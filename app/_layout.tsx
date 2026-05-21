import '../global.css';
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useAppOpenAd } from '@/hooks/useAppOpenAd';
import { useUIStore } from '@/stores/uiStore';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { adPreloader, interstitialAd, adsInit } from '@/services/ads';
import { initI18n } from '@/i18n';
import { recordSession } from '@/services/review/reviewManager';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitialized } = useAuth();
  const { onboardingCompleted } = useUIStore();
  const segments = useSegments();
  const router = useRouter();
  const { colors } = useTheme();

  if (__DEV__) {
    console.log('[AuthGuard] State:', { isAuthenticated, isInitialized, segments: segments.join('/') });
  }

  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';
    const inMainGroup = segments[0] === '(main)';
    const isOnIndex = !segments[0] || segments.join('/') === '';

    // Guest-friendly flow: No forced login
    // Users can access the app without authentication

    if (isAuthenticated && inAuthGroup) {
      // User is authenticated but on auth screens
      // Redirect to dashboard or onboarding
      if (onboardingCompleted) {
        router.replace('/(main)/dashboard');
      } else {
        router.replace('/(onboarding)/welcome');
      }
    } else if (isOnIndex) {
      // User is on index/root page
      // Redirect to onboarding or dashboard based on status
      if (onboardingCompleted) {
        router.replace('/(main)/dashboard');
      } else {
        router.replace('/(onboarding)/welcome');
      }
    } else if (!onboardingCompleted && inMainGroup) {
      // User hasn't completed onboarding but trying to access main
      // Redirect to onboarding
      router.replace('/(onboarding)/welcome');
    }
  }, [isAuthenticated, isInitialized, segments, onboardingCompleted]);

  // Show loading screen while checking initial auth state
  if (!isInitialized) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.primary,
        }}
      >
        <ActivityIndicator size="large" color="white" />
      </View>
    );
  }

  return <>{children}</>;
}

function RootLayoutNav() {
  const { isDark, colors } = useTheme();

  // Kick off the ad pipeline: gather UMP consent, initialize MobileAds,
  // then warm the rewarded + interstitial pools. Each step is independently
  // safe to fail (Expo Go, missing module, no network).
  useEffect(() => {
    (async () => {
      const ready = await adsInit.ready();
      if (!ready) return;
      adPreloader.preload();
      interstitialAd.preload();
    })();
  }, []);

  // App Open Ad on cold launch (frequency-capped to 1 per 4h, skipped on
  // very first launch so users actually reach the dashboard).
  useAppOpenAd();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthGuard>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
          <Stack.Screen name="(onboarding)" options={{ animation: 'fade' }} />
          <Stack.Screen name="(main)" options={{ animation: 'fade' }} />
          <Stack.Screen name="resume" />
        </Stack>
      </AuthGuard>
    </>
  );
}

export default function RootLayout() {
  // i18next must be initialized BEFORE any screen renders, otherwise the
  // first paint shows raw key paths until translations load. We block the
  // first frame on init (takes <20ms in practice, all bundled JSON), then
  // render the full app.
  const [i18nReady, setI18nReady] = useState(false);
  useEffect(() => {
    initI18n().finally(() => setI18nReady(true));
    // Count this launch toward review-eligibility (idempotent per day).
    recordSession().catch(() => {});
  }, []);

  if (!i18nReady) {
    // Brief loading flash — intentionally minimal so users don't notice
    // a multi-stage startup. Splash screen still owns the visual.
    return <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <RootLayoutNav />
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
