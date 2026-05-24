import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getMyVehicles,
  getMySessions,
  getMyPaymentCards,
  getActiveSession,
  getActiveReservation,
  getCurrentUser,
  getSpots,
  getPricing,
  type UserVehicle,
  type ParkingSessionRow,
  type SavedPaymentCard,
  type SpotsSummary,
  type PricingInfo,
} from '../../src/api';
import { formatMaskedCardPan } from '../../src/cardPan';
import { formatSessionSummaryDate, parseUtcDate } from '../../src/format';
import { formatMoneyAmount } from '../../src/spotFlowUtils';
import { SmartParkingHero } from '@/components/SmartParkingHero';
import { ParkingOccupancyStatCards } from '@/components/ParkingLotPanels';
import { AuthBottomSheet } from '../../components/AuthBottomSheet';
import { useAuth } from '../../src/auth';
import { useTheme } from '../../constants/useTheme';
import { spacing, radius, fontSize, fontWeight, shadow } from '../../constants/Theme';

const TAB_BAR_EXTRA = 172;
const TILE_ROW_GAP = spacing.sm;
const HISTORY_STATUS_LABELS: Record<string, string> = {
  active: 'Devam ediyor',
  ended: 'Tamamlandı',
  cancelled: 'İptal',
};

/** Ana ekran kutularında sayfa başına en fazla gösterilecek öğe üst sınırı (2’şer gruplanır). */
const TILE_HOME_MAX_ITEMS = 20;

/** Fiyat kartında sayfa başına satır sayısı (Geçmiş ile aynı yatay sayfalama mantığı). */
const PRICING_HOME_MAX_ROWS = 24;
const PRICING_ROWS_PER_PAGE = 4;
const PRICING_AUTO_ADVANCE_MS = 10_000;

function chunkBySize<T>(items: T[], size: number): T[][] {
  if (size < 1) return [];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

function homeVehicleLines(v: UserVehicle): { title: string; subtitle: string | null } {
  const plate = v.plate.trim();
  const label = v.label?.trim();
  if (label) return { title: label, subtitle: plate };
  return { title: plate, subtitle: 'Kayıtlı plaka' };
}

function homeCardLines(c: SavedPaymentCard): { title: string; subtitle: string | null } {
  const masked = formatMaskedCardPan(c.last_four);
  const label = c.label?.trim();
  if (label) return { title: label, subtitle: masked };
  return { title: masked, subtitle: 'Kayıtlı kart' };
}

/** Akıllı otopark kartındaki “canlı” durum noktası — hafif nabız. */
function PulsingLiveDot({ color }: { color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [t]);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 1], [1, 0.45]),
    transform: [{ scale: interpolate(t.value, [0, 1], [1, 1.5]) }],
  }));
  return (
    <View style={styles.liveDotWrap} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.liveDot, { backgroundColor: color }, pulseStyle]} />
    </View>
  );
}

function PageIndicatorDots(props: {
  pageCount: number;
  activeIndex: number;
  activeColor: string;
  inactiveColor: string;
}) {
  const { pageCount, activeIndex, activeColor, inactiveColor } = props;
  if (pageCount <= 0) return null;
  return (
    <View style={styles.pageDotsRow} importantForAccessibility="no-hide-descendants">
      {Array.from({ length: pageCount }, (_, i) => (
        <View
          key={i}
          style={[
            styles.pageDotBase,
            i === activeIndex
              ? [styles.pageDotActiveSize, { backgroundColor: activeColor }]
              : [styles.pageDotInactiveSize, { backgroundColor: inactiveColor }],
          ]}
        />
      ))}
    </View>
  );
}

function usePagedHorizontalScroll<T>(
  items: T[],
  maxItems: number,
  fallbackPageWidth: number,
  resetDependency: unknown,
  groupSize: number = 2,
) {
  const pages = useMemo(
    () => chunkBySize(items.slice(0, maxItems), groupSize),
    [items, maxItems, groupSize],
  );

  const [layoutW, setLayoutW] = useState(0);
  const pageW = layoutW > 0 ? layoutW : fallbackPageWidth;
  const [pageIndex, setPageIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setPageIndex(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [resetDependency]);

  const syncPageFromEvent = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageW <= 0 || pages.length === 0) return;
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / pageW);
      const clamped = Math.min(Math.max(0, idx), pages.length - 1);
      setPageIndex((prev) => (prev === clamped ? prev : clamped));
    },
    [pageW, pages.length],
  );

  const onPagerLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) {
      setLayoutW((prev) => (Math.abs(prev - w) < 0.5 ? prev : w));
    }
  }, []);

  return { pages, pageW, pageIndex, scrollRef, syncPageFromEvent, onPagerLayout };
}

type TabsParamList = {
  index: undefined;
  parking: { suggestedSpotId?: number } | undefined;
  profile: undefined;
};

