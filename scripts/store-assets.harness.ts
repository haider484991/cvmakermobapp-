/**
 * Play Store asset generator v3 — phone + 7" tablet + 10" tablet + feature graphic.
 *
 * Design intent: restraint. One idea per frame, a short confident headline, a
 * lot of breathing room, and a single deep colour story instead of the rainbow
 * of gradients the old set used. Real rendered templates and real product UI
 * are composited in, so what the store shows is what the app does.
 *
 * Outputs (store-assets/screenshots-v3):
 *   phone-01..08.png     1080×1920
 *   tab7-01..04.png      1200×1920   (7" portrait)
 *   tab10-01..04.png     1600×2560   (10" portrait)
 *   feature-graphic.png  1024×500
 *
 * Build & run:
 *   npx esbuild scripts/store-assets.harness.ts --bundle --platform=node \
 *     --format=cjs --outfile=scripts/.assets.cjs --tsconfig=tsconfig.json --external:puppeteer
 *   node scripts/.assets.cjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { interFontFaceCss } from '@/services/pdf/interFonts';

const RENDERS = path.join(process.cwd(), 'store-assets', 'template-renders');
const OUT = path.join(process.cwd(), 'store-assets', 'screenshots-v3');
mkdirSync(OUT, { recursive: true });

const img = (id: string) =>
  `data:image/png;base64,${readFileSync(path.join(RENDERS, `${id}.png`)).toString('base64')}`;

const T = {
  aurora: img('aurora'),
  onyx: img('onyx'),
  vivid: img('vivid'),
  luxe: img('luxe'),
  modernPro: img('modern-pro'),
  atsPro: img('ats-professional'),
  finance: img('finance-navy'),
  exec: img('executive'),
};

/* ------------------------------------------------------------------ */
/* Design system for the shots                                        */
/* ------------------------------------------------------------------ */

const INK = '#0A1F2C'; // deep, desaturated navy — the "expensive" base
const ACCENT = '#5EEAD4'; // mint highlight for the one word that matters

const CSS = `
${interFontFaceCss()}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;background:${INK};color:#fff}
.stage{position:relative;overflow:hidden;background:
  radial-gradient(120% 90% at 12% -8%, #12586B 0%, transparent 55%),
  radial-gradient(110% 80% at 105% 8%, #0E7490 0%, transparent 50%),
  linear-gradient(168deg,#0A1F2C 0%,#0B2E3D 52%,#0A1F2C 100%)}
/* a faint grid gives the flat background some craft */
.grid{position:absolute;inset:0;opacity:.05;
  background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);
  background-size:64px 64px}
.glow{position:absolute;border-radius:50%;filter:blur(120px);opacity:.4}

.brand{display:inline-flex;align-items:center;gap:10px;font-weight:600;letter-spacing:.2px;color:rgba(255,255,255,.72)}
.brand i{width:10px;height:10px;border-radius:3px;background:${ACCENT};display:block}

h1{font-weight:700;letter-spacing:-2.4px;line-height:1.02}
.sub{color:rgba(255,255,255,.62);font-weight:400;line-height:1.45}
.hl{color:${ACCENT}}

/* device */
.phone{position:absolute;left:50%;transform:translateX(-50%);background:#050D14;
  box-shadow:0 50px 120px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.09), inset 0 0 0 1px rgba(255,255,255,.05)}
.screen{width:100%;height:100%;overflow:hidden;position:relative;background:#F7FAFC}
.screen img{width:100%;display:block;object-fit:cover;object-position:top center}
.notch{position:absolute;top:22px;left:50%;transform:translateX(-50%);width:20px;height:20px;border-radius:50%;
  background:#050D14;z-index:9;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
/* soft screen sheen */
.sheen{position:absolute;inset:0;z-index:8;pointer-events:none;
  background:linear-gradient(148deg,rgba(255,255,255,.16) 0%,rgba(255,255,255,0) 42%)}

/* floating paper */
.paper{position:absolute;overflow:hidden;background:#fff;
  box-shadow:0 36px 90px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.14)}
.paper img{width:100%;display:block;object-fit:cover;object-position:top center}

.chip{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,.2);
  background:rgba(255,255,255,.07);border-radius:100px;color:rgba(255,255,255,.85);font-weight:500}
`;

