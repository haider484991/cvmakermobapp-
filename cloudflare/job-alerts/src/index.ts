/**
 * job-alerts — Cloudflare Worker.
 *
 * Two jobs in one Worker:
 *
 *   HTTP    POST /subscribe, POST /unsubscribe — the app registers a saved
 *           search and its Expo push token.
 *   CRON    scheduled() — once a day, search the same public boards the app
 *           uses, score postings against each saved search, and push ONE
 *           notification per device summarising what is new.
 *
 * Why Cloudflare rather than a Supabase edge function: the cron trigger, the
 * D1 database and the outbound fetches are all on the free tier, and the
 * account already hosts the rest of this stack. There is no server to keep up.
 *
 * Two design choices worth knowing before editing:
 *
 * 1. THE SCORING HERE IS A CONSERVATIVE PREFILTER, NOT THE REAL RANKING.
 *    `src/services/jobs/jobMatch.ts` in the app is the authority — it has the
 *    whole resume and runs when the user opens the app. Duplicating it here
 *    would drift silently, so this does something simpler and stricter:
 *    real title agreement plus keyword hits, with a high floor. Staying quiet
 *    about a good job is a much cheaper mistake than crying wolf.
 *
 * 2. ONE NOTIFICATION PER DEVICE PER RUN, NEVER ONE PER JOB.
 *    `seen_job_ids` is what stops the same postings alerting twice. An alert
 *    that repeats yesterday's jobs gets muted within a week, and on Android
 *    13+ you only get to ask for that permission once.
 */

export interface Env {
  DB: D1Database;
  /** Shared secret the app sends as X-Alert-Key. Set with `wrangler secret put`. */
  SUBSCRIBE_KEY: string;
}

const MUSE_URL = 'https://www.themuse.com/api/public/jobs';
const REMOTIVE_URL = 'https://remotive.com/api/remote-jobs';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** How many subscriptions one cron invocation will process. */
const BATCH = 200;
/** Job ids remembered per device. Bounded so a row can't grow forever. */
const SEEN_CAP = 300;

/** Must stay in sync with MUSE_CATEGORIES in src/services/jobs/jobsApi.ts. */
const MUSE_CATEGORIES: Record<string, string> = {
  tech: 'Software Engineering',
  healthcare: 'Healthcare',
  finance: 'Accounting and Finance',
  marketing: 'Advertising and Marketing',
  education: 'Education',
  engineering: 'Science and Engineering',
  design: 'Design and UX',
  sales: 'Sales',
};

/** Notification copy per locale. Mirrors the `jobAlerts` i18n namespace. */
const COPY: Record<string, { title: string; one: string; many: string }> = {
  en: { title: 'New roles match your resume', one: '1 new {{query}} role worth a look', many: '{{count}} new {{query}} roles worth a look' },
  es: { title: 'Nuevos empleos para tu currículum', one: '1 nuevo puesto de {{query}} para ver', many: '{{count}} nuevos puestos de {{query}} para ver' },
  'pt-BR': { title: 'Novas vagas combinam com seu currículo', one: '1 nova vaga de {{query}} para ver', many: '{{count}} novas vagas de {{query}} para ver' },
  fr: { title: 'De nouvelles offres correspondent à votre CV', one: '1 nouveau poste de {{query}} à voir', many: '{{count}} nouveaux postes de {{query}} à voir' },
  de: { title: 'Neue Stellen passen zu deinem Lebenslauf', one: '1 neue Stelle als {{query}}', many: '{{count}} neue Stellen als {{query}}' },
  hi: { title: 'आपके रिज़्यूमे से मेल खाती नई नौकरियाँ', one: '{{query}} की 1 नई नौकरी देखें', many: '{{query}} की {{count}} नई नौकरियाँ देखें' },
  id: { title: 'Lowongan baru cocok dengan CV kamu', one: '1 lowongan {{query}} baru', many: '{{count}} lowongan {{query}} baru' },
  ar: { title: 'وظائف جديدة تناسب سيرتك الذاتية', one: 'وظيفة {{query}} جديدة تستحق النظر', many: '{{count}} وظائف {{query}} جديدة تستحق النظر' },
  ru: { title: 'Новые вакансии под ваше резюме', one: '1 новая вакансия: {{query}}', many: 'Новых вакансий: {{count}} — {{query}}' },
  tr: { title: 'Özgeçmişine uyan yeni ilanlar', one: '1 yeni {{query}} ilanı', many: '{{count}} yeni {{query}} ilanı' },
  ja: { title: 'あなたに合う新着求人', one: '{{query}} の新着求人が1件', many: '{{query}} の新着求人が{{count}}件' },
  'zh-CN': { title: '有新职位匹配你的简历', one: '有 1 个新的{{query}}职位', many: '有 {{count}} 个新的{{query}}职位' },
};

interface SubscriptionRow {
  push_token: string;
  query: string;
  location: string;
  industry: string | null;
  skills: string;
  min_score: number;
  locale: string;
  seen_job_ids: string;
  failure_count: number;
}

interface Posting {
  id: string;
  title: string;
  text: string;
}

