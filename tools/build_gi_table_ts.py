# -*- coding: utf-8 -*-
"""
GI 표(CSV) → Deno Edge Function용 TS 모듈 생성기  (설계서 132 · 원칙3 IP 분리)
──────────────────────────────────────────────────────────────────────────
단일 출처(single source of truth) = IP/content/gi_table_v1.csv  ← 사람이 고치는 유일한 파일.
Edge Function(Deno)은 D:\ 로컬 경로를 읽을 수 없으므로 CSV를 TS 모듈로 **생성**해 번들에 넣는다.
생성물은 손으로 고치지 않는다(헤더에 DO NOT EDIT + 원본 SHA-256 기록 → 표류 감지 가능).

로직 이식 원칙: 파싱 규칙은 food_analyzer.load_gi_table() 과 **동일**해야 한다.
  · gi 공란 → 건너뜀(미상 → T2에 위임)
  · 0~110 범위 밖 → 건너뜀
  · gi_source 기본 db_measured / gi_confidence 기본 low

실행:
  python tools/build_gi_table_ts.py          # 생성 + 요약 출력
  python tools/build_gi_table_ts.py --check  # 재생성 없이 최신인지만 검사(CI 게이트용)
"""
import csv
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC_CSV = ROOT / 'IP' / 'content' / 'gi_table_v1.csv'
OUT_TS = (ROOT / 'backends' / 'Vita50' / 'code' / 'myhealthcheck' / 'supabase'
          / 'functions' / '_shared' / 'gi' / 'gi_table_v1.gen.ts')

REL_SRC = 'IP/content/gi_table_v1.csv'


def load_rows(path):
    """food_analyzer.load_gi_table() 과 동일한 파싱 규칙."""
    rows = {}
    skipped = 0
    with open(path, encoding='utf-8-sig', newline='') as f:
        for row in csv.DictReader(f):
            fid = (row.get('food_id') or '').strip()
            raw_gi = (row.get('gi') or '').strip()
            if not fid or not raw_gi:
                skipped += 1
                continue
            try:
                gi = int(round(float(raw_gi)))
            except ValueError:
                skipped += 1
                continue
            if not 0 <= gi <= 110:
                skipped += 1
                continue
            rows[fid] = {
                'gi': gi,
                'gi_source': (row.get('gi_source') or 'db_measured').strip(),
                'gi_confidence': (row.get('gi_confidence') or 'low').strip(),
                'gi_ref': (row.get('gi_ref') or '').strip(),
            }
    return rows, skipped


def render(rows, sha):
    j = json.dumps
    lines = [
        '// =====================================================================',
        '// gi_table_v1.gen.ts — 자동 생성 파일 · 직접 수정 금지 (DO NOT EDIT)',
        '// ---------------------------------------------------------------------',
        '// 생성기 : tools/build_gi_table_ts.py',
        '// 원본   : %s   ← ★단일 출처. 값을 바꾸려면 이 CSV를 고치고 생성기를 다시 돌린다.' % REL_SRC,
        '// 원본 SHA-256 : %s' % sha,
        '// 수록 종수     : %d' % len(rows),
        '//',
        '// GI 값의 근거·한계는 IP/137_GI_eval_v1.1_개정확정_v1.md 및',
        '// IP/138_GI_전문가검수_체크리스트_v1.md 를 볼 것.',
        '// gi_confidence=low / gi_source=db_estimated 는 직접 측정치가 아니라 추론값이다.',
        '// =====================================================================',
        '',
        '/** GI 표 1행. food_analyzer.py 의 GI_FIELDS 와 1:1 대응. */',
        'export interface GiEntry {',
        '  readonly gi: number;',
        '  readonly gi_source: string;',
        '  readonly gi_confidence: string;',
        '  readonly gi_ref: string;',
        '}',
        '',
        '/** 원본 CSV 의 SHA-256 — 생성물이 원본과 어긋나면 CI 에서 잡는다. */',
        'export const GI_TABLE_SOURCE = %s;' % j(REL_SRC),
        'export const GI_TABLE_SOURCE_SHA256 = %s;' % j(sha),
        '',
        '/** food_id → GI. gi 공란 행은 원본에 있어도 여기 없다(미상 → T2 게이트에 위임). */',
        'export const GI_TABLE: Readonly<Record<string, GiEntry>> = {',
    ]
    for fid in sorted(rows):
        e = rows[fid]
        lines.append('  %s: { gi: %d, gi_source: %s, gi_confidence: %s, gi_ref: %s },' % (
            j(fid), e['gi'], j(e['gi_source']), j(e['gi_confidence']), j(e['gi_ref'])))
    lines += [
        '};',
        '',
        '/** 수록 종수(생성 시점 실측). 로딩 검증용. */',
        'export const GI_TABLE_ROWS = %d;' % len(rows),
        '',
    ]
    return '\n'.join(lines)


def main():
    if not SRC_CSV.exists():
        print('ERROR: 원본 CSV 없음: %s' % SRC_CSV)
        return 2
    sha = hashlib.sha256(SRC_CSV.read_bytes()).hexdigest()
    rows, skipped = load_rows(SRC_CSV)
    out = render(rows, sha)

    if '--check' in sys.argv:
        cur = OUT_TS.read_text(encoding='utf-8') if OUT_TS.exists() else ''
        if cur != out:
            print('STALE: %s 가 원본과 다릅니다. `python tools/build_gi_table_ts.py` 재실행 필요.' % OUT_TS.name)
            return 1
        print('OK: 생성물이 원본과 일치 (%d종, sha=%s)' % (len(rows), sha[:12]))
        return 0

    OUT_TS.parent.mkdir(parents=True, exist_ok=True)
    OUT_TS.write_text(out, encoding='utf-8')
    print('원본 : %s' % SRC_CSV)
    print('SHA  : %s' % sha)
    print('생성 : %s' % OUT_TS)
    print('수록 : %d종 (gi 공란/범위밖 %d행 제외)' % (len(rows), skipped))
    return 0


if __name__ == '__main__':
    sys.exit(main())
