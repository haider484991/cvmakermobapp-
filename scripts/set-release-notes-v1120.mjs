/**
 * Name the v1.12.0 production draft and attach its release notes.
 *
 * `eas submit` uploads the AAB and creates the draft, but it has no way to
 * set a release name or "What's new" text — those land empty, which is what
 * the user sees in the Play Console when they open the draft to roll out.
 *
 * Two things this script is deliberately careful about:
 *
 *  1. `tracks.update` REPLACES the whole releases array. Sending only the
 *     draft would drop the live `completed` v1.11.0 entry off the track. So
 *     we read every release, modify only the one matching our versionCode,
 *     and send them all back.
 *  2. Status stays `draft`. Rolling out is the user's call, not ours.
 *
 * Run:  node scripts/set-release-notes-v1120.mjs
 */

import { statSync } from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const ROOT = process.cwd();
const PACKAGE = 'com.freeresumeai.app';
const KEY_PATH = path.join(ROOT, 'play-store-credentials.json');
const TRACK = 'production';
const LANG = 'en-US';
const RELEASE_NAME = '1.12.0';

const RELEASE_NOTES = `New: Job board — search live openings and tailor your resume to any listing in one tap.
New: PDFs now save straight to your Downloads folder.
New: Word and plain-text export, plus cover letters as PDF.
New: Version history — snapshot before a big edit, roll back anytime.
New: Projects, certifications, languages, awards and custom sections are now editable and reorderable.
Fixed: PDF import errors and a print preview crash.`;

if (!statSync(KEY_PATH, { throwIfNoEntry: false })) {
  console.error('Missing service account key at', KEY_PATH);
  process.exit(1);
}

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

  // This app is configured so changes always go for review; passing
  // changesNotSentForReview at all is rejected outright. That's safe here —
  // the release stays `draft`, so nothing rolls out and there is nothing for
  // Google to review until the user starts the rollout themselves.
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
