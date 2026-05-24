import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme as useRNColorScheme } from 'react-native';

const THEME_KEY = 'carparking_theme_pref';
const LANG_KEY = 'carparking_language';

export type ThemePreference = 'system' | 'light' | 'dark';
export type AppLanguage = 'tr' | 'en';

type PreferencesContextType = {
  themePreference: ThemePreference;
  setThemePreference: (p: ThemePreference) => Promise<void>;
  resolvedColorScheme: 'light' | 'dark';
  language: AppLanguage;
  setLanguage: (l: AppLanguage) => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextType | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const rnScheme = useRNColorScheme();
  const systemScheme: 'light' | 'dark' = rnScheme === 'dark' ? 'dark' : 'light';

  const [themePreference, setThemePrefState] = useState<ThemePreference>('system');
  const [language, setLangState] = useState<AppLanguage>('tr');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [t, l] = await Promise.all([AsyncStorage.getItem(THEME_KEY), AsyncStorage.getItem(LANG_KEY)]);
        if (cancelled) return;
        if (t === 'light' || t === 'dark' || t === 'system') setThemePrefState(t);
        if (l === 'en' || l === 'tr') setLangState(l);
      } catch {
        /* varsayılanlar */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setThemePreference = useCallback(async (p: ThemePreference) => {
    setThemePrefState(p);
    await AsyncStorage.setItem(THEME_KEY, p);
  }, []);

  const setLanguage = useCallback(async (l: AppLanguage) => {
    setLangState(l);
    await AsyncStorage.setItem(LANG_KEY, l);
  }, []);

  const resolvedColorScheme = useMemo((): 'light' | 'dark' => {
    if (themePreference === 'system') return systemScheme;
    return themePreference;
  }, [themePreference, systemScheme]);

  const value = useMemo(
    () => ({
      themePreference,
      setThemePreference,
      resolvedColorScheme,
      language,
      setLanguage,
    }),
    [themePreference, setThemePreference, resolvedColorScheme, language, setLanguage],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('PreferencesProvider gerekli');
  return ctx;
}

/** Navigation / Theme.ts ile uyumlu: sistem + kullanıcı seçimi çözümlenmiş tema. */
export function useResolvedColorScheme(): 'light' | 'dark' {
  const ctx = useContext(PreferencesContext);
  const rnScheme = useRNColorScheme();
  const systemScheme: 'light' | 'dark' = rnScheme === 'dark' ? 'dark' : 'light';
  if (!ctx) return systemScheme;
  return ctx.resolvedColorScheme;
}
