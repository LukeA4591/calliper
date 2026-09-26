import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { AccountShell } from "@/components/account-shell";
import { processLabels, processSchema } from "@/lib/manufacturing/schemas";
import { idSchema } from "@/lib/validation";
export default async function ManufacturerDetails({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await requireUser();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const { data: p, error } = await supabase
    .from("manufacturer_profiles")
    .select("*")
    .eq("user_id", id)
    .maybeSingle();
  if (error) throw new Error("Could not load manufacturer.");
  if (!p) notFound();
  const { data: machines, error: me } = await supabase
    .from("machines")
    .select("*")
    .eq("manufacturer_id", id)
    .order("name");
  if (me) throw new Error("Could not load equipment.");
  const labels = (list: string[]) =>
    list.map((v) => processLabels[processSchema.parse(v)]).join(", ") ||
    "Unspecified";
  const size = (v: {
    max_x_mm: number | null;
    max_y_mm: number | null;
    max_z_mm: number | null;
  }) => `${v.max_x_mm ?? "?"} × ${v.max_y_mm ?? "?"} × ${v.max_z_mm ?? "?"} mm`;
  return (
    <AccountShell signedIn title={p.business_name} description={p.location}>
      <p>{p.description}</p>
      <section className="account-section">
        <h2>Business capabilities</h2>
        <dl className="capability-list">
          <dt>Business contact</dt>
          <dd>
            {p.contact_email}
            {p.contact_phone && ` · ${p.contact_phone}`}
          </dd>
          <dt>Processes</dt>
          <dd>{labels(p.processes)}</dd>
          <dt>Materials</dt>
          <dd>{p.materials.join(", ") || "Unspecified"}</dd>
          <dt>Maximum part size (X × Y × Z)</dt>
          <dd>{size(p)}</dd>
          <dt>Smallest ± tolerance</dt>
          <dd>
            {p.tolerance_mm === null ? "Unspecified" : `${p.tolerance_mm} mm`}
          </dd>
          <dt>Production capacity</dt>
          <dd>{p.capacity_notes || "Unspecified; contact manufacturer"}</dd>
          <dt>Limitations</dt>
          <dd>{p.limitations || "None declared"}</dd>
        </dl>
      </section>
      <section className="account-section">
        <h2>Declared equipment</h2>
        {!machines?.length && (
          <p>No machines listed. Capability requires confirmation.</p>
        )}
        {machines?.map((m) => (
          <article className="machine-record" key={m.id}>
            <h3>{m.name}</h3>
            <p>
              {[m.brand, m.model].filter(Boolean).join(" ") ||
                "Brand/model unspecified"}
            </p>
            <dl className="capability-list">
              <dt>Processes</dt>
              <dd>{labels(m.processes)}</dd>
              <dt>Materials</dt>
              <dd>{m.materials.join(", ") || "Unspecified"}</dd>
              <dt>Working envelope</dt>
              <dd>{size(m)}</dd>
              <dt>Smallest ± tolerance</dt>
              <dd>
                {m.tolerance_mm === null
                  ? "Unspecified"
                  : `${m.tolerance_mm} mm`}
              </dd>
              <dt>Additional capabilities</dt>
              <dd>
                {m.special_capabilities
                  .map((s) => s.replaceAll("_", " "))
                  .join(", ") || "Unspecified"}
              </dd>
              <dt>Limitations</dt>
              <dd>{m.notes || "None declared"}</dd>
            </dl>
          </article>
        ))}
      </section>
      <p className="account-intro">
        Manufacturer-declared information, not a guarantee of manufacturability,
        pricing, availability, or willingness to accept a job.
      </p>
    </AccountShell>
  );
}
