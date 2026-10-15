ALTER TABLE movements ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS rental_movement_revisions (
 id bigserial PRIMARY KEY,
 movement_id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES erp_users(id),
 action text NOT NULL CHECK(action IN ('EDIT','DELETE')),
 reason text NOT NULL,
 before_record jsonb NOT NULL,
 after_record jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION protect_movement_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Movement revision history is immutable.'; END $$;
CREATE TRIGGER movement_revision_immutable BEFORE UPDATE OR DELETE ON rental_movement_revisions FOR EACH ROW EXECUTE FUNCTION protect_movement_revision();
CREATE TABLE IF NOT EXISTS rental_export_formats (
 module text PRIMARY KEY CHECK(module IN ('material','party')),
 settings jsonb NOT NULL,
 updated_by uuid REFERENCES erp_users(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
