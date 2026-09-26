import { ForgeWorkspace } from "@/components/forge/workspace";
import { analysisSchema } from "@/lib/forge/types";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/landing-page";
import "./designer.css";
export const dynamic = "force-dynamic";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const account = await getCurrentUser();
  if (!account) return <LandingPage />;
  const { supabase, userId, email, role } = account;
  if (role === "manufacturer") redirect("/manufacturer");
  const { data, error } = await supabase
    .from("analyses")
    .select("data,updated_at")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });
  if (error)
    throw new Error(
      "Could not load analysis history. Apply the database migrations and try again.",
    );
  const projects = (data ?? []).flatMap((row) => {
    const parsed = analysisSchema.safeParse(row.data);
    return parsed.success && parsed.data.mode === "uploaded"
      ? [{ analysis: parsed.data, updatedAt: row.updated_at }]
      : [];
  });
  const { project } = await searchParams;
  return (
    <ForgeWorkspace
      userId={userId}
      email={email}
      savedAnalyses={projects}
      initialProjectId={project}
      aiConfigured={!!process.env.AI_API_KEY?.trim()}
    />
  );
}
