# Calliper

An engineering drawing review prototype with verified designer/manufacturer accounts,
manufacturer capability profiles, and explainable equipment matching.
Built for SaaSathon with Next.js App Router, strict TypeScript, Tailwind v4, and PDF.js.

## Run from scratch

Follow these steps for the full local setup: app, database, authentication, and optional AI
drawing review. Run all commands from the repository root unless stated otherwise.

### 1. Install the prerequisites

- **Git** to clone the repository.
- **Node.js 22 or newer**, including npm.
- **pnpm 10.30.3**, the version pinned in `package.json`.
- **Docker Desktop** (or a running Docker engine) for the local Supabase services.

If pnpm is not installed:

```sh
npm install --global pnpm@10.30.3
```

Start Docker Desktop, wait for its engine to be ready, then check your tools:

```sh
node --version
pnpm --version
docker info
```

You do not need a hosted Supabase project, a Supabase account, or a separately installed
Supabase CLI. The CLI is included in this project's development dependencies.

### 2. Get the code and install dependencies

Clone **this Calliper repository**, replacing `YOUR_REPOSITORY_URL` with its Git URL:

```sh
git clone YOUR_REPOSITORY_URL calliper
cd calliper
pnpm install --frozen-lockfile
```

If you already have the code, open a terminal in its root folder and run only the install
command. This is the folder containing `package.json` and `supabase/config.toml`.

### 3. Create your local environment file

```sh
# Create it only if it does not exist; preserve any keys already added.
[ -f .env.local ] || cp .env.example .env.local
```

`.env.local` is a **file in the repository root**, not a folder. It is ignored by Git.
Keep your existing values if you are setting up an existing checkout.

### 4. Start the database and local services

With Docker running:

```sh
pnpm db:start
pnpm supabase status
```

The first start downloads Docker images, starts Postgres and the Supabase services, and
applies the committed migrations to the fresh database. It can take several minutes.
The migration in `supabase/migrations/` creates the private `ideas` table and its access
policies. There is no seed step and no reset is needed for a fresh start.

From the status output, copy the **API URL** and **publishable key** into `.env.local`.
If your local output lists an `anon` key instead, use that for the publishable-key variable.
Do not use the secret or `service_role` key in the app's public variables.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55431
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=replace-with-the-key-from-local-status

