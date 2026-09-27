# Jyoti Rental Desk

A full-stack **Next.js 16 + React + TypeScript + PostgreSQL** application for Jyoti Engineering & Jyoti Scaffold Pvt Ltd. The backend uses parameterized SQL through `pg`; there is no SQLite or browser-storage substitute.

## Run on this Windows computer

The dependencies, local PostgreSQL cluster, schema, catalog and `.env` have already been initialized. The local app is at **http://127.0.0.1:3000** while both processes run.

Initial office password: **`your configured office password`**. Change `OFFICE_PASSWORD` in `.env` before sharing access. The session secret was randomly generated and is not committed.

Open two terminals in this project folder:

```powershell
# Terminal 1: keep running
npm run db:local
```

```powershell
# Terminal 2: keep running
npm run dev
```

Do not start duplicate database processes. The local PostgreSQL helper listens only on 127.0.0.1:54329 and persists data under `.postgres/`. Stop it with Ctrl+C for a clean shutdown.

## Fresh installation / existing PostgreSQL server

Requires Node.js 22.14+ and npm. Use PostgreSQL 17+ or the bundled development database.

1. Run `npm ci`.
2. Copy `.env.example` to `.env`; set `DATABASE_URL`, `OFFICE_PASSWORD`, and a random `SESSION_SECRET` of at least 32 characters.
3. Start PostgreSQL using `npm run db:local`, **or** `docker compose up -d`, **or** point `DATABASE_URL` at your own server. Use only one local database option at a time.
4. Run `npm run db:migrate` and `npm run db:seed`.
5. Run `npm run dev`. For production, run `npm run build` then `npm start` behind an HTTPS reverse proxy. The app binds to localhost by default.

The migration and catalog seed are repeatable. Seeding does not invent customers, transactions, GST registration or rate-change dates. Historical baseline rates from the brief start at 2000-01-01; add your actual revised rates with their actual effective dates.

## Office workflow

1. **Settings:** verify both unit addresses, GSTIN, bank account, logo and document terms. The provided account number starts with the letter `O`; it is preserved exactly from the brief and should be verified. The original quotation template was not provided; the seeded terms are an editable paraphrase.
2. **Item Master:** set rental rates, effective dates, item weights and the original price per piece. Unpriced brochure items are labeled “Set a rate.” An invoice cannot silently use a missing rate.
3. **Customers:** create a customer with the required locking period, default 180 days. Use 0 for no commitment. Deposit is a reference amount; it is not automatically netted against invoices.
4. **Dispatch & Returns:** enter one dispatch / delivery date, then one or several materials in an atomic entry. The standard daily rate for the delivery date fills automatically; edit it for this customer's dispatch if agreed. The chosen rate is permanently saved with the batch. The balance preview is calculated by the server. Damaged pieces are included in total returned quantity, not added to it a second time.
5. **Customer Ledger:** view current physical and billable balances, deferred returns, dated events and segmented billable history. Export the complete customer ledger to Excel.
6. **Invoices:** select a customer, period, GST and notes; calculate and save a draft; open it, review, finalize and download PDF. PDF can also be printed using its viewer. Drafts are clearly marked.
7. **Quotations:** create multi-item offers with a 30-day estimate, material value, deposit, PDC terms and editable conditions; download PDF. Quotes do not change stock or automatically override rental rate history.

## Dispatch dates, returns and agreed rates

- Dispatches use a single delivery date. There is no dispatch end-date field or automatic revised-dispatch workflow.
- Standard rental rates fill automatically and can be changed for the customer on each dispatch. The agreed rate stays saved with that batch.
- Returns reduce physical stock immediately, FIFO. Billable quantity drops on the later of the actual return date and the original batch lock-expiry date.
- Remaining material continues under its existing dispatch and agreed rate. Returns do not create another dispatch or restart the lock.
- Previously saved end-date and rental-period records are retained in the database for history but are no longer used or updated. Existing transactions and finalized invoices are preserved.

## Damage rule — confirmed by the user

