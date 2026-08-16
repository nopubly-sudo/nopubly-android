package com.nopubly;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.util.Log;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.os.Build;
import androidx.core.app.NotificationCompat;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class AppInstallReceiver extends BroadcastReceiver {
    private static final String TAG = "AppInstallReceiver";
    private static final String CHANNEL_ID = "Nopubly_Security_Alerts";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_PACKAGE_ADDED.equals(intent.getAction())) {
            return;
        }

        Uri data = intent.getData();
        if (data == null) return;
        String packageName = data.getSchemeSpecificPart();
        if (packageName == null || packageName.equals(context.getPackageName())) {
            return;
        }

        SharedPreferences prefs = context.getSharedPreferences("NopublyPrefs", Context.MODE_PRIVATE);
        boolean isPro = prefs.getBoolean("isPro", false);

        if (!isPro) {
            Log.i(TAG, "Install Monitor: Skipping " + packageName + " (User is not PRO)");
            return;
        }

        Log.i(TAG, "Install Monitor: Scanning newly installed app: " + packageName);

        // Run in background to avoid blocking the broadcast receiver main thread
        new Thread(() -> {
            try {
                PackageManager pm = context.getPackageManager();
                PackageInfo pkgInfo = pm.getPackageInfo(packageName, PackageManager.GET_PERMISSIONS | PackageManager.GET_META_DATA);
                
                CloudIntelligenceClient cloudIntel = new CloudIntelligenceClient();
                int score = AppScannerModule.calculateRiskScore(context, pkgInfo, cloudIntel);
                String risk = AppScannerModule.getRiskLabel(score);

                Log.i(TAG, "Scan result for " + packageName + ": Score=" + score + " Risk=" + risk);

                if ("CRITICAL".equals(risk) || "HIGH".equals(risk)) {
                    sendThreatNotification(context, packageName, pkgInfo, risk);
                }

                sendTelemetry(context, packageName, score, risk);

            } catch (Exception e) {
                Log.e(TAG, "Error scanning newly installed app", e);
            }
        }).start();
    }

    private void sendThreatNotification(Context context, String packageName, PackageInfo pkgInfo, String risk) {
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Security Alerts",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Alerts for malicious applications installed on your device.");
            notificationManager.createNotificationChannel(channel);
        }

        String appName = packageName;
        try {
            appName = pkgInfo.applicationInfo.loadLabel(context.getPackageManager()).toString();
        } catch (Exception e) {}

        Intent uninstallIntent = new Intent(Intent.ACTION_DELETE);
        uninstallIntent.setData(android.net.Uri.parse("package:" + packageName));
        uninstallIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 0, uninstallIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setContentTitle("Nopubly Security Alert")
                .setContentText("Threat detected! '" + appName + "' is classified as " + risk + ". Tap to uninstall.")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setColor(0xFFFF0000) // Red
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

        notificationManager.notify(packageName.hashCode(), builder.build());
    }

    private void sendTelemetry(Context context, String packageName, int score, String risk) {
        try {
            URL url = new URL("https://api.nopubly.com/api/telemetry");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);

            String jsonInputString = "{\"packageName\": \"" + packageName + "\", \"score\": " + score + ", \"riskLevel\": \"" + risk + "\"}";
            
            try(OutputStream os = conn.getOutputStream()) {
                byte[] input = jsonInputString.getBytes("utf-8");
                os.write(input, 0, input.length);			
            }
            conn.getResponseCode();
            conn.disconnect();
        } catch (Exception e) {
            Log.e(TAG, "Failed to send telemetry", e);
        }
    }
}
