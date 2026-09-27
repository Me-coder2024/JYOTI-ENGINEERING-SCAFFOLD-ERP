# Jyoti ERP | Operating guide

## Purpose
A practical guide to the installed rental and manufacturing ERP. Prepared 27 September 2026. Manufacturing is operated for Jyoti Engineering; rental is operated for Jyoti Scaffold Private Limited. Check the saved legal name on every document before issuing it.

## Access
Open http://127.0.0.1:3001/login on the computer running the application. Sign in with your individual account. The database is now hosted on Supabase, but this address is still local: a client-facing production website has not yet been deployed.

## How to use this guide
Pages 2-3: access and setup. Pages 4-5: rental operations and billing. Pages 6-8: purchasing, production and sales. Pages 9-10: accounting and faster entry. Page 11: daily checks and recovery. Page 12: Tally feature coverage and remaining work.

## Important distinction
Warehouse documents track physical quantities. Accounting vouchers track money. A goods receipt or sales invoice does not automatically create its accounting voucher. The final sales invoice can be linked to a Sales voucher to prefill and validate its values.

# Sign in and choose your work area

## Steps
1. Open the login page and enter your assigned username and password.
2. Owners choose Rental or Manufacturing on the module chooser.
3. Staff accounts open their permitted module directly.
4. Owners use Team access to create individual users and assign Owner, Rental staff or Manufacturing staff.
5. Use Switch module to return to the chooser; use Sign out when finished.

## Permissions
Owner accounts can access both modules and manage users. Rental staff cannot access manufacturing pages or APIs, and manufacturing staff cannot access rental. Account changes and disabling a user revoke their sessions.

## First checks
Confirm that the expected customers and items are present before entering transactions. If login expires, sign in again. Do not create a second entry merely because a screen failed to refresh after saving.

## Supabase migration
Existing records were copied and verified. Login sessions were intentionally not copied, so everyone must sign in again. Application secrets and database credentials belong only in private configuration; they are not included in this guide.

# Prepare your masters and opening position

## Rental setup
Open Settings and verify company name, addresses, GST details, bank details, logo and terms. Open Item Master and verify daily rates and original replacement prices. Add customers and their minimum locking days. Review every prefilled detail before sending a document.

## Manufacturing setup
Add Suppliers, Raw materials, Customers and Finished goods in the manufacturing module. Raw material units may be kg, pc or mtr. Set reorder levels, finished-good sale rates, HSN and unit weight. Used records are retained or archived to preserve history.

## Accounting setup
As Owner, open Accounts & vouchers, then Company / period. Set Jyoti Engineering and the accounting opening date. Create Bank/Cash, Capital, Purchase, Sales, Expense, Tax, Customer and Supplier ledgers. Link party ledgers to the corresponding manufacturing masters.

## Opening quantities versus money
Use Opening stock once for a finished good before stock movements, with a clear audit note. Record monetary opening balances separately as a balanced Journal voucher, with the appropriate capital/opening counterpart. Do not use opening stock for regular production.

## Company limitation
Rental and manufacturing operational records are separated, but manufacturing invoice letterhead currently reads the shared Company settings when the invoice is issued. Independent legal-company letterheads must be implemented before issuing documents for two different legal entities. Saved final invoices retain their snapshot.

# Dispatch materials and record returns

## New dispatch
1. Open Dispatch & Returns and choose New dispatch.
2. Select the customer and dispatch date.
3. Add each item and outgoing quantity.
4. Review the default daily rent; change the agreed rate for this dispatch when required.
5. Review and save. Confirm the movement appears in the customer ledger.

## Record return
1. Choose Record return and the same customer.
2. Enter the actual return date and item quantities.
3. Enter damaged quantity for the relevant item, where applicable.
4. Review and save. Check the physical balance and billable timeline.

## Locking period
A physical return and a reduction in billable quantity are not always the same event. The original dispatch minimum rental commitment still applies to an early return. Use Customer Ledger to inspect the billable timeline; do not restart a satisfied lock manually or create a duplicate dispatch.

## Damage example
If 2 pieces are damaged and the saved original price is INR 500 per piece, the invoice adds INR 1,000 as damage charges. This is an additional customer charge, not a deduction from rent. Check the saved replacement price before dispatching.

## Control
Do not record a return before material physically arrives. Do not edit quantities merely to adjust money; investigate the original movement and invoice period first.

# Calculate, review and finalize invoices

## Steps
1. Open Invoices and create an invoice.
2. Select the customer, period start and period end.
3. Review GST percentage and notes.
4. Click Calculate invoice.
5. Inspect each quantity/day/rate segment and any damage charges.
6. Save draft, reopen and check the letterhead and totals.
7. Click Finalize & lock invoice only after review.
8. Download the PDF and send it through your normal approved channel.

