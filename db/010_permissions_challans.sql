ALTER TABLE movements ADD COLUMN contact_phone text NOT NULL DEFAULT '';
ALTER TABLE movements ADD COLUMN delivery_site text NOT NULL DEFAULT '';
ALTER TABLE movements ADD COLUMN stock_type text NOT NULL DEFAULT 'Rent' CHECK(stock_type IN ('Rent','New Rent'));
CREATE TABLE erp_roles(id uuid PRIMARY KEY, name text NOT NULL UNIQUE, permissions jsonb NOT NULL DEFAULT '{}');
ALTER TABLE erp_users ADD COLUMN role_id uuid REFERENCES erp_roles(id);
ALTER TABLE erp_users ADD COLUMN permission_overrides jsonb NOT NULL DEFAULT '{}';
ALTER TABLE erp_users ADD COLUMN manage_users boolean NOT NULL DEFAULT false;

-- ERP roles are server-only, matching the existing production ERP tables.
ALTER TABLE erp_roles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
  REVOKE ALL ON erp_roles FROM anon;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
  REVOKE ALL ON erp_roles FROM authenticated;
 END IF;
END $$;
