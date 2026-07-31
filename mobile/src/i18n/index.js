import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from './en.json';
import sw from './sw.json';

// Detect the device language once at startup; the user's saved choice (from
// LanguageSelectScreen / Settings) overrides this via i18n.changeLanguage.
const deviceLang = Localization.getLocales?.()[0]?.languageCode === 'sw' ? 'sw' : 'en';

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v3',
  resources: {
    en: { translation: en },
    sw: { translation: sw },
  },
  lng: deviceLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
