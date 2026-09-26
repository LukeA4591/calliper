"use server";
import { requireUser } from "@/lib/auth";
import {
  requirementsSchema,
  profileSchema,
  machineSchema,
} from "@/lib/manufacturing/schemas";
import { matchManufacturer } from "@/lib/manufacturing/matching";
import { z } from "zod";
export async function findManufacturers(input: unknown) {
  const { supabase, userId } = await requireUser("designer");
  const parsed = z
    .object({
      analysisId: z.string().min(1).max(120),
      requirements: requirementsSchema,
    })
    .safeParse(input);
  if (!parsed.success)
    return {
      error: "Review the manufacturing requirements before matching.",
    } as const;
  const { data: analysis, error: ae } = await supabase
    .from("analyses")
    .select("id")
    .eq("owner_id", userId)
    .eq("id", parsed.data.analysisId)
    .maybeSingle();
  if (ae || !analysis)
    return {
      error: "Save this analysis to your account before matching.",
    } as const;
  const [{ data: profiles, error: pe }, { data: machines, error: me }] =
    await Promise.all([
      supabase.from("manufacturer_profiles").select("*").eq("published", true),
      supabase.from("machines").select("*"),
    ]);
  if (pe || me)
    return { error: "Could not load manufacturers. Try again." } as const;
  const rows = (machines ?? []).flatMap((row) => {
    const p = machineSchema.safeParse(row);
    return p.success
      ? [{ ...p.data, id: row.id, manufacturer_id: row.manufacturer_id }]
      : [];
  });
  const matches = (profiles ?? []).flatMap((row) => {
    const p = profileSchema.safeParse(row);
    return p.success
      ? [
          matchManufacturer(
            parsed.data.requirements,
            { ...p.data, user_id: row.user_id },
            rows,
          ),
        ]
      : [];
  });
  return {
    matches: matches.sort(
      (a, b) =>
        ({ compatible: 0, potential: 1, incompatible: 2 })[a.status] -
        { compatible: 0, potential: 1, incompatible: 2 }[b.status],
    ),
  } as const;
}
