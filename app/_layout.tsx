import '../global.css';
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useAppOpenAd } from '@/hooks/useAppOpenAd';
import { useUIStore } from '@/stores/uiStore';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { adPreloader, interstitialAd, adsInit } from '@/services/ads';
import { usePremium } from '@/hooks/usePremium';
import { initI18n } from '@/i18n';
import { recordSession } from '@/services/review/reviewManager';
import { initSentry } from '@/services/analytics/sentry';
import { track, ANALYTICS_EVENTS, flushAnalytics } from '@/services/analytics/analytics';
import { initPurchases } from '@/services/purchases/purchases';

// Initialize Sentry as early as possible so it can catch crashes during
// the very first render. Safe no-op if DSN env var isn't configured.
initSentry();

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

  // Premium users see zero ads. We still init the ad SDK + UMP for free
  // users via the hooks below.
  const { isPremium } = usePremium();

  // Kick off the ad pipeline: gather UMP consent, initialize MobileAds,
  // then warm the rewarded + interstitial pools. Skipped entirely for
  // premium users. Safe to fail at any step (Expo Go, missing module,
  // no network).
  useEffect(() => {
    if (isPremium) return;
    (async () => {
      const ready = await adsInit.ready();
      if (!ready) return;
      adPreloader.preload();
      interstitialAd.preload();
    })();
  }, [isPremium]);

  // App Open Ad on cold launch (frequency-capped to 1 per 4h, skipped on
  // very first launch so users actually reach the dashboard). The hook
  // itself short-circuits for premium users — see useAppOpenAd.ts.
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

  // Load Inter (v1.9.0 — premium typography). Bundled offline via
  // @expo-google-fonts/inter so resume templates render with the same
  // face on every device. We block the first paint until fonts are
  // loaded so templates never flash with the system fallback first.
  // Note: react-native-print/expo-print uses these via WOFF2 base64
  // embedding for the PDF export (handled separately in the HTML engine).
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    // Playfair Display: display-only face used by Executive + Academic
    // template names. Per research, only loaded at 24pt+ where the thin
    // strokes can breathe. Body text in those templates stays on Inter
    // (or Georgia for academic-serif PDF) to preserve readability.
    PlayfairDisplay_700Bold,
  });
  // Treat load failure as "ready" — Inter falls back to system sans, which
  // is fine. Better to render with the wrong face than hang on the splash.
  const fontsReady = fontsLoaded || !!fontError;
  useEffect(() => {
    if (fontError) {
      track('font_load_failed' as any, {
        message: (fontError.message || String(fontError)).slice(0, 200),
      });
    }
  }, [fontError]);

  useEffect(() => {
    initI18n().finally(() => setI18nReady(true));
    // Count this launch toward review-eligibility (idempotent per day).
    recordSession().catch(() => {});
    // Analytics: log app open + flush any queued events from prior session.
    track(ANALYTICS_EVENTS.APP_OPENED);
    flushAnalytics().catch(() => {});
    // Connect to Google Play Billing + refresh entitlement. Safe no-op
    // in Expo Go (native module unavailable). Doesn't block render —
    // the persisted snapshot from last session is authoritative until
    // this finishes.
    initPurchases().catch(() => {});
  }, []);

  if (!i18nReady || !fontsReady) {
    // Brief loading flash — intentionally minimal so users don't notice
    // a multi-stage startup. Splash screen still owns the visual.
    // Fonts typically load in <100ms from bundled assets; if they fail
    // we still render (Inter falls back to system sans which is fine).
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
