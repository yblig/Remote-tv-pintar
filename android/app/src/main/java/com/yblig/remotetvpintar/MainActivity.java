package com.yblig.remotetvpintar;

import android.os.Bundle;
import android.view.KeyEvent;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TvBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }

    // Phone volume buttons control the TV volume when enabled in Settings.
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int code = event.getKeyCode();
        if (TvBridgePlugin.volumeKeys && (code == KeyEvent.KEYCODE_VOLUME_UP || code == KeyEvent.KEYCODE_VOLUME_DOWN)) {
            if (event.getAction() == KeyEvent.ACTION_DOWN) {
                TvBridgePlugin.emitHwKey(code == KeyEvent.KEYCODE_VOLUME_UP ? "volup" : "voldown");
            }
            return true;
        }
        return super.dispatchKeyEvent(event);
    }
}
