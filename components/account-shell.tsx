import { Brand } from "@/components/brand";
import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
export function AccountShell({
  title,
  description,
  children,
  signedIn = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  signedIn?: boolean;
}) {
  return (
    <div className="forge-app">
      <header className="app-navigation">
        <Link className="forge-brand" href="/" aria-label="Calliper home">
          <Brand />
        </Link>
        {signedIn && (
          <>
            <Link href="/">Workspace</Link>
            <form action={signOut} className="ml-auto">
              <Button variant="ghost">Sign out</Button>
            </form>
          </>
        )}
      </header>
      <main id="main" className={`account-page ${signedIn ? "" : "auth-page"}`}>
        <h1>{title}</h1>
        {description && <p className="account-intro">{description}</p>}
        {children}
      </main>
    </div>
  );
}
