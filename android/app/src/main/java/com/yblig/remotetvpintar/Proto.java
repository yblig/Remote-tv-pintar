package com.yblig.remotetvpintar;

import java.io.ByteArrayOutputStream;
import java.io.EOFException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Minimal protobuf writer/reader (varint + length-delimited fields only). */
final class Proto {
    private Proto() {}

    static final class W {
        private final ByteArrayOutputStream b = new ByteArrayOutputStream();

        W varint(long v) {
            while ((v & ~0x7FL) != 0) {
                b.write((int) ((v & 0x7F) | 0x80));
                v >>>= 7;
            }
            b.write((int) v);
            return this;
        }

        W tag(int field, int wireType) { return varint(((long) field << 3) | wireType); }

        W i(int field, long v) { tag(field, 0); return varint(v); }

        W bool(int field, boolean v) { return i(field, v ? 1 : 0); }

        W bytes(int field, byte[] d) {
            tag(field, 2);
            varint(d.length);
            b.write(d, 0, d.length);
            return this;
        }

        W str(int field, String s) { return bytes(field, s.getBytes(StandardCharsets.UTF_8)); }

        W msg(int field, W m) { return bytes(field, m.toBytes()); }

        byte[] toBytes() { return b.toByteArray(); }
    }

    /** Parsed message: field number -> values (Long for varints, byte[] for length-delimited). */
    static final class M {
        final Map<Integer, List<Object>> f = new HashMap<>();

        boolean has(int field) { return f.containsKey(field); }

        long i(int field, long def) {
            List<Object> l = f.get(field);
            if (l == null) return def;
            for (Object o : l) if (o instanceof Long) return (Long) o;
            return def;
        }

        byte[] b(int field) {
            List<Object> l = f.get(field);
            if (l == null) return null;
            for (Object o : l) if (o instanceof byte[]) return (byte[]) o;
            return null;
        }

        String s(int field) {
            byte[] d = b(field);
            return d == null ? null : new String(d, StandardCharsets.UTF_8);
        }

        M m(int field) {
            byte[] d = b(field);
            if (d == null) return null;
            try { return parse(d); } catch (IOException e) { return null; }
        }
    }

    static M parse(byte[] d) throws IOException {
        M m = new M();
        int[] pos = {0};
        while (pos[0] < d.length) {
            long key = readVarint(d, pos);
            int field = (int) (key >>> 3);
            int wt = (int) (key & 7);
            Object val;
            switch (wt) {
                case 0: val = readVarint(d, pos); break;
                case 1: pos[0] += 8; continue;
                case 2: {
                    int len = (int) readVarint(d, pos);
                    if (len < 0 || pos[0] + len > d.length) throw new IOException("bad length");
                    byte[] sub = new byte[len];
                    System.arraycopy(d, pos[0], sub, 0, len);
                    pos[0] += len;
                    val = sub;
                    break;
                }
                case 5: pos[0] += 4; continue;
                default: throw new IOException("bad wire type " + wt);
            }
            m.f.computeIfAbsent(field, k -> new ArrayList<>()).add(val);
        }
        return m;
    }

    private static long readVarint(byte[] d, int[] pos) throws IOException {
        long r = 0;
        int shift = 0;
        while (true) {
            if (pos[0] >= d.length) throw new IOException("truncated varint");
            int c = d[pos[0]++] & 0xFF;
            r |= (long) (c & 0x7F) << shift;
            if ((c & 0x80) == 0) return r;
            shift += 7;
            if (shift > 63) throw new IOException("varint too long");
        }
    }

    static void writeDelimited(OutputStream out, byte[] msg) throws IOException {
        W len = new W().varint(msg.length);
        byte[] l = len.toBytes();
        byte[] all = new byte[l.length + msg.length];
        System.arraycopy(l, 0, all, 0, l.length);
        System.arraycopy(msg, 0, all, l.length, msg.length);
        out.write(all);
        out.flush();
    }

    static byte[] readDelimited(InputStream in) throws IOException {
        long len = 0;
        int shift = 0;
        while (true) {
            int c = in.read();
            if (c < 0) throw new EOFException("closed");
            len |= (long) (c & 0x7F) << shift;
            if ((c & 0x80) == 0) break;
            shift += 7;
            if (shift > 35) throw new IOException("bad length");
        }
        if (len > 1 << 20) throw new IOException("message too large");
        byte[] buf = new byte[(int) len];
        int off = 0;
        while (off < buf.length) {
            int n = in.read(buf, off, buf.length - off);
            if (n < 0) throw new EOFException("closed");
            off += n;
        }
        return buf;
    }
}
