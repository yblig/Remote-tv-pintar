package com.yblig.remotetvpintar;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.math.BigInteger;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.Principal;
import java.security.PrivateKey;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import javax.net.ssl.KeyManager;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLEngine;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509ExtendedKeyManager;
import javax.net.ssl.X509TrustManager;

/**
 * Android TV Remote protocol v2 (the protocol of Google's "Google TV" phone remote).
 * Pairing on port 6467 with a 6-hex-digit code shown on the TV, then a persistent
 * TLS session on port 6466 for keys, text (IME) and app links.
 * Pure Java so it can be unit-tested off-device.
 */
final class AtvCore {

    interface Store {
        String get(String key);
        void put(String key, String value);
    }

    interface Listener {
        void onState(String state, String reason);
        void onVolume(int level, int max, boolean muted);
        void onApp(String pkg);
    }

    static final int FEATURES = 1 | 2 | 4 | 32 | 64 | 512; // PING KEY IME POWER VOLUME APP_LINK
    static final int DIR_SHORT = 3, DIR_START_LONG = 1, DIR_END_LONG = 2;

    private final Store store;
    private final Listener listener;
    private PrivateKey privateKey;
    private X509Certificate cert;

    private SSLSocket pairSocket;
    private SSLSocket remoteSocket;
    private OutputStream remoteOut;
    private volatile boolean remoteAlive;
    private int imeCounter = 0, fieldCounter = 0;
    private String host;

    AtvCore(Store store, Listener listener) {
        this.store = store;
        this.listener = listener;
    }

    // ---------------------------------------------------------------- certificate

