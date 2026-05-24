import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { getThemeColors } from '@/constants/Theme';
import { radius } from '@/constants/Theme';

const TAB_ICON = 22;
/** Orta FAB — büyük; yan tab çizgisi eski sıkı ölçüde */
const FAB_SIZE = 60;
/** Yan sekmeler — sadece ikon */
const SIDE_ICON_SLOT_HEIGHT = 22;
/** FAB’ın oturduğu kısa slot (FAB_SIZE − bu değer ≈ üstte taşan yükseklik) */
const FAB_ANCHOR_HEIGHT = 46;
/** Satır alt iç boşluğu — FAB `bottom: -bu` ile beyaz şeridin en altına hizalanır */
const ROW_PAD_BOTTOM = 4;
/** FAB arka plan — koyu mavi (navy[800]) */
const FAB_BACKGROUND = '#0f2840';
/** FAB içi park (P) ikonu */
const FAB_ICON_COLOR = '#ffffff';
const FAB_BORDER_COLOR = '#ffffff';
const FAB_BORDER_WIDTH = 2.5;
/** Tab barı yukarı kaydırır (içerik üzerine bindirir) */
const TAB_BAR_LIFT = 88;

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = getThemeColors(colorScheme);

  const inactiveColor = colors.textTertiary;
  const activeColor = colors.brandDeep;

  const fabShadow = Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius: 8,
    },
    android: { elevation: 10 },
    web: { boxShadow: '0 6px 16px rgba(0,0,0,0.2)' },
    default: { elevation: 10 },
  });

  return (
    <View
      style={[
        styles.backdrop,
        {
          marginTop: -TAB_BAR_LIFT,
          paddingBottom: insets.bottom,
          backgroundColor: colors.surfaceAlt,
          borderTopColor: colors.border,
          zIndex: 100,
          elevation: 24,
        },
      ]}
    >
      <View
        style={[
          styles.whiteSheet,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            ...Platform.select({
              ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -1 },
                shadowOpacity: 0.06,
                shadowRadius: 4,
              },
              android: { elevation: 2 },
              web: { boxShadow: '0 -2px 10px rgba(0,0,0,0.06)' },
              default: { elevation: 2 },
            }),
          },
        ]}
      >
        <View style={styles.row}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const { options } = descriptors[route.key];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const label =
            route.name === 'index'
              ? 'Ana Sayfa'
              : route.name === 'profile'
                ? 'Profil'
                : route.name === 'parking'
                  ? 'Park'
                  : (options.title as string) ?? route.name;

          const iconName: keyof typeof Ionicons.glyphMap =
            route.name === 'index'
              ? isFocused
                ? 'home'
                : 'home-outline'
              : route.name === 'profile'
                ? isFocused
                  ? 'person'
                  : 'person-outline'
                : 'ellipse-outline';

          const color = isFocused ? activeColor : inactiveColor;

          const isParking = route.name === 'parking';

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              onLongPress={onLongPress}
              style={[styles.sideTab, isParking && styles.sideTabParking]}
            >
              <View
                style={[
                  styles.iconSlot,
                  isParking ? styles.fabAnchor : null,
                  { height: isParking ? FAB_ANCHOR_HEIGHT : SIDE_ICON_SLOT_HEIGHT },
                ]}
              >
                {isParking ? (
                  <View
                    style={[
                      styles.fab,
                      {
                        bottom: -ROW_PAD_BOTTOM,
                        backgroundColor: FAB_BACKGROUND,
                        borderWidth: FAB_BORDER_WIDTH,
                        borderColor: FAB_BORDER_COLOR,
                      },
                      fabShadow,
                    ]}
                  >
                    <MaterialCommunityIcons name="parking" size={28} color={FAB_ICON_COLOR} />
                  </View>
                ) : (
                  <Ionicons name={iconName} size={TAB_ICON} color={color} />
                )}
              </View>
            </Pressable>
          );
        })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Tab bar dışı: gri alan (FAB üst boşluğu + alt güvenli alan) */
  backdrop: {
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'visible',
  },
  /** İkonların durduğu beyaz şerit */
  whiteSheet: {
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    overflow: 'visible',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingTop: 2,
    paddingBottom: ROW_PAD_BOTTOM,
    overflow: 'visible',
  },
  iconSlot: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  fabAnchor: {
    position: 'relative',
    overflow: 'visible',
    justifyContent: 'flex-end',
  },
  sideTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    overflow: 'visible',
  },
  sideTabParking: {
    justifyContent: 'flex-end',
  },
  fab: {
    position: 'absolute',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
