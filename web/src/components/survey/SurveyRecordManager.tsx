import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchMyProfile } from "../../lib/checkup_api";
import {
  fetchSurveyResponses,
  deleteSurveyResponse,
  restoreSurveyResponse,
  type SurveyResponseSummary,
} from "../../lib/survey_api";
import ConfirmDialog from "../ui/ConfirmDialog";

const UNDO_MS = 6000;

function sortByCreatedDesc(rows: SurveyResponseSummary[]): SurveyResponseSummary[] {
  return rows.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function formatDate(iso: string): string {
  // ISO timestamptz → YYYY-MM-DD
  return (iso || "").slice(0, 10);
}

export default function SurveyRecordManager() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [responses, setResponses] = useState<SurveyResponseSummary[]>([]);

  const [pendingDelete, setPendingDelete] = useState<SurveyResponseSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [undoItem, setUndoItem] = useState<SurveyResponseSummary | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
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
      const { responses, error } = await fetchSurveyResponses(profile.userId);
      if (cancelled) return;
      if (error) setLoadError(error);
      else setResponses(sortByCreatedDesc(responses));
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  function clearUndo() {
    if (undoTimer.current) {
      clearTimeout(undoTimer.current);
      undoTimer.current = null;
    }
    setUndoItem(null);
  }

  async function confirmDelete() {
    if (!pendingDelete || !userId) return;
    setDeleting(true);
    setActionError(null);
    const target = pendingDelete;
    const { error } = await deleteSurveyResponse(target.id, userId);
    setDeleting(false);
    if (error) {
      setActionError(error);
      return;
    }
    setPendingDelete(null);
    setResponses((prev) => prev.filter((r) => r.id !== target.id));
    setUndoItem(target);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoItem(null), UNDO_MS);
  }

  async function handleUndo() {
    if (!undoItem || !userId) return;
    const target = undoItem;
    clearUndo();
    const { error } = await restoreSurveyResponse(target.id, userId);
    if (error) {
      setActionError(error);
      return;
    }
    setResponses((prev) => sortByCreatedDesc([...prev, target]));
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "32px 0" }}>
        <div className="spinner" style={{ margin: "0 auto 16px" }} />
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>설문 기록을 불러오는 중...</p>
      </div>
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
          설문 기록을 관리하려면 로그인이 필요합니다
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

  if (loadError) {
    return (
      <p style={{ color: "#dc2626", fontSize: 14, textAlign: "center" }}>
        설문 기록을 불러오지 못했습니다: {loadError}
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {actionError && (
        <p style={{ color: "#dc2626", fontSize: 14 }}>작업 실패: {actionError}</p>
      )}

      {responses.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            저장된 설문 기록이 없습니다.
          </p>
          <button
            type="button"
            className="btn btn-accent"
            style={{ maxWidth: 240, margin: "0 auto" }}
            onClick={() => navigate("/survey")}
          >
            설문하러 가기
          </button>
        </div>
      ) : (
        responses.map((res) => (
          <div
            key={res.id}
            className="card"
            style={{
              padding: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong style={{ fontSize: 15, color: "var(--text)" }}>{formatDate(res.created_at)}</strong>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                증상 {res.symptom_count} · 목표 {res.goal_count}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: "8px 14px", fontSize: 14 }}
                onClick={() => navigate(`/survey/view/${res.id}`)}
              >
                결과 보기
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "8px 14px", fontSize: 14, color: "#dc2626" }}
                onClick={() => {
                  setActionError(null);
                  setPendingDelete(res);
                }}
              >
                삭제
              </button>
            </div>
          </div>
        ))
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="설문 기록을 삭제할까요?"
        description={
          pendingDelete
            ? `${formatDate(pendingDelete.created_at)} 설문 기록을 삭제합니다. 삭제 후에도 복구할 수 있어요.`
            : undefined
        }
        confirmLabel="삭제"
        danger
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      {undoItem && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: 24,
            transform: "translateX(-50%)",
            background: "rgba(33, 37, 41, 0.96)",
            color: "#fff",
            padding: "12px 16px",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 14,
            zIndex: 1000,
            maxWidth: "calc(100% - 32px)",
            boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
          }}
        >
          <span>설문 기록이 삭제되었습니다</span>
          <button
            type="button"
            onClick={handleUndo}
            style={{
              background: "none",
              border: "none",
              color: "#8ecae6",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              padding: 0,
            }}
          >
            실행취소
          </button>
        </div>
      )}
    </div>
  );
}
