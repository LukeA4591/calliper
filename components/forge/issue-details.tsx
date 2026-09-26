"use client";
import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  MapPin,
  ShieldCheck,
  X,
} from "lucide-react";
import type { Finding, ReviewStatus } from "@/lib/forge/types";

export function IssueDetails({
  finding,
  mode = "findings",
  index,
  count,
  onStatus,
  onNavigate,
  onFocus,
}: {
  finding: Finding | undefined;
  mode?: "findings" | "measurements";
  index: number;
  count: number;
  onStatus: (status: ReviewStatus) => void;
  onNavigate: (direction: number) => void;
  onFocus: () => void;
}) {
  if (!finding)
    return (
      <aside className="issue-panel empty-details">
        <CircleDot size={30} />
        <h2>
          {mode === "measurements"
            ? "Review measurements here"
            : "No finding selected"}
        </h2>
        <p>
          {mode === "measurements"
            ? "Use Extract with AI to read drawing callouts, or select an existing suggestion above. Check its dimensions, units, and source before confirming."
            : "Select a finding on the drawing or in the review queue. For an uploaded drawing, open Measurements to extract and confirm inputs for the configured checks."}
        </p>
      </aside>
    );
  return (
    <aside className="issue-panel" aria-label="Selected issue details">
      <div className="panel-heading">
        <span>Finding details</span>
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
          <span className={`status-badge status-${finding.status}`}>
            {finding.status}
          </span>
        </div>
        <h2>{finding.title}</h2>
        <p className="issue-description">{finding.description}</p>
        <div className="evidence-box">
          <div className="detail-label">
            <ShieldCheck size={14} /> Drawing evidence
          </div>
          {finding.evidence.map((evidence, i) => (
            <div key={i}>
              <p className="evidence-text">{evidence.text}</p>
              <div className="measurement-grid">
                {Object.entries(evidence.measurements).map(
                  ([name, measurement]) => (
                    <div key={name}>
                      <span>{name}</span>
                      <strong>
                        {measurement.value}
                        <small> {measurement.unit}</small>
                      </strong>
                    </div>
                  ),
                )}
              </div>
              <span
                className={`evidence-status ${evidence.status === "verified" ? "status-success" : "status-warning"}`}
              >
                {evidence.status === "verified"
                  ? evidence.provenance === "engineer_confirmed"
                    ? "Measurements confirmed by reviewer"
                    : "Verified against the authored demo drawing"
                  : "Unverified — engineer confirmation needed"}
              </span>
            </div>
          ))}
        </div>
        <section className="detail-section">
          <h3>Why it matters</h3>
          <p>{finding.manufacturingImpact}</p>
        </section>
        <section className="detail-section">
          <h3>Recommended review</h3>
          <ol>
            {finding.recommendedActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ol>
        </section>
        <section className="detail-section rule-section">
          <h3>Rule calculation</h3>
          <p className="calculation">{finding.calculation}</p>
          <details>
            <summary>Rule, assumptions & limitations</summary>
            <code>{finding.ruleId}</code>
            {finding.assumptions.map((a, index) => (
              <p key={index}>{a}</p>
            ))}
            <p>
              Profile: {finding.ruleProfileVersion}. A screening concern is not
              a manufacturability verdict.
            </p>
          </details>
        </section>
        <button
          className="source-link"
          onClick={onFocus}
          disabled={
            !finding.evidence.some((e) => e.region && e.status === "verified")
          }
        >
          <MapPin size={15} />
          <span>
            {finding.evidence.find((e) => e.region)?.region
              ? `Drawing source · page ${finding.evidence.find((e) => e.region)!.region!.page}`
              : "No verified drawing location"}
          </span>
          <ArrowUpRight size={14} />
        </button>
      </div>
      <div className="review-actions">
        <button
          className={`address-button ${finding.status === "addressed" ? "active" : ""}`}
          onClick={() =>
            onStatus(finding.status === "addressed" ? "open" : "addressed")
          }
        >
          <Check size={16} />
          {finding.status === "addressed"
            ? "Addressed · reopen"
            : "Mark addressed"}
        </button>
        <button
          className="dismiss-button"
          onClick={() =>
            onStatus(finding.status === "dismissed" ? "open" : "dismissed")
          }
        >
          <X size={15} />
          {finding.status === "dismissed" ? "Reopen" : "Dismiss"}
        </button>
        <p>
          Review status records your decision; it does not change the drawing.
        </p>
      </div>
    </aside>
  );
}
