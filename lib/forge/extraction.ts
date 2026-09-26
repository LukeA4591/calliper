import { z } from "zod";
import { evaluateCandidates } from "./rules";
import {
  evidenceSchema,
  featureKindSchema,
  regionSchema,
  type Analysis,
  type DrawingRegion,
  type ExtractedCandidate,
  type Extraction,
} from "./types";

export const MAX_EXTRACTION_PAGES = 3;
export const DEFAULT_AI_MODEL = "gpt-6-astra";
export const featureFields = {
  pocket: ["width", "depth"],
  corner: ["radius"],
  hole: ["diameter", "depth"],
  tolerance: ["tolerance"],
} as const;
export const featureLabels = {
  pocket: "Pocket",
  corner: "Internal corner",
  hole: "Blind hole",
  tolerance: "Bilateral tolerance",
};

export const extractionPageSchema = z
  .object({
    page: z.number().int().min(1).max(100),
    image: z
      .string()
      .max(1_000_000)
      .regex(/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/=]+$/),
    spans: z
      .array(
        z.object({
          id: z.string().max(30),
          text: z.string().max(500),
          region: regionSchema,
        }),
      )
      .max(500),
    textTruncated: z.boolean(),
  })
  .refine(
    (p) =>
      p.spans.every((s) => s.region.page === p.page) &&
      new Set(p.spans.map((s) => s.id)).size === p.spans.length &&
      p.spans.reduce((sum, s) => sum + s.text.length, 0) <= 40_000,
    "Invalid text references",
  );
export const extractionInputSchema = z
  .object({
    consent: z.literal(true),
    sourceFileId: z.string().min(1).max(120),
    units: z.enum(["mm", "in"]),
    pages: z.array(extractionPageSchema).min(1).max(MAX_EXTRACTION_PAGES),
  })
  .refine(
    (input) =>
      new Set(input.pages.map((p) => p.page)).size === input.pages.length,
    "Duplicate pages",
  );
export type ExtractionInput = z.infer<typeof extractionInputSchema>;
export type ExtractionPage = z.infer<typeof extractionPageSchema>;

// Fixed nullable fields keep the provider contract explicit, including unknown units.
const measure = z.number().min(0).max(1_000_000).nullable();
export const modelExtractionSchema = z.object({
  candidates: z
    .array(
      z.object({
        kind: featureKindSchema,
        label: z.string().min(1).max(160),
        page: z.number().int().min(1).max(100),
        quote: z.string().min(1).max(1500),
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
        width: measure,
        depth: measure,
        diameter: measure,
        radius: measure,
        tolerance: measure,
        uncertainties: z.array(z.string().max(500)).max(10),
      }),
    )
    .max(24),
  warnings: z.array(z.string().max(1000)).max(20),
});
export type ModelExtraction = z.infer<typeof modelExtractionSchema>;

function unionRegions(regions: DrawingRegion[]): DrawingRegion {
  const x = Math.min(...regions.map((r) => r.x));
  const y = Math.min(...regions.map((r) => r.y));
  return {
    page: regions[0].page,
    x,
    y,
    width: Math.max(...regions.map((r) => r.x + r.width)) - x,
    height: Math.max(...regions.map((r) => r.y + r.height)) - y,
  };
}

