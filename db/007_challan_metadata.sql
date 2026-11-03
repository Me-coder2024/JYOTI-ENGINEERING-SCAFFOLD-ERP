-- Additive metadata: existing movement identities and references are preserved.
CREATE SEQUENCE IF NOT EXISTS rental_challan_number_seq;
ALTER TABLE movements ADD COLUMN IF NOT EXISTS challan_id uuid;
ALTER TABLE movements ADD COLUMN IF NOT EXISTS vehicle_no text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS movements_customer_reference ON movements(customer_id, reference, date);
CREATE INDEX IF NOT EXISTS movements_challan_id ON movements(challan_id);
