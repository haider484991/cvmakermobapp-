/**
 * ReviewPromptModal — "Are you enjoying FreeResume AI?" filter.
 *
 * This is the conventional 2-step pattern used by Duolingo, Headspace,
 * and most well-rated apps:
 *
 *   Step 1: Soft pre-prompt — "Are you enjoying X?" Yes / Not really.
 *   Step 2a (Yes branch): Ask for a Play Store review → native API.
 *   Step 2b (No branch):  Offer a feedback channel (email).
 *
 * The point is that Google's quota only allows ~3 native prompts per
 * year per user — burning one on someone who's about to leave a 2★
 * review is a disaster. The filter routes them to private feedback
 * instead, protecting the public rating.
 */

import React, { useState } from 'react';
import { Modal, Pressable, Text, View, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Heart, Star, Send, X } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import {
  markPrompted,
  recordDecline,
  requestNativeReview,
} from '@/services/review/reviewManager';

const SUPPORT_EMAIL = 'haider484991@gmail.com';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Step = 'filter' | 'love-it' | 'feedback' | 'thanks';

export function ReviewPromptModal({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const { hapticEnabled } = useUIStore();
  const [step, setStep] = useState<Step>('filter');

  // Reset internal state when the modal is closed externally so the
  // next open starts fresh on the filter.
  const close = () => {
    setStep('filter');
    onClose();
  };

  const handleLoveIt = async () => {
    if (hapticEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setStep('love-it');
    await markPrompted();
  };

  const handleNotReally = async () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setStep('feedback');
    await markPrompted();
    await recordDecline();
  };

  const handleRateOnStore = async () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await requestNativeReview();
    setStep('thanks');
  };

  const handleSendFeedback = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const subject = encodeURIComponent('FreeResume AI Feedback');
    const body = encodeURIComponent(
      'Hi FreeResume AI team,\n\nMy experience so far has been:\n\n',
    );
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(
      () => {},
    );
    setStep('thanks');
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={close}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}
      >
        <Animated.View
          entering={FadeIn.duration(250)}
          exiting={FadeOut.duration(150)}
          style={{
            backgroundColor: colors.background,
            borderRadius: 28,
            padding: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.35,
            shadowRadius: 24,
            elevation: 12,
          }}
        >
          {/* Close (X) — always available so users don't feel trapped */}
          <Pressable
            onPress={close}
            hitSlop={8}
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
            }}
          >
            <X size={18} color={colors.textSecondary} />
          </Pressable>

          {step === 'filter' && (
            <FilterStep
              colors={colors}
              onLove={handleLoveIt}
              onMeh={handleNotReally}
            />
          )}

          {step === 'love-it' && (
            <LoveStep
              colors={colors}
              onRate={handleRateOnStore}
              onSkip={close}
            />
          )}

          {step === 'feedback' && (
            <FeedbackStep
              colors={colors}
              onSend={handleSendFeedback}
              onSkip={close}
            />
          )}

          {step === 'thanks' && <ThanksStep colors={colors} onClose={close} />}
        </Animated.View>
      </View>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Step components                                                            */
/* -------------------------------------------------------------------------- */

function FilterStep({
  colors,
  onLove,
  onMeh,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  onLove: () => void;
  onMeh: () => void;
}) {
  return (
    <View>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: colors.primary + '18',
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'center',
          marginBottom: 16,
        }}
      >
        <Heart size={36} color={colors.primary} fill={colors.primary} />
      </View>
      <Text
        style={{
          fontSize: 22,
          fontWeight: '800',
          color: colors.text,
          textAlign: 'center',
          letterSpacing: -0.4,
        }}
      >
        Enjoying FreeResume AI?
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: colors.textSecondary,
          textAlign: 'center',
          marginTop: 8,
          lineHeight: 20,
        }}
      >
        Your feedback helps us build a better resume builder for everyone.
      </Text>

      <Pressable
        onPress={onLove}
        style={{
          marginTop: 24,
          paddingVertical: 14,
          borderRadius: 16,
          backgroundColor: colors.primary,
          alignItems: 'center',
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 6,
        }}
      >
        <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>
          Yes, loving it
        </Text>
      </Pressable>

      <Pressable
        onPress={onMeh}
        style={{
          marginTop: 10,
          paddingVertical: 14,
          alignItems: 'center',
        }}
      >
        <Text
          style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '500' }}
        >
          Not really
        </Text>
      </Pressable>
    </View>
  );
}

