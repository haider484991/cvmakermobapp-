import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useAnimatedProps,
  useSharedValue,
  withSpring,
  withTiming,
  withDelay,
  FadeIn,
  FadeInUp,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';
import {
  Target,
  FileText,
  Layout,
  Key,
  Zap,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  X,
  RefreshCw,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { Card } from '@/components/ui/Card';
import type { ResumeScore, ScoreCategory } from '@/types/ai';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface AIScoreCardProps {
  /**
   * The resume score data from AI analysis
   */
  score: ResumeScore;

  /**
   * Whether the card is currently loading
   */
  isLoading?: boolean;

  /**
   * Callback when the card is dismissed
   */
  onDismiss?: () => void;

  /**
   * Callback when retry is clicked
   */
  onRetry?: () => void;

  /**
   * Whether the card is dismissable
   */
  dismissable?: boolean;

  /**
   * Whether to show detailed breakdown
   */
  showDetails?: boolean;
}

/**
 * Circular progress indicator for the overall score
 */
interface CircularProgressProps {
  score: number;
  size?: number;
  strokeWidth?: number;
}

function CircularProgress({ score, size = 120, strokeWidth = 10 }: CircularProgressProps) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);
  const displayScore = useSharedValue(0);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    progress.value = withDelay(
      300,
      withTiming(score / 100, {
        duration: 1500,
        easing: Easing.bezierFn(0.25, 0.1, 0.25, 1),
      })
    );
    displayScore.value = withDelay(
      300,
      withTiming(score, {
        duration: 1500,
        easing: Easing.bezierFn(0.25, 0.1, 0.25, 1),
      })
    );
  }, [score, progress, displayScore]);

  const animatedCircleProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const getScoreColor = () => {
    if (score >= 80) return colors.success;
    if (score >= 60) return colors.warning;
    return colors.error;
  };

  const scoreColor = getScoreColor();

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          {/* Background circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.border}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress circle */}
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={scoreColor}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeLinecap="round"
            animatedProps={animatedCircleProps}
          />
        </G>
      </Svg>
      <View style={{ alignItems: 'center' }}>
        <Text
          style={{
            fontSize: 32,
            fontWeight: '700',
            color: scoreColor,
          }}
        >
          {Math.round(score)}
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: colors.textSecondary,
            marginTop: -4,
          }}
        >
          out of 100
        </Text>
      </View>
    </View>
  );
}

/**
 * Category score bar component
 */
interface CategoryBarProps {
  category: ScoreCategory;
  icon: React.ReactNode;
  delay?: number;
}

function CategoryBar({ category, icon, delay = 0 }: CategoryBarProps) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);
  const percentage = (category.score / category.maxScore) * 100;

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withSpring(percentage / 100, {
        damping: 15,
        stiffness: 80,
      })
    );
  }, [percentage, delay, progress]);

  const animatedWidth = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const getBarColor = () => {
    if (percentage >= 80) return colors.success;
    if (percentage >= 60) return colors.warning;
    return colors.error;
  };

  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
        <View style={{ marginRight: 8 }}>{icon}</View>
        <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: colors.text }}>
          {category.name}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '600', color: getBarColor() }}>
          {category.score}/{category.maxScore}
        </Text>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.border,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[
            {
              height: '100%',
              borderRadius: 3,
              backgroundColor: getBarColor(),
            },
            animatedWidth,
          ]}
        />
      </View>
    </View>
  );
}

/**
 * Feedback item component for strengths and improvements
 */
interface FeedbackItemProps {
  text: string;
  type: 'strength' | 'improvement';
  delay?: number;
}

function FeedbackItem({ text, type, delay = 0 }: FeedbackItemProps) {
  const { colors } = useTheme();
  const isStrength = type === 'strength';

  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(300)}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginBottom: 8,
        borderRadius: 8,
        backgroundColor: isStrength ? colors.success + '10' : colors.warning + '10',
      }}
    >
      {isStrength ? (
        <TrendingUp size={16} color={colors.success} style={{ marginRight: 8, marginTop: 2 }} />
      ) : (
        <TrendingDown size={16} color={colors.warning} style={{ marginRight: 8, marginTop: 2 }} />
      )}
      <Text
        style={{
          flex: 1,
          fontSize: 13,
          color: colors.text,
          lineHeight: 18,
        }}
      >
        {text}
      </Text>
    </Animated.View>
  );
}

/**
 * AI Score Card component
 *
 * Displays a comprehensive resume score analysis with:
 * - Overall score with circular progress
 * - Category breakdown (Content, Formatting, Keywords, Impact, Completeness)
 * - Strengths and improvements lists
 * - Animated appearance using Reanimated
 */
