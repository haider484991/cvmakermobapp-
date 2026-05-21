/**
 * Premium Import Hero
 *
 * Headline card for the dashboard — sells "upload your old resume, AI
 * rebuilds it" as the primary value prop. Uses a vivid gradient + sparkle
 * accents to feel premium, falls back to a staged loading sequence while
 * the AI parser is working so the wait feels progressive instead of dead.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  FadeIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Sparkles, Upload, Wand2 } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useResumeImport } from '@/hooks/useResumeImport';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PARSING_STAGES = [
  'Reading your resume…',
  'Extracting your experience…',
  'Polishing the layout…',
  'Almost ready…',
];

interface Props {
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export function PremiumImportHero({ onPress, disabled = false, style }: Props) {
  const { colors, isDark } = useTheme();
  const { hapticEnabled } = useUIStore();
  const { isLoading, status } = useResumeImport();

  // Press scale animation
  const scale = useSharedValue(1);
  const pressedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.97, { damping: 18, stiffness: 220 });
  }, [scale]);
  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 18, stiffness: 220 });
  }, [scale]);

  // Sparkle pulse animation
  const sparkleScale = useSharedValue(1);
  useEffect(() => {
    sparkleScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 900 }),
        withTiming(1, { duration: 900 }),
      ),
      -1,
      true,
    );
  }, [sparkleScale]);
  const sparkleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sparkleScale.value }],
  }));

  // Staged loading message — rotates while parsing so the wait feels alive.
  const [stageIndex, setStageIndex] = useState(0);
  useEffect(() => {
    if (status !== 'parsing') {
      setStageIndex(0);
      return;
    }
    const t = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, PARSING_STAGES.length - 1));
    }, 2000);
    return () => clearInterval(t);
  }, [status]);

  const loadingMessage =
    status === 'selecting_file'
      ? 'Choose your resume file'
      : status === 'reading_file'
        ? PARSING_STAGES[0]
        : status === 'parsing'
          ? PARSING_STAGES[stageIndex]
          : status === 'importing'
            ? 'Building your new resume…'
            : '';

  const handlePress = useCallback(() => {
    if (disabled || isLoading) return;
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPress();
  }, [disabled, isLoading, hapticEnabled, onPress]);

  const gradientColors = isDark
    ? (['#7C3AED', '#2563EB', '#0891B2'] as const)
    : (['#8B5CF6', '#3B82F6', '#06B6D4'] as const);

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled || isLoading}
      style={[
        pressedStyle,
        {
          borderRadius: 22,
          overflow: 'hidden',
          opacity: disabled ? 0.6 : 1,
          shadowColor: '#3B82F6',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25,
          shadowRadius: 16,
          elevation: 8,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          padding: 20,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {/* Icon Bubble */}
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            backgroundColor: 'rgba(255,255,255,0.22)',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 16,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.35)',
          }}
        >
          {isLoading ? (
            <Animated.View style={sparkleStyle}>
              <Wand2 size={26} color="white" strokeWidth={2.4} />
            </Animated.View>
          ) : (
            <Upload size={26} color="white" strokeWidth={2.4} />
          )}
        </View>

        {/* Copy */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Animated.View style={sparkleStyle}>
              <Sparkles size={14} color="#FCD34D" />
            </Animated.View>
            <Text
              style={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1.2,
                marginLeft: 6,
              }}
            >
              AI POWERED
            </Text>
          </View>

          {isLoading ? (
            <Animated.Text
              key={loadingMessage}
              entering={FadeIn.duration(220)}
              style={{
                color: 'white',
                fontSize: 17,
                fontWeight: '700',
                marginTop: 4,
              }}
            >
              {loadingMessage}
            </Animated.Text>
          ) : (
            <>
              <Text
                style={{
                  color: 'white',
                  fontSize: 17,
                  fontWeight: '800',
                  marginTop: 4,
                }}
              >
                Have a resume already?
              </Text>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                Upload PDF, Word, or a photo — AI rebuilds it in 10 seconds.
              </Text>
            </>
          )}
        </View>
      </LinearGradient>
    </AnimatedPressable>
  );
}

export default PremiumImportHero;
