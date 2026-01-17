/**
 * Sync Hook
 * Provides sync functionality and status for components
 */

import { useEffect, useState, useCallback } from 'react';
import { AppState, AppStateStatus, Platform, DeviceEventEmitter } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { syncService, SyncState, SyncStatus } from '@/services/sync/syncService';
import { useAuthStore } from '@/stores/authStore';
import { useResumeStore } from '@/stores/resumeStore';

export interface UseSyncReturn {
  /**
   * Current sync status
   */
  status: SyncStatus;

  /**
   * Whether currently syncing
   */
  isSyncing: boolean;

  /**
   * Whether device is online
   */
  isOnline: boolean;

  /**
   * Last sync timestamp
   */
  lastSyncedAt: string | null;

  /**
   * Number of pending changes
   */
  pendingChanges: number;

  /**
   * Error message if any
   */
  error: string | null;

  /**
   * Manually trigger sync
   */
  sync: () => Promise<void>;

  /**
   * Force sync all local data
   */
  forceSync: () => Promise<boolean>;

  /**
   * Refresh data from server
   */
  refresh: () => Promise<void>;
}

export function useSync(): UseSyncReturn {
  const { user, isAuthenticated } = useAuthStore();
  const { getAllResumes, setResumes } = useResumeStore();

  const [syncState, setSyncState] = useState<SyncState>(syncService.getState());
  const [isOnline, setIsOnline] = useState(true);

  // Subscribe to sync state changes
  useEffect(() => {
    const unsubscribe = syncService.subscribe(setSyncState);
    return () => unsubscribe();
  }, []);

  // Initialize sync service when authenticated
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      syncService.initialize(user.id);
    }

    return () => {
      syncService.cleanup();
    };
  }, [isAuthenticated, user?.id]);

  // Listen to network state changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected ?? false;
      setIsOnline(online);
      syncService.setOnline(online);
    });

    return () => unsubscribe();
  }, []);

  // Listen to app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isOnline && isAuthenticated) {
        // Sync when app comes to foreground
        syncService.processQueue();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isOnline, isAuthenticated]);

  // Listen to real-time sync events
  useEffect(() => {
    const handleSyncEvent = (data: { type: string; data: unknown }) => {
      console.log('[useSync] Received sync event:', data?.type);

      // Handle different event types
      // The store should be updated based on the event
      // For now, we'll just refresh
      if (user?.id && isAuthenticated) {
        syncService.fetchResumes(user.id).then((serverResumes) => {
          if (serverResumes.length > 0) {
            setResumes(serverResumes);
          }
        }).catch((err) => {
          console.error('[useSync] Failed to refresh after sync event:', err);
        });
      }
    };

    // Use DeviceEventEmitter for React Native event handling
    const subscription = DeviceEventEmitter.addListener('resume-sync', handleSyncEvent);
    return () => subscription.remove();
  }, [user?.id, isAuthenticated, setResumes]);

  /**
   * Manually trigger sync
   */
  const sync = useCallback(async () => {
    if (!isAuthenticated || !user?.id) return;

    await syncService.processQueue();
  }, [isAuthenticated, user?.id]);

  /**
   * Force sync all local data
   */
  const forceSync = useCallback(async (): Promise<boolean> => {
    if (!isAuthenticated || !user?.id) return false;

    const allResumes = getAllResumes();
    return syncService.forceSync(user.id, allResumes);
  }, [isAuthenticated, user?.id, getAllResumes]);

  /**
   * Refresh data from server
   */
  const refresh = useCallback(async () => {
    if (!isAuthenticated || !user?.id) return;

    const serverResumes = await syncService.fetchResumes(user.id);
    if (serverResumes.length > 0) {
      // Merge server data with local data
      // Server data takes precedence for now
      setResumes(serverResumes);
    }
  }, [isAuthenticated, user?.id, setResumes]);

  return {
    status: syncState.status,
    isSyncing: syncState.status === 'syncing',
    isOnline,
    lastSyncedAt: syncState.lastSyncedAt,
    pendingChanges: syncState.pendingChanges,
    error: syncState.error,
    sync,
    forceSync,
    refresh,
  };
}

export default useSync;
