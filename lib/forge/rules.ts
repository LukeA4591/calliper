import type { Evidence, Finding, ProcessProfile } from "./types";

export const defaultProfile: ProcessProfile = {
  name: "Standard tooling · demo",
  version: "demo-1.0",
  provenance:
    "Illustrative screening thresholds for this prototype. Not a machining standard. Mechanical engineer validation is pending.",
  pocketRatio: 3,
  holeRatio: 5,
  minimumCutterDiameter: 6,
  tightTolerance: 0.025,
};
export type Candidate = {
  kind: "pocket" | "corner" | "hole" | "tolerance";
  evidence: Evidence;
};

/** Inputs are explicitly supplied measurements in mm, not inferred from image scale. */
export function evaluateCandidates(
  candidates: Candidate[],
  profile: ProcessProfile,
): Finding[] {
  const findings: Finding[] = [];
  for (const candidate of candidates) {
    if (candidate.evidence.status !== "verified") continue;
    const measure = (key: string) => {
      const item = candidate.evidence.measurements[key];
      return item?.unit === "mm" &&
        Number.isFinite(item.value) &&
        item.value >= 0
        ? item.value
        : undefined;
    };
    const base = {
      id: candidate.kind,
      ruleId: `CNC-${candidate.kind.toUpperCase()}-001`,
      status: "open" as const,
      evidence: [candidate.evidence],
      ruleProfileVersion: profile.version,
      assumptions: [
        profile.provenance,
        "Drawing callouts are fixture-authored inputs; no CAD geometry or tool access has been measured.",
      ],
    };
    if (candidate.kind === "pocket") {
      const depth = measure("depth"),
        width = measure("width");
      if (depth === undefined || !width || depth / width <= profile.pocketRatio)
        continue;
      findings.push({
        ...base,
        severity: "high",
        title: "Deep, narrow pocket",
        description:
          "The called-out pocket depth is large relative to its width.",
        calculation: `${depth} / ${width} = ${(depth / width).toFixed(1)}× · review above ${profile.pocketRatio}×`,
        manufacturingImpact:
          "Reaching the bottom may require a long-reach cutter. Deflection and chip evacuation deserve a tooling review.",
        recommendedActions: [
          "Review a shallower or wider pocket against the part’s functional requirements.",
          "Confirm cutter reach, holder clearance, and a suitable machining strategy with the shop.",
        ],
      });
    } else if (candidate.kind === "corner") {
      const radius = measure("radius");
      if (radius === undefined || radius >= profile.minimumCutterDiameter / 2)
        continue;
      findings.push({
        ...base,
        severity: "high",
        title: "Internal radius below tool profile",
        description:
          "The specified inside corner radius is smaller than the radius of the profile’s smallest end mill.",
        calculation: `R${radius} < R${profile.minimumCutterDiameter / 2} · Ø${profile.minimumCutterDiameter} mm minimum cutter`,
        manufacturingImpact:
          "The configured cylindrical end mill cannot produce this internal radius. Smaller tooling or an alternative corner treatment needs review.",
        recommendedActions: [
          "Consider increasing the radius or adding corner relief if the mating geometry permits.",
          "Confirm whether smaller tooling is available and suitable for the pocket depth.",
        ],
      });
    } else if (candidate.kind === "hole") {
      const depth = measure("depth"),
        diameter = measure("diameter");
      if (
        depth === undefined ||
        !diameter ||
        depth / diameter <= profile.holeRatio
      )
        continue;
      findings.push({
        ...base,
        severity: "medium",
        title: "Deep blind hole",
        description:
          "The blind-hole depth exceeds the profile’s depth-to-diameter review threshold.",
        calculation: `${depth} / ${diameter} = ${(depth / diameter).toFixed(1)}× · review above ${profile.holeRatio}×`,
        manufacturingImpact:
          "Chip removal and drill stability may need special attention. The drawing alone does not establish the required drill or cycle.",
        recommendedActions: [
          "Confirm whether the full blind depth is required.",
          "Review drill length, coolant delivery, and chip evacuation with the machinist.",
        ],
      });
    } else {
      const tolerance = measure("tolerance");
      if (tolerance === undefined || tolerance >= profile.tightTolerance)
        continue;
      findings.push({
        ...base,
        severity: "medium",
        title: "Tight locating dimension",
        description:
          "The bilateral tolerance is tighter than this demo profile’s review threshold.",
        calculation: `±${tolerance} mm · review below ±${profile.tightTolerance} mm`,
        manufacturingImpact:
          "This may require additional process control and inspection. Functional necessity and achievable capability must be confirmed.",
        recommendedActions: [
          "Check the assembly tolerance stack before relaxing the requirement.",
          "Agree a capable machining and inspection process with the supplier.",
        ],
      });
    }
  }
  return findings;
}
