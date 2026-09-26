import { z } from "zod";

export const checkIds = [
  "general_tolerance",
  "material",
  "surface_finish",
  "blind_hole_ratio",
  "shoulder_radius",
  "tight_tolerance",
] as const;
export const checkIdSchema = z.enum(checkIds);
export const reviewCheckSchema = z.object({
  id: checkIdSchema,
  outcome: z.enum(["flagged", "not_flagged", "not_assessed", "pass"]),
  summary: z.string().max(2000),
});
export const aiFindingSchema = z.object({
  checkId: checkIdSchema,
  result: z.enum(["concern", "pass"]).optional(),
  priorityReason: z.string().max(1000).optional(),
  page: z.number().int().positive(),
  locationSource: z.enum(["pdf_text", "vision", "none"]),
  decision: z.enum(["pending", "confirmed", "rejected"]),
  reviewerNote: z.string().max(2000).default(""),
  reviewedAt: z.string().optional(),
});
export const toleranceAssessmentSchema = z.object({
  page: z.number().int().positive(),
  quote: z.string(),
  nominalMm: z.number().positive().nullable(),
  toleranceMm: z.number().positive().nullable(),
  fineMm: z.number().positive().nullable(),
  mediumMm: z.number().positive().nullable(),
  outcome: z.enum(["pass", "tight", "shop_check", "manual_review"]),
  summary: z.string(),
  findingId: z.string().optional(),
});
export const shopCrossReferenceSchema = z.object({
  findingId: z.string(),
  checkedAt: z.string(),
  status: z.enum(["checked", "empty", "unavailable"]),
  summary: z.string(),
  machines: z
    .array(
      z.object({
        manufacturerId: z.string(),
        businessName: z.string(),
        machineName: z.string(),
        achievableMm: z.number().positive().nullable(),
        status: z.enum(["meets", "not_met", "unknown"]),
      }),
    )
    .max(50),
});
export const pageAuditSchema = z.object({
  page: z.number().int().min(1).max(100),
  holeCalloutCount: z.number().int().min(0).max(24),
  toleranceCalloutCount: z.number().int().min(0).max(24),
  holeScanComplete: z.boolean(),
  toleranceScanComplete: z.boolean(),
  limitations: z.array(z.string().min(1).max(500)).max(10),
});
export const drawingReviewSchema = z.object({
  version: z.literal("drawing-review-1"),
  promptVersion: z.string().optional(),
  pageAudits: z.array(pageAuditSchema).min(1).max(3).optional(),
  provider: z.literal("OpenAI"),
  model: z.string(),
  createdAt: z.string(),
  pages: z.array(z.number().int().positive()).min(1),
  totalPages: z.number().int().positive(),
  assumedGeneralTolerance: z.literal("ISO 2768-m").nullable(),
  tolerances: z.array(toleranceAssessmentSchema).max(24),
  // Read previous saved snapshots without running or displaying shop screening.
  shopChecks: z.array(shopCrossReferenceSchema).max(24).optional(),
  checks: z.array(reviewCheckSchema).length(6),
  warnings: z.array(z.string()).max(100),
});
export const checkLabels: Record<(typeof checkIds)[number], string> = {
  general_tolerance: "General tolerance in title block",
  material: "Material specification",
  surface_finish: "Surface finish specification",
  blind_hole_ratio: "Blind hole depth / diameter > 3:1",
  shoulder_radius: "Shoulder corner radius",
  tight_tolerance: "Tight tolerance / manufacturing difficulty",
};
export function checkCategory(id: (typeof checkIds)[number]) {
  if (["general_tolerance", "material", "surface_finish"].includes(id))
    return "Standards · AS 1100 review";
  return "Manufacturability · DFM";
}
export type DrawingReview = z.infer<typeof drawingReviewSchema>;
