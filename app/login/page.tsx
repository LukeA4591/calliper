import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AccountShell } from "@/components/account-shell";
import { SetupNotice } from "@/components/setup-notice";
import { isConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  if (isConfigured()) {
    const c = await createClient();
    const { data } = await c.auth.getUser();
    if (data.user?.email_confirmed_at) redirect("/");
  }
  return (
    <AccountShell
      eyebrow="SIGN IN TO CALLIPER"
      title="Welcome back"
      description="Sign in to your Calliper workspace."
      action={{ href: "/register", label: "Create an account" }}
    >
      {notice === "password-updated" && (
        <p role="status" className="status-success">Password updated. Sign in with your new password.</p>
      )}
      {notice === "verify" && (
        <p role="status" className="status-warning">Verify your email before continuing.</p>
      )}
      {isConfigured() ? (
        <>
          <AuthForm mode="login" />
          <div className="account-links">
            <Link href="/register">Create an account</Link>
            <Link href="/forgot-password">Forgot password?</Link>
            <Link href="/login/code">Sign in with an email code</Link>
          </div>
          <details>
            <summary>Resend verification email</summary>
            <AuthForm mode="resend" />
          </details>
        </>
      ) : (
        <SetupNotice />
      )}
    </AccountShell>
  );
}
