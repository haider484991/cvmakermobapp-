import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, Modal, Dimensions, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  interpolate,
  Extrapolation,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  runOnJS,
} from 'react-native-reanimated';
import {
  Sparkles,
  FileText,
  Zap,
  Lightbulb,
  Target,
  X,
  ChevronRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useAI } from '@/hooks/useAI';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AIFloatingButtonProps {
  /**
   * Callback when "Generate Summary" is selected
   */
  onGenerateSummary?: () => void;

  /**
   * Callback when "Enhance All Bullets" is selected
   */
  onEnhanceAllBullets?: () => void;

  /**
   * Callback when "Suggest Skills" is selected
   */
  onSuggestSkills?: () => void;

  /**
   * Callback when "Score Resume" is selected
   */
  onScoreResume?: () => void;

  /**
   * Whether the button is disabled
   */
  disabled?: boolean;

  /**
   * Custom position from bottom
   */
  bottomOffset?: number;

  /**
   * Custom position from right
   */
  rightOffset?: number;
}

interface AIOptionItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onPress: () => void;
  delay?: number;
  isLoading?: boolean;
}

function AIOptionItem({
  icon,
  title,
  description,
  onPress,
  delay = 0,
  isLoading = false,
}: AIOptionItemProps) {
  const { colors } = useTheme();
  const { hapticEnabled } = useUIStore();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  const handlePress = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={SlideInDown.delay(delay).duration(300).springify()}>
      <AnimatedPressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={isLoading}
        style={[
          animatedStyle,
          {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            marginBottom: 8,
            borderRadius: 12,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: isLoading ? 0.6 : 1,
          },
        ]}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.primary + '15',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          {icon}
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: colors.text,
              marginBottom: 2,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: colors.textSecondary,
            }}
          >
            {description}
          </Text>
        </View>
        <ChevronRight size={20} color={colors.textMuted} />
      </AnimatedPressable>
    </Animated.View>
  );
}

/**
 * AI Floating Action Button component
 *
 * A sparkles icon button that floats in the bottom-right corner.
 * Opens a bottom sheet with AI options:
 * - Generate Summary
 * - Enhance All Bullets
 * - Suggest Skills
 * - Score Resume
 *
 * Features spring physics animations.
 */
