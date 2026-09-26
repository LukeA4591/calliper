# AI drawing review

Calliper reviews selected drawing pages for six specific concerns. It produces unverified
flags immediately so an engineer can inspect the evidence, confirm or dismiss each issue,
add a note, and mark confirmed issues addressed. AI output and locations remain distinguishable
from the engineer's decision. Dismissed flags remain in reports.

## Checks

1. Missing general tolerance in the title block or its references. Check readable notes and
   referenced specifications; unreadable or missing pages are not proof of absence.
2. Missing material specification, considering title block, notes and BOM.
3. Missing surface finish, considering general notes, texture symbols and references.
   **Finish: Machined** (including **As-machined**) counts as a stated finish for this
   completeness check. A numeric Ra/Rz value is not required. The AI reads title-block labels
   and values together; a text safeguard also recognises combined fields and nearby separate
   PDF spans. An unrelated mention of a "machined part" does not satisfy the check.
4. Explicit blind-hole depth / diameter **strictly greater than 3**. Code calculates the ratio
   from positive callout values in the same known units; it never measures image scale.
5. A shoulder with no specified radius or relief, after checking local and general notes.
6. Explicit tolerances, screened by the rules below with no shop capability lookup.

The first three are an AS 1100-oriented documentation checklist. The UI calls a missing general
tolerance a **potential AS 1100 violation**. No licensed clause text is provided to the model,
so this is an engineer review flag, not a certified standards finding.

## Tolerance rules

When a readable drawing has no general tolerance, flag it and record **ISO 2768-m assumed**
for untoleranced dimensions. This is a provisional application default to be confirmed and
added to the drawing; it does not change drawing evidence or override explicit tolerances.

For explicit symmetric bilateral linear tolerances, convert inches to millimetres and look
up ISO 2768-1:1989 Table 1 by nominal dimension. Values below are ± magnitudes in mm:

| Nominal size (mm) | Fine (f)    | Medium (m) |
| ----------------- | ----------- | ---------- |
| 0.5–3             | 0.05        | 0.1        |
| >3–6              | 0.05        | 0.1        |
| >6–30             | 0.1         | 0.2        |
| >30–120           | 0.15        | 0.3        |
| >120–400          | 0.2         | 0.5        |
| >400–1000         | 0.3         | 0.8        |
| >1000–2000        | 0.5         | 1.2        |
| >2000–4000        | Not defined | 2          |

Evaluate **tighter than fine first**: it is also numerically within medium.

- Tolerance < fine: create a drawing review concern explaining the tighter-than-fine callout.
- Fine ≤ tolerance ≤ medium: the tolerance is defined and passes. No issue is created; the callout and its calculation are recorded as coverage only.
- Tolerance > medium: no tight-tolerance concern. The explicit looser drawing tolerance applies.
- Equal fine is not tighter than fine. Band upper bounds are inclusive.
- Missing nominal/units, sizes outside the supported fine bands, angular/GD&T, fit classes,
  asymmetric/unilateral limits, external radii and chamfer heights cannot be evaluated by this
  screen. They raise no issue: the callout is recorded as `manual_review` coverage, the check
  reports `not_assessed` and a warning names it, so it is never presented as a clean pass or
  given a guessed threshold.

Example: 40 ±0.1 mm is tighter than fine (±0.15 mm), so it remains a drawing concern even though
it is also within medium (±0.3 mm). 40 ±0.2 mm passes the tolerance screen.

