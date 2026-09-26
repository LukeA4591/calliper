import test from "node:test";
import assert from "node:assert/strict";
import { matchMachine, matchManufacturer } from "../lib/manufacturing/matching";
import {
  unknownRequirements,
  requirementsSchema,
  profileSchema,
  machineSchema,
  type Requirements,
  type ManufacturerProfile,
  type Machine,
} from "../lib/manufacturing/schemas";
import { signupSchema, resetSchema } from "../lib/auth-validation";
import { groundExtraction } from "../lib/forge/extraction";
const p: ManufacturerProfile = {
  user_id: "maker",
  business_name: "Test shop",
  contact_email: "shop@example.test",
  contact_phone: "",
  location: "Auckland",
  description: "",
  processes: ["cnc_milling_3_axis"],
  materials: ["Aluminium 6061-T6"],
  max_x_mm: null,
  max_y_mm: null,
  max_z_mm: null,
  tolerance_mm: null,
  capacity_notes: "",
  limitations: "",
  published: true,
};
const m: Machine = {
  id: "mill",
  manufacturer_id: "maker",
  name: "Mill 1",
  brand: "",
  model: "",
  category: "cnc_milling_3_axis",
  processes: ["cnc_milling_3_axis"],
  materials: ["Aluminium 6061-T6"],
  max_x_mm: 500,
  max_y_mm: 300,
  max_z_mm: 200,
  tolerance_mm: 0.01,
  special_capabilities: ["internal_pockets"],
  notes: "",
};
function required(): Requirements {
  const r = unknownRequirements();
  for (const key of [
    "processes",
    "material",
    "dimensions",
    "tolerance",
    "features",
    "special",
  ] as const)
    Object.assign(r[key], {
      source: "explicit",
      confirmed: true,
      quote: "Checked drawing callout",
      page: 1,
    });
  r.processes.value = ["cnc_milling_3_axis"];
  r.material.value = "Aluminium 6061-T6";
  Object.assign(r.dimensions, { x: 100, y: 80, z: 20 });
  r.tolerance.value = 0.02;
  r.features.value = ["internal_pockets"];
  r.coverageComplete = true;
  return r;
}
test("complete confirmed requirements match a single declared machine", () => {
  assert.equal(matchMachine(required(), p, m).status, "compatible");
});
test("unknown specifications, inference, partial coverage and special constraints are potential", () => {
  for (const change of [
    (r: Requirements) => {
      r.dimensions.z = null;
    },
    (r: Requirements) => {
      r.processes.source = "inferred";
    },
    (r: Requirements) => {
      r.material.confirmed = false;
    },
    (r: Requirements) => {
      r.coverageComplete = false;
    },
    (r: Requirements) => {
      r.special.value = ["heat_treatment"];
    },
    (r: Requirements) => {
      r.notes = ["Surface finish still needs review"];
    },
  ]) {
    const r = required();
    change(r);
    assert.equal(matchMachine(r, p, m).status, "potential");
  }
  assert.equal(
    matchMachine(required(), p, { ...m, tolerance_mm: null }).status,
    "potential",
  );
  assert.equal(
    matchMachine(required(), { ...p, max_x_mm: 1000 }, { ...m, max_x_mm: null })
      .status,
    "potential",
  );
  assert.equal(matchMachine(unknownRequirements(), p, m).status, "potential");
});
test("oversize, unsupported grade/process and insufficient tolerance produce explainable conflicts", () => {
  for (const machine of [
    { ...m, max_x_mm: 99 },
    { ...m, materials: ["Aluminium 7075-T6"] },
    { ...m, tolerance_mm: 0.03 },
    { ...m, processes: ["cnc_turning"] as Machine["processes"] },
  ]) {
    const result = matchMachine(required(), p, machine);
    assert.equal(result.status, "incompatible");
    assert.ok(result.reasons.length);
  }
  assert.equal(
    matchMachine(required(), { ...p, tolerance_mm: 0.03 }, m).status,
    "incompatible",
  );
  assert.equal(
    matchMachine(required(), { ...p, max_y_mm: 79 }, m).status,
    "incompatible",
  );
});
test("exact boundaries fit; material spelling aliases do not erase grades", () => {
  const r = required();
  Object.assign(r.dimensions, { x: 500, y: 300, z: 200 });
  r.tolerance.value = 0.01;
  r.material.value = " Aluminum 6061-T6 ";
  assert.equal(matchMachine(r, p, m).status, "compatible");
  r.material.value = "Aluminium";
  assert.equal(matchMachine(r, p, m).status, "incompatible");
});
test("machine capacities are never pooled, and dimensions are not rotated silently", () => {
  const result = matchManufacturer(required(), p, [
    { ...m, id: "one", max_x_mm: 90 },
    { ...m, id: "two", max_y_mm: 70 },
  ]);
  assert.equal(result.status, "incompatible");
  assert.equal(matchManufacturer(required(), p, []).status, "potential");
  assert.equal(
    matchMachine(required(), p, { ...m, max_x_mm: 90, max_y_mm: 500 }).status,
    "incompatible",
  );
});
test("unconfirmed conflicting suggestions do not conclusively reject a manufacturer", () => {
  const r = required();
  r.material.confirmed = false;
  r.material.value = "Brass";
  assert.equal(matchMachine(r, p, m).status, "potential");
});
test("account, profile, equipment and requirements validation reject unsupported data", () => {
  assert.ok(
    signupSchema.safeParse({
      email: "person@example.test",
      password: "a-long-password",
      confirmPassword: "a-long-password",
      role: "designer",
    }).success,
  );
  assert.equal(
    signupSchema.safeParse({
      email: "person@example.test",
      password: "short",
      confirmPassword: "short",
      role: "admin",
    }).success,
    false,
  );
  assert.equal(
    resetSchema.safeParse({
      password: "a-long-password",
      confirmPassword: "different-password",
    }).success,
    false,
  );
  assert.ok(profileSchema.safeParse(p).success);
  assert.ok(machineSchema.safeParse(m).success);
  assert.equal(machineSchema.safeParse({ ...m, max_x_mm: -1 }).success, false);
  assert.equal(
    requirementsSchema.safeParse({
      ...required(),
      dimensions: { ...required().dimensions, x: Infinity },
    }).success,
    false,
  );
});
test("model output cannot mark requirements verified or claim full coverage", () => {
  const input = {
    consent: true as const,
    sourceFileId: "drawing",
    units: "mm" as const,
    pages: [
      {
        page: 1,
        image: "data:image/jpeg;base64,/9j/AAAA",
        spans: [],
        textTruncated: false,
      },
    ],
  };
  const r = required();
  r.material.page = 2;
  const result = groundExtraction(
    { candidates: [], warnings: [], requirements: r },
    input,
    "test",
    "run",
  );
  assert.equal(result.requirements?.coverageComplete, false);
  assert.equal(result.requirements?.material.confirmed, false);
  assert.equal(result.requirements?.material.source, "unknown");
});
