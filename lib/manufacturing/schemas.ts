import { z } from "zod";
export const processes = [
  "cnc_milling_3_axis",
  "cnc_milling_5_axis",
  "cnc_turning",
  "laser_cutting",
  "waterjet_cutting",
  "additive_manufacturing",
] as const;
export const processLabels: Record<(typeof processes)[number], string> = {
  cnc_milling_3_axis: "3-axis CNC milling",
  cnc_milling_5_axis: "5-axis CNC milling",
  cnc_turning: "CNC turning",
  laser_cutting: "Laser cutting",
  waterjet_cutting: "Waterjet cutting",
  additive_manufacturing: "3D printing",
};
export const materials = [
  "Aluminium 6061-T6",
  "Aluminium 6082-T6",
  "Aluminium 7075-T6",
  "Stainless steel 304",
  "Stainless steel 316",
  "Mild steel",
  "Titanium Ti-6Al-4V",
  "Brass",
  "Copper",
  "ABS",
  "PLA",
  "Nylon",
  "Acetal (POM)",
] as const;
export const specialties = [
  "internal_pockets",
  "blind_holes",
  "internal_corners",
  "thin_walls",
  "deep_holes",
  "threads",
  "heat_treatment",
  "anodizing",
  "surface_grinding",
  "inspection_report",
] as const;
export const processSchema = z.enum(processes);
export const dimension = z.number().positive().max(1_000_000).nullable();
const materialList = z.array(z.string().trim().min(1).max(100)).max(30);
export const profileSchema = z.object({
  business_name: z
    .string()
    .trim()
    .min(1, "Business name is required.")
    .max(160),
  contact_email: z.email().max(254),
  contact_phone: z.string().trim().max(60),
  location: z.string().trim().min(1, "Location is required.").max(240),
  description: z.string().trim().max(2000),
  processes: z.array(processSchema).max(6),
  materials: materialList,
  max_x_mm: dimension,
  max_y_mm: dimension,
  max_z_mm: dimension,
  tolerance_mm: z.number().positive().max(1000).nullable(),
  capacity_notes: z.string().trim().max(1000),
  limitations: z.string().trim().max(2000),
  published: z.boolean(),
});
export const machineSchema = z.object({
  name: z.string().trim().min(1, "Machine name is required.").max(160),
  brand: z.string().trim().max(120),
  model: z.string().trim().max(120),
  category: processSchema,
  processes: z
    .array(processSchema)
    .min(1, "Select at least one process.")
    .max(6),
  materials: materialList,
  max_x_mm: dimension,
  max_y_mm: dimension,
  max_z_mm: dimension,
  tolerance_mm: z.number().positive().max(1000).nullable(),
  special_capabilities: z.array(z.enum(specialties)).max(10),
  notes: z.string().trim().max(2000),
});
export type ManufacturerProfile = z.infer<typeof profileSchema> & {
  user_id: string;
};
export type Machine = z.infer<typeof machineSchema> & {
  id: string;
  manufacturer_id: string;
};
export const provenanceSchema = z.enum(["explicit", "inferred", "unknown"]);
const evidence = {
  source: provenanceSchema,
  quote: z.string().max(1500),
  page: z.number().int().positive().max(100).nullable(),
  confirmed: z.boolean(),
};
export const requirementsSchema = z.object({
  processes: z.object({ ...evidence, value: z.array(processSchema).max(6) }),
  material: z.object({ ...evidence, value: z.string().max(100).nullable() }),
  dimensions: z.object({
    ...evidence,
    x: dimension,
    y: dimension,
    z: dimension,
  }),
  tolerance: z.object({
    ...evidence,
    value: z.number().positive().max(1000).nullable(),
  }),
  features: z.object({
    ...evidence,
    value: z.array(z.enum(specialties)).max(10),
  }),
  special: z.object({
    ...evidence,
    value: z.array(z.enum(specialties)).max(10),
  }),
  notes: z.array(z.string().max(1000)).max(30),
  coverageComplete: z.boolean(),
});
export type Requirements = z.infer<typeof requirementsSchema>;
export function unknownRequirements(): Requirements {
  const e = {
    source: "unknown" as const,
    quote: "",
    page: null,
    confirmed: false,
  };
  return {
    processes: { ...e, value: [] },
    material: { ...e, value: null },
    dimensions: { ...e, x: null, y: null, z: null },
    tolerance: { ...e, value: null },
    features: { ...e, value: [] },
    special: { ...e, value: [] },
    notes: [],
    coverageComplete: false,
  };
}
export function canonicalMaterial(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/aluminum/g, "aluminium")
    .replace(/\s+/g, " ");
}
