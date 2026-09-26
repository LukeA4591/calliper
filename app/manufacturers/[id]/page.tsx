import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Factory,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import {
  companyInitials,
  directoryMaterials,
  directoryProcesses,
  processLabel,
} from "@/lib/manufacturing/directory";
import { Button } from "@/components/ui/button";

export default async function ManufacturerDetails({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase, userId } = await requireUser();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const { data: p, error } = await supabase
    .from("manufacturer_profiles")
    .select(
      "user_id,business_name,description,location,contact_email,contact_phone,processes,materials,max_x_mm,max_y_mm,max_z_mm,tolerance_mm,capacity_notes,limitations,published,updated_at,machines(id,name,brand,model,category,processes,materials,max_x_mm,max_y_mm,max_z_mm,tolerance_mm,special_capabilities,notes)",
    )
    .eq("user_id", id)
    .maybeSingle();
  if (error) throw new Error("Could not load manufacturer profile.");
  if (!p) notFound();
  const specialisations = [
    ...new Set(p.machines.flatMap((machine) => machine.special_capabilities)),
  ];
  const phone = p.contact_phone.replace(/[^+\d]/g, "");
  return (
    <main id="main">
      <section className="directory-hero profile-hero">
        <div>
          <Link className="directory-back" href="/manufacturers">
            <ArrowLeft size={15} aria-hidden="true" />
            All manufacturers
          </Link>
          <div className="profile-identity">
            <div className="company-avatar" aria-hidden="true">
              {companyInitials(p.business_name)}
            </div>
            <div>
              <h1>{p.business_name}</h1>
              <p>
                <MapPin size={15} aria-hidden="true" />
                {p.location || "Location not provided"}
              </p>
            </div>
          </div>
        </div>
      </section>
      <div className="directory-content">
        {!p.published && (
          <p className="profile-private">
            Private draft · this preview is only visible to you.
          </p>
        )}
        <div className="profile-layout">
          <div className="profile-sections">
            <section className="profile-card" id="overview">
              <p className="directory-eyebrow">THE BUSINESS</p>
              <h2>Company overview</h2>
              <p className="profile-prose">
                {p.description ||
                  "This manufacturer hasn’t added a company description yet."}
              </p>
            </section>
            <section className="profile-card" id="capabilities">
              <p className="directory-eyebrow">WHAT THEY CAN MAKE</p>
              <h2>Manufacturing capabilities</h2>
              <h3>Processes</h3>
              <div className="capability-tags">
                {directoryProcesses(p).map((value) => (
                  <span key={value}>{processLabel(value)}</span>
                ))}
                {!directoryProcesses(p).length && <p>Not specified</p>}
              </div>
              <h3>Materials & grades</h3>
              <div className="capability-tags neutral-tags">
                {directoryMaterials(p).map((value) => (
                  <span key={value}>{value}</span>
                ))}
                {!directoryMaterials(p).length && <p>Not specified</p>}
              </div>
              <p className="profile-hint">
                Includes materials declared for the business or individual
                machines. Confirm the process and grade together with the
                manufacturer.
              </p>
              <h3>Specialisations</h3>
              {specialisations.length ? (
                <div className="capability-tags neutral-tags">
                  {specialisations.map((value) => (
                    <span key={value}>{value.replaceAll("_", " ")}</span>
                  ))}
                </div>
              ) : (
                <p className="profile-hint">
                  No additional specialisations listed. Contact the business
                  about specific requirements.
                </p>
              )}
              <dl className="profile-facts">
                <div>
                  <dt>Business tolerance capability</dt>
                  <dd>
                    {p.tolerance_mm === null
                      ? "Not specified"
                      : `±${p.tolerance_mm} mm`}
                  </dd>
                </div>
                {[p.max_x_mm, p.max_y_mm, p.max_z_mm].some(
                  (value) => value !== null,
                ) && (
                  <div>
                    <dt>Declared business size limit (x × y × z)</dt>
                    <dd>
                      {[p.max_x_mm, p.max_y_mm, p.max_z_mm]
                        .map((value) =>
                          value === null ? "Unspecified" : `${value} mm`,
                        )
                        .join(" × ")}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
            <section className="profile-card" id="equipment">
              <div className="profile-equipment-heading">
                <div>
                  <p className="directory-eyebrow">ON THE WORKSHOP FLOOR</p>
                  <h2>Machinery & equipment</h2>
                </div>
                <span>{p.machines.length} listed</span>
              </div>
              {!p.machines.length && (
                <p className="profile-hint">
                  No machines listed yet. Contact the business to discuss
                  available equipment.
                </p>
              )}
              <div className="profile-machines">
                {p.machines
                  .toSorted((a, b) => a.name.localeCompare(b.name))
                  .map((machine) => (
                    <article className="profile-machine" key={machine.id}>
                      <div className="profile-machine-heading">
                        <Factory size={22} aria-hidden="true" />
                        <div>
                          <h3>{machine.name}</h3>
                          <p>
                            {processLabel(machine.category)}
                            {[machine.brand, machine.model].filter(Boolean)
                              .length > 0 &&
                              ` · ${[machine.brand, machine.model].filter(Boolean).join(" ")}`}
                          </p>
                        </div>
                      </div>
                      <h4>Working envelope</h4>
                      <dl className="profile-dimensions">
                        {(["x", "y", "z"] as const).map((axis) => (
                          <div key={axis}>
                            <dt>{axis} axis</dt>
                            <dd>
                              {machine[`max_${axis}_mm`] === null ? (
                                "Not specified"
                              ) : (
                                <>
                                  {machine[`max_${axis}_mm`]} <small>mm</small>
                                </>
                              )}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <dl className="profile-facts">
                        <div>
                          <dt>Processes</dt>
                          <dd>
                            {[
                              ...new Set([
                                machine.category,
                                ...machine.processes,
                              ]),
                            ]
                              .map(processLabel)
                              .join(" · ")}
                          </dd>
                        </div>
                        <div>
                          <dt>Machine-specific materials</dt>
                          <dd>
                            {machine.materials.join(" · ") ||
                              "Not specified; confirm materials for this machine"}
                          </dd>
                        </div>
                        <div>
                          <dt>Machine-specific tolerance</dt>
                          <dd>
                            {machine.tolerance_mm === null
                              ? "Not specified"
                              : `±${machine.tolerance_mm} mm`}
                          </dd>
                        </div>
                        {machine.special_capabilities.length > 0 && (
                          <div>
                            <dt>Additional capabilities</dt>
                            <dd>
                              {machine.special_capabilities
                                .map((value) => value.replaceAll("_", " "))
                                .join(" · ")}
                            </dd>
                          </div>
                        )}
                        {machine.notes && (
                          <div>
                            <dt>Equipment notes</dt>
                            <dd className="profile-prose">{machine.notes}</dd>
                          </div>
                        )}
                      </dl>
                    </article>
                  ))}
              </div>
            </section>
            <section className="profile-card">
              <p className="directory-eyebrow">PLANNING A PROJECT</p>
              <h2>Working with this manufacturer</h2>
              <h3>Capacity & lead times</h3>
              <p className="profile-prose">
                {p.capacity_notes ||
                  "Contact the business for current capacity and lead times."}
              </p>
              <h3>Limitations & notes</h3>
              <p className="profile-prose">
                {p.limitations ||
                  "No limitations declared. Discuss your project requirements directly."}
              </p>
            </section>
          </div>
          <aside className="profile-contact">
            <section className="profile-card">
              <p className="directory-eyebrow">START A CONVERSATION</p>
              <h2>Contact the business</h2>
              <p className="profile-hint">
                Share your requirements and confirm what’s possible.
              </p>
              <a
                className="profile-contact-detail"
                href={`mailto:${encodeURIComponent(p.contact_email)}`}
              >
                <Mail size={16} aria-hidden="true" />
                <span>{p.contact_email}</span>
              </a>
              {p.contact_phone && (
                <div className="profile-contact-detail">
                  <Phone size={16} aria-hidden="true" />
                  {phone ? (
                    <a href={`tel:${phone}`}>{p.contact_phone}</a>
                  ) : (
                    <span>{p.contact_phone}</span>
                  )}
                </div>
              )}
              <Button asChild>
                <a href={`mailto:${encodeURIComponent(p.contact_email)}`}>
                  Email manufacturer
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              </Button>
              {p.user_id === userId && (
                <Link className="directory-text-link" href="/manufacturer">
                  Edit your business profile
                </Link>
              )}
            </section>
            <nav aria-label="Profile sections">
              <a href="#overview">Company overview</a>
              <a href="#capabilities">Capabilities & materials</a>
              <a href="#equipment">Machinery & equipment</a>
            </nav>
            <p className="profile-hint">
              Business information provided by the manufacturer. Contact details
              are shared with signed-in Calliper users.
            </p>
          </aside>
        </div>
        <p className="directory-disclaimer">
          Manufacturer-declared capabilities are not a guarantee of
          manufacturability, pricing or availability. Confirm suitability
          directly before placing an order.
        </p>
      </div>
    </main>
  );
}
