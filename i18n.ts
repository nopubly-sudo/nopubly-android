import { Platform, NativeModules } from 'react-native';

// Import translations from JSON files
import en from './locales/en.json';
import es from './locales/es.json';
import pt from './locales/pt.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import it from './locales/it.json';
import nl from './locales/nl.json';
import ru from './locales/ru.json';
import zh from './locales/zh.json';
import ja from './locales/ja.json';
import ar from './locales/ar.json';
import hi from './locales/hi.json';
import tr from './locales/tr.json';
import ko from './locales/ko.json';

const translations: { [key: string]: any } = {
    en, es, pt, fr, de, it, nl, ru, zh, ja, ar, hi, tr, ko
};

const getDeviceLanguage = () => {
    try {
        const appLanguage =
            Platform.OS === 'ios'
                ? NativeModules.SettingsManager?.settings?.AppleLocale ||
                NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]
                : NativeModules.I18nManager?.localeIdentifier;

        if (!appLanguage) return 'en';

        const langCode = appLanguage.substring(0, 2).toLowerCase();

        return translations[langCode] ? langCode : 'en';
    } catch (e) {
        return 'en'; // Fallback
    }
};

const lang = translations[getDeviceLanguage()] || en;

export { en, es, pt, fr, de, it, nl, ru, zh, ja, ar, hi, tr, ko, translations };
export default lang;
