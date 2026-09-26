import Link from "next/link";
import { AccountShell } from "@/components/account-shell";
import { AuthForm } from "@/components/auth-form";
import { SetupNotice } from "@/components/setup-notice";
import { isConfigured } from "@/lib/config";
export default function RegisterPage() {
  return (
    <AccountShell
      title="Create your account"
      description="Choose your role, then verify your email to get started."
    >
      {isConfigured() ? <AuthForm mode="register" /> : <SetupNotice />}
      <Link href="/login">Already registered? Sign in</Link>
    </AccountShell>
  );
}
