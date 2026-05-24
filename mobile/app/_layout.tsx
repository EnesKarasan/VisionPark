import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import 'react-native-gesture-handler';
import 'react-native-reanimated';

import { Ionicons, MaterialCommunityIcons, MaterialIcons, FontAwesome } from '@expo/vector-icons';

import { useColorScheme } from '@/components/useColorScheme';
import { getThemeColors } from '@/constants/Theme';
import { AuthProvider } from '../src/auth';
import { ParkingSpotFlowProvider } from '../src/ParkingSpotFlowContext';
import { PreferencesProvider } from '../src/preferences';
import { HelpProvider } from '../src/help/HelpContext';
import HelpButton from '../components/HelpButton';
import type { HelpKey } from '../src/help/helpContent';

function helpHeaderRight(key: HelpKey) {
  return () => <HelpButton entryKey={key} />;
}

const HEADER_FG = '#ffffff';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
    ...MaterialIcons.font,
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <PreferencesProvider>
        <HelpProvider>
          <RootLayoutNav />
        </HelpProvider>
      </PreferencesProvider>
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const colors = getThemeColors(colorScheme);
  const navTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider value={navTheme}>
      <ParkingSpotFlowProvider>
        <Stack
          screenOptions={{
            headerTitleAlign: 'center',
          }}
        >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="settings"
          options={{
            title: 'Ayarlar',
            headerStyle: {
              backgroundColor: colors.secondary,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.tabBarBorder,
            },
            headerTintColor: HEADER_FG,
            headerTitleStyle: { color: HEADER_FG, fontWeight: '600', fontSize: 18 },
            headerRight: helpHeaderRight('settings'),
          }}
        />
        <Stack.Screen
          name="parking-history"
          options={{
            title: 'Park geçmişi',
            headerStyle: {
              backgroundColor: colors.secondary,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.tabBarBorder,
            },
            headerTintColor: HEADER_FG,
            headerTitleStyle: { color: HEADER_FG, fontWeight: '600', fontSize: 18 },
            headerRight: helpHeaderRight('parking-history'),
          }}
        />
        <Stack.Screen
          name="my-cars"
          options={{
            title: 'Arabalarım',
            headerStyle: {
              backgroundColor: colors.secondary,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.tabBarBorder,
            },
            headerTintColor: HEADER_FG,
            headerTitleStyle: { color: HEADER_FG, fontWeight: '600', fontSize: 18 },
            headerRight: helpHeaderRight('my-cars'),
          }}
        />
        <Stack.Screen
          name="payment-cards"
          options={{
            title: 'Ödeme Yöntemleri',
            headerStyle: {
              backgroundColor: colors.secondary,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.tabBarBorder,
            },
            headerTintColor: HEADER_FG,
            headerTitleStyle: { color: HEADER_FG, fontWeight: '600', fontSize: 18 },
            headerRight: helpHeaderRight('payment-cards'),
          }}
        />
        <Stack.Screen
          name="park-now"
          options={{
            title: 'Hemen Park Et',
            headerStyle: {
              backgroundColor: colors.secondary,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.tabBarBorder,
            },
            headerTintColor: HEADER_FG,
            headerTitleStyle: { color: HEADER_FG, fontWeight: '600', fontSize: 18 },
            headerRight: helpHeaderRight('park-now'),
          }}
        />
        <Stack.Screen
          name="reserve-now"
          options={{
            title: 'Rezervasyon',
            headerStyle: {
              backgroundColor: colors.secondary,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.tabBarBorder,
            },
            headerTintColor: HEADER_FG,
            headerTitleStyle: { color: HEADER_FG, fontWeight: '600', fontSize: 18 },
            headerRight: helpHeaderRight('reserve-now'),
          }}
        />
        <Stack.Screen
          name="park-entry-qr"
          options={{
            title: 'Giriş QR’ı',
            headerStyle: {
              backgroundColor: colors.secondary,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.tabBarBorder,
            },
            headerTintColor: HEADER_FG,
            headerTitleStyle: { color: HEADER_FG, fontWeight: '600', fontSize: 18 },
            headerRight: helpHeaderRight('park-entry-qr'),
          }}
        />
        <Stack.Screen
          name="parking-detail"
          options={{
            title: 'Park Detayı',
            headerStyle: {
              backgroundColor: colors.secondary,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.tabBarBorder,
            },
            headerTintColor: HEADER_FG,
            headerTitleStyle: { color: HEADER_FG, fontWeight: '600', fontSize: 18 },
            headerRight: helpHeaderRight('parking-detail'),
          }}
        />
        <Stack.Screen
          name="park-exit-qr"
          options={{
            title: 'Çıkış QR’ı',
            headerStyle: {
              backgroundColor: colors.secondary,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.tabBarBorder,
            },
            headerTintColor: HEADER_FG,
            headerTitleStyle: { color: HEADER_FG, fontWeight: '600', fontSize: 18 },
            headerRight: helpHeaderRight('park-exit-qr'),
          }}
        />
        <Stack.Screen
          name="help"
          options={{
            title: 'Yardım ve Rehber',
            headerStyle: {
              backgroundColor: colors.secondary,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.tabBarBorder,
            },
            headerTintColor: HEADER_FG,
            headerTitleStyle: { color: HEADER_FG, fontWeight: '600', fontSize: 18 },
          }}
        />
        </Stack>
      </ParkingSpotFlowProvider>
    </ThemeProvider>
  );
}
