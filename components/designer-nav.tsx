"use client";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/login/actions";

/** One header for every designer page. The Projects tab is a route on the directory
 * and a view switch inside the workspace, so it accepts either. */
export function DesignerNav({
  email,
  active,
  onProjects,
  label = "DESIGNER WORKSPACE",
  homeLabel = "Projects",
  homeHref = "/",
  children,
}: {
  email: string;
  active: "projects" | "manufacturers";
  onProjects?: () => void;
  label?: string;
  homeLabel?: string;
  homeHref?: string;
  children?: React.ReactNode;
}) {
  const projectsClass = active === "projects" ? "nav-item active" : "nav-item";
  return (
    <header className="app-navigation">
      <Link className="forge-brand" href="/" aria-label="Calliper home">
        <Brand />
      </Link>
      <span className="designer-nav-label">{label}</span>
      <nav aria-label="Main navigation">
        {onProjects ? (
          <button
            className={projectsClass}
            aria-current={active === "projects" ? "page" : undefined}
            onClick={onProjects}
          >
            {homeLabel}
          </button>
        ) : (
          <Link
            className={projectsClass}
            href={homeHref}
            aria-current={active === "projects" ? "page" : undefined}
          >
            {homeLabel}
          </Link>
        )}
        <Link
          className={
            active === "manufacturers" ? "nav-item active" : "nav-item"
          }
          href="/manufacturers"
          aria-current={active === "manufacturers" ? "page" : undefined}
        >
          Manufacturers
        </Link>
      </nav>
      <span className="workspace-label">{email}</span>
      <form action={signOut}>
        <Button variant="ghost" size="sm">
          Sign out
        </Button>
      </form>
      {children}
    </header>
  );
}
