/**
 * Goals Screen
 * Career goals selection with animated interactions
 */

import { useState, useCallback } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeInUp,
  FadeInRight,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Layout,
} from 'react-native-reanimated';
import { ChevronLeft, Check } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { PageIndicator } from '@/components/ui';
import * as Haptics from 'expo-haptics';

const INDUSTRIES = [
  { id: 'tech', label: 'Technology', emoji: '💻' },
  { id: 'healthcare', label: 'Healthcare', emoji: '🏥' },
  { id: 'finance', label: 'Finance', emoji: '💰' },
  { id: 'marketing', label: 'Marketing', emoji: '📣' },
  { id: 'education', label: 'Education', emoji: '📚' },
  { id: 'engineering', label: 'Engineering', emoji: '⚙️' },
  { id: 'design', label: 'Design', emoji: '🎨' },
  { id: 'sales', label: 'Sales', emoji: '📈' },
  { id: 'other', label: 'Other', emoji: '✨' },
];

const EXPERIENCE_LEVELS = [
  { id: 'entry', label: 'Entry Level', description: '0-2 years', icon: '🌱' },
  { id: 'mid', label: 'Mid Level', description: '3-5 years', icon: '🌿' },
  { id: 'senior', label: 'Senior', description: '6-10 years', icon: '🌳' },
  { id: 'executive', label: 'Executive', description: '10+ years', icon: '🏆' },
];

// Animated chip component for industry selection
function IndustryChip({
  industry,
  isSelected,
  onSelect,
  index,
  colors,
}: {
  industry: typeof INDUSTRIES[0];
  isSelected: boolean;
  onSelect: () => void;
  index: number;
  colors: any;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: withTiming(
      isSelected ? colors.primary : colors.surface,
      { duration: 200 }
    ),
    borderColor: withTiming(
      isSelected ? colors.primary : colors.border,
      { duration: 200 }
    ),
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.92, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const handlePress = () => {
    Haptics.selectionAsync();
    onSelect();
  };

  return (
    <Animated.View
      entering={FadeInRight.delay(300 + index * 50).springify()}
      layout={Layout.springify()}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 24,
              borderWidth: 1.5,
              gap: 6,
            },
            animatedStyle,
          ]}
        >
          <Text style={{ fontSize: 16 }}>{industry.emoji}</Text>
          <Text
            style={{
              fontSize: 15,
              fontWeight: '500',
              color: isSelected ? '#FFFFFF' : colors.text,
            }}
          >
            {industry.label}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// Animated card component for experience level selection
function ExperienceCard({
  level,
  isSelected,
  onSelect,
  index,
  colors,
}: {
  level: typeof EXPERIENCE_LEVELS[0];
  isSelected: boolean;
  onSelect: () => void;
  index: number;
  colors: any;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderColor: withSpring(
      isSelected ? colors.primary : colors.border,
      { damping: 20 }
    ),
    borderWidth: isSelected ? 2 : 1,
  }));

  const checkScale = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(isSelected ? 1 : 0, { damping: 15 }) }],
    opacity: withTiming(isSelected ? 1 : 0, { duration: 150 }),
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect();
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(500 + index * 100).springify()}
      layout={Layout.springify()}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
              borderRadius: 16,
              backgroundColor: colors.surface,
            },
            animatedStyle,
          ]}
        >
          <Text style={{ fontSize: 28, marginRight: 12 }}>{level.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 17,
                fontWeight: '600',
                color: colors.text,
              }}
            >
              {level.label}
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: colors.textSecondary,
                marginTop: 2,
              }}
            >
              {level.description}
            </Text>
          </View>
          <Animated.View
            style={[
              {
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              },
              checkScale,
            ]}
          >
            <Check size={16} color="#FFFFFF" strokeWidth={3} />
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export default function Goals() {
  const router = useRouter();
  const { colors } = useTheme();
  const [jobTitle, setJobTitle] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);

  // Button animation
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

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(onboarding)/complete');
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const isFormComplete = jobTitle.length > 0 || selectedIndustry || selectedLevel;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
          {/* Header */}
          <Animated.View
            entering={FadeIn.delay(100).duration(400)}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 24,
            }}
          >
            <Pressable
              onPress={handleBack}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 8,
                paddingRight: 16,
              }}
            >
              <ChevronLeft size={24} color={colors.primary} strokeWidth={2} />
              <Text style={{ color: colors.primary, fontSize: 16, marginLeft: 4 }}>
                Back
              </Text>
            </Pressable>
            <PageIndicator totalPages={3} currentPage={1} />
          </Animated.View>

          {/* Title Section */}
          <Animated.View entering={FadeInUp.delay(200).duration(500)}>
            <Text
              style={{
                fontSize: 32,
                fontWeight: '700',
                color: colors.text,
                marginBottom: 8,
                letterSpacing: -0.5,
              }}
            >
              Tell us about{'\n'}your goals
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: colors.textSecondary,
                marginBottom: 32,
                lineHeight: 24,
              }}
            >
              We'll customize your experience based on your career goals.
            </Text>
          </Animated.View>

          {/* Job Title Input */}
          <Animated.View
            entering={FadeInUp.delay(300).duration(500)}
            style={{ marginBottom: 32 }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: colors.text,
                marginBottom: 12,
              }}
            >
              What job are you looking for?
            </Text>
            <TextInput
              value={jobTitle}
              onChangeText={setJobTitle}
              placeholder="e.g. Software Engineer, Product Manager"
              placeholderTextColor={colors.textMuted}
              style={{
                padding: 16,
                borderRadius: 14,
                fontSize: 16,
                backgroundColor: colors.surface,
                color: colors.text,
                borderWidth: 1.5,
                borderColor: jobTitle ? colors.primary : colors.border,
              }}
            />
          </Animated.View>

          {/* Industry Selection */}
          <Animated.View
            entering={FadeInUp.delay(350).duration(500)}
            style={{ marginBottom: 32 }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: colors.text,
                marginBottom: 16,
              }}
            >
              Select your industry
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              {INDUSTRIES.map((industry, index) => (
                <IndustryChip
                  key={industry.id}
                  industry={industry}
                  isSelected={selectedIndustry === industry.id}
                  onSelect={() => setSelectedIndustry(industry.id)}
                  index={index}
                  colors={colors}
                />
              ))}
            </View>
          </Animated.View>

          {/* Experience Level */}
          <Animated.View entering={FadeInUp.delay(400).duration(500)}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: colors.text,
                marginBottom: 16,
              }}
            >
              Experience level
            </Text>
            <View style={{ gap: 12 }}>
              {EXPERIENCE_LEVELS.map((level, index) => (
                <ExperienceCard
                  key={level.id}
                  level={level}
                  isSelected={selectedLevel === level.id}
                  onSelect={() => setSelectedLevel(level.id)}
                  index={index}
                  colors={colors}
                />
              ))}
            </View>
          </Animated.View>
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 24,
          paddingVertical: 24,
          backgroundColor: colors.background,
        }}
      >
        <Animated.View
          entering={FadeInUp.delay(800).duration(500)}
          style={buttonAnimatedStyle}
        >
          <Pressable
            onPress={handleContinue}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={{
              paddingVertical: 18,
              borderRadius: 16,
              alignItems: 'center',
              backgroundColor: colors.primary,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 6,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '600' }}>
              Continue
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
