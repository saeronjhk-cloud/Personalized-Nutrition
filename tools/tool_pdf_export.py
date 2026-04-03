import os
from datetime import date
from io import BytesIO

from tools.tool_recommender import calculate_monthly_summary

# ── 한국어 폰트 경로 탐색 ─────────────────────────────────────────────────────
_FONT_CANDIDATES = [
    # Windows
    (r"C:\Windows\Fonts\malgun.ttf",   r"C:\Windows\Fonts\malgunbd.ttf"),   # Malgun Gothic
    (r"C:\Windows\Fonts\gulim.ttc",    r"C:\Windows\Fonts\gulim.ttc"),       # 굴림
    # Linux (Streamlit Cloud / Ubuntu — apt: fonts-nanum)
    ("/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
     "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"),
    ("/usr/share/fonts/truetype/nanum/NanumBarunGothic.ttf",
     "/usr/share/fonts/truetype/nanum/NanumBarunGothicBold.ttf"),
    # macOS
    ("/System/Library/Fonts/AppleSDGothicNeo.ttc",
     "/System/Library/Fonts/AppleSDGothicNeo.ttc"),
]

def _find_fonts():
    for regular, bold in _FONT_CANDIDATES:
        if os.path.exists(regular):
            bold_path = bold if os.path.exists(bold) else regular
            return regular, bold_path
    return None, None


# ── 색상 상수 ─────────────────────────────────────────────────────────────────
_PURPLE   = (102, 126, 234)
_GREEN    = (0,   184, 148)
_DARK     = (45,  52,  54)
_GRAY     = (99,  110, 114)
_LIGHT_BG = (248, 249, 250)
_WHITE    = (255, 255, 255)
_BORDER   = (224, 224, 224)
_WARN_BG  = (255, 248, 225)
_WARN_BOR = (255, 193,  7)
_COST_BG  = (240, 244, 255)


