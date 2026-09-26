import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/config";
export async function requireUser(role?: "designer" | "manufacturer") {
  if (!isConfigured()) redirect("/login");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  if (!data.user.email_confirmed_at) redirect("/login?notice=verify");
  const { data: account, error: accountError } = await supabase
    .from("account_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .single();
  if (accountError || !account)
    throw new Error(
      "Account setup is unavailable. Apply the account migration and try again.",
    );
  if (role && account.role !== role)
    redirect(account.role === "manufacturer" ? "/manufacturer" : "/");
  return {
    supabase,
    userId: data.user.id,
    email: data.user.email ?? "",
    role: account.role as "designer" | "manufacturer",
  };
}
