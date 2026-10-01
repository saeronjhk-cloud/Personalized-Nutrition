# -*- coding: utf-8 -*-
"""한식 끼니 문법 P1 — role 사전 생성기 (웹앱트랙 · 설계 IP/integration/meal_grammar_p1_design_v1.md)
입력: backends/NutriLens/training/aihub_400_코드매핑.tsv (AI Hub 음식분류 400종)
출력: IP/meal_role_dictionary_v1.json (정본) — 코드 복사본은 web/src/domain/coaching/ 로 cp.
의미론은 web/src/domain/coaching/meal_role.ts 와 동일해야 한다(평가 R·D).
  resolve(name): 정규화 → entries 정확 일치 → 아니면 rules 전부 평가해 합집합 → OTHER 는 단독일 때만 남김 → 없으면 UNKNOWN
"""
import json, re, sys, unicodedata, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
TSV = ROOT / "backends/NutriLens/training/aihub_400_코드매핑.tsv"
OUT = ROOT / "IP/meal_role_dictionary_v1.json"

ROLE_ORDER = ["RICE", "NOODLE", "GRAIN_OTHER", "PROTEIN", "VEG", "KIMCHI", "PICKLE", "BROTH",
              "ALCOHOL", "SNACK_SWEET", "FRUIT", "BEVERAGE", "OTHER"]

def C(p, roles, unless=()):  # contains
    return {"m": "c", "p": p, "r": roles if isinstance(roles, list) else [roles], **({"u": list(unless)} if unless else {})}
def E(p, roles, unless=()):  # endswith
    return {"m": "e", "p": p, "r": roles if isinstance(roles, list) else [roles], **({"u": list(unless)} if unless else {})}

RULES = []
# 주식
RULES += [E("밥", "RICE"), C("덮밥", "RICE"), C("국밥", ["RICE", "BROTH"]), C("김밥", "RICE"), C("초밥", "RICE"),
          C("라이스", "RICE"), C("리조또", "RICE"), C("백반", "RICE"), E("죽", "RICE"), E("롤", "RICE", ["케이크", "스프링"])]
RULES += [C(p, "NOODLE") for p in ["라면", "국수", "냉면", "우동", "짬뽕", "짜장면", "자장면", "칼국수", "쫄면", "파스타",
                                   "스파게티", "쌀국수", "소바", "막국수", "수제비", "만두", "떡국", "라볶이", "만둣국"]]
RULES += [E("면", "NOODLE")]
RULES += [C(p, "GRAIN_OTHER") for p in ["빵", "토스트", "샌드위치", "베이글", "시리얼", "그래놀라", "오트밀", "피자",
                                        "핫도그", "크루아상", "크로와상", "와플", "팬케이크", "또띠아", "부리또", "타코"]]
RULES += [C("떡", "GRAIN_OTHER", ["떡갈비", "떡국", "떡만둣국", "떡라면"]), C("고구마", "GRAIN_OTHER", ["맛탕", "줄기"])]
# 단백질 — 이름-재료 원칙
PROT = ["달걀", "계란", "메추리알", "에그", "오믈렛", "스크램블", "두부", "비지", "청국장", "낫토",
        "생선", "고등어", "삼치", "갈치", "꽁치", "조기", "굴비", "가자미", "명태", "동태", "북어", "황태", "코다리", "대구",
        "광어", "우럭", "도미", "농어", "장어", "연어", "참치", "멸치", "아귀", "새우", "오징어", "낙지", "문어", "주꾸미",
        "쭈꾸미", "한치", "꼬막", "조개", "바지락", "홍합", "전복", "게살", "꽃게", "게장", "골뱅이", "해물", "해산물",
        "어묵", "육회", "물회", "회덮밥", "회무침", "회냉면", "고기", "소고기", "쇠고기", "돼지", "제육", "불고기", "갈비",
        "삼겹", "목살", "항정", "수육", "족발", "보쌈", "편육", "순대", "곱창", "막창", "대창", "닭", "치킨", "오리",
        "베이컨", "소시지", "소세지", "햄", "스테이크", "미트", "너겟", "가스", "까스", "커틀릿", "육전", "육포", "차돌",
        "등심", "안심", "소머리", "탕수육", "깐풍기", "유린기", "동그랑땡", "선지", "뼈다귀", "뼈해장", "홍어", "쥐포", "우렁",
        "우유", "요거트", "요구르트", "치즈", "두유", "프로틴", "단백질"]
