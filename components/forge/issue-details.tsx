"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { checkCategory } from "@/lib/forge/review-schema";
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
  onAiReview,
}: {
  finding: Finding | undefined;
  mode?: "findings" | "measurements";
  index: number;
  count: number;
  onStatus: (status: ReviewStatus) => void;
  onNavigate: (direction: number) => void;
  onFocus: () => void;
  onAiReview?: (
    decision: "pending" | "confirmed" | "rejected",
    note: string,
  ) => void;
}) {
  const [note, setNote] = useState(finding?.ai?.reviewerNote ?? "");
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
            ? "Select a previously saved measurement to inspect its callout."
            : "Analyse the drawing to find missing specifications and manufacturing concerns, then select a flag on the drawing or in the review queue."}
        </p>
      </aside>
    );
  const passed =
    finding.ai?.result === "pass" && finding.ai.decision !== "rejected";
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
          <span
            className={`status-badge status-${passed ? "success" : finding.status}`}
          >
            {passed
              ? finding.ai?.decision === "confirmed"
                ? "Pass · confirmed"
                : "Pass · check readings"
              : finding.ai?.decision === "pending" && finding.status === "open"
                ? "AI flag · unverified"
                : finding.ai?.decision === "confirmed" &&
                    finding.status === "open"
                  ? "Confirmed issue"
                  : finding.status}
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
        <div className="evidence-box">
          <div className="detail-label">
            <ShieldCheck size={14} />{" "}
            {finding.ai
              ? "AI evidence · check against drawing"
              : "Drawing evidence"}
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
                  : finding.ai
                    ? `AI reading · ${finding.ai.locationSource === "pdf_text" ? "location from PDF text references" : finding.ai.locationSource === "vision" ? "approximate visual location" : "no located source"}`
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
        {finding.ai && (
          <label className="engineer-note">
            Engineer note
            <textarea
              value={note}
              maxLength={2000}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Record your reasoning or drawing correction"
            />
          </label>
        )}
      </div>
      {finding.ai ? (
        <div className="review-actions ai-review-actions">
          <Button onClick={() => onAiReview?.("confirmed", note)}>
            {finding.ai.decision === "confirmed"
              ? "Save confirmed review"
              : finding.ai.result === "pass"
                ? "Confirm check"
                : "Confirm issue"}
          </Button>
          <Button
            variant={
              finding.ai.decision === "rejected" ? "outline" : "destructive"
            }
            onClick={() =>
              onAiReview?.(
                finding.ai!.decision === "rejected" ? "pending" : "rejected",
                note,
              )
            }
          >
            {finding.ai.decision === "rejected"
              ? "Reopen flag"
              : "Dismiss flag"}
          </Button>
          {finding.ai.decision === "confirmed" &&
            finding.ai.result !== "pass" && (
              <Button
                variant="outline"
                onClick={() =>
                  onStatus(
                    finding.status === "addressed" ? "open" : "addressed",
                  )
                }
              >
                {finding.status === "addressed"
                  ? "Reopen issue"
                  : "Mark addressed"}
              </Button>
            )}
          <p>
            {finding.ai.result === "pass"
              ? "Confirm the listed callouts against the drawing. This check covers these tolerances only."
              : "Confirm that you checked the drawing. Confirming accepts the issue; it does not mark the part as passing."}
          </p>
        </div>
      ) : (
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
      )}
    </aside>
  );
}
