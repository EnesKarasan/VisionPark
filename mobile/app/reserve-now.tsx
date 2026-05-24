import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
  Platform,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CardBrandMark } from '@/components/CardBrandMark';
import { ParkingLotPanels, computeStatTileMetrics } from '@/components/ParkingLotPanels';
import { SectionHeader } from '@/components/SectionHeader';
import FlowProgress, { type FlowStep } from '../components/FlowProgress';
import { getCurrentUser, getPricing } from '../src/api';
import { useSpotFlowCheckoutExtras } from '../hooks/useSpotFlowCheckoutExtras';
import {
  SPOT_FLOW_COLUMNS,
  SPOT_FLOW_GAP,
  SECTION_TOTAL_DOT,
  formatCountdownMmSs,
  vehicleTitleSubtitle,
  cardTitleSubtitle,
  statsForSpots,
  sectionValueForPlan,
  formatMoneyAmount,
  groupSpotsBySection,
} from '../src/spotFlowUtils';
import { useAuth } from '../src/auth';
import { useParkingSpotFlowContext } from '../src/ParkingSpotFlowContext';
import type { Spot } from '../src/useParkingSpotFlow';
import { spacing, radius, fontSize, fontWeight, shadow } from '../constants/Theme';
import { isValidBbox } from '../constants/parkingLayout';

const AREAS_CARD_INNER_PAD = spacing.md;
const SERVICE_CARD_GAP = spacing.md;

const RESERVE_ACTION_MODE = 'reserve' as const;

/** Giriş yapmış kullanıcıda alan seçimi / onay için üst süre */
const RESERVE_NOW_IDLE_MS = 5 * 60 * 1000;

