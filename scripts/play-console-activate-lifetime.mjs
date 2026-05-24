/**
 * One-shot fix: activate the lifetime purchase option (it was created
 * but stuck in DRAFT, causing "failed to query products" on the device).
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

(async function main() {
  try {
    await publisher.monetization.onetimeproducts.purchaseOptions.batchUpdateStates({
      packageName: PACKAGE,
      productId: 'freeresume_premium_lifetime',
      requestBody: {
        requests: [
          {
            activatePurchaseOptionRequest: {
              packageName: PACKAGE,
              productId: 'freeresume_premium_lifetime',
              purchaseOptionId: 'buy',
            },
          },
        ],
      },
    });
    console.log('✓ lifetime purchase option activated');

    // Verify
    const p = await publisher.monetization.onetimeproducts.get({
      packageName: PACKAGE,
      productId: 'freeresume_premium_lifetime',
    });
    const po = p.data.purchaseOptions?.[0];
    console.log(`  state is now: ${po?.state}`);
  } catch (err) {
    const msg = err.errors?.[0]?.message || err.message;
    console.error('FAILED:', msg);
    process.exit(1);
  }
})();
