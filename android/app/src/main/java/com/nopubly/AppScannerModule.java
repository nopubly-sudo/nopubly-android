package com.nopubly;

import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.Settings;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import android.content.Context;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import java.io.FileInputStream;
import java.security.MessageDigest;
import java.util.List;

public class AppScannerModule extends ReactContextBaseJavaModule {
    private static final String TAG = "AppScannerModule";
    private final ReactApplicationContext reactContext;
    private final CloudIntelligenceClient cloudIntel = new CloudIntelligenceClient();

    public AppScannerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "AppScannerModule";
    }

    @ReactMethod
    public void openOverlaySettings(Promise promise) {
        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            reactContext.startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("SETTINGS_ERROR", e);
        }
    }

    @ReactMethod
    public void requestUninstall(String packageName, Promise promise) {
        try {
            Intent intent = new Intent(Intent.ACTION_DELETE);
            intent.setData(Uri.parse("package:" + packageName));
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            reactContext.startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("UNINSTALL_ERROR", e);
        }
    }

    @ReactMethod
    public void getDeviceId(Promise promise) {
        try {
            String androidId = Settings.Secure.getString(reactContext.getContentResolver(), Settings.Secure.ANDROID_ID);
            promise.resolve(androidId != null ? androidId : "unknown_device");
        } catch (Exception e) {
            promise.reject("DEVICE_ID_ERROR", e);
        }
    }

    @ReactMethod
    public void setProStatus(boolean isPro, Promise promise) {
        try {
            android.content.SharedPreferences prefs = reactContext.getSharedPreferences("NopublyPrefs", Context.MODE_PRIVATE);
            prefs.edit().putBoolean("isPro", isPro).apply();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("PREFS_ERROR", e);
        }
    }

    @ReactMethod
    public void scanInstalledApps(ReadableArray trustedPackages, Promise promise) {
        new Thread(() -> {
            try {
                PackageManager pm = reactContext.getPackageManager();
                List<PackageInfo> allPackages = pm.getInstalledPackages(PackageManager.GET_PERMISSIONS);

                // Convert ReadableArray to a Set for O(1) lookups
                final java.util.Set<String> userTrusted = new java.util.HashSet<>();
                if (trustedPackages != null) {
                    for (int i = 0; i < trustedPackages.size(); i++) {
                        userTrusted.add(trustedPackages.getString(i));
                    }
                }

                // Filter apps to scan (excluding system, etc. to get true total)
                List<PackageInfo> packagesToScan = new java.util.ArrayList<>();
                for (PackageInfo pkg : allPackages) {
                    if (isSystemApp(pkg) || pkg.packageName.equals("com.nopubly") ||
                            TrustedApps.isTrusted(pkg.packageName) ||
                            userTrusted.contains(pkg.packageName)) {
                        continue;
                    }
                    packagesToScan.add(pkg);
                }

                WritableArray riskyApps = Arguments.createArray();
                int total = packagesToScan.size();
                int current = 0;

                for (PackageInfo pkg : packagesToScan) {
                    current++;

                    // Emit progress
                    WritableMap progressData = Arguments.createMap();
                    progressData.putInt("current", current);
                    progressData.putInt("total", total);
                    progressData.putString("appName", pkg.applicationInfo.loadLabel(pm).toString());

                    reactContext
                            .getJSModule(
                                    com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                            .emit("ScanProgress", progressData);

                    int score = calculateRiskScore(reactContext, pkg, cloudIntel);

                    // Flag if score >= 40 (standard threshold)
                    if (score >= 40) {
                        WritableMap appData = Arguments.createMap();
                        appData.putString("packageName", pkg.packageName);
                        appData.putString("appName", pkg.applicationInfo.loadLabel(pm).toString());
                        appData.putInt("score", score);
                        appData.putString("riskLevel", getRiskLabel(score));

                        WritableArray heuristics = Arguments.createArray();
                        addHeuristics(pkg, pm, heuristics);
                        appData.putArray("heuristics", heuristics);

                        riskyApps.pushMap(appData);
                    }
                }

                promise.resolve(riskyApps);
            } catch (Exception e) {
                Log.e(TAG, "Scan failed", e);
                promise.reject("SCAN_ERROR", e);
            }
        }).start();
    }

    public static int calculateRiskScore(Context context, PackageInfo packageInfo, CloudIntelligenceClient cloudIntel) {
        // Layer 4: Security App identification
        boolean isSecurityApp = isSecurityApp(packageInfo.packageName);

        // Layer 5: Play Store verification
        boolean isFromPlayStore = isSignedByGooglePlay(context, packageInfo);

        int score = 0;
        String[] permissions = packageInfo.requestedPermissions;
        if (permissions == null)
            return 0;

        boolean hasInternet = false;
        boolean hasCamera = false;
        boolean hasLocation = false;
        boolean hasMicrophone = false;
        boolean hasContacts = false;
        boolean hasSMS = false;
        boolean hasCallLog = false;
        boolean hasOverlay = false;
        boolean hasBoot = false;
        boolean hasAdmin = false;

        for (String perm : permissions) {
            if (perm.equals("android.permission.INTERNET"))
                hasInternet = true;
            if (perm.equals("android.permission.CAMERA"))
                hasCamera = true;
            if (perm.equals("android.permission.ACCESS_FINE_LOCATION") ||
                    perm.equals("android.permission.ACCESS_COARSE_LOCATION"))
                hasLocation = true;
            if (perm.equals("android.permission.RECORD_AUDIO"))
                hasMicrophone = true;
            if (perm.equals("android.permission.READ_CONTACTS"))
                hasContacts = true;
            if (perm.equals("android.permission.READ_SMS") ||
                    perm.equals("android.permission.SEND_SMS"))
                hasSMS = true;
            if (perm.equals("android.permission.READ_CALL_LOG"))
                hasCallLog = true;
            if (perm.equals("android.permission.SYSTEM_ALERT_WINDOW"))
                hasOverlay = true;
            if (perm.equals("android.permission.RECEIVE_BOOT_COMPLETED"))
                hasBoot = true;
            if (perm.equals("android.permission.BIND_DEVICE_ADMIN"))
                hasAdmin = true;
        }

        boolean isHidden = isHiddenApp(context, packageInfo);
        
        // Scoring rules
        if (hasInternet && hasOverlay && (hasAdmin || isHidden))
            score += 40; // Phishing potential (Requires Admin or Hidden)
        if (hasInternet && hasSMS)
            score += 35; // SMS fraud
        if (hasInternet && (hasContacts || hasCallLog))
            score += 30; // Data theft
        if (hasCamera && !isSecurityApp)
            score += 20;
        if (hasMicrophone && !isSecurityApp)
            score += 20;
        if (hasLocation)
            score += 10;
        if (hasBoot && hasOverlay) {
            score += 30; // Persistence
            if (hasInternet && !isSecurityApp) {
                score += 35; // Adware Agresivo (Overlay + Boot + Internet)
            }
        }
        if (hasAdmin)
            score += 60; // Persistence & Ransomware

        // Layer 9: Screen Hijacker Detection
        boolean isLauncher = isLauncherApp(context, packageInfo.packageName);
        if (isLauncher && hasOverlay && !isSecurityApp) {
            score += 80; // CRITICAL: Launcher que pone ventanas flotantes (Secuestrador de Pantalla)
        }

        // Layer 7: PUP & Adware Detection (V36.7 Upgrade)
        boolean isPUP = isPUPApp(context, packageInfo.packageName, packageInfo);
        if (isPUP) {
            score += 45; // Automatic flag for suspicious "cleaners/optimizers"
        }

        // Layer 8: Hidden App Detection (No Launcher Icon)
        if (isHidden && !isSecurityApp && (hasInternet || hasBoot)) {
            score += 80; // Critical: Hidden background persistence
        }

        // Layer 6: Cloud Intelligence Check (MalwareBazaar)
        String sha256 = getApkHash(packageInfo);
        CloudIntelligenceResponse cir = cloudIntel.checkHash(sha256);
        boolean isCleanOnCloud = !cir.isThreat && sha256 != null;

        if (cir.isThreat) {
            score += 100; // Flagged by Cloud Database (Critical)
        }

        // Apply discounts
        if (isSecurityApp) {
            score = (int) (score * 0.3); // High confidence in security apps
        } else if (isFromPlayStore) {
            // High trust for Play Store
            if (isCleanOnCloud) {
                if (hasOverlay && hasAdmin) {
                    // Suspicious combination even if from Play Store
                    score = (int) (score * 0.4);
                } else {
                    // High confidence: Play Store + Clean Cloud = Very Safe (90% reduction)
                    score = (int) (score * 0.1);
                }
            } else {
                score = (int) (score * 0.5); // Moderate confidence in Play Store
            }
        } else if (isCleanOnCloud && !isPUP) {
            // Sideloaded but clean on Cloud and not a PUP
            score = (int) (score * 0.5);
        }

        // Intrusive behavior floor: If PUP + Overlay + Internet, minimum HIGH risk
        if (isPUP && hasOverlay && hasInternet && score < 70) {
            score = 75;
        }

        return score;
    }

    public static boolean isSecurityApp(String packageName) {
        String lower = packageName.toLowerCase();
        return lower.contains("antivirus") ||
                lower.contains("security") ||
                lower.contains("vpn") ||
                lower.contains("firewall") ||
                lower.contains("malware") ||
                lower.contains("defender") ||
                lower.contains("protect") ||
                lower.contains("guard");
    }

    public static boolean isPUPApp(Context context, String packageName, PackageInfo pkg) {
        String lowerPkg = packageName.toLowerCase();
        PackageManager pm = context.getPackageManager();
        String lowerLabel = pkg.applicationInfo.loadLabel(pm).toString().toLowerCase();

        // Only target highly specific aggressive keywords usually associated with fake cleaner PUPs
        return lowerPkg.contains("optimizer") || lowerLabel.contains("optimizer") ||
                lowerPkg.contains("boost") || lowerLabel.contains("boost") ||
                lowerPkg.contains("accelerate") || lowerLabel.contains("accelerate") ||
                lowerPkg.contains("speedup") || lowerLabel.contains("speedup") ||
                lowerPkg.contains("battery-saver") || lowerLabel.contains("battery-saver") ||
                lowerPkg.contains("ram-cleaner") || lowerLabel.contains("ram-cleaner");
    }

    public static boolean isSignedByGooglePlay(Context context, PackageInfo packageInfo) {
        try {
            PackageManager pm = context.getPackageManager();
            String installer = pm.getInstallerPackageName(packageInfo.packageName);
            return "com.android.vending".equals(installer);
        } catch (Exception e) {
            return false;
        }
    }

    public static boolean isHiddenApp(Context context, PackageInfo pkg) {
        try {
            PackageManager pm = context.getPackageManager();
            Intent intent = new Intent(Intent.ACTION_MAIN);
            intent.addCategory(Intent.CATEGORY_LAUNCHER);
            intent.setPackage(pkg.packageName);
            List<android.content.pm.ResolveInfo> activities = pm.queryIntentActivities(intent, 0);
            return activities == null || activities.isEmpty();
        } catch (Exception e) {
            return false;
        }
    }

    public static String getApkHash(PackageInfo pkg) {
        try {
            String apkPath = pkg.applicationInfo.sourceDir;
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            FileInputStream fis = new FileInputStream(apkPath);
            byte[] buffer = new byte[8192];
            int read;
            while ((read = fis.read(buffer)) != -1) {
                md.update(buffer, 0, read);
            }
            byte[] hash = md.digest();
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }

    public static boolean isSystemApp(PackageInfo pkg) {
        return (pkg.applicationInfo.flags & ApplicationInfo.FLAG_SYSTEM) != 0;
    }

    public static String getRiskLabel(int score) {
        if (score >= 100)
            return "CRITICAL";
        if (score >= 75)
            return "HIGH";
        if (score >= 50)
            return "SUSPICIOUS";
        return "SAFE";
    }

    public static boolean isLauncherApp(Context context, String packageName) {
        try {
            PackageManager pm = context.getPackageManager();
            android.content.Intent intent = new android.content.Intent(android.content.Intent.ACTION_MAIN);
            intent.addCategory(android.content.Intent.CATEGORY_HOME);
            java.util.List<android.content.pm.ResolveInfo> resolveInfos = pm.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY);
            for (android.content.pm.ResolveInfo info : resolveInfos) {
                if (info.activityInfo != null && packageName.equals(info.activityInfo.packageName)) {
                    return true;
                }
            }
        } catch (Exception e) {
            // Safe fallback
        }
        return false;
    }

    private void addHeuristics(PackageInfo pkg, PackageManager pm, WritableArray heuristics) {
        String[] permissions = pkg.requestedPermissions;
        if (permissions == null)
            return;

        boolean hasInternet = false;
        boolean hasOverlay = false;
        boolean hasSMS = false;
        boolean hasBoot = false;
        boolean hasAdmin = false;

        for (String perm : permissions) {
            if (perm.equals("android.permission.INTERNET"))
                hasInternet = true;
            if (perm.equals("android.permission.SYSTEM_ALERT_WINDOW"))
                hasOverlay = true;
            if (perm.equals("android.permission.SEND_SMS"))
                hasSMS = true;
            if (perm.equals("android.permission.RECEIVE_BOOT_COMPLETED"))
                hasBoot = true;
            if (perm.equals("android.permission.BIND_DEVICE_ADMIN"))
                hasAdmin = true;
        }

        boolean isHidden = isHiddenApp(reactContext, pkg);

        if (hasInternet && hasOverlay && (hasAdmin || isHidden))
            heuristics.pushString("Potential Phishing (Overlay + Internet + Hidden/Admin)");
        if (hasInternet && hasSMS)
            heuristics.pushString("SMS Fraud potential");
        if (hasBoot && hasOverlay && (hasAdmin || isHidden))
            heuristics.pushString("Persistent Overlay behavior (Hidden/Admin)");

        boolean isPUP = isPUPApp(reactContext, pkg.packageName, pkg);
        if (isPUP)
            heuristics.pushString("Potentially Unwanted Program (Suspicious Utility/Adware patterns)");

        if (isHidden)
            heuristics.pushString("Hidden Application (No launcher icon - Background behavior)");

        if (isPUP && hasOverlay && hasInternet && (hasAdmin || isHidden))
            heuristics.pushString("Intrusive Behavior (Utility + Overlay + Ads potential)");

        String sha256 = getApkHash(pkg);
        CloudIntelligenceResponse cir = cloudIntel.checkHash(sha256);
        if (cir.isThreat) {
            heuristics.pushString("Flagged by Cloud Intelligence (" + cir.threatName + ")");
        }
    }
}
