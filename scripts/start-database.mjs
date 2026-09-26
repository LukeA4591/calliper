import { spawnSync } from "node:child_process";

// Node loads .env.local before this script; secrets reach the CLI via its environment.
const result = spawnSync("pnpm", ["supabase", "start"], { stdio: "inherit" });
process.exit(result.status ?? 1);
