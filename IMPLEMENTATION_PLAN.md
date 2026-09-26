# Calliper implementation plan

The supplied `handoff.md` is the product brief. The existing Next.js App Router,
strict TypeScript, Tailwind, shared controls, and Supabase auth remain the foundation.

## Milestone 1 — drawing review vertical slice

- Real PDF.js rendering with fit, zoom, drag to pan, page selection, and page-relative annotations.
- A reproducible two-page aluminium bracket fixture, four evidence-backed candidate findings,
  and a revised drawing. Fixture extraction is explicitly labelled, never attributed to AI.
- One selected finding shared by numbered markers, issue cards, and the details panel.
- Severity/status filtering, open/addressed/dismissed review, and configurable demo tooling.

## Milestone 2 — usable local workflow

- Validate PDF extension, signature, size, and successful parsing before project creation.
- Store uploaded PDFs, optional STEP attachments, page metadata, settings, and findings in
  IndexedDB by analysis ID. No customer documents are uploaded to a service in this milestone.
- Show projects, restore after refresh, report persistence failures, and provide print/PDF export.
- Retain the original authenticated ideas example at `/ideas`; Calliper lives at `/`.

## Milestone 3 — verification and handoff

- Test rule boundaries, incomplete evidence, normalized coordinates, selection/filter/status behavior.
- Exercise the actual viewer, upload failures, page changes, zoom, and persistence in a browser.
- Run lint, typecheck, unit tests, production build, and local integration tests if Docker is available.
- Document real, fixture-backed, and deferred capabilities.

## Explicit decisions and subsequent work

Browser storage is a pragmatic local prototype boundary. It is not shared account storage and is
not a replacement for secured production persistence. No new public database tables are needed.
The PDF canvas and IndexedDB access necessarily run in client components; sample data is supplied
from a Server Component. Existing authenticated server reads and actions retain their boundaries.

Arbitrary uploads receive a viewer and an honest empty analysis state, never the sample findings.
Backend extraction, an authenticated document store, provider consent, async jobs, real tooling
validation, and STEP geometry analysis follow after this interaction contract is proven. The
initial numerical thresholds are editable demo assumptions requiring mechanical engineer review.

## Completed milestone verification

The first two milestones and verification milestone are complete for the local prototype.

- `pnpm lint`, `pnpm typecheck`, `pnpm test` (9 tests), and `pnpm build` pass.
- `pnpm test:integration` passes against the existing dedicated local Docker Supabase stack.
- Browser checks: sample PDF rendering, page-2 card navigation, marker-to-details selection,
  centered source focus, zoom alignment, severity/status state, review restoration, real PDF
  upload and restoration, zero fabricated upload findings, corrupt-PDF recovery, revised
  sample findings, and report preview with current statuses.
- Laptop (1366 × 900) and narrow (390 × 844) layouts inspected; no horizontal page overflow.
- Both pages of both authored sample PDFs rendered and visually reviewed.

Remaining work is the subsequent authenticated-storage/extraction phase described above.
Printing uses the browser's print / Save as PDF facility; JSON export is also available.

## Milestone 4 — live extraction and engineer confirmation

1. Add a bounded OpenAI Responses adapter behind a validated Server Action. Keep the key on
   the server, use structured outputs, explicit page consent, a timeout, and request limits.
   Local development is usable without sign-in; production requires a verified, allowlisted account.
2. Render up to three selected PDF pages and extract positioned text in the browser. Send only
   those page images/text after consent. Treat every returned measurement/location as unverified.
3. Add source previews and editable confirmation. Only confirmed dimensions enter deterministic
   checks; locations require separate confirmation before a finding receives a drawing marker.
4. Persist suggestions, decisions, extraction coverage and provenance locally. Update reports,
   settings recalculation, and error/retry states. Preserve the existing fixture workflow.
5. Verify contracts and failure cases, run all repository checks, then exercise an actual API
   extraction of the public sample through the browser. No customer file is used for testing.

This milestone uses bounded requests (three pages, 60 seconds); durable background jobs and
account-isolated file storage remain the next deployment milestone. No database schema changes.

### Milestone 4 verification complete

- Live OpenAI extraction of the authored two-page PDF returned the four expected feature types.
- Browser verified text-grounded source previews, page-2 navigation, explicit measurement and
  location confirmation, rejection/reconfirmation, an unlocated finding, all four rule outputs,
  marker-to-details selection, addressed status after refresh, and report provenance/coverage.
- Confirmation panel checked at laptop width and narrow layout; no horizontal overflow at 390 px.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` (18 tests), `pnpm build`, and
  `pnpm test:integration` pass. Integration tests use only the dedicated local Supabase stack.
- `.env.local` remains ignored; the configured key is absent from generated browser assets.
- Remaining validation: engineering-team drawings, scanned/rotated real-world accuracy, and
  production storage/jobs/shared limiting. The three-page prototype scope remains explicit.

## Milestone 5 — minimal workspace redesign

- Replace the dark sidebar and repeated decorative containers with compact top navigation,
  neutral surfaces, larger typography, and more space for the drawing and inspector.
- Separate Measurements and Findings views. Use one measurement selector with previous/next
  controls and a flat findings list. Preserve every dimension, source, status and action.
- Keep file/attachment metadata, extraction coverage/notes, and rule assumptions accessible
  in labelled disclosures. Retain report export, settings, project navigation and local storage.
- Apply the same visual language to upload/extraction/settings dialogs and project lists.

Verified at desktop and 390 px mobile widths with no horizontal overflow. Browser checks cover
measurement selection/page navigation, editing and confirmation, findings filters, saved reviews,
coverage notes, empty uploaded drawings, consent controls, and project navigation. Lint, strict
typecheck, all 18 tests, production build and dedicated local Supabase integration checks pass.

## Milestone 6 — project-based manufacturer recommendations

- The six-check review also returns a `manufacturing` plan: a summary plus up to eight process
  recommendations with a role (primary / secondary / alternative), an evidence-based reason and
  limitations. Identifiers are the database process enum, so AI output, storage and directory
  filters share one definition; readable names come from `processLabels`, never from model text.
- The plan is stored inside the review, so it persists with the analysis and is replaced on rerun.
  It is optional: analyses reviewed before this milestone load unchanged with no plan.
- A compact band above the drawing lists the recommended processes and links to the directory.
  Manufacturer capability screening stays out of the drawing viewer.
- `/manufacturers?processes=<ids>&project=<id>` filters the directory to those processes. Unsupported
  identifiers are discarded, and the project name, material and tolerance are read from the owner's
  saved analysis rather than the query string. The directory keeps its own behaviour when opened
  directly.
- A business qualifies by declaring any recommended process and is labelled a full or partial
  capability match; alternatives substitute for a missing required process. Material, tolerance and
  envelope suitability are shown as needing confirmation, never asserted from a declared profile.

- The plan also reports the material stated on the drawing. The directory shows the required
  material, its source (drawing or project setting), and each business's material verdict. Family
  declarations cover drawing grades in either direction and ask for grade confirmation; unrelated
  families and empty material lists never read as capability. Ranking is process coverage, then
  material.

No schema change and no RLS change: the plan travels inside the existing `analyses.data` payload and
the directory reads the same published profiles as before. Lint, strict typecheck, 51 tests and the
production build pass; directory matching was exercised against the 16 published local profiles.
