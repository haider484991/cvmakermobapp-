/**
 * Read Inter TTF files from @expo-google-fonts/inter, base64-encode them,
 * and emit src/services/pdf/interFonts.ts as a constants module.
 *
 * Run this once after `npx expo install @expo-google-fonts/inter` (or when
 * the package version changes). The output file is committed to git so the
 * HTML engine doesn't have to read from node_modules at runtime.
 *
 * We only ship 3 weights (Regular, SemiBold, Bold) because:
 *   - Each TTF is ~150KB → ~200KB base64
 *   - 3 weights × 200KB ≈ 600KB added to every PDF/preview HTML
 *   - Resumes only need 3 weights (body=Regular, subhead=SemiBold,
 *     heading/name=Bold). Medium and ExtraBold are nice-to-have but
 *     don't earn another 400KB.
 *
 *   usage:  node scripts/build-inter-base64.mjs
 */

import { readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const INTER_DIR = path.join(ROOT, 'node_modules', '@expo-google-fonts', 'inter');
const PLAYFAIR_DIR = path.join(ROOT, 'node_modules', '@expo-google-fonts', 'playfair-display');
const OUT = path.join(ROOT, 'src', 'services', 'pdf', 'interFonts.ts');

const INTER_WEIGHTS = [
  { name: 'INTER_REGULAR_400', dir: '400Regular', weight: 400, family: 'Inter', baseDir: INTER_DIR, filePrefix: 'Inter' },
  { name: 'INTER_SEMIBOLD_600', dir: '600SemiBold', weight: 600, family: 'Inter', baseDir: INTER_DIR, filePrefix: 'Inter' },
  { name: 'INTER_BOLD_700', dir: '700Bold', weight: 700, family: 'Inter', baseDir: INTER_DIR, filePrefix: 'Inter' },
];
// Playfair Display: reserved for display name headings only (24pt+) per
// research — its thin strokes break visually at body-text sizes. Just
// the Bold weight; we don't ship Regular Playfair because nothing on the
// resume should use it small.
const PLAYFAIR_WEIGHTS = [
  { name: 'PLAYFAIR_BOLD_700', dir: '700Bold', weight: 700, family: 'Playfair Display', baseDir: PLAYFAIR_DIR, filePrefix: 'PlayfairDisplay' },
];
const WEIGHTS = [...INTER_WEIGHTS, ...PLAYFAIR_WEIGHTS];

function readTtf(weightDir, baseDir, filePrefix) {
  const dir = path.join(baseDir, weightDir);
  const candidates = [
    path.join(dir, `${filePrefix}_${weightDir}.ttf`),
    path.join(dir, `${filePrefix}-${weightDir}.ttf`),
  ];
  for (const c of candidates) {
    if (statSync(c, { throwIfNoEntry: false })) {
      return readFileSync(c);
    }
  }
  throw new Error(`Could not find TTF in ${dir}; tried ${candidates.join(', ')}`);
}

const lines = [
  '/**',
  ' * Inter font weights as base64-encoded TTF strings.',
  ' *',
  ' * GENERATED FILE — do not edit by hand.',
  ' * Regenerate with: node scripts/build-inter-base64.mjs',
  ' *',
  ' * Embedded inline in the HTML engine\'s <head> via @font-face so:',
  ' *   - PDF export uses Inter regardless of device locale / fonts installed',
  ' *   - WebView preview shows the same typography as the exported PDF',
  ' *   - No network request needed at PDF render time (Print.printToFileAsync',
  ' *     runs offline)',
  ' */',
  '',
];

for (const w of WEIGHTS) {
  const ttf = readTtf(w.dir, w.baseDir, w.filePrefix);
  const b64 = ttf.toString('base64');
  lines.push(`/** ${w.family} weight ${w.weight} (${w.dir}) — ${Math.round(b64.length / 1024)}KB base64 */`);
  lines.push(`export const ${w.name} = '${b64}';`);
  lines.push('');
}

// Helper that returns the full @font-face CSS for all bundled families
// so the HTML engine can drop it into a single <style> block.
lines.push('/** Generate the @font-face CSS embedding every bundled font weight. */');
lines.push('export function interFontFaceCss(): string {');
lines.push('  return `');
lines.push('@font-face { font-family: \'Inter\'; font-weight: 400; font-style: normal; font-display: block;');
lines.push('  src: url(data:font/ttf;base64,${INTER_REGULAR_400}) format(\'truetype\'); }');
lines.push('@font-face { font-family: \'Inter\'; font-weight: 600; font-style: normal; font-display: block;');
lines.push('  src: url(data:font/ttf;base64,${INTER_SEMIBOLD_600}) format(\'truetype\'); }');
lines.push('@font-face { font-family: \'Inter\'; font-weight: 700; font-style: normal; font-display: block;');
lines.push('  src: url(data:font/ttf;base64,${INTER_BOLD_700}) format(\'truetype\'); }');
lines.push('@font-face { font-family: \'Playfair Display\'; font-weight: 700; font-style: normal; font-display: block;');
lines.push('  src: url(data:font/ttf;base64,${PLAYFAIR_BOLD_700}) format(\'truetype\'); }');
lines.push('`.trim();');
lines.push('}');
lines.push('');

writeFileSync(OUT, lines.join('\n'));
const sizeKb = Math.round(statSync(OUT).size / 1024);
console.log(`Wrote ${OUT} (${sizeKb} KB total)`);
