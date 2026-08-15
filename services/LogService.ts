import axios from 'axios';
import { Platform } from 'react-native';

// In production this would be https://api.nopubly.com/api/logs
const LOG_URL = 'http://10.0.2.2:3000/api/logs';

class LogService {
    /**
     * Report an error to the backend
     */
    public async reportError(error: any, fatal: boolean = false) {
        const errorData = {
            error: error.message || error.toString(),
            stack: error.stack,
            fatal,
            platform: Platform.OS,
            version: Platform.Version,
            deviceName: Platform.select({ android: 'Android Device', ios: 'iOS Device' }),
            timestamp: new Date().toISOString(),
        };

        console.log(`[LogService] Reporting ${fatal ? 'FATAL' : 'non-fatal'} error...`);

        try {
            await axios.post(LOG_URL, errorData);
        } catch (e) {
            // If the logger fails, we just console.log it locally
            console.warn('Failed to send log to server', e);
        }
    }

    /**
     * Initialize Global Error Handlers
     */
    public initGlobalHandlers() {
        // Handle JS Errors
        const originalHandler = ErrorUtils.getGlobalHandler();
        ErrorUtils.setGlobalHandler((error, isFatal) => {
            this.reportError(error, isFatal);
            if (originalHandler) {
                originalHandler(error, isFatal);
            }
        });

        // Handle Unhandled Promise Rejections
        // Note: In newer RN versions, this might require a different approach depending on the engine
        console.log('LogService initialized global handlers');
    }
}

export default new LogService();
