package com.yblig.remotetvpintar;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.hardware.ConsumerIrManager;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;
import android.speech.RecognizerIntent;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

/** Native side of Remote TV Pintar: TV protocols, discovery, IR, Wake-on-LAN, voice, volume keys. */
@CapacitorPlugin(name = "TvBridge")
public class TvBridgePlugin extends Plugin {

    static volatile TvBridgePlugin instance;
    static volatile boolean volumeKeys = false;

    private final ExecutorService pool = Executors.newCachedThreadPool();
    private final ExecutorService atvWriter = Executors.newSingleThreadExecutor();
    private final Map<String, WebSocket> sockets = new ConcurrentHashMap<>();
    private OkHttpClient http;
    private AtvCore atv;

    @Override
    public void load() {
        instance = this;
        final SharedPreferences prefs = getContext().getSharedPreferences("tvbridge", Context.MODE_PRIVATE);
        atv = new AtvCore(new AtvCore.Store() {
            public String get(String k) { return prefs.getString(k, null); }
            public void put(String k, String v) { prefs.edit().putString(k, v).apply(); }
        }, new AtvCore.Listener() {
            public void onState(String state, String reason) {
                JSObject o = new JSObject();
                o.put("state", state);
                o.put("reason", reason);
                notifyListeners("atvState", o);
            }
            public void onVolume(int level, int max, boolean muted) {
                JSObject o = new JSObject();
                o.put("level", level);
                o.put("max", max);
                o.put("muted", muted);
                notifyListeners("atvVolume", o);
            }
            public void onApp(String pkg) {
                JSObject o = new JSObject();
                o.put("package", pkg);
                notifyListeners("atvApp", o);
            }
        });
        try {
            X509TrustManager tm = new X509TrustManager() {
                public void checkClientTrusted(X509Certificate[] c, String a) {}
                public void checkServerTrusted(X509Certificate[] c, String a) {}
                public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
            };
            SSLContext ctx = SSLContext.getInstance("TLS");
            ctx.init(null, new TrustManager[]{tm}, new SecureRandom());
            http = new OkHttpClient.Builder()
                    .sslSocketFactory(ctx.getSocketFactory(), tm)
                    .hostnameVerifier((h, s) -> true)
                    .connectTimeout(6, TimeUnit.SECONDS)
                    .readTimeout(0, TimeUnit.SECONDS)
                    .pingInterval(25, TimeUnit.SECONDS)
                    .build();
        } catch (Exception e) {
            http = new OkHttpClient();
        }
    }

    static void emitHwKey(String key) {
        TvBridgePlugin p = instance;
        if (p == null) return;
        JSObject o = new JSObject();
        o.put("key", key);
        p.notifyListeners("hwKey", o);
    }

    private static String err(Exception e) {
        String m = e.getMessage();
        return m == null ? e.getClass().getSimpleName() : m;
    }

    // ------------------------------------------------------------------ info / IR

    private ConsumerIrManager ir() {
        return (ConsumerIrManager) getContext().getSystemService(Context.CONSUMER_IR_SERVICE);
    }

    @PluginMethod
    public void info(PluginCall call) {
        JSObject o = new JSObject();
        boolean hasIr = false;
        try {
            ConsumerIrManager m = ir();
            hasIr = m != null && m.hasIrEmitter();
        } catch (Exception ignored) {}
        o.put("hasIr", hasIr);
        o.put("sdk", android.os.Build.VERSION.SDK_INT);
        o.put("model", android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL);
        call.resolve(o);
    }

    @PluginMethod
    public void irTransmit(PluginCall call) {
        try {
            ConsumerIrManager m = ir();
            if (m == null || !m.hasIrEmitter()) { call.reject("NO_IR"); return; }
            int freq = call.getInt("freq", 38000);
            JSArray arr = call.getArray("pattern");
            int[] p = new int[arr.length()];
            for (int i = 0; i < p.length; i++) p[i] = Math.max(1, arr.getInt(i));
            m.transmit(freq, p);
            call.resolve();
        } catch (Exception e) {
            call.reject(err(e));
        }
    }

