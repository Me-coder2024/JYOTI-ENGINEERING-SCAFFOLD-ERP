# Rental workflow update — 3 November 2026

## Implemented locally

- New dispatches/returns receive a batch/challan UUID shared by their material lines. Blank reference numbers receive a DC/RC sequence number. Each row retains its customer foreign key.
- Optional vehicle number is saved, restored in movement drafts, editable with the owner correction workflow, and included in challan PDFs.
- Challan numbers are visible and clickable in movement history. Customer, challan, date-range and type filters also apply to PDF/Excel history exports.
- New customer and item forms open inside the dispatch dialog without unmounting the dispatch form. Existing validation and customer-ledger synchronization are reused; the created record is selected immediately.
- Invoice PDF uses the supplied Bavishi reference's boxed company/customer/site sections, rental-period columns and totals, with Jyoti branding. It uses saved billing amounts, actual allocated receipts and payment status; it does not copy the reference supplier's identity, stamp or sample charges.
- Individual invoices have an Excel download with billing rows, tax/amount totals, company/customer information, dispatch details, bank/terms and a payment-history sheet.
- Party Ledger has an owner-only Delete / cancel action with a reason and confirmation. It posts an exact reversal, retaining original records and updating derived balances and allocated invoice payments. Repeated requests cannot create another reversal.
- Invalid movement corrections now produce a meaningful conflict message. Stale errors are cleared when reopening a form. Finalized invoice and dependent-return protections remain active.

## Database / deployment

`db/007_challan_metadata.sql` is additive: sequence, nullable challan UUID, optional vehicle text and indexes. Applied to local PostgreSQL and the configured Supabase project before the approved GitHub release. Existing data is unchanged. Historical rows without a batch UUID export individually rather than guessing that matching reference numbers identify one transaction.

The additive migration is ready in production; all 64 existing movement records were preserved. GitHub release was authorized after local review; Vercel deployment status must be checked separately.

## Verification

- TypeScript check and production build passed.
- 30 targeted identity/billing/export tests passed; local disposable-database integration suite passed, including movement correction/deletion, FIFO reconstruction, invoice allocations/reversals, customer challans and owner cancellation/idempotency.
- Browser verification passed for inline customer/item creation, immediate selection and retained dispatch/vehicle drafts. Browser writes were intercepted; database writes were tested separately in disposable databases.
- Sample invoice was rendered and visually inspected against the supplied reference. Generated sample is `output/pdf/rental-invoice-format-sample.pdf` and is clearly marked as a draft/sample.

## Pending

- Parshutam: business requirement still needs confirmation.
- Local visual review before deployment. Existing production error reference cannot be conclusively traced without its corresponding server log; regression tests verify the corrected edit/delete paths locally.

Company header and contact lines are centered like the reference. Customer search includes buyer/mailing aliases, and internal-page filters use responsive aligned layouts.
