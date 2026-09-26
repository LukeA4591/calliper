# Accounts, capabilities and manufacturer matching

## Journeys

- **Designer:** register → verify email → Projects → upload PDF → extract/confirm callouts → review manufacturing requirements → inspect manufacturer matches.
- **Manufacturer:** register → verify email → save business draft → add equipment → publish → maintain business/equipment from the dashboard.

The app uses Supabase Auth with password signup/login, expiring one-use verification/recovery
links, SSR session cookies, logout and password reset. Every protected server entry checks the
live user and `email_confirmed_at`. Business access is also enforced at the database boundary.
The legacy email-code sign-in remains for existing accounts at `/login/code`; it does not create
new role-less accounts. Confirmation is a POST after opening the email link, so ordinary GET
prefetches do not consume tokens. Passwords are handled by Supabase, never stored by Calliper.

## Database migration

Apply `supabase/migrations/20260926000000_accounts_manufacturers.sql` with
`pnpm supabase migration up --local` for development. This is additive and backfills existing
accounts as designers. The following `20260926010000_analysis_payload_guard.sql` migration
adds an explicit required-ID constraint to analysis JSON. Apply all migrations; do not reset existing data.

| Table                   | Purpose and access                                                                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `account_roles`         | One immutable role per auth user; populated by a signup trigger. Verified users read only their own role; no client writes.                                                                         |
| `manufacturer_profiles` | Business contact information, processes/materials, optional business-wide constraints, publication flag. Only manufacturers modify their own profile. Other verified users read published profiles. |
| `machines`              | Named equipment, category, process/material lists, nullable X/Y/Z and tolerance limits, special capabilities and notes. Owner-only mutations; visibility follows profile publication.               |
| `analyses`              | Validated analysis JSON, including extracted requirements and reviewed edits, keyed by owner and analysis ID. Designer-only, owner-only access.                                                     |

Every table has grants and RLS; owner IDs cannot be updated. The verified-role helper consults
`auth.users` and `account_roles`, not user-editable metadata. Changing `account_type` metadata
later does not change a role. New roles require a deliberate, trusted administrative migration.
No login email is included automatically in the published business contact fields.

Requirements are embedded in analysis JSON, not duplicated in a separate table. Matches are
computed on demand against current published machines rather than saved as stale promises.
The server validates all action inputs and derives the owner from authentication. Save requests
also reject a changed account context, preventing an old browser tab from writing into a newly
signed-in account. There is no service-role client in the application.

## Files and existing data

Analysis history and review decisions sync to the account. PDF/STEP files stay in an IndexedDB
namespace for that user. On another browser/device, reattach the original PDF to render it.
New PDFs have a SHA-256 fingerprint; older records use filename and page-dimension checks and
should be manually checked against their existing annotations. STEP remains an attachment only.

Old unscoped projects remain available through an explicit **Import my legacy projects** action.
Do not import another person's legacy data from a shared browser. Existing files are not deleted
and are not automatically attributed to the first new account. Account-scoped local copies are
kept if a cloud save fails; the UI offers a retry. This is a prototype, not a concurrent editing
system; avoid editing the same analysis from multiple devices at once.

## Requirements and matching rules

All matching dimensions and bilateral tolerance magnitudes use **mm**. Each requirement has a
source (`explicit`, `inferred`, `unknown`), quote/review note, page, and confirmation flag.
The model cannot mark requirements confirmed or claim full coverage. A human reviews the fields
and complete drawing coverage in the matching section. Legacy analyses start with unknown
requirements until extraction or manual review; project defaults are not drawing evidence.

For each machine, the engine evaluates:

1. At least one required process alternative must appear in its declared process list and any
   business-wide process list. Machine category alone does not imply a capability.
2. The exact material/grade must be listed on the machine and in any business-wide material list.
   Case/spacing and aluminium/aluminum spelling are normalized; grades and tempers are retained.
