"use client";

import { useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Analysis } from "@/lib/forge/types";

export type Project = { analysis: Analysis; pdf?: Blob; step?: Blob };

function reviewState(analysis: Analysis) {
  const pending = analysis.review
    ? analysis.findings.filter((f) => f.ai?.decision === "pending").length
    : (analysis.extraction?.candidates.filter((c) => c.decision === "pending")
        .length ?? 0);
  const open = analysis.findings.filter((f) => f.status === "open").length;
  const reviewed = analysis.findings.filter((f) =>
    f.ai ? f.ai.decision !== "pending" : f.status !== "open",
  ).length;
  const high = analysis.findings.filter(
    (f) => f.status === "open" && f.severity === "high",
  ).length;
  const unanalysed =
    analysis.mode === "uploaded" && !analysis.extraction && !analysis.review;
  const status = unanalysed
    ? "not-started"
    : pending
      ? "pending"
      : open
        ? "open"
        : "reviewed";
  const label = unanalysed
    ? "Ready for AI review"
    : pending
      ? `${pending} pending ${analysis.review ? "AI flag" : "measurement"}${pending === 1 ? "" : "s"}`
      : open
        ? `${open} open finding${open === 1 ? "" : "s"}`
        : "No outstanding reviews";
  return { pending, open, reviewed, high, unanalysed, status, label };
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function ProjectLibrary({
  projects,
  onOpen,
  onSample,
  onImport,
}: {
  projects: Project[];
  onOpen: (project: Project) => void;
  onSample: () => void;
  onImport: () => Promise<string>;
}) {
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [sort, setSort] = useState("newest");
  const entries = projects.map((project) => ({
    project,
    ...reviewState(project.analysis),
  }));
  const search = query.trim().toLowerCase();
  const filtered = entries
    .filter(({ project, ...state }) => {
      const a = project.analysis;
      return (
        (!search ||
          [a.projectName, a.filename, `Rev ${a.revision}`, a.material]
            .join(" ")
            .toLowerCase()
            .includes(search)) &&
        (status === "all" ||
          (status === "pending"
            ? state.pending > 0
            : status === "open"
              ? state.open > 0
              : state.status === status)) &&
        (source === "all" || a.mode === source)
      );
    })
    .sort((a, b) =>
      sort === "name"
        ? a.project.analysis.projectName.localeCompare(
            b.project.analysis.projectName,
          )
        : (sort === "oldest" ? 1 : -1) *
          (Date.parse(a.project.analysis.createdAt) -
            Date.parse(b.project.analysis.createdAt)),
    );
  return (
    <main id="main" className="projects-page">
      <div className="eyebrow">Workspace</div>
      <h1>Projects</h1>
      <p>Every drawing and revision, ready to pick up where you left off.</p>
      <div className="library-toolbar">
        <label className="library-search">
          <span className="sr-only">Search projects</span>
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, file, revision or material"
          />
        </label>
        <label>
          Review status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="not-started">Ready for AI review</option>
            <option value="pending">Awaiting review</option>
            <option value="open">Open findings</option>
            <option value="reviewed">No outstanding reviews</option>
          </select>
        </label>
        <label>
          Source
          <select
            value={source}
            onChange={(event) => setSource(event.target.value)}
          >
            <option value="all">All drawings</option>
            <option value="uploaded">Uploads</option>
            <option value="fixture">Samples</option>
          </select>
        </label>
        <label>
          Sort by
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Project name</option>
          </select>
        </label>
      </div>
      <p className="library-count" role="status">
        {filtered.length} of {projects.length} projects
      </p>
      <div
        className="library-table"
        role="region"
        aria-label="Project library"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Drawing / revision</th>
              <th scope="col">Review status</th>
              <th scope="col">Findings</th>
              <th scope="col">Created</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(
              ({ project, label, high, open, reviewed, status }) => {
                const a = project.analysis;
                return (
                  <tr key={a.id}>
                    <td>
                      <button
                        className="project-title"
                        onClick={() => onOpen(project)}
                      >
                        {a.projectName} <ArrowRight size={14} />
                      </button>
                      <span className="library-meta">
                        Rev {a.revision} · {a.filename}
                      </span>
                      <span className="library-meta">
                        {a.material} · {a.pages.length} pages ·{" "}
                        {a.mode === "fixture" ? "Sample" : "Upload"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status-badge ${
                          status === "reviewed"
                            ? "status-success"
                            : status === "not-started"
                              ? "status-info"
                              : "status-warning"
                        }`}
                      >
                        {label}
                      </span>
                      {high > 0 && (
                        <span className="library-priority">
                          {high} high priority
                        </span>
                      )}
                    </td>
                    <td>
                      {open} open
                      <span className="library-meta">
                        {reviewed} reviewed · {a.findings.length} total
                      </span>
                    </td>
                    <td>
                      <time dateTime={a.createdAt}>
                        {dateLabel(a.createdAt)}
                      </time>
                    </td>
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <div className="library-empty">
          <h2>No projects match</h2>
          <p>Try a different search or clear your filters.</p>
          <Button
            variant="outline"
            onClick={() => {
              setQuery("");
              setStatus("all");
              setSource("all");
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
      <div className="revision-demo">
        <div>
          <h2>Explore a revised drawing</h2>
          <p>
            The revised sample changes three dimensions. The locating tolerance
            remains for review.
          </p>
        </div>
        <Button variant="outline" onClick={onSample}>
          Open revised sample <ArrowRight size={15} />
        </Button>
      </div>
      <details className="legacy-import">
        <summary>Import drawings saved before accounts</summary>
        <p>
          These old projects are unowned browser data. Only import drawings that
          belong to you; they will be copied into your signed-in account.
        </p>
        <Button
          variant="outline"
          disabled={importing}
          onClick={async () => {
            setImporting(true);
            try {
              setImportMessage(await onImport());
            } catch {
              setImportMessage(
                "Could not import all projects. Check your connection and retry; existing projects are preserved.",
              );
            } finally {
              setImporting(false);
            }
          }}
        >
          {importing ? "Importing…" : "Import my legacy projects"}
        </Button>
        <p role="status">{importMessage}</p>
      </details>
      <p className="library-footnote">
        Analysis history is saved to your account. PDF and STEP files stay on
        this device. Preliminary review · engineering sign-off required.
      </p>
    </main>
  );
}
