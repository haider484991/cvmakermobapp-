/**
 * Promote a build from Internal Testing to Production.
 *
 * Use case: EAS submit already pushed v1.8.0 to the Internal Testing
 * track, but EAS rejects re-submitting the same versionCode to another
 * track. We use the Play Android Publisher API directly to copy the
 * versionCode from internal → production, set a fresh release name +
 * release notes + status, then commit the edit so it goes to Google
 * review.
 *
 * Run:  node scripts/play-console-promote.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const ROOT = process.cwd();
const PACKAGE = 'com.freeresumeai.app';
const KEY_PATH = path.join(ROOT, 'play-store-credentials.json');
const SCREENSHOTS_DIR = path.join(ROOT, 'store-assets', 'screenshots');
const LANG = 'en-US';
const SOURCE_TRACK = 'internal';
const TARGET_TRACK = 'production';
const RELEASE_NAME = '1.8.0';

const RELEASE_NOTES = `Introducing FreeResume Pro.

New: Unlock all 22 premium templates, remove the watermark, and hide ads with FreeResume Pro. Start with a free trial.
New: Full AI Resume Score with personalized coaching.
Improved: Stability, performance, and error handling across the app.
The free tier is still fully functional — Pro just removes friction.`;

if (!statSync(KEY_PATH, { throwIfNoEntry: false })) {
  console.error('Missing service account key at', KEY_PATH);
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const publisher = google.androidpublisher({ version: 'v3', auth });

function log(...args) {
  console.log('[promote]', ...args);
}

async function main() {
  log(`Opening edit on ${PACKAGE}...`);
  const editRes = await publisher.edits.insert({ packageName: PACKAGE });
  const editId = editRes.data.id;
  log(`  editId = ${editId}`);

  // 1. Read internal track for versionCode
  const internalRes = await publisher.edits.tracks.get({
    packageName: PACKAGE,
    editId,
    track: SOURCE_TRACK,
  });
  const internalReleases = internalRes.data.releases || [];
  if (internalReleases.length === 0) {
    console.error('No releases found on internal track. Nothing to promote.');
    process.exit(1);
  }
  // Pick the latest by versionCode
  const sourceRelease = internalReleases
    .slice()
    .sort((a, b) => {
      const av = Math.max(...(a.versionCodes || []).map((c) => parseInt(c, 10)));
      const bv = Math.max(...(b.versionCodes || []).map((c) => parseInt(c, 10)));
      return bv - av;
    })[0];
  const versionCodes = sourceRelease.versionCodes || [];
  log(`  source: ${SOURCE_TRACK} "${sourceRelease.name}" versionCodes=${versionCodes.join(',')}`);

  // 2. Look at production track for context
  const prodRes = await publisher.edits.tracks.get({
    packageName: PACKAGE,
    editId,
    track: TARGET_TRACK,
  });
  const prodReleases = prodRes.data.releases || [];
  log(`  ${TARGET_TRACK} currently has ${prodReleases.length} release(s)`);
  prodReleases.forEach((r) =>
    log(`    - name="${r.name}" status=${r.status} versionCodes=${(r.versionCodes || []).join(',')}`),
  );

  // 3. Wipe + re-upload screenshots
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
    log(`  (already empty: ${err.message})`);
  }

  const screenshots = readdirSync(SCREENSHOTS_DIR)
    .filter((n) => /^screenshot-\d+-.+\.png$/.test(n))
    .sort();
  log(`Uploading ${screenshots.length} screenshots...`);
  for (const file of screenshots) {
    const p = path.join(SCREENSHOTS_DIR, file);
    process.stdout.write(`  [promote]  ${file}... `);
    await publisher.edits.images.upload({
      packageName: PACKAGE,
      editId,
      language: LANG,
      imageType: 'phoneScreenshots',
      media: { mimeType: 'image/png', body: readFileSync(p) },
    });
    console.log('✓');
  }

  // 4. Push the production release pointing at the same versionCodes
  log(`Promoting versionCodes ${versionCodes.join(',')} to ${TARGET_TRACK}...`);
  const newReleases = [
    {
      name: RELEASE_NAME,
      versionCodes,
      status: 'completed', // 100% rollout once Google review approves
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
    track: TARGET_TRACK,
    requestBody: { track: TARGET_TRACK, releases: newReleases },
  });
  log(`  ✓ ${TARGET_TRACK} updated`);

  // 5. Validate + commit
  log('Validating...');
  await publisher.edits.validate({ packageName: PACKAGE, editId });
  log('  ✓ valid');

  log('Committing edit (sends to Google review)...');
  await publisher.edits.commit({
    packageName: PACKAGE,
    editId,
    changesNotSentForReview: false,
  });
  log('  ✓ committed');

  console.log(`\nDone. v${RELEASE_NAME} promoted from ${SOURCE_TRACK} → ${TARGET_TRACK}.`);
  console.log('Google review typically takes a few hours to 24h.');
}

main().catch((err) => {
  console.error('\nFAILED');
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  else console.error(err.message || err);
  process.exit(1);
});
