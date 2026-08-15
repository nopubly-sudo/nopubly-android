package com.nopubly;

import android.os.Environment;
import android.os.FileObserver;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.io.File;
import java.io.FileInputStream;
import java.security.MessageDigest;

public class FileMonitorModule extends ReactContextBaseJavaModule {
    private static final String TAG = "FileMonitor";
    private FileObserver downloadObserver;
    private final ReactApplicationContext reactContext;

    FileMonitorModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
    }

    @Override
    public String getName() {
        return "FileMonitorModule";
    }

    @ReactMethod
    public void startMonitoring(String path) {
        if (downloadObserver != null)
            return;

        final String downloadPath = path != null ? path
                : Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).getAbsolutePath();

        Log.i(TAG, "Starting monitor at: " + downloadPath);

        downloadObserver = new FileObserver(downloadPath, FileObserver.CREATE | FileObserver.MOVED_TO) {
            @Override
            public void onEvent(int event, String path) {
                if (path != null && path.endsWith(".apk")) {
                    Log.i(TAG, "New APK detected: " + path);
                    handleNewApk(downloadPath + File.separator + path);
                }
            }
        };
        downloadObserver.startWatching();
    }

    private void handleNewApk(String fullPath) {
        try {
            // Wait a bit for the file to be fully written
            Thread.sleep(1000);

            String hash = getFileChecksum(new File(fullPath));

            WritableMap params = Arguments.createMap();
            params.putString("path", fullPath);
            params.putString("fileName", new File(fullPath).getName());
            params.putString("hash", hash);

            reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("NewDownloadDetected", params);

        } catch (Exception e) {
            Log.e(TAG, "Error processing new APK", e);
        }
    }

    private String getFileChecksum(File file) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            FileInputStream fis = new FileInputStream(file);
            byte[] byteArray = new byte[1024];
            int bytesCount;
            while ((bytesCount = fis.read(byteArray)) != -1) {
                digest.update(byteArray, 0, bytesCount);
            }
            fis.close();
            byte[] bytes = digest.digest();
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) {
                sb.append(Integer.toString((b & 0xff) + 0x100, 16).substring(1));
            }
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }

    @ReactMethod
    public void stopMonitoring() {
        if (downloadObserver != null) {
            downloadObserver.stopWatching();
            downloadObserver = null;
        }
    }
}
