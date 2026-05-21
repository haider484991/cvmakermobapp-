/**
 * Inline Resume Score
 *
 * Always-visible score badge at the top of the resume editor. Shows the
 * instant rule-based "quick score" by default; tapping opens a modal that
 * runs the full AI analysis (categories, strengths, improvements, tips).
 *
 * This is what makes the app feel like a real tool — users get continuous
 * feedback on quality, the way Grammarly does for writing.
 */

import React, { useCallback, useState, useEffect } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, X, ChevronRight, Wand2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useResumeScore } from '@/hooks/useResumeScore';
import { ResumeScoreCard } from './ResumeScoreCard';
import type { Resume } from '@/types/resume';

interface Props {
  resume: Resume | null;
}

function MiniRing({ score, size = 48 }: { score: number; size?: number }) {
  const { colors } = useTheme();
  const animated = useSharedValue(0);

  useEffect(() => {
    animated.value = withDelay(150, withSpring(score, { damping: 15 }));
  }, [score]);

  const color = score >= 80 ? colors.success : score >= 60 ? colors.warning : colors.error;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 4,
        borderColor: color,
        backgroundColor: color + '15',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size / 3, fontWeight: '800', color }}>{score}</Text>
    </View>
  );
}

export function ResumeScoreInline({ resume }: Props) {
  const { colors } = useTheme();
  const { hapticEnabled } = useUIStore();
  const { score, quickScore, isLoading, analyze, reset } = useResumeScore(resume);
  const [showModal, setShowModal] = useState(false);

  // Quick score is "free" — it's just a rule-based count of resume completeness.
  // The AI score is what users actually want to see, so we lazy-load it the
  // first time the modal opens, then cache it for the session.
  const handleOpen = useCallback(() => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowModal(true);
    if (!score && !isLoading) {
      analyze();
    }
  }, [hapticEnabled, score, isLoading, analyze]);

  const handleRefresh = useCallback(() => {
    reset();
    analyze();
  }, [reset, analyze]);

  const headline =
    quickScore >= 80
      ? 'Looking great'
      : quickScore >= 60
        ? 'Solid — room to grow'
        : quickScore >= 40
          ? 'Getting there'
          : 'Add more details';

  return (
    <>
      <Animated.View entering={FadeIn.delay(150)}>
        <Pressable onPress={handleOpen}>
          <LinearGradient
            colors={['rgba(139,92,246,0.10)', 'rgba(6,182,212,0.10)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              borderRadius: 16,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <MiniRing score={quickScore} />

            <View style={{ flex: 1, marginLeft: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Sparkles size={12} color={colors.primary} />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    letterSpacing: 1,
                    color: colors.primary,
                    marginLeft: 4,
                  }}
                >
                  RESUME SCORE
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '700',
                  color: colors.text,
                  marginTop: 2,
                }}
              >
                {headline}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginTop: 1,
                }}
              >
                Tap for AI analysis & tips
              </Text>
            </View>

            <ChevronRight size={20} color={colors.textSecondary} />
          </LinearGradient>
        </Pressable>
      </Animated.View>

      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Modal header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Wand2 size={20} color={colors.primary} />
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: colors.text,
                  marginLeft: 8,
                }}
              >
                AI Resume Analysis
              </Text>
            </View>
            <Pressable
              onPress={() => setShowModal(false)}
              hitSlop={8}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
          >
            <ResumeScoreCard
              score={score}
              isLoading={isLoading}
              onRefresh={handleRefresh}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

export default ResumeScoreInline;
