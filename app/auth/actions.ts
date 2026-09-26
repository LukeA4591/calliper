"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { signupSchema, loginSchema, resetSchema } from "@/lib/auth-validation";
import { emailSchema, type FormState } from "@/lib/validation";
import { z } from "zod";

export async function register(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const p = signupSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const client = await createClient();
  const { error } = await client.auth.signUp({
    email: p.data.email,
    password: p.data.password,
    options: { data: { account_type: p.data.role } },
  });
  if (error)
    return {
      error:
        "Registration could not be completed. Check your details or try again later.",
    };
  return {
    success:
      "Check your email for a verification link. If you already have an account, sign in or reset your password.",
  };
}
export async function login(_: FormState, form: FormData): Promise<FormState> {
  const p = loginSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Enter a valid email and password." };
  const client = await createClient();
  const { data, error } = await client.auth.signInWithPassword(p.data);
  if (error)
    return {
      error:
        error.code === "email_not_confirmed"
          ? "Verify your email before signing in. You can resend the verification link below."
          : "Email or password is incorrect, or sign-in is temporarily unavailable.",
    };
  if (!data.user.email_confirmed_at) {
    await client.auth.signOut();
    return { error: "Verify your email before signing in." };
  }
  revalidatePath("/", "layout");
  const user = await requireUser();
  redirect(user.role === "manufacturer" ? "/manufacturer" : "/");
}
export async function forgotPassword(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const p = emailSchema.safeParse(form.get("email"));
  if (!p.success) return { error: "Enter a valid email address." };
  const client = await createClient();
  const { error } = await client.auth.resetPasswordForEmail(p.data);
  if (error)
    return {
      error: "We could not send the email. Wait a moment and try again.",
    };
  return {
    success:
      "If that account exists, a password reset link has been sent. Check your inbox.",
  };
}
export async function resendVerification(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const p = emailSchema.safeParse(form.get("email"));
  if (!p.success) return { error: "Enter a valid email address." };
  const client = await createClient();
  const { error } = await client.auth.resend({ type: "signup", email: p.data });
  if (error)
    return {
      error: "Could not resend the link. Wait a moment or try signing in.",
    };
  return {
    success: "If your account needs verification, a new link has been sent.",
  };
}
export async function resetPassword(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const { supabase } = await requireUser();
  const p = resetSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const { error } = await supabase.auth.updateUser({
    password: p.data.password,
  });
  if (error)
    return {
      error:
        "Could not change your password. Use a different password or request a new reset link.",
    };
  await supabase.auth.signOut({ scope: "global" });
  revalidatePath("/", "layout");
  redirect("/login?notice=password-updated");
}
export async function confirmEmail(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const p = z
    .object({
      token_hash: z.string().regex(/^[a-zA-Z0-9_-]{20,256}$/),
      type: z.enum(["email", "signup", "recovery"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success)
    return { error: "This verification link is invalid. Request a new email." };
  const client = await createClient();
  const { error } = await client.auth.verifyOtp(p.data);
  if (error)
    return {
      error:
        "This link has expired or has already been used. Request a new email.",
    };
  revalidatePath("/", "layout");
  if (p.data.type === "recovery") redirect("/reset-password");
  const account = await requireUser();
  redirect(account.role === "manufacturer" ? "/manufacturer" : "/");
}
