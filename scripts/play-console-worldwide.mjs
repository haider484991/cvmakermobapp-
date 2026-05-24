/**
 * Make all 3 paywall products available worldwide.
 *
 * Strategy: instead of manually adding regional prices for ~150 countries,
 * use Play's "other regions" / "new regions" config — provide a base
 * price in USD (and EUR for subscriptions, also required), and Play
 * auto-converts to local currencies and makes the product available in
 * every region.
 *
 * Anchor prices:
 *   Monthly:  $2.99 USD  /  €2.99 EUR
 *   Annual:   $19.99 USD /  €19.99 EUR
 *   Lifetime: $29.99 USD /  €29.99 EUR
 *
 * Currency conversion uses Play's daily rate. Prices end up near these
 * anchors in every region but rounded to local "psychologically pleasant"
 * values (e.g. $2.99 → ¥360 in JP, not ¥298).
 *
 * Run:  node scripts/play-console-worldwide.mjs
 */

import { statSync } from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const PACKAGE = 'com.freeresumeai.app';
const KEY_PATH = path.join(process.cwd(), 'play-store-credentials.json');
const REGIONS_VERSION = '2022/02';

if (!statSync(KEY_PATH, { throwIfNoEntry: false })) {
  console.error('Missing service account key at', KEY_PATH);
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const publisher = google.androidpublisher({ version: 'v3', auth });

function money(units, nanos, currency) {
  return { currencyCode: currency, units: String(units), nanos };
}

function band(t) {
  console.log(`\n${'━'.repeat(60)}\n${t}\n${'━'.repeat(60)}`);
}

function errMsg(err) {
  return err?.errors?.[0]?.message || err?.message || String(err);
}

/* -------------------------------------------------------------------------- */
/* Subscription — update the base plan with otherRegionsConfig                */
/* -------------------------------------------------------------------------- */

async function setSubscriptionWorldwide(sku, basePlanId, billingPeriod, usdUnits, usdNanos, eurUnits, eurNanos) {
  band(`Subscription: ${sku}`);
  try {
    // Pull existing subscription so we preserve everything else
    const current = await publisher.monetization.subscriptions.get({
      packageName: PACKAGE,
      productId: sku,
    });

    const existingBasePlan = current.data.basePlans?.find((bp) => bp.basePlanId === basePlanId);
    const existingRegional = existingBasePlan?.regionalConfigs || [];

    const updatedBasePlan = {
      ...existingBasePlan,
      basePlanId,
      state: 'ACTIVE',
      autoRenewingBasePlanType: { billingPeriodDuration: billingPeriod },
      regionalConfigs: existingRegional, // keep US explicit price
      otherRegionsConfig: {
        newSubscriberAvailability: true,
        usdPrice: money(usdUnits, usdNanos, 'USD'),
        eurPrice: money(eurUnits, eurNanos, 'EUR'),
      },
    };

    // Replace the matching base plan, keep any others as-is
    const newBasePlans = (current.data.basePlans || []).map((bp) =>
      bp.basePlanId === basePlanId ? updatedBasePlan : bp,
    );
    if (!newBasePlans.find((bp) => bp.basePlanId === basePlanId)) {
      newBasePlans.push(updatedBasePlan);
    }

    await publisher.monetization.subscriptions.patch({
      packageName: PACKAGE,
      productId: sku,
      updateMask: 'basePlans',
      'regionsVersion.version': REGIONS_VERSION,
      requestBody: {
        ...current.data,
        basePlans: newBasePlans,
      },
    });
    console.log(`  ✓ base plan now available worldwide (auto-priced from $${usdUnits}.${String(usdNanos).padStart(9, '0').slice(0, 2)} / €${eurUnits}.${String(eurNanos).padStart(9, '0').slice(0, 2)})`);

    // Also enable the trial offer worldwide
    try {
      const offerId = `${basePlanId}-trial`;
      // The offer needs otherRegionsConfig too if we want it global.
      // Use patch via offers.patch — pull current then update.
      const offer = await publisher.monetization.subscriptions.basePlans.offers.get({
        packageName: PACKAGE,
        productId: sku,
        basePlanId,
        offerId,
      });
      const updatedRegional = offer.data.regionalConfigs || [];
      await publisher.monetization.subscriptions.basePlans.offers.patch({
        packageName: PACKAGE,
        productId: sku,
        basePlanId,
        offerId,
        updateMask: 'regionalConfigs,otherRegionsConfig,phases',
        'regionsVersion.version': REGIONS_VERSION,
        requestBody: {
          ...offer.data,
          regionalConfigs: updatedRegional,
          otherRegionsConfig: {
            otherRegionsNewSubscriberAvailability: true,
          },
          phases: (offer.data.phases || []).map((ph) => ({
            ...ph,
            otherRegionsConfig: { free: {} },
          })),
        },
      });
      console.log(`  ✓ trial offer also available worldwide`);
    } catch (err) {
      const msg = errMsg(err);
      console.log(`  ⚠ trial offer global: ${msg.slice(0, 140)}`);
    }

    return { ok: true };
  } catch (err) {
    const msg = errMsg(err);
    console.log(`  ✖ ${msg}`);
    return { ok: false, error: msg };
  }
}

/* -------------------------------------------------------------------------- */
/* One-time product — update purchase option with newRegionsConfig            */
/* -------------------------------------------------------------------------- */

async function setOneTimeWorldwide(sku, purchaseOptionId, usdUnits, usdNanos, eurUnits, eurNanos) {
  band(`One-time product: ${sku}`);
  try {
    const current = await publisher.monetization.onetimeproducts.get({
      packageName: PACKAGE,
      productId: sku,
    });
    const existing = current.data.purchaseOptions?.find(
      (po) => po.purchaseOptionId === purchaseOptionId,
    );
    if (!existing) {
      console.log(`  ✖ purchase option "${purchaseOptionId}" not found`);
      return { ok: false };
    }

    // Build updated purchase option with newRegionsConfig
    const updatedPO = {
      ...existing,
      newRegionsConfig: {
        availability: 'AVAILABLE',
        usdPrice: money(usdUnits, usdNanos, 'USD'),
        eurPrice: money(eurUnits, eurNanos, 'EUR'),
      },
    };

    // The onetimeproducts API uses batchUpdate with the whole product
    const updatedProduct = {
      ...current.data,
      purchaseOptions: current.data.purchaseOptions.map((po) =>
        po.purchaseOptionId === purchaseOptionId ? updatedPO : po,
      ),
    };

    await publisher.monetization.onetimeproducts.batchUpdate({
      packageName: PACKAGE,
      requestBody: {
        requests: [
          {
            updateMask: 'purchaseOptions',
            regionsVersion: { version: REGIONS_VERSION },
            oneTimeProduct: updatedProduct,
          },
        ],
      },
    });
    console.log(`  ✓ purchase option available worldwide (auto-priced from $${usdUnits}.${String(usdNanos).padStart(9, '0').slice(0, 2)} / €${eurUnits}.${String(eurNanos).padStart(9, '0').slice(0, 2)})`);
    return { ok: true };
  } catch (err) {
    const msg = errMsg(err);
    console.log(`  ✖ ${msg}`);
    return { ok: false, error: msg };
  }
}

/* -------------------------------------------------------------------------- */
/* Runner                                                                     */
/* -------------------------------------------------------------------------- */

(async function main() {
  console.log(`Enabling worldwide availability for ${PACKAGE}\n`);

  const results = {
    monthly: await setSubscriptionWorldwide(
      'freeresume_premium_monthly',
      'monthly',
      'P1M',
      2, 990000000,   // $2.99
      2, 990000000,   // €2.99
    ),
    annual: await setSubscriptionWorldwide(
      'freeresume_premium_annual',
      'annual',
      'P1Y',
      19, 990000000,  // $19.99
      19, 990000000,  // €19.99
    ),
    lifetime: await setOneTimeWorldwide(
      'freeresume_premium_lifetime',
      'buy',
      29, 990000000,  // $29.99
      29, 990000000,  // €29.99
    ),
  };

  band('SUMMARY');
  for (const [k, v] of Object.entries(results)) {
    console.log(`  ${v.ok ? '✅' : '❌'} ${k}${v.error ? ' — ' + v.error.slice(0, 100) : ''}`);
  }
  console.log(`
  Worldwide propagation: typically 5-30 minutes for prices to surface in
  user-region Play Store catalogs. After that, users in any country with
  Google Play can see + purchase the products.

  Local currency conversion is automatic. To override the auto-converted
  price for a specific country (e.g. discount India to $1.49/mo), add a
  regional config explicitly in Play Console > Monetize > [product] > Manage.
  `);
})();
