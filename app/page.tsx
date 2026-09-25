import { ForgeWorkspace } from "@/components/forge/workspace";
import { createFixture } from "@/lib/forge/fixture";

export default function Home() {
  return <ForgeWorkspace initialAnalysis={createFixture()} />;
}
