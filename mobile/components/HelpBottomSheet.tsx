import { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/constants/useTheme';
import { spacing, radius, fontSize, fontWeight } from '@/constants/Theme';
import type { HelpEntry } from '../src/help/helpContent';

interface HelpBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  entry: HelpEntry | null;
}

export default function HelpBottomSheet({ visible, onClose, entry }: HelpBottomSheetProps) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();

  // Modal görünürken aksi durumda re-mount edilirse focus kaybolur — sade tutuyoruz
  useEffect(() => {
    if (!visible) return;
    // Şimdilik ek bir effect yok
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: 'rgba(15,23,42,0.45)' }]}
        onPress={onClose}
      >
        {/* boş — sadece tıklamayla kapansın */}
      </Pressable>

      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            paddingBottom: spacing.xl + insets.bottom,
          },
        ]}
      >
        {/* drag handle */}
        <View style={styles.handleWrap}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>

        {/* header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="help-circle" size={22} color={colors.brandDeep} />
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {entry?.title ?? 'Yardım'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
          >
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* body */}
        <ScrollView
          style={{ maxHeight: 480 }}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {entry?.intro ? (
            <Text style={[styles.intro, { color: colors.textSecondary }]}>{entry.intro}</Text>
          ) : null}

          {entry?.sections.map((s, i) => (
            <View key={i} style={{ marginTop: spacing.md }}>
              <Text style={[styles.sectionHeading, { color: colors.brandDeep }]}>{s.heading}</Text>
              <Text style={[styles.sectionBody, { color: colors.text }]}>{s.body}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    marginRight: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    flex: 1,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  intro: {
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
