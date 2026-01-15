import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradientColors } from '@/constants/theme';

interface GradientBackgroundProps {
  children: React.ReactNode;
  variant?: 'primary' | 'light' | 'dark';
  style?: ViewStyle;
  start?: { x: number; y: number };
  end?: { x: number; y: number };
}

/**
 * GradientBackground component
 *
 * Provides the signature teal-to-blue gradient background
 * used throughout the FreeResume AI app.
 */
export function GradientBackground({
  children,
  variant = 'primary',
  style,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
}: GradientBackgroundProps) {
  const colors = gradientColors[variant];

  return (
    <LinearGradient
      colors={colors}
      start={start}
      end={end}
      style={[styles.container, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default GradientBackground;
