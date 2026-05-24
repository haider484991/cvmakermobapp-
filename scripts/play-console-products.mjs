/**
 * Auto-create the FreeResume Pro paywall products in Play Console.
 *
 *   1. freeresume_premium_lifetime — $29.99 one-time (managed product)
 *      Uses the NEW monetization.onetimeproducts API (the legacy
 *      inappproducts API is deprecated and rejects new writes).
 *
 *   2. freeresume_premium_monthly — $2.99/mo subscription, 3-day free trial
 *   3. freeresume_premium_annual  — $19.99/yr subscription, 7-day free trial
 *      Both use monetization.subscriptions API with the required
 *      regionsVersion query parameter.
 *
 * Run:  node scripts/play-console-products.mjs
 *
 * Idempotent: if a product already exists, skips create and reports so.
 * Each step reports independently — so if (say) the lifetime succeeds
 * but the monthly fails, you know exactly what to finish manually.
 *
 * Common failures + fixes:
 *   - "App is missing required information" → Play Console → Setup →
 *     Payments profile (1-2 day verification).
 *   - "Permission denied" → service account needs "Manage store presence"
 *     and "Manage orders and subscriptions" permissions in Play Console.
 *   - "Tax not configured" → Play Console → Setup → Tax settings.
 */

import { statSync } from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const PACKAGE = 'com.freeresumeai.app';
const KEY_PATH = path.join(process.cwd(), 'play-store-credentials.json');
const PRICE_CURRENCY = 'USD';
const PRICE_REGION = 'US';
// The "regions version" is Google's snapshot of available regions at a
// given date. Old versions get accepted; new ones occasionally roll out.
const REGIONS_VERSION = '2022/02';

const LIFETIME = {
  sku: 'freeresume_premium_lifetime',
  name: 'FreeResume Pro (Lifetime)',
  description:
    'Pay once, own forever. Unlock all 22 premium templates, remove the watermark, hide ads, and get the full AI Resume Score and coaching.',
  priceUsd: 29.99,
};

const SUBSCRIPTIONS = {
  monthly: {
    sku: 'freeresume_premium_monthly',
    name: 'FreeResume Pro (Monthly)',
    description:
      'Unlock all 22 premium templates, remove watermark on PDF exports, hide ads, and get the full AI Resume Score with personalized coaching. Cancel anytime.',
    benefits: [
      'All 22 premium templates',
      'No watermark on PDF exports',
      'Full AI Resume Score & coaching',
      'No ads, ever',
    ],
    basePlanId: 'monthly',
    billingPeriod: 'P1M',
    priceUsd: 2.99,
    trialDays: 3,
  },
  annual: {
    sku: 'freeresume_premium_annual',
    name: 'FreeResume Pro (Annual)',
    description:
      'Unlock all 22 premium templates, remove watermark on PDF exports, hide ads, and get the full AI Resume Score with personalized coaching. Save 44% vs monthly. Cancel anytime.',
    benefits: [
      // Play Console allows max 4 benefits per listing.
      'All 22 premium templates',
      'No watermark on PDF exports',
      'Full AI Resume Score & coaching',
      'No ads — save 44% vs monthly',
    ],
    basePlanId: 'annual',
    billingPeriod: 'P1Y',
    priceUsd: 19.99,
    trialDays: 7,
  },
};

