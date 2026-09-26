import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyDirectoryFilters,
  matchesDirectoryFilters,
  directoryMaterials,
  directoryProcesses,
  type DirectoryManufacturer,
} from "../lib/manufacturing/directory";
import {
  compareCapabilityMatches,
  confirmationNotes,
  matchCapabilities,
  matchMaterial,
  materialLabel,
  parseProcessParam,
  processParam,
  requiredMaterial,
} from "../lib/manufacturing/recommendations";
const profile: DirectoryManufacturer = {
  user_id: "test",
  business_name: "Harbour Engineering",
  description: "Prototypes and short runs",
  location: "Wellington",
  processes: ["cnc_turning"],
  materials: ["Aluminium 6061-T6"],
  machines: [
    {
      id: "machine",
      name: "Kirax PC-30",
      brand: "Kirax",
      model: "30w3",
      category: "additive_manufacturing",
      processes: ["additive_manufacturing"],
      materials: ["Nylon"],
    },
  ],
};
test("directory searches names, process labels and identifiers, machine brands/models, and exact material grades", () => {
  for (const query of [
    "harbour",
    "engineering kirax",
    "3d printing",
    "additive manufacturing",
    "30w3",
    "nylon",
    "aluminum 6061-t6",
    "WELLINGTON",
  ])
    assert.equal(
      matchesDirectoryFilters(profile, { ...emptyDirectoryFilters, query }),
      true,
      query,
    );
  for (const query of ["6061 7075", "wire edm", "Auckland"])
    assert.equal(
      matchesDirectoryFilters(profile, { ...emptyDirectoryFilters, query }),
      false,
      query,
    );
});
test("directory combines every filter and retains machine-only capabilities", () => {
  const filters = {
    query: "kirax",
    processes: ["additive_manufacturing"],
    material: "nylon",
    machinery: "kirax pc-30",
    location: "wellington",
  };
  assert.equal(matchesDirectoryFilters(profile, filters), true);
  for (const [field, value] of Object.entries({
    processes: ["wire_edm"],
    material: "brass",
    machinery: "different mill",
    location: "auckland",
  }))
    assert.equal(
      matchesDirectoryFilters(profile, { ...filters, [field]: value }),
      false,
      field,
    );
  assert.equal(matchesDirectoryFilters(profile, emptyDirectoryFilters), true);
  assert.deepEqual(directoryMaterials(profile), ["Aluminium 6061-T6", "Nylon"]);
  assert.deepEqual(directoryProcesses(profile), [
    "cnc_turning",
    "additive_manufacturing",
  ]);
});
test("empty capabilities and missing location produce usable empty-filter results", () => {
  const empty = {
    ...profile,
    location: "",
    processes: [],
    materials: [],
    machines: [],
  };
  assert.equal(matchesDirectoryFilters(empty, emptyDirectoryFilters), true);
  assert.equal(
    matchesDirectoryFilters(empty, {
      ...emptyDirectoryFilters,
      processes: ["cnc_turning"],
    }),
    false,
  );
});
test("a recommended process list matches any of its processes and ranks coverage", () => {
  const miller: DirectoryManufacturer = {
    ...profile,
    user_id: "miller",
    business_name: "Alpine Machining",
    processes: ["cnc_milling_3_axis", "surface_grinding"],
    machines: [],
  };
  const partial: DirectoryManufacturer = {
    ...profile,
    user_id: "partial",
    business_name: "Basin Engineering",
    processes: ["cnc_milling_3_axis"],
    machines: [],
  };
  const required = ["cnc_milling_3_axis", "surface_grinding"];
  const filters = { ...emptyDirectoryFilters, processes: required };
  assert.equal(matchesDirectoryFilters(miller, filters), true);
  assert.equal(matchesDirectoryFilters(partial, filters), true);
  assert.equal(matchesDirectoryFilters(profile, filters), false);
  assert.equal(matchCapabilities(miller, required).status, "full");
  const some = matchCapabilities(partial, required);
  assert.equal(some.status, "partial");
  assert.deepEqual(some.missing, ["surface_grinding"]);
  assert.equal(matchCapabilities(profile, required).status, "none");
  const ranked = [partial, miller]
    .map((p) => ({ profile: p, match: matchCapabilities(p, required) }))
    .sort(compareCapabilityMatches);
  assert.deepEqual(
    ranked.map((row) => row.profile.user_id),
    ["miller", "partial"],
  );
  // An alternative route qualifies without needing every alternative.
  const alternative = matchCapabilities(profile, ["wire_edm"], [
    "cnc_turning",
    "laser_cutting",
  ]);
  assert.equal(alternative.status, "partial");
  assert.deepEqual(alternative.matched, ["cnc_turning"]);
  assert.equal(
    matchCapabilities(profile, [], []).status,
    "full",
    "No recommendation means nothing is excluded",
  );
});
test("process parameters ignore unsupported identifiers and duplicates", () => {
  assert.deepEqual(
    parseProcessParam("cnc_turning,not_a_process,cnc_turning,wire_edm"),
    ["cnc_turning", "wire_edm"],
  );
  assert.deepEqual(parseProcessParam(undefined), []);
  assert.deepEqual(parseProcessParam("<script>"), []);
  assert.deepEqual(parseProcessParam(["cnc_turning", "press_brake"]), [
    "cnc_turning",
    "press_brake",
  ]);
  assert.equal(processParam(["cnc_turning", "wire_edm"]), "cnc_turning,wire_edm");
});
test("declared profiles cannot silently satisfy material, tolerance or envelope", () => {
  const notes = confirmationNotes(profile, { toleranceMm: 0.01 });
  assert.ok(notes.some((n) => n.includes("±0.01 mm")));
  assert.ok(notes.some((n) => n.includes("envelope")));
  assert.deepEqual(confirmationNotes(profile, { toleranceMm: null }), [
    "Confirm the part envelope against the machine working dimensions.",
  ]);
});
test("a declared material family covers a drawing grade, but a different family never does", () => {
  const declares = (materials: string[]): DirectoryManufacturer => ({
    ...profile,
    materials,
    machines: [],
  });
  // Businesses declare families; drawings state grades.
  assert.equal(
    matchMaterial(declares(["Aluminium", "Steel"]), "Aluminium 6061-T6").status,
    "family",
  );
  assert.equal(
    matchMaterial(declares(["Stainless Steel"]), "Stainless steel 304").status,
    "family",
  );
  assert.equal(
    matchMaterial(declares(["Aluminium 6061-T6"]), "Aluminium 6061-T6").status,
    "supported",
  );
  assert.equal(
    matchMaterial(declares(["Aluminum 6061-T6"]), "Aluminium 6061-T6").status,
    "supported",
    "American spelling is the same material",
  );
  assert.equal(
    matchMaterial(declares(["Steel", "Brass"]), "Stainless steel 304").status,
    "not_listed",
    "Steel does not cover stainless steel",
  );
  assert.equal(
    matchMaterial(declares(["Tool Steel"]), "Steel").status,
    "not_listed",
  );
  assert.equal(matchMaterial(declares([]), "Brass").status, "undeclared");
  assert.equal(matchMaterial(declares(["Brass"]), null).status, "not_required");
  assert.equal(matchMaterial(declares(["Brass"]), "   ").status, "not_required");
  // A machine-only material still counts as declared capability.
  assert.equal(matchMaterial(profile, "Nylon").status, "supported");
  assert.match(
    materialLabel(matchMaterial(declares(["Aluminium"]), "Aluminium 7075-T6")),
    /confirm the Aluminium 7075-T6 grade/,
  );
});
test("required material prefers the drawing over the project setting", () => {
  const plan = {
    summary: "",
    processes: [],
    material: { stated: "Stainless steel 316", quote: "MATL: SS316" },
  };
  assert.deepEqual(requiredMaterial(plan, "Aluminium 6061-T6"), {
    value: "Stainless steel 316",
    source: "drawing",
  });
  assert.deepEqual(
    requiredMaterial({ ...plan, material: { stated: null, quote: "" } }, "Brass"),
    { value: "Brass", source: "project" },
  );
  assert.deepEqual(requiredMaterial(undefined, "Brass"), {
    value: "Brass",
    source: "project",
  });
  assert.deepEqual(requiredMaterial(undefined, null), {
    value: null,
    source: "none",
  });
});
test("material coverage ranks below process coverage but above business name", () => {
  const make = (id: string, name: string, materials: string[]) => ({
    ...profile,
    user_id: id,
    business_name: name,
    processes: ["cnc_turning"],
    materials,
    machines: [],
  });
  const required = ["cnc_turning"];
  const rows = [
    make("c", "Aaa Engineering", ["Brass"]),
    make("a", "Zzz Machining", ["Aluminium 6061-T6"]),
    make("b", "Mmm Works", ["Aluminium"]),
  ]
    .map((p) => ({
      profile: p,
      match: matchCapabilities(p, required),
      material: matchMaterial(p, "Aluminium 6061-T6"),
    }))
    .sort(compareCapabilityMatches);
  assert.deepEqual(
    rows.map((row) => row.profile.user_id),
    ["a", "b", "c"],
    "exact material, then family, then not listed",
  );
});
