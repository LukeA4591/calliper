# ForgeCheck

A working local prototype for reviewing potential manufacturing concerns in PDF drawings.
Built for SaaSathon with Next.js App Router, strict TypeScript, Tailwind v4, and PDF.js.

## Run locally

Requires Node.js 22+ and pnpm 10.30.3.

```sh
pnpm install
pnpm dev
```

Open http://localhost:3000. The ForgeCheck workspace and demo need **no environment variables,
AI keys, database, or paid services**. If port 3000 is occupied, use `pnpm dev --port 3100`.
Do not replace another running development server.
Live drawing extraction requires `AI_API_KEY`; see the setup section below.

The original Supabase email-code sign-in and private ideas example remain at `/login` and
`/ideas`. Their setup, migrations, local ports, and deployment instructions are preserved in
[docs/STARTER.md](docs/STARTER.md). `.env.example` contains only public placeholders.

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
- Dashboard/project list and original/revised fixture drawings.
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

1. Open the default revision A sample: four candidate concerns across two PDF pages.
2. Select a marker or card, inspect its dimensions and rule, and use fit/zoom/pan.
3. Select the locating tolerance card to navigate to page 2.
4. Mark a finding addressed, refresh, and confirm the saved status after local restoration.
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

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
# Requires this starter's dedicated local Supabase Docker stack:
pnpm test:integration
```

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
2. Optional: `AI_MODEL=gpt-4.1-mini` overrides the default. Use an image-capable model supporting
   Responses and structured outputs. Restart the dev server after changing environment settings.
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
  60-second provider timeout, 2 concurrent requests and 20 requests/hour per server process.
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
