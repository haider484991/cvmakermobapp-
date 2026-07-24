/**
 * ATS round-trip test.
 *
 * Every competitor's "ATS score" is either keyword matching (Jobscan) or an
 * LLM's opinion of your resume text. Neither actually checks whether a machine
 * can READ the file you send. This does: it exports the real PDF, feeds that
 * PDF back through the same parser used for resume import, and diffs what came
 * back against what you typed.
 *
 * The output is concrete — "a scanner reading your PDF missed your phone
 * number and 3 bullets from your Stripe role" — rather than a number. We can
 * do this because the app happens to own both halves of the loop; almost
 * nothing else does.
 *
 * Note this measures PARSEABILITY (can an ATS extract your data), not keyword
 * relevance to a specific job — `tailorToJob` covers that.
 */

import { Resume } from '@/types/resume';
import { ResumeTemplate } from '@/types/template';
import { generatePDF } from '@/services/pdf/pdfExport';
import { parseResumeWithAI } from '@/services/ai/resumeParser';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import type { ParsedResumeData } from '@/types/resumeImport';

export type IssueSeverity = 'critical' | 'warning' | 'info';

export interface AtsIssue {
  severity: IssueSeverity;
  /** Short label, e.g. "Phone number unreadable". */
  title: string;
  /** What it means for the user, in plain language. */
  detail: string;
}

export interface AtsRoundTripResult {
  /** 0-100: share of your content a parser recovered from the PDF. */
  score: number;
  issues: AtsIssue[];
  /** Counts recovered vs. expected, for the detail rows. */
  recovered: {
    contactFields: [number, number];
    experience: [number, number];
    bullets: [number, number];
    education: [number, number];
    skills: [number, number];
  };
}

/* ------------------------------------------------------------------ */

