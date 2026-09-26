import { z } from "zod";
import { emailSchema } from "./validation";
export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128, "Use no more than 128 characters.");
export const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    role: z.enum(["designer", "manufacturer"]),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords must match.",
  });
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export const resetSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords must match.",
  });
