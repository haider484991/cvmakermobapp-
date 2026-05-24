/**
 * Diagnose "failed to query products" on the device.
 *
 * Checks every Play-side reason this can happen and prints what needs
 * fixing. Doesn't mutate anything.
 */

import { statSync } from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const PACKAGE = 'com.freeresumeai.app';
const KEY_PATH = path.join(process.cwd(), 'play-store-credentials.json');

if (!statSync(KEY_PATH, { throwIfNoEntry: false })) {
  console.error('Missing service account key at', KEY_PATH);
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const publisher = google.androidpublisher({ version: 'v3', auth });

function band(t) {
  console.log(`\n${'━'.repeat(64)}\n${t}\n${'━'.repeat(64)}`);
}

async function main() {
  console.log(`Diagnosing "failed to query products" for ${PACKAGE}\n`);

  band('1. SUBSCRIPTION STATE');
  for (const sku of ['freeresume_premium_monthly', 'freeresume_premium_annual']) {
    try {
      const s = await publisher.monetization.subscriptions.get({
        packageName: PACKAGE,
        productId: sku,
      });
      const basePlans = s.data.basePlans || [];
      console.log(`  ${sku}`);
      console.log(`    listings: ${(s.data.listings || []).length}  basePlans: ${basePlans.length}`);
      for (const bp of basePlans) {
        const region = bp.regionalConfigs?.[0];
        const price = region?.price ? `${region.price.units}.${String(region.price.nanos).padStart(9, '0').slice(0, 2)} ${region.price.currencyCode}` : '?';
        console.log(`    base plan "${bp.basePlanId}"  state=${bp.state}  price=${price} (${region?.regionCode})  newSubAvail=${region?.newSubscriberAvailability}`);
      }
    } catch (err) {
      console.log(`  ${sku} — ERROR: ${err.errors?.[0]?.message || err.message}`);
    }
  }

  band('2. ONE-TIME PRODUCT STATE');
  try {
    const p = await publisher.monetization.onetimeproducts.get({
      packageName: PACKAGE,
      productId: 'freeresume_premium_lifetime',
    });
    console.log(`  freeresume_premium_lifetime`);
    console.log(`    listings: ${(p.data.listings || []).length}  purchaseOptions: ${(p.data.purchaseOptions || []).length}`);
    for (const po of p.data.purchaseOptions || []) {
      const region = po.regionalPricingAndAvailabilityConfigs?.[0];
      const price = region?.price
        ? `${region.price.units}.${String(region.price.nanos).padStart(9, '0').slice(0, 2)} ${region.price.currencyCode}`
        : '?';
      console.log(`    purchase option "${po.purchaseOptionId}"  state=${po.state}  price=${price} (${region?.regionCode}, availability=${region?.availability})`);
    }
  } catch (err) {
    console.log(`  freeresume_premium_lifetime — ERROR: ${err.errors?.[0]?.message || err.message}`);
  }

  band('3. RELEASE TRACKS (which have a build with billing permission?)');
  const edit = await publisher.edits.insert({ packageName: PACKAGE });
  for (const track of ['production', 'beta', 'alpha', 'internal']) {
    try {
      const t = await publisher.edits.tracks.get({
        packageName: PACKAGE,
        editId: edit.data.id,
        track,
      });
      const releases = t.data.releases || [];
      if (!releases.length) continue;
      console.log(`  ${track}:`);
      for (const r of releases) {
        console.log(`    - "${r.name}" versionCodes=${(r.versionCodes || []).join(',')} status=${r.status}`);
      }
    } catch {
      // track missing — skip
    }
  }
  await publisher.edits.delete({ packageName: PACKAGE, editId: edit.data.id });

  band('4. CHECKLIST');
  console.log(`
  If "failed to query products" shows on your phone, check IN ORDER:

  □ You installed the app FROM PLAY STORE via the Internal Testing opt-in
    URL — NOT sideloaded the AAB. Sideloaded APKs CANNOT use Play Billing,
    even if signed with the same key.

  □ Your Gmail account on the test phone is signed into the Play Store.

  □ Your Gmail is in Play Console → Setup → License testing → Testers.
    AND in the Internal Testing track's testers list (separate setting).
    These are TWO different settings.

  □ The v1.8.0 build has been processed by Play. After submitting an AAB,
    Play takes 5-30 minutes to scan + index the manifest. Until that
    finishes, products can't be queried even though the build is "live".
    Check Play Console > App bundle explorer > expand the AAB > look for
    "com.android.vending.BILLING" permission. Should be listed.

  □ All 3 product states above show "ACTIVE" (not "DRAFT"). Product
    propagation from Play API to billing service takes 1-2 hours.

  □ Your test Gmail is in a region where the products are priced
    (currently US only — non-US accounts return "product not found").

  Most common cause: trying too soon after the v1.8.0 internal release.
  Wait 30-60 min after install + try again. If still failing after 2h,
  check the App bundle explorer to confirm BILLING permission is declared.
  `);
}

main().catch((err) => {
  console.error('FAILED');
  console.error(err.errors || err.message || err);
  process.exit(1);
});
