# Challan Management and customer sites

Dispatch & Returns is now Challan Management. Outward challans issue material;
inward challans receive it back. History groups all lines of a saved challan and
provides one print action for the complete document. Per-material corrections
remain available inside its expanded item list.

Top-right Grid / List controls switch between the existing horizontal table and
searchable customer cards. Grid navigation opens site cards for customers with
sites and goes directly to challans for customers without sites. The calendar
filters by an exact date; clearing it restores all dates.

Settings > Document export formats > Challan controls the company heading,
outward/inward titles, text size, logo visibility, footer and reference/compact
layout. Heading overrides apply to challans only. Saving requires owner access
and creates an audit entry. Reopen a challan printout to preview the saved format.

Customer sites are optional. Customers with sites must select a destination for
outward challans and an origin for inward challans. Customers without sites do
not see this field. A site used in transaction history cannot be removed or
renamed. Existing unassigned stock remains returnable through the explicit
"Existing stock — site not recorded" choice.

## Invoice protection

Invoice templates, tax calculation, rates, lock periods, return-day charging and
finalized-invoice protections are unchanged. Returns match outward lots within
their selected site, retaining each lot's agreed rate and lock. Historical
movements retain a blank site and their existing allocation behavior. Site
profile metadata is excluded from invoice snapshots so adding sites does not
invalidate an otherwise unchanged draft invoice.

## Database and release

Apply `db/008_customer_sites.sql` and `db/009_challan_export_format.sql` before deploying the application. They only add
customer sites, movement site names and an index; it does not update existing
invoice amounts, snapshots or movement quantities. Both migrations have been
applied locally and to production. Production migration verification confirmed
all 5 customer records, 65 movement records and 4 complete invoice records were
unchanged apart from the newly added empty site fields. A pre-migration backup
is stored in the ignored deployment backups directory.

## Verification

- 49 unit tests passed, including site-specific stock/rate allocation and challan grouping.
- Both local integration suites passed using disposable databases.
- Regression confirmed that adding sites preserves a saved invoice's snapshot
  and grand total and permits finalization without regenerating the draft.
- Production build passed.
- Browser checks passed for complete three-item challans, conditional site
  selection, no-site customers, multiple site creation and site draft recovery.
- Rendered challan PDF reviewed for full item list and quantity-only layout.
- Browser checks passed for customer search, site drilldown, exact-date and
  cleared-date filters, Grid/List switching, mobile layout and format settings.
- Integration tests verified owner-only format saving, PDF generation and
  preservation of invoice snapshots and totals when challan formatting changes.

Legacy records without a batch ID are grouped only when customer, nonblank
reference, date, direction and site match. Blank-reference historical entries
remain separate because their original batch cannot be established reliably.
