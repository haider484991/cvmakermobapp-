/**
 * Fetch the current en-US Play Store listing so we know exactly what to translate.
 */

import path from 'node:path';
import { google } from 'googleapis';

const PACKAGE = 'com.freeresumeai.app';
const auth = new google.auth.GoogleAuth({
  keyFile: path.resolve('play-store-credentials.json'),
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const publisher = google.androidpublisher({ version: 'v3', auth });

const edit = await publisher.edits.insert({ packageName: PACKAGE });
const editId = edit.data.id;

try {
  const list = await publisher.edits.listings.list({ packageName: PACKAGE, editId });
  for (const l of list.data.listings || []) {
    console.log(`\n========== ${l.language} ==========`);
    console.log(`TITLE (${(l.title || '').length} chars):\n  ${l.title}`);
    console.log(`SHORT DESC (${(l.shortDescription || '').length} chars):\n  ${l.shortDescription}`);
    console.log(`FULL DESC (${(l.fullDescription || '').length} chars):`);
    console.log((l.fullDescription || '').split('\n').map((x) => `  ${x}`).join('\n'));
  }
} finally {
  await publisher.edits.delete({ packageName: PACKAGE, editId }).catch(() => {});
}
