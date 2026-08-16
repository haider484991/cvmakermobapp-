/**
 * Name the current production DRAFT release and attach its "What's new" text.
 * Generic successor to the per-version set-release-notes-v*.mjs scripts.
 *
 * Reads the release name from app.json's expo.version and the notes from
 * scripts/release-notes/<version>.txt (create that file before running).
 * Localized notes are picked up automatically from sibling files named
 * <version>.<locale>.txt (e.g. 1.13.0.es-ES.txt) — locales must exist on
 * the store listing or Play rejects the edit.
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

import { statSync, readFileSync, readdirSync } from 'node:fs';
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

// Localized notes: <version>.<locale>.txt next to the default file.
const NOTES_DIR = path.dirname(NOTES_PATH);
const LOCALIZED = readdirSync(NOTES_DIR)
  .map((f) => f.match(new RegExp(`^${RELEASE_NAME.replaceAll('.', '\\.')}\\.(.+)\\.txt$`)))
  .filter(Boolean)
  .map((m) => ({ language: m[1], text: readFileSync(path.join(NOTES_DIR, m[0]), 'utf8').trim() }));

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const publisher = google.androidpublisher({ version: 'v3', auth });

const log = (...a) => console.log('[notes]', ...a);

const maxVc = (r) => Math.max(...(r.versionCodes || ['0']).map((c) => parseInt(c, 10)));

async function main() {
  for (const n of [{ language: LANG, text: RELEASE_NOTES }, ...LOCALIZED]) {
    if (n.text.length > 500) {
      console.error(`Release notes (${n.language}) are ${n.text.length} chars; Play caps them at 500.`);
      process.exit(1);
    }
  }
  log(
    `release v${RELEASE_NAME}, notes ${RELEASE_NOTES.length} chars` +
      (LOCALIZED.length ? ` + ${LOCALIZED.length} localized (${LOCALIZED.map((l) => l.language).join(', ')})` : ''),
  );

  const editRes = await publisher.edits.insert({ packageName: PACKAGE });
  const editId = editRes.data.id;
  log(`editId = ${editId}`);

  const trackRes = await publisher.edits.tracks.get({ packageName: PACKAGE, editId, track: TRACK });
  const releases = trackRes.data.releases || [];

  log(`${TRACK} has ${releases.length} release(s):`);
  releases.forEach((r) =>
    log(`  - name="${r.name}" status=${r.status} versionCodes=${(r.versionCodes || []).join(',')}`),
  );

  // Target the newest draft; if the release was already promoted (e.g. a
  // rejected-and-fixed resubmission), fall back to the release whose name
  // matches app.json's version — without changing its status.
  const drafts = releases.filter((r) => r.status === 'draft');
  const target =
    drafts.sort((a, b) => maxVc(b) - maxVc(a))[0] ??
    releases.find((r) => r.name === RELEASE_NAME);
  if (!target) {
    console.error(`No draft and no release named "${RELEASE_NAME}" on the ${TRACK} track.`);
    process.exit(1);
  }
  log(`targeting ${target.status} release versionCodes=${(target.versionCodes || []).join(',')}`);

  // Rebuild the full array, touching only the target release's name/notes.
  const updated = releases.map((r) =>
    r === target
      ? {
          ...r,
          name: RELEASE_NAME,
          releaseNotes: [{ language: LANG, text: RELEASE_NOTES }, ...LOCALIZED],
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

  // Normally validate+commit go for review automatically. But when the app
  // has a rejected change pending (e.g. a policy issue being fixed), Play
  // refuses automatic review — both validate and commit must carry
  // changesNotSentForReview=true, and the final "Send for review" can then
  // ONLY be clicked in the Play Console UI (no API for it).
  const isManualReviewError = (err) =>
    String(err?.message || '').includes('changesNotSentForReview');

  let manualSend = false;
  try {
    await publisher.edits.validate({ packageName: PACKAGE, editId });
    log('validated');
  } catch (err) {
    if (!isManualReviewError(err)) throw err;
    manualSend = true;
    log('Play refuses automatic review for this app state — using unsent-changes mode');
  }

  if (!manualSend) {
    try {
      await publisher.edits.commit({ packageName: PACKAGE, editId });
      log('committed');
    } catch (err) {
      if (!isManualReviewError(err)) throw err;
      manualSend = true;
    }
  }

  if (manualSend) {
    // validate doesn't accept the flag — commit performs validation anyway.
    // The flag must ride the query string only (googleapis has no field for
    // it on this method, so a request param would land in the body and 400).
    await publisher.edits.commit(
      { packageName: PACKAGE, editId },
      { params: { changesNotSentForReview: 'true' } },
    );
    log('committed as UNSENT changes — finish in Play Console: Publishing overview → "Send for review"');
  }

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
