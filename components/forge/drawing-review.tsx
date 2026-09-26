"use client";
import { useState } from "react";
import { LoaderCircle, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractDrawing } from "@/app/actions/extract-drawing";
import { prepareExtractionPages } from "@/lib/forge/pdf";
import { MAX_EXTRACTION_PAGES } from "@/lib/forge/extraction";
import { checkLabels, type DrawingReview } from "@/lib/forge/review-schema";
import type { ReviewResult } from "@/lib/forge/drawing-review";
import type { Analysis } from "@/lib/forge/types";
import { Modal } from "./dialogs";

export function DrawingReviewControls({
  analysis,
  source,
  configured,
  onResult,
}: {
  analysis: Analysis;
  source: string;
  configured: boolean;
  onResult: (result: ReviewResult) => void;
}) {
  const [open, setOpen] = useState<"analyse" | "notes" | null>(null);
  return (
    <div className="drawing-analysis-controls">
      {analysis.review && (
        <Button variant="ghost" size="sm" onClick={() => setOpen("notes")}>
          Analysis notes
        </Button>
      )}
      <Button size="sm" disabled={!source} onClick={() => setOpen("analyse")}>
        <ScanSearch size={16} />
        {analysis.review ? "Reanalyse" : "Analyse drawing"}
      </Button>
      {open === "notes" && analysis.review && (
        <Modal title="Analysis notes" onClose={() => setOpen(null)}>
          <div className="analysis-notes">
            <ReviewCoverage review={analysis.review} />
          </div>
        </Modal>
      )}
      {open === "analyse" && (
        <ReviewDialog
          analysis={analysis}
          source={source}
          configured={configured}
          onClose={() => setOpen(null)}
          onResult={(result) => {
            onResult(result);
            setOpen(null);
          }}
        />
      )}
    </div>
  );
}
export function ReviewCoverage({ review }: { review: DrawingReview }) {
  const labels = {
    flagged: "Needs review",
    not_flagged: "No issue identified",
    not_assessed: "Not assessed",
    pass: "Pass · tolerance screen",
  };
  return (
    <>
      <p className="review-scope-note">
        Pages {review.pages.join(", ")} of {review.totalPages} · AI findings and
        callout readings require engineer review.
      </p>
      {review.assumedGeneralTolerance && (
        <p className="review-assumption status-warning">
          General tolerance missing: ISO 2768-m assumed for untoleranced
          dimensions. Potential AS 1100 documentation violation — confirm and
          add the intended tolerance to the drawing.
        </p>
      )}
      {review.manufacturing?.summary && (
        <p className="review-scope-note">
          Suggested manufacturing route: {review.manufacturing.summary}
        </p>
      )}
      <details className="review-coverage">
        <summary>Six-check results & analysis notes</summary>
        <ul className="review-checks">
          {review.checks.map((c) => (
            <li key={c.id}>
              <strong>{checkLabels[c.id]}</strong>
              <span
                className={`status-badge ${c.outcome === "pass" ? "status-success" : c.outcome === "flagged" || c.outcome === "not_assessed" ? "status-warning" : "status-info"}`}
              >
                {labels[c.outcome]}
              </span>
              <p>{c.summary}</p>
            </li>
          ))}
        </ul>
        {review.tolerances.length > 0 && (
          <>
            <h3>Tolerance calculations</h3>
            {review.tolerances.map((t, i) => (
              <p key={i}>
                Page {t.page} · {t.quote || "Unclear callout"}
                <br />
                {t.summary}
              </p>
            ))}
          </>
        )}
        <p>
          No issues identified is not standards approval or a guarantee of
          manufacturability. ISO calculations use linear symmetric bilateral
          tolerances; other types require manual interpretation.
        </p>
        <p>
          {review.provider} · {review.model} ·{" "}
          {new Date(review.createdAt).toLocaleString("en-GB", {
            timeZone: "UTC",
          })}{" "}
          UTC
        </p>
        {review.warnings.length > 0 && (
          <ul>
            {review.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </details>
    </>
  );
}
function ReviewDialog({
  analysis,
  source,
  configured,
  onClose,
  onResult,
}: {
  analysis: Analysis;
  source: string;
  configured: boolean;
  onClose: () => void;
  onResult: (r: ReviewResult) => void;
}) {
  const [pages, setPages] = useState(
    Array.from(
      { length: Math.min(analysis.pages.length, MAX_EXTRACTION_PAGES) },
      (_, i) => i + 1,
    ),
  );
  const [consent, setConsent] = useState(false),
    [replace, setReplace] = useState(false);
  const [progress, setProgress] = useState(""),
    [error, setError] = useState("");
  const busy = !!progress,
    previous = !!(analysis.review || analysis.extraction);
  return (
    <Modal
      title="Analyse drawing"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="analysis-form extraction-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || !consent || (previous && !replace)) return;
          setError("");
          setProgress("Preparing drawing pages…");
          try {
            const prepared = await prepareExtractionPages(
              source,
              [...pages].sort((a, b) => a - b),
              setProgress,
            );
            setProgress("Reviewing specifications and manufacturing concerns…");
            const response = await extractDrawing({
              consent: true,
              analysisId: analysis.id,
              sourceFileId: analysis.pdfFileId,
              units: analysis.units,
              pages: prepared,
            });
            if (!response.ok) throw new Error(response.error);
            onResult(response.result);
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Review failed. Please retry.",
            );
          } finally {
            setProgress("");
          }
        }}
      >
        <p className="dialog-intro">
          AI flags potential errors directly on your drawing. Include the title
          block, general notes and relevant feature views. You review the
          evidence and explore each issue on the drawing.
        </p>
        <fieldset className="page-selection" disabled={busy}>
          <legend>
            Pages to analyse ({pages.length}/{MAX_EXTRACTION_PAGES})
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
                  setPages((old) =>
                    e.target.checked
                      ? [...old, i + 1]
                      : old.filter((p) => p !== i + 1),
                  )
                }
              />
              Page {i + 1}
            </label>
          ))}
        </fieldset>
        {pages.length < analysis.pages.length && (
          <p className="status-warning">
            Partial review: {analysis.pages.length - pages.length} pages will
            not be analysed. Missing notes may be on another sheet.
          </p>
        )}
        <p className="dialog-intro">
          Missing general tolerances are flagged with a provisional ISO 2768-m
          default. Tolerances within the standard range form one low-priority
          check. Tighter-than-fine tolerances remain manufacturing review
          concerns.
        </p>
        <label className="check-line">
          <input
            type="checkbox"
            checked={consent}
            required
            disabled={busy}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            I allow these page images and text to be sent to OpenAI for this
            review. API charges may apply.
          </span>
        </label>
        {previous && (
          <label className="check-line">
            <input
              type="checkbox"
              checked={replace}
              required
              disabled={busy}
              onChange={(e) => setReplace(e.target.checked)}
            />
            <span>Replace the previous AI results with this new analysis.</span>
          </label>
        )}
        {!configured && (
          <p className="form-error">
            AI review is not configured on the server.
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {busy && (
          <p className="form-progress" role="status">
            <LoaderCircle className="spin" size={16} />
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
              (previous && !replace)
            }
          >
            {busy ? "Analysing…" : "Analyse selected pages"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
