import { useResolvedColorScheme } from '@/src/preferences';

/** Uygulama teması: Sistem / Açık / Koyu tercihi `PreferencesProvider` ile birleştirilir. */
export function useColorScheme(): 'light' | 'dark' {
  return useResolvedColorScheme();
}
