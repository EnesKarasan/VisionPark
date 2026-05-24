import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { getCurrentUser, updateCurrentUserProfile, ApiError, type CurrentUser } from '../src/api';
import { useAuth } from '../src/auth';
import { spacing, fontSize, fontWeight, radius, shadow, type ThemeColors } from '../constants/Theme';
import { useTheme } from '../constants/useTheme';

const INFO_ICON_COL = 40;
const INFO_ICON_SIZE = 24;

function ModalSectionHeader({ title, colors }: { title: string; colors: ThemeColors }) {
  return (
    <View style={styles.modalSectionHeader}>
      <View style={[styles.modalSectionAccent, { backgroundColor: colors.brandDeep }]} />
      <Text style={[styles.modalSectionTitle, { color: colors.text }]}>{title}</Text>
    </View>
  );
}

type EditFocusField = 'first' | 'last' | 'email';

const GENDER_LABELS: Record<string, string> = {
  female: 'Kadın',
  male: 'Erkek',
  other: 'Diğer',
  unspecified: 'Belirtmek istemiyorum',
};

function formatIsoDateToTR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0]!.split('-');
  if (!y || !m || !d) return iso;
  return `${d.padStart(2, '0')}.${m.padStart(2, '0')}.${y}`;
}

function IconInfoRow({
  icon,
  value,
  colors,
  isLast,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  colors: ThemeColors;
  isLast?: boolean;
  accessibilityLabel: string;
}) {
  return (
    <View
      style={[
        styles.iconRow,
        !isLast && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
      accessible
      accessibilityLabel={`${accessibilityLabel}: ${value}`}
    >
      <View style={styles.iconSlot}>
        <Ionicons name={icon} size={INFO_ICON_SIZE} color={colors.brandDeep} />
      </View>
      <Text
        style={[
          styles.iconRowValue,
          { color: colors.text },
          Platform.OS === 'android' ? { includeFontPadding: false } : {},
        ]}
        numberOfLines={3}
      >
        {value}
      </Text>
    </View>
  );
}

type Props = {
  token: string;
};

export function AccountProfileCard({ token }: Props) {
  const colors = useTheme();
  const { logout } = useAuth();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [emailField, setEmailField] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editFocusField, setEditFocusField] = useState<EditFocusField | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const u = await getCurrentUser(token);
      setUser(u);
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        logout();
        return;
      }
      setError((e as Error).message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [token, logout]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openEdit = useCallback(() => {
    if (!user) return;
    setFirstName(user.first_name?.trim() ?? '');
    setLastName(user.last_name?.trim() ?? '');
    setEmailField(user.email ?? '');
    setSaveError(null);
    setEditFocusField(null);
    setEditOpen(true);
  }, [user]);

  const closeEdit = useCallback(() => {
    Keyboard.dismiss();
    setEditFocusField(null);
    setEditOpen(false);
    setSaveError(null);
  }, []);

  const handleSaveProfile = useCallback(async () => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    const em = emailField.trim();
    if (!fn || !ln) {
      setSaveError('Ad ve soyad zorunludur.');
      return;
    }
    if (!em || !em.includes('@')) {
      setSaveError('Geçerli bir e-posta girin.');
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const updated = await updateCurrentUserProfile(token, {
        first_name: fn,
        last_name: ln,
        email: em,
      });
      setUser(updated);
      setEditOpen(false);
    } catch (e: unknown) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [token, firstName, lastName, emailField]);

  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.full_name || '—'
    : '—';

  if (loading) {
    return (
      <View style={styles.cardWrap}>
        <View style={[styles.mergedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.muted, { color: colors.textSecondary }]}>Bilgiler yükleniyor…</Text>
          </View>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.cardWrap}>
        <View style={[styles.mergedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.centered}>
            <Ionicons name="cloud-offline-outline" size={40} color={colors.danger} style={styles.errIcon} />
            <Text style={[styles.errTitle, { color: colors.text }]}>Yüklenemedi</Text>
            <Text style={[styles.errMsg, { color: colors.textSecondary }]}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: colors.brandDeep }]}
              onPress={() => void load()}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Tekrar dene"
            >
              <Text style={[styles.retryBtnText, { color: colors.textInverse }]}>Tekrar dene</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <View style={styles.cardWrap}>
      <View style={[styles.mergedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View
          style={[styles.heroInCard, { borderBottomColor: colors.border }]}
          accessible
          accessibilityLabel={`${displayName}, ${user.email}`}
        >
          <TouchableOpacity
            style={styles.heroEditHit}
            onPress={openEdit}
            activeOpacity={0.65}
            accessibilityRole="button"
            accessibilityLabel="Profili düzenle"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="create-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.heroRow}>
            <View style={[styles.avatar, { backgroundColor: colors.brandDeepLight }]}>
              <Ionicons name="person" size={36} color={colors.brandDeep} />
            </View>
            <View style={styles.heroTextBlock}>
              <Text style={[styles.heroName, { color: colors.text }]} numberOfLines={2}>
                {displayName}
              </Text>
            </View>
          </View>
        </View>
        <IconInfoRow
          icon="mail-outline"
          value={user.email}
          colors={colors}
          accessibilityLabel="E-posta"
        />
        <IconInfoRow
          icon="calendar-outline"
          value={formatIsoDateToTR(user.birth_date)}
          colors={colors}
          accessibilityLabel="Doğum tarihi"
        />
        <IconInfoRow
          icon="male-female-outline"
          value={user.gender ? GENDER_LABELS[user.gender] ?? user.gender : '—'}
          colors={colors}
          isLast
          accessibilityLabel="Cinsiyet"
        />
      </View>

      <Modal visible={editOpen} animationType="fade" transparent onRequestClose={closeEdit}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeEdit} accessibilityLabel="Kapat" />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.modalKb, { pointerEvents: 'box-none' }]}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
          >
            <View
              style={[
                styles.modalCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                shadow.md,
              ]}
            >
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderMain}>
                  <ModalSectionHeader title="Profili düzenle" colors={colors} />
                </View>
                <Pressable
                  onPress={closeEdit}
                  style={({ pressed }) => [
                    styles.modalCloseBtn,
                    { backgroundColor: pressed ? colors.surfaceAlt : 'transparent' },
                  ]}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Kapat"
                  disabled={saving}
                >
                  <Ionicons name="close" size={26} color={colors.textSecondary} />
                </Pressable>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.modalNameRow}>
                  <View style={styles.modalHalfField}>
                    <View
                      style={[
                        styles.inputWithIcon,
                        {
                          borderColor:
                            editFocusField === 'first' ? colors.inputFocusBorder : colors.inputBorder,
                          borderWidth: editFocusField === 'first' ? 2 : 1,
                          backgroundColor: colors.inputBg,
                        },
                      ]}
                    >
                      <Ionicons name="person-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
                      <TextInput
                        style={[
                          styles.inputFlex,
                          { color: colors.text },
                          Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
                        ]}
                        value={firstName}
                        onChangeText={setFirstName}
                        onFocus={() => setEditFocusField('first')}
                        onBlur={() => setEditFocusField((f) => (f === 'first' ? null : f))}
                        placeholder="Adınız"
                        placeholderTextColor={colors.textTertiary}
                        autoCapitalize="words"
                        autoCorrect={false}
                        editable={!saving}
                        returnKeyType="next"
                        accessibilityLabel="Ad"
                      />
                    </View>
                  </View>
                  <View style={styles.modalHalfField}>
                    <View
                      style={[
                        styles.inputWithIcon,
                        {
                          borderColor:
                            editFocusField === 'last' ? colors.inputFocusBorder : colors.inputBorder,
                          borderWidth: editFocusField === 'last' ? 2 : 1,
                          backgroundColor: colors.inputBg,
                        },
                      ]}
                    >
                      <Ionicons
                        name="person-circle-outline"
                        size={20}
                        color={colors.textTertiary}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={[
                          styles.inputFlex,
                          { color: colors.text },
                          Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
                        ]}
                        value={lastName}
                        onChangeText={setLastName}
                        onFocus={() => setEditFocusField('last')}
                        onBlur={() => setEditFocusField((f) => (f === 'last' ? null : f))}
                        placeholder="Soyadınız"
                        placeholderTextColor={colors.textTertiary}
                        autoCapitalize="words"
                        autoCorrect={false}
                        editable={!saving}
                        returnKeyType="next"
                        accessibilityLabel="Soyad"
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.modalFieldBlock}>
                  <View
                    style={[
                      styles.inputWithIcon,
                      {
                        borderColor:
                          editFocusField === 'email' ? colors.inputFocusBorder : colors.inputBorder,
                        borderWidth: editFocusField === 'email' ? 2 : 1,
                        backgroundColor: colors.inputBg,
                      },
                    ]}
                  >
                    <Ionicons name="mail-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={[
                        styles.inputFlex,
                        { color: colors.text },
                        Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
                      ]}
                      value={emailField}
                      onChangeText={setEmailField}
                      onFocus={() => setEditFocusField('email')}
                      onBlur={() => setEditFocusField((f) => (f === 'email' ? null : f))}
                      placeholder="ornek@eposta.com"
                      placeholderTextColor={colors.textTertiary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      editable={!saving}
                      returnKeyType="done"
                      onSubmitEditing={() => void handleSaveProfile()}
                      accessibilityLabel="E-posta"
                    />
                  </View>
                </View>

                {saveError ? (
                  <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight }]}>
                    <Ionicons name="alert-circle" size={20} color={colors.danger} style={styles.errorBannerIcon} />
                    <Text style={[styles.errorBannerText, { color: colors.dangerDark }]}>{saveError}</Text>
                  </View>
                ) : null}
              </View>

              <View style={[styles.modalFooter, { borderTopColor: colors.borderLight }]}>
                <TouchableOpacity
                  style={[styles.modalBtnGhost, { borderColor: colors.border }]}
                  onPress={closeEdit}
                  disabled={saving}
                  accessibilityRole="button"
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalBtnGhostText, { color: colors.textSecondary }]}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtnPrimary, { backgroundColor: colors.brandDeep }]}
                  onPress={() => void handleSaveProfile()}
                  disabled={saving}
                  accessibilityRole="button"
                  activeOpacity={0.85}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.textInverse} size="small" />
                  ) : (
                    <Text style={[styles.modalBtnPrimaryText, { color: colors.textInverse }]}>Kaydet</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    marginBottom: spacing.lg,
  },
  mergedCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    overflow: 'hidden',
  },
  centered: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  muted: {
    fontSize: fontSize.md,
  },
  heroInCard: {
    position: 'relative',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  heroEditHit: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.lg,
    zIndex: 2,
    padding: spacing.xs,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 40,
  },
  heroTextBlock: {
    flex: 1,
    marginLeft: spacing.md,
    minWidth: 0,
  },
  heroName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    textAlign: 'left',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
  iconSlot: {
    width: INFO_ICON_COL,
    height: INFO_ICON_COL,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconRowValue: {
    flex: 1,
    fontSize: fontSize.md,
    lineHeight: 22,
    fontWeight: fontWeight.semibold,
    ...Platform.select({
      android: { textAlignVertical: 'center' as const },
    }),
  },
  errIcon: {
    marginBottom: spacing.sm,
  },
  errTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  errMsg: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  retryBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  modalKb: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    zIndex: 1,
    flexShrink: 1,
  },
  modalCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  modalHeaderMain: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.xs,
  },
  modalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  modalSectionAccent: {
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  modalSectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.35,
    flex: 1,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -spacing.xs,
    marginRight: -spacing.xs,
  },
  modalBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  modalNameRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  modalHalfField: {
    flex: 1,
    minWidth: 0,
  },
  modalFieldBlock: {
    marginBottom: spacing.md,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: 48,
    paddingLeft: spacing.md,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  inputFlex: {
    flex: 1,
    minWidth: 0,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    paddingRight: spacing.md,
    fontSize: fontSize.md,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  errorBannerIcon: {
    marginTop: 1,
  },
  errorBannerText: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: 20,
    fontWeight: fontWeight.medium,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  modalBtnGhost: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnGhostText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  modalBtnPrimary: {
    flex: 1.35,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnPrimaryText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
});
