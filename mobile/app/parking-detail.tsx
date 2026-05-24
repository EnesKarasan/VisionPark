import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/constants/useTheme';
import { spacing, radius, fontSize, fontWeight, shadow } from '@/constants/Theme';
import { useAuth } from '../src/auth';
import { useParkingSpotFlowContext } from '../src/ParkingSpotFlowContext';
import { parseUtcDate } from '../src/format';
import { getPricing, type PricingInfo } from '../src/api';

function formatStartedAt(iso?: string): string {
  if (!iso) return '—';
  const d = parseUtcDate(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseElapsedParts(startedAtIso: string | undefined, nowMs: number) {
  if (!startedAtIso) return { h: 0, m: 0, s: 0, totalMin: 0 };
  const startMs = parseUtcDate(startedAtIso).getTime();
  if (!Number.isFinite(startMs)) return { h: 0, m: 0, s: 0, totalMin: 0 };
  const diff = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  return {
    h: Math.floor(diff / 3600),
    m: Math.floor((diff % 3600) / 60),
    s: diff % 60,
    totalMin: Math.floor(diff / 60),
  };
}

/** Pricing rules kullanarak şu ana kadarki tahmini ücreti hesaplar. */
function estimateFee(pricing: PricingInfo | null, elapsedMin: number): number | null {
  if (!pricing) return null;
  if (elapsedMin <= pricing.free_minutes) return 0;
  // Dilimlerden uygun olanı bul: max_minutes değeri totalMin'i içeren ilk dilim
  for (const b of pricing.brackets) {
    const price = typeof b.price === 'string' ? parseFloat(b.price) : b.price;
    if (b.max_minutes == null) {
      return Number.isFinite(price) ? price : null;
    }
    if (elapsedMin <= b.max_minutes) {
      return Number.isFinite(price) ? price : null;
    }
  }
  return null;
}

export default function ParkingDetailScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const { activeSession, loading, load, refreshing, setRefreshing } = useParkingSpotFlowContext();

  const [now, setNow] = useState(() => Date.now());
  const [pricing, setPricing] = useState<PricingInfo | null>(null);
  const pulseAnim = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (!activeSession) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [activeSession]);

  // Status indicator pulse animation
  useEffect(() => {
    if (!activeSession) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [activeSession, pulseAnim]);

  // Pricing fetch
  useEffect(() => {
    if (!activeSession) return;
    let cancelled = false;
    getPricing()
      .then((p) => {
        if (!cancelled) setPricing(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeSession]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load, setRefreshing]);

  const elapsedParts = useMemo(
    () => parseElapsedParts(activeSession?.started_at, now),
    [activeSession?.started_at, now],
  );

  const estimatedFee = useMemo(
    () => estimateFee(pricing, elapsedParts.totalMin),
    [pricing, elapsedParts.totalMin],
  );

  const pageBg = colors.surfaceAlt;
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });

  if (!token) {
    return (
      <View style={[styles.centered, { backgroundColor: pageBg, paddingBottom: insets.bottom }]}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="lock-closed" size={32} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Giriş gerekli</Text>
        <Text style={[styles.muted, { color: colors.textSecondary, textAlign: 'center' }]}>
          Park detayını görmek için Profil sekmesinden giriş yapın.
        </Text>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.brandDeep, marginTop: spacing.lg }]}
          onPress={() => router.back()}
        >
          <Text style={styles.primaryBtnText}>Geri</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading && !activeSession) {
    return (
      <View style={[styles.centered, { backgroundColor: pageBg }]}>
        <ActivityIndicator size="large" color={colors.brandDeep} />
        <Text style={[styles.muted, { color: colors.textSecondary, marginTop: spacing.md }]}>
          Yükleniyor…
        </Text>
      </View>
    );
  }

  if (!activeSession) {
    return (
      <View style={[styles.centered, { backgroundColor: pageBg, paddingBottom: insets.bottom }]}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="car-outline" size={32} color={colors.textTertiary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Aktif park oturumunuz yok</Text>
        <Text style={[styles.muted, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
          Park başlatmak için ana sayfaya dönün.
        </Text>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.brandDeep, marginTop: spacing.lg }]}
          onPress={() => router.back()}
        >
          <Text style={styles.primaryBtnText}>Geri</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: pageBg }}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: spacing.lg, paddingBottom: spacing.xxl + insets.bottom },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandDeep} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* HERO: Alan numarası + canlı durum */}
      <View
        style={[
          styles.heroCard,
          { backgroundColor: colors.brandDeep, borderColor: colors.brandDeep },
          shadow.md,
        ]}
      >
        {/* Status pill */}
        <View style={styles.heroStatusRow}>
          <View style={styles.heroStatusBadge}>
            <Animated.View
              style={[
                styles.heroPulseDot,
                { backgroundColor: '#22c55e', opacity: pulseOpacity },
              ]}
            />
            <Text style={styles.heroStatusText}>CANLI</Text>
          </View>
          <Text style={styles.heroStatusSub}>Park oturumu devam ediyor</Text>
        </View>

        {/* Spot numarası — büyük */}
        <View style={styles.heroSpotWrap}>
          <Text style={styles.heroSpotLabel}>Park Alanı</Text>
          <Text style={styles.heroSpotValue}>
            {activeSession.spot_number ?? '—'}
          </Text>
        </View>

        {/* Geçen süre — büyük sayaç */}
        <View style={styles.heroTimerWrap}>
          <Text style={styles.heroTimerLabel}>Geçen Süre</Text>
          <View style={styles.heroTimerRow}>
            <TimerSegment value={elapsedParts.h} label="saat" />
            <Text style={styles.heroTimerSep}>:</Text>
            <TimerSegment value={elapsedParts.m} label="dakika" />
            <Text style={styles.heroTimerSep}>:</Text>
            <TimerSegment value={elapsedParts.s} label="saniye" />
          </View>
        </View>
      </View>

      {/* Detay grid kartları */}
      <View style={styles.detailGrid}>
        {/* Başlangıç saati */}
        <View
          style={[
            styles.detailCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
            shadow.sm,
          ]}
        >
          <View style={[styles.detailIcon, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="enter-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.detailContent}>
            <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Giriş Zamanı</Text>
            <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={2}>
              {formatStartedAt(activeSession.started_at)}
            </Text>
          </View>
        </View>

        {/* Tahmini ücret */}
        <View
          style={[
            styles.detailCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
            shadow.sm,
          ]}
        >
          <View style={[styles.detailIcon, { backgroundColor: colors.warningLight }]}>
            <Ionicons name="cash-outline" size={20} color={colors.warningDark} />
          </View>
          <View style={styles.detailContent}>
            <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Tahmini Ücret</Text>
            <Text style={[styles.detailValueFee, { color: colors.text }]}>
              {estimatedFee != null ? `${estimatedFee.toFixed(2)} ₺` : '—'}
            </Text>
            {pricing && elapsedParts.totalMin <= pricing.free_minutes ? (
              <Text style={[styles.detailHint, { color: colors.success }]}>Ücretsiz dilim</Text>
            ) : null}
          </View>
        </View>

        {/* Bilgilendirme — ücret hesabı */}
        <View
          style={[
            styles.infoBanner,
            { backgroundColor: colors.infoLight, borderColor: colors.info },
          ]}
        >
          <Ionicons name="information-circle-outline" size={20} color={colors.info} />
          <Text style={[styles.infoBannerText, { color: colors.info }]}>
            Kesin ücret, çıkış QR kodunu okuttuğunuzda hesaplanıp kayıtlı kartınızdan otomatik tahsil
            edilir.
          </Text>
        </View>
      </View>

      {/* Aksiyon butonları */}
      <View style={styles.actionsBlock}>
        <TouchableOpacity
          style={[styles.exitBtn, { backgroundColor: colors.danger }, shadow.md]}
          onPress={() => router.push('/park-exit-qr')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Parkı bitir, çıkış QR oluştur"
        >
          <Ionicons name="exit-outline" size={22} color="#fff" />
          <Text style={styles.exitBtnText}>Parkı Bitir · Çıkış QR'ı</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: colors.border }]}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
          <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

/* ── Yardımcı bileşenler ────────────────────────────────────────────────── */

function TimerSegment({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.timerSegment}>
      <Text style={styles.timerNumber}>{String(value).padStart(2, '0')}</Text>
      <Text style={styles.timerLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },

  // Empty state
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },

  // HERO card (mavi gradient)
  heroCard: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  heroStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  heroStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  heroPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  heroStatusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.6,
  },
  heroStatusSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: fontSize.xs,
    flex: 1,
  },

  heroSpotWrap: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  heroSpotLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: fontWeight.semibold,
    marginBottom: 4,
  },
  heroSpotValue: {
    color: '#fff',
    fontSize: 52,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.5,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  heroTimerWrap: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
  },
  heroTimerLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  heroTimerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  heroTimerSep: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 28,
    fontWeight: fontWeight.bold,
    marginHorizontal: 2,
  },
  timerSegment: {
    alignItems: 'center',
    minWidth: 48,
  },
  timerNumber: {
    color: '#fff',
    fontSize: 36,
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  timerLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: fontWeight.medium,
    marginTop: 2,
    textTransform: 'lowercase',
  },

  // Detay kartları
  detailGrid: {
    gap: spacing.sm,
  },
  detailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailContent: {
    flex: 1,
    minWidth: 0,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  detailValuePlate: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  detailValueFee: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  detailHint: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: fontWeight.semibold,
  },

  // Bilgi banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  infoBannerText: {
    flex: 1,
    fontSize: fontSize.xs,
    lineHeight: 18,
    fontWeight: fontWeight.medium,
  },

  // Aksiyon butonları
  actionsBlock: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    minHeight: 56,
  },
  exitBtnText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },

  // Generic
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  muted: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  primaryBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
});
