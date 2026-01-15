/**
 * Sync Service
 * Handles real-time synchronization of resumes with Supabase
 */

import { supabase } from '@/lib/supabase';
import { Resume } from '@/types/resume';
import { RealtimeChannel } from '@supabase/supabase-js';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export interface SyncState {
  status: SyncStatus;
  lastSyncedAt: string | null;
  pendingChanges: number;
  error: string | null;
}

export interface SyncQueueItem {
  id: string;
  resumeId: string;
  action: 'create' | 'update' | 'delete';
  data?: Partial<Resume>;
  createdAt: string;
  retryCount: number;
}

/**
 * Database resume row structure
 */
interface ResumeRow {
  id: string;
  user_id: string;
  name: string;
  template_id: string;
  data: Resume;
  created_at: string;
  updated_at: string;
}

class SyncService {
  private channel: RealtimeChannel | null = null;
  private syncQueue: SyncQueueItem[] = [];
  private isOnline: boolean = true;
  private listeners: Set<(state: SyncState) => void> = new Set();
  private state: SyncState = {
    status: 'idle',
    lastSyncedAt: null,
    pendingChanges: 0,
    error: null,
  };

  /**
   * Initialize sync service and subscribe to real-time updates
   */
  async initialize(userId: string): Promise<void> {
    try {
      // Subscribe to real-time changes for user's resumes
      this.channel = supabase
        .channel(`resumes:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'resumes',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            this.handleRealtimeChange(payload);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[SyncService] Real-time subscription active');
          }
        });

      // Process any pending queue items
      await this.processQueue();
    } catch (error) {
      console.error('[SyncService] Initialize error:', error);
      this.updateState({ status: 'error', error: 'Failed to initialize sync' });
    }
  }

  /**
   * Cleanup and unsubscribe
   */
  async cleanup(): Promise<void> {
    if (this.channel) {
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.listeners.clear();
  }

  /**
   * Subscribe to sync state changes
   */
  subscribe(listener: (state: SyncState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  /**
   * Update sync state and notify listeners
   */
  private updateState(updates: Partial<SyncState>): void {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach((listener) => listener(this.state));
  }

  /**
   * Handle real-time database changes
   */
  private handleRealtimeChange(payload: {
    eventType: string;
    new: Record<string, unknown>;
    old: Record<string, unknown>;
  }): void {
    console.log('[SyncService] Real-time change:', payload.eventType);

    // Emit event for store to handle
    const event = new CustomEvent('resume-sync', {
      detail: {
        type: payload.eventType,
        data: payload.new,
        oldData: payload.old,
      },
    });
    window.dispatchEvent(event);
  }

  /**
   * Fetch all resumes from server
   */
  async fetchResumes(userId: string): Promise<Resume[]> {
    try {
      this.updateState({ status: 'syncing' });

      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      this.updateState({
        status: 'synced',
        lastSyncedAt: new Date().toISOString(),
        error: null,
      });

      return (data as ResumeRow[]).map((row) => row.data);
    } catch (error) {
      console.error('[SyncService] Fetch resumes error:', error);
      this.updateState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to fetch resumes',
      });
      return [];
    }
  }

  /**
   * Save resume to server
   */
  async saveResume(userId: string, resume: Resume): Promise<boolean> {
    if (!this.isOnline) {
      this.queueChange(resume.id, 'update', resume);
      return true;
    }

    try {
      this.updateState({ status: 'syncing' });

      const { error } = await supabase.from('resumes').upsert({
        id: resume.id,
        user_id: userId,
        name: resume.name,
        template_id: resume.templateId,
        data: resume,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      this.updateState({
        status: 'synced',
        lastSyncedAt: new Date().toISOString(),
        error: null,
      });

      return true;
    } catch (error) {
      console.error('[SyncService] Save resume error:', error);
      // Queue for retry if failed
      this.queueChange(resume.id, 'update', resume);
      this.updateState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to save resume',
      });
      return false;
    }
  }

  /**
   * Create new resume on server
   */
  async createResume(userId: string, resume: Resume): Promise<boolean> {
    if (!this.isOnline) {
      this.queueChange(resume.id, 'create', resume);
      return true;
    }

    try {
      this.updateState({ status: 'syncing' });

      const { error } = await supabase.from('resumes').insert({
        id: resume.id,
        user_id: userId,
        name: resume.name,
        template_id: resume.templateId,
        data: resume,
        created_at: resume.createdAt,
        updated_at: resume.updatedAt,
      });

      if (error) throw error;

      this.updateState({
        status: 'synced',
        lastSyncedAt: new Date().toISOString(),
        error: null,
      });

      return true;
    } catch (error) {
      console.error('[SyncService] Create resume error:', error);
      this.queueChange(resume.id, 'create', resume);
      this.updateState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to create resume',
      });
      return false;
    }
  }

  /**
   * Delete resume from server
   */
  async deleteResume(userId: string, resumeId: string): Promise<boolean> {
    if (!this.isOnline) {
      this.queueChange(resumeId, 'delete');
      return true;
    }

    try {
      this.updateState({ status: 'syncing' });

      const { error } = await supabase
        .from('resumes')
        .delete()
        .eq('id', resumeId)
        .eq('user_id', userId);

      if (error) throw error;

      this.updateState({
        status: 'synced',
        lastSyncedAt: new Date().toISOString(),
        error: null,
      });

      return true;
    } catch (error) {
      console.error('[SyncService] Delete resume error:', error);
      this.queueChange(resumeId, 'delete');
      this.updateState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to delete resume',
      });
      return false;
    }
  }

  /**
   * Add change to sync queue for offline support
   */
  private queueChange(
    resumeId: string,
    action: 'create' | 'update' | 'delete',
    data?: Partial<Resume>
  ): void {
    const queueItem: SyncQueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      resumeId,
      action,
      data,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    // Remove any existing queue items for same resume
    this.syncQueue = this.syncQueue.filter((item) => item.resumeId !== resumeId);
    this.syncQueue.push(queueItem);

    this.updateState({ pendingChanges: this.syncQueue.length });
    this.persistQueue();
  }

  /**
   * Process queued changes when online
   */
  async processQueue(): Promise<void> {
    if (!this.isOnline || this.syncQueue.length === 0) return;

    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) return;

    const userId = session.session.user.id;
    const itemsToProcess = [...this.syncQueue];

    for (const item of itemsToProcess) {
      try {
        let success = false;

        switch (item.action) {
          case 'create':
            if (item.data) {
              success = await this.createResume(userId, item.data as Resume);
            }
            break;
          case 'update':
            if (item.data) {
              success = await this.saveResume(userId, item.data as Resume);
            }
            break;
          case 'delete':
            success = await this.deleteResume(userId, item.resumeId);
            break;
        }

        if (success) {
          this.syncQueue = this.syncQueue.filter((q) => q.id !== item.id);
        } else {
          // Increment retry count
          const queueItem = this.syncQueue.find((q) => q.id === item.id);
          if (queueItem) {
            queueItem.retryCount++;
            // Remove after 5 retries
            if (queueItem.retryCount >= 5) {
              this.syncQueue = this.syncQueue.filter((q) => q.id !== item.id);
            }
          }
        }
      } catch (error) {
        console.error('[SyncService] Process queue item error:', error);
      }
    }

    this.updateState({ pendingChanges: this.syncQueue.length });
    this.persistQueue();
  }

  /**
   * Persist queue to storage
   */
  private async persistQueue(): Promise<void> {
    try {
      // Using AsyncStorage would be better, but for simplicity
      // we'll rely on the store's persistence
    } catch (error) {
      console.error('[SyncService] Persist queue error:', error);
    }
  }

  /**
   * Set online status
   */
  setOnline(online: boolean): void {
    const wasOffline = !this.isOnline;
    this.isOnline = online;

    if (online && wasOffline) {
      // Process queue when coming back online
      this.processQueue();
      this.updateState({ status: 'syncing' });
    } else if (!online) {
      this.updateState({ status: 'offline' });
    }
  }

  /**
   * Get current sync state
   */
  getState(): SyncState {
    return this.state;
  }

  /**
   * Get pending queue items count
   */
  getPendingCount(): number {
    return this.syncQueue.length;
  }

  /**
   * Force sync all local data
   */
  async forceSync(userId: string, resumes: Resume[]): Promise<boolean> {
    try {
      this.updateState({ status: 'syncing' });

      for (const resume of resumes) {
        await this.saveResume(userId, resume);
      }

      this.updateState({
        status: 'synced',
        lastSyncedAt: new Date().toISOString(),
        error: null,
      });

      return true;
    } catch (error) {
      console.error('[SyncService] Force sync error:', error);
      this.updateState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Force sync failed',
      });
      return false;
    }
  }
}

export const syncService = new SyncService();
export default syncService;
