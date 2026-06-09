/**
 * Dump the FULL regional config of every product so we can see why the MN
 * strip patch silently failed. The diagnose script summarises — this prints
 * the raw structure.
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

async function inspectSub(sku) {
  console.log(`\n=== Subscription: ${sku} ===`);
  const r = await publisher.monetization.subscriptions.get({
    packageName: PACKAGE, productId: sku,
  });
  for (const bp of r.data.basePlans || []) {
    console.log(`\n  base plan "${bp.basePlanId}" state=${bp.state}`);
    console.log('  regionalConfigs:');
    for (const c of bp.regionalConfigs || []) {
      console.log(`    - ${c.regionCode}: price=${JSON.stringify(c.price)} newSubAvail=${c.newSubscriberAvailability}`);
    }
    console.log('  otherRegionsConfig:', JSON.stringify(bp.otherRegionsConfig, null, 2));
  }
}

async function inspectOneTime(sku) {
  console.log(`\n=== One-time: ${sku} ===`);
  const r = await publisher.monetization.onetimeproducts.get({
    packageName: PACKAGE, productId: sku,
  });
  for (const po of r.data.purchaseOptions || []) {
    console.log(`\n  option "${po.purchaseOptionId}" state=${po.state}`);
    console.log('  regionalPricingAndAvailabilityConfigs:');
    for (const c of po.regionalPricingAndAvailabilityConfigs || []) {
      console.log(`    - ${c.regionCode}: price=${JSON.stringify(c.price)} availability=${c.availability}`);
    }
    console.log('  newRegionsConfig:', JSON.stringify(po.newRegionsConfig, null, 2));
  }
}

(async () => {
  await inspectSub('freeresume_premium_monthly');
  await inspectSub('freeresume_premium_annual');
  await inspectOneTime('freeresume_premium_lifetime');
})();