## What is automatic
Rental totals are calculated from movements, agreed rates and locking rules. Damage totals use recorded damaged quantities and original prices. GST is calculated using the entered rate. Finalized periods cannot be billed twice.

## What remains your responsibility
Choose the correct customer, dates and tax treatment. The software calculates the supplied GST rate; it does not determine your legal tax obligations or file returns. Final invoices are permanently locked.

## Quotations
Open Quotations, choose a customer and date, add items, quantities and daily rates, then enter deposit, cheque terms and other terms. Save and download the quotation. Quoted quantities do not dispatch stock; the monthly estimate uses 30 days.

# Receive raw materials

## Purchase order
1. Add the supplier and raw materials first.
2. Create a Purchase order, select supplier and date, and enter items, quantities and rates.
3. Save the draft and review its PDF.
4. Mark sent once the order is released to the supplier.

## Goods receipt
1. Open the sent order and record a goods receipt.
2. Enter the actual receipt date and quantities received.
3. Partial receipts are allowed up to the remaining order quantity.
4. Save once and check the receipt document and stock journal.

## Automation
Raw stock increases from the posted receipt. The remaining order quantities and order status update automatically. Duplicate submissions, excessive receipts and invalid quantities are rejected.

## Supplier bill and payment
Receiving stock is not the supplier bill. In Accounts & vouchers, post a Purchase voucher with the appropriate purchase/tax debits and supplier credit. When paid, post Payment: debit the supplier and credit Bank/Cash. Record supplier bill references for reconciliation.

## Current boundary
The purchase workflow receives raw materials. A dedicated purchase-and-resale finished-product workflow and itemized expense bill generator are not implemented. Do not represent purchased resale goods as manufactured output merely to create stock.

# BOM, work orders and completion

## Build a BOM
1. Add the finished good and required raw materials.
2. Open BOMs and define raw quantities required per finished piece.
3. Save the revision and review quantities and units. New revisions do not rewrite existing work orders.

## Release work
1. Create a Work order for the finished good and planned quantity.
2. Review the active BOM and dates.
3. Save and release the work order.
4. Check raw stock availability. A work order does not reserve stock.

## Record completion
1. Open the released work order and record good-piece completion.
2. Enter completed quantity and actual date.
3. Record additional raw-material wastage, labour cost and a note.
4. Review consumption, then post.
5. Repeat for partial completions until the planned quantity is complete.

## Automation
Each completion consumes the frozen BOM requirement plus additional wastage and adds finished stock in one transaction. Shortages, backdated negative stock and over-completion are blocked. Order progress updates automatically.

## Limits
Posted production is immutable. Labour is recorded, but automatic inventory financial valuation and manufacturing cost accounting are not implemented. Have your accountant post required valuation and closing adjustments.

# Order, dispatch and invoice finished goods

## Sales order
1. Add the manufacturing customer and finished goods.
2. Create a Sales order and select the customer.
3. Add quantities; review the default sale rate and agreed changes.
4. Save the draft, review, then Confirm.

## Dispatch
1. Record a dispatch against the confirmed order.
2. Enter actual date and quantities leaving the warehouse.
3. Partial dispatches are allowed; stock cannot become negative.
4. Save and download the dispatch note.

## Final invoice
1. Fully dispatch the order.
2. Issue its final invoice after reviewing date, GST and terms.
3. Check customer, items, rates and legal letterhead.
4. Download the invoice PDF. Final invoices use their own JM series and cannot be edited.

## Post the accounts
Open Accounts & vouchers > New voucher > Sales. Select the final manufacturing invoice. The form proposes customer debit, sales credit and tax credit from the invoice. Ensure the correct ledgers exist and review before posting. Duplicate linkage is blocked.

## Customer receipt
When payment is received, post Receipt: debit the receiving Bank/Cash ledger and credit the customer ledger. Invoice-by-invoice payment allocation and aging are not yet available; retain the invoice reference and reconcile the customer statement.

# Choose the voucher type first

## One accounting entry form
Open Accounts & vouchers and click New voucher. Select Payment, Receipt, Contra, Journal, Purchase or Sales. Enter date, reference, ledger lines and narration. Posting is available only when debits equal credits and the total is positive.

## Common entries
Payment: debit supplier or expense; credit Bank/Cash.
Receipt: debit Bank/Cash; credit customer or income counterpart.
Contra: debit receiving Bank/Cash; credit sending Bank/Cash.
Purchase: debit purchase and applicable tax; credit supplier.
Sales: debit customer; credit sales and applicable tax.
Journal: balanced accountant-approved adjustment.

## Paid expense example
For an INR 1,200 expense paid from bank, select Payment, debit the relevant expense ledger INR 1,200 and credit the bank ledger INR 1,200. Enter the bill/reference and useful narration. Review tax handling separately; the balancing helper does not calculate tax.