export function AIScoreCard({
  score,
  isLoading = false,
  onDismiss,
  onRetry,
  dismissable = true,
  showDetails = true,
}: AIScoreCardProps) {
  const { colors, isDark } = useTheme();
  const { hapticEnabled } = useUIStore();

  // Animation values
  const cardScale = useSharedValue(0.95);
  const cardOpacity = useSharedValue(0);

  useEffect(() => {
    cardScale.value = withSpring(1, { damping: 15, stiffness: 100 });
    cardOpacity.value = withSpring(1, { damping: 15, stiffness: 100 });
  }, [cardScale, cardOpacity]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  const handleDismiss = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onDismiss?.();
  };

  const handleRetry = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onRetry?.();
  };

  const getCategoryIcon = (categoryKey: string) => {
    const iconSize = 14;
    const iconColor = colors.textSecondary;

    switch (categoryKey) {
      case 'content':
        return <FileText size={iconSize} color={iconColor} />;
      case 'formatting':
        return <Layout size={iconSize} color={iconColor} />;
      case 'keywords':
        return <Key size={iconSize} color={iconColor} />;
      case 'impact':
        return <Zap size={iconSize} color={iconColor} />;
      case 'completeness':
        return <CheckCircle size={iconSize} color={iconColor} />;
      default:
        return <Target size={iconSize} color={iconColor} />;
    }
  };

  const getScoreLabel = () => {
    if (score.overallScore >= 90) return 'Excellent';
    if (score.overallScore >= 80) return 'Very Good';
    if (score.overallScore >= 70) return 'Good';
    if (score.overallScore >= 60) return 'Fair';
    if (score.overallScore >= 50) return 'Needs Work';
    return 'Needs Improvement';
  };

  const getScoreLabelColor = () => {
    if (score.overallScore >= 80) return colors.success;
    if (score.overallScore >= 60) return colors.warning;
    return colors.error;
  };

  return (
    <Animated.View entering={FadeIn.duration(300)} style={cardAnimatedStyle}>
      <Card variant="elevated" padding="lg">
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.primary + '15',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
              }}
            >
              <Target size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
                Resume Score
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                AI-powered analysis
              </Text>
            </View>
          </View>
          {dismissable && onDismiss && (
            <Pressable onPress={handleDismiss} style={{ padding: 4 }}>
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* Overall Score */}
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <CircularProgress score={score.overallScore} />
          <Animated.View entering={FadeInUp.delay(500).duration(300)}>
            <Text
              style={{
                marginTop: 12,
                fontSize: 16,
                fontWeight: '600',
                color: getScoreLabelColor(),
              }}
            >
              {getScoreLabel()}
            </Text>
          </Animated.View>
        </View>

        {showDetails && (
          <>
            {/* Category Breakdown */}
            <View style={{ marginBottom: 20 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.text,
                  marginBottom: 12,
                }}
              >
                Category Breakdown
              </Text>
              {Object.entries(score.categories).map(([key, category], index) => (
                <CategoryBar
                  key={key}
                  category={category}
                  icon={getCategoryIcon(key)}
                  delay={600 + index * 100}
                />
              ))}
            </View>

            {/* Strengths */}
            {score.strengths.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: colors.success,
                    marginBottom: 8,
                  }}
                >
                  Strengths
                </Text>
                {score.strengths.slice(0, 3).map((strength, index) => (
                  <FeedbackItem
                    key={index}
                    text={strength}
                    type="strength"
                    delay={1100 + index * 100}
                  />
                ))}
              </View>
            )}

            {/* Improvements */}
            {score.improvements.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: colors.warning,
                    marginBottom: 8,
                  }}
                >
                  Areas for Improvement
                </Text>
                {score.improvements.slice(0, 3).map((improvement, index) => (
                  <FeedbackItem
                    key={index}
                    text={improvement}
                    type="improvement"
                    delay={1400 + index * 100}
                  />
                ))}
              </View>
            )}

            {/* ATS Compatibility */}
            <Animated.View
              entering={FadeInUp.delay(1700).duration(300)}
              style={{
                padding: 12,
                borderRadius: 10,
                backgroundColor: isDark ? colors.surfaceSecondary : colors.background,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                  ATS Compatibility
                </Text>
                <View
                  style={{
                    marginLeft: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 4,
                    backgroundColor:
                      score.atsCompatibility.score >= 80
                        ? colors.success + '20'
                        : score.atsCompatibility.score >= 60
                          ? colors.warning + '20'
                          : colors.error + '20',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color:
                        score.atsCompatibility.score >= 80
                          ? colors.success
                          : score.atsCompatibility.score >= 60
                            ? colors.warning
                            : colors.error,
                    }}
                  >
                    {score.atsCompatibility.score}%
                  </Text>
                </View>
              </View>
              {score.atsCompatibility.issues.length > 0 && (
                <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 16 }}>
                  {score.atsCompatibility.issues[0]}
                </Text>
              )}
            </Animated.View>
          </>
        )}

        {/* Retry Button */}
        {onRetry && (
          <Pressable
            onPress={handleRetry}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 16,
              paddingVertical: 10,
              borderRadius: 8,
              backgroundColor: colors.primary + '10',
            }}
          >
            <RefreshCw size={16} color={colors.primary} />
            <Text
              style={{
                marginLeft: 8,
                fontSize: 14,
                fontWeight: '500',
                color: colors.primary,
              }}
            >
              Analyze Again
            </Text>
          </Pressable>
        )}
      </Card>
    </Animated.View>
  );
}

export default AIScoreCard;
