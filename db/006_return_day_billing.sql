-- Return day is chargeable; lock_until already denotes the first unlocked day.
-- Final invoice snapshots are intentionally untouched.
UPDATE return_allocations a
SET billing_date = GREATEST(a.return_date + 1, l.lock_until)
FROM dispatch_lots l
WHERE l.id = a.lot_id AND a.billing_date <> GREATEST(a.return_date + 1, l.lock_until);
