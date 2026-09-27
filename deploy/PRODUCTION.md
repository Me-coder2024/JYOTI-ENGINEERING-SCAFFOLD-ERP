# Client deployment and Supabase cutover

The app uses Supabase as PostgreSQL through server-side `pg`. It does not require Supabase Auth, an anon key or a service-role API key. Existing ERP user passwords and role checks stay in place. All rental code and schema definitions remain frozen.

## Credentials and destination

Use a dedicated Supabase project and copy `deploy/production.env.example` to `deploy/production.env` locally. That file is ignored and excluded from the Docker build. Set the runtime pooler URL, direct/session-pooler migration URL, a fresh session secret and the intended HTTPS app origin. URL-encode special characters in the database password. Use certificate-verified TLS and the provider's CA certificate when required. Never use `rejectUnauthorized: false`.

**Disable the Supabase Data API for this dedicated project.** ERP authentication belongs to the Next.js server; the public database tables must not be anonymously exposed by PostgREST. Set `SUPABASE_DATA_API_DISABLED=true` only after verifying that setting. The migration also revokes `anon` and `authenticated` table/sequence privileges. Do not re-enable API exposure without a deliberate role/RLS design. This avoids altering the frozen rental tables to add RLS.

Use the transaction pooler for a serverless runtime or session pooler for a persistent server, subject to the project's connection limits. Migration uses the direct connection or session pooler, never transaction pooling. The existing application opens up to eight connections per instance, so cap host instance count according to the database plan.

## Local validation

```powershell
npx tsx scripts/manufacturing-setup.ts
npm run build
npm test
npm run test:integration
npx tsx manufacturing/tests/integration.ts --http
npx tsx scripts/verify-rental-isolation.ts
```

These integration tests use temporary databases and need CREATE DATABASE permission locally. Do not run them against the client's Supabase project.

## Migration

1. Verify a restorable database backup before cutover. Use PostgreSQL's `pg_dump`/`pg_restore` with a compatible client version or a tested platform backup. Do not copy a running `.postgres` directory. The provided embedded database does not include `pg_dump`.
2. Run `npx tsx scripts/supabase-migrate.ts` for read-only source counts and destination checks. No remote tables are created in this mode.
3. Schedule a maintenance window and stop office writes for the full migration and cutover. Keep the source database running.
4. Run `npx tsx scripts/supabase-migrate.ts --apply`. It requires an empty ERP destination, takes source table locks, creates the existing schemas, copies in foreign-key order, verifies counts and row content, transfers sequence positions and commits the destination transaction. It does not modify local source records. Active login sessions and login-attempt counters are not migrated.
5. If it fails, inspect the error before retrying. Database sequences are not fully transactional; an unsuccessful new destination may need manual inspection. This tool never clears or overwrites an existing ERP database.
6. Run hosted smoke tests before pointing the client at the app: owner chooser, both staff roles, forbidden-module 403s, company data, invoice download, known ledger and stock totals.
7. Stop using the old database after cutover to prevent two independent books. Keep its backup for recovery. Switching back after new hosted transactions exist requires a reconciliation plan, not a blind connection-string change.

## Hosting

No production host or domain is assumed. For a Docker-capable host:

```powershell
docker build -f deploy/Dockerfile -t jyoti-erp .
docker run --rm --env-file deploy/production.env -p 127.0.0.1:3001:3000 jyoti-erp
```

The image uses `next start`, not the development server, and runs as an unprivileged OS user. Put it behind the host's HTTPS endpoint. Supply runtime secrets through the provider settings; do not commit or copy the environment file into the image. For a managed Next.js host, use `npm ci`, `npm run build` and the same server-only runtime environment variables.

Before sharing the URL, replace the inherited office/default owner password through Team access, create individual staff accounts, confirm the HTTPS origin, enable host logs and database backup retention, and perform a restore drill. Public hosting is not complete merely because a local build passes.

## Accounting scope

The supplied Tally screens informed the ERP's own ledger, voucher, buyer/GST and dispatch forms. There is no Tally connection. Six voucher types, reversal journals, financial period closing and ledger-derived financial statements are implemented. Manufacturing sales invoices are posted to accounts through an explicitly linked Sales voucher; stock receipts and production do not automatically create financial valuation entries.

Automatic stock costing, bill-wise payment allocation, GST returns, e-invoicing, e-way bills, payroll and bank reconciliation are not implemented. Do not present the current build as a complete statutory or feature-for-feature Tally replacement. Accountants must review opening balances, chart of accounts, tax ledgers and closing/stock valuation adjustments before relying on the financial reports.

References: [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [migration](https://supabase.com/docs/guides/platform/migrating-to-supabase/postgres).
