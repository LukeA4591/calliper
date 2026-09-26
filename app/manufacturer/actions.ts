"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  machineSchema,
  profileSchema,
  profileMachinesSchema,
} from "@/lib/manufacturing/schemas";
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
  let machineInput: unknown;
  try {
    machineInput = JSON.parse(String(form.get("machines") ?? ""));
  } catch {
    return { error: "Could not read your machines. Reload and try again." };
  }
  const machines = profileMachinesSchema.safeParse(machineInput);
  if (!machines.success) return { error: machines.error.issues[0].message };
  const p = profileSchema.omit({ published: true }).safeParse({
    ...fields(form),
    processes: [...new Set(machines.data.map((machine) => machine.category))],
  });
  if (!p.success) return { error: p.error.issues[0].message };
  const { data: existing, error: readError } = await supabase
    .from("manufacturer_profiles")
    .select("published")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) return { error: "Could not read your profile. Try again." };
  // One transaction saves the business and its machine list, preserving visibility.
  const { error } = await supabase.rpc("save_manufacturer_profile", {
    business: p.data,
    equipment: machines.data,
  });
  if (error)
    return {
      error:
        "Could not save the profile. Check the database connection and try again.",
    };
  revalidatePath("/manufacturer");
  revalidatePath("/manufacturers");
  revalidatePath(`/manufacturers/${userId}`);
  return {
    success: existing?.published
      ? "Business profile saved. Your published profile has been updated."
      : "Business profile saved as a private draft.",
  };
}
export async function setManufacturerPublication(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireUser("manufacturer");
  if (form.get("account_context") !== userId)
    return { error: "Your account changed. Reload before publishing." };
  const intent = z.enum(["publish", "unpublish"]).safeParse(form.get("intent"));
  if (!intent.success) return { error: "Choose publish or unpublish." };
  const published = intent.data === "publish";
  const { data, error } = await supabase
    .from("manufacturer_profiles")
    .update({ published })
    .eq("user_id", userId)
    .select("user_id");
  if (error)
    return { error: "Could not update profile visibility. Please try again." };
  if (!data?.length)
    return { error: "Save your business profile before publishing." };
  revalidatePath("/manufacturer");
  revalidatePath("/manufacturers");
  revalidatePath(`/manufacturers/${userId}`);
  return {
    success: published
      ? "Profile published. Verified Calliper users can now see your business profile."
      : "Profile unpublished. Your business profile is now private.",
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
  revalidatePath(`/manufacturers/${userId}`);
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
  revalidatePath("/manufacturers");
  revalidatePath(`/manufacturers/${userId}`);
  return { success: "Machine removed. Matching uses the remaining equipment." };
}
