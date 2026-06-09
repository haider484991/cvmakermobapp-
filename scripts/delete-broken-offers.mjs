/**
 * Delete the malformed trial offers on the monthly + annual subscriptions.
 *
 * The offers are broken: phase free=false (not actually a free trial) and
 * only target ["MN","US"] regions while the base plan is worldwide. A
 * structurally-invalid offer can make BillingClient's queryProductDetails
 * fail for the ENTIRE subscription — the "Failed to query product" symptom.
 *
 * Products remain fully purchasable without the offer (just no free trial).
 * We can add a CORRECT free-trial offer later once queries work.
 *
 * Flow per offer: deactivate (if active) → delete.
 */
import { statSync } from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const PACKAGE = 'com.freeresumeai.app';
const KEY_PATH = path.join(process.cwd(), 'play-store-credentials.json');
if (!statSync(KEY_PATH, { throwIfNoEntry: false })) process.exit(1);

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const publisher = google.androidpublisher({ version: 'v3', auth });
const errMsg = (e) => e?.errors?.[0]?.message || e?.message || String(e);

const TARGETS = [
  { sku: 'freeresume_premium_monthly', basePlanId: 'monthly' },
  { sku: 'freeresume_premium_annual', basePlanId: 'annual' },
];

for (const { sku, basePlanId } of TARGETS) {
  console.log(`\n=== ${sku} / ${basePlanId} ===`);
  try {
    const offers = await publisher.monetization.subscriptions.basePlans.offers.list({
      packageName: PACKAGE,
      productId: sku,
      basePlanId,
    });
    const list = offers.data.subscriptionOffers || [];
    if (!list.length) {
      console.log('  (no offers)');
      continue;
    }
    for (const o of list) {
      console.log(`  offer "${o.offerId}" state=${o.state}`);
      // Deactivate first if active (can't delete an active offer).
      if (o.state === 'ACTIVE') {
        try {
          await publisher.monetization.subscriptions.basePlans.offers.deactivate({
            packageName: PACKAGE,
            productId: sku,
            basePlanId,
            offerId: o.offerId,
            requestBody: {},
          });
          console.log('    ✓ deactivated');
        } catch (e) {
          console.log('    ✖ deactivate:', errMsg(e));
        }
      }
      // Delete.
      try {
        await publisher.monetization.subscriptions.basePlans.offers.delete({
          packageName: PACKAGE,
          productId: sku,
          basePlanId,
          offerId: o.offerId,
        });
        console.log('    ✓ deleted');
      } catch (e) {
        console.log('    ✖ delete:', errMsg(e));
      }
    }
  } catch (e) {
    console.log('  ✖', errMsg(e));
  }
}

console.log('\nDone. Broken trial offers removed. Base plans stay ACTIVE +');
console.log('purchasable. Re-test the paywall in ~5-15 min (server propagation).');