    synchronized void ensureCert() throws Exception {
        if (cert != null) return;
        String k = store.get("atv_key"), c = store.get("atv_cert");
        if (k != null && c != null) {
            try {
                privateKey = KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(k)));
                cert = (X509Certificate) CertificateFactory.getInstance("X.509")
                        .generateCertificate(new ByteArrayInputStream(Base64.getDecoder().decode(c)));
                return;
            } catch (Exception ignored) { /* regenerate */ }
        }
        KeyPairGenerator g = KeyPairGenerator.getInstance("RSA");
        g.initialize(2048, new SecureRandom());
        KeyPair kp = g.generateKeyPair();
        byte[] der = selfSigned(kp, "atvremote");
        cert = (X509Certificate) CertificateFactory.getInstance("X.509").generateCertificate(new ByteArrayInputStream(der));
        privateKey = kp.getPrivate();
        store.put("atv_key", Base64.getEncoder().encodeToString(privateKey.getEncoded()));
        store.put("atv_cert", Base64.getEncoder().encodeToString(der));
    }

    private static byte[] tlv(int tag, byte[]... parts) {
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        for (byte[] p : parts) body.write(p, 0, p.length);
        byte[] c = body.toByteArray();
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        o.write(tag);
        int len = c.length;
        if (len < 128) o.write(len);
        else if (len < 256) { o.write(0x81); o.write(len); }
        else if (len < 65536) { o.write(0x82); o.write(len >> 8); o.write(len & 0xFF); }
        else { o.write(0x83); o.write(len >> 16); o.write((len >> 8) & 0xFF); o.write(len & 0xFF); }
        o.write(c, 0, c.length);
        return o.toByteArray();
    }

    private static byte[] hex(String h) {
        byte[] r = new byte[h.length() / 2];
        for (int i = 0; i < r.length; i++) r[i] = (byte) Integer.parseInt(h.substring(i * 2, i * 2 + 2), 16);
        return r;
    }

    static byte[] selfSigned(KeyPair kp, String cn) throws Exception {
        byte[] sha256Rsa = tlv(0x30, hex("06092A864886F70D01010B"), hex("0500"));
        byte[] name = tlv(0x30, tlv(0x31, tlv(0x30, hex("0603550403"), tlv(0x0C, cn.getBytes(StandardCharsets.UTF_8)))));
        byte[] validity = tlv(0x30,
                tlv(0x17, "250101000000Z".getBytes(StandardCharsets.US_ASCII)),
                tlv(0x18, "20541231000000Z".getBytes(StandardCharsets.US_ASCII)));
        byte[] serial = tlv(0x02, new BigInteger(62, new SecureRandom()).add(BigInteger.ONE).toByteArray());
        byte[] version = tlv(0xA0, tlv(0x02, new byte[]{2}));
        byte[] tbs = tlv(0x30, version, serial, sha256Rsa, name, validity, name, kp.getPublic().getEncoded());
        Signature s = Signature.getInstance("SHA256withRSA");
        s.initSign(kp.getPrivate());
        s.update(tbs);
        byte[] sig = s.sign();
        byte[] bits = new byte[sig.length + 1];
        System.arraycopy(sig, 0, bits, 1, sig.length);
        return tlv(0x30, tbs, sha256Rsa, tlv(0x03, bits));
    }

    // ---------------------------------------------------------------- TLS

    private SSLSocket open(String host, int port, int timeoutMs) throws Exception {
        ensureCert();
        final PrivateKey pk = privateKey;
        final X509Certificate[] chain = {cert};
        KeyManager km = new X509ExtendedKeyManager() {
            public String[] getClientAliases(String t, Principal[] i) { return new String[]{"c"}; }
            public String chooseClientAlias(String[] t, Principal[] i, Socket s) { return "c"; }
            public String chooseEngineClientAlias(String[] t, Principal[] i, SSLEngine e) { return "c"; }
            public String[] getServerAliases(String t, Principal[] i) { return null; }
            public String chooseServerAlias(String t, Principal[] i, Socket s) { return null; }
            public X509Certificate[] getCertificateChain(String a) { return chain; }
            public PrivateKey getPrivateKey(String a) { return pk; }
        };
        TrustManager tm = new X509TrustManager() {
            public void checkClientTrusted(X509Certificate[] c, String a) {}
            public void checkServerTrusted(X509Certificate[] c, String a) {}
            public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
        };
        SSLContext ctx = SSLContext.getInstance("TLS");
        ctx.init(new KeyManager[]{km}, new TrustManager[]{tm}, new SecureRandom());
        Socket raw = new Socket();
        raw.connect(new InetSocketAddress(host, port), timeoutMs);
        SSLSocket s = (SSLSocket) ctx.getSocketFactory().createSocket(raw, host, port, true);
        s.setSoTimeout(timeoutMs);
        s.startHandshake();
        return s;
    }

    // ---------------------------------------------------------------- pairing (6467)

    private static Proto.W outer() { return new Proto.W().i(1, 2).i(2, 200); }

    private static Proto.M readPairing(InputStream in) throws IOException {
        Proto.M m = Proto.parse(Proto.readDelimited(in));
        long status = m.i(2, 200);
        if (status != 200) throw new IOException("PAIRING_STATUS_" + status);
        return m;
    }

    synchronized void startPairing(String host, String clientName) throws Exception {
        closePairing();
        pairSocket = open(host, 6467, 8000);
        pairSocket.setSoTimeout(12000);
        OutputStream out = pairSocket.getOutputStream();
        InputStream in = pairSocket.getInputStream();
        Proto.W req = new Proto.W().str(1, "atvremote").str(2, clientName);
        Proto.writeDelimited(out, outer().msg(10, req).toBytes());
        if (!readPairing(in).has(11)) throw new IOException("PAIRING_NO_ACK");
        Proto.W enc = new Proto.W().i(1, 3).i(2, 6);
        Proto.W opt = new Proto.W().msg(1, enc).i(3, 1);
        Proto.writeDelimited(out, outer().msg(20, opt).toBytes());
        if (!readPairing(in).has(20)) throw new IOException("PAIRING_NO_OPTIONS");
        Proto.W cfg = new Proto.W().msg(1, enc).i(2, 1);
        Proto.writeDelimited(out, outer().msg(30, cfg).toBytes());
        if (!readPairing(in).has(31)) throw new IOException("PAIRING_NO_CONFIG_ACK");
        // The TV now shows the code. Keep the socket open until finishPairing.
        pairSocket.setSoTimeout(0);
    }

    private static byte[] hexBytesOf(BigInteger v, boolean prefixZero) {
        String h = v.toString(16).toUpperCase();
        if (prefixZero) h = "0" + h;
        if (h.length() % 2 == 1) h = "0" + h;
        return hex(h);
    }

    static byte[] secret(RSAPublicKey client, RSAPublicKey server, String code) throws Exception {
        MessageDigest d = MessageDigest.getInstance("SHA-256");
        d.update(hexBytesOf(client.getModulus(), false));
        d.update(hexBytesOf(client.getPublicExponent(), true));
        d.update(hexBytesOf(server.getModulus(), false));
        d.update(hexBytesOf(server.getPublicExponent(), true));
        d.update(hex(code.substring(2)));
        return d.digest();
    }

    synchronized void finishPairing(String code) throws Exception {
        if (pairSocket == null) throw new IOException("PAIRING_NOT_STARTED");
        code = code.trim().toUpperCase();
        if (!code.matches("[0-9A-F]{6}")) throw new IOException("BAD_CODE");
        RSAPublicKey server = (RSAPublicKey) pairSocket.getSession().getPeerCertificates()[0].getPublicKey();
        byte[] h = secret((RSAPublicKey) cert.getPublicKey(), server, code);
        if ((h[0] & 0xFF) != Integer.parseInt(code.substring(0, 2), 16)) throw new IOException("WRONG_CODE");
        pairSocket.setSoTimeout(10000);
        Proto.writeDelimited(pairSocket.getOutputStream(), outer().msg(40, new Proto.W().bytes(1, h)).toBytes());
        Proto.M ack = readPairing(pairSocket.getInputStream());
        closePairing();
        if (!ack.has(41)) throw new IOException("PAIRING_NO_SECRET_ACK");
    }

    synchronized void closePairing() {
        if (pairSocket != null) try { pairSocket.close(); } catch (Exception ignored) {}
        pairSocket = null;
    }

    // ---------------------------------------------------------------- remote (6466)

    void connect(String host) throws Exception {
        disconnect();
        this.host = host;
        final SSLSocket s = open(host, 6466, 8000);
        s.setSoTimeout(0);
        final CountDownLatch ready = new CountDownLatch(1);
        final String[] err = {null};
        synchronized (this) {
            remoteSocket = s;
            remoteOut = s.getOutputStream();
            remoteAlive = true;
        }
        Thread t = new Thread(() -> {
            String reason = "closed";
            try {
                InputStream in = s.getInputStream();
                while (remoteAlive) {
                    Proto.M m = Proto.parse(Proto.readDelimited(in));
                    if (m.has(1)) {
                        Proto.W info = new Proto.W().str(1, "Remote TV Pintar").str(2, "yblig").i(3, 1)
                                .str(4, "1").str(5, "atvremote").str(6, "1.0.0");
                        send(new Proto.W().msg(1, new Proto.W().i(1, FEATURES).msg(2, info)));
                    } else if (m.has(2)) {
                        send(new Proto.W().msg(2, new Proto.W().i(1, FEATURES)));
                        ready.countDown();
                    } else if (m.has(8)) {
                        Proto.M p = m.m(8);
                        send(new Proto.W().msg(9, new Proto.W().i(1, p == null ? 0 : p.i(1, 0))));
                    } else if (m.has(21)) {
                        Proto.M e = m.m(21);
                        if (e != null) {
                            imeCounter = (int) e.i(1, imeCounter);
                            fieldCounter = (int) e.i(2, fieldCounter);
                        }
                    } else if (m.has(20)) {
                        Proto.M k = m.m(20);
                        Proto.M app = k == null ? null : k.m(1);
                        String pkg = app == null ? null : app.s(12);
                        if (pkg != null) listener.onApp(pkg);
                    } else if (m.has(50)) {
                        Proto.M v = m.m(50);
                        if (v != null) listener.onVolume((int) v.i(7, 0), (int) v.i(6, 100), v.i(8, 0) != 0);
                    } else if (m.has(40)) {
                        ready.countDown();
                    } else if (m.has(3)) {
                        reason = "remote_error";
                    }
                }
            } catch (Exception e) {
                reason = String.valueOf(e.getMessage());
                err[0] = reason;
            } finally {
                ready.countDown();
                boolean was;
                synchronized (AtvCore.this) {
                    was = remoteSocket == s;
                    if (was) { remoteAlive = false; remoteSocket = null; remoteOut = null; }
                }
                try { s.close(); } catch (Exception ignored) {}
                if (was) listener.onState("disconnected", reason);
            }
        }, "atv-remote");
        t.setDaemon(true);
        t.start();
        if (!ready.await(8, TimeUnit.SECONDS)) {
            // Some TVs skip set_active until the first key; treat a live socket as connected.
            if (!isConnected()) throw new IOException("TIMEOUT");
        }
        if (!isConnected()) throw new IOException(err[0] != null ? "NOT_PAIRED: " + err[0] : "NOT_PAIRED");
        listener.onState("connected", null);
    }

    synchronized boolean isConnected() { return remoteAlive && remoteSocket != null; }

    private void send(Proto.W m) throws IOException {
        synchronized (this) {
            if (remoteOut == null) throw new IOException("NOT_CONNECTED");
            Proto.writeDelimited(remoteOut, m.toBytes());
        }
    }

    void sendKey(int keyCode, int direction) throws IOException {
        send(new Proto.W().msg(10, new Proto.W().i(1, keyCode).i(2, direction)));
    }

    void sendText(String text) throws IOException {
        if (text == null || text.isEmpty()) return;
        int p = text.length() - 1;
        Proto.W obj = new Proto.W().i(1, p).i(2, p).str(3, text);
        Proto.W edit = new Proto.W().i(1, 1).msg(2, obj);
        send(new Proto.W().msg(21, new Proto.W().i(1, imeCounter).i(2, fieldCounter).msg(3, edit)));
    }

    void launch(String link) throws IOException {
        send(new Proto.W().msg(90, new Proto.W().str(1, link)));
    }

    void disconnect() {
        SSLSocket s;
        synchronized (this) {
            s = remoteSocket;
            remoteSocket = null;
            remoteOut = null;
            remoteAlive = false;
        }
        if (s != null) try { s.close(); } catch (Exception ignored) {}
    }

    String host() { return host; }
}
