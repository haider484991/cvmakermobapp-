/**
 * Stats Card Component
 *
 * Displays user statistics in a visual card format.
 */

import React from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { useGamificationStore } from '@/stores/gamificationStore';
import {
  FileText,
  Download,
  Sparkles,
  Layout,
  Share2,
  Users,
  Target,
  Calendar,
} from 'lucide-react-native';

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  delay: number;
}

function StatItem({ icon, label, value, color, delay }: StatItemProps) {
  const { colors } = useTheme();

  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(300)}
      style={{
        width: '48%',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          backgroundColor: color + '15',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        {icon}
      </View>
      <View>
        <Text
          style={{
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
          }}
        >
          {value}
        </Text>
        <Text
          style={{
            fontSize: 11,
            color: colors.textSecondary,
          }}
        >
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

export function StatsCard() {
  const { colors } = useTheme();
  const { stats } = useGamificationStore();

  const statItems = [
    {
      icon: <FileText size={20} color={colors.primary} />,
      label: 'Resumes',
      value: stats.resumesCreated,
      color: colors.primary,
    },
    {
      icon: <Download size={20} color={colors.success} />,
      label: 'Exports',
      value: stats.resumesExported,
      color: colors.success,
    },
    {
      icon: <Sparkles size={20} color="#8b5cf6" />,
      label: 'AI Used',
      value: stats.aiSuggestionsUsed,
      color: '#8b5cf6',
    },
    {
      icon: <Layout size={20} color={colors.warning} />,
      label: 'Templates',
      value: stats.templatesViewed,
      color: colors.warning,
    },
    {
      icon: <Share2 size={20} color="#ec4899" />,
      label: 'Shares',
      value: stats.shareCount,
      color: '#ec4899',
    },
    {
      icon: <Target size={20} color={colors.error} />,
      label: 'Perfect Scores',
      value: stats.perfectScores,
      color: colors.error,
    },
  ];

  return (
    <View>
      <Text
        style={{
          fontSize: 16,
          fontWeight: '600',
          color: colors.text,
          marginBottom: 12,
        }}
      >
        Your Stats
      </Text>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        {statItems.map((item, index) => (
          <StatItem
            key={item.label}
            icon={item.icon}
            label={item.label}
            value={item.value}
            color={item.color}
            delay={index * 50}
          />
        ))}
      </View>
    </View>
  );
}

export default StatsCard;
