package com.nopubly;

import android.content.Intent;
import android.net.VpnService;
import android.content.pm.ServiceInfo;
import android.os.ParcelFileDescriptor;
import android.util.Log;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.nio.ByteBuffer;
import java.util.HashSet;
import java.util.Set;

public class AdBlockVpnService extends VpnService {
    private static final String TAG = "NopublyVpn";
    private static final String VPN_ADDRESS = "192.0.2.1"; // DNS66 reserved range
    private static final String VPN_ROUTE = "0.0.0.0"; // We route all to catch DNS, but we could narrow this.
    // Ideally we route only DNS IP, but we don't know it.
    // Optimization: WE SET THE DNS to 192.0.2.1 to force traffic there.

    private Thread vpnThread;
    private ParcelFileDescriptor vpnInterface;
    static boolean isRunning = false;
    private Set<String> blocklist = new HashSet<>();
    private static final String BLOCKLIST_FILENAME = "blocked_domains.txt";
    private int ipIdCounter = 0;

    // Blocking Control Flags (Public Static for direct access from VpnModule)
    public static boolean enableBlockTrackers = true;
    public static boolean enableBlockAds = true;

    // DNS Alias System (DNS66 method)
    // Map upstream DNS servers to internal IPs within our subnet
    private static final String[] UPSTREAM_DNS_SERVERS = {
            "8.8.8.8", // Google Primary -> 192.0.2.2
            "8.8.4.4", // Google Secondary -> 192.0.2.3
            "1.1.1.1", // Cloudflare Primary -> 192.0.2.4
            "1.0.0.1" // Cloudflare Secondary -> 192.0.2.5
    };

    public static boolean isRunning() {
        return isRunning;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createNotificationChannel();
        Notification notification = buildNotification();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(1, notification);
        }

        if (isRunning)
            return START_STICKY;

        // CRITICAL: Check auto-start preference
        // If this is a system restart (intent == null) and auto-start is OFF, stop
        // here.
        android.content.SharedPreferences prefs = getSharedPreferences("NopublySettings",
                android.content.Context.MODE_PRIVATE);
        boolean autoStart = prefs.getBoolean("auto_start", false);

        // Load persisteds blocking config
        enableBlockTrackers = prefs.getBoolean("block_trackers", true);
        enableBlockAds = prefs.getBoolean("block_ads", true);

        // If intent is null, it's a system restart.
        // We only allow it if autoStart is true OR if we were already running (which is
        // checked above).
        if (intent == null && !autoStart) {
            Log.i(TAG, "System restart detected but auto-start is disabled. Stopping.");
            stopSelf();
            return START_NOT_STICKY;
        }

        // Load blocklist from internal storage
        loadBlocklist();

        // Initial fallbacks
        if (blocklist.isEmpty()) {
            blocklist.add("ads.google.com");
            blocklist.add("doubleclick.net");
            blocklist.add("graph.facebook.com");
        }

        try {
            Builder builder = new Builder();
            builder.setSession("Nopubly Shield");
            builder.setMtu(1400);

            // Assign fixed internal IP with proper subnet (DNS66 uses /24)
            builder.addAddress(VPN_ADDRESS, 24);

            // DNS Alias System: Create internal IPs for each upstream DNS server
            // This is how DNS66 works - map each upstream to an internal IP
            for (int i = 0; i < UPSTREAM_DNS_SERVERS.length; i++) {
                String alias = "192.0.2." + (i + 2); // .2, .3, .4, .5
                builder.addDnsServer(alias);
                builder.addRoute(alias, 32);
                Log.i(TAG, "DNS Alias: " + alias + " -> " + UPSTREAM_DNS_SERVERS[i]);
            }

            // IPv6 DNS Support: Enabled for v47+ with proper subnet
            try {
                // Unique Local Address (ULA) for VPN with proper subnet (DNS66 uses /120)
                builder.addAddress("fd00::1", 120);
                builder.addRoute("fd00::1", 128); // Route our own IP
                builder.addDnsServer("fd00::1");
            } catch (Exception e) {
                Log.w(TAG, "IPv6 not supported by builder", e);
            }

            // CRITICAL: Allow apps to bypass VPN if needed
            builder.allowBypass();

            // Allow both IPv4 and IPv6 traffic families
            builder.allowFamily(android.system.OsConstants.AF_INET); // IPv4
            builder.allowFamily(android.system.OsConstants.AF_INET6); // IPv6

            // Set blocking mode to true (DNS66 uses true)
            builder.setBlocking(true);

            // Optimization for Android 10+
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                builder.setMetered(false);
            }

