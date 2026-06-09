/**
 * Push the v2 store listing (ASO overhaul) to Google Play — en-US.
 *
 *   1. Updates title / short / full description (keyword-tuned, HONEST:
 *      the old listing claimed "no subscription, no paywall" which is false
 *      since v1.8 and a policy risk).
 *   2. Wipes + uploads the 8 new phoneScreenshots (store-assets/screenshots-v2)
 *   3. Uploads the new featureGraphic
 *   4. Commits the edit (changesNotSentForReview: false → goes into review)
 *
 * Run: node scripts/push-listing-v2.mjs          (dry run — prints plan)
 *      node scripts/push-listing-v2.mjs --push   (actually uploads + commits)
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const PACKAGE = 'com.freeresumeai.app';
const KEY_PATH = path.join(process.cwd(), 'play-store-credentials.json');
const SHOTS = path.join(process.cwd(), 'store-assets', 'screenshots-v2');
const LANG = 'en-US';
const PUSH = process.argv.includes('--push');

/* ------------------------- ASO COPY (v2) ------------------------- */

// 29 chars — leads with the highest-volume keyword phrase.
const TITLE = 'AI Resume Builder: FreeResume';

// 74 chars.
const SHORT_DESC =
  'AI resume builder & CV maker. ATS templates, job match score, PDF export.';

const FULL_DESC = `Build a resume that gets interviews — right from your phone.

FreeResume AI is the AI resume builder and CV maker that does the hard part for you: describe yourself in a sentence and AI writes your resume, or upload your old PDF and watch it get rebuilt in seconds. Then export a crisp PDF and apply.

🎯 TAILOR YOUR RESUME TO ANY JOB (NEW)
Paste a job posting. AI scores your match, shows the exact keywords you're missing, and rewrites your summary, bullet points, and skills for that job — truthfully, no fabrication. Stop sending the same resume everywhere.

✉️ AI COVER LETTERS (NEW)
A personal, specific cover letter written from your real experience in one tap. Edit it, copy it, send it.

✨ AI DOES THE WRITING
• Describe yourself in a paragraph — AI structures your full resume
• Generate professional summaries and achievement-focused bullet points
• Instant AI resume score with concrete fixes
• Import your old resume (PDF, Word, or photo) and AI rebuilds it

📄 26 RECRUITER-READY TEMPLATES
Modern, professional, creative, and minimal designs — including skill-bar layouts, photo headers, and an executive serif. Recolor any template and add your headshot.

🤖 BUILT TO PASS ATS
Applicant Tracking Systems reject resumes before a human sees them. Every template here is ATS-scored — clean layouts, standard headings, real text PDFs that parsers can read.

📱 EVERYTHING ON YOUR PHONE
• Save your finished PDF straight to your device — US Letter or A4
• Works in 12 languages including Spanish, Hindi, Arabic, French, German
• Your resume data stays on your device by default

💎 FREE TO BUILD — PRO WHEN YOU'RE SERIOUS
Building, editing, AI writing help, and PDF export are free (ad-supported). FreeResume Pro unlocks job tailoring, AI cover letters, every template, clean watermark-free exports, and removes ads — with a free trial to start.

Whether you're writing your first resume with no experience, switching careers, or going for a promotion: the best resume maker is the one you'll actually finish. This one finishes WITH you.

Download FreeResume AI and apply with confidence.`;

/* ------------------------------------------------------------------ */

const SCREENSHOTS = readdirSync(SHOTS)
  .filter((f) => /^0\d-.*\.png$/.test(f))
  .sort();
const FEATURE = path.join(SHOTS, 'feature-graphic.png');

console.log(`\nListing v2 push — ${PACKAGE} (${LANG})  ${PUSH ? '** LIVE PUSH **' : '(dry run — pass --push to apply)'}\n`);
console.log(`TITLE (${TITLE.length}): ${TITLE}`);
console.log(`SHORT (${SHORT_DESC.length}): ${SHORT_DESC}`);
console.log(`FULL  (${FULL_DESC.length} chars)`);
console.log(`SCREENSHOTS: ${SCREENSHOTS.join(', ')}`);
console.log(`FEATURE GRAPHIC: ${path.basename(FEATURE)}\n`);

if (TITLE.length > 30) throw new Error('Title exceeds 30 chars');
if (SHORT_DESC.length > 80) throw new Error('Short description exceeds 80 chars');
if (FULL_DESC.length > 4000) throw new Error('Full description exceeds 4000 chars');
if (SCREENSHOTS.length < 2 || SCREENSHOTS.length > 8) throw new Error(`Need 2-8 screenshots, found ${SCREENSHOTS.length}`);

if (!PUSH) {
  console.log('Dry run complete. Re-run with --push to upload.');
  process.exit(0);
}

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const publisher = google.androidpublisher({ version: 'v3', auth });

const { data: edit } = await publisher.edits.insert({ packageName: PACKAGE });
const editId = edit.id;
console.log(`Edit ${editId} opened`);

// 1) Listing text
await publisher.edits.listings.update({
  packageName: PACKAGE,
  editId,
  language: LANG,
  requestBody: { language: LANG, title: TITLE, shortDescription: SHORT_DESC, fullDescription: FULL_DESC },
});
console.log('✓ listing text updated');

// 2) Screenshots: wipe then upload in order
await publisher.edits.images.deleteall({ packageName: PACKAGE, editId, language: LANG, imageType: 'phoneScreenshots' });
console.log('✓ old phoneScreenshots wiped');
for (const f of SCREENSHOTS) {
  await publisher.edits.images.upload({
    packageName: PACKAGE,
    editId,
    language: LANG,
    imageType: 'phoneScreenshots',
    media: { mimeType: 'image/png', body: (await import('node:fs')).createReadStream(path.join(SHOTS, f)) },
  });
  console.log(`  ↑ ${f}`);
}

// 3) Feature graphic
await publisher.edits.images.deleteall({ packageName: PACKAGE, editId, language: LANG, imageType: 'featureGraphic' });
await publisher.edits.images.upload({
  packageName: PACKAGE,
  editId,
  language: LANG,
  imageType: 'featureGraphic',
  media: { mimeType: 'image/png', body: (await import('node:fs')).createReadStream(FEATURE) },
});
console.log('✓ feature graphic uploaded');

// 4) Commit
await publisher.edits.commit({ packageName: PACKAGE, editId, changesNotSentForReview: false });
console.log('\n✅ Listing committed — Google will review the changes (usually hours, up to a few days).');
