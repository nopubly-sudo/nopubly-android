package com.nopubly;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.json.JSONObject;
import android.util.Log;

public class CloudIntelligenceClient {
    private static final String TAG = "CloudIntelClient";
    // Unified API URL
    private static String PROXY_URL = "https://api.nopubly.com/api/malware/check?hash=";

    private final OkHttpClient client;

    public CloudIntelligenceClient() {
        // Set shorter timeouts for resilience
        client = new OkHttpClient.Builder()
                .callTimeout(5, java.util.concurrent.TimeUnit.SECONDS)
                .connectTimeout(5, java.util.concurrent.TimeUnit.SECONDS)
                .readTimeout(5, java.util.concurrent.TimeUnit.SECONDS)
                .build();
    }

    public CloudIntelligenceResponse checkHash(String sha256) {
        if (sha256 == null || sha256.isEmpty()) {
            return new CloudIntelligenceResponse(false, "");
        }

        Request request = new Request.Builder()
                .url(PROXY_URL + sha256)
                .build();

        try (Response response = client.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                Log.w(TAG, "Security Proxy call failed: " + response.code());
                return new CloudIntelligenceResponse(false, "");
            }

            String body = response.body().string();
            JSONObject json = new JSONObject(body);

            boolean isThreat = json.optBoolean("isThreat", false);
            String threatName = json.optString("threatName", "");

            Log.i(TAG, "Security Result for " + sha256 + ": isThreat=" + isThreat);
            return new CloudIntelligenceResponse(isThreat, threatName);
        } catch (Exception e) {
            Log.e(TAG, "Error checking reputation via proxy (" + e.getMessage() + ")");
            // Network/Parsing error -> Fail-safe
            return new CloudIntelligenceResponse(false, "");
        }
    }

    public static void setProxyUrl(String url) {
        PROXY_URL = url;
    }
}

class CloudIntelligenceResponse {
    public final boolean isThreat;
    public final String threatName;

    CloudIntelligenceResponse(boolean isThreat, String threatName) {
        this.isThreat = isThreat;
        this.threatName = threatName;
    }
}