/** Reusable in-app UI blocks rendered at phone scale (crisp, not screenshots of screenshots). */
const ui = {
  jobCard: (title: string, co: string, loc: string, tag: string) => `
    <div style="background:#fff;border:1px solid #E6EDF2;border-radius:20px;padding:22px;display:flex;gap:16px;align-items:flex-start">
      <div style="width:56px;height:56px;border-radius:16px;background:#E8F6F9;display:flex;align-items:center;justify-content:center;flex:0 0 auto">
        <span style="font-size:24px">🏢</span></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:21px;font-weight:700;color:#0B1B24;letter-spacing:-.3px">${title}</div>
        <div style="font-size:17px;color:#5B7180;margin-top:3px">${co}</div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <span style="background:#E8F6F9;color:#0E7490;font-size:14px;font-weight:600;padding:5px 12px;border-radius:9px">${loc}</span>
          <span style="background:#F1F5F7;color:#5B7180;font-size:14px;font-weight:600;padding:5px 12px;border-radius:9px">${tag}</span>
        </div>
      </div>
    </div>`,
  bar: (w: string, c = '#E6EDF2', h = 10) =>
    `<div style="height:${h}px;border-radius:${h / 2}px;background:${c};width:${w}"></div>`,
};

/* ------------------------------------------------------------------ */
/* Frame builders                                                     */
/* ------------------------------------------------------------------ */

interface Frame { name: string; w: number; h: number; html: string }

/** Phone frame: headline block on top, device below. */
function phoneFrame(
  name: string,
  headline: string,
  sub: string,
  screen: string,
  opts: { papers?: string; chips?: string[] } = {},
): Frame {
  const W = 1080, H = 1920;
  return {
    name, w: W, h: H,
    html: `<div class="stage" style="width:${W}px;height:${H}px">
      <div class="grid"></div>
      <div class="glow" style="width:760px;height:760px;background:#14B8A6;top:-260px;right:-220px"></div>
      <div class="glow" style="width:620px;height:620px;background:#2563EB;bottom:-200px;left:-240px"></div>

      <div style="position:absolute;top:78px;left:0;right:0;display:flex;justify-content:center">
        <div class="brand" style="font-size:27px"><i></i>FreeResume AI</div>
      </div>

      <div style="position:absolute;top:168px;left:72px;right:72px;text-align:center">
        <h1 style="font-size:82px">${headline}</h1>
        <p class="sub" style="font-size:34px;margin-top:22px">${sub}</p>
        ${opts.chips ? `<div style="display:flex;gap:12px;justify-content:center;margin-top:26px;flex-wrap:wrap">
          ${opts.chips.map((c) => `<span class="chip" style="font-size:24px;padding:11px 22px">${c}</span>`).join('')}</div>` : ''}
      </div>

      ${opts.papers || ''}

      <div class="phone" style="top:${opts.chips ? 620 : 560}px;width:748px;height:1420px;border-radius:78px;padding:14px">
        <div class="screen" style="border-radius:64px">
          <div class="notch"></div><div class="sheen"></div>
          ${screen}
        </div>
      </div>
    </div>`,
  };
}

/**
 * Tablet frame — PORTRAIT layout: headline block on top, one large device
 * below that bleeds off the bottom edge.
 *
 * An earlier version used a left-copy / right-device split borrowed from
 * landscape marketing pages. On a 1200×1920 (or 1600×2560) portrait canvas
 * that left big dead margins top and bottom and clipped the device content
 * mid-card. Stacking fills the canvas and lets the screen run off the bottom,
 * which reads as "there's more here" instead of "this got cut off".
 */
