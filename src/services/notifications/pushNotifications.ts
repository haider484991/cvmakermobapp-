/**
 * Push Notifications Service
 * Handles streak reminders, daily bonus alerts, and engagement notifications
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_PREFS_KEY = 'notification_preferences';

export interface NotificationPreferences {
  enabled: boolean;
  streakReminders: boolean;
  dailyBonusReminders: boolean;
  achievementAlerts: boolean;
  tipsAndUpdates: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  streakReminders: true,
  dailyBonusReminders: true,
  achievementAlerts: true,
  tipsAndUpdates: false,
};

/**
 * Configure notification handler
 */
export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Request notification permissions
 */
export async function requestPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    console.log('[Notifications] Not a physical device, skipping permissions');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Notifications] Permission not granted');
    return false;
  }

  // Set up Android channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366f1',
    });

    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      description: 'Daily reminders and streak alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250],
      lightColor: '#22c55e',
    });
  }

  console.log('[Notifications] Permission granted');
  return true;
}

/**
 * Get notification preferences
 */
export async function getPreferences(): Promise<NotificationPreferences> {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('[Notifications] Failed to get preferences:', error);
  }
  return DEFAULT_PREFERENCES;
}

/**
 * Save notification preferences
 */
export async function savePreferences(prefs: Partial<NotificationPreferences>): Promise<void> {
  try {
    const current = await getPreferences();
    const updated = { ...current, ...prefs };
    await AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(updated));

    // Reschedule notifications based on new preferences
    if (updated.enabled) {
      await scheduleAllNotifications(updated);
    } else {
      await cancelAllNotifications();
    }
  } catch (error) {
    console.error('[Notifications] Failed to save preferences:', error);
  }
}

/**
 * Schedule streak reminder notification
 */
export async function scheduleStreakReminder(): Promise<string | null> {
  try {
    // Cancel existing streak reminders
    await cancelNotificationsByTag('streak');

    // Schedule for 8 PM daily
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Don't lose your streak! 🔥",
        body: 'Open FreeResume AI to keep your streak going and earn bonus XP!',
        data: { type: 'streak_reminder' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 20,
        minute: 0,
      },
    });

    console.log('[Notifications] Scheduled streak reminder:', identifier);
    return identifier;
  } catch (error) {
    console.error('[Notifications] Failed to schedule streak reminder:', error);
    return null;
  }
}

/**
 * Schedule daily bonus reminder
 */
export async function scheduleDailyBonusReminder(): Promise<string | null> {
  try {
    // Cancel existing daily bonus reminders
    await cancelNotificationsByTag('daily_bonus');

    // Schedule for 9 AM daily
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your daily bonus is ready! 🎁',
        body: 'Claim your free XP and keep building your resume!',
        data: { type: 'daily_bonus' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 9,
        minute: 0,
      },
    });

    console.log('[Notifications] Scheduled daily bonus reminder:', identifier);
    return identifier;
  } catch (error) {
    console.error('[Notifications] Failed to schedule daily bonus reminder:', error);
    return null;
  }
}

/**
 * Send achievement unlock notification
 */
export async function sendAchievementNotification(
  achievementName: string,
  xpReward: number
): Promise<void> {
  const prefs = await getPreferences();
  if (!prefs.enabled || !prefs.achievementAlerts) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🏆 Achievement Unlocked!',
        body: `You earned "${achievementName}" and +${xpReward} XP!`,
        data: { type: 'achievement', name: achievementName },
        sound: true,
      },
      trigger: null, // Send immediately
    });
  } catch (error) {
    console.error('[Notifications] Failed to send achievement notification:', error);
  }
}

/**
 * Send level up notification
 */
export async function sendLevelUpNotification(level: number, levelName: string): Promise<void> {
  const prefs = await getPreferences();
  if (!prefs.enabled) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎉 Level Up!',
        body: `Congratulations! You reached Level ${level}: ${levelName}!`,
        data: { type: 'level_up', level },
        sound: true,
      },
      trigger: null,
    });
  } catch (error) {
    console.error('[Notifications] Failed to send level up notification:', error);
  }
}

/**
 * Schedule all recurring notifications
 */
export async function scheduleAllNotifications(prefs?: NotificationPreferences): Promise<void> {
  const preferences = prefs || (await getPreferences());

  if (!preferences.enabled) return;

  if (preferences.streakReminders) {
    await scheduleStreakReminder();
  }

  if (preferences.dailyBonusReminders) {
    await scheduleDailyBonusReminder();
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log('[Notifications] Cancelled all notifications');
}

/**
 * Cancel notifications by tag (stored in data)
 */
async function cancelNotificationsByTag(tag: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of scheduled) {
    if (notification.content.data?.type === tag) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
}

/**
 * Get push token for remote notifications (future use)
 */
export async function getPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;

  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: 'your-project-id', // Replace with actual project ID
    });
    return token.data;
  } catch (error) {
    console.error('[Notifications] Failed to get push token:', error);
    return null;
  }
}

export default {
  configureNotifications,
  requestPermissions,
  getPreferences,
  savePreferences,
  scheduleStreakReminder,
  scheduleDailyBonusReminder,
  sendAchievementNotification,
  sendLevelUpNotification,
  scheduleAllNotifications,
  cancelAllNotifications,
  getPushToken,
};
