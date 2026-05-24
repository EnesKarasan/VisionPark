import type { ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useTheme } from '@/constants/useTheme';
import { spacing, radius, fontWeight, fontSize } from '@/constants/Theme';
import {
  unionBBoxViewport,
  bboxToLayoutInViewport,
  isValidBbox,
} from '@/constants/parkingLayout';
import {
  type Spot,
  type SpotStatus,
  type ActionMode,
  type ActiveReservation,
  isParkNowPlanPickCell,
} from '@/src/useParkingSpotFlow';

const RESERVED_SPOT_LABEL = '#1c1917';

type ActiveSession = { id: number; spot_number: string; started_at?: string };

type Props = {
  width: number;
  spotList: Spot[];
  actionMode: ActionMode;
  activeReservation: ActiveReservation | null;
  activeSession: ActiveSession | null;
  highlightSpotId: number | null;
  uiSelectedSpotId?: number | null;
  /** Hemen Park Et: seçim vurgusu koyu yeşil, park hemen başlamaz */
  planSelectVisual?: boolean;
  onSpotPress: (spot: Spot) => void;
  /** Plan çerçevesinin içinde, en üstte gösterilir */
  headerTitle?: string;
};

/**
 * Yalnızca spotList içindeki yerlerin bbox birleşimini gösterir (bölüm filtresi = sadece o bölümün düzeni).
 */
export function ParkingLotMapView({
  width: maxWidth,
  spotList,
  actionMode,
  activeReservation,
  activeSession,
  highlightSpotId,
  uiSelectedSpotId = null,
  planSelectVisual = false,
  onSpotPress,
  headerTitle,
}: Props) {
  const colors = useTheme();

  const sorted = [...spotList].filter((s) => isValidBbox(s.bbox)).sort((a, b) => {
    const ay = a.bbox![1];
    const by = b.bbox![1];
    if (ay !== by) return ay - by;
    return a.bbox![0] - b.bbox![0];
  });

  const bboxes = sorted.map((s) => s.bbox!);
  const viewport = unionBBoxViewport(bboxes);

  /** Her zaman kart genişliğini kullan; yükseklik en-boy oranına göre büyür (iç scroll yok, sayfa kayar). */
  let displayW = maxWidth;
  let displayH = 200;
  if (viewport && viewport.viewW > 0 && viewport.viewH > 0) {
    displayW = maxWidth;
    displayH = Math.round((maxWidth * viewport.viewH) / viewport.viewW);
  }

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
    if (status === 'reserved') return RESERVED_SPOT_LABEL;
    if (highlightSpotId === item.id || uiSelectedSpotId === item.id) {
      return colors.parkingSectionChipActiveFg;
    }
    return colors.parkingSectionChipIdleFg;
  }

  const frameShell = (children: ReactNode) => (
    <View
      style={[
        styles.mapFrame,
        {
          width: displayW || maxWidth,
          borderColor: colors.border,
          alignSelf: 'stretch',
          ...(headerTitle ? { marginTop: spacing.lg } : null),
        },
      ]}
      accessibilityLabel="Seçili bölüm park planı, yalnızca listedeki yerler"
    >
      {children}
    </View>
  );

  if (!viewport || sorted.length === 0) {
    return frameShell(
      <>
        {headerTitle ? (
          <View style={[styles.mapHeaderRow, { backgroundColor: colors.surfaceAlt }]}>
            <View
              style={[
                styles.mapHeaderBadge,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.mapHeaderTitle, { color: colors.brandDeep }]} numberOfLines={1}>
                {headerTitle}
              </Text>
            </View>
          </View>
        ) : null}
        <View
          style={[
            styles.mapSpotLayer,
            {
              minHeight: 120,
              backgroundColor: colors.surfaceAlt,
              justifyContent: 'center',
              alignItems: 'center',
            },
          ]}
        >
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Gösterilecek alan yok</Text>
        </View>
      </>,
    );
  }

  const { viewX, viewY, viewW, viewH } = viewport;

  const spotNodes = sorted.map((item, index) => {
    const layout = bboxToLayoutInViewport(item.bbox!, viewX, viewY, viewW, viewH, displayW, displayH);
    if (!layout) return null;

    const status = getSpotStatus(item);
    const isOwn = activeReservation && activeReservation.spot_id === item.id;
    const isSpotPickHighlight = planSelectVisual
      ? isParkNowPlanPickCell(item, status, uiSelectedSpotId, activeReservation)
      : status === 'available' && (highlightSpotId === item.id || uiSelectedSpotId === item.id);
    const baseDisabled = status === 'occupied' || (status === 'reserved' && !isOwn) || !!activeSession;
    const needsModeForAvailable = status === 'available' && actionMode === 'none';
    const disabled = baseDisabled || needsModeForAvailable;
    const dimPickHint = needsModeForAvailable && status === 'available';

    const fontSizeSpot = Math.max(
      8,
      Math.min(14, Math.round(Math.min(layout.width, layout.height) * 0.36)),
    );

    return (
      <Animated.View
        key={item.id}
        entering={FadeIn.duration(220).delay(Math.min(index * 25, 280))}
        style={[
          styles.spotWrap,
          {
            left: layout.left,
            top: layout.top,
            width: layout.width,
            height: layout.height,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.spotInner,
            {
              backgroundColor: getSpotBgColor(item, status),
              opacity: dimPickHint ? 0.62 : 1,
              borderColor: isSpotPickHighlight
                ? colors.parkingSectionChipIdleBorder
                : isOwn
                  ? '#854d0e'
                  : 'rgba(0,0,0,0.2)',
              borderWidth: isSpotPickHighlight ? 2.5 : isOwn ? 2 : StyleSheet.hairlineWidth,
            },
            Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
          ]}
          onPress={() => onSpotPress(item)}
          disabled={disabled}
          activeOpacity={0.75}
          accessibilityLabel={`Park yeri ${item.spot_number}, ${status}`}
        >
          <Text
            style={[
              styles.spotLabel,
              { fontSize: fontSizeSpot, color: spotLabelColor(item, status) },
            ]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.45}
          >
            {item.spot_number}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  });

  return frameShell(
    <>
      {headerTitle ? (
        <View style={[styles.mapHeaderRow, { backgroundColor: colors.surfaceAlt }]}>
          <View
            style={[
              styles.mapHeaderBadge,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.mapHeaderTitle, { color: colors.brandDeep }]} numberOfLines={1}>
              {headerTitle}
            </Text>
          </View>
        </View>
      ) : null}
      <View
        style={[
          styles.mapSpotLayer,
          {
            width: '100%',
            height: displayH,
            backgroundColor: colors.surfaceAlt,
          },
        ]}
      >
        {spotNodes}
      </View>
    </>,
  );
}

const styles = StyleSheet.create({
  mapFrame: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    flexDirection: 'column',
  },
  mapHeaderRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  mapHeaderBadge: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    maxWidth: '92%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapHeaderTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.25,
    textAlign: 'center',
  },
  mapSpotLayer: {
    position: 'relative',
    alignSelf: 'stretch',
  },
  emptyText: {
    fontSize: 14,
    padding: spacing.md,
  },
  spotWrap: {
    position: 'absolute',
    padding: 0.5,
  },
  spotInner: {
    flex: 1,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 1,
  },
  spotLabel: {
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 0.5 },
    textShadowRadius: 2,
  },
});
