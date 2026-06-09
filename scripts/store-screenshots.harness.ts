/**
 * Play Store listing asset generator (v2 — the "million dollar" set).
 *
 * Renders 8 phone screenshots (1080×1920) + 1 feature graphic (1024×500)
 * as HTML → PNG via puppeteer. Unlike the old generate.py set (abstract
 * colored rectangles), these composite the REAL rendered templates from
 * store-assets/template-renders, so the listing shows the actual product.
 *
 * Build & run:
 *   npx esbuild scripts/store-screenshots.harness.ts --bundle --platform=node \
 *     --format=cjs --outfile=scripts/.shots-tmp.cjs --tsconfig=tsconfig.json \
 *     --external:puppeteer
 *   node scripts/.shots-tmp.cjs
 *
 * Output: store-assets/screenshots-v2/*.png
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { interFontFaceCss } from '@/services/pdf/interFonts';

const RENDERS = path.join(process.cwd(), 'store-assets', 'template-renders');
const OUT = path.join(process.cwd(), 'store-assets', 'screenshots-v2');
mkdirSync(OUT, { recursive: true });

/** Load a template render as a data URI (crops happen in CSS). */
function render64(id: string): string {
  const buf = readFileSync(path.join(RENDERS, `${id}.png`));
  return `data:image/png;base64,${buf.toString('base64')}`;
}

const IMG = {
  aurora: render64('aurora'),
  onyx: render64('onyx'),
  vivid: render64('vivid'),
  luxe: render64('luxe'),
  modernPro: render64('modern-pro'),
  atsPro: render64('ats-professional'),
};

/* ------------------------------------------------------------------ */
/* Shared CSS                                                         */
/* ------------------------------------------------------------------ */

const BASE_CSS = `
  ${interFontFaceCss()}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1080px; height: 1920px; overflow: hidden; }
  body {
    font-family: 'Inter', 'Segoe UI', -apple-system, sans-serif;
    background: linear-gradient(160deg, #0B3B54 0%, #0E7490 38%, #0EA5E9 100%);
    color: #fff;
    -webkit-font-smoothing: antialiased;
  }
  .frame { position: relative; width: 1080px; height: 1920px; overflow: hidden; }
  /* soft glow blobs for depth */
  .blob { position: absolute; border-radius: 50%; filter: blur(90px); opacity: .5; }
  .blob.b1 { width: 700px; height: 700px; background: #14B8A6; top: -220px; right: -200px; }
  .blob.b2 { width: 600px; height: 600px; background: #2563EB; bottom: -180px; left: -200px; }

  .brand {
    position: absolute; top: 64px; left: 0; right: 0;
    display: flex; justify-content: center;
  }
  .brand-pill {
    display: inline-flex; align-items: center; gap: 14px;
    background: rgba(255,255,255,0.14); border: 2px solid rgba(255,255,255,0.22);
    border-radius: 100px; padding: 14px 32px;
    font-size: 30px; font-weight: 700; letter-spacing: .5px;
  }
  .brand-dot { width: 18px; height: 18px; border-radius: 6px; background: #5EEAD4; }

  .headline {
    position: absolute; top: 170px; left: 70px; right: 70px;
    text-align: center;
  }
  .headline h1 { font-size: 88px; font-weight: 700; line-height: 1.08; letter-spacing: -2.5px; }
  .headline p { margin-top: 26px; font-size: 40px; font-weight: 600; color: rgba(255,255,255,0.88); line-height: 1.3; }
  .hl { color: #5EEAD4; }

  /* phone device frame */
  .phone {
    position: absolute; left: 50%; transform: translateX(-50%);
    width: 760px; height: 1560px;
    background: #0B1220; border-radius: 84px; padding: 18px;
    box-shadow: 0 60px 120px rgba(2, 18, 32, 0.55), 0 0 0 2px rgba(255,255,255,0.08);
  }
  .screen {
    width: 100%; height: 100%; border-radius: 66px; overflow: hidden;
    background: #F8FAFC; position: relative;
  }
  .notch {
    position: absolute; top: 34px; left: 50%; transform: translateX(-50%);
    width: 26px; height: 26px; border-radius: 50%; background: #0B1220; z-index: 50;
  }
  .shot { width: 100%; object-fit: cover; object-position: top; display: block; }

  /* floating template cards */
  .float-card {
    position: absolute; border-radius: 28px; overflow: hidden;
    box-shadow: 0 40px 80px rgba(2, 18, 32, 0.5);
    border: 2px solid rgba(255,255,255,0.35);
  }
  .float-card img { width: 100%; object-fit: cover; object-position: top; display: block; }

  .chip-row { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
  .chip {
    background: rgba(255,255,255,0.16); border: 2px solid rgba(255,255,255,0.25);
    border-radius: 100px; padding: 12px 28px; font-size: 30px; font-weight: 600;
  }
`;

