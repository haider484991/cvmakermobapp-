-- Analytics events table.
-- Append-only log of user actions for product analytics. Designed for
-- cheap inserts + cheap aggregation queries (group by event_name, day).
--
-- Why Supabase instead of Firebase/Mixpanel/PostHog:
--   - You already pay for Supabase, so this adds zero SaaS bill.
--   - Owns the data fully (no third-party PII handling).
--   - Same RLS model as the rest of the app; you control retention.
--
-- This is a minimal-viable analytics design — for funnel analysis,
-- cohort retention, etc. later, this same table can be joined against
-- auth.users or copied to a warehouse.

create table if not exists public.analytics_events (
  id            bigserial primary key,
  occurred_at   timestamptz not null default now(),
  -- Anonymous device identifier (UUID generated client-side on first launch
  -- and persisted in AsyncStorage). Distinct from user_id so we can track
  -- pre-auth events too.
  device_id     text not null,
  user_id       uuid references auth.users(id) on delete set null,
  -- Event name in snake_case, e.g. 'resume_exported'
  event_name    text not null,
  -- App version that emitted the event ('1.7.0', etc.) for slicing.
  app_version   text,
  platform      text not null default 'android',
  -- Arbitrary payload (template_id, score, duration_ms, etc.)
  properties    jsonb not null default '{}'::jsonb
);

create index if not exists analytics_events_event_time_idx
  on public.analytics_events (event_name, occurred_at desc);

create index if not exists analytics_events_user_time_idx
  on public.analytics_events (user_id, occurred_at desc);

create index if not exists analytics_events_device_time_idx
  on public.analytics_events (device_id, occurred_at desc);

-- RLS: anyone can insert their own events (anonymous + authed), nobody can
-- read except service_role. We aggregate via the dashboard's SQL editor
-- using the service_role connection.
alter table public.analytics_events enable row level security;

create policy "anyone can insert analytics events"
  on public.analytics_events
  for insert
  with check (true);

create policy "no client reads"
  on public.analytics_events
  for select
  using (false);
