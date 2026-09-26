import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AccountShell } from "@/components/account-shell";
import {
  BusinessForm,
  MachineForm,
  RemoveMachine,
} from "@/components/manufacturer-forms";
import {
  profileSchema,
  machineSchema,
  processLabels,
} from "@/lib/manufacturing/schemas";
export default async function ManufacturerDashboard() {
  const { supabase, userId } = await requireUser("manufacturer");
  const [{ data: profile, error }, { data: machines, error: machineError }] =
    await Promise.all([
      supabase
        .from("manufacturer_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("machines")
        .select("*")
        .eq("manufacturer_id", userId)
        .order("name"),
    ]);
  if (error || machineError)
    throw new Error(
      "Could not load manufacturer data. Check the database migration.",
    );
  return (
    <AccountShell
      signedIn
      title={
        profile
          ? "Manufacturer workspace"
          : "Set up your manufacturing business"
      }
      description="Describe your real equipment and capabilities. Leave unknown specifications blank."
    >
      <ol className="onboarding-progress">
        <li className={profile ? "status-success" : "status-warning"}>
          {profile ? "✓" : "1."} Business profile
        </li>
        <li className={machines?.length ? "status-success" : "status-warning"}>
          {machines?.length ? "✓" : "2."} Equipment
        </li>
        <li className={profile?.published ? "status-success" : "status-warning"}>
          {profile?.published ? "✓ Published" : "3. Publish for matching"}
        </li>
      </ol>
      <section className="account-section">
        <h2>
          Business profile{" "}
          <span
            className={`status-badge ${profile?.published ? "status-success" : "status-warning"}`}
          >
            {profile?.published ? "Published" : "Private draft"}
          </span>
        </h2>
        {profile?.published && (
          <Link href={`/manufacturers/${userId}`}>
            View published profile →
          </Link>
        )}
        {profile && (
          <p className="account-intro">
            {profile.business_name} · {profile.location}
          </p>
        )}
        <details open={!profile}>
          <summary>
            {profile ? "Edit business profile" : "Create business profile"}
          </summary>
          <BusinessForm
            userId={userId}
            profile={
              profile
                ? { ...profileSchema.parse(profile), user_id: userId }
                : undefined
            }
          />
        </details>
      </section>
      <section className="account-section">
        <h2>Machines & equipment ({machines?.length ?? 0})</h2>
        {!profile ? (
          <p>Save your business profile first, then add machines here.</p>
        ) : (
          <>
            {!machines?.length && (
              <p>
                No equipment yet. Add at least one machine, then publish your
                business profile.
              </p>
            )}
            {machines?.map((row) => (
              <article key={row.id} className="machine-record">
                <h3>{row.name}</h3>
                <p>
                  {processLabels[machineSchema.parse(row).category]} ·{" "}
                  {[row.brand, row.model].filter(Boolean).join(" ") ||
                    "Brand/model unspecified"}
                </p>
                <details>
                  <summary>Edit capabilities</summary>
                  <MachineForm
                    userId={userId}
                    machine={{
                      ...machineSchema.parse(row),
                      id: row.id,
                      manufacturer_id: row.manufacturer_id,
                    }}
                  />
                </details>
                <RemoveMachine id={row.id} userId={userId} />
              </article>
            ))}
            <details open={!machines?.length}>
              <summary>Add a machine</summary>
              <MachineForm userId={userId} />
            </details>
          </>
        )}
      </section>
    </AccountShell>
  );
}
