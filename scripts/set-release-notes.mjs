/**
 * Name the current production DRAFT release and attach its "What's new" text.
 * Generic successor to the per-version set-release-notes-v*.mjs scripts.
 *
 * Reads the release name from app.json's expo.version and the notes from
 * scripts/release-notes/<version>.txt (create that file before running).
 *
 * `eas submit` uploads the AAB and creates the draft, but leaves the release
 * name and notes empty — this fills them in. Careful about two things:
 *
 *  1. `tracks.update` REPLACES the whole releases array. Sending only the
 *     draft would drop the live `completed` release off the track. So we
 *     read every release, modify only the newest draft, and send them all
 *     back.
 *  2. Status stays `draft`. Rolling out is the user's call, not ours.
 *
 * Run (after eas submit):  node scripts/set-release-notes.mjs
 */

import { statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const ROOT = process.cwd();
const PACKAGE = 'com.freeresumeai.app';
const KEY_PATH = path.join(ROOT, 'play-store-credentials.json');
const TRACK = 'production';
const LANG = 'en-US';

const RELEASE_NAME = JSON.parse(readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo.version;
const NOTES_PATH = path.join(ROOT, 'scripts', 'release-notes', `${RELEASE_NAME}.txt`);

if (!statSync(KEY_PATH, { throwIfNoEntry: false })) {
  console.error('Missing service account key at', KEY_PATH);
  process.exit(1);
}
if (!statSync(NOTES_PATH, { throwIfNoEntry: false })) {
  console.error(`Missing notes file for v${RELEASE_NAME}: ${NOTES_PATH}`);
  process.exit(1);
}
const RELEASE_NOTES = readFileSync(NOTES_PATH, 'utf8').trim();

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const publisher = google.androidpublisher({ version: 'v3', auth });

const log = (...a) => console.log('[notes]', ...a);

const maxVc = (r) => Math.max(...(r.versionCodes || ['0']).map((c) => parseInt(c, 10)));

async function main() {
  if (RELEASE_NOTES.length > 500) {
    console.error(`Release notes are ${RELEASE_NOTES.length} chars; Play caps them at 500.`);
    process.exit(1);
  }
  log(`release v${RELEASE_NAME}, notes ${RELEASE_NOTES.length} chars`);

  const editRes = await publisher.edits.insert({ packageName: PACKAGE });
  const editId = editRes.data.id;
  log(`editId = ${editId}`);

  const trackRes = await publisher.edits.tracks.get({ packageName: PACKAGE, editId, track: TRACK });
  const releases = trackRes.data.releases || [];

  log(`${TRACK} has ${releases.length} release(s):`);
  releases.forEach((r) =>
    log(`  - name="${r.name}" status=${r.status} versionCodes=${(r.versionCodes || []).join(',')}`),
  );

  // The draft we just submitted is the highest versionCode in draft status.
  const drafts = releases.filter((r) => r.status === 'draft');
  if (drafts.length === 0) {
    console.error('No draft release on the production track — did the submit land?');
    process.exit(1);
  }
  const target = drafts.sort((a, b) => maxVc(b) - maxVc(a))[0];
  log(`targeting draft versionCodes=${(target.versionCodes || []).join(',')}`);

  // Rebuild the full array, touching only the target release.
  const updated = releases.map((r) =>
    r === target
      ? {
          ...r,
          name: RELEASE_NAME,
          status: 'draft', // explicit: never promote here
          releaseNotes: [{ language: LANG, text: RELEASE_NOTES }],
        }
      : r,
  );

  await publisher.edits.tracks.update({
    packageName: PACKAGE,
    editId,
    track: TRACK,
    requestBody: { track: TRACK, releases: updated },
  });
  log('track updated');

  await publisher.edits.validate({ packageName: PACKAGE, editId });
  log('validated');

  // This app is configured so changes always go for review; the release stays
  // `draft`, so nothing rolls out until the user starts it themselves.
  await publisher.edits.commit({ packageName: PACKAGE, editId });
  log('committed');

  // Read back through a fresh edit so we report what Play actually stored.
  const verifyEdit = await publisher.edits.insert({ packageName: PACKAGE });
  const after = await publisher.edits.tracks.get({
    packageName: PACKAGE,
    editId: verifyEdit.data.id,
    track: TRACK,
  });
  console.log('\nProduction track now:');
  (after.data.releases || []).forEach((r) => {
    console.log(`  name="${r.name}" status=${r.status} versionCodes=${(r.versionCodes || []).join(',')}`);
    const n = (r.releaseNotes || []).find((x) => x.language === LANG);
    if (n) console.log(`    notes: ${n.text.split('\n')[0]}...`);
  });
  await publisher.edits.delete({ packageName: PACKAGE, editId: verifyEdit.data.id });
}

main().catch((err) => {
  console.error('\nFAILED');
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  else console.error(err.message || err);
  process.exit(1);
});
