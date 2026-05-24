import type { ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ParkingLotMapView } from '@/components/ParkingLotMapView';
import { useTheme } from '@/constants/useTheme';
import { spacing, radius, fontSize, fontWeight, shadow } from '@/constants/Theme';
import type { SpotsSummary } from '@/src/api';
import {
  type Spot,
  type SpotStatus,
  type ActionMode,
  type ActiveReservation,
  isParkNowPlanPickCell,
} from '@/src/useParkingSpotFlow';

const SPOT_GAP = 10;
const AREAS_CARD_INNER_PAD = spacing.md;
/** plainCards: kartın yan boşluğu; harita genişliği buna göre daraltılır */
const PLAIN_AREAS_SIDE_INSET = spacing.md;

const STAT_CARD_FREE_BG = '#15803d';
const STAT_CARD_OCCUPIED_BG = '#b91c1c';
const STAT_CARD_RESERVED_BG = '#eab308';
const STAT_CARD_RESERVED_FG = '#1c1917';
const SERVICE_RESERVE_ICON = '#854d0e';

export type StatTileMetrics = {
  pad: number;
  icon: number;
  countFont: number;
  titleFont: number;
};

export function computeStatTileMetrics(cardWidth: number): StatTileMetrics {
  const s = cardWidth;
  return {
    pad: Math.max(6, Math.min(spacing.md, Math.round(s * 0.085))),
    icon: Math.round(Math.min(30, Math.max(18, s * 0.22))),
    countFont: Math.round(Math.min(fontSize.xxl, Math.max(16, s * 0.24))),
    titleFont: s < 118 ? fontSize.sm : fontSize.md,
  };
}

type ActiveSession = { id: number; spot_number: string; started_at?: string };

type AreasSubtitleMode = 'tab' | 'parkNow';

type Props = {
  actionMode: ActionMode;
  areasSubtitleMode: AreasSubtitleMode;
  spots: SpotsSummary | null;
  spotList: Spot[];
  canUseMapLayout: boolean;
  occupiedCount: number;
  spotsSummary: string;
  /** Verilirse istatistik kutularında (Boş/Dolu/Rezerve) bu sayılar kullanılır (ör. bölüm filtresi). */
  statCounts?: { available: number; occupied: number; reserved: number };
  /** Izgara kartı başlığı */
  areasCardTitle?: string;
  /** false ise Boş/Dolu/Rezerve özet kutuları gösterilmez; yer seçimi ızgarası kullanılır (ör. park-now). */
  showSummaryStats?: boolean;
  /** false ise başlık altındaki özet / harita açıklama metni gösterilmez (ör. park-now’da üstte rehber varken). */
  showAreasSubtitle?: boolean;
  statCardSize: number;
  statCardRadius: number;
  statTile: StatTileMetrics;
  spotSizeAreas: number;
  highlightSpotId: number | null;
  /** Dokunulup onay bekleyen boş alan (açık yeşil → koyu yeşil). */
  uiSelectedSpotId?: number | null;
  activeSession: ActiveSession | null;
  activeReservation: ActiveReservation | null;
  onSpotPress: (spot: Spot) => void;
  onEndPark: () => void;
  onStartParkFromReservation: (spotId: number) => void;
  onCancelReservation: () => void;
  /** bbox haritası genişliği (kart içi alan ≈ bu değer − 2×kart padding) */
  layoutContentWidth: number;
  /** Alan kartının en üstüne (başlıktan önce) eklenir — bölüm seçici vb. tek kartta birleştirmek için. */
  prependInsideAreasCard?: ReactNode;
  /** true: alan / aktif / rezervasyon kartlarında gölge ve yuvarlatılmış köşe yok (tam genişlik ekranlar). */
  plainCards?: boolean;
  /** Harita modunda bu metin shell’de değil, plan kutusunun üstündeki kartta gösterilir */
  mapHeaderTitle?: string;
  /** false ise alan kartı altındaki Boş / Dolu / Rezerve göstergesi gösterilmez */
  showAreasLegend?: boolean;
};

