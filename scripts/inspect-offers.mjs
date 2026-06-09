/**
 * Dump the full subscription including base-plan OFFERS + their states.
 * A free-trial offer in a broken / pending state can make BillingClient's
 * queryProductDetails fail for the entire subscription.
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

for (const sku of ['freeresume_premium_monthly', 'freeresume_premium_annual']) {
  console.log(`\n======== ${sku} ========`);
  const sub = await publisher.monetization.subscriptions.get({ packageName: PACKAGE, productId: sku });
  console.log('subscription.archived:', sub.data.archived ?? false);
  for (const bp of sub.data.basePlans || []) {
    console.log(`  basePlan "${bp.basePlanId}" state=${bp.state} autoRenewing=${bp.autoRenewingBasePlanType ? 'yes' : (bp.prepaidBasePlanType ? 'prepaid' : '?')}`);
  }
  // List offers per base plan
  for (const bp of sub.data.basePlans || []) {
    try {
      const offers = await publisher.monetization.subscriptions.basePlans.offers.list({
        packageName: PACKAGE,
        productId: sku,
        basePlanId: bp.basePlanId,
      });
      const list = offers.data.subscriptionOffers || [];
      console.log(`  offers for "${bp.basePlanId}": ${list.length}`);
      for (const o of list) {
        console.log(`    - offerId="${o.offerId}" state=${o.state} tags=${(o.offerTags || []).map((t) => t.tag).join(',')}`);
        // Phases
        for (const ph of o.phases || []) {
          console.log(`        phase: ${ph.recurrenceCount ?? '?'}x ${JSON.stringify(ph.regionalConfigs?.map((r) => r.regionCode) || [])} free=${!!ph.free}`);
        }
      }
    } catch (e) {
      console.log(`  (offers list failed: ${e?.errors?.[0]?.message || e?.message})`);
    }
  }
}

// One-time product state
console.log(`\n======== freeresume_premium_lifetime ========`);
const ot = await publisher.monetization.onetimeproducts.get({ packageName: PACKAGE, productId: 'freeresume_premium_lifetime' });
console.log('purchaseOptions:', (ot.data.purchaseOptions || []).map((p) => `${p.purchaseOptionId}:${p.state}`).join(', '));
console.log('offers:', JSON.stringify((ot.data.purchaseOptions || []).map((p) => p.offers?.length || 0)));
