# Accounts and manufacturer matching implementation

## Existing foundation

- Next.js App Router, TypeScript, Supabase SSR cookies, Zod, Server Actions, Tailwind and Calliper CSS.
- Supabase email-code login and owner-only `ideas` table. No manufacturer or analysis tables.
- Client PDF.js workspace; drawings and analysis JSON in unscoped IndexedDB.
- Server-only OpenAI Responses extraction with strict schema, followed by engineer confirmation and deterministic issue rules.

## Milestones

1. Add immutable database roles, verified-email authorization, password signup/login, confirmation links and password recovery. Keep legacy email-code login available.
2. Add RLS-protected manufacturer business profiles and structured machines, with private drafts and explicit publication. Manufacturers manage only their own records.
3. Store analysis metadata per designer in Supabase; scope local files by account. Offer explicit import of pre-account local projects. Do not upload drawing files or automatically claim legacy data.
4. Extract provenance-aware requirements alongside existing callouts. Allow designers to review/edit/confirm requirements. Match each machine independently with deterministic process/material/envelope/tolerance/special-requirement rules. Unknowns and inferred/unconfirmed requirements prevent a definitive compatible result.
5. Integrate matching and manufacturer profiles with the existing drawing review; verify auth flows, role protections, all new tables with two accounts, edge-case matching, and desktop/mobile UI. Update setup and deployment documentation.

## Data and access

`account_roles` is populated once by an auth-user insert trigger; client metadata is never used for authorization after registration. Existing accounts default to designer. `manufacturer_profiles` and `machines` expose only published business capabilities to verified users. `analyses` stores validated analysis JSON, including requirements, under an immutable owner. Matches are computed on demand from current declared capabilities, avoiding stale persisted capability claims. Files remain in account-scoped IndexedDB and require reattachment on another browser.

## Matching limits

Evaluate one machine at a time, in stated X/Y/Z axes; do not assume rotation, re-fixturing, subcontracting or cross-machine workflows. Specific material grades must match. Unknown specifications, inferred evidence, partial page coverage, and unspecified special requirements produce potential matches. A conflict is reported only when a confirmed explicit requirement conflicts with an explicit capability. Results never guarantee manufacturing feasibility, price, availability or acceptance.

## Implemented and verified

All five milestones are implemented. Local migrations were applied without resetting the database;
the local auth stack was restarted to load verification/recovery templates. Lint, typecheck,
27 unit tests, production build, and the expanded database/HTTP integration suite pass.
A live extraction of the public two-page fixture returned structured provenance-aware requirements
and five suggestions; missing dimensions remained unknown. Browser checks covered automatic
matching, compatible-to-potential updates, persistence after reload, manufacturer dashboard/forms
and mobile overflow. Synthetic UI accounts and their database records were removed afterward.
Private cloud file storage, concurrent editing and production-scale job/rate-limit infrastructure
remain explicitly outside this implementation; see ACCOUNTS_AND_MATCHING.md.
