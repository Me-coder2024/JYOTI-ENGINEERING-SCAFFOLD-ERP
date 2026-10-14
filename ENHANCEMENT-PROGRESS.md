# ERP enhancement implementation status

This is an implementation checkpoint, not acceptance of the complete specification.
Existing production data has not been migrated or changed by this work.

## Implemented locally

- Routine payment/receipt form: select party, bank/cash, amount, date, reference and narration.
- Backend generates both double-entry lines; validates the bank/party roles.
- Advanced vouchers and reversal journals retain the existing accounting validation.
- Receipt allocation across multiple final invoices, with an optional unallocated remainder.
- One shared payment query includes both historical single-invoice receipts and new split allocations.
- Reversed receipts stop paying their invoices without deleting historical vouchers.
- Accounting invoice data, rental invoice lists, invoice detail and invoice PDF use the same allocations.
- Existing transaction/advisory-lock and submission-ID protection remains in place.

## Verified

- 37 unit tests passed.
- TypeScript and production build passed.
- Disposable-database integration: automatic receipt/payment lines; 8000 paid against 20000 leaves 12000; split receipt fully pays two invoices; reversal restores balances.
- Concurrent identical requests create one voucher; overpayment and invalid bank/party combinations are rejected.
- Existing customer synchronization, material export and billing integration checks passed.

## Still required before complete delivery

- Universal user/company/module-scoped server drafts, local recovery buffer, Drafts UI, form restoration and atomic draft completion.
- Retry idempotency for every non-voucher entry form.
- Challan edit/cancel, permissions, reason, immutable audit revisions and safe recalculation of downstream operational records.
- A4 material ledger preview and pagination verification.
- Dedicated party-ledger navigation, linked transactions, closing totals and PDF.
- Invoice template selection/default/preview and payment-status rendering on every template.
- Resolve the full invoice/accounting posting lifecycle so financial ledger balances and customer receivables reconcile, including unallocated credit handling.
- Complete TC-01 through TC-18 acceptance evidence and browser verification.
- Review and deploy the complete integrated release; current changes are not deployed.

Primary changed files: src/rental/accounting.ts, src/rental/simple-voucher.tsx,
src/rental/payments.ts, src/rental/accounting-ui.tsx, src/lib/service.ts,
src/app/api/[...path]/route.ts, src/components/rental-app.tsx,
tests/rental-shift.integration.ts.
