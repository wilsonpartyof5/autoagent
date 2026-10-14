-- MarketCheck API usage tracking table
-- Stores monthly call counts so we can monitor free-tier (500 calls/month) usage.

CREATE TABLE IF NOT EXISTS mc_api_usage (
  month       TEXT        NOT NULL,          -- "YYYY-MM" e.g. "2026-04"
  call_type   TEXT        NOT NULL,          -- "search" | "detail"
  call_count  INTEGER     NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (month, call_type)
);

-- Only service role can read/write (no user-level RLS needed)
ALTER TABLE mc_api_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON mc_api_usage
  USING (auth.role() = 'service_role');

-- Increment function called via RPC from the API routes
CREATE OR REPLACE FUNCTION mc_usage_increment(p_month TEXT, p_call_type TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO mc_api_usage (month, call_type, call_count, updated_at)
  VALUES (p_month, p_call_type, 1, NOW())
  ON CONFLICT (month, call_type)
  DO UPDATE SET
    call_count = mc_api_usage.call_count + 1,
    updated_at = NOW();
END;
$$;

-- Convenience view: total calls per month across all types
CREATE OR REPLACE VIEW mc_api_usage_summary AS
SELECT
  month,
  SUM(call_count)                                          AS total_calls,
  SUM(CASE WHEN call_type = 'search' THEN call_count END) AS search_calls,
  SUM(CASE WHEN call_type = 'detail' THEN call_count END) AS detail_calls,
  MAX(updated_at)                                          AS last_call_at
FROM mc_api_usage
GROUP BY month
ORDER BY month DESC;
