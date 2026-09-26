import { z } from "zod";
import { extractionInputSchema, type ExtractionInput } from "./extraction";
import {
  checkIds,
  checkIdSchema,
  checkLabels,
  pageAuditSchema,
  type DrawingReview,
} from "./review-schema";
import {
  regionSchema,
  type Analysis,
  type DrawingRegion,
  type Finding,
} from "./types";

import { classifyTolerance } from "./iso-tolerances";
import { reviewPrompt } from "./review-prompt";
export const reviewInputSchema = extractionInputSchema.extend({
  analysisId: z.string().min(1).max(200),
});
const dimension = z.number().min(0).max(1_000_000).nullable();
export const modelReviewSchema = z.object({
  pageAudits: z.array(pageAuditSchema).min(1).max(3),
  checks: z
    .array(
      z.object({
        id: checkIdSchema,
        outcome: z.enum(["flagged", "not_flagged", "not_assessed"]),
        summary: z.string().min(1).max(2000),
        observations: z
          .array(
            z.object({
              page: z.number().int().min(1).max(100),
              quote: z.string().max(1500),
              observation: z.string().min(1).max(2000),
              impact: z.string().min(1).max(1000),
              recommendation: z.string().min(1).max(1000),
              priority: z.enum(["high", "medium", "low"]),
              priorityReason: z.string().min(1).max(1000),
              spanIds: z.array(z.string().max(30)).max(20),
              region: z
                .object({
                  x: z.number().min(0).max(1),
                  y: z.number().min(0).max(1),
                  width: z.number().positive().max(1),
                  height: z.number().positive().max(1),
                })
                .nullable(),
              unit: z.enum(["mm", "in", "unknown"]),
              diameter: dimension,
              depth: dimension,
              holeType: z.enum(["blind", "through", "unknown"]),
              tolerance: dimension,
              nominal: dimension,
              toleranceKind: z.enum(["linear_symmetric", "other", "none"]),
              uncertainties: z.array(z.string().max(500)).max(10),
            }),
          )
          .max(24),
      }),
    )
    .length(6),
  warnings: z.array(z.string().max(1000)).max(20),
});
export type ModelReview = z.infer<typeof modelReviewSchema>;
export type ReviewResult = { review: DrawingReview; findings: Finding[] };

export function validateReviewCoverage(
  raw: ModelReview,
  input: ExtractionInput,
) {
  const supplied = new Set(input.pages.map((p) => p.page));
  if (
    raw.pageAudits.length !== supplied.size ||
    new Set(raw.pageAudits.map((a) => a.page)).size !== supplied.size
  )
    throw new Error("Every supplied page needs a unique audit.");
  for (const audit of raw.pageAudits) {
    if (!supplied.has(audit.page))
      throw new Error("Audit references an unsupplied page.");
    for (const [id, count] of [
      ["blind_hole_ratio", audit.holeCalloutCount],
      ["tight_tolerance", audit.toleranceCalloutCount],
    ] as const) {
      if (
        raw.checks
          .find((c) => c.id === id)
          ?.observations.filter((o) => o.page === audit.page).length !== count
      )
        throw new Error("Callout inventory count does not match observations.");
    }
    if (
      (!audit.holeScanComplete || !audit.toleranceScanComplete) &&
      !audit.limitations.length
    )
      throw new Error("Incomplete scans require a limitation.");
  }
  if (raw.checks.some((c) => c.observations.some((o) => !supplied.has(o.page))))
    throw new Error("Observation references an unsupplied page.");
}
const titles = {
  general_tolerance: "Missing general tolerance — potential AS 1100 violation",
  material: "Material specification not found",
  surface_finish: "Surface finish specification not found",
  blind_hole_ratio: "Blind hole exceeds 3:1 depth-to-diameter ratio",
  shoulder_radius: "Shoulder corner has no specified radius",
  tight_tolerance: "Tight tolerance needs manufacturing review",
};

