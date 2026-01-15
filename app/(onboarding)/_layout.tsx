/**
 * Onboarding Layout
 * Provides smooth transitions between onboarding screens
 */

import { Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';

export default function OnboardingLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
        animationDuration: 300,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    >
      <Stack.Screen
        name="welcome"
        options={{
          animation: 'fade',
        }}
      />
      <Stack.Screen
        name="goals"
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="complete"
        options={{
          animation: 'slide_from_right',
        }}
      />
    </Stack>
  );
}