**Damage charge = damaged quantity × original price saved when the return is recorded.**

This is **added** to the invoice subtotal. A later catalog-price change does not alter it. The charge appears once in the invoice period containing the return date. Damaged returns still respect the original lot's minimum rental commitment. GST is applied to the combined rental-and-damage subtotal at the invoice's editable percentage (0 is allowed).

Example: return 20 pipes, including 2 damaged; original price ₹1,200. Physical stock decreases by 20. Damage adds ₹2,400. Rental on any early-returned pieces continues until their individual lot lock dates.

## Billing decisions and integrity

- All quantity/date logic lives in `src/lib/engine.ts` and is shared by ledger and billing.
- Inclusive daily billing uses UTC calendar-date arithmetic and India-local “today.”
- A 180-day lock ends on `dispatch date + 180`; quantity stops being charged **on** that date. This follows the spec's pseudocode and ensures exactly 180 billed days. The contradictory phrase “through lock date” is not treated as an extra 181st day.
- Each dispatch permanently saves its lock-until date. Changing the customer's policy affects new dispatches only.
- FIFO return allocations are persisted and rebuilt when allowed backdated entries affect open history. Physical/billable quantities are derived, never stored as stale mutable counters.
- Same-day deltas net before segmentation. Legacy dispatches use effective-date catalog history; new dispatches use their saved agreed rate. Distinct agreed rates are priced separately, never averaged.
- Date ranges ending in the future are rejected at invoice entry. The pure engine also caps at today.
- A global PostgreSQL transaction lock serializes stock/rate/invoice mutations; customer row locks and full-timeline validation prevent concurrent or backdated over-returns. A multi-item failure rolls back the whole entry.
- Finalized invoices include frozen item names, rates, customer, company, damage prices, notes and totals. A database trigger prevents any update or deletion of a final invoice.
- Finalized periods cannot overlap. Backdated stock changes and rate changes that could affect finalized invoices are blocked with an explicit credit/debit-note instruction.
- Draft finalization recomputes and compares source data. If anything changed, create a fresh draft and review it.
- Existing movements are append-only in this release. A dedicated credit/debit-note issuance workflow is not included; corrections to finalized periods require your accountant's separate adjustment process.
- The dashboard reports **finalized billing**, not paid/overdue receivables. Payment collection and due-date tracking were optional in the brief and are not included.

## Verification

```powershell
npm test                 # 27 pure billing / rate regression tests
npm run test:integration # real PostgreSQL integration tests, isolated temporary DB
npm run typecheck
npm run build
npm audit
```

Integration tests need a database user allowed to create/drop a temporary test database. They remove that database afterward, leaving office data alone. Test PDFs and XLSX exports are placed in ignored `test-results/`.

The supplied June fixture reproduces **₹1,05,591**. Additional supplied examples cover `580 + 300` and `1660 + 96`; full April/May spreadsheets were not attached, so their missing transactions have not been invented.

## Structure

```text
src/app/                   Next.js App Router and API route handlers
src/components/            Office interface
src/lib/engine.ts          Pure rental, FIFO and money engine
src/lib/service.ts         Validated transactional business operations
src/lib/db.ts              PostgreSQL connection pool and transactions
src/lib/auth.ts            Signed, expiring office sessions
src/lib/documents.ts       A4 PDF and real XLSX exports
db/001_initial.sql         Schema, constraints and immutable invoice trigger
scripts/                  Database initialization and local PostgreSQL
tests/                    Billing and PostgreSQL integration tests
```

## Backup and deployment

Use PostgreSQL `pg_dump` for live database backups and test restoration with `pg_restore`. Do not copy a running `.postgres/` directory as a backup. The database contains your operational records; the source project alone is not a data backup.

This delivery runs locally; it has not been deployed to a public server. For remote access, provide a Node.js host, persistent PostgreSQL, HTTPS, strong office credentials and database backups. The shared-password gate matches the brief's small-office scope; per-user roles are not implemented.

Reference: [Next.js installation documentation](https://nextjs.org/docs/app/getting-started/installation).
