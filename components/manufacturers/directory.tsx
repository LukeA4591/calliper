"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
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

function options(values: string[]) {
  const unique = new Map<string, string>();
  values
    .filter(Boolean)
    .forEach((value) => unique.set(normalizeDirectoryText(value), value));
  return [...unique].sort((a, b) => a[1].localeCompare(b[1]));
}
export function ManufacturersDirectory({
  manufacturers,
}: {
  manufacturers: DirectoryManufacturer[];
}) {
  const [filters, setFilters] = useState(emptyDirectoryFilters);
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
      manufacturers.filter((profile) =>
        matchesDirectoryFilters(profile, filters),
      ),
    [manufacturers, filters],
  );
  const active = Object.values(filters).some(Boolean);
  return (
    <>
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
        <div className="directory-filter-grid">
          <label>
            Manufacturing process
            <select
              value={filters.process}
              onChange={(event) =>
                setFilters({ ...filters, process: event.target.value })
              }
            >
              <option value="">All processes</option>
              {choices.process.map((value) => (
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
        {matches.map((profile) => (
          <article className="directory-card" key={profile.user_id}>
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
            {manufacturers.length
              ? "Try a broader search or clear your filters to see all published profiles."
              : "Manufacturers will appear here when they publish their business profiles."}
          </p>
          {active && (
            <Button
              variant="outline"
              onClick={() => setFilters(emptyDirectoryFilters)}
            >
              Reset filters
            </Button>
          )}
        </section>
      )}
    </>
  );
}
