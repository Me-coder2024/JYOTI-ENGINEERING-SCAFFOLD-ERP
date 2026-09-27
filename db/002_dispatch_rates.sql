-- Existing dispatches keep NULL and their original effective-date rate history.
-- Every new dispatch saves its agreed rate, including an unchanged catalog default.
ALTER TABLE movements ADD COLUMN IF NOT EXISTS rental_rate numeric(12,4)
 CHECK (rental_rate IS NULL OR (type='DISPATCH' AND rental_rate>=0));
