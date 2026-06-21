import { supabase } from "./supabase";

export interface BiomarkerRule {
  biomarker_key: string;
  display_name_ko: string;
  unit: string;
  category_group: string;
  inverted: boolean;
  note: string | null;
}

export interface UserProfile {
  id: string;
  sex: string | null;
  birth_year: number | null;
}

const BIOMARKER_COLUMNS =
  "biomarker_key, display_name_ko, unit, category_group, inverted, note";

export async function fetchBiomarkerRules(): Promise<{
  data: BiomarkerRule[] | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("biomarker_rules")
    .select(BIOMARKER_COLUMNS)
    .order("category_group", { ascending: true })
    .order("biomarker_key", { ascending: true });

  if (error) {
    console.error("[checkup_api] fetchBiomarkerRules failed:", error.message);
    return { data: null, error: error.message };
  }

  return { data: (data ?? []) as BiomarkerRule[], error: null };
}

export async function fetchMyProfile(): Promise<{
  isLoggedIn: boolean;
  userId: string | null;
  profile: UserProfile | null;
  error: string | null;
}> {
  const loggedOut = {
    isLoggedIn: false,
    userId: null as string | null,
    profile: null as UserProfile | null,
    error: null as string | null,
  };

  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      const msg = sessionError.message ?? "";
      if (/session missing|AuthSessionMissing/i.test(msg)) {
        return loggedOut;
      }
      console.error("[checkup_api] getSession failed:", sessionError.message);
      return { ...loggedOut, error: sessionError.message };
    }

    if (!session?.user) {
      return loggedOut;
    }

    const userId = session.user.id;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, sex, birth_year")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("[checkup_api] fetchMyProfile failed:", error.message);
      return { isLoggedIn: true, userId, profile: null, error: error.message };
    }

    return {
      isLoggedIn: true,
      userId,
      profile: data as UserProfile | null,
      error: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/session missing|AuthSessionMissing/i.test(msg)) {
      return loggedOut;
    }
    console.error("[checkup_api] fetchMyProfile unexpected:", err);
    return loggedOut;
  }
}

export function groupBiomarkersByCategory(
  rules: BiomarkerRule[],
): [string, BiomarkerRule[]][] {
  const map = new Map<string, BiomarkerRule[]>();
  for (const rule of rules) {
    const list = map.get(rule.category_group) ?? [];
    list.push(rule);
    map.set(rule.category_group, list);
  }
  return Array.from(map.entries());
}

export interface BiomarkerRangeRow {
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

const RANGE_COLUMNS =
  "id, biomarker_key, range_min, range_max, level, label_ko, functional_needs, tone, force_medical_referral, sex_specific, sort_order";

export async function fetchRanges(sex: "M" | "F"): Promise<{
  ranges: BiomarkerRangeRow[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("biomarker_ranges")
    .select(RANGE_COLUMNS)
    .or(`sex_specific.is.null,sex_specific.eq.${sex}`)
    .order("biomarker_key", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[checkup_api] fetchRanges failed:", error.message);
    return { ranges: [], error: error.message };
  }

  return { ranges: (data ?? []) as BiomarkerRangeRow[], error: null };
}

export async function saveCheckup(params: {
  user_id: string;
  sex: "M" | "F";
  birth_year: number;
  recorded_date: string;
  biomarker_input: { [key: string]: number };
  rules_by_key: { [key: string]: { unit: string } };
}): Promise<{
  record_id: string | null;
  values_count: number;
  error: string | null;
}> {
  const { user_id, sex, birth_year, recorded_date, biomarker_input, rules_by_key } = params;

  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: user_id, sex, birth_year }, { onConflict: "id" })
    .select();

  if (profileError) {
    console.error("[checkup_api] saveCheckup profiles upsert failed:", profileError.message);
    return { record_id: null, values_count: 0, error: profileError.message };
  }
  if (!profileRows || profileRows.length === 0) {
    const msg = "profiles upsert returned no rows";
    console.error("[checkup_api] saveCheckup:", msg);
    return { record_id: null, values_count: 0, error: msg };
  }

  const { data: record, error: recordError } = await supabase
    .from("checkup_records")
    .insert({ user_id, recorded_date, source: "manual" })
    .select()
    .single();

