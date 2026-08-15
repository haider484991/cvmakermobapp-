/**
 * Live smoke test for the AI pipeline — run before every release:
 *
 *   npx tsx --tsconfig scripts/tsconfig.smoke.json scripts/ai-smoke.harness.ts
 *
 * Exercises the real production modules (model registry, OpenRouter client,
 * resume parser, narrative structuring) against the live OpenRouter API:
 *
 *   1. Model chains resolve against the live catalog (deprecation guard)
 *   2. structureFromNarrative — text → JSON round trip (json mode +
 *      reasoning-off + fallback array accepted by the API)
 *   3. parseResumeWithAI — a generated PDF resume through the actual
 *      vision parse path
 *
 * Needs EXPO_PUBLIC_OPENROUTER_API_KEY in .env. Makes 2 paid API calls
 * (well under a cent). Sentry is stubbed via tsconfig.smoke.json.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failures = 0;

function check(name: string, ok: boolean, detail?: string): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

function loadEnv(): void {
  const envPath = resolve(__dirname, '..', '.env');
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
  if (!process.env.EXPO_PUBLIC_OPENROUTER_API_KEY) {
    throw new Error('EXPO_PUBLIC_OPENROUTER_API_KEY missing from .env');
  }
}

/**
 * Build a minimal one-page PDF resume (pure ASCII, Helvetica). Hand-rolled
 * so the harness needs no PDF dependency.
 */
function buildResumePDF(): string {
  const lines = [
    'Ayesha Khan',
    'Senior Software Engineer',
    'ayesha.khan@example.com | +92-300-1234567 | Lahore, Pakistan',
    '',
    'EXPERIENCE',
    'TechNova - Senior Software Engineer  (Mar 2021 - Present)',
    '- Led migration to microservices, reducing API latency by 40%',
    '- Mentored 6 junior engineers across two product teams',
    'CodeWorks - Software Engineer  (Jan 2018 - Feb 2021)',
    '- Built React dashboards used by 12,000 monthly users',
    '- Cut CI build times in half by parallelizing test suites',
    '',
    'EDUCATION',
    'BS Computer Science, FAST-NUCES, Lahore  (2014 - 2018)',
    '',
    'SKILLS',
    'TypeScript, React Native, Node.js, PostgreSQL, Docker',
  ];

  const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const streamBody =
    'BT /F1 11 Tf 50 750 Td 16 TL\n' +
    lines.map((l) => `(${escape(l)}) Tj T*`).join('\n') +
    '\nET';

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${streamBody.length} >>\nstream\n${streamBody}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, 'ascii').toString('base64');
}

async function main(): Promise<void> {
  loadEnv();

  // Import after env is loaded so module-level env reads see the values.
  const { resolveModelChain } = await import('@/services/ai/modelRegistry');
  const { structureFromNarrative } = await import('@/services/ai/resumeAI');
  const { parseResumeWithAI } = await import('@/services/ai/resumeParser');

  console.log('\n--- 1. Model chains vs live catalog ---');
  for (const cap of ['parse', 'text-quality', 'text-fast'] as const) {
    const chain = await resolveModelChain(cap);
    check(`chain resolves: ${cap}`, chain.length > 0, chain.join(' -> '));
  }

  console.log('\n--- 2. Narrative -> structured resume (text pipeline, live) ---');
  const narrative =
    "I'm Ayesha Khan, a senior software engineer in Lahore with 7 years of experience. " +
    'Since 2021 I work at TechNova where I led a migration to microservices that cut API latency by 40% ' +
    'and mentored six junior engineers. Before that I built React dashboards at CodeWorks from 2018 to 2021. ' +
    'I have a BS in Computer Science from FAST-NUCES (2018). Reach me at ayesha.khan@example.com.';
  const structured = await structureFromNarrative(narrative);
  check(
    'narrative parsed to JSON',
    Boolean(structured.data?.header?.fullName),
    `model=${structured.model} tokens=${structured.tokensUsed}`
  );
  check(
    'narrative: name extracted',
    /ayesha/i.test(structured.data.header.fullName),
    structured.data.header.fullName
  );
  check(
    'narrative: experience extracted',
    (structured.data.experience?.length ?? 0) >= 1,
    `${structured.data.experience?.length ?? 0} entries`
  );

  console.log('\n--- 3. PDF resume import (vision pipeline, live) ---');
  const pdfBase64 = buildResumePDF();
  const result = await parseResumeWithAI(pdfBase64, 'pdf', 'application/pdf');
  check('pdf parse succeeded', result.success, result.success ? undefined : result.error);
  if (result.success && result.data) {
    check('pdf: name extracted', /ayesha/i.test(result.data.header.fullName), result.data.header.fullName);
    check('pdf: email extracted', /ayesha\.khan@example\.com/i.test(result.data.header.contact.email), result.data.header.contact.email);
    check(
      'pdf: both jobs extracted',
      (result.data.experience?.length ?? 0) >= 2,
      `${result.data.experience?.length ?? 0} entries, confidence=${result.confidence}`
    );
    check('pdf: skills extracted', (result.data.skills?.length ?? 0) >= 3, `${result.data.skills?.length ?? 0} skills`);
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('SMOKE TEST CRASHED:', err);
  process.exit(1);
});
