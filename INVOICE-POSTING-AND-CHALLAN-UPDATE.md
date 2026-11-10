# Invoice accounting, challan printing and deletion

## Accounting

Finalization now locks the invoice and posts its Sales voucher in the same database transaction. The customer account is debited with the total; rental sales and GST payable are credited separately. Existing receipt and journal credits reduce the party-ledger balance. Receipt allocations still determine individual invoice paid/outstanding amounts; unallocated receipts remain customer credits.

The accounting company and open period must be configured. A failed posting rolls back finalization. Repeated finalization cannot create a second charge. Existing finalized invoices without a charge appear in an owner-only reconciliation notice in Accounts. Reconciliation rejects closed-period charges and matching manual invoice references rather than silently duplicating them.

## Dispatch and return printing

Each movement offers **Print dispatch** or **Print return**. The PDF includes all lines in that customer-linked challan, the configured company identity/logo, customer/site details, optional vehicle, quantities, total and signature boxes. Legacy entries without a challan batch print individually. The supplied delivery-challan reference guides the A4 layout. No rates or prices are printed. Long descriptions and multi-page challans are supported.

## Deletion

Owner-only, reason-required deletion is available for draft invoices, quotations, unused customers, unused items and unused non-customer accounts. The original record and reason are retained in the audit log. Customers with transactions and records referenced by other documents cannot be deleted. Item rate history is captured before removing an unused item.

Dispatch/return deletion continues through the existing correction workflow, retaining revisions and enforcing return/invoice dependencies. Ordinary posted vouchers have **Delete / reverse**, which creates an exact journal reversal and updates receipt allocations. Final invoice charges cannot be independently removed while their invoice remains final; final invoices and audit history remain protected. Settings and report views are not deletable transactions.

## Verification

- Expanded disposable-database integration tests: invoice debit/tax credits, repeated finalization, atomic rollback, customer balance after payment, legacy reconciliation, deletion permissions/dependencies/audit and voucher reversal.
- Built-app HTTP tests: authentication, owner/staff restrictions and document download routes.
- Browser check: individual dispatch/return print links, draft-invoice deletion submission and accounts rendering.
- A4 dispatch, return and five-page stress samples rendered for PDF review.
- TypeScript and optimized Next.js production build passed.

No schema migration or historical record deletion is needed for this release.
