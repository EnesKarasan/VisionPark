import { useResolvedColorScheme } from '@/src/preferences';

export function useColorScheme(): 'light' | 'dark' {
  return useResolvedColorScheme();
}
