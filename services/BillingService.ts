import { Platform } from 'react-native';
import * as IAP from 'react-native-iap';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PRO_PLAN_STATUS_KEY = '@nopubly_pro_status';

// Replacement for real Product IDs (configure in Play Console)
const itemSkus = Platform.select({
    android: [
        'nopubly_pro_monthly',
        'nopubly_pro_yearly',
    ],
    ios: [],
}) || [];

class BillingService {
    private static instance: BillingService;
    private isConnected = false;
    private purchaseUpdateSubscription: any = null;
    private purchaseErrorSubscription: any = null;

    private constructor() { }

    public static getInstance(): BillingService {
        if (!BillingService.instance) {
            BillingService.instance = new BillingService();
        }
        return BillingService.instance;
    }

    /**
     * Initialize connection to Play Store and setup listeners
     */
    public async init(): Promise<boolean> {
        if (this.isConnected) return true;
        try {
            await IAP.initConnection();
            this.isConnected = true;
            console.log('N-CORE IAP: Connection initialized');

            // Setup listeners for real purchase updates
            this.purchaseUpdateSubscription = IAP.purchaseUpdatedListener(async (purchase: any) => {
                const receipt = purchase.transactionReceipt;
                if (receipt) {
                    try {
                        // In a real production app, verify receipt with your backend here
                        if (Platform.OS === 'android') {
                            await IAP.finishTransaction({ purchase, isConsumable: false });
                        }
                        await this.setProStatus(true);
                        console.log('N-CORE IAP: Purchase successful and acknowledged');
                    } catch (ackErr) {
                        console.warn('N-CORE IAP: Acknowledge error', ackErr);
                    }
                }
            });

            this.purchaseErrorSubscription = IAP.purchaseErrorListener((error: any) => {
                console.warn('N-CORE IAP: Purchase error listener', error);
            });

            return true;
        } catch (err) {
            console.warn('N-CORE IAP: Initialization error', err);
            return false;
        }
    }

    /**
     * Get available subscriptions
     */
    public async getSubscriptions(): Promise<any[]> {
        if (!this.isConnected) await this.init();
        try {
            const products = await IAP.getSubscriptions({ skus: itemSkus });
            return products;
        } catch (err) {
            console.warn('N-CORE IAP: Error fetching subscriptions', err);
            return [];
        }
    }

    /**
     * Request a subscription
     */
    public async requestSubscription(sku: string): Promise<void> {
        if (!this.isConnected) await this.init();
        try {
            await IAP.requestSubscription({ sku });
        } catch (err) {
            console.warn('N-CORE IAP: Request subscription error', err);
            throw err;
        }
    }

    /**
     * Restore purchases
     */
    public async restorePurchases(): Promise<boolean> {
        if (!this.isConnected) await this.init();
        try {
            const purchases = await IAP.getAvailablePurchases();
            let hasActiveSub = false;
            purchases.forEach(purchase => {
                if (itemSkus.includes(purchase.productId)) {
                    hasActiveSub = true;
                }
            });
            await this.setProStatus(hasActiveSub);
            return hasActiveSub;
        } catch (err) {
            console.warn('N-CORE IAP: Restore error', err);
            return false;
        }
    }

    /**
     * Save Pro status locally
     */
    public async setProStatus(isPro: boolean): Promise<void> {
        await AsyncStorage.setItem(PRO_PLAN_STATUS_KEY, JSON.stringify(isPro));
    }

    /**
     * Get Pro status locally
     */
    public async getProStatus(): Promise<boolean> {
        const status = await AsyncStorage.getItem(PRO_PLAN_STATUS_KEY);
        return status ? JSON.parse(status) : false;
    }

    /**
     * Close connection and clean up listeners
     */
    public async end(): Promise<void> {
        if (this.purchaseUpdateSubscription) {
            this.purchaseUpdateSubscription.remove();
            this.purchaseUpdateSubscription = null;
        }
        if (this.purchaseErrorSubscription) {
            this.purchaseErrorSubscription.remove();
            this.purchaseErrorSubscription = null;
        }
        await IAP.endConnection();
        this.isConnected = false;
    }
}

export default BillingService.getInstance();
