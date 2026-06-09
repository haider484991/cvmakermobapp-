/**
 * Push screenshots + release notes for the current Production draft, then
 * send it for Google review.
 *
 * Auth: service account at ./play-store-credentials.json (gitignored).
 * Scope needed: https://www.googleapis.com/auth/androidpublisher
 *
 * Usage:
 *   node scripts/play-console-upload.mjs
 *
 * What it does:
 *   1. Opens an `edits` session on com.freeresumeai.app
 *   2. Confirms there's a draft on the `production` track and reads its
 *      versionCode (just for the log)
 *   3. Wipes existing phoneScreenshots in en-US, then uploads the 8 PNGs
 *      in store-assets/screenshots in order
 *   4. Sets the release notes for the draft
 *   5. Flips the release status from "draft" to "inProgress" so it goes
 *      to Google review
 *   6. Commits the edit
 *
 * Idempotent across re-runs because the script always starts a fresh edit.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const ROOT = process.cwd();
const PACKAGE = 'com.freeresumeai.app';
const KEY_PATH = path.join(ROOT, 'play-store-credentials.json');
const SCREENSHOTS_DIR = path.join(ROOT, 'store-assets', 'screenshots');
const LANG = 'en-US';
const TRACK = 'production';

// Play Console enforces 500 chars per locale. Keep this tight.
const RELEASE_NOTES = `Major redesign — the best version yet.

NEW: Build with AI — describe yourself in a paragraph, get a complete resume.
NEW: Templates redesigned with Inter typography + Playfair on Executive.
NEW: Preview now matches your PDF export exactly, with real page breaks.
NEW: Date pickers, bullet-by-bullet input, smart progress tracking.
Fixed: Resume import, full-page preview, and pricing display.`;

function log(...args) {
  console.log('[play-upload]', ...args);
}

async function main() {
  if (!statSync(KEY_PATH, { throwIfNoEntry: false })) {
    console.error(`Missing service account key at ${KEY_PATH}`);
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const publisher = google.androidpublisher({ version: 'v3', auth });

  // 1. Open an edit
  log(`Opening edit on ${PACKAGE}...`);
  const editRes = await publisher.edits.insert({ packageName: PACKAGE });
  const editId = editRes.data.id;
  log(`  editId = ${editId}`);

  // 2. Check the production track for current draft
  const trackRes = await publisher.edits.tracks.get({
    packageName: PACKAGE,
    editId,
    track: TRACK,
  });
  const releases = trackRes.data.releases || [];
  log(`  ${TRACK} track has ${releases.length} release(s)`);
  releases.forEach((r) =>
    log(
      `    - name="${r.name || '(unnamed)'}" status=${r.status} versionCodes=${(r.versionCodes || []).join(',')}`,
    ),
  );

  if (releases.length === 0) {
    console.error('No release found on production track. Nothing to do.');
    process.exit(1);
  }

  // 3. Delete existing phone screenshots so we replace them cleanly
  log(`Wiping existing ${LANG} phoneScreenshots...`);
  try {
    await publisher.edits.images.deleteall({
      packageName: PACKAGE,
      editId,
      language: LANG,
      imageType: 'phoneScreenshots',
    });
    log('  ✓ wiped');
  } catch (err) {
    log(`  (no existing screenshots or already empty: ${err.message})`);
  }

  // 4. Upload new screenshots in order (01..08)
  const files = readdirSync(SCREENSHOTS_DIR)
    .filter((n) => /^screenshot-\d+-.+\.png$/.test(n))
    .sort();
  log(`Uploading ${files.length} screenshots...`);
  for (const file of files) {
    const p = path.join(SCREENSHOTS_DIR, file);
    const stat = statSync(p);
    process.stdout.write(`  [play-upload]  ${file}  (${Math.round(stat.size / 1024)} KB)... `);
    const up = await publisher.edits.images.upload({
      packageName: PACKAGE,
      editId,
      language: LANG,
      imageType: 'phoneScreenshots',
      media: {
        mimeType: 'image/png',
        body: readFileSync(p),
      },
    });
    console.log(`✓ sha1=${up.data.image?.sha1 || '?'}`);
  }

  // 5. Set release notes and flip to inProgress (send for review)
  log(`Updating release notes + sending for review...`);
  // Find the draft release (the one we just uploaded). There might be older
  // "completed" releases on the track too — leave those alone.
  const draftIdx = releases.findIndex((r) => r.status === 'draft');
  if (draftIdx < 0) {
    console.error('No draft release on production track. Did the AAB submission go through?');
    process.exit(1);
  }
  const target = releases[draftIdx];
  log(`  Updating release "${target.name}" (versionCode ${(target.versionCodes || []).join(',')})`);

  // Only send the new release in the update. Older completed releases on
  // the track stay in Google's history; the API rejects having two
  // simultaneous completed releases in the request body.
  const newReleases = [
    {
      ...target,
      // Override the display name so it reflects the actual app version
      // (EAS submitted with old version metadata; codes are correct).
      name: JSON.parse(readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo.version,
      // "completed" = 100% rollout after Google review approves.
      // For a staged rollout instead: { status: 'inProgress', userFraction: 0.5 }
      status: 'completed',
      releaseNotes: [
        {
          language: LANG,
          text: RELEASE_NOTES.slice(0, 500),
        },
      ],
    },
  ];

  await publisher.edits.tracks.update({
    packageName: PACKAGE,
    editId,
    track: TRACK,
    requestBody: {
      track: TRACK,
      releases: newReleases,
    },
  });
  log('  ✓ release updated');

  // 6. Validate the edit before committing.
  //    Note: validation may fail with "changes cannot be sent for review
  //    automatically" when the account has an active policy violation or
  //    after certain config changes (screenshots, etc.). In that case we
  //    commit with changesNotSentForReview=true and the user finishes the
  //    review submission in the Play Console UI — same effect, one extra
  //    click. Detect that specific error and route around it.
  let sendForReview = true;
  try {
    log('Validating edit...');
    await publisher.edits.validate({ packageName: PACKAGE, editId });
    log('  ✓ valid');
  } catch (err) {
    const msg = err?.errors?.[0]?.message || err?.message || String(err);
    if (msg.includes('changesNotSentForReview')) {
      log(`  ⚠ Play API requires manual review submission: ${msg.slice(0, 120)}`);
      log('  → committing with changesNotSentForReview=true; finish in Play Console UI');
      sendForReview = false;
    } else {
      throw err;
    }
  }

  // 7. Commit. If sendForReview, the release auto-routes to Google review.
  //    Otherwise it lands as a committed draft you finalize manually.
  log(`Committing edit (changesNotSentForReview=${!sendForReview})...`);
  const commitRes = await publisher.edits.commit({
    packageName: PACKAGE,
    editId,
    changesNotSentForReview: !sendForReview,
  });
  log(`  ✓ committed editId=${commitRes.data.id}`);

  if (sendForReview) {
    console.log('\nDone. The v1.9.0 release is now in Google review.');
  } else {
    console.log('\nDone. Screenshots + release notes are committed to the v1.9.0 draft.');
    console.log('FINAL STEP (manual): Open Play Console → Publishing overview → click');
    console.log('"Send for review" to submit. Required because of the open policy violation.');
  }
  console.log('Track it at: https://play.google.com/console');
}

main().catch((err) => {
  console.error('\n[play-upload] FAILED');
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  else console.error(err.message || err);
  process.exit(1);
});
