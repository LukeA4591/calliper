import { requireUser } from "@/lib/auth";
import { ManufacturersDirectory } from "@/components/manufacturers/directory";
import type { DirectoryManufacturer } from "@/lib/manufacturing/directory";

export const metadata = { title: "Manufacturers" };
export default async function ManufacturersPage() {
  const { supabase } = await requireUser();
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
        <ManufacturersDirectory manufacturers={manufacturers} />
        <p className="directory-disclaimer">
          Capabilities are declared by each manufacturer. Contact the business
          to confirm suitability, availability and pricing for your project.
        </p>
      </div>
    </main>
  );
}
