import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  fetchMyProfile,
  fetchBiomarkerRules,
  fetchCheckupRecordDetail,
  groupBiomarkersByCategory,
  updateCheckup,
  type BiomarkerRule,
} from "../../lib/checkup_api";

export default function EditCheckup() {
  const navigate = useNavigate();
  const { recordId } = useParams<{ recordId: string }>();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [rules, setRules] = useState<BiomarkerRule[]>([]);
  const [recordedDate, setRecordedDate] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!recordId) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError(null);

      const profile = await fetchMyProfile();
      if (cancelled) return;
      setIsLoggedIn(profile.isLoggedIn);
      setUserId(profile.userId);
      if (!profile.isLoggedIn || !profile.userId) {
        setLoading(false);
        return;
      }

      const [rulesResult, detailResult] = await Promise.all([
        fetchBiomarkerRules(),
        fetchCheckupRecordDetail(recordId, profile.userId),
      ]);
      if (cancelled) return;

      if (rulesResult.error) {
        setLoadError(rulesResult.error);
        setLoading(false);
        return;
      }
      if (detailResult.error) {
        setLoadError(detailResult.error);
        setLoading(false);
        return;
      }
      if (!detailResult.detail) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setRules(rulesResult.data ?? []);
      setRecordedDate(detailResult.detail.recorded_date);
      const prefill: Record<string, string> = {};
      for (const [key, v] of Object.entries(detailResult.detail.values)) {
        prefill[key] = String(v.value);
      }
      setValues(prefill);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [recordId]);

  const groupedRules = useMemo(() => groupBiomarkersByCategory(rules), [rules]);

  function handleValueChange(key: string, raw: string) {
    setValues((prev) => ({ ...prev, [key]: raw }));
  }

  async function handleSave() {
    if (!userId || !recordId) return;

    const biomarker_input: Record<string, number> = {};
    for (const [key, raw] of Object.entries(values)) {
      if (raw === "") continue;
      const num = Number(raw);
      if (!Number.isNaN(num)) biomarker_input[key] = num;
    }

    const rules_by_key: Record<string, { unit: string }> = {};
    for (const rule of rules) {
      rules_by_key[rule.biomarker_key] = { unit: rule.unit };
    }

    setSaving(true);
    setSaveError(null);
    const result = await updateCheckup({
      recordId,
      userId,
      recorded_date: recordedDate,
      biomarker_input,
      rules_by_key,
    });
    setSaving(false);

    if (result.error) {
      setSaveError(result.error);
      return;
    }
    navigate("/checkup/manage");
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "32px 0" }}>
        <div className="spinner" style={{ margin: "0 auto 16px" }} />
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>검진 기록을 불러오는 중...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="survey-container fade-in">
        <div className="survey-card">
          <p style={{ color: "var(--text-secondary)", fontSize: 14, textAlign: "center" }}>
            로그인이 필요합니다.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ maxWidth: 240, margin: "16px auto 0" }}
            onClick={() => navigate("/login")}
          >
            로그인하러 가기
          </button>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="survey-container fade-in">
        <div className="survey-card">
          <p style={{ color: "var(--text-secondary)", fontSize: 14, textAlign: "center" }}>
            해당 검진 기록을 찾을 수 없습니다.
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ maxWidth: 240, margin: "16px auto 0" }}
            onClick={() => navigate("/checkup/manage")}
          >
            검진 기록 관리로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="survey-container fade-in">
      <div className="survey-card">
        <h2 className="survey-step-title">검진 기록 수정</h2>
        {loadError && (
          <p style={{ color: "#dc2626", fontSize: 14, marginBottom: 16 }}>
            불러오기 오류: {loadError}
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <section>
            <h3 className="section-title" style={{ fontSize: 16, marginBottom: 8 }}>
              검진일
            </h3>
            <div className="input-group">
              <label htmlFor="edit-recorded-date">검진 기록일</label>
              <input
                id="edit-recorded-date"
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
                style={{
                  fontSize: 16,
                  marginBottom: 12,
                  borderBottom: "1px solid var(--border)",
                  paddingBottom: 8,
                }}
              >
                {category}
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {items.map((rule) => (
                  <div key={rule.biomarker_key} className="input-group" style={{ marginBottom: 0 }}>
                    <label htmlFor={`edit-biomarker-${rule.biomarker_key}`}>
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
                      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                        {rule.note}
                      </p>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        id={`edit-biomarker-${rule.biomarker_key}`}
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

          {saveError && (
            <p style={{ color: "#dc2626", fontSize: 14 }}>수정 실패: {saveError}</p>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1, fontSize: 16 }}
              disabled={saving}
              onClick={() => navigate("/checkup/manage")}
            >
              취소
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1, fontSize: 16 }}
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? "저장 중..." : "수정 저장"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
