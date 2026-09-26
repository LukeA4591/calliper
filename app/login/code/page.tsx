import Link from "next/link";
import { AccountShell } from "@/components/account-shell";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { SetupNotice } from "@/components/setup-notice";
import { isConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };
export default async function LoginPage() {
  const configured = isConfigured();
  if (configured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims.sub) redirect("/");
  }
  return (
    <AccountShell
      title="Sign in with an email code"
      description="Use an existing account. New users should register and choose an account type first."
    >
      {configured ? <LoginForm /> : <SetupNotice />}
      <div className="account-links">
        <Link href="/login">Use password instead</Link>
        <Link href="/register">Create an account</Link>
      </div>
    </AccountShell>
  );
}
