# Movement corrections and ledger exports

Implemented locally on 15 October 2026. Production migration/deployment has not been performed for this release.

## Owner corrections

Open Rental > Dispatch & Returns > Edit / Delete on a material line.
The owner can correct the date, quantity, return damage quantity, agreed dispatch rate, reference and notes.
The customer, material and movement type stay attached to their original identities.
Deletion requires confirmation and a reason; the complete original record is retained in immutable revision history.
Movement correction history lists the latest 500 corrections, including actor, reason and before/after values.

Updates run in one database transaction under the existing movement write lock.
They preserve the original batch commitment duration and saved damage price, rebuild FIFO return allocations, and reject negative stock or stale revisions.
Changes affecting finalized invoices are blocked. Affected draft invoices must be regenerated before finalization.
Deletion removes the active movement and its lot, after validating later returns; it does not erase its archived record.

## Party Ledger Module

Accounts > Party Ledger Module includes searchable account selection, date filters, opening balance, posted voucher entries, running balance, debit/credit totals and closing balance.
References open the existing voucher details.
PDF and Excel exports use the same report calculations as the screen.
Includes payments, receipts, journals and posted sales/purchase entries, including reversals.
Unposted rental invoices are not synthetic accounting entries: post their linked Sales voucher to include them in these books.

## Export formats

Rental > Settings > Ledger export formats, or Accounts > Export formats (owner only).
Material and party ledgers share a boxed heading and A4 table renderer.
Default heading: Jyoti Engineering & Scarfolding Pvt Ltd
Settings support heading, title, footer, text size, portrait/landscape, column order and optional type/reference columns.
Date, description and financial/quantity columns cannot be removed.
Settings apply to new PDF/Excel exports and are audited; they do not change business data.
Use a ledger's Print / PDF action to preview the saved layout.

## Database rollout

Apply db/005_movement_revisions_and_export_formats.sql through npm run db:migrate using the intended database environment before deploying this code.
The migration adds movements.revision and the rental_movement_revisions and rental_export_formats tables.
It does not remove or reset existing business records.
Only the local database was migrated during this implementation.

## Verification

- TypeScript and production build passed.
- 39 unit tests passed.
- Disposable PostgreSQL integration passed: owner-only edit/delete, stale edit conflicts, dependent-return protection, FIFO rebuilding, immutable history and finalized-invoice protection.
- Party ledger totals reconciled with posted voucher lines, including reversals.
- PDF/Excel generation and persisted format settings passed.
- HTTP checks passed: unauthenticated exports/settings rejected; staff edit/delete/settings/history access denied; owner history and authenticated PDF access allowed.
- Material and party PDF pages rendered with Poppler and visually inspected.
- Interactive browser automation was unavailable because its kernel assets could not be initialized; no browser-click verification is claimed.