function endOfTodayLocal(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function defaultScheduledStart(): Date {
  const d = new Date(Date.now() + 15 * 60 * 1000);
  const end = endOfTodayLocal();
  if (d.getTime() > end.getTime()) {
    const x = new Date(end);
    x.setMinutes(x.getMinutes() - 5);
    return x;
  }
  return d;
}

function mergeTodayWithTime(hours: number, minutes: number): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function formatScheduleTr(d: Date): string {
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

type NativePickerProps = {
  value: Date;
  mode: 'time';
  display: 'default' | 'spinner';
  minimumDate: Date;
  maximumDate: Date;
  onChange: (event: { type?: string }, date?: Date) => void;
};

function NativeDateTimePicker(props: NativePickerProps) {
  if (Platform.OS === 'web') return null;
  const DateTimePicker = require('@react-native-community/datetimepicker').default as ComponentType<
    NativePickerProps
  >;
  return <DateTimePicker {...props} />;
}

export default function ReserveNowScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const params = useLocalSearchParams<{ suggestedSpotId?: string }>();

  const [scheduledDate, setScheduledDate] = useState(() => defaultScheduledStart());
  const [showLateEntryWarning, setShowLateEntryWarning] = useState(false);
  const [androidTimePicker, setAndroidTimePicker] = useState(false);
  const [submittingReserve, setSubmittingReserve] = useState(false);
  const [webTimeStr, setWebTimeStr] = useState(() => {
    const d = defaultScheduledStart();
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  });

  const [pendingSuggestedSpotId, setPendingSuggestedSpotId] = useState<number | null>(null);
  const [suggestionScrollNonce, setSuggestionScrollNonce] = useState(0);
  const [selectedSectionKey, setSelectedSectionKey] = useState<string>('Genel');
  const [idleTimeoutModalOpen, setIdleTimeoutModalOpen] = useState(false);
  const [idleDeadlineAt, setIdleDeadlineAt] = useState<number | null>(null);
  const [, setIdleCountdownPulse] = useState(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const planReadyForParkRef = useRef<boolean>(false);
  const {
    colors,
    spots,
    spotList,
    loading,
    refreshing,
    setRefreshing,
    load,
    activeSession,
    activeReservation,
    highlightSpotId,
    setHighlightSpotId,
    uiSelectedSpotId,
    setUiSelectedSpotId,
    handleSpotPress,
    handleCancelReservation,
    handleEndPark,
    showAlert,
    occupiedCount,
    setStartParkingPlate,
    setScheduledReservationStart,
    submitReserve,
  } = useParkingSpotFlowContext();

  const {
    vehicles,
    paymentCards,
    extrasLoading,
    extrasError,
    selectedVehicleId,
    setSelectedVehicleId,
    selectedCardId,
    setSelectedCardId,
    priceModalOpen,
    setPriceModalOpen,
    pricingInfo,
    setPricingInfo,
    pricingModalLoading,
    setPricingModalLoading,
    pricingModalError,
    setPricingModalError,
  } = useSpotFlowCheckoutExtras({ token, setStartParkingPlate });

  planReadyForParkRef.current = uiSelectedSpotId != null || activeReservation != null;

  const webTimeValid = useMemo(() => {
    if (Platform.OS !== 'web') return true;
    const parts = webTimeStr.split(':');
    if (parts.length !== 2) return false;
    const [hh, mm] = parts.map((x) => Number(x));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return false;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return false;
    return true;
  }, [webTimeStr]);

  const effectiveScheduled = useMemo(() => {
    if (Platform.OS === 'web') {
      const [hh, mm] = webTimeStr.split(':').map((x) => Number(x));
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) return defaultScheduledStart();
      return mergeTodayWithTime(hh, mm);
    }
    return scheduledDate;
  }, [webTimeStr, scheduledDate]);

  useEffect(() => {
    setScheduledReservationStart(effectiveScheduled);
    return () => setScheduledReservationStart(null);
  }, [effectiveScheduled, setScheduledReservationStart]);

  useFocusEffect(
    useCallback(() => {
      if (!token) {
        setShowLateEntryWarning(false);
        return;
      }
      let cancelled = false;
      void getCurrentUser(token)
        .then((u) => {
          if (!cancelled) setShowLateEntryWarning(!!u.show_late_entry_warning);
        })
        .catch(() => {
          if (!cancelled) setShowLateEntryWarning(false);
        });
      return () => {
        cancelled = true;
      };
    }, [token]),
  );

  const clearParkNowIdleTimer = useCallback(() => {
    if (idleTimerRef.current != null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    setIdleDeadlineAt(null);
  }, []);

  const spotsLoaded = !!spots;
  const hasActiveReservation = activeReservation != null;
  const hasSelectedSpot = uiSelectedSpotId != null;

  useFocusEffect(
    useCallback(() => {
      setIdleTimeoutModalOpen(false);
      if (!token || activeSession) {
        clearParkNowIdleTimer();
        return () => clearParkNowIdleTimer();
      }
      if (loading || !spotsLoaded) {
        clearParkNowIdleTimer();
        return () => clearParkNowIdleTimer();
      }
      if (hasSelectedSpot || hasActiveReservation) {
        clearParkNowIdleTimer();
        return () => clearParkNowIdleTimer();
      }
      clearParkNowIdleTimer();
      const deadline = Date.now() + RESERVE_NOW_IDLE_MS;
      setIdleDeadlineAt(deadline);
      idleTimerRef.current = setTimeout(() => {
        idleTimerRef.current = null;
        setIdleDeadlineAt(null);
        if (planReadyForParkRef.current) return;
        setIdleTimeoutModalOpen(true);
      }, RESERVE_NOW_IDLE_MS);
      return () => {
        clearParkNowIdleTimer();
      };
    }, [
      token,
      activeSession,
      loading,
      spotsLoaded,
      hasSelectedSpot,
      hasActiveReservation,
      clearParkNowIdleTimer,
    ]),
  );

  const navigateToParkEntryQr = useCallback(
    (spotId: number) => {
      clearParkNowIdleTimer();
      router.push({ pathname: '/park-entry-qr', params: { spotId: String(spotId) } });
    },
    [router, clearParkNowIdleTimer],
  );

  const onIdleTimeoutModalConfirm = useCallback(() => {
    setIdleTimeoutModalOpen(false);
    router.replace('/(tabs)');
  }, [router]);

  useEffect(() => {
    if (idleDeadlineAt == null) return;
    const id = setInterval(() => setIdleCountdownPulse((p) => p + 1), 1000);
    return () => clearInterval(id);
  }, [idleDeadlineAt]);

  const idleDisplaySec =
    idleDeadlineAt == null ? 0 : Math.max(0, Math.ceil((idleDeadlineAt - Date.now()) / 1000));

  const idleUrgency: 'safe' | 'warn' | 'danger' =
    idleDisplaySec > 120 ? 'safe' : idleDisplaySec > 60 ? 'warn' : 'danger';

  // Rezervasyon saatine kaç dakika kaldı
  const scheduledHintMin = useMemo(() => {
    const diff = effectiveScheduled.getTime() - Date.now();
    return Math.max(0, Math.round(diff / 60000));
  }, [effectiveScheduled]);

  // Akış adımı
  const flowStep: FlowStep = useMemo(() => {
    if (uiSelectedSpotId == null && activeReservation == null) return 'spot';
    if (token && (selectedVehicleId == null || selectedCardId == null)) return 'details';
    return 'summary';
  }, [uiSelectedSpotId, activeReservation, token, selectedVehicleId, selectedCardId]);

  const sectionGroups = useMemo(() => groupSpotsBySection(spotList), [spotList]);

  useEffect(() => {
    const keys = sectionGroups.map((g) => g.key);
    if (keys.length === 0) return;
    setSelectedSectionKey((prev) => (keys.includes(prev) ? prev : keys[0]));
  }, [sectionGroups]);

  const activeSection = useMemo(() => {
    return sectionGroups.find((g) => g.key === selectedSectionKey) ?? sectionGroups[0];
  }, [sectionGroups, selectedSectionKey]);

  const filteredSpots = activeSection?.spots ?? [];

  const sectionStatCounts = useMemo(() => {
    let available = 0;
    let occupied = 0;
    let reserved = 0;
    for (const s of filteredSpots) {
      if (s.is_occupied) occupied++;
      else if (s.is_reserved) reserved++;
      else available++;
    }
    return { available, occupied, reserved };
  }, [filteredSpots]);

  const sectionSpotsSummary = useMemo(() => {
    const { available, occupied, reserved } = sectionStatCounts;
    return `${available} boş · ${occupied} dolu · ${reserved} rezerve`;
  }, [sectionStatCounts]);

  const canUseMapLayout = useMemo(
    () => filteredSpots.length > 0 && filteredSpots.every((s) => isValidBbox(s.bbox)),
    [filteredSpots],
  );

  const layoutMetrics = useMemo(() => {
    const contentWidth = Math.max(280, windowWidth);
    const areasInnerWidth = contentWidth - AREAS_CARD_INNER_PAD * 2;
    const rawSpot = (areasInnerWidth - SPOT_FLOW_GAP * (SPOT_FLOW_COLUMNS - 1)) / SPOT_FLOW_COLUMNS;
    const spotSizeAreas = Math.max(44, rawSpot);
    const rawStatWidth = (contentWidth - 2 * SERVICE_CARD_GAP) / 3;
    const statCardSize = Math.min(200, Math.max(1, Math.floor(rawStatWidth)));
    const statCardRadius = Math.min(32, Math.round(statCardSize * 0.2));
    const statTile = computeStatTileMetrics(statCardSize);
    return {
      contentWidth,
      spotSizeAreas,
      statCardSize,
      statCardRadius,
      statTile,
    };
  }, [windowWidth]);

  const { contentWidth, spotSizeAreas, statCardSize, statCardRadius, statTile } = layoutMetrics;
  const pageBg = colors.surfaceAlt;
  const bottomPad = spacing.xl + insets.bottom;

  const effectiveSpotId = useMemo(() => {
    if (uiSelectedSpotId != null) return uiSelectedSpotId;
    if (activeReservation) return activeReservation.spot_id;
    return null;
  }, [uiSelectedSpotId, activeReservation]);

  const showReserveSubmitFooter = !!token && !activeSession;
  const scrollBottomPad = showReserveSubmitFooter ? spacing.lg + 56 + insets.bottom : bottomPad;

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? null;
  const selectedCard = paymentCards.find((c) => c.id === selectedCardId) ?? null;
  const selectedVehicleLines = selectedVehicle ? vehicleTitleSubtitle(selectedVehicle) : null;
  const selectedCardLines = selectedCard ? cardTitleSubtitle(selectedCard) : null;

  const areasCardTitle = activeSection?.label ?? '—';

  const spotsSummaryForPanel =
    spots?.parking_lot_name != null && String(spots.parking_lot_name).trim()
      ? `${spots.parking_lot_name} — ${sectionSpotsSummary}`
      : sectionSpotsSummary;

  const planParkingDisplay = useMemo(() => {
    if (activeSession?.spot_number) {
      const sid = activeSession.spot_id;
      const spot =
        sid != null
          ? spotList.find((s) => s.id === sid)
          : spotList.find((s) => s.spot_number === activeSession.spot_number);
      return {
        sectionValue: spot ? sectionValueForPlan(spot) : '—',
        spotNumber: activeSession.spot_number,
        hint: 'Aktif park oturumu',
      };
    }

    if (uiSelectedSpotId != null) {
      const spot = spotList.find((s) => s.id === uiSelectedSpotId);
      if (spot) {
        return {
          sectionValue: sectionValueForPlan(spot),
          spotNumber: spot.spot_number,
          hint: 'Seçili alan; alttan rezervasyonu tamamlayın',
        };
      }
    }

    if (activeReservation) {
      const spot = spotList.find((s) => s.id === activeReservation.spot_id);
      return {
        sectionValue: spot ? sectionValueForPlan(spot) : '—',
        spotNumber: activeReservation.spot_number,
        hint: 'Rezervasyonunuz var — giriş QR akışı uygulama güncellemesiyle eklenecek',
      };
    }

    return {
      sectionValue: null as string | null,
      spotNumber: null as string | null,
      hint: null as string | null,
    };
  }, [activeSession, activeReservation, uiSelectedSpotId, spotList]);

  useEffect(() => {
    if (!priceModalOpen) return;
    if (pricingInfo) return;
    let cancelled = false;
    setPricingModalLoading(true);
    setPricingModalError(null);
    void getPricing()
      .then((p) => {
        if (!cancelled) setPricingInfo(p);
      })
      .catch((e) => {
        if (!cancelled) {
          setPricingModalError((e as Error).message);
          setPricingInfo(null);
        }
      })
      .finally(() => {
        if (!cancelled) setPricingModalLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [priceModalOpen, pricingInfo]);

  useEffect(() => {
    if (uiSelectedSpotId == null) return;
    if (!filteredSpots.some((s) => s.id === uiSelectedSpotId)) {
      setUiSelectedSpotId(null);
    }
  }, [filteredSpots, uiSelectedSpotId, setUiSelectedSpotId]);

  useEffect(() => {
    const raw = params.suggestedSpotId;
    if (raw == null || raw === '') return;
    const sid = typeof raw === 'string' ? Number(raw) : Number(raw);
    if (!Number.isFinite(sid)) return;
    setPendingSuggestedSpotId(sid);
  }, [params.suggestedSpotId]);

  useEffect(() => {
    if (suggestionScrollNonce === 0) return;
    if (token && extrasLoading) return;
    const t = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 160);
    return () => clearTimeout(t);
  }, [suggestionScrollNonce, token, extrasLoading]);

  useEffect(() => {
    if (pendingSuggestedSpotId == null) return;
    if (!spots?.spots?.length) return;

    const sid = pendingSuggestedSpotId;
    const spot = spots.spots.find((s) => s.id === sid);
    setPendingSuggestedSpotId(null);

    if (!spot) return;
    if (spot.is_occupied || spot.is_reserved) {
      showAlert('Uyarı', 'Seçilen alan artık müsait değil. Başka bir alan seçin.');
      return;
    }

    const sec = spot.section?.trim() || 'Genel';
    setSelectedSectionKey(sec);
    setHighlightSpotId(null);
    if (token && !activeSession) {
      setUiSelectedSpotId(sid);
    } else if (!token) {
      setHighlightSpotId(sid);
    }

    setSuggestionScrollNonce((n) => n + 1);
  }, [
    pendingSuggestedSpotId,
    spots,
    token,
    activeSession,
    showAlert,
    setHighlightSpotId,
    setUiSelectedSpotId,
  ]);

  if (loading && !spots) {
    return (
      <View style={[styles.centered, { backgroundColor: pageBg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Yükleniyor...</Text>
      </View>
    );
  }

  const prependInsideAreasCard = (
    <>
      {sectionGroups.length === 0 ? (
        <Text style={[styles.muted, { color: colors.textSecondary, marginTop: spacing.sm }]}>
          Henüz park yeri tanımlı değil.
        </Text>
      ) : (
        <>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.sectionChipScrollContent}
          >
            {sectionGroups.map((g) => {
              const sel = g.key === selectedSectionKey;
              const st = statsForSpots(g.spots);
              return (
                <TouchableOpacity
                  key={g.key}
                  style={[
                    styles.sectionChip,
                    {
                      borderColor: sel ? colors.secondary : colors.border,
                      backgroundColor: sel ? colors.secondary : colors.surface,
                    },
                  ]}
                  onPress={() => setSelectedSectionKey(g.key)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sel }}
                  accessibilityLabel={`${g.label}, toplam ${st.total} alan, ${st.available} boş, ${st.occupied} dolu${st.reserved > 0 ? `, ${st.reserved} rezerve` : ''}`}
                >
                  <Text
                    style={[
                      styles.sectionChipTitle,
                      { color: sel ? '#ffffff' : colors.text },
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {g.label}
                  </Text>
                  <View style={styles.sectionChipDotsRow}>
                    <View style={styles.sectionChipDotItem}>
                      <View
                        style={[
                          styles.sectionChipDot,
                          {
                            backgroundColor: sel ? 'rgba(255,255,255,0.92)' : SECTION_TOTAL_DOT,
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.sectionChipDotNum,
                          { color: sel ? '#ffffff' : colors.text },
                        ]}
                      >
                        {st.total}
                      </Text>
                    </View>
                    <View style={styles.sectionChipDotItem}>
                      <View style={[styles.sectionChipDot, { backgroundColor: colors.spotFree }]} />
                      <Text
                        style={[
                          styles.sectionChipDotNum,
                          { color: sel ? '#ffffff' : colors.text },
                        ]}
                      >
                        {st.available}
                      </Text>
                    </View>
                    <View style={styles.sectionChipDotItem}>
                      <View style={[styles.sectionChipDot, { backgroundColor: colors.spotOccupied }]} />
                      <Text
                        style={[
                          styles.sectionChipDotNum,
                          { color: sel ? '#ffffff' : colors.text },
                        ]}
                      >
                        {st.occupied}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      )}

      {filteredSpots.length === 0 && spotList.length > 0 ? (
        <View
          style={[
            styles.emptyBanner,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.muted, { color: colors.textSecondary }]}>
            Bu bölümde park yeri yok. Başka bir bölüm seçin.
          </Text>
        </View>
      ) : null}
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: pageBg }]}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollFlex}
        contentContainerStyle={[styles.listContent, { paddingBottom: scrollBottomPad }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {token && !activeSession ? <FlowProgress current={flowStep} mode="reserve" /> : null}

        <View style={[styles.pageTitleInset, styles.pageTitleInsetFirst]}>
          <SectionHeader title="Park yerleri" flush />
        </View>

        <ParkingLotPanels
          actionMode={RESERVE_ACTION_MODE}
          areasSubtitleMode="parkNow"
          spots={spots}
          spotList={filteredSpots}
          canUseMapLayout={canUseMapLayout}
          occupiedCount={occupiedCount}
          spotsSummary={spotsSummaryForPanel}
          areasCardTitle={areasCardTitle}
          layoutContentWidth={contentWidth}
          prependInsideAreasCard={prependInsideAreasCard}
          plainCards
          mapHeaderTitle={areasCardTitle}
          showAreasSubtitle={false}
          showAreasLegend={false}
          showSummaryStats={false}
          statCardSize={statCardSize}
          statCardRadius={statCardRadius}
          statTile={statTile}
          spotSizeAreas={spotSizeAreas}
          highlightSpotId={highlightSpotId}
          uiSelectedSpotId={uiSelectedSpotId}
          activeSession={activeSession}
          activeReservation={activeReservation}
          onSpotPress={(spot) => handleSpotPress(spot, RESERVE_ACTION_MODE)}
          onEndPark={handleEndPark}
          onStartParkFromReservation={(spotId) => navigateToParkEntryQr(spotId)}
          onCancelReservation={handleCancelReservation}
        />

        {token && !activeSession ? (
          <View style={styles.blockBelowParking}>
            <View style={styles.pageTitleInset}>
              <SectionHeader title="Rezervasyon saati" flush />
            </View>
            <View style={[styles.formCardInset, { marginBottom: spacing.md }]}>
              <View
                style={[
                  styles.planSummaryCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  shadow.sm,
                ]}
              >
                <Text style={[styles.muted, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                  Bugün için planladığınız giriş saatini seçin. Rezervasyon saatinizden önce gelebilirsiniz.
                </Text>
                {showLateEntryWarning ? (
                  <View
                    style={[
                      styles.lateWarningBanner,
                      { backgroundColor: colors.dangerLight, borderColor: colors.danger, marginBottom: spacing.sm },
                    ]}
                  >
                    <Ionicons name="warning-outline" size={22} color={colors.danger} />
                    <Text style={[styles.lateWarningText, { color: colors.danger }]}>
                      Daha önce rezervasyon saatinizi 10 dakikayı aşan gecikmeyle kaçırdınız. Aynı ihlali
                      tekrarlarsanız hesabınız kalıcı olarak silinir.
                    </Text>
                  </View>
                ) : null}
                {Platform.OS === 'web' ? (
                  <>
                    <TextInput
                      value={webTimeStr}
                      onChangeText={setWebTimeStr}
                      placeholder="SS:DD"
                      style={[
                        styles.webTimeInput,
                        {
                          color: colors.text,
                          borderColor: webTimeValid ? colors.border : colors.danger,
                          backgroundColor: colors.inputBg,
                        },
                      ]}
                    />
                    {!webTimeValid ? (
                      <Text style={[styles.muted, { color: colors.danger, marginTop: spacing.xs }]}>
                        Geçerli bir saat girin (örn. 14:30)
                      </Text>
                    ) : null}
                  </>
                ) : Platform.OS === 'ios' ? (
                  <NativeDateTimePicker
                    value={scheduledDate}
                    mode="time"
                    display="spinner"
                    minimumDate={new Date()}
                    maximumDate={endOfTodayLocal()}
                    onChange={(_, date) => {
                      if (date) setScheduledDate(date);
                    }}
                  />
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.timePickBtn, { borderColor: colors.brandDeep, backgroundColor: colors.inputBg }]}
                      onPress={() => setAndroidTimePicker(true)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel="Rezervasyon saatini seç"
                    >
                      <Ionicons name="time-outline" size={22} color={colors.brandDeep} />
                      <Text style={[styles.timePickBtnText, { color: colors.brandDeep }]}>
                        {formatScheduleTr(scheduledDate)}
                      </Text>
                    </TouchableOpacity>
                    {androidTimePicker ? (
                      <NativeDateTimePicker
                        value={scheduledDate}
                        mode="time"
                        display="default"
                        minimumDate={new Date()}
                        maximumDate={endOfTodayLocal()}
                        onChange={(_ev, date) => {
                          setAndroidTimePicker(false);
                          if (date) setScheduledDate(date);
                        }}
                      />
                    ) : null}
                  </>
                )}
              </View>
            </View>
          </View>
        ) : null}

        {token && extrasLoading ? (
          <ActivityIndicator style={styles.formLoader} color={colors.primary} />
        ) : null}

        {token && extrasError ? (
          <Text style={[styles.errorText, { color: colors.danger, marginHorizontal: spacing.md }]}>
            {extrasError}
          </Text>
        ) : null}

        {!token ? (
          <View style={styles.blockBelowParking}>
            <View style={[styles.formCard, styles.formCardInset, { backgroundColor: colors.surface }]}>
              <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>Giriş</Text>
              <Text style={[styles.muted, { color: colors.textSecondary }]}>
                Park başlatmak ve plaka seçmek için giriş yapın. Yukarıdan otoparkı inceleyebilirsiniz.
              </Text>
            </View>
          </View>
        ) : (
          <>
            {idleDeadlineAt != null && !idleTimeoutModalOpen ? (
              <View style={styles.blockBelowParking}>
                <View style={[styles.formCardInset, { marginBottom: spacing.md }]}>
                  <View
                    style={[
                      styles.idleCountdownCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor:
                          idleUrgency === 'danger'
                            ? colors.danger
                            : idleUrgency === 'warn'
                              ? colors.warning
                              : colors.border,
                      },
                      shadow.sm,
                    ]}
                  >
                    <View
                      style={[
                        styles.idleCountdownIconWrap,
                        {
                          backgroundColor:
                            idleUrgency === 'danger'
                              ? colors.dangerLight
                              : idleUrgency === 'warn'
                                ? colors.warningLight
                                : colors.successLight,
                          borderColor:
                            idleUrgency === 'danger'
                              ? colors.danger
                              : idleUrgency === 'warn'
                                ? colors.warning
                                : colors.success,
                        },
                      ]}
                    >
                      <Ionicons
                        name="timer-outline"
                        size={26}
                        color={
                          idleUrgency === 'danger'
                            ? colors.danger
                            : idleUrgency === 'warn'
                              ? colors.warningDark
                              : colors.successDark
                        }
                      />
                    </View>
                    <View style={styles.idleCountdownTextCol}>
                      <Text style={[styles.fieldLabel, { color: colors.textTertiary, marginBottom: 4 }]}>
                        İşlem süresi
                      </Text>
                      <Text
                        style={[
                          styles.idleCountdownTime,
                          {
                            color:
                              idleUrgency === 'danger'
                                ? colors.danger
                                : idleUrgency === 'warn'
                                  ? colors.warningDark
                                  : colors.text,
                          },
                        ]}
                      >
                        {formatCountdownMmSs(idleDisplaySec)}
                      </Text>
                      <Text style={[styles.muted, { color: colors.textSecondary }]}>
                        {idleUrgency === 'danger'
                          ? 'Süreniz dolmak üzere! Hemen alan seçin veya rezervasyonu tamamlayın.'
                          : 'Alan seçin veya rezervasyonu tamamlayın; süre dolunca ana sayfaya yönlendirilirsiniz.'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ) : null}

            <View style={styles.blockBelowParking}>
              <View style={styles.pageTitleInset}>
                <SectionHeader title="Araç" flush />
              </View>
              <View style={[styles.formCardInset, { marginBottom: spacing.md }]}>
                <View style={[styles.pickerSummaryCard, { backgroundColor: colors.inputBg }]}>
                  <View
                    style={[
                      styles.pickerPaymentCardFace,
                      { backgroundColor: '#ffffff', borderColor: colors.border },
                      shadow.sm,
                    ]}
                  >
                    <Ionicons name="car-outline" size={24} color={colors.brandDeep} />
                  </View>
                  <View style={styles.pickerSummaryTextCol}>
                    {selectedVehicleLines ? (
                      <>
                        <Text
                          style={[styles.pickerSummaryTitleStrong, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {selectedVehicleLines.title}
                        </Text>
                        {selectedVehicleLines.subtitle ? (
                          <Text
                            style={[styles.pickerSummarySub, { color: colors.textSecondary }]}
                            numberOfLines={1}
                          >
                            {selectedVehicleLines.subtitle}
                          </Text>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <Text
                          style={[styles.pickerSummaryTitleStrong, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          Araç seçilmedi
                        </Text>
                        <Text
                          style={[styles.pickerSummarySub, { color: colors.textSecondary }]}
                          numberOfLines={2}
                        >
                          Kayıtlı araç yok. Değiştir ile ekleyebilirsiniz.
                        </Text>
                      </>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.pickerChangeBtn, { borderColor: colors.brandDeep }]}
                    onPress={() => router.push('/my-cars')}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Araç değiştir"
                  >
                    <Text style={[styles.pickerChangeBtnText, { color: colors.brandDeep }]}>Değiştir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.blockBelowParking}>
              <View style={styles.pageTitleInset}>
                <SectionHeader title="Ödeme Yöntemi" flush />
              </View>
              <View style={[styles.formCardInset, { marginBottom: spacing.md }]}>
                <View style={[styles.pickerSummaryCard, { backgroundColor: colors.inputBg }]}>
                  <View
                    style={[
                      styles.pickerPaymentCardFace,
                      { backgroundColor: '#ffffff', borderColor: colors.border },
                      shadow.sm,
                    ]}
                  >
                    {selectedCard ? (
                      <CardBrandMark brand={selectedCard.brand} size={26} fallbackIconColor={colors.brandDeep} />
                    ) : (
                      <Ionicons name="card-outline" size={22} color={colors.brandDeep} />
                    )}
                  </View>
                  <View style={styles.pickerSummaryTextCol}>
                    {selectedCardLines ? (
                      <>
                        <Text
                          style={[styles.pickerSummaryTitleStrong, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {selectedCardLines.title}
                        </Text>
                        {selectedCardLines.subtitle ? (
                          <Text
                            style={[styles.pickerSummarySub, { color: colors.textSecondary }]}
                            numberOfLines={1}
                          >
                            {selectedCardLines.subtitle}
                          </Text>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <Text
                          style={[styles.pickerSummaryTitleStrong, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          Kart seçilmedi
                        </Text>
                        <Text
                          style={[styles.pickerSummarySub, { color: colors.textSecondary }]}
                          numberOfLines={2}
                        >
                          Kayıtlı kart yok. Değiştir ile ekleyebilirsiniz.
                        </Text>
                      </>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.pickerChangeBtn, { borderColor: colors.brandDeep }]}
                    onPress={() => router.push('/payment-cards')}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Ödeme yöntemini değiştir"
                  >
                    <Text style={[styles.pickerChangeBtnText, { color: colors.brandDeep }]}>Değiştir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.blockBelowParking}>
              <View style={styles.pageTitleInset}>
                <SectionHeader title="Plan Özeti" flush />
              </View>
              <View style={[styles.formCardInset, { marginBottom: spacing.md }]}>
                <View
                  style={[
                    styles.planSummaryCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.planSummaryRow}>
                    <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>Araç</Text>
                    {selectedVehicleLines ? (
                      <>
                        <Text
                          style={[styles.planSummaryRowTitle, { color: colors.text }]}
                          numberOfLines={2}
                        >
                          {selectedVehicleLines.title}
                        </Text>
                        {selectedVehicleLines.subtitle ? (
                          <Text
                            style={[styles.planSummaryRowSub, { color: colors.textSecondary }]}
                            numberOfLines={1}
                          >
                            {selectedVehicleLines.subtitle}
                          </Text>
                        ) : null}
                      </>
                    ) : (
                      <Text style={[styles.planSummaryRowSub, { color: colors.textSecondary }]}>
                        Kayıtlı araç yok
                      </Text>
                    )}
                  </View>

                  <View style={[styles.planSummaryDivider, { backgroundColor: colors.border }]} />

                  <View style={styles.planSummaryRow}>
                    <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>Ödeme</Text>
                    {selectedCardLines ? (
                      <>
                        <Text
                          style={[styles.planSummaryRowTitle, { color: colors.text }]}
                          numberOfLines={2}
                        >
                          {selectedCardLines.title}
                        </Text>
                        {selectedCardLines.subtitle ? (
                          <Text
                            style={[styles.planSummaryRowSub, { color: colors.textSecondary }]}
                            numberOfLines={1}
                          >
                            {selectedCardLines.subtitle}
                          </Text>
                        ) : null}
                      </>
                    ) : (
                      <Text style={[styles.planSummaryRowSub, { color: colors.textSecondary }]}>
                        Kayıtlı ödeme yöntemi yok
                      </Text>
                    )}
                  </View>

                  <View style={[styles.planSummaryDivider, { backgroundColor: colors.border }]} />

                  <View style={styles.planSummaryRow}>
                    <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>Park alanı</Text>
                    {planParkingDisplay.spotNumber ? (
                      <>
                        <View style={styles.planParkingKVRow}>
                          <Text style={[styles.planParkingKVLabel, { color: colors.textTertiary }]}>
                            Bölüm
                          </Text>
                          <Text
                            style={[styles.planParkingKVValue, { color: colors.text }]}
                            numberOfLines={1}
                          >
                            {planParkingDisplay.sectionValue ?? '—'}
                          </Text>
                        </View>
                        <View style={styles.planParkingKVRow}>
                          <Text style={[styles.planParkingKVLabel, { color: colors.textTertiary }]}>
                            Alan
                          </Text>
                          <Text
                            style={[styles.planParkingKVValue, { color: colors.text }]}
                            numberOfLines={1}
                          >
                            {planParkingDisplay.spotNumber}
                          </Text>
                        </View>
                        {planParkingDisplay.hint ? (
                          <Text
                            style={[styles.planSummaryRowSub, { color: colors.textSecondary }]}
                            numberOfLines={2}
                          >
                            {planParkingDisplay.hint}
                          </Text>
                        ) : null}
                      </>
                    ) : (
                      <Text style={[styles.planSummaryRowSub, { color: colors.textSecondary }]}>
                        Yukarıdan boş bir alan seçin
                      </Text>
                    )}
                  </View>

                  <View style={[styles.planSummaryDivider, { backgroundColor: colors.border }]} />

                  <View style={styles.planSummaryRow}>
                    <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>Rezervasyon saati</Text>
                    <Text style={[styles.planSummaryRowTitle, { color: colors.text }]}>
                      {formatScheduleTr(effectiveScheduled)}
                      {scheduledHintMin > 0 ? (
                        <Text style={[styles.planSummaryRowSub, { color: colors.primary, marginTop: 0 }]}>
                          {'   '}· {scheduledHintMin < 60 ? `${scheduledHintMin} dk sonra` : `${Math.floor(scheduledHintMin / 60)} sa ${scheduledHintMin % 60} dk sonra`}
                        </Text>
                      ) : null}
                    </Text>
                    <Text style={[styles.planSummaryRowSub, { color: colors.textSecondary }]}>
                      Giriş için son tarih: rezervasyon saatinden itibaren 10 dakika
                    </Text>
                  </View>

                  <View style={[styles.planSummaryDivider, { backgroundColor: colors.border }]} />

                  <View style={styles.planSummaryRow}>
                    <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>Fiyat</Text>
                    <Text style={[styles.planSummaryRowSub, { color: colors.textSecondary, marginTop: 0 }]}>
                      İlk dakikalar ücretsiz; sonrası toplam süreye göre tarife diliminden sabit tutar alınır.
                    </Text>
                    <TouchableOpacity
                      style={[styles.planPriceBtn, { borderColor: colors.brandDeep }]}
                      onPress={() => setPriceModalOpen(true)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel="Fiyat listesini aç"
                    >
                      <Text style={[styles.planPriceBtnText, { color: colors.brandDeep }]}>
                        Fiyat listesini gör
                      </Text>
                      <Ionicons name="receipt-outline" size={20} color={colors.brandDeep} />
                    </TouchableOpacity>
                  </View>

                  <View
                    style={[
                      styles.planQrWarning,
                      {
                        backgroundColor: colors.warningLight,
                        borderColor: colors.warning,
                      },
                    ]}
                  >
                    <Ionicons name="information-circle-outline" size={22} color={colors.warningDark} />
                    <Text style={[styles.planQrWarningText, { color: colors.warningDark }]}>
                      Rezervasyon saatinizden önce otoparka girebilirsiniz. Rezervasyon saatinden itibaren en geç 10
                      dakika içinde giriş QR’ı okutulmazsa ihlal sayılır; ilk ihlalde uyarı alırsınız, ikinci ihlalde
                      hesabınız silinir. Giriş QR’ı bu sürümde hemen gösterilmez; akış ayrıca güncellenecektir.
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {showReserveSubmitFooter ? (
        <View
          style={[
            styles.entryQrFooter,
            {
              paddingBottom: spacing.sm + insets.bottom,
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
            },
          ]}
        >
          {effectiveSpotId != null ? (
            <TouchableOpacity
              style={[
                styles.entryQrFooterBtn,
                { backgroundColor: colors.brandDeep, opacity: submittingReserve ? 0.65 : 1 },
              ]}
              disabled={submittingReserve}
              onPress={() => {
                if (!webTimeValid) {
                  showAlert('Uyarı', 'Lütfen geçerli bir saat girin (örn. 14:30).');
                  return;
                }
                if (effectiveScheduled.getTime() <= Date.now()) {
                  showAlert('Uyarı', 'Rezervasyon saati gelecekte olmalıdır.');
                  return;
                }
                if (!vehicles.length) {
                  showAlert('Uyarı', 'Önce kayıtlı bir araç ekleyin.');
                  return;
                }
                if (!paymentCards.length) {
                  showAlert('Uyarı', 'Önce kayıtlı bir ödeme yöntemi ekleyin.');
                  return;
                }
                setSubmittingReserve(true);
                void (async () => {
                  try {
                    const ok = await submitReserve(effectiveSpotId);
                    if (ok) router.back();
                  } finally {
                    setSubmittingReserve(false);
                  }
                })();
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Rezervasyonu oluştur"
            >
              {submittingReserve ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.entryQrFooterBtnText}>Rezervasyonu oluştur</Text>
              )}
            </TouchableOpacity>
          ) : (
            <Text style={[styles.entryQrFooterHint, { color: colors.textSecondary }]}>
              Önce bir alan seçin; ardından rezervasyonu tamamlayın.
            </Text>
          )}
        </View>
      ) : null}

      <Modal
        visible={priceModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setPriceModalOpen(false)}
      >
        <View style={styles.priceModalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPriceModalOpen(false)}
            accessibilityLabel="Kapat"
          />
          <View
            style={[
              styles.priceModalCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              shadow.md,
            ]}
            accessibilityViewIsModal
          >
            <View style={styles.priceModalHeader}>
              <Text style={[styles.priceModalTitle, { color: colors.text }]}>Fiyat listesi</Text>
              <Pressable
                onPress={() => setPriceModalOpen(false)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Kapat"
                style={({ pressed }) => [
                  styles.priceModalCloseHit,
                  { backgroundColor: pressed ? colors.surfaceAlt : 'transparent' },
                ]}
              >
                <Ionicons name="close" size={26} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={[styles.priceModalSubtitle, { color: colors.textSecondary }]}>
              İlk ücretsiz dakikadan sonra toplam park süresine göre sabit tutar uygulanır; kesin tutar çıkışta
              netleşir.
            </Text>
            {pricingModalLoading ? (
              <ActivityIndicator style={styles.priceModalLoader} color={colors.primary} />
            ) : pricingModalError ? (
              <Text style={[styles.muted, { color: colors.danger }]}>{pricingModalError}</Text>
            ) : pricingInfo ? (
              <ScrollView
                style={styles.priceModalScroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {(() => {
                  const cur = pricingInfo.currency?.trim() || 'TRY';
                  return (
                    <>
                      <View style={styles.priceModalRow}>
                        <Text style={[styles.priceModalRowLabel, { color: colors.textSecondary }]}>
                          Ücretsiz süre
                        </Text>
                        <Text style={[styles.priceModalRowValue, { color: colors.text }]}>
                          {pricingInfo.free_minutes} dakika
                        </Text>
                      </View>
                      {pricingInfo.brackets.map((b) => (
                        <View key={b.label} style={styles.priceModalRow}>
                          <Text style={[styles.priceModalRowLabel, { color: colors.textSecondary }]}>{b.label}</Text>
                          <Text style={[styles.priceModalRowValue, { color: colors.text }]}>
                            {formatMoneyAmount(b.price, cur)}
                          </Text>
                        </View>
                      ))}
                    </>
                  );
                })()}
              </ScrollView>
            ) : (
              <Text style={[styles.muted, { color: colors.textSecondary }]}>Ücret bilgisi yok.</Text>
            )}
            <TouchableOpacity
              style={[styles.priceModalDoneBtn, { backgroundColor: colors.brandDeep }]}
              onPress={() => setPriceModalOpen(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.priceModalDoneBtnText}>Tamam</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={idleTimeoutModalOpen}
        animationType="fade"
        transparent
        onRequestClose={onIdleTimeoutModalConfirm}
      >
        <View style={styles.priceModalBackdrop}>
          <View
            style={[
              styles.priceModalCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              shadow.md,
            ]}
            accessibilityViewIsModal
          >
            <Text style={[styles.priceModalTitle, { color: colors.text }]}>Süre doldu</Text>
            <Text style={[styles.priceModalSubtitle, { color: colors.textSecondary }]}>
              5 dakika içinde park yeri seçilmedi veya rezervasyon tamamlanmadı. Ana sayfaya yönlendiriliyorsunuz.
            </Text>
            <TouchableOpacity
              style={[styles.priceModalDoneBtn, { backgroundColor: colors.brandDeep }]}
              onPress={onIdleTimeoutModalConfirm}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Tamam"
            >
              <Text style={styles.priceModalDoneBtnText}>Tamam</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollFlex: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: spacing.md, fontSize: fontSize.sm },
  listContent: { width: '100%', alignSelf: 'stretch' },
  pageTitleInset: { paddingHorizontal: spacing.md, marginTop: spacing.lg },
  pageTitleInsetFirst: { marginTop: spacing.sm },

  sectionChipScrollContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingRight: spacing.md,
  },
  sectionChip: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minWidth: 118,
    maxWidth: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionChipTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    width: '100%',
  },
  sectionChipDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    width: '100%',
  },
  sectionChipDotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sectionChipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  sectionChipDotNum: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    fontVariant: ['tabular-nums'],
  },

  emptyBanner: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  formCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  formCardInset: {
    marginHorizontal: spacing.md,
  },
  blockBelowParking: {
    marginTop: spacing.sm,
  },
  formLoader: { marginVertical: spacing.md },
  /** ISO kart oranı (~1,586) — özet satırı (araç / ödeme) */
  pickerPaymentCardFace: {
    width: 58,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  pickerSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  pickerChangeBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginLeft: spacing.md,
    flexShrink: 0,
  },
  pickerChangeBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  pickerSummaryTextCol: { flex: 1, minWidth: 0 },
  pickerSummaryTitleStrong: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  pickerSummarySub: {
    fontSize: fontSize.sm,
    marginTop: 4,
    fontWeight: fontWeight.regular,
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  muted: { fontSize: fontSize.sm, lineHeight: 20 },
  errorText: { fontSize: fontSize.sm, marginBottom: spacing.sm },

  planSummaryCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  planSummaryRow: { gap: 4 },
  planSummaryRowTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  planSummaryRowSub: { fontSize: fontSize.sm, marginTop: 2 },
  planSummaryDivider: { height: StyleSheet.hairlineWidth, marginVertical: spacing.md },
  planParkingKVRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  planParkingKVLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    flexShrink: 0,
  },
  planParkingKVValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    flex: 1,
    textAlign: 'right',
  },
  planPriceBtn: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  planPriceBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, flex: 1 },
  planQrWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  planQrWarningText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, flex: 1, lineHeight: 20 },

  priceModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  priceModalCard: {
    zIndex: 1,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
  priceModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  priceModalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, flex: 1 },
  priceModalCloseHit: { borderRadius: radius.md, padding: spacing.xs },
  priceModalSubtitle: { fontSize: fontSize.sm, lineHeight: 20, marginBottom: spacing.md },
  priceModalLoader: { marginVertical: spacing.lg },
  priceModalScroll: { maxHeight: 380 },
  priceModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.35)',
  },
  priceModalRowLabel: { fontSize: fontSize.sm, flex: 1 },
  priceModalRowValue: { fontSize: fontSize.md, fontWeight: fontWeight.bold, textAlign: 'right' },
  priceModalDoneBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  priceModalDoneBtnText: { color: '#ffffff', fontSize: fontSize.md, fontWeight: fontWeight.semibold },

  entryQrFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  entryQrFooterBtn: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  entryQrFooterBtnText: {
    color: '#ffffff',
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  entryQrFooterHint: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
  },

  idleCountdownCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  idleCountdownIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idleCountdownTextCol: { flex: 1, minWidth: 0 },
  idleCountdownTime: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  lateWarningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    marginBottom: spacing.md,
  },
  lateWarningText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, flex: 1, lineHeight: 20 },
  timePickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  timePickBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  webTimeInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    minWidth: 120,
    maxWidth: 160,
  },
});
