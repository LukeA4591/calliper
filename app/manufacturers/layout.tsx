import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { DesignerNav } from "@/components/designer-nav";
import "../designer.css";
import "./directory.css";

export default async function ManufacturersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { email, role } = await requireUser();
  return (
    <div className="forge-app designer-app directory-app">
      <DesignerNav
        email={email}
        active="manufacturers"
        label={
          role === "designer" ? "DESIGNER WORKSPACE" : "MANUFACTURER WORKSPACE"
        }
        homeLabel={role === "designer" ? "Projects" : "My business"}
        homeHref={role === "designer" ? "/" : "/manufacturer"}
      >
        {role === "designer" && (
          <Button asChild size="sm">
            <Link href="/?new=1">
              <Plus size={15} />
              New analysis
            </Link>
          </Button>
        )}
      </DesignerNav>
      {children}
    </div>
  );
}
