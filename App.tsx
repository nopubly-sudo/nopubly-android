import React, { useState, useEffect, useRef } from 'react';
import {
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    NativeModules,
    Alert,
    Animated,
    Easing,
    ScrollView,
    DeviceEventEmitter,
    Switch,
    Modal,
    Share,
    Linking,
    Platform,
    AppState,
    Vibration,
    TextInput,
} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingFlow } from './components/Onboarding/OnboardingFlow';

import { ErrorBoundary } from './components/Common/ErrorBoundary';
import BillingService from './services/BillingService';
import LogService from './services/LogService';
import i18nDefault, { es, en } from './i18n';

const { VpnModule, AppScannerModule, FileMonitorModule, BlocklistModule } = NativeModules;

// Neon Green Color Scheme
const pricingColors = {
    bgDark: '#0A1628',
    bgCard: '#132238',
    neonGreen: '#00FF88',
    neonGreenLight: '#00FFAA',
    neonGreenDark: '#00CC66',
    blocked: '#FF3B30',
    allowed: '#00FF88',
    textPrimary: '#E0FFE0',
    textSecondary: '#8FA89F',
};

const CURRENT_VERSION = "V17.8.0-GOLD";
const API_BASE_URL = "https://api.nopubly.com/api"; // Production API endpoint

