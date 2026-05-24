import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/auth';
import { HomeHeaderLogo } from '../components/HomeHeaderLogo';

export default function Index() {
  const { initialized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!initialized) return;
    router.replace('/(tabs)');
  }, [initialized, router]);

  return (
    <LinearGradient
      colors={['#0a1f33', '#153a5c', '#1e4a76', '#153a5c', '#0a1f33']}
      style={styles.container}
    >
      <Animated.View entering={FadeIn.duration(700)} style={styles.content}>
        <View style={styles.logoWrap}>
          <HomeHeaderLogo color="#ffffff" />
        </View>
        <Animated.Text entering={FadeInUp.duration(700).delay(150)} style={styles.title}>
          VisionPark
        </Animated.Text>
        <Animated.Text entering={FadeInUp.duration(700).delay(300)} style={styles.tagline}>
          Akıllı Otopark Yönetimi
        </Animated.Text>
        <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" style={styles.spinner} />
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoWrap: {
    marginBottom: 20,
    transform: [{ scale: 1.6 }],
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1.2,
    marginTop: 8,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
    marginTop: 6,
  },
  spinner: {
    marginTop: 32,
  },
});
