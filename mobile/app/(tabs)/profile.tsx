import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { AccountProfileCard } from '../../components/AccountProfileCard';
import { AuthBottomSheet } from '../../components/AuthBottomSheet';
import { useAuth } from '../../src/auth';
import { spacing, fontSize, fontWeight } from '../../constants/Theme';
import { useTheme } from '../../constants/useTheme';

const LOGOUT_SLIDE_MS = 300;
const MENU_ICON_COL = 40;
const MENU_ICON_SIZE = 24;
const TAB_BAR_EXTRA = 172;

type TabsParamList = {
  index: undefined;
  parking: undefined;
  profile: undefined;
};

function Chevron({ color }: { color: string }) {
  return <Ionicons name="chevron-forward" size={22} color={color} />;
}

type MenuRowProps = {
  label: string;
  icon: React.ReactNode;
  accent: string;
  onPress?: () => void;
  showChevron?: boolean;
  isLast?: boolean;
  destructive?: boolean;
};

function MenuRow({
  label,
  icon,
  accent,
  onPress,
  showChevron = true,
  isLast,
  destructive,
}: MenuRowProps) {
  const colors = useTheme();
  const content = (
    <View
      style={[
        styles.menuRow,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.menuIconSlot}>{icon}</View>
      <Text
        style={[
          styles.menuLabel,
          { color: destructive ? accent : colors.text },
          Platform.select({
            android: { textAlignVertical: 'center' as const, includeFontPadding: false },
          }),
        ]}
      >
        {label}
      </Text>
      {showChevron ? <Chevron color={accent} /> : <View style={styles.chevronSpacer} />}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.65} accessibilityRole="button">
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

export default function ProfileTabScreen() {
  const router = useRouter();
  const navigation = useNavigation<BottomTabNavigationProp<TabsParamList>>();
  const { width: windowW } = useWindowDimensions();
  const colors = useTheme();
  const colorScheme = useColorScheme();
  const { token, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [authOpen, setAuthOpen] = useState(false);
  const logoutShift = useSharedValue(0);

  const logoutAnimStyle = useAnimatedStyle(() => ({
    flex: 1,
    transform: [{ translateX: logoutShift.value }],
  }));

  const isFocused = useIsFocused();

  const goToHomeTab = useCallback(() => {
    navigation.navigate('index');
  }, [navigation]);

  const finishLogoutAndGoHome = useCallback(() => {
    logout();
    navigation.navigate('index');
    logoutShift.value = 0;
  }, [logout, navigation, logoutShift]);

  const handleLogout = useCallback(() => {
    logoutShift.value = withTiming(
      windowW,
      { duration: LOGOUT_SLIDE_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finishLogoutAndGoHome)();
      },
    );
  }, [windowW, logoutShift, finishLogoutAndGoHome]);

  return (
    <Animated.View style={logoutAnimStyle}>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        {isFocused ? <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} /> : null}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: spacing.xxxl + TAB_BAR_EXTRA + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          bounces
        >
          <View style={styles.topSpacer} />

          {token ? <AccountProfileCard token={token} /> : null}

          {!token ? (
            <TouchableOpacity
              style={[styles.singleCard, { backgroundColor: colors.surface }]}
              onPress={() => setAuthOpen(true)}
              activeOpacity={0.65}
              accessibilityRole="button"
              accessibilityLabel="Giriş yap"
            >
              <View style={styles.menuIconSlot}>
                <Ionicons name="person" size={MENU_ICON_SIZE} color={colors.brandDeep} />
              </View>
              <Text
                style={[
                  styles.menuLabel,
                  { color: colors.text },
                  Platform.select({
                    android: { textAlignVertical: 'center' as const, includeFontPadding: false },
                  }),
                ]}
              >
                Giriş Yap
              </Text>
              <Chevron color={colors.brandDeep} />
            </TouchableOpacity>
          ) : null}

          <View style={styles.gapAfterLogin} />

          <View style={[styles.groupCard, { backgroundColor: colors.surface }]}>
            <MenuRow
              label="Park geçmişim"
              icon={<Ionicons name="time-outline" size={MENU_ICON_SIZE} color={colors.brandDeep} />}
              accent={colors.brandDeep}
              onPress={() => router.push('/parking-history')}
              isLast={false}
            />
            <MenuRow
              label="Arabalarım"
              icon={<Ionicons name="car-sport-outline" size={MENU_ICON_SIZE} color={colors.brandDeep} />}
              accent={colors.brandDeep}
              onPress={() => router.push('/my-cars')}
              isLast={false}
            />
            <MenuRow
              label="Kartlarım"
              icon={<Ionicons name="card-outline" size={MENU_ICON_SIZE} color={colors.brandDeep} />}
              accent={colors.brandDeep}
              onPress={() => router.push('/payment-cards')}
              isLast={false}
            />
            <MenuRow
              label="Ayarlar"
              icon={<Ionicons name="settings-outline" size={MENU_ICON_SIZE} color={colors.brandDeep} />}
              accent={colors.brandDeep}
              onPress={() => router.push('/settings')}
              isLast={false}
            />
            <MenuRow
              label="Yardım ve Rehber"
              icon={<Ionicons name="help-buoy-outline" size={MENU_ICON_SIZE} color={colors.brandDeep} />}
              accent={colors.brandDeep}
              onPress={() => router.push('/help')}
              isLast={!token}
            />
            {token ? (
              <MenuRow
                label="Çıkış yap"
                icon={<Ionicons name="log-out-outline" size={MENU_ICON_SIZE} color={colors.danger} />}
                accent={colors.danger}
                onPress={handleLogout}
                showChevron={false}
                destructive
                isLast
              />
            ) : null}
          </View>

          <View style={styles.bottomPad} />
        </ScrollView>

        <AuthBottomSheet
          visible={authOpen}
          onClose={() => setAuthOpen(false)}
          onAuthenticated={goToHomeTab}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.lg,
  },
  topSpacer: {
    height: spacing.md,
  },
  gapAfterLogin: {
    height: spacing.lg,
  },
  singleCard: {
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupCard: {
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
  },
  menuLabel: {
    flex: 1,
    fontSize: fontSize.md,
    lineHeight: 22,
    fontWeight: fontWeight.medium,
  },
  menuIconSlot: {
    width: MENU_ICON_COL,
    height: MENU_ICON_COL,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  chevronSpacer: {
    width: 22,
  },
  bottomPad: {
    height: spacing.xl,
  },
});
