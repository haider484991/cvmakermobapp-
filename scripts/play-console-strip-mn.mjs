/**
 * Strip the stray Mongolia (MN) regional config from all 3 products.
 *
 * The MN entry was inadvertently added during an earlier worldwide-pricing
 * run. It has units but no nanos, which appears to cause silent validation
 * failures in Play Billing — fetchProducts returns empty for the entire
 * app instead of just skipping MN. Removing it should unblock everyone.
 *
 * Worldwide availability stays — the otherRegionsConfig (subs) and
 * newRegionsConfig (lifetime) keep USD/EUR auto-conversion for all
 * regions including Mongolia.
 */
import { statSync } from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const PACKAGE = 'com.freeresumeai.app';
const KEY_PATH = path.join(process.cwd(), 'play-store-credentials.json');
const REGIONS_VERSION = '2022/02';

if (!statSync(KEY_PATH, { throwIfNoEntry: false })) process.exit(1);

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const publisher = google.androidpublisher({ version: 'v3', auth });

function errMsg(e) { return e?.errors?.[0]?.message || e?.message || String(e); }

async function stripFromSubscription(sku) {
  console.log(`\n=== Subscription: ${sku} ===`);
  try {
    const current = await publisher.monetization.subscriptions.get({
      packageName: PACKAGE, productId: sku,
    });
    let changedAny = false;
    const newBasePlans = (current.data.basePlans || []).map((bp) => {
      const before = bp.regionalConfigs || [];
      const after = before.filter((c) => c.regionCode !== 'MN');
      if (before.length !== after.length) {
        changedAny = true;
        console.log(`  base plan "${bp.basePlanId}": stripped MN (${before.length} → ${after.length} regions)`);
      }
      return { ...bp, regionalConfigs: after };
    });
    if (!changedAny) {
      console.log('  (no MN regional config — already clean)');
      return;
    }
    await publisher.monetization.subscriptions.patch({
      packageName: PACKAGE,
      productId: sku,
      updateMask: 'basePlans',
      'regionsVersion.version': REGIONS_VERSION,
      requestBody: { ...current.data, basePlans: newBasePlans },
    });
    console.log('  ✓ patched');
  } catch (err) {
    console.log('  ✖', errMsg(err));
  }
}

async function stripFromOneTime(sku) {
  console.log(`\n=== One-time product: ${sku} ===`);
  try {
    const current = await publisher.monetization.onetimeproducts.get({
      packageName: PACKAGE, productId: sku,
    });
    let changedAny = false;
    const newOptions = (current.data.purchaseOptions || []).map((po) => {
      const before = po.regionalPricingAndAvailabilityConfigs || [];
      const after = before.filter((c) => c.regionCode !== 'MN');
      if (before.length !== after.length) {
        changedAny = true;
        console.log(`  option "${po.purchaseOptionId}": stripped MN (${before.length} → ${after.length} regions)`);
      }
      return { ...po, regionalPricingAndAvailabilityConfigs: after };
    });
    if (!changedAny) {
      console.log('  (no MN regional config — already clean)');
      return;
    }
    await publisher.monetization.onetimeproducts.batchUpdate({
      packageName: PACKAGE,
      requestBody: {
        requests: [{
          updateMask: 'purchaseOptions',
          regionsVersion: { version: REGIONS_VERSION },
          oneTimeProduct: { ...current.data, purchaseOptions: newOptions },
        }],
      },
    });
    console.log('  ✓ patched');
  } catch (err) {
    console.log('  ✖', errMsg(err));
  }
}

(async () => {
  await stripFromSubscription('freeresume_premium_monthly');
  await stripFromSubscription('freeresume_premium_annual');
  await stripFromOneTime('freeresume_premium_lifetime');
  console.log('\nDone. Try paywall again — Play Billing should now return real prices.');
  console.log('Worldwide availability preserved via otherRegionsConfig / newRegionsConfig.');
})();
