import Link from "next/link";
import { ArrowUpRight, Factory } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  planProcesses,
  processName,
  processParam,
  requiredMaterial,
} from "@/lib/manufacturing/recommendations";
import type { Analysis } from "@/lib/forge/types";

const roleLabels = {
  primary: "Primary",
  secondary: "Secondary",
  alternative: "Alternative",
};

/** A compact band above the drawing. Manufacturer capabilities and listings stay in
 * the directory; this only carries the recommended processes and the way through. */
export function ManufacturingPlan({ analysis }: { analysis: Analysis }) {
  const plan = analysis.review?.manufacturing;
  if (!plan) return null;
  const material = requiredMaterial(plan, analysis.material || null);
  const search = new URLSearchParams({ project: analysis.id });
  if (plan.processes.length)
    search.set("processes", processParam(planProcesses(plan)));
  return (
    <section className="manufacturing-plan" aria-labelledby="plan-heading">
      <div className="plan-copy">
        <h2 id="plan-heading">
          <Factory size={14} aria-hidden="true" />
          Manufacturing recommendations
        </h2>
        {plan.processes.length ? (
          <ul className="plan-processes">
            {plan.processes.map((entry) => (
              <li key={entry.process} title={entry.reason}>
                {processName(entry.process)}
                <span>{roleLabels[entry.role]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="plan-summary">
            No process could be recommended from the reviewed pages. Browse the
            directory and choose the processes yourself.
          </p>
        )}
        <p className="plan-material">
          Material:{" "}
          {material.value ? (
            <strong>{material.value}</strong>
          ) : (
            "not specified on the drawing"
          )}
          {material.source === "project" && " (from project settings)"}
        </p>
        {plan.summary && <p className="plan-summary">{plan.summary}</p>}
      </div>
      <Button asChild size="sm" className="plan-action">
        <Link href={`/manufacturers?${search}`}>
          Find manufacturers
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </Button>
    </section>
  );
}
