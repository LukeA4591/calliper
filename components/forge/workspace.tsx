"use client";
import { Brand } from "@/components/brand";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowRight,
  Box,
  Check,
  CircleDot,
  FileText,
  LockKeyhole,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createFixture, fixtureCandidates } from "@/lib/forge/fixture";
import { evaluateCandidates } from "@/lib/forge/rules";
import {
  findingsFromExtraction,
  updateCandidate,
} from "@/lib/forge/extraction";
import {
  loadProjects,
  saveProject as saveLocalProject,
} from "@/lib/forge/storage";
import {
  filterFindings,
  selectionAfterFilter,
  updateReviewStatus,
  type Analysis,
  type Filters,
  type ReviewStatus,
  type DrawingRegion,
  type ExtractedCandidate,
} from "@/lib/forge/types";
import { PdfViewer } from "./pdf-viewer";
import { IssueDetails } from "./issue-details";
import { Modal, NewAnalysisDialog, SettingsDialog } from "./dialogs";
import { PrintReport } from "./print-report";
import { CandidateDetails } from "./extraction-review";

import { DrawingReviewControls } from "./drawing-review";
import {
  applyDrawingReview,
  reviewAiFinding,
} from "@/lib/forge/drawing-review";
import { saveAnalysis } from "@/app/actions/analyses";
import { signOut } from "@/app/login/actions";
import { validatePdf } from "@/lib/forge/pdf";
import { MatchingPanel } from "./matching-panel";
import { ProjectLibrary, type Project } from "./project-views";
export function ForgeWorkspace({
  initialAnalysis,
  aiConfigured,
  userId,
  email,
  savedAnalyses,
}: {
  userId: string;
  email: string;
  savedAnalyses: { analysis: Analysis; updatedAt: string }[];
  initialAnalysis: Analysis;
  aiConfigured: boolean;
}) {
  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [projects, setProjects] = useState<Project[]>(
    savedAnalyses.length ? savedAnalyses : [{ analysis: initialAnalysis }],
  );
  const [source, setSource] = useState("/drawings/cnc-bracket-rev-a.pdf");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialAnalysis.findings[0]?.id ?? null,
  );
  const [focusRequest, setFocusRequest] = useState<{
    id: string;
    sequence: number;
    region?: DrawingRegion;
    page?: number;
  } | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState<"findings" | "measurements">(
    "findings",
  );
  const candidate = analysis.extraction?.candidates.find(
    (c) => c.id === candidateId,
  );
  const [filters, setFilters] = useState<Filters>({
    severity: "all",
    status: "all",
  });
  const [modal, setModal] = useState<"new" | "settings" | "report" | null>(
    null,
  );
  const [view, setView] = useState<"analysis" | "projects">("projects");
  const [storage, setStorage] = useState("Loading local projects…");
  const [notice, setNotice] = useState("");
  const [storageError, setStorageError] = useState("");
  const saveQueue = useRef(Promise.resolve());
  const sequence = useRef(0);
  const visible = filterFindings(analysis.findings, filters);
  const selected = visible.find((f) => f.id === selectedId);
  const selectedIndex = visible.findIndex((f) => f.id === selectedId);
  const openCount = analysis.findings.filter((f) => f.status === "open").length;
  const reviewedCount = analysis.findings.filter((f) =>
    f.ai ? f.ai.decision !== "pending" : f.status !== "open",
  ).length;

  function openProject(project: Project) {
    const next = project.analysis;
    const nextCandidate =
      next.mode === "uploaded" &&
      !next.review &&
      !!next.extraction?.candidates.length &&
      !next.findings.length
        ? (next.extraction?.candidates.find((c) => c.decision === "pending") ??
          next.extraction?.candidates[0])
        : undefined;
    setAnalysis(next);
    setCandidateId(nextCandidate?.id ?? null);
    setReviewMode(
      next.mode === "uploaded" &&
        !next.review &&
        !!next.extraction?.candidates.length &&
        !next.findings.length
        ? "measurements"
        : "findings",
    );
    setSelectedId(next.findings[0]?.id ?? null);
    setFilters({ severity: "all", status: "all" });
    setFocusRequest(
      nextCandidate
        ? {
            id: nextCandidate.id,
            region: nextCandidate.originalEvidence.region,
            page: nextCandidate.page,
            sequence: ++sequence.current,
          }
        : next.findings[0]
          ? { id: next.findings[0].id, sequence: ++sequence.current }
          : null,
    );
    setSource(
      next.mode === "fixture"
        ? `/drawings/cnc-bracket-rev-${next.fixtureRevision || "a"}.pdf`
        : project.pdf
          ? URL.createObjectURL(project.pdf)
          : "",
    );
    setView("analysis");
    setModal(null);
  }
  async function saveProject(
    next: Analysis,
    files?: { pdf?: Blob; step?: Blob },
  ) {
    await saveLocalProject(next, userId, files);
    const result = await saveAnalysis(next, userId);
    if (result.error) throw new Error(result.error);
  }
  useEffect(() => {
    let cancelled = false;
    loadProjects(userId)
      .then(async (saved) => {
        if (cancelled) return;
        const merged = new Map(
          savedAnalyses.map((p) => [
            p.analysis.id,
            p as Project & { updatedAt?: string },
          ]),
        );
        for (const local of saved) {
          const remote = merged.get(local.analysis.id);
          merged.set(local.analysis.id, {
            ...local,
            analysis:
              remote &&
              Date.parse(remote.updatedAt ?? "") >
                Date.parse(local.updatedAt ?? "")
                ? remote.analysis
                : local.analysis,
          });
        }
        const all = [...merged.values()];
        if (!all.some((p) => p.analysis.id === initialAnalysis.id))
          all.push({ analysis: initialAnalysis });
        setProjects(all);
        if (!savedAnalyses.some((p) => p.analysis.id === initialAnalysis.id)) {
          const result = await saveAnalysis(initialAnalysis, userId);
          if (result.error) throw new Error(result.error);
        }
        if (!cancelled)
          setStorage("Analysis saved to account · files on this device");
      })
      .catch((error) => {
        if (!cancelled) {
          setStorage("Session only");
          setStorageError(
            error instanceof Error
              ? error.message
              : "Local file storage is unavailable. Saved account analyses are still listed; check the connection before editing.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initialAnalysis, userId, savedAnalyses]);
  useEffect(
    () => () => {
      if (source.startsWith("blob:")) URL.revokeObjectURL(source);
    },
    [source],
  );

  function persist(next: Analysis) {
    setAnalysis(next);
    setStorage("Saving…");
    setStorageError("");
    setProjects((current) =>
      current.map((p) =>
        p.analysis.id === next.id ? { ...p, analysis: next } : p,
      ),
    );
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(() => saveProject(next))
      .then(() =>
        setStorage("Analysis saved to account · files on this device"),
      )
      .catch(() => {
        setStorage("Not saved");
        setStorageError(
          "Your latest changes could not be synced. Check the connection and retry, or export your report.",
        );
      });
  }
  function select(id: string) {
    setCandidateId(null);
    setReviewMode("findings");
    setSelectedId(id);
    setFocusRequest({
      id,
      page: analysis.findings.find((f) => f.id === id)?.ai?.page,
      sequence: ++sequence.current,
    });
  }
  function selectCandidate(next: ExtractedCandidate | null) {
    setCandidateId(next?.id ?? null);
    setReviewMode(next ? "measurements" : "findings");
    if (!next) {
      setFilters({ severity: "all", status: "all" });
      const first = analysis.findings[0];
      setSelectedId(first?.id ?? null);
      if (first)
        setFocusRequest({ id: first.id, sequence: ++sequence.current });
    }
    if (next)
      setFocusRequest({
        id: next.id,
        region: next.originalEvidence.region,
        page: next.page,
        sequence: ++sequence.current,
      });
  }
  function setFilter(next: Filters) {
    setFilters(next);
    const id = selectionAfterFilter(
      filterFindings(analysis.findings, next),
      selectedId,
    );
    setSelectedId(id);
    if (id && id !== selectedId)
      setFocusRequest({
        id,
        page: analysis.findings.find((f) => f.id === id)?.ai?.page,
        sequence: ++sequence.current,
      });
  }
  function review(status: ReviewStatus) {
    if (!selectedId) return;
    const next = updateReviewStatus(analysis, selectedId, status);
    persist(next);
    const nextId = selectionAfterFilter(
      filterFindings(next.findings, filters),
      selectedId,
    );
    setSelectedId(nextId);
    if (nextId && nextId !== selectedId)
      setFocusRequest({ id: nextId, sequence: ++sequence.current });
    setNotice(
      status === "open" ? "Finding reopened" : `Finding marked ${status}`,
    );
  }
  async function showDemo(revision: "a" | "b" = "a") {
    const existing = projects.find(
      (p) => p.analysis.id === `demo-bracket-${revision}`,
    );
    const project = existing || { analysis: createFixture(revision) };
    if (!existing) {
      await saveProject(project.analysis).catch(() =>
        setStorageError(
          "Sample opened for this session. Local storage is unavailable.",
        ),
      );
      setProjects((current) => [...current, project]);
    }
    openProject(project);
  }
  return (
    <>
      <div className="forge-app no-print">
        <header className="app-navigation">
          <Link className="forge-brand" href="/" aria-label="Calliper home">
            <Brand />
          </Link>
          <nav aria-label="Main navigation">
            <button
              aria-current={view === "projects" ? "page" : undefined}
              className={view === "projects" ? "nav-item active" : "nav-item"}
              onClick={() => setView("projects")}
            >
              Projects
            </button>
          </nav>
          <span className="workspace-label">{email}</span>
          <form action={signOut}>
            <Button variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
          <Button size="sm" onClick={() => setModal("new")}>
            <Plus size={15} />
            New analysis
          </Button>
        </header>
        {storageError && (
          <div className="account-save-error" role="alert">
            {storageError}{" "}
            <Button
              variant="outline"
              size="sm"
              onClick={() => persist(analysis)}
            >
              Retry save
            </Button>
          </div>
        )}
        <div className="workspace-body">
          {view === "analysis" ? (
            <main id="main" className="analysis-workspace">
              {!source && analysis.mode === "uploaded" && (
                <div className="account-save-error">
                  <p>
                    This drawing’s file is on another device. Reattach the
                    original PDF to use its viewer and source annotations.
                  </p>
                  <label>
                    Original PDF
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        try {
                          const pages = await validatePdf(file);
                          const digest = Array.from(
                            new Uint8Array(
                              await crypto.subtle.digest(
                                "SHA-256",
                                await file.arrayBuffer(),
                              ),
                            ),
                          )
                            .map((b) => b.toString(16).padStart(2, "0"))
                            .join("");
                          if (
                            analysis.pdfDigest &&
                            digest !== analysis.pdfDigest
                          )
                            throw new Error(
                              "This PDF does not match the original drawing.",
                            );
                          if (
                            !analysis.pdfDigest &&
                            (file.name !== analysis.filename ||
                              JSON.stringify(pages) !==
                                JSON.stringify(analysis.pages))
                          )
                            throw new Error(
                              "Use the original PDF with the same filename and page dimensions.",
                            );
                          const next = { ...analysis, pdfDigest: digest };
                          await saveProject(next, { pdf: file });
                          setProjects((current) =>
                            current.map((p) =>
                              p.analysis.id === next.id
                                ? { ...p, analysis: next, pdf: file }
                                : p,
                            ),
                          );
                          openProject({ analysis: next, pdf: file });
                          setStorageError("");
                        } catch (error) {
                          setStorageError(
                            error instanceof Error
                              ? error.message
                              : "Could not attach the PDF.",
                          );
                        }
                      }}
                    />
                  </label>
                </div>
              )}
              <div className="analysis-heading">
                <div>
                  <div className="eyebrow">
                    <button onClick={() => setView("projects")}>
                      Projects
                    </button>
                    <span>/</span>{" "}
                    {analysis.mode === "fixture"
                      ? "FC-1042"
                      : analysis.id.slice(0, 8).toUpperCase()}
                  </div>
                  <h1>
                    {analysis.projectName}
                    <span className="revision-tag">
                      Rev {analysis.revision}
                    </span>
                  </h1>
                  <p>
                    3-axis CNC milling<span>·</span>
                    {analysis.material}
                    <span>·</span>
                    {analysis.units === "mm" ? "Millimetres" : "Inches"}
                  </p>
                </div>
                <div className="heading-actions">
                  <Button variant="outline" onClick={() => setModal("report")}>
                    <ArrowDownToLine size={15} />
                    Export report
                  </Button>
                  <span
                    className={`local-save ${
                      storageError || storage === "Not saved"
                        ? "save-error"
                        : storage.startsWith("Analysis saved")
                          ? "save-complete"
                          : "save-pending"
                    }`}
                    role="status"
                  >
                    <span />
                    {storage}
                  </span>
                </div>
              </div>
              <div className="analysis-context">
                <span>
                  {analysis.mode === "fixture"
                    ? "Sample analysis"
                    : "Uploaded drawing"}
                </span>
                <details>
                  <summary>Analysis information</summary>
                  <div className="context-details">
                    <p>
                      {analysis.review
                        ? "Six drawing checks with evidence and priority. All readings and locations require engineer review."
                        : analysis.mode === "fixture"
                          ? "Authored drawing and rule-based findings. No AI extraction. Engineer validation pending."
                          : analysis.extraction
                            ? "Measurements extracted with AI require reviewer confirmation before generating findings."
                            : "Analyse the drawing to flag missing specifications and manufacturing concerns."}
                    </p>
                    <p>
                      PDF: {analysis.filename} · {analysis.pages.length} pages
                    </p>
                    <p>
                      {analysis.stepFilename
                        ? `STEP attachment: ${analysis.stepFilename}. Stored only; 3D geometry analysis is not available.`
                        : "No STEP attachment. 3D geometry analysis is not available."}
                    </p>
                    <p>
                      Created{" "}
                      {new Date(analysis.createdAt).toLocaleDateString(
                        "en-GB",
                        { timeZone: "UTC" },
                      )}{" "}
                      · {analysis.profile.name}
                    </p>
                  </div>
                </details>
              </div>
              <div className="review-navigation">
                <div
                  className="review-switch"
                  role="group"
                  aria-label="Review view"
                >
                  <button
                    aria-pressed={reviewMode === "findings"}
                    onClick={() => selectCandidate(null)}
                  >
                    Findings <span>{analysis.findings.length}</span>
                  </button>
                  {!analysis.review &&
                    !!analysis.extraction?.candidates.length && (
                      <button
                        aria-pressed={reviewMode === "measurements"}
                        onClick={() => {
                          setReviewMode("measurements");
                          const next =
                            analysis.extraction?.candidates.find(
                              (c) => c.decision === "pending",
                            ) ?? analysis.extraction?.candidates[0];
                          if (next) selectCandidate(next);
                        }}
                      >
                        Previous measurements{" "}
                        <span>
                          {analysis.extraction?.candidates.length ?? 0}
                        </span>
                      </button>
                    )}
                </div>
                {!analysis.review && (
                  <button
                    className="profile-button"
                    aria-label="Process settings"
                    onClick={() => setModal("settings")}
                  >
                    <SlidersHorizontal size={15} />
                    Process settings<span>{analysis.profile.name}</span>
                  </button>
                )}
              </div>
              {storageError && (
                <div className="storage-error" role="alert">
                  {storageError}
                </div>
              )}
              <DrawingReviewControls
                key={`drawing-review:${analysis.id}`}
                analysis={analysis}
                source={source}
                configured={aiConfigured}
                onResult={(result) => {
                  const next = applyDrawingReview(analysis, result);
                  persist(next);
                  setReviewMode("findings");
                  setCandidateId(null);
                  setFilters({ severity: "all", status: "all" });
                  setSelectedId(next.findings[0]?.id ?? null);
                  setFocusRequest(
                    next.findings[0]
                      ? {
                          id: next.findings[0].id,
                          page: next.findings[0].ai?.page,
                          sequence: ++sequence.current,
                        }
                      : null,
                  );
                  setNotice(
                    `${next.findings.length} review items ready for engineer review`,
                  );
                }}
              />
              {reviewMode === "measurements" &&
                analysis.extraction &&
                !analysis.review && (
                  <label className="measurement-picker legacy-measurements">
                    Previous measurement
                    <select
                      value={candidateId ?? ""}
                      onChange={(e) =>
                        selectCandidate(
                          analysis.extraction!.candidates.find(
                            (c) => c.id === e.target.value,
                          ) ?? null,
                        )
                      }
                    >
                      <option value="" disabled>
                        Select a saved measurement
                      </option>
                      {analysis.extraction.candidates.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label} · {c.decision}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              <div className="review-layout">
                <div className="drawing-column">
                  <div className="drawing-tabs">
                    <button className="active">
                      <FileText size={16} />
                      Drawing<span>PDF</span>
                    </button>
                    <button
                      disabled
                      title="3D model rendering is not yet available"
                    >
                      <Box size={16} />
                      3D model<span>SOON</span>
                    </button>
                    <a
                      href={source}
                      download={analysis.filename}
                      title="Download source drawing"
                    >
                      {analysis.filename}
                      <ArrowDownToLine size={13} />
                    </a>
                  </div>
                  {source ? (
                    <PdfViewer
                      key={`${analysis.id}:${source}`}
                      source={source}
                      findings={visible}
                      allFindings={analysis.findings}
                      selectedId={selectedId}
                      focusRequest={focusRequest}
                      previewRegion={candidate?.originalEvidence.region}
                      onSelect={select}
                    />
                  ) : (
                    <div className="viewer-message" role="alert">
                      The saved PDF is unavailable. Please upload it again.
                    </div>
                  )}
                </div>
                {candidate ? (
                  <CandidateDetails
                    key={`${candidate.id}:${candidate.decision}:${candidate.reviewedAt ?? ""}`}
                    candidate={candidate}
                    findingTitle={
                      analysis.findings.find((f) => f.id === candidate.id)
                        ?.title
                    }
                    onFocus={() => selectCandidate(candidate)}
                    onFindings={() => {
                      selectCandidate(null);
                    }}
                    onUpdate={(updated) => {
                      const next = updateCandidate(analysis, updated);
                      persist(next);
                      setSelectedId(
                        next.findings.find((f) => f.id === updated.id)?.id ??
                          next.findings[0]?.id ??
                          null,
                      );
                      setNotice(
                        updated.decision === "confirmed"
                          ? "Measurement confirmed and checks updated"
                          : "Suggestion rejected",
                      );
                    }}
                  />
                ) : (
                  <IssueDetails
                    key={`${selected?.id ?? "none"}:${selected?.ai?.decision ?? "legacy"}`}
                    onAiReview={(decision, note) => {
                      if (selectedId)
                        persist(
                          reviewAiFinding(analysis, selectedId, {
                            decision,
                            note,
                          }),
                        );
                    }}
                    finding={reviewMode === "findings" ? selected : undefined}
                    mode={reviewMode}
                    index={selectedIndex}
                    count={visible.length}
                    onStatus={review}
                    onNavigate={(direction) => {
                      const next =
                        visible[
                          (selectedIndex + direction + visible.length) %
                            visible.length
                        ];
                      if (next) select(next.id);
                    }}
                    onFocus={() => {
                      if (selectedId) select(selectedId);
                    }}
                  />
                )}
              </div>
              {reviewMode === "findings" && (
                <section
                  className="findings-section"
                  aria-label="Manufacturing findings"
                >
                  <div className="findings-heading">
                    <div>
                      <h2>
                        Review queue <span>{analysis.findings.length}</span>
                      </h2>
                      <p>
                        {openCount} open <span>·</span> {reviewedCount} reviewed
                      </p>
                    </div>
                    <div className="filter-controls">
                      <label>
                        <span className="sr-only">Filter severity</span>
                        <SlidersHorizontal size={14} />
                        <select
                          value={filters.severity}
                          onChange={(e) =>
                            setFilter({
                              ...filters,
                              severity: e.target.value as Filters["severity"],
                            })
                          }
                        >
                          <option value="all">All severities</option>
                          <option value="high">High priority</option>
                          <option value="medium">Medium priority</option>
                          <option value="low">Low priority</option>
                        </select>
                      </label>
                      <label>
                        <span className="sr-only">Filter status</span>
                        <select
                          value={filters.status}
                          onChange={(e) =>
                            setFilter({
                              ...filters,
                              status: e.target.value as Filters["status"],
                            })
                          }
                        >
                          <option value="all">All statuses</option>
                          <option value="open">Open</option>
                          <option value="addressed">Addressed</option>
                          <option value="dismissed">Dismissed</option>
                        </select>
                      </label>
                    </div>
                  </div>
                  {visible.length ? (
                    <div className="issue-cards">
                      {visible.map((finding) => (
                        <button
                          id={`card-${finding.id}`}
                          key={finding.id}
                          className={`issue-card severity-${finding.severity} ${selectedId === finding.id ? "is-selected" : ""}`}
                          aria-pressed={selectedId === finding.id}
                          onClick={() => select(finding.id)}
                        >
                          <span className="issue-number">
                            {analysis.findings.findIndex(
                              (f) => f.id === finding.id,
                            ) + 1}
                          </span>
                          <div className="issue-row-body">
                            <h3>{finding.title}</h3>
                            <p>{finding.evidence[0]?.text}</p>
                          </div>
                          <span
                            className={`severity-badge severity-${finding.severity}`}
                          >
                            <i />
                            {finding.severity}
                          </span>
                          <span className="issue-location">
                            {finding.evidence[0]?.region
                              ? `Page ${finding.evidence[0].region.page}`
                              : finding.ai
                                ? `Page ${finding.ai.page} · unlocated`
                                : "No verified location"}
                          </span>
                          <span
                            className={`card-status status-${finding.ai?.result === "pass" && finding.ai.decision !== "rejected" ? "success" : finding.status}`}
                          >
                            {finding.status === "addressed" ? (
                              <Check size={13} />
                            ) : (
                              <CircleDot size={12} />
                            )}
                            {finding.ai?.result === "pass" &&
                            finding.ai.decision !== "rejected"
                              ? finding.ai.decision === "confirmed"
                                ? "Pass · confirmed"
                                : "Pass · check readings"
                              : finding.ai?.decision === "pending" &&
                                  finding.status === "open"
                                ? "AI flag"
                                : finding.ai?.decision === "confirmed" &&
                                    finding.status === "open"
                                  ? "Confirmed"
                                  : finding.status}
                          </span>
                          <ArrowRight className="row-arrow" size={16} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-findings">
                      <CircleDot size={22} />
                      <div>
                        <strong>
                          {analysis.findings.length
                            ? "No findings match these filters"
                            : analysis.review
                              ? "No AI issues flagged in reviewed pages"
                              : "Your drawing is ready for AI review"}
                        </strong>
                        <p>
                          {analysis.findings.length
                            ? "Try a different severity or review status."
                            : analysis.review
                              ? "Review the six-check coverage and any unassessed areas; zero flags is not a manufacturability verdict."
                              : analysis.mode === "uploaded"
                                ? "Use Analyse drawing above to review the drawing."
                                : "No concerns cross the current tooling thresholds."}
                        </p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() =>
                          analysis.findings.length
                            ? setFilter({ severity: "all", status: "all" })
                            : void showDemo()
                        }
                      >
                        {analysis.findings.length
                          ? "Clear filters"
                          : "Open sample"}
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </section>
              )}
              <MatchingPanel
                key={analysis.id}
                analysis={analysis}
                onSave={persist}
              />
              <footer className="workspace-footer">
                <span>
                  <LockKeyhole size={12} /> Preliminary review · engineering
                  sign-off required
                </span>
                <span>
                  Analysis history is account-owned. Drawing files stay on this
                  device.
                </span>
              </footer>
            </main>
          ) : (
            <ProjectLibrary
              projects={projects}
              onOpen={openProject}
              onImport={async () => {
                const legacy = await loadProjects();
                let count = 0;
                for (const project of legacy) {
                  if (
                    projects.some((p) => p.analysis.id === project.analysis.id)
                  )
                    continue;
                  await saveProject(project.analysis, {
                    pdf: project.pdf,
                    step: project.step,
                  });
                  setProjects((current) => [...current, project]);
                  count++;
                }
                return `Imported ${count} legacy projects into this account.`;
              }}
              onSample={() => void showDemo("b")}
            />
          )}
        </div>
        <div className="sr-only" role="status" aria-live="polite">
          {notice}
        </div>
        {modal === "report" && (
          <Modal
            title="Manufacturing review report"
            onClose={() => setModal(null)}
          >
            <div className="report-actions">
              <p>
                Includes every finding, its evidence, assumptions, and current
                review status.
              </p>
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = URL.createObjectURL(
                      new Blob([JSON.stringify(analysis, null, 2)], {
                        type: "application/json",
                      }),
                    );
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `calliper-${analysis.id}.json`;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }}
                >
                  Download JSON
                </Button>
                <Button size="sm" onClick={() => window.print()}>
                  Print / save PDF
                </Button>
              </div>
            </div>
            <div className="report-preview">
              <PrintReport analysis={analysis} />
            </div>
          </Modal>
        )}
        {modal === "new" && (
          <NewAnalysisDialog
            onClose={() => setModal(null)}
            onDemo={() => void showDemo()}
            onCreate={async (next, pdf, step) => {
              await saveProject(next, { pdf, step });
              const project = { analysis: next, pdf, step };
              setProjects((current) => [...current, project]);
              openProject(project);
              setStorage("Analysis saved to account · files on this device");
              setStorageError("");
            }}
          />
        )}
        {modal === "settings" && (
          <SettingsDialog
            analysis={analysis}
            onClose={() => setModal(null)}
            onSave={(profile, material) => {
              const next = {
                ...analysis,
                profile,
                material,
                findings: analysis.review
                  ? analysis.findings
                  : analysis.mode === "fixture"
                    ? evaluateCandidates(
                        fixtureCandidates(analysis.fixtureRevision || "a"),
                        profile,
                      )
                    : findingsFromExtraction({ ...analysis, profile }),
              };
              persist(next);
              setFilters({ severity: "all", status: "all" });
              setSelectedId(next.findings[0]?.id ?? null);
              setFocusRequest(
                next.findings[0]
                  ? { id: next.findings[0].id, sequence: ++sequence.current }
                  : null,
              );
              setModal(null);
              setNotice(
                "Tooling profile saved and confirmed-input rules updated",
              );
            }}
          />
        )}
      </div>
      <PrintReport analysis={analysis} />
    </>
  );
}
