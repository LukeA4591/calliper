import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function ManufacturerNotFound() {
  return (
    <main id="main" className="directory-content">
      <section className="directory-empty">
        <h1>Profile unavailable</h1>
        <p>This business profile may be private or no longer available.</p>
        <Button asChild variant="outline">
          <Link href="/manufacturers">Browse manufacturers</Link>
        </Button>
      </section>
    </main>
  );
}