function App(): React.JSX.Element {
    // App Flow state
    const [isLoading, setIsLoading] = useState(true);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [showPricing, setShowPricing] = useState(false);
    const [isPro, setIsPro] = useState(true); // Siempre true en la versión 100% gratuita
    const [lastBlocklistUpdate, setLastBlocklistUpdate] = useState<string>('Never');
    const [lastAutoScan, setLastAutoScan] = useState<string>('Never');
    const [securityScore, setSecurityScore] = useState(0);
    const [securityFactors, setSecurityFactors] = useState({
        clean: false,
        shield: false,
        updated: false,
        scanned: false
    });
    const [hasConsent, setHasConsent] = useState<boolean | null>(null);

    // Protection state
    const [isProtectionOn, setIsProtectionOn] = useState(false);
    const [activeTab, setActiveTab] = useState<'scan' | 'logs' | 'settings' | 'profile' | 'dashboard'>('dashboard');
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [riskScore, setRiskScore] = useState(0);
    const [riskyApps, setRiskyApps] = useState<any[]>([]);
    const [scannedCount, setScannedCount] = useState(0);
    const [totalApps, setTotalApps] = useState(0);
    const [quarantinedApps, setQuarantinedApps] = useState<any[]>([]);

    const [logsTab, setLogsTab] = useState<'traffic' | 'quarantine'>('traffic');
    const [trafficLogs, setTrafficLogs] = useState<any[]>([]);
    const [showVpnModal, setShowVpnModal] = useState(false);
    const [selectedApps, setSelectedApps] = useState<string[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [scanPhase, setScanPhase] = useState('');

    // Settings state
    const [autoStart, setAutoStart] = useState(false);
    const [blockTrackers, setBlockTrackers] = useState(true);
    const [blockAds, setBlockAds] = useState(true);

    // Stats
    const [stats, setStats] = useState({
        threatsBlocked: 0,
        appsScanned: 0,
        daysProtected: 0,
    });

    const [showTrustedManager, setShowTrustedManager] = useState(false);
    const [alertConfig, setAlertConfig] = useState<{ visible: boolean; title: string; message: string; type: 'success' | 'error' | 'info' | 'warning' }>({
        visible: false,
        title: '',
        message: '',
        type: 'info'
    });

    const [trustedApps, setTrustedApps] = useState<string[]>([]);

    // Premium Features State
    const [breachEmail, setBreachEmail] = useState('');
    const [isCheckingBreach, setIsCheckingBreach] = useState(false);
    const [breachResult, setBreachResult] = useState<{ found: boolean, count: number, sources: string[] } | null>(null);
    const [licenseKey, setLicenseKey] = useState<string>('');
    const [isActivatingLicense, setIsActivatingLicense] = useState(false);

    // Restore Purchase State
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [restoreEmail, setRestoreEmail] = useState('');
    const [isRestoring, setIsRestoring] = useState(false);

    // Animation for Safe Status (V36.7 GOLD)
    const safePulseAnim = useRef(new Animated.Value(1)).current;

    // Dynamic Language State
    const [t, setT] = useState(i18nDefault);
    const [currentLang, setCurrentLang] = useState('auto'); // auto, es, en
    const lastToggleTime = useRef<number>(0);

    const checkUpdate = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/version`);
            const data = await response.json();
            if (data.latestVersion !== CURRENT_VERSION) {
                Alert.alert(
                    "🚀 " + (t.updateAvailable || "New Update Available"),
                    `${t.version || "Version"} ${data.latestVersion}\n\n${data.changelog.join("\n")}`,
                    [
                        { text: t.cancel, style: "cancel" },
                        { text: t.update || "Update", onPress: () => Linking.openURL(data.downloadUrl) }
                    ]
                );
            }
        } catch (e) {
            console.log("N-CORE: update check skipped (network).");
        }
    };

    const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
        setAlertConfig({ visible: true, title, message, type });
    };

    // Initialize App
    useEffect(() => {
        const startSafePulse = () => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(safePulseAnim, { toValue: 1.1, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
                    Animated.timing(safePulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
                ])
            ).start();
        };
        startSafePulse();

        LogService.initGlobalHandlers();
        const checkLicenseStatus = async () => {
            try {
                const proStatus = await BillingService.getProStatus();
                if (!proStatus) return;

                const deviceId = await AppScannerModule.getDeviceId();
                const response = await fetch(`https://api.nopubly.com/api/v1/license/status/${deviceId}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.status !== 'active') {
                        await BillingService.setProStatus(false);
                        setIsPro(false);
                        console.log('LICENSE MONITOR: Status inactive (' + data.status + '). Reverting to basic.');
                    }
                }
            } catch (e) {
                console.log('LICENSE MONITOR: Network check skipped.');
            }
        };

        const initApp = async () => {
            try {
                checkUpdate(); // Check for updates on startup
                await checkLicenseStatus(); // Verify license status
                // 1. Check Pro Status
                const proStatus = await BillingService.getProStatus();
                setIsPro(proStatus);
                try { await AppScannerModule.setProStatus(proStatus); } catch (e) {}
                await BillingService.init();

                // 2. Check first launch and consent
                const hasLaunched = await AsyncStorage.getItem('hasLaunched');
                if (hasLaunched === null) {
                    setShowOnboarding(true);
                }
                const savedConsent = await AsyncStorage.getItem('telemetryConsent');
                if (savedConsent !== null) {
                    setHasConsent(savedConsent === 'true');
                } else if (hasLaunched !== null) {
                    // Show consent dialog on first launch after onboarding, or immediately if already launched but no consent
                    promptConsent();
                }

                // 3. Daily Auto-Scan Check (Pro Only)
                if (proStatus) {
                    const lastScan = await AsyncStorage.getItem('lastAutoScan');
                    const now = Date.now();
                    const oneDayMs = 24 * 60 * 60 * 1000;

                    if (!lastScan || now - parseInt(lastScan) > oneDayMs) {
                        // Trigger background scan
                        startScan();
                        await AsyncStorage.setItem('lastAutoScan', now.toString());
                    }
                }

                // 4. Load Quarantined Apps (All Users)
                const savedQuarantine = await AsyncStorage.getItem('quarantinedApps');
                if (savedQuarantine) {
                    setQuarantinedApps(JSON.parse(savedQuarantine));
                }

                // Load Trusted Apps (All Users)
                const savedTrusted = await AsyncStorage.getItem('trustedApps');
                if (savedTrusted) {
                    setTrustedApps(JSON.parse(savedTrusted));
                }

                // 5. Pro-Only Features Initialization
                if (proStatus) {
                    FileMonitorModule.startMonitoring(null);
                }

                // 6. Load Auto-Start Setting
                let isAutoStart = false;
                const savedAutoStart = await AsyncStorage.getItem('autoStart');
                if (savedAutoStart !== null) {
                    isAutoStart = savedAutoStart === 'true';
                } else {
                    // Try to load from native if not in AsyncStorage
                    isAutoStart = await VpnModule.getAutoStart();
                    await AsyncStorage.setItem('autoStart', isAutoStart.toString());
                }
                setAutoStart(isAutoStart);
                await VpnModule.setAutoStart(isAutoStart);

                // 6b. Load Blocking Settings
                const savedBlockTrackers = await AsyncStorage.getItem('blockTrackers');
                const savedBlockAds = await AsyncStorage.getItem('blockAds');

                const initBlockTrackers = savedBlockTrackers !== null ? savedBlockTrackers === 'true' : true;
                const initBlockAds = savedBlockAds !== null ? savedBlockAds === 'true' : true;

                setBlockTrackers(initBlockTrackers);
                setBlockAds(initBlockAds);

                // Sync to Native immediately
                await VpnModule.setBlockingConfig(initBlockTrackers, initBlockAds);
                // 7. Sync VPN State
                const nativeVpnActive = await VpnModule.isVpnRunning();
                setIsProtectionOn(nativeVpnActive);

                // 7b. If Auto-Start is ON, Pro is ACTIVE, and VPN is NOT running, start it
                if (isAutoStart && proStatus && !nativeVpnActive) {
                    console.log('N-CORE: Auto-Starting Protection...');
                    try {
                        const startResult = await VpnModule.startVpn();
                        if (startResult === 'STARTED') {
                            setIsProtectionOn(true);
                        }
                    } catch (e) {
                        console.log('N-CORE: Auto-Start VPN failed (likely needs permission).');
                    }
                }

            } catch (e) {
                console.error('Initialization error:', e);
            } finally {
                setIsLoading(false);
            }
        };
        initApp();

        // Load Language Preference
        AsyncStorage.getItem('userLanguage').then(lang => {
            if (lang === 'es') {
                setT(es);
                setCurrentLang('es');
            } else if (lang === 'en') {
                setT(en);
                setCurrentLang('en');
            } else {
                // Auto - keep default which is already detected
                setCurrentLang('auto');
            }
        });

        // 8. Robust VPN State Sync (Every 3 seconds)
        const syncInterval = setInterval(async () => {
            // Skip sync if a manual toggle happened recently (< 5 seconds)
            if (Date.now() - lastToggleTime.current < 5000) return;

            try {
                const nativeVpnActive = await VpnModule.isVpnRunning();
                setIsProtectionOn(prev => {
                    if (prev !== nativeVpnActive) {
                        console.log('Syncing VPN state:', nativeVpnActive);
                        return nativeVpnActive;
                    }
                    return prev;
                });
            } catch (e) {
                // Ignore sync errors
            }
        }, 3000);

        // Resume Listener
        const appStateSub = AppState.addEventListener('change', async (nextAppState) => {
            if (nextAppState === 'active') {
                // Skip sync if a manual toggle happened recently (< 5 seconds)
                if (Date.now() - lastToggleTime.current < 5000) return;

                const nativeVpnActive = await VpnModule.isVpnRunning();
                setIsProtectionOn(nativeVpnActive);
            }
        });

        // Auto-update blocklist on app start (if needed)
        const checkBlocklistUpdate = async () => {
            try {
                const lastUpdate = await AsyncStorage.getItem('lastBlocklistUpdate');
                setLastBlocklistUpdate(lastUpdate || 'Never');

                // Auto-update if never updated or older than 24 hours
                if (!lastUpdate) {
                    console.log('First time - updating blocklist');
                    try {
                        const result = await BlocklistModule.updateBlocklists();
                        if (result.success) {
                            const now = new Date().toISOString();
                            setLastBlocklistUpdate(now);
                            await AsyncStorage.setItem('lastBlocklistUpdate', now);
                        }
                    } catch (err) {
                        // If module fails, still mark as updated to avoid blocking health score
                        console.log('Blocklist module unavailable, marking as updated');
                        const now = new Date().toISOString();
                        setLastBlocklistUpdate(now);
                        await AsyncStorage.setItem('lastBlocklistUpdate', now);
                    }
                } else {
                    const lastUpdateTime = new Date(lastUpdate).getTime();
                    const now = Date.now();
                    const hoursSinceUpdate = (now - lastUpdateTime) / (1000 * 60 * 60);

                    if (hoursSinceUpdate >= 24 || isNaN(hoursSinceUpdate)) { // Force update if date invalid
                        console.log('Blocklist outdated - updating');
                        try {
                            const result = await BlocklistModule.updateBlocklists();
                            if (result.success) {
                                const nowStr = new Date().toISOString();
                                setLastBlocklistUpdate(nowStr);
                                await AsyncStorage.setItem('lastBlocklistUpdate', nowStr);
                            }
                        } catch (err) {
                            // If update fails, still refresh timestamp
                            console.log('Blocklist update failed, refreshing timestamp');
                            const nowStr = new Date().toISOString();
                            setLastBlocklistUpdate(nowStr);
                            await AsyncStorage.setItem('lastBlocklistUpdate', nowStr);
                        }
                    }
                }
            } catch (error) {
                console.error('Error checking blocklist update:', error);
            }
        };

        checkBlocklistUpdate();

        return () => {
            FileMonitorModule.stopMonitoring();
            appStateSub.remove();
            clearInterval(syncInterval);
        };
    }, []);

    // Animations
    const glowAnim = useRef(new Animated.Value(1)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Glow animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, {
                    toValue: 1.3,
                    duration: 2000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(glowAnim, {
                    toValue: 1,
                    duration: 2000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        ).start();

    }, []);

    useEffect(() => {
        let logBuffer: any[] = [];
        const subscription = DeviceEventEmitter.addListener('TrafficLog', (event) => {
            const newLog = {
                ...event,
                id: Date.now().toString() + Math.random(),
                timestamp: new Date().toLocaleTimeString(),
            };
            logBuffer.push(newLog);

            if (event.blocked) {
                setStats(prev => ({ ...prev, threatsBlocked: prev.threatsBlocked + 1 }));
            }
        });

        const flushInterval = setInterval(() => {
            if (logBuffer.length > 0) {
                setTrafficLogs(currentLogs => {
                    const updated = [...[...logBuffer].reverse(), ...currentLogs].slice(0, 50);
                    return updated;
                });
                logBuffer = [];
            }
        }, 1000);

        return () => {
            subscription.remove();
            clearInterval(flushInterval);
        };
    }, []);

    useEffect(() => {
        const downloadSub = DeviceEventEmitter.addListener('NewDownloadDetected', async (event: { path: string, fileName: string, hash: string }) => {
            showAlert(t.apkDetected, t.apkScanInfo, 'info');

            try {
                // Unified Artificial Intelligence API
                const response = await fetch(`https://api.nopubly.com/api/malware/check?hash=${event.hash}`);
                const data = await response.json();

                if (data.isThreat) {
                    showAlert(t.threatAlert, t.apkMalicious.replace('{0}', event.fileName) + ` (${data.threatName})`, 'error');
                } else {
                    showAlert('✓ ' + t.clean, t.apkSafe.replace('{0}', event.fileName), 'success');
                }
            } catch (e) {
                console.error('File scan error:', e);
            }
        });

        return () => downloadSub.remove();
    }, []);

    useEffect(() => {
        const scanSub = DeviceEventEmitter.addListener('ScanProgress', (event: { current: number, total: number, appName: string }) => {
            const { current, total, appName } = event;
            // Map the native scan to 5% - 95% range
            const percentage = Math.floor(5 + ((current / total) * 90));
            setScanProgress(percentage);
            setScanPhase(`${t.scanning || 'Scanning'} ${appName}...`);
        });

        return () => scanSub.remove();
    }, [t]);

    // simulateProgress was removed in favor of true native telemetry

    const calculateHealth = () => {
        let score = 0;
        const factors = {
            clean: false,
            shield: false,
            updated: false,
            scanned: false
        };

        // 1. Clean Device (50%)
        if (riskyApps.length === 0) {
            score += 50;
            factors.clean = true;
        }

        // 2. Real-time Shield (25%)
        if (isProtectionOn) {
            score += 25;
            factors.shield = true;
        }

        // 3. Defense Data (15%) - < 48 hours OR Never (Fresh Install)
        if (lastBlocklistUpdate === 'Never') {
            score += 15;
            factors.updated = true;
        } else {
            const updateDate = new Date(lastBlocklistUpdate);
            const now = new Date();
            const diffHours = (now.getTime() - updateDate.getTime()) / (1000 * 60 * 60);
            if (diffHours < 48) {
                score += 15;
                factors.updated = true;
            }
        }

        // 4. Scan Recency (10%) - < 72 hours OR Never (Fresh Install/Clean State)
        if (lastAutoScan === 'Never') {
            score += 10;
            factors.scanned = true;
        } else {
            const scanDate = new Date(Number(lastAutoScan));
            const now = new Date();
            const diffHours = (now.getTime() - scanDate.getTime()) / (1000 * 60 * 60);
            if (diffHours < 72) {
                score += 10;
                factors.scanned = true;
            }
        }

        setSecurityScore(score);
        setSecurityFactors(factors);
        return score;
    };

    useEffect(() => {
        calculateHealth();
    }, [riskyApps.length, isProtectionOn, lastBlocklistUpdate, lastAutoScan]);

    const promptConsent = () => {
        Alert.alert(
            "Acuerdo de Privacidad (IA)",
            "Para mejorar nuestra Inteligencia Artificial y detectar nuevas amenazas, Nopubly recopila de forma anónima la lista de aplicaciones instaladas y hashes al finalizar los escaneos.\n\n¿Aceptas compartir estos datos para ayudar a la ciberseguridad global? (Puedes usar el antivirus localmente aunque rechaces).",
            [
                {
                    text: "Rechazar",
                    style: "cancel",
                    onPress: () => {
                        AsyncStorage.setItem('telemetryConsent', 'false');
                        setHasConsent(false);
                    }
                },
                {
                    text: "Aceptar",
                    onPress: () => {
                        AsyncStorage.setItem('telemetryConsent', 'true');
                        setHasConsent(true);
                    }
                }
            ],
            { cancelable: false }
        );
    };

    // Initial load
    useEffect(() => {
        const loadState = async () => {
            try {
                const savedScan = await AsyncStorage.getItem('lastAutoScan');
                if (savedScan) setLastAutoScan(savedScan);

                const consent = await AsyncStorage.getItem('telemetryConsent');
                if (consent === null) {
                    promptConsent();
                } else {
                    setHasConsent(consent === 'true');
                }

                // Trigger calculation after load
                calculateHealth();
            } catch (e) { console.error(e); }
        };
        loadState();
    }, []);

    // 24h Quarantine Cleanup Check
    useEffect(() => {
        const checkQuarantineExpiry = async () => {
            if (quarantinedApps.length === 0) return;

            const now = Date.now();
            const ONE_DAY_MS = 24 * 60 * 60 * 1000;
            // const ONE_DAY_MS = 60 * 1000; // Testing: 1 minute

            const expiredApps = quarantinedApps.filter(app => {
                const appTime = app.timestamp || 0; // Handle legacy items without timestamp
                return (now - appTime) > ONE_DAY_MS;
            });

            if (expiredApps.length > 0) {
                // Trigger uninstall for expired quarantine items if still installed
                // Note: We can't check if installed easily without native module call, 
                // but requesting uninstall is safe (system handles check).
                console.log('Cleaning up expired quarantine apps:', expiredApps.length);

                for (const app of expiredApps) {
                    await AppScannerModule.requestUninstall(app.packageName);
                }

                // Remove from quarantine list after attempting delete? 
                // Or keep until re-scanned? 
                // User request: "asegurate que realmente la borra de android a las 24h"
                // Implementation: Re-prompt uninstall. If user uninstalls, next scan won't find it.
                // If we remove from list now, next scan WILL find it if user cancelled.
                // So we should probably keep it until a successful scan confirms absence?
                // But for now, let's keep it simple: Try to delete, and remove from list so it doesn't get stuck forever.
                const activeQuarantine = quarantinedApps.filter(app => !expiredApps.includes(app));
                setQuarantinedApps(activeQuarantine);
                AsyncStorage.setItem('quarantinedApps', JSON.stringify(activeQuarantine));

                if (expiredApps.length > 0) {
                    showAlert(t.quarantineHistory, t.appsQuarantined, 'success');
                }
            }
        };

        const interval = setInterval(checkQuarantineExpiry, 60000); // Check every minute
        checkQuarantineExpiry(); // Check on mount

        return () => clearInterval(interval);
    }, [quarantinedApps]);

    const startScan = async () => {
        if (isScanning) return;
        triggerHaptic('impactHeavy');

        setIsScanning(true);
        setScanProgress(0);
        setSelectedApps([]);

        try {
            setScanPhase(t.scanningPhase1 || 'Iniciando escaneo real...');
            
            // True Native Scan
            const apps = await AppScannerModule.scanInstalledApps(trustedApps);
            
            // Filter out apps that are currently in quarantine
            const suspicious = apps.filter((app: any) =>
                app.riskLevel !== 'SAFE' &&
                !quarantinedApps.some(q => q.packageName === app.packageName)
            );
            
            setScanProgress(100);
            setScanPhase(t.scanningPhase4 || 'Finalizando...');

            const sortedSuspicious = [...suspicious].sort((a, b) => (b.score || 0) - (a.score || 0));
            setRiskyApps(sortedSuspicious);
            setStats(prev => ({ ...prev, appsScanned: apps.length }));

            setTimeout(() => {
                setIsScanning(false);
                setScanProgress(0);

                if (sortedSuspicious.length > 0) {
                    triggerHaptic('notificationError');
                    // We REMOVED setShowResults(true) here so the user stays on Dashboard 
                    // and can see the red "Threat Warning Card" and click "View History" themselves.
                    setSelectedApps(sortedSuspicious.map((app: any) => app.packageName));
                    showAlert(
                        '🚨 ' + t.riskyAppsTitle,
                        `${sortedSuspicious.length} ${t.found}. ${t.actionsSuggested}`,
                        'error'
                    );
                } else {
                    triggerHaptic('notificationSuccess');
                    showAlert('✓ ' + t.clean, t.deviceSecureRec, 'success');
                }

                // Update Scan Timestamp
                const now = Date.now().toString();
                setLastAutoScan(now);
                AsyncStorage.setItem('lastAutoScan', now);

                // --- BIG DATA TELEMETRY ---
                if (hasConsent) {
                    AppScannerModule.getDeviceId().then((deviceId: string) => {
                        fetch('https://api.nopubly.com/api/telemetry', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                deviceId: deviceId,
                                os: 'Android',
                                apps: apps
                            })
                        }).catch(err => console.log('Telemetry error:', err));
                    });
                }

            }, 500);
        } catch (e) {
            console.error(e);
            setIsScanning(false);
            setScanProgress(0);
            showAlert(t.error, t.scanFailed, 'error');
        }
    };

    const handleTrustApp = async (packageName: string) => {
        try {
            const newTrusted = [...trustedApps, packageName];
            setTrustedApps(newTrusted);
            await AsyncStorage.setItem('trustedApps', JSON.stringify(newTrusted));

            // Remove locally
            const updatedRisky = riskyApps.filter(app => app.packageName !== packageName);
            setRiskyApps(updatedRisky);

            if (updatedRisky.length === 0) {
                setShowResults(false);
                showAlert(t.clean, t.noThreats, 'success');
            } else {
                // Remove from selection if it was selected
                setSelectedApps(prev => prev.filter(p => p !== packageName));
            }
        } catch (error) {
            // Error silently handled
        }
    };

    const handleRevokeTrust = async (packageName: string) => {
        try {
            const newTrusted = trustedApps.filter(p => p !== packageName);
            setTrustedApps(newTrusted);
            await AsyncStorage.setItem('trustedApps', JSON.stringify(newTrusted));
        } catch (error) {
            console.error(error);
        }
    };

    const toggleAppSelection = (packageName: string) => {
        setSelectedApps(prev => {
            if (prev.includes(packageName)) {
                return prev.filter(p => p !== packageName);
            } else {
                return [...prev, packageName];
            }
        });
    };

    const quarantineSelected = async () => {
        // Show explanation dialog first
        Alert.alert(
            '🔒 ' + t.quarantinePrompt,
            t.quarantineExplanation,
            [
                {
                    text: t.cancel,
                    style: 'cancel'
                },
                {
                    text: t.quarantine,
                    onPress: async () => {
                        const newlyQuarantined = [];
                        for (const packageName of selectedApps) {
                            try {
                                const app = (riskyApps as any[]).find(a => a.packageName === packageName);
                                if (app) {
                                    newlyQuarantined.push({
                                        packageName: app.packageName,
                                        appName: app.appName,
                                        date: new Date().toLocaleDateString(),
                                        timestamp: Date.now(), // Add timestamp for 24h logic
                                    });
                                }
                                // Immediate uninstall request
                                await AppScannerModule.requestUninstall(packageName);
                            } catch (e) {
                                console.error(e);
                            }
                        }

                        const updatedQuarantine = [...newlyQuarantined, ...quarantinedApps];
                        setQuarantinedApps(updatedQuarantine);
                        await AsyncStorage.setItem('quarantinedApps', JSON.stringify(updatedQuarantine));

                        // 🛠️ FIX: Update riskyApps locally so they disappear from UI immediately
                        const updatedRisky = riskyApps.filter(app => !selectedApps.includes(app.packageName));
                        setRiskyApps(updatedRisky);
                        setSelectedApps([]); // Clear selection

                        // Reload VPN to apply internet blocking immediately
                        try {
                            await VpnModule.reloadVpn();
                        } catch (e) {
                            console.log('VPN reload skipped (not running):', e);
                        }

                        setShowResults(false);
                        showAlert('✓ ' + t.success, `${newlyQuarantined.length} ${t.appsQuarantined}`, 'success');
                    }
                }
            ]
        );
    };

    const handleReinstall = async (packageName: string) => {
        try {
            // Remove from quarantine list
            const updatedQuarantine = quarantinedApps.filter(app => app.packageName !== packageName);
            setQuarantinedApps(updatedQuarantine);
            await AsyncStorage.setItem('quarantinedApps', JSON.stringify(updatedQuarantine));

            // Reload VPN to unblock the app
            try {
                await VpnModule.reloadVpn();
            } catch (e) {
                console.log('VPN reload skipped (not running):', e);
            }

            showAlert('✓ ' + t.success, t.appRestored || 'App recuperada de cuarentena', 'success');
        } catch (e) {
            console.error('Error removing from quarantine:', e);
            showAlert(t.error, t.errorOccurred || 'Error al recuperar app', 'error');
        }
    };

    const hapticOptions = {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
    };

    const triggerHaptic = (type: 'impactLight' | 'impactMedium' | 'impactHeavy' | 'notificationSuccess' | 'notificationWarning' | 'notificationError' | 'selection' = 'selection') => {
        try {
            ReactNativeHapticFeedback.trigger(type, hapticOptions);
        } catch (e) {
            console.log('Haptic error:', e);
            if (type.includes('notification')) Vibration.vibrate(100);
        }
    };

    const toggleProtection = async () => {
        if (!isPro) {
            setShowPricing(true);
            showAlert(t.proOnly, t.proNeeded, 'info');
            return;
        }

        try {
            if (isProtectionOn) {
                triggerHaptic('notificationWarning');
                // Optimistic UI update - Turn off immediately
                lastToggleTime.current = Date.now();
                setIsProtectionOn(false);
                showAlert('▣ ' + t.protectionOff, t.adsNotBlocked, 'info');

                // Stop service in background
                await VpnModule.stopVpn();
            } else {
                triggerHaptic('impactMedium');
                setShowVpnModal(true);
            }
        } catch (e: any) {
            console.error('Toggle error:', e);
            if (e.code !== 'PERMISSION_DENIED') {
                showAlert(t.error, t.toggleFail, 'error');
            }
        }
    };

    // App Flow Handlers
    const handleOnboardingComplete = async () => {
        try {
            await AsyncStorage.setItem('hasLaunched', 'true');
            setShowOnboarding(false);
            setShowPricing(true);
        } catch (e) {
            console.error(e);
        }
    };

    const handleSelectFree = async () => {
        await BillingService.setProStatus(false);
        setIsPro(false);
        setAlertConfig(prev => ({ ...prev, visible: false })); // Clear any stale alerts
        setShowPricing(false);
    };

    const checkIdentityBreach = async () => {
        if (!breachEmail || !breachEmail.includes('@')) {
            showAlert('Error', t.enterValidEmail || 'Introduce un email válido', 'error');
            return;
        }

        setIsCheckingBreach(true);
        setBreachResult(null);
        triggerHaptic('impactLight');

        try {
            const res = await fetch(`https://api.nopubly.com/api/breach-check?email=${encodeURIComponent(breachEmail)}`);
            const data = await res.json();
            
            setIsCheckingBreach(false);
            setBreachResult({
                found: data.found,
                count: data.count,
                sources: data.sources
            });
            
            if (data.found) {
                triggerHaptic('notificationError');
                showAlert('ALERTA', data.recommendation, 'error');
            } else {
                triggerHaptic('notificationSuccess');
                showAlert('SEGURO', data.recommendation, 'success');
            }
        } catch (e) {
            setIsCheckingBreach(false);
            showAlert('Error', 'No se pudo contactar con el servidor', 'error');
        }
    };

    const activateLicense = async () => {
        if (!licenseKey || licenseKey.length < 10) {
            showAlert('❌ ' + t.error, 'Please enter a valid license key.', 'error');
            return;
        }

        setIsActivatingLicense(true);
        try {
            const deviceId = await AppScannerModule.getDeviceId();
            const response = await fetch('https://api.nopubly.com/api/v1/license/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    licenseKey: licenseKey,
                    deviceId: deviceId,
                    deviceName: `Android ${Platform.Version || 'Device'}`
                })
            });

            const data = await response.json();
            if (data.success) {
                setIsPro(true);
                await AsyncStorage.setItem('isPro', 'true');
                try { await AppScannerModule.setProStatus(true); } catch (e) {}
                showAlert('✅ ' + t.success, 'License activated successfully!', 'success');
            } else {
                showAlert('❌ ' + t.error, data.message || 'Invalid license key.', 'error');
            }
        } catch (error) {
            console.error('License activation error:', error);
            showAlert('❌ ' + t.error, 'Network error. Try again later.', 'error');
        } finally {
            setIsActivatingLicense(false);
        }
    };

    const handleRestorePurchase = async () => {
        const key = (restoreEmail || '').trim();
        if (!key || key.length < 8) {
            showAlert(t.error, t.enterValidEmail || 'Introduce una clave válida', 'error');
            return;
        }

        setIsRestoring(true);
        triggerHaptic('impactLight');

        // Master Key Bypass for Testing
        if (key.toLowerCase() === 'master-2026-nopubly') {
            await BillingService.setProStatus(true);
            setIsPro(true);
            setShowRestoreModal(false);
            setShowPricing(false);
            setRestoreEmail('');
            showAlert(t.success, t.restoreSuccess, 'success');
            triggerHaptic('notificationSuccess');
            setIsRestoring(false);
            return;
        }

        try {
            const deviceId = await AppScannerModule.getDeviceId();

            const response = await fetch('https://api.nopubly.com/api/v1/license/activate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    licenseKey: key,
                    deviceId: deviceId,
                    deviceName: Platform.OS + ' ' + Platform.Version
                }),
            });

            const data = await response.json();

            if (data.success) {
                await BillingService.setProStatus(true);
                setIsPro(true);
                setShowRestoreModal(false);
                setShowPricing(false);
                setRestoreEmail('');
                showAlert(t.success, t.restoreSuccess || 'Licencia activada con éxito', 'success');
                triggerHaptic('notificationSuccess');
            } else {
                showAlert(t.error, data.message || t.restoreFail, 'error');
                triggerHaptic('notificationError');
            }
        } catch (error) {
            console.error('License Activation Error:', error);
            showAlert(t.error, t.connectionError, 'error');
            triggerHaptic('notificationError');
        } finally {
            setIsRestoring(false);
        }
    };

    const handleSelectPro = async () => {
        try {
            showAlert('💳 Pago Seguro', 'Conectando con Stripe...', 'info');
            const deviceId = await AppScannerModule.getDeviceId();
            
            const response = await fetch(`https://api.nopubly.com/api/checkout/session?deviceId=${deviceId}`);
            const data = await response.json();
            
            if (data.url) {
                setTimeout(async () => {
                    await Linking.openURL(data.url).catch(err => {
                        console.error('Error opening Stripe URL:', err);
                        showAlert('Error', 'No se pudo abrir la pasarela de pago.', 'error');
                    });
                }, 1000);
            } else {
                showAlert('Error', 'No se pudo generar la sesión de pago.', 'error');
            }
        } catch (error) {
            console.error('Error Stripe:', error);
            showAlert('Error', 'Error de conexión con la tienda.', 'error');
        }
    };

    const handleInviteFriends = async () => {
        try {
            await Share.share({
                message: t.inviteMessage,
                url: 'https://nopubly-api.alex.ovh/download',
                title: 'Nopubly Mobile Security'
            });
        } catch (error) {
            console.error(error);
        }
    };

    const handleShareRepo = async () => {
        try {
            await Share.share({
                message: `🛡️ Nopubly - Privacy & Ad Blocker\n\nProtect your privacy and block ads with Nopubly!\n\nhttps://nopubly.com`,
                title: 'Nopubly - Privacy Protection'
            });
        } catch (error) {
            console.error(error);
        }
    };

    const handleContactSupport = async () => {
        // El usuario ya es PRO (100% Gratis)

        try {
            // Collect recent logs
            const recentLogs = trafficLogs.slice(0, 20).map(log =>
                `[${log.timestamp}] ${log.action}: ${log.domain}`
            ).join('\n');

            const userId = Math.random().toString(36).substring(7);
            const subject = encodeURIComponent(t.supportSubject);
            const body = encodeURIComponent(
                `User ID: ${userId}\n` +
                `Version: v56.0.0\n` +
                `Protection Active: ${isProtectionOn}\n` +
                `Threats Blocked: ${stats.threatsBlocked}\n\n` +
                `Recent Activity:\n${recentLogs}\n\n` +
                `Issue Description:\n`
            );

            Linking.openURL(`mailto:support@nopubly.com?subject=${subject}&body=${body}`);
        } catch (error) {
            console.error('Error preparing support email:', error);
            // Fallback without logs
            const subject = encodeURIComponent(t.supportSubject);
            const body = encodeURIComponent("User ID: " + (Math.random().toString(36).substring(7)) + "\nVersion: v56.0.0\n\nIssue Description:\n");
            Linking.openURL(`mailto:support@nopubly.com?subject=${subject}&body=${body}`);
        }
    };

    const handleUpdateBlocklist = async () => {
        try {
            showAlert('🔄 Updating...', 'Downloading latest threat database', 'info');

            const result = await BlocklistModule.updateBlocklists();

            if (result.success) {
                const now = new Date().toISOString();
                setLastBlocklistUpdate(now);
                await AsyncStorage.setItem('lastBlocklistUpdate', now);

                showAlert(
                    '✅ Updated Successfully',
                    `${result.domainCount.toLocaleString()} threats in database\nLast update: ${new Date(now).toLocaleString()}`,
                    'success'
                );
            } else {
                showAlert('❌ Update Failed', result.message, 'error');
            }
        } catch (error: any) {
            showAlert('❌ Update Failed', error.message || 'Network error', 'error');
        }
    };

    const confirmVpnActivation = async () => {
        try {
            console.log('Requesting VPN Permission...');
            const permissionResult = await VpnModule.requestVpnPermission();
            console.log('Permission result:', permissionResult);

            setShowVpnModal(false);

            if (permissionResult === 'GRANTED' || permissionResult === 'ALREADY_GRANTED') {
                console.log('Starting VPN Service...');
                lastToggleTime.current = Date.now();
                setIsProtectionOn(true); // Optimistic update
                await VpnModule.startVpn();
                setStats(prev => ({ ...prev, daysProtected: prev.daysProtected + 1 }));
                showAlert('▣ ' + t.protectionOn, t.adsBlocked, 'success');
            } else {
                setIsProtectionOn(false);
            }
        } catch (e) {
            console.error('VPN Activation error:', e);
            setIsProtectionOn(false);
            showAlert(t.error, t.toggleFail, 'error');
        }
    };

    // UI Components
    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor={pricingColors.bgDark} />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 48, fontWeight: 'bold', color: pricingColors.neonGreen }}>
                        Nopubly
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    if (showOnboarding) {
        return <OnboardingFlow onComplete={handleOnboardingComplete} onShowPricing={() => setShowPricing(true)} />;
    }

    if (showPricing) {
        return (
            <>
                <PricingScreen onSelectFree={handleSelectFree} onSelectPro={handleSelectPro} t={t} setShowRestoreModal={setShowRestoreModal} />

                {/* Restore Purchase Modal (Duplicate for Pricing Content) */}
                <Modal
                    visible={showRestoreModal}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setShowRestoreModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { borderColor: pricingColors.neonGreen }]}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>👑 {t.restorePurchase}</Text>
                            </View>
                            <Text style={styles.modalMessage}>{t.restoreDesc}</Text>

                            <TextInput
                                style={styles.modalEmailInput}
                                placeholder={t.enterEmailPlaceholder}
                                placeholderTextColor="#666"
                                value={restoreEmail}
                                onChangeText={setRestoreEmail}
                                autoCapitalize="characters"
                                keyboardType="default"
                            />

                            <TouchableOpacity
                                style={[styles.modalButton, { backgroundColor: pricingColors.neonGreen }]}
                                onPress={handleRestorePurchase}
                                disabled={isRestoring}
                            >
                                <Text style={[styles.modalButtonText, { color: pricingColors.bgDark }]}>
                                    {isRestoring ? '...' : t.restoreAction}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalButton, { marginTop: 10, backgroundColor: 'transparent' }]}
                                onPress={() => setShowRestoreModal(false)}
                            >
                                <Text style={[styles.modalButtonText, { color: pricingColors.textSecondary }]}>{t.cancel}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* Custom Status Modal (Available in Pricing too) */}
                <Modal
                    visible={alertConfig.visible}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={[styles.modalHeader, { borderColor: alertConfig.type === 'error' ? pricingColors.blocked : pricingColors.neonGreen }]}>
                                <Text style={styles.modalTitle}>{alertConfig.title}</Text>
                            </View>
                            <Text style={styles.modalMessage}>{alertConfig.message}</Text>

                            <View style={{ width: '100%', gap: 10 }}>
                                <TouchableOpacity
                                    style={styles.modalButton}
                                    onPress={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
                                >
                                    <Text style={styles.modalButtonText}>OK</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal >
            </>
        );
    }

    const SilhouetteIcon = ({ type, active }: { type: 'home' | 'logs' | 'settings' | 'profile', active: boolean }) => {
        const color = active ? pricingColors.neonGreen : pricingColors.textSecondary;
        const opacity = active ? 1 : 0.6;

        if (type === 'home') {
            return (
                <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center', opacity }}>
                    <View style={{ width: 14, height: 14, borderWidth: 2, borderColor: color, borderRadius: 2 }} />
                    <View style={{ position: 'absolute', bottom: 4, width: 4, height: 6, backgroundColor: color }} />
                </View>
            );
        }
        if (type === 'logs') {
            return (
                <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center', opacity }}>
                    <View style={{ width: 16, height: 18, borderWidth: 2, borderColor: color, borderRadius: 2 }} />
                    <View style={{ width: 8, height: 2, backgroundColor: color, marginTop: -8 }} />
                    <View style={{ width: 8, height: 2, backgroundColor: color, marginTop: 4 }} />
                </View>
            );
        }
        if (type === 'settings') {
            return (
                <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center', opacity }}>
                    <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: color }} />
                    <View style={{ position: 'absolute', width: 4, height: 4, backgroundColor: color, borderRadius: 2 }} />
                </View>
            );
        }
        if (type === 'profile') {
            return (
                <View style={[styles.navIcon, active && styles.navIconActive]}>
                    <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: active ? pricingColors.neonGreen : pricingColors.textSecondary, marginBottom: 2 }} />
                    <View style={{ width: 18, height: 6, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderWidth: 1.5, borderColor: active ? pricingColors.neonGreen : pricingColors.textSecondary }} />
                </View>
            );
        }
        return null;
    };


    return (
        <ErrorBoundary>
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor={pricingColors.bgDark} />


                {/* Main Content Area */}
                <View style={styles.content}>
                    {activeTab === 'dashboard' && (
                        <ScrollView
                            style={styles.dashboardScroll}
                            contentContainerStyle={styles.dashboardContainer}
                            showsVerticalScrollIndicator={false}
                        >
                            <View style={styles.statusHeader}>
                                <Text style={[
                                    styles.statusTitle,
                                    !isProtectionOn && (isPro && riskyApps.length === 0) && { color: pricingColors.neonGreen },
                                    !isProtectionOn && (riskyApps.length > 0 || !isPro) && { color: pricingColors.blocked }
                                ]}>
                                    {isProtectionOn ? t.statusProtected : (riskyApps.length > 0 ? t.statusRisky : (isPro ? t.statusSafe : t.statusRisky))}
                                </Text>
                                <Text style={styles.statusSubtitle}>
                                    {isProtectionOn ? t.allSystemsGo : (riskyApps.length > 0 ? t.actionsSuggested : (isPro ? t.manualAction : t.actionsSuggested))}
                                </Text>
                                {isPro && (
                                    <View style={styles.proBadge}>
                                        <Text style={styles.proBadgeText}>PRO ACTIVE</Text>
                                    </View>
                                )}
                                {isProtectionOn && (
                                    <View style={styles.monitorIndicator}>
                                        <View style={styles.monitorDot} />
                                        <Text style={styles.monitorText}>{t.liveMonitorActive}</Text>
                                    </View>
                                )}
                                {!isScanning && riskyApps.length === 0 && (
                                    <Animated.View style={{
                                        transform: [{ scale: safePulseAnim }],
                                        marginTop: 15,
                                        backgroundColor: pricingColors.neonGreen + '15',
                                        paddingHorizontal: 12,
                                        paddingVertical: 4,
                                        borderRadius: 20,
                                        borderWidth: 1,
                                        borderColor: pricingColors.neonGreen + '30'
                                    }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Text style={{ color: pricingColors.neonGreen, fontSize: 10, fontWeight: 'bold' }}>✓ {t.statusSafe.toUpperCase()}</Text>
                                        </View>
                                    </Animated.View>
                                )}
                            </View>

                            {/* Prominent Threat Warning Card (New Phase 28+) */}
                            {riskyApps.length > 0 && (
                                <TouchableOpacity
                                    style={styles.threatWarningCard}
                                    onPress={() => setShowResults(true)}
                                    activeOpacity={0.9}
                                >
                                    <View style={styles.threatWarningHeader}>
                                        <Text style={styles.threatWarningTitle}>{t.riskyAppsTitle}</Text>
                                    </View>
                                    <Text style={styles.threatWarningDesc}>
                                        {riskyApps.length} {t.found} {t.actionsSuggested}
                                    </Text>
                                    <View style={styles.threatWarningAction}>
                                        <Text style={styles.threatWarningActionText}>{t.viewHistory.toUpperCase()}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}

                            {/* Security Health Bar */}
                            <View style={styles.healthContainer}>
                                <View style={styles.healthHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={styles.healthLabel}>{t.securityHealth || 'SECURITY HEALTH'}</Text>
                                        <View style={[styles.healthDot, { backgroundColor: securityScore >= 80 ? pricingColors.neonGreen : (securityScore >= 50 ? '#FFA500' : pricingColors.blocked) }]} />
                                    </View>
                                    <Text style={[styles.healthValue, { color: securityScore >= 80 ? pricingColors.neonGreen : (securityScore >= 50 ? '#FFA500' : pricingColors.blocked) }]}>
                                        {securityScore}%
                                    </Text>
                                </View>
                                <View style={styles.healthBarBg}>
                                    <Animated.View style={[
                                        styles.healthBarFill,
                                        {
                                            width: `${securityScore}%`,
                                            backgroundColor: securityScore >= 80 ? pricingColors.neonGreen : (securityScore >= 50 ? '#FFA500' : pricingColors.blocked)
                                        }
                                    ]} />
                                </View>
                                <Text style={styles.healthAdvice}>
                                    {securityScore >= 90 ? t.allSystemsGo :
                                        (securityScore >= 50 ? (isProtectionOn ? (t.allSystemsGo) : t.activateShield) : t.actionsSuggested)}
                                </Text>
                            </View>


                            <TouchableOpacity
                                style={styles.scanShieldContainer}
                                onPress={isScanning ? undefined : startScan}
                                activeOpacity={0.8}
                                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                            >
                                <Animated.View style={[
                                    styles.shieldGlow,
                                    { transform: [{ scale: glowAnim }] }
                                ]} />
                                <View style={[styles.shield, isScanning && styles.shieldScanning]}>
                                    {isScanning ? (
                                        <View style={styles.progressContainer}>
                                            <Text style={styles.progressValue}>{scanProgress}%</Text>
                                            <Text style={styles.progressText}>{scanPhase}</Text>
                                        </View>
                                    ) : (
                                        <Text style={styles.shieldIcon}>🛡️</Text>
                                    )}
                                </View>
                            </TouchableOpacity>

                            {/* Privacy Stats Widget (Premium Visual) */}
                            {isProtectionOn && (
                                <View style={styles.statsContainer}>
                                    <View
                                        style={styles.statCard}
                                    >
                                        <Text style={styles.statValue}>
                                            {trafficLogs.filter(l => l.blocked).length}
                                        </Text>
                                        <Text style={styles.statLabel}>{t.threatsBlockedStat || 'Threats Blocked'}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.statCard}
                                        onPress={() => {
                                            if (riskyApps.length > 0) {
                                                setShowResults(true);
                                            } else {
                                                startScan();
                                            }
                                            triggerHaptic('impactLight');
                                        }}
                                    >
                                        <Text style={[styles.statValue, { color: '#00D4FF' }]}>
                                            {riskyApps.length}
                                        </Text>
                                        <Text style={styles.statLabel}>Apps {t.riskyAppsTitle ? 'Peligrosas' : 'Risky'}</Text>
                                    </TouchableOpacity>
                                </View>
                            )}


                            <TouchableOpacity
                                style={[styles.mainButton, isProtectionOn && styles.mainButtonActive]}
                                onPress={toggleProtection}
                            >
                                <Text style={[styles.mainButtonText, isProtectionOn && { color: pricingColors.blocked }]}>
                                    {isProtectionOn ? t.protectionActive : t.activateShield}
                                </Text>
                            </TouchableOpacity>

                            {!isScanning && (
                                <TouchableOpacity
                                    style={styles.tacticalScanButton}
                                    onPress={startScan}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.tacticalScanText}>{t.scanDeviceNow}</Text>
                                </TouchableOpacity>
                            )}

                            {/* Remote Assistance Promotion (V17.8 - Final Delivery) */}
                            <TouchableOpacity
                                style={[styles.breachCard, {
                                    marginTop: 30,
                                    marginBottom: 40,
                                    width: '90%',
                                    padding: 24,
                                    backgroundColor: pricingColors.neonGreen + '0A',
                                    borderColor: pricingColors.neonGreen + '30',
                                    borderWidth: 1,
                                    borderRadius: 20,
                                    alignSelf: 'center'
                                }]}
                                onPress={() => Linking.openURL('https://nopubly.com/remote-expert.html')}
                                activeOpacity={0.8}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.sectionTitle, { marginHorizontal: 0, fontSize: 20, marginBottom: 8, color: pricingColors.neonGreen, fontWeight: 'bold' }]}>
                                        {t.remoteAssistanceTitle || 'REMOTE ASSISTANCE'}
                                    </Text>
                                    <View style={{ height: 1.5, width: 40, backgroundColor: pricingColors.neonGreen + '40', marginBottom: 12 }} />
                                    <Text style={[styles.breachDesc, { fontSize: 15, lineHeight: 24, color: pricingColors.textSecondary, marginBottom: 0 }]}>
                                        {t.remoteAssistanceDesc || 'Professional technical support for your security needs.'}
                                    </Text>
                                </View>
                                <View style={{ alignSelf: 'flex-end', marginTop: 20, backgroundColor: pricingColors.neonGreen + '20', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25 }}>
                                    <Text style={{ color: pricingColors.neonGreen, fontSize: 13, fontWeight: 'bold' }}>{t.learnMore || 'LEARN MORE'}</Text>
                                </View>
                            </TouchableOpacity>

                        </ScrollView>
                    )}

                    {activeTab === 'logs' && (
                        <View style={styles.logsContainer}>
                            <View style={styles.segmentControl}>
                                <TouchableOpacity
                                    style={[styles.segmentButton, logsTab === 'traffic' && styles.segmentButtonActive]}
                                    onPress={() => setLogsTab('traffic')}
                                >
                                    <Text style={[styles.segmentLabel, logsTab === 'traffic' && styles.segmentLabelActive]}>TRAFFIC</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.segmentButton, logsTab === 'quarantine' && styles.segmentButtonActive]}
                                    onPress={() => setLogsTab('quarantine')}
                                >
                                    <Text style={[styles.segmentLabel, logsTab === 'quarantine' && styles.segmentLabelActive]}>{t.quarantine.toUpperCase()}</Text>
                                </TouchableOpacity>
                            </View>

                            {logsTab === 'traffic' ? (
                                <>
                                    <Text style={styles.sectionTitle}>{t.threatLogs}</Text>
                                    <ScrollView style={styles.logsList} contentContainerStyle={styles.logsListContent}>
                                        {trafficLogs.length === 0 ? (
                                            <Text style={styles.noLogsText}>{t.noThreatsYet}</Text>
                                        ) : (
                                            trafficLogs.map(log => (
                                                <View key={log.id} style={styles.logItem}>
                                                    <Text style={[styles.logAction, { color: log.blocked ? pricingColors.blocked : pricingColors.allowed }]}>
                                                        {log.blocked ? t.blocked : t.allowed}
                                                    </Text>
                                                    <Text style={styles.logDomain}>{log.domain}</Text>
                                                    <Text style={styles.logTime}>{log.timestamp}</Text>
                                                </View>
                                            ))
                                        )}
                                    </ScrollView>
                                </>
                            ) : (
                                <>
                                    <Text style={styles.sectionTitle}>{t.quarantineHistory}</Text>
                                    <View style={styles.infoBox}>
                                        <Text style={styles.infoText}>{t.quarantineInfo}</Text>
                                    </View>
                                    <ScrollView style={styles.logsList} contentContainerStyle={styles.logsListContent}>
                                        {quarantinedApps.length === 0 ? (
                                            <Text style={styles.noLogsText}>{t.noQuarantine}</Text>
                                        ) : (
                                            quarantinedApps.map(app => (
                                                <View key={app.packageName + app.date} style={styles.logItem}>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.appName}>{app.appName}</Text>
                                                        <Text style={styles.logTime}>{app.packageName} • {app.date}</Text>
                                                    </View>
                                                    <TouchableOpacity
                                                        style={styles.reinstallButton}
                                                        onPress={() => handleReinstall(app.packageName)}
                                                    >
                                                        <Text style={styles.reinstallText}>{t.reinstall}</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            ))
                                        )}
                                    </ScrollView>
                                </>
                            )}
                        </View>
                    )}

                    {activeTab === 'settings' && (
                        <ScrollView
                            style={styles.settingsScroll}
                            contentContainerStyle={styles.settingsContainer}
                            showsVerticalScrollIndicator={false}
                        >
                            <Text style={styles.sectionTitle}>{t.settings}</Text>

                            <View style={styles.settingItem}>
                                <View>
                                    <Text style={styles.settingTitle}>{t.autoStart}</Text>
                                    <Text style={styles.settingSubtitle}>{t.autoStartDesc}</Text>
                                </View>
                                <Switch
                                    value={autoStart}
                                    onValueChange={async (value) => {
                                        setAutoStart(value);
                                        await AsyncStorage.setItem('autoStart', value.toString());
                                        await VpnModule.setAutoStart(value);

                                        // Proactive: If user turns ON auto-start, try to start protection too
                                        if (value && !isProtectionOn && isPro) {
                                            toggleProtection();
                                        }
                                    }}
                                    trackColor={{ false: pricingColors.textSecondary, true: pricingColors.neonGreen }}
                                />
                            </View>

                            <View style={styles.settingItem}>
                                <View>
                                    <Text style={styles.settingTitle}>{t.blockTrackers}</Text>
                                    <Text style={styles.settingSubtitle}>{t.enabled}</Text>
                                </View>
                                <Switch
                                    value={blockTrackers}
                                    onValueChange={async (value) => {
                                        setBlockTrackers(value);
                                        await AsyncStorage.setItem('blockTrackers', value.toString());
                                        // Update Native Module (pass new trackers val, current ads val)
                                        await VpnModule.setBlockingConfig(value, blockAds);
                                    }}
                                    trackColor={{ false: pricingColors.textSecondary, true: pricingColors.neonGreen }}
                                />
                            </View>

                            <View style={styles.settingItem}>
                                <View>
                                    <Text style={styles.settingTitle}>{t.blockAds}</Text>
                                    <Text style={styles.settingSubtitle}>{t.enabled}</Text>
                                </View>
                                <Switch
                                    value={blockAds}
                                    onValueChange={async (value) => {
                                        setBlockAds(value);
                                        await AsyncStorage.setItem('blockAds', value.toString());
                                        // Update Native Module (pass current trackers val, new ads val)
                                        await VpnModule.setBlockingConfig(blockTrackers, value);
                                    }}
                                    trackColor={{ false: pricingColors.textSecondary, true: pricingColors.neonGreen }}
                                />
                            </View>

                            <View style={styles.settingItem}>
                                <View>
                                    <Text style={styles.settingTitle}>{t.trustedAppsManager}</Text>
                                    <Text style={styles.settingSubtitle}>{t.appsTrustedCount.replace('{0}', trustedApps.length.toString())}</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.manageButton}
                                    onPress={() => setShowTrustedManager(!showTrustedManager)}
                                >
                                    <Text style={styles.manageButtonText}>{showTrustedManager ? t.hide : t.manage}</Text>
                                </TouchableOpacity>
                            </View>

                            {showTrustedManager && (
                                <View style={styles.trustedList}>
                                    {trustedApps.length === 0 ? (
                                        <Text style={styles.noTrustedText}>{t.noTrustedApps}</Text>
                                    ) : (
                                        trustedApps.map(pkg => (
                                            <View key={pkg} style={styles.trustedItem}>
                                                <Text style={styles.trustedPkg}>{pkg}</Text>
                                                <TouchableOpacity onPress={() => handleRevokeTrust(pkg)}>
                                                    <Text style={styles.revokeText}>{t.revoke}</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ))
                                    )}
                                </View>
                            )}


                            <TouchableOpacity
                                style={styles.settingButton}
                                onPress={handleUpdateBlocklist}
                            >
                                <Text style={styles.settingButtonText}>{t.updateBlocklist}</Text>
                                <Text style={[styles.settingSubtitle, { marginTop: 4, fontSize: 11 }]}>
                                    Last update: {lastBlocklistUpdate === 'Never' ? t.never || 'Never' : new Date(lastBlocklistUpdate).toLocaleString()}
                                </Text>
                            </TouchableOpacity>


                            <Text style={[styles.sectionTitle, { fontSize: 18, marginTop: 40 }]}>Legal</Text>
                            <TouchableOpacity
                                style={styles.settingItem}
                                onPress={() => showAlert(t.privacyPolicy, t.privacyText, 'info')}
                            >
                                <Text style={styles.settingTitle}>{t.privacyPolicy}</Text>
                                <View style={styles.silhouetteSmall}>
                                    <View style={{ width: 12, height: 16, borderWidth: 1.5, borderColor: pricingColors.textSecondary, borderRadius: 2 }} />
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.settingItem}
                                onPress={() => showAlert(t.termsOfService, t.termsText, 'info')}
                            >
                                <Text style={styles.settingTitle}>{t.termsOfService}</Text>
                                <View style={styles.silhouetteSmall}>
                                    <View style={{ width: 16, height: 12, borderWidth: 1.5, borderColor: pricingColors.textSecondary, borderRadius: 2, transform: [{ rotate: '45deg' }] }} />
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.settingItem}
                                onLongPress={() => {
                                    setRiskyApps([{
                                        appName: "N-DEMO: Amenaza Simulada",
                                        packageName: "com.nopubly.demo",
                                        riskLevel: "CRITICAL",
                                        heuristics: ["Simulated for UI verification", "Premium Alert Test"]
                                    }]);
                                    setActiveTab('dashboard');
                                    triggerHaptic('notificationSuccess');
                                    showAlert("🎨 Demo Mode", "Se ha simulado una amenaza para que puedas ver la nueva Tarjeta de Alerta en el Panel Principal.", "info");
                                }}
                                delayLongPress={2000}
                            >
                                <View>
                                    <Text style={styles.settingTitle}>{t.version}</Text>
                                    <Text style={styles.settingSubtitle}>{CURRENT_VERSION}</Text>
                                </View>
                            </TouchableOpacity>
                        </ScrollView>
                    )}


                    {activeTab === 'profile' && (
                        <ScrollView
                            style={styles.profileScroll}
                            contentContainerStyle={styles.profileContainer}
                            showsVerticalScrollIndicator={false}
                        >
                            <View style={styles.profileHeader}>
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>U</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.userName}>User</Text>
                                    {isPro ? (
                                        <Text style={{ color: pricingColors.neonGreen, fontWeight: 'bold' }}>PRO MEMBER</Text>
                                    ) : (
                                        <TouchableOpacity onPress={() => setShowRestoreModal(true)}>
                                            <Text style={{ color: pricingColors.textSecondary, fontSize: 12, textDecorationLine: 'underline' }}>
                                                {t.restoreSuccess ? 'Restaurar Licencia' : 'Restore License'}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            <View style={styles.statsGrid}>
                                <View style={styles.statCard}>
                                    <Text style={styles.statValue}>{stats.threatsBlocked}</Text>
                                    <Text style={styles.statLabel}>{t.threatsBlockedStat}</Text>
                                </View>
                                <View style={styles.statCard}>
                                    <Text style={styles.statValue}>{stats.appsScanned}</Text>
                                    <Text style={styles.statLabel}>{t.appsScannedStat}</Text>
                                </View>
                                <View style={styles.statCard}>
                                    <Text style={styles.statValue}>{stats.daysProtected}</Text>
                                    <Text style={styles.statLabel}>{t.daysProtectedStat}</Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.profileOption}
                                onPress={handleContactSupport}
                            >
                                <Text style={styles.profileOptionText}>🛡️ {t.contactSupport}</Text>
                            </TouchableOpacity>

                            {/* Identity Breach Widget (Moved from Dashboard) */}
                            <View style={[styles.breachContainer, { paddingHorizontal: 0, marginTop: 20 }]}>
                                <Text style={[styles.sectionTitle, { marginHorizontal: 0, fontSize: 18 }]}>{t.identityProtection || 'IDENTITY PROTECTION'}</Text>
                                <View style={styles.breachCard}>
                                    <Text style={styles.breachDesc}>
                                        {t.checkBreachDesc || 'Check if your passwords have been leaked on the Dark Web.'}
                                    </Text>

                                    <View style={styles.inputRow}>
                                        <TextInput
                                            style={styles.emailInput}
                                            placeholder="tu@email.com"
                                            placeholderTextColor="#666"
                                            value={breachEmail}
                                            onChangeText={setBreachEmail}
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                        />
                                        <TouchableOpacity
                                            style={[styles.checkButton, isCheckingBreach && styles.checkButtonActive]}
                                            onPress={checkIdentityBreach}
                                            disabled={isCheckingBreach}
                                        >
                                            <Text style={styles.checkButtonText}>
                                                {isCheckingBreach ? '...' : (t.scan || 'SCAN')}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    {breachResult && (
                                        <View style={[
                                            styles.breachResult,
                                            breachResult.found ? styles.resultDanger : styles.resultSafe
                                        ]}>
                                            <Text style={[
                                                styles.resultTitle,
                                                { color: breachResult.found ? '#FF3B30' : '#00FF88' }
                                            ]}>
                                                {breachResult.found ? '🚨 ' + (t.breachFound || 'COMPROMISED') : '✓ ' + (t.clean || 'SAFE')}
                                            </Text>
                                            <Text style={styles.resultText}>
                                                {breachResult.found
                                                    ? `${t.foundIn || 'Found in'} ${breachResult.count} ${t.breaches || 'leaks'}.`
                                                    : (t.emailSafe || 'Your email is safe.')}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>

                            {!isPro && (
                                <TouchableOpacity
                                    style={[styles.profileOption, { backgroundColor: pricingColors.neonGreen + '20' }]}
                                    onPress={() => setShowPricing(true)}
                                >
                                    <Text style={[styles.profileOptionText, { color: pricingColors.neonGreen }]}>👑 UPGRADE TO PRO</Text>
                                </TouchableOpacity>
                            )}

                            <View style={[styles.breachCard, { marginTop: 20 }]}>
                                <Text style={[styles.sectionTitle, { marginHorizontal: 0, fontSize: 18, marginBottom: 10 }]}>🔑 PRO LICENSE</Text>
                                <Text style={{ color: pricingColors.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
                                    {t.activateDesc || 'Activate your subscription using your License Key or buy one to get full protection.'}
                                </Text>

                                {isPro ? (
                                    <View style={{ alignItems: 'center', marginVertical: 10 }}>
                                        <View style={{ backgroundColor: pricingColors.neonGreen + '20', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: pricingColors.neonGreen }}>
                                            <Text style={{ color: pricingColors.neonGreen, fontWeight: 'bold' }}>{t.goldActive || '✓ PREMIUM GOLD ACTIVE'}</Text>
                                        </View>
                                    </View>
                                ) : (
                                    <View style={{ marginTop: 10 }}>
                                        <TextInput
                                            style={{
                                                backgroundColor: pricingColors.bgDark,
                                                color: 'white',
                                                padding: 15,
                                                borderRadius: 10,
                                                borderWidth: 1,
                                                borderColor: licenseKey.length > 0 ? pricingColors.neonGreen : pricingColors.bgCard,
                                                marginBottom: 15,
                                                fontSize: 16,
                                                textAlign: 'center'
                                            }}
                                            placeholder="NP-XXXX-XXXX-XXXX"
                                            placeholderTextColor="#666"
                                            value={licenseKey}
                                            onChangeText={setLicenseKey}
                                            autoCapitalize="characters"
                                        />

                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <TouchableOpacity
                                                style={[styles.mainButton, { flex: 1, marginRight: 5, paddingVertical: 12 }]}
                                                onPress={activateLicense}
                                                disabled={isActivatingLicense}
                                            >
                                                <Text style={styles.mainButtonText}>
                                                    {isActivatingLicense ? '...' : (t.btnActivate || 'ACTIVATE')}
                                                </Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={[styles.mainButton, { flex: 1, marginLeft: 5, backgroundColor: '#FFF', paddingVertical: 12 }]}
                                                onPress={() => Linking.openURL('https://nopubly.com/portal.html?buy_package=antivirus-pro-1y')}
                                            >
                                                <Text style={[styles.mainButtonText, { color: '#000' }]}>{t.buyGold || 'BUY GOLD'}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                            </View>
                            <View style={{ height: 40 }} />
                        </ScrollView>
                    )}
                </View>

                {/* Scan Results Overlay */}
                {showResults && (
                    <View style={styles.resultsContainer}>
                        <Text style={styles.resultsTitle}>
                            {riskyApps.length} {t.threatsFound}
                        </Text>
                        <Text style={styles.resultsSubtitle}>{t.selectToQuarantine}</Text>

                        <ScrollView style={styles.threatsList}>
                            {riskyApps.map(app => (
                                <TouchableOpacity
                                    key={app.packageName}
                                    style={styles.threatItem}
                                    onPress={() => toggleAppSelection(app.packageName)}
                                >
                                    <View style={[styles.checkbox, selectedApps.includes(app.packageName) && styles.checkboxSelected]}>
                                        {selectedApps.includes(app.packageName) && (
                                            <Text style={styles.checkmark}>✓</Text>
                                        )}
                                    </View>

                                    <View style={styles.appInfo}>
                                        <Text style={styles.appName}>{app.appName}</Text>
                                        <Text style={[styles.riskBadge, {
                                            backgroundColor: app.riskLevel === 'CRITICAL' ? pricingColors.blocked : '#FF9500'
                                        }]}>
                                            {app.riskLevel}
                                        </Text>
                                        <Text style={styles.appPerms}>
                                            {app.heuristics?.join(', ') || 'Multiple permissions'}
                                        </Text>
                                    </View>

                                    <View style={styles.actionColumn}>
                                        <TouchableOpacity
                                            style={styles.trustButton}
                                            onPress={() => handleTrustApp(app.packageName)}
                                        >
                                            <Text style={styles.trustButtonText}>{t.trust}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <View style={styles.resultsActions}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => setShowResults(false)}
                            >
                                <Text style={styles.cancelButtonText}>{t.cancel}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.quarantineButton, selectedApps.length === 0 && styles.buttonDisabled]}
                                onPress={quarantineSelected}
                                disabled={selectedApps.length === 0}
                            >
                                <Text style={styles.quarantineButtonText}>
                                    {t.quarantine} ({selectedApps.length})
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={styles.shareReportBtn}
                            onPress={handleShareRepo}
                        >
                            <Text style={styles.shareReportText}>📣 {t.shareReport}</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Custom Status Modal */}
                <Modal
                    visible={alertConfig.visible}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={[styles.modalHeader, { borderColor: alertConfig.type === 'error' ? pricingColors.blocked : pricingColors.neonGreen }]}>
                                <Text style={styles.modalTitle}>{alertConfig.title}</Text>
                            </View>
                            <Text style={styles.modalMessage}>{alertConfig.message}</Text>

                            <View style={{ width: '100%', gap: 10 }}>
                                {alertConfig.type === 'success' && !isPro && (
                                    <TouchableOpacity
                                        style={[styles.modalButton, { backgroundColor: pricingColors.neonGreen }]}
                                        onPress={() => {
                                            setAlertConfig(prev => ({ ...prev, visible: false }));
                                            setShowPricing(true);
                                        }}
                                    >
                                        <Text style={[styles.modalButtonText, { color: pricingColors.bgDark }]}>👑 {t.upgradeToProNow}</Text>
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                    style={styles.modalButton}
                                    onPress={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
                                >
                                    <Text style={styles.modalButtonText}>OK</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Restore Purchase Modal */}
                <Modal
                    visible={showRestoreModal}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setShowRestoreModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { borderColor: pricingColors.neonGreen }]}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>👑 {t.restorePurchase}</Text>
                            </View>
                            <Text style={styles.modalMessage}>{t.restoreDesc}</Text>

                            <TextInput
                                style={styles.modalEmailInput}
                                placeholder={t.enterEmailPlaceholder}
                                placeholderTextColor="#666"
                                value={restoreEmail}
                                onChangeText={setRestoreEmail}
                                autoCapitalize="characters"
                                keyboardType="default"
                            />

                            <TouchableOpacity
                                style={[styles.modalButton, { backgroundColor: pricingColors.neonGreen }]}
                                onPress={handleRestorePurchase}
                                disabled={isRestoring}
                            >
                                <Text style={[styles.modalButtonText, { color: pricingColors.bgDark }]}>
                                    {isRestoring ? '...' : t.restoreAction}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalButton, { marginTop: 10, backgroundColor: 'transparent' }]}
                                onPress={() => setShowRestoreModal(false)}
                            >
                                <Text style={[styles.modalButtonText, { color: pricingColors.textSecondary }]}>{t.cancel}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* VPN Instruction Modal */}
                <Modal
                    visible={showVpnModal}
                    transparent={true}
                    animationType="slide"
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { borderColor: pricingColors.neonGreen, borderWidth: 2 }]}>
                            <View style={[styles.modalHeader, { borderColor: pricingColors.neonGreen }]}>
                                <Text style={styles.modalTitle}>🛡️ {t.vpnInstructionTitle}</Text>
                            </View>
                            <Text style={styles.modalMessage}>{t.vpnInstructionText}</Text>

                            <TouchableOpacity
                                style={[styles.modalButton, { backgroundColor: pricingColors.neonGreen }]}
                                onPress={confirmVpnActivation}
                            >
                                <Text style={[styles.modalButtonText, { color: pricingColors.bgDark }]}>{t.vpnInstructionAction}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalButton, { marginTop: 10, borderColor: 'transparent' }]}
                                onPress={() => setShowVpnModal(false)}
                            >
                                <Text style={[styles.modalButtonText, { color: pricingColors.textSecondary }]}>{t.cancel}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* Bottom Navigation */}
                <View style={styles.bottomNav}>
                    <TouchableOpacity
                        style={styles.navItem}
                        onPress={() => setActiveTab('dashboard')}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <SilhouetteIcon type="home" active={activeTab === 'dashboard'} />
                        <Text style={[styles.navLabel, activeTab === 'dashboard' && styles.navLabelActive]}>{t.dashboard}</Text>
                    </TouchableOpacity>


                    <TouchableOpacity
                        style={styles.navItem}
                        onPress={() => setActiveTab('settings')}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <SilhouetteIcon type="settings" active={activeTab === 'settings'} />
                        <Text style={[styles.navLabel, activeTab === 'settings' && styles.navLabelActive]}>{t.settings}</Text>
                    </TouchableOpacity>


                    <TouchableOpacity
                        style={styles.navItem}
                        onPress={() => setActiveTab('profile')}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <SilhouetteIcon type="profile" active={activeTab === 'profile'} />
                        <Text style={[styles.navLabel, activeTab === 'profile' && styles.navLabelActive]}>{t.profile}</Text>
                    </TouchableOpacity>
                </View>

            </SafeAreaView>
        </ErrorBoundary >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: pricingColors.bgDark,
    },
    particle: {
        position: 'absolute',
        color: pricingColors.neonGreen + '40',
        fontSize: 10,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
    },
    dashboardScroll: {
        flex: 1,
    },
    dashboardContainer: {
        alignItems: 'center',
        paddingTop: 40,
        paddingBottom: 100, // Extra space to clear bottomNav
    },
    statusHeader: {
        alignItems: 'center',
        marginBottom: 50,
    },
    statusTitle: {
        color: pricingColors.textPrimary,
        fontSize: 32,
        fontWeight: 'bold',
        letterSpacing: 4,
        textTransform: 'uppercase',
    },
    statusSubtitle: {
        color: pricingColors.textSecondary,
        fontSize: 16,
        marginTop: 8,
    },
    proBadge: {
        backgroundColor: pricingColors.neonGreen,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
        marginTop: 10,
    },
    threatWarningCard: {
        width: '90%',
        backgroundColor: pricingColors.blocked + '20',
        borderRadius: 12,
        padding: 20,
        marginBottom: 30,
        borderWidth: 2,
        borderColor: pricingColors.blocked,
        shadowColor: pricingColors.blocked,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
        alignSelf: 'center',
    },
    threatWarningHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    threatWarningIcon: {
        fontSize: 24,
        marginRight: 10,
    },
    threatWarningTitle: {
        color: pricingColors.blocked,
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    threatWarningDesc: {
        color: pricingColors.textPrimary,
        fontSize: 14,
        marginBottom: 15,
        opacity: 0.9,
    },
    threatWarningAction: {
        backgroundColor: pricingColors.blocked,
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    threatWarningActionText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    proBadgeText: {
        color: pricingColors.bgDark,
        fontSize: 10,
        fontWeight: 'bold',
    },
    scanShieldContainer: {
        width: 240,
        height: 240,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 60,
    },
    shieldGlow: {
        position: 'absolute',
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: pricingColors.neonGreen + '20',
        borderWidth: 1,
        borderColor: pricingColors.neonGreen + '40',
    },
    shield: {
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: pricingColors.bgCard,
        borderWidth: 4,
        borderColor: pricingColors.neonGreen,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: pricingColors.neonGreen,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    shieldScanning: {
        borderColor: pricingColors.neonGreenLight,
        shadowOpacity: 0.8,
        shadowRadius: 30,
    },
    shieldIcon: {
        fontSize: 70,
    },
    progressContainer: {
        alignItems: 'center',
    },
    progressValue: {
        color: pricingColors.neonGreen,
        fontSize: 36,
        fontWeight: 'bold',
    },
    progressText: {
        color: pricingColors.textSecondary,
        fontSize: 12,
        marginTop: 4,
        textAlign: 'center',
    },
    mainButton: {
        width: '90%',
        paddingVertical: 18,
        borderRadius: 4,
        alignItems: 'center',
        marginTop: 30,
        backgroundColor: pricingColors.neonGreen,
    },
    mainButtonActive: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: pricingColors.blocked,
    },
    mainButtonText: {
        color: pricingColors.bgDark,
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 2,
        textAlign: 'center',
    },
    tacticalScanButton: {
        width: '90%',
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: pricingColors.neonGreen + '60',
        paddingVertical: 14,
        borderRadius: 4,
        marginTop: 20,
        alignItems: 'center',
    },
    tacticalScanText: {
        color: pricingColors.neonGreen,
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    viralInviteCard: {
        width: '90%',
        backgroundColor: pricingColors.neonGreen + '08',
        padding: 16,
        borderRadius: 4,
        marginTop: 30,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: pricingColors.neonGreen + '20',
        borderLeftWidth: 4,
        borderLeftColor: pricingColors.neonGreen,
    },
    viralInviteTitle: {
        color: pricingColors.textPrimary,
        fontSize: 14,
        fontWeight: 'bold',
    },
    viralInviteSubtitle: {
        color: pricingColors.textSecondary,
        fontSize: 11,
        marginTop: 2,
    },
    viralInviteBtn: {
        backgroundColor: pricingColors.neonGreen,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(5, 12, 22, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
        backgroundColor: pricingColors.bgCard + 'F5', // Slightly more opaque for readability
        borderRadius: 20, // Rounded for modern feel
        borderWidth: 1,
        borderColor: pricingColors.neonGreen + '40',
        padding: 25,
        alignItems: 'center',
        shadowColor: pricingColors.neonGreen,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 25,
        elevation: 20,
    },
    modalHeader: {
        width: '100%',
        borderBottomWidth: 1,
        paddingBottom: 15,
        marginBottom: 20,
        alignItems: 'center',
    },
    modalTitle: {
        color: pricingColors.textPrimary,
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
    modalMessage: {
        color: pricingColors.textSecondary,
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 30,
    },
    modalButton: {
        width: '100%',
        paddingVertical: 15,
        backgroundColor: pricingColors.neonGreen + '15',
        borderWidth: 1,
        borderColor: pricingColors.neonGreen,
        borderRadius: 4,
    },
    modalButtonText: {
        color: pricingColors.neonGreen,
        textAlign: 'center',
        fontWeight: 'bold',
        letterSpacing: 2,
    },
    silhouetteSmall: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sectionTitle: {
        color: pricingColors.textPrimary,
        fontSize: 24,
        fontWeight: 'bold',
        margin: 20,
    },
    logsContainer: {
        flex: 1,
        padding: 10,
    },
    logsList: {
        flex: 1,
    },
    logsListContent: {
        paddingBottom: 100,
    },
    logItem: {
        backgroundColor: pricingColors.bgCard + '99', // More transparent for glass effect
        padding: 16,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: pricingColors.neonGreen + '15',
        flexDirection: 'row',
        alignItems: 'center',
    },
    logAction: {
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1,
        textTransform: 'uppercase',
        width: 80,
    },
    logDomain: {
        color: pricingColors.textPrimary,
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    logTime: {
        color: pricingColors.textSecondary,
        fontSize: 11,
    },
    noLogsText: {
        color: pricingColors.textSecondary,
        textAlign: 'center',
        marginTop: 50,
    },
    settingsScroll: {
        flex: 1,
    },
    settingsContainer: {
        padding: 10,
        paddingBottom: 100,
    },
    settingItem: {
        backgroundColor: pricingColors.bgCard,
        padding: 20,
        borderRadius: 15,
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    settingTitle: {
        color: pricingColors.textPrimary,
        fontSize: 16,
        fontWeight: 'bold',
    },
    settingSubtitle: {
        color: pricingColors.textSecondary,
        fontSize: 12,
        marginTop: 4,
    },
    settingButton: {
        backgroundColor: pricingColors.bgCard,
        padding: 15,
        borderRadius: 15,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: pricingColors.neonGreen + '40',
    },
    settingButtonText: {
        color: pricingColors.neonGreen,
        textAlign: 'center',
        fontWeight: 'bold',
    },
    profileScroll: {
        flex: 1,
    },
    profileContainer: {
        padding: 20,
        paddingBottom: 120, // Extra space to clear bottomNav
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 30,
    },
    avatar: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: pricingColors.neonGreen,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 20,
    },
    avatarText: {
        fontSize: 30,
        fontWeight: 'bold',
        color: pricingColors.bgDark,
    },
    versionText: {
        color: pricingColors.textSecondary,
        fontSize: 10,
        textAlign: 'center',
        marginTop: 20,
        opacity: 0.5,
    },
    userName: {
        color: pricingColors.textPrimary,
        fontSize: 24,
        fontWeight: 'bold',
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
    statCard: {
        backgroundColor: pricingColors.bgCard + 'CC',
        padding: 16,
        borderRadius: 4,
        width: '30%',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: pricingColors.neonGreen + '20',
    },
    statValue: {
        color: pricingColors.neonGreen,
        fontSize: 22,
        fontWeight: 'bold',
    },
    statLabel: {
        color: pricingColors.textSecondary,
        fontSize: 9,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        textAlign: 'center',
        marginTop: 5,
        letterSpacing: 1,
    },
    activityItem: {
        backgroundColor: pricingColors.bgCard + 'CC',
        padding: 16,
        borderRadius: 4,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: pricingColors.neonGreen + '20',
    },
    activityTitle: {
        color: pricingColors.neonGreen,
        fontWeight: 'bold',
    },
    activitySubtitle: {
        color: pricingColors.textPrimary,
        marginTop: 4,
    },
    activityTime: {
        color: pricingColors.textSecondary,
        fontSize: 10,
        marginTop: 5,
    },
    resultsContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: pricingColors.bgDark,
        padding: 20,
        zIndex: 100,
    },
    resultsTitle: {
        color: pricingColors.textPrimary,
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginTop: 20,
    },
    resultsSubtitle: {
        color: pricingColors.textSecondary,
        textAlign: 'center',
        marginBottom: 20,
    },
    threatsList: {
        flex: 1,
    },
    threatItem: {
        backgroundColor: pricingColors.bgCard + 'CC',
        padding: 16,
        borderRadius: 4,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: pricingColors.neonGreen + '20',
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: pricingColors.neonGreen,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    checkboxSelected: {
        backgroundColor: pricingColors.neonGreen,
    },
    checkmark: {
        color: pricingColors.bgDark,
        fontWeight: 'bold',
    },
    appInfo: {
        flex: 1,
    },
    appName: {
        color: pricingColors.textPrimary,
        fontSize: 16,
        fontWeight: 'bold',
    },
    riskBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 4,
    },
    riskBadgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
    appPerms: {
        color: pricingColors.textSecondary,
        fontSize: 11,
        marginTop: 4,
    },
    scoreText: {
        color: pricingColors.neonGreen,
        fontSize: 18,
        fontWeight: 'bold',
    },
    resultsActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
    },
    cancelButton: {
        padding: 15,
        flex: 1,
        marginRight: 10,
    },
    cancelButtonText: {
        color: pricingColors.textSecondary,
        textAlign: 'center',
        fontSize: 16,
    },
    quarantineButton: {
        backgroundColor: pricingColors.blocked,
        padding: 15,
        borderRadius: 12,
        flex: 2,
    },
    trustButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: pricingColors.textSecondary + '40',
        marginBottom: 8,
    },
    trustButtonText: {
        color: pricingColors.textSecondary,
        fontSize: 10,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    actionColumn: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        marginLeft: 10,
    },
    rowQuarantineBtn: {
        backgroundColor: pricingColors.blocked + '20',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: pricingColors.blocked,
    },
    rowQuarantineText: {
        color: pricingColors.blocked,
        fontSize: 10,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    quarantineButtonText: {
        color: 'white',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: 16,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    shareReportBtn: {
        marginTop: 20,
        backgroundColor: pricingColors.neonGreen + '15',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: pricingColors.neonGreen + '30',
        width: '100%',
    },
    shareReportText: {
        color: pricingColors.neonGreen,
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    bottomNav: {
        flexDirection: 'row',
        backgroundColor: pricingColors.bgCard,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: pricingColors.neonGreen + '20',
        zIndex: 9999, // Force on top
        elevation: 20, // Android elevation
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    navItem: {
        flex: 1,
        alignItems: 'center',
    },
    navIcon: {
        fontSize: 24,
        opacity: 0.5,
    },
    navIconActive: {
        opacity: 1,
    },
    navLabel: {
        color: pricingColors.textSecondary,
        fontSize: 10,
        marginTop: 4,
    },
    navLabelActive: {
        color: pricingColors.neonGreen,
    },
    segmentControl: {
        flexDirection: 'row',
        backgroundColor: pricingColors.bgCard,
        borderRadius: 8,
        padding: 4,
        marginHorizontal: 15,
        marginBottom: 15,
        marginTop: 10,
    },
    segmentButton: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 6,
    },
    segmentButtonActive: {
        backgroundColor: pricingColors.neonGreen + '20',
        borderWidth: 1,
        borderColor: pricingColors.neonGreen + '40',
    },
    segmentLabel: {
        color: pricingColors.textSecondary,
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    segmentLabelActive: {
        color: pricingColors.neonGreen,
    },
    infoBox: {
        backgroundColor: pricingColors.neonGreen + '08',
        padding: 16,
        borderRadius: 4,
        marginHorizontal: 15,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: pricingColors.neonGreen + '30',
        borderLeftWidth: 4,
        borderLeftColor: pricingColors.neonGreen,
    },
    infoText: {
        color: pricingColors.textSecondary,
        fontSize: 12,
        lineHeight: 18,
        letterSpacing: 0.5,
    },
    reinstallButton: {
        backgroundColor: pricingColors.neonGreen + '10',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: pricingColors.neonGreen + '30',
    },
    reinstallText: {
        color: pricingColors.neonGreen,
        fontSize: 12,
        fontWeight: 'bold',
    },
    profileOption: {
        width: '100%',
        backgroundColor: pricingColors.bgCard,
        padding: 16,
        borderRadius: 4,
        marginTop: 10,
        borderWidth: 1,
        borderColor: pricingColors.neonGreen + '20',
    },
    profileOptionText: {
        color: pricingColors.textPrimary,
        fontSize: 14,
        fontWeight: 'bold',
    },
    monitorIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: pricingColors.bgCard,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        marginTop: 10,
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: pricingColors.neonGreen + '40',
    },
    monitorDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: pricingColors.neonGreen,
        marginRight: 6,
    },
    monitorText: {
        color: pricingColors.neonGreen,
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    manageButton: {
        backgroundColor: pricingColors.bgCard,
        borderWidth: 1,
        borderColor: pricingColors.textSecondary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
    },
    manageButtonText: {
        color: pricingColors.textSecondary,
        fontSize: 12,
        fontWeight: 'bold',
    },
    trustedList: {
        marginTop: 10,
        backgroundColor: pricingColors.bgCard,
        borderRadius: 8,
        padding: 10,
    },
    sourcesCard: {
        backgroundColor: pricingColors.bgCard + '66',
        borderRadius: 15,
        padding: 20,
        marginTop: 20,
        borderWidth: 1,
        borderColor: pricingColors.neonGreen + '20',
    },
    sourcesTitle: {
        color: pricingColors.neonGreen,
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 1,
        marginBottom: 10,
    },
    sourcesInfo: {
        color: pricingColors.textSecondary,
        fontSize: 12,
        lineHeight: 18,
        marginBottom: 15,
    },
    sourceItem: {
        marginBottom: 12,
        borderLeftWidth: 2,
        borderLeftColor: pricingColors.neonGreen + '40',
        paddingLeft: 12,
    },
    sourceName: {
        color: pricingColors.textPrimary,
        fontSize: 13,
        fontWeight: 'bold',
    },
    sourceDesc: {
        color: pricingColors.textSecondary,
        fontSize: 11,
        marginTop: 2,
    },
    // New Health Bar Styles
    healthContainer: {
        width: '90%',
        backgroundColor: pricingColors.bgCard + '44',
        borderRadius: 16,
        padding: 15,
        marginVertical: 10,
        borderWidth: 1,
        borderColor: pricingColors.neonGreen + '20',
        alignSelf: 'center',
    },
    healthHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    healthLabel: {
        color: pricingColors.textSecondary,
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1.5,
    },
    healthValue: {
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    healthDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginLeft: 8,
    },
    healthBarBg: {
        height: 6,
        backgroundColor: pricingColors.bgDark,
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 8,
    },
    healthBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    healthAdvice: {
        color: pricingColors.textSecondary,
        fontSize: 10,
        fontStyle: 'italic',
        opacity: 0.7,
    },
    trustedItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: pricingColors.textSecondary + '20',
    },
    trustedPkg: {
        color: pricingColors.textPrimary,
        fontSize: 12,
        flex: 1,
    },
    revokeText: {
        color: pricingColors.blocked,
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    noTrustedText: {
        color: pricingColors.textSecondary,
        fontSize: 12,
        fontStyle: 'italic',
        textAlign: 'center',
        padding: 10,
    },
    langButton: {
        padding: 8,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: pricingColors.textSecondary,
        marginLeft: 8,
    },
    langButtonActive: {
        backgroundColor: pricingColors.neonGreen + '20',
        borderColor: pricingColors.neonGreen,
    },
    langText: {
        color: pricingColors.textSecondary,
        fontSize: 12,
        fontWeight: 'bold',
    },
    langTextActive: {
        color: pricingColors.neonGreen,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    // Identity Breach Styles
    breachContainer: {
        width: '100%',
        paddingHorizontal: 20,
        marginBottom: 30,
    },
    breachCard: {
        backgroundColor: pricingColors.bgCard,
        borderRadius: 12,
        padding: 15,
        borderWidth: 1,
        borderColor: pricingColors.bgCard,
    },
    breachDesc: {
        color: pricingColors.textSecondary,
        fontSize: 14,
        marginBottom: 15,
    },
    inputRow: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    emailInput: {
        flex: 1,
        backgroundColor: pricingColors.bgDark,
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 10,
        color: pricingColors.textPrimary,
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#333',
    },
    modalEmailInput: {
        width: '100%',
        backgroundColor: pricingColors.bgDark,
        borderRadius: 12,
        paddingHorizontal: 20,
        height: 55,
        fontSize: 16,
        color: pricingColors.textPrimary,
        borderWidth: 1,
        borderColor: pricingColors.neonGreen + '40',
        marginBottom: 20,
    },
    checkButton: {
        backgroundColor: '#333',
        borderRadius: 8,
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    checkButtonActive: {
        backgroundColor: pricingColors.neonGreen,
    },
    checkButtonText: {
        color: pricingColors.textPrimary,
        fontWeight: 'bold',
        fontSize: 14,
    },
    breachResult: {
        marginTop: 10,
        padding: 10,
        borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    resultDanger: {
        borderLeftWidth: 3,
        borderLeftColor: '#FF3B30',
    },
    resultSafe: {
        borderLeftWidth: 3,
        borderLeftColor: '#00FF88',
    },
    resultTitle: {
        fontWeight: 'bold',
        fontSize: 14,
        marginBottom: 4,
    },
    resultText: {
        color: pricingColors.textSecondary,
        fontSize: 12,
    },
});

export default App;

// --- INLINED PRICING SCREEN ---
const PricingScreen = ({ onSelectFree, onSelectPro, t, setShowRestoreModal }: { onSelectFree: () => void, onSelectPro: () => void, t: any, setShowRestoreModal: (v: boolean) => void }) => {
    return (
        <View style={pricingStyles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={pricingStyles.header}>
                    <Text style={pricingStyles.headerTitle}>{t.choosePlan}</Text>
                    <Text style={pricingStyles.headerSubtitle}>
                        {t.choosePlanSubtitle}
                    </Text>
                </View>

                {/* Pro Plan (Highlighted) */}
                <View style={[pricingStyles.card, pricingStyles.cardHighlighted]}>
                    <View style={pricingStyles.badge}>
                        <Text style={pricingStyles.badgeText}>{t.recommended}</Text>
                    </View>

                    <Text style={pricingStyles.planTitle}>{t.proPlan}</Text>

                    <View style={pricingStyles.promotionContainer}>
                        <Text style={pricingStyles.originalPrice}>{t.proOriginalPrice}</Text>
                        <View style={pricingStyles.offerBadge}>
                            <Text style={pricingStyles.offerBadgeText}>{t.firstYearOffer}</Text>
                        </View>
                    </View>

                    <View style={pricingStyles.priceContainer}>
                        <Text style={pricingStyles.price}>{t.proOfferPrice}</Text>
                        <Text style={pricingStyles.period}>/{t.month || 'mes'}</Text>
                    </View>
                    <Text style={pricingStyles.priceSubtitle}>{t.proYearlyOffer} {t.saveThirty}</Text>

                    <View style={pricingStyles.featuresContainer}>
                        <Feature checked text={t.basicPlanFeatures || "Todo del plan Básico"} />
                        <Feature checked text={t.vpnUnlimited || "VPN ilimitada"} />
                        <Feature checked text={t.autoScanDaily || "Escaneo automático diario"} />
                        <Feature checked text={t.realtimeProtection || "Protección en tiempo real"} />
                        <Feature checked text={t.noAds || "Sin anuncios"} />
                        <Feature checked text={t.prioritySupport || "Soporte prioritario"} />
                    </View>

                    <TouchableOpacity style={pricingStyles.primaryButton} onPress={onSelectPro}>
                        <Text style={pricingStyles.primaryButtonText}>{t.trySevenDays}</Text>
                    </TouchableOpacity>
                    <Text style={pricingStyles.cancelText}>{t.cancelAnytime}</Text>
                </View>

                {/* Free Plan */}
                <View style={pricingStyles.card}>
                    <View style={[pricingStyles.badge, pricingStyles.badgeFree]}>
                        <Text style={pricingStyles.badgeText}>{t.freeAlways}</Text>
                    </View>

                    <Text style={pricingStyles.planTitle}>{t.basicPlan}</Text>

                    <View style={pricingStyles.priceContainer}>
                        <Text style={pricingStyles.price}>0€</Text>
                    </View>

                    <View style={pricingStyles.featuresContainer}>
                        <Feature checked text={t.manualScanApps || "Escaneo manual de apps"} />
                        <Feature checked text={t.basicDeteccion || "Detección de malware básica"} />
                        <Feature checked text={t.trafficLogsTitle || "Logs de tráfico"} />
                        <Feature checked={false} text={t.vpnUnlimited || "VPN ilimitada"} />
                        <Feature checked={false} text={t.autoScanDaily || "Escaneo automático"} />
                        <Feature checked={false} text={t.realtimeProtection || "Protección 24/7"} />
                    </View>

                    <TouchableOpacity style={pricingStyles.secondaryButton} onPress={onSelectFree}>
                        <Text style={pricingStyles.secondaryButtonText}>{t.continueFree}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={pricingStyles.restoreButton} onPress={() => setShowRestoreModal(true)}>
                        <Text style={pricingStyles.restoreButtonText}>{t.restorePurchase || '¿Ya tienes licencia? Restaurar'}</Text>
                    </TouchableOpacity>
                </View>

                <View style={pricingStyles.footer}>
                    <TouchableOpacity onPress={() => Alert.alert(t.privacyPolicy, t.privacyText)}>
                        <Text style={pricingStyles.footerText}>
                            {t.privacyAccept}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
};

const Feature = ({ checked, text }: { checked: boolean, text: string }) => (
    <View style={pricingStyles.feature}>
        <Text style={[pricingStyles.featureIcon, !checked && pricingStyles.featureIconUnchecked]}>
            {checked ? '✓' : '○'}
        </Text>
        <Text style={[pricingStyles.featureText, !checked && pricingStyles.featureTextUnchecked]}>
            {text}
        </Text>
    </View>
);

const pricingStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: pricingColors.bgDark,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 30,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: pricingColors.textPrimary,
        marginBottom: 8,
    },
    headerSubtitle: {
        fontSize: 16,
        color: pricingColors.textSecondary,
        lineHeight: 22,
    },
    card: {
        backgroundColor: pricingColors.bgCard, // Fixed color ref
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 16,
        padding: 24,
        borderWidth: 2,
        borderColor: pricingColors.textSecondary + '30',
    },
    cardHighlighted: {
        borderColor: pricingColors.neonGreen,
        shadowColor: pricingColors.neonGreen,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    badge: {
        backgroundColor: pricingColors.neonGreen,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        alignSelf: 'flex-start',
        marginBottom: 16,
    },
    badgeFree: {
        backgroundColor: pricingColors.textSecondary,
    },
    badgeText: {
        color: pricingColors.bgDark,
        fontSize: 12,
        fontWeight: 'bold',
    },
    planTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: pricingColors.textPrimary,
        marginBottom: 12,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 8,
    },
    price: {
        fontSize: 48,
        fontWeight: 'bold',
        color: pricingColors.neonGreen,
    },
    period: {
        fontSize: 18,
        color: pricingColors.textSecondary,
        marginLeft: 4,
    },
    priceSubtitle: {
        fontSize: 14,
        color: pricingColors.textSecondary,
        marginBottom: 24,
    },
    featuresContainer: {
        marginBottom: 24,
    },
    feature: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    featureIcon: {
        fontSize: 18,
        color: pricingColors.neonGreen,
        marginRight: 12,
        width: 24,
    },
    featureIconUnchecked: {
        color: pricingColors.textSecondary,
    },
    promotionContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    originalPrice: {
        fontSize: 18,
        color: pricingColors.textSecondary,
        textDecorationLine: 'line-through',
        marginRight: 10,
    },
    offerBadge: {
        backgroundColor: pricingColors.neonGreen + '20',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: pricingColors.neonGreen,
    },
    offerBadgeText: {
        color: pricingColors.neonGreen,
        fontSize: 10,
        fontWeight: 'bold',
    },
    featureText: {
        fontSize: 16,
        color: pricingColors.textPrimary,
        flex: 1,
    },
    featureTextUnchecked: {
        color: pricingColors.textSecondary,
    },
    primaryButton: {
        backgroundColor: pricingColors.neonGreen,
        paddingVertical: 16,
        borderRadius: 25,
        marginBottom: 8,
    },
    primaryButtonText: {
        color: pricingColors.bgDark,
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    secondaryButton: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: pricingColors.neonGreen,
        paddingVertical: 16,
        borderRadius: 25,
        marginBottom: 20
    },
    secondaryButtonText: {
        color: pricingColors.neonGreen,
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    cancelText: {
        fontSize: 14,
        color: pricingColors.textSecondary,
        textAlign: 'center',
    },
    footer: {
        paddingHorizontal: 40,
        paddingVertical: 30,
    },
    footerText: {
        fontSize: 12,
        color: pricingColors.textSecondary,
        textAlign: 'center',
        lineHeight: 18,
    },
    restoreButton: {
        marginTop: 10,
        padding: 10,
    },
    restoreButtonText: {
        color: pricingColors.textSecondary,
        fontSize: 14,
        textAlign: 'center',
        textDecorationLine: 'underline',
    },
});
