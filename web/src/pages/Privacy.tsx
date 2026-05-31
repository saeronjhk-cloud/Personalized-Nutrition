export default function Privacy() {
  return (
    <div className="page fade-in" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <h1 className="section-title" style={{ marginBottom: 24 }}>개인정보처리방침</h1>

      <div className="card" style={{ lineHeight: 1.8, fontSize: 14, color: 'var(--text-secondary)' }}>
        <p style={{ marginBottom: 20 }}>
          <strong>새론비즈</strong>(이하 "회사")는 이용자의 개인정보를 중요하게 생각하며,
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
          <strong>요약:</strong> 회원가입 없이 <strong>익명으로</strong> 설문·추천을 이용할 수 있습니다.
          선택적 회원가입(이메일 Magic Link) 시 이메일 주소를 <strong>인증·로그인 용도</strong>로 수집합니다.
          설문 응답과 추천 결과는 서비스 품질 개선을 위해 <strong>익명 또는 회원 계정에 연동</strong>하여 기록됩니다.
          IP 주소는 원본이 저장되지 않고 복원이 불가능한 해시값만 남습니다.
        </div>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>1. 수집하는 정보 항목</h3>
        <p style={{ marginBottom: 8 }}>
          회사는 다음과 같은 정보를 설문 완료 시점 또는 회원가입 시 수집합니다.
        </p>
        <p style={{ marginBottom: 8, fontWeight: 600, color: 'var(--text)' }}>① 익명 이용 시 (회원가입 없음)</p>
        <ul style={{ marginBottom: 16, paddingLeft: 20 }}>
          <li>익명 세션 ID (브라우저에서 무작위 생성, 개인 식별 불가)</li>
          <li>설문 응답: 성별, 나이, 키, 체중, 증상, 건강 목표, 수면·스트레스·운동·식사·음주·흡연 등 생활 습관, 현재 복용 중인 영양제, 기저질환, 가족력</li>
          <li>추천 결과: 노출된 영양제 목록, 점수, 페르소나 분류</li>
          <li>기기 유형 (모바일/태블릿/데스크톱)</li>
          <li>접속 IP 및 User-Agent의 <strong>단방향 해시값</strong> (원본은 저장하지 않으며 복원 불가)</li>
        </ul>
        <p style={{ marginBottom: 8, fontWeight: 600, color: 'var(--text)' }}>② 회원가입 시 (선택)</p>
        <ul style={{ marginBottom: 16, paddingLeft: 20 }}>
          <li>이메일 주소 (회원가입 시, 인증·로그인 용도)</li>
          <li>마지막 익명 세션 ID (회원가입 시 기존 분석 데이터와 회원 계정을 연결하기 위한 목적)</li>
          <li>회원 식별 정보 (Supabase 인증 시스템에서 발급되는 고유 사용자 ID)</li>
        </ul>
        <p style={{ marginBottom: 8, fontWeight: 600, color: 'var(--text)' }}>③ 향후 도입 예정 (선택, Phase C)</p>
        <ul style={{ marginBottom: 16, paddingLeft: 20 }}>
          <li>검진 데이터 (혈액검사 등 — 민감정보에 해당하며, 별도 동의를 받은 경우에만 수집)</li>
        </ul>
        <p style={{ marginBottom: 16 }}>
          <strong>수집하지 않는 정보:</strong> 이름, 전화번호, 주소, 주민등록번호, 결제 정보,
          계정 비밀번호, 얼굴 사진 등 직접 개인을 식별할 수 있는 일체의 정보(이메일은 회원가입 시에만 수집).
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>2. 수집 및 이용 목적</h3>
        <ul style={{ marginBottom: 16, paddingLeft: 20 }}>
          <li>영양제 추천 알고리즘 품질 개선</li>
          <li>증상·목표·연령대별 사용 현황 통계 분석</li>
          <li>서비스 오류 및 이상 사용 패턴 탐지</li>
          <li>장기적인 영양 트렌드 연구 자료로 활용 (익명 집계 형태)</li>
          <li>회원 인증 및 로그인, 회원 전용 기능 제공</li>
          <li>익명 설문 데이터와 회원 계정의 연결 (선택적 회원가입 시)</li>
        </ul>
        <p style={{ marginBottom: 16 }}>
          수집된 정보는 위 목적 외에 마케팅, 광고, 개인 맞춤 타겟팅, 판매 등에 <strong>사용되지 않습니다</strong>.
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>3. 보유 기간 및 파기</h3>
        <ul style={{ marginBottom: 16, paddingLeft: 20 }}>
          <li><strong>회원 데이터:</strong> 회원 탈퇴 시 즉시 삭제합니다. (이메일, 회원 식별 정보, 연결된 설문 응답 포함)</li>
          <li><strong>익명 분석 데이터:</strong> 익명 처리된 상태로 운영·분석 목적에 따라 보관합니다. 서비스 종료 시 지체 없이 파기합니다.</li>
        </ul>
        <p style={{ marginBottom: 16 }}>
          이용자는 언제든 아래 '이용자의 권리'에 따라 자신의 데이터 삭제를 요청할 수 있으나,
          익명으로 저장되는 특성상 세션 ID를 별도로 보관한 경우에만 특정 레코드를 찾아 삭제할 수 있습니다.
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>4. 제3자 제공 및 저장 위치</h3>
        <p style={{ marginBottom: 16 }}>
          회사는 이용자의 정보를 제3자에게 판매하거나 제공하지 않습니다. 다만 서비스 운영을 위해 다음 처리 위탁이
          이루어질 수 있습니다.
        </p>
        <ul style={{ marginBottom: 16, paddingLeft: 20 }}>
          <li><strong>Vercel Inc.</strong> — 웹사이트 호스팅 및 서버리스 함수 실행 (미국)</li>
          <li><strong>Google LLC</strong> — 익명 설문 데이터의 저장소(Google Sheets) 및 기본 분석 (미국)</li>
          <li><strong>Supabase Inc.</strong> — 데이터 저장·인증 인프라 (미국). 위탁 항목: 이메일, 설문 응답, 회원 식별 정보</li>
        </ul>
        <p style={{ marginBottom: 16 }}>
          각 업체는 자체 개인정보 보호 정책과 국제 표준(GDPR, SCC 등)을 따릅니다.
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>5. 쿠키 및 로컬 저장소</h3>
        <p style={{ marginBottom: 16 }}>
          본 서비스는 광고·추적 쿠키를 사용하지 않습니다. 다만 이용 편의를 위해 다음 정보를 브라우저
          localStorage에 저장합니다: 익명 세션 ID, 마지막 익명 세션 ID(회원가입 시 데이터 연결용), 데이터 수집 고지 확인 여부. 이 정보는 서버로 전송되지
          않으며, 브라우저 설정에서 언제든 삭제할 수 있습니다.
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>6. 제3자 링크</h3>
        <p style={{ marginBottom: 16 }}>
          본 서비스는 쿠팡 등 외부 쇼핑몰 검색 링크를 제공합니다. 외부 사이트의 개인정보처리방침은
          해당 사이트의 정책을 따르며, 회사는 이에 대한 책임을 지지 않습니다.
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>7. 이용자의 권리</h3>
        <p style={{ marginBottom: 16 }}>
          이용자는 「개인정보 보호법」에 따라 열람, 정정, 삭제, 처리 정지를 요청할 권리가 있습니다.
          데이터 수집을 원하지 않는 경우 수집이 시작되기 전(설문 제출 전)에 브라우저를 닫으면 어떤 정보도
          기록되지 않습니다. 이미 제출된 익명 데이터의 삭제가 필요하면 아래 이메일로 세션 ID와 함께
          요청해 주시기 바랍니다.
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>8. 개인정보 보호책임자</h3>
        <p style={{ marginBottom: 16 }}>
          성명: 김재환<br />
          직책: 대표<br />
          이메일: saeronjhk@gmail.com
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>9. 방침 변경</h3>
        <p>
          본 개인정보처리방침은 2026년 5월 30일부터 시행됩니다.
          중요한 변경 사항이 있을 경우 서비스 내 공지를 통해 사전에 안내합니다.
        </p>
      </div>
    </div>
  )
}
