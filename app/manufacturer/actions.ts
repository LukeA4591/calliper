"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { machineSchema, profileSchema } from "@/lib/manufacturing/schemas";
import { idSchema, type FormState } from "@/lib/validation";
function numeric(form: FormData, key: string) {
  const v = form.get(key);
  return v === null || v === "" ? null : Number(v);
}
function fields(form: FormData) {
  return {
    ...Object.fromEntries(form),
    processes: form.getAll("processes"),
    materials: [
      ...form.getAll("materials"),
      ...String(form.get("other_materials") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ],
    max_x_mm: numeric(form, "max_x_mm"),
    max_y_mm: numeric(form, "max_y_mm"),
    max_z_mm: numeric(form, "max_z_mm"),
    tolerance_mm: numeric(form, "tolerance_mm"),
  };
}
export async function saveManufacturer(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireUser("manufacturer");
  if (form.get("account_context") !== userId)
    return { error: "Your account changed. Reload before saving." };
  const p = profileSchema.safeParse({
    ...fields(form),
    published: form.get("published") === "on",
  });
  if (!p.success) return { error: p.error.issues[0].message };
  if (p.data.published) {
    const { count, error } = await supabase
      .from("machines")
      .select("id", { count: "exact", head: true })
      .eq("manufacturer_id", userId);
    if (error || !count)
      return {
        error: "Save a draft and add at least one machine before publishing.",
      };
  }
  const { data: existing, error: readError } = await supabase
    .from("manufacturer_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) return { error: "Could not read your profile. Try again." };
  const { error } = existing
    ? await supabase
        .from("manufacturer_profiles")
        .update(p.data)
        .eq("user_id", userId)
    : await supabase
        .from("manufacturer_profiles")
        .insert({ ...p.data, user_id: userId });
  if (error)
    return {
      error:
        "Could not save the profile. Check the database connection and try again.",
    };
  revalidatePath("/manufacturer");
  revalidatePath("/manufacturers");
  return {
    success: p.data.published
      ? "Profile published. Designers can now find your declared capabilities."
      : "Draft saved. Add equipment, then publish when ready.",
  };
}
export async function saveMachine(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireUser("manufacturer");
  if (form.get("account_context") !== userId)
    return { error: "Your account changed. Reload before saving." };
  const p = machineSchema.safeParse({
    ...fields(form),
    special_capabilities: form.getAll("special_capabilities"),
  });
  if (!p.success) return { error: p.error.issues[0].message };
  const id = form.get("id");
  if (id && !idSchema.safeParse(id).success)
    return { error: "Invalid machine." };
  const result = id
    ? await supabase
        .from("machines")
        .update(p.data)
        .eq("id", String(id))
        .eq("manufacturer_id", userId)
        .select("id")
    : await supabase
        .from("machines")
        .insert({ ...p.data, manufacturer_id: userId })
        .select("id");
  if (result.error || !result.data?.length)
    return {
      error:
        "Could not save the machine. Save your business profile first and try again.",
    };
  revalidatePath("/manufacturer");
  revalidatePath("/manufacturers");
  return { success: "Machine saved." };
}
export async function deleteMachine(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireUser("manufacturer");
  if (form.get("account_context") !== userId)
    return { error: "Your account changed. Reload before removing equipment." };
  const id = idSchema.safeParse(form.get("id"));
  if (!id.success) return { error: "Invalid machine." };
  const { error } = await supabase
    .from("machines")
    .delete()
    .eq("id", id.data)
    .eq("manufacturer_id", userId);
  if (error) return { error: "Could not remove the machine." };
  revalidatePath("/manufacturer");
  return { success: "Machine removed. Matching uses the remaining equipment." };
}
