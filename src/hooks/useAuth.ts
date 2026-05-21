import { useCallback, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

/**
 * Custom hook that wraps the auth store with convenient methods
 * and handles loading states for auth operations.
 */
export const useAuth = () => {
  const {
    user,
    session,
    profile,
    isLoading,
    isInitialized,
    isAuthenticated,
    error,
    initialize,
    signIn,
    signUp,
    signOut,
    deleteAccount,
    resetPassword,
    updatePassword,
    refreshSession,
    fetchProfile,
    updateProfile,
    clearError,
  } = useAuthStore();

  // Initialize auth on first mount
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  // Convenience method to handle sign in with loading state
  const handleSignIn = useCallback(
    async (email: string, password: string) => {
      clearError();
      return signIn(email, password);
    },
    [signIn, clearError]
  );

  // Convenience method to handle sign up with loading state
  const handleSignUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      clearError();
      return signUp(email, password, fullName);
    },
    [signUp, clearError]
  );

  // Convenience method to handle sign out
  const handleSignOut = useCallback(async () => {
    clearError();
    return signOut();
  }, [signOut, clearError]);

  // Convenience method to handle password reset
  const handleResetPassword = useCallback(
    async (email: string) => {
      clearError();
      return resetPassword(email);
    },
    [resetPassword, clearError]
  );

  // Convenience method to handle password update
  const handleUpdatePassword = useCallback(
    async (newPassword: string) => {
      clearError();
      return updatePassword(newPassword);
    },
    [updatePassword, clearError]
  );

  // Convenience method to handle account deletion
  const handleDeleteAccount = useCallback(async () => {
    clearError();
    return deleteAccount();
  }, [deleteAccount, clearError]);

  // Get user's display name
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email || '';

  // Get user's initials for avatar
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Get user's avatar URL
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || null;

  // Check if user has a specific subscription tier
  const hasSubscription = (tier: 'pro' | 'premium'): boolean => {
    if (!profile) return false;
    if (tier === 'pro') {
      return profile.subscription_tier === 'pro' || profile.subscription_tier === 'premium';
    }
    return profile.subscription_tier === 'premium';
  };

  // Check if user has AI credits remaining
  const hasAiCredits = (profile?.ai_credits_remaining ?? 0) > 0;

  // Get remaining AI credits
  const aiCreditsRemaining = profile?.ai_credits_remaining ?? 0;

  return {
    // State
    user,
    session,
    profile,
    isLoading,
    isInitialized,
    isAuthenticated,
    error,

    // User info helpers
    displayName,
    initials,
    avatarUrl,
    email: user?.email || '',

    // Subscription helpers
    hasSubscription,
    subscriptionTier: profile?.subscription_tier || 'free',
    hasAiCredits,
    aiCreditsRemaining,

    // Auth actions
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
    deleteAccount: handleDeleteAccount,
    resetPassword: handleResetPassword,
    updatePassword: handleUpdatePassword,
    refreshSession,
    fetchProfile,
    updateProfile,
    clearError,
    initialize,
  };
};

export default useAuth;
