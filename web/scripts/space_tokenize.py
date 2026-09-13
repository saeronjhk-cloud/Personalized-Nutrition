"""
세션53 · UI 토큰 이행 4단계 — 간격 리터럴 → --space-* 토큰 (값이 «정확히 같은» 것만)

원칙: 치환 후 픽셀이 같은 경우에만 바꾼다(규칙86). 4·8·12·16·20·24·32·48 만 대상.
6·10·14·18·40 등 토큰 값과 다른 숫자는 손대지 않는다 — 그건 카드 단위로 눈 확인하며 옮긴다.

사용:
  python scripts/space_tokenize.py            드라이런(파일별 건수만)
  python scripts/space_tokenize.py --apply    실제 치환
"""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent / "src"
TOK = {4: "--space-1", 8: "--space-2", 12: "--space-3", 16: "--space-4",
       20: "--space-5", 24: "--space-6", 32: "--space-8", 48: "--space-12"}
PROPS = r"(margin|marginTop|marginBottom|marginLeft|marginRight|padding|paddingTop|paddingBottom|paddingLeft|paddingRight|gap|rowGap|columnGap)"

# 1) 단일 숫자:   marginBottom: 16   /  gap: 8
RE_NUM = re.compile(PROPS + r"(\s*:\s*)(\d+)(?=\s*[,}\)])")
# 2) 문자열 shorthand: padding: '8px 16px'  /  margin: '0 auto 16px'
RE_STR = re.compile(PROPS + r"(\s*:\s*)(['\"])([^'\"]*?)\3")

def tok_px(m):
    n = int(m.group(1))
    return f"var({TOK[n]})" if n in TOK else m.group(0)

def conv_shorthand(s):
    # '8px 16px' → 'var(--space-2) var(--space-4)'.  0·auto·% 등은 그대로.
    # 한 문자열 안에 토큰화 불가 값이 섞여도 가능한 것만 바꾼다(픽셀 동일).
    return re.sub(r"\b(\d+)px\b", tok_px, s)

def process(text):
    n = 0
    def r_num(m):
        nonlocal n
        v = int(m.group(3))
        if v in TOK:
            n += 1
            return f"{m.group(1)}{m.group(2)}'var({TOK[v]})'"
        return m.group(0)
    def r_str(m):
        nonlocal n
        new = conv_shorthand(m.group(4))
        if new != m.group(4):
            n += new.count("var(") - m.group(4).count("var(")
            return f"{m.group(1)}{m.group(2)}{m.group(3)}{new}{m.group(3)}"
        return m.group(0)
    text = RE_NUM.sub(r_num, text)
    text = RE_STR.sub(r_str, text)
    return text, n

def main():
    apply = "--apply" in sys.argv
    total = 0
    for f in sorted(ROOT.rglob("*.tsx")):
        src = f.read_text(encoding="utf-8")
        out, n = process(src)
        if n:
            total += n
            print(f"{n:4d}  {f.relative_to(ROOT)}")
            if apply:
                f.write_text(out, encoding="utf-8", newline="")
    print(f"{'적용' if apply else '드라이런'} 합계 {total}")

if __name__ == "__main__":
    main()
