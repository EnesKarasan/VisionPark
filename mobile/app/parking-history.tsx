import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { getMySessions, type ParkingSessionRow } from '../src/api';
import { formatDateTimeTr, parseUtcDate } from '../src/format';
import { useAuth } from '../src/auth';
import { spacing, fontSize, fontWeight, radius, shadow } from '../constants/Theme';
import { useTheme } from '../constants/useTheme';

const STATUS_LABELS: Record<string, string> = {
  active: 'Devam ediyor',
  ended: 'Tamamlandı',
  cancelled: 'İptal',
};

const STATUS_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  active: 'play-circle',
  ended: 'checkmark-circle',
  cancelled: 'close-circle',
};

type FilterKey = 'all' | 'active' | 'ended' | 'cancelled';

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'active', label: 'Devam eden' },
  { key: 'ended', label: 'Tamamlanan' },
  { key: 'cancelled', label: 'İptal' },
];

function formatFee(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (Number.isNaN(n)) return '—';
  if (n === 0) return 'Ücretsiz';
  return `${n.toFixed(2)} ₺`;
}

function parseFeeNumber(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isNaN(n) ? 0 : n;
}

function formatDurationMs(ms: number): string {
  if (ms < 0 || Number.isNaN(ms)) return '—';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (totalMin < 1) return '1 dk’den az';
  if (h === 0) return `${m} dk`;
  if (m === 0) return `${h} sa`;
  return `${h} sa ${m} dk`;
}

function parkingDurationMs(item: ParkingSessionRow): number {
  const start = parseUtcDate(item.started_at).getTime();
  if (Number.isNaN(start)) return 0;
  const end = item.ended_at ? parseUtcDate(item.ended_at).getTime() : Date.now();
  if (Number.isNaN(end)) return 0;
  return end - start;
}

