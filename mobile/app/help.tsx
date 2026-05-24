import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/constants/useTheme';
import { spacing, radius, fontSize, fontWeight, shadow } from '@/constants/Theme';
import { helpContent, helpOrder, type HelpKey } from '../src/help/helpContent';

export default function HelpScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();

  // Hangi bölüm açık (ilk girişi varsayılan olarak açık tutalım)
  const [openKey, setOpenKey] = useState<HelpKey | null>(helpOrder[0] ?? null);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfaceAlt }}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: spacing.lg, paddingBottom: spacing.xl + insets.bottom },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.intro}>
        <Text style={[styles.title, { color: colors.text }]}>VisionPark Kullanıcı Kılavuzu</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Her ekranın açıklaması aşağıda. Bir ekrandayken üstteki "?" simgesine dokunarak o sayfaya
          özel kısa yardımı da görüntüleyebilirsiniz.
        </Text>
      </View>

      {helpOrder.map((key) => {
        const entry = helpContent[key];
        if (!entry) return null;
        const isOpen = openKey === key;
        return (
          <View
            key={key}
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
              shadow.sm,
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setOpenKey(isOpen ? null : key)}
              style={styles.cardHeader}
              accessibilityRole="button"
              accessibilityLabel={`${entry.title} bölümünü ${isOpen ? 'kapat' : 'aç'}`}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                {entry.title}
              </Text>
              <Ionicons
                name={isOpen ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            {isOpen ? (
              <View style={styles.cardBody}>
                <Text style={[styles.intro_, { color: colors.textSecondary }]}>{entry.intro}</Text>
                {entry.sections.map((s, i) => (
                  <View key={i} style={{ marginTop: spacing.md }}>
                    <Text style={[styles.sectionHeading, { color: colors.brandDeep }]}>
                      {s.heading}
                    </Text>
                    <Text style={[styles.sectionBody, { color: colors.text }]}>{s.body}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.md,
  },
  intro: {
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  subtitle: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    flex: 1,
    marginRight: spacing.sm,
  },
  cardBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  intro_: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  sectionHeading: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  sectionBody: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
});
