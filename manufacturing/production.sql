-- Manufacturing-only extension. Existing rental tables are never altered.
CREATE TABLE IF NOT EXISTS mfg_boms (
 id uuid PRIMARY KEY, finished_good_id uuid NOT NULL REFERENCES mfg_finished_goods(id),
 revision integer NOT NULL CHECK(revision>0), product_name text NOT NULL, lines jsonb NOT NULL,
 notes text NOT NULL DEFAULT '', is_active boolean NOT NULL DEFAULT true,
 created_by uuid NOT NULL REFERENCES erp_users(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(finished_good_id,revision)
);
CREATE UNIQUE INDEX IF NOT EXISTS mfg_bom_one_active ON mfg_boms(finished_good_id) WHERE is_active;
CREATE SEQUENCE IF NOT EXISTS mfg_work_order_number;
CREATE TABLE IF NOT EXISTS mfg_work_orders (
 id uuid PRIMARY KEY, work_order_no text NOT NULL UNIQUE, bom_id uuid NOT NULL REFERENCES mfg_boms(id),
 finished_good_id uuid NOT NULL REFERENCES mfg_finished_goods(id), product_name text NOT NULL,
 bom_snapshot jsonb NOT NULL, quantity integer NOT NULL CHECK(quantity>0), completed_quantity integer NOT NULL DEFAULT 0 CHECK(completed_quantity>=0 AND completed_quantity<=quantity),
 date date NOT NULL, due_date date, notes text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','RELEASED','IN_PROGRESS','COMPLETED','CANCELLED')),
 created_by uuid NOT NULL REFERENCES erp_users(id), created_at timestamptz NOT NULL DEFAULT now(), CHECK(due_date IS NULL OR due_date>=date)
);
CREATE TABLE IF NOT EXISTS mfg_production_entries (
 id uuid PRIMARY KEY, work_order_id uuid NOT NULL REFERENCES mfg_work_orders(id),
 date date NOT NULL, quantity integer NOT NULL CHECK(quantity>0), consumption jsonb NOT NULL,
 labour_cost numeric(16,2) NOT NULL DEFAULT 0 CHECK(labour_cost>=0), notes text NOT NULL,
 request_snapshot jsonb NOT NULL, created_by uuid NOT NULL REFERENCES erp_users(id), created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE mfg_stock_journal DROP CONSTRAINT IF EXISTS mfg_stock_journal_source_type_check;
ALTER TABLE mfg_stock_journal ADD CONSTRAINT mfg_stock_journal_source_type_check CHECK(source_type IN ('RECEIPT','DISPATCH','OPENING','PRODUCTION_INPUT','PRODUCTION_OUTPUT'));
DROP TRIGGER IF EXISTS mfg_production_immutable ON mfg_production_entries;
CREATE TRIGGER mfg_production_immutable BEFORE UPDATE OR DELETE ON mfg_production_entries FOR EACH ROW EXECUTE FUNCTION mfg_prevent_document_change();
DROP TRIGGER IF EXISTS mfg_journal_immutable ON mfg_stock_journal;
CREATE TRIGGER mfg_journal_immutable BEFORE UPDATE OR DELETE ON mfg_stock_journal FOR EACH ROW EXECUTE FUNCTION mfg_prevent_document_change();
CREATE INDEX IF NOT EXISTS mfg_production_work_order ON mfg_production_entries(work_order_id);