def generate_pdf_bytes(
    answers: dict,
    scores: dict,
    persona: dict,
    recommendations: list,
    toxicity_warnings: list,
    food_advices: list,
    radar_fig,
) -> bytes:
    """결과 데이터를 받아 A4 PDF를 생성하고 bytes로 반환합니다."""
    from fpdf import FPDF

    font_regular, font_bold = _find_fonts()

    # ── 레이더 차트 → PNG bytes ──────────────────────────────────────────────
    chart_buf = None
    try:
        chart_png = radar_fig.to_image(format="png", width=500, height=380, scale=1.5)
        chart_buf = BytesIO(chart_png)
    except Exception:
        pass

    # ── 월간 비용 ────────────────────────────────────────────────────────────
    monthly = calculate_monthly_summary(recommendations)

    # ── FPDF 초기화 ──────────────────────────────────────────────────────────
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_margins(left=15, top=15, right=15)
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # 폰트 등록
    if font_regular:
        pdf.add_font("KR", fname=font_regular)
        pdf.add_font("KR", style="B", fname=font_bold)
        _font = "KR"
    else:
        _font = "Helvetica"   # 한글 깨질 수 있지만 fallback

    W = pdf.w - pdf.l_margin - pdf.r_margin   # 콘텐츠 폭 (≈180mm)

    def set_color(r, g, b, fill=True, text=False):
        if fill:
            pdf.set_fill_color(r, g, b)
        if text:
            pdf.set_text_color(r, g, b)
        pdf.set_draw_color(r, g, b)

    def h_rule(color=_BORDER, thickness=0.3):
        pdf.set_draw_color(*color)
        pdf.set_line_width(thickness)
        pdf.line(pdf.l_margin, pdf.get_y(), pdf.l_margin + W, pdf.get_y())
        pdf.ln(2)

    def section_title(text, color=_PURPLE):
        pdf.set_font(_font, "B", 12)
        pdf.set_text_color(*color)
        pdf.cell(W, 7, text, ln=True)
        pdf.set_draw_color(*color)
        pdf.set_line_width(0.5)
        pdf.line(pdf.l_margin, pdf.get_y(), pdf.l_margin + W, pdf.get_y())
        pdf.ln(3)

    today = date.today().strftime("%Y년 %m월 %d일")

    # ════════════════════════════════════════════════════════════════
    # ① 헤더
    # ════════════════════════════════════════════════════════════════
    pdf.set_fill_color(*_PURPLE)
    pdf.set_text_color(*_WHITE)
    pdf.set_draw_color(*_PURPLE)
    pdf.set_line_width(0)
    pdf.rect(pdf.l_margin, pdf.get_y(), W, 18, style="F")
    y_hdr = pdf.get_y()
    pdf.set_xy(pdf.l_margin + 4, y_hdr + 3)
    pdf.set_font(_font, "B", 14)
    pdf.cell(W - 8, 7, "내 몸에 맞는 영양제 분석 결과", ln=False)
    pdf.set_xy(pdf.l_margin + 4, y_hdr + 10)
    pdf.set_font(_font, "", 9)
    pdf.cell(W - 8, 5, f"분석일: {today}", ln=True)
    pdf.ln(4)

    # ════════════════════════════════════════════════════════════════
    # ② 페르소나
    # ════════════════════════════════════════════════════════════════
    section_title("내 건강 유형")
    p_name = f"{persona.get('emoji', '')} {persona['name']}"
    tagline = persona.get("tagline", "")
    desc = persona.get("description", "")

    pdf.set_fill_color(*_LIGHT_BG)
    pdf.set_draw_color(*_BORDER)
    pdf.set_line_width(0.3)
    box_y = pdf.get_y()
    pdf.rect(pdf.l_margin, box_y, W, 0.3, style="F")   # top border placeholder

    pdf.set_x(pdf.l_margin + 3)
    pdf.set_font(_font, "B", 12)
    pdf.set_text_color(*_PURPLE)
    pdf.multi_cell(W - 6, 6, p_name, align="L")
    if tagline:
        pdf.set_x(pdf.l_margin + 3)
        pdf.set_font(_font, "", 9)
        pdf.set_text_color(*_GRAY)
        pdf.multi_cell(W - 6, 5, f'"{tagline}"', align="L")
    pdf.set_x(pdf.l_margin + 3)
    pdf.set_font(_font, "", 9)
    pdf.set_text_color(*_DARK)
    pdf.multi_cell(W - 6, 5, desc, align="L")
    pdf.ln(3)

    # ════════════════════════════════════════════════════════════════
    # ③ 건강 밸런스
    # ════════════════════════════════════════════════════════════════
    section_title("건강 밸런스")

    # 레이더 차트 이미지
    if chart_buf:
        chart_w = min(W * 0.65, 110)
        chart_x = pdf.l_margin + (W - chart_w) / 2
        chart_h = chart_w * (380 / 500)
        pdf.image(chart_buf, x=chart_x, y=pdf.get_y(), w=chart_w, h=chart_h)
        pdf.ln(chart_h + 2)

    # 점수 바 테이블
    cat_items = [
        ("피로·에너지", scores.get("피로", 0)),
        ("수면",       scores.get("수면", 0)),
        ("스트레스",   scores.get("스트레스", 0)),
        ("간 건강",    scores.get("간건강", 0)),
        ("면역력",     scores.get("면역력", 0)),
        ("장 건강",    scores.get("장건강", 0)),
        ("근육·관절",  scores.get("근육관절", 0)),
        ("피부",       scores.get("피부", 0)),
    ]
    bar_max = max((v for _, v in cat_items), default=1)
    bar_max = max(bar_max, 8)

    label_w, num_w, bar_w = 28, 12, W - 28 - 12
    row_h = 5.5

    for label, val in cat_items:
        pct = val / bar_max
        bar_color = (231, 76, 60) if val >= 6 else (243, 156, 18) if val >= 3 else (0, 184, 148)

        pdf.set_x(pdf.l_margin)
        pdf.set_font(_font, "", 8)
        pdf.set_text_color(*_GRAY)
        pdf.cell(label_w, row_h, label, align="L")

        pdf.set_font(_font, "B", 8)
        pdf.set_text_color(*_DARK)
        pdf.cell(num_w, row_h, f"{val}점", align="R")

        # 배경 바
        bx = pdf.l_margin + label_w + num_w
        by = pdf.get_y() + 1.5
        pdf.set_fill_color(230, 230, 230)
        pdf.rect(bx, by, bar_w, 3, style="F")
        # 채운 바
        pdf.set_fill_color(*bar_color)
        pdf.rect(bx, by, bar_w * pct, 3, style="F")

        pdf.ln(row_h)

    pdf.ln(4)

    # ════════════════════════════════════════════════════════════════
    # ④ 영양제 추천 카드
    # ════════════════════════════════════════════════════════════════
    section_title(f"맞춤 영양제 추천 ({len(recommendations)}개)")

    grade_label = {"A": "★★★ 근거 강함", "B": "★★☆ 근거 보통", "C": "★☆☆ 근거 제한적"}

    for i, (supp, matched_symptoms, rec_score) in enumerate(recommendations, 1):
        if pdf.get_y() > 250:
            pdf.add_page()

        dg = supp.get("dosage_guide", {})
        ev = supp.get("evidence", {})
        onset = supp.get("onset_weeks", "")
        cautions = supp.get("caution", [])
        grade = grade_label.get(ev.get("grade", ""), "")

        h_rule(_BORDER, 0.2)

        # 이름 행
        pdf.set_font(_font, "B", 11)
        pdf.set_text_color(*_DARK)
        name_text = f"{i}. {supp.get('emoji', '')} {supp['name']}"
        pdf.cell(W * 0.6, 6, name_text, align="L")

        # 뱃지 (onset + grade)
        badge_parts = []
        if onset:
            badge_parts.append(f"⏱ {onset} 후 체감")
        if grade:
            badge_parts.append(grade)
        if badge_parts:
            pdf.set_font(_font, "", 8)
            pdf.set_text_color(*_GRAY)
            pdf.cell(W * 0.4, 6, "  ".join(badge_parts), align="R")
        pdf.ln(6)

        # 설명
        pdf.set_x(pdf.l_margin + 4)
        pdf.set_font(_font, "", 9)
        pdf.set_text_color(*_GRAY)
        pdf.multi_cell(W - 8, 5, supp.get("description", ""), align="L")

        # 복용 가이드
        timing = dg.get("timing", "")
        amount = dg.get("amount", "")
        if timing or amount:
            dosage = f"💊 복용: {timing}"
            if amount:
                dosage += f"  /  {amount}"
            pdf.set_x(pdf.l_margin + 4)
            pdf.set_font(_font, "", 8.5)
            pdf.set_text_color(*_GRAY)
            pdf.multi_cell(W - 8, 5, dosage, align="L")

        # 매칭 증상
        if matched_symptoms:
            syms = ", ".join(matched_symptoms[:5])
            pdf.set_x(pdf.l_margin + 4)
            pdf.set_font(_font, "", 8.5)
            pdf.set_text_color(*_GRAY)
            pdf.multi_cell(W - 8, 5, f"🎯 매칭 증상: {syms}", align="L")

        # 주의사항
        if cautions:
            pdf.set_x(pdf.l_margin + 4)
            pdf.set_font(_font, "", 8.5)
            pdf.set_text_color(214, 48, 49)
            pdf.multi_cell(W - 8, 5, f"⚠️ {cautions[0]}", align="L")

        pdf.ln(2)

    pdf.ln(4)

    # ════════════════════════════════════════════════════════════════
    # ⑤ 월간 비용
    # ════════════════════════════════════════════════════════════════
    if monthly["pills_per_day"] > 0:
        if pdf.get_y() > 240:
            pdf.add_page()
        section_title("예상 월간 비용 & 복용 계획")

        cost_min = f"{monthly['cost_min']:,}"
        cost_max = f"{monthly['cost_max']:,}"
        pills = monthly["pills_per_day"]

        pdf.set_fill_color(*_COST_BG)
        pdf.set_draw_color(*_PURPLE)
        pdf.set_line_width(0.4)
        box_y2 = pdf.get_y()
        box_h2 = 18
        pdf.rect(pdf.l_margin, box_y2, W, box_h2, style="FD")

        pdf.set_xy(pdf.l_margin + 4, box_y2 + 3)
        pdf.set_font(_font, "", 8)
        pdf.set_text_color(*_GRAY)
        pdf.cell(W / 2 - 4, 5, "월간 예상 비용")
        pdf.cell(W / 2, 5, "하루 복용량", ln=True)

        pdf.set_xy(pdf.l_margin + 4, box_y2 + 8)
        pdf.set_font(_font, "B", 13)
        pdf.set_text_color(*_PURPLE)
        pdf.cell(W / 2 - 4, 6, f"{cost_min}~{cost_max}원")
        pdf.cell(W / 2, 6, f"{pills}정·캡슐", ln=True)

        pdf.set_y(box_y2 + box_h2 + 2)
        items_text = "  ".join(
            f"{it['name']} {it['pills']}{it['unit']}"
            for it in monthly.get("items", [])
        )
        if items_text:
            pdf.set_x(pdf.l_margin + 2)
            pdf.set_font(_font, "", 8)
            pdf.set_text_color(*_GRAY)
            pdf.multi_cell(W - 4, 5, items_text, align="L")
        pdf.ln(3)

    # ════════════════════════════════════════════════════════════════
    # ⑥ 성분 중복 경고
    # ════════════════════════════════════════════════════════════════
    if toxicity_warnings:
        if pdf.get_y() > 245:
            pdf.add_page()
        section_title("성분 중복 경고", color=(230, 81, 0))

        pdf.set_fill_color(*_WARN_BG)
        pdf.set_draw_color(*_WARN_BOR)
        pdf.set_line_width(0.4)
        warn_y = pdf.get_y()
        warn_h = len(toxicity_warnings) * 7 + 4
        pdf.rect(pdf.l_margin, warn_y, W, warn_h, style="FD")

        for j, tw in enumerate(toxicity_warnings):
            pdf.set_xy(pdf.l_margin + 4, warn_y + 3 + j * 7)
            pdf.set_font(_font, "", 8.5)
            pdf.set_text_color(*_DARK)
            # markdown 볼드(**text**) 제거
            clean = tw.replace("**", "")
            pdf.multi_cell(W - 8, 5, f"🛡️ {clean}", align="L")
        pdf.set_y(warn_y + warn_h + 3)

    # ════════════════════════════════════════════════════════════════
    # ⑦ Food-First 처방
    # ════════════════════════════════════════════════════════════════
    if food_advices:
        if pdf.get_y() > 245:
            pdf.add_page()
        section_title("Food-First 처방", color=_GREEN)
        for advice in food_advices:
            pdf.set_x(pdf.l_margin + 4)
            pdf.set_font(_font, "", 9)
            pdf.set_text_color(*_DARK)
            pdf.multi_cell(W - 8, 5, f"• {advice}", align="L")
        pdf.ln(3)

    # ════════════════════════════════════════════════════════════════
    # ⑧ 면책 조항
    # ════════════════════════════════════════════════════════════════
    pdf.ln(4)
    h_rule(_BORDER, 0.2)
    pdf.set_font(_font, "", 7.5)
    pdf.set_text_color(*_GRAY)
    pdf.multi_cell(
        W, 4.5,
        "※ 본 분석 결과는 일반적인 건강 정보 제공 목적이며, 의학적 진단·처방·치료를 대체하지 않습니다. "
        "개인의 건강 상태에 따라 전문 의료진과 상담하시기 바랍니다.",
        align="C",
    )

    return bytes(pdf.output())
