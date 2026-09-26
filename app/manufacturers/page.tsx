import { requireUser } from "@/lib/auth";
import { ManufacturersDirectory } from "@/components/manufacturers/directory";
import type { DirectoryManufacturer } from "@/lib/manufacturing/directory";
import {
  parseProcessParam,
  requiredMaterial,
} from "@/lib/manufacturing/recommendations";
import { analysisSchema } from "@/lib/forge/types";
import { idSchema } from "@/lib/validation";
import type { ProjectContext } from "@/lib/manufacturing/recommendations";

export const metadata = { title: "Manufacturers" };
export default async function ManufacturersPage({
  searchParams,
}: {
  searchParams: Promise<{ processes?: string | string[]; project?: string }>;
}) {
  const { supabase, userId } = await requireUser();
  const { processes: requestedProcesses, project } = await searchParams;
  const recommended = parseProcessParam(requestedProcesses);
  // The project name, material and tolerance come from the owner's saved analysis,
  // never from the query string, so a link cannot put arbitrary text in the banner.
  let context: ProjectContext | null = null;
  if (project && idSchema.safeParse(project).success) {
    const { data } = await supabase
      .from("analyses")
      .select("data")
      .eq("owner_id", userId)
      .eq("id", project)
      .maybeSingle();
    const saved = data ? analysisSchema.safeParse(data.data) : undefined;
    if (saved?.success) {
      const tolerances = (saved.data.review?.tolerances ?? [])
        .map((t) => t.toleranceMm)
        .filter((value): value is number => value !== null);
      // The drawing's stated material is evidence; the project setting is the
      // designer's own declaration and only used when the drawing states none.
      const material = requiredMaterial(
        saved.data.review?.manufacturing,
        saved.data.material || null,
      );
      context = {
        id: saved.data.id,
        name: saved.data.projectName,
        revision: saved.data.revision,
        material: material.value,
        materialSource: material.source,
        toleranceMm: tolerances.length ? Math.min(...tolerances) : null,
      };
    }
  }
  const manufacturers: DirectoryManufacturer[] = [];
  // Page database reads so Supabase's response limit cannot silently truncate the directory.
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await supabase
      .from("manufacturer_profiles")
      .select(
        "user_id,business_name,location,description,processes,materials,machines(id,name,brand,model,category,processes,materials)",
      )
      .eq("published", true)
      .order("business_name")
      .order("user_id")
      .range(offset, offset + 199);
    if (error) throw new Error("Could not load the manufacturer directory.");
    manufacturers.push(...data);
    if (data.length < 200) break;
  }
  return (
    <main id="main">
      <section className="directory-hero">
        <div>
          <p className="directory-eyebrow">
            FIND YOUR NEXT MANUFACTURING PARTNER
          </p>
          <h1>Manufacturers</h1>
          <p>
            Explore the people, processes and equipment behind your next
            project.
          </p>
        </div>
      </section>
      <div className="directory-content">
        <ManufacturersDirectory
          manufacturers={manufacturers}
          recommended={recommended}
          context={context}
        />
        <p className="directory-disclaimer">
          Capabilities are declared by each manufacturer. Contact the business
          to confirm suitability, availability and pricing for your project.
        </p>
      </div>
    </main>
  );
}
