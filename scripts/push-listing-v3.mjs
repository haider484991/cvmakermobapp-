/**
 * Store listing v3 — reposition as JOB SEARCH + AI resume builder.
 *
 * v1.11 added a live job board, so the listing should compete for job-search
 * queries ("job search", "find jobs", "remote jobs", "job board") as well as
 * the resume queries it already targeted. Google weights the title, the short
 * description, and the first ~2 lines of the full description most heavily,
 * so the job intent leads.
 *
 * Also uploads the v3 image set, including 7"/10" TABLET screenshots — the
 * listing previously had only one of each (Play allows up to eight, and
 * tablet assets factor into store quality/visibility).
 *
 * Run: node scripts/push-listing-v3.mjs           (dry run — validates)
 *      node scripts/push-listing-v3.mjs --push    (live)
 *      node scripts/push-listing-v3.mjs --push --images-all-locales
 */
import { readdirSync, createReadStream } from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const PKG = 'com.freeresumeai.app';
const KEY_PATH = path.join(process.cwd(), 'play-store-credentials.json');
const SHOTS = path.join(process.cwd(), 'store-assets', 'screenshots-v3');
const PUSH = process.argv.includes('--push');
const IMAGES_ALL = process.argv.includes('--images-all-locales');

/* ------------------------- ASO COPY (v3) ------------------------- */

// 28 chars. Leads with "Job Search" — far higher search volume than "resume
// builder" alone, and now accurate: the app has a real job board.
const TITLE = 'Job Search & AI Resume Maker';

// 79 chars.
const SHORT_DESC =
  'Find jobs, tailor your resume with AI & apply. Job board + ATS CV builder.';

const FULL_DESC = `Search jobs and apply with a resume built for the role — all in one app.

FreeResume AI is a job search app and AI resume builder in one. Browse thousands of live job openings, then let AI tailor your resume and write your cover letter for the exact role you're applying to.

🔎 JOB SEARCH
• Thousands of live job listings from real companies
• Remote jobs, hybrid and on-site roles
• Search by job title, keyword or city
• Full job descriptions, apply in one tap
• New openings added every day

🎯 TAILOR YOUR RESUME TO ANY JOB
Tap a job and AI scores how well you match it, shows the exact keywords you're missing, and rewrites your summary, bullet points and skills for that posting — truthfully, no invented experience. Stop sending the same resume everywhere.

✉️ AI COVER LETTERS
A personal cover letter written from your real experience in one tap. Edit it, copy it, send it.

✨ AI RESUME BUILDER
• Describe yourself in a sentence — AI writes your whole resume
• Import your old resume (PDF, Word or a photo) and AI rebuilds it
• Instant AI resume score with concrete fixes
• Professional summaries and achievement-focused bullet points

📄 26 RECRUITER-READY TEMPLATES
Modern, professional, creative and minimal CV designs — skill bars, photo headers, executive serif. Recolour any template and add your headshot.

🤖 BUILT TO PASS ATS
Applicant Tracking Systems reject most resumes before a human reads them. Every template is ATS-scored: clean layouts, standard headings, and real-text PDFs that parsers can read.

📱 EVERYTHING ON YOUR PHONE
• Save your CV straight to your Downloads folder (US Letter or A4)
• Works in 12 languages
• Your resume data stays on your device by default

💎 FREE TO USE — PRO WHEN YOU'RE SERIOUS
Job search, resume building, AI writing help and PDF export are free (ad-supported). FreeResume Pro unlocks job tailoring, AI cover letters, every template and watermark-free exports, with a free trial.

Whether you're job hunting, changing careers, writing your first CV with no experience, or going for a promotion — find the job, tailor the resume, and apply with confidence.

Download FreeResume AI: job search and resume maker in one.`;

/* ------------------------------------------------------------------ */

const phone = readdirSync(SHOTS).filter((f) => /^phone-\d+\.png$/.test(f)).sort();
const tab7 = readdirSync(SHOTS).filter((f) => /^tab7-\d+\.png$/.test(f)).sort();
const tab10 = readdirSync(SHOTS).filter((f) => /^tab10-\d+\.png$/.test(f)).sort();
const feature = path.join(SHOTS, 'feature-graphic.png');

console.log(`\nListing v3 — ${PUSH ? '** LIVE PUSH **' : '(dry run)'}\n`);
console.log(`TITLE (${TITLE.length}/30): ${TITLE}`);
console.log(`SHORT (${SHORT_DESC.length}/80): ${SHORT_DESC}`);
console.log(`FULL  (${FULL_DESC.length}/4000 chars)`);
console.log(`\nIMAGES`);
console.log(`  phoneScreenshots      ${phone.length}  ${phone.join(', ')}`);
console.log(`  sevenInchScreenshots  ${tab7.length}  ${tab7.join(', ')}`);
console.log(`  tenInchScreenshots    ${tab10.length}  ${tab10.join(', ')}`);
console.log(`  featureGraphic        1`);

if (TITLE.length > 30) throw new Error('title > 30');
if (SHORT_DESC.length > 80) throw new Error('short > 80');
if (FULL_DESC.length > 4000) throw new Error('full > 4000');
if (phone.length < 2) throw new Error('need >= 2 phone screenshots');

if (!PUSH) {
  console.log('\nDry run OK. Re-run with --push.');
  process.exit(0);
}

const auth = new google.auth.GoogleAuth({ keyFile: KEY_PATH, scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
const publisher = google.androidpublisher({ version: 'v3', auth });
const { data: edit } = await publisher.edits.insert({ packageName: PKG });
const editId = edit.id;
console.log(`\nEdit ${editId} opened`);

async function uploadSet(language, imageType, files) {
  await publisher.edits.images.deleteall({ packageName: PKG, editId, language, imageType });
  for (const f of files) {
    await publisher.edits.images.upload({
      packageName: PKG, editId, language, imageType,
      media: { mimeType: 'image/png', body: createReadStream(path.join(SHOTS, f)) },
    });
  }
  console.log(`  ↑ ${language} ${imageType}: ${files.length}`);
}

// 1) en-US text
await publisher.edits.listings.update({
  packageName: PKG, editId, language: 'en-US',
  requestBody: { language: 'en-US', title: TITLE, shortDescription: SHORT_DESC, fullDescription: FULL_DESC },
});
console.log('✓ en-US listing text updated');

// 2) Images. The artwork is English, so by default only en-US gets it; pass
//    --images-all-locales to mirror it everywhere (better than the stale set).
const locales = ['en-US'];
if (IMAGES_ALL) {
  const { data: listings } = await publisher.edits.listings.list({ packageName: PKG, editId });
  for (const l of listings.listings || []) if (l.language !== 'en-US') locales.push(l.language);
}

for (const lang of locales) {
  await uploadSet(lang, 'phoneScreenshots', phone);
  await uploadSet(lang, 'sevenInchScreenshots', tab7);
  await uploadSet(lang, 'tenInchScreenshots', tab10);
  await publisher.edits.images.deleteall({ packageName: PKG, editId, language: lang, imageType: 'featureGraphic' });
  await publisher.edits.images.upload({
    packageName: PKG, editId, language: lang, imageType: 'featureGraphic',
    media: { mimeType: 'image/png', body: createReadStream(feature) },
  });
  console.log(`  ↑ ${lang} featureGraphic: 1`);
}

await publisher.edits.commit({ packageName: PKG, editId });
console.log(`\n✅ Committed. ${locales.length} locale(s) got the new imagery; en-US got the new job-search copy.`);
