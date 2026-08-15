package com.nopubly;

import android.content.Intent;
import android.net.VpnService;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.IntentFilter;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class VpnModule extends ReactContextBaseJavaModule {
    private static ReactApplicationContext reactContext;

    private final BroadcastReceiver logReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if ("com.nopubly.TRAFFIC_LOG".equals(intent.getAction())) {
                WritableMap params = Arguments.createMap();
                params.putString("domain", intent.getStringExtra("domain"));
                params.putString("action", intent.getStringExtra("action"));
                params.putString("timestamp", String.valueOf(System.currentTimeMillis()));

                if (reactContext.hasActiveCatalystInstance()) {
                    reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit("TrafficLog",
                            params);
                }
            }
        }
    };

    VpnModule(ReactApplicationContext context) {
        super(context);
        reactContext = context;
        // Register receiver with Android 14+ security flag
        IntentFilter filter = new IntentFilter("com.nopubly.TRAFFIC_LOG");
        // RECEIVER_NOT_EXPORTED: This receiver is only for internal app communication
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            reactContext.registerReceiver(logReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            reactContext.registerReceiver(logReceiver, filter);
        }
    }

    @Override
    public String getName() {
        return "VpnModule";
    }

    @ReactMethod
    public void requestVpnPermission(Promise promise) {
        try {
            Intent intent = VpnService.prepare(reactContext);
            if (intent != null) {
                MainActivity activity = (MainActivity) getCurrentActivity();
                if (activity != null) {
                    MainActivity.Companion.setVpnPermissionPromise(promise);
                    activity.launchVpnPermission(intent);
                } else {
                    promise.reject("NO_ACTIVITY", "Activity not available");
                }
            } else {
                // Permission already granted
                promise.resolve("ALREADY_GRANTED");
            }
        } catch (Exception e) {
            promise.reject("PERMISSION_ERROR", e);
        }
    }

    @ReactMethod
    public void startVpn(Promise promise) {
        try {
            Intent intent = VpnService.prepare(reactContext);
            if (intent != null) {
                // Permission not granted, reject
                promise.reject("PERMISSION_REQUIRED", "VPN permission required. Call requestVpnPermission first.");
            } else {
                // Permission already granted, start service
                Intent serviceIntent = new Intent(reactContext, AdBlockVpnService.class);
                reactContext.startService(serviceIntent);
                promise.resolve("STARTED");
            }
        } catch (Exception e) {
            promise.reject("START_ERROR", e);
        }
    }

    @ReactMethod
    public void stopVpn(Promise promise) {
        try {
            AdBlockVpnService.isRunning = false;
            Intent serviceIntent = new Intent(reactContext, AdBlockVpnService.class);
            reactContext.stopService(serviceIntent);
            promise.resolve("STOPPED");
        } catch (Exception e) {
            promise.reject("STOP_ERROR", e);
        }
    }

    @ReactMethod
    public void isVpnRunning(Promise promise) {
        promise.resolve(AdBlockVpnService.isRunning());
    }

    @ReactMethod
    public void setAutoStart(boolean enabled, Promise promise) {
        try {
            android.content.SharedPreferences prefs = reactContext.getSharedPreferences("NopublySettings",
                    Context.MODE_PRIVATE);
            prefs.edit().putBoolean("auto_start", enabled).apply();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("PREF_ERROR", e);
        }
    }

    @ReactMethod
    public void getAutoStart(Promise promise) {
        try {
            android.content.SharedPreferences prefs = reactContext.getSharedPreferences("NopublySettings",
                    Context.MODE_PRIVATE);
            boolean enabled = prefs.getBoolean("auto_start", false);
            promise.resolve(enabled);
        } catch (Exception e) {
            promise.reject("PREF_ERROR", e);
        }
    }

    @ReactMethod
    public void setBlockingConfig(boolean blockTrackers, boolean blockAds, Promise promise) {
        try {
            // Update live service flags
            AdBlockVpnService.enableBlockTrackers = blockTrackers;
            AdBlockVpnService.enableBlockAds = blockAds;

            // Save to preferences for persistence (service restart)
            android.content.SharedPreferences prefs = reactContext.getSharedPreferences("NopublySettings",
                    Context.MODE_PRIVATE);
            prefs.edit()
                    .putBoolean("block_trackers", blockTrackers)
                    .putBoolean("block_ads", blockAds)
                    .apply();

            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("CONFIG_ERROR", e);
        }
    }

    @ReactMethod
    public void reloadVpn(Promise promise) {
        try {
            // Only reload if VPN is currently running
            if (AdBlockVpnService.isRunning()) {
                // Stop current VPN
                AdBlockVpnService.isRunning = false;
                Intent stopIntent = new Intent(reactContext, AdBlockVpnService.class);
                reactContext.stopService(stopIntent);

                // Wait a bit for clean shutdown
                Thread.sleep(500);

                // Restart VPN (will read updated quarantine list)
                Intent startIntent = new Intent(reactContext, AdBlockVpnService.class);
                reactContext.startService(startIntent);

                promise.resolve("RELOADED");
            } else {
                promise.resolve("NOT_RUNNING");
            }
        } catch (Exception e) {
            promise.reject("RELOAD_ERROR", e);
        }
    }
}
