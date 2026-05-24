import { useColorScheme } from '@/components/useColorScheme';
import { getThemeColors, type ThemeColors } from './Theme';

export function useTheme(): ThemeColors {
  const scheme = useColorScheme();
  return getThemeColors(scheme);
}