# Optional: required only for live AI drawing review.
AI_API_KEY=
AI_MODEL=gpt-6-astra
```

Replace the placeholder with your actual **local** key. Add your OpenAI key to `AI_API_KEY`
if you want AI to review uploaded drawings. Never commit the populated file.
See [AI drawing review setup and workflow](#ai-drawing-review-setup-and-workflow) for access rules.

The ports are configured in `supabase/config.toml`:

| Service           | Local address                             | Purpose                                                            |
| ----------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| App               | [localhost:3000](http://localhost:3000)   | Projects and drawing review; started in step 5                     |
| Supabase API      | [127.0.0.1:55431](http://127.0.0.1:55431) | Authentication and database API                                    |
| Postgres          | `127.0.0.1:55432`                         | Direct database connection; credentials are in local status output |
| Supabase Studio   | [127.0.0.1:55433](http://127.0.0.1:55433) | Inspect local tables and users                                     |
| Local email inbox | [127.0.0.1:55434](http://127.0.0.1:55434) | Read verification, recovery and sign-in emails                     |

**What uses the database?** Supabase stores authentication, immutable account roles, manufacturer
profiles/equipment, and each designer's analysis JSON (including requirements and review decisions).
PDF/STEP files stay in **account-scoped IndexedDB** on the device. On another browser you can see
analysis history, but must reattach the original PDF to render it. New uploads record a SHA-256
fingerprint to verify reattachment. The database and a verified account are required; the AI key
is optional for viewing uploaded drawings and manually entering requirements.

### 5. Start the app

```sh
pnpm dev
```

Keep this terminal running and open [localhost:3000](http://localhost:3000).
Signed-out visitors see the public Calliper landing page. Choose **Get started**, select Designer or Manufacturer,
and verify your email as described below. Designers land on **Projects**: choose **New analysis** to upload your first drawing. Manufacturers land on their
business onboarding/dashboard.

If port 3000 is occupied, run `pnpm dev --port 3100` and open
[localhost:3100](http://localhost:3100). Use the same hostname and port each time to access your
cached drawing files: `localhost`, `127.0.0.1`, and different ports have separate storage.
Restart the app after editing `.env.local`.

### 6. Register, verify email, and test both roles

1. Open [registration](http://localhost:3000/register), enter an email such as
   `designer@example.test`, choose **Designer**, and enter/confirm a 12–128 character password.
2. Open [the local email inbox](http://127.0.0.1:55434) and follow the verification link.
   Press **Verify email** on the confirmation page. Links expire after 10 minutes and work once;
   GET requests do not consume them, to avoid email scanner/prefetch problems.
3. You are signed in and directed to Projects. Choose **New analysis** and upload a PDF.
4. Sign out, register another email with **Manufacturer**, and verify it.
5. Fill in your business details, add named machines with their type and individual x/y/z part-size limits, then **Save business profile** and **Publish profile**. Materials, tolerance and lead times are entered once for the business. Machine changes are saved together with the profile. Saving business details never changes publication status.
6. Sign in as the designer, upload a drawing and open the drawing viewer. Manufacturer matching is separate from this page; its underlying services and manufacturer profiles remain available.

Unverified users cannot access protected routes, actions, or records. Roles cannot be changed
through profile editing or user metadata. Existing pre-migration accounts become designers.
Existing users can still sign in with a code at `/login/code`; new users must register with a role.
`/ideas` remains the protected starter example.

Use **Forgot password?** to send a recovery link to the same local inbox. Verify the link, set a
new password, then sign in again. Password hashing, token expiration, and session issuance are
handled by Supabase Auth; application code does not store passwords.

Local verification links use `auth.site_url` in `supabase/config.toml` (default
`http://localhost:3000`). If you use a different app port, change that setting and restart your
local Supabase stack with `pnpm supabase stop` then `pnpm db:start`. Restarting preserves its
local data. No external email provider is required for local development.

### Send real, branded emails

Verification, recovery, and sign-in emails use styled Calliper templates. By default,
they go to the local test inbox. To deliver to real inboxes, follow
[the Resend / SMTP setup guide](docs/EMAIL_SETUP.md): verify a sender domain, fill the
SMTP variables in `.env.local`, then run `pnpm email:configure smtp` and restart the
local stack. Other people need a deployed app URL for their email links to work.

### Upgrading an existing checkout

```sh
pnpm install --frozen-lockfile
pnpm db:start
pnpm supabase migration up --local
# Reload changed auth configuration and email templates without resetting data:
pnpm supabase stop
pnpm db:start
pnpm dev
```

Apply all committed migrations, including `20260927000000_manufacturer_machine_profiles.sql`
and `20260926010000_analysis_payload_guard.sql`, to add account tables, policies and validation.
Do **not** use `db:reset` to upgrade existing data. Existing ideas and users remain intact.
Legacy browser projects are not silently assigned to whichever account signs in first.
In Projects, use **Import drawings saved before accounts → Import my legacy projects** to
copy only your own pre-account drawings into your signed-in account. This preserves the old
local data. New account data is isolated from other users in the app and database.

### Stop and start again

Stop the app with **Ctrl+C** in its terminal. To stop this project's database services:

```sh
pnpm supabase stop
```

The normal stop command preserves local database data. On your next session, start Docker,
then run from the repository root:

```sh
pnpm db:start
pnpm dev
```

You do not need to reinstall dependencies or copy the environment file on every run.
After pulling dependency changes, run `pnpm install --frozen-lockfile` again.

