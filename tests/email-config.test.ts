import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const base = readFileSync("supabase/config.toml", "utf8")
  .replace(/# BEGIN CALLIPER EMAIL DELIVERY[\s\S]*?# END CALLIPER EMAIL DELIVERY\n?/g, "");
const cli = resolve("node_modules/tsx/dist/cli.mjs");
const script = resolve("scripts/configure-email.ts");

test("SMTP configuration round-trips without persisting credentials or changing database/auth identity", () => {
  const dir = mkdtempSync(join(tmpdir(), "calliper-email-"));
  try {
    mkdirSync(join(dir, "supabase"));
    const path = join(dir, "supabase/config.toml");
    writeFileSync(path, base);
    const env = {
      ...process.env,
      SMTP_HOST: "smtp.resend.com", SMTP_PORT: "465", SMTP_USER: "resend",
      SMTP_PASSWORD: "test-only-secret-not-a-real-key", SMTP_FROM_EMAIL: "hello@mail.example.com",
    };
    const run = (mode: string) => spawnSync(process.execPath, [cli, script, mode], { cwd: dir, env, encoding: "utf8" });
    assert.equal(run("smtp").status, 0);
    assert.equal(run("smtp").status, 0);
    const smtp = readFileSync(path, "utf8");
    assert.equal(smtp.match(/\[auth.email.smtp\]/g)?.length, 1);
    assert.ok(smtp.includes('pass = "env(SMTP_PASSWORD)"'));
    assert.ok(!smtp.includes(env.SMTP_PASSWORD));
    assert.ok(smtp.includes('max_frequency = "60s"'));
    assert.equal(run("local").status, 0);
    assert.equal(readFileSync(path, "utf8").trim(), base.replace(/^max_frequency = .*$/m, 'max_frequency = "1s"').trim());
    env.SMTP_PASSWORD = "";
    const before = readFileSync(path, "utf8");
    assert.notEqual(run("smtp").status, 0);
    assert.equal(readFileSync(path, "utf8"), before);
    assert.notEqual(run("unsupported").status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