const norm = (s?: string | null) =>
  (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9@.+\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Loose containment — parsers reflow whitespace and may truncate. */
function found(needle: string | undefined | null, haystack: string): boolean {
  const n = norm(needle);
  if (!n || n.length < 2) return true; // nothing to look for
  if (haystack.includes(n)) return true;
  // Fall back to a token overlap test for longer strings that got reflowed.
  const tokens = n.split(' ').filter((t) => t.length > 2);
  if (!tokens.length) return false;
  const hits = tokens.filter((t) => haystack.includes(t)).length;
  return hits / tokens.length >= 0.7;
}

/** Flatten everything a parser returned into one searchable blob. */
function parsedBlob(p: ParsedResumeData): string {
  const parts: Array<string | undefined | null> = [];
  const h = p.header || ({} as any);
  parts.push(h.fullName, h.jobTitle, h.contact?.email, h.contact?.phone, h.contact?.location, h.contact?.linkedin, h.contact?.website);
  parts.push(p.summary);
  (p.experience || []).forEach((e: any) => {
    parts.push(e.title, e.company, e.location, e.description, ...(e.bullets || []));
  });
  (p.education || []).forEach((e: any) => parts.push(e.degree, e.field, e.institution));
  (p.skills || []).forEach((s: any) => parts.push(typeof s === 'string' ? s : s?.name));
  (p.certifications || []).forEach((c: any) => parts.push(c?.name, c?.issuer));
  (p.languages || []).forEach((l: any) => parts.push(typeof l === 'string' ? l : l?.name));
  return norm(parts.filter(Boolean).join(' '));
}

/**
 * Run the full round trip. Throws only if the PDF itself can't be produced;
 * a parse failure is reported as a critical issue rather than an exception,
 * because "no ATS could read this at all" is a legitimate — and important —
 * result.
 */
export async function runAtsRoundTrip(
  resume: Resume,
  template?: ResumeTemplate,
  paperSize: 'letter' | 'a4' = 'letter',
): Promise<AtsRoundTripResult> {
  // 1. Produce the exact PDF the user would send (watermark off — we're
  //    testing their content, not the free-tier footer).
  const pdf = await generatePDF(resume, template, { paperSize, addWatermark: false });
  if (!pdf.success || !pdf.uri) {
    throw new Error(pdf.error || 'Could not generate the PDF to test.');
  }

  // 2. Read it back exactly as an ATS would receive it.
  const base64 = await readAsStringAsync(pdf.uri, { encoding: EncodingType.Base64 });

  let parsed: ParsedResumeData | null = null;
  try {
    const res = await parseResumeWithAI(base64, 'pdf', 'application/pdf');
    parsed = (res as any)?.data ?? null;
  } catch {
    parsed = null;
  }

  if (!parsed) {
    return {
      score: 0,
      issues: [
        {
          severity: 'critical',
          title: 'A scanner could not read this PDF',
          detail:
            'Nothing could be extracted from your exported file. Try a simpler, single-column template — heavy graphics and text inside images block parsers.',
        },
      ],
      recovered: { contactFields: [0, 0], experience: [0, 0], bullets: [0, 0], education: [0, 0], skills: [0, 0] },
    };
  }

  const blob = parsedBlob(parsed);
  const issues: AtsIssue[] = [];

  /* ---- contact ---- */
  const c = resume.header.contact ?? ({} as any);
  const contactChecks: Array<[string, string | undefined, IssueSeverity]> = [
    ['Your name', resume.header.fullName, 'critical'],
    ['Email address', c.email, 'critical'],
    ['Phone number', c.phone, 'critical'],
    ['Location', c.location, 'warning'],
    ['LinkedIn URL', c.linkedin, 'info'],
  ];
  let contactOk = 0;
  let contactTotal = 0;
  contactChecks.forEach(([label, value, severity]) => {
    if (!value?.trim()) return;
    contactTotal++;
    if (found(value, blob)) contactOk++;
    else
      issues.push({
        severity,
        title: `${label} unreadable`,
        detail: `A scanner reading your PDF could not recover your ${label.toLowerCase()}. Recruiters filter on this field — move it into plain text in the header, not a graphic or sidebar image.`,
      });
  });

  /* ---- experience + bullets ---- */
  let expOk = 0;
  let bulletsOk = 0;
  let bulletsTotal = 0;
  (resume.experience || []).forEach((e) => {
    const titleOk = found(e.title, blob);
    const companyOk = found(e.company, blob);
    if (titleOk && companyOk) expOk++;
    else
      issues.push({
        severity: 'critical',
        title: `Role at ${e.company || 'a company'} not detected`,
        detail: `"${e.title || 'This role'}" did not survive parsing. Job-title matching is the first filter most ATS run, so a missing role can drop your application before a human sees it.`,
      });

    const missing = (e.bullets || []).filter((b) => b.trim() && !found(b, blob));
    bulletsTotal += (e.bullets || []).filter((b) => b.trim()).length;
    bulletsOk += (e.bullets || []).filter((b) => b.trim()).length - missing.length;
    if (missing.length) {
      issues.push({
        severity: 'warning',
        title: `${missing.length} bullet${missing.length > 1 ? 's' : ''} lost from ${e.company || 'a role'}`,
        detail: `These achievements were not recovered from the PDF, so the keywords in them will not be indexed: "${missing[0].slice(0, 70)}${missing[0].length > 70 ? '…' : ''}"`,
      });
    }
  });

  /* ---- education ---- */
  let eduOk = 0;
  (resume.education || []).forEach((e) => {
    if (found(e.degree, blob) || found(e.institution, blob)) eduOk++;
    else
      issues.push({
        severity: 'warning',
        title: `Education entry not detected`,
        detail: `"${e.degree || e.institution || 'An entry'}" did not survive parsing. Many roles filter on degree, so this can silently disqualify you.`,
      });
  });

  /* ---- skills ---- */
  const skills = (resume.skills || []).filter((s) => s.name?.trim());
  const skillsOk = skills.filter((s) => found(s.name, blob)).length;
  const skillsLost = skills.length - skillsOk;
  if (skillsLost > 0) {
    issues.push({
      severity: skillsLost > skills.length / 2 ? 'critical' : 'warning',
      title: `${skillsLost} of ${skills.length} skills unreadable`,
      detail:
        'Skills are the densest keyword block on a resume. If they sit in a graphic sidebar or a decorative chart, a parser will skip them — a plain list is safest.',
    });
  }

  /* ---- score ---- */
  const pairs: Array<[number, number]> = [
    [contactOk, contactTotal],
    [expOk, (resume.experience || []).length],
    [bulletsOk, bulletsTotal],
    [eduOk, (resume.education || []).length],
    [skillsOk, skills.length],
  ];
  const totalExpected = pairs.reduce((a, [, t]) => a + t, 0);
  const totalOk = pairs.reduce((a, [o]) => a + o, 0);
  const score = totalExpected === 0 ? 100 : Math.round((totalOk / totalExpected) * 100);

  if (!issues.length) {
    issues.push({
      severity: 'info',
      title: 'Everything survived the scan',
      detail: 'A parser recovered every field, role, bullet and skill from your exported PDF. This resume is safe to submit through an ATS.',
    });
  }

  // Most severe first so the important stuff is above the fold.
  const rank: Record<IssueSeverity, number> = { critical: 0, warning: 1, info: 2 };
  issues.sort((a, b) => rank[a.severity] - rank[b.severity]);

  return {
    score,
    issues,
    recovered: {
      contactFields: [contactOk, contactTotal],
      experience: [expOk, (resume.experience || []).length],
      bullets: [bulletsOk, bulletsTotal],
      education: [eduOk, (resume.education || []).length],
      skills: [skillsOk, skills.length],
    },
  };
}