3. Each overall part axis must fit the corresponding known machine envelope and any smaller
   business-wide limit. Business limits do not fill unknown machine limits. No rotations,
   multi-setup strategies or envelope combinations are assumed.
4. The machine's smallest achievable ± tolerance must be less than or equal to the requested
   magnitude. A less precise business-wide limit also applies. Unknown values need confirmation.
5. Geometric features and special requirements need matching structured capability declarations.
   Missing special-capability declarations are unknown, not proven impossibilities.
6. Inferred/unconfirmed requirements, missing fields, partial page coverage, unresolved drawing
   notes and free-text business/machine limitations require confirmation. Free text is never
   treated as an automatically satisfied constraint.

**Compatible:** all mandatory fields are known, explicit and confirmed, complete coverage is
confirmed, and one machine satisfies all constraints without unresolved notes.
**Potential match:** there is no confirmed contradiction, but some requirement/capability needs
confirmation. A published business with no equipment can only be potential.
**Not compatible:** every machine has at least one confirmed explicit conflict. Results explain
which constraint conflicts; contradictory unconfirmed model suggestions remain potential.

A manufacturer's result is the best individual machine result. Separate machine capabilities
are never combined into one operation. A 5-axis category does not silently imply a declared
3-axis process. Availability/capacity notes, price, production schedules, certifications, tool
reach, fixtures, GD&T and surface finish are not quantitatively verified. Unsupported drawing
requirements belong in unresolved notes so they block a definitive compatible result.

The matching panel shows compatible/potential candidates and their machine explanations, with
excluded results in a separate disclosure. Profiles open in a new tab to preserve drawing
context. All matches are preliminary and based on manufacturer-declared information, not a
guarantee of manufacturability, availability, price, or willingness to accept a job.

## Deployment

1. Apply the committed migrations to your approved Supabase database (do not reset it).
2. Enable email signup and **Require email confirmation**. Use a minimum password length of 12;
   keep a short OTP/link expiry (local configuration: 600 seconds).
3. Set Auth **Site URL** to the exact HTTPS application origin. Locally this is configured in
   `supabase/config.toml`; changes require a local stack restart, preserving data.
4. Copy `supabase/templates/confirmation.html` into **Confirm signup** and
   `supabase/templates/recovery.html` into **Reset password**. Keep `TokenHash`, `SiteURL` and the
   specified `type` query parameters. Use `magic-link.html` for the legacy code login template.
5. Configure your approved SMTP service for deployed email and retain provider rate limits.
6. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and optional server-only
   `AI_API_KEY` / `AI_MODEL`. Outside same-origin localhost development, `AI_ALLOWED_USER_IDS`
   must explicitly list designers permitted to spend the extraction key's quota. Even on
   localhost, extraction requires a verified designer and an owned analysis record.
7. Exercise both roles, verification, logout, recovery and two-account isolation before launch.

No additional paid service is provisioned by this implementation. Public production operation
still needs durable shared rate limits, abuse controls and private file storage appropriate to
real engineering drawings. The existing extraction cap is in-process (2 concurrent, 20/hour).

Auth implementation follows the [Supabase password flow](https://supabase.com/docs/guides/auth/passwords)
and [email-template guidance](https://supabase.com/docs/guides/auth/auth-email-templates).

## Verification

`pnpm test` covers request validation, evidence grounding, deterministic findings, matching
boundaries, unsupported grades/processes, missing values, insufficient tolerances, partial
coverage, inferred requirements and refusal to pool machine capabilities.

`pnpm test:integration` uses only the configured dedicated local Docker database. It verifies
all new tables with two accounts, anonymous access denial, role immutability even after metadata
changes, manufacturer draft/publication isolation, machine CRUD, analysis ownership, password
registration, verification/replay rejection, role routing, persistent cookies, actual onboarding
forms, machine edits, published profile viewing and email recovery through real Server Actions.
Temporary users and data are removed. No external emails or AI requests are sent by this suite.
