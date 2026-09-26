"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractDrawing } from "@/app/actions/extract-drawing";
import {
  confirmCandidate,
  featureFields,
  featureLabels,
  MAX_EXTRACTION_PAGES,
} from "@/lib/forge/extraction";
import { prepareExtractionPages } from "@/lib/forge/pdf";
import type {
  Analysis,
  ExtractedCandidate,
  Extraction,
} from "@/lib/forge/types";
import { Modal } from "./dialogs";

export function ExtractionReview({
  analysis,
  source,
  configured,
  selectedId,
  onSelect,
  onExtract,
}: {
  analysis: Analysis;
  source: string;
  configured: boolean;
  selectedId: string | null;
  onSelect: (candidate: ExtractedCandidate | null) => void;
  onExtract: (extraction: Extraction) => void;
}) {
  const [open, setOpen] = useState(false);
  const extraction = analysis.extraction;
  const pending =
    extraction?.candidates.filter((c) => c.decision === "pending").length ?? 0;
  const selectedIndex =
    extraction?.candidates.findIndex((c) => c.id === selectedId) ?? -1;
  const candidates = extraction?.candidates ?? [];
  return (
    <section className="extraction-review" aria-label="Drawing extraction">
      <div className="extraction-heading">
        {candidates.length ? (
          <>
            <label className="measurement-picker">
              <span>Measurement</span>
              <select
                value={selectedId ?? ""}
                onChange={(event) =>
                  onSelect(
                    candidates.find((c) => c.id === event.target.value) ?? null,
                  )
                }
              >
                <option value="" disabled>
                  Select a measurement
                </option>
                {candidates.map((candidate, index) => (
                  <option value={candidate.id} key={candidate.id}>
                    {index + 1}. {candidate.label} · Page {candidate.page} ·{" "}
                    {candidate.decision}
                  </option>
                ))}
              </select>
            </label>
            <div className="measurement-pagination">
              <button
                aria-label="Previous measurement"
                disabled={selectedIndex <= 0}
                onClick={() => onSelect(candidates[selectedIndex - 1])}
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                {selectedIndex < 0 ? "–" : selectedIndex + 1} /{" "}
                {candidates.length}
              </span>
              <button
                aria-label="Next measurement"
                disabled={selectedIndex >= candidates.length - 1}
                onClick={() => onSelect(candidates[selectedIndex + 1])}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <span className="measurement-progress">
              {pending ? `${pending} to confirm` : "All suggestions reviewed"}
            </span>
          </>
        ) : (
          <div className="extraction-intro">
            <h2>
              {extraction
                ? "No supported callouts found"
                : "Start with the drawing"}
            </h2>
            <p>
              {extraction
                ? "Check the extraction notes or try another page."
                : "Extract dimensioned callouts, then check them against the source."}
            </p>
          </div>
        )}
        <Button
          variant={extraction ? "outline" : "default"}
          size="sm"
          onClick={() => setOpen(true)}
          disabled={!source}
        >
          {extraction ? "Extract again" : "Extract with AI"}
        </Button>
      </div>
      {extraction && (
        <details className="extraction-warnings">
          <summary>
            Coverage & notes{" "}
            <span>
              {extraction.warnings.length
                ? `(${extraction.warnings.length})`
                : ""}
            </span>
          </summary>
          <div className="extraction-scope">
            <p>
              Pages {extraction.pages.join(", ")} of {analysis.pages.length} ·{" "}
              {pending} awaiting confirmation ·{" "}
              {candidates.filter((c) => c.decision === "confirmed").length}{" "}
              confirmed ·{" "}
              {candidates.filter((c) => c.decision === "rejected").length}{" "}
              rejected.
            </p>
            <p>
              Only selected pages and four feature types are screened.{" "}
              {analysis.pages.length - extraction.pages.length} pages not sent.
              No findings does not mean the drawing is manufacturable.
            </p>
            <p>
              {extraction.provider} · {extraction.model} ·{" "}
              {new Date(extraction.createdAt).toLocaleString("en-GB", {
                timeZone: "UTC",
              })}{" "}
              UTC
            </p>
            {extraction.warnings.length > 0 && (
              <ul>
                {extraction.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
            {!candidates.length && (
              <p>
                No supported callouts were extracted. Check drawing legibility,
                or try a different page. Manual engineering review is still
                required.
              </p>
            )}
          </div>
        </details>
      )}
      {open && (
        <ExtractionDialog
          analysis={analysis}
          source={source}
          configured={configured}
          onClose={() => setOpen(false)}
          onExtract={(result) => {
            onExtract(result);
            setOpen(false);
          }}
        />
      )}
    </section>
  );
}

function ExtractionDialog({
  analysis,
  source,
  configured,
  onClose,
  onExtract,
}: {
  analysis: Analysis;
  source: string;
  configured: boolean;
  onClose: () => void;
  onExtract: (result: Extraction) => void;
}) {
  const [pages, setPages] = useState<number[]>(
    Array.from(
      { length: Math.min(analysis.pages.length, MAX_EXTRACTION_PAGES) },
      (_, i) => i + 1,
    ),
  );
  const [consent, setConsent] = useState(false);
  const [replace, setReplace] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const busy = !!progress;
  return (
    <Modal
      title="Extract drawing measurements"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="analysis-form extraction-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || !consent || (analysis.extraction && !replace)) return;
          setError("");
          setProgress("Opening drawing…");
          try {
            const prepared = await prepareExtractionPages(
              source,
              [...pages].sort((a, b) => a - b),
              setProgress,
            );
            setProgress(
              "Reading callouts with OpenAI… This can take up to 60 seconds.",
            );
            const result = await extractDrawing({
              consent: true,
              sourceFileId: analysis.pdfFileId,
              units: analysis.units,
              pages: prepared,
            });
            if (!result.ok) throw new Error(result.error);
            onExtract(result.extraction);
          } catch (failure) {
            setError(
              failure instanceof Error
                ? failure.message
                : "Extraction failed. Please try again.",
            );
          } finally {
            setProgress("");
          }
        }}
      >
        <p className="dialog-intro">
          Choose up to three pages. OpenAI will read their images and embedded
          text for pockets, internal corners, blind holes, and bilateral
          tolerances. You will check the measurements before findings are
          created.
        </p>
        {!configured && (
          <p className="form-error" role="alert">
            AI_API_KEY is missing from the server environment. Add it to
            .env.local and restart the development server.
          </p>
        )}
        <fieldset disabled={busy} className="page-selection">
          <legend>
            Pages to send ({pages.length}/{MAX_EXTRACTION_PAGES})
          </legend>
          {analysis.pages.map((_, i) => (
            <label key={i}>
              <input
                type="checkbox"
                checked={pages.includes(i + 1)}
                disabled={
                  !pages.includes(i + 1) && pages.length >= MAX_EXTRACTION_PAGES
                }
                onChange={(e) =>
                  setPages((current) =>
                    e.target.checked
                      ? [...current, i + 1]
                      : current.filter((p) => p !== i + 1),
                  )
                }
              />
              Page {i + 1}
            </label>
          ))}
        </fieldset>
        <label className="check-line">
          <input
            type="checkbox"
            checked={consent}
            required
            disabled={busy}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            I allow the selected page images and text to be sent to OpenAI for
            this extraction.
          </span>
        </label>
        <p className="dialog-intro">
          The full PDF and STEP attachment stay in this browser. Requests use
          your server API key and may incur API charges. Response storage is
          disabled; OpenAI’s API data retention policies still apply.
        </p>
        {analysis.extraction && (
          <label className="check-line">
            <input
              type="checkbox"
              checked={replace}
              required
              disabled={busy}
              onChange={(e) => setReplace(e.target.checked)}
            />
            <span>
              Replace the previous extraction, measurement confirmations, and
              finding review decisions for this drawing.
            </span>
          </label>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {progress && (
          <p className="extraction-progress" role="status">
            <LoaderCircle className="spin" size={17} />
            {progress}
          </p>
        )}
        <div className="dialog-actions">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            disabled={
              busy ||
              !configured ||
              !consent ||
              !pages.length ||
              (!!analysis.extraction && !replace)
            }
            type="submit"
          >
            {busy
              ? "Extracting…"
              : error
                ? "Retry extraction"
                : "Send selected pages"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

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
