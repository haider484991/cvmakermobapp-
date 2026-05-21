/**
 * Social Sharing Service
 * Handles sharing achievements, referrals, and social features
 */

import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { Platform, Share, Alert } from 'react-native';
import { useGamificationStore } from '@/stores/gamificationStore';
import type { Achievement } from '@/stores/gamificationStore';

const APP_STORE_URL = 'https://play.google.com/store/apps/details?id=com.freeresumeai';
const APP_NAME = 'FreeResume AI';

export interface ShareResult {
  success: boolean;
  method: 'native' | 'clipboard' | 'cancelled';
  error?: string;
}

/**
 * Generate a referral code for the user
 */
export function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'FR';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Get referral code from store (doesn't create one - use initReferralCode first)
 */
export function getReferralCode(): string {
  const store = useGamificationStore.getState();
  return store.referralCode || 'LOADING';
}

/**
 * Initialize referral code if not exists (call this in useEffect)
 */
export function initReferralCode(): string {
  const store = useGamificationStore.getState();
  if (!store.referralCode) {
    const code = generateReferralCode();
    store.setReferralCode(code);
    return code;
  }
  return store.referralCode;
}

/**
 * Share an achievement
 */
export async function shareAchievement(achievement: Achievement): Promise<ShareResult> {
  const message = `🏆 I just unlocked "${achievement.name}" on ${APP_NAME}!\n\n${achievement.description}\n\nCreate your professional resume for free:\n${APP_STORE_URL}`;

  return shareMessage(message, `Achievement: ${achievement.name}`);
}

/**
 * Share resume score
 */
export async function shareResumeScore(score: number): Promise<ShareResult> {
  const emoji = score >= 80 ? '🌟' : score >= 60 ? '✨' : '📄';
  const message = `${emoji} My resume scored ${score}/100 on ${APP_NAME}!\n\nGet your resume scored by AI:\n${APP_STORE_URL}`;

  return shareMessage(message, 'Resume Score');
}

/**
 * Share referral link
 */
export async function shareReferralLink(): Promise<ShareResult> {
  const code = getReferralCode();
  const message = `Join me on ${APP_NAME} and get bonus XP!\n\nUse my referral code: ${code}\n\nDownload now:\n${APP_STORE_URL}`;

  return shareMessage(message, 'Invite Friends');
}

/**
 * Share app link
 */
export async function shareApp(): Promise<ShareResult> {
  const message = `📄 Create professional resumes for free with ${APP_NAME}!\n\n✨ AI-powered suggestions\n📊 ATS-friendly templates\n🎯 Resume scoring\n\nDownload now:\n${APP_STORE_URL}`;

  return shareMessage(message, 'Share FreeResume AI');
}

/**
 * Share a generic message using native share or clipboard
 */
async function shareMessage(message: string, title: string): Promise<ShareResult> {
  try {
    // Try native share first
    const result = await Share.share(
      {
        message,
        title,
      },
      {
        dialogTitle: title,
      }
    );

    if (result.action === Share.sharedAction) {
      return { success: true, method: 'native' };
    } else if (result.action === Share.dismissedAction) {
      return { success: false, method: 'cancelled' };
    }

    return { success: true, method: 'native' };
  } catch (error) {
    // Fallback to clipboard
    try {
      await Clipboard.setStringAsync(message);
      Alert.alert('Copied!', 'Share link copied to clipboard');
      return { success: true, method: 'clipboard' };
    } catch (clipboardError) {
      return {
        success: false,
        method: 'cancelled',
        error: 'Failed to share',
      };
    }
  }
}

/**
 * Copy referral code to clipboard
 */
export async function copyReferralCode(): Promise<boolean> {
  try {
    const code = getReferralCode();
    await Clipboard.setStringAsync(code);
    return true;
  } catch {
    return false;
  }
}

/**
 * Apply a referral code (when someone joins with a code)
 */
export function applyReferralCode(code: string): { success: boolean; bonus: number } {
  // Validate code format
  if (!code || code.length !== 8 || !code.startsWith('FR')) {
    return { success: false, bonus: 0 };
  }

  const store = useGamificationStore.getState();

  // Can't use own code
  if (code === store.referralCode) {
    return { success: false, bonus: 0 };
  }

  // Check if already used a referral
  if (store.usedReferralCode) {
    return { success: false, bonus: 0 };
  }

  // Apply the referral bonus
  const REFERRAL_BONUS = 100;
  store.addXP(REFERRAL_BONUS, 'referral');
  store.setUsedReferralCode(code);

  return { success: true, bonus: REFERRAL_BONUS };
}

export default {
  generateReferralCode,
  getReferralCode,
  shareAchievement,
  shareResumeScore,
  shareReferralLink,
  shareApp,
  copyReferralCode,
  applyReferralCode,
};
