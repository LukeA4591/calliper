import test from "node:test";
import assert from "node:assert/strict";
import { createFixture } from "../lib/forge/fixture";
import { analysisSchema } from "../lib/forge/types";
import {
  DEFAULT_AI_MODEL,
  confirmationSchema,
  confirmCandidate,
  extractionInputSchema,
  findingsFromExtraction,
  groundExtraction,
  modelExtractionSchema,
  updateCandidate,
  type ExtractionInput,
  type ModelExtraction,
} from "../lib/forge/extraction";
import { extractWithOpenAI } from "../lib/forge/openai-extractor";
import { createExtractionLimiter } from "../lib/forge/extraction-access";

const region = { page: 1, x: 0.1, y: 0.2, width: 0.3, height: 0.1 };
const input: ExtractionInput = {
  consent: true,
  sourceFileId: "uploaded-1",
  units: "mm",
  pages: [
    {
      page: 1,
      image: "data:image/jpeg;base64,/9j/AAAA",
      textTruncated: false,
      spans: [{ id: "p1-t1", text: "POCKET 8 WIDE x 40 DEEP", region }],
    },
  ],
};
const raw: ModelExtraction = {
  warnings: [],
  candidates: [
    {
      kind: "pocket",
      label: "Pocket A",
      page: 1,
      quote: "POCKET 8 WIDE x 40 DEEP",
      spanIds: ["p1-t1"],
      region: null,
      unit: "mm",
      width: 8,
      depth: 40,
      diameter: null,
      radius: null,
      tolerance: null,
      uncertainties: [],
    },
  ],
};
const extraction = () =>
  groundExtraction(structuredClone(raw), input, "test-model", "run1");
const analysis = () => ({
  ...createFixture(),
  mode: "uploaded" as const,
  pdfFileId: input.sourceFileId,
  findings: [],
  extraction: extraction(),
});
const confirmation = {
  text: raw.candidates[0].quote,
  unit: "mm",
  values: { width: 8, depth: 40 },
  confirmMeasurements: true,
  confirmLocation: true,
};

test("request validation blocks unconsented, oversized, external-image and mismatched source input", () => {
  assert.ok(extractionInputSchema.safeParse(input).success);
  for (const invalid of [
    { ...input, consent: false },
    { ...input, pages: [] },
    { ...input, pages: Array(4).fill(input.pages[0]) },
    { ...input, pages: [input.pages[0], input.pages[0]] },
    {
      ...input,
      pages: [{ ...input.pages[0], image: "https://internal.example/image" }],
    },
    {
      ...input,
      pages: [
        {
          ...input.pages[0],
          image: input.pages[0].image + "A".repeat(1_000_000),
        },
      ],
    },
    {
      ...input,
      pages: [
        {
          ...input.pages[0],
          spans: [
            { ...input.pages[0].spans[0], region: { ...region, page: 2 } },
          ],
        },
      ],
    },
  ])
    assert.equal(extractionInputSchema.safeParse(invalid).success, false);
});

test("extraction remains unverified, grounds only selected-page references and survives storage schema", () => {
  const result = analysisSchema.parse(analysis());
  assert.equal(result.extraction?.candidates[0].decision, "pending");
  for (const key of ["x", "y", "width", "height"] as const)
    assert.ok(
      Math.abs(
        result.extraction!.candidates[0].evidence.region![key] - region[key],
      ) < 1e-12,
    );
  assert.equal(findingsFromExtraction(result).length, 0);
  const invalidPage = { ...raw.candidates[0], page: 2 };
  const invalidRef = {
    ...raw.candidates[0],
    spanIds: ["invented"],
    region: { x: 0.9, y: 0.1, width: 0.5, height: 0.1 },
  };
  const grounded = groundExtraction(
    { warnings: [], candidates: [invalidPage, invalidRef] },
    input,
    "test",
    "run2",
  );
  assert.equal(grounded.candidates.length, 1);
  assert.equal(grounded.candidates[0].locationSource, "none");
  assert.equal(grounded.candidates[0].evidence.region, undefined);
  assert.ok(grounded.warnings.length);
  assert.ok(grounded.candidates[0].notes.length);
});

test("confirmations require complete measurements and separately confirmed source locations", () => {
  const candidate = extraction().candidates[0];
  assert.equal(
    confirmationSchema.safeParse({
      ...confirmation,
      confirmMeasurements: false,
    }).success,
    false,
  );
  for (const values of [
    { width: 0, depth: 40 },
    { width: 8 },
    { width: 8, depth: -1 },
    { width: NaN, depth: 40 },
  ])
    assert.throws(() =>
      confirmCandidate(candidate, { ...confirmation, values }),
    );
  const confirmed = confirmCandidate(candidate, {
    ...confirmation,
    confirmLocation: false,
  });
  confirmed.notes = ["Check conflicting callouts"];
  const next = updateCandidate(analysis(), confirmed);
  assert.equal(next.findings.length, 1);
  assert.equal(next.findings[0].evidence[0].region, undefined);
  assert.equal(next.findings[0].evidence[0].provenance, "engineer_confirmed");
  assert.ok(
    next.findings[0].assumptions.some((a) =>
      a.includes("Check conflicting callouts"),
    ),
  );
  assert.deepEqual(
    confirmed.originalEvidence.region,
    candidate.originalEvidence.region,
  );
  assert.equal(confirmed.originalEvidence.status, "extracted_unverified");
});

