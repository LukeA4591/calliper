import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { z } from "zod";

// Configure the existing local stack; never creates or resets a database.
const mode = process.argv[2];
if (mode !== "smtp" && mode !== "local") {
  console.error("Usage: pnpm email:configure smtp|local");
  process.exit(1);
}
if (existsSync(".env.local")) loadEnvFile(".env.local");

const path = "supabase/config.toml";
let config = readFileSync(path, "utf8");
const start = "# BEGIN CALLIPER EMAIL DELIVERY";
const end = "# END CALLIPER EMAIL DELIVERY";
config = config.replace(new RegExp(`${start}[\\s\\S]*?${end}\\n?`, "g"), "");
if (/^\[auth\.email\.smtp\]/m.test(config)) {
  throw new Error("An unmanaged SMTP section already exists in supabase/config.toml. Review it before configuring email.");
}
if (mode === "smtp") {
  const settings = z.object({
    SMTP_HOST: z.string().regex(/^[a-zA-Z0-9.-]+$/),
    SMTP_PORT: z.coerce.number().int().refine((port) => [465, 587, 2465, 2587].includes(port)),
    SMTP_USER: z.string().trim().min(1),
    SMTP_PASSWORD: z.string().min(1),
    SMTP_FROM_EMAIL: z.email().refine((email) => !email.endsWith(".example") && !email.endsWith(".test")),
  }).safeParse(process.env);
  if (!settings.success) {
    console.error("Add valid SMTP settings to .env.local first. Missing/invalid fields:");
    console.error(settings.error.issues.map((issue) => issue.path.join(".")).join(", "));
    process.exit(1);
  }
  config += `\n${start}\n[auth.email.smtp]\nenabled = true\nhost = "env(SMTP_HOST)"\nport = ${settings.data.SMTP_PORT}\nuser = "env(SMTP_USER)"\npass = "env(SMTP_PASSWORD)"\nadmin_email = "env(SMTP_FROM_EMAIL)"\nsender_name = "Calliper"\n${end}\n`;
}
config = config.replace(/^max_frequency = .*$/m, `max_frequency = "${mode === "smtp" ? "60s" : "1s"}"`);
writeFileSync(path, config);
console.log(`Email delivery configured for ${mode === "smtp" ? "your SMTP provider" : "the local test inbox"}.`);
console.log("Apply it without losing data: pnpm supabase stop && pnpm db:start");
console.log("Email links use auth.site_url in supabase/config.toml. Use your deployed HTTPS app URL for other people.");
