import Link from "next/link";
import { AccountShell } from "@/components/account-shell";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return (
    <AccountShell
      title="Check your email"
      description="Check your email for a verification link to finish setting up your Calliper account."
    >
      <div className="verification-next-steps">
        <ol>
          <li>Open the email from Calliper. Check spam if it hasn’t arrived.</li>
          <li>Follow the link and select Verify email to open your workspace.</li>
        </ol>
        <p>
          Already have an account? Sign in instead, or reset your password if
          you’ve forgotten it.
        </p>
        <div className="account-links">
          <Link href="/login">Back to sign in</Link>
          <Link href="/forgot-password">Reset password</Link>
        </div>
        <details>
          <summary>Didn’t receive the email?</summary>
          <AuthForm mode="resend" />
        </details>
      </div>
    </AccountShell>
  );
}
