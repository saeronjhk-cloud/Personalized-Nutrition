export default function Terms() {
  return (
    <div className="page fade-in" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <h1 className="section-title" style={{ marginBottom: 24 }}>이용약관</h1>

      <div className="card" style={{ lineHeight: 1.8, fontSize: 14, color: 'var(--text-secondary)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>제1조 (목적)</h3>
        <p style={{ marginBottom: 16 }}>
          본 약관은 새론비즈(이하 "회사")가 운영하는 케어앤(Care & N) 서비스(이하 "서비스")의 이용에 관한
          기본적인 사항을 규정하는 것을 목적으로 합니다.
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>제2조 (서비스의 내용)</h3>
        <p style={{ marginBottom: 16 }}>
          본 서비스는 이용자가 입력한 건강 설문 정보를 기반으로 맞춤 영양제를 추천하는 정보 제공 서비스입니다.
          본 서비스는 의학적 진단, 치료, 처방을 대체하지 않으며, 의료 행위에 해당하지 않습니다.
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>제3조 (면책 조항)</h3>
        <p style={{ marginBottom: 16 }}>
          본 서비스에서 제공하는 추천 정보는 식약처 인정 건강기능식품의 기능성 정보와 공개된 학술 자료에 기반한
          참고 정보입니다. 이용자는 추천 결과를 참고 자료로만 활용하여야 하며, 건강 관련 결정은 반드시 전문 의료인과
          상담 후 내려야 합니다. 회사는 서비스 이용으로 인해 발생한 직접적·간접적 손해에 대해 책임을 지지 않습니다.
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>제4조 (지식재산권)</h3>
        <p style={{ marginBottom: 16 }}>
          서비스에 포함된 추천 알고리즘, 콘텐츠, 디자인, 로고 등 지식재산은 회사에 귀속됩니다.
          이용자는 서비스의 내용을 상업적으로 복제, 배포, 전송할 수 없습니다.
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>제5조 (제휴 링크)</h3>
        <p style={{ marginBottom: 16 }}>
          본 서비스는 쿠팡 등 외부 쇼핑몰의 상품 검색 링크를 제공하며, 이를 통한 구매 시 회사가 일정 수수료를
          받을 수 있습니다. 이는 이용자에게 추가 비용을 발생시키지 않습니다.
          외부 사이트에서의 구매, 배송, 환불 등은 해당 사이트의 정책을 따릅니다.
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>제6조 (서비스의 변경 및 중단)</h3>
        <p style={{ marginBottom: 16 }}>
          회사는 서비스의 내용을 변경하거나 중단할 수 있으며, 중요한 변경 사항은 서비스 내 공지를 통해 안내합니다.
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>제7조 (준거법 및 관할)</h3>
        <p style={{ marginBottom: 16 }}>
          본 약관의 해석 및 분쟁 해결에 관해서는 대한민국 법률을 적용하며,
          분쟁이 발생한 경우 회사의 소재지를 관할하는 법원을 관할 법원으로 합니다.
        </p>

        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          시행일: 2026년 4월 4일
        </p>
      </div>
    </div>
  )
}
