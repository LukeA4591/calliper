import { Brand } from "@/components/brand";
import { checkLabels } from "@/lib/forge/review-schema";
import type { Analysis } from "@/lib/forge/types";
export function PrintReport({ analysis }: { analysis: Analysis }) {
  return (
    <article className="print-report">
      <header>
        <Brand />
        <h1>DFM review</h1>
        <p>Preliminary manufacturing review — not engineering sign-off</p>
      </header>
      <h2>
        {analysis.projectName} · Revision {analysis.revision}
      </h2>
      <p>
        {analysis.filename} · {analysis.material} · 3-axis CNC milling · Drawing
        units: {analysis.units}
      </p>
      <p>
        {analysis.review
          ? "AI drawing review: potential errors and manufacturing concerns. Engineering judgement required."
          : analysis.mode === "fixture"
            ? "SAMPLE ANALYSIS: authored drawing inputs and deterministic demo rules. No AI extraction."
            : analysis.extraction
              ? "Uploaded drawing: AI extraction followed by reviewer confirmation and deterministic checks."
              : "Uploaded drawing: extraction has not been run. No manufacturing screening completed."}
      </p>
      {analysis.review && (
        <section>
          <h3>AI review coverage</h3>
          <p>
            {analysis.review.provider} · {analysis.review.model} ·{" "}
            {analysis.review.createdAt}. Pages{" "}
            {analysis.review.pages.join(", ")} of {analysis.review.totalPages}.
          </p>
          {analysis.review.assumedGeneralTolerance && (
            <p>
              General tolerance missing — ISO 2768-m provisionally assumed, not
              specified by the designer. Potential AS 1100 documentation
              violation requires review.
            </p>
          )}
          {analysis.review.checks.map((c) => (
            <p key={c.id}>
              {checkLabels[c.id]} · {c.outcome}: {c.summary}
            </p>
          ))}
          {analysis.review.tolerances.map((t, i) => (
            <p key={i}>
              Page {t.page} · {t.quote}: {t.summary}
            </p>
          ))}
          {analysis.review.warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </section>
      )}
      {analysis.extraction && (
        <section>
          <h3>Extraction scope and review</h3>
          <p>
            {analysis.extraction.provider} · {analysis.extraction.model} ·{" "}
            {analysis.extraction.createdAt}
          </p>
          <p>
            Pages sent: {analysis.extraction.pages.join(", ")} of{" "}
            {analysis.pages.length}. Only pockets, internal radii, blind holes
            and bilateral tolerances are screened. Unsent pages and unconfirmed
            measurements are not evaluated. Zero findings does not establish
            manufacturability.
          </p>
          <ul>
            {analysis.extraction.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          {analysis.extraction.candidates.map((c) => (
            <p key={c.id}>
              <strong>{c.label}</strong> · page {c.page} · {c.decision}.{" "}
              {c.evidence.text} ·{" "}
              {Object.entries(c.evidence.measurements)
                .map(([key, m]) => `${key}: ${m.value} ${m.unit}`)
                .join(", ")}
              .{" "}
              {c.decision === "confirmed" && !c.evidence.region
                ? "Location not confirmed."
                : ""}{" "}
              {c.notes.join(" ")}
            </p>
          ))}
        </section>
      )}
      <p>
        {analysis.review
          ? `Review basis: ${analysis.review.version}. Six-check drawing review with ISO 2768-1 linear tolerance screening.`
          : `Profile: ${analysis.profile.version}. ${analysis.profile.provenance}`}
      </p>
      <p>{analysis.findings.length} detected issues</p>
      {analysis.findings.map((finding, index) => (
        <section key={finding.id}>
          <h3>
            {index + 1}. {finding.title}
          </h3>
          <p>
            <strong>{finding.severity.toUpperCase()} priority</strong> ·{" "}
            {finding.ruleId}
          </p>
          <p>{finding.description}</p>
          {finding.ai?.priorityReason && (
            <p>Priority: {finding.ai.priorityReason}</p>
          )}
          {/* Only reachable for analyses saved while passing tolerances raised an issue. */}
          {finding.ai?.result === "pass" && (
            <p>
              Tolerance screen passed for the listed callouts; AI readings
              require confirmation.
            </p>
          )}
          {finding.evidence.map((e, i) => (
            <p key={i}>
              <strong>Evidence:</strong> {e.text} · {e.status} ·{" "}
              {e.region
                ? `Page ${e.region.page}, normalized region (${e.region.x}, ${e.region.y}, ${e.region.width}, ${e.region.height})`
                : finding.ai
                  ? `Page ${finding.ai.page}; no located source`
                  : "No verified location"}
            </p>
          ))}
          <p>
            <strong>Rule:</strong> {finding.calculation}
          </p>
          <p>
            <strong>Impact:</strong> {finding.manufacturingImpact}
          </p>
          <ul>
            {finding.recommendedActions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <p>
            <strong>Uncertainty:</strong> {finding.assumptions.join(" ")}
          </p>
        </section>
      ))}
      <footer>
        Source drawing remains a separate file. Review status records an
        engineer’s decision and does not validate a changed drawing.
      </footer>
    </article>
  );
}