const brand = `<div class="brand"><div class="brand-pill"><span class="brand-dot"></span>FreeResume AI</div></div>`;

/* ------------------------------------------------------------------ */
/* Frames                                                             */
/* ------------------------------------------------------------------ */

const FRAMES: Array<{ name: string; html: string }> = [
  // 1 — HERO: real Aurora render in device
  {
    name: '01-hero',
    html: `
      <div class="frame">
        <div class="blob b1"></div><div class="blob b2"></div>
        ${brand}
        <div class="headline">
          <h1>The resume that<br/>gets you <span class="hl">hired</span></h1>
          <p>AI builds it with you — in minutes, on your phone</p>
        </div>
        <div class="float-card" style="width:330px; top:585px; left:28px; transform:rotate(-9deg); height:660px;">
          <img src="${IMG.luxe}" style="height:660px"/>
        </div>
        <div class="float-card" style="width:330px; top:585px; right:28px; transform:rotate(9deg); height:660px;">
          <img src="${IMG.onyx}" style="height:660px"/>
        </div>
        <div class="phone" style="top:560px;">
          <div class="screen"><div class="notch"></div><img class="shot" src="${IMG.aurora}" style="height:1530px; object-position: top left;"/></div>
        </div>
      </div>`,
  },

  // 2 — TEMPLATES: 3 fanned real renders
  {
    name: '02-templates',
    html: `
      <div class="frame">
        <div class="blob b1"></div><div class="blob b2"></div>
        ${brand}
        <div class="headline">
          <h1><span class="hl">26 templates</span><br/>recruiters respect</h1>
          <p>Skill bars · photo headers · ATS&nbsp;ready</p>
        </div>
        <div style="position:absolute; top:545px; left:0; right:0; text-align:center;">
          <div class="chip-row">
            <span class="chip">Modern</span><span class="chip">Professional</span>
            <span class="chip">Creative</span><span class="chip">Minimal</span>
          </div>
        </div>
        <div class="float-card" style="width:420px; height:900px; top:760px; left:60px; transform:rotate(-7deg);">
          <img src="${IMG.onyx}" style="height:900px"/>
        </div>
        <div class="float-card" style="width:420px; height:900px; top:760px; right:60px; transform:rotate(7deg);">
          <img src="${IMG.vivid}" style="height:900px"/>
        </div>
        <div class="float-card" style="width:460px; height:980px; top:700px; left:310px; z-index:5;">
          <img src="${IMG.modernPro}" style="height:980px"/>
        </div>
      </div>`,
  },

  // 3 — AI WIZARD: recreated compose UI
  {
    name: '03-ai-wizard',
    html: `
      <div class="frame">
        <div class="blob b1"></div><div class="blob b2"></div>
        ${brand}
        <div class="headline">
          <h1>Describe yourself.<br/><span class="hl">AI writes the rest</span></h1>
          <p>One paragraph in — a complete resume out</p>
        </div>
        <div class="phone" style="top:560px;">
          <div class="screen"><div class="notch"></div>
            <div style="padding:90px 40px 0; height:100%; background:#F8FAFC;">
              <div style="background:linear-gradient(120deg,#0E7490,#06B6D4); border-radius:28px; padding:34px;">
                <div style="font-size:30px; font-weight:700; color:#fff;">✦ Tell me about yourself</div>
                <div style="font-size:22px; color:rgba(255,255,255,.92); margin-top:10px; line-height:1.4;">Type a paragraph — AI turns it into a structured resume.</div>
              </div>
              <div style="margin-top:28px; background:#fff; border:2px solid #E2E8F0; border-radius:24px; padding:30px; font-size:24px; line-height:1.55; color:#0F172A; height:430px;">
                I'm a senior product designer with 8 years of experience. Led the design team at Stripe where we rebuilt the payments dashboard used by 200K+ businesses. Strong in Figma, design systems, and user research…<span style="display:inline-block; width:3px; height:28px; background:#0E7490; vertical-align:-4px;"></span>
              </div>
              <div style="margin-top:26px; display:flex; gap:14px;">
                <span style="background:#E0F2FE; color:#0369A1; border-radius:100px; padding:12px 24px; font-size:21px; font-weight:600;">Senior engineer</span>
                <span style="background:#E0F2FE; color:#0369A1; border-radius:100px; padding:12px 24px; font-size:21px; font-weight:600;">Designer</span>
                <span style="background:#E0F2FE; color:#0369A1; border-radius:100px; padding:12px 24px; font-size:21px; font-weight:600;">Student</span>
              </div>
              <div style="margin-top:30px; background:#0E7490; border-radius:24px; padding:30px; text-align:center; font-size:28px; font-weight:700; color:#fff;">✨ Generate my resume</div>
            </div>
          </div>
        </div>
      </div>`,
  },

  // 4 — TAILOR: match score UI (v1.10)
  {
    name: '04-tailor',
    html: `
      <div class="frame">
        <div class="blob b1"></div><div class="blob b2"></div>
        ${brand}
        <div class="headline">
          <h1>Tailored to the job<br/>you <span class="hl">actually want</span></h1>
          <p>Paste a job post — AI matches your resume to it</p>
        </div>
        <div class="phone" style="top:560px;">
          <div class="screen"><div class="notch"></div>
            <div style="padding:100px 40px 0; background:#F8FAFC; height:100%;">
              <div style="background:#ECFDF5; border:3px solid #6EE7B7; border-radius:28px; padding:36px; text-align:center;">
                <div style="font-size:22px; font-weight:700; color:#64748B; letter-spacing:1px;">MATCH WITH THIS JOB</div>
                <div style="font-size:110px; font-weight:700; color:#059669; line-height:1.1;">86%</div>
                <div style="font-size:22px; color:#475569;">Strong match — rewrite sharpens it further</div>
              </div>
              <div style="margin-top:30px; font-size:26px; font-weight:700; color:#0F172A;">✓ Already on your resume</div>
              <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:14px;">
                <span style="background:#D1FAE5; color:#047857; border:2px solid #6EE7B7; border-radius:100px; padding:10px 22px; font-size:21px; font-weight:600;">✓ Product strategy</span>
                <span style="background:#D1FAE5; color:#047857; border:2px solid #6EE7B7; border-radius:100px; padding:10px 22px; font-size:21px; font-weight:600;">✓ Figma</span>
                <span style="background:#D1FAE5; color:#047857; border:2px solid #6EE7B7; border-radius:100px; padding:10px 22px; font-size:21px; font-weight:600;">✓ A/B testing</span>
              </div>
              <div style="margin-top:28px; font-size:26px; font-weight:700; color:#0F172A;">✗ Missing — ATS will flag these</div>
              <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:14px;">
                <span style="background:#FEF3C7; color:#B45309; border:2px solid #FCD34D; border-radius:100px; padding:10px 22px; font-size:21px; font-weight:600;">✗ Design systems</span>
                <span style="background:#FEF3C7; color:#B45309; border:2px solid #FCD34D; border-radius:100px; padding:10px 22px; font-size:21px; font-weight:600;">✗ Stakeholder mgmt</span>
              </div>
              <div style="margin-top:30px; background:#fff; border:2px solid #E2E8F0; border-radius:22px; padding:26px 30px;">
                <div style="font-size:23px; font-weight:700; color:#0F172A;">✨ Your tailored rewrite is ready</div>
                <div style="font-size:21px; color:#475569; margin-top:8px; line-height:1.5;">• New summary targeting this role<br/>• 3 experience entries rewritten<br/>• 2 missing skills added</div>
              </div>
              <div style="margin-top:26px; background:#0E7490; border-radius:24px; padding:30px; text-align:center; font-size:28px; font-weight:700; color:#fff;">✨ Apply tailored rewrite</div>
            </div>
          </div>
        </div>
      </div>`,
  },

  // 5 — COVER LETTER (v1.10)
  {
    name: '05-cover-letter',
    html: `
      <div class="frame">
        <div class="blob b1"></div><div class="blob b2"></div>
        ${brand}
        <div class="headline">
          <h1>Cover letters,<br/><span class="hl">written in one tap</span></h1>
          <p>Personal, specific, grounded in your real experience</p>
        </div>
        <div class="phone" style="top:560px;">
          <div class="screen"><div class="notch"></div>
            <div style="padding:100px 40px 0; background:#F8FAFC; height:100%;">
              <div style="background:#fff; border:2px solid #E2E8F0; border-radius:28px; padding:40px; font-size:23px; line-height:1.65; color:#1E293B;">
                Dear Hiring Manager,<br/><br/>
                When I saw that Linear is hiring a senior product designer, I recognized the exact problems I've spent the last three years solving. At Stripe, I led the redesign of a payments dashboard used by 200,000+ businesses — cutting task completion time by 34%…<br/><br/>
                <span style="color:#94A3B8;">Your background in design systems and…</span>
              </div>
              <div style="margin-top:30px; display:flex; gap:16px;">
                <div style="flex:1; background:#0E7490; border-radius:22px; padding:26px; text-align:center; font-size:25px; font-weight:700; color:#fff;">⧉ Copy</div>
                <div style="flex:1; background:#fff; border:2px solid #E2E8F0; border-radius:22px; padding:26px; text-align:center; font-size:25px; font-weight:700; color:#0F172A;">↗ Share</div>
              </div>
            </div>
          </div>
        </div>
      </div>`,
  },

  // 6 — CUSTOMIZE: vivid render + color dots
  {
    name: '06-customize',
    html: `
      <div class="frame">
        <div class="blob b1"></div><div class="blob b2"></div>
        ${brand}
        <div class="headline">
          <h1>Your photo.<br/>Your <span class="hl">colors</span>.</h1>
          <p>Recolor any template · add a headshot</p>
        </div>
        <div style="position:absolute; top:545px; left:0; right:0;">
          <div style="display:flex; gap:22px; justify-content:center;">
            ${['#0E7490', '#4F46E5', '#0D9488', '#B91C1C', '#B45309', '#6D28D9', '#DB2777']
              .map(
                (c, i) =>
                  `<span style="width:64px;height:64px;border-radius:50%;background:${c};border:5px solid ${i === 2 ? '#fff' : 'rgba(255,255,255,0.35)'};"></span>`,
              )
              .join('')}
          </div>
        </div>
        <div class="phone" style="top:680px;">
          <div class="screen"><div class="notch"></div><img class="shot" src="${IMG.vivid}" style="height:1530px; object-position: top right;"/></div>
        </div>
      </div>`,
  },

  // 7 — ATS
  {
    name: '07-ats',
    html: `
      <div class="frame">
        <div class="blob b1"></div><div class="blob b2"></div>
        ${brand}
        <div class="headline">
          <h1>Built to pass<br/><span class="hl">ATS scanners</span></h1>
          <p>Every template scored for applicant tracking systems</p>
        </div>
        <div class="phone" style="top:560px;">
          <div class="screen"><div class="notch"></div>
            <div style="padding:110px 40px 0; background:#F8FAFC; height:100%;">
              <div style="text-align:center;">
                <div style="display:inline-flex; align-items:center; justify-content:center; width:300px; height:300px; border-radius:50%; border:22px solid #059669; background:#ECFDF5;">
                  <div>
                    <div style="font-size:96px; font-weight:700; color:#047857; line-height:1;">98</div>
                    <div style="font-size:24px; font-weight:700; color:#059669; letter-spacing:1px;">ATS SCORE</div>
                  </div>
                </div>
              </div>
              ${[
                ['Clean single-column layout', '✓'],
                ['Standard section headings', '✓'],
                ['Real text — no image traps', '✓'],
                ['Keywords from the job post', '✓'],
                ['Exports as true text PDF', '✓'],
              ]
                .map(
                  ([t, c]) => `
                <div style="margin-top:22px; background:#fff; border:2px solid #E2E8F0; border-radius:20px; padding:26px 30px; display:flex; align-items:center; justify-content:space-between;">
                  <span style="font-size:26px; font-weight:600; color:#0F172A;">${t}</span>
                  <span style="width:46px;height:46px;border-radius:50%;background:#D1FAE5;color:#047857;display:inline-flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;">${c}</span>
                </div>`,
                )
                .join('')}
            </div>
          </div>
        </div>
      </div>`,
  },

  // 8 — EXPORT
  {
    name: '08-export',
    html: `
      <div class="frame">
        <div class="blob b1"></div><div class="blob b2"></div>
        ${brand}
        <div class="headline">
          <h1>Download.<br/>Apply. <span class="hl">Get hired.</span></h1>
          <p>Crisp PDF saved straight to your phone — US Letter or A4</p>
        </div>
        <div class="float-card" style="width:340px; top:640px; left:40px; transform:rotate(-8deg); height:700px;">
          <img src="${IMG.atsPro}" style="height:700px"/>
        </div>
        <div class="float-card" style="width:340px; top:640px; right:40px; transform:rotate(8deg); height:700px;">
          <img src="${IMG.modernPro}" style="height:700px"/>
        </div>
        <div class="phone" style="top:600px; width:700px; height:1440px;">
          <div class="screen"><div class="notch"></div>
            <div style="padding:110px 40px 0; background:#F8FAFC; height:100%; text-align:center;">
              <div style="margin:40px auto 0; width:300px; height:380px; background:#fff; border:2px solid #E2E8F0; border-radius:24px; padding:26px; text-align:left;">
                <div style="height:18px; width:60%; background:#0F172A; border-radius:6px;"></div>
                <div style="height:10px; width:40%; background:#94A3B8; border-radius:5px; margin-top:10px;"></div>
                <div style="height:8px; width:90%; background:#E2E8F0; border-radius:4px; margin-top:24px;"></div>
                <div style="height:8px; width:84%; background:#E2E8F0; border-radius:4px; margin-top:8px;"></div>
                <div style="height:8px; width:88%; background:#E2E8F0; border-radius:4px; margin-top:8px;"></div>
                <div style="display:inline-block; margin-top:28px; background:#FEE2E2; color:#B91C1C; font-weight:800; font-size:22px; padding:8px 18px; border-radius:10px;">PDF</div>
              </div>
              <div style="margin:50px auto 0; max-width:520px; background:#0E7490; border-radius:24px; padding:32px; font-size:28px; font-weight:700; color:#fff;">⬇ Save PDF to Phone</div>
              <div style="margin-top:20px; font-size:22px; color:#64748B;">Saves to the folder you choose</div>
            </div>
          </div>
        </div>
      </div>`,
  },
];