  if (recordError) {
    console.error("[checkup_api] saveCheckup checkup_records insert failed:", recordError.message);
    return { record_id: null, values_count: 0, error: recordError.message };
  }
  if (!record?.id) {
    const msg = "checkup_records insert returned no id";
    console.error("[checkup_api] saveCheckup:", msg);
    return { record_id: null, values_count: 0, error: msg };
  }

  const valuesRows = Object.entries(biomarker_input)
    .filter(([, value]) => typeof value === "number" && !Number.isNaN(value))
    .map(([key, value]) => ({
      checkup_record_id: record.id,
      biomarker_key: key,
      value,
      unit: rules_by_key[key]?.unit ?? "",
    }));

  if (valuesRows.length === 0) {
    const msg = "저장할 biomarker 값이 없습니다";
    console.error("[checkup_api] saveCheckup:", msg);
    return { record_id: record.id, values_count: 0, error: msg };
  }

  const { data, error: valuesError } = await supabase
    .from("biomarker_values")
    .insert(valuesRows)
    .select();

  if (valuesError) {
    console.error("[checkup_api] saveCheckup biomarker_values insert failed:", valuesError.message);
    return { record_id: record.id, values_count: 0, error: valuesError.message };
  }

  if (!data || data.length !== valuesRows.length) {
    const msg = `biomarker_values insert count mismatch: expected ${valuesRows.length}, got ${data?.length ?? 0}`;
    console.error("[checkup_api] saveCheckup:", msg);
    return { record_id: record.id, values_count: data?.length ?? 0, error: msg };
  }

  return { record_id: record.id, values_count: data.length, error: null };
}

export interface CheckupHistoryEntry {
  recorded_date: string;
  biomarkers: Record<string, number>;
  units: Record<string, string>;
}

