/**
 * Render every template's HTML (via the real premiumHtmlEngine) to PNG so
 * we can SEE them. Bundled with esbuild (resolves @ alias), run in Node,
 * screenshot with puppeteer.
 *
 * Output: store-assets/template-renders/<id>.png  (preview mode, full page)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { generatePremiumHTML } from '@/services/pdf/premiumHtmlEngine';
import { useTemplateStore } from '@/stores/templateStore';
import type { Resume } from '@/types/resume';

const OUT = path.join(process.cwd(), 'store-assets', 'template-renders');
mkdirSync(OUT, { recursive: true });

// Rich, realistic sample resume so layouts are stress-tested (long bullets,
// multiple jobs that force a 2nd page, full skills, education, projects).
const SAMPLE: Resume = {
  id: 'sample',
  name: 'Sample',
  templateId: 'ats-classic',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  header: {
    fullName: 'Sarah Chen',
    jobTitle: 'Senior Product Designer',
    // Test photo — a gray avatar silhouette (SVG data URI) to verify the
    // circular photo slot renders. Real photos are JPEG base64.
    photo:
      'data:image/svg+xml;base64,' +
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="#64748b"/><circle cx="120" cy="92" r="46" fill="#cbd5e1"/><ellipse cx="120" cy="230" rx="82" ry="64" fill="#cbd5e1"/></svg>`,
      ).toString('base64'),
    contact: {
      email: 'sarah.chen@email.com',
      phone: '(555) 123-4567',
      location: 'San Francisco, CA',
      linkedin: 'linkedin.com/in/sarahchen',
      website: 'sarahchen.design',
      github: '',
    },
  },
  summary:
    'Senior product designer with 8 years shipping consumer and B2B products used by millions. I lead design systems, run user research end-to-end, and partner closely with engineering to ship pixel-perfect, accessible interfaces. Passionate about turning ambiguous problems into elegant, measurable outcomes.',
  experience: [
    {
      id: 'e1',
      company: 'Stripe',
      title: 'Senior Product Designer',
      location: 'San Francisco, CA',
      startDate: 'Mar 2021',
      endDate: '',
      isCurrentRole: true,
      description: '',
      bullets: [
        'Led the redesign of the payments dashboard used by 200K+ businesses, increasing task completion 34% and cutting support tickets 22%.',
        'Built and shipped a 60-component design system adopted across 9 product teams, reducing design-to-dev handoff time by half.',
        'Ran 40+ usability sessions and synthesized findings into a research repository that now informs roadmap prioritization.',
      ],
    },
    {
      id: 'e2',
      company: 'Square',
      title: 'Product Designer',
      location: 'San Francisco, CA',
      startDate: 'Jun 2018',
      endDate: 'Feb 2021',
      isCurrentRole: false,
      description: '',
      bullets: [
        'Designed the Cash App onboarding flow, improving activation by 18% across 5M new users.',
        'Owned end-to-end design for the merchant analytics suite from concept through launch.',
      ],
    },
    {
      id: 'e3',
      company: 'Adobe',
      title: 'UX Designer',
      location: 'San Jose, CA',
      startDate: 'Jul 2016',
      endDate: 'May 2018',
      isCurrentRole: false,
      description: '',
      bullets: [
        'Shipped 3 major features for Creative Cloud mobile, contributing to a 12% retention lift.',
      ],
    },
  ],
  education: [
    {
      id: 'ed1',
      institution: 'Rhode Island School of Design',
      degree: 'BFA',
      field: 'Graphic Design',
      location: 'Providence, RI',
      startDate: 'Sep 2012',
      endDate: 'May 2016',
      gpa: '3.8',
      achievements: [],
    },
  ],
  skills: [
    { id: 's1', name: 'Figma', level: 'expert' },
    { id: 's2', name: 'Design Systems', level: 'expert' },
    { id: 's3', name: 'User Research', level: 'advanced' },
    { id: 's4', name: 'Prototyping', level: 'advanced' },
    { id: 's5', name: 'Webflow', level: 'intermediate' },
    { id: 's6', name: 'HTML/CSS', level: 'intermediate' },
    { id: 's7', name: 'Accessibility', level: 'advanced' },
    { id: 's8', name: 'Design Ops', level: 'advanced' },
  ],
  projects: [
    {
      id: 'p1',
      name: 'Open Design Tokens',
      link: 'https://github.com/sarahchen/tokens',
      technologies: ['Style Dictionary', 'TypeScript'],
      description: 'An open-source design token pipeline with 2K+ GitHub stars.',
    },
  ],
  certifications: [
    { id: 'c1', name: 'Nielsen Norman UX Certification', issuer: 'NN/g', date: '2022' },
  ],
  languages: [
    { id: 'l1', name: 'English', proficiency: 'Native' },
    { id: 'l2', name: 'Mandarin', proficiency: 'Professional' },
  ],
  awards: [],
  customSections: [],
  sections: [],
} as unknown as Resume;

(async () => {
  const templates = useTemplateStore.getState().templates;
  console.log(`Rendering ${templates.length} templates...`);

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  // Letter at 96dpi = 816px wide. Render at 2x for crisp screenshots.
  await page.setViewport({ width: 816, height: 1056, deviceScaleFactor: 2 });

  for (const t of templates) {
    try {
      const html = generatePremiumHTML(SAMPLE, t, { paperSize: 'letter', mode: 'pdf' });
      await page.setContent(html, { waitUntil: 'load', timeout: 15000 });
      // Give the inline base64 fonts a moment to parse + apply.
      await page.evaluate(() => (document as any).fonts?.ready).catch(() => {});
      await new Promise((r) => setTimeout(r, 400));
      const file = path.join(OUT, `${t.id}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`  ✓ ${t.id} (${t.name})`);
    } catch (err: any) {
      console.log(`  ✖ ${t.id}: ${err?.message?.slice(0, 80)}`);
    }
  }

  // Color-picker verification: render a couple templates re-colored.
  const recolorTests = [
    { id: 'ats-classic', color: '#0F766E', label: 'teal' },
    { id: 'ats-classic', color: '#9F1239', label: 'burgundy' },
    { id: 'corporate-blue', color: '#166534', label: 'forest' },
  ];
  for (const rc of recolorTests) {
    const t = templates.find((x) => x.id === rc.id);
    if (!t) continue;
    try {
      const html = generatePremiumHTML(SAMPLE, t, {
        paperSize: 'letter',
        mode: 'pdf',
        accentColor: rc.color,
      });
      await page.setContent(html, { waitUntil: 'load', timeout: 15000 });
      await page.evaluate(() => (document as any).fonts?.ready).catch(() => {});
      await new Promise((r) => setTimeout(r, 400));
      await page.screenshot({ path: path.join(OUT, `_recolor-${rc.id}-${rc.label}.png`), fullPage: true });
      console.log(`  ✓ recolor ${rc.id} → ${rc.label}`);
    } catch (err: any) {
      console.log(`  ✖ recolor ${rc.id}: ${err?.message?.slice(0, 60)}`);
    }
  }

  await browser.close();
  console.log(`\nDone. PNGs in ${OUT}`);
})();