            // QUARANTINE BLOCKING: Read quarantined apps from AsyncStorage and block their
            // internet
            try {
                android.content.SharedPreferences asyncStorage = getSharedPreferences("RN_ASYNC_STORAGE",
                        android.content.Context.MODE_PRIVATE);
                // React Native AsyncStorage uses @RNC_AsyncStorage: prefix
                String quarantineJson = asyncStorage.getString("@RNC_AsyncStorage:quarantinedApps", "[]");

                if (!quarantineJson.equals("[]")) {
                    org.json.JSONArray quarantineArray = new org.json.JSONArray(quarantineJson);
                    int blockedCount = 0;

                    for (int i = 0; i < quarantineArray.length(); i++) {
                        org.json.JSONObject app = quarantineArray.getJSONObject(i);
                        String packageName = app.getString("packageName");

                        try {
                            builder.addDisallowedApplication(packageName);
                            blockedCount++;
                            Log.i(TAG, "QUARANTINE BLOCK: " + packageName);
                        } catch (android.content.pm.PackageManager.NameNotFoundException e) {
                            // App no longer installed, ignore
                            Log.w(TAG, "Quarantined app not found: " + packageName);
                        }
                    }

                    if (blockedCount > 0) {
                        Log.i(TAG, "Blocked internet for " + blockedCount + " quarantined apps");
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Error loading quarantine list", e);
            }

            vpnInterface = builder.establish();
            if (vpnInterface == null) {
                Log.e(TAG, "Failed to establish VPN interface (likely permission revoked or system error)");
                stopSelf();
                return START_NOT_STICKY;
            }

            isRunning = true;
            vpnThread = new Thread(this::runVpnLoop);
            vpnThread.start();
            Log.i(TAG, "VPN Started: DNS Filtering Mode");

        } catch (Exception e) {
            Log.e(TAG, "Failed to start VPN", e);
            stopSelf();
        }
        return START_STICKY;
    }

    private void runVpnLoop() {
        if (vpnInterface == null) {
            Log.e(TAG, "runVpnLoop aborting: vpnInterface is null");
            return;
        }

        FileInputStream in = new FileInputStream(vpnInterface.getFileDescriptor());
        FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor());

        ByteBuffer packet = ByteBuffer.allocate(Short.MAX_VALUE);