export async function fetchCheckupHistory(userId: string): Promise<{
  history: CheckupHistoryEntry[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("checkup_records")
    .select(
      `
      id,
      recorded_date,
      biomarker_values (
        biomarker_key,
        value,
        unit
      )
    `,
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("recorded_date", { ascending: true });

  if (error) {
    console.error("[checkup_api] fetchCheckupHistory failed:", error.message);
    return { history: [], error: error.message };
  }

  const history: CheckupHistoryEntry[] = (data ?? []).map((row: {
    recorded_date: string;
    biomarker_values: { biomarker_key: string; value: number; unit: string | null }[] | null;
  }) => {
    const biomarkers: Record<string, number> = {};
    const units: Record<string, string> = {};
    for (const bv of row.biomarker_values ?? []) {
      biomarkers[bv.biomarker_key] = bv.value;
      if (bv.unit) units[bv.biomarker_key] = bv.unit;
    }
    return {
      recorded_date: row.recorded_date,
      biomarkers,
      units,
    };
  });

  return { history, error: null };
}

// =============================================================================
// C.9 — 이전 검진 수정/삭제 (Soft delete)
// 참조: D:\헬스픽\IP\prompts\supabase_anti_patterns.md (규칙 1)
//   .update()/.delete() 후 반드시 .select() 체이닝 후 반환 행 수로 성공 판정.
//   supabase-js .update()는 RLS silent fail을 error로 주지 않음(error:null, 0 rows 가능).
// 전제: checkup_records.deleted_at(timestamptz, nullable) 컬럼 적용
//       (phase_c9_soft_delete_v1.sql). RLS는 기존 checkup_own_all(FOR ALL)이 본인 행 보장.
// =============================================================================

export interface CheckupRecordSummary {
  id: string;
  recorded_date: string;
  value_count: number;
}

export async function fetchCheckupRecords(userId: string): Promise<{
  records: CheckupRecordSummary[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("checkup_records")
    .select("id, recorded_date, biomarker_values(count)")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("recorded_date", { ascending: false });

  if (error) {
    console.error("[checkup_api] fetchCheckupRecords failed:", error.message);
    return { records: [], error: error.message };
  }

  const records: CheckupRecordSummary[] = (data ?? []).map((row: {
    id: string;
    recorded_date: string;
    biomarker_values: { count: number }[] | null;
  }) => ({
    id: row.id,
    recorded_date: row.recorded_date,
    value_count: row.biomarker_values?.[0]?.count ?? 0,
  }));

  return { records, error: null };
}

export interface CheckupRecordDetail {
  id: string;
  recorded_date: string;
  values: Record<string, { value: number; unit: string }>;
}

export async function fetchCheckupRecordDetail(
  recordId: string,
  userId: string,
): Promise<{ detail: CheckupRecordDetail | null; error: string | null }> {
  const { data, error } = await supabase
    .from("checkup_records")
    .select(
      `
      id,
      recorded_date,
      biomarker_values (
        biomarker_key,
        value,
        unit
      )
    `,
    )
    .eq("id", recordId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[checkup_api] fetchCheckupRecordDetail failed:", error.message);
    return { detail: null, error: error.message };
  }
  if (!data) {
    return { detail: null, error: null };
  }

  const row = data as {
    id: string;
    recorded_date: string;
    biomarker_values: { biomarker_key: string; value: number; unit: string | null }[] | null;
  };
  const values: Record<string, { value: number; unit: string }> = {};
  for (const bv of row.biomarker_values ?? []) {
    values[bv.biomarker_key] = { value: bv.value, unit: bv.unit ?? "" };
  }
  return {
    detail: { id: row.id, recorded_date: row.recorded_date, values },
    error: null,
  };
}

export async function deleteCheckup(
  recordId: string,
  userId: string,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("checkup_records")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", recordId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    console.error("[checkup_api] deleteCheckup failed:", error.message);
    return { id: null, error: error.message };
  }
  if (!data || data.length === 0) {
    return { id: null, error: "삭제 대상이 없거나 권한이 없습니다." };
  }
  return { id: data[0].id, error: null };
}

export async function restoreCheckup(
  recordId: string,
  userId: string,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("checkup_records")
    .update({ deleted_at: null })
    .eq("id", recordId)
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .select("id");

  if (error) {
    console.error("[checkup_api] restoreCheckup failed:", error.message);
    return { id: null, error: error.message };
  }
  if (!data || data.length === 0) {
    return { id: null, error: "복구 대상이 없습니다." };
  }
  return { id: data[0].id, error: null };
}

export async function updateCheckup(params: {
  recordId: string;
  userId: string;
  recorded_date?: string;
  biomarker_input: { [key: string]: number };
  rules_by_key: { [key: string]: { unit: string } };
}): Promise<{ record_id: string | null; values_count: number; error: string | null }> {
  const { recordId, userId, recorded_date, biomarker_input, rules_by_key } = params;

  // 1) 회차 메타(날짜 등) 변경 — 변경할 값이 있을 때만.
  if (recorded_date) {
    const { data: rec, error: recError } = await supabase
      .from("checkup_records")
      .update({ recorded_date })
      .eq("id", recordId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select("id");

    if (recError) {
      console.error("[checkup_api] updateCheckup record failed:", recError.message);
      return { record_id: null, values_count: 0, error: recError.message };
    }
    if (!rec || rec.length === 0) {
      return { record_id: null, values_count: 0, error: "수정 대상이 없거나 권한이 없습니다." };
    }
  }

  // 2) biomarker 값 upsert (unique(checkup_record_id, biomarker_key) -> onConflict)
  const valuesRows = Object.entries(biomarker_input)
    .filter(([, value]) => typeof value === "number" && !Number.isNaN(value))
    .map(([key, value]) => ({
      checkup_record_id: recordId,
      biomarker_key: key,
      value,
      unit: rules_by_key[key]?.unit ?? "",
    }));

  if (valuesRows.length === 0) {
    return { record_id: recordId, values_count: 0, error: null };
  }

  const { data, error } = await supabase
    .from("biomarker_values")
    .upsert(valuesRows, { onConflict: "checkup_record_id,biomarker_key" })
    .select();

  if (error) {
    console.error("[checkup_api] updateCheckup values failed:", error.message);
    return { record_id: recordId, values_count: 0, error: error.message };
  }
  if (!data || data.length !== valuesRows.length) {
    const msg = `biomarker_values upsert count mismatch: expected ${valuesRows.length}, got ${data?.length ?? 0}`;
    console.error("[checkup_api] updateCheckup:", msg);
    return { record_id: recordId, values_count: data?.length ?? 0, error: msg };
  }

  // NOTE v1: 입력에서 빠진 항목의 값 삭제는 미지원(추가/수정만). 필요 시 v1.1.
  return { record_id: recordId, values_count: data.length, error: null };
}
