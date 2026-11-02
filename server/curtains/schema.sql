CREATE TABLE IF NOT EXISTS curtain_orders (
 reference TEXT PRIMARY KEY, contact TEXT NOT NULL, preferences TEXT NOT NULL,
 fabric TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 original_key TEXT NOT NULL, preview_key TEXT NOT NULL, status TEXT NOT NULL,
 notes TEXT NOT NULL DEFAULT '', ready INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS curtain_orders_expiry ON curtain_orders(expires_at);