    // ------------------------------------------------------------------ discovery

    @PluginMethod
    public void discover(final PluginCall call) {
        final int timeout = call.getInt("timeout", 5000);
        pool.execute(() -> {
            final Map<String, JSObject> found = Collections.synchronizedMap(new LinkedHashMap<>());
            Thread nsdThread = new Thread(() -> discoverAtv(found, timeout));
            Thread ssdpThread = new Thread(() -> discoverSsdp(found, timeout));
            nsdThread.start();
            ssdpThread.start();
            try { nsdThread.join(timeout + 4000); ssdpThread.join(timeout + 4000); } catch (InterruptedException ignored) {}
            JSArray list = new JSArray();
            synchronized (found) { for (JSObject o : found.values()) list.put(o); }
            JSObject res = new JSObject();
            res.put("devices", list);
            call.resolve(res);
        });
    }

    @SuppressWarnings("deprecation")
    private void discoverAtv(final Map<String, JSObject> found, int timeout) {
        final NsdManager nsd = (NsdManager) getContext().getSystemService(Context.NSD_SERVICE);
        if (nsd == null) return;
        final List<NsdServiceInfo> services = Collections.synchronizedList(new ArrayList<>());
        NsdManager.DiscoveryListener dl = new NsdManager.DiscoveryListener() {
            public void onStartDiscoveryFailed(String t, int c) {}
            public void onStopDiscoveryFailed(String t, int c) {}
            public void onDiscoveryStarted(String t) {}
            public void onDiscoveryStopped(String t) {}
            public void onServiceFound(NsdServiceInfo si) { services.add(si); }
            public void onServiceLost(NsdServiceInfo si) {}
        };
        try {
            nsd.discoverServices("_androidtvremote2._tcp", NsdManager.PROTOCOL_DNS_SD, dl);
        } catch (Exception e) { return; }
        try { Thread.sleep(Math.max(1500, timeout - 1500)); } catch (InterruptedException ignored) {}
        try { nsd.stopServiceDiscovery(dl); } catch (Exception ignored) {}
        List<NsdServiceInfo> copy;
        synchronized (services) { copy = new ArrayList<>(services); }
        for (NsdServiceInfo si : copy) {
            final CountDownLatch latch = new CountDownLatch(1);
            final String name = si.getServiceName();
            try {
                nsd.resolveService(si, new NsdManager.ResolveListener() {
                    public void onResolveFailed(NsdServiceInfo s, int c) { latch.countDown(); }
                    public void onServiceResolved(NsdServiceInfo s) {
                        InetAddress a = s.getHost();
                        if (a != null) {
                            String host = a.getHostAddress();
                            JSObject o = new JSObject();
                            o.put("type", "androidtv");
                            o.put("host", host);
                            o.put("name", name);
                            o.put("model", "Android TV / Google TV");
                            found.put(host, o);
                        }
                        latch.countDown();
                    }
                });
                latch.await(2500, TimeUnit.MILLISECONDS);
            } catch (Exception ignored) {}
        }
    }

    private static final String[] SSDP_TARGETS = {
            "urn:samsung.com:device:RemoteControlReceiver:1",
            "urn:lge-com:service:webos-second-screen:1",
            "roku:ecp",
            "urn:dial-multiscreen-org:service:dial:1"
    };

