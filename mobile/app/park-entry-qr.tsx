import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';

import { useTheme } from '@/constants/useTheme';
import { spacing, radius, fontSize, fontWeight, shadow } from '@/constants/Theme';
import { useAuth } from '../src/auth';
import { useParkingSpotFlowContext } from '../src/ParkingSpotFlowContext';
import {
  createParkingIntent,
  getActiveParkingIntent,
  getActiveSession,
  type ParkingIntent,
} from '../src/api';
import { parseUtcDate } from '../src/format';

const POLL_INTERVAL_MS = 3000;

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0:00';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ParkEntryQrScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ spotId?: string }>();
  const { spotList, activeSession, activeReservation, load, getStartParkingPlate } = useParkingSpotFlowContext();

  const [intent, setIntent] = useState<ParkingIntent | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const closedRef = useRef(false);

  const numericSpotId = useMemo(() => {
    const raw = params.spotId;
    if (raw == null || raw === '') return null;
    const s = Array.isArray(raw) ? raw[0] : raw;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }, [params.spotId]);

  const spot = useMemo(
    () => (numericSpotId != null ? spotList.find((s) => s.id === numericSpotId) ?? null : null),
    [spotList, numericSpotId],
  );

  const validationError = useMemo(() => {
    if (numericSpotId == null) return 'Geçersiz park alanı.';
    if (!spot) return 'Bu alan bulunamadı.';
    if (spot.is_occupied) return 'Bu alan dolu; QR oluşturulamaz.';
    if (spot.is_reserved) {
      if (!activeReservation || activeReservation.spot_id !== spot.id) {
        return 'Bu alan başka bir kullanıcıya rezerve.';
      }
    }
    return null;
  }, [numericSpotId, spot, activeReservation]);

  // Intent oluştur veya mevcut olanı kullan
  useEffect(() => {
    if (!token || numericSpotId == null || validationError) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        // Önce aktif intent var mı kontrol et (aynı spot için)
        const existing = await getActiveParkingIntent(token);
        if (existing && existing.spot_id === numericSpotId) {
          if (!cancelled) setIntent(existing);
        } else {
          const fresh = await createParkingIntent(numericSpotId, token, { plate_number: getStartParkingPlate() });
          if (!cancelled) setIntent(fresh);
        }
      } catch (e) {
        if (!cancelled) setErrorMsg((e as Error).message || 'QR oluşturulamadı');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, numericSpotId, validationError]);

  // Geri sayım için her saniye now güncelle
  useEffect(() => {
    if (!intent) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [intent]);

  // Aktif oturum oluştu mu diye düzenli kontrol — oluşursa ekranı kapat
  useEffect(() => {
    if (!token || !intent || closedRef.current) return;

    const poll = setInterval(async () => {
      try {
        const session = await getActiveSession(token);
        if (session && !closedRef.current) {
          closedRef.current = true;
          load();
          // Park-exit-qr ile tutarlı: doğrudan ana sayfaya dön
          router.replace('/');
        }
      } catch {
        /* ignore */
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(poll);
  }, [token, intent, router, load]);

  const expiresMs = intent ? parseUtcDate(intent.expires_at).getTime() : 0;
  const remaining = expiresMs - now;
  const expired = intent != null && remaining <= 0;

  const handleRegenerate = useCallback(async () => {
    if (!token || numericSpotId == null) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const fresh = await createParkingIntent(numericSpotId, token);
      setIntent(fresh);
    } catch (e) {
      setErrorMsg((e as Error).message || 'QR yenilenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, numericSpotId]);

  const pageBg = colors.surfaceAlt;

  if (!token) {
    return (
      <View style={[styles.centered, { backgroundColor: pageBg, paddingBottom: insets.bottom }]}>
        <Text style={[styles.title, { color: colors.text }]}>Giriş gerekli</Text>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.brandDeep, marginTop: spacing.lg }]}
          onPress={() => router.back()}
        >
          <Text style={styles.primaryBtnText}>Geri</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (activeSession) {
    return (
      <View style={[styles.centered, { backgroundColor: pageBg, paddingBottom: insets.bottom }]}>
        <Text style={[styles.title, { color: colors.text }]}>Zaten aktif park</Text>
        <Text style={[styles.muted, { color: colors.textSecondary, textAlign: 'center' }]}>
          Alan: {activeSession.spot_number}
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
        { paddingTop: spacing.lg, paddingBottom: spacing.xl + insets.bottom },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadow.sm]}>
        <Text style={[styles.kicker, { color: colors.textTertiary }]}>Otopark Girişi</Text>
        <Text style={[styles.title, { color: colors.text, marginTop: spacing.xs }]}>
          Kişisel giriş QR kodunuz
        </Text>
        {spot ? (
          <Text style={[styles.muted, { color: colors.textSecondary, marginTop: spacing.sm }]}>
            Alan: <Text style={{ fontWeight: fontWeight.bold }}>{spot.spot_number}</Text>
          </Text>
        ) : null}

        {validationError ? (
          <Text style={[styles.errorText, { color: colors.danger, marginTop: spacing.md }]}>
            {validationError}
          </Text>
        ) : loading && !intent ? (
          <View style={{ marginTop: spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={colors.brandDeep} />
            <Text style={[styles.muted, { color: colors.textSecondary, marginTop: spacing.sm }]}>
              QR oluşturuluyor…
            </Text>
          </View>
        ) : intent && !expired ? (
          <>
            <View style={[styles.qrWrap, { backgroundColor: '#ffffff', borderColor: colors.border }]}>
              <QRCode value={intent.redeem_url} size={240} color="#0a0a0a" backgroundColor="#ffffff" />
            </View>

            <View style={styles.countdownRow}>
              <Text style={[styles.countdownLabel, { color: colors.textSecondary }]}>
                Geçerlilik süresi
              </Text>
              <Text style={[styles.countdownValue, { color: remaining < 60_000 ? colors.danger : colors.text }]}>
                {formatRemaining(remaining)}
              </Text>
            </View>

            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Bu QR'ı iPhone kameranıza okuttuğunuzda Safari otomatik açılır, oturumunuz başlatılır
              ve bu ekran otomatik kapanır.
            </Text>
            <View style={[styles.urlBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Text style={[styles.urlLabel, { color: colors.textTertiary }]}>
                TARAYAMAZSANIZ AÇIN
              </Text>
              <Text style={[styles.urlText, { color: colors.text }]} numberOfLines={2} selectable>
                {intent.redeem_url}
              </Text>
            </View>
          </>
        ) : intent && expired ? (
          <>
            <View style={[styles.qrWrap, { backgroundColor: '#fef2f2', borderColor: colors.danger }]}>
              <Text style={{ color: colors.danger, fontWeight: fontWeight.bold }}>QR'ın süresi doldu</Text>
            </View>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Aşağıdaki düğme ile yeni bir QR oluşturabilirsiniz.
            </Text>
          </>
        ) : null}

        {errorMsg ? (
          <Text style={[styles.errorText, { color: colors.danger, marginTop: spacing.md }]}>
            {errorMsg}
          </Text>
        ) : null}

        {intent && (expired || errorMsg) ? (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.brandDeep, marginTop: spacing.lg }]}
            onPress={handleRegenerate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Yeni QR Oluştur</Text>
            )}
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: colors.border, marginTop: spacing.sm }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>İptal et</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    alignItems: 'stretch',
    paddingHorizontal: spacing.md,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
  kicker: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  muted: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  hint: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: spacing.md,
  },
  errorText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 20,
  },
  qrWrap: {
    alignSelf: 'center',
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
    minWidth: 260,
  },
  countdownRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  countdownLabel: { fontSize: fontSize.sm },
  countdownValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'] },
  urlBox: {
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  urlLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  urlText: {
    fontSize: 11,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  primaryBtn: {
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
  secondaryBtn: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
});
