"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileWarning,
  Hand,
  LoaderCircle,
  Maximize,
  Minus,
  Plus,
  Scan,
  Eye,
  EyeOff,
  TriangleAlert,
} from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { getPdfEngine } from "@/lib/forge/pdf";
import {
  rotatedRegion,
  type Finding,
  type DrawingRegion,
} from "@/lib/forge/types";

type Props = {
  source: string;
  findings: Finding[];
  allFindings: Finding[];
  selectedId: string | null;
  focusRequest: {
    id: string;
    sequence: number;
    region?: DrawingRegion;
    page?: number;
  } | null;
  previewRegion?: DrawingRegion;
  onSelect: (id: string) => void;
};

export function PdfViewer({
  source,
  findings,
  allFindings,
  selectedId,
  focusRequest,
  previewRegion,
  onSelect,
}: Props) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(
    () =>
      allFindings
        .find((f) => f.id === selectedId)
        ?.evidence.find((e) => e.region)?.region?.page ?? 1,
  );
  const [pageSize, setPageSize] = useState({
    width: 1000,
    height: 700,
    rotation: 0,
  });
  const [zoom, setZoom] = useState(0.7);
  const [container, setContainer] = useState({ width: 900, height: 620 });
  const [error, setError] = useState("");
  const [rendering, setRendering] = useState(true);
  const [annotations, setAnnotations] = useState(true);
  const viewport = useRef<HTMLDivElement>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  const pan = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const fit = Math.max(
    0.08,
    Math.min(
      (container.width - 72) / pageSize.width,
      (container.height - 72) / pageSize.height,
    ),
  );
  const fitRef = useRef(true);
  const renderedFocus = useRef(0);
  const pendingScroll = useRef<{
    page: number;
    zoom: number;
    x: number;
    y: number;
  } | null>(null);

  // Apply focus after the paper has its new size. This also avoids races between
  // a card selection and a subsequent zoom click or responsive layout change.
  useLayoutEffect(() => {
    const target = pendingScroll.current;
    const host = viewport.current;
    if (!target || !host || target.page !== page || target.zoom !== zoom)
      return;
    pendingScroll.current = null;
    host.scrollTo({
      left:
        Math.max(36, (container.width - pageSize.width * zoom) / 2) +
        target.x * zoom -
        container.width / 2,
      top:
        Math.max(36, (container.height - pageSize.height * zoom) / 2) +
        target.y * zoom -
        container.height / 2,
      behavior: "auto",
    });
  });

  useEffect(() => {
    const host = viewport.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) =>
      setContainer({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof import("pdfjs-dist").getDocument> | undefined;
    getPdfEngine()
      .then((pdfjs) => {
        if (cancelled) return;
        task = pdfjs.getDocument({ url: source, isEvalSupported: false });
        return task.promise;
      })
      .then((pdf) => {
        if (pdf && !cancelled) setDocument(pdf);
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "This drawing could not be opened. Try a valid, unlocked PDF.",
          );
          setRendering(false);
        }
      });
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [source]);

  useEffect(() => {
    if (fitRef.current) setZoom(fit);
  }, [fit]);

  useEffect(() => {
    if (!document) return;
    let cancelled = false;
    let renderTask:
      | ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]>
      | undefined;
    document
      .getPage(page)
      .then((pdfPage) => {
        if (cancelled) return;
        setRendering(true);
        const base = pdfPage.getViewport({ scale: 1 });
        setPageSize({
          width: base.width,
          height: base.height,
          rotation: pdfPage.rotate,
        });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        // Cap the backing canvas on large sheets; CSS and overlay geometry remain exact.
        const outputScale = Math.min(
          zoom * ratio,
          6000 / Math.max(base.width, base.height),
        );
        const renderViewport = pdfPage.getViewport({ scale: outputScale });
        const canvas = window.document.createElement("canvas");
        canvas.width = Math.ceil(renderViewport.width);
        canvas.height = Math.ceil(renderViewport.height);
        canvas.setAttribute("aria-label", `Engineering drawing, page ${page}`);
        canvas.setAttribute("role", "img");
        renderTask = pdfPage.render({ canvas, viewport: renderViewport });
        return renderTask.promise.then(() => {
          if (!cancelled) {
            canvasHost.current?.replaceChildren(canvas);
            setRendering(false);
          }
        });
      })
      .catch((error) => {
        if (!cancelled && error?.name !== "RenderingCancelledException") {
          setError("This page could not be rendered. Try another PDF export.");
          setRendering(false);
        }
      });
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [document, page, zoom]);

  useEffect(() => {
    if (
      !focusRequest ||
      !document ||
      renderedFocus.current === focusRequest.sequence
    )
      return;
    const finding = allFindings.find((f) => f.id === focusRequest.id);
    const evidence = finding?.evidence.find(
      (e) => e.region && (e.status === "verified" || finding?.ai),
    );
    const region =
      focusRequest.region ??
      evidence?.region ??
      (focusRequest.page
        ? { page: focusRequest.page, x: 0, y: 0, width: 1, height: 1 }
        : undefined);
    if (!region) {
      renderedFocus.current = focusRequest.sequence;
      return;
    }
    let cancelled = false;
    document.getPage(region.page).then((pdfPage) => {
      if (cancelled) return;
      const base = pdfPage.getViewport({ scale: 1 });
      const location = rotatedRegion(region, pdfPage.rotate);
      const scale = Math.max(
        fit,
        Math.min(
          1.6,
          (container.width * 0.65) / (location.width * base.width),
          (container.height * 0.65) / (location.height * base.height),
        ),
      );
      pendingScroll.current = {
        page: region.page,
        zoom: scale,
        x: (location.x + location.width / 2) * base.width,
        y: (location.y + location.height / 2) * base.height,
      };
      fitRef.current = false;
      setAnnotations(true);
      setPage(region.page);
      setZoom(scale);
      setPageSize({
        width: base.width,
        height: base.height,
        rotation: pdfPage.rotate,
      });
      renderedFocus.current = focusRequest.sequence;
    });
    return () => {
      cancelled = true;
    };
  }, [focusRequest, document, allFindings, container, fit]);

  const changeZoom = (next: number) => {
    fitRef.current = false;
    const bounded = Math.max(0.08, Math.min(3, next));
    const host = viewport.current;
    const centerX = host
      ? (host.scrollLeft +
          container.width / 2 -
          Math.max(36, (container.width - pageSize.width * zoom) / 2)) /
        zoom
      : pageSize.width / 2;
    const centerY = host
      ? (host.scrollTop +
          container.height / 2 -
          Math.max(36, (container.height - pageSize.height * zoom) / 2)) /
        zoom
      : pageSize.height / 2;
    pendingScroll.current = { page, zoom: bounded, x: centerX, y: centerY };
    setZoom(bounded);
  };
  const fitPage = () => {
    pendingScroll.current = null;
    fitRef.current = true;
    setZoom(fit);
    viewport.current?.scrollTo(0, 0);
  };
  const changePage = (number: number) => {
    pendingScroll.current = null;
    setPage(number);
    setError("");
    fitRef.current = true;
    setZoom(fit);
    viewport.current?.scrollTo(0, 0);
  };
  const pageMarkers = findings.flatMap((finding) =>
    finding.evidence
      .filter(
        (e) =>
          e.region?.page === page && (e.status === "verified" || finding.ai),
      )
      .map((evidence, index) => ({
        finding,
        region: rotatedRegion(evidence.region!, pageSize.rotation),
        index,
      })),
  );
  const preview =
    previewRegion?.page === page
      ? rotatedRegion(previewRegion, pageSize.rotation)
      : undefined;

  return (
    <section className="drawing-viewer" aria-label="PDF drawing viewer">
      <div className="viewer-toolbar">
        <div className="toolbar-group">
          <span className="tool-active">
            <Hand size={16} /> <span>Pan</span>
          </span>
          <span className="toolbar-divider" />
          <button aria-label="Zoom out" onClick={() => changeZoom(zoom / 1.2)}>
            <Minus size={16} />
          </button>
          <span className="zoom-value" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <button aria-label="Zoom in" onClick={() => changeZoom(zoom * 1.2)}>
            <Plus size={16} />
          </button>
          <button onClick={fitPage} aria-label="Fit drawing to view">
            <Maximize size={15} />
            <span>Fit</span>
          </button>
        </div>
        <div className="toolbar-group">
          <button
            aria-label={annotations ? "Hide annotations" : "Show annotations"}
            onClick={() => setAnnotations(!annotations)}
          >
            {annotations ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          <span className="toolbar-divider" />
          <button
            aria-label="Previous page"
            disabled={page === 1 || !document}
            onClick={() => changePage(page - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <label className="page-picker">
            <span className="sr-only">Drawing page</span>
            <select
              value={page}
              onChange={(e) => changePage(Number(e.target.value))}
              disabled={!document}
            >
              {Array.from({ length: document?.numPages ?? 1 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
            <span>/ {document?.numPages ?? "–"}</span>
          </label>
          <button
            aria-label="Next page"
            disabled={!document || page === document.numPages}
            onClick={() => changePage(page + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div
        ref={viewport}
        className="drawing-viewport"
        data-testid="drawing-viewport"
        onPointerDown={(e) => {
          if (e.button !== 0 || (e.target as HTMLElement).closest("button"))
            return;
          pan.current = {
            x: e.clientX,
            y: e.clientY,
            left: e.currentTarget.scrollLeft,
            top: e.currentTarget.scrollTop,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (pan.current) {
            e.currentTarget.scrollLeft =
              pan.current.left - (e.clientX - pan.current.x);
            e.currentTarget.scrollTop =
              pan.current.top - (e.clientY - pan.current.y);
          }
        }}
        onPointerUp={() => {
          pan.current = null;
        }}
        onPointerCancel={() => {
          pan.current = null;
        }}
      >
        {error ? (
          <div className="viewer-message" role="alert">
            <FileWarning size={30} />
            <strong>Unable to display drawing</strong>
            <p>{error}</p>
          </div>
        ) : (
          <div
            className="drawing-stage"
            style={{
              width: Math.max(container.width, pageSize.width * zoom + 72),
              height: Math.max(container.height, pageSize.height * zoom + 72),
            }}
          >
            <div
              className="pdf-paper"
              style={{
                width: pageSize.width * zoom,
                height: pageSize.height * zoom,
                left: Math.max(
                  36,
                  (container.width - pageSize.width * zoom) / 2,
                ),
                top: Math.max(
                  36,
                  (container.height - pageSize.height * zoom) / 2,
                ),
              }}
            >
              <div ref={canvasHost} className="pdf-canvas" />
              {annotations && !rendering && preview && (
                <div
                  className="source-preview"
                  aria-label="Suggested source preview; verify before confirming"
                  style={{
                    left: `${preview.x * 100}%`,
                    top: `${preview.y * 100}%`,
                    width: `${preview.width * 100}%`,
                    height: `${preview.height * 100}%`,
                  }}
                >
                  <span>Source preview</span>
                </div>
              )}
              {annotations &&
                !rendering &&
                pageMarkers.map(({ finding, region, index }) => (
                  <button
                    key={`${finding.id}-${index}`}
                    className={`drawing-marker severity-${finding.severity} ${selectedId === finding.id ? "is-selected" : ""} ${finding.status !== "open" ? "is-reviewed" : ""}`}
                    style={{
                      left: `${region.x * 100}%`,
                      top: `${region.y * 100}%`,
                      width: `${region.width * 100}%`,
                      height: `${region.height * 100}%`,
                    }}
                    onClick={() => onSelect(finding.id)}
                    title={`${finding.ai ? "AI-suggested location · " : ""}${finding.severity} priority · ${finding.status}: ${finding.title}`}
                    aria-label={`Issue ${allFindings.findIndex((f) => f.id === finding.id) + 1}: ${finding.title}, ${finding.severity} priority, ${finding.status}${finding.ai ? ", AI-suggested location" : ""}`}
                    aria-pressed={selectedId === finding.id}
                  >
                    <span>
                      <TriangleAlert size={12} aria-hidden="true" />
                      {allFindings.findIndex((f) => f.id === finding.id) + 1}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}
        {rendering && !error && (
          <div className="rendering-indicator" role="status">
            <LoaderCircle size={16} className="spin" /> Rendering drawing
          </div>
        )}
      </div>
      <div className="viewer-footer">
        <span>
          <Scan size={13} />{" "}
          {annotations
            ? `${pageMarkers.length} located findings · AI markers need review`
            : "Annotations hidden"}
        </span>
        <span>
          Drag to pan <span className="footer-dot">·</span> Use + / − to zoom
        </span>
      </div>
    </section>
  );
}
