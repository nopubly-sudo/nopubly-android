package com.nopubly;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "NopublyBoot";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            SharedPreferences prefs = context.getSharedPreferences("NopublySettings", Context.MODE_PRIVATE);
            boolean autoStart = prefs.getBoolean("auto_start", false);

            Log.i(TAG, "Device booted. Auto-start enabled: " + autoStart);

            if (autoStart) {
                Intent vpnIntent = new Intent(context, AdBlockVpnService.class);
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    context.startForegroundService(vpnIntent);
                } else {
                    context.startService(vpnIntent);
                }
            }
        }
    }
}
