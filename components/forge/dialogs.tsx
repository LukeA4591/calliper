"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Box, FileText, LoaderCircle, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { validatePdf, validateStep } from "@/lib/forge/pdf";
import { defaultProfile } from "@/lib/forge/rules";
import {
  profileSchema,
  type Analysis,
  type ProcessProfile,
} from "@/lib/forge/types";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      className="forge-dialog"
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button onClick={onClose} aria-label="Close dialog">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function NewAnalysisDialog({
  onClose,
  onCreate,
  onDemo,
}: {
  onClose: () => void;
  onCreate: (analysis: Analysis, pdf: File, step?: File) => Promise<void>;
  onDemo: () => void;
}) {
  const [file, setFile] = useState<File>();
  const [step, setStep] = useState<File>();
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [dragging, setDragging] = useState(false);
  const busy = !!progress;
  return (
    <Modal
      title="New drawing analysis"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="analysis-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          if (!file) {
            setError("Choose a PDF drawing to continue.");
            return;
          }
          const fields = new FormData(e.currentTarget);
          try {
            setProgress("Checking PDF and reading pages…");
            const pages = await validatePdf(file);
            if (step) await validateStep(step);
            const id = crypto.randomUUID();
            const analysis: Analysis = {
              id,
              projectName:
                String(fields.get("name") || file.name.replace(/\.pdf$/i, ""))
                  .trim()
                  .slice(0, 120) || "Untitled drawing",
              revision:
                String(fields.get("revision") || "A")
                  .trim()
                  .slice(0, 20) || "A",
              createdAt: new Date().toISOString(),
              process: "cnc_milling_3_axis",
              material: String(fields.get("material")),
              units: fields.get("units") === "in" ? "in" : "mm",
              filename: file.name.replace(/[\x00-\x1f/\\]/g, "_").slice(0, 200),
              pdfFileId: id,
              pdfDigest: Array.from(
                new Uint8Array(
                  await crypto.subtle.digest(
                    "SHA-256",
                    await file.arrayBuffer(),
                  ),
                ),
              )
                .map((b) => b.toString(16).padStart(2, "0"))
                .join(""),
              stepFilename: step?.name
                .replace(/[\x00-\x1f/\\]/g, "_")
                .slice(0, 200),
              mode: "uploaded",
              profile: defaultProfile,
              pages,
              findings: [],
            };
            setProgress("Saving analysis to your account…");
            await onCreate(analysis, file, step);
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "The drawing could not be opened.",
            );
          } finally {
            setProgress("");
          }
        }}
      >
        <p className="dialog-intro">
          Bring a drawing into your review workspace.
        </p>
        <label
          className={`upload-zone ${dragging ? "is-dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!busy) setFile(e.dataTransfer.files[0]);
          }}
        >
          <input
            type="file"
            accept="application/pdf,.pdf"
            aria-label="PDF drawing"
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0])}
          />
          {file ? <FileText size={30} /> : <UploadCloud size={30} />}
          <strong>{file?.name || "Drop your drawing here"}</strong>
          <span>
            {file
              ? `${(file.size / 1024 / 1024).toFixed(2)} MB · click to replace`
              : "or click to browse · PDF, up to 25 MB"}
          </span>
        </label>
        <div className="form-grid">
          <label>
            Project name
            <input
              name="name"
              placeholder="e.g. Pump mounting bracket"
              maxLength={120}
              disabled={busy}
            />
          </label>
          <label>
            Revision
            <input
              name="revision"
              defaultValue="A"
              maxLength={20}
              disabled={busy}
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Material
            <select name="material" disabled={busy}>
              <option>Aluminium 6061-T6</option>
              <option>Aluminium 7075-T6</option>
              <option>Stainless steel 304</option>
              <option>Mild steel</option>
              <option>Acetal (POM)</option>
              <option>Unconfirmed</option>
            </select>
          </label>
          <label>
            Drawing units
            <select name="units" disabled={busy}>
              <option value="mm">Millimetres (mm)</option>
              <option value="in">Inches (in)</option>
            </select>
          </label>
        </div>
        <div className="process-readonly">
          <span>Manufacturing process</span>
          <strong>3-axis CNC milling</strong>
        </div>
        <label className="step-input">
          <Box size={18} />
          <span>
            <strong>
              STEP model <small>optional</small>
            </strong>
            <span>
              Stored as an attachment. 3D analysis is not available yet.
            </span>
          </span>
          <input
            type="file"
            accept=".step,.stp"
            disabled={busy}
            aria-label="Optional STEP model"
            onChange={(e) => setStep(e.target.files?.[0])}
          />
        </label>
        <div className="local-note">
          Your files are saved in this browser. After upload, choose pages for
          AI extraction and confirm their measurements before findings are
          created.
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {busy && (
          <p role="status" className="form-progress">
            <LoaderCircle size={16} className="spin" />
            {progress}
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={onDemo}
          >
            Use sample drawing
          </button>
          <Button type="submit" disabled={busy}>
            {busy ? "Opening…" : "Open drawing"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function SettingsDialog({
  analysis,
  onClose,
  onSave,
}: {
  analysis: Analysis;
  onClose: () => void;
  onSave: (profile: ProcessProfile, material: string) => void;
}) {
  const [error, setError] = useState("");
  return (
    <Modal title="Process & tooling profile" onClose={onClose}>
      <form
        className="analysis-form"
        onSubmit={(e) => {
          e.preventDefault();
          const fields = new FormData(e.currentTarget);
          const parsed = profileSchema.safeParse({
            ...analysis.profile,
            version: `demo-custom-${Date.now()}`,
            pocketRatio: Number(fields.get("pocketRatio")),
            holeRatio: Number(fields.get("holeRatio")),
            minimumCutterDiameter: Number(fields.get("minimumCutterDiameter")),
            tightTolerance: Number(fields.get("tightTolerance")),
          });
          if (!parsed.success) {
            setError(parsed.error.issues[0].message);
            return;
          }
          onSave(parsed.data, String(fields.get("material")).trim());
        }}
      >
        <p className="dialog-intro">
          3-axis CNC milling · configurable screening assumptions
        </p>
        <label>
          Material
          <input
            name="material"
            defaultValue={analysis.material}
            required
            maxLength={100}
          />
        </label>
        <div className="form-grid">
          <label>
            Pocket depth / width threshold
            <input
              type="number"
              name="pocketRatio"
              defaultValue={analysis.profile.pocketRatio}
              min="1"
              max="20"
              step="0.1"
              required
            />
          </label>
          <label>
            Hole depth / diameter threshold
            <input
              type="number"
              name="holeRatio"
              defaultValue={analysis.profile.holeRatio}
              min="1"
              max="30"
              step="0.1"
              required
            />
          </label>
          <label>
            Smallest end mill (mm)
            <input
              type="number"
              name="minimumCutterDiameter"
              defaultValue={analysis.profile.minimumCutterDiameter}
              min="0.1"
              max="50"
              step="0.1"
              required
            />
          </label>
          <label>
            Tolerance threshold ± (mm)
            <input
              type="number"
              name="tightTolerance"
              defaultValue={analysis.profile.tightTolerance}
              min="0.001"
              max="1"
              step="0.001"
              required
            />
          </label>
        </div>
        <div className="local-note">
          {analysis.profile.provenance} Values are in mm, independent of
          displayed drawing units. Saving reruns confirmed-input checks and
          resets their review status. Uploaded drawings require confirmed
          measurements before rules can run.
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="text-button" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit">Save profile</Button>
        </div>
      </form>
    </Modal>
  );
}
