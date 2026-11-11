package com.yblig.rtpcast;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.IBinder;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import java.util.Locale;

/**
 * Foreground service that speaks text (phone-less TTS, on the TV itself) or plays
 * an audio file through the TV speakers WITHOUT taking over the screen — so you can
 * talk through the TV while the show keeps playing. Launched over ADB with
 * --es say <text> [--es lang id] or --es audio <path>.
 */
public class CastService extends Service {

    private static final String CH = "rtpcast";
    private TextToSpeech tts;
    private MediaPlayer player;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startAsForeground();
        if (intent != null) {
            String say = intent.getStringExtra("say");
            String audio = intent.getStringExtra("audio");
            String lang = intent.getStringExtra("lang");
            if (audio != null) playAudio(audio);
            else if (say != null) speak(say, lang == null ? "id" : lang);
            else stopSelf();
        }
        return START_NOT_STICKY;
    }

    private void startAsForeground() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel c = new NotificationChannel(CH, "Cast", NotificationManager.IMPORTANCE_LOW);
            nm.createNotificationChannel(c);
        }
        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CH) : new Notification.Builder(this);
        Notification n = b.setContentTitle("Remote TV Pintar").setContentText("Memutar suara…")
                .setSmallIcon(android.R.drawable.ic_lock_silent_mode_off).build();
        try { startForeground(1, n); } catch (Throwable ignored) {}
    }

    private void speak(String text, String lang) {
        tts = new TextToSpeech(this, status -> {
            if (status != TextToSpeech.SUCCESS) { stopSelf(); return; }
            try { tts.setLanguage(new Locale(lang, "ID")); } catch (Throwable ignored) {}
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                public void onStart(String id) {}
                public void onDone(String id) { stopSelf(); }
                public void onError(String id) { stopSelf(); }
            });
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "rtp");
        });
    }

    private void playAudio(String path) {
        try {
            player = new MediaPlayer();
            player.setDataSource(path);
            player.setOnCompletionListener(mp -> stopSelf());
            player.setOnErrorListener((mp, w, e) -> { stopSelf(); return true; });
            player.prepare();
            player.start();
        } catch (Throwable e) { stopSelf(); }
    }

    @Override
    public void onDestroy() {
        if (tts != null) { try { tts.shutdown(); } catch (Throwable ignored) {} tts = null; }
        if (player != null) { try { player.release(); } catch (Throwable ignored) {} player = null; }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