RULES += [C(p, "PROTEIN") for p in PROT]
RULES += [C("콩", "PROTEIN", ["콩나물"]), C("굴", "PROTEIN", ["굴소스"]), E("회", "PROTEIN")]
# 채소 (김치·장아찌·피클 제외)
VEG = ["나물", "샐러드", "상추", "시금치", "숙주", "고사리", "도라지", "취나물", "미나리", "가지", "버섯", "브로콜리",
       "당근", "파프리카", "피망", "양상추", "케일", "채소", "야채", "생채", "우엉", "연근", "시래기", "우거지",
       "근대", "아욱", "쑥갓", "냉이", "달래", "더덕", "봄동", "청경채", "아스파라거스", "셀러리", "노각", "콩나물", "열무", "얼갈이", "쑥갓", "머위", "고들빼기잎"]
RULES += [C(p, "VEG") for p in VEG]
RULES += [C("쌈", "VEG", ["쌈장"]), C("배추", "VEG", ["김치", "겉절이"]), C("호박", "VEG", ["호박씨"]),
          C("오이", "VEG", ["소박이", "오이지", "피클"]), C("깻잎", "VEG", ["김치", "장아찌"]),
          C("고추", "VEG", ["고추장", "고춧", "장아찌"]), C("양파", "VEG", ["장아찌"]), C("양배추", "VEG"), C("부추", "VEG", ["김치"]), C("토마토", "VEG", ["소스", "스프", "케첩"])]
# 김치·장아찌
RULES += [E("김치", "KIMCHI")] + [C(p, "KIMCHI") for p in ["깍두기", "겉절이", "동치미", "소박이", "섞박지"]]
RULES += [C(p, "PICKLE") for p in ["장아찌", "피클", "단무지", "오이지", "젓갈"]] + [E("젓", "PICKLE")]
# 국물
RULES += [E("국", "BROTH"), E("탕", "BROTH", ["맛탕", "사탕", "설탕"]), C("찌개", "BROTH"), C("전골", "BROTH"),
          C("스프", "BROTH"), C("수프", "BROTH"), C("해장국", "BROTH"), C("냉국", "BROTH")]
# 기타
RULES += [C(p, "ALCOHOL") for p in ["맥주", "소주", "막걸리", "와인", "위스키", "사케", "하이볼", "칵테일", "보드카",
                                    "고량주", "청주", "동동주", "소맥"]]
RULES += [C(p, "SNACK_SWEET") for p in ["콜라", "사이다", "탄산", "주스", "에이드", "스무디", "밀크티", "버블티", "과자",
                                        "쿠키", "케이크", "초콜릿", "초코", "아이스크림", "빙수", "도넛", "마카롱", "젤리",
                                        "맛탕", "약과", "유과", "한과", "시럽", "프라푸치노", "식혜", "수정과"]]
RULES += [C("사탕", "SNACK_SWEET")]
RULES += [C(p, "FRUIT") for p in ["사과", "바나나", "딸기", "귤", "오렌지", "포도", "수박", "참외", "키위", "블루베리",
                                  "망고", "복숭아", "자두", "체리", "파인애플", "과일", "멜론"]]
RULES += [C(p, "BEVERAGE") for p in ["커피", "아메리카노", "라떼", "에스프레소", "녹차", "홍차", "보리차", "생수"]]
RULES += [E("전", "OTHER"), C("부침", "OTHER"), C("튀김", "OTHER"), C("볶음", "OTHER"), C("조림", "OTHER"),
          C("구이", "OTHER"), E("찜", "OTHER"), C("잡채", "OTHER"), C("감자", "OTHER"), C("묵", "OTHER")]

def norm(s: str) -> str:
    s = unicodedata.normalize("NFC", s or "")
    s = re.sub(r"\([^)]*\)", "", s)
    s = re.sub(r"\s+", "", s)
    return s.lower()

def apply_rules(n: str) -> list:
    out = set()
    if not n:
        return []
    for r in RULES:
        hit = (r["p"] in n) if r["m"] == "c" else n.endswith(r["p"])
        if hit and not any(u in n for u in r.get("u", [])):
            out.update(r["r"])
    if len(out) > 1:
        out.discard("OTHER")
    return [x for x in ROLE_ORDER if x in out]

