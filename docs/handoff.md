# ForgeCheck — Codex Project Handoff

## Your role

You are the implementation agent for **ForgeCheck**, a SaaSathon prototype of an AI-assisted Design for Manufacturing (DFM) review platform. Read this document first, inspect the repository, then build the smallest credible end-to-end product. Make pragmatic implementation choices, explain trade-offs, and do not claim an engineering capability that has not actually been implemented.

## 1. Product vision

ForgeCheck helps engineers identify **potential manufacturing problems before sending a design to production**. A user uploads a 2D engineering drawing (PDF); optionally, they can also upload a 3D STEP/STP CAD model. They select a manufacturing process, initially **3-axis CNC milling**, and receive an interactive, annotated drawing with evidence-backed findings and suggested changes.

The question ForgeCheck answers is: **“What about this design may be difficult, expensive, or impractical to manufacture with the selected process and tooling?”** It is a preliminary review aid, not a substitute for engineering sign-off, CAM simulation, machining quotes, or inspection planning.

Context: This is being developed for the LuminLabs SaaSathon at the University of Canterbury. The team includes software engineers, mechanical engineers, and lawyers. The prototype should demonstrate a real engineering workflow, not merely a generic chatbot that comments on a PDF. The product should be credible as a future B2B SaaS for engineering consultancies, machine shops, and manufacturers.

## 2. Scope and product decisions

### MVP: build this first

- PDF engineering drawing upload is **required**.
- STEP/STP upload is **optional** and should not block the PDF-only flow.
- One process: **3-axis CNC milling**.
- Process settings: material (user-selectable/confirmed), tool library/profile (initially a simple configurable standard-tooling profile), and units.
- Render the uploaded PDF in an interactive drawing viewer.
- Analyse drawing content and generate **structured, evidence-backed candidate findings**.
- Show selectable issue markers on the drawing and corresponding issue cards/details.
- Allow an engineer to mark a finding as addressed, dismiss it, or leave it open. Preserve status in the session/persistent project data.
- Export a clear DFM report, ideally PDF after the core experience works.
- Have a convincing, reproducible demo with a deliberately problematic CNC bracket drawing and a revised version.

### Do not build in the first pass

- Full CAM simulation, toolpath generation, machining-time or price guarantees.
- General-purpose support for every manufacturing process.
- Automatic redesign or editing of source CAD.
- Unsupported claims of reliable 3D feature recognition or tool accessibility from PDF images.
- Complex multi-tenant billing, enterprise permissions, or integrations before the core demo works.

### Future direction

Use STEP geometry for measurable 3D feature analysis and better tool-access reasoning; combine this with drawing-derived tolerances, notes, and manufacturing intent. Eventually allow machine shops to configure real machine envelopes, tools, materials, and capabilities. Sheet metal, injection moulding, and casting are later extensions, not MVP scope.

## 3. Main user journey

1. Open dashboard and create a new analysis/project.
2. Upload PDF drawing; optionally attach a STEP/STP model.
3. Select/confirm CNC milling (3-axis), material, units, and tooling profile.
4. Start analysis; display progress and actionable errors.
5. View the drawing with overlaid, numbered, color-coded issue markers.
6. Click a marker or issue card: select the same finding, focus/zoom to the relevant drawing area, and show the detailed explanation.
7. Read observed evidence, dimensions, assumption/confidence, manufacturing implication, suggested action, and source location.
8. Mark addressed or dismiss; filter by severity/status and move between issues.
9. Export a report with findings and their review status.

## 4. UI design direction

Professional engineering SaaS, not a chat interface. The previously agreed visual concept has:

- Dark left navigation rail: ForgeCheck branding, Dashboard, Projects, Drawing Analysis, 3D Viewer (disabled/placeholder until implemented), Reports, Settings.
- Top breadcrumb: Projects > [part] > [revision] > Drawing Analysis; actions for Export Report and New Analysis.
- Large central PDF drawing canvas with pan, zoom, fit, page selection, and selectable annotation markers.
- Right-hand selected-issue panel with severity, title, description, measured/extracted values, why it matters, recommended actions, references/evidence, and status actions.
- Bottom horizontal list of issue cards, with selected state, severity, short description, and click-to-focus behavior.
- Process settings visible in a sidebar or compact settings panel.
- Optional Drawing / 3D Model tabs, but do not present a functioning 3D viewer unless it is implemented.

Use a restrained light workspace, dark sidebar, clear typography, and red/amber/blue severity accents. Selected state must be obvious. The PDF itself should be the main visual element. Responsive behavior should remain usable on laptop screens.

### Interaction contract

- Clicking a marker selects the corresponding issue and scrolls/focuses its card/details.
- Clicking an issue card selects it and navigates to its page/region on the drawing.
- Selected issue stays synchronized across viewer, issue list, and details panel.
- Zoom/pan must keep annotations aligned with the underlying PDF.
- Markers must be based on stored page-relative coordinates, not hard-coded CSS pixel positions.
- A finding with no verified location must appear in the issue list without a fabricated marker.
- Show useful loading, empty, extraction-failure, and unsupported-file states.

