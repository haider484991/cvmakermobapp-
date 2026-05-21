/**
 * NextStepCard — orientation card for the resume editor home screen.
 *
 * Solves the "I don't know where to start" problem users described: instead
 * of dumping them into a flat list of 5 section cards and hoping they pick
 * the right one, this card explicitly says "Next: add your Experience →"
 * with a single big tap target. Overall progress sits above so users see
 * they're making forward motion (key for retention on long forms).
 *
 * Auto-updates as sections get filled, so it always points at the most
 * impactful incomplete step in the recommended order.
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { gradientColors } from '@/constants/theme';
import type { Resume, SectionType } from '@/types/resume';

/** Recommended order for filling out a resume. Highest-impact sections first. */
const RECOMMENDED_ORDER: { type: SectionType; label: string; copy: string }[] = [
  { type: 'header', label: 'Your details', copy: 'Add your name, role, and contact' },
  { type: 'experience', label: 'Work experience', copy: 'Add your most recent role' },
  { type: 'summary', label: 'Professional summary', copy: 'A 2-3 sentence intro (AI can help)' },
  { type: 'skills', label: 'Key skills', copy: 'Add 5-10 relevant skills' },
  { type: 'education', label: 'Education', copy: 'Your degree and school' },
];

function isComplete(resume: Resume, type: SectionType): boolean {
  switch (type) {
    case 'header':
      return Boolean(
        resume.header.fullName &&
          resume.header.jobTitle &&
          resume.header.contact?.email,
      );
    case 'summary':
      return Boolean(resume.summary && resume.summary.trim().length > 0);
    case 'experience':
      return resume.experience.length > 0;
    case 'education':
      return resume.education.length > 0;
    case 'skills':
      return resume.skills.length > 0;
    default:
      return false;
  }
}

interface Props {
  resume: Resume;
  onContinue: (section: SectionType) => void;
}

export function NextStepCard({ resume, onContinue }: Props) {
  const { colors } = useTheme();
  const { hapticEnabled } = useUIStore();

  // Compute progress + next step in one pass.
  const completedCount = RECOMMENDED_ORDER.filter((s) => isComplete(resume, s.type)).length;
  const totalCount = RECOMMENDED_ORDER.length;
  const percentComplete = Math.round((completedCount / totalCount) * 100);
  const nextStep = RECOMMENDED_ORDER.find((s) => !isComplete(resume, s.type));

  const handleContinue = () => {
    if (!nextStep) return;
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onContinue(nextStep.type);
  };

  // Resume is fully filled — celebrate, point to preview/export instead.
  if (!nextStep) {
    return (
      <Animated.View entering={FadeIn.duration(220)}>
        <View
          style={{
            backgroundColor: colors.success + '14',
            borderRadius: 18,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.success + '40',
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.success,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
            }}
          >
            <CheckCircle2 size={24} color="white" strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.success }}>
              All sections filled
            </Text>
            <Text style={{ fontSize: 13, color: colors.text, marginTop: 2 }}>
              Tap the eye icon to preview, or download to share.
            </Text>
          </View>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(220)}>
      <Pressable onPress={handleContinue}>
        <LinearGradient
          colors={gradientColors.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 18,
            padding: 16,
          }}
        >
          {/* Tiny eyebrow */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Sparkles size={12} color="rgba(255,255,255,0.85)" />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1,
                color: 'rgba(255,255,255,0.9)',
                marginLeft: 4,
              }}
            >
              NEXT STEP · {completedCount}/{totalCount} DONE
            </Text>
          </View>

          {/* Action */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: 'white' }}>
                {nextStep.label}
              </Text>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                {nextStep.copy}
              </Text>
            </View>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.25)',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 8,
              }}
            >
              <ArrowRight size={22} color="white" strokeWidth={2.5} />
            </View>
          </View>

          {/* Progress bar */}
          <View style={{ marginTop: 14 }}>
            <View
              style={{
                height: 6,
                backgroundColor: 'rgba(255,255,255,0.22)',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: 6,
                  width: `${percentComplete}%`,
                  backgroundColor: 'white',
                  borderRadius: 3,
                }}
              />
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

export default NextStepCard;