## Corrections
Open the posted voucher and choose Prepare reversal journal. Review the exact inverse and post it with a clear reason. The original remains visible. Then create the corrected entry if needed. Do not enter a second payment just to replace the narration.

## Period control
Owner uses Company / period to close books through an approved date. New entries on or before that date are blocked. Closing is not a backup and should happen only after reconciliation.

# Keyboard search, balancing and reports

## Search without scrolling
In manufacturing order Customer/Supplier fields and voucher Ledger fields, focus the search box and type a name. Prefix matches are shown first; other matching names follow. Use Arrow keys and Enter to select. Escape closes the list. Tab moves to the next field. Select an actual result rather than leaving unselected text.

## Voucher shortcuts
While inside the voucher form: F4 Contra, F5 Payment, F6 Receipt, F7 Journal, F8 Sales, F9 Purchase. Some keyboards require Fn. Switching type preserves ledger lines, so review them before posting. Reversal voucher type cannot be switched.

## Fill balancing amount
Choose the counterpart ledger on an empty amount line. Enter the other ledger amounts, then click Fill balancing amount. The first selected blank line receives the exact difference as debit or credit. The button does not choose an account, determine tax or post automatically. Review the result.

## Registers and reports
Day book: filter From/To dates and Voucher register type to see Sales, Purchase, Payment, Receipt, Contra or Journal entries.
Chart of accounts: inspect current ledger balances.
Ledger statement: select a ledger and period; opening balance is carried forward.
Trial balance: cumulative balances to the selected date.
Financial reports: profit and loss plus balance sheet from posted vouchers.

## Reconciliation
Stock quantities and accounting values are different reports. Financial reports exclude unposted operational documents and do not automatically value closing stock. Reconcile invoices, bank, supplier balances and stock before interpreting profit.

# Close the day and recover safely

## Daily checklist
1. Confirm every physical receipt, production completion, dispatch and rental return is entered once.
2. Match source documents to their saved reference numbers.
3. Post and review financial vouchers for bills and payments.
4. Reconcile bank/cash and party statements.
5. Investigate negative/low stock or unexpected billable quantities.
6. Download required documents and sign out.

## If something goes wrong
Saved but refresh failed: reload and find the entry before retrying.
Insufficient stock: check dates, receipt quantities and BOM consumption.
Unbalanced voucher: check both sides and use the balancing helper only after selecting the correct counterpart.
Closed period: contact the owner; do not falsify a date.
Access denied: ask the owner to review the account role.

## Running the local website
An administrator starts the existing Next.js production build with: node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3001. The private .env points to Supabase and its CA certificate. Internet access is required. A local PostgreSQL process is no longer needed for ordinary use.

## Deployment and backups
A production URL, hosting configuration and operational backup/restore process still need completion. Do not run seed, reset or integration-test commands against the live Supabase database. Keep credentials out of PDFs and source control. Test restoration in a separate database before relying on backups.

# Tally coverage and automation boundaries

## Implemented in this ERP
Core six accounting voucher types, chart of accounts, day book/type registers, ledger statements, trial balance, profit and loss, balance sheet, period locks and reversal trail. Purchasing, receipts, sales orders, dispatch notes, invoices, stock journal, BOM/work orders and partial production. Rental dispatch/return, locking rules, damage charges, quotations and locked invoices.

## Automation added or present
Searchable party/ledger selection; voucher function keys; filling balancing amounts; invoice-linked sales line preparation; automatic document numbering and totals; transaction-safe stock updates; production BOM consumption; partial-order progress; duplicate submission safeguards; rental billing calculations. Accounting posting still requires deliberate review.

## Not yet implemented / no full Tally parity claim
Dedicated Credit Note/Debit Note workflows, bill-wise allocation and aging, bank statement import/reconciliation, connected bank payments, cost centres/budgets, multi-currency, payroll, batch/serial/expiry and multi-warehouse stock, automated valuation/depreciation, statutory GST return filing, e-invoice/e-way-bill submission, independent manufacturing legal letterhead, itemized expense invoices and purchased finished-goods resale. Some need external credentials and business rules.

## Recommended implementation order
First separate manufacturing legal letterhead and add bill allocation/aging. Next add credit/debit adjustments and expense/trading purchase documents. Then implement reviewed bank reconciliation and valuation. Statutory connectors and payroll need their own requirements and validation; they should not be simulated as completed features.

## Reference basis
Comparison uses supplied Tally screenshots, inspected ERP source and official Tally feature documentation. Sources: https://help.tallysolutions.com/tallyprime-get-started/ and https://help.tallysolutions.com/tallyprime-features-release-wise/ . Tally itself already automates many tasks; this guide does not assume all its entry is manual.
