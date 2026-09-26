import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyDirectoryFilters,
  matchesDirectoryFilters,
  directoryMaterials,
  directoryProcesses,
  type DirectoryManufacturer,
} from "../lib/manufacturing/directory";
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
    process: "additive_manufacturing",
    material: "nylon",
    machinery: "kirax pc-30",
    location: "wellington",
  };
  assert.equal(matchesDirectoryFilters(profile, filters), true);
  for (const [field, value] of Object.entries({
    process: "wire_edm",
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
      process: "cnc_turning",
    }),
    false,
  );
});