## 5. Initial manufacturing checks

Start with a small, validated rule set. Treat findings as **potential concerns**, not proof a part cannot be made.

| Check                           | Inputs needed                                         | Example finding                                                                            |
| ------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Deep/narrow pocket              | Confirmed or extracted depth and width                | High aspect ratio may require long-reach tooling, additional setups, or design review.     |
| Small/sharp internal corner     | Radius and relevant cutter/tool profile               | A standard cylindrical end mill cannot create a perfectly sharp internal corner.           |
| Deep hole                       | Hole diameter and depth                               | Depth-to-diameter ratio warrants drilling/tooling review.                                  |
| Tight tolerance                 | Extracted tolerance, feature context, process profile | Confirm whether precision is functionally necessary and achievable with intended process.  |
| Missing/ambiguous specification | Drawing notes and applicable surfaces/features        | Material, finish, general tolerance, or other required information may need clarification. |

Do **not** embed arbitrary numerical thresholds as universal manufacturing facts. Put initial heuristic thresholds in an explicit, configurable process profile, with provenance/assumptions and mechanical-engineer review. A missing finish note is not automatically an error on every surface. Do not invent functional criticality.

Each finding should separate: observed/extracted fact; rule/heuristic applied; inference; suggested action; uncertainty. If measurements are ambiguous, ask for confirmation or flag them as unverified. Do not silently use invented dimensions.

## 6. Architecture recommendation

Adapt to the existing repo rather than rewriting it. If starting from scratch, a pragmatic stack is:

- Frontend: React + TypeScript + Vite or Next.js, Tailwind CSS, PDF.js/react-pdf for drawing rendering, an SVG/HTML annotation layer aligned to the PDF viewport.
- Backend: Python + FastAPI for upload, document processing, rule evaluation, and report data.
- Storage for prototype: local files and SQLite or simple persistent database; use project/analysis IDs rather than global singleton state.
- AI: a provider-abstracted multimodal model for drawing interpretation and structured extraction. Keep API keys server-side. Allow mock/demo extraction so the UI works without credentials.
- Future STEP: Open CASCADE via OCP/CadQuery/pythonOCC, with a separate geometry-analysis module. Three.js can render a converted mesh, but STEP parsing and manufacturing feature recognition are separate tasks.

Keep boundaries clear:

```text
PDF (+ optional STEP)
    -> file validation/storage
    -> PDF rendering / drawing extraction
    -> structured candidate features + evidence + locations
    -> schema validation / uncertainty handling
    -> deterministic configurable DFM rules
    -> findings with traceable evidence
    -> optional LLM explanation grounded in findings
    -> interactive viewer and report
```

The LLM may help extract and explain; it should **not** be the sole source of geometry, precision claims, severity, or a pass/fail certification. If an LLM is unavailable, the app should still demonstrate the end-to-end flow using an explicitly labelled fixture/sample analysis.

## 7. Suggested data model

Use typed schemas and validate backend responses. Exact naming may vary.

```ts
type Severity = "high" | "medium" | "low";
type ReviewStatus = "open" | "addressed" | "dismissed";
type EvidenceStatus = "verified" | "extracted_unverified" | "inferred";

type DrawingRegion = {
  page: number; // define and document zero- or one-based indexing
  x: number;
  y: number;
  width: number;
  height: number;
  // normalized 0..1 coordinates relative to the unrotated PDF page
};

type Evidence = {
  sourceFileId: string;
  region?: DrawingRegion;
  text?: string;
  measurements?: Record<string, { value: number; unit: string }>;
  status: EvidenceStatus;
  confidence?: number;
};

type Finding = {
  id: string;
  ruleId: string;
  title: string;
  severity: Severity;
  status: ReviewStatus;
  description: string;
  manufacturingImpact: string;
  recommendedActions: string[];
  evidence: Evidence[];
  assumptions: string[];
  ruleProfileVersion: string;
};

type Analysis = {
  id: string;
  projectName: string;
  revision?: string;
  process: "cnc_milling_3_axis";
  material?: string;
  pdfFileId: string;
  stepFileId?: string;
  findings: Finding[];
  createdAt: string;
};
```

Persist the source file, original page dimensions/rotation, and location metadata. A single issue may have multiple source regions (e.g. dimension callout and feature). Never display an invented location simply to fill the UI.

## 8. API sketch

Adapt endpoints to framework/repo conventions:

- `POST /api/analyses` — upload PDF, optional STEP, and settings; create analysis.
- `GET /api/analyses/:id` — analysis state, metadata, findings.
- `GET /api/analyses/:id/drawing` — retrieve source PDF securely.
- `PATCH /api/analyses/:id/findings/:findingId` — update review status.
- `GET /api/analyses/:id/report` — export report when implemented.

For long-running analysis, return a job ID/status and poll or stream progress. Do not hold a request indefinitely. Validate MIME/content and extension, enforce size limits, sanitize filenames, and avoid exposing proprietary uploaded drawings in public URLs/logs.

