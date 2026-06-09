/**
 * Make all 3 products available in ALL Google Play countries.
 *
 * Root cause of "Failed to query product": the products only had MN + US
 * explicit regions. otherRegionsConfig/newRegionsConfig only covers regions
 * Google launches in the FUTURE — NOT existing countries that aren't listed.
 * So users outside MN/US couldn't query the products at all.
 *
 * Fix: use monetization.convertRegionPrices to convert the USD price into
 * every sellable region, then write all those regionalConfigs onto each
 * product. Zero subscribers exist, so changing/adding regional prices is
 * safe (no existing subscriber prices to protect).
 */
import { statSync } from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const PACKAGE = 'com.freeresumeai.app';
const KEY_PATH = path.join(process.cwd(), 'play-store-credentials.json');
if (!statSync(KEY_PATH, { throwIfNoEntry: false })) process.exit(1);

const auth = new google.auth.GoogleAuth({ keyFile: KEY_PATH, scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
const publisher = google.androidpublisher({ version: 'v3', auth });
const errMsg = (e) => e?.errors?.[0]?.message || e?.message || String(e);

/** Convert a USD price to every region. Returns { regions: {regionCode:{price}},
 *  version }. CRITICAL: the patch must use the SAME regions version the
 *  converter used (currencies change between versions — e.g. BG → EUR). */
async function convertedRegions(units, nanos) {
  const res = await publisher.monetization.convertRegionPrices({
    packageName: PACKAGE,
    requestBody: { price: { currencyCode: 'USD', units: String(units), nanos } },
  });
  const out = {};
  const conv = res.data.convertedRegionPrices || {};
  for (const [region, v] of Object.entries(conv)) {
    if (v?.price) out[region] = v.price;
  }
  return { regions: out, version: res.data.regionVersion?.version || '2025/03' };
}

async function fixSubscription(sku, basePlanId, units, nanos) {
  console.log(`\n=== ${sku} ===`);
  const { regions: regionsMap, version } = await convertedRegions(units, nanos);
  const regionCodes = Object.keys(regionsMap);
  console.log(`  convertRegionPrices → ${regionCodes.length} regions (version ${version})`);

  const sub = await publisher.monetization.subscriptions.get({ packageName: PACKAGE, productId: sku });
  const basePlans = (sub.data.basePlans || []).map((bp) => {
    if (bp.basePlanId !== basePlanId) return bp;
    const regionalConfigs = regionCodes.map((rc) => ({
      regionCode: rc,
      newSubscriberAvailability: true,
      price: regionsMap[rc],
    }));
    return { ...bp, regionalConfigs };
  });

  // Deactivate → patch → activate, so the active-plan price-change guard
  // doesn't silently drop our update (zero subscribers, safe).
  try {
    await publisher.monetization.subscriptions.basePlans.deactivate({
      packageName: PACKAGE, productId: sku, basePlanId, requestBody: {},
    });
    console.log('  ✓ base plan deactivated');
  } catch (e) { console.log('  (deactivate skipped:', errMsg(e), ')'); }

  try {
    await publisher.monetization.subscriptions.patch({
      packageName: PACKAGE,
      productId: sku,
      updateMask: 'basePlans',
      'regionsVersion.version': version,
      requestBody: { ...sub.data, basePlans },
    });
    console.log('  ✓ patched with all regions');
  } catch (e) { console.log('  ✖ patch:', errMsg(e)); }

  try {
    await publisher.monetization.subscriptions.basePlans.activate({
      packageName: PACKAGE, productId: sku, basePlanId, requestBody: {},
    });
    console.log('  ✓ base plan re-activated');
  } catch (e) { console.log('  ✖ activate:', errMsg(e)); }
}

async function fixOneTime(sku, optionId, units, nanos) {
  console.log(`\n=== ${sku} ===`);
  const { regions: regionsMap, version } = await convertedRegions(units, nanos);
  const regionCodes = Object.keys(regionsMap);
  console.log(`  convertRegionPrices → ${regionCodes.length} regions (version ${version})`);

  const ot = await publisher.monetization.onetimeproducts.get({ packageName: PACKAGE, productId: sku });
  const purchaseOptions = (ot.data.purchaseOptions || []).map((po) => {
    if (po.purchaseOptionId !== optionId) return po;
    const regionalPricingAndAvailabilityConfigs = regionCodes.map((rc) => ({
      regionCode: rc,
      availability: 'AVAILABLE',
      price: regionsMap[rc],
    }));
    return { ...po, regionalPricingAndAvailabilityConfigs };
  });

  try {
    await publisher.monetization.onetimeproducts.batchUpdate({
      packageName: PACKAGE,
      requestBody: {
        requests: [{
          updateMask: 'purchaseOptions',
          regionsVersion: { version },
          oneTimeProduct: { ...ot.data, purchaseOptions },
        }],
      },
    });
    console.log('  ✓ patched with all regions');
  } catch (e) { console.log('  ✖ batchUpdate:', errMsg(e)); }
}

(async () => {
  await fixSubscription('freeresume_premium_monthly', 'monthly', 2, 990000000);
  await fixSubscription('freeresume_premium_annual', 'annual', 19, 990000000);
  await fixOneTime('freeresume_premium_lifetime', 'buy', 29, 990000000);
  console.log('\nDone. Re-run inspect-availability.mjs to verify region counts.');
})();
