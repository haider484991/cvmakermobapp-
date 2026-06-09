/**
 * Show exactly which regions each product is available in + whether the
 * "other regions" worldwide fallback is actually enabled. The Play Console
 * UI says "3 countries" — this proves whether the products are truly
 * worldwide or limited.
 */
import { statSync } from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const PACKAGE = 'com.freeresumeai.app';
const KEY_PATH = path.join(process.cwd(), 'play-store-credentials.json');
if (!statSync(KEY_PATH, { throwIfNoEntry: false })) process.exit(1);
const auth = new google.auth.GoogleAuth({ keyFile: KEY_PATH, scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
const publisher = google.androidpublisher({ version: 'v3', auth });

for (const sku of ['freeresume_premium_monthly', 'freeresume_premium_annual']) {
  console.log(`\n==== ${sku} ====`);
  const r = await publisher.monetization.subscriptions.get({ packageName: PACKAGE, productId: sku });
  for (const bp of r.data.basePlans || []) {
    const regions = (bp.regionalConfigs || []).map((c) => c.regionCode);
    console.log(`  basePlan "${bp.basePlanId}": ${regions.length} explicit regions: [${regions.join(', ')}]`);
    console.log(`    otherRegionsConfig:`, bp.otherRegionsConfig
      ? `newSubAvail=${bp.otherRegionsConfig.newSubscriberAvailability}`
      : 'NONE (not worldwide!)');
  }
}

console.log(`\n==== freeresume_premium_lifetime ====`);
const ot = await publisher.monetization.onetimeproducts.get({ packageName: PACKAGE, productId: 'freeresume_premium_lifetime' });
for (const po of ot.data.purchaseOptions || []) {
  const regions = (po.regionalPricingAndAvailabilityConfigs || []).map((c) => c.regionCode);
  console.log(`  purchaseOption "${po.purchaseOptionId}": ${regions.length} explicit regions: [${regions.join(', ')}]`);
  console.log(`    newRegionsConfig:`, po.newRegionsConfig
    ? `availability=${po.newRegionsConfig.availability}`
    : 'NONE (not worldwide!)');
}
