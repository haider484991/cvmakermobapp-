-- ============================================================================
-- FreeResume AI — Analytics Queries
-- ============================================================================
--
-- Paste any of these into Supabase Studio's SQL editor to see KPIs in real
-- time. Most run in <100ms even at 10M+ events thanks to the indexes on
-- (event_name, occurred_at) and (device_id, occurred_at).
--
-- Sections:
--   1. Health check — is data flowing?
--   2. Acquisition + activity (DAU, MAU, new users)
--   3. Activation funnel (install → first export)
--   4. Engagement (which features get used)
--   5. AI usage and cost-relevant metrics
--   6. Templates — which ones win
--   7. Retention (D1, D7, D30 cohorts)
--   8. Review prompt funnel
--   9. Monetization (will activate post-v1.8 paywall)
--   10. Error / failure rates
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. HEALTH CHECK — is data actually flowing?
-- ----------------------------------------------------------------------------

-- Total events ever
select count(*) as total_events from analytics_events;

-- Events in the last hour (sanity check after deploy)
select count(*) as events_last_hour
from analytics_events
where occurred_at > now() - interval '1 hour';

-- Events per hour for the last 24 hours
select
  date_trunc('hour', occurred_at) as hour,
  count(*) as events
from analytics_events
where occurred_at > now() - interval '24 hours'
group by 1
order by 1 desc;

-- Event-type distribution (sanity that all expected events are firing)
select event_name, count(*) as n
from analytics_events
where occurred_at > now() - interval '7 days'
group by 1
order by n desc;


-- ----------------------------------------------------------------------------
-- 2. ACQUISITION + ACTIVITY
-- ----------------------------------------------------------------------------

-- Daily active devices (DAU) for the last 30 days
select
  date_trunc('day', occurred_at)::date as day,
  count(distinct device_id) as dau
from analytics_events
where occurred_at > now() - interval '30 days'
group by 1
order by 1 desc;

-- Monthly active devices (MAU) trailing
select count(distinct device_id) as mau_last_30d
from analytics_events
where occurred_at > now() - interval '30 days';

-- New devices per day (first time we ever saw them)
with first_seen as (
  select device_id, min(occurred_at) as first_at
  from analytics_events
  group by device_id
)
select
  date_trunc('day', first_at)::date as day,
  count(*) as new_devices
from first_seen
where first_at > now() - interval '30 days'
group by 1
order by 1 desc;

-- Stickiness ratio = DAU / MAU (healthy is > 0.20 for a productivity app)
with dau as (
  select count(distinct device_id) as v
  from analytics_events
  where occurred_at > now() - interval '24 hours'
),
mau as (
  select count(distinct device_id) as v
  from analytics_events
  where occurred_at > now() - interval '30 days'
)
select
  dau.v as dau,
  mau.v as mau,
  round((dau.v::numeric / nullif(mau.v, 0)) * 100, 1) as stickiness_pct
from dau, mau;


-- ----------------------------------------------------------------------------
-- 3. ACTIVATION FUNNEL — install → first PDF exported
-- ----------------------------------------------------------------------------

-- Funnel: app_opened → resume_created → resume_export_succeeded for users
-- whose first session was in the last 14 days.
with first_open as (
  select device_id, min(occurred_at) as first_at
  from analytics_events
  where event_name = 'app_opened'
  group by device_id
),
cohort as (
  select device_id, first_at
  from first_open
  where first_at > now() - interval '14 days'
),
created as (
  select distinct c.device_id
  from cohort c
  join analytics_events e using (device_id)
  where e.event_name = 'resume_created'
    and e.occurred_at >= c.first_at
),
exported as (
  select distinct c.device_id
  from cohort c
  join analytics_events e using (device_id)
  where e.event_name = 'resume_export_succeeded'
    and e.occurred_at >= c.first_at
)
select
  (select count(*) from cohort)       as installed,
  (select count(*) from created)      as created_a_resume,
  (select count(*) from exported)     as exported_pdf,
  round((select count(*) from created)::numeric  / nullif((select count(*) from cohort), 0) * 100, 1) as pct_created,
  round((select count(*) from exported)::numeric / nullif((select count(*) from cohort), 0) * 100, 1) as pct_exported;

-- Time from first open to first export (median) — how fast users find value
with first_open as (
  select device_id, min(occurred_at) as first_at
  from analytics_events where event_name = 'app_opened' group by device_id
),
first_export as (
  select device_id, min(occurred_at) as first_at
  from analytics_events where event_name = 'resume_export_succeeded' group by device_id
)
select
  percentile_cont(0.5) within group (order by
    extract(epoch from (fe.first_at - fo.first_at)) / 60.0
  ) as median_minutes_to_first_export
