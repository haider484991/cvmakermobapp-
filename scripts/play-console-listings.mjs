/**
 * Push localized Play Store listings (title / short description / full
 * description) for every locale in store-assets/listings/listings.json.
 *
 * Each Play Console locale is a separate search-ranking index — adding
 * a localized listing for `es` makes you appear in Spanish-language
 * search results separately from English. This typically yields a
 * 30-200% install lift in those markets within 4-6 weeks of indexing.
 *
 * Run:  node scripts/play-console-listings.mjs
 *
 * What this DOES upload:
 *   - title, shortDescription, fullDescription per locale
 *
 * What this does NOT touch (use other scripts):
 *   - phoneScreenshots, featureGraphic, icon → play-console-upload.mjs
 *   - Release notes → play-console-upload.mjs
 *   - Release status / track → play-console-upload.mjs
 */

import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const ROOT = process.cwd();
const PACKAGE = 'com.freeresumeai.app';
const KEY_PATH = path.join(ROOT, 'play-store-credentials.json');
const LISTINGS_PATH = path.join(ROOT, 'store-assets', 'listings', 'listings.json');

if (!statSync(KEY_PATH, { throwIfNoEntry: false })) {
  console.error('Missing service account at', KEY_PATH);
  process.exit(1);
}

const all = JSON.parse(readFileSync(LISTINGS_PATH, 'utf8'));
delete all._meta;

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const publisher = google.androidpublisher({ version: 'v3', auth });

function pad(s, n) {
  return s.padEnd(n);
}

async function main() {
  console.log(`Pushing ${Object.keys(all).length} locale(s) to ${PACKAGE}\n`);

  // 1. Open an edit
  const edit = await publisher.edits.insert({ packageName: PACKAGE });
  const editId = edit.data.id;
  console.log(`editId = ${editId}\n`);

  // 2. Loop over locales
  for (const [lang, listing] of Object.entries(all)) {
    process.stdout.write(`  ${pad(lang, 8)}  `);

    // Validate lengths client-side so we get a clearer error than Play's
    if (listing.title.length > 30) {
      console.log(`❌ title too long (${listing.title.length}/30)`);
      continue;
    }
    if (listing.shortDescription.length > 80) {
      console.log(
        `❌ shortDescription too long (${listing.shortDescription.length}/80)`,
      );
      continue;
    }
    if (listing.fullDescription.length > 4000) {
      console.log(
        `❌ fullDescription too long (${listing.fullDescription.length}/4000)`,
      );
      continue;
    }

    try {
      await publisher.edits.listings.update({
        packageName: PACKAGE,
        editId,
        language: lang,
        requestBody: {
          language: lang,
          title: listing.title,
          shortDescription: listing.shortDescription,
          fullDescription: listing.fullDescription,
        },
      });
      console.log(
        `✓ title=${listing.title.length}c short=${listing.shortDescription.length}c full=${listing.fullDescription.length}c`,
      );
    } catch (err) {
      const msg = err.errors?.[0]?.message || err.message;
      console.log(`❌ ${msg}`);
    }
  }

  // 3. Validate + commit
  console.log('\nValidating edit...');
  await publisher.edits.validate({ packageName: PACKAGE, editId });
  console.log('  ✓ valid');

  console.log('Committing edit...');
  // Listing changes always go through Google review — the API rejects
  // changesNotSentForReview=true for listing edits. Just commit normally.
  const res = await publisher.edits.commit({
    packageName: PACKAGE,
    editId,
  });
  console.log(`  ✓ committed editId=${res.data.id}`);

  console.log(
    '\nDone. Localized listings will be live in Play Store search after Google review (typically a few hours).',
  );
}

main().catch((err) => {
  console.error('\nFAILED');
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  else console.error(err.message || err);
  process.exit(1);
});
