import { Platform } from 'react-native';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 28,
  xxxl: 34,
} as const;

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const shadow = {
  sm: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
    android: { elevation: 1 },
    web: { boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.08)' },
    default: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
  }),
  md: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6 },
    android: { elevation: 3 },
    web: { boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.12)' },
    default: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6 },
  }),
  lg: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 12 },
    android: { elevation: 6 },
    web: { boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.16)' },
    default: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 12 },
  }),
} as const;

const palette = {
  blue: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    900: '#1e3a5f',
  },
  green: {
    50: '#f0fdf4',
    100: '#dcfce7',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
  },
  red: {
    50: '#fef2f2',
    100: '#fee2e2',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
  },
  yellow: {
    50: '#fefce8',
    100: '#fef9c3',
    400: '#facc15',
    500: '#eab308',
    600: '#ca8a04',
    700: '#a16207',
    800: '#854d0e',
  },
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
  /** Koyu lacivert — tab bar ve uygulama ikincil marka rengi */
  navy: {
    950: '#061321',
    900: '#0a1f33',
    800: '#0f2840',
    700: '#153a5c',
    600: '#1c4d6e',
  },
  white: '#ffffff',
  black: '#000000',
};

export type ThemeColors = typeof lightColors;

export const lightColors = {
  /** Etkileşim, ikon, odak — koyu mavi (lacivert) */
  primary: palette.navy[700],
  primaryLight: palette.blue[100],
  primaryDark: palette.navy[800],
  /** Başlık / güçlü vurgu — koyu mavi */
  brandDeep: palette.navy[800],
  brandDeepLight: palette.blue[100],

  secondary: palette.navy[800],

  background: palette.slate[50],
  surface: palette.white,
  surfaceAlt: palette.slate[100],

  text: palette.slate[900],
  textSecondary: palette.slate[500],
  textTertiary: palette.slate[400],
  textInverse: palette.white,

  border: palette.slate[200],
  borderLight: palette.slate[100],

  inputBg: palette.white,
  inputBorder: palette.slate[300],
  inputFocusBorder: palette.navy[600],

  success: palette.green[500],
  successLight: palette.green[50],
  successDark: palette.green[700],

  danger: palette.red[500],
  dangerLight: palette.red[50],
  dangerDark: palette.red[600],

  warning: palette.yellow[500],
  warningLight: palette.yellow[50],
  warningDark: palette.yellow[800],

  info: palette.navy[700],
  infoLight: palette.blue[50],

  spotFree: palette.green[500],
  spotOccupied: palette.red[500],
  spotReserved: palette.yellow[500],
  spotOwnReserved: palette.yellow[400],

  /** Hemen Park Et: planda seçilen alan (henüz park başlamadı) — koyu yeşil */
  spotPlanSelectedBg: '#14532d',
  spotPlanSelectedFg: palette.white,

  /** Park-now bölüm seçici — seçili değil (açık yeşil) */
  parkingSectionChipIdleBg: palette.green[100],
  parkingSectionChipIdleBorder: palette.green[400],
  parkingSectionChipIdleFg: palette.green[700],
  /** Seçili (koyu yeşil) */
  parkingSectionChipActiveBg: palette.green[700],
  parkingSectionChipActiveFg: palette.white,

  tabBar: palette.navy[800],
  tabBarBorder: palette.navy[700],

  gradientStart: palette.navy[700],
  gradientEnd: palette.navy[900],

  cardShadow: palette.black,
};

export const darkColors: ThemeColors = {
  primary: palette.blue[600],
  primaryLight: palette.blue[900],
  primaryDark: palette.blue[700],
  brandDeep: palette.blue[500],
  brandDeepLight: palette.blue[900],

  secondary: palette.navy[800],

  background: palette.slate[900],
  surface: palette.slate[800],
  surfaceAlt: palette.slate[700],

  text: palette.slate[50],
  textSecondary: palette.slate[400],
  textTertiary: palette.slate[500],
  textInverse: palette.slate[900],

  border: palette.slate[700],
  borderLight: palette.slate[800],

  inputBg: palette.slate[800],
  inputBorder: palette.slate[600],
  inputFocusBorder: palette.blue[600],

  success: palette.green[400],
  successLight: '#0d2818',
  successDark: palette.green[600],

  danger: palette.red[400],
  dangerLight: '#2d1215',
  dangerDark: palette.red[500],

  warning: palette.yellow[400],
  warningLight: '#2d2505',
  warningDark: palette.yellow[700],

  info: palette.blue[600],
  infoLight: '#0d1b2d',

  spotFree: palette.green[400],
  spotOccupied: palette.red[400],
  spotReserved: palette.yellow[400],
  spotOwnReserved: palette.yellow[500],

  spotPlanSelectedBg: '#166534',
  spotPlanSelectedFg: palette.white,

  parkingSectionChipIdleBg: '#14532d',
  parkingSectionChipIdleBorder: palette.green[500],
  parkingSectionChipIdleFg: palette.green[100],
  parkingSectionChipActiveBg: palette.green[600],
  parkingSectionChipActiveFg: palette.white,

  tabBar: palette.navy[800],
  tabBarBorder: palette.navy[700],

  gradientStart: palette.slate[800],
  gradientEnd: palette.slate[900],

  cardShadow: '#000',
};

export function getThemeColors(scheme: 'light' | 'dark'): ThemeColors {
  return scheme === 'dark' ? darkColors : lightColors;
}
