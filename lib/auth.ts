import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/config";
export async function getCurrentUser() {
  if (!isConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
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
  return {
    supabase,
    userId: data.user.id,
    email: data.user.email ?? "",
    role: account.role as "designer" | "manufacturer",
  };
}

export async function requireUser(role?: "designer" | "manufacturer") {
  const account = await getCurrentUser();
  if (!account) redirect("/login");
  if (role && account.role !== role)
    redirect(account.role === "manufacturer" ? "/manufacturer" : "/");
  return account;
}
