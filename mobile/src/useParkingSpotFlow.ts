import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { usePathname } from 'expo-router';

import { useAuth } from './auth';
import {
  getSpots,
  startParking,
  endParking,
  getActiveSession,
  createReservation,
  cancelReservation,
  getActiveReservation,
  type SpotsSummary,
  type ParkingSpotRow,
} from './api';
import type { ThemeColors } from '../constants/Theme';
import { useTheme } from '../constants/useTheme';

export type Spot = ParkingSpotRow;

export type SpotStatus = 'available' | 'occupied' | 'reserved';

export type ActionMode = 'none' | 'park' | 'reserve';

export interface ActiveReservation {
  id: number;
  spot_id: number;
  spot_number: string;
  expires_at: string;
  scheduled_start_at?: string | null;
  entry_deadline_at?: string | null;
}

function isParkingFlowRoute(pathname: string): boolean {
  if (pathname === '/park-now' || pathname.endsWith('/park-now')) return true;
  if (pathname === '/reserve-now' || pathname.endsWith('/reserve-now')) return true;
  if (pathname === '/park-entry-qr' || pathname.endsWith('/park-entry-qr')) return true;
  if (pathname === '/park-exit-qr' || pathname.endsWith('/park-exit-qr')) return true;
  if (pathname === '/parking-detail' || pathname.endsWith('/parking-detail')) return true;
  const parts = pathname.replace(/\/$/, '').split('/').filter(Boolean);
  return parts[parts.length - 1] === 'parking';
}

export function isParkNowPath(pathname: string): boolean {
  return pathname === '/park-now' || pathname.endsWith('/park-now');
}

export function isReserveNowPath(pathname: string): boolean {
  return pathname === '/reserve-now' || pathname.endsWith('/reserve-now');
}

/** Hemen Park Et: henüz park başlamadan kullanıcının seçtiği hücre (boş veya kendi rezervasyonu). */
export function isParkNowPlanPickCell(
  item: Spot,
  status: SpotStatus,
  uiSelectedSpotId: number | null,
  activeReservation: ActiveReservation | null,
): boolean {
  if (uiSelectedSpotId == null || item.id !== uiSelectedSpotId) return false;
  if (status === 'available') return true;
  return status === 'reserved' && activeReservation?.spot_id === item.id;
}

export type UseParkingSpotFlowResult = {
  colors: ThemeColors;
  spots: SpotsSummary | null;
  spotList: Spot[];
  loading: boolean;
  refreshing: boolean;
  setRefreshing: (v: boolean) => void;
  load: () => Promise<void>;
  activeSession: {
    id: number;
    spot_id?: number;
    spot_number: string;
    started_at?: string;
  } | null;
  activeReservation: ActiveReservation | null;
  highlightSpotId: number | null;
  setHighlightSpotId: (id: number | null) => void;
  handleSpotPress: (spot: Spot, actionMode: ActionMode) => void;
  handleStartPark: (spotId: number) => Promise<boolean>;
  /** Park başlatırken API’ye gönderilecek plaka (ör. park-now ekranında seçilen araç). */
  setStartParkingPlate: (plate: string | null) => void;
  /** Mevcut "sıradaki park" için seçilmiş plaka (QR akışında intent'e gönderilir). */
  getStartParkingPlate: () => string | null;
  handleCancelReservation: () => void;
  /** Planlı rezervasyon için seçilen saat (reserve-now ekranında ayarlanır). */
  setScheduledReservationStart: (d: Date | null) => void;
  /** reserve-now: alan + saat ile rezervasyon oluşturur. */
  submitReserve: (spotId: number) => Promise<boolean>;
  handleEndPark: () => void;
  getSpotStatus: (item: Spot) => SpotStatus;
  getSpotBgColor: (item: Spot, status: SpotStatus) => string;
  showAlert: (title: string, message: string) => void;
  confirmAction: (
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
  ) => void;
  uiSelectedSpotId: number | null;
  setUiSelectedSpotId: (id: number | null) => void;
  occupiedCount: number;
  spotsSummary: string;
};

