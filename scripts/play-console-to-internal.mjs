/**
 * Release the latest already-uploaded bundle to the Internal Testing track.
 *
 * Why: the production auto-submit already uploaded versionCode N to Play's
 * library. `eas submit` refuses to re-upload the same versionCode to
 * another track. But Internal Testing doesn't need a re-upload — we just
 * create a release on the internal track that references the versionCode
 * that's already in the app's bundle library. Internal releases go live
 * for testers in minutes (no Google review).
 *
 * Picks the highest versionCode present on ANY track (production draft,
 * etc.) and publishes it to internal.
 *
 * Run:  node scripts/play-console-to-internal.mjs
 */

import { statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const PACKAGE = 'com.freeresumeai.app';
const KEY_PATH = path.join(process.cwd(), 'play-store-credentials.json');
const TARGET_TRACK = 'internal';
// Read the real version from app.json so the release label never drifts.
const RELEASE_NAME = (() => {
  try {
    return JSON.parse(readFileSync(path.join(process.cwd(), 'app.json'), 'utf8')).expo.version;
  } catch {
    return '1.9.0';
  }
})();

if (!statSync(KEY_PATH, { throwIfNoEntry: false })) {
  console.error('Missing service account key at', KEY_PATH);
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const publisher = google.androidpublisher({ version: 'v3', auth });
const log = (...a) => console.log('[to-internal]', ...a);

async function main() {
  const editRes = await publisher.edits.insert({ packageName: PACKAGE });
  const editId = editRes.data.id;
  log(`editId = ${editId}`);

  // Find the highest versionCode across the tracks we care about.
  const tracksToScan = ['production', 'internal', 'alpha', 'beta'];
  let bestCode = 0;
  for (const t of tracksToScan) {
    try {
      const res = await publisher.edits.tracks.get({ packageName: PACKAGE, editId, track: t });
      for (const rel of res.data.releases || []) {
        for (const c of rel.versionCodes || []) {
          const n = parseInt(c, 10);
          if (n > bestCode) bestCode = n;
        }
      }
    } catch {
      // track may not exist — ignore
    }
  }

  if (!bestCode) {
    console.error('No versionCode found on any track. Has the build been submitted yet?');
    process.exit(1);
  }
  log(`Highest versionCode found: ${bestCode} — releasing to ${TARGET_TRACK}`);

  await publisher.edits.tracks.update({
    packageName: PACKAGE,
    editId,
    track: TARGET_TRACK,
    requestBody: {
      track: TARGET_TRACK,
      releases: [
        {
          name: RELEASE_NAME,
          versionCodes: [String(bestCode)],
          status: 'completed', // internal testing: live for testers immediately
        },
      ],
    },
  });
  log(`  ✓ ${TARGET_TRACK} release set to versionCode ${bestCode}`);

  await publisher.edits.validate({ packageName: PACKAGE, editId });
  log('  ✓ valid');

  await publisher.edits.commit({ packageName: PACKAGE, editId, changesNotSentForReview: false });
  log('  ✓ committed');

  console.log(`\nDone. v${RELEASE_NAME} (versionCode ${bestCode}) is live on the Internal Testing track.`);
  console.log('Testers on the internal list can install/update within a few minutes.');
}

main().catch((err) => {
  console.error('\nFAILED');
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  else console.error(err.message || err);
  process.exit(1);
});
