-- Job alerts on Cloudflare D1.
--
-- Stores a SUBSCRIPTION, not a resume: what to search for, where, and which
-- keywords make a posting relevant — the same thing any job board keeps when
-- you save a search. No name, contact details, employers, dates or resume text
-- ever reach this database, which is what keeps the app's Play data-safety
-- declaration ("resume data stays on your device by default") true.
--
-- Identity is the Expo push token. There is no account: the app works without
-- signing in, and requiring one just to receive alerts would kill the feature.
-- The token is long, opaque and device-scoped, so it is both the address and
-- the bearer secret. D1 is never exposed publicly — only the Worker touches it.

CREATE TABLE IF NOT EXISTS subscriptions (
  push_token      TEXT PRIMARY KEY,
  query           TEXT NOT NULL,
  location        TEXT NOT NULL DEFAULT '',
  industry        TEXT,
  -- JSON array. D1 is SQLite; no native array type.
  skills          TEXT NOT NULL DEFAULT '[]',
  min_score       INTEGER NOT NULL DEFAULT 70,
  locale          TEXT NOT NULL DEFAULT 'en',
  platform        TEXT,
  app_version     TEXT,
  enabled         INTEGER NOT NULL DEFAULT 1,
  -- JSON array of job ids already pushed, so an alert never repeats itself.
  seen_job_ids    TEXT NOT NULL DEFAULT '[]',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  last_checked_at TEXT,
  last_sent_at    TEXT,
  -- Expo reports DeviceNotRegistered when an app is uninstalled. Three strikes
  -- and we stop, so a dead device isn't pushed at forever.
  failure_count   INTEGER NOT NULL DEFAULT 0
);

-- The cron pass selects enabled rows not checked recently.
CREATE INDEX IF NOT EXISTS subscriptions_due
  ON subscriptions (enabled, last_checked_at);