### Migrations and optional local reset

To apply newly pulled migrations to an existing local database:

```sh
pnpm supabase migration up --local
```

Only if you deliberately want to **erase local users, ideas, manufacturer profiles, machines and analysis history** and rebuild from the
committed migrations:

```sh
pnpm db:reset
```

This script explicitly uses `--local`. Never reset a linked or production database. A database
reset does not clear browser-stored drawing projects. After changing the schema, regenerate
TypeScript database types with `pnpm db:types`.

### Troubleshooting

| Problem                                          | What to check                                                                                                                                                                          |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm` not found                                 | Install the pinned pnpm version from step 1, then reopen your terminal if necessary.                                                                                                   |
| Cannot connect to Docker                         | Start Docker Desktop and wait until `docker info` succeeds before `pnpm db:start`.                                                                                                     |
| First database start is slow                     | The CLI is downloading container images; check its output for download or network errors.                                                                                              |
| Database ports are already in use                | Check for another checkout using the same ports/project ID. Use the intended stack; do not stop unrelated services. The integration suite expects this repository's API on port 55431. |
| Sign-in shows setup guidance or fails to connect | Check both Supabase values in `.env.local`, run `pnpm supabase status`, and restart `pnpm dev`.                                                                                        |
| Sign-in email is missing                         | Default mode: check the local inbox on port 55434. SMTP mode: check your real inbox and provider delivery logs. See docs/EMAIL_SETUP.md.                                                                       |
| AI extraction is unavailable                     | Set `AI_API_KEY` in `.env.local` and restart the app. Check the in-app error for account-access or quota failures.                                                                     |
| Projects appear missing                          | Return to the same browser, hostname, and port. Sign into the same account for history; original files remain in the original browser.                                                 |

For the original starter's hosted deployment instructions, see
[docs/STARTER.md](docs/STARTER.md#4-deploy-your-version). Also follow the account-specific
[deployment checklist](docs/ACCOUNTS_AND_MATCHING.md#deployment) for the new migrations,
verification/recovery email templates and required confirmation setting.

## What works

The drawing page is a full-height PDF workspace with a collapsible **Detected Issues** sidebar.
Drawings initially fit the available page area, including after analysis. Selecting an issue or
annotation focuses its page and source region; **Fit** returns to the complete sheet. On narrow
screens, the issue selector and details sit below the drawing, which remains visible.

- Multi-page PDF rendering, zoom, drag-to-pan, automatic fit and page selection.
- Padded severity annotations: yellow for low, orange for medium and red for high.
- Read-only issue explanations, drawing evidence, calculations and manufacturing considerations.
  There are no confirm, resolve, dismiss or issue-status controls on the drawing page.
- **Analysis notes** retains the six-check coverage, tolerance assumptions and uncertainties.
- Validated PDF uploads up to 25 MB and 100 pages, plus optional STEP attachments up to 50 MB.
- Account-owned analysis history in Supabase; PDF/STEP files remain in account-scoped IndexedDB.
- Report preview, browser print / Save as PDF and JSON export. Historical review data remains in
  saved analyses for compatibility, but does not control which issues appear in the viewer.
- Projects with search, sorting and revisions. New accounts start empty; demo entries are excluded.
- Six-check AI drawing analysis remains unchanged: missing general tolerances use a flagged
  provisional ISO 2768-m default; a stated tolerance raises an issue only when it is tighter than
  ISO 2768-f, and is otherwise recorded as coverage. Each issue keeps its evidence and priority
  explanation.
- AI review also recommends the manufacturing processes suited to the drawing and reports the
  material it states. The project shows both above the viewer with a **Find manufacturers** link
  into the directory. Capability screening stays in the directory, not the drawing viewer.

## Real versus fixture-backed analysis

The viewer, upload validation, account persistence, issue inspection and exports are real. **AI drawing review is connected for selected pages.**

The sample uses authored inputs that correspond to explicit callouts on the included schematic
PDFs. “Verified” means checked against the authored fixture, not independently validated CAD or
engineer-approved geometry. These fixtures are retained for automated tests, but are not seeded into accounts or offered in the UI. Uploading a
drawing starts with **zero findings**. Use **Analyse drawing** to generate AI flags directly,
then inspect each issue and its evidence. Uploaded drawings never use recycled sample results.

There is no CAM simulation, tool-access proof, automated redesign, STEP geometry
parser, shared drawing-file storage, or production certification. Missing specifications are flagged
for engineer review; unreadable or unsupplied content is recorded as unassessed, not proof of absence.

### Test drawings

For manual checks, upload a PDF using **New analysis**, run **Analyse drawing**, and inspect
its findings in the viewer. Select issues on different pages, use Fit, refresh and reopen the project. Export the report using browser print or JSON download.

The supplied drawings are schematic software fixtures, **not production drawings**. Mechanical
engineering teammates must supply/validate the actual demo part, its functional requirements,
source dimensions, locations, and tooling assumptions before engineering conclusions are used.

Regenerate the committed sample PDFs with `python3 scripts/create-demo-drawings.py` (requires
`reportlab`). Their page space is 1000 × 700 PDF points, with two pages in each revision.

### Legacy sample profile

These are editable demonstration assumptions, not universal manufacturing limits or standards:

| Rule      | Candidate raised when                              |
| --------- | -------------------------------------------------- |
| Pocket    | Confirmed depth / width > 3                        |
| Hole      | Confirmed depth / diameter > 5                     |
| Corner    | Internal radius < 3 mm for a 6 mm minimum end mill |
| Tolerance | Bilateral magnitude < ±0.025 mm                    |

These rules apply to the authored samples and previous measurement extractions. The new AI review
uses the six checks and ISO size bands described below. In the legacy workflow, only reviewer-confirmed inputs are evaluated. Confirmed inch values are converted to mm for
calculations; the original units are preserved in evidence. Missing measurements, zero divisors, wrong units, and
unverified evidence are not silently converted into geometric claims. The profile's provenance
and version are attached to findings. No automatic functional-criticality assessment is made.

## Architecture

```text
Server Component loads account-owned uploaded analyses
  → client drawing workspace
    → PDF.js worker and canvas + normalized annotation overlay
    → shared selection, filters, and review state
    → owner-protected Supabase analysis JSON + account-scoped IndexedDB files
    → printable / JSON report

