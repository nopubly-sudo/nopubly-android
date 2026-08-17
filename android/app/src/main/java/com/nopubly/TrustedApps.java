package com.nopubly;

import java.util.HashSet;
import java.util.Set;

public class TrustedApps {
    public static final Set<String> TRUSTED = new HashSet<>();

    static {
        // Social Media
        TRUSTED.add("com.whatsapp");
        TRUSTED.add("com.facebook.katana");
        TRUSTED.add("com.instagram.android");
        TRUSTED.add("com.twitter.android");
        TRUSTED.add("com.snapchat.android");
        TRUSTED.add("com.zhiliaoapp.musically");
        TRUSTED.add("com.linkedin.android");
        TRUSTED.add("com.pinterest");
        TRUSTED.add("com.reddit.frontpage");
        TRUSTED.add("com.tumblr");

        // Communication
        TRUSTED.add("com.google.android.apps.messaging");
        TRUSTED.add("com.google.android.talk");
        TRUSTED.add("com.skype.raider");
        TRUSTED.add("com.viber.voip");
        TRUSTED.add("org.telegram.messenger");
        TRUSTED.add("org.thunderdog.challegram");
        TRUSTED.add("org.thoughtcrime.securesms");
        TRUSTED.add("com.whatsapp.w4b");
        TRUSTED.add("com.discord");
        TRUSTED.add("us.zoom.videomeetings");
        TRUSTED.add("com.microsoft.teams");

        // Google Apps
        TRUSTED.add("com.google.android.gms");
        TRUSTED.add("com.google.android.gsf");
        TRUSTED.add("com.android.chrome");
        TRUSTED.add("com.google.android.youtube");
        TRUSTED.add("com.google.android.apps.photos");
        TRUSTED.add("com.google.android.gm");
        TRUSTED.add("com.google.android.calendar");
        TRUSTED.add("com.google.android.apps.maps");
        TRUSTED.add("com.google.android.apps.docs");
        TRUSTED.add("com.google.android.apps.drive");

        // Banking & Payment
        TRUSTED.add("com.bankofamerica.mobile");
        TRUSTED.add("com.chase.mobile");
        TRUSTED.add("com.wellsfargo.mobile");
        TRUSTED.add("com.paypal.android");
        TRUSTED.add("com.venmo");
        TRUSTED.add("com.coinbase.android");
        TRUSTED.add("com.binance.dev");

        // Entertainment
        TRUSTED.add("com.spotify.music");
        TRUSTED.add("com.netflix.mediaclient");
        TRUSTED.add("com.amazon.mShop.android.shopping");
        TRUSTED.add("com.ebay.mobile");
        TRUSTED.add("com.amazon.avod.thirdpartyclient");
        TRUSTED.add("com.hulu.plus");
        TRUSTED.add("com.disney.disneyplus");
        TRUSTED.add("com. HBO.hbonow");

        // Productivity
        TRUSTED.add("com.microsoft.office.outlook");
        TRUSTED.add("com.dropbox.android");
        TRUSTED.add("com.evernote");
        TRUSTED.add("com.adobe.reader");
        TRUSTED.add("com.notion.id");
        TRUSTED.add("com.todoist");

        // Security Apps
        TRUSTED.add("com.avast.android.mobilesecurity");
        TRUSTED.add("com.avg.android.security.free");
        TRUSTED.add("com.bitdefender.security");
        TRUSTED.add("com.kaspersky.mobile");
        TRUSTED.add("com.mcafee.mobile.security");
        TRUSTED.add("com.norton.mobile.security");
        TRUSTED.add("com.malwarebytes.antimalware");

        // Games & Utilities
        TRUSTED.add("com.supercell.clashofclans");
        TRUSTED.add("com.king.candycrushsaga");
        TRUSTED.add("com.mojang.minecraftpe");
        TRUSTED.add("com.roblox.client");
        TRUSTED.add("com.google.android.apps.translate");
        TRUSTED.add("com.shazam.android");
        TRUSTED.add("com.waze");
        TRUSTED.add("com.ubercab");
        TRUSTED.add("com.lyft");

        // Remote Support (Whitelisted to prevent false positives)
        TRUSTED.add("com.teamviewer.teamviewer.market.mobile");
        TRUSTED.add("com.anydesk.anydeskandroid");
        TRUSTED.add("com.microsoft.rdc.android");
        TRUSTED.add("com.google.chromeremotedesktop");
        TRUSTED.add("com.sand.airdroid");
    }

    public static final Set<String> TRUSTED_PREFIXES = new HashSet<>();
    
    static {
        // Trusted Publishers (Prefixes)
        TRUSTED_PREFIXES.add("com.google.");
        TRUSTED_PREFIXES.add("com.facebook.");
        TRUSTED_PREFIXES.add("com.whatsapp.");
        TRUSTED_PREFIXES.add("com.instagram.");
        TRUSTED_PREFIXES.add("com.microsoft.");
        TRUSTED_PREFIXES.add("com.amazon.");
        TRUSTED_PREFIXES.add("com.netflix.");
        TRUSTED_PREFIXES.add("com.spotify.");
        TRUSTED_PREFIXES.add("com.canva.");
        TRUSTED_PREFIXES.add("com.lidl.");
        TRUSTED_PREFIXES.add("com.ubercab.");
        TRUSTED_PREFIXES.add("com.opera.");
    }

    public static boolean isTrusted(String packageName) {
        if (packageName == null) return false;
        if (TRUSTED.contains(packageName)) return true;
        for (String prefix : TRUSTED_PREFIXES) {
            if (packageName.startsWith(prefix)) return true;
        }
        return false;
    }
}
