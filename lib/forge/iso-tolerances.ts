/** ISO 2768-1:1989 Table 1, linear dimensions excluding external radii/chamfer heights.
 * Table reference: https://www.csl-imt.ch/en/knowledge/iso-2768-tolerance-tables/
 * Explicit tolerances override general tolerances. Values are bilateral magnitudes in mm.
 */
const bands = [
  { max: 3, f: 0.05, m: 0.1 },
  { max: 6, f: 0.05, m: 0.1 },
  { max: 30, f: 0.1, m: 0.2 },
  { max: 120, f: 0.15, m: 0.3 },
  { max: 400, f: 0.2, m: 0.5 },
  { max: 1000, f: 0.3, m: 0.8 },
  { max: 2000, f: 0.5, m: 1.2 },
  { max: 4000, f: null, m: 2 },
] as const;
export function isoLinearTolerance(nominalMm: number) {
  if (!Number.isFinite(nominalMm) || nominalMm < 0.5) return null;
  const index = bands.findIndex((b) => nominalMm <= b.max);
  if (index < 0) return null;
  return { ...bands[index], min: index ? bands[index - 1].max : 0.5 };
}
export function classifyTolerance(
  nominal: number | null,
  tolerance: number | null,
  unit: string,
  kind: string,
) {
  if (
    nominal === null ||
    tolerance === null ||
    nominal <= 0 ||
    tolerance <= 0 ||
    !["mm", "in"].includes(unit) ||
    kind !== "linear_symmetric"
  )
    return null;
  const factor = unit === "in" ? 25.4 : 1;
  const nominalMm = Number((nominal * factor).toPrecision(12));
  const toleranceMm = Number((tolerance * factor).toPrecision(12));
  const band = isoLinearTolerance(nominalMm);
  if (!band || band.f === null) return null;
  return {
    nominalMm,
    toleranceMm,
    fineMm: band.f,
    mediumMm: band.m,
    // Check fine FIRST: a tighter-than-fine value is also numerically within medium.
    outcome: toleranceMm < band.f ? ("tight" as const) : ("pass" as const),
    summary:
      toleranceMm < band.f
        ? `±${toleranceMm} mm is tighter than ISO 2768-f ±${band.f} mm for ${nominalMm} mm. Review the functional need and manufacturing difficulty.`
        : toleranceMm <= band.m
          ? `Pass: ±${toleranceMm} mm is within ISO 2768-m ±${band.m} mm and not tighter than ISO 2768-f ±${band.f} mm for ${nominalMm} mm.`
          : `No tight-tolerance concern: explicit ±${toleranceMm} mm is looser than ISO 2768-m ±${band.m} mm for ${nominalMm} mm. The explicit drawing value takes precedence.`,
  };
}
