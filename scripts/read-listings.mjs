/**
 * Read-only: fetch the CURRENT store listing for every locale from the Play
 * Console. Creates a throwaway edit and deletes it — nothing on Play is
 * modified.
 *
 * Print:              node scripts/read-listings.mjs
 * Sync repo copy:     node scripts/read-listings.mjs --save
 *   (--save rewrites store-assets/listings/listings.json from live, so the
 *    repo file can never drift behind the console again. The console is the
 *    source of truth; the repo copy exists for review/diffing/backup.)
 */

import { statSync, readFileSync, writeFileSync } from 'node:fs';
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

const LISTINGS_PATH = path.join(process.cwd(), 'store-assets', 'listings', 'listings.json');

async function main() {
  const save = process.argv.includes('--save');

  const edit = await publisher.edits.insert({ packageName: PACKAGE });
  const editId = edit.data.id;
  const res = await publisher.edits.listings.list({ packageName: PACKAGE, editId });
  const listings = res.data.listings ?? [];

  for (const l of listings) {
    console.log(`\n=== ${l.language} ===`);
    console.log(`TITLE (${l.title?.length ?? 0}): ${l.title}`);
    console.log(`SHORT (${l.shortDescription?.length ?? 0}): ${l.shortDescription}`);
    if (!save) {
      console.log(`FULL  (${l.fullDescription?.length ?? 0} chars):`);
      console.log(l.fullDescription);
    }
  }

  if (save) {
    // Preserve the existing _meta block; replace every locale with live data.
    let meta = {
      package: PACKAGE,
      rules: {
        title: 'max 30 chars',
        shortDescription: 'max 80 chars',
        fullDescription: 'max 4000 chars',
      },
    };
    try {
      const existing = JSON.parse(readFileSync(LISTINGS_PATH, 'utf8'));
      if (existing._meta) meta = { ...existing._meta };
    } catch {
      // no existing file — use the default meta
    }
    meta.synced_from_console = new Date().toISOString().slice(0, 10);

    const out = { _meta: meta };
    for (const l of listings) {
      out[l.language] = {
        title: l.title ?? '',
        shortDescription: l.shortDescription ?? '',
        fullDescription: l.fullDescription ?? '',
      };
    }
    writeFileSync(LISTINGS_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
    console.log(`\nSaved ${listings.length} locale(s) to ${LISTINGS_PATH}`);
  }

  await publisher.edits.delete({ packageName: PACKAGE, editId });
  console.log('(read-only edit deleted)');
}

main().catch((err) => {
  console.error('FAILED:', err.message || err);
  process.exit(1);
});
