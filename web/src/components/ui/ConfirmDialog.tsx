interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 재사용 확인 다이얼로그 (실수 방지). 외부 라이브러리 없이 오버레이로 구현. */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 1000,
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 360,
          width: "100%",
          padding: 24,
          background: "var(--surface, #fff)",
        }}
      >
        <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 600, color: "var(--text)" }}>
          {title}
        </h3>
        {description && (
          <p
            style={{
              margin: "0 0 20px",
              fontSize: 14,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            {description}
          </p>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ maxWidth: 120 }}
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{
              maxWidth: 120,
              ...(danger ? { background: "#dc2626", borderColor: "#dc2626" } : {}),
            }}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "처리 중..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
