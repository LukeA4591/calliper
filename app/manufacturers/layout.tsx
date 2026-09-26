import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import "../designer.css";
import "./directory.css";

export default async function ManufacturersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role } = await requireUser();
  return (
    <div className="forge-app designer-app directory-app">
      <header className="app-navigation">
        <Link className="forge-brand" href="/" aria-label="Calliper home">
          <Brand />
        </Link>
        <nav aria-label="Main navigation">
          <Link
            className="nav-item"
            href={role === "designer" ? "/" : "/manufacturer"}
          >
            {role === "designer" ? "Projects" : "My business"}
          </Link>
          <Link
            className="nav-item active"
            href="/manufacturers"
            aria-current="page"
          >
            Manufacturers
          </Link>
        </nav>
        <form action={signOut} className="ml-auto">
          <Button variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </header>
      {children}
    </div>
  );
}
