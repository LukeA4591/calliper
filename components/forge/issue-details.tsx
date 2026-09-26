"use client";
import { checkCategory } from "@/lib/forge/review-schema";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  MapPin,
} from "lucide-react";
import type { Finding } from "@/lib/forge/types";

export function IssueDetails({
  finding,
  index,
  count,
  onNavigate,
  onFocus,
}: {
  finding: Finding | undefined;
  index: number;
  count: number;
  onNavigate: (direction: number) => void;
  onFocus: () => void;
}) {
  if (!finding)
    return (
      <aside className="issue-panel empty-details">
        <CircleDot size={30} />
        <h2>Select an issue</h2>
        <p>
          Choose an annotation on the drawing or an issue above to inspect its
          check, calculation and recommended review.
        </p>
      </aside>
    );
  return (
    <aside className="issue-panel" aria-label="Selected issue details">
      <div className="panel-heading">
        <span>Issue details</span>
        <div>
          <button
            aria-label="Previous issue"
            onClick={() => onNavigate(-1)}
            disabled={count < 2}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            {index + 1} / {count}
          </span>
          <button
            aria-label="Next issue"
            onClick={() => onNavigate(1)}
            disabled={count < 2}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="issue-panel-content" key={finding.id}>
        <div className="badge-row">
          <span className={`severity-badge severity-${finding.severity}`}>
            <i />
            {finding.severity} priority
          </span>
        </div>
        {finding.ai && (
          <p className="issue-category">{checkCategory(finding.ai.checkId)}</p>
        )}
        <h2>{finding.title}</h2>
        {finding.ai?.priorityReason && (
          <p className="review-scope-note">
            Priority: {finding.ai.priorityReason}
          </p>
        )}
        <p className="issue-description">{finding.description}</p>
        <section className="detail-section">
          <h3>Recommended review</h3>
          <ol>
            {finding.recommendedActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ol>
        </section>
        <section className="detail-section rule-section">
          <h3>{finding.ai ? "Check & calculation" : "Rule calculation"}</h3>
          <p className="calculation">{finding.calculation}</p>
          <details>
            <summary>
              {finding.ai
                ? "AI uncertainties & review basis"
                : "Rule, assumptions & limitations"}
            </summary>
            <code>{finding.ruleId}</code>
            {finding.assumptions.map((a, index) => (
              <p key={index}>{a}</p>
            ))}
            <p>
              Review basis: {finding.ruleProfileVersion}. A screening concern is
              not a manufacturability verdict.
            </p>
          </details>
        </section>
        <button
          className="source-link"
          onClick={onFocus}
          disabled={
            !finding.ai &&
            !finding.evidence.some((e) => e.region && e.status === "verified")
          }
        >
          <MapPin size={15} />
          <span>
            {finding.evidence.find((e) => e.region)?.region
              ? `${finding.ai ? "Inspect AI source" : "Drawing source"} · page ${finding.evidence.find((e) => e.region)!.region!.page}`
              : finding.ai
                ? `Inspect page ${finding.ai.page} · no located source`
                : "No verified drawing location"}
          </span>
          <ArrowUpRight size={14} />
        </button>
      </div>
    </aside>
  );
}
