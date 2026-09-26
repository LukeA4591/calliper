"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { findManufacturers } from "@/app/actions/matches";
import {
  requirementsSchema,
  unknownRequirements,
  processes,
  processLabels,
  specialties,
  type Requirements,
} from "@/lib/manufacturing/schemas";
import type { ManufacturerMatch } from "@/lib/manufacturing/matching";
import type { Analysis } from "@/lib/forge/types";
const labels = {
  compatible: "Compatible",
  potential: "Potential match",
  incompatible: "Not compatible",
};
const keys = [
  "processes",
  "material",
  "dimensions",
  "tolerance",
  "features",
  "special",
] as const;
function Provenance({
  name,
  value,
}: {
  name: (typeof keys)[number];
  value: Requirements[(typeof keys)[number]];
}) {
  return (
    <div className="requirement-evidence">
      <label>
        Evidence source
        <select name={`${name}_source`} defaultValue={value.source}>
          <option value="unknown">Unknown</option>
          <option value="explicit">Explicit drawing requirement</option>
          <option value="inferred">Inferred — needs confirmation</option>
        </select>
      </label>
      <label>
        Supporting callout / review evidence
        <textarea
          name={`${name}_quote`}
          maxLength={1500}
          defaultValue={value.quote}
        />
      </label>
      <label>
        Page (if known)
        <input
          type="number"
          name={`${name}_page`}
          min={1}
          max={100}
          defaultValue={value.page ?? ""}
        />
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          name={`${name}_confirmed`}
          defaultChecked={value.confirmed}
        />
        I checked this requirement against the drawing
      </label>
    </div>
  );
}
export function MatchingPanel({
  analysis,
  onSave,
}: {
  analysis: Analysis;
  onSave: (analysis: Analysis) => void;
}) {
  const r =
    analysis.requirements ??
    analysis.extraction?.requirements ??
    unknownRequirements();
  const serialized = JSON.stringify({
    analysisId: analysis.id,
    requirements: r,
  });
  const enabled = !!(
    analysis.requirements || analysis.extraction?.requirements
  );
  const [result, setResult] = useState<{
    request?: string;
    matches?: ManufacturerMatch[];
    error?: string;
    loading?: boolean;
  }>({});
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    if (enabled) {
      findManufacturers(JSON.parse(serialized))
        .then((value) => {
          if (!cancelled) setResult({ ...value, request: serialized });
        })
        .catch(() => {
          if (!cancelled)
            setResult({
              error: "Could not load matches. Check your session and retry.",
              request: serialized,
            });
        });
    }
    return () => {
      cancelled = true;
    };
  }, [serialized, enabled, retry]);
  const current = result.request === serialized && !result.loading;
  const matches =
    (current ? result.matches : undefined)?.filter(
      (m) => m.status !== "incompatible",
    ) ?? [];
  const excluded =
    (current ? result.matches : undefined)?.filter(
      (m) => m.status === "incompatible",
    ) ?? [];
  return (
    <section className="matching-panel" aria-labelledby="matching-title">
      <div className="section-heading">
        <div>
          <h2 id="matching-title">Manufacturer matching</h2>
          <p>
            Requirements from the drawing, compared with declared equipment
            capabilities.
          </p>
        </div>
        {enabled && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setResult({ loading: true });
              setRetry((v) => v + 1);
            }}
          >
            Refresh matches
          </Button>
        )}
      </div>
      <details className="requirements-editor" open={!enabled}>
        <summary>
          Review manufacturing requirements ·{" "}
          {keys.filter((k) => r[k].confirmed).length} / 6 confirmed
        </summary>
        <p>
          All sizes and tolerances below are in mm. Process choices are
          alternatives for a single machine. Confirm the exact material grade
          and the overall part size; partial page coverage and inferred
          requirements remain potential matches.
        </p>
        <form
          className="account-form"
          key={serialized}
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            const f = new FormData(event.currentTarget);
            const next = structuredClone(r);
            const number = (name: string) =>
              f.get(name) === "" ? null : Number(f.get(name));
            for (const key of keys) {
              const group = next[key];
              group.source = String(
                f.get(`${key}_source`),
              ) as typeof group.source;
              group.quote = String(f.get(`${key}_quote`) ?? "").trim();
              group.page = number(`${key}_page`);
              group.confirmed = f.get(`${key}_confirmed`) === "on";
              if (
                group.confirmed &&
                (group.source === "unknown" || !group.quote)
              ) {
                setError(
                  "Confirmed requirements need a known evidence source and a supporting callout / review note.",
                );
                return;
              }
              if (group.page !== null && group.page > analysis.pages.length) {
                setError(
                  "A requirement refers to a page outside this drawing.",
                );
                return;
              }
            }
            next.processes.value = f.getAll(
              "processes",
            ) as Requirements["processes"]["value"];
            next.material.value =
              String(f.get("material") ?? "").trim() || null;
            next.dimensions.x = number("x");
            next.dimensions.y = number("y");
            next.dimensions.z = number("z");
            next.tolerance.value = number("tolerance");
            next.features.value = f.getAll(
              "features",
            ) as Requirements["features"]["value"];
            next.special.value = f.getAll(
              "special",
            ) as Requirements["special"]["value"];
            next.notes = String(f.get("notes") ?? "")
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean);
            next.coverageComplete = f.get("coverageComplete") === "on";
            const p = requirementsSchema.safeParse(next);
            if (!p.success) {
              setError(p.error.issues[0].message);
              return;
            }
            setResult({ loading: true });
            onSave({ ...analysis, requirements: p.data });
          }}
        >
          <fieldset>
            <legend>Compatible process alternatives</legend>
            <div className="check-grid">
              {processes.map((p) => (
                <label key={p}>
                  <input
                    name="processes"
                    type="checkbox"
                    value={p}
                    defaultChecked={r.processes.value.includes(p)}
                  />
                  {processLabels[p]}
                </label>
              ))}
            </div>
            <Provenance name="processes" value={r.processes} />
          </fieldset>
          <fieldset>
            <legend>Exact material / grade</legend>
            <label>
              Material
              <input
                name="material"
                maxLength={100}
                defaultValue={r.material.value ?? ""}
                placeholder="Unknown — leave blank"
              />
            </label>
            <Provenance name="material" value={r.material} />
          </fieldset>
          <fieldset>
            <legend>Overall part envelope (mm)</legend>
            <div className="account-grid">
              {(["x", "y", "z"] as const).map((axis) => (
                <label key={axis}>
                  {axis.toUpperCase()}
                  <input
                    name={axis}
                    type="number"
                    min="0.001"
                    step="any"
                    defaultValue={r.dimensions[axis] ?? ""}
                  />
                </label>
              ))}
            </div>
            <Provenance name="dimensions" value={r.dimensions} />
          </fieldset>
          <fieldset>
            <legend>Tightest required bilateral tolerance (± mm)</legend>
            <label>
              Tolerance magnitude
              <input
                name="tolerance"
                type="number"
                min="0.000001"
                step="any"
                defaultValue={r.tolerance.value ?? ""}
              />
            </label>
            <Provenance name="tolerance" value={r.tolerance} />
          </fieldset>
          {(["features", "special"] as const).map((key) => (
            <fieldset key={key}>
              <legend>
                {key === "features"
                  ? "Important geometric features"
                  : "Specialised manufacturing requirements"}
              </legend>
              <div className="check-grid">
                {specialties.map((s) => (
                  <label key={s}>
                    <input
                      type="checkbox"
                      name={key}
                      value={s}
                      defaultChecked={r[key].value.includes(s)}
                    />
                    {s.replaceAll("_", " ")}
                  </label>
                ))}
              </div>
              <Provenance name={key} value={r[key]} />
            </fieldset>
          ))}
          <label>
            Unresolved requirements / limitations (one per line)
            <textarea name="notes" defaultValue={r.notes.join("\n")} />
            <small>
              Keep unresolved notes here. They prevent a definitive compatible
              result.
            </small>
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              name="coverageComplete"
              defaultChecked={r.coverageComplete}
            />
            I reviewed all drawing pages for manufacturing requirements
          </label>
          <Button>Save requirements & match</Button>
          {error && <p role="alert">{error}</p>}
        </form>
      </details>
      {!enabled ? (
        <p className="matching-empty">
          Extract requirements from your drawing or fill in the review above to
          find manufacturers.
        </p>
      ) : (
        <>
          {!current && <p role="status">Checking capabilities…</p>}
          {current && result.error && <p role="alert">{result.error}</p>}
          {current && result.matches && !matches.length && (
            <p className="matching-empty">
              {excluded.length
                ? "No compatible or potential matches for the confirmed requirements. Review the conflicts below."
                : "No published manufacturer profiles yet. Manufacturers need to add equipment and publish their profiles."}
            </p>
          )}
          {matches.map((match) => (
            <article className="manufacturer-match" key={match.profile.user_id}>
              <div>
                <h3>
                  <Link
                    href={`/manufacturers/${match.profile.user_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {match.profile.business_name} ↗
                  </Link>
                </h3>
                <p>{match.profile.location}</p>
              </div>
              <strong className="match-status">{labels[match.status]}</strong>
              <p>
                Materials: {match.profile.materials.join(", ") || "Unspecified"}
              </p>
              {!match.machines.length && (
                <p>
                  No equipment declared; confirm capabilities with this
                  manufacturer.
                </p>
              )}
              {match.machines
                .filter((m) => m.status !== "incompatible")
                .map((machine) => (
                  <details key={machine.machineId}>
                    <summary>
                      {machine.machineName} · {labels[machine.status]}
                    </summary>
                    <ul>
                      {machine.reasons.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                    {machine.missing.length > 0 && (
                      <>
                        <h4>Needs confirmation</h4>
                        <ul>
                          {machine.missing.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </details>
                ))}
            </article>
          ))}
          {excluded.length > 0 && (
            <details>
              <summary>
                {excluded.length} manufacturers with confirmed conflicts
              </summary>
              {excluded.map((m) => (
                <div className="machine-record" key={m.profile.user_id}>
                  <h3>{m.profile.business_name} · Not compatible</h3>
                  {m.machines.map((machine) => (
                    <div key={machine.machineId}>
                      <strong>{machine.machineName}</strong>
                      <ul>
                        {machine.reasons.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
            </details>
          )}
        </>
      )}
      <p className="matching-disclaimer">
        Matches use manufacturer-declared capabilities and drawing requirements.
        Each machine is evaluated independently; no combined workflow, rotation
        or re-fixturing is assumed. Results do not guarantee manufacturability,
        pricing, availability, or willingness to accept the job.
      </p>
    </section>
  );
}