Authored sample measurements → deterministic configurable rules → validated findings
Uploaded PDF → selected page images + positioned text → validated Server Action
  → OpenAI six-check review → deterministic L/D and ISO tolerance calculations
  → passing tolerances → coverage record only; concerns → explained priorities
  → unverified flags / suggested markers → engineer decisions / notes / reports
```

- `components/forge/pdf-viewer.tsx`: rendering, transforms, pan, zoom, focus, page navigation.
- `components/forge/workspace.tsx`: selection, local project lifecycle, and screen composition.
- `components/forge/issue-details.tsx`: evidence and engineer review decisions.
- `components/forge/dialogs.tsx`: upload and tooling settings.
- `lib/forge/types.ts`: Zod schemas, filters, review helpers, rotation transforms.
- `lib/forge/rules.ts` and `fixture.ts`: rules and explicit sample measurements.
- `lib/forge/pdf.ts`: browser PDF engine and input validation.
- `lib/forge/storage.ts`: versioned IndexedDB storage; uploaded files are never in public URLs.

Page numbers are **one-based**. Regions use a **top-left origin on the unrotated crop box** and
0..1 x/y/width/height. The annotation layer rotates with the PDF viewport (0/90/180/270 degrees)
and shares the paper element's dimensions and scroll transform. AI flags can have suggested markers,
explicitly labelled unverified; an unlocated flag still navigates to its source page. Legacy
measurement findings require confirmed locations for markers.

Analysis metadata and requirements are stored in Supabase under the verified designer's ID.
Files stay on the device; selected page images/text are sent to OpenAI only after review
consent. The full PDF and STEP file are not uploaded. Browser storage is not a file backup.

Manufacturer business contact information and capabilities are visible to verified users only
when the owner publishes the profile. Login emails and private draft profiles are not listed.
Named machines and their individual part-size limits are shown on profiles. Existing machine-specific
materials, tolerances and additional capabilities remain stored for legacy records. The underlying
matching service still evaluates existing machine records independently using deterministic
rules. Missing values, inferred/unconfirmed requirements, incomplete page coverage, and unresolved
limitations produce **Potential match**, never a definitive compatibility claim.

See [Accounts and matching](docs/ACCOUNTS_AND_MATCHING.md) for schema, authorization,
matching rules, limitations, and hosted setup.

## Verification

With dependencies installed, run:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
# Docker must be running. Start this repository's local stack first:
pnpm db:start
pnpm test:integration
```