from first_open fo
join first_export fe using (device_id)
where fo.first_at > now() - interval '30 days';


-- ----------------------------------------------------------------------------
-- 4. ENGAGEMENT — which features get used?
-- ----------------------------------------------------------------------------

-- Top events in the last 7 days
select event_name, count(*) as n, count(distinct device_id) as unique_devices
from analytics_events
where occurred_at > now() - interval '7 days'
group by 1
order by n desc
limit 20;

-- Sessions per device (a "session" = a day with at least 1 app_opened event)
with sessions as (
  select device_id, count(distinct date_trunc('day', occurred_at)) as session_days
  from analytics_events
  where event_name = 'app_opened'
    and occurred_at > now() - interval '30 days'
  group by 1
)
select
  case
    when session_days = 1 then '1 day'
    when session_days between 2 and 3 then '2-3 days'
    when session_days between 4 and 7 then '4-7 days'
    when session_days between 8 and 14 then '8-14 days'
    else '15+ days'
  end as bucket,
  count(*) as devices
from sessions
group by 1
order by min(session_days);


-- ----------------------------------------------------------------------------
-- 5. AI USAGE — cost-relevant metrics for the OpenRouter bill
-- ----------------------------------------------------------------------------

-- AI calls per day by type
select
  date_trunc('day', occurred_at)::date as day,
  event_name,
  count(*) as calls
from analytics_events
where event_name in (
  'ai_score_requested',
  'ai_summary_generated',
  'ai_bullets_enhanced',
  'ai_skills_suggested',
  'resume_import_succeeded'
)
  and occurred_at > now() - interval '14 days'
group by 1, 2
order by 1 desc, 2;

-- AI score success rate
with attempts as (
  select count(*)::numeric as v
  from analytics_events
  where event_name = 'ai_score_requested'
    and occurred_at > now() - interval '7 days'
),
successes as (
  select count(*)::numeric as v
  from analytics_events
  where event_name = 'ai_score_completed'
    and occurred_at > now() - interval '7 days'
)
select
  attempts.v as attempts,
  successes.v as successes,
  round(successes.v / nullif(attempts.v, 0) * 100, 1) as success_pct
from attempts, successes;

-- AI score latency distribution (ms)
select
  percentile_cont(0.5)  within group (order by (properties->>'duration_ms')::int) as p50_ms,
  percentile_cont(0.95) within group (order by (properties->>'duration_ms')::int) as p95_ms,
  percentile_cont(0.99) within group (order by (properties->>'duration_ms')::int) as p99_ms
from analytics_events
where event_name = 'ai_score_completed'
  and occurred_at > now() - interval '7 days'
  and (properties->>'duration_ms') is not null;

-- Distribution of resume scores users actually get
select
  case
    when (properties->>'overall_score')::int >= 90 then '90-100 (excellent)'
    when (properties->>'overall_score')::int >= 75 then '75-89 (good)'
    when (properties->>'overall_score')::int >= 60 then '60-74 (room to grow)'
    when (properties->>'overall_score')::int >= 40 then '40-59 (needs work)'
    else '0-39 (early draft)'
  end as bucket,
  count(*) as n
from analytics_events
where event_name = 'ai_score_completed'
  and occurred_at > now() - interval '30 days'
group by 1
order by min((properties->>'overall_score')::int) desc;


-- ----------------------------------------------------------------------------
-- 6. TEMPLATES — which ones actually win
-- ----------------------------------------------------------------------------

-- Top templates by selection count (drives v1.8 paywall decisions)
select
  properties->>'template_name' as template_name,
  properties->>'category'      as category,
  (properties->>'is_premium')::boolean as is_premium,
  count(*) as selections,
  count(distinct device_id) as unique_devices
from analytics_events
where event_name = 'template_selected'
  and occurred_at > now() - interval '30 days'
group by 1, 2, 3
order by selections desc
limit 25;

-- Top templates by *export* (more valuable than just selecting)
select
  properties->>'template_name' as template_name,
  properties->>'paper_size'    as paper_size,
  count(*) as exports,
  count(distinct device_id) as unique_exporters
from analytics_events
where event_name = 'resume_export_succeeded'
  and occurred_at > now() - interval '30 days'
group by 1, 2
order by exports desc
limit 25;


-- ----------------------------------------------------------------------------
-- 7. RETENTION — cohort table for D1, D7, D14, D30
-- ----------------------------------------------------------------------------