        while (isRunning) {
            try {
                int length = in.read(packet.array());
                if (length > 0) {
                    packet.limit(length);
                    processPacket(packet, out);
                    packet.clear();
                }
            } catch (Exception e) {
                if (isRunning)
                    Log.e(TAG, "Error in loop", e);
            }
        }
    }

    private void processPacket(ByteBuffer packet, FileOutputStream out) {
        // Simple IPv4 parser
        byte[] data = packet.array();
        int version = (data[0] >> 4) & 0x0F;

        if (version == 6) {
            // IPv6 Packet detected.
            // Log to confirm if this is the cause of "no internet" on IPv6 networks.
            Log.v(TAG, "Captured IPv6 Packet (Layer 3 Bypass Needed?)");
            return;
        }

        if (version != 4)
            return;

        int headerLength = (data[0] & 0x0F) * 4;
        int protocol = data[9] & 0xFF;

        // Only DNS traffic will reach us now (no routing for other traffic)
        if (protocol == 17) { // UDP
            int dstPort = ((data[headerLength + 2] & 0xFF) << 8) | (data[headerLength + 3] & 0xFF);

            if (dstPort == 53) {
                handleDnsRequest(data, headerLength, packet.limit(), out);
            }
            // Non-DNS UDP won't reach here anymore (no routing configured)
        }
        // TCP and other protocols won't reach here (no routing configured)
    }

    private void handleDnsRequest(byte[] packetData, int ipHeaderLen, int totalLen, FileOutputStream out) {
        // Helper to extract UDP payload
        int udpHeaderLen = 8;
        int dnsStart = ipHeaderLen + udpHeaderLen;
        int dnsLen = totalLen - dnsStart;

        if (dnsLen < 12)
            return; // Malformed

        // Extract Query Name (Simplified)
        String domain = parseDnsQuestion(packetData, dnsStart);

        boolean blocked = false;

        // Only check blocklist if at least one protection is enabled
        if (domain != null && (enableBlockAds || enableBlockTrackers)) {
            for (String rule : blocklist) {
                if (domain.endsWith(rule)) {
                    blocked = true;
                    break;
                }
            }
        }

        if (blocked) {
            Log.i(TAG, "BLOCKED (Instant NXDOMAIN): " + domain);
            sendBroadcast("BLOCKED", domain);
            sendForgedNxDomain(packetData, ipHeaderLen, totalLen, out);
        } else {
            Log.i(TAG, "ALLOWED: " + domain);
            sendBroadcast("ALLOWED", domain);
            // Forward to Upstream
            forwardDns(packetData, ipHeaderLen, totalLen, out);
        }
    }

    private void forwardDns(byte[] packetData, int ipHeaderLen, int totalLen, FileOutputStream vpnOut) {
        forwardDns(packetData, ipHeaderLen, totalLen, vpnOut, false);
    }

    private void forwardDns(byte[] packetData, int ipHeaderLen, int totalLen, FileOutputStream vpnOut, boolean isIpv6) {
        DatagramSocket socket = null;
        try {
            // Determine which upstream DNS to use based on destination IP
            String upstreamDns = getUpstreamDns(packetData, ipHeaderLen, isIpv6);

            int payloadStart = ipHeaderLen + 8;
            int payloadLen = totalLen - payloadStart;

            byte[] dnsQuery = new byte[payloadLen];
            System.arraycopy(packetData, payloadStart, dnsQuery, 0, payloadLen);

            // Extract Transaction ID for logging
            int transactionId = ((dnsQuery[0] & 0xFF) << 8) | (dnsQuery[1] & 0xFF);

            // Create temporary socket for this query
            socket = new DatagramSocket();
            socket.setSoTimeout(1200);
            if (!protect(socket)) {
                Log.e(TAG, "Failed to protect query socket");
                return;
            }

            // Forward to determined upstream DNS
            InetAddress upstream = InetAddress.getByName(upstreamDns);
            DatagramPacket dnsReq = new DatagramPacket(dnsQuery, dnsQuery.length, upstream, 53);

            byte[] buffer = new byte[4096];
            DatagramPacket inPacket = new DatagramPacket(buffer, buffer.length);

            socket.send(dnsReq);
            socket.receive(inPacket);

            byte[] dnsResponse = new byte[inPacket.getLength()];
            System.arraycopy(buffer, 0, dnsResponse, 0, inPacket.getLength());

            // Verify transaction ID matches
            int responseId = ((dnsResponse[0] & 0xFF) << 8) | (dnsResponse[1] & 0xFF);
            if (responseId != transactionId) {
                Log.w(TAG, "Transaction ID mismatch: " + transactionId + " vs " + responseId);
                return;
            }

            Log.d(TAG, "Upstream Success [" + upstream.getHostAddress() + "] ID:" + transactionId);
            sendDnsResponse(dnsResponse, packetData, ipHeaderLen, vpnOut);

        } catch (Exception e) {
            Log.e(TAG, "DNS Forward Error", e);
        } finally {
            if (socket != null)
                socket.close();
        }
    }

    // Map destination IP to upstream DNS server (DNS66 alias system)
    private String getUpstreamDns(byte[] packetData, int ipHeaderLen, boolean isIpv6) {
        try {
            if (isIpv6) {
                // For IPv6, use default for now
                return UPSTREAM_DNS_SERVERS[0];
            } else {
                // IPv4: Extract destination IP (bytes 16-19)
                int lastOctet = packetData[19] & 0xFF;
                int index = lastOctet - 2; // .2 -> index 0, .3 -> index 1, etc.

                if (index >= 0 && index < UPSTREAM_DNS_SERVERS.length) {
                    return UPSTREAM_DNS_SERVERS[index];
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Error mapping upstream DNS", e);
        }
        return UPSTREAM_DNS_SERVERS[0]; // Default to Google Primary
    }

    private void sendDnsResponse(byte[] dnsPayload, byte[] queryPacket, int ipHeaderLen, FileOutputStream out) {
        try {
            int udpLen = 8 + dnsPayload.length;
            int totalLen = 20 + udpLen;
            ByteBuffer response = ByteBuffer.allocate(totalLen);

            // --- IPv4 Header (20 bytes) ---
            response.put((byte) 0x45); // Version 4, IHL 5
            response.put((byte) 0x00); // DSCP/ECN
            response.putShort((short) totalLen);
            response.putShort((short) (ipIdCounter++ & 0xFFFF)); // Corrected: Dynamic IP ID
            response.putShort((short) 0x4000); // Flags: Don't Fragment
            response.put((byte) 64); // TTL
            response.put((byte) 17); // Protocol: UDP
            response.putShort((short) 0); // Placeholder for Checksum

            // SWAP IPs
            response.put(queryPacket, 16, 4); // New Source (Original Dest)
            response.put(queryPacket, 12, 4); // New Destination (Original Source)

            // CALC IP CHECKSUM
            byte[] ipHeader = new byte[20];
            System.arraycopy(response.array(), 0, ipHeader, 0, 20);
            short ipChecksum = calculateHeaderChecksum(ipHeader, 20);
            response.putShort(10, ipChecksum);

            // --- UDP Header (8 bytes) ---
            response.position(20);
            // SWAP PORTS
            response.putShort(((ByteBuffer) ByteBuffer.wrap(queryPacket).position(ipHeaderLen + 2)).getShort()); // New
                                                                                                                 // Source
                                                                                                                 // Port
            response.putShort(((ByteBuffer) ByteBuffer.wrap(queryPacket).position(ipHeaderLen)).getShort()); // New Dest
                                                                                                             // Port
            response.putShort((short) udpLen);
            response.putShort((short) 0); // UDP Checksum (0 is fine for v4)

            // --- Payload ---
            response.put(dnsPayload);

            // Write back to VPN interface
            out.write(response.array());
            Log.d(TAG, "DNS Response injected: " + totalLen + " bytes");

        } catch (Exception e) {
            Log.e(TAG, "Error building DNS response", e);
        }
    }

    private void sendForgedNxDomain(byte[] queryPacket, int ipHeaderLen, int totalLen, FileOutputStream out) {
        try {
            int dnsStart = ipHeaderLen + 8;
            int dnsLen = totalLen - dnsStart;

            // Build a minimal NXDOMAIN response
            ByteBuffer responsePayload = ByteBuffer.allocate(dnsLen);
            responsePayload.put(queryPacket, dnsStart, dnsLen);

            // Set Flags: QR=1 (Response), Opcode=0, AA=1, TC=0, RD=1, RA=1, Z=0, RCODE=3
            // (NXDOMAIN)
            responsePayload.putShort(2, (short) 0x8183);
            // Set Answer Count to 0
            responsePayload.putShort(6, (short) 0);

            sendDnsResponse(responsePayload.array(), queryPacket, ipHeaderLen, out);
        } catch (Exception e) {
            Log.e(TAG, "Error forging NXDOMAIN", e);
        }
    }

    private short calculateHeaderChecksum(byte[] buffer, int length) {
        int sum = 0;
        int i = 0;
        while (length > 1) {
            sum += ((buffer[i] & 0xFF) << 8) | (buffer[i + 1] & 0xFF);
            if ((sum & 0xFFFF0000) != 0) {
                sum = (sum & 0xFFFF) + (sum >> 16);
            }
            i += 2;
            length -= 2;
        }
        if (length > 0) {
            sum += (buffer[i] & 0xFF) << 8;
            if ((sum & 0xFFFF0000) != 0) {
                sum = (sum & 0xFFFF) + (sum >> 16);
            }
        }
        return (short) (~sum & 0xFFFF);
    }

    // Minimal DNS Parser
    private String parseDnsQuestion(byte[] data, int offset) {
        try {
            StringBuilder sb = new StringBuilder();
            int pos = offset + 12; // Skip Header
            while (pos < data.length) {
                int len = data[pos] & 0xFF;
                if (len == 0)
                    break;
                if (sb.length() > 0)
                    sb.append(".");
                for (int i = 0; i < len; i++) {
                    sb.append((char) data[pos + 1 + i]);
                }
                pos += len + 1;
            }
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }

    private void sendBroadcast(String action, String domain) {
        Intent intent = new Intent("com.nopubly.TRAFFIC_LOG");
        intent.putExtra("action", action);
        intent.putExtra("domain", domain);
        intent.setPackage(getPackageName());
        sendBroadcast(intent);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    "nopubly_service",
                    "Nopubly Shield Active",
                    NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Shows that your privacy is being protected.");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return new Notification.Builder(this, "nopubly_service")
                    .setContentTitle("Nopubly")
                    .setContentText("Escudo de privacidad activo")
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .build();
        } else {
            return new Notification.Builder(this)
                    .setContentTitle("Nopubly")
                    .setContentText("Escudo de privacidad activo")
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .getNotification();
        }
    }

    private void loadBlocklist() {
        java.io.File file = new java.io.File(getFilesDir(), BLOCKLIST_FILENAME);
        if (!file.exists()) {
            Log.w(TAG, "Blocklist file not found: " + file.getAbsolutePath());
            return;
        }

        try (java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.FileReader(file))) {
            String line;
            blocklist.clear();
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (!line.isEmpty()) {
                    blocklist.add(line);
                }
            }
            Log.i(TAG, "Loaded " + blocklist.size() + " domains from " + BLOCKLIST_FILENAME);
        } catch (Exception e) {
            Log.e(TAG, "Error loading blocklist", e);
        }
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        try {
            if (vpnInterface != null)
                vpnInterface.close();
        } catch (Exception e) {
        }
    }
}