The integration suite builds and starts its own production server on a temporary free port,
creates temporary test users, and cleans them up. It uses the dedicated local database at
`127.0.0.1:55431` and the local email inbox; it does not use your running dev server or call
OpenAI. Keep the configured local ports for this suite.

Unit tests cover rule boundaries, incomplete/unverified evidence, coordinate bounds/rotation,
filter/selection/status behavior, revision fixtures, and file validation. Existing integration
checks exercise local Supabase CRUD, cross-account isolation, password registration/verification/recovery, legacy OTP sign-in, protected
pages, server actions, and sign-out. They reject remote database targets.

Browser verification covers PDF rendering, card-to-page navigation, marker selection, zoom/fit,
review persistence, filters, uploaded PDF persistence without fabricated findings, and reports.
The six-check provider contract is tested with mocked responses, including refusals, errors and
malformed output. ISO size boundaries, fine-before-medium precedence, inch conversion, blind-hole
calculations, consolidated passing checks and priority preservation have unit coverage. This is not a measured AI accuracy benchmark.
See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) and [docs/handoff.md](docs/handoff.md).

## AI drawing review setup and workflow

1. Set `AI_API_KEY` in `.env.local` to your OpenAI API key. It is server-only and ignored by Git.
2. The default is `gpt-6-astra`. Set `AI_MODEL` to override it with an image-capable model supporting
   Responses and structured outputs. GPT-6 models use low reasoning effort and a 10,000-token
   output budget (including reasoning). Restart the dev server after changing environment settings.
3. Create a new analysis and upload a PDF. Choose **Analyse drawing**, select 1–3 pages (include
   title block/general notes), and allow their images and text to be sent to OpenAI. API charges may apply.
4. Flags appear immediately in the issue queue and on the PDF where a source can be located. Select
   a flag, inspect the callout and calculation, add an engineer note, then **Confirm issue** or
   **Dismiss flag**. Confirmation accepts the issue; **Mark addressed** records its resolution.
5. Expand **Six-check results & analysis notes** to see coverage, tolerance calculations and unknowns.
   A stated tolerance raises **no issue** unless it is tighter than ISO 2768-f; passing and
   unevaluated callouts are listed there instead. When nothing is flagged, the issue queue says so.
   Each concern explains its priority.
6. Export the report. Re-running review explicitly replaces the previous AI results and decisions.
   Previous measurement extractions remain readable until replaced; sample tooling settings do not
   rerun the new AI review.

See [AI drawing review and tolerance rules](docs/AI_DRAWING_REVIEW.md) for the six checks, ISO
size bands, pass/flag boundaries, priority guidance and limitations.

