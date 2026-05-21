/**
 * End-to-end smoke test of every AI feature against the live OpenRouter API.
 *
 * Run with:  node scripts/test-ai-features.mjs
 *
 * Hits each AI endpoint the app uses with realistic input + the same model
 * the app uses in production. Prints a pass/fail report. If anything 404s
 * or 401s, the equivalent feature is broken in the live app.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

// Load .env without dotenv dependency
const envText = readFileSync(path.resolve('.env'), 'utf8');
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    }),
);

const KEY = env.EXPO_PUBLIC_OPENROUTER_API_KEY;
if (!KEY) {
  console.error('Missing EXPO_PUBLIC_OPENROUTER_API_KEY');
  process.exit(1);
}

const BASE = 'https://openrouter.ai/api/v1/chat/completions';

async function call(label, body) {
  process.stdout.write(`${label.padEnd(28)} `);
  const t0 = Date.now();
  try {
    const r = await fetch(BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${KEY}`,
        'HTTP-Referer': 'https://freeresumeai.app',
        'X-Title': 'FreeResume AI',
      },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    const dt = Date.now() - t0;
    if (!r.ok) {
      console.log(`❌ HTTP ${r.status}  ${j?.error?.message || 'unknown'}`);
      return false;
    }
    const content = j?.choices?.[0]?.message?.content ?? '';
    const tokens = j?.usage?.total_tokens ?? 0;
    const cost = j?.usage?.cost ?? 0;
    const sample = content.slice(0, 60).replace(/\s+/g, ' ');
    console.log(`✅ ${dt}ms  ${tokens}tok  $${cost.toFixed(5)}  "${sample}..."`);
    return true;
  } catch (e) {
    console.log(`❌ network: ${e.message}`);
    return false;
  }
}

const GROK = 'x-ai/grok-4.3';
const GEMINI = 'google/gemini-2.0-flash-001';

const sampleResume = {
  name: 'Alex Chen',
  jobTitle: 'Senior Product Designer',
  email: 'alex@example.com',
  experience: [
    {
      title: 'Senior Designer',
      company: 'Acme Corp',
      bullets: [
        'redesigned checkout flow',
        'mentored 4 designers',
        'shipped design system',
      ],
    },
  ],
};

console.log('Testing every AI feature against live OpenRouter...\n');

const results = [];

results.push(
  await call('1. Resume Scorer (Grok)', {
    model: GROK,
    messages: [
      {
        role: 'system',
        content: 'You are an ATS expert. Return JSON: {"overall":number}.',
      },
      {
        role: 'user',
        content: `Score this resume: ${JSON.stringify(sampleResume)}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 200,
  }),
);

results.push(
  await call('2. Summary Generator (Grok)', {
    model: GROK,
    messages: [
      {
        role: 'system',
        content:
          'You are an expert resume writer. Write a 2-sentence professional summary.',
      },
      {
        role: 'user',
        content: `Job title: ${sampleResume.jobTitle}. Recent role: ${sampleResume.experience[0].title} at ${sampleResume.experience[0].company}.`,
      },
    ],
    temperature: 0.7,
    max_tokens: 200,
  }),
);

results.push(
  await call('3. Bullet Enhancer (Grok)', {
    model: GROK,
    messages: [
      {
        role: 'system',
        content:
          'Rewrite the bullet point to be achievement-focused with a metric. One sentence only.',
      },
      {
        role: 'user',
        content: sampleResume.experience[0].bullets[0],
      },
    ],
    temperature: 0.7,
    max_tokens: 100,
  }),
);

results.push(
  await call('4. Skill Suggester (Grok)', {
    model: GROK,
    messages: [
      {
        role: 'system',
        content:
          'List 5 skills relevant to this job title as a JSON array of strings.',
      },
      { role: 'user', content: sampleResume.jobTitle },
    ],
    temperature: 0.7,
    max_tokens: 200,
  }),
);

results.push(
  await call('5. Resume Parser (Gemini)', {
    model: GEMINI,
    messages: [
      {
        role: 'system',
        content:
          'Extract resume fields from this text and return JSON with keys: header, summary, experience.',
      },
      {
        role: 'user',
        content:
          'Alex Chen\nSenior Product Designer · alex@example.com\n\nEXPERIENCE\nAcme Corp — Senior Designer — 2021 to Present\n- Redesigned checkout flow',
      },
    ],
    temperature: 0.3,
    max_tokens: 400,
  }),
);

console.log('');
const pass = results.filter(Boolean).length;
const fail = results.length - pass;
console.log(`Result: ${pass}/${results.length} passed${fail > 0 ? `, ${fail} failed ❌` : ' ✅'}`);
process.exit(fail > 0 ? 1 : 0);
