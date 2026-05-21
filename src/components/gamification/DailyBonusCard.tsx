/**
 * Daily Bonus Card
 *
 * Shows claimable daily bonus with animated button.
 */

import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  FadeIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { useGamificationStore } from '@/stores/gamificationStore';
import { Gift, Check, Zap } from 'lucide-react-native';

export function DailyBonusCard() {
  const { colors } = useTheme();
  const { dailyBonusClaimed, claimDailyBonus, streak } = useGamificationStore();
  const [claimed, setClaimed] = useState(dailyBonusClaimed);
  const [bonusAmount, setBonusAmount] = useState(0);

  const pulseScale = useSharedValue(1);
  const buttonScale = useSharedValue(1);

  React.useEffect(() => {
    if (!claimed) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      );
    }
  }, [claimed]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleClaim = () => {
    if (claimed) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    buttonScale.value = withSequence(
      withSpring(0.9, { damping: 10 }),
      withSpring(1, { damping: 8 })
    );

    const bonus = claimDailyBonus();
    setBonusAmount(bonus);
    setClaimed(true);
  };

  const potentialBonus = Math.min(10 + streak.current * 5, 50);

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: claimed ? colors.success + '50' : colors.warning + '50',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Icon */}
        <Animated.View
          style={[
            pulseStyle,
            {
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: claimed ? colors.success + '20' : colors.warning + '20',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 16,
            },
          ]}
        >
          {claimed ? (
            <Check size={28} color={colors.success} />
          ) : (
            <Gift size={28} color={colors.warning} />
          )}
        </Animated.View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '700',
              color: colors.text,
            }}
          >
            {claimed ? 'Bonus Claimed!' : 'Daily Bonus'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Zap size={14} color={colors.warning} />
            <Text
              style={{
                fontSize: 13,
                color: colors.textSecondary,
                marginLeft: 4,
              }}
            >
              {claimed
                ? `+${bonusAmount} XP collected`
                : `+${potentialBonus} XP waiting for you`}
            </Text>
          </View>
          {!claimed && streak.current > 0 && (
            <Text
              style={{
                fontSize: 11,
                color: colors.success,
                marginTop: 4,
              }}
            >
              {streak.current}-day streak bonus included!
            </Text>
          )}
        </View>

        {/* Claim Button */}
        {!claimed && (
          <Pressable onPress={handleClaim}>
            <Animated.View style={buttonAnimatedStyle}>
              <LinearGradient
                colors={[colors.warning, '#f59e0b']}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 20,
                }}
              >
                <Text
                  style={{
                    color: 'white',
                    fontWeight: '600',
                    fontSize: 14,
                  }}
                >
                  Claim
                </Text>
              </LinearGradient>
            </Animated.View>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

export default DailyBonusCard;
