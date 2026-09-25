import { ForgeWorkspace } from "@/components/forge/workspace";
import { createFixture } from "@/lib/forge/fixture";
import { connection } from "next/server";

export default async function Home() {
  await connection();
  return (
    <ForgeWorkspace
      initialAnalysis={createFixture()}
      aiConfigured={!!process.env.AI_API_KEY?.trim()}
    />
  );
}
