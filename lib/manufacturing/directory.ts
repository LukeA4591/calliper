import { processLabels, type processes } from "./schemas";

export type DirectoryMachine = {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  processes: string[];
  materials: string[];
};
export type DirectoryManufacturer = {
  user_id: string;
  business_name: string;
  location: string;
  description: string;
  processes: string[];
  materials: string[];
  machines: DirectoryMachine[];
};
export type DirectoryFilters = {
  query: string;
  process: string;
  material: string;
  machinery: string;
  location: string;
};
export const emptyDirectoryFilters: DirectoryFilters = {
  query: "",
  process: "",
  material: "",
  machinery: "",
  location: "",
};
export function processLabel(value: string) {
  return (
    processLabels[value as (typeof processes)[number]] ??
    value.replaceAll("_", " ")
  );
}
export function directoryProcesses(profile: DirectoryManufacturer) {
  return [
    ...new Set([
      ...profile.processes,
      ...profile.machines.flatMap((machine) => [
        machine.category,
        ...machine.processes,
      ]),
    ]),
  ];
}
export function directoryMaterials(profile: DirectoryManufacturer) {
  return [
    ...new Set([
      ...profile.materials,
      ...profile.machines.flatMap((machine) => machine.materials),
    ]),
  ];
}
export function normalizeDirectoryText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/aluminum/g, "aluminium")
    .trim();
}
export function matchesDirectoryFilters(
  profile: DirectoryManufacturer,
  filters: DirectoryFilters,
) {
  const processList = directoryProcesses(profile);
  const materialList = directoryMaterials(profile);
  const machineNames = profile.machines.map((machine) => machine.name);
  const text = normalizeDirectoryText(
    [
      profile.business_name,
      profile.description,
      profile.location,
      ...processList.map(processLabel),
      ...processList.map((value) => value.replaceAll("_", " ")),
      ...materialList,
      ...profile.machines.flatMap((machine) => [
        machine.name,
        machine.brand,
        machine.model,
      ]),
    ].join(" "),
  );
  return (
    filters.query
      .trim()
      .split(/\s+/)
      .every((term) => text.includes(normalizeDirectoryText(term))) &&
    (!filters.process || processList.includes(filters.process)) &&
    (!filters.material ||
      materialList.some(
        (value) => normalizeDirectoryText(value) === filters.material,
      )) &&
    (!filters.machinery ||
      machineNames.some(
        (value) => normalizeDirectoryText(value) === filters.machinery,
      )) &&
    (!filters.location ||
      normalizeDirectoryText(profile.location) === filters.location)
  );
}
export function companyInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}
