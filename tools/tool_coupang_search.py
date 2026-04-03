"""
쿠팡 상품 검색 연결 도구

현재: 쿠팡 검색 페이지로 직접 연결 (수익 발생 없음)
나중에: 쿠팡 파트너스 API 키 등록 후 제휴 링크로 교체하면 구매 수익 발생
"""

import urllib.parse
import os


def get_coupang_url(keyword: str) -> dict:
    """
    상품 키워드로 쿠팡 링크를 생성합니다.

    Returns:
        {
            "url": 링크 URL,
            "mode": "search" (파트너스 미연동) | "affiliate" (파트너스 연동됨),
            "label": 버튼에 표시할 텍스트,
        }
    """
    access_key = os.getenv("COUPANG_ACCESS_KEY")
    secret_key = os.getenv("COUPANG_SECRET_KEY")

    if access_key and secret_key:
        # 파트너스 API 연동됨 → 제휴 링크 생성 (추후 구현)
        url = _generate_affiliate_link(keyword, access_key, secret_key)
        return {
            "url": url,
            "mode": "affiliate",
            "label": "🛒 쿠팡 최저가 보기 (파트너스)",
        }
    else:
        # 미연동 → 일반 검색 링크
        encoded = urllib.parse.quote(keyword)
        url = f"https://www.coupang.com/np/search?q={encoded}&channel=user"
        return {
            "url": url,
            "mode": "search",
            "label": "🛒 쿠팡에서 찾아보기",
        }


def _generate_affiliate_link(keyword: str, access_key: str, secret_key: str) -> str:
    """
    쿠팡 파트너스 API로 제휴 딥링크를 생성합니다.
    파트너스 계정 승인 후 이 함수를 완성하세요.

    API 문서: https://partners.coupang.com > API 연동 가이드
    """
    # TODO: 파트너스 API 연동 후 구현
    # 현재는 일반 검색 링크 반환
    encoded = urllib.parse.quote(keyword)
    return f"https://www.coupang.com/np/search?q={encoded}&channel=user"
