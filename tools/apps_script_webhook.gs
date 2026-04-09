/**
 * 서박사의 영양공식 — 설문 응답 수신 웹훅 + 초기 세팅
 *
 * 사용 순서:
 *   1. 구글 시트에서 확장 프로그램 → Apps Script 열기
 *   2. 기본 코드 전부 지우고 이 파일 내용 붙여넣기
 *   3. 상단 함수 드롭다운에서 setupSheet 선택 → ▶ 실행 → 권한 승인
 *      → 시트 탭 이름이 "Responses"로 바뀌고 A1~R1에 18개 헤더가 자동 삽입됨
 *   4. 배포 → 새 배포 → 유형: 웹 앱
 *      - 설명: seoboksa survey ingest
 *      - 실행 계정: 나 (saeronjhk@gmail.com)
 *      - 액세스: 모든 사용자
 *   5. 웹 앱 URL 복사 → Vercel 환경변수 SHEETS_WEBHOOK_URL에 등록
 *   6. Vercel 환경변수 SHEETS_WEBHOOK_SECRET에 아래 SECRET 값과 동일하게 등록
 */

const SECRET = 'seoboksa-boyVNdDOWJ4Ty6k0XrPKpVrzLcL2Ico-';
const SHEET_NAME = 'Responses';

const HEADERS = [
  'timestamp', 'session_id', 'device', 'age_group', 'gender',
  'height', 'weight', 'bmi', 'symptoms', 'goals',
  'lifestyle', 'current_supplements', 'conditions', 'family_history',
  'recommendations', 'persona_id', 'ip_hash', 'ua_hash'
];

/**
 * 초기 세팅: 첫 번째 시트 이름을 Responses로 바꾸고 1행에 헤더를 삽입.
 * Apps Script 편집기에서 한 번만 ▶ 실행하면 됨.
 */
function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    // 기본 '시트1' 같은 이름을 Responses로 변경
    sheet = ss.getSheets()[0];
    sheet.setName(SHEET_NAME);
  }
  // 헤더가 이미 있으면 덮어쓰지 않음
  const firstCell = sheet.getRange(1, 1).getValue();
  if (!firstCell) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  Logger.log('setupSheet 완료: ' + SHEET_NAME + ' 시트에 헤더 ' + HEADERS.length + '개 삽입');
}

/** 설문 응답 1건을 Responses 시트에 append */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    if (!body || body.secret !== SECRET) {
      return json({ ok: false, error: 'unauthorized' });
    }
    if (!Array.isArray(body.values)) {
      return json({ ok: false, error: 'values must be array' });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      return json({ ok: false, error: 'sheet not found: ' + SHEET_NAME + ' (run setupSheet first)' });
    }

    sheet.appendRow(body.values);
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/** 헬스체크 (브라우저로 웹앱 URL에 접속하면 {ok:true} 반환) */
function doGet() {
  return json({ ok: true, service: 'seoboksa-survey-webhook' });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
