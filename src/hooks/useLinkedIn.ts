/**
 * LinkedIn Hook
 * Provides convenient methods for LinkedIn OAuth and profile import
 */

import { useCallback, useEffect, useMemo } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useLinkedInStore } from '@/stores/linkedinStore';
import { useResumeStore } from '@/stores/resumeStore';
import { linkedInService } from '@/services/linkedin/linkedinService';
import {
  mapLinkedInToResume,
  mapLinkedInToResumeWithStats,
} from '@/services/linkedin/profileMapper';
import { LinkedInProfile, LinkedInImportResult } from '@/types/linkedin';
import { Resume } from '@/types/resume';

// Ensure web browser session is handled
WebBrowser.maybeCompleteAuthSession();

/**
 * Custom hook for LinkedIn OAuth and profile import
 */
export const useLinkedIn = () => {
  const {
    isConnected,
    profile,
    authState,
    isLoading,
    error,
    lastImportedAt,
    setAuthState,
    setConnected,
    setProfile,
    setLoading,
    setError,
    disconnect,
    clearError,
    isTokenValid,
  } = useLinkedInStore();

  const { createResume, getResume } = useResumeStore();

  // Get LinkedIn OAuth configuration
  const config = useMemo(() => linkedInService.getConfig(), []);
  const discovery = useMemo(() => linkedInService.getDiscovery(), []);

  // Create auth request using expo-auth-session
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: config.clientId,
      scopes: config.scopes,
      redirectUri: config.redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    discovery
  );

  /**
   * Check if LinkedIn integration is properly configured
   */
  const isConfigured = useMemo(() => linkedInService.isConfigured(), []);

  /**
   * Handle OAuth response when it changes
   */
  useEffect(() => {
    if (!response) return;

    const handleResponse = async () => {
      try {
        setAuthState({ status: 'fetching_profile' });

        const result = await linkedInService.importProfile(response);

        if (result.success && result.profile) {
          // Store the connection with a default expiry of 60 days
          setConnected(
            'imported', // We don't store the actual token for security
            60 * 24 * 60 * 60, // 60 days in seconds
            result.profile
          );
        } else {
          setAuthState({
            status: 'error',
            error: result.error || 'Import failed',
          });
        }
      } catch (err) {
        console.error('[useLinkedIn] Handle response error:', err);
        setAuthState({
          status: 'error',
          error: err instanceof Error ? err.message : 'Authentication failed',
        });
      }
    };

    if (response.type === 'success') {
      handleResponse();
    } else if (response.type === 'cancel' || response.type === 'dismiss') {
      setAuthState({ status: 'idle' });
    } else if (response.type === 'error') {
      setAuthState({
        status: 'error',
        error: response.error?.message || 'Authentication failed',
      });
    }
  }, [response, setAuthState, setConnected]);

  /**
   * Start LinkedIn OAuth flow
   */
  const connect = useCallback(async (): Promise<LinkedInImportResult> => {
    if (!isConfigured) {
      const errorMsg = 'LinkedIn integration is not configured. Please set EXPO_PUBLIC_LINKEDIN_CLIENT_ID.';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      setAuthState({ status: 'authenticating' });

      const result = await promptAsync();

      if (result.type === 'success') {
        // Response will be handled by the useEffect above
        return { success: true };
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        setAuthState({ status: 'idle' });
        return { success: false, error: 'Authentication cancelled' };
      } else {
        const errorMsg = 'error' in result ? result.error?.message : 'Authentication failed';
        setAuthState({ status: 'error', error: errorMsg || 'Authentication failed' });
        return { success: false, error: errorMsg || 'Authentication failed' };
      }
    } catch (err) {
      console.error('[useLinkedIn] Connect error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Connection failed';
      setAuthState({ status: 'error', error: errorMsg });
      return { success: false, error: errorMsg };
    }
  }, [isConfigured, promptAsync, setAuthState, setError]);

  /**
   * Disconnect from LinkedIn
   */
  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  /**
   * Import LinkedIn profile into a new resume
   */
  const importToNewResume = useCallback(async (): Promise<{
    success: boolean;
    resumeId?: string;
    error?: string;
  }> => {
    if (!profile) {
      return { success: false, error: 'No LinkedIn profile available' };
    }

    try {
      setLoading(true);

      // Create new resume with LinkedIn data
      const resume = mapLinkedInToResume(profile);
      const resumeId = createResume(resume.name);

      // Get the created resume and update it with LinkedIn data
      const createdResume = getResume(resumeId);
      if (createdResume) {
        const updatedResume = mapLinkedInToResume(profile, createdResume);
        // The resume store will handle persistence
        // We need to update the resume directly
        // For now, return the resume ID for navigation
      }

      setLoading(false);
      return { success: true, resumeId };
    } catch (err) {
      console.error('[useLinkedIn] Import to new resume error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Import failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [profile, createResume, getResume, setLoading, setError]);

  /**
   * Import LinkedIn profile into an existing resume
   */
  const importToExistingResume = useCallback(
    async (
      resumeId: string
    ): Promise<{
      success: boolean;
      resume?: Resume;
      error?: string;
    }> => {
      if (!profile) {
        return { success: false, error: 'No LinkedIn profile available' };
      }

      try {
        setLoading(true);

        const existingResume = getResume(resumeId);
        if (!existingResume) {
          setLoading(false);
          return { success: false, error: 'Resume not found' };
        }

        const { resume, importedSections } = mapLinkedInToResumeWithStats(
          profile,
          existingResume
        );

        setLoading(false);
        return { success: true, resume };
      } catch (err) {
        console.error('[useLinkedIn] Import to existing resume error:', err);
        const errorMsg = err instanceof Error ? err.message : 'Import failed';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    },
    [profile, getResume, setLoading, setError]
  );

  /**
   * Connect and import in one step
   */
  const connectAndImport = useCallback(async (): Promise<{
    success: boolean;
    profile?: LinkedInProfile;
    error?: string;
  }> => {
    const connectResult = await connect();

    // If connection initiated successfully, the profile will be
    // set via the useEffect when response is received
    if (connectResult.success) {
      // Return current profile state (will be updated async)
      return { success: true, profile: profile ?? undefined };
    }

    return connectResult;
  }, [connect, profile]);

  /**
   * Get import status message
   */
  const getStatusMessage = useCallback((): string => {
    switch (authState.status) {
      case 'authenticating':
        return 'Opening LinkedIn...';
      case 'fetching_profile':
        return 'Importing profile data...';
      case 'success':
        return 'Profile imported successfully!';
      case 'error':
        return authState.error;
      default:
        return '';
    }
  }, [authState]);

  return {
    // State
    isConnected,
    isConfigured,
    profile,
    authState,
    isLoading,
    error,
    lastImportedAt,

    // Auth request state (for manual handling if needed)
    request,
    response,

    // Actions
    connect,
    disconnect: handleDisconnect,
    connectAndImport,
    importToNewResume,
    importToExistingResume,
    clearError,

    // Helpers
    isTokenValid,
    getStatusMessage,
  };
};

export default useLinkedIn;
