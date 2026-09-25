# ForgeCheck implementation plan

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
- Retain the original authenticated ideas example at `/ideas`; ForgeCheck lives at `/`.

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
