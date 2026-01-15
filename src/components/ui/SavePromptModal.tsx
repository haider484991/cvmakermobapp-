/**
 * SavePromptModal
 * A popup notification that prompts guest users to log in to save their resume to the cloud.
 * Shows when editing a resume as a guest user.
 */

import { Modal, View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, SlideInUp } from 'react-native-reanimated';
import { Cloud, X, LogIn, Clock } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useRouter } from 'expo-router';
import { gradientColors } from '@/constants/theme';
import * as Haptics from 'expo-haptics';

interface SavePromptModalProps {
  visible: boolean;
  onClose: () => void;
}

export function SavePromptModal({ visible, onClose }: SavePromptModalProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { dismissSavePrompt, hapticEnabled } = useUIStore();

  const handleSignIn = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onClose();
    router.push('/(auth)/login');
  };

  const handleCreateAccount = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onClose();
    router.push('/(auth)/register');
  };

  const handleContinueAsGuest = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    dismissSavePrompt();
    onClose();
  };

  const handleDismiss = () => {
    if (hapticEnabled) {
      Haptics.selectionAsync();
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <Pressable
        className="flex-1 justify-center items-center px-6"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
        onPress={handleDismiss}
      >
        <Animated.View
          entering={SlideInUp.springify().damping(15)}
          style={{
            width: '100%',
            maxWidth: 400,
          }}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            {/* Card */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 24,
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.25,
                shadowRadius: 20,
                elevation: 10,
              }}
            >
              {/* Header with gradient */}
              <LinearGradient
                colors={gradientColors.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: 24, alignItems: 'center' }}
              >
                {/* Close button */}
                <Pressable
                  onPress={handleDismiss}
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    padding: 8,
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: 20,
                  }}
                >
                  <X size={18} color="white" />
                </Pressable>

                {/* Icon */}
                <Animated.View entering={FadeIn.delay(100)}>
                  <View
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 36,
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 16,
                    }}
                  >
                    <Cloud size={36} color="white" strokeWidth={1.5} />
                  </View>
                </Animated.View>

                {/* Title */}
                <Animated.Text
                  entering={FadeIn.delay(150)}
                  style={{
                    fontSize: 22,
                    fontWeight: '700',
                    color: 'white',
                    textAlign: 'center',
                    marginBottom: 8,
                  }}
                >
                  Save Your Progress
                </Animated.Text>

                {/* Subtitle */}
                <Animated.Text
                  entering={FadeIn.delay(200)}
                  style={{
                    fontSize: 14,
                    color: 'rgba(255, 255, 255, 0.9)',
                    textAlign: 'center',
                    lineHeight: 20,
                  }}
                >
                  Create a free account to save your resume{'\n'}to the cloud and access it anywhere
                </Animated.Text>
              </LinearGradient>

              {/* Content */}
              <View style={{ padding: 24 }}>
                {/* Benefits */}
                <Animated.View entering={FadeIn.delay(250)}>
                  <View style={{ marginBottom: 20 }}>
                    {[
                      { icon: Cloud, text: 'Sync across all devices' },
                      { icon: Clock, text: 'Never lose your work' },
                    ].map((benefit, index) => (
                      <View
                        key={index}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          marginBottom: 12,
                        }}
                      >
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            backgroundColor: colors.primary + '15',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12,
                          }}
                        >
                          <benefit.icon size={16} color={colors.primary} />
                        </View>
                        <Text style={{ color: colors.text, fontSize: 14 }}>
                          {benefit.text}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Animated.View>

                {/* Buttons */}
                <Animated.View entering={FadeIn.delay(300)}>
                  {/* Create Account Button */}
                  <LinearGradient
                    colors={gradientColors.primary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ borderRadius: 14, marginBottom: 12 }}
                  >
                    <Pressable
                      onPress={handleCreateAccount}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingVertical: 16,
                      }}
                    >
                      <LogIn size={18} color="white" style={{ marginRight: 8 }} />
                      <Text
                        style={{
                          color: 'white',
                          fontSize: 16,
                          fontWeight: '600',
                        }}
                      >
                        Create Free Account
                      </Text>
                    </Pressable>
                  </LinearGradient>

                  {/* Sign In Button */}
                  <Pressable
                    onPress={handleSignIn}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 14,
                      borderWidth: 1.5,
                      borderColor: colors.primary,
                      borderRadius: 14,
                      marginBottom: 12,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: 16,
                        fontWeight: '600',
                      }}
                    >
                      I have an account
                    </Text>
                  </Pressable>

                  {/* Continue as Guest */}
                  <Pressable
                    onPress={handleContinueAsGuest}
                    style={{
                      alignItems: 'center',
                      paddingVertical: 12,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 14,
                      }}
                    >
                      Continue without saving
                    </Text>
                  </Pressable>
                </Animated.View>

                {/* Footer note */}
                <Animated.Text
                  entering={FadeIn.delay(350)}
                  style={{
                    textAlign: 'center',
                    fontSize: 12,
                    color: colors.textMuted,
                    marginTop: 8,
                  }}
                >
                  Your resume is saved locally on this device
                </Animated.Text>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
