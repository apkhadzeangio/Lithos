CREATE TABLE IF NOT EXISTS exterior_leads (
  reference TEXT PRIMARY KEY,
  contact TEXT NOT NULL,
  preferences TEXT NOT NULL,
  original_key TEXT NOT NULL,
  generated_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  consent_version TEXT NOT NULL,
  ready INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS exterior_leads_expiry ON exterior_leads(expires_at);
