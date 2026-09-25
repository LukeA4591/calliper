import { defaultProfile, evaluateCandidates, type Candidate } from "./rules";
import type { Analysis, ProcessProfile } from "./types";

// Matches the authored callouts in scripts/create-demo-drawings.py, 1000 × 700 pt.
// Locations enclose the relevant feature AND dimension callout, never decorative markers.
export function fixtureCandidates(revision: "a" | "b"): Candidate[] {
  const revised = revision === "b";
  const sourceFileId = `bracket-rev-${revision}`;
  return [
    {
      kind: "pocket",
      evidence: {
        sourceFileId,
        status: "verified",
        text: revised ? "POCKET 12 WIDE × 24 DEEP" : "POCKET 8 WIDE × 40 DEEP",
        region: { page: 1, x: 0.155, y: 0.27, width: 0.28, height: 0.18 },
        measurements: {
          width: { value: revised ? 12 : 8, unit: "mm" },
          depth: { value: revised ? 24 : 40, unit: "mm" },
        },
      },
    },
    {
      kind: "corner",
      evidence: {
        sourceFileId,
        status: "verified",
        text: revised ? "4X INTERNAL R3.5" : "4X INTERNAL R0.5",
        region: { page: 1, x: 0.345, y: 0.435, width: 0.18, height: 0.11 },
        measurements: { radius: { value: revised ? 3.5 : 0.5, unit: "mm" } },
      },
    },
    {
      kind: "hole",
      evidence: {
        sourceFileId,
        status: "verified",
        text: revised ? "2X Ø6 BLIND, DEPTH 24" : "2X Ø4 BLIND, DEPTH 32",
        region: { page: 1, x: 0.64, y: 0.265, width: 0.25, height: 0.19 },
        measurements: {
          diameter: { value: revised ? 6 : 4, unit: "mm" },
          depth: { value: revised ? 24 : 32, unit: "mm" },
        },
      },
    },
    {
      kind: "tolerance",
      evidence: {
        sourceFileId,
        status: "verified",
        text: "LOCATING SPAN 40.00 ±0.01",
        region: { page: 2, x: 0.24, y: 0.31, width: 0.5, height: 0.2 },
        measurements: { tolerance: { value: 0.01, unit: "mm" } },
      },
    },
  ];
}
export function createFixture(
  revision: "a" | "b" = "a",
  profile: ProcessProfile = defaultProfile,
): Analysis {
  return {
    id: `demo-bracket-${revision}`,
    projectName: "Precision mounting bracket",
    revision: revision.toUpperCase(),
    createdAt: "2026-09-25T00:00:00.000Z",
    process: "cnc_milling_3_axis",
    material: "Aluminium 6061-T6",
    units: "mm",
    filename: `FC-1042_bracket_rev-${revision.toUpperCase()}.pdf`,
    pdfFileId: `bracket-rev-${revision}`,
    mode: "fixture",
    fixtureRevision: revision,
    profile,
    findings: evaluateCandidates(fixtureCandidates(revision), profile),
    pages: [
      { width: 1000, height: 700, rotation: 0 },
      { width: 1000, height: 700, rotation: 0 },
    ],
  };
}
