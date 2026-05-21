/**
 * Resume Score Card Component
 * Displays AI-generated resume score with visual feedback
 */

import React, { useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withDelay,
  withTiming,
  FadeIn,
  FadeInUp,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Star,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Lightbulb,
  RefreshCw,
  Sparkles,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import type { ResumeScore } from '@/services/ai/resumeScorer';

interface ResumeScoreCardProps {
  score: ResumeScore | null;
  isLoading?: boolean;
  onRefresh?: () => void;
  compact?: boolean;
}

function ScoreRing({
  score,
  size = 120,
  strokeWidth = 10,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
}) {
  const { colors } = useTheme();
  const animatedScore = useSharedValue(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  useEffect(() => {
    animatedScore.value = withDelay(300, withSpring(score, { damping: 15 }));
  }, [score]);

  const getScoreColor = (s: number) => {
    if (s >= 80) return colors.success;
    if (s >= 60) return colors.warning;
    return colors.error;
  };

  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute' }}>
        {/* Background circle */}
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: colors.border,
          }}
        />
      </View>
      <View style={{ position: 'absolute' }}>
        {/* Animated progress circle */}
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: getScoreColor(score),
            borderRightColor: 'transparent',
            borderBottomColor: score > 25 ? getScoreColor(score) : 'transparent',
            borderLeftColor: score > 50 ? getScoreColor(score) : 'transparent',
            borderTopColor: score > 75 ? getScoreColor(score) : 'transparent',
            transform: [{ rotate: '-45deg' }],
          }}
        />
      </View>
      <View style={{ alignItems: 'center' }}>
        <Text
          style={{
            fontSize: size / 3,
            fontWeight: '700',
            color: getScoreColor(score),
          }}
        >
          {score}
        </Text>
        <Text style={{ fontSize: 12, color: colors.textSecondary }}>/ 100</Text>
      </View>
    </View>
  );
}

function CategoryBar({
  label,
  score,
  delay = 0,
}: {
  label: string;
  score: number;
  delay?: number;
}) {
  const { colors } = useTheme();
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withDelay(delay, withSpring(score, { damping: 15 }));
  }, [score, delay]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  const getColor = (s: number) => {
    if (s >= 80) return colors.success;
    if (s >= 60) return colors.warning;
    return colors.error;
  };

  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 12, color: colors.textSecondary }}>{label}</Text>
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>{score}%</Text>
      </View>
      <View
        style={{
          height: 6,
          backgroundColor: colors.border,
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[
            barStyle,
            {
              height: '100%',
              backgroundColor: getColor(score),
              borderRadius: 3,
            },
          ]}
        />
      </View>
    </View>
  );
}

export function ResumeScoreCard({
  score,
  isLoading,
  onRefresh,
  compact = false,
}: ResumeScoreCardProps) {
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 24,
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, color: colors.textSecondary }}>
          Analyzing your resume...
        </Text>
      </View>
    );
  }

  if (!score) {
    return (
      <Pressable
        onPress={onRefresh}
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 24,
          alignItems: 'center',
        }}
      >
        <Sparkles size={32} color={colors.primary} />
        <Text
          style={{
            marginTop: 12,
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
          }}
        >
          Get AI Resume Score
        </Text>
        <Text style={{ marginTop: 4, color: colors.textSecondary, textAlign: 'center' }}>
          Get personalized feedback and tips
        </Text>
      </Pressable>
    );
  }

  if (compact) {
    return (
      <Animated.View entering={FadeIn}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <ScoreRing score={score.overall} size={60} strokeWidth={6} />
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
              Resume Score
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              {score.overall >= 80
                ? 'Excellent!'
                : score.overall >= 60
                ? 'Good, room to improve'
                : 'Needs work'}
            </Text>
          </View>
          {onRefresh && (
            <Pressable onPress={onRefresh} style={{ padding: 8 }}>
              <RefreshCw size={20} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInUp}>
      <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 20 }}>
        {/* Header with Score Ring */}
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <ScoreRing score={score.overall} />
          <Text
            style={{
              marginTop: 12,
              fontSize: 18,
              fontWeight: '700',
              color: colors.text,
            }}
          >
            {score.overall >= 80
              ? 'Excellent Resume!'
              : score.overall >= 60
              ? 'Good Resume'
              : 'Resume Needs Improvement'}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 4,
              backgroundColor: colors.primary + '15',
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 12,
            }}
          >
            <Star size={14} color={colors.primary} />
            <Text style={{ marginLeft: 4, fontSize: 13, color: colors.primary, fontWeight: '500' }}>
              ATS Score: {score.atsCompatibility}%
            </Text>
          </View>
        </View>

        {/* Category Breakdown */}
        <View style={{ marginBottom: 16 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: colors.text,
              marginBottom: 12,
            }}
          >
            Score Breakdown
          </Text>
          <CategoryBar label="Content Quality" score={score.categories.content} delay={100} />
          <CategoryBar label="Formatting" score={score.categories.formatting} delay={200} />
          <CategoryBar label="Keywords" score={score.categories.keywords} delay={300} />
          <CategoryBar label="Impact" score={score.categories.impact} delay={400} />
          <CategoryBar label="Completeness" score={score.categories.completeness} delay={500} />
        </View>

        {/* Strengths */}
        {score.strengths.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <CheckCircle size={16} color={colors.success} />
              <Text
                style={{
                  marginLeft: 6,
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.success,
                }}
              >
                Strengths
              </Text>
            </View>
            {score.strengths.map((strength, index) => (
              <Text
                key={index}
                style={{
                  fontSize: 13,
                  color: colors.textSecondary,
                  marginBottom: 4,
                  paddingLeft: 22,
                }}
              >
                • {strength}
              </Text>
            ))}
          </View>
        )}

        {/* Improvements */}
        {score.improvements.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <AlertCircle size={16} color={colors.warning} />
              <Text
                style={{
                  marginLeft: 6,
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.warning,
                }}
              >
                Areas to Improve
              </Text>
            </View>
            {score.improvements.map((improvement, index) => (
              <Text
                key={index}
                style={{
                  fontSize: 13,
                  color: colors.textSecondary,
                  marginBottom: 4,
                  paddingLeft: 22,
                }}
              >
                • {improvement}
              </Text>
            ))}
          </View>
        )}

        {/* Tips */}
        {score.tips.length > 0 && (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Lightbulb size={16} color={colors.primary} />
              <Text
                style={{
                  marginLeft: 6,
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.primary,
                }}
              >
                Pro Tips
              </Text>
            </View>
            {score.tips.map((tip, index) => (
              <Text
                key={index}
                style={{
                  fontSize: 13,
                  color: colors.textSecondary,
                  marginBottom: 4,
                  paddingLeft: 22,
                }}
              >
                💡 {tip}
              </Text>
            ))}
          </View>
        )}

        {/* Refresh Button */}
        {onRefresh && (
          <Pressable
            onPress={onRefresh}
            style={{
              marginTop: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 12,
              backgroundColor: colors.primary + '10',
              borderRadius: 12,
            }}
          >
            <RefreshCw size={16} color={colors.primary} />
            <Text
              style={{
                marginLeft: 8,
                fontSize: 14,
                fontWeight: '600',
                color: colors.primary,
              }}
            >
              Re-analyze Resume
            </Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

export default ResumeScoreCard;
