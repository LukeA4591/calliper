"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Factory,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  companyInitials,
  directoryMaterials,
  directoryProcesses,
  emptyDirectoryFilters,
  matchesDirectoryFilters,
  normalizeDirectoryText,
  processLabel,
  type DirectoryManufacturer,
} from "@/lib/manufacturing/directory";
import {
  capabilityLabel,
  compareCapabilityMatches,
  confirmationNotes,
  matchCapabilities,
  matchMaterial,
  materialLabel,
  type ProjectContext,
} from "@/lib/manufacturing/recommendations";
import { processes as allProcesses } from "@/lib/manufacturing/schemas";

function options(values: string[]) {
  const unique = new Map<string, string>();
  values
    .filter(Boolean)
    .forEach((value) => unique.set(normalizeDirectoryText(value), value));
  return [...unique].sort((a, b) => a[1].localeCompare(b[1]));
}
export function ManufacturersDirectory({
  manufacturers,
  recommended = [],
  context = null,
}: {
  manufacturers: DirectoryManufacturer[];
  recommended?: string[];
  context?: ProjectContext | null;
}) {
  const [filters, setFilters] = useState({
    ...emptyDirectoryFilters,
    processes: recommended,
  });
  const requiredMaterialValue = context?.material ?? null;
  const choices = useMemo(
    () => ({
      process: [...new Set(manufacturers.flatMap(directoryProcesses))].sort(
        (a, b) => processLabel(a).localeCompare(processLabel(b)),
      ),
      material: options(manufacturers.flatMap(directoryMaterials)),
      machinery: options(
        manufacturers.flatMap((profile) =>
          profile.machines.map((machine) => machine.name),
        ),
      ),
      location: options(manufacturers.map((profile) => profile.location)),
    }),
    [manufacturers],
  );
  const matches = useMemo(
    () =>
      manufacturers
        .filter((profile) => matchesDirectoryFilters(profile, filters))
        .map((profile) => ({
          profile,
          match: matchCapabilities(profile, filters.processes),
          material: matchMaterial(profile, requiredMaterialValue),
        }))
        .sort(compareCapabilityMatches),
    [manufacturers, filters, requiredMaterialValue],
  );
  const active =
    filters.processes.length > 0 ||
    [filters.query, filters.material, filters.machinery, filters.location].some(
      Boolean,
    );
  const unselected = allProcesses.filter(
    (value) => !filters.processes.includes(value),
  );
  function removeProcess(value: string) {
    setFilters({
      ...filters,
      processes: filters.processes.filter((item) => item !== value),
    });
  }
  return (
    <>
      {context && (
        <section className="directory-context" aria-label="Project context">
          <div>
            <p className="directory-eyebrow">FINDING MANUFACTURERS FOR</p>
            <h2>
              {context.name} <span>Rev {context.revision}</span>
            </h2>
            <p className="directory-context-detail">
              {recommended.length
                ? `Recommended processes: ${recommended.map(processLabel).join(" · ")}`
                : "This project has no recommended processes yet. Browse every manufacturer below."}
            </p>
            <p className="directory-context-detail">
              {context.material
                ? `Material required: ${context.material} (${
                    context.materialSource === "drawing"
                      ? "stated on the drawing"
                      : "from project settings"
                  }). `
                : "No material specified on the drawing or in the project. "}
              {context.toleranceMm !== null
                ? `Tightest reviewed tolerance: ±${context.toleranceMm} mm. `
                : ""}
              Capabilities are declared by each business and need confirmation.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/?project=${encodeURIComponent(context.id)}`}>
              <ArrowLeft size={15} aria-hidden="true" />
              Back to project
            </Link>
          </Button>
        </section>
      )}
      <section className="directory-filters" aria-label="Filter manufacturers">
        <label className="directory-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search manufacturers</span>
          <input
            type="search"
            placeholder="Search companies, processes, machines or materials"
            value={filters.query}
            onChange={(event) =>
              setFilters({ ...filters, query: event.target.value })
            }
          />
        </label>
        {filters.processes.length > 0 && (
          <div className="directory-process-filters">
            <span>Manufacturing processes</span>
            <ul>
              {filters.processes.map((value) => (
                <li key={value}>
                  {processLabel(value)}
                  <button
                    onClick={() => removeProcess(value)}
                    aria-label={`Remove ${processLabel(value)} filter`}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            <small>
              Businesses offering any of these appear, closest match first.
            </small>
          </div>
        )}
        <div className="directory-filter-grid">
          <label>
            Add a manufacturing process
            <select
              value=""
              onChange={(event) =>
                event.target.value &&
                setFilters({
                  ...filters,
                  processes: [...filters.processes, event.target.value],
                })
              }
            >
              <option value="">
                {filters.processes.length ? "Add another process" : "Any process"}
              </option>
              {unselected.map((value) => (
                <option key={value} value={value}>
                  {processLabel(value)}
                </option>
              ))}
            </select>
          </label>
          {(
            [
              ["material", "Supported material"],
              ["machinery", "Available machinery"],
              ["location", "Location"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <select
                value={filters[key]}
                onChange={(event) =>
                  setFilters({ ...filters, [key]: event.target.value })
                }
              >
                <option value="">
                  {key === "material"
                    ? "All materials"
                    : key === "machinery"
                      ? "All machinery"
                      : "All locations"}
                </option>
                {choices[key].map(([value, name]) => (
                  <option value={value} key={value}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="directory-filter-footer">
          <span>
            <SlidersHorizontal size={14} aria-hidden="true" />
            Combine filters to narrow your search.
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={!active}
            onClick={() => setFilters(emptyDirectoryFilters)}
          >
            <X size={14} aria-hidden="true" />
            Clear filters
          </Button>
        </div>
      </section>
      <div className="directory-results-heading">
        <p role="status" aria-live="polite">
          <strong>{matches.length}</strong>{" "}
          {matches.length === 1 ? "manufacturer" : "manufacturers"}
          {active
            ? ` matching your filters · ${manufacturers.length} total`
            : " to explore"}
        </p>
        <span>Published business profiles</span>
      </div>
      <div className="directory-grid" aria-label="Manufacturer results">
        {matches.map(({ profile, match, material }) => (
          <article className="directory-card" key={profile.user_id}>
            {filters.processes.length > 0 && (
              <p
                className={`capability-match capability-${match.status}`}
                title={
                  match.missing.length
                    ? `Not declared: ${match.missing.map(processLabel).join(", ")}`
                    : undefined
                }
              >
                {capabilityLabel(match)}
              </p>
            )}
            {material.status !== "not_required" && (
              <p className={`capability-match capability-material-${material.status}`}>
                {materialLabel(material)}
              </p>
            )}
            <div className="directory-company-heading">
              <div className="company-avatar" aria-hidden="true">
                {companyInitials(profile.business_name)}
              </div>
              <div>
                <h2>
                  <Link href={`/manufacturers/${profile.user_id}`}>
                    {profile.business_name}
                  </Link>
                </h2>
                <p>
                  <MapPin size={13} aria-hidden="true" />
                  {profile.location || "Location not provided"}
                </p>
              </div>
            </div>
            <p className="directory-description">
              {profile.description ||
                "Explore this manufacturer’s capabilities and contact them to discuss your project."}
            </p>
            <div className="directory-card-section">
              <h3>Capabilities</h3>
              <div className="capability-tags">
                {directoryProcesses(profile)
                  .slice(0, 4)
                  .map((value) => (
                    <span key={value}>{processLabel(value)}</span>
                  ))}
                {directoryProcesses(profile).length > 4 && (
                  <span>+{directoryProcesses(profile).length - 4} more</span>
                )}
                {!directoryProcesses(profile).length && <p>Not specified</p>}
              </div>
            </div>
            <div className="directory-card-section">
              <h3>Materials</h3>
              <p>
                {directoryMaterials(profile).slice(0, 4).join(" · ") ||
                  "Not specified"}
                {directoryMaterials(profile).length > 4 &&
                  ` · +${directoryMaterials(profile).length - 4} more`}
              </p>
            </div>
            <div className="directory-card-section">
              <h3>
                <Factory size={13} aria-hidden="true" />
                Equipment <span>{profile.machines.length}</span>
              </h3>
              <p>
                {profile.machines
                  .slice(0, 2)
                  .map((machine) => machine.name)
                  .join(" · ") || "No machines listed"}
                {profile.machines.length > 2 &&
                  ` · +${profile.machines.length - 2} more`}
              </p>
            </div>
            {context && (
              <div className="directory-card-section">
                <h3>Needs confirmation</h3>
                <ul className="capability-confirm">
                  {confirmationNotes(profile, {
                    toleranceMm: context.toleranceMm,
                  }).map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
            <Button asChild variant="outline" className="directory-view">
              <Link
                href={`/manufacturers/${profile.user_id}`}
                aria-label={`View ${profile.business_name} profile`}
              >
                View profile
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </Button>
          </article>
        ))}
      </div>
      {!matches.length && (
        <section className="directory-empty">
          <Factory size={32} aria-hidden="true" />
          <h2>
            {manufacturers.length
              ? "No manufacturers match yet"
              : "The directory is getting started"}
          </h2>
          <p>
            {!manufacturers.length
              ? "Manufacturers will appear here when they publish their business profiles."
              : filters.processes.length
                ? "No published business declares these manufacturing processes. Remove a process to broaden the search, or browse every manufacturer."
                : "Try a broader search or clear your filters to see all published profiles."}
          </p>
          {active && (
            <Button
              variant="outline"
              onClick={() => setFilters(emptyDirectoryFilters)}
            >
              Show all manufacturers
            </Button>
          )}
        </section>
      )}
    </>
  );
}
