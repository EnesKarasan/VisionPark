import { lightColors, darkColors } from './Theme';

export default {
  light: {
    ...lightColors,
    tint: lightColors.brandDeep,
    tabIconDefault: lightColors.textTertiary,
    tabIconSelected: lightColors.brandDeep,
  },
  dark: {
    ...darkColors,
    tint: darkColors.brandDeep,
    tabIconDefault: darkColors.textTertiary,
    tabIconSelected: darkColors.brandDeep,
  },
} as const;
