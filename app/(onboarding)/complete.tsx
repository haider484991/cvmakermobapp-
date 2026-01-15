/**
 * Complete Screen
 * Final onboarding screen with celebration animation
 */

import { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeInUp,
  FadeIn,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { Rocket, FileText, Sparkles, Download } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { Confetti, PageIndicator } from '@/components/ui';
import * as Haptics from 'expo-haptics';

// Animated stat card
function StatCard({
  icon: Icon,
  value,
  label,
  delay,
  colors,
}: {
  icon: any;
  value: string;
  label: string;
  delay: number;
  colors: any;
}) {
  const scale = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withSpring(1, { damping: 12, stiffness: 150 })
    );
    rotate.value = withDelay(
      delay,
      withSequence(
        withTiming(-5, { duration: 100 }),
        withSpring(0, { damping: 8 })
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          flex: 1,
          alignItems: 'center',
          padding: 16,
        },
        animatedStyle,
      ]}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          backgroundColor: colors.primary + '15',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}
      >
        <Icon size={24} color={colors.primary} strokeWidth={2} />
      </View>
      <Text
        style={{
          fontSize: 22,
          fontWeight: '700',
          color: colors.primary,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: colors.textSecondary,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

// Animated success icon with ring effect
function SuccessIcon({ colors }: { colors: any }) {
  const scale = useSharedValue(0);
  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(0);

  useEffect(() => {
    // Main icon animation
    scale.value = withDelay(
      200,
      withSpring(1, { damping: 8, stiffness: 100 })
    );

    // Ring pulse animation
    const animateRing = () => {
      ringScale.value = 0.8;
      ringOpacity.value = 0.8;

      ringScale.value = withTiming(1.5, { duration: 1500, easing: Easing.out(Easing.ease) });
      ringOpacity.value = withTiming(0, { duration: 1500, easing: Easing.out(Easing.ease) });
    };

    animateRing();
    const interval = setInterval(animateRing, 2000);
    return () => clearInterval(interval);
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      {/* Pulsing ring */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 140,
            height: 140,
            borderRadius: 70,
            borderWidth: 3,
            borderColor: colors.success,
          },
          ringStyle,
        ]}
      />

      {/* Main icon container */}
      <Animated.View
        style={[
          {
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: colors.success + '20',
            alignItems: 'center',
            justifyContent: 'center',
          },
          iconStyle,
        ]}
      >
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: colors.success + '30',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Rocket size={40} color={colors.success} strokeWidth={1.5} />
        </View>
      </Animated.View>
    </View>
  );
}

export default function Complete() {
  const router = useRouter();
  const { colors } = useTheme();
  const { setOnboardingCompleted } = useUIStore();
  const [showConfetti, setShowConfetti] = useState(false);

  // Button animation
  const buttonScale = useSharedValue(1);
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  // Trigger confetti and haptic on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowConfetti(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setOnboardingCompleted(true);
    router.replace('/(main)/dashboard');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Confetti Effect */}
      <Confetti
        active={showConfetti}
        count={60}
        duration={4000}
        onComplete={() => setShowConfetti(false)}
      />

      <View style={{ flex: 1, paddingHorizontal: 24, paddingVertical: 16 }}>
        {/* Header with Page Indicator */}
        <Animated.View
          entering={FadeIn.delay(100).duration(400)}
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <PageIndicator totalPages={3} currentPage={2} />
        </Animated.View>

        {/* Main Content */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          {/* Success Icon */}
          <SuccessIcon colors={colors} />

          {/* Title */}
          <Animated.Text
            entering={FadeInUp.delay(400).duration(600).springify()}
            style={{
              fontSize: 34,
              fontWeight: '700',
              textAlign: 'center',
              marginTop: 32,
              color: colors.text,
              letterSpacing: -0.5,
            }}
          >
            You're All Set!
          </Animated.Text>

          {/* Subtitle */}
          <Animated.Text
            entering={FadeInUp.delay(500).duration(600)}
            style={{
              fontSize: 17,
              textAlign: 'center',
              lineHeight: 26,
              marginTop: 12,
              paddingHorizontal: 20,
              color: colors.textSecondary,
            }}
          >
            Your personalized resume builder is ready.{'\n'}Let's create something amazing.
          </Animated.Text>

          {/* Stats Card */}
          <Animated.View
            entering={FadeInUp.delay(600).duration(600)}
            style={{
              width: '100%',
              borderRadius: 20,
              backgroundColor: colors.surface,
              marginTop: 40,
              flexDirection: 'row',
              overflow: 'hidden',
            }}
          >
            <StatCard
              icon={FileText}
              value="40+"
              label="Templates"
              delay={700}
              colors={colors}
            />
            <View style={{ width: 1, backgroundColor: colors.border, marginVertical: 16 }} />
            <StatCard
              icon={Sparkles}
              value="AI"
              label="Powered"
              delay={800}
              colors={colors}
            />
            <View style={{ width: 1, backgroundColor: colors.border, marginVertical: 16 }} />
            <StatCard
              icon={Download}
              value="PDF"
              label="Export"
              delay={900}
              colors={colors}
            />
          </Animated.View>
        </View>

        {/* CTA Button */}
        <Animated.View entering={FadeInUp.delay(1000).duration(600)}>
          <Animated.View style={buttonAnimatedStyle}>
            <Pressable
              onPress={handleStart}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={{
                paddingVertical: 18,
                borderRadius: 16,
                alignItems: 'center',
                backgroundColor: colors.primary,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '600' }}>
                Create My Resume
              </Text>
            </Pressable>
          </Animated.View>

          {/* Additional info */}
          <Animated.Text
            entering={FadeIn.delay(1100).duration(500)}
            style={{
              textAlign: 'center',
              marginTop: 16,
              fontSize: 13,
              color: colors.textMuted,
            }}
          >
            Takes just 5 minutes to complete
          </Animated.Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
