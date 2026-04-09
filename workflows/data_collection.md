# 설문 데이터 익명 수집 — 운영 매뉴얼

## 목적
설문을 완료한 사용자의 응답·추천 결과를 **완전 익명**으로 Google Sheets에 누적해, 추천 알고리즘 개선과
트렌드 분석의 근거 데이터를 확보한다. PIPA 고지형 안내를 준수하며 서비스 이용은 차단하지 않는다.

## 아키텍처 (3단계 구조)

```
사용자 브라우저
  └─ web/src/lib/analytics.ts           # 익명 세션 ID 발급 + sendBeacon 호출
       │
       ▼
Vercel Serverless
  └─ web/api/survey-submit.ts           # 18열 행 가공 + 검증
       │
       ▼
  └─ web/api/_sheets.ts                 # Apps Script 웹훅으로 POST (secret 첨부)
       │
       ▼
Apps Script 웹앱 (tools/apps_script_webhook.gs)
       │
       ▼
Google Sheets (Responses 시트)           # 최종 저장소 — 사장 계정 소유
```

> **왜 Apps Script?** 구글이 `iam.disableServiceAccountKeyCreation` 조직 정책을 개인 계정에도 자동 적용해 서비스계정 JSON 키 발급이 막힌다. Apps Script는 사장 본인 계정 권한으로 시트에 쓰므로 키 발급 없이 동작한다.

## 수집 항목 (18열)

| 열 | 이름 | 설명 |
|----|------|------|
| A | timestamp | ISO 8601 |
| B | session_id | `anon-{UUID}` 익명 |
| C | device | mobile / tablet / desktop |
| D | age_group | 10대 / 20대 / ... / 70대+ |
| E | gender | male / female |
| F | height | cm |
| G | weight | kg |
| H | bmi | 계산값 |
| I | symptoms | JSON 배열 |
| J | goals | JSON 배열 |
| K | lifestyle | JSON (수면/스트레스/운동/식사/음주/흡연 등) |
| L | current_supplements | JSON 배열 |
| M | conditions | JSON 배열 |
| N | family_history | JSON 배열 |
| O | recommendations | JSON `[{rank,id,name,score}]` |
| P | persona_id | 매칭된 페르소나 |
| Q | ip_hash | `sha256(salt+IP)` 앞 16자 |
| R | ua_hash | `sha256(salt+UA)` 앞 16자 |

## 환경변수 (Vercel)

| 키 | 설명 |
|----|------|
| `SHEETS_WEBHOOK_URL` | Apps Script 웹앱 URL (`https://script.google.com/macros/s/.../exec`) |
| `SHEETS_WEBHOOK_SECRET` | Apps Script의 `SECRET` 상수와 완전 동일해야 함 |
| `ANALYTICS_IP_SALT` | IP·UA 해시 솔트 (긴 랜덤 문자열) |

## Apps Script 쪽 (`tools/apps_script_webhook.gs`)

- 구글 시트 → 확장 프로그램 → Apps Script에 붙여넣고 웹앱으로 배포.
- `doPost`: JSON `{secret, values}`를 받아 `Responses` 시트에 `appendRow`.
- `doGet`: 헬스체크. 브라우저로 웹앱 URL에 접속하면 `{ok:true}` 반환.
- 배포 액세스 = "모든 사용자" (익명 접근 허용). SECRET 불일치 시 거부.

## 프라이버시 규칙

- 이름·이메일·전화 등 직접 식별 정보는 **절대 저장하지 않는다**.
- IP·UA는 원본 저장 금지. 반드시 `hashWithSalt`를 거쳐 16자 해시만 기록.
- 사용자가 `sf_data_consent=declined`를 설정한 경우 `submitSurveyAnalytics`가 즉시 return.
- 새로운 필드를 추가할 때마다 `web/src/pages/Privacy.tsx` 1절과 본 문서를 동시 업데이트한다.

## 장애 대응

| 증상 | 점검 순서 |
|------|-----------|
| 시트에 행이 안 쌓임 | Vercel Logs → `[survey-submit] error:` 확인 |
| `Sheets webhook 실패: 401/거부 unauthorized` | Vercel `SHEETS_WEBHOOK_SECRET`과 Apps Script `SECRET` 값 일치 확인 |
| `Sheets webhook 실패: 404` | 웹앱 URL 오타 / 배포 해제 상태 확인 |
| `Sheets webhook 거부: sheet not found` | 시트 탭 이름이 `Responses`인지 확인 |
| 클라이언트만 OK, 시트엔 0건 | sendBeacon은 fire-and-forget → Vercel 쪽 Logs 확인 필수 |
| SECRET 교체 후 계속 거부 | Apps Script 배포 관리 → 편집 → 새 버전 → 배포 했는지 확인 (저장만으론 반영 안 됨) |

## 확장 시 주의
- 열을 추가할 땐 Responses 시트 맨 뒤에만 추가. 기존 열 순서를 바꾸면 과거 데이터와 불일치.
- 개인 식별성이 높은 필드를 추가해야 하면 반드시 사장 승인 + 개인정보처리방침 개정 후 배포.
