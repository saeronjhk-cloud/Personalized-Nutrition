import type { Range } from "./engine";

export interface CheckupHistoryRow {
  recorded_date: string;
  biomarkers: Record<string, number>;
  units?: Record<string, string>;
}

export interface HistoryPoint {
  recorded_date: string;
  biomarkers: Record<string, number>;
}

export type ChangeClass =
  | "improving"
  | "stable"
  | "watching"
  | "worsening"
  | "needs_consult";

export interface BiomarkerChange {
  biomarker_key: string;
  prev: number;
  curr: number;
  changeRate: number;
  classification: ChangeClass;
}

const LEVEL_SCORE: Record<string, number> = {
  normal: 0,
  stable: 0,
  watch: 1,
  watching: 1,
  low: 2,
  high: 2,
  unknown: 1,
};

export function normalizeHistory(
  rows: CheckupHistoryRow[],
): HistoryPoint[] {
  return rows
    .slice()
    .sort((a, b) => a.recorded_date.localeCompare(b.recorded_date))
    .map((row) => ({
      recorded_date: row.recorded_date,
      biomarkers: { ...row.biomarkers },
    }));
}

export function getChangeRate(prev: number, curr: number): number {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function findMatchingRange(
  ranges: Range[],
  biomarkerKey: string,
  value: number,
): Range | undefined {
  return ranges.find(
    (range) =>
      range.biomarker_key === biomarkerKey &&
      range.range_min <= value &&
      value < range.range_max,
  );
}

function levelForValue(
  biomarkerKey: string,
  value: number,
  ranges: Range[],
): string {
  return findMatchingRange(ranges, biomarkerKey, value)?.level ?? "unknown";
}

export function classifyChange(
  biomarkerKey: string,
  prev: number,
  curr: number,
  ranges: Range[],
): ChangeClass {
  const currRange = findMatchingRange(ranges, biomarkerKey, curr);
  if (currRange?.force_medical_referral) return "needs_consult";

  const prevLevel = levelForValue(biomarkerKey, prev, ranges);
  const currLevel = levelForValue(biomarkerKey, curr, ranges);

  if (prevLevel === "normal" && currLevel === "normal") return "stable";
  if (currLevel === "watch") return "watching";

  const prevScore = LEVEL_SCORE[prevLevel] ?? 1;
  const currScore = LEVEL_SCORE[currLevel] ?? 1;

  if (currScore < prevScore) return "improving";
  if (currScore > prevScore) return "worsening";
  return "stable";
}

export function getTopChanges(
  history: HistoryPoint[],
  ranges: Range[],
  n = 5,
): BiomarkerChange[] {
  if (history.length < 2) return [];

  const prev = history[history.length - 2];
  const curr = history[history.length - 1];
  const keys = new Set([
    ...Object.keys(prev.biomarkers),
    ...Object.keys(curr.biomarkers),
  ]);

  const changes: BiomarkerChange[] = [];
  for (const biomarkerKey of keys) {
    const prevVal = prev.biomarkers[biomarkerKey];
    const currVal = curr.biomarkers[biomarkerKey];
    if (typeof prevVal !== "number" || typeof currVal !== "number") continue;

    changes.push({
      biomarker_key: biomarkerKey,
      prev: prevVal,
      curr: currVal,
      changeRate: getChangeRate(prevVal, currVal),
      classification: classifyChange(biomarkerKey, prevVal, currVal, ranges),
    });
  }

  return changes
    .sort((a, b) => Math.abs(b.changeRate) - Math.abs(a.changeRate))
    .slice(0, n);
}

export function getBiomarkerSeries(
  history: HistoryPoint[],
  biomarkerKey: string,
): { recorded_date: string; value: number }[] {
  return history
    .filter((point) => typeof point.biomarkers[biomarkerKey] === "number")
    .map((point) => ({
      recorded_date: point.recorded_date,
      value: point.biomarkers[biomarkerKey],
    }));
}

export function getNormalRangeBand(
  biomarkerKey: string,
  ranges: Range[],
): { min: number; max: number } | null {
  const normal = ranges.find(
    (range) => range.biomarker_key === biomarkerKey && range.level === "normal",
  );
  if (!normal) return null;
  return { min: normal.range_min, max: normal.range_max };
}

export function aggregateTopFunctionalNeeds(
  results: { functional_needs: string[] }[],
  limit = 3,
): string[] {
  const counts = new Map<string, number>();
  for (const result of results) {
    for (const need of result.functional_needs) {
      counts.set(need, (counts.get(need) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([need]) => need);
}

export function pickExampleWorseningBiomarker(
  results: { biomarker_key: string; level: string }[],
): string | null {
  const priority = ["high", "low", "watch", "unknown", "normal"];
  const sorted = results
    .slice()
    .sort(
      (a, b) => priority.indexOf(a.level) - priority.indexOf(b.level),
    );
  return sorted[0]?.biomarker_key ?? null;
}

export const CHANGE_COLORS: Record<ChangeClass, string> = {
  improving: "#10b981",
  stable: "#6b7280",
  watching: "#f59e0b",
  worsening: "#ef4444",
  needs_consult: "#dc2626",
};
