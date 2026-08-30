/**
 * Promote the v1.12.0 production draft to a live rollout and send it for review.
 *
 * Note the difference from set-release-notes-v1120.mjs: that script preserved
 * every release on the track, because adding a draft alongside the live build
 * must not knock the live build off. Here we do the opposite — we send ONLY the
 * new release. A track cannot hold two `completed` releases, and the new one is
 * meant to supersede 1.11.0. That is what shipping a new version means.
 *
 * `changesNotSentForReview` is deliberately not passed: this app is enrolled in
 * automatic review and Play rejects the parameter outright. Committing without
 * it is what sends the release for review.
 *
 * Run:  node scripts/rollout-v1120.mjs
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
const EXPECT_VC = 50;

if (!statSync(KEY_PATH, { throwIfNoEntry: false })) {
  console.error('Missing service account key at', KEY_PATH);
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const publisher = google.androidpublisher({ version: 'v3', auth });

const log = (...a) => console.log('[rollout]', ...a);
const maxVc = (r) => Math.max(...(r.versionCodes || ['0']).map((c) => parseInt(c, 10)));

async function main() {
  const editRes = await publisher.edits.insert({ packageName: PACKAGE });
  const editId = editRes.data.id;
  log(`editId = ${editId}`);

  const trackRes = await publisher.edits.tracks.get({ packageName: PACKAGE, editId, track: TRACK });
  const releases = trackRes.data.releases || [];
  log(`${TRACK} before:`);
  releases.forEach((r) =>
    log(`  - name="${r.name}" status=${r.status} versionCodes=${(r.versionCodes || []).join(',')}`),
  );

  const draft = releases.filter((r) => r.status === 'draft').sort((a, b) => maxVc(b) - maxVc(a))[0];
  if (!draft) {
    console.error('No draft release found on production — nothing to roll out.');
    process.exit(1);
  }
  if (maxVc(draft) !== EXPECT_VC) {
    console.error(`Draft is versionCode ${maxVc(draft)}, expected ${EXPECT_VC}. Refusing to guess.`);
    process.exit(1);
  }

  // Carry the notes we already set rather than retyping them, so the live
  // release cannot drift from what was reviewed on the draft.
  const notes = draft.releaseNotes || [];
  if (!notes.some((n) => n.language === LANG)) {
    console.error(`Draft has no ${LANG} release notes — set them before rolling out.`);
    process.exit(1);
  }

  const release = {
    name: RELEASE_NAME,
    versionCodes: draft.versionCodes,
    status: 'completed', // 100% once Google approves
    releaseNotes: notes,
  };

  log(`promoting versionCode ${maxVc(draft)} to status=completed (100%)`);
  await publisher.edits.tracks.update({
    packageName: PACKAGE,
    editId,
    track: TRACK,
    requestBody: { track: TRACK, releases: [release] },
  });
  log('track updated');

  await publisher.edits.validate({ packageName: PACKAGE, editId });
  log('validated');

  await publisher.edits.commit({ packageName: PACKAGE, editId });
  log('committed — sent for review');

  const verify = await publisher.edits.insert({ packageName: PACKAGE });
  const after = await publisher.edits.tracks.get({
    packageName: PACKAGE,
    editId: verify.data.id,
    track: TRACK,
  });
  console.log('\nProduction track now:');
  (after.data.releases || []).forEach((r) => {
    const frac = r.userFraction != null ? ` userFraction=${r.userFraction}` : '';
    console.log(
      `  name="${r.name}" status=${r.status}${frac} versionCodes=${(r.versionCodes || []).join(',')}`,
    );
  });
  await publisher.edits.delete({ packageName: PACKAGE, editId: verify.data.id });
}

main().catch((err) => {
  console.error('\nFAILED');
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  else console.error(err.message || err);
  process.exit(1);
});
