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
CREATE TABLE IF NOT EXISTS mfg_suppliers (id uuid PRIMARY KEY,name text NOT NULL,address text NOT NULL DEFAULT '',gst_no text NOT NULL DEFAULT '',contact text NOT NULL DEFAULT '',mobile text NOT NULL DEFAULT '',is_active boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS mfg_customers (id uuid PRIMARY KEY,name text NOT NULL,address text NOT NULL DEFAULT '',gst_no text NOT NULL DEFAULT '',contact text NOT NULL DEFAULT '',mobile text NOT NULL DEFAULT '',is_active boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS mfg_raw_materials (id uuid PRIMARY KEY,name text NOT NULL UNIQUE,unit text NOT NULL CHECK(unit IN ('kg','pc','mtr')),current_stock_qty numeric(16,3) NOT NULL DEFAULT 0 CHECK(current_stock_qty>=0),low_stock_qty numeric(16,3) NOT NULL DEFAULT 0 CHECK(low_stock_qty>=0),is_active boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS mfg_finished_goods (id uuid PRIMARY KEY,name text NOT NULL UNIQUE,hsn_code text NOT NULL DEFAULT '',sale_rate numeric(14,4) NOT NULL CHECK(sale_rate>=0),unit_weight numeric(14,3) NOT NULL DEFAULT 0 CHECK(unit_weight>=0),current_stock_qty numeric(16,3) NOT NULL DEFAULT 0 CHECK(current_stock_qty>=0),is_active boolean NOT NULL DEFAULT true);
CREATE SEQUENCE IF NOT EXISTS mfg_po_number;
CREATE SEQUENCE IF NOT EXISTS mfg_so_number;
CREATE SEQUENCE IF NOT EXISTS mfg_receipt_number;
CREATE SEQUENCE IF NOT EXISTS mfg_dispatch_number;
CREATE SEQUENCE IF NOT EXISTS mfg_invoice_number;
CREATE TABLE IF NOT EXISTS mfg_purchase_orders (
 id uuid PRIMARY KEY,po_no text NOT NULL UNIQUE,supplier_id uuid NOT NULL REFERENCES mfg_suppliers(id),date date NOT NULL,
 status text NOT NULL CHECK(status IN ('DRAFT','SENT','PARTIALLY_RECEIVED','RECEIVED','CANCELLED')),
 lines jsonb NOT NULL,party_snapshot jsonb NOT NULL,total_amount numeric(18,2) NOT NULL CHECK(total_amount>=0),notes text NOT NULL DEFAULT '',created_by uuid NOT NULL REFERENCES erp_users(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mfg_goods_receipts (id uuid PRIMARY KEY,receipt_no text NOT NULL UNIQUE,purchase_order_id uuid NOT NULL REFERENCES mfg_purchase_orders(id),date date NOT NULL,lines jsonb NOT NULL,notes text NOT NULL DEFAULT '',created_by uuid NOT NULL REFERENCES erp_users(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS mfg_sales_orders (
 id uuid PRIMARY KEY,so_no text NOT NULL UNIQUE,customer_id uuid NOT NULL REFERENCES mfg_customers(id),date date NOT NULL,
 status text NOT NULL CHECK(status IN ('DRAFT','CONFIRMED','PARTIALLY_DISPATCHED','DISPATCHED','INVOICED','CANCELLED')),
 lines jsonb NOT NULL,party_snapshot jsonb NOT NULL,total_amount numeric(18,2) NOT NULL CHECK(total_amount>=0),notes text NOT NULL DEFAULT '',created_by uuid NOT NULL REFERENCES erp_users(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mfg_dispatch_notes (id uuid PRIMARY KEY,dispatch_no text NOT NULL UNIQUE,sales_order_id uuid NOT NULL REFERENCES mfg_sales_orders(id),date date NOT NULL,lines jsonb NOT NULL,notes text NOT NULL DEFAULT '',created_by uuid NOT NULL REFERENCES erp_users(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS mfg_opening_stock (id uuid PRIMARY KEY,finished_good_id uuid NOT NULL UNIQUE REFERENCES mfg_finished_goods(id),date date NOT NULL,quantity numeric(16,3) NOT NULL CHECK(quantity>0),notes text NOT NULL,created_by uuid NOT NULL REFERENCES erp_users(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS mfg_stock_journal (id uuid PRIMARY KEY,kind text NOT NULL CHECK(kind IN ('RAW','FINISHED')),item_id uuid NOT NULL,date date NOT NULL,quantity numeric(16,3) NOT NULL CHECK(quantity<>0),source_id uuid NOT NULL,source_type text NOT NULL CHECK(source_type IN ('RECEIPT','DISPATCH','OPENING')),created_by uuid NOT NULL REFERENCES erp_users(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS mfg_journal_item ON mfg_stock_journal(kind,item_id,date);
CREATE TABLE IF NOT EXISTS mfg_sales_invoices (
 id uuid PRIMARY KEY,invoice_no text NOT NULL UNIQUE,sales_order_id uuid NOT NULL UNIQUE REFERENCES mfg_sales_orders(id),customer_id uuid NOT NULL REFERENCES mfg_customers(id),date date NOT NULL,
 status text NOT NULL DEFAULT 'FINAL' CHECK(status='FINAL'),snapshot jsonb NOT NULL,subtotal numeric(18,2) NOT NULL,gst_percent numeric(5,2) NOT NULL CHECK(gst_percent BETWEEN 0 AND 100),gst_amount numeric(18,2) NOT NULL,grand_total numeric(18,2) NOT NULL,created_by uuid NOT NULL REFERENCES erp_users(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION mfg_prevent_document_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Posted manufacturing documents are immutable.'; END $$;
DROP TRIGGER IF EXISTS mfg_invoice_immutable ON mfg_sales_invoices;
CREATE TRIGGER mfg_invoice_immutable BEFORE UPDATE OR DELETE ON mfg_sales_invoices FOR EACH ROW EXECUTE FUNCTION mfg_prevent_document_change();
DROP TRIGGER IF EXISTS mfg_receipt_immutable ON mfg_goods_receipts;
CREATE TRIGGER mfg_receipt_immutable BEFORE UPDATE OR DELETE ON mfg_goods_receipts FOR EACH ROW EXECUTE FUNCTION mfg_prevent_document_change();
DROP TRIGGER IF EXISTS mfg_dispatch_immutable ON mfg_dispatch_notes;
CREATE TRIGGER mfg_dispatch_immutable BEFORE UPDATE OR DELETE ON mfg_dispatch_notes FOR EACH ROW EXECUTE FUNCTION mfg_prevent_document_change();
DROP TRIGGER IF EXISTS mfg_opening_immutable ON mfg_opening_stock;
CREATE TRIGGER mfg_opening_immutable BEFORE UPDATE OR DELETE ON mfg_opening_stock FOR EACH ROW EXECUTE FUNCTION mfg_prevent_document_change();