export function ParkingLotPanels({
  actionMode,
  areasSubtitleMode,
  spots,
  spotList,
  canUseMapLayout,
  occupiedCount,
  spotsSummary,
  statCounts,
  areasCardTitle = 'Park alanları',
  showSummaryStats = true,
  showAreasSubtitle = true,
  statCardSize,
  statCardRadius,
  statTile,
  spotSizeAreas,
  highlightSpotId,
  uiSelectedSpotId = null,
  activeSession,
  activeReservation,
  onSpotPress,
  onEndPark,
  onStartParkFromReservation,
  onCancelReservation,
  layoutContentWidth,
  prependInsideAreasCard,
  plainCards = false,
  mapHeaderTitle,
  showAreasLegend = true,
}: Props) {
  const colors = useTheme();

  const plainSideTotal = plainCards ? 2 * PLAIN_AREAS_SIDE_INSET : 0;
  const mapViewportWidth = Math.max(
    160,
    layoutContentWidth - 2 * AREAS_CARD_INNER_PAD - plainSideTotal,
  );

  const statFree = statCounts?.available ?? spots?.available ?? 0;
  const statOcc = statCounts?.occupied ?? occupiedCount;
  const statRes = statCounts?.reserved ?? spots?.reserved ?? 0;

  const planSelectVisual = areasSubtitleMode === 'parkNow';

  const showStatTiles = canUseMapLayout && showSummaryStats;

  function getSpotStatus(item: Spot): SpotStatus {
    if (item.is_reserved) return 'reserved';
    if (item.is_occupied) return 'occupied';
    return 'available';
  }

  function getSpotBgColor(item: Spot, status: SpotStatus) {
    const planPicked =
      planSelectVisual && isParkNowPlanPickCell(item, status, uiSelectedSpotId, activeReservation);
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
  }

  function spotLabelColor(item: Spot, status: SpotStatus): string {
    const planPicked =
      planSelectVisual && isParkNowPlanPickCell(item, status, uiSelectedSpotId, activeReservation);
    if (status === 'occupied') return colors.parkingSectionChipActiveFg;
    if (planPicked) return colors.spotPlanSelectedFg;
    if (status === 'reserved') return STAT_CARD_RESERVED_FG;
    if (highlightSpotId === item.id || uiSelectedSpotId === item.id) {
      return colors.parkingSectionChipActiveFg;
    }
    return colors.parkingSectionChipIdleFg;
  }

  function renderSpotCell(item: Spot, index: number) {
    const status = getSpotStatus(item);
    const isOwn = activeReservation && activeReservation.spot_id === item.id;
    const isSpotPickHighlight = planSelectVisual
      ? isParkNowPlanPickCell(item, status, uiSelectedSpotId, activeReservation)
      : status === 'available' && (highlightSpotId === item.id || uiSelectedSpotId === item.id);
    const baseDisabled = status === 'occupied' || (status === 'reserved' && !isOwn) || !!activeSession;
    const needsModeForAvailable = status === 'available' && actionMode === 'none';
    const disabled = baseDisabled || needsModeForAvailable;
    const dimPickHint = needsModeForAvailable && status === 'available';

    const inner = (
      <TouchableOpacity
        style={[
          s.spot,
          {
            width: spotSizeAreas,
            height: spotSizeAreas,
          },
          {
            backgroundColor: getSpotBgColor(item, status),
            opacity: dimPickHint ? 0.65 : 1,
          },
          isOwn && s.spotOwnBorder,
          isSpotPickHighlight && [
            s.spotSuggested,
            { borderColor: colors.parkingSectionChipIdleBorder },
          ],
          Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
        ]}
        onPress={() => onSpotPress(item)}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Text
          style={[
            s.spotText,
            {
              fontSize: fontSize.sm,
              textAlign: 'center',
              color: spotLabelColor(item, status),
            },
          ]}
          numberOfLines={2}
          minimumFontScale={0.35}
        >
          {item.spot_number}
        </Text>
      </TouchableOpacity>
    );

    return (
      <Animated.View key={item.id} entering={FadeIn.duration(300).delay(Math.min(index * 30, 300))}>
        {inner}
      </Animated.View>
    );
  }

  const areasSubtitle =
    areasSubtitleMode === 'parkNow'
      ? spotsSummary
        ? `${spotsSummary} — alan seçmek için dokunun; park bir sonraki adımda`
        : 'Alan seçmek için dokunun; park bir sonraki adımda'
      : spotsSummary
        ? `${spotsSummary} — Rezervasyon için mod seçip alana dokunun; park için Hemen Park Et’e dokunun`
        : 'Park için Hemen Park Et’e dokunun; rezervasyon için alttaki Rezervasyon Yap’ı seçin';

  const embedTitleInMap = Boolean(mapHeaderTitle) && canUseMapLayout;

  const areasCardShell = (subtitle: string | null, body: ReactNode) => (
    <View
      style={[
        s.areasCard,
        plainCards && s.areasCardPlain,
        { backgroundColor: colors.surface },
        !plainCards && shadow.lg,
      ]}
    >
      {prependInsideAreasCard}
      {!embedTitleInMap ? (
        <Text
          style={[
            s.areasTitle,
            { color: colors.brandDeep },
            prependInsideAreasCard ? { marginTop: spacing.md } : null,
            !subtitle ? { marginBottom: spacing.md } : null,
          ]}
        >
          {areasCardTitle}
        </Text>
      ) : null}
      {subtitle ? (
        <Text style={[s.areasSubtitle, { color: colors.textSecondary }]} numberOfLines={4}>
          {subtitle}
        </Text>
      ) : null}
      {body}
      {showAreasLegend ? (
        <View style={[s.legend, { borderTopColor: colors.border }]}>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: colors.parkingSectionChipIdleBg }]} />
            <Text style={[s.legendLabel, { color: colors.textSecondary }]}>Boş</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: colors.spotOccupied }]} />
            <Text style={[s.legendLabel, { color: colors.textSecondary }]}>Dolu</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: colors.spotReserved }]} />
            <Text style={[s.legendLabel, { color: colors.textSecondary }]}>Rezerve</Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <>
      {showStatTiles ? (
        <ParkingOccupancyStatCards
          available={statFree}
          occupied={statOcc}
          reserved={statRes}
          contentWidth={layoutContentWidth}
        />
      ) : null}

      {canUseMapLayout
        ? areasCardShell(
            showAreasSubtitle
              ? `${areasSubtitle} Yalnızca bu listedeki yerler gösterilir; kutular arasındaki konum kamera planıyla uyumludur.`
              : null,
            (
              <ParkingLotMapView
                width={mapViewportWidth}
                spotList={spotList}
                actionMode={actionMode}
                activeReservation={activeReservation}
                activeSession={activeSession}
                highlightSpotId={highlightSpotId}
                uiSelectedSpotId={uiSelectedSpotId}
                planSelectVisual={planSelectVisual}
                onSpotPress={onSpotPress}
                headerTitle={mapHeaderTitle}
              />
            ),
          )
        : areasCardShell(
            showAreasSubtitle ? areasSubtitle : null,
            <View style={s.fallbackGrid}>
              {spotList.map((item, index) => renderSpotCell(item, index))}
            </View>,
          )}

      {activeSession && (
        <Animated.View
          entering={FadeIn.duration(350)}
          style={[
            plainCards ? s.activeCardFlat : s.activeCard,
            { backgroundColor: colors.surface, borderLeftColor: colors.brandDeep },
          ]}
        >
          <View style={s.activeCardHeader}>
            <Text style={s.activeEmoji}>🅿️</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.activeTitle, { color: colors.text }]}>Aktif Park</Text>
              <Text style={[s.activeSpot, { color: colors.textSecondary }]}>Alan: {activeSession.spot_number}</Text>
            </View>
          </View>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.danger }]} onPress={onEndPark} activeOpacity={0.8}>
            <Text style={s.actionBtnText}>⏹ Park Bitir</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {activeReservation && !activeSession && (
        <Animated.View
          entering={FadeIn.duration(350)}
          style={[
            plainCards ? s.reservationCardFlat : s.reservationCard,
            { backgroundColor: colors.surface, borderLeftColor: colors.warning },
          ]}
        >
          <View style={s.activeCardHeader}>
            <Text style={s.activeEmoji}>📌</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.activeTitle, { color: colors.text }]}>Aktif Rezervasyon</Text>
              <Text style={[s.activeSpot, { color: colors.textSecondary }]}>Alan: {activeReservation.spot_number}</Text>
              <Text style={[s.expiryText, { color: colors.textTertiary }]}>
                ⏰{' '}
                {new Date(activeReservation.expires_at).toLocaleTimeString('tr-TR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                'e kadar
              </Text>
            </View>
          </View>
          <View style={s.reservationActions}>
            <TouchableOpacity
              style={[s.actionBtn, s.actionBtnHalf, { backgroundColor: colors.success }]}
              onPress={() => onStartParkFromReservation(activeReservation.spot_id)}
              activeOpacity={0.8}
            >
              <Text style={s.actionBtnText}>🚗 Park Et</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtn, s.actionBtnHalf, { backgroundColor: colors.danger }]}
              onPress={onCancelReservation}
              activeOpacity={0.8}
            >
              <Text style={s.actionBtnText}>✕ İptal Et</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
    alignSelf: 'stretch',
  },
  statCardBox: {
    position: 'relative',
  },
  statCardTextCol: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    minWidth: 0,
  },
  statCardIconAbs: {
    position: 'absolute',
  },
  serviceCardSquare: {
    borderWidth: 2,
    borderColor: 'transparent',
    padding: spacing.md,
    overflow: 'hidden',
  },
  serviceCardTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
  },
  statCardCount: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    marginTop: spacing.xs,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  areasCard: {
    borderRadius: radius.xl,
    padding: AREAS_CARD_INNER_PAD,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  areasCardPlain: {
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    marginHorizontal: PLAIN_AREAS_SIDE_INSET,
    overflow: 'hidden',
  },
  areasTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
  },
  areasSubtitle: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  fallbackGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPOT_GAP,
    marginBottom: spacing.sm,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { fontSize: fontSize.sm },
  activeCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    ...shadow.md,
  },
  activeCardFlat: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    marginHorizontal: PLAIN_AREAS_SIDE_INSET,
    borderLeftWidth: 4,
  },
  reservationCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    ...shadow.md,
  },
  reservationCardFlat: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    marginHorizontal: PLAIN_AREAS_SIDE_INSET,
    borderLeftWidth: 4,
  },
  activeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  activeEmoji: { fontSize: 28 },
  activeTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  activeSpot: { fontSize: fontSize.sm, marginTop: 2 },
  expiryText: { fontSize: fontSize.xs, marginTop: 4 },
  reservationActions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  actionBtnHalf: { flex: 1 },
  actionBtnText: { color: '#fff', fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
  spot: {
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  spotOwnBorder: {
    borderWidth: 2.5,
    borderColor: '#854d0e',
  },
  spotSuggested: {
    borderWidth: 3,
  },
  spotText: {
    fontWeight: fontWeight.bold,
    width: '100%',
  },
});

