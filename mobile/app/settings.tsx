import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  Pressable,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';

import { SectionHeader } from '@/components/SectionHeader';
import { useTheme } from '../constants/useTheme';
import { spacing, fontSize, fontWeight, radius, shadow, type ThemeColors } from '../constants/Theme';
import { usePreferences, type AppLanguage } from '../src/preferences';
import { changePassword, deleteAccount } from '../src/api';
import { useAuth } from '../src/auth';

const MENU_ICON_COL = 40;
const MENU_ICON_SIZE = 24;

type SettingsRowProps = {
  icon: React.ReactNode;
  label: string;
  description?: string;
  selected?: boolean;
  onPress: () => void;
  isLast?: boolean;
  colors: ThemeColors;
  destructive?: boolean;
};

function SettingsRow({
  icon,
  label,
  description,
  selected,
  onPress,
  isLast,
  colors,
  destructive,
}: SettingsRowProps) {
  const labelColor = destructive ? colors.danger : colors.text;
  return (
    <TouchableOpacity
      style={[
        styles.menuRow,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.65}
      accessibilityRole="button"
      accessibilityState={selected !== undefined ? { selected } : undefined}
    >
      <View style={styles.menuIconSlot}>{icon}</View>
      <View style={styles.rowTextCol}>
        <Text
          style={[
            styles.menuLabel,
            { color: labelColor },
            Platform.select({
              android: { textAlignVertical: 'center' as const, includeFontPadding: false },
            }),
          ]}
        >
          {label}
        </Text>
        {description ? (
          <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>{description}</Text>
        ) : null}
      </View>
      {selected ? (
        <Ionicons name="checkmark-circle" size={22} color={colors.brandDeep} />
      ) : (
        <View style={styles.trailingSpacer} />
      )}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const colors = useTheme();
  const router = useRouter();
  const { token, logout } = useAuth();
  const { themePreference, setThemePreference, language, setLanguage } = usePreferences();
  const appVersion = Constants.expoConfig?.version ?? '—';

  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [deletePwd, setDeletePwd] = useState('');
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const closePwdModal = useCallback(() => {
    Keyboard.dismiss();
    setPwdModalOpen(false);
    setCurrentPwd('');
    setNewPwd('');
    setConfirmPwd('');
    setPwdError(null);
    setPwdSaving(false);
  }, []);

  const closeDeleteModal = useCallback(() => {
    Keyboard.dismiss();
    setDeleteModalOpen(false);
    setDeletePwd('');
    setDeleteError(null);
    setDeleteSaving(false);
  }, []);

  const onPickLang = async (l: AppLanguage) => {
    if (l === 'en') {
      Alert.alert(
        'English',
        'English interface will be available in a future update. Your choice will be saved.',
        [
          { text: 'Tamam', onPress: () => void setLanguage('en') },
          { text: 'İptal', style: 'cancel' },
        ],
      );
      return;
    }
    await setLanguage('tr');
  };

  const submitChangePassword = useCallback(async () => {
    if (!token) return;
    setPwdError(null);
    if (!currentPwd.trim()) {
      setPwdError('Mevcut şifrenizi girin.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('Yeni şifreler eşleşmiyor.');
      return;
    }
    setPwdSaving(true);
    try {
      await changePassword(token, currentPwd, newPwd);
      closePwdModal();
      Alert.alert('Tamam', 'Şifreniz güncellendi.');
    } catch (e: unknown) {
      setPwdError((e as Error).message);
    } finally {
      setPwdSaving(false);
    }
  }, [token, currentPwd, newPwd, confirmPwd, closePwdModal]);

  const openDeleteWarningModal = useCallback(() => {
    setDeletePwd('');
    setDeleteError(null);
    setDeleteModalOpen(true);
  }, []);

  const submitDeleteAccount = useCallback(async () => {
    if (!token) return;
    setDeleteError(null);
    if (!deletePwd.trim()) {
      setDeleteError('Onaylamak için şifrenizi girin.');
      return;
    }
    setDeleteSaving(true);
    try {
      await deleteAccount(token, deletePwd);
      closeDeleteModal();
      logout();
      router.replace('/(tabs)/index');
    } catch (e: unknown) {
      setDeleteError((e as Error).message);
    } finally {
      setDeleteSaving(false);
    }
  }, [token, deletePwd, closeDeleteModal, logout, router]);

  return (
    <>
      <ScrollView
        style={[styles.screen, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topSpacer} />

        <SectionHeader title="Görünüm" />

        <View style={[styles.groupCard, { backgroundColor: colors.surface }]}>
          <SettingsRow
            icon={<Ionicons name="phone-portrait-outline" size={MENU_ICON_SIZE} color={colors.brandDeep} />}
            label="Sistem"
            description="Telefon veya tarayıcı temasını kullan"
            selected={themePreference === 'system'}
            onPress={() => void setThemePreference('system')}
            isLast={false}
            colors={colors}
          />
          <SettingsRow
            icon={<Ionicons name="sunny-outline" size={MENU_ICON_SIZE} color={colors.brandDeep} />}
            label="Açık tema"
            description="Beyaz arka plan, koyu metin"
            selected={themePreference === 'light'}
            onPress={() => void setThemePreference('light')}
            isLast={false}
            colors={colors}
          />
          <SettingsRow
            icon={<Ionicons name="moon-outline" size={MENU_ICON_SIZE} color={colors.brandDeep} />}
            label="Koyu tema"
            description="Koyu arka plan, açık metin"
            selected={themePreference === 'dark'}
            onPress={() => void setThemePreference('dark')}
            isLast
            colors={colors}
          />
        </View>

        <View style={styles.sectionGap} />

        <SectionHeader title="Dil ve bölge" />

        <View style={[styles.groupCard, { backgroundColor: colors.surface }]}>
          <SettingsRow
            icon={<Ionicons name="language-outline" size={MENU_ICON_SIZE} color={colors.brandDeep} />}
            label="Türkçe"
            description="Varsayılan"
            selected={language === 'tr'}
            onPress={() => void onPickLang('tr')}
            isLast={false}
            colors={colors}
          />
          <SettingsRow
            icon={<Ionicons name="globe-outline" size={MENU_ICON_SIZE} color={colors.brandDeep} />}
            label="English"
            description="Interface coming soon"
            selected={language === 'en'}
            onPress={() => void onPickLang('en')}
            isLast
            colors={colors}
          />
        </View>

        {token ? (
          <>
            <View style={styles.sectionGap} />
            <SectionHeader title="Hesap ve güvenlik" />
            <View style={[styles.groupCard, { backgroundColor: colors.surface }]}>
              <SettingsRow
                icon={<Ionicons name="key-outline" size={MENU_ICON_SIZE} color={colors.brandDeep} />}
                label="Şifre değiştir"
                description="Mevcut şifrenizi doğrulayarak yeni şifre belirleyin"
                onPress={() => {
                  setPwdError(null);
                  setCurrentPwd('');
                  setNewPwd('');
                  setConfirmPwd('');
                  setPwdModalOpen(true);
                }}
                isLast={false}
                colors={colors}
              />
              <SettingsRow
                icon={<Ionicons name="trash-outline" size={MENU_ICON_SIZE} color={colors.danger} />}
                label="Hesabı sil"
                description="Tüm verileriniz kalıcı olarak kaldırılır"
                onPress={openDeleteWarningModal}
                isLast
                colors={colors}
                destructive
              />
            </View>
          </>
        ) : null}

        <View style={styles.sectionGap} />

        <SectionHeader title="Hakkında" colors={colors} />

        <View style={[styles.groupCard, { backgroundColor: colors.surface }]}>
          <View style={styles.versionRow}>
            <View style={styles.menuIconSlot}>
              <Ionicons name="information-circle-outline" size={MENU_ICON_SIZE} color={colors.brandDeep} />
            </View>
            <Text
              style={[
                styles.menuLabel,
                { color: colors.text, flex: 1 },
                Platform.select({
                  android: { textAlignVertical: 'center' as const, includeFontPadding: false },
                }),
              ]}
            >
              Sürüm
            </Text>
            <Text style={[styles.versionValue, { color: colors.text }]}>{appVersion}</Text>
          </View>
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>

      <Modal visible={pwdModalOpen} animationType="fade" transparent onRequestClose={closePwdModal}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closePwdModal} accessibilityLabel="Kapat" />
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
                  <View style={styles.modalSheetSectionHeader}>
                    <View style={[styles.sectionAccentBar, { backgroundColor: colors.brandDeep }]} />
                    <Text style={[styles.sectionTitle, styles.modalSheetTitleText, { color: colors.text }]}>
                      Şifre değiştir
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={closePwdModal}
                  hitSlop={12}
                  disabled={pwdSaving}
                  accessibilityRole="button"
                  accessibilityLabel="Kapat"
                  style={({ pressed }) => [
                    styles.modalCloseBtn,
                    { backgroundColor: pressed ? colors.surfaceAlt : 'transparent' },
                  ]}
                >
                  <Ionicons name="close" size={26} color={colors.textSecondary} />
                </Pressable>
              </View>
              <Text style={[styles.modalHint, { color: colors.textSecondary }]}>
                En az 8 karakter; büyük, küçük harf ve rakam içermeli.
              </Text>
              <Text style={[styles.modalFieldLbl, { color: colors.textSecondary }]}>Mevcut şifre</Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    color: colors.text,
                    borderColor: colors.inputBorder,
                    backgroundColor: colors.inputBg,
                  },
                  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
                ]}
                value={currentPwd}
                onChangeText={setCurrentPwd}
                secureTextEntry
                autoCapitalize="none"
                editable={!pwdSaving}
                placeholder="••••••••"
                placeholderTextColor={colors.textTertiary}
              />
              <Text style={[styles.modalFieldLbl, { color: colors.textSecondary }]}>Yeni şifre</Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    color: colors.text,
                    borderColor: colors.inputBorder,
                    backgroundColor: colors.inputBg,
                  },
                  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
                ]}
                value={newPwd}
                onChangeText={setNewPwd}
                secureTextEntry
                autoCapitalize="none"
                editable={!pwdSaving}
                placeholder="••••••••"
                placeholderTextColor={colors.textTertiary}
              />
              <Text style={[styles.modalFieldLbl, { color: colors.textSecondary }]}>Yeni şifre (tekrar)</Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    color: colors.text,
                    borderColor: colors.inputBorder,
                    backgroundColor: colors.inputBg,
                  },
                  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
                ]}
                value={confirmPwd}
                onChangeText={setConfirmPwd}
                secureTextEntry
                autoCapitalize="none"
                editable={!pwdSaving}
                placeholder="••••••••"
                placeholderTextColor={colors.textTertiary}
                onSubmitEditing={() => void submitChangePassword()}
              />
              {pwdError ? (
                <Text style={[styles.modalErr, { color: colors.danger }]}>{pwdError}</Text>
              ) : null}
              <View style={[styles.modalActions, { borderTopColor: colors.borderLight }]}>
                <TouchableOpacity
                  style={[styles.modalBtnGhost, { borderColor: colors.border }]}
                  onPress={closePwdModal}
                  disabled={pwdSaving}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalBtnGhostTxt, { color: colors.textSecondary }]}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtnPrimary, { backgroundColor: colors.brandDeep }]}
                  onPress={() => void submitChangePassword()}
                  disabled={pwdSaving}
                  activeOpacity={0.85}
                >
                  {pwdSaving ? (
                    <ActivityIndicator color={colors.textInverse} size="small" />
                  ) : (
                    <Text style={[styles.modalBtnPrimaryTxt, { color: colors.textInverse }]}>Kaydet</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={deleteModalOpen} animationType="fade" transparent onRequestClose={closeDeleteModal}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeDeleteModal} accessibilityLabel="Kapat" />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.modalKb, { pointerEvents: 'box-none' }]}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
          >
            <View
              style={[
                styles.modalCard,
                { backgroundColor: colors.surface, borderColor: colors.danger },
                shadow.md,
              ]}
            >
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderMain}>
                  <View style={styles.modalSheetSectionHeader}>
                    <View style={[styles.sectionAccentBar, { backgroundColor: colors.danger }]} />
                    <Text style={[styles.sectionTitle, styles.modalSheetTitleText, { color: colors.danger }]}>
                      Hesabı sil
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={closeDeleteModal}
                  hitSlop={12}
                  disabled={deleteSaving}
                  accessibilityRole="button"
                  accessibilityLabel="Kapat"
                  style={({ pressed }) => [
                    styles.modalCloseBtn,
                    { backgroundColor: pressed ? colors.surfaceAlt : 'transparent' },
                  ]}
                >
                  <Ionicons name="close" size={26} color={colors.textSecondary} />
                </Pressable>
              </View>
              <Text style={[styles.modalHint, { color: colors.textSecondary }]}>
                Hesabınız kalıcı olarak silinecek. Park geçmişi, araçlar ve kayıtlı kartlar da kaldırılır. Bu işlem
                geri alınamaz.
              </Text>
              <Text style={[styles.modalFieldLbl, { color: colors.textSecondary }]}>Şifrenizi girin</Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    color: colors.text,
                    borderColor: colors.inputBorder,
                    backgroundColor: colors.inputBg,
                  },
                  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
                ]}
                value={deletePwd}
                onChangeText={setDeletePwd}
                secureTextEntry
                autoCapitalize="none"
                editable={!deleteSaving}
                placeholder="Şifre"
                placeholderTextColor={colors.textTertiary}
              />
              {deleteError ? (
                <Text style={[styles.modalErr, { color: colors.danger }]}>{deleteError}</Text>
              ) : null}
              <View style={[styles.modalActions, { borderTopColor: colors.borderLight }]}>
                <TouchableOpacity
                  style={[styles.modalBtnGhost, { borderColor: colors.border }]}
                  onPress={closeDeleteModal}
                  disabled={deleteSaving}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalBtnGhostTxt, { color: colors.textSecondary }]}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtnDanger, { backgroundColor: colors.danger }]}
                  onPress={() => void submitDeleteAccount()}
                  disabled={deleteSaving}
                  activeOpacity={0.85}
                >
                  {deleteSaving ? (
                    <ActivityIndicator color={colors.textInverse} size="small" />
                  ) : (
                    <Text style={[styles.modalBtnPrimaryTxt, { color: colors.textInverse }]}>Sil</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  topSpacer: {
    height: spacing.md,
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
  sectionGap: {
    height: spacing.lg,
  },
  groupCard: {
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
  },
  menuIconSlot: {
    width: MENU_ICON_COL,
    height: MENU_ICON_COL,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowTextCol: {
    flex: 1,
    minWidth: 0,
  },
  menuLabel: {
    fontSize: fontSize.md,
    lineHeight: 22,
    fontWeight: fontWeight.medium,
  },
  rowDescription: {
    fontSize: fontSize.sm,
    lineHeight: 18,
    marginTop: 2,
  },
  trailingSpacer: {
    width: 22,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
  },
  versionValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  bottomPad: {
    height: spacing.xl,
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  modalHeaderMain: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.xs,
  },
  modalSheetSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalSheetTitleText: {
    flex: 1,
    minWidth: 0,
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
  modalHint: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  modalFieldLbl: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    minHeight: 48,
    marginBottom: spacing.md,
  },
  modalErr: {
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
    fontWeight: fontWeight.medium,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    marginTop: spacing.sm,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
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
  modalBtnGhostTxt: {
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
  modalBtnDanger: {
    flex: 1.35,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnPrimaryTxt: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
});