export function AIFloatingButton({
  onGenerateSummary,
  onEnhanceAllBullets,
  onSuggestSkills,
  onScoreResume,
  disabled = false,
  bottomOffset = 100,
  rightOffset = 20,
}: AIFloatingButtonProps) {
  const { colors, isDark } = useTheme();
  const { hapticEnabled } = useUIStore();
  const { isGenerating, currentOperation } = useAI();

  const [isOpen, setIsOpen] = useState(false);

  // Animation values
  const buttonScale = useSharedValue(1);
  const buttonRotate = useSharedValue(0);
  const pulseOpacity = useSharedValue(0.5);
  const backdropOpacity = useSharedValue(0);

  // Pulse animation for the button
  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0.5, { duration: 1000 })
      ),
      -1,
      true
    );
  }, [pulseOpacity]);

  // Button press animation
  const handlePressIn = () => {
    buttonScale.value = withSpring(0.9, { damping: 15, stiffness: 200 });
    buttonRotate.value = withSpring(15, { damping: 10, stiffness: 100 });
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1, { damping: 15, stiffness: 200 });
    buttonRotate.value = withSpring(0, { damping: 10, stiffness: 100 });
  };

  const handlePress = useCallback(() => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setIsOpen(true);
    backdropOpacity.value = withTiming(1, { duration: 300 });
  }, [hapticEnabled, backdropOpacity]);

  const handleClose = useCallback(() => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    backdropOpacity.value = withTiming(0, { duration: 200 });
    setTimeout(() => setIsOpen(false), 200);
  }, [hapticEnabled, backdropOpacity]);

  const handleOptionPress = useCallback(
    (callback?: () => void) => {
      handleClose();
      if (callback) {
        setTimeout(callback, 300);
      }
    },
    [handleClose]
  );

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: buttonScale.value },
      { rotate: `${buttonRotate.value}deg` },
    ],
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    transform: [{ scale: interpolate(pulseOpacity.value, [0.5, 1], [1, 1.3]) }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return (
    <>
      {/* Floating Button */}
      <AnimatedPressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled || isGenerating}
        style={[
          buttonAnimatedStyle,
          {
            position: 'absolute',
            bottom: bottomOffset,
            right: rightOffset,
            zIndex: 100,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          },
        ]}
      >
        {/* Pulse ring */}
        <Animated.View
          style={[
            pulseAnimatedStyle,
            {
              position: 'absolute',
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: colors.primary + '30',
            },
          ]}
        />
        {/* Button body */}
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Sparkles size={24} color="white" />
        </View>
      </AnimatedPressable>

      {/* Bottom Sheet Modal */}
      <Modal
        visible={isOpen}
        transparent
        animationType="none"
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        {/* Backdrop */}
        <AnimatedPressable
          onPress={handleClose}
          style={[
            backdropAnimatedStyle,
            {
              ...StyleSheet.absoluteFillObject,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
            },
          ]}
        />

        {/* Bottom Sheet */}
        <Animated.View
          entering={SlideInDown.duration(300).springify()}
          exiting={SlideOutDown.duration(200)}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 8,
            paddingBottom: 34,
            paddingHorizontal: 16,
            maxHeight: SCREEN_HEIGHT * 0.7,
          }}
        >
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
              }}
            />
          </View>

          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 12,
              paddingHorizontal: 4,
              marginBottom: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Sparkles size={20} color="white" />
              </View>
              <View>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: colors.text,
                  }}
                >
                  AI Assistant
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textSecondary,
                  }}
                >
                  Enhance your resume
                </Text>
              </View>
            </View>
            <Pressable
              onPress={handleClose}
              style={{
                padding: 8,
                borderRadius: 20,
                backgroundColor: colors.surfaceSecondary,
              }}
            >
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* AI Options */}
          <View style={{ paddingTop: 8 }}>
            {/* These items NAVIGATE to the section where the AI tools live —
                they don't generate inline. Labels say "Write/Improve…" rather
                than "Generate…" so the menu doesn't promise an action it
                doesn't perform (the old copy claimed it created content, then
                just changed screens). */}
            <AIOptionItem
              icon={<FileText size={22} color={colors.primary} />}
              title="Write my summary"
              description="Open the summary editor with AI suggestions"
              onPress={() => handleOptionPress(onGenerateSummary)}
              delay={100}
              isLoading={isGenerating && currentOperation?.includes('summary')}
            />

            <AIOptionItem
              icon={<Zap size={22} color={colors.primary} />}
              title="Improve my bullet points"
              description="Open experience, where AI can rewrite each bullet"
              onPress={() => handleOptionPress(onEnhanceAllBullets)}
              delay={150}
              isLoading={isGenerating && currentOperation?.includes('bullet')}
            />

            <AIOptionItem
              icon={<Lightbulb size={22} color={colors.primary} />}
              title="Add skills"
              description="Open skills, with AI recommendations for your role"
              onPress={() => handleOptionPress(onSuggestSkills)}
              delay={200}
              isLoading={isGenerating && currentOperation?.includes('skill')}
            />

            <AIOptionItem
              icon={<Target size={22} color={colors.primary} />}
              title="Score my resume"
              description="See your AI resume score and how to improve it"
              onPress={() => handleOptionPress(onScoreResume)}
              delay={250}
              isLoading={isGenerating && currentOperation?.includes('score')}
            />
          </View>

          {/* Footer */}
          <Animated.View
            entering={FadeIn.delay(400).duration(300)}
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 10,
              backgroundColor: isDark ? colors.surfaceSecondary : colors.primary + '08',
            }}
          >
            <Text
              style={{
                fontSize: 12,
                color: colors.textSecondary,
                textAlign: 'center',
              }}
            >
              AI features use your resume data to generate personalized suggestions.
              Results may vary based on content quality.
            </Text>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
}

export default AIFloatingButton;
