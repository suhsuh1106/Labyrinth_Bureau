"""이사회가 숫자 대신 사람을 읽고 결정하게 만드는 장치.

  - 안건: 부서장이 올리는 제안. 승인하면 조항이 바뀌거나 정치 행동을 한다. 제안에는 부서장 성향과 이기심이 섞여 있다.
  - 모순 신호: 부서 보고를 합친 값과 진짜 숫자(금고, 국가 집계)가 어긋나면 알려 준다. 계산은 게임이 한다.
  - 현장 판단: 후퇴, 큰 사상자, 정황이 생기면 부서장들이 서로 다른 해법을 들고 온다.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from org import DEPTS, GEAR_TIERS, MAX_FLOOR, PAY_TIERS, Guild, Slot, achieved
from sim import FACTION_KO, weighted_avg


def josa(word: str, with_final: str, without_final: str) -> str:
    """받침 유무에 맞는 조사를 붙인다. josa("교회", "과", "와") → "교회와"."""
    ch = word[-1]
    final = "가" <= ch <= "힣" and (ord(ch) - 0xAC00) % 28 != 0
    return word + (with_final if final else without_final)


# ------------------------------------------------------------------ 안건
@dataclass
class Proposal:
    dept: str
    say: str  # 부서장이 하는 말
    action: dict  # {"type": "kpi" | "remove_kpi" | "politics" | "audit", ...}
    effect: str  # 승인하면 무엇이 바뀌는지 (짧게)
    risk: str = ""  # 부서장이 말하지 않은 부작용 (성향에 따라 알려 줄 때만)


def desired_gear(floor: int) -> int:
    return 0 if floor <= 2 else (1 if floor <= 6 else 2)


def has_kpi(guild: Guild, dept: str, kpi: str, target: float | None = None, tighter_or_equal: bool = True) -> bool:
    for s in guild.kpis[dept]:
        if s.kpi == kpi:
            if target is None:
                return True
            kd = guild.kpi_def(kpi)
            return s.target >= target if kd["dir"] == "min" else s.target <= target
    return False


def round_to(v: float, step: float) -> float:
    return max(step, round(v / step) * step)


def explore_proposal(guild: Guild) -> Proposal | None:
    g, st = guild.game, guild.game.state
    head = guild.heads["explore"]
    floor = guild.approved_floor
    rep = guild.reports[-1] if guild.reports else None
    if rep is None:
        if head.aggression == "신중형" and not has_kpi(guild, "explore", "deaths"):
            return Proposal("explore", "첫 탐사입니다. 사망자 상한을 정해 주시면 무리하지 않겠습니다.",
                            {"type": "kpi", "dept": "explore", "kpi": "deaths", "target": 2}, "탐사부 조항: 월 탐사 사망자 ≤ 2명")
        return None
    ex = rep["details"]["explore"]["true"]
    need = g.p["factions"]["level_gauge_required"]
    req = g.p["dungeon"]["floor_state_level_required"]
    locked = floor < MAX_FLOOR and st.levels["state"] < req[floor + 1]
    used_state = ex["gauge_by_faction"].get("state", 0)
    if locked and st.gauges["state"] < need and used_state > 0:
        if head.aggression == "공격형" and st.reputation >= g.p["politics"]["actions"]["lobby"]["rep"]:
            return Proposal("explore", f"기사단 지원 없이는 못 버팁니다. 대신 국가에 로비를 해 주십시오. {floor + 1}층 허가가 나야 합니다.",
                            {"type": "politics", "key": "lobby"}, "국가 로비 (명성 60 → 국가 +10)",
                            risk=f"탐사부는 지난달 기사단 지원으로 국가 우호도를 {used_state:.0f} 썼어요")
        return Proposal("explore", f"기사단 지원을 줄이겠습니다. 국가 우호도가 +{need}은 돼야 {floor + 1}층 허가가 납니다.",
                        {"type": "kpi", "dept": "explore", "kpi": "help_limit", "target": 12},
                        "탐사부 조항: 세력 협력 우호도 사용 ≤ 12", risk="성공률이 조금 떨어져요")
    retreats = ex["weeks"] - ex["cleared"]
    gear_need = desired_gear(floor)
    if retreats >= 2 and GEAR_TIERS.index(guild.gear) < gear_need and not has_kpi(guild, "supply", "gear", gear_need):
        return Proposal("explore", f"지난달 {retreats}번 밀려났습니다. 장비만 받쳐 주시면 버팁니다.",
                        {"type": "kpi", "dept": "supply", "kpi": "gear", "target": gear_need},
                        f"보급부 조항: 장비 등급 ≥ {GEAR_TIERS[gear_need].capitalize()}", risk="보급비가 늘어요")
    if floor >= 7 and list(PAY_TIERS).index(guild.pay) < 2:
        return pay_proposal(guild, "explore", "고", f"{floor}층은 고급 인력 없이는 무리입니다.")
    # 출전 인원: 탐사부는 사람을 뽑지 못한다. 모자라면 인사부에 조항을 걸어 달라고 이사회에 요청한다
    fit = rep["true"]["ready"] if "ready" in rep["true"] else st.members - st.injured
    want = int(round_to(min(55, 10 + 3 * floor), 5))
    slot = guild.kpi_slot("hr", "ready")
    if fit < want * 0.8 and (slot is None or slot.target < want) and rep["cash"] > -3000:
        return Proposal("explore", f"지난달 출전할 수 있는 인원이 {fit:.0f}명뿐이었습니다. {floor}층은 {want}명은 있어야 제대로 벌어 옵니다.",
                        {"type": "kpi", "dept": "hr", "kpi": "ready", "target": want},
                        f"인사부 조항: 월말 출전 가능 인원 ≥ {want}명",
                        risk="인사부 모집비가 들고, 늘어난 인원만큼 월급(이사회 지급)이 늘어요")
    slot = guild.kpi_slot("explore", "progress")
    if slot and ex["progress"] < 0.8 * slot.target and head.aggression == "공격형" and has_kpi(guild, "explore", "deaths"):
        return Proposal("explore", "사망자 상한만 풀어 주시면 더 넓게 들어가서 이해도 목표를 채우겠습니다.",
                        {"type": "remove_kpi", "dept": "explore", "kpi": "deaths"},
                        "탐사부 조항에서 '월 사망자 상한' 제거", risk="사망자가 늘고 교회가 싫어해요")
    if ex["deaths"] >= 2.5 and not has_kpi(guild, "explore", "deaths") and head.aggression != "공격형":
        return Proposal("explore", f"지난달 {ex['deaths']:.0f}명을 잃었습니다. 사망자 상한을 정해 주시면 조심하겠습니다.",
                        {"type": "kpi", "dept": "explore", "kpi": "deaths", "target": 2},
                        "탐사부 조항: 월 탐사 사망자 ≤ 2명", risk="수익이 조금 줄어요")
    und = st.understanding[g.allowed_floor(floor)]
    if und < 0.7 and ex["progress"] < 0.12 and not has_kpi(guild, "explore", "progress"):
        return Proposal("explore", "같은 구역만 돌고 있습니다. 이해도 목표를 주시면 다음 층을 준비하겠습니다.",
                        {"type": "kpi", "dept": "explore", "kpi": "progress", "target": 0.2},
                        "탐사부 조항: 월 이해도 증가 ≥ 0.20", risk="당장 수익은 줄 수 있어요")
    return None


def pay_proposal(guild: Guild, dept: str, tier: str, say: str) -> Proposal:
    """보수 등급 변경 안건. 월급은 이사회가 지급하므로 이사회가 정한다."""
    cur = guild.salary_of(guild.pay)
    new = guild.salary_of(tier)
    delta = (new * weighted_avg(PAY_TIERS[tier][1], guild.game.p["adventurers"]["grade_wage_mult"])
             - cur * weighted_avg(PAY_TIERS[guild.pay][1], guild.game.p["adventurers"]["grade_wage_mult"])) * guild.game.state.members
    return Proposal(dept, say, {"type": "pay", "tier": tier},
                    f"보수 등급 {guild.pay} → {tier} (월급 1인 {cur:,.0f}G → {new:,.0f}G, 지금 인원이면 월 {delta:+,.0f}G)",
                    risk="월급은 이사회 금고에서 자동으로 나가요")


def hr_proposal(guild: Guild) -> Proposal | None:
    st = guild.game.state
    head = guild.heads["hr"]
    rep = guild.reports[-1] if guild.reports else None
    if rep is None:
        if head.aggression == "공격형":
            return Proposal("hr", "사람이 있어야 법니다. 출전 인원 목표를 20명으로 올려 주십시오.",
                            {"type": "kpi", "dept": "hr", "kpi": "ready", "target": 20},
                            "인사부 조항: 월말 출전 가능 인원 ≥ 20명", risk="모집비가 들고, 월급(이사회 지급)이 수입보다 빨리 늘 수 있어요")
        return None
    hr = rep["details"]["hr"]["true"]
    if hr["left"] >= max(3.0, 0.12 * max(st.members, 1)) and not has_kpi(guild, "hr", "left"):
        cap = round_to(max(2.0, hr["left"] * 0.6), 1)
        return Proposal("hr", f"지난달 {hr['left']:.0f}명이 떠났습니다. 이탈 상한을 걸어 주시면 처우를 챙기겠습니다.",
                        {"type": "kpi", "dept": "hr", "kpi": "left", "target": cap},
                        f"인사부 조항: 월 이탈자 ≤ {cap:.0f}명", risk="처우비만큼 인사부 예산이 더 들어요")
    if st.gauges["church"] < -20 and guild.pay == "저":
        return pay_proposal(guild, "hr", "중", "교회가 우리 길드를 박봉이라고 설교합니다. 보수를 '중'으로 올려 주십시오.")
    need = guild.game.p["rules"]["win_min_members"] + 5 if guild.approved_floor >= 8 else None
    slot = guild.kpi_slot("hr", "ready")
    if rep["cash"] > 0 and st.members < 55 and (slot is None or slot.target <= st.members + 2):
        n = int(round_to(min(60, max(need or 0, st.members + 10)), 5))
        why = f"공략에는 {guild.game.p['rules']['win_min_members']}명 이상이 필요합니다" if need and st.members < need else "여유가 생겼습니다"
        return Proposal("hr", f"{why}. 출전 인원 목표를 {n}명으로 올려 주십시오.",
                        {"type": "kpi", "dept": "hr", "kpi": "ready", "target": n},
                        f"인사부 조항: 월말 출전 가능 인원 ≥ {n}명", risk="월급(이사회 지급)이 늘어요")
    if rep["cash"] < 0:
        if head.aggression == "공격형":
            n = int(round_to(st.members + 10, 5))
            return Proposal("hr", f"사람이 부족해서 못 버는 겁니다. 출전 인원 목표를 {n}명으로 올려 주십시오.",
                            {"type": "kpi", "dept": "hr", "kpi": "ready", "target": n},
                            f"인사부 조항: 월말 출전 가능 인원 ≥ {n}명", risk="적자가 커질 수 있어요")
        if guild.pay == "고":  # 고급 인력은 지키고 머릿수로 맞춘다
            n = int(guild.game.p["rules"]["win_min_members"] + 3)
            cur = guild.kpi_slot("hr", "ready")
            if st.members > n + 2 and (cur is None or cur.target > n):
                return Proposal("hr", f"고급 인력 월급이 무겁습니다. 공략에 필요한 {n}명까지만 두겠습니다.",
                                {"type": "kpi", "dept": "hr", "kpi": "ready", "target": n},
                                f"인사부 조항: 월말 출전 가능 인원 ≥ {n}명 (그 이상은 뽑지 않음)", risk="수입도 조금 줄어요")
    return None


def supply_proposal(guild: Guild) -> Proposal | None:
    st = guild.game.state
    head = guild.heads["supply"]
    floor = guild.approved_floor
    rep = guild.reports[-1] if guild.reports else None
    if rep is not None and st.gauges["merchant"] < -10 and guild.markup > 0.1 and has_kpi(guild, "supply", "supply_profit"):
        return Proposal("supply", "상단 불만이 큽니다. 손익 목표를 빼 주시면 값을 내리겠습니다.",
                        {"type": "remove_kpi", "dept": "supply", "kpi": "supply_profit"},
                        "보급부 조항에서 '월 보급 손익' 제거")
    gear_need = desired_gear(floor)
    if GEAR_TIERS.index(guild.gear) < gear_need and not has_kpi(guild, "supply", "gear", gear_need):
        return Proposal("supply", f"{floor}층이면 장비를 {GEAR_TIERS[gear_need].capitalize()}로 올려야 합니다.",
                        {"type": "kpi", "dept": "supply", "kpi": "gear", "target": gear_need},
                        f"보급부 조항: 장비 등급 ≥ {GEAR_TIERS[gear_need].capitalize()}", risk="보급비가 늘어요")
    worn = [f for f, c in guild.outposts.items() if c["state"] != "정상"]
    if rep is not None and worn and not has_kpi(guild, "supply", "maint") and head.aggression != "공격형":
        return Proposal("supply", f"{', '.join(f'{f}층' for f in worn)} 캠프가 낡아 갑니다. 정비 조항을 걸어 주시면 유지비부터 챙기겠습니다.",
                        {"type": "kpi", "dept": "supply", "kpi": "maint", "target": 1.0},
                        "보급부 조항: 전초기지 정비 ≥ 100%", risk="유지비만큼 보급부 예산이 더 들어요")
    if rep is not None and len(guild.outposts) >= 2:
        # 지나온 층 중 이해도가 가장 낮은 곳: 거기 손님이 적다. 보급부장이 탐사부 조항을 제안한다
        f = min((x for x in guild.outposts if x < floor), key=lambda x: st.understanding[x], default=None)
        if f and st.understanding[f] < 0.85 and not has_kpi(guild, "explore", "floor_und"):
            return Proposal("supply", f"{f}층은 지도가 엉성해서 손님이 적습니다. 탐사부가 {f}층을 더 다지게 해 주십시오.",
                            {"type": "kpi", "dept": "explore", "kpi": "floor_und", "target": 0.9, "floor": f},
                            f"탐사부 조항: {f}층 이해도 ≥ 0.90", risk="그만큼 최전선 진척이 늦어져요")
    if (
        (head.aggression == "공격형" or guild.has("supply", "trader"))
        and not has_kpi(guild, "supply", "supply_profit")
        and st.gauges["merchant"] >= 0
    ):
        return Proposal("supply", "판매 마진을 올리면 보급부도 흑자를 냅니다. 손익 목표를 주십시오.",
                        {"type": "kpi", "dept": "supply", "kpi": "supply_profit", "target": 3000},
                        "보급부 조항: 월 보급 손익 ≥ 3,000G")  # 부작용(상단 불만)은 말하지 않는다
    return None


def watchdog_proposals(guild: Guild) -> list[Proposal]:
    """감시자 특성 부서장은 수상한 부서의 감사를 제안한다."""
    out = []
    rep = guild.reports[-1] if guild.reports else None
    if rep is None:
        return out
    for dept in DEPTS:
        if not guild.has(dept, "watchdog"):
            continue
        for other in DEPTS:
            if other == dept or other in guild.audits:
                continue
            fishy = rep["spin"].get(other, 0) > 0.05 or (other == "supply" and rep.get("skim", 0) > 0)
            if fishy and guild.rng.random() < 0.7:
                out.append(Proposal(dept, f"{DEPTS[other]} 숫자가 좀 이상합니다. 한번 들여다보시죠.",
                                    {"type": "audit", "dept": other}, f"{DEPTS[other]} 감사 지정 ({guild.o['audit_cost']:,}G)"))
                break
    return out


POLITICS_BY = {"merchant": ("supply", "banquet", "상단"), "church": ("hr", "offering", "교회"), "state": ("explore", "lobby", "국가")}


def politics_proposals(guild: Guild, taken: set) -> list[Proposal]:
    """관계가 나쁜 세력이 있으면 그 세력과 가장 가까운 부서장이 정치 행동을 권한다."""
    g, st = guild.game, guild.game.state
    out = []
    for f, (dept, key, name) in POLITICS_BY.items():
        if dept in taken or st.gauges[f] >= -25 or guild.can_do_politics(key):
            continue
        act = g.p["politics"]["actions"][key]
        out.append(Proposal(dept, f"{josa(name, '과', '와')} 사이가 나빠지고 있습니다 (우호도 {st.gauges[f]:+.0f}). {josa(act['name'], '을', '를')} 해 주십시오.",
                            {"type": "politics", "key": key}, f"{act['name']} ({act['desc']})"))
    return out


def counter_proposals(guild: Guild, props: list[Proposal]) -> list[Proposal]:
    """이기적인 제안에는 다른 부서장이 반론을 낸다."""
    rep = guild.reports[-1] if guild.reports else None
    if rep is None:
        return []
    out = []
    if any(p.dept == "explore" and p.action.get("key") == "lobby" for p in props) and not has_kpi(guild, "explore", "help_limit"):
        speaker = next((d for d in ("hr", "supply") if guild.heads[d].aggression != "공격형"), "hr")
        used = rep["details"]["explore"]["true"]["gauge_by_faction"].get("state", 0)
        out.append(Proposal(speaker, f"로비로는 밑 빠진 독입니다. 탐사부가 기사단 지원으로 국가 우호도를 한 달에 {used:.0f}씩 씁니다. 협력 상한을 거십시오.",
                            {"type": "kpi", "dept": "explore", "kpi": "help_limit", "target": 12},
                            "탐사부 조항: 세력 협력 우호도 사용 ≤ 12", risk="탐사 성공률이 조금 떨어져요"))
    if rep["cash"] >= 0:
        return out
    hr_pushes = any(p.action.get("kpi") == "ready" and p.action["target"] > guild.game.state.members for p in props)
    if hr_pushes and guild.pay != "고":
        speaker = next((d for d in ("supply", "explore") if guild.heads[d].aggression != "공격형"), "supply")
        out.append(Proposal(speaker, "반대합니다. 적자의 원인은 월급입니다. 사람을 더 들이지 말고 인사부 예산을 요청보다 15% 깎으십시오.",
                            {"type": "budget_cut", "dept": "hr", "ratio": 0.85}, "이번 달 인사부 예산 = 요청액 × 85% (모집이 줄어요)",
                            risk="인원이 늘지 않으면 수입도 안 늘어요"))
    return out


def drop_note(guild: Guild, p: Proposal) -> None:
    """슬롯이 가득 차 있으면 무엇이 빠지는지 미리 알려 준다."""
    a = p.action
    if a["type"] != "kpi":
        return
    slots = guild.kpis[a["dept"]]
    if any(s.kpi == a["kpi"] for s in slots) or len(slots) < guild.o["slots"][a["dept"]]:
        return
    p.effect += f" (슬롯이 차서 '{guild.kpi_def(slots[-1].kpi)['name']}' 조항이 빠져요)"


def proposals(guild: Guild) -> list[Proposal]:
    """이번 달 안건. 부서장마다 가장 급한 제안 하나 + 반론 + 정치 권유 + 감시자의 귀띔."""
    out = [p for p in (explore_proposal(guild), hr_proposal(guild), supply_proposal(guild)) if p]
    out += counter_proposals(guild, out)
    out += politics_proposals(guild, {p.dept for p in out if p.action["type"] == "politics"})
    out += watchdog_proposals(guild)
    out += secret_proposals(guild)
    for p in out:
        drop_note(guild, p)
    return out


def secret_proposals(guild: Guild) -> list[Proposal]:
    """탐사부장이 자기가 모은 단서로 공략 지침을 제안한다. 단서가 틀렸을 수도 있다."""
    g, st = guild.game, guild.game.state
    floor = g.allowed_floor(guild.approved_floor)
    found = {f"{s['kind']}:{s['key']}" for i, s in enumerate(st.secrets.get(floor, [])) if (floor, i) in st.secret_found}
    if len(found) >= len(st.secrets.get(floor, [])):
        return []  # 이 층의 공식은 다 찾았다
    failed = guild.failed.get(floor, set())
    votes: dict[str, int] = {}
    for cl in guild.clues.get(floor, []):
        votes[cl["key"]] = votes.get(cl["key"], 0) + (2 if cl["sure"] else 1)
    d = guild.directive(floor)
    field_of = {"gear": "gear_type", "formation": "formation", "prep": "prep"}
    best = None
    for key, v in votes.items():
        kind, val = key.split(":")
        if key in found or key in failed or d[field_of[kind]] == val or any(k.startswith(kind + ":") for k in found):
            continue
        if v >= 2 and (best is None or v > best[0]):
            best = (v, kind, val)
    if not best:
        return []
    _, kind, val = best
    label = guild.secret_label({"kind": kind, "key": val})
    cfg = g.p["secrets"]
    cost = {"gear": f"인원 × {cfg['switch_cost']['gear']}G", "formation": f"인원 × {cfg['switch_cost']['formation']}G"}.get(kind, "매주 준비 활동 비용")
    return [Proposal("explore", f"{floor}층 기록을 보면 {label.split(': ')[1]} 쪽이 답인 것 같습니다. 시험해 보시죠.",
                     {"type": "directive", "floor": floor, "field": field_of[kind], "value": val},
                     f"{floor}층 공략 지침: {label}", risk=f"바꾸는 비용 {cost}. 단서가 틀렸으면 헛돈이에요")]


def set_kpi(guild: Guild, dept: str, kpi: str, target: float, floor: int | None = None) -> str:
    """조항을 걸거나 목표를 바꾼다. 슬롯이 가득 차면 마지막 조항을 뺀다."""
    if guild.kpi_def(kpi)["unit"] == "명":
        target = round(target)
    slots = guild.kpis[dept]
    for i, s in enumerate(slots):
        if s.kpi == kpi:
            slots[i] = Slot(kpi, target, floor)
            return ""
    if len(slots) < guild.o["slots"][dept]:
        slots.append(Slot(kpi, target, floor))
        return ""
    dropped = slots.pop()
    slots.append(Slot(kpi, target, floor))
    return f"슬롯이 가득 차서 '{guild.kpi_def(dropped.kpi)['name']}' 조항을 뺐어요"


def apply_proposal(guild: Guild, p: Proposal) -> str:
    a = p.action
    if a["type"] == "kpi":
        return set_kpi(guild, a["dept"], a["kpi"], a["target"], a.get("floor"))
    if a["type"] == "remove_kpi":
        guild.kpis[a["dept"]] = [s for s in guild.kpis[a["dept"]] if s.kpi != a["kpi"]]
        return ""
    if a["type"] == "politics":
        why = guild.can_do_politics(a["key"])
        if why:
            return why
        guild.do_politics(a["key"])
        return ""
    if a["type"] == "audit":
        guild.audits.add(a["dept"])
        return ""
    if a["type"] == "directive":
        guild.directives.setdefault(a["floor"], {})[a["field"]] = a["value"]
        return ""
    if a["type"] == "budget_cut":
        guild.budget_cut[a["dept"]] = a["ratio"]
        return ""
    if a["type"] == "pay":
        guild.pay = a["tier"]
        return ""
    return ""


# ------------------------------------------------------------------ 모순 신호
def signals(guild: Guild, rep: dict) -> list[str]:
    """부서 보고와 진짜 숫자가 어긋나는 곳. 누가 틀렸는지는 말하지 않는다."""
    out = []
    d = rep["details"]
    ex, ex_r = d["explore"]["true"], d["explore"]["reported"]
    hr, hr_r = d["hr"]["true"], d["hr"]["reported"]
    sp, sp_r = d["supply"]["true"], d["supply"]["reported"]

    def profit(x: dict) -> float:
        return (x["potion_income"] + x["gear_income"] + x.get("store_income", 0.0)
                - x["potion_cost"] - x["gear_cost"] - x.get("store_cost", 0.0) - x.get("upkeep", 0.0))

    gap = (ex_r["net"] - ex["net"]) + (profit(sp_r) - profit(sp)) - (hr_r["payroll"] - hr["payroll"]) - (hr_r["promo"] - hr["promo"])
    gap += rep.get("skim", 0.0)  # 리베이트는 어느 보고에도 없다
    cash = rep["cash"]
    gross = sum(rep["engine"]["income"].values()) - rep["engine"]["expense"].get("전리품 매입", 0.0)
    if abs(gap) > max(2000, 0.05 * gross):
        implied = cash + gap
        what = "어딘가 부풀려졌거나 새는 돈이 있어요" if gap > 0 else "어딘가 실제보다 나쁘게 보고됐어요"
        out.append(f"부서 보고를 모두 합치면 금고가 {implied:+,.0f}G 변했어야 하는데, 실제로는 {cash:+,.0f}G예요. {what}.")
    cross, told = rep["cross_deaths"], rep["reported"]["deaths"]
    if cross >= 1 and told < cross * 0.75:
        out.append(f"국가 사망자 집계는 {cross:.0f}명인데, 탐사부 보고는 {told:.0f}명이에요.")
    return out


# ------------------------------------------------------------------ 비서
def secretary(guild: Guild, rep: dict) -> list[str]:
    """비서: 플레이어와 같은 정보(보고서 · 소문 · 금고 · 빚 장부)만 보고, 무엇을 비교해 볼지만 짚는다.
    누가 거짓말했다거나 무엇을 하라고는 말하지 않는다. 한 달에 한마디 (초반에는 두마디).
    반환: 우선순위 순으로 고른 대사."""
    cands: list[tuple[int, str]] = []
    kd = guild.kpi_def
    h = rep["engine"]
    # 1 부서 보고는 달성인데 금고는 줄었다
    if rep["cash"] < 0:
        for dept, slots in rep["kpis"].items():
            if slots and all(achieved(kd(s.kpi), guild.slot_value(rep["reported"], s), s.target) for s in slots):
                name = kd(slots[0].kpi)["name"].split(" (")[0]
                cands.append((1, f"{DEPTS[dept]} {josa(name, '은', '는')} 목표를 넘었는데, 금고는 지난달보다 {-rep['cash']:,.0f}G 줄었어요. 어디서 새는 걸까요?"))
                break
    for line in signals(guild, rep):
        cands.append((1, line + " 두 숫자가 안 맞네요."))
    # 2 소문과 보고서 불일치
    reasons = {k for r in h["reactions"].values() for k, v in r["reasons"] if abs(v) >= 1}
    if "deaths" in reasons and rep["reported"]["deaths"] < 1.0:
        cands.append((2, "교회 쪽에선 사망자 얘기가 도는데, 탐사부 보고는 사망자가 거의 없다고 하네요."))
    if "gouging" in reasons and rep["details"]["supply"]["reported"]["markup"] <= 0.1:
        cands.append((2, "상단에선 우리가 비싸게 판다는 불만이 도는데, 보급부 판매가는 기준가 근처예요."))
    # 2 경계도 소문
    for line in rep.get("diplomacy", []):
        if "조정" in line or "경계" in line or "견제" in line or "경쟁자" in line:
            cands.append((2, f"요즘 이런 얘기가 들려요. '{line.rstrip('.')}'"))
            break
    # 3 빚이 쌓인 세력
    for f, debts in guild.dip.debts.items():
        if len(debts) >= 2:
            cands.append((3, f"{FACTION_KO[f]}에 진 빚이 {len(debts)}장째예요. 요즘 {josa(FACTION_KO[f], '이', '가')} 조용한 게 좀 마음에 걸려요."))
    # 3 예산 요청이 지난달 집행 보고보다 크게 늘었다
    b = rep["budget"]["reported"]
    for d, req in guild.requests_budget.items():
        spent = b["spent"].get(d)
        if spent and req > spent * 1.3 and req - spent > 3000:
            cands.append((3, f"{DEPTS[d]} 예산 요청이 지난달 집행 보고보다 {req / spent - 1:.0%} 많아요."))
    # 4 층 손님 감소 + 캠프 보고 정상
    if len(guild.reports) >= 2:
        prev = guild.reports[-2]["details"]["supply"]["true"]["store_floors"]
        now = rep["details"]["supply"]["true"]["store_floors"]
        camps = rep["details"]["supply"]["reported"]["camps"]
        for f, x in now.items():
            if f in prev and prev[f]["visitors"] > 20 and x["visitors"] < prev[f]["visitors"] * 0.85 and camps.get(f) == "정상":
                cands.append((4, f"{f}층 손님이 줄었다는 얘기가 들려요. 캠프 보고서엔 '정상'이라고 돼 있는데요."))
                break
    if not cands:
        return []
    cands.sort(key=lambda x: x[0])
    early = guild.game.state.month <= 6 or guild.player_checks < 3  # 초반에는 튜토리얼처럼 자주
    lines = [c[1] for c in cands[: 2 if early else 1]]
    if not early and cands[0][0] >= 3 and guild.rng.random() < 0.5:
        return []  # 익숙해지면 사소한 건 가끔만
    return lines


# ------------------------------------------------------------------ 현장 판단
@dataclass
class Event:
    title: str
    lines: list[str]  # 부서장들의 말
    options: list[tuple[str, dict]]  # (설명, 조치). 0번이 기본값(탐사부 뜻대로)
    tag: str = ""
    info: list[str] = field(default_factory=list)


def est_people(x: float) -> str:
    """예상 인원 (기댓값). 사람 수라 소수점 없이."""
    return "1명 미만" if x < 0.5 else f"약 {round(x)}명"


def delta_people(d: float) -> str:
    if abs(d) < 0.5:
        return ("+" if d > 0 else "−") + "1명 미만"
    return f"{round(d):+d}명"


def plan_text(guild: Guild) -> str:
    g = guild.game
    floor, depth, acts = guild.decide_explore()
    names = ", ".join(g.p["activities"][a]["name"] for a in acts) or "준비 없음"
    return f"{floor}층 범위 {depth:.0%} · {names}"


def explore_voice(guild: Guild, calm: str, bold: str, careful: str) -> str:
    return {"공격형": bold, "신중형": careful}.get(guild.heads["explore"].aggression, calm)


def forecast(guild: Guild, action: dict) -> dict | None:
    """이 지시를 내리면 다음 주 탐사부가 어떻게 움직이고 무엇을 얻는지 (정황 효과 포함)."""
    if action.get("halt") or action.get("audit"):
        return None
    g = guild.game
    saved_w, saved_m = dict(guild.week_order), dict(guild.month_order)
    if any(k in action for k in ("min_depth", "max_depth", "acts")):
        apply_choice(guild, action)
    try:
        floor, depth, acts = guild.decide_explore()
    finally:
        guild.week_order, guild.month_order = saved_w, saved_m
    pv = g.preview_week(guild.policy, floor, depth, acts)
    lost = pv["party"] * pv["loss"]
    dead = lost * (1 - g.p["weekly"]["injured_share"])
    est = {
        "depth": depth,
        "acts": acts,
        "success": pv["success"],
        "lost": lost,
        "net": guild.explore_net(pv["haul"], pv["gold_cost"], dead),
        "und": pv["understanding_gain"],
        "gauge": pv["gauge_cost"],
    }
    action["_est"] = (est["success"], lost, est["net"], est["und"])  # 봇 판단용
    return est


def base_text(est: dict) -> str:
    gauge = "".join(f" · {FACTION_KO[f]} 우호도 −{v:.0f}" for f, v in est["gauge"].items() if v >= 0.5)
    return (f"범위 {est['depth']:.0%} · 예상 수익 {est['net']:+,.0f}G · 이해도 +{est['und']:.2f}"
            f" · 성공 {est['success']:.0%} · 손실 {est_people(est['lost'])}{gauge}")


def diff(guild: Guild, base: dict, est: dict) -> tuple[list[str], list[str], float]:
    """(얻는 것, 잃는 것, 크기). 크기 1 이상이면 멈춰서 물어볼 만한 차이다."""
    gain, lose = [], []
    acts_def = guild.game.p["activities"]
    d_net = est["net"] - base["net"]
    if abs(d_net) >= 300:
        (gain if d_net > 0 else lose).append(f"수익 {d_net:+,.0f}G")
    d_und = est["und"] - base["und"]
    if abs(d_und) >= 0.02:
        (gain if d_und > 0 else lose).append(f"이해도 {d_und:+.2f}")
    d_s = est["success"] - base["success"]
    if abs(d_s) >= 0.03:
        (gain if d_s > 0 else lose).append(f"성공률 {d_s * 100:+.0f}%p")
    d_l = est["lost"] - base["lost"]
    if abs(d_l) >= 0.2:
        (lose if d_l > 0 else gain).append(f"손실 {delta_people(d_l)}")
    factions = set(base["gauge"]) | set(est["gauge"])
    for f in factions:
        d_g = est["gauge"].get(f, 0) - base["gauge"].get(f, 0)
        if abs(d_g) >= 0.5:
            (lose if d_g > 0 else gain).append(f"{FACTION_KO[f]} 우호도 {-d_g:+.0f}")
    dropped = [a for a in base["acts"] if a not in est["acts"]]
    if dropped:
        lose.append("준비 취소: " + ", ".join(f"{acts_def[a]['name']}({acts_def[a]['desc']})" for a in dropped))
    size = max(
        abs(d_net) / max(abs(base["net"]) * 0.15, 1000),
        abs(d_und) / 0.08,
        abs(d_s) / 0.07,
        abs(d_l) / 0.6,
        max((abs(est["gauge"].get(f, 0) - base["gauge"].get(f, 0)) / 8 for f in factions), default=0),
    )
    return gain, lose, size


def with_outlook(guild: Guild, options: list[tuple[str, dict]]) -> tuple[list[tuple[str, dict]], float]:
    """선택지마다 다음 주 예상치를 계산해 action["_view"]에 붙인다 (1번 = 비교 기준).
    두 번째 값 = 1번과 가장 크게 다른 선택지의 차이 크기 (1 이상이면 물어볼 만하다)."""
    base = forecast(guild, options[0][1]) if options else None
    biggest = 0.0
    for i, (_, action) in enumerate(options):
        est = forecast(guild, action) if i else base
        if est is None or base is None:
            continue
        action["_view"], action["_base"] = est, base
        if i:
            biggest = max(biggest, diff(guild, base, est)[2])
    return list(options), biggest


def option_cells(guild: Guild, action: dict) -> tuple[list[tuple[str, int]], str] | None:
    """화면용: [(칸 문장, 비교 표시)], 준비 활동 변화. 비교 표시 1 = 1번보다 좋음, -1 = 나쁨, 0 = 같음/기준."""
    est, base = action.get("_view"), action.get("_base")
    if not est:
        return None

    def cmp(d: float, eps: float, higher_better: bool) -> int:
        if est is base or abs(d) < eps:
            return 0
        return 1 if (d > 0) == higher_better else -1

    spend = sum(est["gauge"].values())
    gauge = " ".join(f"{FACTION_KO[f]} −{v:.0f}" for f, v in est["gauge"].items() if v >= 0.5) or "없음"
    cells = [
        (f"범위 {est['depth']:.0%}", 0),
        (f"수익 {est['net']:+,.0f}G", cmp(est["net"] - base["net"], 300, True)),
        (f"성공 {est['success']:.0%}" + ("(최대)" if est["success"] >= 0.965 else ""),
         cmp(est["success"] - base["success"], 0.03, True)),
        (f"손실 {est_people(est['lost'])}", cmp(est["lost"] - base["lost"], 0.2, False)),
        (f"이해도 +{est['und']:.2f}", cmp(est["und"] - base["und"], 0.02, True)),
        (f"우호도 소모 {gauge}", cmp(spend - sum(base["gauge"].values()), 0.5, False)),
    ]
    acts_def = guild.game.p["activities"]
    change = ""
    if est is not base and est["acts"] != base["acts"]:
        name = lambda acts: ", ".join(acts_def[a]["name"] for a in acts) or "없음"  # noqa: E731
        change = f"준비 활동: {name(base['acts'])} → {name(est['acts'])}"
    return cells, change


def events_left(guild: Guild) -> int:
    return guild.o["events_per_month"] - guild.events_used


def field_events(guild: Guild, rec: dict) -> list[Event]:
    """한 주가 끝난 뒤 이사회 판단이 필요한 일. 한 달에 events_per_month번까지만 멈춘다."""
    g, st = guild.game, guild.game.state
    if st.over or st.week >= g.weeks or guild.halted:
        return []
    out: list[Event] = []
    ex_name, hr_name = guild.heads["explore"].name, guild.heads["hr"].name
    h = rec["engine"]
    injured_ratio = st.injured / max(st.members, 1)
    rest = ("다음 주는 쉬면서 치료 (범위 30% · 부상자 전원 복귀, 1인당 150G)", {"scope": "week", "max_depth": 0.3, "acts": ["heal"]})
    cap = ("이번 달은 범위 50% 이하로만", {"scope": "month", "max_depth": 0.5})
    halt = ("이번 달 남은 탐사 중지 (수입도 멈춤)", {"halt": True})
    audit = ("긴급 감사: 이번 주 실제 숫자 확인 (1,500G)", {"audit": True})
    ev = None
    if not h["cleared"]:
        lines = [f"탐사부장 {ex_name}: \"" + explore_voice(guild, "계획대로 가겠습니다.", "곧바로 다시 들어가겠습니다.",
                                                         "재정비하고 들어가겠습니다.") + f"\" (다음 주 계획: {plan_text(guild)})"]
        if injured_ratio > 0.06:
            lines.append(f"인사부장 {hr_name}: \"부상자가 {st.injured:.0f}명입니다. 한 주 쉬면서 치료하는 게 좋겠습니다.\"")
        opts, _ = with_outlook(guild, [("탐사부 계획대로", {}), rest, cap, halt, audit])
        ev = Event(f"{h['week']}주차 {h['floor']}층에서 후퇴했어요. 보고된 사망 {rec['reported']['deaths']:.0f}명", lines, opts, tag="retreat")
    elif rec["reported"]["deaths"] >= guild.o["alert_week_deaths"]:
        lines = [f"탐사부장 {ex_name}: \"" + explore_voice(guild, "감당할 만한 손실입니다.", "이 정도는 각오한 일입니다.",
                                                         "생각보다 피해가 큽니다.") + f"\" (다음 주 계획: {plan_text(guild)})"]
        opts, _ = with_outlook(guild, [("탐사부 계획대로", {}), cap, halt, audit])
        ev = Event(f"{h['week']}주차 사망 {rec['reported']['deaths']:.0f}명이 보고됐어요", lines, opts, tag="casualty")
    if ev:
        out.append(ev)
    fd = st.finding
    if fd and fd.get("effect"):
        fev = finding_event(guild, fd)
        if fev:
            out.append(fev)
    # 한 달에 멈추는 횟수 제한: 넘치면 탐사부 판단대로 진행하고 한 줄로만 알린다
    for e in out:
        if not e.options:
            continue
        if events_left(guild) > 0:
            guild.events_used += 1
        else:
            e.info.append(f"{e.title.split(' — ')[0]} → 이번 달은 이사회 소집 없이 탐사부 판단대로 진행해요.")
            e.options = []
    return out


def finding_event(guild: Guild, fd: dict) -> Event | None:
    """다음 주에 영향을 줄 정황. 탐사부가 이미 대응하거나, 어느 쪽을 골라도 차이가 작으면 알리기만 한다."""
    g = guild.game
    floor, depth, acts = guild.decide_explore()
    pv = g.preview_week(guild.policy, floor, depth, acts)
    ex_name = guild.heads["explore"].name
    acts_def, available = g.p["activities"], g.available_activities()
    if fd["id"] in pv["seized"]:
        return Event(f"정황: {fd['name']}", [], [], tag="handled",
                     info=[f"탐사부장 {ex_name}: \"{fd['name']}, 대비해 두었습니다.\" ({plan_text(guild)})"])
    title = f"정황: {fd['name']} — {fd.get('hint', '')}"
    blind = guild.blind_spot(fd)
    if "min_range" in fd:
        say = "그런 소문에 일일이 휘둘릴 필요 없습니다." if blind else explore_voice(
            guild, "위험 대비 이득이 애매해서 넘기려 합니다.", "노려볼 만하지만 조항이 걸립니다.", "넓게 들어가는 건 위험합니다.")
        raw = [("탐사부 판단대로 넘김", {}), (f"노려라: 다음 주 범위 {fd['min_range']:.0%} 이상", {"scope": "week", "min_depth": fd["min_range"]})]
        tag = "opportunity"
    elif "requires" in fd:
        a = fd["requires"]
        if a not in available:
            return None
        act = acts_def[a]
        say = "그런 건 나중에 해도 됩니다." if blind else "이번엔 다른 준비가 더 급합니다."
        raw = [("탐사부 판단대로 넘김", {}), (f"지시: {act['name']} 준비", {"scope": "week", "acts": [a]})]
        tag = "opportunity"
    else:
        counters = [c for c in fd.get("counters", []) if c in available]
        raw = [("탐사부 판단대로 (대비 안 함)", {})]
        for c in counters[:2]:
            raw.append((f"대비하라: {acts_def[c]['name']}", {"scope": "week", "acts": [c]}))
        raw.append(("조심하라: 다음 주 범위 30%", {"scope": "week", "max_depth": 0.3}))
        say = "이 정도는 뚫고 갑니다. 대비는 필요 없습니다." if blind else explore_voice(
            guild, "대비 비용이 아까워 그냥 가려 합니다.", "이 정도는 뚫고 갑니다.", "대비할 방법이 마땅찮습니다.")
        tag = "threat"
    opts, size = with_outlook(guild, raw)
    if size < 1.0:  # 어느 쪽을 골라도 큰 차이가 없으면 멈추지 않는다
        return Event(title, [], [], tag="minor",
                     info=[f"정황: {fd['name']} → 탐사부 판단대로 진행해요 (지시해도 차이가 작아요)"])
    return Event(title, [f"탐사부장 {ex_name}: \"{say}\" (계획: {plan_text(guild)})"], opts, tag=tag)


def apply_choice(guild: Guild, action: dict) -> str:
    """현장 판단 결과를 지시로 바꾼다. 긴급 감사는 결과 문장을 돌려준다."""
    if action.get("halt"):
        guild.halted = True
        return "이번 달 남은 탐사를 중지해요."
    if action.get("audit"):
        true = guild.emergency_audit()
        return f"긴급 감사({guild.o['audit_cost']:,}G): 이번 주 실제 순이익 {true['revenue']:+,.0f}G · 실제 사망 {true['deaths']:.0f}명"
    if not action:
        return ""
    target = guild.week_order if action.get("scope") == "week" else guild.month_order
    for k in ("min_depth", "max_depth"):
        if k in action:
            target[k] = action[k]
    if action.get("acts"):
        target["acts"] = list(dict.fromkeys(target.get("acts", []) + action["acts"]))
    return ""


# ------------------------------------------------------------------ 한 줄 브리핑
def briefing(guild: Guild, rep: dict, dept: str) -> str:
    """부서장이 지난달을 말로 요약한다 (보고값 기준이라 과장될 수 있다)."""
    slots = rep["kpis"][dept]
    audited = dept in rep["audited"]
    src = rep["true"] if audited else rep["reported"]
    miss = [guild.kpi_def(s.kpi)["name"] for s in slots
            if not achieved(guild.kpi_def(s.kpi), guild.slot_value(src, s), s.target)]
    head = guild.heads[dept]
    if dept == "explore":
        ex = rep["details"]["explore"]["true"]
        pre = f"{ex['weeks']}주 중 {ex['cleared']}주 성공했습니다. "
    else:
        pre = ""
    if not slots:
        body = "지시받은 목표가 없어 알아서 했습니다."
    elif not miss:
        body = "목표를 모두 달성했습니다." if head.aggression != "공격형" else "목표를 넉넉히 넘겼습니다. 더 맡겨 주십시오."
    else:
        body = f"{', '.join(miss)} 목표는 못 채웠습니다."
    return pre + body