function firstAvailableSpot(spots: SpotsSummary['spots'] | undefined) {
  if (!spots?.length) return null;
  return spots.find((s) => !s.is_occupied && !s.is_reserved) ?? null;
}

function timeGreetingLine(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi Günler';
  return 'İyi Akşamlar';
}

function greetingDisplayName(firstName: string | null | undefined, fullName: string | null | undefined): string | null {
  const fn = firstName?.trim();
  if (fn) return fn;
  const full = fullName?.trim();
  if (!full) return null;
  const part = full.split(/\s+/)[0];
  return part || null;
}

function capitalizeTrName(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1).toLocaleLowerCase('tr-TR');
}

export default function HomeScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const navigation = useNavigation<BottomTabNavigationProp<TabsParamList>>();
  const { token } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  const [vehicles, setVehicles] = useState<UserVehicle[]>([]);
  const [sessions, setSessions] = useState<ParkingSessionRow[]>([]);
  const [paymentCards, setPaymentCards] = useState<SavedPaymentCard[]>([]);
  const [activeSession, setActiveSession] = useState<{
    id: number;
    spot_number?: string;
    started_at?: string;
  } | null>(null);
  const [activeReservation, setActiveReservation] = useState<{
    id: number;
    spot_id: number;
    spot_number?: string;
    scheduled_start_at?: string;
  } | null>(null);
  const [spotsSummary, setSpotsSummary] = useState<SpotsSummary | null>(null);
  const [pricingInfo, setPricingInfo] = useState<PricingInfo | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [greetingName, setGreetingName] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const spotsRes = await getSpots().catch(() => null);
      setSpotsSummary(spotsRes);

      try {
        const p = await getPricing();
        setPricingInfo(p);
        setPricingError(null);
      } catch {
        setPricingInfo(null);
        setPricingError('Ücret bilgisi alınamadı');
      }

      if (!token) {
        setVehicles([]);
        setSessions([]);
        setPaymentCards([]);
        setActiveSession(null);
        setActiveReservation(null);
        setGreetingName(null);
        return;
      }

      const [v, s, c, a, r, me] = await Promise.all([
        getMyVehicles(token).catch(() => [] as UserVehicle[]),
        getMySessions(token).catch(() => [] as ParkingSessionRow[]),
        getMyPaymentCards(token).catch(() => [] as SavedPaymentCard[]),
        getActiveSession(token),
        getActiveReservation(token).catch(() => null),
        getCurrentUser(token).catch(() => null),
      ]);
      setActiveReservation(r);
      setVehicles(v);
      setSessions(s);
      setPaymentCards(c);
      setActiveSession(a);
      const raw = me ? greetingDisplayName(me.first_name, me.full_name) : null;
      setGreetingName(raw ? capitalizeTrName(raw) : null);
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  // Aktif oturumun geçen süresini canlı göstermek için her saniye güncelle
  const [clockNow, setClockNow] = useState(() => Date.now());
  useEffect(() => {
    if (!activeSession?.started_at) return;
    const t = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [activeSession?.started_at]);

  const activeElapsedLabel = useMemo(() => {
    if (!activeSession?.started_at) return null;
    const startMs = parseUtcDate(activeSession.started_at).getTime();
    if (!Number.isFinite(startMs)) return null;
    const diffSec = Math.max(0, Math.floor((clockNow - startMs) / 1000));
    const h = Math.floor(diffSec / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    const s = diffSec % 60;
    if (h > 0) return `${h}sa ${m}dk ${s}sn`;
    if (m > 0) return `${m}dk ${s}sn`;
    return `${s}sn`;
  }, [activeSession?.started_at, clockNow]);

  // Aktif park için anlık tahmini ücret
  const activeEstimatedFee = useMemo(() => {
    if (!activeSession?.started_at || !pricingInfo) return null;
    const startMs = parseUtcDate(activeSession.started_at).getTime();
    if (!Number.isFinite(startMs)) return null;
    const elapsedMin = Math.floor((clockNow - startMs) / 60000);
    if (elapsedMin <= pricingInfo.free_minutes) return 0;
    for (const b of pricingInfo.brackets) {
      const price = typeof b.price === 'string' ? parseFloat(b.price) : b.price;
      if (b.max_minutes == null) return Number.isFinite(price) ? price : null;
      if (elapsedMin <= b.max_minutes) return Number.isFinite(price) ? price : null;
    }
    return null;
  }, [activeSession?.started_at, clockNow, pricingInfo]);

  const isInFreeTier = useMemo(() => {
    if (!activeSession?.started_at || !pricingInfo) return false;
    const startMs = parseUtcDate(activeSession.started_at).getTime();
    if (!Number.isFinite(startMs)) return false;
    const elapsedMin = Math.floor((clockNow - startMs) / 60000);
    return elapsedMin <= pricingInfo.free_minutes;
  }, [activeSession?.started_at, clockNow, pricingInfo]);

  const sortedSessionsForHome = useMemo(
    () =>
      [...sessions].sort(
        (a, b) => parseUtcDate(b.started_at).getTime() - parseUtcDate(a.started_at).getTime(),
      ),
    [sessions],
  );

  const contentInnerWidth = width - spacing.lg * 2;

  const homeSpotStats = useMemo(() => {
    if (!spotsSummary) return { available: 0, occupied: 0, reserved: 0 };
    const available = spotsSummary.available;
    const reserved = spotsSummary.reserved;
    const occupied =
      spotsSummary.occupied ??
      Math.max(0, spotsSummary.total - spotsSummary.available - spotsSummary.reserved);
    return { available, occupied, reserved };
  }, [spotsSummary]);

  const historyTilePadding = spacing.sm + 2;
  const historyPageWidthFallback = Math.max(0, contentInnerWidth - 2 * historyTilePadding);

  const historyPager = usePagedHorizontalScroll(
    sortedSessionsForHome,
    TILE_HOME_MAX_ITEMS,
    historyPageWidthFallback,
    sessions,
  );

  const pairTileWidth = (contentInnerWidth - TILE_ROW_GAP) / 2;
  const squareTileInnerFallback = Math.max(0, pairTileWidth - 2 * historyTilePadding);

  const vehiclesPager = usePagedHorizontalScroll(
    vehicles,
    TILE_HOME_MAX_ITEMS,
    squareTileInnerFallback,
    vehicles,
  );

  const cardsPager = usePagedHorizontalScroll(
    paymentCards,
    TILE_HOME_MAX_ITEMS,
    squareTileInnerFallback,
    paymentCards,
  );
  const smartHeroHeight = Math.min(120, Math.max(92, Math.round(width * 0.22)));
  const smartHeroWidth = width - spacing.lg * 2 - spacing.md * 2;

  const pricingPagerItems = useMemo(() => {
    if (!pricingInfo) return [] as { key: string; label: string; value: string }[];
    const cur = pricingInfo.currency?.trim() || 'TRY';
    return [
      { key: '__free', label: 'Ücretsiz süre', value: `${pricingInfo.free_minutes} dakika` },
      ...pricingInfo.brackets.map((b) => ({
        key: b.label,
        label: b.label,
        value: formatMoneyAmount(b.price, cur),
      })),
    ];
  }, [pricingInfo]);

  const pricingPager = usePagedHorizontalScroll(
    pricingPagerItems,
    PRICING_HOME_MAX_ROWS,
    smartHeroWidth,
    pricingInfo,
    PRICING_ROWS_PER_PAGE,
  );

  const pricingPageIndexRef = useRef(0);
  const pricingPageWRef = useRef(pricingPager.pageW);
  const pricingPagesLenRef = useRef(pricingPager.pages.length);
  useEffect(() => {
    pricingPageIndexRef.current = pricingPager.pageIndex;
  }, [pricingPager.pageIndex]);
  useEffect(() => {
    pricingPageWRef.current = pricingPager.pageW;
    pricingPagesLenRef.current = pricingPager.pages.length;
  }, [pricingPager.pageW, pricingPager.pages.length]);

  const pricingScrollRef = pricingPager.scrollRef;
  useFocusEffect(
    useCallback(() => {
      const id = setInterval(() => {
        const total = pricingPagesLenRef.current;
        const pw = pricingPageWRef.current;
        if (total <= 1 || pw <= 0) return;
        const cur = pricingPageIndexRef.current;
        const next = (cur + 1) % total;
        pricingPageIndexRef.current = next;
        pricingScrollRef.current?.scrollTo({ x: next * pw, animated: true });
      }, PRICING_AUTO_ADVANCE_MS);
      return () => clearInterval(id);
    }, [pricingScrollRef]),
  );

  const headlineGreeting = greetingName
    ? `${timeGreetingLine()}, ${greetingName}`
    : timeGreetingLine();

  const suggestedSpot = useMemo(
    () => firstAvailableSpot(spotsSummary?.spots),
    [spotsSummary?.spots],
  );

  const reservedSpotForCard = useMemo(() => {
    if (!activeReservation) return null;
    return spotsSummary?.spots?.find((s) => s.id === activeReservation.spot_id) ?? null;
  }, [activeReservation, spotsSummary?.spots]);

  // Karta gösterilecek spot: aktif rezervasyon > akıllı öneri
  const cardSuggestedSpot = reservedSpotForCard ?? suggestedSpot;

  const openParkingWithSuggestion = useCallback(() => {
    if (!token) {
      setAuthOpen(true);
      return;
    }
    if (activeSession) {
      router.push('/parking-detail');
      return;
    }
    if (activeReservation) {
      // Aktif rezervasyon varsa doğrudan giriş QR'ına — park-now'da gereksiz banner gösterme
      router.push({
        pathname: '/park-entry-qr',
        params: { spotId: String(activeReservation.spot_id) },
      });
      return;
    }
    if (suggestedSpot) {
      router.push({ pathname: '/park-now', params: { suggestedSpotId: String(suggestedSpot.id) } });
    } else {
      router.push('/park-now');
    }
  }, [token, router, suggestedSpot, activeSession, activeReservation]);

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + TAB_BAR_EXTRA + insets.bottom }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandDeep} />
      }
    >
      <Animated.View entering={FadeInDown.duration(360).delay(30)}>
        <Text
          style={[
            styles.title,
            {
              color: colors.text,
              // Telefon genişliğine göre responsive font boyutu
              fontSize: width < 340 ? 22 : width < 380 ? 24 : width < 440 ? 26 : 28,
              lineHeight: width < 340 ? 28 : width < 380 ? 30 : width < 440 ? 32 : 34,
            },
          ]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {headlineGreeting}
        </Text>
      </Animated.View>

      {loading && !refreshing ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="small" color={colors.brandDeep} />
        </View>
      ) : null}


      <Animated.View entering={FadeInDown.duration(400).delay(80)}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={openParkingWithSuggestion}
          style={[
            styles.smartCard,
            {
              backgroundColor: activeSession
                ? colors.successLight
                : activeReservation
                  ? colors.warningLight
                  : colors.surface,
              borderColor: activeSession
                ? colors.success
                : activeReservation
                  ? colors.warning
                  : colors.border,
              borderWidth: activeSession || activeReservation ? 2 : StyleSheet.hairlineWidth,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            activeSession
              ? `Aktif park oturumu ${activeSession.spot_number ?? ''}, detayları gör`
              : activeReservation
                ? `Aktif rezervasyon, alan ${activeReservation.spot_number ?? ''}`
                : suggestedSpot
                  ? `Önerilen alan ${suggestedSpot.spot_number}, park ekranına git`
                  : 'Akıllı otopark önerisi, park ekranına git'
          }
        >
          <View style={styles.smartCardHeader}>
            <View style={styles.smartCardHeaderTitles}>
              <Text style={[styles.homeSectionTitle, { color: colors.text }]}>
                {activeSession
                  ? 'Otopark Devam Ediyor'
                  : activeReservation
                    ? 'Aktif Rezervasyonunuz Var'
                    : 'Akıllı Otopark Önerisi'}
              </Text>
              <Text style={[styles.homeSectionSubtitle, { color: colors.textSecondary }]} numberOfLines={3}>
                {activeSession
                  ? 'Aktif park oturumunuz var. Detayları görmek ve çıkış yapmak için dokunun.'
                  : activeReservation
                    ? "Rezervasyon yaptınız. Saatinde otoparka gelip giriş QR'ını okutun."
                    : 'Tek dokunuş ile hızlı bir şekilde alanı seçin ve arabanızı park edin!'}
              </Text>
            </View>
            <View
              style={[
                styles.smartChevronCircle,
                {
                  backgroundColor:
                    activeSession || activeReservation ? 'rgba(255,255,255,0.6)' : colors.surfaceAlt,
                },
              ]}
            >
              <Ionicons name="chevron-forward" size={20} color={colors.brandDeep} />
            </View>
          </View>
          <View style={[styles.smartHero, { height: smartHeroHeight }]}>
            <SmartParkingHero width={smartHeroWidth} height={smartHeroHeight} />
          </View>
          <View style={styles.smartFooter}>
            <View style={styles.smartFooterAlanWrap}>
              <View style={styles.smartFooterPromoRow}>
                <Text style={[styles.smartFooterPromoLabel, { color: colors.textTertiary }]}>Alan </Text>
                <Text
                  style={[styles.smartFooterPromoValue, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {activeSession
                    ? (activeSession.spot_number ?? '—')
                    : (activeReservation
                        ? (activeReservation.spot_number ?? cardSuggestedSpot?.spot_number ?? '—')
                        : (cardSuggestedSpot ? cardSuggestedSpot.spot_number : '—'))}
                </Text>
              </View>
            </View>
            <View style={styles.smartFooterLiveRowEnd}>
              <PulsingLiveDot color={colors.success} />
              <Text style={[styles.smartFooterStatusText, { color: colors.success }]}>
                {activeSession
                  ? (activeElapsedLabel ? `Süre: ${activeElapsedLabel}` : 'Park aktif')
                  : (activeReservation
                      ? 'Rezervasyonunuz'
                      : (cardSuggestedSpot ? 'Önerilen alan' : 'Canlı · Müsait'))}
              </Text>
            </View>
          </View>
          {/* Aktif park için anlık tahmini ücret */}
          {activeSession && pricingInfo ? (
            <View
              style={{
                marginTop: spacing.sm,
                paddingTop: spacing.sm,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: 'rgba(0,0,0,0.08)',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Anlık Tahmini Ücret
              </Text>
              {isInFreeTier ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.success }}>Ücretsiz</Text>
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>(serbest dilimde)</Text>
                </View>
              ) : (
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
                  ₺{(activeEstimatedFee ?? 0).toFixed(2)}
                </Text>
              )}
            </View>
          ) : null}
        </TouchableOpacity>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(390).delay(75)}>
        <View
          style={[styles.smartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text
            style={[styles.homeSectionTitle, { color: colors.text, marginBottom: spacing.sm }]}
          >
            Doluluk durumu
          </Text>
          <ParkingOccupancyStatCards
            available={homeSpotStats.available}
            occupied={homeSpotStats.occupied}
            reserved={homeSpotStats.reserved}
            contentWidth={smartHeroWidth}
            rowStyle={{ marginBottom: 0 }}
          />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(100)}>
        <View
          style={[styles.smartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.pricingCardHeadTextCol}>
            <View style={styles.historyHeader}>
              <Text style={[styles.homeSectionTitle, { color: colors.text }]}>Fiyat listesi</Text>
              {pricingPager.pages.length > 1 ? (
                <PageIndicatorDots
                  pageCount={pricingPager.pages.length}
                  activeIndex={pricingPager.pageIndex}
                  activeColor={colors.secondary}
                  inactiveColor={colors.borderLight}
                />
              ) : null}
            </View>
          </View>
          {pricingError && !pricingInfo ? (
            <Text style={[styles.pricingErrorText, { color: colors.danger }]}>{pricingError}</Text>
          ) : pricingInfo ? (
            pricingPager.pages.length > 0 ? (
              <ScrollView
                ref={pricingPager.scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled
                decelerationRate="fast"
                keyboardShouldPersistTaps="handled"
                onLayout={pricingPager.onPagerLayout}
                onScroll={pricingPager.syncPageFromEvent}
                scrollEventThrottle={32}
                onScrollEndDrag={pricingPager.syncPageFromEvent}
                onMomentumScrollEnd={pricingPager.syncPageFromEvent}
                accessibilityLabel="Fiyat dilimleri, yatay kaydırın"
                accessibilityValue={
                  pricingPager.pages.length > 1
                    ? { text: `Sayfa ${pricingPager.pageIndex + 1} / ${pricingPager.pages.length}` }
                    : undefined
                }
                style={styles.pricingPager}
                contentContainerStyle={styles.pricingPagerContent}
              >
                {pricingPager.pages.map((page) => (
                  <View
                    key={page.map((r) => r.key).join('-')}
                    style={[styles.pricingPage, { width: pricingPager.pageW }]}
                  >
                    <View style={styles.pricingPageList}>
                      {page.map((row, i) => (
                        <View key={row.key}>
                          {i > 0 ? (
                            <View
                              style={[styles.pricingPagerDivider, { backgroundColor: colors.borderLight }]}
                            />
                          ) : null}
                          <View style={styles.pricingPagerRow}>
                            <Text style={[styles.pricingRowLabel, { color: colors.textSecondary }]}>
                              {row.label}
                            </Text>
                            <Text style={[styles.pricingRowValue, { color: colors.text }]}>{row.value}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={[styles.homeSectionSubtitle, { color: colors.textSecondary }]}>
                Ücret bilgisi yok.
              </Text>
            )
          ) : loading && !refreshing ? (
            <ActivityIndicator color={colors.brandDeep} style={styles.pricingLoader} />
          ) : (
            <Text style={[styles.homeSectionSubtitle, { color: colors.textSecondary }]}>Ücret bilgisi yok.</Text>
          )}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(440).delay(115)} style={styles.historyBarWrap}>
        <View
          style={[
            styles.historyBarTile,
            styles.historyTile,
            {
              backgroundColor: colors.secondary,
              borderColor: colors.tabBarBorder,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => (token ? router.push('/parking-history') : navigation.navigate('profile'))}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Park geçmişi, tam listeyi aç"
            accessibilityValue={
              token && historyPager.pages.length > 0
                ? { text: `Sayfa ${historyPager.pageIndex + 1} / ${historyPager.pages.length}` }
                : undefined
            }
          >
            <View style={styles.historyHeader}>
              <Text style={[styles.homeSectionTitle, { color: 'rgba(255,255,255,0.96)' }]}>Geçmiş</Text>
              {token && historyPager.pages.length > 0 ? (
                <PageIndicatorDots
                  pageCount={historyPager.pages.length}
                  activeIndex={historyPager.pageIndex}
                  activeColor="rgba(255,255,255,0.92)"
                  inactiveColor="rgba(255,255,255,0.28)"
                />
              ) : null}
            </View>
          </TouchableOpacity>
          {token ? (
            historyPager.pages.length > 0 ? (
              <>
                <ScrollView
                  ref={historyPager.scrollRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  nestedScrollEnabled
                  decelerationRate="fast"
                  keyboardShouldPersistTaps="handled"
                  onLayout={historyPager.onPagerLayout}
                  onScroll={historyPager.syncPageFromEvent}
                  scrollEventThrottle={32}
                  onScrollEndDrag={historyPager.syncPageFromEvent}
                  onMomentumScrollEnd={historyPager.syncPageFromEvent}
                  accessibilityLabel="Son park oturumları, yatay kaydırın"
                  style={styles.historyPager}
                  contentContainerStyle={styles.historyPagerContent}
                >
                  {historyPager.pages.map((page) => (
                    <View
                      key={page.map((r) => r.id).join('-')}
                      style={[styles.historyPage, { width: historyPager.pageW }]}
                    >
                      <View style={styles.historyList}>
                        {page.map((row, i) => (
                          <View key={row.id}>
                            {i > 0 ? (
                              <View
                                style={[styles.historyDivider, { backgroundColor: 'rgba(255,255,255,0.14)' }]}
                              />
                            ) : null}
                            <View style={styles.historyRow}>
                              <View style={styles.historyRowMain}>
                                <Text style={[styles.historyRowTitle, { color: '#ffffff' }]} numberOfLines={1}>
                                  {row.spot_number ? `Alan ${row.spot_number}` : 'Park oturumu'}
                                </Text>
                                <View style={styles.historyMetaRow}>
                                  <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.5)" />
                                  <Text
                                    style={[styles.historyMetaText, { color: 'rgba(255,255,255,0.58)' }]}
                                    numberOfLines={1}
                                  >
                                    {formatSessionSummaryDate(row.started_at)}
                                    {' · '}
                                    {HISTORY_STATUS_LABELS[row.status] ?? row.status}
                                  </Text>
                                </View>
                              </View>
                              <View style={[styles.historyChevronCircle, { backgroundColor: '#ffffff' }]}>
                                <Ionicons name="chevron-forward" size={16} color={colors.secondary} />
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </ScrollView>
                {sessions.length > TILE_HOME_MAX_ITEMS ? (
                  <Text style={[styles.historyMoreHint, { color: 'rgba(255,255,255,0.45)' }]}>
                    +{sessions.length - TILE_HOME_MAX_ITEMS} kayıt
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={[styles.historyEmptyText, { color: 'rgba(255,255,255,0.5)' }]}>Henüz yok</Text>
            )
          ) : (
            <TouchableOpacity
              onPress={() => setAuthOpen(true)}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel="Geçmişi görmek için giriş yap"
              style={[styles.loginPromptBtn, { backgroundColor: 'rgba(255,255,255,0.18)' }]}
            >
              <Ionicons name="person-outline" size={15} color="rgba(255,255,255,0.92)" />
              <Text style={[styles.loginPromptBtnText, { color: 'rgba(255,255,255,0.92)' }]}>
                Giriş Yap
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(440).delay(120)} style={styles.tileRow}>
        <View
          style={[
            styles.squareTile,
            styles.historyTile,
            {
              width: pairTileWidth,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => (token ? router.push('/my-cars') : navigation.navigate('profile'))}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Araçlarım, tam listeyi aç"
            accessibilityValue={
              token && vehiclesPager.pages.length > 0
                ? { text: `Sayfa ${vehiclesPager.pageIndex + 1} / ${vehiclesPager.pages.length}` }
                : undefined
            }
          >
            <View style={styles.historyHeader}>
              <Text style={[styles.homeSectionTitle, { color: colors.text }]}>Araçlarım</Text>
              {token && vehiclesPager.pages.length > 0 ? (
                <PageIndicatorDots
                  pageCount={vehiclesPager.pages.length}
                  activeIndex={vehiclesPager.pageIndex}
                  activeColor={colors.secondary}
                  inactiveColor={colors.borderLight}
                />
              ) : null}
            </View>
          </TouchableOpacity>
          {token ? (
            vehiclesPager.pages.length > 0 ? (
              <>
                <ScrollView
                  ref={vehiclesPager.scrollRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  nestedScrollEnabled
                  decelerationRate="fast"
                  keyboardShouldPersistTaps="handled"
                  onLayout={vehiclesPager.onPagerLayout}
                  onScroll={vehiclesPager.syncPageFromEvent}
                  scrollEventThrottle={32}
                  onScrollEndDrag={vehiclesPager.syncPageFromEvent}
                  onMomentumScrollEnd={vehiclesPager.syncPageFromEvent}
                  accessibilityLabel="Kayıtlı plakalar, yatay kaydırın"
                  style={styles.squareTileHorizontalPager}
                  contentContainerStyle={styles.squareTilePagerContent}
                >
                  {vehiclesPager.pages.map((page) => (
                    <View
                      key={page.map((v) => v.id).join('-')}
                      style={[styles.historyPage, { width: vehiclesPager.pageW }]}
                    >
                      <View style={[styles.historyList, styles.squareTilePagerPageList]}>
                        {page.map((v, i) => {
                          const veh = homeVehicleLines(v);
                          return (
                          <View key={v.id}>
                            {i > 0 ? (
                              <View style={[styles.historyDivider, { backgroundColor: colors.borderLight }]} />
                            ) : null}
                            <View style={styles.historyRow}>
                              <View style={styles.historyRowMain}>
                                <Text
                                  style={[styles.historyRowTitle, { color: colors.text }]}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                  minimumFontScale={0.75}
                                >
                                  {veh.title}
                                </Text>
                                {veh.subtitle ? (
                                  <Text
                                    style={[styles.historyRowSubtitle, { color: colors.textSecondary }]}
                                    numberOfLines={1}
                                  >
                                    {veh.subtitle}
                                  </Text>
                                ) : null}
                              </View>
                              <View style={[styles.historyChevronCircle, { backgroundColor: colors.surfaceAlt }]}>
                                <Ionicons name="chevron-forward" size={16} color={colors.secondary} />
                              </View>
                            </View>
                          </View>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </ScrollView>
                {vehicles.length > TILE_HOME_MAX_ITEMS ? (
                  <Text style={[styles.historyMoreHint, { color: colors.textTertiary }]}>
                    +{vehicles.length - TILE_HOME_MAX_ITEMS} plaka
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={[styles.historyEmptyText, { color: colors.textSecondary }]}>Plaka ekleyin</Text>
            )
          ) : (
            <TouchableOpacity
              onPress={() => setAuthOpen(true)}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel="Araçlarımı görmek için giriş yap"
              style={[styles.loginPromptBtn, { backgroundColor: colors.brandDeepLight }]}
            >
              <Ionicons name="person-outline" size={15} color={colors.brandDeep} />
              <Text style={[styles.loginPromptBtnText, { color: colors.brandDeep }]}>Giriş Yap</Text>
            </TouchableOpacity>
          )}
        </View>

        <View
          style={[
            styles.squareTile,
            styles.historyTile,
            {
              width: pairTileWidth,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => (token ? router.push('/payment-cards') : navigation.navigate('profile'))}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Kartlarım, tam listeyi aç"
            accessibilityValue={
              token && cardsPager.pages.length > 0
                ? { text: `Sayfa ${cardsPager.pageIndex + 1} / ${cardsPager.pages.length}` }
                : undefined
            }
          >
            <View style={styles.historyHeader}>
              <Text style={[styles.homeSectionTitle, { color: colors.text }]}>Kartlarım</Text>
              {token && cardsPager.pages.length > 0 ? (
                <PageIndicatorDots
                  pageCount={cardsPager.pages.length}
                  activeIndex={cardsPager.pageIndex}
                  activeColor={colors.secondary}
                  inactiveColor={colors.borderLight}
                />
              ) : null}
            </View>
          </TouchableOpacity>
          {token ? (
            cardsPager.pages.length > 0 ? (
              <>
                <ScrollView
                  ref={cardsPager.scrollRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  nestedScrollEnabled
                  decelerationRate="fast"
                  keyboardShouldPersistTaps="handled"
                  onLayout={cardsPager.onPagerLayout}
                  onScroll={cardsPager.syncPageFromEvent}
                  scrollEventThrottle={32}
                  onScrollEndDrag={cardsPager.syncPageFromEvent}
                  onMomentumScrollEnd={cardsPager.syncPageFromEvent}
                  accessibilityLabel="Kayıtlı kartlar, yatay kaydırın"
                  style={styles.squareTileHorizontalPager}
                  contentContainerStyle={styles.squareTilePagerContent}
                >
                  {cardsPager.pages.map((page) => (
                    <View
                      key={page.map((c) => c.id).join('-')}
                      style={[styles.historyPage, { width: cardsPager.pageW }]}
                    >
                      <View style={[styles.historyList, styles.squareTilePagerPageList]}>
                        {page.map((c, i) => {
                          const card = homeCardLines(c);
                          return (
                          <View key={c.id}>
                            {i > 0 ? (
                              <View style={[styles.historyDivider, { backgroundColor: colors.borderLight }]} />
                            ) : null}
                            <View style={styles.historyRow}>
                              <View style={styles.historyRowMain}>
                                <Text
                                  style={[styles.historyRowTitle, { color: colors.text }]}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                  minimumFontScale={0.75}
                                >
                                  {card.title}
                                </Text>
                                {card.subtitle ? (
                                  <Text
                                    style={[styles.historyRowSubtitle, { color: colors.textSecondary }]}
                                    numberOfLines={1}
                                  >
                                    {card.subtitle}
                                  </Text>
                                ) : null}
                              </View>
                              <View style={[styles.historyChevronCircle, { backgroundColor: colors.surfaceAlt }]}>
                                <Ionicons name="chevron-forward" size={16} color={colors.secondary} />
                              </View>
                            </View>
                          </View>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </ScrollView>
                {paymentCards.length > TILE_HOME_MAX_ITEMS ? (
                  <Text style={[styles.historyMoreHint, { color: colors.textTertiary }]}>
                    +{paymentCards.length - TILE_HOME_MAX_ITEMS} kart
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={[styles.historyEmptyText, { color: colors.textSecondary }]}>Kart ekleyin</Text>
            )
          ) : (
            <TouchableOpacity
              onPress={() => setAuthOpen(true)}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel="Kartlarımı görmek için giriş yap"
              style={[styles.loginPromptBtn, { backgroundColor: colors.brandDeepLight }]}
            >
              <Ionicons name="person-outline" size={15} color={colors.brandDeep} />
              <Text style={[styles.loginPromptBtnText, { color: colors.brandDeep }]}>Giriş Yap</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
      <AuthBottomSheet
        visible={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={() => setAuthOpen(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
    marginBottom: spacing.md,
  },
  loaderWrap: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  activeBannerOuter: {
    marginBottom: spacing.md,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadow.md,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  activeBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBannerTextCol: { flex: 1 },
  activeBannerTitle: {
    color: '#fff',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  activeBannerSub: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  smartCard: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.md,
  },
  pricingCardHeadTextCol: {
    flex: 1,
    minWidth: 0,
    marginBottom: spacing.sm,
  },
  pricingPager: {
    flexGrow: 0,
  },
  pricingPagerContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  pricingPage: {
    flexShrink: 0,
  },
  pricingPageList: {
    justifyContent: 'flex-start',
    width: '100%',
  },
  pricingPagerDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    marginVertical: 2,
  },
  pricingPagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  pricingErrorText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  pricingLoader: {
    paddingVertical: spacing.md,
  },
  pricingRowLabel: {
    fontSize: fontSize.sm,
    flex: 1,
  },
  pricingRowValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    textAlign: 'right',
  },
  smartCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  smartCardHeaderTitles: {
    flex: 1,
    minWidth: 0,
  },
  homeSectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.35,
  },
  homeSectionSubtitle: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: 4,
    fontWeight: fontWeight.medium,
  },
  smartChevronCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartHero: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    backgroundColor: 'transparent',
  },
  smartFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  smartFooterAlanWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  smartFooterLiveRowEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDotWrap: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartFooterStatusText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
  },
  smartFooterPromoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'flex-start',
    maxWidth: '100%',
  },
  smartFooterPromoLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  smartFooterPromoValue: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  tileRow: {
    flexDirection: 'row',
    gap: TILE_ROW_GAP,
    marginBottom: TILE_ROW_GAP,
  },
  historyBarWrap: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  historyBarTile: {
    width: '100%',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    ...shadow.sm,
  },
  squareTile: {
    aspectRatio: 1,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.sm,
    ...shadow.sm,
  },
  squareTileIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  squareTileTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    marginBottom: 2,
  },
  squareTileStat: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    marginBottom: 2,
  },
  squareTileHint: {
    fontSize: 9,
    lineHeight: 12,
    flex: 1,
  },
  historyTile: {
    padding: spacing.sm + 2,
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  pageDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pageDotBase: {
    borderRadius: 99,
  },
  pageDotInactiveSize: {
    width: 6,
    height: 6,
  },
  pageDotActiveSize: {
    width: 8,
    height: 8,
  },
  historyPager: {
    flexGrow: 0,
  },
  /** Kare kutularda yatay pager: flexGrow 0 kullanma; viewport yüksekliği ve içerik için alan açılır. */
  squareTileHorizontalPager: {
    width: '100%',
    minWidth: 0,
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 96,
  },
  squareTilePagerContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    flexGrow: 1,
  },
  /** Kare tile’da sayfa yüksekliği stretch ile gelir; flex:1 + center satırları ortalar. Üst yükseklik 0 iken flex:1 çökertiyordu. */
  squareTilePagerPageList: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
  },
  historyPagerContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  historyPage: {
    flexShrink: 0,
  },
  historyList: {
    justifyContent: 'center',
  },
  historyDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    marginVertical: 2,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  historyRowMain: {
    flex: 1,
    minWidth: 0,
  },
  historyRowTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
  },
  historyRowSubtitle: {
    fontSize: 11,
    fontWeight: fontWeight.regular,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  historyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  historyMetaText: {
    flex: 1,
    fontSize: 10,
  },
  historyChevronCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyMoreHint: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
    paddingVertical: 4,
  },
  historyEmptyText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  historyEmptyTextMuted: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  loginPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 1,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  loginPromptBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
});
