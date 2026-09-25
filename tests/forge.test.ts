import test from "node:test";
import assert from "node:assert/strict";
import { createFixture, fixtureCandidates } from "../lib/forge/fixture";
import {
  defaultProfile,
  evaluateCandidates,
  type Candidate,
} from "../lib/forge/rules";
import {
  analysisSchema,
  filterFindings,
  regionSchema,
  rotatedRegion,
  selectionAfterFilter,
  updateReviewStatus,
} from "../lib/forge/types";
import { MAX_PDF_BYTES, validatePdf, validateStep } from "../lib/forge/pdf";

test("fixture revisions have traceable findings and bounded source regions", () => {
  const original = analysisSchema.parse(createFixture());
  const revised = analysisSchema.parse(createFixture("b"));
  assert.equal(original.findings.length, 4);
  assert.deepEqual(
    revised.findings.map((f) => f.id),
    ["tolerance"],
  );
  for (const finding of original.findings) {
    assert.ok(
      finding.ruleId &&
        finding.assumptions.length &&
        finding.recommendedActions.length,
    );
    assert.ok(
      finding.evidence.every(
        (e) =>
          e.sourceFileId === original.pdfFileId &&
          regionSchema.safeParse(e.region).success,
      ),
    );
  }
});
test("rule boundary values do not trigger; values just outside them do", () => {
  const cases = [
    {
      kind: "pocket",
      measurements: { depth: 24, width: 8 },
      key: "depth",
      outside: 24.01,
    },
    {
      kind: "hole",
      measurements: { depth: 20, diameter: 4 },
      key: "depth",
      outside: 20.01,
    },
    {
      kind: "corner",
      measurements: { radius: 3 },
      key: "radius",
      outside: 2.99,
    },
    {
      kind: "tolerance",
      measurements: { tolerance: 0.025 },
      key: "tolerance",
      outside: 0.024,
    },
  ] as const;
  for (const item of cases) {
    const candidate: Candidate = {
      kind: item.kind,
      evidence: {
        sourceFileId: "test",
        text: "confirmed input",
        status: "verified",
        measurements: Object.fromEntries(
          Object.entries(item.measurements).map(([k, v]) => [
            k,
            { value: v, unit: "mm" },
          ]),
        ),
      },
    };
    assert.equal(
      evaluateCandidates([candidate], defaultProfile).length,
      0,
      item.kind,
    );
    candidate.evidence.measurements[item.key].value = item.outside;
    assert.equal(
      evaluateCandidates([candidate], defaultProfile).length,
      1,
      item.kind,
    );
  }
});
test("missing, zero divisor, ambiguous, and wrong-unit evidence cannot silently become findings", () => {
  for (const candidate of fixtureCandidates("a")) {
    assert.equal(
      evaluateCandidates(
        [
          {
            ...candidate,
            evidence: { ...candidate.evidence, status: "extracted_unverified" },
          },
        ],
        defaultProfile,
      ).length,
      0,
    );
    assert.equal(
      evaluateCandidates(
        [
          {
            ...candidate,
            evidence: { ...candidate.evidence, measurements: {} },
          },
        ],
        defaultProfile,
      ).length,
      0,
    );
    const wrongUnits = Object.fromEntries(
      Object.entries(candidate.evidence.measurements).map(([key, m]) => [
        key,
        { ...m, unit: "in" },
      ]),
    );
    assert.equal(
      evaluateCandidates(
        [
          {
            ...candidate,
            evidence: { ...candidate.evidence, measurements: wrongUnits },
          },
        ],
        defaultProfile,
      ).length,
      0,
    );
  }
  const pocket = fixtureCandidates("a")[0];
  pocket.evidence.measurements.width.value = 0;
  assert.equal(evaluateCandidates([pocket], defaultProfile).length, 0);
});
test("profile changes affect screening without claiming universal limits", () => {
  assert.equal(
    evaluateCandidates(fixtureCandidates("a"), {
      ...defaultProfile,
      pocketRatio: 6,
      holeRatio: 9,
      minimumCutterDiameter: 1,
      tightTolerance: 0.005,
    }).length,
    0,
  );
});
test("selection and review status stay consistent when filters remove a finding", () => {
  const original = createFixture();
  const reviewed = updateReviewStatus(original, "pocket", "addressed");
  assert.equal(original.findings[0].status, "open");
  assert.equal(reviewed.findings[0].status, "addressed");
  const open = filterFindings(reviewed.findings, {
    severity: "all",
    status: "open",
  });
  assert.equal(selectionAfterFilter(open, "pocket"), "corner");
  assert.equal(selectionAfterFilter(open, "hole"), "hole");
  assert.equal(selectionAfterFilter([], "pocket"), null);
  assert.equal(
    filterFindings(reviewed.findings, { severity: "high", status: "open" })
      .length,
    1,
  );
});
test("normalized annotations rotate with page and reject out-of-page coordinates", () => {
  const region = { page: 2, x: 0.2, y: 0.3, width: 0.1, height: 0.2 };
  const ninety = rotatedRegion(region, 90);
  assert.ok(Math.abs(ninety.x - 0.5) < 1e-10);
  assert.equal(ninety.y, 0.2);
  assert.equal(ninety.width, 0.2);
  assert.equal(ninety.height, 0.1);
  const back = rotatedRegion(ninety, 270);
  assert.ok(
    Math.abs(back.x - region.x) < 1e-10 && Math.abs(back.y - region.y) < 1e-10,
  );
  assert.equal(regionSchema.safeParse({ ...region, x: 0.95 }).success, false);
  assert.equal(regionSchema.safeParse({ ...region, page: 0 }).success, false);
});
test("upload rejects wrong extension, oversized files, false PDF signatures, and invalid STEP", async () => {
  await assert.rejects(
    validatePdf(new File(["%PDF-1.7"], "drawing.txt")),
    /Choose a PDF/,
  );
  await assert.rejects(
    validatePdf(
      new File([new Uint8Array(MAX_PDF_BYTES + 1)], "big.pdf", {
        type: "application/pdf",
      }),
    ),
    /25 MB/,
  );
  await assert.rejects(
    validatePdf(
      new File(["not a pdf"], "drawing.pdf", { type: "application/pdf" }),
    ),
    /not a valid PDF/,
  );
  await assert.rejects(
    validateStep(new File(["not step"], "model.step")),
    /not a supported STEP/,
  );
  await assert.doesNotReject(
    validateStep(new File(["ISO-10303-21;\nHEADER;"], "model.stp")),
  );
});
