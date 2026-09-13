import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchMyProfile,
  fetchCheckupRecords,
  deleteCheckup,
  restoreCheckup,
  type CheckupRecordSummary,
} from "../../lib/checkup_api";
import ConfirmDialog from "../ui/ConfirmDialog";

const UNDO_MS = 6000;

function sortByDateDesc(rows: CheckupRecordSummary[]): CheckupRecordSummary[] {
  return rows.slice().sort((a, b) => b.recorded_date.localeCompare(a.recorded_date));
}

export default function CheckupRecordManager() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [records, setRecords] = useState<CheckupRecordSummary[]>([]);

  // 삭제 확인 대상
  const [pendingDelete, setPendingDelete] = useState<CheckupRecordSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // 실행취소 토스트
  const [undoRecord, setUndoRecord] = useState<CheckupRecordSummary | null>(null);
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
      const { records, error } = await fetchCheckupRecords(profile.userId);
      if (cancelled) return;
      if (error) setLoadError(error);
      else setRecords(sortByDateDesc(records));
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
    setUndoRecord(null);
  }

  async function confirmDelete() {
    if (!pendingDelete || !userId) return;
    setDeleting(true);
    setActionError(null);
    const target = pendingDelete;
    const { error } = await deleteCheckup(target.id, userId);
    setDeleting(false);
    if (error) {
      setActionError(error);
      return;
    }
    setPendingDelete(null);
    setRecords((prev) => prev.filter((r) => r.id !== target.id));
    // 실행취소 토스트
    setUndoRecord(target);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoRecord(null), UNDO_MS);
  }

  async function handleUndo() {
    if (!undoRecord || !userId) return;
    const target = undoRecord;
    clearUndo();
    const { error } = await restoreCheckup(target.id, userId);
    if (error) {
      setActionError(error);
      return;
    }
    setRecords((prev) => sortByDateDesc([...prev, target]));
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-8) 0" }}>
        <div className="spinner" style={{ margin: "0 auto var(--space-4)" }} />
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>검진 기록을 불러오는 중...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div
        className="card"
        style={{
          textAlign: "center",
          padding: "28px var(--space-6)",
          background: "rgba(142, 202, 230, 0.08)",
          border: "1px solid rgba(142, 202, 230, 0.25)",
        }}
      >
        <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text)", marginBottom: 'var(--space-3)' }}>
          로그인이 필요합니다
        </h3>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 'var(--space-5)', lineHeight: 1.6 }}>
          검진 기록을 관리하려면 로그인이 필요합니다
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
        검진 기록을 불러오지 못했습니다: {loadError}
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 'var(--space-4)' }}>
      {actionError && (
        <p style={{ color: "#dc2626", fontSize: 14 }}>작업 실패: {actionError}</p>
      )}

      {records.length === 0 ? (
        <div className="card" style={{ padding: 'var(--space-6)', textAlign: "center" }}>
          <p style={{ margin: "0 0 var(--space-4)", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            저장된 검진 기록이 없습니다.
          </p>
          <button
            type="button"
            className="btn btn-accent"
            style={{ maxWidth: 240, margin: "0 auto" }}
            onClick={() => navigate("/checkup")}
          >
            검진 결과 입력하러 가기
          </button>
        </div>
      ) : (
        records.map((rec) => (
          <div
            key={rec.id}
            className="card"
            style={{
              padding: 'var(--space-4)',
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 'var(--space-3)',
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong style={{ fontSize: 15, color: "var(--text)" }}>{rec.recorded_date}</strong>
              <p style={{ margin: "var(--space-1) 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                검진 항목 {rec.value_count}개
              </p>
            </div>
            <div style={{ display: "flex", gap: 'var(--space-2)', flexShrink: 0 }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: "var(--space-2) 14px", fontSize: 14 }}
                onClick={() => navigate(`/checkup/view/${rec.id}`)}
              >
                결과 보기
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "var(--space-2) 14px", fontSize: 14 }}
                onClick={() => navigate(`/checkup/edit/${rec.id}`)}
              >
                수정
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "var(--space-2) 14px", fontSize: 14, color: "#dc2626" }}
                onClick={() => {
                  setActionError(null);
                  setPendingDelete(rec);
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
        title="검진 기록을 삭제할까요?"
        description={
          pendingDelete
            ? `${pendingDelete.recorded_date} 검진 기록을 삭제합니다. 삭제 후에도 복구할 수 있어요.`
            : undefined
        }
        confirmLabel="삭제"
        danger
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      {undoRecord && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: 24,
            transform: "translateX(-50%)",
            background: "rgba(33, 37, 41, 0.96)",
            color: "#fff",
            padding: "var(--space-3) var(--space-4)",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 'var(--space-4)',
            fontSize: 14,
            zIndex: 1000,
            maxWidth: "calc(100% - 32px)",
            boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
          }}
        >
          <span>검진 기록이 삭제되었습니다</span>
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