export function groundExtraction(
  raw: ModelExtraction,
  input: ExtractionInput,
  model: string,
  runId: string,
): Extraction {
  const warnings = [...raw.warnings];
  for (const page of input.pages) {
    if (!page.spans.length)
      warnings.push(
        `Page ${page.page}: no embedded PDF text; visual reading and locations need careful confirmation.`,
      );
    if (page.textTruncated)
      warnings.push(
        `Page ${page.page}: text limit reached. Extraction may miss callouts.`,
      );
  }
  const candidates: ExtractedCandidate[] = [];
  for (const [index, item] of raw.candidates.entries()) {
    const page = input.pages.find((p) => p.page === item.page);
    if (!page) {
      warnings.push(
        `Skipped a suggestion referencing a page that was not sent.`,
      );
      continue;
    }
    const spans = item.spanIds.map((id) => page.spans.find((s) => s.id === id));
    const validReferences =
      spans.length > 0 && spans.every((s) => s !== undefined);
    let region: DrawingRegion | undefined;
    let locationSource: ExtractedCandidate["locationSource"] = "none";
    const notes = [...item.uncertainties];
    if (validReferences) {
      region = unionRegions(spans.map((s) => s!.region));
      locationSource = "pdf_text";
    } else {
      if (item.spanIds.length)
        notes.push(
          "AI text references could not be matched. Check the source manually.",
        );
      const parsed = regionSchema.safeParse(
        item.region ? { ...item.region, page: item.page } : undefined,
      );
      if (parsed.success) {
        region = parsed.data;
        locationSource = "vision";
      }
    }
    const measurements = Object.fromEntries(
      featureFields[item.kind].flatMap((key) =>
        item[key] === null
          ? []
          : [[key, { value: item[key], unit: item.unit }]],
      ),
    );
    const evidence = evidenceSchema.parse({
      sourceFileId: input.sourceFileId,
      region,
      text: item.quote,
      status: "extracted_unverified",
      provenance: "ai_extracted",
      measurements,
    });
    candidates.push({
      id: `${runId}-${index + 1}`,
      kind: item.kind,
      label: item.label,
      page: item.page,
      notes,
      decision: "pending",
      locationSource,
      evidence,
      originalEvidence: evidence,
    });
  }
  return {
    provider: "OpenAI",
    model,
    createdAt: new Date().toISOString(),
    pages: input.pages.map((p) => p.page),
    warnings,
    candidates,
  };
}

export const confirmationSchema = z.object({
  text: z.string().trim().min(1).max(1500),
  unit: z.enum(["mm", "in"]),
  values: z.record(z.string(), z.number().min(0).max(1_000_000)),
  confirmMeasurements: z.literal(true),
  confirmLocation: z.boolean(),
});
export function confirmCandidate(
  candidate: ExtractedCandidate,
  input: unknown,
): ExtractedCandidate {
  const values = confirmationSchema.parse(input);
  const fields = featureFields[candidate.kind];
  for (const key of fields) {
    if (
      values.values[key] === undefined ||
      (["width", "diameter"].includes(key) && values.values[key] <= 0)
    )
      throw new Error(`Enter a valid ${key}.`);
  }
  return {
    ...candidate,
    decision: "confirmed",
    reviewedAt: new Date().toISOString(),
    evidence: {
      ...candidate.evidence,
      text: values.text,
      region: values.confirmLocation
        ? candidate.originalEvidence.region
        : undefined,
      status: "verified",
      provenance: "engineer_confirmed",
      measurements: Object.fromEntries(
        fields.map((key) => [
          key,
          { value: values.values[key], unit: values.unit },
        ]),
      ),
    },
  };
}

export function findingsFromExtraction(analysis: Analysis) {
  // Unit conversion happens only after explicit reviewer confirmation. Preserve original units in evidence.
  const confirmed =
    analysis.extraction?.candidates.filter(
      (c) => c.decision === "confirmed" && c.evidence.status === "verified",
    ) ?? [];
  return evaluateCandidates(
    confirmed.map((c) => ({
      id: c.id,
      kind: c.kind,
      evidence: {
        ...c.evidence,
        measurements: Object.fromEntries(
          Object.entries(c.evidence.measurements).map(([key, m]) => [
            key,
            {
              value:
                m.unit === "in"
                  ? Number((m.value * 25.4).toPrecision(12))
                  : m.value,
              unit: m.unit === "in" ? "mm" : m.unit,
            },
          ]),
        ),
      },
    })),
    analysis.profile,
  ).map((f) => ({
    ...f,
    evidence: [confirmed.find((c) => c.id === f.id)!.evidence],
    assumptions: [
      ...f.assumptions,
      ...confirmed
        .find((c) => c.id === f.id)!
        .notes.map((note) => `Extraction note for review: ${note}`),
      "Inch inputs are converted to millimetres for rule calculations (1 in = 25.4 mm).",
    ],
  }));
}

export function updateCandidate(
  analysis: Analysis,
  candidate: ExtractedCandidate,
): Analysis {
  if (!analysis.extraction) return analysis;
  const next = {
    ...analysis,
    extraction: {
      ...analysis.extraction,
      candidates: analysis.extraction.candidates.map((c) =>
        c.id === candidate.id ? candidate : c,
      ),
    },
  };
  // Preserve unrelated reviews; editing/reconfirming this candidate reopens its finding.
  return {
    ...next,
    findings: findingsFromExtraction(next).map((f) =>
      f.id === candidate.id
        ? f
        : {
            ...f,
            status:
              analysis.findings.find((old) => old.id === f.id)?.status ??
              "open",
          },
    ),
  };
}
