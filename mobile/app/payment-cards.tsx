import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { CardBrandMark } from '@/components/CardBrandMark';
import { FloatingField } from '@/components/FloatingField';
import {
  getMyPaymentCards,
  addPaymentCard,
  deletePaymentCard,
  type SavedPaymentCard,
  type CardBrand,
} from '../src/api';
import {
  formatCardExpiryAAYY,
  formatPaymentListMask,
  isCardExpiryNotExpired,
  lastFourFromPan,
  parseCardExpiryAAYY,
  formatCardPanWithSpaces,
  sanitizeCardPanInput,
  validatePanLength16,
} from '../src/cardPan';
import { getPreferredPaymentCardId, setPreferredPaymentCardId } from '../src/preferredPaymentCard';
import { useAuth } from '../src/auth';
import { spacing, fontSize, fontWeight, radius, shadow } from '../constants/Theme';
import { useTheme } from '../constants/useTheme';

const CARD_BRANDS: { id: CardBrand; label: string }[] = [
  { id: 'visa', label: 'Visa' },
  { id: 'mastercard', label: 'Mastercard' },
  { id: 'amex', label: 'Amex' },
  { id: 'troy', label: 'Troy' },
  { id: 'other', label: 'Diğer' },
];

function paymentCardRowLines(c: SavedPaymentCard): { lineTitle: string; lineMask: string } {
  const label = c.label?.trim();
  return {
    lineTitle: label || 'Banka kartı',
    lineMask: formatPaymentListMask(c.last_four),
  };
}

