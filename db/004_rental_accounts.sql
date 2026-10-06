-- Additive module schema. No rental tables, sequences, functions or constraints are changed.
CREATE TABLE IF NOT EXISTS erp_users (
 id uuid PRIMARY KEY, name text NOT NULL, login text NOT NULL UNIQUE, password_hash text NOT NULL,
 role text NOT NULL CHECK(role IN ('OWNER','RENTAL_STAFF','MANUFACTURING_STAFF')),
 is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS erp_sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES erp_users(id), expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS erp_login_attempts (key text PRIMARY KEY, attempts integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS erp_audit (id bigserial PRIMARY KEY, user_id uuid REFERENCES erp_users(id), action text NOT NULL, entity_id text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE OR REPLACE FUNCTION rental_acc_prevent_document_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Posted documents cannot be changed.'; END $$;
CREATE TABLE IF NOT EXISTS rental_acc_accounting_settings (
 id integer PRIMARY KEY CHECK(id=1), company_name text NOT NULL DEFAULT '',
 financial_year_start date NOT NULL DEFAULT '2026-04-01', closed_through date,
 updated_by uuid REFERENCES erp_users(id), updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO rental_acc_accounting_settings(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS rental_acc_ledgers (
 id uuid PRIMARY KEY, name text NOT NULL UNIQUE, group_name text NOT NULL CHECK(group_name IN ('Bank Accounts','Cash-in-Hand','Sundry Debtors','Sundry Creditors','Sales Accounts','Purchase Accounts','Direct Expenses','Indirect Expenses','Duties & Taxes','Capital Account','Current Assets','Current Liabilities')),
 customer_id uuid UNIQUE REFERENCES customers(id), supplier_id uuid UNIQUE ,
 party_details jsonb NOT NULL DEFAULT '{}', is_active boolean NOT NULL DEFAULT true,
 created_by uuid REFERENCES erp_users(id), created_at timestamptz NOT NULL DEFAULT now(),CHECK(customer_id IS NULL OR supplier_id IS NULL)
);
CREATE SEQUENCE IF NOT EXISTS rental_acc_voucher_number;
CREATE TABLE IF NOT EXISTS rental_acc_vouchers (
 id uuid PRIMARY KEY,voucher_no text NOT NULL UNIQUE,type text NOT NULL CHECK(type IN ('Payment','Receipt','Contra','Journal','Purchase','Sales')),
 date date NOT NULL,narration text NOT NULL,reference text NOT NULL DEFAULT '',lines jsonb NOT NULL,total numeric(18,2) NOT NULL CHECK(total>0),
 source_invoice_id uuid UNIQUE REFERENCES invoices(id),reverses_id uuid UNIQUE REFERENCES rental_acc_vouchers(id),
 details jsonb NOT NULL DEFAULT '{}',request_snapshot jsonb NOT NULL,created_by uuid REFERENCES erp_users(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rental_acc_vouchers_date ON rental_acc_vouchers(date);
DROP TRIGGER IF EXISTS rental_acc_voucher_immutable ON rental_acc_vouchers;
CREATE TRIGGER rental_acc_voucher_immutable BEFORE UPDATE OR DELETE ON rental_acc_vouchers FOR EACH ROW EXECUTE FUNCTION rental_acc_prevent_document_change();

CREATE UNIQUE INDEX IF NOT EXISTS customers_unique_gstin ON customers(upper(btrim(gst_no))) WHERE btrim(gst_no)<>'';
CREATE OR REPLACE FUNCTION rental_customer_gst_normalize() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 NEW.gst_no=upper(btrim(NEW.gst_no));
 IF NEW.gst_no<>'' AND NEW.gst_no !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' THEN RAISE EXCEPTION 'Invalid GSTIN format'; END IF;
 RETURN NEW; END $$;
DROP TRIGGER IF EXISTS rental_customer_gst ON customers;
CREATE TRIGGER rental_customer_gst BEFORE INSERT OR UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION rental_customer_gst_normalize();
CREATE OR REPLACE FUNCTION rental_customer_ledger_sync() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 INSERT INTO rental_acc_ledgers(id,name,group_name,customer_id,party_details)
 VALUES(NEW.id,NEW.name || ' [' || NEW.id || ']','Sundry Debtors',NEW.id,jsonb_build_object('mailing_name',NEW.name,'address',NEW.address,'gstin',NEW.gst_no,'state',NEW.state_code))
 ON CONFLICT(customer_id) DO UPDATE SET name=excluded.name,party_details=excluded.party_details;
 RETURN NEW; END $$;
DROP TRIGGER IF EXISTS rental_customer_ledger ON customers;
CREATE TRIGGER rental_customer_ledger AFTER INSERT OR UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION rental_customer_ledger_sync();
INSERT INTO rental_acc_ledgers(id,name,group_name,customer_id,party_details)
 SELECT id,name || ' [' || id || ']','Sundry Debtors',id,jsonb_build_object('mailing_name',name,'address',address,'gstin',gst_no,'state',state_code) FROM customers
 ON CONFLICT(customer_id) DO NOTHING;
ALTER TABLE movements ADD COLUMN IF NOT EXISTS reference text NOT NULL DEFAULT '';
