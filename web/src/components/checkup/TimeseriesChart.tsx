import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import type { Range } from "../../domain/checkup/engine";
import { getNormalRangeBand } from "../../domain/checkup/timeseries";

export interface TimeseriesPoint {
  recorded_date: string;
  value: number;
}

interface Props {
  biomarker_key: string;
  history: TimeseriesPoint[];
  ranges: Range[];
  height?: number;
}

export default function TimeseriesChart({
  biomarker_key,
  history,
  ranges,
  height = 200,
}: Props) {
  if (history.length <= 1) {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: "var(--radius-sm)",
          background: "var(--bg-hover)",
          color: "var(--text-muted)",
          fontSize: 13,
          textAlign: "center",
        }}
      >
        {history.length === 0
          ? "표시할 데이터가 없습니다."
          : "첫 검진 기준선만 있습니다. 다음 검진부터 변화 그래프가 표시됩니다."}
      </div>
    );
  }

  const band = getNormalRangeBand(biomarker_key, ranges);
  const chartData = history.map((point) => ({
    date: point.recorded_date,
    value: point.value,
  }));

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {band && (
            <ReferenceArea
              y1={band.min}
              y2={band.max}
              fill="#10b981"
              fillOpacity={0.12}
              strokeOpacity={0}
            />
          )}
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={40} />
          <Tooltip formatter={(value: number) => [value, biomarker_key]} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
