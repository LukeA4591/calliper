import Link from "next/link";
import { AccountShell } from "@/components/account-shell";
import { AuthForm } from "@/components/auth-form";
import { SetupNotice } from "@/components/setup-notice";
import { isConfigured } from "@/lib/config";
export default function RegisterPage() {
  return (
    <AccountShell
      eyebrow="ONE ACCOUNT, TWO WAYS TO WORK"
      title="Create your account"
      description="Choose your role, then verify your email to get started."
      action={{ href: "/login", label: "Sign in" }}
    >
      {isConfigured() ? <AuthForm mode="register" /> : <SetupNotice />}
      <div className="account-links">
        <Link href="/login">Already registered? Sign in</Link>
      </div>
    </AccountShell>
  );
}
