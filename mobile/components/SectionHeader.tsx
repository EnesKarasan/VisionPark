import { View, Text, StyleSheet } from 'react-native';

import { useTheme } from '@/constants/useTheme';
import { spacing, fontSize, fontWeight } from '@/constants/Theme';

type Props = {
  title: string;
  /** true: yatay padding yok (üst görünümde zaten padding varsa, kartla hizalı kalsın) */
  flush?: boolean;
};

export function SectionHeader({ title, flush = false }: Props) {
  const colors = useTheme();
  return (
    <View style={[styles.sectionHeader, flush && styles.sectionHeaderFlush]}>
      <View style={[styles.sectionAccentBar, { backgroundColor: colors.brandDeep }]} />
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  sectionHeaderFlush: {
    paddingHorizontal: 0,
    marginTop: 0,
    marginBottom: spacing.xs,
  },
  sectionAccentBar: {
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.35,
  },
});
