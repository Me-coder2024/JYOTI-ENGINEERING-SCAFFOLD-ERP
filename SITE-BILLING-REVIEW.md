# Company and site billing — local review

Customers and Invoices now include a Company & site overview. Select a company
for consolidated finalized-invoice totals, allocated payments, invoice balances,
total receipts and the posted company ledger balance. Select a site for that
site's invoices and material distribution. Draft invoices appear in history but
are excluded from financial totals.

Generate invoice selects the customer and dates only. It includes every site's
applicable rental and damage charges, including Legacy / Unassigned and stock
carried forward from earlier dates. One combined customer invoice is created.
Finalized company periods cannot be billed twice. New combined invoices lock
the company period; historical legacy invoices retain their legacy scope for
movement checks. Existing finalized snapshot records are not rewritten.
No database migration is required.

Material ledger filters and PDF/Excel exports are unchanged: customer, all
sites, Legacy / Unassigned and individual named sites remain available.

Receipts continue posting to the single customer ledger. Invoice allocations
may span multiple sites of that customer. Unallocated receipts affect the company
ledger, not individual invoice paid amounts. Company invoice outstanding and
posted ledger balance are separately labelled because advances and journal
adjustments can make them differ. Return allocation remains FIFO within the
selected site; material is never automatically moved between sites.

Validation: 49 unit tests, both disposable-database integration suites, TypeScript,
production build, local browser checks and rendered site-invoice review.
The integration scenario verifies legacy invoice preservation, zero opening
stock for new sites, all-site combined billing with carried-forward stock,
duplicate billing rejection, receipt retry idempotency and company advances.

These changes are for local review and have not been pushed or deployed.
A read-only production check found zero historical invoices with named-site
movements dated within their coverage and created before invoice generation.
Before any production release, confirm that historical invoices without site
metadata cover unassigned movements, as described in the requested scenario.
If any old invoice already included named-site stock, its coverage needs an
explicit compatibility mapping before deployment to prevent rebilling it.
