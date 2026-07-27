-- Migration scrubbed for security.
--
-- The original version of this file seeded an `app_secrets` table with
-- plaintext XAI and Tavily API keys. Those keys were exposed via version
-- history and must be considered compromised — rotate them at the provider.
--
-- Secrets are now read from Edge Function environment variables
-- (XAI_API_KEY, TAVILY_API_KEY), never persisted in the database.
-- The app_secrets table is not needed and is intentionally not created here.
SELECT 1;
