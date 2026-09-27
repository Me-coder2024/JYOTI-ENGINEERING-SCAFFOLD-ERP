CREATE TABLE IF NOT EXISTS mfg_accounting_settings (
 id integer PRIMARY KEY CHECK(id=1), company_name text NOT NULL DEFAULT '',
 financial_year_start date NOT NULL DEFAULT '2026-04-01', closed_through date,
 updated_by uuid REFERENCES erp_users(id), updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO mfg_accounting_settings(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS mfg_ledgers (
 id uuid PRIMARY KEY, name text NOT NULL UNIQUE, group_name text NOT NULL CHECK(group_name IN ('Bank Accounts','Cash-in-Hand','Sundry Debtors','Sundry Creditors','Sales Accounts','Purchase Accounts','Direct Expenses','Indirect Expenses','Duties & Taxes','Capital Account','Current Assets','Current Liabilities')),
 customer_id uuid UNIQUE REFERENCES mfg_customers(id), supplier_id uuid UNIQUE REFERENCES mfg_suppliers(id),
 party_details jsonb NOT NULL DEFAULT '{}', is_active boolean NOT NULL DEFAULT true,
 created_by uuid NOT NULL REFERENCES erp_users(id), created_at timestamptz NOT NULL DEFAULT now(),CHECK(customer_id IS NULL OR supplier_id IS NULL)
);
CREATE SEQUENCE IF NOT EXISTS mfg_voucher_number;
CREATE TABLE IF NOT EXISTS mfg_vouchers (
 id uuid PRIMARY KEY,voucher_no text NOT NULL UNIQUE,type text NOT NULL CHECK(type IN ('Payment','Receipt','Contra','Journal','Purchase','Sales')),
 date date NOT NULL,narration text NOT NULL,reference text NOT NULL DEFAULT '',lines jsonb NOT NULL,total numeric(18,2) NOT NULL CHECK(total>0),
 source_invoice_id uuid UNIQUE REFERENCES mfg_sales_invoices(id),reverses_id uuid UNIQUE REFERENCES mfg_vouchers(id),
 details jsonb NOT NULL DEFAULT '{}',request_snapshot jsonb NOT NULL,created_by uuid NOT NULL REFERENCES erp_users(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mfg_vouchers_date ON mfg_vouchers(date);
DROP TRIGGER IF EXISTS mfg_voucher_immutable ON mfg_vouchers;
CREATE TRIGGER mfg_voucher_immutable BEFORE UPDATE OR DELETE ON mfg_vouchers FOR EACH ROW EXECUTE FUNCTION mfg_prevent_document_change();
