"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  PanelRightClose,
  PanelRightOpen,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  loadProjects,
  saveProject as saveLocalProject,
} from "@/lib/forge/storage";
import type { Analysis, DrawingRegion } from "@/lib/forge/types";
import { PdfViewer } from "./pdf-viewer";
import { IssueDetails } from "./issue-details";
import { Modal, NewAnalysisDialog } from "./dialogs";
import { PrintReport } from "./print-report";
import { DrawingReviewControls } from "./drawing-review";
import { applyDrawingReview } from "@/lib/forge/drawing-review";
import { saveAnalysis } from "@/app/actions/analyses";
import { validatePdf } from "@/lib/forge/pdf";
import { ProjectLibrary, type Project } from "./project-views";
import { ManufacturingPlan } from "./manufacturing-plan";
import { DesignerNav } from "@/components/designer-nav";

export function ForgeWorkspace({
  aiConfigured,
  userId,
  email,
  savedAnalyses,
  initialProjectId,
  openNewAnalysis = false,
}: {
  userId: string;
  email: string;
  savedAnalyses: { analysis: Analysis; updatedAt: string }[];
  aiConfigured: boolean;
  initialProjectId?: string;
  openNewAnalysis?: boolean;
}) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [projects, setProjects] = useState<Project[]>(savedAnalyses);
  const [source, setSource] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [focusRequest, setFocusRequest] = useState<{
    id: string;
    sequence: number;
    region?: DrawingRegion;
    page?: number;
  } | null>(null);
  const [modal, setModal] = useState<"new" | "report" | null>(
    openNewAnalysis ? "new" : null,
  );
  const [view, setView] = useState<"analysis" | "projects">("projects");
  const [storage, setStorage] = useState("Loading local projects…");
  const [notice, setNotice] = useState("");
  const [storageError, setStorageError] = useState("");
  const saveQueue = useRef(Promise.resolve());
  const requested = useRef(false);
  const sequence = useRef(0);
  const selectedIndex =
    analysis?.findings.findIndex((f) => f.id === selectedId) ?? -1;
  const selected = analysis?.findings[selectedIndex];

  const openProject = useCallback((project: Project) => {
    setAnalysis(project.analysis);
    setSelectedId(null);
    setFocusRequest(null);
    setSidebarOpen(true);
    setSource(project.pdf ? URL.createObjectURL(project.pdf) : "");
    setView("analysis");
    setModal(null);
  }, []);
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
      .then((saved) => {
        if (cancelled) return;
        const merged = new Map(
          savedAnalyses.map((p) => [
            p.analysis.id,
            p as Project & { updatedAt?: string },
          ]),
        );
        for (const local of saved) {
          if (local.analysis.mode !== "uploaded") continue;
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
        setProjects([...merged.values()]);
        // Returning from the manufacturer directory reopens that project, once its
        // local file is available to the viewer.
        const wanted = initialProjectId
          ? merged.get(initialProjectId)
          : undefined;
        if (wanted && !requested.current) {
          requested.current = true;
          openProject(wanted);
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
  }, [userId, savedAnalyses, initialProjectId, openProject]);
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
    if (!analysis) return;
    setSelectedId(id);
    setSidebarOpen(true);
    setFocusRequest({
      id,
      page: analysis.findings.find((f) => f.id === id)?.ai?.page,
      sequence: ++sequence.current,
    });
  }

  return (
    <>
      <div
        className={`forge-app designer-app no-print ${view === "analysis" ? "drawing-app" : ""}`}
      >
        <DesignerNav
          email={email}
          active="projects"
          onProjects={() => setView("projects")}
        >
          <Button size="sm" onClick={() => setModal("new")}>
            <Plus size={15} />
            New analysis
          </Button>
        </DesignerNav>

        {storageError && (
          <div className="account-save-error" role="alert">
            {storageError}
            {analysis && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => persist(analysis)}
              >
                Retry save
              </Button>
            )}
          </div>
        )}
        <div className="workspace-body">
          {view === "analysis" && analysis ? (
            <main id="main" className="drawing-workspace">
              <header className="drawing-heading">
                <div className="drawing-identity">
                  <button
                    className="drawing-back"
                    aria-label="Back to projects"
                    onClick={() => setView("projects")}
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div>
                    <h1>
                      {analysis.projectName}{" "}
                      <span>Rev {analysis.revision}</span>
                    </h1>
                    <p>
                      {analysis.filename} · {analysis.pages.length} pages
                    </p>
                  </div>
                </div>
                <div className="drawing-actions">
                  <DrawingReviewControls
                    key={analysis.id}
                    analysis={analysis}
                    source={source}
                    configured={aiConfigured}
                    onResult={(result) => {
                      const next = applyDrawingReview(analysis, result);
                      persist(next);
                      setSelectedId(null);
                      setFocusRequest(null);
                      setSidebarOpen(true);
                      setNotice(
                        `${next.findings.length} detected issues ready to inspect`,
                      );
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    aria-expanded={sidebarOpen}
                    aria-controls="detected-issues"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                  >
                    {sidebarOpen ? (
                      <PanelRightClose size={16} />
                    ) : (
                      <PanelRightOpen size={16} />
                    )}
                    Issues {analysis.findings.length}
                  </Button>
                </div>
              </header>
              <ManufacturingPlan analysis={analysis} />
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

              <div
                className={`drawing-explorer ${sidebarOpen ? "" : "sidebar-collapsed"}`}
              >
                <div className="drawing-canvas-panel">
                  {source ? (
                    <PdfViewer
                      key={`${analysis.id}:${source}:${analysis.review?.createdAt ?? "original"}`}
                      source={source}
                      findings={analysis.findings}
                      allFindings={analysis.findings}
                      selectedId={selectedId}
                      focusRequest={focusRequest}
                      onSelect={select}
                    />
                  ) : (
                    <div className="viewer-message">
                      Reattach the original PDF to view this drawing.
                    </div>
                  )}
                </div>
                {sidebarOpen && (
                  <aside
                    id="detected-issues"
                    className="detected-issues"
                    aria-label="Detected Issues"
                  >
                    <div className="detected-issues-heading">
                      <h2>
                        Detected Issues <span>{analysis.findings.length}</span>
                      </h2>
                      <p>
                        {analysis.review
                          ? "Select an issue to explore its source."
                          : "Analyse the drawing to identify potential issues."}
                      </p>
                    </div>
                    {analysis.findings.length ? (
                      <>
                        <label className="mobile-issue-picker">
                          <span className="sr-only">Select detected issue</span>
                          <select
                            value={selectedId ?? ""}
                            onChange={(e) => select(e.target.value)}
                          >
                            <option value="" disabled>
                              Select an issue
                            </option>
                            {analysis.findings.map((finding, index) => (
                              <option key={finding.id} value={finding.id}>
                                {index + 1}. {finding.title} ·{" "}
                                {finding.severity}
                              </option>
                            ))}
                          </select>
                        </label>
                        <nav
                          className="detected-issue-list"
                          aria-label="Issue navigation"
                        >
                          {analysis.findings.map((finding, index) => {
                            const page =
                              finding.evidence.find((e) => e.region)?.region
                                ?.page ?? finding.ai?.page;
                            return (
                              <button
                                key={finding.id}
                                aria-pressed={selectedId === finding.id}
                                onClick={() => select(finding.id)}
                                className={`detected-issue severity-${finding.severity}`}
                              >
                                <span className="detected-issue-number">
                                  {index + 1}
                                </span>
                                <span className="detected-issue-title">
                                  {finding.title}
                                  <small>
                                    {page
                                      ? `Page ${page}`
                                      : "No located source"}
                                  </small>
                                </span>
                                <span
                                  className={`severity-badge severity-${finding.severity}`}
                                >
                                  {finding.severity}
                                </span>
                              </button>
                            );
                          })}
                        </nav>
                        <IssueDetails
                          finding={selected}
                          index={selectedIndex}
                          count={analysis.findings.length}
                          onNavigate={(direction) => {
                            const next =
                              analysis.findings[
                                (selectedIndex +
                                  direction +
                                  analysis.findings.length) %
                                  analysis.findings.length
                              ];
                            if (next) select(next.id);
                          }}
                          onFocus={() => {
                            if (selectedId) select(selectedId);
                          }}
                        />
                      </>
                    ) : (
                      <div className="detected-issues-empty">
                        <h3>
                          {analysis.review
                            ? "No issues detected — looks good to go"
                            : "Ready to analyse"}
                        </h3>
                        <p>
                          {analysis.review
                            ? "Nothing was flagged across the six checks on the reviewed pages. See Analysis notes for coverage and anything that could not be assessed."
                            : "Run AI analysis to find missing specifications and manufacturing concerns."}
                        </p>
                      </div>
                    )}
                  </aside>
                )}
              </div>
              <footer className="drawing-statusbar">
                <span>
                  AI findings are suggestions · engineering judgement required
                </span>
                <span role="status">{storage}</span>
              </footer>
            </main>
          ) : (
            <ProjectLibrary
              projects={projects}
              onOpen={openProject}
              onCreate={() => setModal("new")}
              onImport={async () => {
                const legacy = (await loadProjects()).filter(
                  (p) => p.analysis.mode === "uploaded",
                );
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
            />
          )}
        </div>
        <div className="sr-only" role="status" aria-live="polite">
          {notice}
        </div>
        {modal === "report" && analysis && (
          <Modal
            title="Manufacturing review report"
            onClose={() => setModal(null)}
          >
            <div className="report-actions">
              <p>
                Includes every detected issue, its evidence and manufacturing
                considerations.
              </p>
              <div>
                {source && (
                  <a
                    className="text-button"
                    href={source}
                    download={analysis.filename}
                  >
                    Download source PDF
                  </a>
                )}
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
      </div>
      {analysis && <PrintReport analysis={analysis} />}
    </>
  );
}