# 중분류 기본 role
CAT = {
    "쌀밥류": "RICE", "잡곡밥류": "RICE", "채소밥류": "RICE", "비빔밥,볶음밥류": "RICE", "덮밥,국밥류": "RICE", "김밥/초밥": "RICE",
    "면류": "NOODLE", "만두류": "NOODLE", "죽류": "RICE", "스프류": "BROTH",
    "맑은국류": "BROTH", "된장국류": "BROTH", "곰국/탕류": "BROTH", "냉국류": "BROTH", "어패류찌개": "BROTH", "육류찌개": "BROTH",
    "된장찌개류": "BROTH", "전골류": "BROTH", "김치류": "KIMCHI", "장아찌류": "PICKLE", "젓갈류": "PICKLE",
    "떡류": "GRAIN_OTHER", "한과류": "SNACK_SWEET", "숙채류": "VEG", "생채류": "VEG", "샐러드류": "VEG", "어패류무침": "PROTEIN",
    "육류무침": "OTHER", "육류구이": "PROTEIN", "생선구이": "PROTEIN", "어패류전": "PROTEIN", "육류전": "PROTEIN",
    "채소류전": "OTHER", "어패류볶음": "PROTEIN", "채소류볶음": "VEG", "육류, 난류볶음": "PROTEIN", "어패류조림": "PROTEIN",
    "난류조림": "PROTEIN", "육류조림": "PROTEIN", "두류조림": "PROTEIN", "채소류조림": "VEG", "어패류튀김": "PROTEIN",
    "육류튀김": "PROTEIN", "채소, 해조류튀김": "OTHER", "어패류찜": "PROTEIN", "육류찜": "PROTEIN", "어패류": "PROTEIN", "육류": "PROTEIN",
}
# 수기 예외(최종값) — 이름-재료 원칙의 예외·카테고리 오류 교정. 근거는 설계 §1.
OVERRIDE = {
    "치즈라면": ["NOODLE"], "유부초밥": ["RICE"], "치즈김밥": ["RICE"], "알밥": ["RICE"], "김치김밥": ["RICE"],
    "샐러드김밥": ["RICE"], "짬뽕밥": ["RICE"], "자장밥": ["RICE"], "잡채밥": ["RICE"], "잡탕밥": ["RICE", "PROTEIN"],
    "산채비빔밥": ["RICE", "VEG"], "열무비빔밥": ["RICE", "VEG"], "전주비빔밥": ["RICE", "VEG"], "일반비빔밥": ["RICE", "VEG"],
    "곤드레밥": ["RICE", "VEG"], "감자밥": ["RICE"], "콩밥": ["RICE"], "깨죽": ["RICE"], "팥죽": ["RICE"], "잣국": ["RICE"],
    "어죽": ["RICE", "PROTEIN"], "채소죽": ["RICE", "VEG"], "호박죽": ["RICE"],
    "매운탕": ["BROTH", "PROTEIN"], "지리탕": ["BROTH", "PROTEIN"], "알탕": ["BROTH", "PROTEIN"], "연포탕": ["BROTH", "PROTEIN"],
    "곰탕": ["BROTH", "PROTEIN"], "꼬리곰탕": ["BROTH", "PROTEIN"], "설렁탕": ["BROTH", "PROTEIN"], "도가니탕": ["BROTH", "PROTEIN"],
    "내장탕": ["BROTH", "PROTEIN"], "삼계탕": ["BROTH", "PROTEIN"], "감자탕": ["BROTH", "PROTEIN"], "추어탕": ["BROTH", "PROTEIN"],
    "육개장": ["BROTH", "PROTEIN"], "부대찌개": ["BROTH", "PROTEIN"], "탕국": ["BROTH", "PROTEIN"],
    "청국장찌개": ["BROTH", "PROTEIN"], "콩비지찌개": ["BROTH", "PROTEIN"], "콩국수": ["NOODLE", "PROTEIN"],
    "고추장찌개": ["BROTH"], "김치국": ["BROTH"], "미역오이냉국": ["BROTH", "VEG"], "토란국": ["BROTH"], "감자국": ["BROTH"],
    "간장게장": ["PROTEIN"], "양념게장": ["PROTEIN"], "명란젓": ["PICKLE"], "오징어젓갈": ["PICKLE"],
    "단무지무침": ["PICKLE"], "도토리묵": ["OTHER"], "청포묵무침": ["OTHER"], "상추겉절이": ["VEG"], "해파리냉채": ["OTHER"],
    "김무침": ["OTHER"], "미역초무침": ["OTHER"], "파래무침": ["OTHER"], "무말랭이": ["VEG"], "파무침": ["VEG"],
    "마늘쫑무침": ["VEG"], "무생채": ["VEG"], "무나물": ["VEG"], "고구마줄기나물": ["VEG"],
    "감자볶음": ["OTHER"], "감자조림": ["OTHER"], "알감자조림": ["OTHER"], "땅콩조림": ["OTHER"], "김치볶음": ["KIMCHI"],
    "두부김치": ["PROTEIN", "KIMCHI"], "고추잡채": ["VEG"], "떡볶이": ["GRAIN_OTHER"], "라볶이": ["NOODLE"],
    "김치전": ["OTHER"], "감자전": ["OTHER"], "녹두빈대떡": ["OTHER"],
    "고구마맛탕": ["SNACK_SWEET"], "고구마튀김": ["OTHER"], "김말이튀김": ["OTHER"], "감자튀김": ["OTHER"],
    "쥐포튀김": ["PROTEIN"], "모래집튀김": ["PROTEIN"],
    "쥐치채": ["PROTEIN"], "햄버거스테이크": ["PROTEIN"], "쑥된장국": ["BROTH", "VEG"], "우렁된장국": ["BROTH", "PROTEIN"], "파전": ["VEG"], "아귀찜": ["PROTEIN", "VEG"], "참꼬막": ["PROTEIN"], "찜닭": ["PROTEIN"],
    "떡만둣국": ["NOODLE", "BROTH"], "만둣국": ["NOODLE", "BROTH"], "떡국": ["NOODLE", "BROTH"], "물만두": ["NOODLE"],
    "김치만두": ["NOODLE"], "군만두": ["NOODLE"], "고기만두": ["NOODLE", "PROTEIN"], "떡라면": ["NOODLE"],
    "김치라면": ["NOODLE"], "짬뽕라면": ["NOODLE"], "짜장라면": ["NOODLE"], "간자장": ["NOODLE"], "기스면": ["NOODLE"],
    "삼선자장면": ["NOODLE", "PROTEIN"], "삼선짬뽕": ["NOODLE", "PROTEIN"], "삼선우동": ["NOODLE", "PROTEIN"],
    "삼선볶음밥": ["RICE", "PROTEIN"], "콘스프": ["BROTH"], "토마토스프": ["BROTH"], "미소된장국": ["BROTH"],
}
DROP = {"categories", "생략", "음식명"}

