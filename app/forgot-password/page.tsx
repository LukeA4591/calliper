import Link from "next/link";
import { AccountShell } from "@/components/account-shell";
import { AuthForm } from "@/components/auth-form";
import { isConfigured } from "@/lib/config";
import { SetupNotice } from "@/components/setup-notice";
export default function Forgot() {
  return (
    <AccountShell
      title="Reset your password"
      description="We’ll send you a secure, expiring reset link."
    >
      {isConfigured() ? <AuthForm mode="forgot" /> : <SetupNotice />}
      <Link href="/login">Back to sign in</Link>
    </AccountShell>
  );
}
