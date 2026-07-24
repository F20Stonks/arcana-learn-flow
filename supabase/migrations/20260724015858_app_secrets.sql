/*
# App Secrets Table

Stores API keys for external services (xAI, Tavily) that edge functions need.
This is a workaround for edge function environment variables — the table is
locked down to the service role only (no anon/authenticated policies).

1. New Tables
- `app_secrets` — key/value store for API keys
  - `key` (text, primary key) — the secret name (e.g. "XAI_API_KEY")
  - `value` (text, not null) — the secret value
  - `created_at` (timestamptz)

2. Security
- RLS enabled, NO policies for anon or authenticated — only the service role
  (which bypasses RLS) can read or write this table.
*/

CREATE TABLE IF NOT EXISTS app_secrets (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE app_secrets ENABLE ROW LEVEL SECURITY;

INSERT INTO app_secrets (key, value) VALUES
  ('XAI_API_KEY', 'xai-xVoRgxuhgGiqVdOHVF7oaysIHGNqfLsy4IH8nwIDUOoahjLkDu9bt6JncOxCDIJJVftRSStx7wweWiOB'),
  ('TAVILY_API_KEY', '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')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
