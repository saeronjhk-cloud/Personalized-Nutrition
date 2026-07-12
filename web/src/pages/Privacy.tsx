import { MEAL_ENABLED } from '../lib/flags'

export default function Privacy() {
  return (
    <div className="page fade-in" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <h1 className="section-title" style={{ marginBottom: 24 }}>개인정보처리방침</h1>

      <div className="card" style={{ lineHeight: 1.8, fontSize: 14, color: 'var(--text-secondary)' }}>
        <p style={{ marginBottom: 20 }}>
          <strong>(주)새론미디어</strong>(이하 "회사")는 이용자의 개인정보를 중요하게 생각하며,
          「개인정보 보호법」 등 관련 법령을 준수합니다. 본 방침은 서비스가 <strong>어떤 데이터를 왜 수집하고, 어떻게 보호하는지</strong>를
          투명하게 설명하기 위해 작성되었습니다.
        </p>

        <div
          style={{
            background: 'rgba(142, 202, 230, 0.12)',
            border: '1px solid rgba(142, 202, 230, 0.35)',
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 24,
            color: 'var(--text)',
            fontSize: 13,
          }}
        >
          <strong>요약:</strong> 회원가입 없이 <strong>비회원 상태로</strong> 설문·추천을 이용할 수 있습니다(이름·전화번호 등 직접 식별정보 미수집).
          선택적 회원가입(이메일 Magic Link) 시 이메일 주소를 <strong>인증·로그인 용도</strong>로 수집합니다.
          설문 응답과 추천 결과는 서비스 품질 개선을 위해 <strong>비회원 세션 또는 회원 계정에 연동</strong>하여 기록됩니다.
          설문 중 건강에 관한 정보(증상·기저질환·가족력 등)는 <strong>민감정보</strong>로, 별도 동의를 받은 경우에만 처리합니다.
          IP 주소는 원본이 저장되지 않고 복원이 불가능한 해시값만 남습니다.
        </div>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>1. 수집하는 정보 항목</h3>
        <p style={{ marginBottom: 8 }}>
          회사는 다음과 같은 정보를 설문 완료 시점 또는 회원가입 시 수집합니다.
        </p>
        <p style={{ marginBottom: 8, fontWeight: 600, color: 'var(--text)' }}>① 비회원 이용 시 (회원가입 없음)</p>
        <ul style={{ marginBottom: 16, paddingLeft: 20 }}>
          <li>무작위 세션 ID (브라우저에서 생성 — 설문·추천 결과를 구분하기 위한 임시 식별자)</li>
          <li>설문 응답: 성별, 나이, 키, 체중, 증상, 건강 목표, 수면·스트레스·운동·식사·음주·흡연 등 생활 습관, 현재 복용 중인 영양제, 기저질환, 가족력<br /><span style={{ color: 'var(--text-muted)', fontSize: 13 }}>※ 이 중 <strong>증상·기저질환·가족력·건강 목표 등 건강에 관한 정보는 민감정보</strong>에 해당하며, 별도 동의를 받은 경우에만 처리합니다.</span></li>
          <li>추천 결과: 노출된 영양제 목록, 점수, 페르소나 분류</li>
          <li>기기 유형 (모바일/태블릿/데스크톱)</li>
          <li>접속 IP 및 User-Agent의 <strong>단방향 해시값</strong> (원본은 저장하지 않으며 복원 불가)</li>
        </ul>
        <p style={{ marginBottom: 8, fontWeight: 600, color: 'var(--text)' }}>② 회원가입 시 (선택)</p>
        <ul style={{ marginBottom: 16, paddingLeft: 20 }}>
          <li>이메일 주소 (회원가입 시, 인증·로그인 용도)</li>
          <li>마지막 비회원 세션 ID (회원가입 시 기존 분석 데이터와 회원 계정을 연결하기 위한 목적)</li>
          <li>회원 식별 정보 (Supabase 인증 시스템에서 발급되는 고유 사용자 ID)</li>
        </ul>
        <p style={{ marginBottom: 8, fontWeight: 600, color: 'var(--text)' }}>③ 제품 스캔 이용 시 (로그인 회원)</p>
        <ul style={{ marginBottom: 16, paddingLeft: 20 }}>
          <li>제품 스캔 이력: 회원이 앱에서 조회한 가공식품의 제품 정보(제품명·브랜드·분류·바코드)와 조회 당시 표시된 <strong>공개 영양·첨가물 정보 스냅샷</strong>(제품 자체의 정보)</li>
          <li>※ 개인의 건강 설문에 따라 계산된 맞춤 주의 사유·개인화 영양소 항목, 설문 응답값, 건강검진 결과값은 스캔 이력에 <strong>저장하지 않으며</strong>, "내 기준으로 보기"는 조회 시점에 다시 계산합니다.</li>
        </ul>

        <p style={{ marginBottom: 8, fontWeight: 600, color: 'var(--text)' }}>④ 향후 도입 예정 (선택, Phase C)</p>
        <ul style={{ marginBottom: 16, paddingLeft: 20 }}>
          <li>검진 데이터 (혈액검사 등 — 민감정보에 해당하며, 별도 동의를 받은 경우에만 수집)</li>
        </ul>
        <p style={{ marginBottom: 16 }}>
          <strong>수집하지 않는 정보:</strong> 이름, 전화번호, 주소, 주민등록번호, 결제 정보,
          계정 비밀번호, 얼굴 사진 등 직접 개인을 식별할 수 있는 일체의 정보(이메일은 회원가입 시에만 수집).
        </p>

        <p style={{ marginBottom: 8, fontWeight: 600, color: 'var(--text)' }}>민감정보(건강에 관한 정보)의 별도 동의</p>
        <p style={{ marginBottom: 16 }}>
          설문 입력 중 <strong>증상·기저질환·가족력·건강 목표</strong> 등 건강에 관한 정보와 그로부터 산출된 추천 결과는
          「개인정보 보호법」상 <strong>민감정보</strong>에 해당합니다. 회사는 이를 <strong>맞춤 영양(건강기능식품 등) 추천 및
          생활습관 가이드 제공, 본인 기록·변화 추적</strong> 목적으로 처리하며, <strong>설문 시작 전 일반 개인정보 동의와 분리된
          별도 동의</strong>를 받은 경우에만 수집·이용합니다. 보유기간은 생성일로부터 최대 730일 또는 탈퇴·삭제요청 시까지입니다.
          동의를 거부하실 수 있으며, 이 경우 설문 기능 이용이 제한될 수 있으나 회원가입 및 다른 기능은 이용하실 수 있습니다.
          (가족력은 본인의 건강관리 참고 범위에서만 입력하며, 가족 구성원의 식별정보는 수집하지 않습니다.)
        </p>

        <div
          style={{
            background: 'rgba(142, 202, 230, 0.10)',
            border: '1px solid rgba(142, 202, 230, 0.30)',
            borderRadius: 10,
            padding: '14px 16px',
            marginBottom: 24,
            color: 'var(--text)',
            fontSize: 13,
            lineHeight: 1.7,
          }}
        >
          <strong>🔒 제품 스캔 이력 프라이버시 원칙</strong>
          <p style={{ margin: '8px 0 0' }}>
            <strong>처리 항목·목적</strong> — 회사는 로그인 회원에게 최근 스캔 다시 보기, 주간 조회 패턴 요약,
            동일 제품 재조회 등 회원 본인의 편의 기능을 제공하기 위해 제품 스캔 이력을 처리합니다.
          </p>
          <p style={{ margin: '8px 0 0' }}>
            <strong>이용 제한(광고·마케팅 프로파일링 금지)</strong> — 제품 스캔 이력은 위 서비스 기능 제공
            목적으로만 이용되며, 제품 관심사 기반 광고·마케팅 프로파일링에는 이용하지 않습니다.
          </p>
          <p style={{ margin: '8px 0 0' }}>
            <strong>민감정보 결합 제한</strong> — 제품 스캔 이력은 건강 설문·건강검진 정보 등 민감정보와 결합하여
            별도의 건강 프로파일을 생성하거나 광고·마케팅 목적으로 이용하지 않습니다. 스캔 화면의 "내 기준으로 보기"
            기능은 이용자가 제공한 설문 정보를 바탕으로 조회 시점에 필요한 표시를 계산하는 기능이며, 스캔 이력에는 그
            판단의 근거가 된 설문 응답값이나 건강검진 결과값이 저장되지 않습니다.
          </p>
          <p style={{ margin: '8px 0 0' }}>
            <strong>삭제·파기</strong> — 회원은 개별 스캔 이력을 삭제할 수 있습니다. 개별 이력을 삭제하면 해당 이력은
            서비스에서 즉시 제외되고 데이터베이스에서 삭제됩니다. 회원 탈퇴 시 계정에 연결된 스캔 이력은 영구 삭제됩니다.
            (백업본이 있는 경우 백업 보관기간 경과 후 파기)
          </p>
          <p style={{ margin: '8px 0 0' }}>
            <strong>비회원(비로그인) 이용 시</strong> — 로그인하지 않은 상태의 스캔 이력은 회사 서버로 전송되지 않고
            이용자 기기(브라우저 저장소)에만 저장됩니다. 브라우저 저장소를 비우거나 앱/브라우저 데이터를 삭제하면 이력은 즉시 사라집니다.
          </p>
        </div>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>2. 수집 및 이용 목적</h3>
        <ul style={{ marginBottom: 16, paddingLeft: 20 }}>
          <li>영양제 추천 알고리즘 품질 개선</li>
          <li>증상·목표·연령대별 사용 현황 통계 분석</li>
          <li>서비스 오류 및 이상 사용 패턴 탐지</li>
          <li>장기적인 영양 트렌드 연구 자료로 활용 (개인을 식별할 수 없도록 집계된 통계 형태)</li>
          <li>회원 인증 및 로그인, 회원 전용 기능 제공</li>
          <li>비회원 설문 데이터와 회원 계정의 연결 (선택적 회원가입 시)</li>
        </ul>
        <p style={{ marginBottom: 16 }}>
          수집된 정보는 위 목적 외에 마케팅, 광고, 개인 맞춤 타겟팅, 판매 등에 <strong>사용되지 않습니다</strong>.
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>3. 보유 기간 및 파기</h3>
        <ul style={{ marginBottom: 16, paddingLeft: 20 }}>
          <li><strong>회원 데이터:</strong> 회원 탈퇴 시 즉시 삭제합니다. (이메일, 회원 식별 정보, 연결된 설문 응답 포함)</li>
          <li><strong>설문 기반 건강 관련(민감) 정보:</strong> 생성일로부터 최대 730일(약 2년), 또는 회원 탈퇴·삭제요청 시까지 보관 후 파기합니다. (설문 시작 전 별도 동의를 받은 항목)</li>
          <li><strong>제품 스캔 이력(로그인 회원):</strong> 회원이 개별 이력을 삭제하면 데이터베이스에서 삭제되며, 회원 탈퇴 시 계정에 연결된 스캔 이력은 함께 영구 삭제됩니다. 비회원 스캔 이력은 서버에 저장되지 않고 이용자 기기에만 남습니다.</li>
          <li><strong>비회원 세션 기반 설문·추천 데이터:</strong> 생성일로부터 최대 730일(약 2년) 또는 삭제요청 시까지 보관 후 파기합니다.</li>
          <li><strong>개인을 식별할 수 없도록 집계된 통계 데이터:</strong> 서비스 품질 개선 및 연구 목적으로 보관할 수 있으며, 서비스 종료 시 지체 없이 파기합니다.</li>
          <li><strong>백업 데이터:</strong> 장애 복구를 위해 최대 30일간 보관 후 순차적으로 파기합니다.</li>
          {MEAL_ENABLED && (
            <li><strong>식사 사진 분석 동의 증빙(최소 메타):</strong> 회원 탈퇴 또는 동의 철회 후에도 적법한 별도 동의·철회가 있었다는 사실을 증명하고 분쟁에 대응하기 위한 <strong>회사의 정당한 이익</strong>에 근거하여, 식별키·동의/철회 시각·동의한 정책 버전·동의문 해시 등 최소 정보(<strong>건강정보·사진·음식/영양값 제외</strong>)를 탈퇴·철회일부터 3년간 분리 보관한 후 지체 없이 파기합니다. 다만 분쟁·조사·소송이 개시된 경우 해당 절차 종료 시까지 보관합니다.</li>
          )}
        </ul>
        <p style={{ marginBottom: 16 }}>
          이용자는 언제든 아래 '이용자의 권리'에 따라 자신의 데이터 삭제를 요청할 수 있습니다. 다만 비회원 세션 기반으로
          저장된 데이터는 이용자가 세션 ID를 별도로 보관한 경우에만 특정 레코드를 찾아 삭제할 수 있습니다.
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>4. 처리위탁 및 국외 이전</h3>
        <p style={{ marginBottom: 16 }}>
          회사는 이용자의 정보를 제3자에게 판매하거나 마케팅 목적으로 제공하지 않습니다. 다만 서비스 운영을 위해 아래와 같이
          처리위탁 및 개인정보의 국외 이전이 수반될 수 있습니다. 회사는 수탁자의 개인정보 보호 약관 및 계약상 보호조치를 확인하고,
          필요한 경우 데이터처리계약(DPA) 등 보호조치를 적용합니다.
        </p>

        {[
          {
            name: 'Supabase, Inc.', country: '미국',
            items: '이메일, 회원 식별 정보, 설문 응답(건강 관련 민감정보 포함), 추천 결과, 제품 스캔 이력'
              + (MEAL_ENABLED ? ', 식사 사진 및 그로부터 추정된 음식·영양 정보(식사 기록 기능 이용 시)' : '') + '(로그인 회원)',
            when: '서비스 이용(설문 저장·로그인·스캔 저장) 시 정보통신망(HTTPS)을 통해 전송'
              + (MEAL_ENABLED ? ' (식사 사진 원본은 미국 소재 비공개 저장소에 보관)' : ''),
            purpose: '데이터 저장, 회원 인증, 회원 전용 기능 제공',
            keep: '회원 탈퇴·삭제요청 또는 위탁계약 종료 시까지 (설문 기반 민감정보는 최대 730일)',
            contact: 'privacy@supabase.com',
            basis: MEAL_ENABLED
              ? '「개인정보 보호법」 제28조의8 제1항 제3호(계약의 이행에 필요한 처리위탁·보관으로서 본 처리방침을 통해 공개). 다만 식사 사진 및 그로부터 추정된 건강 관련 정보의 국외 보관에 대하여는 같은 항 제1호(정보주체의 국외이전 별도 동의)에 근거합니다.'
              : '「개인정보 보호법」 제28조의8 제1항 제3호(계약의 이행에 필요한 처리위탁·보관으로서 본 처리방침을 통해 공개)',
          },
          {
            name: 'Vercel, Inc.', country: '미국',
            items: '접속 로그, 요청 정보, IP·User-Agent 해시 등 웹 접속에 수반되는 기술 정보',
            when: '웹 접속 시 정보통신망(HTTPS)을 통해 전송',
            purpose: '웹사이트 호스팅 및 서버리스 함수 실행',
            keep: '서비스 운영에 필요한 기간 또는 위탁계약 종료 시까지',
            contact: 'privacy@vercel.com',
            basis: '「개인정보 보호법」 제28조의8 제1항 제3호(계약의 이행에 필요한 처리위탁·보관으로서 본 처리방침을 통해 공개)',
          },
          ...(MEAL_ENABLED ? [
            {
              name: 'Railway Corp.', country: '미국',
              items: '식사 사진(또는 음식 영역 크롭), 분석 요청 메타데이터',
              when: '식사 사진 분석 요청 시 정보통신망(HTTPS)을 통해 서버-서버로 전송',
              purpose: '사진 기반 음식·영양 분석 연산(무상태 처리 — 회사 데이터베이스에 별도 저장하지 않음)',
              keep: '요청 처리에 필요한 기간까지(회사 데이터베이스에 별도 저장하지 않음). 다만 플랫폼 운영·보안 로그의 보유 여부·기간은 수탁자 정책 및 회사가 확인한 실제 설정에 따릅니다. 위탁계약 종료 시까지.',
              contact: 'privacy@railway.app',
              basis: '「개인정보 보호법」 제28조의8 제1항 제1호(정보주체의 국외이전 별도 동의)',
            },
            {
              name: 'OpenAI OpCo, LLC', country: '미국',
              items: '음식 영역으로 한정·저해상도로 축소한 이미지(전체 원본 사진 전송 안 함, 위치정보 등 부가정보 제거, 회원번호·이메일 등 직접 식별정보 미포함)',
              when: '식사 사진 분석 시 HTTPS로 전송(국외이전에 동의한 경우에 한함)',
              purpose: '사진 속 음식 인식(AI 추론)을 통한 음식·영양 분석',
              keep: 'OpenAI는 서비스 제공 및 오남용 탐지를 위해 API 입력·출력을 최대 30일간 보관할 수 있으며 이후 삭제합니다. 다만 관계 법령상 보존 의무가 있거나, 이미지 입력에서 불법 아동 성착취물 의심 콘텐츠가 탐지되는 등 OpenAI의 필수 안전정책상 예외가 적용되는 경우에는 별도 보관·검토될 수 있습니다. API로 전송된 데이터는 기본적으로 모델 학습에 사용되지 않으며, 회사는 데이터 공유(모델 개선) 기능을 활성화하지 않습니다.',
              contact: 'privacy@openai.com',
              basis: '「개인정보 보호법」 제28조의8 제1항 제1호(정보주체의 국외이전 별도 동의)',
            },
          ] : []),
        ].map((v) => (
          <div key={v.name} className="card" style={{ padding: '12px 14px', marginBottom: 12, fontSize: 13, lineHeight: 1.7 }}>
            <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{v.name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· 이전 국가: {v.country}</span></div>
            <div><strong>이전 항목:</strong> {v.items}</div>
            <div><strong>이전 시기·방법:</strong> {v.when}</div>
            <div><strong>이용 목적:</strong> {v.purpose}</div>
            <div><strong>보유·이용 기간:</strong> {v.keep}</div>
            <div><strong>이전받는 자 연락처:</strong> {v.contact}</div>
            <div><strong>법적 근거:</strong> {v.basis}</div>
          </div>
        ))}

        {MEAL_ENABLED && (
          <p style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-muted)' }}>
            ⓘ <strong>식사 사진의 처리 흐름과 최소 전송</strong> — 회사는 식사 사진 분석 과정에서 <strong>원본 식사 사진을 미국 소재 비공개 저장소(Supabase)에 보관</strong>하고,
            분석 처리를 위해 <strong>미국 소재 분석 서버(Railway)로 전송</strong>합니다. 자체 분석만으로 음식 식별이 어려운 경우에 <strong>한하여</strong>,
            AI 처리자(OpenAI)에는 <strong>전체 원본 사진을 전송하지 않고</strong> 음식으로 판단된 영역만 잘라 저해상도로 축소한 이미지만 전송합니다.
            OpenAI 전송 전 위치정보 등 부가정보(EXIF)를 제거하고, 회원번호·이메일·전화번호 등 직접 식별정보는 함께 전송하지 않습니다.
            음식 영역 분리가 실패하거나 유효한 국외이전 동의가 확인되지 않으면 OpenAI로 전송하지 않습니다.
          </p>
        )}
        <p style={{ marginBottom: 16 }}>
          <strong>국외 이전 거부:</strong> 이용자는 개인정보의 국외 이전을 거부할 수 있으며, 거부 방법·절차는 아래 '8. 개인정보 보호책임자'의
          연락처로 요청하실 수 있습니다. 다만 위 이전은 서비스 제공에 필수적이므로, 거부 시 관련 서비스(회원 기능·저장 등) 이용이 제한될 수 있습니다.
        </p>
        {MEAL_ENABLED && (
          <p style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-muted)' }}>
            ⓘ <strong>식사 사진 기능의 국외이전 거부·철회</strong> — 식사 사진 분석을 위한 국외이전·민감정보 처리는 <strong>해당 기능에 한하여</strong> 별도로
            거부·철회할 수 있습니다. 식사 사진 기록 진입 시 '동의하지 않음'을 선택하거나, 이미 동의한 경우 <strong>설정 &gt; 식사 사진 분석 동의 철회</strong>에서
            철회할 수 있습니다. <strong>철회가 접수되면 이후 식사 사진의 신규 업로드·분석·국외이전은 즉시 중단되며, 회사 및 해외 저장소(Supabase)에 보관된 기존 식사 사진과
            분석 결과는 지체 없이 삭제됩니다.</strong> <strong>계정 및 그 밖의 서비스는 계속 이용</strong>할 수 있습니다. 백업본에 남아 있는 정보는 복구 목적 외에는 이용되지 않으며, 정해진 백업 보유주기(최대 30일)가 지나면 자동 파기됩니다.
            이미 OpenAI로 전송된 입력·출력은 위 OpenAI 보유·이용 기간(최대 30일)에 따라 처리되며, 법령상 보존이 필요한 정보와 동의 사실을 증명하기 위한 최소 감사기록(건강정보·사진 제외)은 별도 분리하여 3년간 보관 후 파기됩니다.
          </p>
        )}
        <p style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-muted)' }}>
          ⓘ 자동화된 처리: 본 서비스의 영양제 추천 결과·점수·페르소나 분류는 이용자가 입력한 설문 응답을 바탕으로
          사전에 정한 규칙과 알고리즘에 따라 자동 생성됩니다. 추천 결과는 질병의 진단·치료 또는 의학적 판단을 대체하지
          않으며, 이용자는 추천 결과에 대한 설명이나 정정을 회사 이메일로 요청할 수 있습니다.
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>5. 쿠키 및 로컬 저장소</h3>
        <p style={{ marginBottom: 16 }}>
          본 서비스는 광고·추적 쿠키를 사용하지 않습니다. 다만 이용 편의를 위해 다음 정보를 브라우저
          localStorage에 저장합니다. 브라우저 설정에서 언제든 삭제할 수 있습니다.
        </p>
        <ul style={{ marginBottom: 16, paddingLeft: 20 }}>
          <li><strong>서버로 전송될 수 있는 정보:</strong> 무작위 세션 ID, 마지막 세션 ID — 설문 결과 저장 및 회원가입 시 기존 분석 데이터 연결을 위해 사용됩니다.</li>
          <li><strong>서버로 전송되지 않는 정보:</strong> 데이터 수집 고지 확인 여부, 비회원의 제품 스캔 이력 — 이용자 기기 내에만 저장되며 서버로 전송되지 않습니다.</li>
        </ul>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>6. 제3자 링크</h3>
        <p style={{ marginBottom: 16 }}>
          본 서비스는 쿠팡 등 외부 쇼핑몰 검색 링크를 제공합니다. 외부 사이트의 개인정보처리방침은
          해당 사이트의 정책을 따르며, 회사는 이에 대한 책임을 지지 않습니다.
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>7. 이용자의 권리</h3>
        <p style={{ marginBottom: 16 }}>
          이용자는 「개인정보 보호법」에 따라 열람, 정정, 삭제, 처리 정지를 요청할 권리가 있습니다.
          데이터 수집을 원하지 않는 경우 수집이 시작되기 전(설문 제출 전)에 브라우저를 닫으면 어떤 정보도
          기록되지 않습니다. 이미 제출된 비회원 세션 데이터의 삭제가 필요하면 아래 이메일로 세션 ID와 함께
          요청해 주시기 바랍니다.
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>8. 개인정보 보호책임자 및 사업자 정보</h3>
        <p style={{ marginBottom: 16 }}>
          상호: (주)새론미디어 (Saeron Media Co., Ltd.)<br />
          대표: 김재환<br />
          사업자등록번호: 606-86-65033<br />
          주소: 서울특별시 송파구 중대로 211, 2층(가락동, 나은빌딩)<br />
          개인정보 보호책임자: 김재환 (대표)<br />
          이메일: saeronjhk@gmail.com
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>9. 만 14세 미만 아동의 개인정보 처리</h3>
        <p style={{ marginBottom: 16 }}>
          본 서비스는 만 14세 미만 아동을 대상으로 하지 않으며, 만 14세 미만 아동의 개인정보를 고의로 수집하지 않습니다.
          설문 입력 과정에서 만 14세 미만으로 확인되는 경우 서비스 이용이 제한됩니다.
          {MEAL_ENABLED && ' 회사는 식사 사진 분석 기능 이용 전에 이용자에게 만 14세 이상임을 확인하도록 요구하며, 해당 확인이 완료되지 않은 경우 서버에서 사진 업로드와 분석을 차단합니다. 회사가 이용자가 만 14세 미만임을 알게 된 경우에는 식사 사진 기능 제공을 중단하고 관련 개인정보를 지체 없이 삭제합니다.'}
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>10. 개인정보의 안전성 확보조치</h3>
        <ul style={{ marginBottom: 16, paddingLeft: 20 }}>
          <li>개인정보 접근 권한을 서비스 운영에 필요한 최소 인원으로 제한합니다.</li>
          <li>비밀번호는 회사가 직접 저장하지 않으며, 이메일 Magic Link 등 인증 인프라를 통해 로그인합니다.</li>
          <li>접속 IP와 User-Agent는 원본이 아닌 단방향 해시값으로 처리합니다.</li>
          <li>서비스 통신 구간에는 HTTPS 등 암호화된 전송 방식을 사용합니다.</li>
          <li>장애 복구용 백업 데이터는 최대 30일간 보관 후 순차적으로 파기합니다.</li>
        </ul>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>11. 방침 변경</h3>
        <p style={{ marginBottom: 8 }}>
          {MEAL_ENABLED
            ? '본 개인정보처리방침(버전 13_v5.0)은 2026년 7월 12일부터 시행됩니다. (직전 개정: 2026년 7월 9일)'
            : '본 개인정보처리방침은 2026년 7월 9일부터 시행됩니다. (직전 개정: 2026년 5월 30일)'}
          {' '}개인정보 수집·이용 목적, 처리 항목, 국외이전 대상 등 중요한 변경이 있을 경우 시행 최소 7일 전(이용자에게 불리하거나 민감한 변경은 최소 30일 전)에 서비스 내 공지로 사전 안내합니다.
          {MEAL_ENABLED && ' 식사 사진의 민감정보 처리·국외이전(제4조 Supabase·Railway·OpenAI) 등 중요한 변경 시에는 기존 이용자에게도 다음 이용 시점에 변경된 내용을 다시 고지하고 재동의를 받은 뒤에만 해당 처리를 계속하며, 회사 서버는 현행 동의문 버전에 대한 동의가 확인된 경우에만 해당 처리를 수행합니다.'}
        </p>
        {MEAL_ENABLED && (
          <>
            <p style={{ marginBottom: 4, fontWeight: 600, color: 'var(--text)' }}>부칙 (개정 이력)</p>
            <ul style={{ marginBottom: 16, paddingLeft: 20 }}>
              <li>13_v5.0 (2026-07-12 시행): 식사 사진 분석 기능 관련 민감정보(건강정보) 처리·국외이전(OpenAI·Railway, 미국) 조항 신설, 전송 최소화(음식영역 크롭·저해상도·EXIF 제거)·OpenAI 보관(최대 30일)·모델 미학습 명시, 만 14세 이상 서버 확인, 동의 철회 및 회원 탈퇴 시 전수 삭제 반영.</li>
              <li>v4.9 (2026-07-09 시행): 회원 탈퇴(삭제권) 절차 및 운영사 정보 정비.</li>
              <li>v4.x (2026-05-30 시행): 최초 방침 시행.</li>
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
