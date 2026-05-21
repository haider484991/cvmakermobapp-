/**
 * In-app review prompt manager.
 *
 * Goal: Maximize 4-5★ Play Store reviews while staying inside Google's
 * quotas + minimizing friction for users who would leave 1-2★ feedback.
 *
 * Strategy:
 *   1. Track positive engagement signals (PDF exports, high scores,
 *      successful imports). Each one increments a value counter.
 *   2. Only become "eligible" after the user has had genuine positive
 *      experiences AND enough wall-clock time has passed for the install
 *      to feel real (not first-launch confusion).
 *   3. On eligible trigger, show our own "Are you enjoying X?" filter
 *      modal. Only users who tap "Loving it" see the native Play API
 *      review prompt — everyone else is routed to a feedback channel.
 *   4. Persist all state in AsyncStorage so cooldowns survive reinstalls
 *      of just the app process (not the OS).
 *
 * Google Play's quota is roughly 3 native prompts per year per user. Our
 * own cooldown is more conservative (60 days) so the user doesn't feel
 * pestered.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const STORAGE_KEY = '@review/state-v1';

interface ReviewState {
  /** First launch timestamp (ms) — set on first read */
  firstLaunchAt: number;
  /** Session count — incremented at most once per calendar day */
  sessionCount: number;
  /** Most recent date we counted a session (yyyy-mm-dd) */
  lastSessionDate: string;
  /** Number of successful PDF exports */
  pdfExports: number;
  /** Number of successful resume imports */
  resumeImports: number;
  /** Highest AI score achieved (0–100) */
  bestScore: number;
  /** Last time we showed the happy-path filter (ms) */
  lastPromptAt: number | null;
  /** Whether the user accepted (tapped "Loving it") */
  hasAccepted: boolean;
  /** Whether the user explicitly declined ("Not yet") */
  hasDeclined: boolean;
}

const DEFAULT_STATE: ReviewState = {
  firstLaunchAt: 0,
  sessionCount: 0,
  lastSessionDate: '',
  pdfExports: 0,
  resumeImports: 0,
  bestScore: 0,
  lastPromptAt: null,
  hasAccepted: false,
  hasDeclined: false,
};

/** Minimum signals before we even consider asking */
export const ELIGIBILITY = {
  /** Must have been installed at least this long */
  minInstallAgeMs: 2 * 24 * 60 * 60 * 1000, // 2 days
  /** At least this many sessions on different days */
  minSessions: 2,
  /** At least one strong positive moment */
  minStrongSignals: 1,
  /** Don't re-prompt for this long after a prior prompt */
  cooldownMs: 60 * 24 * 60 * 60 * 1000, // 60 days
};

let cached: ReviewState | null = null;

async function readState(): Promise<ReviewState> {
  if (cached) return cached;
  let next: ReviewState;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    next = raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : { ...DEFAULT_STATE };
  } catch {
    next = { ...DEFAULT_STATE };
  }
  if (!next.firstLaunchAt) {
    next.firstLaunchAt = Date.now();
    await writeState(next);
  }
  cached = next;
  return next;
}

async function writeState(state: ReviewState): Promise<void> {
  cached = state;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // best-effort — cooldown will reset next launch if write fails
  }
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * Call once at app startup so we record session activity. Idempotent
 * per calendar day — calling it 10 times today still counts as 1
 * session, but tomorrow's first call increments.
 */
export async function recordSession(): Promise<void> {
  const s = await readState();
  const today = todayKey();
  if (s.lastSessionDate !== today) {
    s.sessionCount += 1;
    s.lastSessionDate = today;
    await writeState(s);
  }
}

/**
 * Positive-signal hooks. Wire each to its corresponding user action.
 */
export const reviewSignals = {
  async pdfExported(): Promise<void> {
    const s = await readState();
    s.pdfExports += 1;
    await writeState(s);
  },
  async resumeImported(): Promise<void> {
    const s = await readState();
    s.resumeImports += 1;
    await writeState(s);
  },
  async scoreAchieved(score: number): Promise<void> {
    const s = await readState();
    if (score > s.bestScore) {
      s.bestScore = score;
      await writeState(s);
    }
  },
};

/**
 * Returns true if the user is eligible to see the happy-path filter
 * right now. False means we should silently skip.
 */
export async function isEligible(): Promise<boolean> {
  const s = await readState();
  const now = Date.now();

  // Hard blockers
  if (s.hasAccepted) return false; // already left a review
  if (s.hasDeclined) {
    // give one re-ask after a long cooldown
    if (s.lastPromptAt && now - s.lastPromptAt < ELIGIBILITY.cooldownMs) return false;
  }
  if (s.lastPromptAt && now - s.lastPromptAt < ELIGIBILITY.cooldownMs) return false;

  // Minimum bar
  if (now - s.firstLaunchAt < ELIGIBILITY.minInstallAgeMs) return false;
  if (s.sessionCount < ELIGIBILITY.minSessions) return false;

  // Count "strong signals" — only ask people who clearly got value
  const strong =
    (s.pdfExports > 0 ? 1 : 0) +
    (s.resumeImports > 0 ? 1 : 0) +
    (s.bestScore >= 80 ? 1 : 0);
  if (strong < ELIGIBILITY.minStrongSignals) return false;

  return true;
}

/**
 * Mark that we showed the happy-path filter. Doesn't matter what the
 * user did — we never want to reshow within the cooldown.
 */
export async function markPrompted(): Promise<void> {
  const s = await readState();
  s.lastPromptAt = Date.now();
  await writeState(s);
}

/**
 * The user said they love the app. Open the native Play Store review
 * dialog. If the native API is unavailable for any reason (Expo Go,
 * device with no Play Store, etc.), fall back to a deep link.
 */
export async function requestNativeReview(): Promise<boolean> {
  const s = await readState();
  s.hasAccepted = true;
  await writeState(s);

  try {
    const isAvailable = await StoreReview.isAvailableAsync();
    if (!isAvailable) {
      return await fallbackOpenStorePage();
    }
    const hasAction = await StoreReview.hasAction();
    if (!hasAction) {
      return await fallbackOpenStorePage();
    }
    await StoreReview.requestReview();
    return true;
  } catch {
    return await fallbackOpenStorePage();
  }
}

async function fallbackOpenStorePage(): Promise<boolean> {
  try {
    const url = await StoreReview.storeUrl();
    if (url) {
      const Linking = require('expo-linking');
      await Linking.openURL(url);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * The user said they're NOT loving it. Record decline so we don't
 * pester them, and the caller should open a feedback channel.
 */
export async function recordDecline(): Promise<void> {
  const s = await readState();
  s.hasDeclined = true;
  await writeState(s);
}

/**
 * Reset state — useful for QA + the "ask me again" debug path.
 */
export async function resetReviewState(): Promise<void> {
  cached = null;
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/**
 * For debugging / settings.
 */
export async function getReviewState(): Promise<Readonly<ReviewState>> {
  return await readState();
}
