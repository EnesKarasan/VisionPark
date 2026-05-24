import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';

import { CustomTabBar } from '@/components/CustomTabBar';
import { HomeHeaderLogo } from '@/components/HomeHeaderLogo';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColorScheme } from '@/components/useColorScheme';
import { getThemeColors } from '@/constants/Theme';
import HelpButton from '../../components/HelpButton';
import type { HelpKey } from '../../src/help/helpContent';

function helpHeaderRight(key: HelpKey) {
  return () => <HelpButton entryKey={key} />;
}

/** Lacivert header üzerinde okunaklı metin / ikon */
const HEADER_FG = '#ffffff';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = getThemeColors(colorScheme);

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        tabBarShowLabel: false,
        headerShown: useClientOnlyValue(false, true),
        headerStyle: {
          backgroundColor: colors.secondary,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.tabBarBorder,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.18,
              shadowRadius: 3,
            },
            android: { elevation: 2 },
            web: { boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.2)' },
            default: { elevation: 2 },
          }),
        },
        headerTintColor: HEADER_FG,
        headerTitleStyle: {
          fontWeight: '600',
          color: HEADER_FG,
          fontSize: 18,
        },
        headerTitleAlign: 'center',
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          overflow: 'visible',
          zIndex: 100,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ana Sayfa',
          headerTitle: () => <HomeHeaderLogo />,
          headerRight: helpHeaderRight('home'),
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="parking"
        options={{
          title: 'Park',
          headerTitle: () => <HomeHeaderLogo />,
          headerRight: helpHeaderRight('parking'),
          tabBarIcon: ({ color, size }) => <Ionicons name="car-sport-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          headerRight: helpHeaderRight('profile'),
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
