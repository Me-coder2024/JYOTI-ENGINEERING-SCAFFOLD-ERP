# Manufacturing ERP

The new manufacturing module runs in the existing Next.js application and PostgreSQL database. It uses separate `mfg_*` tables. The new `erp_*` tables hold individual users, sessions and audit records.

## Start and sign in

1. Start PostgreSQL with `npm run db:local` if using the bundled local database.
2. On a new installation, run `npx tsx scripts/manufacturing-setup.ts`. This creates only new tables and the first owner. It does not reset existing accounts or rental data.
3. Run `npm run dev` and use the address printed in the terminal. The current preview uses **http://127.0.0.1:3001** because another project occupies port 3000.
4. Sign in as **owner**, using the existing office password. Setup supports `ERP_OWNER_LOGIN` and `ERP_OWNER_PASSWORD` overrides for a new installation; otherwise it uses `OFFICE_PASSWORD`.
5. Owners see a module chooser and can create individual accounts under **Team access**. Owner accounts have both modules. Rental staff and manufacturing staff go directly to their own module and receive HTTP 403 for the other module's pages and APIs.

## Manufacturing workflow

- Create suppliers, raw materials, manufacturing customers and finished goods. Manufacturing masters are independent of rental masters.
- Create a purchase order, then mark it sent. Post goods receipts against its remaining quantities. Partial receipts increase raw-material stock and update the order status automatically.
- Record the physical opening stock of each finished good under **Opening stock**. One entry per product is allowed, before any dispatch, with a required audit note and recorded user identity. Opening stock is not a recurring production entry.
- Create and confirm a sales order. The default selling rate comes from its finished good and can be changed on that order. Post full or partial dispatches; stock cannot become negative, including through backdated dispatches.
- Once fully dispatched, issue the final sales invoice after reviewing GST and sales terms. The invoice has its own `JM` series and freezes its customer, lines, rates and company letterhead. Posted stock documents and final invoices cannot be edited.
- Download purchase orders, sales orders, goods receipts, dispatch notes and invoices as PDFs. Referenced masters are archived when removed, preserving their document history.

Production is now included: create a versioned BOM per finished piece, create and release a work order, then post full or partial good-piece completion. Each completion consumes the frozen BOM quantities plus extra raw-material wastage, records labour cost and adds finished stock atomically. Backdated shortages and over-completion are blocked. Work orders do not reserve stock. Posted production is immutable.

**Accounts & vouchers** opens independent manufacturing accounting. Set the accounting company/opening date, create ledgers and post balanced Payment, Receipt, Contra, Journal, Purchase and Sales vouchers. Link a Sales voucher to a final manufacturing invoice to prevent duplicate posting and validate the customer/subtotal/GST. This is an explicit accounting step; creating an invoice or receiving stock does not silently create a voucher. Opening balances use a balanced Journal. Corrections use reversal journals. Closing a period blocks new vouchers on or before that date.

Party/GST and transport fields follow the supplied reference screens. The day book, statements, trial balance, profit-and-loss and balance sheet use posted vouchers. Inventory valuation, depreciation and year-end adjustments need accounting entries; no automatic costing, GST filing, e-invoice/e-way-bill generation, bank reconciliation or bill-wise settlement allocation is claimed. There is no Tally connection or synchronisation.

See `deploy/PRODUCTION.md` for Supabase migration and hosting.

## Isolation and validation

Original rental files, calculation rules, tests, PDF generation and tables are unchanged. A new wrapper adds the shared header and authentication around the original rental component. Manufacturing reads Company settings only when freezing a sales-invoice letterhead; it never writes them.

This workspace has no Git history, so comparison with a rental-only commit is unavailable. `verification/rental-baseline.json` records SHA-256 hashes of 25 original files taken before the addition. `verification/rental-schema-baseline.json` records the original rental database definitions. The verification script compares them and rejects manufacturing foreign keys into rental tables.

Validation commands:

```powershell
npm run typecheck
npm run build
npm test
npm run test:integration
npx tsx manufacturing/tests/integration.ts --http
npx tsx scripts/verify-rental-isolation.ts
```

The manufacturing integration test creates and drops an isolated temporary database. It verifies partial/concurrent receipts, duplicate submission protection, opening stock, historical stock availability, partial dispatch, overdispatch rejection, invoice totals/immutability, rental-data isolation, PDF generation, and production HTTP role enforcement on port 3011. Run a production build before `--http`. Test PDF artifacts are written under `test-results/manufacturing`.