Sources: [ISO standard scope](https://www.iso.org/standard/7748.html),
[published ISO 2768 tables from CSL metrology](https://www.csl-imt.ch/en/knowledge/iso-2768-tolerance-tables/),
[AS 1100.101 metadata](https://codehub.building.govt.nz/resources/as-1100-101-1992).

## Manufacturing recommendations

Alongside the six checks, the model returns a `manufacturing` object: a short summary and up to
eight process recommendations. Each carries a process identifier, a role, an evidence-based reason
and its limitations.

Identifiers come from `processSchema` in `lib/manufacturing/schemas.ts` — the same enum the database
columns and the directory filters use — so AI output, storage and filtering cannot drift apart. The
readable process name is derived from `processLabels`, never taken from model text. A process the
database does not define fails schema validation and rejects the response.

Roles decide how a manufacturer is matched:

- `primary` — required to produce the main form.
- `secondary` — a required follow-on operation, such as grinding a toleranced face.
- `alternative` — a different route that could produce the part instead.

Primary and secondary processes are required; alternatives can substitute for a required process
the manufacturer lacks, and a manufacturer never has to offer every alternative. `groundManufacturingPlan`
keeps one entry per process, retaining the most significant role, and orders primary first. An empty
list is recorded with a warning rather than a guess.

The plan also carries `material`: the grade copied exactly as the drawing states it with its
supporting quote, or `null` when the readable content specifies none. The prompt forbids inferring a
material from the process, the part's appearance, a filename or a project default, and forbids
turning a stated family into a specific grade. It is the same evidence as the `material` check.

The directory treats the drawing's stated material as evidence and falls back to the project's own
material setting only when the drawing states none. Comparison is family-aware, because businesses
declare families while drawings state grades: a declared value matches when it leads the required
one in either token order, so `Aluminium` covers `Aluminium 6061-T6` as a family match needing grade
confirmation, while `Steel` does not cover `Stainless steel 304`. An absent material list is
reported as undeclared rather than assumed either way.

The plan is stored in the review, so it persists in `analyses.data` with everything else and is
replaced when the review is rerun. Reviews saved before this feature have no `manufacturing` field;
it is optional, and those analyses load unchanged.

The prompt forbids inventing dimensions, materials, tolerances or features, forbids naming any
company, supplier or machine brand, and states that recommendations are suggestions for an engineer
to confirm rather than a manufacturing plan, quote or guarantee.

## Priority and review

Only a callout tighter than fine becomes an issue. Every other stated tolerance — one that passes,
and one this screen cannot evaluate — raises no issue at all. Its callout and calculation are
listed under **Six-check results & analysis notes**, and the check reports a `pass` outcome. Tight or
unsupported callouts remain separate concerns, so a passing subset does not approve the drawing. When
no check produces an issue, the issue queue says no issues were detected; that is not approval either.

The model assigns high, medium or low priority to each concern and explains the visible impact:

- **High:** a clear release or manufacturing blocker, such as missing material preventing stock selection,
  or an explicit severe functional consequence supported by the drawing.
- **Medium:** an actionable but ordinarily resolvable concern, such as missing general tolerances,
  surface finish, >3:1 blind hole or a shoulder radius with no evidence of a blocker.
- **Low:** minor clarification or informational follow-up with little demonstrated manufacturing impact.

Uncertainty alone does not justify high priority. A tight tolerance or deep hole alone does not
establish impossibility. Priorities are AI suggestions for engineer review, not certified risk ratings.
No forced mix of severities is required.

The AI review does not query shop profiles or display tolerance capability screening. Full manufacturer
matching remains an independent workflow. Older saved shop snapshots are readable for compatibility,
but no longer appear in issue details or printed reports. Re-run a saved analysis to refresh its results.

## Coverage, persistence and compatibility

The versioned JSON instruction policy is in `lib/forge/review-prompt.ts`. It separates security,
the page review workflow, six check policies, priorities, evidence requirements, output rules and
examples. The Responses API enforces the Zod-derived JSON schema with `strict: true`.

Each selected page requires a model-reported audit: hole/tolerance callout counts, scan completeness
and limitations. Server validation rejects missing/duplicate pages or counts that do not match the
returned inventories. Incomplete scans remain unassessed with visible warnings. These are consistency
checks on the model's response, not independent proof that the model saw every feature.

Every returned hole is evaluated even when the model says `not_flagged` or `not_assessed`.
The server calculates blind-hole L/D and raises values strictly above 3. Exactly 3 and through
holes do not trigger. Unknown units/dimensions remain unassessed. The prompt recognises an explicit
finite hole-depth callout/depth symbol as possible blind-hole evidence without requiring the word
BLIND; ambiguous geometry must remain unknown. The machined-finish convention and the no-issue
outcome for defined, passing tolerances remain part of the policy. The complete tolerance inventory is
still requested, because the deterministic screen and the page audits depend on it. Prompt version and
audits are saved in report JSON.

Structured output constrains the format, not recognition accuracy. See the official
[Structured Outputs guidance](https://developers.openai.com/api/docs/guides/structured-outputs).
Unreadable or omitted callouts can still require an engineer's review and drawing-based evaluation.

- Reviews cover 1–3 selected pages, not automatically the full drawing. Coverage and warnings
  are saved. Include title blocks and general notes; referenced documents may need manual review.
- Suggested highlights use PDF text spans where available, otherwise approximate visual regions.
  Unlocated flags still navigate to the source page.
- All six checks are required exactly once. Invalid/incomplete/refused provider output leaves
  the old analysis intact. Unsupported observations become unassessed or manual review.
- Review results and engineer decisions use the existing owner-protected
  analysis JSON. Local PDF storage and RLS remain unchanged; no database migration is required.
- Earlier measurement extractions stay readable until explicitly replaced by a new review.
  Authored sample rules/settings remain separate from the new six-check review.
- Re-running replaces previous results and review decisions. Reports include original AI output,
  assumptions, calculations, scope, priorities, decisions and engineer notes.

## Verification

`pnpm test` covers ISO band boundaries and equality, fine-before-medium ordering, inch conversion,
unsupported tolerance types, blind-hole ratios, grounding, decisions, consolidated passing checks, priorities and mocked
Responses API output/failure handling. `pnpm test:integration` uses only the dedicated local
Supabase stack and checks owner-only review persistence and cross-account isolation.
Local browser checks use synthetic results, so they verify interaction and persistence rather
than real drawing accuracy. Engineering-team drawings still need a measured review benchmark.
