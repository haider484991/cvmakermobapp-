/**
 * App-wide internationalization.
 *
 * Strategy:
 *   - Default locale = device locale (via expo-localization)
 *   - Fallback = English
 *   - User can override via the language picker (stored in AsyncStorage)
 *   - Translations are static JSON, bundled with the app — zero network
 *     calls, works offline.
 *
 * Adding a new language:
 *   1. Create src/i18n/locales/<code>.json (copy en.json, translate values)
 *   2. Import + register in `resources` below
 *   3. Add the locale to `SUPPORTED_LOCALES`
 *   4. Done — language picker will show it automatically.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import es from './locales/es.json';
import ptBR from './locales/pt-BR.json';
import hi from './locales/hi.json';
import id from './locales/id.json';
import ar from './locales/ar.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import ru from './locales/ru.json';
import tr from './locales/tr.json';
import ja from './locales/ja.json';
import zhCN from './locales/zh-CN.json';

const STORAGE_KEY = '@i18n/locale';

export type SupportedLocale =
  | 'en'
  | 'es'
  | 'pt-BR'
  | 'hi'
  | 'id'
  | 'ar'
  | 'fr'
  | 'de'
  | 'ru'
  | 'tr'
  | 'ja'
  | 'zh-CN';

export const SUPPORTED_LOCALES: Array<{
  code: SupportedLocale;
  name: string;
  nativeName: string;
  rtl?: boolean;
}> = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'pt-BR', name: 'Portuguese', nativeName: 'Português' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文' },
];

/**
 * Resolve the best locale for the user. Order of preference:
 *   1. Explicit user choice from AsyncStorage
 *   2. Device locale (if we support it; falls back through region → language)
 *   3. English
 */
async function resolveInitialLocale(): Promise<SupportedLocale> {
  try {
    const stored = (await AsyncStorage.getItem(STORAGE_KEY)) as SupportedLocale | null;
    if (stored && SUPPORTED_LOCALES.some((l) => l.code === stored)) {
      return stored;
    }
  } catch {
    // ignore — fall through to device detection
  }

  const device = getLocales()[0];
  if (!device) return 'en';
  const supported = SUPPORTED_LOCALES.map((l) => l.code);

  // Try exact tag first ("pt-BR", "zh-CN"), then language only ("en", "es").
  if (device.languageTag && supported.includes(device.languageTag as SupportedLocale)) {
    return device.languageTag as SupportedLocale;
  }
  if (device.languageCode && supported.includes(device.languageCode as SupportedLocale)) {
    return device.languageCode as SupportedLocale;
  }

  return 'en';
}

const resources = {
  en: { translation: en },
  es: { translation: es },
  'pt-BR': { translation: ptBR },
  hi: { translation: hi },
  id: { translation: id },
  ar: { translation: ar },
  fr: { translation: fr },
  de: { translation: de },
  ru: { translation: ru },
  tr: { translation: tr },
  ja: { translation: ja },
  'zh-CN': { translation: zhCN },
};

/**
 * Initialize i18next. Call this once at app startup before any rendering.
 */
export async function initI18n(): Promise<void> {
  const lng = await resolveInitialLocale();

  await i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: 'en',
    compatibilityJSON: 'v4',
    interpolation: { escapeValue: false }, // React already escapes
    returnEmptyString: false, // empty string → fall back to en
    react: { useSuspense: false }, // avoids requiring <Suspense> wrappers in RN
  });
}

/**
 * Switch language at runtime. Persists the choice for next launch.
 */
export async function changeLocale(code: SupportedLocale): Promise<void> {
  await i18n.changeLanguage(code);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, code);
  } catch {
    // best-effort
  }
}

export default i18n;
