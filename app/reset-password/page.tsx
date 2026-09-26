import { requireUser } from "@/lib/auth";
import { AccountShell } from "@/components/account-shell";
import { AuthForm } from "@/components/auth-form";
export default async function Reset() {
  await requireUser();
  return (
    <AccountShell
      title="Choose a new password"
      description="After saving, sign in again with your new password."
    >
      <AuthForm mode="reset" />
    </AccountShell>
  );
}
