package com.yblig.rtpcast;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.media.MediaPlayer;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;

/**
 * Fullscreen image display for the "Jahilin TV" prank. Launched over ADB by the
 * phone app with --es img <path> (and optional --es sound <path>). singleTask so a
 * second launch reuses the same instance and pops instantly.
 */
public class CastActivity extends Activity {

    private ImageView view;
    private MediaPlayer player;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED);
        view = new ImageView(this);
        view.setBackgroundColor(Color.BLACK);
        view.setScaleType(ImageView.ScaleType.FIT_CENTER);
        setContentView(view);
        hideBars();
        handle(getIntent());
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        hideBars();
        handle(intent);
    }

    private void handle(android.content.Intent intent) {
        if (intent == null) return;
        if ("close".equals(intent.getStringExtra("action"))) { finish(); return; }
        String img = intent.getStringExtra("img");
        if (img != null) {
            try {
                BitmapFactory.Options o = new BitmapFactory.Options();
                o.inPreferredConfig = Bitmap.Config.RGB_565;
                Bitmap bmp = BitmapFactory.decodeFile(img, o);
                if (bmp != null) view.setImageBitmap(bmp);
            } catch (Throwable ignored) {}
        }
        String sound = intent.getStringExtra("sound");
        if (sound != null) playSound(sound);
    }

    private void playSound(String path) {
        try {
            if (player != null) { player.release(); player = null; }
            player = new MediaPlayer();
            player.setDataSource(path);
            player.setOnCompletionListener(mp -> { mp.release(); if (player == mp) player = null; });
            player.prepare();
            player.start();
        } catch (Throwable ignored) {}
    }

    private void hideBars() {
        View d = getWindow().getDecorView();
        d.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (player != null) { try { player.release(); } catch (Throwable ignored) {} player = null; }
    }
}
