"use server";
import { requireUser } from "@/lib/auth";
import { analysisSchema } from "@/lib/forge/types";
import type { Json } from "@/lib/database.types";
export async function saveAnalysis(input: unknown, expectedAccountId: string) {
  const { supabase, userId } = await requireUser("designer");
  if (expectedAccountId !== userId)
    return { error: "Your account changed. Reload the page before saving." };
  const parsed = analysisSchema.safeParse(input);
  if (!parsed.success || JSON.stringify(parsed.data).length > 1_000_000)
    return { error: "Analysis data is invalid or too large to save." };
  const a = parsed.data;
  const { data: existing, error: readError } = await supabase
    .from("analyses")
    .select("id")
    .eq("owner_id", userId)
    .eq("id", a.id)
    .maybeSingle();
  if (readError) return { error: "Could not load your analysis record." };
  const { error } = existing
    ? await supabase
        .from("analyses")
        .update({ data: a as unknown as Json })
        .eq("owner_id", userId)
        .eq("id", a.id)
    : await supabase
        .from("analyses")
        .insert({ owner_id: userId, id: a.id, data: a as unknown as Json });
  return error
    ? {
        error:
          "Could not save the analysis to your account. Your local copy is retained; retry saving.",
      }
    : { success: true };
}
