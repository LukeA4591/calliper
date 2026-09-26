"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  resendVerification,
  confirmEmail,
} from "@/app/auth/actions";
export function AuthForm({
  mode,
  token,
  type,
}: {
  mode: "register" | "login" | "forgot" | "reset" | "resend" | "confirm";
  token?: string;
  type?: string;
}) {
  const action = {
    register,
    login,
    forgot: forgotPassword,
    reset: resetPassword,
    resend: resendVerification,
    confirm: confirmEmail,
  }[mode];
  const [state, submit, pending] = useActionState(action, {});
  const password = ["register", "login", "reset"].includes(mode);
  const label = {
    register: "Create account",
    login: "Sign in",
    forgot: "Send reset link",
    reset: "Update password",
    resend: "Resend verification link",
    confirm:
      type === "recovery" ? "Continue to password reset" : "Verify email",
  }[mode];
  return (
    <form action={submit} className="account-form">
      {mode === "confirm" ? (
        <>
          <input type="hidden" name="token_hash" value={token ?? ""} />
          <input type="hidden" name="type" value={type ?? ""} />
        </>
      ) : (
        mode !== "reset" && (
          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>
        )
      )}
      {mode === "register" && (
        <label>
          Account type
          <select name="role" required defaultValue="designer">
            <option value="designer">Designer — analyse drawings</option>
            <option value="manufacturer">
              Manufacturer — offer capabilities
            </option>
          </select>
          <small>Your account type is fixed after registration.</small>
        </label>
      )}
      {password && (
        <label>
          Password
          <input
            type="password"
            name="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            minLength={mode === "login" ? 1 : 12}
            maxLength={128}
            required
          />
          {mode !== "login" && <small>Use 12–128 characters.</small>}
        </label>
      )}
      {(mode === "register" || mode === "reset") && (
        <label>
          Confirm password
          <input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </label>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Please wait…" : label}
      </Button>
      {(state.error || state.success) && (
        <p
          role={state.error ? "alert" : "status"}
          className={
            state.error ? "auth-feedback auth-feedback-error" : "auth-feedback auth-feedback-success"
          }
        >
          {state.error || state.success}
        </p>
      )}
    </form>
  );
}
