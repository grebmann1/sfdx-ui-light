import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import ja from './locales/ja.json';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            fr: { translation: fr },
            de: { translation: de },
            es: { translation: es },
            ja: { translation: ja },
        },
        fallbackLng: 'en',
        supportedLngs: ['en', 'fr', 'de', 'es', 'ja'],
        interpolation: { escapeValue: false },
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
        },
    });

export default i18n;

export const SUPPORTED_LANGUAGES = [
    { code: 'en', label: 'EN', name: 'English',  flag: '🇺🇸' },
    { code: 'fr', label: 'FR', name: 'Français', flag: '🇫🇷' },
    { code: 'de', label: 'DE', name: 'Deutsch',  flag: '🇩🇪' },
    { code: 'es', label: 'ES', name: 'Español',  flag: '🇪🇸' },
    { code: 'ja', label: 'JA', name: '日本語',   flag: '🇯🇵' },
] as const;
