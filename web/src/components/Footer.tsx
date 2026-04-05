import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div style={{ fontSize: 20, fontWeight: 700 }}>🧬 서박사의 영양공식</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            바른 먹거리로 건강한 세상을 이룬다
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            새론비즈 | 대표 김재환
          </p>
        </div>

        <div className="footer-links">
          <div className="footer-col">
            <h4>서비스</h4>
            <Link to="/survey">영양제 추천</Link>
            <Link to="/blog">영양정보 블로그</Link>
            <Link to="/resources">유용한 링크</Link>
          </div>
          <div className="footer-col">
            <h4>회사</h4>
            <Link to="/about">회사 소개</Link>
            <Link to="/team">운영진 소개</Link>
            <Link to="/privacy">개인정보처리방침</Link>
            <Link to="/terms">이용약관</Link>
          </div>
          <div className="footer-col">
            <h4>문의</h4>
            <a href="mailto:saeronjhk@gmail.com">saeronjhk@gmail.com</a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© 2026 새론비즈. All rights reserved.</p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          본 서비스는 의학적 진단을 대체하지 않습니다. 질환이 있으신 분은 전문의와 상담하세요.
        </p>
      </div>
    </footer>
  )
}
