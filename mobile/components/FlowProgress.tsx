import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/constants/useTheme';
import { spacing, fontSize, fontWeight } from '@/constants/Theme';

export type FlowStep = 'spot' | 'details' | 'summary';

interface FlowProgressProps {
  /** Aktif adım */
  current: FlowStep;
  /** Akış tipi — başlık etiketleri için */
  mode?: 'park' | 'reserve';
}

const STEPS: FlowStep[] = ['spot', 'details', 'summary'];

const LABELS: Record<'park' | 'reserve', Record<FlowStep, string>> = {
  park: {
    spot: 'Alan',
    details: 'Detaylar',
    summary: 'QR Giriş',
  },
  reserve: {
    spot: 'Alan',
    details: 'Saat & Detay',
    summary: 'Onayla',
  },
};

const ICONS: Record<FlowStep, keyof typeof Ionicons.glyphMap> = {
  spot: 'grid-outline',
  details: 'card-outline',
  summary: 'checkmark-done-outline',
};

export default function FlowProgress({ current, mode = 'park' }: FlowProgressProps) {
  const colors = useTheme();
  const currentIdx = STEPS.indexOf(current);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {STEPS.map((step, idx) => {
        const isPast = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isUpcoming = idx > currentIdx;

        return (
          <View key={step} style={styles.stepWrapper}>
            <View style={styles.stepInner}>
              {/* Bağlantı çizgisi - sol */}
              {idx > 0 && (
                <View
                  style={[
                    styles.connector,
                    styles.connectorLeft,
                    { backgroundColor: isPast || isCurrent ? colors.brandDeep : colors.borderLight },
                  ]}
                />
              )}

              {/* Daire */}
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: isCurrent
                      ? colors.brandDeep
                      : isPast
                        ? colors.brandDeep
                        : colors.surfaceAlt,
                    borderColor: isCurrent
                      ? colors.brandDeep
                      : isPast
                        ? colors.brandDeep
                        : colors.border,
                  },
                ]}
              >
                {isPast ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : (
                  <Ionicons
                    name={ICONS[step]}
                    size={14}
                    color={isCurrent ? '#fff' : colors.textTertiary}
                  />
                )}
              </View>

              {/* Bağlantı çizgisi - sağ */}
              {idx < STEPS.length - 1 && (
                <View
                  style={[
                    styles.connector,
                    styles.connectorRight,
                    { backgroundColor: isPast ? colors.brandDeep : colors.borderLight },
                  ]}
                />
              )}
            </View>

            <Text
              style={[
                styles.label,
                {
                  color: isCurrent
                    ? colors.brandDeep
                    : isPast
                      ? colors.text
                      : colors.textTertiary,
                  fontWeight: isCurrent ? fontWeight.bold : fontWeight.medium,
                },
              ]}
              numberOfLines={1}
            >
              {LABELS[mode][step]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  stepWrapper: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  stepInner: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
    position: 'relative',
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  connector: {
    position: 'absolute',
    height: 2,
    top: 13,
    zIndex: 1,
  },
  connectorLeft: {
    left: 0,
    right: '50%',
    marginRight: 14,
  },
  connectorRight: {
    left: '50%',
    right: 0,
    marginLeft: 14,
  },
  label: {
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
});
