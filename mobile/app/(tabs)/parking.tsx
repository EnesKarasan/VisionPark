import { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
  ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../../src/auth';
import { useParkingSpotFlowContext } from '../../src/ParkingSpotFlowContext';
import { spacing, radius, fontSize, fontWeight, shadow } from '../../constants/Theme';
import { AuthBottomSheet } from '../../components/AuthBottomSheet';

const SPOT_PADDING = 16;

const TAB_BAR_EXTRA = 172;

const SERVICE_PARK_BG = '#0c3558';
const SERVICE_RESERVE_BG = '#f2c01a';
const SERVICE_PARK_FG = '#ffffff';
const SERVICE_PARK_FG_MUTED = 'rgba(255,255,255,0.82)';
const SERVICE_PARK_ICON = '#a8bdd4';
const SERVICE_RESERVE_FG = '#0f172a';
const SERVICE_RESERVE_FG_MUTED = 'rgba(15,23,42,0.78)';
const SERVICE_RESERVE_ICON = '#854d0e';

const SERVICE_CARD_GAP = spacing.md;

type ParkingTabParams = { suggestedSpotId?: number };

export default function ParkingScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const route = useRoute<RouteProp<{ parking: ParkingTabParams }, 'parking'>>();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const [enterKey, setEnterKey] = useState(0);
  const prevFocusedRef = useRef(false);

  const [pendingSuggestedSpotId, setPendingSuggestedSpotId] = useState<number | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<'/park-now' | '/reserve-now' | null>(null);

  const handleServicePress = (destination: '/park-now' | '/reserve-now') => {
    if (!token) {
      setPendingRoute(destination);
      setAuthOpen(true);
      return;
    }
    router.push(destination);
  };

  const {
    colors,
    spots,
    loading,
    refreshing,
    setRefreshing,
    load,
    activeSession,
    setHighlightSpotId,
    setUiSelectedSpotId,
    handleStartPark,
    showAlert,
    confirmAction,
  } = useParkingSpotFlowContext();

  useEffect(() => {
    const raw = route.params?.suggestedSpotId;
    if (raw == null) return;
    const sid = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(sid)) return;
    setPendingSuggestedSpotId(sid);
    navigation.setParams({ suggestedSpotId: undefined } as never);
  }, [route.params?.suggestedSpotId, navigation]);

  useEffect(() => {
    if (isFocused && !prevFocusedRef.current) {
      setEnterKey((k) => k + 1);
    }
    prevFocusedRef.current = isFocused;
  }, [isFocused]);

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

    setHighlightSpotId(sid);

    if (token && !activeSession) {
      confirmAction(
        'Park Et',
        `${spot.spot_number} numaralı boş alanda park etmek istiyor musunuz?`,
        () => void handleStartPark(sid),
        () => {
          setHighlightSpotId(null);
          setUiSelectedSpotId(null);
        },
      );
    }
  }, [
    pendingSuggestedSpotId,
    spots,
    token,
    activeSession,
    showAlert,
    confirmAction,
    handleStartPark,
    setHighlightSpotId,
    setUiSelectedSpotId,
  ]);

  useEffect(() => {
    if (isFocused) return;
    setHighlightSpotId(null);
    setUiSelectedSpotId(null);
  }, [isFocused, setHighlightSpotId, setUiSelectedSpotId]);

  const contentWidth = useMemo(() => Math.max(280, windowWidth - SPOT_PADDING * 2), [windowWidth]);
  const serviceCardSize = useMemo(
    () => Math.min((contentWidth - SERVICE_CARD_GAP) / 2, 200),
    [contentWidth],
  );
  const serviceCardRadius = useMemo(
    () => Math.min(32, Math.round(serviceCardSize * 0.2)),
    [serviceCardSize],
  );

  const heroHeight = Math.round((contentWidth * 9) / 16);
  const pageBg = colors.surfaceAlt;

  if (loading && !spots) {
    return (
      <View style={[s.centered, { backgroundColor: pageBg }]}>
        <ActivityIndicator size="large" color={colors.brandDeep} />
        <Text style={[s.loadingText, { color: colors.textSecondary }]}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: pageBg }]}>
      <ScrollView
        contentContainerStyle={[s.listContent, { paddingBottom: spacing.xl + TAB_BAR_EXTRA + insets.bottom }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.brandDeep}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Animated.View key={enterKey} entering={SlideInDown.duration(420)}>
          <View style={s.serviceRow}>
            <TouchableOpacity
              style={[
                s.serviceCardSquare,
                {
                  width: serviceCardSize,
                  height: serviceCardSize,
                  borderRadius: serviceCardRadius,
                  backgroundColor: SERVICE_PARK_BG,
                },
                shadow.md,
              ]}
              onPress={() => handleServicePress('/park-now')}
              activeOpacity={0.85}
            >
              <View style={s.serviceCardInner}>
                <View style={s.serviceCardText}>
                  <Text style={[s.serviceCardTitle, { color: SERVICE_PARK_FG }]} numberOfLines={2}>
                    Hemen Park Et
                  </Text>
                  <Text style={[s.serviceCardDesc, { color: SERVICE_PARK_FG_MUTED }]} numberOfLines={3}>
                    Boş bir alan seçin, anında park edin
                  </Text>
                </View>
                <MaterialCommunityIcons name="car" size={36} color={SERVICE_PARK_ICON} style={s.serviceCardIcon} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                s.serviceCardSquare,
                {
                  width: serviceCardSize,
                  height: serviceCardSize,
                  borderRadius: serviceCardRadius,
                  backgroundColor: SERVICE_RESERVE_BG,
                },
                shadow.md,
              ]}
              onPress={() => handleServicePress('/reserve-now')}
              activeOpacity={0.85}
            >
              <View style={s.serviceCardInner}>
                <View style={s.serviceCardText}>
                  <Text style={[s.serviceCardTitle, { color: SERVICE_RESERVE_FG }]} numberOfLines={2}>
                    Rezervasyon Yap
                  </Text>
                  <Text style={[s.serviceCardDesc, { color: SERVICE_RESERVE_FG_MUTED }]} numberOfLines={3}>
                    Gün içi saat seçin, yer ayırtın, sonra park edin
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="calendar-clock"
                  size={36}
                  color={SERVICE_RESERVE_ICON}
                  style={s.serviceCardIcon}
                />
              </View>
            </TouchableOpacity>
          </View>

          <View style={[s.heroCard, { width: contentWidth, height: heroHeight }, shadow.lg]}>
            <ImageBackground
              source={require('../../assets/parking-lot-hero.jpg')}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              accessibilityRole="image"
              accessibilityLabel="Otopark görüntüsü"
            >
              <LinearGradient
                colors={['rgba(15,23,42,0.72)', 'rgba(15,23,42,0.38)', 'rgba(15,23,42,0.55)']}
                locations={[0, 0.45, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View style={s.heroTextBlock} pointerEvents="none">
                <Text style={s.heroTitle}>Park yerlerine göz atın</Text>
              </View>
            </ImageBackground>
          </View>
        </Animated.View>
      </ScrollView>

      <AuthBottomSheet
        visible={authOpen}
        onClose={() => {
          setAuthOpen(false);
          setPendingRoute(null);
        }}
        onAuthenticated={() => {
          setAuthOpen(false);
          const dest = pendingRoute;
          setPendingRoute(null);
          if (dest) router.push(dest);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: spacing.md, fontSize: fontSize.sm },
  listContent: { padding: SPOT_PADDING, paddingBottom: spacing.xl },

  heroCard: {
    alignSelf: 'center',
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  heroTextBlock: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
    lineHeight: 28,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },

  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SERVICE_CARD_GAP,
    marginBottom: spacing.md,
    alignSelf: 'stretch',
  },
  serviceCardSquare: {
    borderWidth: 2,
    borderColor: 'transparent',
    padding: spacing.md,
    overflow: 'hidden',
  },
  serviceCardInner: {
    flex: 1,
    justifyContent: 'space-between',
  },
  serviceCardText: {
    flexShrink: 1,
  },
  serviceCardIcon: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
  },
  serviceCardTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
  },
  serviceCardDesc: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
});
