import { View, Text, ActivityIndicator, Image } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { GradientBackground } from '@/components/ui';

/**
 * Index/Splash screen
 *
 * This screen is shown briefly while the AuthGuard in _layout.tsx
 * determines where to redirect the user based on their auth state.
 */
export default function Index() {
  return (
    <GradientBackground>
      <View className="flex-1 items-center justify-center px-8">
        {/* Logo */}
        <Animated.View entering={FadeIn.duration(600)}>
          <Image
            source={require('../assets/icon.png')}
            style={{ width: 140, height: 140, marginBottom: 20 }}
            resizeMode="contain"
          />
        </Animated.View>

        {/* App Name */}
        <Animated.Text
          entering={FadeInUp.delay(200).duration(500)}
          className="text-3xl font-bold text-white mb-2"
        >
          FreeResume AI
        </Animated.Text>

        {/* Tagline */}
        <Animated.Text
          entering={FadeInUp.delay(400).duration(500)}
          className="text-base text-white/80 mb-8"
        >
          Smart & Free CV Builder
        </Animated.Text>

        {/* Loading Indicator */}
        <Animated.View entering={FadeIn.delay(600).duration(400)}>
          <ActivityIndicator size="large" color="white" />
        </Animated.View>
      </View>
    </GradientBackground>
  );
}