function tabletFrame(name: string, w: number, h: number, headline: string, sub: string, screen: string, bullets: string[]): Frame {
  const s = w / 1200; // scale off the 7" design
  const deviceW = w * 0.68;
  const deviceTop = h * 0.42;
  return {
    name, w, h,
    html: `<div class="stage" style="width:${w}px;height:${h}px">
      <div class="grid"></div>
      <div class="glow" style="width:${900 * s}px;height:${900 * s}px;background:#14B8A6;top:${-300 * s}px;right:${-240 * s}px"></div>
      <div class="glow" style="width:${760 * s}px;height:${760 * s}px;background:#2563EB;bottom:${-240 * s}px;left:${-260 * s}px"></div>

      <div style="position:absolute;top:${100 * s}px;left:0;right:0;display:flex;justify-content:center">
        <div class="brand" style="font-size:${32 * s}px"><i></i>FreeResume AI</div>
      </div>

      <div style="position:absolute;top:${196 * s}px;left:${90 * s}px;right:${90 * s}px;text-align:center">
        <h1 style="font-size:${94 * s}px">${headline}</h1>
        <p class="sub" style="font-size:${38 * s}px;margin-top:${24 * s}px">${sub}</p>
        <div style="display:flex;gap:${14 * s}px;justify-content:center;flex-wrap:wrap;margin-top:${34 * s}px">
          ${bullets.map((b) => `<span class="chip" style="font-size:${26 * s}px;padding:${12 * s}px ${24 * s}px">${b}</span>`).join('')}
        </div>
      </div>

      <div class="phone" style="top:${deviceTop}px;width:${deviceW}px;height:${h * 0.72}px;
        border-radius:${72 * s}px;padding:${14 * s}px">
        <div class="screen" style="border-radius:${60 * s}px">
          <div class="sheen"></div>${screen}
        </div>
      </div>
    </div>`,
  };
}

/* ---- Screen contents (real app UI, drawn at scale) ---------------- */

const screenTemplate = (src: string) => `<img src="${src}" style="height:1392px"/>`;
const screenTemplateT = (src: string, h: number) => `<img src="${src}" style="height:${h}px"/>`;

const screenJobs = (scale = 1) => `
  <div style="height:100%;background:#F7FAFC;padding:${76 * scale}px ${26 * scale}px 0">
    <div style="background:linear-gradient(135deg,#0E7490,#0891B2);border-radius:${26 * scale}px;padding:${26 * scale}px;margin-bottom:${22 * scale}px">
      <div style="font-size:${34 * scale}px;font-weight:700;color:#fff;letter-spacing:-.5px">Find Jobs</div>
      <div style="font-size:${18 * scale}px;color:rgba(255,255,255,.85);margin-top:${5 * scale}px">Remote &amp; on-site roles, tailored in one tap</div>
      <div style="background:rgba(255,255,255,.96);border-radius:${16 * scale}px;margin-top:${18 * scale}px;padding:${15 * scale}px ${18 * scale}px;
        display:flex;align-items:center;gap:${10 * scale}px;color:#94A3B8;font-size:${19 * scale}px">🔍 Product Designer</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:${16 * scale}px">
      ${ui.jobCard('Senior Product Designer', 'Uber', 'New York, NY', 'Full time')}
      ${ui.jobCard('UX Designer', 'Spotify', 'Remote', 'Full time')}
      ${ui.jobCard('Design Lead', 'Figma', 'San Francisco', 'Hybrid')}
      ${ui.jobCard('Product Designer', 'Airbnb', 'Remote', 'Full time')}
      ${ui.jobCard('Senior UI Designer', 'Notion', 'London, UK', 'Full time')}
      ${ui.jobCard('Design Systems Lead', 'Linear', 'Remote', 'Contract')}
    </div>
  </div>`;