function formatRelativeTr(iso: string): string {
  const t = parseUtcDate(iso).getTime();
  if (Number.isNaN(t)) return '';
  const sec = Math.round((Date.now() - t) / 1000);
  if (sec < 45) return 'Az önce';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dk önce`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} sa önce`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days} gün önce`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} hf önce`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ay önce`;
  return `${Math.floor(days / 365)} yıl önce`;
}

function statusStyle(
  status: string,
  colors: ReturnType<typeof useTheme>,
): { bg: string; fg: string; accent: string } {
  switch (status) {
    case 'active':
      return { bg: colors.infoLight, fg: colors.info, accent: colors.info };
    case 'ended':
      return { bg: colors.successLight, fg: colors.successDark, accent: colors.success };
    case 'cancelled':
      return { bg: colors.dangerLight, fg: colors.dangerDark, accent: colors.danger };
    default:
      return { bg: colors.surfaceAlt, fg: colors.textSecondary, accent: colors.textTertiary };
  }
}

export default function ParkingHistoryScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [sessions, setSessions] = useState<ParkingSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');

  const load = useCallback(async () => {
    if (!token) {
      setSessions([]);
      setLoading(false);
      setError(null);
      return;
    }
    setError(null);
    try {
      const list = await getMySessions(token);
      setSessions(list);
    } catch (e: unknown) {
      setError((e as Error).message);
      setSessions([]);
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

  const stats = useMemo(() => {
    const ended = sessions.filter((s) => s.status === 'ended');
    const totalSpent = ended.reduce((sum, s) => sum + parseFeeNumber(s.total_fee), 0);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const thisMonth = sessions.filter((s) => {
      const d = parseUtcDate(s.started_at);
      return d.getFullYear() === y && d.getMonth() === m;
    });
    const thisMonthSpent = thisMonth
      .filter((s) => s.status === 'ended')
      .reduce((sum, s) => sum + parseFeeNumber(s.total_fee), 0);
    return {
      count: sessions.length,
      totalSpent,
      thisMonthCount: thisMonth.length,
      thisMonthSpent,
      filteredCount:
        filter === 'all' ? sessions.length : sessions.filter((s) => s.status === filter).length,
    };
  }, [sessions, filter]);

  const filteredSessions = useMemo(() => {
    if (filter === 'all') return sessions;
    return sessions.filter((s) => s.status === filter);
  }, [sessions, filter]);

  const filterCounts = useMemo(() => {
    return {
      all: sessions.length,
      active: sessions.filter((s) => s.status === 'active').length,
      ended: sessions.filter((s) => s.status === 'ended').length,
      cancelled: sessions.filter((s) => s.status === 'cancelled').length,
    };
  }, [sessions]);

  const listHeader = useMemo(() => {
    if (sessions.length === 0) return null;
    return (
      <View style={styles.headerBlock}>
        {/* Özet kartı */}
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
            shadow.sm,
          ]}
        >
          <View style={styles.summaryHeader}>
            <View style={[styles.summaryIconWrap, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="stats-chart" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.summaryTitle, { color: colors.text }]}>Genel Özet</Text>
              <Text style={[styles.summarySubtitle, { color: colors.textTertiary }]}>
                {stats.thisMonthCount > 0
                  ? `Bu ay ${stats.thisMonthCount} oturum`
                  : 'Tüm zamanlar'}
              </Text>
            </View>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.borderLight }]} />
          <View style={styles.summaryRow}>
            <SummaryCell
              label="Toplam Park"
              value={stats.count.toString()}
              colors={colors}
            />
            <View style={[styles.summaryVDivider, { backgroundColor: colors.borderLight }]} />
            <SummaryCell
              label="Toplam Harcama"
              value={stats.totalSpent > 0 ? `${stats.totalSpent.toFixed(2)} ₺` : '—'}
              colors={colors}
            />
            <View style={[styles.summaryVDivider, { backgroundColor: colors.borderLight }]} />
            <SummaryCell
              label="Bu Ay"
              value={stats.thisMonthSpent > 0 ? `${stats.thisMonthSpent.toFixed(2)} ₺` : '—'}
              colors={colors}
            />
          </View>
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {FILTER_OPTIONS.map((opt) => {
            const selected = filter === opt.key;
            const count = filterCounts[opt.key];
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setFilter(opt.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? colors.brandDeep : colors.surface,
                    borderColor: selected ? colors.brandDeep : colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${opt.label}, ${count} kayıt`}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: selected ? '#fff' : colors.textSecondary },
                  ]}
                >
                  {opt.label}
                </Text>
                <View
                  style={[
                    styles.chipBadge,
                    {
                      backgroundColor: selected ? 'rgba(255,255,255,0.25)' : colors.surfaceAlt,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipBadgeText,
                      { color: selected ? '#fff' : colors.textSecondary },
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Sonuç sayısı */}
        <Text style={[styles.resultCount, { color: colors.textTertiary }]}>
          {filteredSessions.length}{' '}
          {filter === 'all' ? 'oturum' : `${FILTER_OPTIONS.find((o) => o.key === filter)?.label.toLowerCase()} oturum`}
        </Text>
      </View>
    );
  }, [sessions.length, stats, filter, colors, filteredSessions.length, filterCounts]);

  if (!token) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.surfaceAlt }]}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="lock-closed" size={32} color={colors.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Giriş gerekli</Text>
        <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
          Park geçmişinizi görüntülemek için Profil sekmesinden giriş yapın.
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
        <View style={[styles.emptyIcon, { backgroundColor: colors.dangerLight }]}>
          <Ionicons name="cloud-offline-outline" size={32} color={colors.danger} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Bağlantı Hatası</Text>
        <Text style={[styles.emptySub, { color: colors.textSecondary }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            setLoading(true);
            void load();
          }}
          accessibilityRole="button"
        >
          <Ionicons name="refresh" size={16} color="#fff" />
          <Text style={styles.retryText}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const emptyForFilter = sessions.length > 0 && filteredSessions.length === 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.surfaceAlt }]}>
      <FlatList
        data={filteredSessions}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[
          filteredSessions.length === 0 && !listHeader ? styles.listEmpty : styles.listContent,
          { paddingBottom: spacing.xxxl + insets.bottom },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          emptyForFilter ? (
            <View style={styles.emptyList}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name="funnel-outline" size={28} color={colors.textTertiary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Sonuç yok</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                Seçili filtreye uygun park kaydı bulunmuyor. Farklı bir filtre deneyin.
              </Text>
              <TouchableOpacity
                onPress={() => setFilter('all')}
                style={[styles.retryBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.retryText}>Tüm kayıtları göster</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyList}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="time-outline" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Henüz park kaydı yok</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                Otoparkta park başlattığınızda geçmişiniz burada listelenir.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <SessionCard item={item} colors={colors} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      />
    </View>
  );
}

/* ── Bileşenler ─────────────────────────────────────────────────────────── */

function SummaryCell({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.summaryCell}>
      <Text style={[styles.summaryValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>{label}</Text>
    </View>
  );
}

function SessionCard({
  item,
  colors,
}: {
  item: ParkingSessionRow;
  colors: ReturnType<typeof useTheme>;
}) {
  const st = statusStyle(item.status, colors);
  const rel = formatRelativeTr(item.started_at);
  const dur = formatDurationMs(parkingDurationMs(item));
  const statusIcon = STATUS_ICONS[item.status] ?? 'help-circle';

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        shadow.sm,
      ]}
    >
      {/* Sol renk şeridi */}
      <View style={[styles.cardAccent, { backgroundColor: st.accent }]} />

      <View style={styles.cardInner}>
        {/* Üst satır: alan + durum */}
        <View style={styles.cardTop}>
          <View style={styles.cardTopLeft}>
            <View style={[styles.spotIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="car-sport" size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.spotNumber, { color: colors.text }]} numberOfLines={1}>
                Alan {item.spot_number ?? item.spot_id}
              </Text>
              {rel ? (
                <Text style={[styles.relativeLine, { color: colors.textTertiary }]}>{rel}</Text>
              ) : null}
            </View>
          </View>
          <View style={[styles.statusChip, { backgroundColor: st.bg }]}>
            <Ionicons name={statusIcon} size={12} color={st.fg} />
            <Text style={[styles.statusChipText, { color: st.fg }]}>
              {STATUS_LABELS[item.status] ?? item.status}
            </Text>
          </View>
        </View>

        {/* Detay grid */}
        <View style={styles.detailGrid}>
          <View style={styles.detailItem}>
            <Ionicons name="enter-outline" size={14} color={colors.textTertiary} />
            <View>
              <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Giriş</Text>
              <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={1}>
                {formatDateTimeTr(item.started_at)}
              </Text>
            </View>
          </View>

          {item.ended_at ? (
            <View style={styles.detailItem}>
              <Ionicons name="exit-outline" size={14} color={colors.textTertiary} />
              <View>
                <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Çıkış</Text>
                <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={1}>
                  {formatDateTimeTr(item.ended_at)}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* Alt: süre + ücret */}
        <View style={[styles.footerRow, { borderTopColor: colors.borderLight }]}>
          <View style={styles.footerCell}>
            <Ionicons name="timer-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.footerText, { color: colors.text }]}>
              {dur}
              {item.status === 'active' ? ' ·  devam' : ''}
            </Text>
          </View>
          <View style={styles.footerCell}>
            <Ionicons name="cash-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.feeValue, { color: colors.text }]}>
              {formatFee(item.total_fee)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  loadingText: { fontSize: fontSize.md, marginTop: spacing.sm },

  headerBlock: { marginBottom: spacing.sm },

  // Özet kartı
  summaryCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  summarySubtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  summaryDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  summaryVDivider: {
    width: StyleSheet.hairlineWidth,
  },
  summaryValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: fontWeight.semibold,
  },

  // Filter chips
  chipsScroll: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  chipBadge: {
    minWidth: 22,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },

  resultCount: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },

  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  listEmpty: {
    flexGrow: 1,
    padding: spacing.lg,
  },

  // Kartlar
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cardAccent: {
    width: 4,
  },
  cardInner: {
    flex: 1,
    padding: spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  spotIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotNumber: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  relativeLine: {
    fontSize: fontSize.xs,
    marginTop: 1,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
  },

  // Detay grid
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    flex: 1,
    minWidth: 110,
  },
  detailLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: fontWeight.semibold,
  },
  detailValue: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    marginTop: 1,
  },

  // Footer
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  feeValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },

  // Empty / error
  emptyList: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  retryText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: '#fff',
  },
});