/** Park-now / ana sayfa ile aynı Boş · Dolu · Rezerve özet kartları. */
const OCCUPANCY_ROW_GAP = spacing.md;

export function ParkingOccupancyStatCards({
  available,
  occupied,
  reserved,
  contentWidth,
  rowStyle,
}: {
  available: number;
  occupied: number;
  reserved: number;
  /** Satır genişliği (yatay padding çıkarılmış içerik genişliği). */
  contentWidth: number;
  /** Örn. kart içinde `marginBottom: 0` */
  rowStyle?: StyleProp<ViewStyle>;
}) {
  const rawStatWidth = (Math.max(1, contentWidth) - 2 * OCCUPANCY_ROW_GAP) / 3;
  const statCardSize = Math.min(200, Math.max(1, Math.floor(rawStatWidth)));
  const statCardRadius = Math.min(32, Math.round(statCardSize * 0.2));
  const statTile = computeStatTileMetrics(statCardSize);

  return (
    <View style={[s.serviceRow, rowStyle]}>
      <View
        style={[
          s.serviceCardSquare,
          s.statCardBox,
          {
            width: statCardSize,
            height: statCardSize,
            borderRadius: statCardRadius,
            backgroundColor: STAT_CARD_FREE_BG,
            padding: statTile.pad,
          },
          shadow.md,
        ]}
        accessibilityLabel={`Boş park yeri sayısı ${available}`}
      >
        <View style={[s.statCardTextCol, { paddingRight: statTile.icon + spacing.xs }]}>
          <Text
            style={[s.serviceCardTitle, { color: '#ffffff', fontSize: statTile.titleFont }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Boş
          </Text>
          <Text
            style={[
              s.statCardCount,
              {
                color: '#ffffff',
                fontSize: statTile.countFont,
                lineHeight: Math.round(statTile.countFont * 1.08),
                marginTop: 2,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
          >
            {available}
          </Text>
        </View>
        <MaterialCommunityIcons
          name="car-outline"
          size={statTile.icon}
          color="rgba(255,255,255,0.88)"
          style={[s.statCardIconAbs, { right: statTile.pad, bottom: statTile.pad }]}
        />
      </View>
      <View
        style={[
          s.serviceCardSquare,
          s.statCardBox,
          {
            width: statCardSize,
            height: statCardSize,
            borderRadius: statCardRadius,
            backgroundColor: STAT_CARD_OCCUPIED_BG,
            padding: statTile.pad,
          },
          shadow.md,
        ]}
        accessibilityLabel={`Dolu alan sayısı ${occupied}`}
      >
        <View style={[s.statCardTextCol, { paddingRight: statTile.icon + spacing.xs }]}>
          <Text
            style={[s.serviceCardTitle, { color: '#ffffff', fontSize: statTile.titleFont }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Dolu
          </Text>
          <Text
            style={[
              s.statCardCount,
              {
                color: '#ffffff',
                fontSize: statTile.countFont,
                lineHeight: Math.round(statTile.countFont * 1.08),
                marginTop: 2,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
          >
            {occupied}
          </Text>
        </View>
        <MaterialCommunityIcons
          name="close-circle-outline"
          size={statTile.icon}
          color="rgba(255,255,255,0.88)"
          style={[s.statCardIconAbs, { right: statTile.pad, bottom: statTile.pad }]}
        />
      </View>
      <View
        style={[
          s.serviceCardSquare,
          s.statCardBox,
          {
            width: statCardSize,
            height: statCardSize,
            borderRadius: statCardRadius,
            backgroundColor: STAT_CARD_RESERVED_BG,
            padding: statTile.pad,
          },
          shadow.md,
        ]}
        accessibilityLabel={`Rezerve alan sayısı ${reserved}`}
      >
        <View style={[s.statCardTextCol, { paddingRight: statTile.icon + spacing.xs }]}>
          <Text
            style={[s.serviceCardTitle, { color: STAT_CARD_RESERVED_FG, fontSize: statTile.titleFont }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Rezerve
          </Text>
          <Text
            style={[
              s.statCardCount,
              {
                color: STAT_CARD_RESERVED_FG,
                fontSize: statTile.countFont,
                lineHeight: Math.round(statTile.countFont * 1.08),
                marginTop: 2,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
          >
            {reserved}
          </Text>
        </View>
        <MaterialCommunityIcons
          name="clock-outline"
          size={statTile.icon}
          color={SERVICE_RESERVE_ICON}
          style={[s.statCardIconAbs, { right: statTile.pad, bottom: statTile.pad }]}
        />
      </View>
    </View>
  );
}