const screenTailor = (scale = 1) => `
  <div style="height:100%;background:#F7FAFC;padding:${88 * scale}px ${28 * scale}px 0">
    <div style="background:#ECFDF5;border:${3 * scale}px solid #6EE7B7;border-radius:${26 * scale}px;padding:${32 * scale}px;text-align:center">
      <div style="font-size:${17 * scale}px;font-weight:700;color:#64748B;letter-spacing:${1.4 * scale}px">MATCH WITH THIS JOB</div>
      <div style="font-size:${104 * scale}px;font-weight:700;color:#059669;line-height:1.05;letter-spacing:-3px">92%</div>
      <div style="font-size:${19 * scale}px;color:#475569">Strong match — you're ready to apply</div>
    </div>
    <div style="font-size:${21 * scale}px;font-weight:700;color:#0B1B24;margin-top:${26 * scale}px">Already on your resume</div>
    <div style="display:flex;gap:${9 * scale}px;flex-wrap:wrap;margin-top:${12 * scale}px">
      ${['Design systems', 'Figma', 'User research', 'Prototyping'].map((t) => `<span style="background:#D1FAE5;color:#047857;border:1px solid #6EE7B7;border-radius:100px;padding:${8 * scale}px ${16 * scale}px;font-size:${17 * scale}px;font-weight:600">✓ ${t}</span>`).join('')}
    </div>
    <div style="font-size:${21 * scale}px;font-weight:700;color:#0B1B24;margin-top:${24 * scale}px">Add these to rank higher</div>
    <div style="display:flex;gap:${9 * scale}px;flex-wrap:wrap;margin-top:${12 * scale}px">
      ${['Design ops', 'Accessibility'].map((t) => `<span style="background:#FEF3C7;color:#B45309;border:1px solid #FCD34D;border-radius:100px;padding:${8 * scale}px ${16 * scale}px;font-size:${17 * scale}px;font-weight:600">+ ${t}</span>`).join('')}
    </div>
    <div style="margin-top:${26 * scale}px;background:#fff;border:1px solid #E6EDF2;border-radius:${22 * scale}px;padding:${24 * scale}px">
      <div style="font-size:${20 * scale}px;font-weight:700;color:#0B1B24">✨ Your tailored rewrite is ready</div>
      <div style="font-size:${18 * scale}px;color:#5B7180;margin-top:${8 * scale}px;line-height:1.55">• Summary rewritten for this role<br/>• 3 experience entries updated<br/>• 2 missing skills added</div>
    </div>
    <div style="margin-top:${24 * scale}px;background:linear-gradient(135deg,#0E7490,#06B6D4);border-radius:${22 * scale}px;padding:${26 * scale}px;
      text-align:center;font-size:${23 * scale}px;font-weight:700;color:#fff">✨ Apply tailored rewrite</div>
    <div style="margin-top:${16 * scale}px;text-align:center;font-size:${17 * scale}px;color:#94A3B8">Free match analysis · Pro applies it</div>
  </div>`;

const screenAI = (scale = 1) => `
  <div style="height:100%;background:#F7FAFC;padding:${88 * scale}px ${28 * scale}px 0">
    <div style="background:linear-gradient(135deg,#0E7490,#06B6D4);border-radius:${26 * scale}px;padding:${30 * scale}px">
      <div style="font-size:${26 * scale}px;font-weight:700;color:#fff">✦ Tell me about yourself</div>
      <div style="font-size:${18 * scale}px;color:rgba(255,255,255,.9);margin-top:${8 * scale}px;line-height:1.45">One paragraph. AI writes the whole resume.</div>
    </div>
    <div style="margin-top:${22 * scale}px;background:#fff;border:1px solid #E6EDF2;border-radius:${22 * scale}px;padding:${26 * scale}px;
      font-size:${20 * scale}px;line-height:1.6;color:#0B1B24;height:${330 * scale}px">
      I'm a product designer with 8 years' experience. I led design at Stripe where we rebuilt the payments dashboard used by 200K businesses…<span style="display:inline-block;width:2px;height:${23 * scale}px;background:#0E7490;vertical-align:-3px"></span>
    </div>
    <div style="margin-top:${26 * scale}px;display:flex;flex-direction:column;gap:${12 * scale}px">
      ${ui.bar('92%')} ${ui.bar('84%')} ${ui.bar('96%')} ${ui.bar('70%')}
    </div>
    <div style="margin-top:${30 * scale}px;background:linear-gradient(135deg,#0E7490,#06B6D4);border-radius:${22 * scale}px;padding:${26 * scale}px;
      text-align:center;font-size:${23 * scale}px;font-weight:700;color:#fff">Generate my resume</div>
  </div>`;