export default function PaymentCardsScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [list, setList] = useState<SavedPaymentCard[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addExpanded, setAddExpanded] = useState(false);
  const [cardPan, setCardPan] = useState('');
  const [holderName, setHolderName] = useState('');
  const [expiryAAYY, setExpiryAAYY] = useState('');
  const [brand, setBrand] = useState<CardBrand>('visa');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);

  const canSubmitAdd = useMemo(() => {
    if (validatePanLength16(cardPan) !== null) return false;
    if (!holderName.trim()) return false;
    const exp = parseCardExpiryAAYY(expiryAAYY);
    if (!exp) return false;
    if (!isCardExpiryNotExpired(exp.month, exp.yearFull)) return false;
    return true;
  }, [cardPan, expiryAAYY, holderName]);

  const load = useCallback(async () => {
    if (!token) {
      setList([]);
      setLoading(false);
      setError(null);
      return;
    }
    setError(null);
    try {
      const rows = await getMyPaymentCards(token);
      setList(rows);
    } catch (e: unknown) {
      setError((e as Error).message);
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!list.length) {
      setSelectedId(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const pref = await getPreferredPaymentCardId();
      if (cancelled) return;
      if (pref != null && list.some((c) => c.id === pref)) {
        setSelectedId(pref);
        return;
      }
      setSelectedId(list[0].id);
    })();
    return () => {
      cancelled = true;
    };
  }, [list]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const selectCard = useCallback(async (id: number) => {
    setSelectedId(id);
    await setPreferredPaymentCardId(id);
  }, []);

  const onDeleteRequest = useCallback(
    (c: SavedPaymentCard) => {
      Alert.alert('Kartı sil', 'Bu kartı listeden kaldırmak istiyor musunuz?', [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (!token) return;
              try {
                await deletePaymentCard(token, c.id);
                const pref = await getPreferredPaymentCardId();
                if (pref === c.id) {
                  await setPreferredPaymentCardId(null);
                }
                setList((prev) => prev.filter((x) => x.id !== c.id));
              } catch {
                void load();
              }
            })();
          },
        },
      ]);
    },
    [token, load],
  );

  const submitAdd = useCallback(async () => {
    if (!token) return;
    const panErr = validatePanLength16(cardPan);
    if (panErr) {
      setAddErr(panErr);
      return;
    }
    const four = lastFourFromPan(cardPan);
    const exp = parseCardExpiryAAYY(expiryAAYY);
    if (!exp) {
      setAddErr('Son kullanma tarihini AA/YY olarak tam girin (örn. 08/28).');
      return;
    }
    if (!isCardExpiryNotExpired(exp.month, exp.yearFull)) {
      setAddErr('Kartın son kullanma tarihi geçmiş; güncel veya gelecek bir tarih girin.');
      return;
    }
    const m = exp.month;
    const y = exp.yearFull;
    const h = holderName.trim();
    if (!h) {
      setAddErr('Kart üzerindeki isim zorunludur.');
      return;
    }
    setAddErr(null);
    setSaving(true);
    try {
      const row = await addPaymentCard(token, {
        last_four: four,
        holder_name: h,
        exp_month: m,
        exp_year: y,
        brand,
        label: label.trim() || null,
      });
      await setPreferredPaymentCardId(row.id);
      setCardPan('');
      setHolderName('');
      setExpiryAAYY('');
      setBrand('visa');
      setLabel('');
      setAddExpanded(false);
      await load();
    } catch (e: unknown) {
      setAddErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [token, cardPan, holderName, expiryAAYY, brand, label, load]);

  if (!token) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name="card-outline" size={48} color={colors.textTertiary} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Giriş gerekli</Text>
        <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
          Kartlarınızı kaydetmek için Profil sekmesinden giriş yapın.
        </Text>
      </View>
    );
  }

  if (loading && !refreshing) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.surfaceAlt }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Yükleniyor…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name="cloud-offline-outline" size={44} color={colors.danger} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            setLoading(true);
            void load();
          }}
          accessibilityRole="button"
        >
          <Text style={[styles.retryText, { color: colors.textInverse }]}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.surfaceAlt }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={[styles.cardBlock, { backgroundColor: colors.surface }, shadow.sm]}>
          {list.length === 0 ? (
            <Text style={[styles.emptyInCard, { color: colors.textSecondary }]}>
              Kayıtlı kart yok. Aşağıdan yeni kart ekleyebilirsiniz.
            </Text>
          ) : (
            list.map((c, idx) => {
              const { lineTitle, lineMask } = paymentCardRowLines(c);
              const sel = c.id === selectedId;
              const isLast = idx === list.length - 1;
              return (
                <View
                  key={c.id}
                  style={[
                    styles.savedRow,
                    !isLast && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.savedRowMain}
                    onPress={() => void selectCard(c.id)}
                    activeOpacity={0.75}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: sel }}
                  >
                    <View
                      style={[
                        styles.radioOuter,
                        { borderColor: sel ? colors.primary : colors.border },
                      ]}
                    >
                      {sel ? (
                        <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.cardFaceList,
                        { backgroundColor: '#ffffff', borderColor: colors.border },
                        shadow.sm,
                      ]}
                    >
                      <CardBrandMark brand={c.brand} size={20} fallbackIconColor={colors.brandDeep} />
                    </View>
                    <View style={styles.textCol}>
                      <Text style={[styles.listTitle, { color: colors.text }]} numberOfLines={1}>
                        {lineTitle}
                      </Text>
                      <Text style={[styles.listSub, { color: colors.textSecondary }]} numberOfLines={1}>
                        {lineMask}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.trashBtn}
                    onPress={() => onDeleteRequest(c)}
                    hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel="Kartı sil"
                  >
                    <Ionicons name="trash-outline" size={22} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        <View
          style={[
            styles.cardBlock,
            { backgroundColor: colors.surface, marginTop: spacing.md },
            shadow.sm,
          ]}
        >
          <TouchableOpacity
            style={[
              styles.actionRow,
              addExpanded && {
                borderBottomColor: colors.border,
                borderBottomWidth: StyleSheet.hairlineWidth,
              },
            ]}
            onPress={() => setAddExpanded((e) => !e)}
            activeOpacity={0.75}
          >
            <Ionicons name="card-outline" size={22} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.text }]}>Kredi/Banka kartı ekle</Text>
            <Ionicons
              name={addExpanded ? 'chevron-down' : 'chevron-forward'}
              size={20}
              color={colors.primary}
            />
          </TouchableOpacity>
          {addExpanded ? (
            <View
              style={[
                styles.addFormPanel,
                {
                  borderBottomColor: colors.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
            <FloatingField
              colors={colors}
              fieldLabel="Kart ismi"
              value={label}
              onChangeText={setLabel}
              editable={!saving}
            />
            <FloatingField
              colors={colors}
              fieldLabel="Kart numarası (16 hane)"
              value={formatCardPanWithSpaces(cardPan)}
              onChangeText={(t) => setCardPan(sanitizeCardPanInput(t))}
              keyboardType="number-pad"
              maxLength={19}
              editable={!saving}
            />
            <FloatingField
              colors={colors}
              fieldLabel="Kart üzerindeki isim"
              value={holderName}
              onChangeText={setHolderName}
              autoCapitalize="characters"
              editable={!saving}
            />
            <FloatingField
              colors={colors}
              fieldLabel="Son kullanma (AA/YY)"
              value={expiryAAYY}
              onChangeText={(t) => setExpiryAAYY(formatCardExpiryAAYY(t))}
              keyboardType="number-pad"
              maxLength={5}
              editable={!saving}
            />
            <Text style={[styles.fieldLbl, { color: colors.textSecondary }]}>Kart markası</Text>
            <View
              style={[
                styles.brandBar,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              {CARD_BRANDS.map((b, i) => {
                const sel = brand === b.id;
                const last = i === CARD_BRANDS.length - 1;
                return (
                  <TouchableOpacity
                    key={b.id}
                    onPress={() => setBrand(b.id)}
                    style={[
                      styles.brandSegment,
                      !last && [
                        styles.brandSegmentDivider,
                        { borderRightColor: colors.border },
                      ],
                      sel && { backgroundColor: colors.brandDeep },
                    ]}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected: sel }}
                  >
                    <Text
                      style={[
                        styles.brandSegmentText,
                        {
                          color: sel ? colors.textInverse : colors.text,
                          fontWeight: sel ? fontWeight.bold : fontWeight.semibold,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {b.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {addErr ? <Text style={[styles.addErr, { color: colors.danger }]}>{addErr}</Text> : null}
            <TouchableOpacity
              style={[
                styles.submitBtn,
                {
                  backgroundColor: canSubmitAdd ? colors.brandDeep : colors.border,
                },
              ]}
              onPress={() => void submitAdd()}
              disabled={saving || !canSubmitAdd}
              activeOpacity={canSubmitAdd && !saving ? 0.85 : 1}
              accessibilityState={{ disabled: saving || !canSubmitAdd }}
            >
              {saving ? (
                <ActivityIndicator color={colors.textInverse} size="small" />
              ) : (
                <Text
                  style={[
                    styles.submitBtnText,
                    { color: canSubmitAdd ? colors.textInverse : colors.textTertiary },
                  ]}
                >
                  Kaydet
                </Text>
              )}
            </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  loadingText: { fontSize: fontSize.md, marginTop: spacing.sm },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, textAlign: 'center' },
  emptySub: { fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20, maxWidth: 300 },
  retryBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  retryText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  cardBlock: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  emptyInCard: {
    padding: spacing.lg,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
  },
  savedRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    minWidth: 0,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  cardFaceList: {
    width: 50,
    height: 32,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  textCol: { flex: 1, minWidth: 0 },
  listTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, flexShrink: 1 },
  listSub: { fontSize: fontSize.sm, marginTop: 2, fontWeight: fontWeight.regular },
  trashBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  actionText: {
    flex: 1,
    marginLeft: spacing.md,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  addFormPanel: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  fieldLbl: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  brandBar: {
    flexDirection: 'row',
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  brandSegment: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandSegmentDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  brandSegmentText: {
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
  addErr: { fontSize: fontSize.sm, marginBottom: spacing.sm },
  submitBtn: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  submitBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
});