with first_seen as (
  select device_id, date_trunc('day', min(occurred_at))::date as install_day
  from analytics_events
  group by device_id
),
activity as (
  select distinct device_id, date_trunc('day', occurred_at)::date as active_day
  from analytics_events
),
cohort as (
  select
    fs.install_day,
    count(distinct fs.device_id) as cohort_size,
    count(distinct case when a.active_day = fs.install_day + 1  then a.device_id end) as d1,
    count(distinct case when a.active_day = fs.install_day + 7  then a.device_id end) as d7,
    count(distinct case when a.active_day = fs.install_day + 14 then a.device_id end) as d14,
    count(distinct case when a.active_day = fs.install_day + 30 then a.device_id end) as d30
  from first_seen fs
  left join activity a on a.device_id = fs.device_id
  where fs.install_day > now() - interval '60 days'
  group by fs.install_day
)
select
  install_day,
  cohort_size,
  round(d1::numeric  / nullif(cohort_size, 0) * 100, 1) as d1_pct,
  round(d7::numeric  / nullif(cohort_size, 0) * 100, 1) as d7_pct,
  round(d14::numeric / nullif(cohort_size, 0) * 100, 1) as d14_pct,
  round(d30::numeric / nullif(cohort_size, 0) * 100, 1) as d30_pct
from cohort
order by install_day desc;


-- ----------------------------------------------------------------------------
-- 8. REVIEW PROMPT FUNNEL — is the v1.6 review system working?
-- ----------------------------------------------------------------------------

with stats as (
  select
    sum(case when event_name = 'review_prompt_shown'    then 1 else 0 end)::numeric as shown,
    sum(case when event_name = 'review_prompt_accepted' then 1 else 0 end)::numeric as accepted,
    sum(case when event_name = 'review_prompt_declined' then 1 else 0 end)::numeric as declined
  from analytics_events
  where occurred_at > now() - interval '30 days'
)
select
  shown,
  accepted,
  declined,
  round(accepted / nullif(shown, 0) * 100, 1) as love_rate_pct,
  round(declined / nullif(shown, 0) * 100, 1) as feedback_rate_pct
from stats;


-- ----------------------------------------------------------------------------
-- 9. MONETIZATION — light up after v1.8 paywall ships
-- ----------------------------------------------------------------------------

-- Paywall → purchase funnel
with stats as (
  select
    sum(case when event_name = 'paywall_shown'      then 1 else 0 end)::numeric as shown,
    sum(case when event_name = 'purchase_initiated' then 1 else 0 end)::numeric as initiated,
    sum(case when event_name = 'purchase_completed' then 1 else 0 end)::numeric as completed,
    sum(case when event_name = 'purchase_failed'    then 1 else 0 end)::numeric as failed
  from analytics_events
  where occurred_at > now() - interval '30 days'
)
select
  shown,
  initiated,
  completed,
  failed,
  round(initiated / nullif(shown, 0) * 100, 1)     as tap_through_pct,
  round(completed / nullif(initiated, 0) * 100, 1) as purchase_pct
from stats;


-- ----------------------------------------------------------------------------
-- 10. FAILURE RATES — catch regressions before they hit reviews
-- ----------------------------------------------------------------------------

-- Export failure rate by day
with daily as (
  select
    date_trunc('day', occurred_at)::date as day,
    sum(case when event_name = 'resume_export_succeeded' then 1 else 0 end)::numeric as ok,
    sum(case when event_name = 'resume_export_failed'    then 1 else 0 end)::numeric as fail
  from analytics_events
  where event_name in ('resume_export_succeeded','resume_export_failed')
    and occurred_at > now() - interval '14 days'
  group by 1
)
select
  day,
  ok,
  fail,
  round(fail / nullif(ok + fail, 0) * 100, 1) as fail_pct
from daily
order by day desc;

-- AI score failure rate
with daily as (
  select
    date_trunc('day', occurred_at)::date as day,
    sum(case when event_name = 'ai_score_completed' then 1 else 0 end)::numeric as ok,
    sum(case when event_name = 'ai_score_failed'    then 1 else 0 end)::numeric as fail
  from analytics_events
  where event_name in ('ai_score_completed','ai_score_failed')
    and occurred_at > now() - interval '14 days'
  group by 1
)
select day, ok, fail, round(fail / nullif(ok + fail, 0) * 100, 1) as fail_pct
from daily order by day desc;

-- Top failure messages (helps you fix the most common issues)
select
  properties->>'error' as error,
  count(*) as n
from analytics_events
where event_name in (
  'resume_export_failed',
  'resume_import_failed',
  'ai_score_failed',
  'purchase_failed'
)
  and occurred_at > now() - interval '14 days'
  and properties->>'error' is not null
group by 1
order by n desc
limit 20;
