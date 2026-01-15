/**
 * Sync Status Indicator
 * Shows the current sync status with visual feedback
 */

import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  useSharedValue,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Cloud, CloudOff, Check, AlertCircle, RefreshCw } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useSync } from '@/hooks/useSync';
import * as Haptics from 'expo-haptics';
import { useUIStore } from '@/stores/uiStore';

interface SyncStatusIndicatorProps {
  /**
   * Whether to show detailed status text
   */
  showText?: boolean;

  /**
   * Whether to allow manual sync trigger
   */
  allowManualSync?: boolean;

  /**
   * Size of the indicator
   */
  size?: 'sm' | 'md' | 'lg';
}

export function SyncStatusIndicator({
  showText = false,
  allowManualSync = true,
  size = 'md',
}: SyncStatusIndicatorProps) {
  const { colors } = useTheme();
  const { hapticEnabled } = useUIStore();
  const { status, isSyncing, isOnline, pendingChanges, lastSyncedAt, sync } = useSync();

  const rotation = useSharedValue(0);

  // Animate refresh icon when syncing
  React.useEffect(() => {
    if (isSyncing) {
      rotation.value = withRepeat(
        withSequence(
          withTiming(360, { duration: 1000 }),
          withTiming(0, { duration: 0 })
        ),
        -1
      );
    } else {
      rotation.value = 0;
    }
  }, [isSyncing, rotation]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const handleSync = async () => {
    if (!allowManualSync || isSyncing) return;

    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await sync();
  };

  const iconSize = size === 'sm' ? 14 : size === 'md' ? 18 : 22;
  const containerSize = size === 'sm' ? 28 : size === 'md' ? 36 : 44;

  const getStatusColor = () => {
    if (!isOnline) return colors.textSecondary;
    if (status === 'error') return colors.error;
    if (status === 'synced') return colors.success;
    if (status === 'syncing') return colors.primary;
    return colors.textSecondary;
  };

  const getStatusIcon = () => {
    if (!isOnline) {
      return <CloudOff size={iconSize} color={colors.textSecondary} />;
    }

    if (isSyncing) {
      return (
        <Animated.View style={spinStyle}>
          <RefreshCw size={iconSize} color={colors.primary} />
        </Animated.View>
      );
    }

    if (status === 'error') {
      return <AlertCircle size={iconSize} color={colors.error} />;
    }

    if (status === 'synced') {
      return <Check size={iconSize} color={colors.success} />;
    }

    return <Cloud size={iconSize} color={colors.textSecondary} />;
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (isSyncing) return 'Syncing...';
    if (status === 'error') return 'Sync error';
    if (status === 'synced') return 'Synced';
    if (pendingChanges > 0) return `${pendingChanges} pending`;
    return 'Ready';
  };

  const formatLastSync = () => {
    if (!lastSyncedAt) return null;

    const date = new Date(lastSyncedAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <Pressable
      onPress={handleSync}
      disabled={!allowManualSync || isSyncing}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        opacity: allowManualSync ? 1 : 0.8,
      }}
    >
      {/* Status Icon */}
      <Animated.View
        entering={FadeIn.duration(200)}
        style={{
          width: containerSize,
          height: containerSize,
          borderRadius: containerSize / 2,
          backgroundColor: getStatusColor() + '15',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {getStatusIcon()}
      </Animated.View>

      {/* Status Text */}
      {showText && (
        <View style={{ marginLeft: 8 }}>
          <Text
            style={{
              fontSize: size === 'sm' ? 12 : size === 'md' ? 13 : 14,
              fontWeight: '500',
              color: getStatusColor(),
            }}
          >
            {getStatusText()}
          </Text>
          {lastSyncedAt && status === 'synced' && (
            <Text
              style={{
                fontSize: size === 'sm' ? 10 : 11,
                color: colors.textSecondary,
              }}
            >
              {formatLastSync()}
            </Text>
          )}
        </View>
      )}

      {/* Pending Badge */}
      {pendingChanges > 0 && !showText && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: colors.warning,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: '600',
              color: 'white',
            }}
          >
            {pendingChanges}
          </Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

export default SyncStatusIndicator;