/* ------------------------------------------------------------------ */
/* Scoring                                                            */
/* ------------------------------------------------------------------ */

const STOP = new Set(['the', 'and', 'for', 'with', 'senior', 'junior', 'lead', 'staff', 'remote', 'jr', 'sr']);

function tokens(s: string): string[] {
  return (s || '')
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((w) => w.length >= 2 && !STOP.has(w));
}

/** Conservative 0–100. See note 1 at the top: prefilter, not the ranking. */
export function score(query: string, skills: string[], job: Posting): number {
  const q = tokens(query);
  if (q.length === 0) return 0;

  const titleTokens = new Set(tokens(job.title));
  const hits = q.filter((w) => titleTokens.has(w)).length;
  const titleScore = (hits / q.length) * 65;
  // Demand real title agreement. This is what stops a nurse being pushed a
  // sales role that happens to mention "care".
  if (titleScore < 30) return 0;

  const hay = `${job.title} ${job.text}`.toLowerCase();
  const skillHits = skills.filter((s) => {
    const n = s.toLowerCase();
    return n.length <= 3
      ? new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(hay)
      : hay.includes(n);
  }).length;
  const skillScore = skills.length ? (skillHits / skills.length) * 35 : 0;

  return Math.round(titleScore + skillScore);
}

export function renderCopy(locale: string, query: string, count: number): { title: string; body: string } {
  const copy = COPY[locale] ?? COPY[locale?.split('-')[0]] ?? COPY.en;
  const template = count === 1 ? copy.one : copy.many;
  return {
    title: copy.title,
    body: template.replace('{{count}}', String(count)).replace('{{query}}', query),
  };
}

/* ------------------------------------------------------------------ */
/* Job boards                                                         */
/* ------------------------------------------------------------------ */

async function getJson(url: string, timeoutMs = 12_000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const stripHtml = (html: string) =>
  (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 4000);

async function fetchPostings(location: string, industry: string | null): Promise<Posting[]> {
  const category = industry ? MUSE_CATEGORIES[industry] : undefined;

  // The Muse has no keyword parameter and ~20,000 pages, so we sample a slice
  // of the right CATEGORY rather than page 1 of everything — without this a
  // search for "Registered Nurse" finds nothing at all.
  const musePages = [1, 2, 3].map((page) => {
    const p = new URLSearchParams({ page: String(page) });
    if (location.trim()) p.set('location', location.trim());
    if (category) p.set('category', category);
    return getJson(`${MUSE_URL}?${p}`).catch(() => ({ results: [] }));
  });

  const [muse, remotive] = await Promise.all([
    Promise.all(musePages),
    getJson(REMOTIVE_URL).catch(() => ({ jobs: [] })),
  ]);

  const out: Posting[] = [];
  for (const page of muse) {
    for (const j of page.results ?? []) {
      out.push({ id: `muse-${j.id}`, title: j.name ?? '', text: stripHtml(j.contents ?? '') });
    }
  }
  for (const j of (remotive.jobs ?? []).slice(0, 200)) {
    out.push({ id: `remotive-${j.id}`, title: j.title ?? '', text: stripHtml(j.description ?? '') });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* HTTP — the app registering a saved search                          */
/* ------------------------------------------------------------------ */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });

function parseSkills(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12); // a keyword filter, never a profile
}

async function handleSubscribe(req: Request, env: Env): Promise<Response> {
  const body = (await req.json().catch(() => null)) as any;
  if (!body) return json({ error: 'bad json' }, 400);

  const pushToken = String(body.pushToken ?? '').trim();
  const query = String(body.query ?? '').trim();
  // An Expo token always looks like ExponentPushToken[...] or ExpoPushToken[...].
  // Rejecting anything else keeps junk out of the table cheaply.
  if (!/^Expo(nent)?PushToken\[[^\]]+\]$/.test(pushToken)) {
    return json({ error: 'invalid push token' }, 400);
  }
  if (!query) return json({ error: 'query required' }, 400);

  await env.DB.prepare(
    `INSERT INTO subscriptions
       (push_token, query, location, industry, skills, min_score, locale, platform, app_version, enabled, failure_count, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1, 0, datetime('now'))
     ON CONFLICT(push_token) DO UPDATE SET
       query = excluded.query,
       location = excluded.location,
       industry = excluded.industry,
       skills = excluded.skills,
       min_score = excluded.min_score,
       locale = excluded.locale,
       platform = excluded.platform,
       app_version = excluded.app_version,
       enabled = 1,
       failure_count = 0,
       updated_at = datetime('now')`,
  )
    .bind(
      pushToken,
      query.slice(0, 120),
      String(body.location ?? '').trim().slice(0, 120),
      body.industry ? String(body.industry).slice(0, 40) : null,
      JSON.stringify(parseSkills(body.skills)),
      Math.min(100, Math.max(50, Number(body.minScore) || 70)),
      String(body.locale ?? 'en').slice(0, 10),
      String(body.platform ?? '').slice(0, 20),
      String(body.appVersion ?? '').slice(0, 20),
    )
    .run();

  return json({ ok: true });
}

