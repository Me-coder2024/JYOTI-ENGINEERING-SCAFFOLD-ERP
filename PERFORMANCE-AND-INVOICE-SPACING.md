# Performance and invoice pagination

Implemented locally on 4 November 2026. No production database writes, migrations, commit, push or deployment were performed for this change.

## Invoice

Removed the fixed 310-point bottom reservation from item pages and the blank filler before totals. Item rows now flow down to the printable bottom margin; totals and bank/signature sections follow the last item or continue on the next page. Company heading, logo, billing data and payment calculations are unchanged. A synthetic 20-item invoice renders on two A4 pages; both pages were visually inspected.

## Performance

- Dispatch/return validation loads selected items, movement history and effective rates in batches instead of per item. A 10-item dispatch uses three data reads instead of thirty, in addition to the existing transaction/customer/final-invoice checks.
- Return allocation rebuilds use a bulk insert. Transaction boundaries and write locks remain intact.
- Dashboard balances and invoice payments are grouped once instead of repeatedly filtering complete datasets.
- Dispatch previews cancel obsolete browser requests and have a 20-second deadline. Note, reference and vehicle edits do not invalidate the stock check. Final saves still validate in the backend; failed saves retain drafts.
- Removed duplicate state reloads after inline customer/item creation.
- Secondary panels are loaded on demand. PDF/Excel generators are imported only for exports, avoiding their initialization on ordinary state/save requests.
- Fonts are self-hosted with Next.js; the external CSS font import is removed. Login images use content-hashed static imports. Next.js serves these and its hashed JS/CSS/font assets with one-year immutable caching. Business data is not given public caching.
- Touch inputs/buttons have 48px minimum targets on coarse-pointer devices. Existing named icon buttons are retained.
- State and save responses expose `Server-Timing: application;dur=...`. Successful application operations exceeding one second emit `slow_rental_request` logs with operation and duration only, without payloads or customer details. Timing excludes proxy authentication and network transfer.

No forced geometry-read/write reflows or external analytics scripts were found in the reviewed source. No extra preconnect is needed for server-only GST providers or now-self-hosted fonts. Next.js's existing modern browser build is retained. Broad CSS deletion was avoided because classes are shared across conditional ERP screens.

## Measurements and verification

Read-only 10-item dispatch preview against the configured Supabase database, measured from this workstation, three interleaved runs:

| Run | Before | After |
| --- | ---: | ---: |
| 1 | 17,224 ms | 5,385 ms |
| 2 | 11,356 ms | 6,079 ms |
| 3 | 17,250 ms | 3,005 ms |

Median: 17,224 → 5,385 ms (approximately 69% lower). These are service timings, not production browser Core Web Vitals or actual dispatch-write timings. Network latency still varies. Vercel runtime logs and production LCP were not available for this check.

Passed: production build and TypeScript; 30 billing/rate/PDF/Excel unit tests; disposable-local-database integration suite for dispatch, returns, corrections, allocations, accounting and permissions; desktop/mobile browser overflow checks; dispatch metadata-vs-quantity preview check; browser verification of no external font requests and one-year immutable image caching.

Local production build review: http://127.0.0.1:3002/rental (local database). Changes require deployment before the live website benefits. Use the new timing headers/logs after deployment to distinguish application latency from network/proxy delays.