// PDFs often split a title-block label and its value into separate text spans.
// Only accept an explicit field or a nearby value, not "machined" elsewhere.
function findMachinedFinish(pages: ExtractionInput["pages"]) {
  const normalize = (text: string) => text.trim().replace(/\s+/g, " ");
  const labelPattern = /^(?:surface )?finish\s*[:=-]?$/i;
  const valuePattern = /^(?:as[ -]+)?machined\.?$/i;
  const fieldPattern =
    /^(?:surface )?finish(?:\s*[:=-]\s*|\s+)(?:as[ -]+)?machined\.?$/i;
  for (const page of pages) {
    if (page.spans.some((span) => fieldPattern.test(normalize(span.text))))
      return page.page;
    for (const label of page.spans.filter((span) =>
      labelPattern.test(normalize(span.text)),
    )) {
      const a = label.region;
      const value = page.spans.find((span) => {
        if (!valuePattern.test(normalize(span.text))) return false;
        const b = span.region;
        const rightGap = b.x - (a.x + a.width);
        const belowGap = b.y - (a.y + a.height);
        const sameLine =
          Math.abs(b.y + b.height / 2 - (a.y + a.height / 2)) <=
          Math.max(a.height, b.height) * 0.75;
        const alignedColumn = Math.abs(b.x - a.x) <= 0.02;
        return (
          (sameLine && rightGap >= -0.005 && rightGap <= 0.06) ||
          (alignedColumn && belowGap >= -0.005 && belowGap <= 0.04)
        );
      });
      if (value) return page.page;
    }
  }
  return undefined;
}
export function groundDrawingReview(
  raw: ModelReview,
  input: ExtractionInput,
  totalPages: number,
  model: string,
  runId: string,
): ReviewResult {
  if (new Set(raw.checks.map((c) => c.id)).size !== checkIds.length)
    throw new Error(
      "The review must report each of the six checks exactly once.",
    );
  const warnings = [...raw.warnings];
  for (const audit of raw.pageAudits) {
    warnings.push(...audit.limitations.map((l) => `Page ${audit.page}: ${l}`));
    if (!audit.holeScanComplete)
      warnings.push(
        `Page ${audit.page}: hole callout scan incomplete; additional depth-ratio concerns may be missed.`,
      );
    if (!audit.toleranceScanComplete)
      warnings.push(`Page ${audit.page}: tolerance callout scan incomplete.`);
  }
  const findings: Finding[] = [];
  const tolerances: DrawingReview["tolerances"] = [];
  const partial = input.pages.length !== totalPages;
  if (partial)
    warnings.push(
      `Partial drawing review: ${input.pages.length} of ${totalPages} pages supplied. Missing specifications may be on unsent pages.`,
    );
  for (const page of input.pages) {
    if (!page.spans.length)
      warnings.push(
        `Page ${page.page}: scanned or no embedded text. AI readings and highlighted locations require visual confirmation.`,
      );
    if (page.textTruncated)
      warnings.push(
        `Page ${page.page}: embedded text was truncated; some callouts may be missed.`,
      );
  }
  const checks = checkIds.map((id) => {
    const check = raw.checks.find((c) => c.id === id)!;
    if (id === "surface_finish") {
      const finishPage = findMachinedFinish(input.pages);
      if (finishPage !== undefined)
        return {
          id,
          outcome: "not_flagged" as const,
          summary: `Page ${finishPage}: Finish is specified as Machined. This satisfies the finish-presence check; a numeric roughness value is not required for this check.`,
        };
    }
    const start = findings.length;
    let skipped = raw.pageAudits.some((a) =>
      id === "blind_hole_ratio"
        ? !a.holeScanComplete
        : id === "tight_tolerance"
          ? !a.toleranceScanComplete
          : false,
    );
    const holeResults: string[] = [];
    for (const item of check.observations) {
      if (
        check.outcome !== "flagged" &&
        id !== "tight_tolerance" &&
        id !== "blind_hole_ratio"
      )
        continue;
      const page = input.pages.find((p) => p.page === item.page);
      if (!page) {
        skipped = true;
        continue;
      }
      let calculation =
        "Visual/document completeness check — engineer confirmation required.";
      const measurements: Finding["evidence"][number]["measurements"] = {};
      if (id === "blind_hole_ratio") {
        if (item.holeType === "through") {
          holeResults.push(
            `Page ${item.page}: through-hole callout excluded from blind-hole ratio check.`,
          );
          continue;
        }
        if (
          item.holeType !== "blind" ||
          !item.diameter ||
          !item.depth ||
          item.unit === "unknown" ||
          !item.quote.trim()
        ) {
          skipped = true;
          continue;
        }
        // Compute from reported callout values, never from the model's claimed ratio or image scale.
        const ratio = item.depth / item.diameter;
        holeResults.push(
          `Page ${item.page}: ${item.depth} / ${item.diameter} = ${ratio}:1${ratio > 3 ? " exceeds 3:1" : " does not exceed 3:1"}.`,
        );
        if (ratio <= 3) {
          continue;
        }
        calculation = `${item.depth} / ${item.diameter} = ${ratio}:1 > 3:1 (both dimensions in ${item.unit}).`;
        measurements.diameter = { value: item.diameter, unit: item.unit };
        measurements.depth = { value: item.depth, unit: item.unit };
      }
      let toleranceIndex: number | undefined;
      if (id === "tight_tolerance") {
        const assessed = item.quote.trim()
          ? classifyTolerance(
              item.nominal,
              item.tolerance,
              item.unit,
              item.toleranceKind,
            )
          : null;
        toleranceIndex = tolerances.length;
        tolerances.push({
          page: item.page,
          quote: item.quote,
          nominalMm: assessed?.nominalMm ?? null,
          toleranceMm: assessed?.toleranceMm ?? null,
          fineMm: assessed?.fineMm ?? null,
          mediumMm: assessed?.mediumMm ?? null,
          outcome: assessed?.outcome ?? "manual_review",
          summary:
            assessed?.summary ??
            "Manual tolerance review required: nominal size, units or supported linear bilateral tolerance could not be established. Angular, GD&T, fit classes, asymmetric limits and broken edges require separate interpretation.",
        });
        if (assessed?.outcome === "pass") continue;
        calculation = tolerances[toleranceIndex].summary;
        if (assessed) {
          measurements.nominal = { value: item.nominal!, unit: item.unit };
          measurements.tolerance = { value: item.tolerance!, unit: item.unit };
        }
      }
      if (id === "general_tolerance")
        calculation =
          "Assumed ISO 2768-m for untoleranced dimensions, using nominal-size bands. Provisional Calliper default, not a tolerance stated by the designer. Explicit tolerances always take precedence.";
      const referenced = item.spanIds.map((ref) =>
        page.spans.find((s) => s.id === ref),
      );
      let region: DrawingRegion | undefined;
      let locationSource: "pdf_text" | "vision" | "none" = "none";
      const notes = [...item.uncertainties];
      if (referenced.length && referenced.every(Boolean)) {
        const regions = referenced.map((s) => s!.region);
        const x = Math.min(...regions.map((r) => r.x)),
          y = Math.min(...regions.map((r) => r.y));
        region = {
          page: item.page,
          x,
          y,
          width: Math.max(...regions.map((r) => r.x + r.width)) - x,
          height: Math.max(...regions.map((r) => r.y + r.height)) - y,
        };
        locationSource = "pdf_text";
      } else {
        if (referenced.length)
          notes.push(
            "Some text references were not found; check the AI evidence manually.",
          );
        const parsed = regionSchema.safeParse(
          item.region ? { ...item.region, page: item.page } : undefined,
        );
        if (parsed.success) {
          region = parsed.data;
          locationSource = "vision";
        }
      }
      const standards = [
        "general_tolerance",
        "material",
        "surface_finish",
      ].includes(id);
      const correctedHoleDecision =
        id === "blind_hole_ratio" && check.outcome !== "flagged";
      findings.push({
        id: `${runId}-${findings.length + 1}`,
        ruleId: `REVIEW-${id}`,
        title:
          id === "tight_tolerance" &&
          tolerances[toleranceIndex!]?.outcome === "manual_review"
            ? "Tolerance needs manual interpretation"
            : titles[id],
        severity:
          correctedHoleDecision && item.priority === "low"
            ? "medium"
            : item.priority,
        status: "open",
        description:
          id === "blind_hole_ratio"
            ? `The reported blind-hole callout exceeds the 3:1 depth-to-diameter screening threshold. ${calculation}`
            : item.observation,
        manufacturingImpact: correctedHoleDecision
          ? "The calculated depth-to-diameter ratio requires review of tool reach, chip evacuation and the drilling strategy."
          : item.impact,
        recommendedActions: [
          correctedHoleDecision
            ? "Confirm the diameter, blind depth and units against the callout, then review the drilling strategy."
            : item.recommendation,
        ],
        calculation,
        ruleProfileVersion: "drawing-review-1",
        ai: {
          checkId: id,
          result: "concern",
          priorityReason: correctedHoleDecision
            ? "The server calculated a ratio above 3:1 from the reported callout, overriding the AI's no-issue conclusion."
            : item.priorityReason,
          page: item.page,
          locationSource,
          decision: "pending",
          reviewerNote: "",
        },
        evidence: [
          {
            sourceFileId: input.sourceFileId,
            region,
            text:
              item.quote.trim() ||
              "No supporting callout identified. Inspect the indicated area and drawing notes.",
            measurements,
            status: "extracted_unverified",
            provenance: "ai_extracted",
          },
        ],
        assumptions: [
          "AI-generated flag. Check the drawing before accepting; a highlight is a suggested location, not verified evidence.",
          ...(standards
            ? [
                "AS 1100 drawing-completeness checklist only. No licensed clause-level compliance assessment has been performed. Check title block, notes, referenced specifications and other sheets.",
              ]
            : []),
          ...(partial
            ? [
                "Only selected pages were reviewed. Missing information may exist on another sheet.",
              ]
            : []),
          ...(id === "tight_tolerance"
            ? [
                "Manufacturing difficulty depends on process, material, geometry and inspection. A tighter tolerance is a review concern, not proof of impossibility.",
              ]
            : []),
          ...notes,
        ],
      });
      if (toleranceIndex !== undefined)
        tolerances[toleranceIndex].findingId = findings[findings.length - 1].id;
    }
    const count = findings.length - start;
    if (skipped)
      warnings.push(
        `${checkLabels[id]}: unsupported or non-triggering AI observations were excluded. Review the callouts manually.`,
      );
    const outcome = count
      ? "flagged"
      : id === "tight_tolerance" &&
          check.outcome !== "not_assessed" &&
          !skipped &&
          tolerances.length &&
          tolerances.every((t) => t.outcome === "pass")
        ? "pass"
        : id === "blind_hole_ratio" &&
            holeResults.length &&
            !skipped &&
            check.outcome !== "not_assessed"
          ? "not_flagged"
          : check.outcome === "flagged" || skipped
            ? "not_assessed"
            : check.outcome;
    return {
      id,
      outcome: outcome as DrawingReview["checks"][number]["outcome"],
      summary:
        id === "blind_hole_ratio" && holeResults.length
          ? `${holeResults.join(" ")}${skipped || check.outcome === "not_assessed" ? " Additional callouts need manual review; the check is incomplete." : ""}`.slice(
              0,
              2000,
            )
          : outcome === "pass"
            ? "All assessed explicit linear tolerances pass the ISO 2768 medium/fine screening rule. AI callout readings still require engineer review."
            : count
              ? check.summary
              : check.outcome === "flagged" || skipped
                ? "AI flags could not be supported by valid page references or required callout values. Manual review needed."
                : check.summary,
    };
  });
  // One low-priority check for the supported callouts within the standard range.
  // Keep any tight or unsupported callouts as separate concerns.
  const passing = tolerances.filter(
    (t) => t.outcome === "pass" && t.toleranceMm! <= t.mediumMm!,
  );
  if (passing.length) {
    const id = `${runId}-${findings.length + 1}`;
    findings.push({
      id,
      ruleId: "REVIEW-tolerance-pass",
      title: "Tolerance check — within ISO range",
      severity: "low",
      status: "open",
      ruleProfileVersion: "drawing-review-1",
      description: `${passing.length} assessed linear tolerance${passing.length === 1 ? " is" : "s are"} within ISO 2768-m and not tighter than ISO 2768-f. Grouped into one check; other callouts may still need review.`,
      manufacturingImpact:
        "No tight-tolerance concern identified for these callouts. Confirm the AI readings against the drawing.",
      recommendedActions: [
        "Check the listed nominal dimensions, units and tolerance values.",
      ],
      calculation: passing
        .map((t) => `Page ${t.page}: ${t.summary}`)
        .join("\n"),
      assumptions: [
        "Covers only the listed linear symmetric callouts. Does not certify the whole drawing or part.",
        ...(partial ? ["Only selected pages were reviewed."] : []),
      ],
      ai: {
        checkId: "tight_tolerance",
        result: "pass",
        page: passing[0].page,
        locationSource: "none",
        decision: "pending",
        reviewerNote: "",
        priorityReason:
          "Low priority: these callouts pass the tolerance screen; only the AI readings need confirmation.",
      },
      evidence: passing.map((t) => ({
        sourceFileId: input.sourceFileId,
        text: `Page ${t.page}: ${t.quote}`,
        status: "extracted_unverified",
        provenance: "ai_extracted",
        measurements: {
          nominal: { value: t.nominalMm!, unit: "mm" },
          tolerance: { value: t.toleranceMm!, unit: "mm" },
        },
      })),
    });
    for (const tolerance of passing) tolerance.findingId = id;
  }
  return {
    findings,
    review: {
      version: "drawing-review-1",
      promptVersion: reviewPrompt.version,
      pageAudits: raw.pageAudits,
      provider: "OpenAI",
      model,
      createdAt: new Date().toISOString(),
      pages: input.pages.map((p) => p.page),
      totalPages,
      assumedGeneralTolerance: findings.some(
        (f) => f.ai?.checkId === "general_tolerance",
      )
        ? "ISO 2768-m"
        : null,
      tolerances,
      checks,
      warnings: warnings.slice(0, 100),
    },
  };
}

export function applyDrawingReview(
  analysis: Analysis,
  result: ReviewResult,
): Analysis {
  return {
    ...analysis,
    review: result.review,
    findings: result.findings,
    extraction: undefined,
  };
}
export const engineerReviewSchema = z.object({
  decision: z.enum(["pending", "confirmed", "rejected"]),
  note: z.string().trim().max(2000),
});
export function reviewAiFinding(
  analysis: Analysis,
  id: string,
  input: unknown,
): Analysis {
  const { decision, note } = engineerReviewSchema.parse(input);
  return {
    ...analysis,
    findings: analysis.findings.map((f) =>
      f.id === id && f.ai
        ? {
            ...f,
            status:
              decision === "rejected"
                ? ("dismissed" as const)
                : decision === "confirmed" &&
                    (f.status === "addressed" || f.ai.result === "pass")
                  ? ("addressed" as const)
                  : ("open" as const),
            ai: {
              ...f.ai,
              decision,
              reviewerNote: note,
              reviewedAt:
                decision === "pending" ? undefined : new Date().toISOString(),
            },
          }
        : f,
    ),
  };
}
