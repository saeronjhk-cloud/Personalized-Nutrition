export const ENGINE_VERSION = "1.0.0";

export type BiomarkerInput = Record<string, number>;

export interface Range {
  id: string;
  biomarker_key: string;
  range_min: number;
  range_max: number;
  level: string;
  label_ko: string | null;
  functional_needs: string[] | null;
  tone: string | null;
  force_medical_referral: boolean;
  sex_specific: string | null;
  sort_order: number;
}

export interface CategoryResult {
  biomarker_key: string;
  value: number;
  level: string;
  label_ko: string | null;
  functional_needs: string[];
  tone: string | null;
  force_medical_referral: boolean;
  matched_range_id: string | null;
}

function isValidNumber(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

function findMatchingRange(ranges: Range[], biomarkerKey: string, value: number): Range | undefined {
  return ranges.find(
    (range) =>
      range.biomarker_key === biomarkerKey &&
      range.range_min <= value &&
      value < range.range_max,
  );
}

export function runEngine(input: BiomarkerInput, ranges: Range[]): CategoryResult[] {
  const results: CategoryResult[] = [];

  for (const [biomarkerKey, rawValue] of Object.entries(input)) {
    if (rawValue === undefined || rawValue === null || Number.isNaN(rawValue)) {
      continue;
    }

    const value = Number(rawValue);
    if (!isValidNumber(value)) {
      continue;
    }

    const matched = findMatchingRange(ranges, biomarkerKey, value);

    if (matched) {
      results.push({
        biomarker_key: biomarkerKey,
        value,
        level: matched.level,
        label_ko: matched.label_ko,
        functional_needs: matched.functional_needs ?? [],
        tone: matched.tone,
        force_medical_referral: matched.force_medical_referral,
        matched_range_id: matched.id,
      });
      continue;
    }

    results.push({
      biomarker_key: biomarkerKey,
      value,
      level: "unknown",
      label_ko: null,
      functional_needs: [],
      tone: null,
      force_medical_referral: false,
      matched_range_id: null,
    });
  }

  return results;
}