async function handleUnsubscribe(req: Request, env: Env): Promise<Response> {
  const body = (await req.json().catch(() => null)) as any;
  const pushToken = String(body?.pushToken ?? '').trim();
  if (!pushToken) return json({ error: 'pushToken required' }, 400);
  // DELETE, not disable: when someone turns alerts off, their saved search
  // ceases to exist server-side. Re-enabling simply re-registers — the app
  // still holds everything needed to rebuild the row.
  await env.DB.prepare('DELETE FROM subscriptions WHERE push_token = ?1').bind(pushToken).run();
  return json({ ok: true });
}

/* ------------------------------------------------------------------ */
/* Cron — the daily pass                                              */
/* ------------------------------------------------------------------ */

async function runAlerts(env: Env, dryRun: boolean): Promise<{ checked: number; notified: number }> {
  // Due = enabled and not checked in the last 20 hours, so a daily cron has
  // slack without ever double-sending.
  const { results } = await env.DB.prepare(
    `SELECT push_token, query, location, industry, skills, min_score, locale, seen_job_ids, failure_count
       FROM subscriptions
      WHERE enabled = 1
        AND failure_count < 3
        AND (last_checked_at IS NULL OR last_checked_at < datetime('now', '-20 hours'))
      LIMIT ?1`,
  )
    .bind(BATCH)
    .all<SubscriptionRow>();

  let checked = 0;
  let notified = 0;

  for (const sub of results ?? []) {
    checked++;
    const now = new Date().toISOString();
    try {
      const skills: string[] = JSON.parse(sub.skills || '[]');
      const seen: string[] = JSON.parse(sub.seen_job_ids || '[]');
      const seenSet = new Set(seen);

      const postings = await fetchPostings(sub.location, sub.industry);
      const fresh = postings
        .filter((j) => !seenSet.has(j.id))
        .map((j) => ({ job: j, s: score(sub.query, skills, j) }))
        .filter((m) => m.s >= (sub.min_score ?? 70))
        .sort((a, b) => b.s - a.s)
        .slice(0, 10);

      if (fresh.length === 0 || dryRun) {
        await env.DB.prepare(`UPDATE subscriptions SET last_checked_at = ?2 WHERE push_token = ?1`)
          .bind(sub.push_token, now)
          .run();
        continue;
      }

      const { title, body } = renderCopy(sub.locale, sub.query, fresh.length);
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          to: sub.push_token,
          title,
          body,
          sound: 'default',
          data: { type: 'job_alert', query: sub.query, count: fresh.length },
        }),
      });
      const payload: any = await res.json().catch(() => null);
      const status = payload?.data?.status;
      const errCode = payload?.data?.details?.error;

      if (status === 'ok') {
        notified++;
        const nextSeen = [...fresh.map((m) => m.job.id), ...seen].slice(0, SEEN_CAP);
        await env.DB.prepare(
          `UPDATE subscriptions
              SET last_checked_at = ?2, last_sent_at = ?2, failure_count = 0, seen_job_ids = ?3
            WHERE push_token = ?1`,
        )
          .bind(sub.push_token, now, JSON.stringify(nextSeen))
          .run();
      } else if (errCode === 'DeviceNotRegistered') {
        // App uninstalled or token rotated. Three strikes, then stop.
        await env.DB.prepare(
          `UPDATE subscriptions
              SET last_checked_at = ?2,
                  failure_count = failure_count + 1,
                  enabled = CASE WHEN failure_count + 1 >= 3 THEN 0 ELSE enabled END
            WHERE push_token = ?1`,
        )
          .bind(sub.push_token, now)
          .run();
      } else {
        await env.DB.prepare(`UPDATE subscriptions SET last_checked_at = ?2 WHERE push_token = ?1`)
          .bind(sub.push_token, now)
          .run();
      }
    } catch {
      // One bad subscription must never stop the run.
      await env.DB.prepare(`UPDATE subscriptions SET last_checked_at = ?2 WHERE push_token = ?1`)
        .bind(sub.push_token, now)
        .run();
    }
  }

  return { checked, notified };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, X-Alert-Key',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
      });
    }

    if (url.pathname === '/health') return json({ ok: true });

    // A shared key keeps casual abuse out. It is not a strong secret — it
    // ships in the app bundle — but it stops the endpoint being trivially
    // spammed by anything that finds the URL.
    if (env.SUBSCRIBE_KEY && req.headers.get('X-Alert-Key') !== env.SUBSCRIBE_KEY) {
      return json({ error: 'unauthorized' }, 401);
    }

    if (req.method === 'POST' && url.pathname === '/subscribe') return handleSubscribe(req, env);
    if (req.method === 'POST' && url.pathname === '/unsubscribe') return handleUnsubscribe(req, env);

    // Manual trigger for testing. ?dry_run=1 scores and counts without sending.
    if (req.method === 'POST' && url.pathname === '/run') {
      const out = await runAlerts(env, url.searchParams.get('dry_run') === '1');
      return json(out);
    }

    return json({ error: 'not found' }, 404);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runAlerts(env, false).then(() => undefined));
  },
};