const screenExport = (scale = 1) => `
  <div style="height:100%;background:#F7FAFC;padding:${92 * scale}px ${28 * scale}px 0;text-align:center">
    <div style="margin:0 auto;width:${300 * scale}px;height:${400 * scale}px;background:#fff;border:1px solid #E6EDF2;border-radius:${20 * scale}px;
      padding:${26 * scale}px;text-align:left;box-shadow:0 ${18 * scale}px ${40 * scale}px rgba(11,27,36,.10)">
      ${ui.bar('62%', '#0B1B24', 16)}
      <div style="height:${10 * scale}px"></div>
      ${ui.bar('40%', '#94A3B8', 9)}
      <div style="height:${22 * scale}px"></div>
      ${ui.bar('100%')}<div style="height:${8 * scale}px"></div>
      ${ui.bar('92%')}<div style="height:${8 * scale}px"></div>
      ${ui.bar('96%')}<div style="height:${8 * scale}px"></div>
      ${ui.bar('88%')}
      <div style="display:inline-block;margin-top:${26 * scale}px;background:#FEE2E2;color:#B91C1C;font-weight:800;
        font-size:${18 * scale}px;padding:${7 * scale}px ${15 * scale}px;border-radius:${9 * scale}px">PDF</div>
    </div>
    <div style="margin:${40 * scale}px auto 0;max-width:${420 * scale}px;background:linear-gradient(135deg,#0E7490,#06B6D4);
      border-radius:${22 * scale}px;padding:${26 * scale}px;font-size:${23 * scale}px;font-weight:700;color:#fff">⬇  Save PDF to phone</div>
    <div style="margin-top:${16 * scale}px;font-size:${18 * scale}px;color:#64748B">Straight to your Downloads folder</div>
  </div>`;

/* ------------------------------------------------------------------ */
/* The set                                                            */
/* ------------------------------------------------------------------ */

const paper = (src: string, css: string, h: number) =>
  `<div class="paper" style="${css};border-radius:26px"><img src="${src}" style="height:${h}px"/></div>`;

const FRAMES: Frame[] = [
  phoneFrame('phone-01', 'Find jobs.<br/>Get <span class="hl">hired</span>.', 'Real openings + an AI resume tailored to each one', screenJobs(), {
    papers:
      paper(T.aurora, 'width:300px;height:600px;top:640px;left:14px;transform:rotate(-9deg)', 600) +
      paper(T.onyx, 'width:300px;height:600px;top:640px;right:14px;transform:rotate(9deg)', 600),
  }),
  phoneFrame('phone-02', 'Thousands of<br/><span class="hl">live jobs</span>', 'Remote and on-site roles from real companies', screenJobs(), {
    chips: ['Remote', 'On-site', 'Full time', 'Contract'],
  }),
  phoneFrame('phone-03', 'Tailored to<br/><span class="hl">every job</span>', 'See your match score and the keywords you\'re missing', screenTailor()),
  phoneFrame('phone-04', 'AI writes it<br/><span class="hl">for you</span>', 'Describe yourself once — get a complete resume', screenAI()),
  phoneFrame('phone-05', '26 templates<br/>recruiters <span class="hl">respect</span>', 'Skill bars, photo headers, executive serif', screenTemplate(T.modernPro), {
    papers:
      paper(T.vivid, 'width:290px;height:640px;top:700px;left:8px;transform:rotate(-8deg)', 640) +
      paper(T.luxe, 'width:290px;height:640px;top:700px;right:8px;transform:rotate(8deg)', 640),
  }),
  phoneFrame('phone-06', 'Built to pass<br/><span class="hl">the robots</span>', 'Every template is scored for applicant tracking systems', screenTemplate(T.atsPro)),
  phoneFrame('phone-07', 'Cover letters<br/>in <span class="hl">one tap</span>', 'Personal, specific, from your real experience', screenTemplate(T.exec)),
  phoneFrame('phone-08', 'Download.<br/>Apply. <span class="hl">Win</span>.', 'A crisp PDF saved straight to your phone', screenExport()),

  // 7-inch tablet (1200×1920)
  tabletFrame('tab7-01', 1200, 1920, 'Find jobs.<br/>Get hired.', 'The job board and the AI resume builder, in one app.', screenJobs(1.5), [
    'Live roles from real companies', 'Tailor your resume per job', 'AI cover letters',
  ]),
  tabletFrame('tab7-02', 1200, 1920, 'Match every<br/>job posting.', 'AI scores your fit and rewrites your resume to match.', screenTailor(1.5), [
    'Instant match score', 'Missing keywords surfaced', 'One-tap rewrite',
  ]),
  tabletFrame('tab7-03', 1200, 1920, 'AI writes<br/>your resume.', 'Describe yourself once. Get a finished, ATS-ready resume.', screenAI(1.5), [
    'From one paragraph', 'Import an old PDF', 'Instant resume score',
  ]),
  tabletFrame('tab7-04', 1200, 1920, '26 designs<br/>that get read.', 'Recruiter-ready templates with a clean PDF export.', screenTemplateT(T.aurora, 1420), [
    'Skill bars &amp; photo headers', 'Recolour anything', 'No-watermark PDF',
  ]),

  // 10-inch tablet (1600×2560)
  tabletFrame('tab10-01', 1600, 2560, 'Find jobs.<br/>Get hired.', 'The job board and the AI resume builder, in one app.', screenJobs(2.0), [
    'Live roles from real companies', 'Tailor your resume per job', 'AI cover letters',
  ]),
  tabletFrame('tab10-02', 1600, 2560, 'Match every<br/>job posting.', 'AI scores your fit and rewrites your resume to match.', screenTailor(2.0), [
    'Instant match score', 'Missing keywords surfaced', 'One-tap rewrite',
  ]),
  tabletFrame('tab10-03', 1600, 2560, 'AI writes<br/>your resume.', 'Describe yourself once. Get a finished, ATS-ready resume.', screenAI(2.0), [
    'From one paragraph', 'Import an old PDF', 'Instant resume score',
  ]),
  tabletFrame('tab10-04', 1600, 2560, '26 designs<br/>that get read.', 'Recruiter-ready templates with a clean PDF export.', screenTemplateT(T.aurora, 1900), [
    'Skill bars &amp; photo headers', 'Recolour anything', 'No-watermark PDF',
  ]),
];

