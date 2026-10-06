import { URINE_PROTEIN_KEY, URINE_PROTEIN_OPTIONS } from "../../domain/checkup/urine_protein";

/**
 * 검진 값 입력칸 (BiomarkerForm·EditCheckup 공용)
 * 요단백은 기호 선택(<select>, 순서 코드 저장) · 나머지는 숫자칸. 평가: IP/integration/checkup_urine_protein_eval_v1.md W1
 */
interface Props {
  id: string;
  biomarkerKey: string;
  value: string;
  onChange: (v: string) => void;
}

export default function BiomarkerValueInput({ id, biomarkerKey, value, onChange }: Props) {
  if (biomarkerKey === URINE_PROTEIN_KEY) {
    return (
      <select id={id} className="input-field" value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1 }}>
        <option value="">선택 안 함</option>
        {URINE_PROTEIN_OPTIONS.map((o) => (
          <option key={o.code} value={String(o.code)}>{o.label}</option>
        ))}
      </select>
    );
  }
  return (
    <input
      id={id}
      type="number"
      step="any"
      className="input-field"
      placeholder="수치 입력"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ flex: 1 }}
    />
  );
}
