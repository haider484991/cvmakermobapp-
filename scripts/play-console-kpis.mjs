/**
 * Pull what we can from the Google Play Android Publisher API:
 *   - All public reviews (up to ~7-day window) with text + rating
 *   - Release history across tracks
 *   - In-app product / subscription configuration (if any)
 *   - app-ads.txt status (proxy: check the URL is live)
 *
 * What we CANNOT pull with just androidpublisher (need separate scopes/APIs):
 *   - Install counts (Play Reports — google-cloud-storage + Play CSV exports)
 *   - Revenue / AdMob (AdMob Reporting API — admob.readonly scope)
 *   - Crashlytics (Firebase)
 *   - Acquisition source (Play Install Referrer)
 *   - Retention curves (Firebase Analytics or Play Console UI only)
 *
 * Run:  node scripts/play-console-kpis.mjs
 */

import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const ROOT = process.cwd();
const PACKAGE = 'com.freeresumeai.app';
const KEY_PATH = path.join(ROOT, 'play-store-credentials.json');

if (!statSync(KEY_PATH, { throwIfNoEntry: false })) {
  console.error('Missing service account key at', KEY_PATH);
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const publisher = google.androidpublisher({ version: 'v3', auth });

function band(title) {
  console.log(`\n${'━'.repeat(60)}\n${title}\n${'━'.repeat(60)}`);
}

async function fetchReviews() {
  band('REVIEWS (public, last ~7 days from Play API)');
  try {
    const all = [];
    let nextPageToken = undefined;
    do {
      const res = await publisher.reviews.list({
        packageName: PACKAGE,
        maxResults: 100,
        translationLanguage: 'en',
        token: nextPageToken,
      });
      const items = res.data.reviews || [];
      all.push(...items);
      nextPageToken = res.data.tokenPagination?.nextPageToken;
    } while (nextPageToken && all.length < 500);

    if (all.length === 0) {
      console.log('  (no reviews returned — the public Reviews endpoint only');
      console.log('   returns reviews from the past ~7 days; older reviews');
      console.log('   live in Play Console UI but cannot be pulled by this API)');
      return { count: 0, byStar: {}, summaries: [] };
    }

    // Build histogram + collect short snippets
    const byStar = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const snippets = [];
    for (const r of all) {
      const c = r.comments?.[0]?.userComment;
      if (!c) continue;
      const rating = c.starRating ?? 0;
      byStar[rating] = (byStar[rating] || 0) + 1;
      const text = (c.text || '').replace(/\s+/g, ' ').trim();
      if (text) {
        snippets.push({
          rating,
          when: c.lastModified?.seconds
            ? new Date(parseInt(c.lastModified.seconds) * 1000).toISOString().slice(0, 10)
            : '?',
          text: text.slice(0, 140),
          device: c.deviceMetadata?.productName || '?',
        });
      }
    }
    const total = Object.values(byStar).reduce((a, b) => a + b, 0);
    const avg =
      (1 * byStar[1] + 2 * byStar[2] + 3 * byStar[3] + 4 * byStar[4] + 5 * byStar[5]) /
      Math.max(total, 1);

    console.log(`  Total comments collected: ${total}`);
    console.log(`  Average rating: ${avg.toFixed(2)} ★`);
    console.log(`  Distribution:`);
    for (let s = 5; s >= 1; s--) {
      const n = byStar[s] || 0;
      const pct = total > 0 ? ((n / total) * 100).toFixed(0) : 0;
      const bar = '█'.repeat(Math.round((n / Math.max(total, 1)) * 30));
      console.log(`    ${s}★ ${String(n).padStart(3)} ${pct.toString().padStart(3)}%  ${bar}`);
    }

    // Most recent — show 6
    console.log('\n  RECENT REVIEWS (most recent first):');
    const recent = snippets
      .sort((a, b) => (a.when < b.when ? 1 : -1))
      .slice(0, 6);
    for (const r of recent) {
      const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
      console.log(`    [${r.when}] ${stars}  (${r.device})`);
      console.log(`      "${r.text}"`);
    }

    // Worst ratings get extra attention (1-2 stars)
    const bad = snippets.filter((r) => r.rating <= 2);
    if (bad.length > 0) {
      console.log('\n  BAD REVIEWS (1-2★, address these):');
      for (const r of bad.slice(0, 5)) {
        const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
        console.log(`    [${r.when}] ${stars}  "${r.text}"`);
      }
    }

    return { count: total, byStar, snippets };
  } catch (err) {
    console.log('  ERROR:', err.errors?.[0]?.message || err.message);
    return null;
  }
}

async function fetchReleaseHistory() {
  band('RELEASE HISTORY (all tracks)');
  try {
    const edit = await publisher.edits.insert({ packageName: PACKAGE });
    const editId = edit.data.id;
    for (const track of ['production', 'beta', 'alpha', 'internal']) {
      try {
        const t = await publisher.edits.tracks.get({
          packageName: PACKAGE,
          editId,
          track,
        });
        const releases = t.data.releases || [];
        if (releases.length === 0) continue;
        console.log(`\n  ${track.toUpperCase()}:`);
        for (const r of releases) {
          const codes = (r.versionCodes || []).join(',');
          const userFraction = r.userFraction
            ? `  (${(r.userFraction * 100).toFixed(1)}% rollout)`
            : '';
          console.log(
            `    v${r.name || '?'.padEnd(8)} versionCode=${codes.padStart(2)} status=${r.status}${userFraction}`,
          );
        }
      } catch {
        // track might not exist for this app — skip
      }
    }
    await publisher.edits.delete({ packageName: PACKAGE, editId });
  } catch (err) {
    console.log('  ERROR:', err.errors?.[0]?.message || err.message);
  }
}

async function fetchInAppProducts() {
  band('IN-APP PRODUCTS / SUBSCRIPTIONS');
  try {
    const subs = await publisher.monetization.subscriptions.list({
      packageName: PACKAGE,
    });
    const inapps = await publisher.inappproducts.list({
      packageName: PACKAGE,
    });
    const subList = subs.data.subscriptions || [];
    const iapList = inapps.data.inappproduct || [];
    if (subList.length === 0 && iapList.length === 0) {
      console.log('  (no subscriptions or in-app products configured)');
      console.log('  Suggestion: ads-only is fine for now; IAP can add 3-5x revenue.');
    } else {
      console.log(`  Subscriptions: ${subList.length}`);
      subList.forEach((s) => console.log(`    - ${s.productId}: ${s.listings?.[0]?.title || ''}`));
      console.log(`  In-app products: ${iapList.length}`);
      iapList.forEach((p) =>
        console.log(`    - ${p.sku}: ${p.listings?.['en-US']?.title || ''} (${p.status})`),
      );
    }
  } catch (err) {
    console.log('  ERROR:', err.errors?.[0]?.message || err.message);
  }
}

async function checkAppAdsTxt() {
  band('APP-ADS.TXT VERIFICATION');
  try {
    const url = 'https://haider484991.github.io/cvmakermobapp-/app-ads.txt';
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`  ❌ ${url} returned HTTP ${res.status}`);
      console.log('  AdMob buyers will downrank your inventory until this is fixed.');
      return;
    }
    const text = (await res.text()).trim();
    console.log(`  ✅ Live: ${url}`);
    console.log(`  Content: ${text}`);
    const okPublisher = text.includes('pub-6873688003145340');
    console.log(`  Publisher ID match: ${okPublisher ? '✅' : '❌'}`);
  } catch (err) {
    console.log('  ERROR:', err.message);
  }
}

(async function main() {
  console.log(`KPI check for ${PACKAGE}`);
  console.log(`Generated: ${new Date().toISOString()}`);

  const reviewData = await fetchReviews();
  await fetchReleaseHistory();
  await fetchInAppProducts();
  await checkAppAdsTxt();

  band('WHAT THIS SCRIPT CANNOT TELL YOU (needs separate APIs/data)');
  console.log(`  - Install / uninstall counts → Play Console > Statistics, or
    set up the Play Reports CSV export to Cloud Storage
  - Install conversion rate from store listing → Play Console > Acquisition reports
  - DAU / MAU / retention → install Firebase Analytics (free)
  - Crash rate / ANR rate → install Firebase Crashlytics (free)
  - AdMob revenue / eCPM / fill rate → AdMob Reporting API (separate service
    account scope: https://www.googleapis.com/auth/admob.readonly)
  - User acquisition source → Play Install Referrer
  - Feature usage (which template is most picked, etc.) → product analytics
    (Firebase Analytics events or PostHog)

  Recommend: install Firebase Analytics + Crashlytics in v1.7.0 — it's
  the single biggest gap in observability right now.`);
})();
