-- Existing stock stays explicitly unassigned; no historical quantities change.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sites jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE movements ADD COLUMN IF NOT EXISTS site_name text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS movements_customer_site ON movements(customer_id,site_name);
