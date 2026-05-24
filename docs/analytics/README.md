# Analytics Toolkit

Everything you need to actually see the events flowing into your app.

## What's tracked

The app emits 28 typed events covering lifecycle, AI usage, exports, templates, the review prompt funnel, and (after v1.8) purchases. See `src/services/analytics/analytics.ts` for the canonical list (`ANALYTICS_EVENTS`).

Each event is logged to the **Supabase `analytics_events` table** — no third-party SaaS, no extra bill, your data stays in your Supabase instance.

## One-time setup (do this once before any of the queries return data)

### 1. Apply the migration

The `analytics_events` table is created by `supabase/migrations/002_analytics_events.sql`. Apply it via either:

- **Supabase Studio UI** — Project → SQL Editor → New query → paste the contents of `002_analytics_events.sql` → Run.
- **Supabase CLI** — `supabase db push` (if you've linked the project).

You can verify it worked by running this in the SQL Editor:

```sql
select count(*) from analytics_events;
-- Should return 0, not an error.
```

### 2. Get the service-role key (for the CLI viewer)

The CLI script `analytics-kpis.mjs` needs the **service-role** key (not anon) because the table has RLS that blocks all reads from clients.

1. Supabase Studio → Project Settings → API
2. Find **`service_role`** key (it says "secret" — that's fine, this stays on your machine)
3. Add to your local `.env`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=eyJ...your-secret-key...
   ```
4. `.env` is gitignored — never commit this key

⚠️ The service-role key has full admin access. Never bundle it into the app, never share it.

## Three ways to view the data

### Option A — One-line terminal dashboard (fastest)

```bash
node scripts/analytics-kpis.mjs            # last 7 days
node scripts/analytics-kpis.mjs --days=30  # last 30 days
node scripts/analytics-kpis.mjs --live     # last 1 hour (for deploys)
```

Outputs:
- Total events ever / in window / unique devices
- Top 12 events
- Export success rate
- AI score request → complete → fail counts
- Review prompt funnel (shown → loved → declined)
- 6 most recent events for sanity

### Option B — Supabase Studio SQL Editor (most flexible)

Open `docs/analytics/queries.sql` — 15+ ready-to-paste queries grouped by topic:

1. Health check (is data flowing?)
2. Acquisition + DAU/MAU/stickiness
3. Activation funnel (install → first export)
4. Engagement (feature usage)
5. AI usage + cost-relevant metrics
6. Templates (which ones win)
7. Cohort retention (D1/D7/D14/D30)
8. Review prompt funnel
9. Monetization (lights up after v1.8)
10. Failure rates

Paste any block into Supabase Studio → SQL Editor → Run. Most return in <100ms.

### Option C — Hosted BI dashboard (for sharing with non-technical folks)

If you want a real always-on dashboard with charts and email reports, three free options:

| Tool | Setup | Best for |
|---|---|---|
| **Metabase Cloud** (free trial) | Connect Postgres → drag-drop charts | Marketing dashboards, sharing |
| **Grafana Cloud** (free tier) | Add Postgres datasource → build panels | Real-time monitoring, alerts |
| **Supabase Studio Reports** (built-in) | Already there in your Supabase project | Quick ad-hoc charts |

All three connect to your Supabase Postgres with the service-role key. Pick one based on whether you want shareable dashboards (Metabase), alerting (Grafana), or zero setup (Supabase Studio).

## Key KPIs to watch weekly

These are the numbers I'd put on a sticky note:

| KPI | Target | Why |
|---|---|---|
| **DAU / MAU stickiness** | > 0.20 | Healthy engagement for a productivity app |
| **Activation rate** (% of installs that export a PDF) | > 25% | If lower, the editor flow is friction-heavy |
| **D7 retention** | > 15% | Most utility apps see 10-20% |
| **AI score success rate** | > 95% | If lower, AI infra is unstable |
| **Export failure rate** | < 2% | If higher, template engine has bugs |
| **Review prompt love rate** | > 40% | If lower, you're prompting too aggressively |

## Adding new events

In any source file:

```ts
import { track, ANALYTICS_EVENTS } from '@/services/analytics/analytics';

track(ANALYTICS_EVENTS.RESUME_CREATED, { source: 'dashboard_button' });
```

For a brand-new event:

1. Add a constant to `ANALYTICS_EVENTS` in `src/services/analytics/analytics.ts`
2. Call `track(YOUR_NEW_EVENT, { ...properties })`
3. Properties go into the `properties` jsonb column — query them with `properties->>'key'`

## How the offline queue works

Events are buffered in `AsyncStorage` and flushed in batches when:
- The app starts up (auto-flush on app_opened)
- Any track() call succeeds (immediate retry of queued events)

Max queue size: 500 events. Beyond that, oldest events get dropped. The user could lose data only if they're offline for many days AND fire many hundreds of events — unlikely.

## Dev mode behavior

By default, `track()` is a no-op in `__DEV__` to keep the production table clean. To test event flow locally, set:

```
EXPO_PUBLIC_ANALYTICS_DEV=1
```

in your `.env`.
