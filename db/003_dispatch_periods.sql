-- End dates belong to individual dispatches; a planned end is not a stock return.
ALTER TABLE movements ADD COLUMN IF NOT EXISTS end_date date
 CHECK (end_date IS NULL OR (type='DISPATCH' AND end_date>=date));

-- Auditable rental periods, not additional outward stock movements.
CREATE TABLE IF NOT EXISTS rental_periods (
 id text PRIMARY KEY,
 lot_id uuid NOT NULL REFERENCES dispatch_lots(id),
 customer_id uuid NOT NULL REFERENCES customers(id),
 item_id uuid NOT NULL REFERENCES items(id),
 parent_id text,
 trigger_return_id uuid REFERENCES movements(id),
 start_date date NOT NULL,
 expected_end_date date,
 closed_on date,
 opening_quantity integer NOT NULL CHECK(opening_quantity>0),
 rental_rate numeric(12,4) CHECK(rental_rate>=0),
 lock_until date NOT NULL,
 CHECK(closed_on IS NULL OR closed_on>=start_date)
);
CREATE INDEX IF NOT EXISTS rental_periods_customer ON rental_periods(customer_id,item_id,start_date);
