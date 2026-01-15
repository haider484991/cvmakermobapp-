/**
 * LinkedIn Store
 * Manages LinkedIn connection state and profile data
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinkedInProfile, LinkedInAuthState } from '@/types/linkedin';

interface LinkedInState {
  // Connection state
  isConnected: boolean;
  accessToken: string | null;
  tokenExpiresAt: number | null;

  // Profile state
  profile: LinkedInProfile | null;

  // Operation state
  authState: LinkedInAuthState;
  isLoading: boolean;
  error: string | null;
  lastImportedAt: string | null;

  // Actions
  setAuthState: (state: LinkedInAuthState) => void;
  setConnected: (
    accessToken: string,
    expiresIn: number,
    profile: LinkedInProfile
  ) => void;
  setProfile: (profile: LinkedInProfile | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  disconnect: () => void;
  clearError: () => void;

  // Computed
  isTokenValid: () => boolean;
}

export const useLinkedInStore = create<LinkedInState>()(
  persist(
    (set, get) => ({
      // Initial state
      isConnected: false,
      accessToken: null,
      tokenExpiresAt: null,
      profile: null,
      authState: { status: 'idle' },
      isLoading: false,
      error: null,
      lastImportedAt: null,

      // Actions
      setAuthState: (authState) => {
        set({ authState });

        // Update loading state based on auth state
        if (
          authState.status === 'loading' ||
          authState.status === 'authenticating' ||
          authState.status === 'fetching_profile'
        ) {
          set({ isLoading: true, error: null });
        } else if (authState.status === 'success') {
          set({
            isLoading: false,
            profile: authState.profile,
            lastImportedAt: new Date().toISOString(),
          });
        } else if (authState.status === 'error') {
          set({ isLoading: false, error: authState.error });
        } else {
          set({ isLoading: false });
        }
      },

      setConnected: (accessToken, expiresIn, profile) => {
        const tokenExpiresAt = Date.now() + expiresIn * 1000;
        set({
          isConnected: true,
          accessToken,
          tokenExpiresAt,
          profile,
          error: null,
          lastImportedAt: new Date().toISOString(),
          authState: { status: 'success', profile },
        });
      },

      setProfile: (profile) => {
        set({
          profile,
          ...(profile && { lastImportedAt: new Date().toISOString() }),
        });
      },

      setLoading: (isLoading) => {
        set({ isLoading });
      },

      setError: (error) => {
        set({
          error,
          isLoading: false,
          authState: error ? { status: 'error', error } : { status: 'idle' },
        });
      },

      disconnect: () => {
        set({
          isConnected: false,
          accessToken: null,
          tokenExpiresAt: null,
          profile: null,
          authState: { status: 'idle' },
          error: null,
        });
      },

      clearError: () => {
        set({
          error: null,
          authState:
            get().authState.status === 'error'
              ? { status: 'idle' }
              : get().authState,
        });
      },

      // Computed
      isTokenValid: () => {
        const { accessToken, tokenExpiresAt } = get();
        if (!accessToken || !tokenExpiresAt) return false;

        // Add 5 minute buffer for token expiration
        const bufferMs = 5 * 60 * 1000;
        return Date.now() < tokenExpiresAt - bufferMs;
      },
    }),
    {
      name: 'linkedin-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist connection status and profile, not tokens for security
      partialize: (state) => ({
        isConnected: state.isConnected,
        profile: state.profile,
        lastImportedAt: state.lastImportedAt,
      }),
    }
  )
);

// Selectors for convenience
export const selectIsLinkedInConnected = (state: LinkedInState) =>
  state.isConnected;

export const selectLinkedInProfile = (state: LinkedInState) => state.profile;

export const selectLinkedInAuthState = (state: LinkedInState) => state.authState;

export const selectLinkedInIsLoading = (state: LinkedInState) => state.isLoading;

export const selectLinkedInError = (state: LinkedInState) => state.error;
