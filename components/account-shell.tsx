import { Brand } from "@/components/brand";
import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import "@/app/designer.css";
export function AccountShell({
  title,
  description,
  eyebrow,
  action,
  children,
  signedIn = false,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
  signedIn?: boolean;
}) {
  return (
    <div className="forge-app designer-app auth-app">
      <header className="app-navigation">
        <Link className="forge-brand" href="/" aria-label="Calliper home">
          <Brand />
        </Link>
        {signedIn ? (
          <>
            <nav aria-label="Main navigation">
              <Link className="nav-item" href="/">
                Workspace
              </Link>
            </nav>
            <form action={signOut} className="ml-auto">
              <Button variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </>
        ) : (
          action && (
            <div className="auth-nav-actions">
              <Link className="nav-item" href={action.href}>
                {action.label}
              </Link>
            </div>
          )
        )}
      </header>
      <main id="main" className="auth-main">
        <section className="auth-hero">
          <div className="auth-hero-inner">
            {eyebrow && <p className="auth-eyebrow">{eyebrow}</p>}
            <h1>{title}</h1>
            {description && <p className="auth-hero-copy">{description}</p>}
          </div>
        </section>
        <div className="auth-content account-page">
          <div className="auth-panel">{children}</div>
        </div>
      </main>
    </div>
  );
}
