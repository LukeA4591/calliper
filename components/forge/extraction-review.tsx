"use client";
// Backward-compatible editor for measurements saved before drawing review v1.
import { useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  confirmCandidate,
  featureFields,
  featureLabels,
} from "@/lib/forge/extraction";
import type { ExtractedCandidate } from "@/lib/forge/types";

export function CandidateDetails({
  candidate,
  findingTitle,
  onUpdate,
  onFocus,
  onFindings,
}: {
  candidate: ExtractedCandidate;
  findingTitle?: string;
  onUpdate: (candidate: ExtractedCandidate) => void;
  onFocus: () => void;
  onFindings: () => void;
}) {
  const measurements = candidate.evidence.measurements;
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      featureFields[candidate.kind].map((key) => [
        key,
        measurements[key]?.value.toString() ?? "",
      ]),
    ),
  );
  const [unit, setUnit] = useState(
    Object.values(measurements)[0]?.unit ?? "unknown",
  );
  const [quote, setQuote] = useState(candidate.evidence.text);
  const [confirm, setConfirm] = useState(false);
  const [location, setLocation] = useState(false);
  const [error, setError] = useState("");
  return (
    <aside
      className="issue-panel candidate-panel"
      aria-label="Measurement confirmation"
    >
      <div className="panel-heading">
        <span>Measurement review</span>
        <span>Page {candidate.page}</span>
      </div>
      <form
        className="candidate-form"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          try {
            onUpdate(
              confirmCandidate(candidate, {
                text: quote,
                unit,
                values: Object.fromEntries(
                  Object.entries(values).map(([key, value]) => [
                    key,
                    value.trim() ? Number(value) : NaN,
                  ]),
                ),
                confirmMeasurements: confirm,
                confirmLocation: location,
              }),
            );
          } catch {
            setError(
              "Check all dimensions, units, and the confirmation checkbox. Width and diameter must be greater than zero.",
            );
          }
        }}
      >
        <div className={`candidate-state decision-${candidate.decision}`}>
          {candidate.decision === "pending"
            ? "Unverified AI suggestion"
            : candidate.decision === "confirmed"
              ? "Confirmed by reviewer"
              : "Rejected by reviewer"}
        </div>
        <h2>{candidate.label}</h2>
        {candidate.decision === "confirmed" && (
          <p
            className={`confirmation-result ${findingTitle ? "status-warning" : "status-success"}`}
            role="status"
          >
            {findingTitle
              ? `Finding raised: ${findingTitle}. Open Review findings for its details.`
              : "Confirmed. No concern crosses the current thresholds for this feature. The drawing still needs engineering review."}
          </p>
        )}
        <p>
          {featureLabels[candidate.kind]} · Confirm the feature type and that
          the dimensions refer to the same feature. Reject incorrect
          associations.
        </p>
        <button type="button" className="source-link" onClick={onFocus}>
          <MapPin size={15} />
          {candidate.originalEvidence.region
            ? "Inspect suggested source"
            : `Inspect page ${candidate.page}`}
        </button>
        <details
          className="source-notes"
          open={
            candidate.locationSource !== "pdf_text" ||
            candidate.notes.length > 0
          }
        >
          <summary>
            Source & extraction notes
            {candidate.notes.length > 0 ? ` (${candidate.notes.length})` : ""}
          </summary>
          <p className="source-caution">
            {candidate.locationSource === "pdf_text"
              ? "Highlight comes from referenced PDF text. Check that the references support these measurements."
              : candidate.locationSource === "vision"
                ? "The highlight is estimated by AI and may be misplaced."
                : "No source location could be established. Confirmation can create an unlocated finding."}
          </p>
          {candidate.notes.length > 0 && (
            <ul className="candidate-notes">
              {candidate.notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          )}
        </details>
        <label>
          Supporting callout
          <textarea
            value={quote}
            required
            maxLength={1500}
            onChange={(e) => setQuote(e.target.value)}
          />
        </label>
        <div className="form-grid">
          {featureFields[candidate.kind].map((key) => (
            <label key={key}>
              {key === "tolerance" ? "Tolerance ± magnitude" : key}
              <input
                type="number"
                step="any"
                min={["width", "diameter"].includes(key) ? "0.000001" : "0"}
                max="1000000"
                required
                value={values[key]}
                onChange={(e) =>
                  setValues((current) => ({
                    ...current,
                    [key]: e.target.value,
                  }))
                }
              />
            </label>
          ))}
        </div>
        <label>
          Drawing callout units
          <select
            value={unit}
            required
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="unknown" disabled>
              Confirm units
            </option>
            <option value="mm">Millimetres (mm)</option>
            <option value="in">Inches (in)</option>
          </select>
        </label>
        <label className="check-line">
          <input
            type="checkbox"
            required
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
          />
          <span>
            I checked the feature, dimensions, units, and callout against the
            drawing.
          </span>
        </label>
        {candidate.originalEvidence.region && (
          <label className="check-line">
            <input
              type="checkbox"
              checked={location}
              onChange={(e) => setLocation(e.target.checked)}
            />
            <span>
              The highlighted region correctly locates the supporting callout.
              Include its marker in findings.
            </span>
          </label>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={!confirm || !["mm", "in"].includes(unit)}
        >
          Confirm & run checks
        </Button>
        <div className="candidate-actions">
          <Button
            type="button"
            variant="destructive"
            onClick={() =>
              onUpdate({
                ...candidate,
                decision: "rejected",
                reviewedAt: new Date().toISOString(),
                evidence: {
                  ...candidate.evidence,
                  status: "extracted_unverified",
                  provenance: "ai_extracted",
                },
              })
            }
          >
            Reject suggestion
          </Button>
          <button type="button" className="text-button" onClick={onFindings}>
            Review findings
          </button>
        </div>
        <p>
          Only confirmed inputs enter the configured checks. A confirmation is a
          local review decision, not independent engineering validation.
        </p>
      </form>
    </aside>
  );
}