    private void discoverSsdp(Map<String, JSObject> found, int timeout) {
        WifiManager wm = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        WifiManager.MulticastLock lock = null;
        DatagramSocket sock = null;
        Map<String, String[]> hits = new LinkedHashMap<>();
        try {
            if (wm != null) { lock = wm.createMulticastLock("ssdp"); lock.setReferenceCounted(false); lock.acquire(); }
            sock = new DatagramSocket();
            sock.setSoTimeout(400);
            InetAddress group = InetAddress.getByName("239.255.255.250");
            for (int round = 0; round < 2; round++) {
                for (String st : SSDP_TARGETS) {
                    String msg = "M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\nMX: 2\r\nST: " + st + "\r\n\r\n";
                    byte[] b = msg.getBytes(StandardCharsets.US_ASCII);
                    sock.send(new DatagramPacket(b, b.length, group, 1900));
                }
            }
            long end = System.currentTimeMillis() + Math.max(2000, timeout - 1500);
            byte[] buf = new byte[4096];
            while (System.currentTimeMillis() < end) {
                DatagramPacket p = new DatagramPacket(buf, buf.length);
                try { sock.receive(p); } catch (SocketTimeoutException t) { continue; }
                String txt = new String(p.getData(), 0, p.getLength(), StandardCharsets.UTF_8);
                String host = p.getAddress().getHostAddress();
                String st = header(txt, "ST"), server = header(txt, "SERVER"), loc = header(txt, "LOCATION");
                String type = classify(st, server);
                String[] prev = hits.get(host);
                if (prev == null || (prev[0].equals("unknown") && !type.equals("unknown"))) {
                    hits.put(host, new String[]{type, loc == null ? "" : loc, server == null ? "" : server});
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (sock != null) sock.close();
            if (lock != null) try { lock.release(); } catch (Exception ignored) {}
        }
        List<Thread> fetchers = new ArrayList<>();
        for (Map.Entry<String, String[]> e : hits.entrySet()) {
            final String host = e.getKey();
            final String[] v = e.getValue();
            if (found.containsKey(host)) continue;
            Thread t = new Thread(() -> {
                String name = null, maker = null, model = null;
                if (!v[1].isEmpty()) {
                    try {
                        String xml = httpGet(v[1], 1800);
                        name = tag(xml, "friendlyName");
                        maker = tag(xml, "manufacturer");
                        model = tag(xml, "modelName");
                    } catch (Exception ignored) {}
                }
                String type = v[0];
                if (type.equals("unknown") && maker != null) type = classify(maker, maker);
                if (type.equals("unknown")) return; // only list TVs we can control
                JSObject o = new JSObject();
                o.put("type", type);
                o.put("host", host);
                o.put("name", name != null ? name : defaultName(type));
                o.put("model", model != null ? (maker != null ? maker + " " : "") + model : "");
                if (!found.containsKey(host)) found.put(host, o);
            });
            t.start();
            fetchers.add(t);
        }
        for (Thread t : fetchers) try { t.join(2500); } catch (InterruptedException ignored) {}
    }

    private static String defaultName(String type) {
        switch (type) {
            case "samsung": return "Samsung Smart TV";
            case "lg": return "LG webOS TV";
            case "roku": return "Roku TV";
            default: return "Smart TV";
        }
    }

    private static String classify(String a, String b) {
        String s = ((a == null ? "" : a) + " " + (b == null ? "" : b)).toLowerCase(Locale.ROOT);
        if (s.contains("roku")) return "roku";
        if (s.contains("samsung") || s.contains("tizen")) return "samsung";
        if (s.contains("lge") || s.contains("webos") || s.contains("lg electronics")) return "lg";
        return "unknown";
    }

    private static String header(String txt, String name) {
        Matcher m = Pattern.compile("(?im)^" + name + ":\\s*(.+?)\\s*$").matcher(txt);
        return m.find() ? m.group(1) : null;
    }

    private static String tag(String xml, String t) {
        Matcher m = Pattern.compile("<" + t + ">([^<]*)</" + t + ">").matcher(xml);
        return m.find() ? m.group(1).trim() : null;
    }

    private static String httpGet(String url, int timeout) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(timeout);
        c.setReadTimeout(timeout);
        try (InputStream in = c.getInputStream()) { return readAll(in); } finally { c.disconnect(); }
    }

    private static String readAll(InputStream in) throws Exception {
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        byte[] b = new byte[8192];
        int n;
        while ((n = in.read(b)) > 0 && o.size() < 2_000_000) o.write(b, 0, n);
        return o.toString("UTF-8");
    }

    // ------------------------------------------------------------------ HTTP (Roku, Samsung info)

    @PluginMethod
    public void http(final PluginCall call) {
        pool.execute(() -> {
            HttpURLConnection c = null;
            try {
                String method = call.getString("method", "GET");
                c = (HttpURLConnection) new URL(call.getString("url")).openConnection();
                int t = call.getInt("timeout", 4000);
                c.setConnectTimeout(t);
                c.setReadTimeout(t);
                c.setRequestMethod(method);
                String body = call.getString("body");
                if (body != null || "POST".equals(method)) {
                    c.setDoOutput(true);
                    byte[] b = (body == null ? "" : body).getBytes(StandardCharsets.UTF_8);
                    c.setFixedLengthStreamingMode(b.length);
                    try (OutputStream o = c.getOutputStream()) { o.write(b); }
                }
                int code = c.getResponseCode();
                String txt = "";
                try (InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream()) {
                    if (in != null) txt = readAll(in);
                }
                JSObject o = new JSObject();
                o.put("status", code);
                o.put("body", txt);
                call.resolve(o);
            } catch (Exception e) {
                call.reject(err(e));
            } finally {
                if (c != null) c.disconnect();
            }
        });
    }

    // ------------------------------------------------------------------ WebSocket (Samsung, LG)

    @PluginMethod
    public void wsOpen(final PluginCall call) {
        final String id = call.getString("id");
        final String url = call.getString("url");
        if (id == null || url == null) { call.reject("BAD_ARGS"); return; }
        WebSocket old = sockets.remove(id);
        if (old != null) old.cancel();
        final AtomicBoolean settled = new AtomicBoolean(false);
        Request req = new Request.Builder().url(url).build();
        WebSocket ws = http.newWebSocket(req, new WebSocketListener() {
            @Override public void onOpen(WebSocket w, Response r) {
                if (settled.compareAndSet(false, true)) call.resolve();
            }
            @Override public void onMessage(WebSocket w, String text) {
                JSObject o = new JSObject();
                o.put("id", id);
                o.put("text", text);
                notifyListeners("wsMessage", o);
            }
            @Override public void onClosed(WebSocket w, int code, String reason) { closed(w, code, reason); }
            @Override public void onClosing(WebSocket w, int code, String reason) { w.close(1000, null); }
            @Override public void onFailure(WebSocket w, Throwable t, Response r) {
                String msg = t.getMessage() == null ? t.getClass().getSimpleName() : t.getMessage();
                if (settled.compareAndSet(false, true)) call.reject(msg);
                closed(w, -1, msg);
            }
            private void closed(WebSocket w, int code, String reason) {
                if (sockets.get(id) != w) return;
                sockets.remove(id);
                JSObject o = new JSObject();
                o.put("id", id);
                o.put("code", code);
                o.put("reason", reason);
                notifyListeners("wsClose", o);
            }
        });
        sockets.put(id, ws);
    }

    @PluginMethod
    public void wsSend(PluginCall call) {
        WebSocket ws = sockets.get(call.getString("id", ""));
        if (ws == null) { call.reject("NOT_CONNECTED"); return; }
        if (ws.send(call.getString("text", ""))) call.resolve(); else call.reject("SEND_FAILED");
    }

    @PluginMethod
    public void wsClose(PluginCall call) {
        WebSocket ws = sockets.remove(call.getString("id", ""));
        if (ws != null) ws.close(1000, null);
        call.resolve();
    }

    // ------------------------------------------------------------------ Android TV

    @PluginMethod
    public void atvStartPairing(final PluginCall call) {
        final String host = call.getString("host");
        final String name = call.getString("name", "Remote TV Pintar");
        pool.execute(() -> {
            try { atv.startPairing(host, name); call.resolve(); } catch (Exception e) { call.reject(err(e)); }
        });
    }

    @PluginMethod
    public void atvFinishPairing(final PluginCall call) {
        final String code = call.getString("code", "");
        pool.execute(() -> {
            try { atv.finishPairing(code); call.resolve(); } catch (Exception e) { call.reject(err(e)); }
        });
    }

    @PluginMethod
    public void atvCancelPairing(PluginCall call) {
        pool.execute(() -> atv.closePairing());
        call.resolve();
    }

    @PluginMethod
    public void atvConnect(final PluginCall call) {
        final String host = call.getString("host");
        pool.execute(() -> {
            try { atv.connect(host); call.resolve(); } catch (Exception e) { call.reject(err(e)); }
        });
    }

    @PluginMethod
    public void atvDisconnect(PluginCall call) {
        pool.execute(() -> atv.disconnect());
        call.resolve();
    }

    @PluginMethod
    public void atvKey(final PluginCall call) {
        final int code = call.getInt("code", 0);
        final int dir = call.getInt("dir", AtvCore.DIR_SHORT);
        atvWriter.execute(() -> {
            try { atv.sendKey(code, dir); call.resolve(); } catch (Exception e) { call.reject(err(e)); }
        });
    }

    @PluginMethod
    public void atvText(final PluginCall call) {
        final String text = call.getString("text", "");
        atvWriter.execute(() -> {
            try { atv.sendText(text); call.resolve(); } catch (Exception e) { call.reject(err(e)); }
        });
    }

    @PluginMethod
    public void atvLaunch(final PluginCall call) {
        final String link = call.getString("link", "");
        atvWriter.execute(() -> {
            try { atv.launch(link); call.resolve(); } catch (Exception e) { call.reject(err(e)); }
        });
    }

    // ------------------------------------------------------------------ Wake-on-LAN

    @PluginMethod
    public void wol(final PluginCall call) {
        final String mac = call.getString("mac", "");
        pool.execute(() -> {
            try {
                String hex = mac.replaceAll("[^0-9A-Fa-f]", "");
                if (hex.length() != 12) throw new Exception("BAD_MAC");
                byte[] m = new byte[6];
                for (int i = 0; i < 6; i++) m[i] = (byte) Integer.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
                byte[] pkt = new byte[102];
                for (int i = 0; i < 6; i++) pkt[i] = (byte) 0xFF;
                for (int i = 6; i < pkt.length; i++) pkt[i] = m[(i - 6) % 6];
                try (DatagramSocket s = new DatagramSocket()) {
                    s.setBroadcast(true);
                    InetAddress all = InetAddress.getByName("255.255.255.255");
                    for (int r = 0; r < 3; r++) {
                        s.send(new DatagramPacket(pkt, pkt.length, all, 9));
                        s.send(new DatagramPacket(pkt, pkt.length, all, 7));
                        String host = call.getString("host");
                        if (host != null && host.matches("\\d+\\.\\d+\\.\\d+\\.\\d+")) {
                            String bc = host.substring(0, host.lastIndexOf('.')) + ".255";
                            s.send(new DatagramPacket(pkt, pkt.length, InetAddress.getByName(bc), 9));
                        }
                        Thread.sleep(80);
                    }
                }
                call.resolve();
            } catch (Exception e) {
                call.reject(err(e));
            }
        });
    }

    // ------------------------------------------------------------------ voice typing

    @PluginMethod
    public void speech(PluginCall call) {
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, call.getString("lang", "id-ID"));
        i.putExtra(RecognizerIntent.EXTRA_PROMPT, call.getString("prompt", "Ucapkan teks untuk TV"));
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        try {
            startActivityForResult(call, i, "onSpeech");
        } catch (ActivityNotFoundException e) {
            call.reject("NO_SPEECH");
        } catch (Exception e) {
            call.reject(err(e));
        }
    }

    @ActivityCallback
    private void onSpeech(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) { call.reject("CANCELLED"); return; }
        ArrayList<String> r = result.getData().getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        JSObject o = new JSObject();
        o.put("text", r == null || r.isEmpty() ? "" : r.get(0));
        call.resolve(o);
    }

    // ------------------------------------------------------------------ phone volume keys

    @PluginMethod
    public void setVolumeKeys(PluginCall call) {
        volumeKeys = call.getBoolean("enabled", false);
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        try { atv.disconnect(); } catch (Exception ignored) {}
        for (WebSocket w : sockets.values()) w.cancel();
        sockets.clear();
        super.handleOnDestroy();
    }
}
