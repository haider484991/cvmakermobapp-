/**
 * Create a 1-day free trial offer on the monthly + annual subscriptions,
 * covering ALL regions the base plan is available in (173), targeted at
 * new subscribers. Then activate it.
 *
 * Why a NEW offer id (not reusing monthly-trial): those are INACTIVE and
 * the API can't move an offer back to DRAFT to edit it. A fresh offer is
 * the clean path. The old inactive offers stay harmlessly inactive.
 *
 * One-time products (lifetime) cannot have trials — skipped.
 */
import { statSync } from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const PACKAGE = 'com.freeresumeai.app';
const KEY_PATH = path.join(process.cwd(), 'play-store-credentials.json');
const NEW_OFFER_ID = 'trial-1day';
if (!statSync(KEY_PATH, { throwIfNoEntry: false })) process.exit(1);

const auth = new google.auth.GoogleAuth({ keyFile: KEY_PATH, scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
const publisher = google.androidpublisher({ version: 'v3', auth });
const errMsg = (e) => e?.errors?.[0]?.message || e?.message || String(e);

// Match the regions version the base plans were written with.
const REGIONS_VERSION = '2025/03';

async function createTrial(sku, basePlanId) {
  console.log(`\n=== ${sku} / ${basePlanId} ===`);
  // 1. Pull the base plan's region list so the offer matches exactly.
  const sub = await publisher.monetization.subscriptions.get({ packageName: PACKAGE, productId: sku });
  const bp = (sub.data.basePlans || []).find((b) => b.basePlanId === basePlanId);
  if (!bp) { console.log('  ✖ base plan not found'); return; }
  const regionCodes = (bp.regionalConfigs || []).map((c) => c.regionCode);
  console.log(`  base plan covers ${regionCodes.length} regions`);

  // 2. Build a 1-day free trial offer for new subscribers, free in every region.
  const offerBody = {
    packageName: PACKAGE,
    productId: sku,
    basePlanId,
    offerId: NEW_OFFER_ID,
    phases: [
      {
        recurrenceCount: 1,
        // Google Play minimum free-trial length is 3 days — 1 day is
        // rejected ("duration too short"). 3 days is the shortest allowed.
        duration: 'P3D',
        regionalConfigs: regionCodes.map((rc) => ({ regionCode: rc, free: {} })),
        otherRegionsConfig: { free: {} },
      },
    ],
    regionalConfigs: regionCodes.map((rc) => ({ regionCode: rc, newSubscriberAvailability: true })),
    otherRegionsConfig: { otherRegionsNewSubscriberAvailability: true },
    // New-customer acquisition: only users who've never subscribed to THIS
    // subscription are eligible for the free trial.
    targeting: { acquisitionRule: { scope: { thisSubscription: {} } } },
    offerTags: [{ tag: 'freetrial' }],
  };

  // 3. Create (DRAFT), then activate.
  try {
    await publisher.monetization.subscriptions.basePlans.offers.create({
      packageName: PACKAGE,
      productId: sku,
      basePlanId,
      offerId: NEW_OFFER_ID,
      'regionsVersion.version': REGIONS_VERSION,
      requestBody: offerBody,
    });
    console.log('  ✓ created (draft)');
  } catch (e) {
    const msg = errMsg(e);
    if (msg.includes('already exists')) {
      console.log('  (offer already exists — will just (re)activate)');
    } else {
      console.log('  ✖ create:', msg);
      return;
    }
  }

  try {
    await publisher.monetization.subscriptions.basePlans.offers.activate({
      packageName: PACKAGE,
      productId: sku,
      basePlanId,
      offerId: NEW_OFFER_ID,
      requestBody: {},
    });
    console.log('  ✓ activated — 1-day free trial live');
  } catch (e) {
    console.log('  ✖ activate:', errMsg(e));
  }
}

(async () => {
  await createTrial('freeresume_premium_monthly', 'monthly');
  await createTrial('freeresume_premium_annual', 'annual');
  console.log('\nDone. 1-day free trial active on monthly + annual, all regions.');
  console.log('Re-test the paywall — the CTA should show "Start 1-day free trial".');
})();