if (!statSync(KEY_PATH, { throwIfNoEntry: false })) {
  console.error('Missing service account key at', KEY_PATH);
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const publisher = google.androidpublisher({ version: 'v3', auth });

function moneyFromUsd(usd) {
  const units = Math.floor(usd);
  const nanos = Math.round((usd - units) * 1_000_000_000);
  return { currencyCode: PRICE_CURRENCY, units: String(units), nanos };
}

function band(title) {
  console.log(`\n${'━'.repeat(60)}\n${title}\n${'━'.repeat(60)}`);
}

function errMsg(err) {
  return err?.errors?.[0]?.message || err?.message || String(err);
}

/* -------------------------------------------------------------------------- */
/* Lifetime — monetization.onetimeproducts                                    */
/* -------------------------------------------------------------------------- */

async function createLifetime() {
  band('1/3 — Lifetime in-app product');
  const p = LIFETIME;
  console.log(`  sku=${p.sku}  price=$${p.priceUsd}`);

  try {
    try {
      const existing = await publisher.monetization.onetimeproducts.get({
        packageName: PACKAGE,
        productId: p.sku,
      });
      console.log(`  ⏩ already exists`);
      return { ok: true, skipped: true };
    } catch (err) {
      if (err.code !== 404 && err.errors?.[0]?.reason !== 'notFound') {
        // not a "does not exist" error — surface it
        if (!/not found/i.test(errMsg(err))) throw err;
      }
    }

    await publisher.monetization.onetimeproducts.batchUpdate({
      packageName: PACKAGE,
      requestBody: {
        requests: [
          {
            allowMissing: true,
            updateMask: 'listings,purchaseOptions',
            regionsVersion: { version: REGIONS_VERSION },
            oneTimeProduct: {
              packageName: PACKAGE,
              productId: p.sku,
              listings: [
                {
                  languageCode: 'en-US',
                  title: p.name,
                  description: p.description,
                },
              ],
              purchaseOptions: [
                {
                  purchaseOptionId: 'buy',
                  buyOption: { legacyCompatible: true },
                  regionalPricingAndAvailabilityConfigs: [
                    {
                      regionCode: PRICE_REGION,
                      availability: 'AVAILABLE',
                      price: moneyFromUsd(p.priceUsd),
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    });
    console.log(`  ✓ created`);

    // Activate the purchase option so it's buyable.
    try {
      await publisher.monetization.onetimeproducts.purchaseOptions.batchUpdateStates({
        packageName: PACKAGE,
        productId: p.sku,
        requestBody: {
          requests: [
            {
              activatePurchaseOptionRequest: {
                packageName: PACKAGE,
                productId: p.sku,
                purchaseOptionId: 'buy',
              },
            },
          ],
        },
      });
      console.log(`  ✓ purchase option activated`);
    } catch (err) {
      const msg = errMsg(err);
      if (/already active/i.test(msg)) {
        console.log(`  ⏩ purchase option already active`);
      } else {
        console.log(`  ⚠ activation hint: ${msg}`);
      }
    }

    return { ok: true };
  } catch (err) {
    const msg = errMsg(err);
    console.log(`  ✖ ${msg}`);
    return { ok: false, error: msg };
  }
}

/* -------------------------------------------------------------------------- */
/* Subscription — monetization.subscriptions + basePlans + trial offer        */
/* -------------------------------------------------------------------------- */

async function createSubscription(p) {
  band(`Subscription — ${p.name}`);
  console.log(`  sku=${p.sku}  price=$${p.priceUsd}/${p.billingPeriod === 'P1Y' ? 'yr' : 'mo'}  trial=${p.trialDays}d`);

  // ---------- 1. Subscription product ----------
  let subExists = false;
  try {
    await publisher.monetization.subscriptions.get({
      packageName: PACKAGE,
      productId: p.sku,
    });
    subExists = true;
    console.log(`  ⏩ subscription exists`);
  } catch (err) {
    if (!/not found/i.test(errMsg(err)) && err.code !== 404) {
      console.log(`  ✖ existence check failed: ${errMsg(err)}`);
      return { ok: false };
    }
  }

  // Subscription create requires at least one base plan inline.
  const inlineBasePlan = {
    basePlanId: p.basePlanId,
    state: 'DRAFT', // base plans are created in DRAFT, activated next step
    autoRenewingBasePlanType: {
      billingPeriodDuration: p.billingPeriod,
    },
    regionalConfigs: [
      {
        regionCode: PRICE_REGION,
        newSubscriberAvailability: true,
        price: moneyFromUsd(p.priceUsd),
      },
    ],
  };

  if (!subExists) {
    try {
      await publisher.monetization.subscriptions.create({
        packageName: PACKAGE,
        productId: p.sku,
        'regionsVersion.version': REGIONS_VERSION,
        requestBody: {
          packageName: PACKAGE,
          productId: p.sku,
          basePlans: [inlineBasePlan],
          listings: [
            {
              languageCode: 'en-US',
              title: p.name,
              benefits: p.benefits,
              description: p.description,
            },
          ],
        },
      });
      console.log(`  ✓ subscription + base plan created`);
    } catch (err) {
      const msg = errMsg(err);
      console.log(`  ✖ create failed: ${msg}`);
      return { ok: false, error: msg };
    }
  }

  // ---------- 3. Activate base plan ----------
  try {
    await publisher.monetization.subscriptions.basePlans.activate({
      packageName: PACKAGE,
      productId: p.sku,
      basePlanId: p.basePlanId,
    });
    console.log(`  ✓ base plan activated`);
  } catch (err) {
    const msg = errMsg(err);
    if (/already active|ACTIVE/i.test(msg)) {
      console.log(`  ⏩ base plan already active`);
    } else {
      console.log(`  ⚠ activate hint: ${msg}`);
    }
  }

  // ---------- 4. Free-trial offer ----------
  // Modern API: the trial is just a free first phase. Targeting block
  // limits it to new subscribers (omit to allow re-acquisition too).
  const offerId = `${p.basePlanId}-trial`;
  try {
    await publisher.monetization.subscriptions.basePlans.offers.create({
      packageName: PACKAGE,
      productId: p.sku,
      basePlanId: p.basePlanId,
      offerId,
      'regionsVersion.version': REGIONS_VERSION,
      requestBody: {
        offerId,
        packageName: PACKAGE,
        productId: p.sku,
        basePlanId: p.basePlanId,
        // Top-level regional configs — required, declares which regions
        // the offer is offered in to new subscribers.
        regionalConfigs: [
          {
            regionCode: PRICE_REGION,
            newSubscriberAvailability: true,
          },
        ],
        phases: [
          {
            duration: `P${p.trialDays}D`,
            regionalConfigs: [
              {
                regionCode: PRICE_REGION,
                free: {},
              },
            ],
            recurrenceCount: 1,
          },
        ],
        targeting: {
          acquisitionRule: {
            // Limit trial to brand-new subscribers of THIS subscription
            // (not anyone in the app, not anyone re-acquiring).
            scope: { thisSubscription: {} },
          },
        },
      },
    });
    console.log(`  ✓ ${p.trialDays}-day free trial offer created`);

    // Activate the offer separately (created in DRAFT).
    try {
      await publisher.monetization.subscriptions.basePlans.offers.activate({
        packageName: PACKAGE,
        productId: p.sku,
        basePlanId: p.basePlanId,
        offerId,
      });
      console.log(`  ✓ trial offer activated`);
    } catch (err) {
      const msg = errMsg(err);
      if (!/already active/i.test(msg)) {
        console.log(`  ⚠ trial activate hint: ${msg}`);
      }
    }
  } catch (err) {
    const msg = errMsg(err);
    if (/already exists|ALREADY_EXISTS/i.test(msg)) {
      console.log(`  ⏩ trial offer already exists`);
    } else {
      console.log(`  ⚠ trial offer failed (sub still works without it): ${msg}`);
    }
  }

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Runner                                                                     */
/* -------------------------------------------------------------------------- */

(async function main() {
  console.log(`Creating Play Store products for ${PACKAGE}`);
  console.log(`Currency: ${PRICE_CURRENCY} · Region: ${PRICE_REGION}  Regions version: ${REGIONS_VERSION}\n`);

  const results = {
    lifetime: await createLifetime(),
    monthly: await createSubscription(SUBSCRIPTIONS.monthly),
    annual: await createSubscription(SUBSCRIPTIONS.annual),
  };

  band('SUMMARY');
  for (const [k, v] of Object.entries(results)) {
    const icon = v.ok ? '✅' : '❌';
    const note = v.skipped ? ' (already existed)' : v.error ? ` — ${v.error.slice(0, 120)}` : '';
    console.log(`  ${icon} ${k}${note}`);
  }

  band('NEXT STEPS');
  console.log(`  1. Wait ~1 hour for products to activate in the Play Store cache.`);
  console.log(`  2. Verify in Play Console → Monetize → Subscriptions / In-app products.`);
  console.log(`  3. Add your test Gmail to Play Console → Setup → License testing.`);
  console.log(`  4. Install v1.8.0 on a real device, tap a premium template,`);
  console.log(`     verify the purchase shows "Test Card, Always Approves".`);
  console.log(`  5. See docs/paywall/PLAY-CONSOLE-SETUP.md for the full checklist.`);
})().catch((err) => {
  console.error('\nUNEXPECTED FAILURE');
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  else console.error(err.message || err);
  process.exit(1);
});
