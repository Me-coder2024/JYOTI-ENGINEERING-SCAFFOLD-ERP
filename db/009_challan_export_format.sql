-- Extend the existing export settings without modifying transactions or invoices.
ALTER TABLE rental_export_formats DROP CONSTRAINT IF EXISTS rental_export_formats_module_check;
ALTER TABLE rental_export_formats ADD CONSTRAINT rental_export_formats_module_check
 CHECK (module IN ('material','party','challan'));
