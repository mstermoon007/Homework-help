#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""单题质量审计 · 扩展维度（只读分析，不修改任何源数据）

输入：
  1) /tmp/audit-single-question.json   —— 1566 行基础五维审计结果（rows 含 prompt/answer/explanation/graphic/data）
  2) shared/knowledge/index/index.json —— KP 名称索引（byId）
输出：
  audit/single-question-quality-20261031/summary.json
"""
import json, re, os, collections

ROOT = "/Users/zhanggaozhang/Code/Homework Help"
OUT = os.path.join(ROOT, "audit/single-question-quality-20261031")
SRC = "/tmp/audit-single-question.json"

data = json.load(open(SRC, encoding="utf-8"))
rows = data["rows"]
idx = json.load(open(os.path.join(ROOT, "shared/knowledge/index/index.json"), encoding="utf-8"))
KP = idx.get("byId", {})

PASS, FAIL, WATCH, NA = "PASS", "FAIL", "WATCH", "NA"


def nums(text):
    """提取题面/解析中的阿拉伯数字，剔除年份与序号标记（1）2））。"""
    t = re.sub(r"\d+\s*[）)]\s*(?=[；;。，,\s]|\d)", " ", text or "")
    out = []
    for m in re.finditer(r"(?<![0-9.])([0-9]+(?:\.[0-9]+)?)", t or ""):
        raw = m.group(1)
        if len(raw.replace(".", "")) >= 11:   # 身份证/电话/编码，不是数值
            continue
        v = float(raw)
        if 1900 <= v <= 2100 and "." not in m.group(1):
            continue
        out.append(v)
    return out


def norm(s):
    return re.sub(r"[\s，,。；;：:（）()【】\[\]“”\"'、]", "", str(s or ""))


# ---------- X1 年级适配 ----------
CEIL = {1: 100, 2: 10000, 3: 10000, 4: 100000000, 5: 100000000, 6: 1e18}


def x1(row, flags):
    g = row.get("grade")
    p = row.get("prompt") or ""
    n = nums(p)
    if not g or g not in CEIL:
        return NA
    top = max(n) if n else 0
    if top > CEIL[g]:
        flags.append(("X1", WATCH, "数值超出年级上限 %s>%s" % (int(top), CEIL[g])))
        return WATCH
    if g == 1 and re.search(r"[×÷]", p):
        flags.append(("X1", FAIL, "一年级出现乘除运算"))
        return FAIL
    if g <= 5 and re.search(r"[%％]", p):
        flags.append(("X1", FAIL, "百分数早于六年级"))
        return FAIL
    if g <= 5 and re.search(r"负\s*[0-9]|负\s*[一二三四五六七八九十]", p):
        flags.append(("X1", FAIL, "负数早于六年级"))
        return FAIL
    if g <= 2 and re.search(r"[0-9]\.[0-9]", p):
        flags.append(("X1", WATCH, "小数早于三年级（小数的初步认识在三年级下册）"))
        return WATCH
    if g == 2 and re.search(r"([0-9]{2,})\s*[×÷]\s*([0-9]{2,})", p):
        flags.append(("X1", WATCH, "二年级两位数乘除超出表内范围"))
        return WATCH
    return PASS


# ---------- X2 知识点对齐 ----------
TOPIC = [
    ("折线", r"折线"), ("条形", r"条形"), ("统计", r"统计|数据|图|表"),
    ("分数", r"分数|[0-9]/[0-9]|几分之|分之"), ("小数", r"小数|[0-9]\.[0-9]"),
    ("百分数", r"百分数|[%％]|折|成数|利率|税率"), ("面积", r"面积|平方|表面|大小"),
    ("体积", r"体积|立方|容积|升|毫升"), ("周长", r"周长|一周|一圈"), ("对称", r"对称|平移|旋转"),
    ("负数", r"负"), ("比例", r"比例|[0-9]\s*[:∶]\s*[0-9]"), ("方程", r"方程|字母|未知数"),
    ("圆", r"圆|半径|直径|扇形|球"), ("角度", r"角|度|观察|视图|正面|上面|侧面"), ("时间", r"时|分|秒|年|月|日|经过"),
    ("长度", r"长度|长|刻度|厘米|毫米|米|尺"), ("货币", r"元|角|钱|人民币|价钱"),
]


def x2(row, flags):
    name = (KP.get(row["kp"]) or {}).get("name") or ""
    text = " ".join([row.get("prompt") or "", row.get("explanation") or "", str(row.get("answerValue") or "")])
    hits = [kw for kw, rx in TOPIC if kw in name]
    if not hits:
        return NA
    matched = [kw for kw in hits if re.search(dict(TOPIC)[kw], text)]
    if matched:
        return PASS
    flags.append(("X2", WATCH, "KP「%s」主题(%s)未在题面/解析/答案出现" % (name, "/".join(hits))))
    return WATCH


# ---------- X3 干扰项质量 ----------
def x3(row, flags):
    if row.get("questionType") != "choice":
        return NA
    d = row.get("data") or {}
    opts = d.get("options")
    ans = str(row.get("answerValue") or "")
    if not isinstance(opts, list) or len(opts) == 0:
        flags.append(("X3", FAIL, "选择题缺少选项"))
        return FAIL
    st = PASS
    if len(opts) != 4:
        flags.append(("X3", WATCH, "选项数为 %d（标准 4）" % len(opts)))
        st = WATCH
    keys = [norm(o) for o in opts]
    if len(set(keys)) != len(keys):
        flags.append(("X3", FAIL, "存在重复选项"))
        st = FAIL
    ci = d.get("correctIndex")
    if not isinstance(ci, int) or ci < 0 or ci >= len(opts):
        flags.append(("X3", FAIL, "correctIndex 缺失或越界"))
        st = FAIL
    else:
        if norm(opts[ci]) != norm(ans):
            flags.append(("X3", FAIL, "correctIndex 指向与答案不一致"))
            st = FAIL
    if any(re.search(r"以上(都|均)|都不对|全部", str(o)) for o in opts):
        flags.append(("X3", WATCH, "含「以上都不对」型选项"))
        st = WATCH if st == PASS else st
    # 数值型干扰项是否与正确答案同值（换单位/换写法）
    if re.match(r"^-?[0-9.]+$", ans.strip()):
        try:
            av = float(ans)
            same = [o for o in opts if re.match(r"^-?[0-9.]+$", str(o).strip()) and abs(float(o) - av) < 1e-9]
            if len(same) > 1:
                flags.append(("X3", FAIL, "同值选项重复（%s）" % ",".join(same)))
                st = FAIL
        except Exception:
            pass
    return st


# ---------- X4 解析质量 ----------
TEMPLATE_PREFIX = ("我们之前学过〈", "把〈", "结合起来看")


def x4(row, flags):
    exp = str(row.get("explanation") or "")
    ans = str(row.get("answerValue") or "")
    qt = row.get("questionType")
    if not exp.strip():
        flags.append(("X4", FAIL, "解析为空"))
        return FAIL
    st = PASS
    if len(exp) < 8:
        flags.append(("X4", FAIL, "解析过短（%d 字）" % len(exp)))
        st = FAIL
    elif len(exp) < 15:
        flags.append(("X4", WATCH, "解析偏短（%d 字）" % len(exp)))
        st = WATCH
    if re.search(r"(?<![\d/])(?:1/1|5/5|9/1)(?![\d/])|约分得\s*1/1|2/4\s*=\s*2/4", exp):
        flags.append(("X4", FAIL, "解析含未约分/错误化归表达"))
        st = FAIL
    if any(t in exp for t in TEMPLATE_PREFIX):
        flags.append(("X4", WATCH, "解析为跨 KP 通用模板，未针对本题"))
        st = WATCH if st == PASS else st
    if qt in ("calc", "fill") and re.match(r"^-?[0-9./]+$", ans.strip()):
        key = norm(ans)
        if key and key not in norm(exp):
            # 解析里允许以分数/小数等价形式出现，做一次宽松判定
            if ans not in exp and norm(ans) not in norm(exp):
                flags.append(("X4", WATCH, "解析未出现最终答案"))
                st = WATCH if st == PASS else st
    if qt == "calc" and "=" not in exp:
        flags.append(("X4", WATCH, "计算题解析无等式过程"))
        st = WATCH if st == PASS else st
    # 解析与题面高度重复（复述题面）
    sim = prompt_sim(exp, row.get("prompt") or "")
    if sim > 0.75:
        flags.append(("X4", WATCH, "解析与题面重复度过高（%.2f）" % sim))
        st = WATCH if st == PASS else st
    return st


def prompt_sim(a, b):
    """字符二元组 Jaccard"""
    def bg(s):
        s = re.sub(r"[\s，,。；;：:（）()？?！!____¥%％/]", "", s or "")
        return set(s[i:i + 2] for i in range(len(s) - 1))
    A, B = bg(a), bg(b)
    if not A or not B:
        return 0.0
    return len(A & B) / len(A | B)


# ---------- X5 题型-答案形式匹配 ----------
def x5(row, flags):
    qt = row.get("questionType")
    p = row.get("prompt") or ""
    ans = str(row.get("answerValue") or "")
    if qt == "judge":
        if ans not in ("true", "false", "对", "错"):
            flags.append(("X5", FAIL, "判断题答案非布尔值：%s" % ans[:20]))
            return FAIL
        if re.search(r"____", p):
            flags.append(("X5", WATCH, "判断题题干残留填空位"))
            return WATCH
        return PASS
    if qt == "choice":
        d = row.get("data") or {}
        opts = d.get("options") or []
        if ans not in [str(o) for o in opts]:
            flags.append(("X5", FAIL, "答案不在选项集合内"))
            return FAIL
        return PASS
    if qt == "fill":
        blanks = len(re.findall(r"(?<!在\s)____", p)) + len(re.findall(r"[（(]\s*[）)]", p))
        parts = [x for x in re.split(r"[，,；;]", ans) if x.strip()]
        if blanks >= 2 and len(parts) < blanks:
            flags.append(("X5", WATCH, "%d 空但答案仅 %d 段" % (blanks, len(parts))))
            return WATCH
        if blanks == 0:
            flags.append(("X5", FAIL, "填空题无作答空位"))
            return FAIL
        return PASS
    if qt == "calc":
        if re.search(r"____", p):
            return PASS
        return PASS
    return NA


# ---------- X6 单位与量纲 ----------
UNIT_RX = r"(元|角|分|厘米|毫米|米|千米|分米|平方厘米|平方分米|平方米|平方千米|立方厘米|立方分米|立方米|千克|克|吨|分钟|秒|小时|天|个|本|人|页|度|℃|%)"


def unit_omitted(row):
    """题面以「多少<单位>？」结尾、答案为纯数值 → 单位靠题干隐含（记录为口径提示，不判缺陷）"""
    p = row.get("prompt") or ""
    ans = str(row.get("answerValue") or "")
    m = re.search(r"(?:是多少|多少|几)([^？?。，,；;]{0,6})[？?]", p)
    if not m:
        return False
    u = m.group(1).strip()
    if not re.search(UNIT_RX, u):
        return False
    return not re.search(UNIT_RX, ans) and bool(re.match(r"^-?[0-9./]+$", ans.strip()))


def x6(row, flags):
    p = row.get("prompt") or ""
    ans = str(row.get("answerValue") or "")
    m = re.search(r"(?:是多少|多少|几)([^？?。，,；;]{0,6})[？?]", p)
    if not m:
        return NA
    u = m.group(1).strip()
    if not re.search(UNIT_RX, u):
        return NA
    mu = re.search(UNIT_RX, u).group(1)
    if re.search(UNIT_RX, ans):
        au = re.search(UNIT_RX, ans).group(1)
        if au != mu and not (mu == "米" and au in ("分米", "厘米")):
            flags.append(("X6", WATCH, "答案单位 %s ≠ 题干单位 %s" % (au, mu)))
            return WATCH
        return PASS
    return PASS


# ---------- X7 数据自洽 ----------
def x7(row, flags):
    d = row.get("data") or {}
    qt = row.get("questionType")
    st = PASS
    if qt == "choice":
        opts = d.get("options") or []
        ci = d.get("correctIndex")
        ans = str(row.get("answerValue") or "")
        if isinstance(ci, int) and 0 <= ci < len(opts) and norm(opts[ci]) != norm(ans):
            flags.append(("X7", FAIL, "correctIndex 与 answer 不一致"))
            st = FAIL
    if (str(d.get("mode")) == "classify" or qt == "classify"):
        groups = d.get("groups") or {}
        items = d.get("items") or []
        if isinstance(groups, dict) and groups and items:
            union = set()
            for v in groups.values():
                union |= set(str(x) for x in v)
            if union != set(str(x) for x in items):
                flags.append(("X7", FAIL, "分类分组与题目清单不一致"))
                st = FAIL
    # 图表数据自洽
    g = row.get("graphic") or (d.get("graphic"))
    if isinstance(g, dict) and g.get("type") == "chart":
        pts = ((g.get("params") or {}).get("data")) or []
        if pts:
            labels = [str(x.get("label")) for x in pts if isinstance(x, dict)]
            if len(set(labels)) != len(labels):
                flags.append(("X7", FAIL, "图表标签重复"))
                st = FAIL
            for x in pts:
                if not isinstance(x, dict):
                    flags.append(("X7", FAIL, "图表点非对象"))
                    st = FAIL
                    break
                vals = [x.get("value")] if "value" in x else [x.get("a"), x.get("b")]
                if not all(isinstance(v, (int, float)) for v in vals if v is not None):
                    flags.append(("X7", FAIL, "图表值非数值"))
                    st = FAIL
                    break
    if qt == "judge" and str(d.get("mode")) == "classify":
        flags.append(("X7", WATCH, "判断题实为分类元判断模板"))
        st = WATCH if st == PASS else st
    return st


# ---------- X8 难度一致性 ----------
def x8(row, flags):
    p = row.get("prompt") or ""
    d = row.get("data") or {}
    steps = d.get("steps")
    ops = len(re.findall(r"[+\-−×÷]", re.sub(r"负|−5", "", p)))
    st = PASS
    if isinstance(steps, int) and steps >= 2 and ops < 2:
        # 文字多步题不必然有多个符号，仅在纯算式题上判
        if re.search(r"[0-9]\s*[+\-−×÷]\s*[0-9]", p) and "/" not in p:
            flags.append(("X8", WATCH, "标记 %d 步但仅 %d 个运算符" % (steps, ops)))
            st = WATCH
    g = row.get("grade") or 0
    ns = nums(p)
    pure = bool(re.match(r"^\s*(?:[0-9./]+\s*[+\-−×÷]\s*)+[0-9./]+\s*=\s*[？?]\s*$", p))
    if g >= 4 and pure and len(ns) >= 2 and max(ns) <= 10 and ops <= 1:
        flags.append(("X8", WATCH, "高年级 d3 纯算式仍为个位数单步"))
        st = WATCH if st == PASS else st
    return st


# ---------- X9 语言与格式 ----------
def x9(row, flags):
    p = row.get("prompt") or ""
    exp = row.get("explanation") or ""
    st = PASS
    bad = [
        (r"[？?]{2,}|[。！]{2,}|[，,]{2,}", "重复标点"),
        (r"（参考：", "题面残留「（参考：…）」脚手架"),
        (r"[（(]\s*标出\s*[0-9]", "题面残留「标出 Ncm」脚手架"),
        (r"列式[^：]*：.*列式：", "题面重复「列式」"),
        (r"[0-9]\.\s*(?:[？?。]|\s|$)", "数字尾部多余小数点"),
        (r"，，|。。|；；", "重复分隔符"),
        (r"\?\s*\?", "连续问号"),
    ]
    for rx, msg in bad:
        if re.search(rx, p):
            flags.append(("X9", WATCH, msg))
            st = WATCH if st == PASS else st
    if p != p.strip():
        flags.append(("X9", WATCH, "题面首尾空白"))
        st = WATCH if st == PASS else st
    if re.search(r"[A-Za-z0-9]\s{2,}[A-Za-z0-9]", p):
        flags.append(("X9", WATCH, "题面存在多空格"))
        st = WATCH if st == PASS else st
    return st


DIMS = [("X1", "年级适配", x1), ("X2", "知识点对齐", x2), ("X3", "干扰项质量", x3),
        ("X4", "解析质量", x4), ("X5", "题型-答案形式匹配", x5), ("X6", "单位与量纲", x6),
        ("X7", "数据自洽", x7), ("X8", "难度一致性", x8), ("X9", "语言与格式", x9)]

summary = {k: collections.Counter() for k, _, _ in DIMS}
results = []
unit_omitted_count = 0
for row in rows:
    if unit_omitted(row):
        unit_omitted_count += 1
    rec = {"kp": row["kp"], "qt": row.get("questionType"), "grade": row.get("grade"),
           "prompt": row.get("prompt"), "answer": row.get("answerValue"), "dims": {}, "flags": []}
    for key, label, fn in DIMS:
        f = []
        st = fn(row, f)
        rec["dims"][key] = st
        summary[key][st] += 1
        for dk, sev, msg in f:
            rec["flags"].append({"dim": dk, "sev": sev, "msg": msg})
    results.append(rec)

# 维度名称补入汇总
dim_meta = {k: {"label": lab, "counts": dict(summary[k])} for k, lab, _ in DIMS}

# 选择项正确位置分布
pos = collections.Counter()
for row in rows:
    if row.get("questionType") == "choice":
        ci = (row.get("data") or {}).get("correctIndex")
        if isinstance(ci, int):
            pos[ci] += 1

# 年级 / 题型分布
by_grade = collections.Counter(r.get("grade") for r in rows)
by_qt = collections.Counter(r.get("questionType") for r in rows)

# 缺陷聚合（按 KP）
kpfail = collections.Counter()
for rec in results:
    for f in rec["flags"]:
        if f["sev"] == "FAIL":
            kpfail[rec["kp"]] += 1

out = {
    "meta": {"total": len(rows), "source": SRC, "generatedBy": "audit/single-question-quality-20261031/analyze_extended.py"},
    "dims": dim_meta,
    "choicePosition": dict(pos),
    "byGrade": dict(by_grade),
    "byQuestionType": dict(by_qt),
    "topFailingKp": kpfail.most_common(20),
    "unitOmitted": unit_omitted_count,
    "rows": results,
}
json.dump(out, open(os.path.join(OUT, "summary.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# 控制台摘要
print("total", len(rows))
for k, lab, _ in DIMS:
    print(k, lab, dict(summary[k]))
print("choice positions", dict(pos))
print("FAIL flags by kp", kpfail.most_common(12))
