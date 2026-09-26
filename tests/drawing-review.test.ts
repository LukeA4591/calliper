import test from "node:test";
import assert from "node:assert/strict";
import {
  isoLinearTolerance,
  classifyTolerance,
} from "../lib/forge/iso-tolerances";
import {
  groundDrawingReview,
  applyDrawingReview,
  reviewAiFinding,
  modelReviewSchema,
  validateReviewCoverage,
  reviewInputSchema,
  type ModelReview,
} from "../lib/forge/drawing-review";
import { checkIds } from "../lib/forge/review-schema";
import {
  alternativeProcesses,
  requiredProcesses,
} from "../lib/manufacturing/recommendations";
import { createFixture } from "../lib/forge/fixture";
import {
  analysisSchema,
  findingRegion,
  updateReviewStatus,
} from "../lib/forge/types";
import {
  DEFAULT_AI_MODEL,
  type ExtractionInput,
} from "../lib/forge/extraction";
import { extractWithOpenAI, instructions } from "../lib/forge/openai-extractor";

const input: ExtractionInput = {
  consent: true,
  sourceFileId: "review-test",
  units: "mm",
  pages: [
    {
      page: 1,
      image: "data:image/jpeg;base64,/9j/AAAA",
      textTruncated: false,
      spans: [
        {
          id: "p1-t1",
          text: "Ø4 BLIND DEPTH 16",
          region: { page: 1, x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
        },
      ],
    },
  ],
};
const observation: ModelReview["checks"][number]["observations"][number] = {
  page: 1,
  quote: "Ø4 BLIND DEPTH 16",
  observation: "A deep blind hole needs tooling review.",
  impact: "Chip evacuation and tool reach may be difficult.",
  recommendation: "Confirm depth and drilling strategy.",
  priority: "medium",
  priorityReason: "Chip evacuation needs an actionable tooling review.",
  spanIds: ["p1-t1"],
  region: null,
  unit: "mm",
  diameter: 4,
  depth: 16,
  holeType: "blind",
  tolerance: null,
  nominal: null,
  toleranceKind: "none",
  uncertainties: [],
};
function raw(): ModelReview {
  return {
    manufacturing: {
      summary: "Prismatic bracket from plate with a finishing operation.",
      material: { stated: "Aluminium 6061-T6", quote: "MATERIAL: ALUMINIUM 6061-T6" },
      processes: [
        {
          process: "cnc_milling_3_axis",
          role: "primary",
          reason: "Prismatic part with pockets and holes on one face.",
          limitations: ["Stock size is not stated."],
        },
        {
          process: "surface_grinding",
          role: "secondary",
          reason: "The locating face carries a tight tolerance.",
          limitations: [],
        },
      ],
    },
    pageAudits: [
      {
        page: 1,
        holeCalloutCount: 1,
        toleranceCalloutCount: 0,
        holeScanComplete: true,
        toleranceScanComplete: true,
        limitations: [],
      },
    ],
    checks: checkIds.map((id) => ({
      id,
      outcome: id === "blind_hole_ratio" ? "flagged" : "not_flagged",
      summary: "Review summary",
      observations:
        id === "blind_hole_ratio" ? [structuredClone(observation)] : [],
    })),
    warnings: [],
  };
}
function ground(r = raw(), total = 1) {
  return groundDrawingReview(r, input, total, "test-model", "run");
}
const config = {
  apiKey: "public-test-placeholder",
  model: "test-model",
  totalPages: 1,
};
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status });
const complete = (data: unknown) => ({
  status: "completed",
  output: [
    { type: "reasoning" },
    {
      type: "message",
      content: [{ type: "output_text", text: JSON.stringify(data) }],
    },
  ],
});

test("review request requires an analysis ID and preserves duplicate-page validation", () => {
  assert.equal(reviewInputSchema.safeParse(input).success, false);
  assert.equal(
    reviewInputSchema.safeParse({ ...input, analysisId: "owned-analysis" })
      .success,
    true,
  );
  assert.equal(
    reviewInputSchema.safeParse({
      ...input,
      analysisId: "owned-analysis",
      pages: [input.pages[0], input.pages[0]],
    }).success,
    false,
  );
});

