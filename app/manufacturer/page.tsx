import Link from "next/link";
import { ArrowUpRight, CheckCircle2, FileText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { BusinessForm, PublicationForm } from "@/components/manufacturer-forms";
import {
  profileSchema,
  profileMachineSchema,
} from "@/lib/manufacturing/schemas";
import "./manufacturer.css";

export default async function ManufacturerDashboard() {
  const { supabase, userId } = await requireUser("manufacturer");
  const { data: row, error } = await supabase
    .from("manufacturer_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error)
    throw new Error("Could not load your business profile. Please try again.");
  const profile = row
    ? { ...profileSchema.parse(row), user_id: userId }
    : undefined;
  const { data: machineRows, error: machineError } = await supabase
    .from("machines")
    .select("*")
    .eq("manufacturer_id", userId)
    .order("id");
  if (machineError)
    throw new Error("Could not load your machines. Please try again.");
  const machines = (machineRows ?? []).map((row) =>
    profileMachineSchema.parse(row),
  );
  return (
    <div className="manufacturer-workspace">
      <header className="manufacturer-nav">
        <Link href="/" aria-label="Calliper home">
          <Brand />
        </Link>
        <span>MANUFACTURER WORKSPACE</span>
        <Link className="manufacturer-directory-link" href="/manufacturers">
          Manufacturers
        </Link>
        <form action={signOut}>
          <Button variant="ghost">Sign out</Button>
        </form>
      </header>
      <main id="main">
        <section className="manufacturer-hero">
          <div className="manufacturer-hero-inner">
            <p className="manufacturer-eyebrow">
              YOUR BUSINESS. YOUR CAPABILITIES.
            </p>
            <h1>
              Good work starts
              <br />
              with the right connection.
            </h1>
            <p>
              Show engineers what you can make.
              <br />
              One business profile. Everything they need to get in touch.
            </p>
            <div className="manufacturer-hero-footer">
              <span>YOUR MANUFACTURING PROFILE</span>
              <span>
                01 / DETAILS &nbsp; 02 / CAPABILITIES &nbsp; 03 / AVAILABILITY
              </span>
            </div>
          </div>
        </section>
        <div className="manufacturer-content">
          <div className="manufacturer-page-heading">
            <div>
              <p className="manufacturer-eyebrow">BUILT AROUND YOUR BUSINESS</p>
              <h2>
                {profile
                  ? "Your business profile"
                  : "Set up your business profile"}
              </h2>
              <p>
                Keep your capabilities in one place. Update them whenever things
                change.
              </p>
            </div>
            <span
              className={`manufacturer-status ${profile?.published ? "status-success" : "manufacturer-draft"}`}
            >
              {profile?.published ? (
                <CheckCircle2 size={15} aria-hidden="true" />
              ) : (
                <FileText size={15} aria-hidden="true" />
              )}
              {profile?.published
                ? "Published"
                : profile
                  ? "Private draft"
                  : "Not saved yet"}
            </span>
          </div>
          <div className="manufacturer-layout">
            <BusinessForm
              userId={userId}
              profile={profile}
              machines={machines}
            />
            <aside className="manufacturer-sidebar">
              <nav aria-label="Business profile sections">
                <p className="manufacturer-eyebrow">IN YOUR PROFILE</p>
                <a href="#business-details">
                  <span>01</span>Your business
                  <ArrowUpRight size={15} />
                </a>
                <a href="#business-capabilities">
                  <span>02</span>What you can make
                  <ArrowUpRight size={15} />
                </a>
                <a href="#business-capacity">
                  <span>03</span>Working with you
                  <ArrowUpRight size={15} />
                </a>
              </nav>
              <section className="manufacturer-card" id="publish-profile">
                <PublicationForm
                  userId={userId}
                  published={profile?.published ?? false}
                  hasProfile={!!profile}
                />
                {profile?.published && (
                  <Link
                    className="manufacturer-profile-link"
                    href={`/manufacturers/${userId}`}
                  >
                    View published profile
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                )}
              </section>
              <p className="manufacturer-sidebar-note">
                Only your listed business contact details are shared. Your login
                email isn’t added to your profile automatically.
              </p>
            </aside>
          </div>
        </div>
      </main>
      <footer className="manufacturer-footer">
        <Brand />
        <p>From drawing to doing.</p>
      </footer>
    </div>
  );
}
