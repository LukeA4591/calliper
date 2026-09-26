import { processes, processLabels, processSchema } from "./schemas";
import type { ManufacturingPlan } from "@/lib/forge/review-schema";
import {
  directoryMaterials,
  directoryProcesses,
  normalizeDirectoryText,
  type DirectoryManufacturer,
} from "./directory";

/** A process is required when the drawing route depends on it. Alternatives are
 * interchangeable routes, so a manufacturer qualifies by offering any one of them. */
export function requiredProcesses(plan: ManufacturingPlan) {
  return plan.processes
    .filter((entry) => entry.role !== "alternative")
    .map((entry) => entry.process);
}
export function alternativeProcesses(plan: ManufacturingPlan) {
  return plan.processes
    .filter((entry) => entry.role === "alternative")
    .map((entry) => entry.process);
}
export function planProcesses(plan: ManufacturingPlan) {
  return plan.processes.map((entry) => entry.process);
}

/** Query strings are untrusted: keep only supported identifiers, deduplicated. */
export function parseProcessParam(value: string | string[] | undefined) {
  const raw = (Array.isArray(value) ? value.join(",") : (value ?? "")).split(
    ",",
  );
  const kept = raw
    .map((item) => item.trim())
    .filter((item) => processSchema.safeParse(item).success);
  return [...new Set(kept)].slice(0, processes.length);
}
export function processParam(list: string[]) {
  return list.join(",");
}

/** Businesses declare families ("Aluminium"); drawings state grades ("Aluminium 6061-T6").
 * A declared value matches when it leads the required one, or the required one leads it, so
 * "Aluminium" covers "Aluminium 6061-T6" but "Steel" never covers "Stainless steel 304". */
function materialTokens(value: string) {
  return normalizeDirectoryText(value).split(/[^a-z0-9]+/).filter(Boolean);
}
function leads(a: string[], b: string[]) {
  return a.length <= b.length && a.every((token, index) => token === b[index]);
}
export type MaterialMatch = {
  status: "supported" | "family" | "not_listed" | "undeclared" | "not_required";
  required: string | null;
  matched: string[];
};
export function matchMaterial(
  profile: DirectoryManufacturer,
  required: string | null,
): MaterialMatch {
  const declared = directoryMaterials(profile).filter((value) => value.trim());
  if (!required?.trim())
    return { status: "not_required", required: null, matched: [] };
  if (!declared.length)
    return { status: "undeclared", required, matched: [] };
  const want = materialTokens(required);
  const exact = declared.filter(
    (value) => normalizeDirectoryText(value) === normalizeDirectoryText(required),
  );
  if (exact.length) return { status: "supported", required, matched: exact };
  const family = declared.filter((value) => {
    const have = materialTokens(value);
    return leads(have, want) || leads(want, have);
  });
  return family.length
    ? { status: "family", required, matched: family }
    : { status: "not_listed", required, matched: [] };
}
export function materialLabel(match: MaterialMatch) {
  return match.status === "supported"
    ? `${match.required} declared`
    : match.status === "family"
      ? `Declares ${match.matched.join(", ")} — confirm the ${match.required} grade`
      : match.status === "undeclared"
        ? `No material list declared — confirm ${match.required}`
        : match.status === "not_listed"
          ? `${match.required} is not in the declared material list`
          : "";
}

/** The drawing is the evidence; the project setting is the designer's own declaration. */
export function requiredMaterial(
  plan: ManufacturingPlan | undefined,
  projectMaterial: string | null,
): { value: string | null; source: "drawing" | "project" | "none" } {
  const stated = plan?.material?.stated?.trim();
  if (stated) return { value: stated, source: "drawing" };
  const chosen = projectMaterial?.trim();
  return chosen
    ? { value: chosen, source: "project" }
    : { value: null, source: "none" };
}

export type ProjectContext = {
  id: string;
  name: string;
  revision: string;
  material: string | null;
  materialSource: "drawing" | "project" | "none";
  toleranceMm: number | null;
};

export type CapabilityMatch = {
  status: "full" | "partial" | "none";
  matched: string[];
  missing: string[];
};

/** Required processes decide the match. Alternatives can only satisfy a required
 * process the manufacturer lacks; they never turn a full match into a partial one. */
export function matchCapabilities(
  profile: DirectoryManufacturer,
  required: string[],
  alternatives: string[] = [],
): CapabilityMatch {
  const offered = new Set(directoryProcesses(profile));
  if (!required.length && !alternatives.length)
    return { status: "full", matched: [], missing: [] };
  const matched = required.filter((process) => offered.has(process));
  const missing = required.filter((process) => !offered.has(process));
  const substitutes = alternatives.filter((process) => offered.has(process));
  if (!required.length)
    return {
      status: substitutes.length ? "full" : "none",
      matched: substitutes,
      missing: [],
    };
  if (!missing.length) return { status: "full", matched, missing };
  if (matched.length || substitutes.length)
    return {
      status: "partial",
      matched: [...matched, ...substitutes],
      missing,
    };
  return { status: "none", matched, missing };
}

export function capabilityLabel(match: CapabilityMatch) {
  return match.status === "full"
    ? "Offers every recommended process"
    : match.status === "partial"
      ? `Offers ${match.matched.length} of ${match.matched.length + match.missing.length}`
      : "No recommended process declared";
}

/** Process coverage first, then material, then the widest coverage, then business name. */
export function compareCapabilityMatches(
  a: {
    profile: DirectoryManufacturer;
    match: CapabilityMatch;
    material?: MaterialMatch;
  },
  b: {
    profile: DirectoryManufacturer;
    match: CapabilityMatch;
    material?: MaterialMatch;
  },
) {
  const rank = { full: 0, partial: 1, none: 2 };
  const materialRank = {
    supported: 0,
    family: 1,
    undeclared: 2,
    not_listed: 3,
    not_required: 0,
  };
  return (
    rank[a.match.status] - rank[b.match.status] ||
    materialRank[a.material?.status ?? "not_required"] -
      materialRank[b.material?.status ?? "not_required"] ||
    b.match.matched.length - a.match.matched.length ||
    a.profile.business_name.localeCompare(b.profile.business_name)
  );
}

/** What a declared profile cannot answer on its own. Stated rather than assumed,
 * because a missing value is not evidence that the manufacturer can do the work. */
export function confirmationNotes(
  profile: DirectoryManufacturer,
  context: { toleranceMm: number | null },
) {
  const notes: string[] = [];
  if (context.toleranceMm !== null)
    notes.push(
      `Confirm that ±${context.toleranceMm} mm is achievable for the toleranced features.`,
    );
  notes.push(
    "Confirm the part envelope against the machine working dimensions.",
  );
  return notes;
}

export function processName(value: string) {
  return (
    processLabels[value as (typeof processes)[number]] ??
    value.replaceAll("_", " ")
  );
}