const FEATURE = `
<div class="stage" style="width:1024px;height:500px">
  <div class="grid"></div>
  <div class="glow" style="width:560px;height:560px;background:#14B8A6;top:-200px;right:60px"></div>
  <div style="position:absolute;left:72px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;max-width:560px">
    <div class="brand" style="font-size:23px"><i></i>FreeResume AI</div>
    <h1 style="font-size:62px;margin-top:16px">Find jobs.<br/>Get <span class="hl">hired</span>.</h1>
    <p class="sub" style="font-size:23px;margin-top:16px">Live job board + AI resume tailoring</p>
    <div style="display:flex;gap:10px;margin-top:22px">
      ${['Live jobs', 'AI tailoring', '26 templates'].map((c) => `<span class="chip" style="font-size:17px;padding:8px 16px">${c}</span>`).join('')}
    </div>
  </div>
  <div class="paper" style="width:224px;height:452px;right:158px;top:52px;transform:rotate(6deg);border-radius:18px">
    <img src="${T.aurora}" style="height:452px"/></div>
  <div class="paper" style="width:196px;height:400px;right:6px;top:108px;transform:rotate(13deg);border-radius:16px">
    <img src="${T.onyx}" style="height:400px"/></div>
</div>`;

/* ------------------------------------------------------------------ */

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  for (const f of FRAMES) {
    await page.setViewport({ width: f.w, height: f.h, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${f.html}</body></html>`, {
      waitUntil: 'load', timeout: 30000,
    });
    await page.evaluate(() => (document as any).fonts?.ready).catch(() => {});
    await new Promise((r) => setTimeout(r, 220));
    await page.screenshot({ path: path.join(OUT, `${f.name}.png`), clip: { x: 0, y: 0, width: f.w, height: f.h } });
    console.log(`  ✓ ${f.name}.png  ${f.w}×${f.h}`);
  }

  await page.setViewport({ width: 1024, height: 500, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${FEATURE}</body></html>`, { waitUntil: 'load' });
  await page.evaluate(() => (document as any).fonts?.ready).catch(() => {});
  await new Promise((r) => setTimeout(r, 220));
  await page.screenshot({ path: path.join(OUT, 'feature-graphic.png'), clip: { x: 0, y: 0, width: 1024, height: 500 } });
  console.log('  ✓ feature-graphic.png  1024×500');

  await browser.close();
  console.log(`\nDone → ${OUT}`);
})();
