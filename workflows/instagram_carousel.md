# 워크플로: 인스타그램 카드뉴스 자동 생성

## 목적

Notion에 올라간 주간 블로그 글을 10장짜리 인스타그램 캐러셀(카드뉴스)로 변환한다. 마지막 장은 **항상 "서박사의 영양공식" 광고 카드**로 고정.

## 입력

- Notion 블로그 페이지 ID 또는 슬러그 (예: `global-omega3-deficiency-2026`)
- 또는 직접 작성한 카드 JSON 스펙

## 출력

- `.pptx` 파일 1개 (슬라이드 10장, 1080x1350 4:5 비율)
- 사장님 폴더의 `대시보드/서박사의 영양공식/인스타/{날짜}_{주제}.pptx`

사장님은 이 파일을 PowerPoint에서 열어서 `파일 → 내보내기 → 파일 형식 변경 → PNG`로 10장의 이미지 파일을 한 번에 뽑아낼 수 있다. 그걸 Instagram에 올리면 끝.

## 사용하는 Tool

- `tools/instagram_card_generator.py` — JSON 스펙을 받아 PPTX를 만드는 Python 스크립트

## 단계

### 1. Notion 블로그 글 읽기

Notion MCP `notion-fetch`로 블로그 페이지를 가져와 제목/요약/본문/카테고리/이모지를 확인한다. 블로그 글이 마크다운 구조(h2 헤딩 + 본문)로 돼 있으므로 섹션 단위로 쪼개서 파악한다.

### 2. 8장의 본문 카드로 압축

블로그 글의 핵심을 **최대 8장**까지 분배한다. 원칙은:

- **1장째 본문은 "충격 통계" 또는 "한 줄 정의"** — 사용자 시선을 멈춰 세울 만한 것
- **중간은 "왜/어떻게/무엇을" 순서** — 원인 → 상황 → 해결
- **마지막 본문은 "결론 또는 인용"** — 한 줄로 압축된 핵심 메시지

각 카드는 다음 4가지 타입 중 하나:

| 타입 | 용도 | 필드 |
|------|------|------|
| `stat` | 큰 통계/숫자 하나 | `eyebrow`, `headline`(숫자), `unit`, `body` |
| `list` | 체크리스트, 이유, 단계 (최대 5개) | `eyebrow`, `headline`, `items[]` |
| `body` | 일반 본문 설명 | `eyebrow`, `headline`, `body` |
| `quote` | 핵심 메시지 인용 | `eyebrow`, `body` |

각 필드 길이 가이드:
- `eyebrow`: 한두 단어 (섹션 라벨, 예: "최신 연구", "주의")
- `headline`: 1~2줄, 24자 이내
- `body`: 3~5줄, 120자 이내
- `items[]`: 각 25자 이내, 최대 5개

### 3. 테마 선택

블로그 카테고리에 맞춰 테마를 고른다:

| 카테고리 | 테마 |
|----------|------|
| 오메가-3, 수면 | `ocean` (딥블루) |
| 유산균, 비타민, 면역 | `sage` (딥그린) |
| 철분, 미네랄, 여성 | `berry` (버건디) |
| 복용법, 가이드 | `terracotta` (테라코타) |
| 피부, 에너지 | `coral` (코랄) |

### 4. JSON 스펙 파일 작성

`.tmp/instagram/{slug}_spec.json` 위치에 저장한다.

필수 필드:
```json
{
  "post_title": "원본 블로그 제목",
  "cover_emoji": "🌊",
  "cover_hook": "표지에 들어갈 후킹 (2줄 이내)",
  "cover_subtitle": "부제목 (질문형 권장)",
  "theme": "ocean",
  "cards": [
    { "type": "stat", ... },
    { "type": "list", ... },
    ...
  ]
}
```

광고 카드(10장째)는 JSON에 절대 넣지 않는다. 자동으로 추가된다.

### 5. 생성기 실행

```bash
python tools/instagram_card_generator.py \
  --input .tmp/instagram/{slug}_spec.json \
  --output ".tmp/instagram/{YYYY-MM-DD}_{slug}.pptx" \
  --logo web/public/logo.png
```

### 6. 최종 폴더로 복사

완성된 PPTX를 사장님이 접근할 수 있는 `대시보드/서박사의 영양공식/인스타/` 폴더로 복사한다.

### 7. QA 체크리스트

사장님에게 전달하기 전에 다음을 확인:

- [ ] 슬라이드 수가 정확히 10장인가
- [ ] 10번 슬라이드가 고정 광고 카드인가 (`MADE BY` + 서박사의 영양공식 + CTA)
- [ ] 모든 슬라이드 좌하단에 `@서박사의영양공식 | nutriformula.co.kr` 푸터가 있는가
- [ ] 표지에 이모지 + 후킹 + "밀어서 자세히 보기 →" 가 있는가
- [ ] 본문 카드 headline이 24자 초과로 잘리지 않았는가

`python -m markitdown 파일.pptx` 로 텍스트 추출해서 빠르게 확인 가능.

## 절대 바꾸지 않는 것

**10장째 광고 카드**는 어떤 경우에도 수정하지 않는다. `tools/instagram_card_generator.py`의 `render_ad()` 함수 안에 하드코딩돼 있다. 텍스트, 레이아웃, CTA, URL 모두 고정. 브랜드 일관성을 위해서다.

광고 카드 내용을 바꾸고 싶으면 사장님의 명시적 지시를 받은 뒤에만 `render_ad()` 함수를 수정한다.

## 실패 케이스

### 한글이 네모 박스로 보임

PPT를 열었을 때 한글이 `□□□`로 나오면, 해당 기기에 **맑은 고딕(Malgun Gothic)** 폰트가 없는 것. Windows에는 기본 설치돼 있고, Mac이나 Linux에서는 `Apple SD Gothic Neo`, `Noto Sans KR` 등으로 대체 필요. `tools/instagram_card_generator.py`의 `FONT_BOLD`, `FONT_BODY` 상수를 바꿔서 다른 폰트로 저장할 수 있다.

### PowerPoint가 없음

사장님이 MS Office 없이 PPT를 열고 싶으면:
- **LibreOffice Impress**(무료)로 열고 `파일 → 내보내기`로 PNG 뽑기
- 또는 Google Slides에 업로드 → 각 슬라이드 우클릭 → 이미지로 저장

### 슬라이드 번호가 자동 생성되지 않음

`render_*` 함수에서 `add_page_number()`를 호출하지 않은 슬라이드가 있으면 번호가 빠진다. 모든 렌더러 함수 끝에 이 호출이 있는지 확인.

## 업데이트 기록

- 2026-04-09: 최초 작성. 오메가-3 76% 글로 첫 카드 생성 성공.