test("multiple features keep distinct IDs; edits reopen only the changed finding and rejection removes it", () => {
  const next = analysis();
  const one = confirmCandidate(next.extraction.candidates[0], confirmation);
  const two = { ...one, id: "run1-2", label: "Pocket B" };
  next.extraction.candidates = [one, two];
  const findings = findingsFromExtraction(next);
  assert.equal(new Set(findings.map((f) => f.id)).size, 2);
  const reviewed = {
    ...next,
    findings: findings.map((f) => ({ ...f, status: "addressed" as const })),
  };
  const updated = updateCandidate(reviewed, {
    ...one,
    evidence: {
      ...one.evidence,
      measurements: {
        width: { value: 8, unit: "mm" },
        depth: { value: 41, unit: "mm" },
      },
    },
  });
  assert.equal(updated.findings[0].status, "open");
  assert.equal(updated.findings[1].status, "addressed");
  assert.deepEqual(
    updateCandidate(updated, { ...one, decision: "rejected" }).findings.map(
      (f) => f.id,
    ),
    [two.id],
  );
});

test("confirmed inch inputs convert for checks and preserve the original drawing evidence", () => {
  const candidate = confirmCandidate(extraction().candidates[0], {
    ...confirmation,
    unit: "in",
    values: { width: 0.25, depth: 2 },
  });
  const next = updateCandidate(analysis(), candidate);
  assert.equal(next.findings.length, 1);
  assert.match(next.findings[0].calculation, /50.8 \/ 6.35/);
  assert.equal(next.findings[0].evidence[0].measurements.width.unit, "in");
  assert.equal(
    findingsFromExtraction({
      ...next,
      profile: { ...next.profile, pocketRatio: 10 },
    }).length,
    0,
  );
});

test("scanned sources keep estimated regions and unknown units unverified", () => {
  const scan = { ...input, pages: [{ ...input.pages[0], spans: [] }] };
  const result = groundExtraction(
    {
      ...raw,
      candidates: [
        {
          ...raw.candidates[0],
          spanIds: [],
          unit: "unknown",
          region: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
        },
      ],
    },
    scan,
    "test",
    "scan",
  );
  const candidate = result.candidates[0];
  assert.equal(candidate.locationSource, "vision");
  assert.equal(candidate.evidence.status, "extracted_unverified");
  assert.ok(result.warnings.some((w) => w.includes("no embedded PDF text")));
  assert.throws(() =>
    confirmCandidate(candidate, { ...confirmation, unit: "unknown" }),
  );
  assert.equal(
    findingsFromExtraction({ ...analysis(), extraction: result }).length,
    0,
  );
});

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const completed = (data: unknown) => ({
  status: "completed",
  output: [
    {
      type: "message",
      content: [{ type: "output_text", text: JSON.stringify(data) }],
    },
  ],
});
const config = { apiKey: "public-test-placeholder", model: "test-model" };
test("provider request uses structured image extraction, disabled storage, bounded output, and pending results", async () => {
  const result = await extractWithOpenAI(
    input,
    config,
    async (url, options) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      const payload = JSON.parse(String(options?.body));
      assert.equal(payload.store, false);
      assert.equal(payload.text.format.strict, true);
      assert.ok(payload.max_output_tokens < 7000);
      assert.equal(payload.reasoning, undefined);
      assert.equal(payload.input[0].content[1].image_url, input.pages[0].image);
      assert.ok(options?.signal);
      return response(completed(raw));
    },
  );
  assert.equal(result.candidates[0].decision, "pending");
  assert.ok(modelExtractionSchema.safeParse(raw).success);
});

test("default model has a bounded reasoning budget and accepts reasoning output items", async () => {
  assert.equal(DEFAULT_AI_MODEL, "gpt-6-astra");
  const result = await extractWithOpenAI(
    input,
    { ...config, model: DEFAULT_AI_MODEL },
    async (_url, options) => {
      const payload = JSON.parse(String(options?.body));
      assert.equal(payload.model, DEFAULT_AI_MODEL);
      assert.deepEqual(payload.reasoning, { effort: "low" });
      assert.equal(payload.max_output_tokens, 10000);
      const body = completed(raw);
      return response({ ...body, output: [{ type: "reasoning" }, ...body.output] });
    },
  );
  assert.equal(result.candidates[0].decision, "pending");
});

test("provider failures cannot create partial findings or leak response secrets", async () => {
  for (const [body, status, expected] of [
    [{ error: { message: "sensitive provider detail" } }, 401, /authorize/],
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
    [
      completed({
        candidates: [{ ...raw.candidates[0], depth: -1 }],
        warnings: [],
      }),
      200,
      /required measurement format/,
    ],
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

test("extraction limits concurrent work, counts hourly requests and releases slots only once", () => {
  const acquire = createExtractionLimiter();
  const one = acquire(0),
    two = acquire(0);
  assert.throws(() => acquire(0), /already running/);
  one();
  one();
  two();
  for (let i = 2; i < 20; i++) acquire(0)();
  assert.throws(() => acquire(0), /20 requests/);
  acquire(3_600_000)();
});
