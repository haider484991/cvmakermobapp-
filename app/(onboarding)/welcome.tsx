/**
 * Welcome Screen - FreeResume AI
 * First onboarding screen with gradient background and feature highlights
 * Design: Teal-blue gradient with glassmorphism cards
 */

import { useState } from 'react';
import { View, Text, Pressable, Alert, Image, ScrollView, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  SlideInRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  Sparkles,
  FileText,
  Palette,
  Zap,
  Download,
  Shield,
  ArrowRight,
  Check,
} from 'lucide-react-native';
import { useLinkedIn } from '@/hooks/useLinkedIn';
import { useResumeStore } from '@/stores/resumeStore';
import { useUIStore } from '@/stores/uiStore';
import { LinkedInImportButton } from '@/components/features/linkedin';
import { GradientBackground } from '@/components/ui';
import { mapLinkedInToResume } from '@/services/linkedin/profileMapper';
import { LinkedInProfile } from '@/types/linkedin';
import { gradientColors } from '@/constants/theme';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

// Key features of FreeResume AI
const FEATURES = [
  {
    icon: Sparkles,
    title: 'AI-Powered Writing',
    description: 'Smart suggestions to make your resume stand out',
    color: '#F59E0B',
  },
  {
    icon: Palette,
    title: '40+ Pro Templates',
    description: 'Beautiful, ATS-friendly designs for every industry',
    color: '#8B5CF6',
  },
  {
    icon: Zap,
    title: 'Quick & Easy',
    description: 'Create a professional resume in under 5 minutes',
    color: '#10B981',
  },
  {
    icon: Download,
    title: 'PDF Export',
    description: 'Download and share your resume instantly',
    color: '#3B82F6',
  },
];

// Bullet points for value proposition
const VALUE_POINTS = [
  'No credit card required',
  '100% Free forever',
  'No watermarks',
];

// Animated feature card
function FeatureCard({
  icon: Icon,
  title,
  description,
  color,
  delay,
}: {
  icon: any;
  title: string;
  description: string;
  color: string;
  delay: number;
}) {
  return (
    <Animated.View
      entering={SlideInRight.delay(delay).duration(400).springify()}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          backgroundColor: color + '25',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 14,
        }}
      >
        <Icon size={24} color={color} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: '700',
            color: 'white',
            marginBottom: 2,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: 'rgba(255, 255, 255, 0.75)',
            lineHeight: 18,
          }}
        >
          {description}
        </Text>
      </View>
    </Animated.View>
  );
}

// Animated sparkle effect for the logo
function SparkleEffect() {
  const opacity = useSharedValue(0.3);
  const scale = useSharedValue(1);

  opacity.value = withRepeat(
    withSequence(
      withTiming(1, { duration: 1500 }),
      withTiming(0.3, { duration: 1500 })
    ),
    -1,
    true
  );

  scale.value = withRepeat(
    withSequence(
      withTiming(1.1, { duration: 1500 }),
      withTiming(1, { duration: 1500 })
    ),
    -1,
    true
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: -10,
          right: -10,
        },
        animatedStyle,
      ]}
    >
      <Sparkles size={28} color="#FFD700" fill="#FFD700" />
    </Animated.View>
  );
}

