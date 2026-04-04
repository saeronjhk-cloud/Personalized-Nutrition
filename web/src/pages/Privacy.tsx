export default function Privacy() {
  return (
    <div className="page fade-in" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <h1 className="section-title" style={{ marginBottom: 24 }}>개인정보처리방침</h1>

      <div className="card" style={{ lineHeight: 1.8, fontSize: 14, color: 'var(--text-secondary)' }}>
        <p style={{ marginBottom: 20 }}>
          <strong>새론비즈</strong>(이하 "회사")는 이용자의 개인정보를 중요하게 생각하며,
          「개인정보 보호법」 등 관련 법령을 준수하고 있습니다.
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>1. 수집하는 개인정보 항목</h3>
        <p style={{ marginBottom: 16 }}>
          본 서비스는 <strong>회원가입을 하지 않으며</strong>, 설문 과정에서 입력된 건강 관련 정보(성별, 나이, 키, 체중, 증상, 생활습관, 기저질환)는
          <strong> 서버에 저장되지 않고 브라우저에서만 처리</strong>됩니다. 분석이 완료되면 입력 데이터는 자동으로 삭제됩니다.
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>2. 개인정보의 수집 및 이용 목적</h3>
        <p style={{ marginBottom: 16 }}>
          입력된 건강 정보는 오직 맞춤 영양제 추천 결과를 생성하는 목적으로만 사용되며,
          제3자에게 제공되거나 마케팅에 활용되지 않습니다.
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>3. 개인정보의 보유 및 파기</h3>
        <p style={{ marginBottom: 16 }}>
          본 서비스는 서버에 개인정보를 저장하지 않습니다. 모든 분석은 사용자의 브라우저(클라이언트)에서 이루어지며,
          페이지를 떠나면 모든 데이터가 자동으로 소멸됩니다.
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>4. 쿠키 및 자동 수집 정보</h3>
        <p style={{ marginBottom: 16 }}>
          본 서비스는 서비스 개선을 위해 방문자 수, 페이지 조회 수 등 기본적인 웹 분석 데이터를 수집할 수 있습니다.
          이 데이터는 개인을 식별할 수 없는 익명 정보입니다.
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>5. 제3자 링크</h3>
        <p style={{ marginBottom: 16 }}>
          본 서비스는 쿠팡 등 외부 쇼핑몰 검색 링크를 제공합니다. 외부 사이트의 개인정보처리방침은
          해당 사이트의 정책을 따르며, 회사는 이에 대한 책임을 지지 않습니다.
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>6. 개인정보 보호책임자</h3>
        <p style={{ marginBottom: 16 }}>
          성명: 김재환<br />
          직책: 대표<br />
          이메일: saeronjhk@gmail.com
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>7. 방침 변경</h3>
        <p>
          본 개인정보처리방침은 2026년 4월 4일부터 시행됩니다.
          변경 사항이 있을 경우 서비스 내 공지를 통해 안내합니다.
        </p>
      </div>
    </div>
  )
}
