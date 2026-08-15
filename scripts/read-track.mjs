/**
 * Read-only: print every release on the production track (name, status,
 * version codes, first line of notes). Creates a throwaway edit and deletes
 * it — nothing is modified.
 *
 * Run:  node scripts/read-track.mjs
 */

import { statSync } from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const PACKAGE = 'com.freeresumeai.app';
const KEY_PATH = path.join(process.cwd(), 'play-store-credentials.json');
const TRACK = 'production';

if (!statSync(KEY_PATH, { throwIfNoEntry: false })) {
  console.error('Missing service account key at', KEY_PATH);
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const publisher = google.androidpublisher({ version: 'v3', auth });

async function main() {
  const edit = await publisher.edits.insert({ packageName: PACKAGE });
  const editId = edit.data.id;
  const res = await publisher.edits.tracks.get({ packageName: PACKAGE, editId, track: TRACK });

  console.log(`${TRACK} track:`);
  for (const r of res.data.releases ?? []) {
    console.log(
      `  name="${r.name}" status=${r.status} versionCodes=[${(r.versionCodes || []).join(', ')}]` +
        (r.userFraction ? ` fraction=${r.userFraction}` : '')
    );
    const n = (r.releaseNotes || [])[0];
    if (n) console.log(`    notes(${n.language}): ${String(n.text).split('\n')[0]}`);
  }

  await publisher.edits.delete({ packageName: PACKAGE, editId });
}

main().catch((err) => {
  console.error('FAILED:', err.message || err);
  process.exit(1);
});
