package com.nopubly;

import android.content.Context;
import android.util.Log;
import org.json.JSONObject;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashSet;
import java.util.Set;

public class BlocklistUpdateModule {
    private static final String TAG = "BlocklistUpdate";
    private static final String API_URL = "https://nopubly-api.alex.ovh/api/blocklists/latest";
    private static final String BLOCKLIST_FILE = "blocked_domains.txt";
    private static final String VERSION_FILE = "blocklist_version.txt";

    private Context context;

    public BlocklistUpdateModule(Context context) {
        this.context = context;
    }

    /**
     * Check if update is available
     */
    public boolean isUpdateAvailable() {
        try {
            String currentVersion = getCurrentVersion();
            String latestVersion = getLatestVersion();

            if (latestVersion == null)
                return false;

            return !latestVersion.equals(currentVersion);
        } catch (Exception e) {
            Log.e(TAG, "Error checking for updates", e);
            return false;
        }
    }

    /**
     * Download and update blocklists
     */
    public UpdateResult updateBlocklists() {
        Log.i(TAG, "Starting professional-grade blocklist update...");
        Set<String> allDomains = new HashSet<>();
        boolean atLeastOneSuccess = false;

        // 1. Fetch from our backend metadata if available (for custom rules)
        try {
            JSONObject metadata = fetchMetadata();
            if (metadata != null) {
                JSONObject categories = metadata.getJSONObject("categories");
                Log.d(TAG, "Found metadata categories. Downloading...");
                allDomains.addAll(downloadList(categories.getString("malware")));
                allDomains.addAll(downloadList(categories.getString("phishing")));
                allDomains.addAll(downloadList(categories.getString("ads")));
                atLeastOneSuccess = true;
            }
        } catch (Exception e) {
            Log.e(TAG, "Error fetching from primary metadata", e);
        }

        // 2. Aggregate from top-tier professional sources
        String[] professionalSources = {
                "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts",
                "https://small.oisd.nl",
                "https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt",
                "https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext"
        };

        for (String source : professionalSources) {
            try {
                Set<String> domains = downloadList(source);
                if (!domains.isEmpty()) {
                    allDomains.addAll(domains);
                    atLeastOneSuccess = true;
                    Log.i(TAG, "Successfully integrated source: " + source + " (+" + domains.size() + " domains)");
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to download from professional source: " + source, e);
            }
        }

        if (!atLeastOneSuccess) {
            return new UpdateResult(false, "Failed to fetch from any source", 0);
        }

        try {
            // Save to file
            saveBlocklist(allDomains);

            // For versioning, use current timestamp if metadata didn't provide one
            String version = "PROFESSIONAL_" + System.currentTimeMillis();
            saveVersion(version);

            Log.i(TAG, "Professional blocklist updated successfully: " + allDomains.size() + " unique domains");
            return new UpdateResult(true, "Updated successfully with professional sources", allDomains.size());

        } catch (Exception e) {
            Log.e(TAG, "Error saving blocklists", e);
            return new UpdateResult(false, "Save error: " + e.getMessage(), 0);
        }
    }

    /**
     * Get current blocklist version
     */
    private String getCurrentVersion() {
        try {
            FileInputStream fis = context.openFileInput(VERSION_FILE);
            BufferedReader reader = new BufferedReader(new InputStreamReader(fis));
            String version = reader.readLine();
            reader.close();
            return version != null ? version : "none";
        } catch (FileNotFoundException e) {
            return "none";
        } catch (Exception e) {
            Log.e(TAG, "Error reading version", e);
            return "none";
        }
    }

    /**
     * Get latest version from API
     */
    private String getLatestVersion() {
        try {
            JSONObject metadata = fetchMetadata();
            return metadata != null ? metadata.getString("version") : null;
        } catch (Exception e) {
            Log.e(TAG, "Error getting latest version", e);
            return null;
        }
    }

    /**
     * Fetch metadata from API
     */
    private JSONObject fetchMetadata() {
        Log.i(TAG, "Fetching metadata from: " + API_URL);
        HttpURLConnection connection = null;
        try {
            URL url = new URL(API_URL);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);

            int responseCode = connection.getResponseCode();
            Log.d(TAG, "Metadata response code: " + responseCode);

            if (responseCode == HttpURLConnection.HTTP_OK) {
                BufferedReader reader = new BufferedReader(
                        new InputStreamReader(connection.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    response.append(line);
                }
                reader.close();

                Log.d(TAG, "Metadata fetched successfully");
                return new JSONObject(response.toString());
            }

            Log.e(TAG, "HTTP error fetching metadata: " + responseCode);
            return null;

        } catch (Exception e) {
            Log.e(TAG, "Exception fetching metadata: " + e.getMessage(), e);
            return null;
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    /**
     * Download a blocklist from URL
     */
    private Set<String> downloadList(String urlString) {
        Log.i(TAG, "Downloading list from: " + urlString);
        Set<String> domains = new HashSet<>();
        HttpURLConnection connection = null;

        try {
            URL url = new URL(urlString);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(30000);
            connection.setReadTimeout(30000);
            connection.setRequestProperty("User-Agent",
                    "Mozilla/5.0 (Android; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0");

            int responseCode = connection.getResponseCode();
            Log.d(TAG, "Download response code for " + urlString + ": " + responseCode);

            if (responseCode == HttpURLConnection.HTTP_OK) {
                BufferedReader reader = new BufferedReader(
                        new InputStreamReader(connection.getInputStream()));

                String line;
                while ((line = reader.readLine()) != null) {
                    line = line.trim();
                    // Handle hosts file format (0.0.0.0 domain.com or 127.0.0.1 domain.com)
                    if (!line.isEmpty() && !line.startsWith("#") && !line.startsWith("!")) {
                        String[] parts = line.split("\\s+");
                        String domain = "";
                        if (parts.length > 1 && (parts[0].equals("0.0.0.0") || parts[0].equals("127.0.0.1"))) {
                            domain = parts[1];
                        } else if (parts.length == 1) {
                            domain = parts[0];
                        }

                        if (!domain.isEmpty() && domain.contains(".")) {
                            domains.add(domain.toLowerCase());
                        }
                    }
                }
                reader.close();
                Log.i(TAG, "Successfully processed " + domains.size() + " domains from " + urlString);
            } else {
                Log.e(TAG, "HTTP error downloading list (" + responseCode + "): " + urlString);
            }

        } catch (Exception e) {
            Log.e(TAG, "Exception downloading list: " + urlString + " - " + e.getMessage(), e);
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }

        return domains;
    }

    /**
     * Save blocklist to file
     */
    private void saveBlocklist(Set<String> domains) throws IOException {
        FileOutputStream fos = context.openFileOutput(BLOCKLIST_FILE, Context.MODE_PRIVATE);
        PrintWriter writer = new PrintWriter(fos);

        for (String domain : domains) {
            writer.println(domain);
        }

        writer.close();
        fos.close();
    }

    /**
     * Save version to file
     */
    private void saveVersion(String version) throws IOException {
        FileOutputStream fos = context.openFileOutput(VERSION_FILE, Context.MODE_PRIVATE);
        PrintWriter writer = new PrintWriter(fos);
        writer.println(version);
        writer.close();
        fos.close();
    }

    /**
     * Result of update operation
     */
    public static class UpdateResult {
        public final boolean success;
        public final String message;
        public final int domainCount;

        public UpdateResult(boolean success, String message, int domainCount) {
            this.success = success;
            this.message = message;
            this.domainCount = domainCount;
        }
    }
}
