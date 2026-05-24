import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';

import { useTheme } from '@/constants/useTheme';
import { spacing, radius, fontSize, fontWeight, shadow } from '@/constants/Theme';
import { useAuth } from '../src/auth';
import { useParkingSpotFlowContext } from '../src/ParkingSpotFlowContext';
import {
  createExitParkingIntent,
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

export default function ParkExitQrScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const { activeSession, load } = useParkingSpotFlowContext();

  const [intent, setIntent] = useState<ParkingIntent | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const closedRef = useRef(false);

  // Aktif oturum yoksa intent oluşturmaz; mesaj gösterir.
  useEffect(() => {
    if (!token || !activeSession) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const existing = await getActiveParkingIntent(token, 'exit');
        if (existing) {
          if (!cancelled) setIntent(existing);
        } else {
          const fresh = await createExitParkingIntent(token);
          if (!cancelled) setIntent(fresh);
        }
      } catch (e) {
        if (!cancelled) setErrorMsg((e as Error).message || 'Çıkış QR oluşturulamadı');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, activeSession?.id]);

  // Saniyelik geri sayım için now güncelle
  useEffect(() => {
    if (!intent) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [intent]);

  // Oturum kapandı mı diye poll et — kapandıysa ana sayfaya dön
  useEffect(() => {
    if (!token || !intent || closedRef.current) return;

    const poll = setInterval(async () => {
      try {
        const session = await getActiveSession(token);
        if (!session && !closedRef.current) {
          closedRef.current = true;
          load();
          // Detay ve QR ekranlarından çıkıp ana sayfaya
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
    if (!token) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const fresh = await createExitParkingIntent(token);
      setIntent(fresh);
    } catch (e) {
      setErrorMsg((e as Error).message || 'QR yenilenemedi');
    } finally {
      setLoading(false);
    }
  }, [token]);

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

  if (!activeSession) {
    return (
      <View style={[styles.centered, { backgroundColor: pageBg, paddingBottom: insets.bottom }]}>
        <Text style={[styles.title, { color: colors.text }]}>Aktif park oturumunuz yok</Text>
        <Text style={[styles.muted, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
          Çıkış QR'ı için önce bir park oturumu başlatmanız gerekir.
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
        <Text style={[styles.kicker, { color: colors.textTertiary }]}>Otopark Çıkışı</Text>
        <Text style={[styles.title, { color: colors.text, marginTop: spacing.xs }]}>
          Çıkış QR Kodunuz
        </Text>
        {activeSession.spot_number ? (
          <Text style={[styles.muted, { color: colors.textSecondary, marginTop: spacing.sm }]}>
            Alan: <Text style={{ fontWeight: fontWeight.bold }}>{activeSession.spot_number}</Text>
          </Text>
        ) : null}

        {loading && !intent ? (
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
              Çıkıştaki tarayıcıya bu QR'ı gösterin. Ücretiniz hesaplanıp ödemeniz alındığında bu ekran
              otomatik olarak kapanır.
            </Text>
          </>
        ) : intent && expired ? (
          <>
            <View style={[styles.qrWrap, { backgroundColor: '#fef2f2', borderColor: colors.danger }]}>
              <Text style={{ color: colors.danger, fontWeight: fontWeight.bold }}>QR'ın süresi doldu</Text>
            </View>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Aşağıdaki düğme ile yeni bir çıkış QR'ı oluşturabilirsiniz.
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
  countdownValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'],
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