export default function Welcome() {
  const router = useRouter();
  const { isLoading: isLinkedInLoading } = useLinkedIn();
  const { createResume, getResume } = useResumeStore();
  const { setOnboardingCompleted } = useUIStore();
  const [isImporting, setIsImporting] = useState(false);

  // Button press animation
  const buttonScale = useSharedValue(1);
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handleGetStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setOnboardingCompleted(true);
    router.replace('/(main)/dashboard');
  };

  const handleLinkedInSuccess = async (linkedInProfile: LinkedInProfile) => {
    try {
      setIsImporting(true);
      const resumeId = createResume(`${linkedInProfile.firstName}'s Resume`);
      const createdResume = getResume(resumeId);

      if (createdResume) {
        mapLinkedInToResume(linkedInProfile, createdResume);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setOnboardingCompleted(true);
      router.replace('/(main)/dashboard');
    } catch (error) {
      console.error('[Welcome] LinkedIn import error:', error);
      Alert.alert(
        'Import Error',
        'There was an error importing your LinkedIn profile. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleLinkedInError = (error: string) => {
    Alert.alert(
      'LinkedIn Import Failed',
      error || 'Unable to import from LinkedIn. Please try again or continue manually.',
      [{ text: 'OK' }]
    );
  };

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: 20,
            paddingBottom: 32,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Logo & Branding Section */}
          <Animated.View
            entering={FadeIn.delay(100).duration(600)}
            style={{ alignItems: 'center', marginBottom: 28 }}
          >
            {/* Logo Container with Sparkle */}
            <View style={{ position: 'relative', marginBottom: 16 }}>
              <View
                style={{
                  width: 110,
                  height: 110,
                  borderRadius: 28,
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: 'rgba(255, 255, 255, 0.25)',
                }}
              >
                <Image
                  source={require('../../assets/icon.png')}
                  style={{ width: 80, height: 80 }}
                  resizeMode="contain"
                />
              </View>
              <SparkleEffect />
            </View>

            {/* App Name */}
            <Text
              style={{
                fontSize: 32,
                fontWeight: '800',
                color: 'white',
                letterSpacing: -0.5,
              }}
            >
              FreeResume AI
            </Text>

            {/* Tagline */}
            <Text
              style={{
                fontSize: 16,
                color: 'rgba(255, 255, 255, 0.85)',
                marginTop: 6,
                fontWeight: '500',
              }}
            >
              Build Your Dream Resume for Free
            </Text>

            {/* FREE Badge */}
            <View
              style={{
                marginTop: 14,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: 'rgba(16, 185, 129, 0.4)',
              }}
            >
              <Shield size={14} color="#10B981" style={{ marginRight: 6 }} />
              <Text style={{ color: '#10B981', fontSize: 13, fontWeight: '700' }}>
                100% FREE • NO ADS • NO LIMITS
              </Text>
            </View>
          </Animated.View>

          {/* Feature Cards */}
          <Animated.View
            entering={FadeInUp.delay(300).duration(400)}
            style={{ marginBottom: 24 }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: 'rgba(255, 255, 255, 0.6)',
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 12,
                marginLeft: 4,
              }}
            >
              Why Choose Us
            </Text>
            {FEATURES.map((feature, index) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                color={feature.color}
                delay={400 + index * 80}
              />
            ))}
          </Animated.View>

          {/* CTA Section */}
          <Animated.View entering={FadeInUp.delay(800).duration(500)}>
            {/* Get Started Button */}
            <Animated.View style={buttonAnimatedStyle}>
              <Pressable
                onPress={handleGetStarted}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={isImporting || isLinkedInLoading}
                style={{
                  overflow: 'hidden',
                  borderRadius: 18,
                  opacity: isImporting || isLinkedInLoading ? 0.7 : 1,
                }}
              >
                <LinearGradient
                  colors={['#FFFFFF', '#F0F9FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={{
                    paddingVertical: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.2,
                    shadowRadius: 16,
                    elevation: 10,
                  }}
                >
                  <Text
                    style={{
                      color: '#0891B2',
                      fontSize: 19,
                      fontWeight: '800',
                      marginRight: 10,
                    }}
                  >
                    Get Started Free
                  </Text>
                  <View
                    style={{
                      backgroundColor: '#0891B2',
                      borderRadius: 20,
                      padding: 4,
                    }}
                  >
                    <ArrowRight size={18} color="white" strokeWidth={3} />
                  </View>
                </LinearGradient>
              </Pressable>
            </Animated.View>

            {/* LinkedIn Import Button */}
            <View style={{ marginTop: 14 }}>
              <LinkedInImportButton
                variant="outline"
                fullWidth
                label="Import from LinkedIn"
                onSuccess={handleLinkedInSuccess}
                onError={handleLinkedInError}
                disabled={isImporting}
              />
            </View>

            {/* Value Points */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                flexWrap: 'wrap',
                marginTop: 20,
                gap: 16,
              }}
            >
              {VALUE_POINTS.map((point, index) => (
                <Animated.View
                  key={point}
                  entering={FadeIn.delay(1000 + index * 100).duration(400)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <Check size={14} color="#10B981" strokeWidth={3} />
                  <Text
                    style={{
                      color: 'rgba(255, 255, 255, 0.8)',
                      fontSize: 13,
                      marginLeft: 6,
                      fontWeight: '500',
                    }}
                  >
                    {point}
                  </Text>
                </Animated.View>
              ))}
            </View>

            {/* Trust Badge */}
            <Animated.View
              entering={FadeIn.delay(1200).duration(400)}
              style={{
                alignItems: 'center',
                marginTop: 24,
              }}
            >
              <Text
                style={{
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: 12,
                  textAlign: 'center',
                }}
              >
                Trusted by 10,000+ job seekers worldwide
              </Text>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}