/* Feature graphic 1024×500 */
const FEATURE_GRAPHIC = `
  <div style="position:relative; width:1024px; height:500px; overflow:hidden; font-family:'Inter','Segoe UI',sans-serif; background:linear-gradient(120deg,#0B3B54 0%,#0E7490 45%,#0EA5E9 100%); color:#fff;">
    <div style="position:absolute; width:500px; height:500px; border-radius:50%; background:#14B8A6; filter:blur(80px); opacity:.5; top:-150px; right:120px;"></div>
    <div style="position:absolute; left:64px; top:0; bottom:0; display:flex; flex-direction:column; justify-content:center; max-width:520px;">
      <div style="display:inline-flex; align-items:center; gap:10px; font-size:26px; font-weight:700;"><span style="width:14px;height:14px;border-radius:5px;background:#5EEAD4;"></span>FreeResume AI</div>
      <div style="font-size:64px; font-weight:700; letter-spacing:-2px; line-height:1.05; margin-top:18px;">AI Resume<br/>Builder</div>
      <div style="display:flex; gap:10px; margin-top:26px; flex-wrap:wrap;">
        <span style="background:rgba(255,255,255,.16); border:2px solid rgba(255,255,255,.25); border-radius:100px; padding:8px 18px; font-size:19px; font-weight:600;">26 templates</span>
        <span style="background:rgba(255,255,255,.16); border:2px solid rgba(255,255,255,.25); border-radius:100px; padding:8px 18px; font-size:19px; font-weight:600;">ATS-ready</span>
        <span style="background:rgba(255,255,255,.16); border:2px solid rgba(255,255,255,.25); border-radius:100px; padding:8px 18px; font-size:19px; font-weight:600;">PDF export</span>
      </div>
    </div>
    <div style="position:absolute; right:150px; top:60px; width:230px; border-radius:16px; overflow:hidden; box-shadow:0 24px 60px rgba(2,18,32,.5); transform:rotate(6deg); border:2px solid rgba(255,255,255,.35);">
      <img src="${IMG.aurora}" style="width:100%; height:460px; object-fit:cover; object-position:top; display:block;"/>
    </div>
    <div style="position:absolute; right:20px; top:120px; width:200px; border-radius:16px; overflow:hidden; box-shadow:0 24px 60px rgba(2,18,32,.5); transform:rotate(12deg); border:2px solid rgba(255,255,255,.35);">
      <img src="${IMG.onyx}" style="width:100%; height:400px; object-fit:cover; object-position:top; display:block;"/>
    </div>
  </div>`;

/* ------------------------------------------------------------------ */
/* Render                                                             */
/* ------------------------------------------------------------------ */

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  // Phone screenshots: 1080×1920
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  for (const f of FRAMES) {
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head><body>${f.html}</body></html>`;
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(() => (document as any).fonts?.ready).catch(() => {});
    await new Promise((r) => setTimeout(r, 250));
    const file = path.join(OUT, `${f.name}.png`);
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
    console.log(`  ✓ ${f.name}.png`);
  }

  // Feature graphic: 1024×500
  await page.setViewport({ width: 1024, height: 500, deviceScaleFactor: 1 });
  const fgHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${interFontFaceCss()} *{margin:0;padding:0;box-sizing:border-box;}</style></head><body>${FEATURE_GRAPHIC}</body></html>`;
  await page.setContent(fgHtml, { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => (document as any).fonts?.ready).catch(() => {});
  await new Promise((r) => setTimeout(r, 250));
  await page.screenshot({ path: path.join(OUT, 'feature-graphic.png'), clip: { x: 0, y: 0, width: 1024, height: 500 } });
  console.log('  ✓ feature-graphic.png');

  await browser.close();
  console.log(`\nDone → ${OUT}`);
})();