Requests use the [Responses API](https://developers.openai.com/api/docs/guides/images-vision) and
[strict structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
Response storage is disabled with `store: false`; this is not a zero-retention guarantee. See
[OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data).

### Access and limits

- All AI review requests require a verified **designer** and an owned, saved analysis.
  Every designer can use AI as soon as their email is verified, in local and deployed environments.
  No per-account allowlist is required; the former `AI_ALLOWED_USER_IDS` setting is ignored and can
  be removed from Vercel. Anonymous, unverified and manufacturer accounts cannot run AI review.
- Prototype limits: 3 pages per request, page images up to 1600 px (up to 1 MB base64 each),
  at most 500 embedded text spans / 40,000 text characters per page, up to 24 observations per check,
  120-second provider timeout, 2 concurrent requests and 20 requests/hour per server process.
- The limiter is in memory and resets on restart. Use a durable shared limiter and a background
  job queue before scaling deployment. Provider errors/refusals/timeouts retain the old analysis
  and offer a retry; no partial response is treated as verified evidence.
- Text-referenced regions are grounded to PDF text spans. Scans can use visual extraction, but
  estimated locations remain unverified. All dimensions, units and feature associations require
  reviewer confirmation. Handwritten, crowded, rotated-text and low-resolution drawings need
  additional real-world validation. A missing finding is not a manufacturing pass.

Implementation: `lib/forge/openai-extractor.ts` is the provider adapter; `app/actions/extract-drawing.ts`
validates ownership; `lib/forge/drawing-review.ts` validates and grounds
flags; `lib/forge/iso-tolerances.ts` calculates thresholds. `components/forge/drawing-review.tsx` provides page selection and
coverage. Review metadata and decisions use the existing owner-protected analysis JSON (no migration).
No API keys or page-image payloads are persisted in analysis records. Full manufacturer matching
continues to use independently reviewed requirements. AI drawing review does not query shop capabilities.

## Next milestone

Validate on engineering-team CNC drawings and tune extraction based on measured accuracy. Add
private cloud drawing-file storage, then durable analysis jobs and shared rate limits. Add STEP geometry only after the drawing workflow and
rules have engineering validation.

### Manufacturer discovery

Signed-in users can browse **Manufacturers** at `/manufacturers`, next to Projects.
The directory reads published business profiles and their machines from Supabase, with combined
search, process, material, machinery and location filters. Profiles show business contact details,
capabilities, capacity notes and each machine's stored specifications. Logo placeholders use company
initials; the current registration schema does not collect logos or websites.

Private drafts are excluded from discovery. Owners can preview their own unpublished profile;
other users cannot read it. Login emails and authentication metadata are never used as business
contact information.
No additional database migration is required for the directory beyond the existing manufacturer migrations.

#### Arriving from a project

**Find manufacturers** on a reviewed project opens
`/manufacturers?processes=<ids>&project=<analysis id>`. Unsupported process identifiers in the
query are discarded. The project name, revision, material and tightest reviewed tolerance are read
from the signed-in owner's saved analysis, never from the query string, so a link cannot place
arbitrary text in the banner; a viewer who does not own that analysis simply sees the plain
directory.

A business appears when it declares **any** recommended process, and each card states whether it
offers every recommended process or only some of them. Alternatives satisfy a required process
without a manufacturer having to offer every alternative. Process filters are individually
removable, more can be added, and the search, material, machinery and location filters are
unchanged.

Each card also reports the material. The required material is the grade stated on the drawing, or
the project's own material setting when the drawing states none, and the banner says which. Because
businesses commonly declare a family such as `Aluminium` while a drawing states `Aluminium 6061-T6`,
a declared value matches when it leads the required one in either direction: `Aluminium` covers
`Aluminium 6061-T6` as a **family** match asking for grade confirmation, while `Steel` never covers
`Stainless steel 304`. An exact grade reads as declared, an empty material list reads as
undeclared, and neither is treated as capability. Results rank by process coverage first, then
material.

Tolerance and working-envelope suitability remain listed as **needs confirmation**: declared
capability is not a quote or a commitment. Opening `/manufacturers` directly still lists every
published profile with no project filters.
