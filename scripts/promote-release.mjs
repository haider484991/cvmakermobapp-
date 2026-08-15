/**
 * Promote the production DRAFT release to a full rollout (status=completed).
 *
 * Companion to set-release-notes.mjs — run it after the notes are attached
 * and you've decided to ship. Guards:
 *
 *  1. Only promotes a draft whose name matches app.json's expo.version —
 *     it can never accidentally promote some other draft.
 *  2. Rebuilds the whole releases array (tracks.update REPLACES it) so the
 *     currently-live release is preserved during the transition.
 *
 * The app is configured so all changes go through Google review; after
 * approval the release goes live to 100% of users.
 *
 * Run:  node scripts/promote-release.mjs
 */

import { statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const ROOT = process.cwd();
const PACKAGE = 'com.freeresumeai.app';
const KEY_PATH = path.join(ROOT, 'play-store-credentials.json');
const TRACK = 'production';

const VERSION = JSON.parse(readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo.version;

if (!statSync(KEY_PATH, { throwIfNoEntry: false })) {
  console.error('Missing service account key at', KEY_PATH);
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const publisher = google.androidpublisher({ version: 'v3', auth });

const log = (...a) => console.log('[promote]', ...a);

async function main() {
  const editRes = await publisher.edits.insert({ packageName: PACKAGE });
  const editId = editRes.data.id;

  const trackRes = await publisher.edits.tracks.get({ packageName: PACKAGE, editId, track: TRACK });
  const releases = trackRes.data.releases || [];
  releases.forEach((r) =>
    log(`  - name="${r.name}" status=${r.status} versionCodes=${(r.versionCodes || []).join(',')}`),
  );

  const target = releases.find((r) => r.status === 'draft' && r.name === VERSION);
  if (!target) {
    console.error(
      `No draft named "${VERSION}" on ${TRACK}. Run set-release-notes.mjs first (it names the draft).`,
    );
    process.exit(1);
  }
  log(`promoting "${target.name}" (versionCodes=${(target.versionCodes || []).join(',')}) to completed`);

  // Play allows exactly ONE completed release per track ("Only one completed
  // release is allowed" otherwise). Send just the promoted release — the
  // previously-live one is superseded implicitly.
  const updated = [{ ...target, status: 'completed' }];

  await publisher.edits.tracks.update({
    packageName: PACKAGE,
    editId,
    track: TRACK,
    requestBody: { track: TRACK, releases: updated },
  });
  log('track updated');

  await publisher.edits.validate({ packageName: PACKAGE, editId });
  log('validated');

  await publisher.edits.commit({ packageName: PACKAGE, editId });
  log('committed — release submitted for Google review, then rolls out to 100%');

  const verifyEdit = await publisher.edits.insert({ packageName: PACKAGE });
  const after = await publisher.edits.tracks.get({
    packageName: PACKAGE,
    editId: verifyEdit.data.id,
    track: TRACK,
  });
  console.log('\nProduction track now:');
  (after.data.releases || []).forEach((r) =>
    console.log(`  name="${r.name}" status=${r.status} versionCodes=${(r.versionCodes || []).join(',')}`),
  );
  await publisher.edits.delete({ packageName: PACKAGE, editId: verifyEdit.data.id });
}

main().catch((err) => {
  console.error('\nFAILED');
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  else console.error(err.message || err);
  process.exit(1);
});
