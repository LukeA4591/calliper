import { z } from "zod";

export const severitySchema = z.enum(["high", "medium", "low"]);
export const statusSchema = z.enum(["open", "addressed", "dismissed"]);
// One-based pages. Top-left origin, normalized to the unrotated PDF crop box.
export const regionSchema = z
  .object({
    page: z.number().int().min(1),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .refine(
    (r) => r.x + r.width <= 1.000001 && r.y + r.height <= 1.000001,
    "Region exceeds page bounds",
  );
export const evidenceSchema = z.object({
  sourceFileId: z.string(),
  region: regionSchema.optional(),
  text: z.string(),
  status: z.enum(["verified", "extracted_unverified", "inferred"]),
  provenance: z
    .enum(["authored_fixture", "engineer_confirmed", "ai_extracted"])
    .optional(),
  measurements: z.record(
    z.string(),
    z.object({ value: z.number(), unit: z.string() }),
  ),
});
export const findingSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  title: z.string(),
  severity: severitySchema,
  status: statusSchema,
  description: z.string(),
  manufacturingImpact: z.string(),
  recommendedActions: z.array(z.string()),
  evidence: z.array(evidenceSchema),
  assumptions: z.array(z.string()),
  ruleProfileVersion: z.string(),
  calculation: z.string(),
});
export const profileSchema = z.object({
  version: z.string(),
  name: z.string(),
  provenance: z.string(),
  pocketRatio: z.number().min(1).max(20),
  holeRatio: z.number().min(1).max(30),
  minimumCutterDiameter: z.number().min(0.1).max(50),
  tightTolerance: z.number().min(0.001).max(1),
});
export const featureKindSchema = z.enum([
  "pocket",
  "corner",
  "hole",
  "tolerance",
]);
export const extractedCandidateSchema = z.object({
  id: z.string(),
  kind: featureKindSchema,
  label: z.string(),
  page: z.number().int().positive(),
  notes: z.array(z.string()),
  locationSource: z.enum(["pdf_text", "vision", "none"]),
  decision: z.enum(["pending", "confirmed", "rejected"]),
  evidence: evidenceSchema,
  originalEvidence: evidenceSchema,
  reviewedAt: z.string().optional(),
});
export const extractionSchema = z.object({
  provider: z.literal("OpenAI"),
  model: z.string(),
  createdAt: z.string(),
  pages: z.array(z.number().int().positive()),
  warnings: z.array(z.string()),
  candidates: z.array(extractedCandidateSchema),
});
export type ExtractedCandidate = z.infer<typeof extractedCandidateSchema>;
export type Extraction = z.infer<typeof extractionSchema>;
export const analysisSchema = z.object({
  id: z.string(),
  projectName: z.string(),
  revision: z.string(),
  createdAt: z.string(),
  process: z.literal("cnc_milling_3_axis"),
  material: z.string(),
  units: z.enum(["mm", "in"]),
  filename: z.string(),
  pdfFileId: z.string(),
  stepFilename: z.string().optional(),
  mode: z.enum(["fixture", "uploaded"]),
  fixtureRevision: z.enum(["a", "b"]).optional(),
  profile: profileSchema,
  findings: z.array(findingSchema),
  extraction: extractionSchema.optional(),
  pages: z.array(
    z.object({
      width: z.number().positive(),
      height: z.number().positive(),
      rotation: z.number(),
    }),
  ),
});
export type DrawingRegion = z.infer<typeof regionSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Finding = z.infer<typeof findingSchema>;
export type Analysis = z.infer<typeof analysisSchema>;
export type ProcessProfile = z.infer<typeof profileSchema>;
export type Severity = z.infer<typeof severitySchema>;
export type ReviewStatus = z.infer<typeof statusSchema>;
export type Filters = {
  severity: Severity | "all";
  status: ReviewStatus | "all";
};

export function filterFindings(findings: Finding[], filters: Filters) {
  return findings.filter(
    (f) =>
      (filters.severity === "all" || f.severity === filters.severity) &&
      (filters.status === "all" || f.status === filters.status),
  );
}
export function selectionAfterFilter(
  findings: Finding[],
  selectedId: string | null,
) {
  return findings.some((f) => f.id === selectedId)
    ? selectedId
    : (findings[0]?.id ?? null);
}
export function updateReviewStatus(
  analysis: Analysis,
  id: string,
  status: ReviewStatus,
): Analysis {
  return {
    ...analysis,
    findings: analysis.findings.map((f) =>
      f.id === id ? { ...f, status } : f,
    ),
  };
}

// Map all four corners to account for PDF rotation (0/90/180/270).
export function rotatedRegion(
  region: DrawingRegion,
  rotation: number,
): DrawingRegion {
  const angle = ((rotation % 360) + 360) % 360;
  if (angle === 90)
    return {
      ...region,
      x: 1 - region.y - region.height,
      y: region.x,
      width: region.height,
      height: region.width,
    };
  if (angle === 180)
    return {
      ...region,
      x: 1 - region.x - region.width,
      y: 1 - region.y - region.height,
    };
  if (angle === 270)
    return {
      ...region,
      x: region.y,
      y: 1 - region.x - region.width,
      width: region.height,
      height: region.width,
    };
  return region;
}
