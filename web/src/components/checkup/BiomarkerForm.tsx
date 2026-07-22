import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchBiomarkerRules,
  fetchMyProfile,
  fetchRanges,
  fetchCheckupHistory,
  groupBiomarkersByCategory,
  saveCheckup,
  type BiomarkerRule,
} from "../../lib/checkup_api";
import {
  runEngine,
  type BiomarkerInput,
  type CategoryResult,
  type Range,
} from "../../domain/checkup/engine";
import {
  normalizeHistory,
  getTopChanges,
  getBiomarkerSeries,
  getNormalRangeBand,
  aggregateTopFunctionalNeeds,
  pickExampleWorseningBiomarker,
  CHANGE_COLORS,
  type HistoryPoint,
} from "../../domain/checkup/timeseries";
import RecommendationList from "./RecommendationList";
import TimeseriesChart from "./TimeseriesChart";
import {
  extractPdfText,
  parseCheckupText,
  matchToRules,
} from "../../lib/checkupImport";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function BiomarkerForm() {
  const navigate = useNavigate();
  const [rules, setRules] = useState<BiomarkerRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);

  const [sex, setSex] = useState<"M" | "F" | "">("");
  const [birthYear, setBirthYear] = useState("");
  const [recordedDate, setRecordedDate] = useState(todayISO);
  const [values, setValues] = useState<Record<string, string>>({});
  const [results, setResults] = useState<CategoryResult[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [ranges, setRanges] = useState<Range[]>([]);
  const [showTimeseries, setShowTimeseries] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPoints, setHistoryPoints] = useState<HistoryPoint[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);

      const [rulesResult, profileResult] = await Promise.all([
        fetchBiomarkerRules(),
        fetchMyProfile(),
      ]);

      if (cancelled) return;

      if (rulesResult.error) {
        setLoadError(rulesResult.error);
        setLoading(false);
        return;
      }

      setRules(rulesResult.data ?? []);
      setIsLoggedIn(profileResult.isLoggedIn);
      setUserId(profileResult.userId);

      if (profileResult.isLoggedIn && profileResult.error) {
        setLoadError(profileResult.error);
      } else if (profileResult.isLoggedIn && !profileResult.profile) {
        setNeedsProfile(true);
      } else if (profileResult.isLoggedIn && profileResult.profile) {
        setNeedsProfile(false);
        if (profileResult.profile.sex === "M" || profileResult.profile.sex === "F") {
          setSex(profileResult.profile.sex);
        }
        if (profileResult.profile.birth_year) {
          setBirthYear(String(profileResult.profile.birth_year));
        }
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const groupedRules = useMemo(() => groupBiomarkersByCategory(rules), [rules]);

  function handleValueChange(key: string, raw: string) {
    setValues((prev) => ({ ...prev, [key]: raw }));
  }

  // 검진결과 PDF 가져오기 — 엔진 파싱(AI 없음). The건강보험/정부24 PDF 대상.
  async function handleImportPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 허용
    if (!file) return;

    setImporting(true);
    setImportMessage(null);
    setImportError(null);

    try {
      const text = await extractPdfText(file);
      if (text.replace(/\s/g, "").length < 30) {
        setImportError(
          "이 PDF에서 글자를 읽을 수 없어요 (사진 스캔본으로 보입니다). 아래에 수기로 입력해 주세요.",
        );
        return;
      }

      const parsed = parseCheckupText(text);
      const { matched, unmatchedLabels } = matchToRules(parsed, rules);
      const count = Object.keys(matched).length;

      if (count === 0) {
        setImportError(
          "검진 수치를 찾지 못했어요. 건강검진 결과통보서 PDF가 맞는지 확인하시고, 아니면 수기로 입력해 주세요.",
        );
        return;
      }

      setValues((prev) => ({ ...prev, ...matched }));
      if (parsed.date) setRecordedDate(parsed.date);

      const extra =
        unmatchedLabels.length > 0
          ? ` (인식했지만 입력 항목이 없는 값 ${unmatchedLabels.length}개는 제외)`
          : "";
      setImportMessage(
        `${count}개 항목을 불러왔어요${parsed.date ? ` · 검진일 ${parsed.date}` : ""}${extra}. 값을 확인한 뒤 '검진 결과 분석하기'를 눌러주세요.`,
      );
    } catch (err) {
      console.error("[BiomarkerForm] PDF import failed:", err);
      setImportError("PDF를 여는 데 실패했어요. 파일이 손상되지 않았는지 확인해 주세요.");
    } finally {
      setImporting(false);
    }
  }

  function buildBiomarkerInput(): BiomarkerInput {
    const input: BiomarkerInput = {};
    for (const [key, raw] of Object.entries(values)) {
      if (raw === "") continue;
      const num = Number(raw);
      if (!Number.isNaN(num)) input[key] = num;
    }
    return input;
  }

  function buildRulesByKey(): Record<string, { unit: string }> {
    const rulesByKey: Record<string, { unit: string }> = {};
    for (const rule of rules) {
      rulesByKey[rule.biomarker_key] = { unit: rule.unit };
    }
    return rulesByKey;
  }

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();

    const activeSex = sex === "M" || sex === "F" ? sex : null;
    if (!activeSex) {
      alert("성별을 선택해 주세요.");
      return;
    }

    setAnalyzing(true);
    setSaved(false);
    setSaveMessage(null);
    setSaveError(null);
    setShowTimeseries(false);

    const { ranges, error } = await fetchRanges(activeSex);
    if (error) {
      console.error("[BiomarkerForm] fetchRanges failed:", error);
      alert(`범위 데이터를 불러오지 못했습니다: ${error}`);
      setAnalyzing(false);
      return;
    }

    const input = buildBiomarkerInput();
    const engineResults = runEngine(input, ranges as Range[]);
    setRanges(ranges as Range[]);
    setResults(engineResults);
    console.log("[BiomarkerForm] engine results:", engineResults);
    setAnalyzing(false);
  }

  async function handleSave() {
    const activeSex = sex === "M" || sex === "F" ? sex : null;
    const birthYearNum = parseInt(birthYear, 10);

    if (!userId || !activeSex) {
      alert("로그인 및 성별 정보가 필요합니다.");
      return;
    }
    if (!birthYear || Number.isNaN(birthYearNum) || birthYearNum < 1900 || birthYearNum > 2030) {
      alert("출생 연도를 올바르게 입력해 주세요.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    const saveResult = await saveCheckup({
      user_id: userId,
      sex: activeSex,
      birth_year: birthYearNum,
      recorded_date: recordedDate,
      biomarker_input: buildBiomarkerInput(),
      rules_by_key: buildRulesByKey(),
    });

    setSaving(false);

    if (saveResult.error) {
      console.error("[BiomarkerForm] saveCheckup failed:", saveResult.error);
      setSaveError(saveResult.error);
      return;
    }

    setSaved(true);
    setSaveMessage("검진 결과가 저장되었습니다 (3개월 후 재검진 시 비교 가능)");
  }

  async function handleShowTimeseries() {
    if (!userId) return;

    setHistoryLoading(true);
    setHistoryError(null);

    let activeRanges = ranges;
    const activeSex = sex === "M" || sex === "F" ? sex : null;
    if (activeRanges.length === 0 && activeSex) {
      const rangeResult = await fetchRanges(activeSex);
      if (rangeResult.error) {
        setHistoryError(rangeResult.error);
        setHistoryLoading(false);
        return;
      }
      activeRanges = rangeResult.ranges as Range[];
      setRanges(activeRanges);
    }

    const { history, error } = await fetchCheckupHistory(userId);
    setHistoryLoading(false);

    if (error) {
      console.error("[BiomarkerForm] fetchCheckupHistory failed:", error);
      setHistoryError(error);
      return;
    }

    setHistoryPoints(normalizeHistory(history));
    setShowTimeseries(true);
  }

  const topChanges = useMemo(
    () => getTopChanges(historyPoints, ranges, 5),
    [historyPoints, ranges],
  );

  const topNeeds = useMemo(
    () => aggregateTopFunctionalNeeds(results, 3),
    [results],
  );

  const exampleBiomarkerKey = useMemo(
    () => pickExampleWorseningBiomarker(results),
    [results],
  );

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "32px 0" }}>
        <div className="spinner" style={{ margin: "0 auto 16px" }} />
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>검진 항목을 불러오는 중...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <p style={{ color: "#dc2626", fontSize: 14, textAlign: "center" }}>
        데이터를 불러오지 못했습니다: {loadError}
      </p>
    );
  }

  if (!isLoggedIn) {
    return (
      <div
        className="card"
        style={{
          textAlign: "center",
          padding: "28px 24px",
          background: "rgba(142, 202, 230, 0.08)",
          border: "1px solid rgba(142, 202, 230, 0.25)",
        }}
      >
        <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>
          로그인이 필요합니다
        </h3>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
          검진 결과를 기록하고 이전 검진과 비교해 추천을 받으려면 로그인이 필요합니다
        </p>
        <button
          type="button"
          className="btn btn-primary"
          style={{ maxWidth: 240, margin: "0 auto" }}
          onClick={() => navigate("/login")}
        >
          로그인하러 가기
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleAnalyze}
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
    >
      {needsProfile && (
        <section>
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 8 }}>
            기본 프로필
          </h3>
          <p className="section-subtitle" style={{ marginBottom: 16 }}>
            첫 이용 시 성별과 출생 연도를 입력해 주세요.
          </p>

          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            {(["M", "F"] as const).map((value) => (
              <div
                key={value}
                className={`radio-card ${sex === value ? "selected" : ""}`}
                onClick={() => setSex(value)}
                style={{ flex: 1, cursor: "pointer" }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setSex(value);
                }}
              >
                <div className="radio-dot" />
                <span>{value === "M" ? "남성" : "여성"}</span>
              </div>
            ))}
          </div>

          <div className="input-group">
            <label htmlFor="birth-year">출생 연도</label>
            <input
              id="birth-year"
              type="number"
              className="input-field"
              min={1900}
              max={2030}
              placeholder="예: 1990"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
            />
          </div>
        </section>
      )}

      <section>
        <h3 className="section-title" style={{ fontSize: 16, marginBottom: 8 }}>
          검진결과지 불러오기
        </h3>
        <p className="section-subtitle" style={{ marginBottom: 12 }}>
          The건강보험 앱이나 정부24에서 받은 건강검진 결과 PDF를 올리면 수치를 자동으로 채워드려요.
        </p>
        <label
          className="btn btn-secondary"
          style={{ display: "block", textAlign: "center", cursor: "pointer" }}
        >
          {importing ? "결과지 읽는 중..." : "📄 검진결과 PDF 불러오기"}
          <input
            type="file"
            accept="application/pdf"
            onChange={handleImportPdf}
            disabled={importing}
            style={{ display: "none" }}
          />
        </label>
        {importMessage && (
          <p style={{ color: "#16a34a", fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
            {importMessage}
          </p>
        )}
        {importError && (
          <p style={{ color: "#dc2626", fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
            {importError}
          </p>
        )}
      </section>

      <section>
        <h3 className="section-title" style={{ fontSize: 16, marginBottom: 8 }}>
          검진일
        </h3>
        <div className="input-group">
          <label htmlFor="recorded-date">검진 기록일</label>
          <input
            id="recorded-date"
            type="date"
            className="input-field"
            value={recordedDate}
            onChange={(e) => setRecordedDate(e.target.value)}
          />
        </div>
      </section>

      {groupedRules.map(([category, items]) => (
        <section key={category}>
          <h3
            className="section-title"
            style={{ fontSize: 16, marginBottom: 12, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}
          >
            {category}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {items.map((rule) => (
              <div key={rule.biomarker_key} className="input-group" style={{ marginBottom: 0 }}>
                <label htmlFor={`biomarker-${rule.biomarker_key}`}>
                  {rule.display_name_ko}
                  {rule.inverted && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 12,
                        color: "var(--text-muted)",
                        fontWeight: 400,
                      }}
                    >
                      (낮을수록 양호)
                    </span>
                  )}
                </label>
                {rule.note && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>{rule.note}</p>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    id={`biomarker-${rule.biomarker_key}`}
                    type="number"
                    step="any"
                    className="input-field"
                    placeholder="수치 입력"
                    value={values[rule.biomarker_key] ?? ""}
                    onChange={(e) => handleValueChange(rule.biomarker_key, e.target.value)}
                    style={{ flex: 1 }}
                  />
                  {rule.unit && (
                    <span style={{ fontSize: 14, color: "var(--text-secondary)", minWidth: 48 }}>
                      {rule.unit}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <button
        type="submit"
        className="btn btn-accent"
        style={{ marginTop: 8, fontSize: 16 }}
        disabled={analyzing}
      >
        {analyzing ? "분석 중..." : "검진 결과 분석하기"}
      </button>

      {results.length > 0 && (
        <section>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginBottom: 12, fontSize: 16 }}
            disabled={saving || saved}
            onClick={handleSave}
          >
            {saving ? "저장 중..." : saved ? "저장 완료" : "저장하기"}
          </button>
          {saveMessage && (
            <p style={{ color: "#16a34a", fontSize: 14, marginBottom: 12, lineHeight: 1.5 }}>
              {saveMessage}
            </p>
          )}
          {saveError && (
            <p style={{ color: "#dc2626", fontSize: 14, marginBottom: 12, lineHeight: 1.5 }}>
              저장 실패: {saveError}
            </p>
          )}
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 12 }}>
            분석 결과
          </h3>
          <RecommendationList results={results} />

          {saved && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginTop: 16, fontSize: 16, width: "100%" }}
              disabled={historyLoading}
              onClick={handleShowTimeseries}
            >
              {historyLoading ? "과거 검진 결과 불러오는 중..." : "과거 검진 결과 보기"}
            </button>
          )}

          {historyError && (
            <p style={{ color: "#dc2626", fontSize: 14, marginTop: 12 }}>
              과거 검진 결과 조회 실패: {historyError}
            </p>
          )}

          {showTimeseries && (
            <section style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <h3 className="section-title" style={{ fontSize: 16, marginBottom: 0 }}>
                변화 추이
              </h3>

              {historyPoints.length < 2 ? (
                <div className="card" style={{ padding: 20 }}>
                  <h4 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600 }}>
                    첫 검진 기준선이 저장되었습니다
                  </h4>
                  <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    다음 검진 때 변화가 표시됩니다.
                  </p>
                  {topNeeds.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600 }}>이번 관심 카테고리 TOP 3</p>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: "var(--text-secondary)" }}>
                        {topNeeds.map((need) => (
                          <li key={need}>{need}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {exampleBiomarkerKey && historyPoints[0]?.biomarkers[exampleBiomarkerKey] != null && (
                    <div>
                      <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--text-secondary)" }}>
                        꾸준한 관리로 목표 범위 도달 가능 (예시: {exampleBiomarkerKey})
                      </p>
                      <TimeseriesChart
                        biomarker_key={exampleBiomarkerKey}
                        history={(() => {
                          const current = historyPoints[0].biomarkers[exampleBiomarkerKey];
                          const band = getNormalRangeBand(exampleBiomarkerKey, ranges);
                          const target = band ? (band.min + band.max) / 2 : current * 0.9;
                          return [
                            { recorded_date: historyPoints[0].recorded_date, value: current },
                            { recorded_date: "목표(예시)", value: target },
                          ];
                        })()}
                        ranges={ranges}
                        height={160}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {topChanges.map((change) => (
                    <div key={change.biomarker_key} className="card" style={{ padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <strong style={{ fontSize: 15 }}>{change.biomarker_key}</strong>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: CHANGE_COLORS[change.classification],
                          }}
                        >
                          {change.classification} ({change.changeRate > 0 ? "+" : ""}
                          {change.changeRate.toFixed(1)}%)
                        </span>
                      </div>
                      <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--text-muted)" }}>
                        {change.prev} → {change.curr}
                      </p>
                      <TimeseriesChart
                        biomarker_key={change.biomarker_key}
                        history={getBiomarkerSeries(historyPoints, change.biomarker_key)}
                        ranges={ranges}
                        height={160}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </section>
      )}
    </form>
  );
}
