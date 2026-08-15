package com.nopubly;

import android.content.Context;
import com.facebook.react.bridge.*;

public class BlocklistModule extends ReactContextBaseJavaModule {
    private static final String TAG = "BlocklistModule";

    public BlocklistModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "BlocklistModule";
    }

    @ReactMethod
    public void checkForUpdates(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            BlocklistUpdateModule updater = new BlocklistUpdateModule(context);

            boolean updateAvailable = updater.isUpdateAvailable();
            promise.resolve(updateAvailable);

        } catch (Exception e) {
            promise.reject("CHECK_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void updateBlocklists(Promise promise) {
        new Thread(() -> {
            try {
                Context context = getReactApplicationContext();
                BlocklistUpdateModule updater = new BlocklistUpdateModule(context);

                BlocklistUpdateModule.UpdateResult result = updater.updateBlocklists();

                WritableMap map = Arguments.createMap();
                map.putBoolean("success", result.success);
                map.putString("message", result.message);
                map.putInt("domainCount", result.domainCount);

                promise.resolve(map);

            } catch (Exception e) {
                promise.reject("UPDATE_ERROR", e.getMessage());
            }
        }).start();
    }
}