function LoveStep({
  colors,
  onRate,
  onSkip,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  onRate: () => void;
  onSkip: () => void;
}) {
  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <Star
            key={i}
            size={32}
            color="#FBBF24"
            fill="#FBBF24"
            style={{ marginHorizontal: 2 }}
          />
        ))}
      </View>
      <Text
        style={{
          fontSize: 22,
          fontWeight: '800',
          color: colors.text,
          textAlign: 'center',
          letterSpacing: -0.4,
        }}
      >
        Awesome! Could you rate us?
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: colors.textSecondary,
          textAlign: 'center',
          marginTop: 8,
          lineHeight: 20,
        }}
      >
        A 5-star review on the Play Store helps more job seekers find us. It
        takes 10 seconds.
      </Text>

      <Pressable
        onPress={onRate}
        style={{
          marginTop: 24,
          paddingVertical: 14,
          borderRadius: 16,
          backgroundColor: colors.primary,
          alignItems: 'center',
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 6,
        }}
      >
        <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>
          Rate on Play Store
        </Text>
      </Pressable>

      <Pressable
        onPress={onSkip}
        style={{
          marginTop: 10,
          paddingVertical: 14,
          alignItems: 'center',
        }}
      >
        <Text
          style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '500' }}
        >
          Maybe later
        </Text>
      </Pressable>
    </View>
  );
}

function FeedbackStep({
  colors,
  onSend,
  onSkip,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  onSend: () => void;
  onSkip: () => void;
}) {
  return (
    <View>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: colors.warning + '20',
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'center',
          marginBottom: 16,
        }}
      >
        <Send size={32} color={colors.warning} />
      </View>
      <Text
        style={{
          fontSize: 22,
          fontWeight: '800',
          color: colors.text,
          textAlign: 'center',
          letterSpacing: -0.4,
        }}
      >
        We want to do better
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: colors.textSecondary,
          textAlign: 'center',
          marginTop: 8,
          lineHeight: 20,
        }}
      >
        Tell us what's not working — we read every message and improve based on
        real feedback.
      </Text>

      <Pressable
        onPress={onSend}
        style={{
          marginTop: 24,
          paddingVertical: 14,
          borderRadius: 16,
          backgroundColor: colors.primary,
          alignItems: 'center',
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 6,
        }}
      >
        <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>
          Send Feedback
        </Text>
      </Pressable>

      <Pressable
        onPress={onSkip}
        style={{
          marginTop: 10,
          paddingVertical: 14,
          alignItems: 'center',
        }}
      >
        <Text
          style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '500' }}
        >
          No thanks
        </Text>
      </Pressable>
    </View>
  );
}

function ThanksStep({
  colors,
  onClose,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  onClose: () => void;
}) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: colors.success + '20',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Heart size={36} color={colors.success} fill={colors.success} />
      </View>
      <Text
        style={{
          fontSize: 22,
          fontWeight: '800',
          color: colors.text,
          textAlign: 'center',
          letterSpacing: -0.4,
        }}
      >
        Thank you!
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: colors.textSecondary,
          textAlign: 'center',
          marginTop: 8,
          lineHeight: 20,
        }}
      >
        We really appreciate it. Now go land that job 🚀
      </Text>

      <Pressable
        onPress={onClose}
        style={{
          marginTop: 24,
          paddingVertical: 14,
          paddingHorizontal: 32,
          borderRadius: 16,
          backgroundColor: colors.primary,
        }}
      >
        <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>
          Close
        </Text>
      </Pressable>
    </View>
  );
}

export default ReviewPromptModal;
