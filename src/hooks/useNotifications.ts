/**
 * Notifications Hook
 * Manages push notification setup and preferences
 */

import { useState, useEffect, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import {
  configureNotifications,
  requestPermissions,
  getPreferences,
  savePreferences,
  scheduleAllNotifications,
  type NotificationPreferences,
} from '@/services/notifications/pushNotifications';

interface UseNotificationsReturn {
  isPermissionGranted: boolean;
  preferences: NotificationPreferences;
  isLoading: boolean;
  requestNotificationPermission: () => Promise<boolean>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    enabled: true,
    streakReminders: true,
    dailyBonusReminders: true,
    achievementAlerts: true,
    tipsAndUpdates: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      configureNotifications();

      // Check existing permission
      const { status } = await Notifications.getPermissionsAsync();
      setIsPermissionGranted(status === 'granted');

      // Load preferences
      const prefs = await getPreferences();
      setPreferences(prefs);

      // Schedule notifications if enabled
      if (status === 'granted' && prefs.enabled) {
        await scheduleAllNotifications(prefs);
      }

      setIsLoading(false);
    };

    init();
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    const granted = await requestPermissions();
    setIsPermissionGranted(granted);

    if (granted) {
      await scheduleAllNotifications(preferences);
    }

    return granted;
  }, [preferences]);

  const updatePreferences = useCallback(async (prefs: Partial<NotificationPreferences>) => {
    const updated = { ...preferences, ...prefs };
    setPreferences(updated);
    await savePreferences(prefs);
  }, [preferences]);

  return {
    isPermissionGranted,
    preferences,
    isLoading,
    requestNotificationPermission,
    updatePreferences,
  };
}

export default useNotifications;