export function useParkingSpotFlow(): UseParkingSpotFlowResult {
  const { token } = useAuth();
  const colors = useTheme();
  const pathname = usePathname();

  const [spots, setSpots] = useState<SpotsSummary | null>(null);
  const [activeSession, setActiveSession] = useState<{
    id: number;
    spot_id?: number;
    spot_number: string;
    started_at?: string;
  } | null>(null);
  const [activeReservation, setActiveReservation] = useState<ActiveReservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [highlightSpotId, setHighlightSpotId] = useState<number | null>(null);
  const [uiSelectedSpotId, setUiSelectedSpotId] = useState<number | null>(null);
  const plateForNextParkRef = useRef<string | null>(null);
  const reservationScheduledStartRef = useRef<Date | null>(null);

  const setScheduledReservationStart = useCallback((d: Date | null) => {
    reservationScheduledStartRef.current = d;
  }, []);

  const setStartParkingPlate = useCallback((plate: string | null) => {
    plateForNextParkRef.current = plate?.trim() ? plate.trim() : null;
  }, []);

  const getStartParkingPlate = useCallback(() => plateForNextParkRef.current, []);

  const load = useCallback(async () => {
    try {
      const [spotsData, session, reservation] = await Promise.all([
        getSpots(),
        token ? getActiveSession(token) : null,
        token ? getActiveReservation(token) : null,
      ]);
      setSpots(spotsData);
      setActiveSession(session);
      setActiveReservation(reservation);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  const pollingActive = useMemo(() => isParkingFlowRoute(pathname ?? ''), [pathname]);

  useEffect(() => {
    if (!pollingActive) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void load();
    // 12 saniye: canlı doluluk için yeterli, pil ve mobil veri için makul
    const id = setInterval(load, 12000);
    return () => clearInterval(id);
  }, [pollingActive, load]);

  const showAlert = useCallback((title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  }, []);

  const confirmAction = useCallback(
    (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => {
      if (Platform.OS === 'web') {
        if (window.confirm(`${title}\n${message}`)) onConfirm();
        else onCancel?.();
      } else {
        Alert.alert(title, message, [
          { text: 'İptal', style: 'cancel', onPress: () => onCancel?.() },
          { text: 'Tamam', onPress: onConfirm },
        ]);
      }
    },
    [],
  );

  const handleStartPark = useCallback(
    async (spotId: number): Promise<boolean> => {
      if (!token) return false;
      try {
        const plate = plateForNextParkRef.current;
        await startParking(spotId, token, { plate_number: plate });
        setHighlightSpotId(null);
        setUiSelectedSpotId(null);
        load();
        return true;
      } catch (e) {
        showAlert('Hata', (e as Error).message);
        return false;
      }
    },
    [token, load, showAlert],
  );

  const submitReserve = useCallback(
    async (spotId: number): Promise<boolean> => {
      if (!token) return false;
      const sched = reservationScheduledStartRef.current;
      if (!sched) {
        showAlert('Uyarı', 'Önce rezervasyon saatini seçin.');
        return false;
      }
      try {
        await createReservation(spotId, token, {
          scheduled_start_at: sched.toISOString(),
        });
        setUiSelectedSpotId(null);
        showAlert(
          'Başarılı',
          'Rezervasyonunuz kaydedildi. Rezervasyon saatinizden önce gelebilirsiniz; giriş QR’ını rezervasyon saatinden itibaren en geç 10 dakika içinde okutmanız gerekir.',
        );
        load();
        return true;
      } catch (e) {
        showAlert('Hata', (e as Error).message);
        return false;
      }
    },
    [token, load, showAlert],
  );

  const handleCancelReservation = useCallback(() => {
    if (!token || !activeReservation) return;
    confirmAction('Rezervasyon İptal', 'Rezervasyonunuzu iptal etmek istiyor musunuz?', async () => {
      try {
        await cancelReservation(activeReservation.id, token);
        load();
      } catch (e) {
        showAlert('Hata', (e as Error).message);
      }
    });
  }, [token, activeReservation, confirmAction, load, showAlert]);

  const handleEndPark = useCallback(() => {
    if (!token) return;
    confirmAction('Park Bitir', 'Park etme oturumunu sonlandırmak istiyor musunuz?', async () => {
      try {
        const res = await endParking(token);
        const fee = res.total_fee != null ? Number(res.total_fee) : 0;
        const feeLine =
          fee > 0
            ? `Ücret: ${fee.toFixed(2)} TRY — ödeme tamamlandı.`
            : 'Ücret alınmadı.';
        showAlert('Park Bitti', feeLine);
        load();
      } catch (e) {
        showAlert('Hata', (e as Error).message);
      }
    });
  }, [token, confirmAction, load, showAlert]);

  const handleSpotPress = useCallback(
    (spot: Spot, actionMode: ActionMode) => {
      if (!token || spot.is_occupied || activeSession) {
        setUiSelectedSpotId(null);
        return;
      }

      const parkNow = isParkNowPath(pathname ?? '');

      if (spot.is_reserved) {
        if (activeReservation && activeReservation.spot_id === spot.id) {
          if (parkNow && actionMode === 'park') {
            setUiSelectedSpotId(spot.id);
            return;
          }
          void handleStartPark(spot.id);
        } else {
          setUiSelectedSpotId(null);
        }
        return;
      }

      if (actionMode === 'park') {
        setUiSelectedSpotId(spot.id);
        if (parkNow) {
          return;
        }
        confirmAction(
          'Park Et',
          `${spot.spot_number} numaralı alanda park etmek istiyor musunuz?`,
          () => void handleStartPark(spot.id),
          () => setUiSelectedSpotId(null),
        );
        return;
      }
      if (actionMode === 'reserve') {
        if (!isReserveNowPath(pathname ?? '')) {
          setUiSelectedSpotId(null);
          return;
        }
        setUiSelectedSpotId(spot.id);
        return;
      }
      setUiSelectedSpotId(null);
    },
    [token, pathname, activeSession, activeReservation, confirmAction, handleStartPark],
  );

  const getSpotStatus = useCallback((item: Spot): SpotStatus => {
    if (item.is_reserved) return 'reserved';
    if (item.is_occupied) return 'occupied';
    return 'available';
  }, []);

  const getSpotBgColor = useCallback(
    (item: Spot, status: SpotStatus) => {
      const parkNow = isParkNowPath(pathname ?? '');
      const reserveNow = isReserveNowPath(pathname ?? '');
      const planPicked =
        (parkNow || reserveNow) && isParkNowPlanPickCell(item, status, uiSelectedSpotId, activeReservation);

      if (status === 'reserved') {
        if (activeReservation && activeReservation.spot_id === item.id) {
          if (planPicked) return colors.spotPlanSelectedBg;
          return colors.spotOwnReserved;
        }
        return colors.spotReserved;
      }
      if (status === 'occupied') return colors.spotOccupied;
      if (planPicked) return colors.spotPlanSelectedBg;
      if (highlightSpotId === item.id || uiSelectedSpotId === item.id) {
        return colors.parkingSectionChipActiveBg;
      }
      return colors.parkingSectionChipIdleBg;
    },
    [
      activeReservation,
      pathname,
      colors.parkingSectionChipActiveBg,
      colors.parkingSectionChipIdleBg,
      colors.spotOccupied,
      colors.spotOwnReserved,
      colors.spotPlanSelectedBg,
      colors.spotReserved,
      highlightSpotId,
      uiSelectedSpotId,
    ],
  );

  const spotList = useMemo(() => spots?.spots ?? [], [spots]);

  const occupiedCount =
    spots != null ? (spots.occupied ?? Math.max(0, spots.total - spots.available - spots.reserved)) : 0;

  const spotsSummary =
    spots != null
      ? `${spots.available} boş · ${spots.occupied ?? spots.total - spots.available - spots.reserved} dolu · ${spots.reserved} rezerve`
      : '';

  return {
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
    handleStartPark,
    setStartParkingPlate,
    getStartParkingPlate,
    handleCancelReservation,
    setScheduledReservationStart,
    submitReserve,
    handleEndPark,
    getSpotStatus,
    getSpotBgColor,
    showAlert,
    confirmAction,
    occupiedCount,
    spotsSummary,
  };
}
