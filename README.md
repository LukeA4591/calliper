# ForgeCheck

A working local prototype for reviewing potential manufacturing concerns in PDF drawings.
Built for SaaSathon with Next.js App Router, strict TypeScript, Tailwind v4, and PDF.js.

## Run from scratch

Follow these steps for the full local setup: app, database, authentication, and optional AI
extraction. Run all commands from the repository root unless stated otherwise.

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

Clone **this ForgeCheck repository**, replacing `YOUR_REPOSITORY_URL` with its Git URL:

```sh
git clone YOUR_REPOSITORY_URL forgecheck
cd forgecheck
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

# Optional: required only for live drawing extraction.
AI_API_KEY=
AI_MODEL=gpt-6-astra

# Leave empty for development on localhost.
AI_ALLOWED_USER_IDS=
```

Replace the placeholder with your actual **local** key. Add your OpenAI key to `AI_API_KEY`
if you want to extract measurements from uploaded drawings. Never commit the populated file.
See [AI extraction setup and workflow](#ai-extraction-setup-and-workflow) for access rules.

The ports are configured in `supabase/config.toml`:

| Service           | Local address                             | Purpose                                                            |
| ----------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| App               | [localhost:3000](http://localhost:3000)   | Projects and drawing review; started in step 5                     |
| Supabase API      | [127.0.0.1:55431](http://127.0.0.1:55431) | Authentication and database API                                    |
| Postgres          | `127.0.0.1:55432`                         | Direct database connection; credentials are in local status output |
| Supabase Studio   | [127.0.0.1:55433](http://127.0.0.1:55433) | Inspect local tables and users                                     |
| Local email inbox | [127.0.0.1:55434](http://127.0.0.1:55434) | Read development sign-in codes                                     |

**What uses the database?** `/login` and `/ideas` use Supabase. ForgeCheck drawing projects,
PDF/STEP files, and review decisions currently live in the browser's IndexedDB. Starting the
database does not upload or sync those projects. The sample drawing viewer can also run without
Supabase or an AI key; the steps above set up the complete development environment.

### 5. Start the app

```sh
pnpm dev
```

Keep this terminal running and open [localhost:3000](http://localhost:3000).
You should land on **Projects**. Open **Precision mounting bracket** to view the sample drawing,
or choose **New analysis** to upload a PDF. Use **Projects** to return to the library.

If port 3000 is occupied, run `pnpm dev --port 3100` and open
[localhost:3100](http://localhost:3100). Use the same hostname and port each time to see your
saved browser projects: `localhost`, `127.0.0.1`, and different ports have separate storage.
Restart the app after editing `.env.local`.

### 6. Verify database and sign-in setup

1. Open [the sign-in page](http://localhost:3000/login).
2. Enter an email such as `developer@example.test` and request a code.
3. Open [the local email inbox](http://127.0.0.1:55434), find the message, and copy the six-digit code.
4. Enter the code in the app. First sign-in creates a local account and opens `/ideas`.
5. Create an idea, edit it, and refresh to confirm it persists in the database.

These emails are captured locally; an external email provider is not required. If you chose
another app port, use that port for `/login` too. Drawing review at `/` does not require signing
in during local development.

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

Only if you deliberately want to **erase local database users and ideas** and rebuild from the
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
| Sign-in email is missing                         | Use the local inbox on port 55434, not your real mailbox; request a fresh code if it expired.                                                                                          |
| AI extraction is unavailable                     | Set `AI_API_KEY` in `.env.local` and restart the app. Check the in-app error for account-access or quota failures.                                                                     |
| Projects appear missing                          | Return to the same browser, hostname, and port. Drawings are stored locally in that browser, not in Supabase.                                                                          |

For the original starter's hosted deployment instructions, see
[docs/STARTER.md](docs/STARTER.md#4-deploy-your-version). Those instructions cover the auth/ideas
backend; they do not add shared storage for ForgeCheck drawings.

## What works

The workspace uses compact top navigation, a large drawing surface and a readable inspector.
For uploaded drawings, **Measurements** contains the suggestion selector, confirmation forms,
and **Coverage & notes**. **Findings** contains the issue list, filters and review decisions.
**Analysis information** retains file metadata and attachment details; each finding's
**Rule, assumptions & limitations** section retains its full technical context.

- Real multi-page PDF rendering, zoom, drag-to-pan, fit, and page selection.
- Numbered annotations stored as normalized page coordinates. Markers, issue cards, and the
  details panel share one selection; selecting a finding focuses its source page and region.
- Evidence, explicit measurements, rule ID, profile threshold, manufacturing implication,
  suggested review, and uncertainty for each sample finding.
- Severity/status filters, next/previous issue, addressed/dismissed/reopen decisions.
- Validated PDF uploads: extension, MIME when supplied, signature, 25 MB limit, parseability,
  unlocked documents, and a maximum of 100 pages. Errors appear in the upload dialog.
- Optional STEP Part 21 attachments up to 50 MB. They are stored only; no 3D analysis occurs.
- Projects, PDF/STEP files, page dimensions/rotation, settings, and review status in IndexedDB.
- Editable material and demo tooling thresholds. Profile updates rerun confirmed-input rules and reset
  review decisions for those regenerated findings.
- Report preview, browser print / Save as PDF, and structured JSON report download. Reports
  contain all findings, including filtered-out or dismissed items. Source PDF remains separate.
- Searchable Projects library with source/status filters, sorting, revisions, and original/revised fixture drawings.
- OpenAI page extraction, suggested source previews, editable measurement/units confirmation,
  rejection, original evidence history, and findings generated only from confirmed inputs.

## Real versus fixture-backed analysis

The viewer, upload validation, local persistence, configurable deterministic checks, review
workflow, and exports are real. **OpenAI drawing extraction is connected for selected pages.**

The sample uses authored inputs that correspond to explicit callouts on the included schematic
PDFs. “Verified” means checked against the authored fixture, not independently validated CAD or
engineer-approved geometry. The UI and reports label the analysis as a sample. Uploading any
other drawing starts with **zero findings**. Extract callouts and confirm their measurements to
generate checks from that drawing, never recycled sample results.

There is no CAM simulation, tool-access proof, automated redesign, STEP geometry
parser, shared project storage, or production certification. The missing/ambiguous-specification
check is deferred until extraction and context are available; a missing finish note is not
silently treated as an error.

### Reproducible demo

1. From Projects, open the revision A sample: four candidate concerns across two PDF pages.
2. Select a marker or card, inspect its dimensions and rule, and use fit/zoom/pan.
3. Select the locating tolerance card to navigate to page 2.
4. Mark a finding addressed, refresh, reopen it from Projects, and confirm the saved status.
5. Open Projects → Open revised sample. Revision B changes pocket width/depth, internal radius,
   and hole diameter/depth; only the locating tolerance still crosses the default profile.
6. Export the report. Use browser print to save a PDF, or download JSON.

The supplied drawings are schematic software fixtures, **not production drawings**. Mechanical
engineering teammates must supply/validate the actual demo part, its functional requirements,
source dimensions, locations, and tooling assumptions before engineering conclusions are used.

Regenerate the committed sample PDFs with `python3 scripts/create-demo-drawings.py` (requires
`reportlab`). Their page space is 1000 × 700 PDF points, with two pages in each revision.

### Initial profile

These are editable demonstration assumptions, not universal manufacturing limits or standards:

| Rule      | Candidate raised when                              |
| --------- | -------------------------------------------------- |
| Pocket    | Confirmed depth / width > 3                        |
| Hole      | Confirmed depth / diameter > 5                     |
| Corner    | Internal radius < 3 mm for a 6 mm minimum end mill |
| Tolerance | Bilateral magnitude < ±0.025 mm                    |

Only reviewer-confirmed inputs are evaluated. Confirmed inch values are converted to mm for
calculations; the original units are preserved in evidence. Missing measurements, zero divisors, wrong units, and
unverified evidence are not silently converted into geometric claims. The profile's provenance
and version are attached to findings. No automatic functional-criticality assessment is made.

## Architecture

```text
Server Component supplies typed sample analysis
  → client drawing workspace
    → PDF.js worker and canvas + normalized annotation overlay
    → shared selection, filters, and review state
    → IndexedDB projects keyed by analysis ID
    → printable / JSON report

Authored sample measurements → deterministic configurable rules → validated findings
Uploaded PDF → selected page images + positioned text → validated Server Action
  → OpenAI structured extraction → unverified suggestions + source previews
  → reviewer confirmation → deterministic checks → markers / details / reports
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
and shares the paper element's dimensions and scroll transform. Findings without verified
locations can remain in the issue list but have no drawing marker.

Browser-local persistence is intentionally the first prototype boundary. Data is tied to this
browser and origin, is not account-isolated, and can be lost when site data is cleared. Avoid
using this prototype as the only copy of a drawing. Selected page images and text are transmitted
to OpenAI only after the extraction consent step. The full PDF and STEP file remain local.
The original authenticated Supabase server reads/actions remain intact. No new public tables
were introduced, and no production database migration is required for this milestone.

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
checks exercise local Supabase CRUD, cross-account isolation, OTP signup/sign-in, protected
pages, server actions, and sign-out. They reject remote database targets.

Browser verification covers PDF rendering, card-to-page navigation, marker selection, zoom/fit,
review persistence, filters, uploaded PDF persistence without fabricated findings, and reports.
Live verification extracted all four expected feature types from the included two-page sample.
Browser checks also cover confirmation, rejection, separate source-location approval, saved
extraction state, and report coverage.
See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) and [docs/handoff.md](docs/handoff.md).

## AI extraction setup and workflow

1. Set `AI_API_KEY` in `.env.local` to your OpenAI API key. It is server-only and ignored by Git.
2. The default is `gpt-6-astra`. Set `AI_MODEL` to override it with an image-capable model supporting
   Responses and structured outputs. GPT-6 models use low reasoning effort and a 10,000-token
   output budget (including reasoning). Restart the dev server after changing environment settings.
3. Create a new analysis and upload a PDF. Choose **Extract with AI**, select 1–3 pages, and allow
   their rendered images and embedded text to be sent to OpenAI. API charges may apply.
4. Open **Measurements** and choose a suggestion from the selector (or use its arrow buttons).
   Inspect its source preview, edit dimensions/units/callout if
   needed, and confirm. Confirm the highlighted location separately to include a finding marker.
   Reject incorrect feature associations; a missing/ambiguous value cannot silently become a finding.
5. Review findings and export. Settings reruns confirmed measurements against the updated profile.
   Extracting again explicitly replaces the previous extraction and its review decisions.

Requests use the [Responses API](https://developers.openai.com/api/docs/guides/images-vision) and
[strict structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
Response storage is disabled with `store: false`; this is not a zero-retention guarantee. See
[OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data).

### Access and limits

- Same-origin localhost **development** requests can extract without signing in.
- Outside localhost development, sign in through `/login` and configure `AI_ALLOWED_USER_IDS`
  with the comma-separated verified Supabase IDs permitted to spend this API key's quota.
  The allowlist defaults to empty. Anonymous production requests and non-allowlisted accounts fail.
- Prototype limits: 3 pages per request, page images up to 1600 px (up to 1 MB base64 each),
  at most 500 embedded text spans / 40,000 text characters per page, 24 extracted features,
  120-second provider timeout, 2 concurrent requests and 20 requests/hour per server process.
- The limiter is in memory and resets on restart. Use a durable shared limiter and a background
  job queue before scaling deployment. Provider errors/refusals/timeouts retain the old analysis
  and offer a retry; no partial response is treated as verified evidence.
- Text-referenced regions are grounded to PDF text spans. Scans can use visual extraction, but
  estimated locations remain unverified. All dimensions, units and feature associations require
  reviewer confirmation. Handwritten, crowded, rotated-text and low-resolution drawings need
  additional real-world validation. A missing finding is not a manufacturing pass.

Implementation: `lib/forge/openai-extractor.ts` is the provider adapter, `app/actions/extract-drawing.ts`
is the server boundary, `lib/forge/extraction.ts` validates/grounds/confirms data, and
`components/forge/extraction-review.tsx` provides the page/consent/measurement review UI.
No API keys or page-image payloads are persisted in project records. Original extracted evidence
is retained alongside confirmed edits in JSON exports.

## Next milestone

Validate on engineering-team CNC drawings and tune extraction based on measured accuracy. Add
account-isolated document storage with migrations, grants/RLS and two-account tests, then durable
analysis jobs and shared rate limits. Add STEP geometry only after the drawing workflow and
rules have engineering validation.
