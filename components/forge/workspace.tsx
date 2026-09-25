"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Box,
  Check,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Cpu,
  FileSearch,
  FileText,
  FolderClosed,
  LayoutDashboard,
  LockKeyhole,
  Plus,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createFixture, fixtureCandidates } from "@/lib/forge/fixture";
import { evaluateCandidates } from "@/lib/forge/rules";
import { loadProjects, saveProject } from "@/lib/forge/storage";
import {
  filterFindings,
  selectionAfterFilter,
  updateReviewStatus,
  type Analysis,
  type Filters,
  type ReviewStatus,
} from "@/lib/forge/types";
import { PdfViewer } from "./pdf-viewer";
import { IssueDetails } from "./issue-details";
import { Modal, NewAnalysisDialog, SettingsDialog } from "./dialogs";
import { PrintReport } from "./print-report";

type Project = { analysis: Analysis; pdf?: Blob; step?: Blob };
export function ForgeWorkspace({
  initialAnalysis,
}: {
  initialAnalysis: Analysis;
}) {
  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [projects, setProjects] = useState<Project[]>([
    { analysis: initialAnalysis },
  ]);
  const [source, setSource] = useState("/drawings/cnc-bracket-rev-a.pdf");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialAnalysis.findings[0]?.id ?? null,
  );
  const [focusRequest, setFocusRequest] = useState<{
    id: string;
    sequence: number;
  } | null>(null);
  const [filters, setFilters] = useState<Filters>({
    severity: "all",
    status: "all",
  });
  const [modal, setModal] = useState<"new" | "settings" | "report" | null>(
    null,
  );
  const [view, setView] = useState<"analysis" | "dashboard" | "projects">(
    "analysis",
  );
  const [storage, setStorage] = useState("Loading local projects…");
  const [notice, setNotice] = useState("");
  const [storageError, setStorageError] = useState("");
  const saveQueue = useRef(Promise.resolve());
  const sequence = useRef(0);
  const visible = filterFindings(analysis.findings, filters);
  const selected = visible.find((f) => f.id === selectedId);
  const selectedIndex = visible.findIndex((f) => f.id === selectedId);
  const openCount = analysis.findings.filter((f) => f.status === "open").length;

  function openProject(project: Project, focus = true) {
    const next = project.analysis;
    setAnalysis(next);
    setSelectedId(next.findings[0]?.id ?? null);
    setFilters({ severity: "all", status: "all" });
    setFocusRequest(
      focus && next.findings[0]
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
    try {
      localStorage.setItem("forgecheck-active", next.id);
    } catch {
      /* Project data still lives in IndexedDB. */
    }
  }
  useEffect(() => {
    let cancelled = false;
    loadProjects()
      .then(async (saved) => {
        if (cancelled) return;
        const activeId = (() => {
          try {
            return localStorage.getItem("forgecheck-active");
          } catch {
            return null;
          }
        })();
        const all = saved.some((p) => p.analysis.id === initialAnalysis.id)
          ? saved
          : [{ analysis: initialAnalysis }, ...saved];
        setProjects(all);
        const active =
          all.find((p) => p.analysis.id === activeId) ||
          all.find((p) => p.analysis.id === initialAnalysis.id);
        if (active) openProject(active, false);
        if (!saved.some((p) => p.analysis.id === initialAnalysis.id))
          await saveProject(initialAnalysis);
        if (!cancelled) setStorage("Saved on this device");
      })
      .catch(() => {
        if (!cancelled) {
          setStorage("Session only");
          setStorageError(
            "Browser storage is unavailable. You can review the sample, but changes may not survive refresh.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initialAnalysis]);
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
      .then(() => setStorage("Saved on this device"))
      .catch(() => {
        setStorage("Not saved");
        setStorageError(
          "Your latest changes could not be saved. Free browser storage and try another status update, or export your report now.",
        );
      });
  }
  function select(id: string) {
    setSelectedId(id);
    setFocusRequest({ id, sequence: ++sequence.current });
    requestAnimationFrame(() =>
      document.getElementById(`card-${id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      }),
    );
  }
  function setFilter(next: Filters) {
    setFilters(next);
    const id = selectionAfterFilter(
      filterFindings(analysis.findings, next),
      selectedId,
    );
    setSelectedId(id);
    if (id && id !== selectedId)
      setFocusRequest({ id, sequence: ++sequence.current });
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
  const nav = [
    { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
    { id: "projects" as const, label: "Projects", icon: FolderClosed },
    { id: "analysis" as const, label: "Drawing analysis", icon: FileSearch },
  ];
  return (
    <>
      <div className="forge-app no-print">
        <aside className="navigation-rail">
          <Link className="forge-brand" href="/" aria-label="ForgeCheck home">
            <span className="brand-mark">
              <Activity size={23} strokeWidth={2.6} />
            </span>
            <span>
              Forge<span>Check</span>
              <small>DESIGN. REVIEW. REFINE.</small>
            </span>
          </Link>
          <div className="nav-workspace">
            <span className="workspace-avatar">FC</span>
            <div>
              Engineering workspace<small>Local prototype</small>
            </div>
            <ChevronRight size={15} />
          </div>
          <p className="nav-label">WORKSPACE</p>
          <nav>
            {nav.map((item) => (
              <button
                key={item.id}
                aria-label={item.label}
                className={view === item.id ? "nav-item active" : "nav-item"}
                onClick={() => setView(item.id)}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
                {item.id === "analysis" && <i />}
              </button>
            ))}
            <button
              className="nav-item"
              disabled
              title="STEP geometry analysis is not implemented"
            >
              <Box size={18} />
              <span>3D viewer</span>
              <small>SOON</small>
            </button>
            <button
              className="nav-item"
              aria-label="Reports"
              onClick={() => setModal("report")}
            >
              <ClipboardList size={18} />
              <span>Reports</span>
            </button>
          </nav>
          <div className="rail-project">
            <p className="nav-label">CURRENT PROJECT</p>
            <div>
              <span className="project-square">
                <Box size={17} />
              </span>
              <span>
                {analysis.projectName}
                <small>
                  FC-
                  {analysis.mode === "fixture"
                    ? "1042"
                    : analysis.id.slice(0, 4).toUpperCase()}{" "}
                  · Rev {analysis.revision}
                </small>
              </span>
            </div>
          </div>
          <div className="rail-bottom">
            <div className="prototype-card">
              <span>
                <Sparkles size={15} /> BUILT FOR BETTER PARTS
              </span>
              <p>
                A second look.
                <br />
                Before the first cut.
              </p>
              <small>Preliminary manufacturing review</small>
            </div>
            <button className="nav-item" onClick={() => setModal("settings")}>
              <Settings2 size={18} />
              Settings
            </button>
            <div className="local-workspace">
              <span className="user-avatar">EN</span>
              <div>
                Engineer
                <small>
                  <span /> Local workspace
                </small>
              </div>
              <LockKeyhole size={14} />
            </div>
          </div>
        </aside>
        <div className="workspace-body">
          <header className="workspace-header">
            <div className="breadcrumbs">
              <button onClick={() => setView("projects")}>Projects</button>
              <ChevronRight size={13} />
              <span>{analysis.projectName}</span>
              <ChevronRight size={13} />
              <span>Rev {analysis.revision}</span>
              <ChevronRight size={13} />
              <strong>
                {view === "analysis"
                  ? "Drawing analysis"
                  : view === "dashboard"
                    ? "Dashboard"
                    : "Projects"}
              </strong>
            </div>
            <div className="header-actions">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal("report")}
              >
                <ArrowDownToLine size={14} />
                Export report
              </Button>
              <Button size="sm" onClick={() => setModal("new")}>
                <Plus size={15} />
                New analysis
              </Button>
            </div>
          </header>
          {view === "analysis" ? (
            <main id="main" className="analysis-workspace">
              <div className="analysis-heading">
                <div>
                  <div className="eyebrow">
                    MANUFACTURING REVIEW <span>/</span>{" "}
                    {analysis.mode === "fixture"
                      ? "FC-1042"
                      : analysis.id.slice(0, 8).toUpperCase()}
                  </div>
                  <h1>
                    {analysis.projectName}
                    <span className="revision-tag">
                      REV {analysis.revision}
                    </span>
                  </h1>
                  <p>
                    <span className="process-dot" />
                    3-axis CNC milling<span>·</span>
                    {analysis.material}
                    <span>·</span>
                    {analysis.units === "mm" ? "Millimetres" : "Inches"}
                  </p>
                </div>
                <button
                  className="profile-button"
                  onClick={() => setModal("settings")}
                >
                  <SlidersHorizontal size={16} />
                  <span>
                    Process settings<small>{analysis.profile.name}</small>
                  </span>
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="analysis-notice">
                <span className="notice-icon">
                  <FileSearch size={15} />
                </span>
                <p>
                  {analysis.mode === "fixture" ? (
                    <>
                      <strong>Sample analysis</strong>
                      <span>
                        Authored drawing + rule-based findings. No AI
                        extraction. Engineer validation pending.
                      </span>
                    </>
                  ) : (
                    <>
                      <strong>Drawing ready for review</strong>
                      <span>
                        Automated extraction is not connected. No manufacturing
                        findings have been generated.
                      </span>
                    </>
                  )}
                </p>
                <span className="local-save">
                  <span />
                  {storage}
                </span>
              </div>
              {storageError && (
                <div className="storage-error" role="alert">
                  {storageError}
                </div>
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
                      onSelect={select}
                    />
                  ) : (
                    <div className="viewer-message" role="alert">
                      The saved PDF is unavailable. Please upload it again.
                    </div>
                  )}
                </div>
                <IssueDetails
                  finding={selected}
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
              </div>
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
                      {openCount} open <span>·</span>{" "}
                      {analysis.findings.length - openCount} reviewed
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
                        <div>
                          <span className="issue-number">
                            {analysis.findings.findIndex(
                              (f) => f.id === finding.id,
                            ) + 1}
                          </span>
                          <span
                            className={`severity-badge severity-${finding.severity}`}
                          >
                            <i />
                            {finding.severity}
                          </span>
                          <span
                            className={`card-status status-${finding.status}`}
                          >
                            {finding.status === "addressed" ? (
                              <Check size={13} />
                            ) : (
                              <CircleDot size={12} />
                            )}
                            {finding.status}
                          </span>
                        </div>
                        <h3>{finding.title}</h3>
                        <p>{finding.evidence[0]?.text}</p>
                        <footer>
                          <span>
                            {finding.evidence[0]?.region
                              ? `Page ${finding.evidence[0].region.page}`
                              : "No verified location"}
                          </span>
                          <ArrowRight size={14} />
                        </footer>
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
                          : "Your drawing is ready. Findings need evidence."}
                      </strong>
                      <p>
                        {analysis.findings.length
                          ? "Try a different severity or review status."
                          : "Explore the sample analysis to see drawing annotations and the review workflow."}
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
              <footer className="workspace-footer">
                <span>
                  <LockKeyhole size={12} /> Preliminary review · engineering
                  sign-off required
                </span>
                <span>
                  ForgeCheck <span className="footer-dot">/</span> From drawing
                  to better decisions.
                </span>
              </footer>
            </main>
          ) : (
            <main id="main" className="projects-page">
              <div className="eyebrow">YOUR ENGINEERING WORKSPACE</div>
              <h1>
                {view === "dashboard"
                  ? "A clearer path to production."
                  : "Your projects"}
              </h1>
              <p>
                Drawings, findings, and review decisions. Saved in this browser.
              </p>
              <div className="dashboard-stats">
                <div>
                  <FolderClosed size={20} />
                  <strong>{projects.length}</strong>
                  <span>Local projects</span>
                </div>
                <div>
                  <TriangleAlert size={20} />
                  <strong>
                    {projects.reduce(
                      (sum, p) =>
                        sum +
                        p.analysis.findings.filter((f) => f.status === "open")
                          .length,
                      0,
                    )}
                  </strong>
                  <span>Open findings</span>
                </div>
                <div>
                  <Check size={20} />
                  <strong>
                    {projects.reduce(
                      (sum, p) =>
                        sum +
                        p.analysis.findings.filter((f) => f.status !== "open")
                          .length,
                      0,
                    )}
                  </strong>
                  <span>Reviewed findings</span>
                </div>
              </div>
              <div className="project-list">
                {projects.map((project) => (
                  <button
                    key={project.analysis.id}
                    onClick={() => openProject(project)}
                  >
                    <span className="project-file">
                      <FileText size={24} />
                    </span>
                    <div>
                      <h2>{project.analysis.projectName}</h2>
                      <p>
                        Rev {project.analysis.revision} ·{" "}
                        {project.analysis.mode === "fixture"
                          ? "Sample analysis"
                          : "Uploaded drawing"}{" "}
                        · {project.analysis.pages.length} pages
                      </p>
                    </div>
                    <span>{project.analysis.findings.length} findings</span>
                    <ArrowRight size={18} />
                  </button>
                ))}
              </div>
              <div className="revision-demo">
                <Cpu size={24} />
                <div>
                  <h2>See what changes in revision B</h2>
                  <p>
                    The revised fixture changes three dimensions. The locating
                    tolerance remains for review.
                  </p>
                </div>
                <Button variant="outline" onClick={() => void showDemo("b")}>
                  Open revised sample
                  <ArrowRight size={15} />
                </Button>
              </div>
            </main>
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
                    link.download = `forgecheck-${analysis.id}.json`;
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
              setStorage("Saved on this device");
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
                findings:
                  analysis.mode === "fixture"
                    ? evaluateCandidates(
                        fixtureCandidates(analysis.fixtureRevision || "a"),
                        profile,
                      )
                    : [],
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
              setNotice("Tooling profile saved and sample rules updated");
            }}
          />
        )}
      </div>
      <PrintReport analysis={analysis} />
    </>
  );
}