test("ISO size bands include upper edges; medium and fine are dimension-dependent", () => {
  const expected = [
    [0.5, 0.05, 0.1],
    [3, 0.05, 0.1],
    [6, 0.05, 0.1],
    [30, 0.1, 0.2],
    [120, 0.15, 0.3],
    [400, 0.2, 0.5],
    [1000, 0.3, 0.8],
    [2000, 0.5, 1.2],
    [4000, null, 2],
  ];
  for (const [size, f, m] of expected) {
    const band = isoLinearTolerance(size!);
    assert.equal(band?.f, f);
    assert.equal(band?.m, m);
  }
  assert.equal(isoLinearTolerance(3.001)?.max, 6);
  assert.equal(isoLinearTolerance(30.001)?.max, 120);
  for (const n of [0, 0.49, 4000.01, NaN, Infinity])
    assert.equal(isoLinearTolerance(n), null);
});
test("tighter-than-fine takes precedence over within-medium; equal fine/medium pass", () => {
  assert.equal(
    classifyTolerance(10, 0.09, "mm", "linear_symmetric")?.outcome,
    "tight",
  );
  for (const tol of [0.1, 0.15, 0.2])
    assert.equal(
      classifyTolerance(10, tol, "mm", "linear_symmetric")?.outcome,
      "pass",
    );
  assert.match(
    classifyTolerance(10, 0.3, "mm", "linear_symmetric")!.summary,
    /looser/,
  );
  assert.equal(
    classifyTolerance(100, 0.1, "mm", "linear_symmetric")?.outcome,
    "tight",
  );
  const inch = classifyTolerance(1, 0.001, "in", "linear_symmetric")!;
  assert.equal(inch.nominalMm, 25.4);
  assert.equal(inch.toleranceMm, 0.0254);
  assert.equal(inch.fineMm, 0.1);
  for (const [n, t, u, k] of [
    [null, 0.1, "mm", "linear_symmetric"],
    [10, null, "mm", "linear_symmetric"],
    [10, 0.1, "unknown", "linear_symmetric"],
    [10, 0.1, "mm", "other"],
    [3000, 0.1, "mm", "linear_symmetric"],
  ] as const)
    assert.equal(classifyTolerance(n, t, u, k), null);
});
test("AI flags appear immediately, remain unverified, and round-trip through saved analyses", () => {
  const result = ground();
  const a = analysisSchema.parse(applyDrawingReview(createFixture(), result));
  assert.equal(a.findings.length, 1);
  assert.equal(a.findings[0].ai?.decision, "pending");
  assert.equal(a.findings[0].evidence[0].status, "extracted_unverified");
  assert.match(a.findings[0].calculation, /16 \/ 4 = 4:1/);
  assert.equal(findingRegion(a.findings[0])?.page, 1);
  assert.equal(a.review?.checks.length, 6);
});
test("L/D strictly exceeds 3 and requires explicit blind hole, positive callouts and known units", () => {
  for (const patch of [
    { depth: 12 },
    { diameter: 0 },
    { depth: null },
    { holeType: "through" },
    { unit: "unknown" },
    { quote: "" },
  ] as const) {
    const r = raw();
    Object.assign(r.checks[3].observations[0], patch);
    const v = ground(r);
    assert.equal(v.findings.length, 0);
    assert.equal(
      v.review.checks[3].outcome,
      ("depth" in patch && patch.depth === 12) ||
        ("holeType" in patch && patch.holeType === "through")
        ? "not_flagged"
        : "not_assessed",
    );
  }
  const r = raw();
  r.checks[3].observations[0].depth = 12.01;
  assert.equal(ground(r).findings.length, 1);
});
test("hole inventory is evaluated even when the model incorrectly says no issue or not assessed", async () => {
  for (const outcome of ["not_flagged", "not_assessed"] as const) {
    const r = raw();
    r.checks[3].outcome = outcome;
    r.checks[3].summary = "No issue identified";
    r.checks[3].observations[0].observation = "This hole is fine";
    r.checks[3].observations[0].priority = "low";
    r.checks[3].observations[0].impact = "No concerns";
    r.checks[3].observations[0].recommendation = "No action required";
    const result = await extractWithOpenAI(input, config, async () =>
      response(complete(r)),
    );
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].severity, "medium");
    assert.doesNotMatch(result.findings[0].manufacturingImpact, /No concerns/);
    assert.doesNotMatch(
      result.findings[0].recommendedActions.join(" "),
      /No action required/,
    );
    assert.match(result.findings[0].description, /exceeds the 3:1/);
    assert.match(result.findings[0].calculation, /16 \/ 4 = 4:1/);
    assert.equal(result.review.checks[3].outcome, "flagged");
    assert.doesNotMatch(result.review.checks[3].summary, /No issue identified/);
  }
});
test("page audits reject missing pages, duplicates, count mismatches and unsupported claims of complete coverage", () => {
  assert.doesNotThrow(() => validateReviewCoverage(raw(), input));
  for (const audits of [
    [],
    [raw().pageAudits[0], raw().pageAudits[0]],
    [{ ...raw().pageAudits[0], page: 2 }],
    [{ ...raw().pageAudits[0], holeCalloutCount: 0 }],
    [{ ...raw().pageAudits[0], holeScanComplete: false }],
  ]) {
    assert.throws(() =>
      validateReviewCoverage({ ...raw(), pageAudits: audits }, input),
    );
  }
  const incomplete = raw();
  incomplete.checks[3].observations = [];
  incomplete.checks[3].outcome = "not_flagged";
  incomplete.pageAudits[0] = {
    ...incomplete.pageAudits[0],
    holeCalloutCount: 0,
    holeScanComplete: false,
    limitations: ["Section view is unreadable"],
  };
  validateReviewCoverage(incomplete, input);
  assert.equal(ground(incomplete).review.checks[3].outcome, "not_assessed");
  assert.ok(
    ground(incomplete).review.warnings.some((w) =>
      w.includes("hole callout scan incomplete"),
    ),
  );
  assert.equal(
    modelReviewSchema.safeParse({ ...raw(), pageAudits: undefined }).success,
    false,
  );
});
test("missing general tolerance flags AS 1100 review and records provisional medium without overwriting explicit values", () => {
  const r = raw();
  r.checks[0] = {
    id: "general_tolerance",
    outcome: "flagged",
    summary: "Readable title block lacks a general tolerance",
    observations: [
      {
        ...observation,
        quote: "",
        spanIds: [],
        region: { x: 0.7, y: 0.8, width: 0.2, height: 0.1 },
      },
    ],
  };
  r.checks[5].observations = [
    {
      ...observation,
      nominal: 10,
      tolerance: 0.15,
      toleranceKind: "linear_symmetric",
      quote: "10 ±0.15",
    },
  ];
  const v = ground(r, 2);
  assert.equal(v.review.assumedGeneralTolerance, "ISO 2768-m");
  assert.equal(v.review.tolerances[0].toleranceMm, 0.15);
  assert.equal(v.review.checks[5].outcome, "pass");
  assert.ok(v.review.warnings.some((w) => w.includes("Partial")));
  assert.match(v.findings[0].title, /potential AS 1100 violation/);
  r.checks[0] = {
    id: "general_tolerance",
    outcome: "not_assessed",
    summary: "Title block unreadable",
    observations: [],
  };
  assert.equal(ground(r).review.assumedGeneralTolerance, null);
});
test("explicit fine violations remain drawing concerns; unsupported tolerances stay visible for manual review", () => {
  const r = raw();
  r.checks[5].observations = [
    {
      ...observation,
      nominal: 40,
      tolerance: 0.01,
      toleranceKind: "linear_symmetric",
      quote: "40 ±0.01",
    },
    {
      ...observation,
      nominal: 10,
      tolerance: 0.1,
      toleranceKind: "other",
      quote: "Ø10 H7",
    },
  ];
  const v = ground(r);
  assert.equal(v.review.tolerances[0].outcome, "tight");
  assert.equal(v.review.tolerances[0].fineMm, 0.15);
  assert.ok(v.review.tolerances[0].findingId);
  assert.equal(v.review.tolerances[1].outcome, "manual_review");
  assert.equal(v.review.tolerances[1].findingId, undefined);
  assert.equal(v.findings.length, 2);
  assert.equal(
    v.findings.filter((f) => f.ai?.checkId === "tight_tolerance").length,
    1,
    "Only the tighter-than-fine callout becomes an issue",
  );
  // The tight callout flags the check; the unevaluated one is reported as a warning.
  assert.equal(v.review.checks[5].outcome, "flagged");
  assert.ok(
    v.review.warnings.some((w) => w.includes("Tight tolerance")),
    "An unevaluated callout is reported as incomplete coverage",
  );
});
test("invented pages and invalid regions cannot create markers; skipped evidence cannot silently pass", () => {
  const r = raw();
  r.checks[3].observations[0].page = 2;
  assert.equal(ground(r).findings.length, 0);
  const invalid = raw();
  Object.assign(invalid.checks[3].observations[0], {
    spanIds: ["invented"],
    region: { x: 0.9, y: 0.1, width: 0.5, height: 0.2 },
  });
  assert.equal(ground(invalid).findings[0].ai?.locationSource, "none");
  assert.equal(findingRegion(ground(invalid).findings[0]), undefined);
  invalid.checks[5].observations = [
    {
      ...observation,
      nominal: 10,
      tolerance: 0.15,
      toleranceKind: "linear_symmetric",
    },
    { ...observation, page: 2 },
  ];
  assert.equal(ground(invalid).review.checks[5].outcome, "not_assessed");
  invalid.checks[5].observations.pop();
  invalid.checks[5].outcome = "not_assessed";
  assert.equal(ground(invalid).review.tolerances[0].outcome, "pass");
  assert.equal(ground(invalid).review.checks[5].outcome, "not_assessed");
});
test("duplicate/missing check IDs reject the complete response", () => {
  const r = raw();
  r.checks[0] = r.checks[1];
  assert.throws(() => ground(r), /exactly once/);
  assert.equal(
    modelReviewSchema.safeParse({ ...raw(), checks: raw().checks.slice(0, 5) })
      .success,
    false,
  );
});
test("Machined in a finish field suppresses a mistaken missing-finish flag", () => {
  const r = raw();
  r.checks[2] = {
    id: "surface_finish",
    outcome: "flagged",
    summary: "No numeric roughness found",
    observations: [
      { ...observation, observation: "Surface finish specification not found" },
    ],
  };
  const span = (text: string, x = 0.7, y = 0.8) => ({
    id: text,
    text,
    region: { page: 1, x, y, width: 0.07, height: 0.015 },
  });
  for (const spans of [
    [span("FINISH: MACHINED")],
    [span("Finish:Machined")],
    [span("Surface finish\nAs-machined")],
    [span("Finish"), span("Machined", 0.7, 0.83)],
    [span("FINISH:"), span("AS MACHINED", 0.79, 0.8)],
  ]) {
    const result = groundDrawingReview(
      r,
      { ...input, pages: [{ ...input.pages[0], spans }] },
      1,
      "test-model",
      "run",
    );
    assert.equal(
      result.findings.some((f) => f.ai?.checkId === "surface_finish"),
      false,
    );
    assert.equal(result.review.checks[2].outcome, "not_flagged");
    assert.match(
      result.review.checks[2].summary,
      /Finish is specified as Machined/,
    );
    assert.ok(
      result.findings.some((f) => f.ai?.checkId === "blind_hole_ratio"),
    );
  }
  for (const spans of [
    [span("Machined part")],
    [span("Finish"), span("Machined", 0.1, 0.2)],
    [span("Finish: NOT machined")],
    [span("Finish: TBD")],
    [span("Finish:Machined surfaces only where indicated")],
    [],
  ]) {
    const result = groundDrawingReview(
      r,
      { ...input, pages: [{ ...input.pages[0], spans }] },
      1,
      "test-model",
      "run",
    );
    assert.ok(result.findings.some((f) => f.ai?.checkId === "surface_finish"));
  }
});
test("a defined, passing tolerance raises no issue and is kept as coverage only", () => {
  const linear = (tolerance: number) => ({
    ...observation,
    quote: `10 ±${tolerance}`,
    nominal: 10,
    tolerance,
    toleranceKind: "linear_symmetric" as const,
  });
  const r = raw();
  r.checks[5].observations = [0.1, 0.15, 0.01].map(linear);
  const result = ground(r);
  assert.equal(
    result.findings.some((f) => f.ai?.result === "pass"),
    false,
    "Passing callouts must not become an issue",
  );
  assert.equal(
    result.findings.filter((f) => f.ai?.checkId === "tight_tolerance").length,
    1,
    "Only the tighter-than-fine callout remains a concern",
  );
  const passing = result.review.tolerances.filter((t) => t.outcome === "pass");
  assert.equal(passing.length, 2);
  assert.ok(
    passing.every((t) => t.findingId === undefined),
    "A passing callout has no finding to link to",
  );
  assert.equal(result.review.checks[5].outcome, "flagged");
  assert.equal(result.review.shopChecks, undefined);
  const allPassing = raw();
  // A looser-than-medium explicit callout also passes: the drawing value takes precedence.
  allPassing.checks[5].observations = [0.1, 0.15, 0.3].map(linear);
  const clean = ground(allPassing);
  assert.equal(
    clean.findings.some((f) => f.ai?.checkId === "tight_tolerance"),
    false,
  );
  assert.equal(clean.review.checks[5].outcome, "pass");
  const saved = analysisSchema.parse(applyDrawingReview(createFixture(), clean));
  assert.equal(saved.review?.tolerances.length, 3);
  assert.equal(
    saved.findings.filter((f) => f.ai?.checkId === "tight_tolerance").length,
    0,
  );
});
test("concerns retain evidence-based priorities and their explanation", () => {
  for (const priority of ["high", "medium", "low"] as const) {
    const r = raw();
    r.checks[3].observations[0].priority = priority;
    r.checks[3].observations[0].priorityReason = `Reason for ${priority}`;
    const finding = ground(r).findings[0];
    assert.equal(finding.severity, priority);
    assert.equal(finding.ai?.priorityReason, `Reason for ${priority}`);
  }
  const invalid = raw();
  const parsed = modelReviewSchema.safeParse({
    ...invalid,
    checks: invalid.checks.map((c) => ({
      ...c,
      observations: c.observations.map((o) => ({ ...o, priority: "urgent" })),
    })),
  });
  assert.equal(parsed.success, false);
});
test("engineer confirms, annotates, dismisses and reopens independently of raw AI evidence", () => {
  const a = applyDrawingReview(createFixture(), ground());
  const id = a.findings[0].id;
  const confirmed = reviewAiFinding(a, id, {
    decision: "confirmed",
    note: "Checked section A",
  });
  assert.equal(confirmed.findings[0].status, "open");
  assert.equal(confirmed.findings[0].ai?.decision, "confirmed");
  assert.equal(
    confirmed.findings[0].evidence[0].status,
    "extracted_unverified",
  );
  assert.equal(confirmed.findings[0].ai?.reviewerNote, "Checked section A");
  const addressed = updateReviewStatus(confirmed, id, "addressed");
  assert.equal(
    reviewAiFinding(addressed, id, {
      decision: "confirmed",
      note: "Drawing updated",
    }).findings[0].status,
    "addressed",
  );
  assert.equal(
    updateReviewStatus(addressed, id, "open").findings[0].ai?.decision,
    "confirmed",
  );
  const dismissed = reviewAiFinding(confirmed, id, {
    decision: "rejected",
    note: "Depth misread",
  });
  assert.equal(dismissed.findings[0].status, "dismissed");
  assert.equal(dismissed.findings.length, 1);
  const reopened = updateReviewStatus(dismissed, id, "open");
  assert.equal(reopened.findings[0].ai?.decision, "pending");
  assert.throws(() =>
    reviewAiFinding(a, id, { decision: "confirmed", note: "x".repeat(2001) }),
  );
});
test("Responses request uses images, all six checks, strict output, bounded reasoning and no shop data", async () => {
  const result = await extractWithOpenAI(
    input,
    { ...config, model: DEFAULT_AI_MODEL },
    async (url, options) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      const p = JSON.parse(String(options?.body));
      assert.equal(p.store, false);
      assert.equal(p.text.format.name, "drawing_review");
      assert.equal(p.text.format.strict, true);
      assert.equal(p.max_output_tokens, 10000);
      assert.deepEqual(p.reasoning, { effort: "low" });
      assert.equal(p.input[0].content[1].image_url, input.pages[0].image);
      assert.ok(options?.signal);
      for (const id of checkIds) assert.ok(instructions.includes(id));
      assert.match(instructions, /untrusted/);
      assert.match(instructions, /nominal dimension/);
      const policy = JSON.parse(instructions);
      assert.equal(policy.version, "drawing-review-prompt-5");
      assert.match(
        policy.manufacturingRecommendations,
        /copied exactly as the drawing states it/,
      );
      assert.match(policy.manufacturingRecommendations, /cnc_milling_5_axis/);
      assert.match(policy.manufacturingRecommendations, /never a process that is irrelevant/);
      assert.ok(p.text.format.schema.required.includes("manufacturing"));
      assert.match(
        policy.checks.tight_tolerance,
        /Only a callout tighter than ISO 2768-f becomes an issue/,
      );
      assert.match(
        policy.checks.blind_hole_ratio,
        /EVERY distinct hole callout/,
      );
      assert.match(policy.checks.surface_finish, /MACHINED/);
      assert.ok(p.text.format.schema.required.includes("pageAudits"));
      return response(complete(raw()));
    },
  );
  assert.equal(result.findings[0].ai?.decision, "pending");
});
test("provider failure, timeout, refusal and malformed output preserve previous results", async () => {
  for (const [body, status, expected] of [
    [{ error: { message: "secret provider detail" } }, 401, /authorize/],
    [{}, 429, /usage or rate limit/],
    [{}, 500, /temporarily unavailable/],
    [{ status: "incomplete", output: [] }, 200, /incomplete/],
    [
      {
        status: "completed",
        output: [{ type: "message", content: [{ type: "refusal" }] }],
      },
      200,
      /declined/,
    ],
    [complete({ checks: [], warnings: [] }), 200, /required review format/],
  ] as const)
    await assert.rejects(
      extractWithOpenAI(input, config, async () => response(body, status)),
      expected,
    );
  await assert.rejects(
    extractWithOpenAI(input, config, async () => {
      throw new DOMException("timeout", "TimeoutError");
    }),
    /120 seconds/,
  );
});
test("manufacturing recommendations are deduplicated, ordered by role and persist with the analysis", () => {
  const r = raw();
  r.manufacturing.processes = [
    {
      process: "surface_grinding",
      role: "secondary",
      reason: "Tight locating face.",
      limitations: [],
    },
    {
      process: "cnc_milling_3_axis",
      role: "alternative",
      reason: "Duplicate with a weaker role.",
      limitations: [],
    },
    {
      process: "cnc_milling_3_axis",
      role: "primary",
      reason: "Prismatic plate part.",
      limitations: ["Stock size not stated."],
    },
    {
      process: "wire_edm",
      role: "alternative",
      reason: "Could cut the profile instead.",
      limitations: [],
    },
  ];
  const plan = ground(r).review.manufacturing!;
  assert.deepEqual(
    plan.processes.map((entry) => `${entry.process}:${entry.role}`),
    [
      "cnc_milling_3_axis:primary",
      "surface_grinding:secondary",
      "wire_edm:alternative",
    ],
    "One entry per process, most significant role first",
  );
  assert.deepEqual(requiredProcesses(plan), [
    "cnc_milling_3_axis",
    "surface_grinding",
  ]);
  assert.deepEqual(alternativeProcesses(plan), ["wire_edm"]);
  const saved = analysisSchema.parse(
    applyDrawingReview(createFixture(), ground(r)),
  );
  assert.deepEqual(
    saved.review?.manufacturing?.processes.map((e) => e.process),
    ["cnc_milling_3_axis", "surface_grinding", "wire_edm"],
    "Recommendations round-trip through the saved analysis",
  );
});
test("an unsupported process identifier is rejected and an empty plan warns instead of guessing", () => {
  const invalid = raw();
  // @ts-expect-error the model cannot introduce a process the database lacks
  invalid.manufacturing.processes[0].process = "five_axis_milling";
  assert.equal(modelReviewSchema.safeParse(invalid).success, false);
  const empty = raw();
  empty.manufacturing = {
    summary: "Views do not show the full form.",
    processes: [],
    material: { stated: null, quote: "" },
  };
  const result = ground(empty);
  assert.deepEqual(result.review.manufacturing?.processes, []);
  assert.ok(
    result.review.warnings.some((w) =>
      w.includes("No manufacturing process could be recommended"),
    ),
  );
});
test("a review saved before manufacturing recommendations still loads", () => {
  const saved = analysisSchema.parse(
    applyDrawingReview(createFixture(), ground()),
  );
  const legacy = {
    ...saved,
    review: { ...saved.review!, manufacturing: undefined },
  };
  const parsed = analysisSchema.safeParse(legacy);
  assert.equal(parsed.success, true);
  assert.equal(parsed.data?.review?.manufacturing, undefined);
});
test("the stated material is carried into the plan and never invented", () => {
  const r = raw();
  r.manufacturing.material = {
    stated: "  Aluminium 6061-T6  ",
    quote: " MATERIAL: ALUMINIUM 6061-T6 ",
  };
  const plan = ground(r).review.manufacturing!;
  assert.equal(plan.material?.stated, "Aluminium 6061-T6");
  assert.equal(plan.material?.quote, "MATERIAL: ALUMINIUM 6061-T6");
  const absent = raw();
  absent.manufacturing.material = { stated: "   ", quote: "" };
  assert.equal(ground(absent).review.manufacturing?.material?.stated, null);
  const saved = analysisSchema.parse(applyDrawingReview(createFixture(), ground(r)));
  assert.equal(saved.review?.manufacturing?.material?.stated, "Aluminium 6061-T6");
  // A plan saved before material recommendations still loads.
  const legacy = analysisSchema.safeParse({
    ...saved,
    review: {
      ...saved.review!,
      manufacturing: { summary: "x", processes: [] },
    },
  });
  assert.equal(legacy.success, true);
  assert.equal(legacy.data?.review?.manufacturing?.material, undefined);
});
