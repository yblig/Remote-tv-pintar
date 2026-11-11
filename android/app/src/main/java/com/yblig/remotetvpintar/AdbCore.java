package com.yblig.remotetvpintar;

import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.math.BigInteger;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.interfaces.RSAPublicKey;
import java.util.Base64;

/**
 * Minimal ADB-over-network client (Android TV "Network/USB debugging", port 5555),
 * used to take screenshots of the TV so the phone can watch what is on screen.
 * The TV shows a one-time "Allow debugging?" prompt for this phone's key.
 */
final class AdbCore {
    static final int CNXN = 0x4e584e43, AUTH = 0x48545541, OPEN = 0x4e45504f,
            OKAY = 0x59414b4f, CLSE = 0x45534c43, WRTE = 0x45545257;
    private static final byte[] SHA1_PREFIX = {
            0x30, 0x21, 0x30, 0x09, 0x06, 0x05, 0x2b, 0x0e, 0x03, 0x02, 0x1a, 0x05, 0x00, 0x04, 0x14};

    interface Prompt { void onAuthPrompt(); }

    private Socket sock;
    private DataInputStream in;
    private OutputStream out;
    private int nextId = 1;
    private String host;
    private int maxData = 4096;

    static final class Msg {
        int cmd, arg0, arg1;
        byte[] data;
    }

    synchronized boolean isConnected(String h) { return sock != null && !sock.isClosed() && h.equals(host); }

    private void write(int cmd, int a0, int a1, byte[] data) throws IOException {
        if (data == null) data = new byte[0];
        int sum = 0;
        for (byte b : data) sum += b & 0xFF;
        ByteBuffer bb = ByteBuffer.allocate(24 + data.length).order(ByteOrder.LITTLE_ENDIAN);
        bb.putInt(cmd).putInt(a0).putInt(a1).putInt(data.length).putInt(sum).putInt(~cmd).put(data);
        out.write(bb.array());
        out.flush();
    }

    private Msg read() throws IOException {
        byte[] h = new byte[24];
        in.readFully(h);
        ByteBuffer bb = ByteBuffer.wrap(h).order(ByteOrder.LITTLE_ENDIAN);
        Msg m = new Msg();
        m.cmd = bb.getInt();
        m.arg0 = bb.getInt();
        m.arg1 = bb.getInt();
        int len = bb.getInt();
        if (len < 0 || len > 16 * 1024 * 1024) throw new IOException("ADB_BAD_LENGTH");
        m.data = new byte[len];
        in.readFully(m.data);
        return m;
    }

    /** ADB's custom public key format: base64(struct RSAPublicKey) + " name\0". */
    static byte[] adbPublicKey(RSAPublicKey pub, String name) {
        BigInteger n = pub.getModulus();
        int words = 64; // 2048-bit
        BigInteger r32 = BigInteger.ONE.shiftLeft(32);
        BigInteger n0inv = n.mod(r32).modInverse(r32);
        n0inv = r32.subtract(n0inv);
        BigInteger rr = BigInteger.ONE.shiftLeft(4096).mod(n);
        ByteBuffer bb = ByteBuffer.allocate(4 + 4 + words * 4 + words * 4 + 4).order(ByteOrder.LITTLE_ENDIAN);
        bb.putInt(words);
        bb.putInt(n0inv.intValue());
        BigInteger t = n;
        for (int i = 0; i < words; i++) { bb.putInt(t.mod(r32).intValue()); t = t.shiftRight(32); }
        t = rr;
        for (int i = 0; i < words; i++) { bb.putInt(t.mod(r32).intValue()); t = t.shiftRight(32); }
        bb.putInt(pub.getPublicExponent().intValue());
        String s = Base64.getEncoder().encodeToString(bb.array()) + " " + name + "\u0000";
        return s.getBytes(StandardCharsets.UTF_8);
    }

    static byte[] sign(PrivateKey key, byte[] token) throws Exception {
        Signature s = Signature.getInstance("NONEwithRSA");
        s.initSign(key);
        byte[] d = new byte[SHA1_PREFIX.length + token.length];
        System.arraycopy(SHA1_PREFIX, 0, d, 0, SHA1_PREFIX.length);
        System.arraycopy(token, 0, d, SHA1_PREFIX.length, token.length);
        s.update(d);
        return s.sign();
    }

    synchronized void connect(String host, int port, PrivateKey key, RSAPublicKey pub, Prompt prompt) throws Exception {
        close();
        Socket s = new Socket();
        s.connect(new InetSocketAddress(host, port), 5000);
        s.setSoTimeout(8000);
        sock = s;
        in = new DataInputStream(s.getInputStream());
        out = s.getOutputStream();
        this.host = host;
        write(CNXN, 0x01000000, 256 * 1024, "host::remotetvpintar\u0000".getBytes(StandardCharsets.UTF_8));
        boolean sentSig = false, sentKey = false;
        while (true) {
            Msg m;
            try {
                m = read();
            } catch (java.net.SocketTimeoutException e) {
                if (sentKey) continue; // waiting for the user to accept on the TV
                throw e;
            }
            if (m.cmd == CNXN) {
                maxData = Math.max(4096, m.arg1);
                s.setSoTimeout(45000);
                return;
            }
            if (m.cmd == AUTH && m.arg0 == 1) {
                if (!sentSig) {
                    write(AUTH, 2, 0, sign(key, m.data));
                    sentSig = true;
                } else if (!sentKey) {
                    write(AUTH, 3, 0, adbPublicKey(pub, "RemoteTVPintar@phone"));
                    sentKey = true;
                    s.setSoTimeout(60000);
                    if (prompt != null) prompt.onAuthPrompt();
                } else {
                    throw new IOException("ADB_DENIED");
                }
            }
        }
    }

    /** Runs a command and returns its raw stdout (exec: service, binary safe). */
    synchronized byte[] exec(String cmd) throws IOException {
        if (sock == null) throw new IOException("ADB_NOT_CONNECTED");
        int local = nextId++;
        write(OPEN, local, 0, ("exec:" + cmd + "\u0000").getBytes(StandardCharsets.UTF_8));
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        int remote = 0;
        while (true) {
            Msg m = read();
            if (m.arg1 != local && m.cmd != CNXN) continue;
            if (m.cmd == OKAY) { remote = m.arg0; }
            else if (m.cmd == WRTE) {
                buf.write(m.data, 0, m.data.length);
                write(OKAY, local, m.arg0, null);
            } else if (m.cmd == CLSE) {
                if (remote != 0) write(CLSE, local, remote, null);
                return buf.toByteArray();
            }
        }
    }

    synchronized void close() {
        if (sock != null) try { sock.close(); } catch (Exception ignored) {}
        sock = null;
        host = null;
    }
}
