import { Link } from 'react-router-dom'
import { MEAL_ENABLED, MEOKSEON_ENABLED } from '../lib/flags'

/** 문의 메일(대외용) — 개인 메일 노출 금지. 처리방침 §8 과 같은 값 */
export const CONTACT_EMAIL = 'contact@saeronmedia.com'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div style={{ fontSize: 20, fontWeight: 700 }}>🧬 서박사의 영양공식</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
            내 건강 상태와 생활 습관에 맞춰 식단을 코칭하고, 필요한 영양제를 추천합니다.
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>
            (주)새론미디어 | 대표 김재환 | 사업자등록번호 606-86-65033<br />
            서울특별시 송파구 중대로 211, 2층(가락동, 나은빌딩)
          </p>
        </div>

        <div className="footer-links">
          <div className="footer-col">
            <h4>서비스</h4>
            <Link to="/dashboard">내 건강</Link>
            <Link to="/survey">영양제 추천</Link>
            {MEAL_ENABLED && <Link to="/meal">식사 기록</Link>}
            {MEOKSEON_ENABLED && <Link to="/scan">가공식품</Link>}
            <Link to="/health-report">건강 변화 리포트</Link>
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
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© 2026 (주)새론미디어. All rights reserved.</p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
          본 서비스는 의학적 진단을 대체하지 않습니다. 질환이 있으신 분은 전문의와 상담하세요.
        </p>
      </div>
    </footer>
  )
}
