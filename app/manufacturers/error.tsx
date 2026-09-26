"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function ManufacturersError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main id="main" className="directory-content">
      <section className="directory-empty">
        <h1>We couldn’t load this page</h1>
        <p>Your filters and profiles haven’t been changed. Please try again.</p>
        <Button onClick={reset}>Try again</Button>
        <Link className="directory-text-link" href="/manufacturers">
          Back to manufacturers
        </Link>
      </section>
    </main>
  );
}
