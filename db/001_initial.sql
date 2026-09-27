CREATE TABLE IF NOT EXISTS company (
 id integer PRIMARY KEY CHECK (id=1), name text NOT NULL, unit1 text NOT NULL DEFAULT '', unit2 text NOT NULL DEFAULT '', mobile text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '', website text NOT NULL DEFAULT '', gst_no text NOT NULL DEFAULT '', bank_name text NOT NULL DEFAULT '', bank_account text NOT NULL DEFAULT '', bank_ifsc text NOT NULL DEFAULT '', logo text NOT NULL DEFAULT '', gst_percent numeric(5,2) NOT NULL DEFAULT 18 CHECK(gst_percent BETWEEN 0 AND 100), terms text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS items (
 id uuid PRIMARY KEY, name text NOT NULL UNIQUE, hsn text NOT NULL DEFAULT '995457', category text NOT NULL DEFAULT 'Scaffolding', material_value numeric(14,2) NOT NULL CHECK(material_value>=0), weight numeric(12,3) NOT NULL DEFAULT 0 CHECK(weight>=0), active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS rates (
 id uuid PRIMARY KEY, item_id uuid NOT NULL REFERENCES items(id), effective_from date NOT NULL, rate numeric(12,4) NOT NULL CHECK(rate>=0), UNIQUE(item_id,effective_from)
);
CREATE TABLE IF NOT EXISTS customers (
 id uuid PRIMARY KEY, name text NOT NULL, address text NOT NULL DEFAULT '', gst_no text NOT NULL DEFAULT '', state_code text NOT NULL DEFAULT '24', contact_person text NOT NULL DEFAULT '', mobile text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '', locking_days integer NOT NULL DEFAULT 180 CHECK(locking_days>=0), deposit numeric(14,2) NOT NULL DEFAULT 0 CHECK(deposit>=0), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS movements (
 id uuid PRIMARY KEY, customer_id uuid NOT NULL REFERENCES customers(id), item_id uuid NOT NULL REFERENCES items(id), date date NOT NULL, type text NOT NULL CHECK(type IN ('DISPATCH','RETURN')), quantity integer NOT NULL CHECK(quantity>0), lock_until date, damaged_quantity integer NOT NULL DEFAULT 0 CHECK(damaged_quantity>=0 AND damaged_quantity<=quantity), damage_price numeric(14,2) NOT NULL DEFAULT 0 CHECK(damage_price>=0), note text NOT NULL DEFAULT '', created_by text NOT NULL DEFAULT 'Office', created_at timestamptz NOT NULL DEFAULT clock_timestamp(), CHECK(type='RETURN' OR damaged_quantity=0), CHECK((type='DISPATCH' AND lock_until IS NOT NULL) OR type='RETURN')
);
CREATE INDEX IF NOT EXISTS movements_timeline ON movements(customer_id,item_id,date,created_at);
CREATE TABLE IF NOT EXISTS dispatch_lots (
 id uuid PRIMARY KEY REFERENCES movements(id), customer_id uuid NOT NULL REFERENCES customers(id), item_id uuid NOT NULL REFERENCES items(id), original_quantity integer NOT NULL CHECK(original_quantity>0), dispatch_date date NOT NULL, lock_until date NOT NULL
);
CREATE TABLE IF NOT EXISTS return_allocations (
 return_id uuid NOT NULL REFERENCES movements(id), lot_id uuid NOT NULL REFERENCES dispatch_lots(id), quantity integer NOT NULL CHECK(quantity>0), return_date date NOT NULL, billing_date date NOT NULL, PRIMARY KEY(return_id,lot_id)
);
CREATE SEQUENCE IF NOT EXISTS invoice_number;
CREATE TABLE IF NOT EXISTS invoices (
 id uuid PRIMARY KEY, invoice_no text NOT NULL UNIQUE, customer_id uuid NOT NULL REFERENCES customers(id), period_start date NOT NULL, period_end date NOT NULL, status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','FINAL')), gst_percent numeric(5,2) NOT NULL CHECK(gst_percent BETWEEN 0 AND 100), snapshot jsonb NOT NULL, rental_total numeric(16,2) NOT NULL, damage_total numeric(16,2) NOT NULL, subtotal numeric(16,2) NOT NULL, gst_amount numeric(16,2) NOT NULL, grand_total numeric(16,2) NOT NULL, notes text NOT NULL DEFAULT '', generated_at timestamptz NOT NULL DEFAULT now(), finalized_at timestamptz, CHECK(period_end>=period_start)
);
CREATE INDEX IF NOT EXISTS invoices_period ON invoices(customer_id,period_start,period_end);
CREATE TABLE IF NOT EXISTS quotations (
 id uuid PRIMARY KEY, customer_id uuid NOT NULL REFERENCES customers(id), date date NOT NULL, snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_log (
 id bigserial PRIMARY KEY, action text NOT NULL, entity_id text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION protect_final_invoice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status='FINAL' THEN RAISE EXCEPTION 'Final invoices are immutable. Use a credit/debit note.'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS invoice_immutable ON invoices;
CREATE TRIGGER invoice_immutable BEFORE UPDATE OR DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION protect_final_invoice();
