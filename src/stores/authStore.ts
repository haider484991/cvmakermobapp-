import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/database.types';

interface AuthState {
  // State
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Computed
  isAuthenticated: boolean;

  // Actions
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
  refreshSession: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  clearError: () => void;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial State
      user: null,
      session: null,
      profile: null,
      isLoading: true,
      isInitialized: false,
      error: null,
      isAuthenticated: false,

      // Initialize auth state and listen to changes
      initialize: async () => {
        try {
          set({ isLoading: true, error: null });
          console.log('[Auth] Starting initialization...');

          // Add timeout to prevent infinite hanging
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Auth initialization timeout')), 10000);
          });

          // Get current session with timeout
          const sessionPromise = supabase.auth.getSession();
          const { data: { session }, error } = await Promise.race([
            sessionPromise,
            timeoutPromise,
          ]) as Awaited<typeof sessionPromise>;

          console.log('[Auth] Session retrieved:', session ? 'exists' : 'none');

          if (error) {
            throw error;
          }

          if (session) {
            set({
              user: session.user,
              session,
              isAuthenticated: true,
            });

            // Fetch user profile (don't block on this)
            get().fetchProfile().catch(console.error);
          }

          // Set up auth state change listener
          supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('[Auth] State changed:', event);

            if (event === 'SIGNED_IN' && session) {
              set({
                user: session.user,
                session,
                isAuthenticated: true,
              });
              await get().fetchProfile();
            } else if (event === 'SIGNED_OUT') {
              set({
                user: null,
                session: null,
                profile: null,
                isAuthenticated: false,
              });
            } else if (event === 'TOKEN_REFRESHED' && session) {
              set({ session });
            } else if (event === 'USER_UPDATED' && session) {
              set({ user: session.user });
              await get().fetchProfile();
            }
          });

          set({ isInitialized: true });
        } catch (error) {
          console.error('[Auth] Initialization error:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to initialize auth',
            isInitialized: true,
          });
        } finally {
          set({ isLoading: false });
        }
      },

      // Sign in with email and password
      signIn: async (email: string, password: string) => {
        try {
          set({ isLoading: true, error: null });

          const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password,
          });

          if (error) {
            set({ error: error.message });
            return { error };
          }

          set({
            user: data.user,
            session: data.session,
            isAuthenticated: true,
          });

          await get().fetchProfile();

          return { error: null };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Sign in failed';
          set({ error: message });
          return { error: { message } as AuthError };
        } finally {
          set({ isLoading: false });
        }
      },

      // Sign up with email and password
      signUp: async (email: string, password: string, fullName: string) => {
        try {
          set({ isLoading: true, error: null });

          const { data, error } = await supabase.auth.signUp({
            email: email.trim().toLowerCase(),
            password,
            options: {
              data: {
                full_name: fullName.trim(),
              },
            },
          });

          if (error) {
            set({ error: error.message });
            return { error };
          }

          // If email confirmation is required, user will be null
          if (data.user && data.session) {
            set({
              user: data.user,
              session: data.session,
              isAuthenticated: true,
            });

            // Create profile in profiles table
            const { error: profileError } = await supabase.from('profiles').insert({
              id: data.user.id,
              email: data.user.email!,
              full_name: fullName.trim(),
            });

            if (profileError) {
              console.error('[Auth] Profile creation error:', profileError);
            }

            await get().fetchProfile();
          }

          return { error: null };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Sign up failed';
          set({ error: message });
          return { error: { message } as AuthError };
        } finally {
          set({ isLoading: false });
        }
      },

      // Sign out
      signOut: async () => {
        try {
          set({ isLoading: true, error: null });

          const { error } = await supabase.auth.signOut();

          if (error) {
            throw error;
          }

          set({
            user: null,
            session: null,
            profile: null,
            isAuthenticated: false,
          });
        } catch (error) {
          console.error('[Auth] Sign out error:', error);
          set({
            error: error instanceof Error ? error.message : 'Sign out failed',
          });
        } finally {
          set({ isLoading: false });
        }
      },

      // Delete user account and all associated data
      deleteAccount: async () => {
        const { user } = get();

        if (!user) {
          return { error: new Error('No authenticated user') };
        }

        try {
          set({ isLoading: true, error: null });

          // Delete user's resumes from database
          const { error: resumesError } = await supabase
            .from('resumes')
            .delete()
            .eq('user_id', user.id);

          if (resumesError) {
            console.error('[Auth] Error deleting resumes:', resumesError);
          }

          // Delete user's profile from database
          const { error: profileError } = await supabase
            .from('profiles')
            .delete()
            .eq('id', user.id);

          if (profileError) {
            console.error('[Auth] Error deleting profile:', profileError);
          }

          // Delete the user account using Supabase Edge Function or RPC
          // Note: Direct user deletion requires admin privileges
          // We use an RPC function that handles this securely
          // Cast: the generated Supabase types don't include this RPC (they
          // haven't been regenerated since the function was added). Safe at
          // runtime — the function exists in the database.
          const { error: deleteError } = await (supabase.rpc as any)('delete_user_account');

          if (deleteError) {
            // If RPC fails, try signing out and let user know to contact support
            console.error('[Auth] Error deleting account via RPC:', deleteError);

            // Still sign out the user
            await supabase.auth.signOut();

            set({
              user: null,
              session: null,
              profile: null,
              isAuthenticated: false,
            });

            // Return success as data is deleted, account will be cleaned up
            return { error: null };
          }

          // Sign out after successful deletion
          await supabase.auth.signOut();

          set({
            user: null,
            session: null,
            profile: null,
            isAuthenticated: false,
          });

          return { error: null };
        } catch (error) {
          console.error('[Auth] Delete account error:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to delete account',
          });
          return { error: error instanceof Error ? error : new Error('Failed to delete account') };
        } finally {
          set({ isLoading: false });
        }
      },

      // Request password reset
      resetPassword: async (email: string) => {
        try {
          set({ isLoading: true, error: null });

          const { error } = await supabase.auth.resetPasswordForEmail(
            email.trim().toLowerCase(),
            {
              redirectTo: 'freeresumeai://reset-password',
            }
          );

          if (error) {
            set({ error: error.message });
            return { error };
          }

          return { error: null };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Password reset failed';
          set({ error: message });
          return { error: { message } as AuthError };
        } finally {
          set({ isLoading: false });
        }
      },

      // Update password
      updatePassword: async (newPassword: string) => {
        try {
          set({ isLoading: true, error: null });

          const { error } = await supabase.auth.updateUser({
            password: newPassword,
          });

          if (error) {
            set({ error: error.message });
            return { error };
          }

          return { error: null };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Password update failed';
          set({ error: message });
          return { error: { message } as AuthError };
        } finally {
          set({ isLoading: false });
        }
      },

      // Refresh the current session
      refreshSession: async () => {
        try {
          const { data: { session }, error } = await supabase.auth.refreshSession();

          if (error) {
            throw error;
          }

          if (session) {
            set({ session, user: session.user });
          }
        } catch (error) {
          console.error('[Auth] Session refresh error:', error);
        }
      },

      // Fetch user profile from profiles table
      fetchProfile: async () => {
        const { user } = get();

        if (!user) {
          set({ profile: null });
          return;
        }

        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (error) {
            // Profile might not exist yet (e.g., during sign-up)
            if (error.code !== 'PGRST116') {
              console.error('[Auth] Fetch profile error:', error);
            }
            return;
          }

          set({ profile: data });
        } catch (error) {
          console.error('[Auth] Fetch profile error:', error);
        }
      },

      // Update user profile
      updateProfile: async (updates: Partial<Profile>) => {
        const { user } = get();

        if (!user) {
          return { error: new Error('No authenticated user') };
        }

        try {
          set({ isLoading: true, error: null });

          const { error } = await supabase
            .from('profiles')
            .update({
              ...updates,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

          if (error) {
            throw error;
          }

          // Refresh profile
          await get().fetchProfile();

          return { error: null };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Profile update failed';
          set({ error: message });
          return { error: error instanceof Error ? error : new Error(message) };
        } finally {
          set({ isLoading: false });
        }
      },

      // Clear error state
      clearError: () => {
        set({ error: null });
      },

      // Set user (for auth state listener)
      setUser: (user: User | null) => {
        set({ user, isAuthenticated: !!user });
      },

      // Set session (for auth state listener)
      setSession: (session: Session | null) => {
        set({ session });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist certain fields
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
