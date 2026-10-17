# Rental billing, documents and login update

## Changes
- Rent includes the physical return date. The billing decrement is max(return date + 1 day, original exclusive lock date). Physical material stock still records the actual return date.
- Migration 006 updates stored allocation billing dates. Final invoice snapshots and original stock dates remain unchanged. Regenerate affected draft invoices; finalized invoices need an explicit accounting adjustment.
- Owner movement deletion uses an inline confirmation and a minimal delete payload. Edit-only fields are disabled during deletion. Existing final-invoice and dependent-return safeguards remain enforced.
- Dispatch & Returns supports From/To, movement type and customer/material search filters, with matching PDF and Excel exports of active movements. Deleted lines remain in owner correction history.
- Party ledger defaults to the supplied To/By reference layout with opposite-account descriptions, voucher type/number, opening/closing balances and balancing totals. PDF and Excel use the same financial rows. Export settings retain a custom-table alternative.
- Quotations use the supplied Jyoti logo, reference paper size, material table, GST/PDC totals, weight, deposit, terms and required documents. Reference, GST, dispatch lead time and document requirements are saved in the quotation snapshot.
- The login page uses the supplied building image and the ERP blue/yellow palette, with responsive layout, password visibility and accessible errors.
- Accounting form spacing fixes from the previous review remain included.

## Verification
- 42 unit tests passed, including inclusive return-day calculations, minimum periods, FIFO rates, quotation totals/pagination and ledger balancing.
- Production build passed after the rental/document work; TypeScript passed again after the login changes.
- Disposable PostgreSQL integration tests passed: permissions, correction audit, dependent returns, finalized records, allocations, receipt reversals, quotation snapshots and filtered PDF/Excel output.
- Browser checks on the disposable database passed: owner deletes a return and dispatch through inline confirmation; export download succeeds.
- Login desktop/mobile checks passed: no horizontal overflow, password visibility and retry after failed login.
- Reference and generated PDFs were rendered and visually inspected.

## Deployment state
Local database migration 006 has been applied. This batch is not committed, pushed or deployed. Apply migration 006 to the production database as part of deployment. No production business data was changed during this work.