## 9. First implementation milestone: working vertical slice

**Build this before spending time on sophisticated AI or CAD feature recognition.**

1. Inspect repo structure, package manifests, current UI, and existing tests. Summarize what exists and identify the smallest changes needed.
2. Scaffold only missing pieces. Set up an easy local run path and `.env.example` (no secrets committed).
3. Implement upload/create-analysis screen with required PDF and optional STEP control; clearly label STEP analysis as not yet available if so.
4. Implement PDF viewer with zoom, pan, fit, and annotation overlay using normalized coordinates.
5. Create a clearly labelled sample fixture for a CNC aluminium bracket with 3–5 findings and real page regions; use an actual sample PDF if present, otherwise create/use a test fixture and do not imply AI has analysed it.
6. Implement synchronized issue cards, marker selection, details panel, severity filter, and addressed/dismissed status.
7. Add persistence and a basic export or print-friendly report.
8. Add backend extraction and deterministic checks incrementally, replacing fixture findings with real results only where validated.
9. Add optional STEP ingestion/geometry checks only after the PDF workflow is solid.

### First Codex task

Start by **inspecting the repository**. Then implement the PDF viewer + annotation/issue-selection vertical slice with mock fixture data if no backend exists. Provide a short implementation plan before substantial changes. Keep the app runnable after each milestone. Do not start by attempting full autonomous CAD analysis.

## 10. Demo plan

Mechanical engineering teammates should create/validate:

- A CNC-machined aluminium bracket drawing with deliberately introduced, clearly measurable concerns.
- A revised drawing that addresses selected concerns.
- Ground-truth issue locations, dimensions, and engineering explanations.
- If possible, matching STEP files for future 3D analysis.

Demo flow: upload original -> analysis -> click a numbered issue -> zoom to its source -> read evidence and proposed action -> mark addressed -> compare revised drawing or run a second analysis -> export report. If using fixture-backed results, label that transparently in the demo. Prioritize three reliable checks over twenty speculative ones.

## 11. Quality and acceptance criteria

- App starts locally with documented commands.
- Upload rejects non-PDF required input and handles corrupt/oversized files gracefully.
- A sample PDF renders; markers remain aligned during zoom/pan/page changes.
- Clicking card/marker updates all relevant panels consistently.
- Finding status survives refresh if persistence is implemented.
- Every displayed finding has a rule ID, evidence, uncertainty status, and useful recommendation.
- No fabricated measurement or marker is presented as verified.
- Rule logic has unit tests, including threshold boundaries and missing/ambiguous input.
- UI has tests for selection/status/filter behavior where practical.
- README explains setup, current implemented capabilities, mock-vs-real analysis, limitations, and next steps.

## 12. Product constraints and risk

Drawings and CAD are often confidential customer IP: store minimally, restrict access, avoid logging document content, and make AI-provider transmission explicit. Engineering recommendations must be reviewable and should not claim certification or guaranteed manufacturability. Legal teammates can later investigate liability, terms, data retention, and commercial agreements. For now, implement truthful product copy and clear uncertainty indicators.

## 13. Working style for Codex

- Inspect first; preserve existing architecture/design where reasonable.
- Implement incrementally and run relevant tests/build checks.
- State which capabilities are real, mocked, partial, or future work.
- Prefer a clean, working vertical slice to an expansive nonfunctional scaffold.
- Ask only when a missing decision blocks progress; otherwise make a documented pragmatic choice.
- Keep this handoff and README updated as the project evolves.

---

## Implementation status — 25 September 2026

The first working vertical slice is implemented in the existing Next.js app. It includes real
PDF.js rendering, normalized annotations, synchronized issue selection, details, review status,
filters, configurable demo thresholds, browser-local persistence, upload validation, original
and revised fixtures, report preview, print/PDF, and JSON export. See the root README and
IMPLEMENTATION_PLAN.md for the architecture, run commands, checks, and explicit limitations.

The original backend remains Supabase for the starter authentication/ideas example. ForgeCheck
uses IndexedDB for the local workflow. Uploaded drawings deliberately receive no fixture findings.
STEP is an attachment only.

### Live extraction update — 26 September 2026

OpenAI extraction is connected through a validated Next.js Server Action. Users explicitly choose
and consent to sending up to three page images and embedded text. Suggestions include grounded
PDF-text references or clearly unverified visual locations. Reviewers can edit measurements/units,
confirm them, confirm source locations separately, or reject incorrect suggestions. Confirmed
inputs generate deterministic findings; original suggestions, decisions, coverage and provenance
persist locally and appear in exports. The default fixture remains clearly labelled and unchanged.

The live sample test returned all four expected feature types. Production extraction requires a
verified Supabase account on the server allowlist. Local development supports same-origin localhost.
Timeouts, refusals, bad responses and usage limits have explicit error paths. No new database tables
or customer document store were introduced. Real engineering drawing validation, authenticated
storage, durable background jobs/shared rate limits and STEP analysis remain subsequent work.