def main():
    rows = [l.rstrip("\n").split("\t") for l in TSV.read_text(encoding="utf-8").splitlines()[1:] if l.strip()]
    entries, report = {}, []
    for code, big, mid, name in (r[:4] for r in rows if len(r) >= 4):
        key = norm(name)
        if not key or key in DROP:
            continue
        rule = apply_rules(key)
        if key in OVERRIDE:
            final = OVERRIDE[key]
        else:
            u = set(rule) | ({CAT[mid]} if mid in CAT else set())
            if len(u) > 1:
                u.discard("OTHER")
            final = [x for x in ROLE_ORDER if x in u]
        if not final:
            final = ["OTHER"]
        entries[key] = final
        report.append((mid, key, rule, final))
    for k, v in OVERRIDE.items():
        entries.setdefault(k, v)
    doc = {
        "version": "meal_role_dictionary_v1",
        "note": "정본 IP/meal_role_dictionary_v1.json · 생성 tools/gen_meal_role_dictionary.py · 설계 IP/integration/meal_grammar_p1_design_v1.md",
        "roles": ROLE_ORDER + ["UNKNOWN"],
        "entries": dict(sorted(entries.items())),
        "rules": RULES,
    }
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    if "--report" in sys.argv:
        for mid, k, rule, final in report:
            flag = "" if rule == final else "  ≠rule" + str(rule)
            print(f"{mid}\t{k}\t{','.join(final)}{flag}")
    print(f"entries={len(entries)} rules={len(RULES)} -> {OUT}", file=sys.stderr)
    return doc

if __name__ == "__main__":
    main()
