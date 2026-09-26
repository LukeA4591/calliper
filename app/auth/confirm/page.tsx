import { AccountShell } from "@/components/account-shell";
import { AuthForm } from "@/components/auth-form";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function Confirm({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash, type } = await searchParams;
  return (
    <AccountShell
      title={type === "recovery" ? "Reset your password" : "Verify your email"}
      description="Continue to securely verify this one-time link."
    >
      <AuthForm mode="confirm" token={token_hash} type={type} />
      <div className="account-links">
        <Link href="/login">Sign in / resend verification</Link>
        <Link href="/forgot-password">Request a new reset link</Link>
      </div>
    </AccountShell>
  );
}
