import {
  canonicalMaterial,
  processLabels,
  type Requirements,
  type ManufacturerProfile,
  type Machine,
} from "./schemas";
export type MatchStatus = "compatible" | "potential" | "incompatible";
export type MachineMatch = {
  machineId: string;
  machineName: string;
  status: MatchStatus;
  reasons: string[];
  missing: string[];
};
export type ManufacturerMatch = {
  profile: ManufacturerProfile;
  machines: MachineMatch[];
  status: MatchStatus;
};
export function matchMachine(
  r: Requirements,
  p: ManufacturerProfile,
  m: Machine,
): MachineMatch {
  const reasons: string[] = [],
    missing: string[] = [];
  let conflict = false;
  function check(
    field: { source: string; confirmed: boolean },
    known: boolean,
    supported: boolean | null,
    yes: string,
    no: string,
    unknown: string,
  ) {
    if (!known || field.source === "unknown") {
      missing.push(unknown);
      return;
    }
    const verified = field.confirmed && field.source === "explicit";
    if (!verified)
      missing.push(
        `${unknown} — drawing requirement is inferred or awaiting confirmation.`,
      );
    if (supported === null) missing.push(unknown);
    else if (supported) reasons.push(yes);
    else if (verified) {
      conflict = true;
      reasons.push(no);
    } else
      missing.push(
        `${no} Confirm the drawing requirement before ruling out this machine.`,
      );
  }
  check(
    r.processes,
    r.processes.value.length > 0,
    m.processes.length
      ? r.processes.value.some(
          (v) =>
            m.processes.includes(v) &&
            (!p.processes.length || p.processes.includes(v)),
        )
      : null,
    `Process supported on ${m.name}: ${r.processes.value
      .filter(
        (v) =>
          m.processes.includes(v) &&
          (!p.processes.length || p.processes.includes(v)),
      )
      .map((v) => processLabels[v])
      .join(", ")}.`,
    "None of the required process alternatives is declared for this machine and business.",
    "Confirm the manufacturing process.",
  );
  const mat = r.material.value ? canonicalMaterial(r.material.value) : "";
  check(
    r.material,
    !!mat,
    m.materials.length
      ? m.materials.some((v) => canonicalMaterial(v) === mat) &&
          (!p.materials.length ||
            p.materials.some((v) => canonicalMaterial(v) === mat))
      : null,
    `Material supported: ${r.material.value}.`,
    `Material ${r.material.value} is not in the declared material list.`,
    "Confirm the exact material grade and machine material capability.",
  );
  for (const axis of ["x", "y", "z"] as const) {
    const limits = [m[`max_${axis}_mm`], p[`max_${axis}_mm`]].filter(
      (v): v is number => v !== null,
    );
    // A business-wide ceiling cannot substitute for an unknown machine envelope.
    const limit = m[`max_${axis}_mm`] === null ? null : Math.min(...limits);
    const requested = r.dimensions[axis];
    check(
      r.dimensions,
      requested !== null,
      limit === null || requested === null ? null : requested <= limit,
      `${axis.toUpperCase()}: ${requested} mm fits the declared ${limit} mm limit.`,
      `${axis.toUpperCase()}: ${requested} mm exceeds the declared ${limit} mm limit.`,
      `Confirm overall ${axis.toUpperCase()} dimension and machine envelope.`,
    );
  }
  const tolerances = [m.tolerance_mm, p.tolerance_mm].filter(
    (v): v is number => v !== null,
  );
  const achievable = m.tolerance_mm === null ? null : Math.max(...tolerances);
  check(
    r.tolerance,
    r.tolerance.value !== null,
    achievable === null || r.tolerance.value === null
      ? null
      : achievable <= r.tolerance.value,
    `Declared ±${achievable} mm meets required ±${r.tolerance.value} mm.`,
    `Declared ±${achievable} mm cannot meet required ±${r.tolerance.value} mm.`,
    "Confirm required and achievable bilateral tolerance.",
  );
  for (const [name, field] of [
    ["Geometric features", r.features],
    ["Special requirements", r.special],
  ] as const) {
    check(
      field,
      field.source !== "unknown",
      field.value.every((v) => m.special_capabilities.includes(v))
        ? true
        : null,
      `${name}: ${field.value.length ? field.value.map((v) => v.replaceAll("_", " ")).join(", ") : "none additionally required"}.`,
      "",
      `${name} require confirmation for this machine.`,
    );
  }
  if (!r.coverageComplete)
    missing.push("Not all drawing pages / requirements have been reviewed.");
  if (p.limitations.trim())
    missing.push(`Business limitations need review: ${p.limitations}`);
  if (m.notes.trim()) missing.push(`Machine notes need review: ${m.notes}`);
  for (const note of r.notes)
    if (note.trim())
      missing.push(`Drawing requirement note needs review: ${note}`);
  return {
    machineId: m.id,
    machineName: m.name,
    status: conflict
      ? "incompatible"
      : missing.length
        ? "potential"
        : "compatible",
    reasons,
    missing: [...new Set(missing)],
  };
}
export function matchManufacturer(
  r: Requirements,
  p: ManufacturerProfile,
  machines: Machine[],
): ManufacturerMatch {
  const matches = machines
    .filter((m) => m.manufacturer_id === p.user_id)
    .map((m) => matchMachine(r, p, m));
  return {
    profile: p,
    machines: matches,
    status: matches.some((m) => m.status === "compatible")
      ? "compatible"
      : !matches.length || matches.some((m) => m.status === "potential")
        ? "potential"
        : "incompatible",
  };
}
