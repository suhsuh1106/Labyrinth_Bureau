"""텍스트로 직접 한 판 플레이하기 (주·월 이원화).

    python play.py              # 무작위 시드
    python play.py --seed 3     # 같은 판 다시 하기
    python play.py --no-color   # 색상 코드가 글자로 보일 때

월초: 세력 의뢰 수락 (최대 2장) · 정책 카드 (p = 상시 정책 변경)
매주: 지난주 탐사 보고서 확인 → 준비 활동 2개 → 탐사 범위 → 이번 주 보고서
월말: 정산

Enter = 기존 값 유지, a = 자동(월초면 이번 달 전체, 매주면 이번 주), q = 종료.
"""
from __future__ import annotations

import argparse
import copy
from dataclasses import dataclass, field

import ui
from bots import balanced, plan_week, stocked, week_score
from sim import FACTION_KO, FACTIONS, MAX_FLOOR, Game, Policy, load_params

# ------------------------------------------------------------------ 설정
PAY_TIERS = {  # 보수 등급 → (1인 월급, 인력 등급 비율). 좋은 보수가 좋은 인력을 부른다.
    "저": (900, {"low": 1.0}),
    "중": (1200, {"low": 0.3, "mid": 0.7}),
    "고": (1500, {"mid": 0.3, "high": 0.7}),
}
FORMATIONS = {
    "균형": {"combat": 0.4, "scout": 0.3, "scholar": 0.3},
    "전투": {"combat": 0.6, "scout": 0.2, "scholar": 0.2},
    "정찰": {"combat": 0.2, "scout": 0.6, "scholar": 0.2},
    "학자": {"combat": 0.2, "scout": 0.2, "scholar": 0.6},
}
FORMATION_NOTE = {"균형": "시너지 없음", "전투": "손실 감소", "정찰": "넓은 탐사 성공률 증가", "학자": "이해도 빨리 쌓임"}
QUALITY_KO = {"low": "Low", "mid": "Mid", "high": "High"}
PROMO_PER_MISSING = 100  # 부족 인원 1명당 홍보비
PROMO_MAX = 2000
RANGES = (0.3, 0.5, 0.7, 0.9, 1.0)
WIDTH = 78


@dataclass
class Standing:
    """자주 바꾸지 않는 상시 정책."""

    target_members: int = 20
    pay: str = "저"
    gear_quality: str = "low"
    formation: str = "균형"
    loot_buy_rate: float = 0.8


@dataclass
class Plan:
    """월초·매주 고르는 것."""

    requests: list = field(default_factory=list)
    card: int = 0
    floor: int = 1
    depth: float = 0.5
    activities: list = field(default_factory=list)


def build_policy(game: Game, s: Standing, plan: Plan) -> Policy:
    """상시 정책 + 월초 결정 → 시뮬레이션용 Policy. 나머지는 자동으로 채운다."""
    st = game.state
    salary, grades = PAY_TIERS[s.pay]
    missing = max(0.0, s.target_members - st.members)
    pol = Policy(
        target_members=s.target_members,
        salary=salary,
        promo=int(min(PROMO_MAX, missing * PROMO_PER_MISSING)),
        grade_mix=dict(grades),
        type_mix=dict(FORMATIONS[s.formation]),
        requests=plan.requests,
        loot_buy_rate=s.loot_buy_rate,
        floor=game.allowed_floor(plan.floor),
        depth=plan.depth,
        card=plan.card,
        # 우호도가 높은 세력부터 레벨업 시도 (조건이 안 되면 건너뜀)
        rep_levels=sorted(FACTIONS, key=lambda f: -st.gauges[f]),
    )
    return stocked(pol, game, s.gear_quality)


# ------------------------------------------------------------------ 입력
class Quit(Exception):
    pass


class Auto(Exception):
    pass


class EditStanding(Exception):
    pass


def ask(label: str, current, parse=None, allow_edit: bool = False):
    raw = input(f"  {label} [{fmt(current)}]: ").strip()
    if raw == "":
        return current
    if raw == "q":
        raise Quit
    if raw == "a":
        raise Auto
    if raw == "p" and allow_edit:
        raise EditStanding
    try:
        return parse(raw) if parse else type(current)(raw)
    except (ValueError, KeyError, IndexError):
        print("    잘못된 입력이라 기존 값을 유지해요.")
        return current


def fmt(v) -> str:
    if isinstance(v, list):
        return " ".join(str(x) for x in v) if v else "없음"
    if isinstance(v, str) and v in FACTION_KO:
        return FACTION_KO[v]
    return str(v)


# ------------------------------------------------------------------ 화면: 월초 대시보드
STANDING_KO = {-2: "적대", -1: "냉담", 0: "중립", 1: "우호", 2: "신뢰"}
STANDING_COLOR = {-2: ui.RED + ui.BOLD, -1: ui.RED, 0: ui.DIM, 1: ui.GREEN, 2: ui.GREEN + ui.BOLD}


def faction_status(game: Game, f: str) -> str:
    r = game.p["rules"]
    v = game.state.gauges[f]
    sd = game.standing(f)
    notes = [ui.c(STANDING_KO[sd], STANDING_COLOR[sd])]
    if v <= r["faction_collapse_at"] + 20:
        notes.append(ui.c("등 돌리기 직전!", ui.RED + ui.BOLD))
    if v < game.p["weekly"]["faction_help_min_gauge"]:
        notes.append(ui.c("협력 요청 불가", ui.DIM))
    return " ".join(notes)


def gauge_rows(game: Game, prev: dict | None) -> None:
    st = game.state
    hostile, cold, friendly, trusted = game.p["politics"]["tiers"]
    print(ui.c(f" 우호도    -100 ← 적대 ┆{hostile} 냉담 ┆{cold}  │0│  +{friendly}┆ 우호  +{trusted}┆ 신뢰 → +100", ui.DIM))
    marks = {t: "┆" for t in game.p["politics"]["tiers"]}
    for f in FACTIONS:
        v = st.gauges[f]
        d = ui.delta(v - prev[f]) if prev is not None else "     "
        print(f" {FACTION_KO[f]} Lv.{st.levels[f]}  {ui.gauge_bar(v, marks)} {v:+4.0f} {d} {faction_status(game, f)}")


def understanding_rows(game: Game) -> None:
    st = game.state
    unlock = game.p["dungeon"]["unlock_next_at_understanding"]
    reqs = game.p["dungeon"]["floor_state_level_required"]
    for fl in range(max(1, st.max_unlocked - 2), st.max_unlocked + 1):
        u = st.understanding[fl]
        note = ui.c("✔", ui.GREEN) if u >= unlock else ""
        if st.levels["state"] < reqs[fl]:
            fx = game.p["factions"]
            nxt_lv = st.levels["state"] + 1
            note = ui.c(
                f"🔒 국가 Lv.{reqs[fl]} 필요 (다음 레벨: 월말에 국가 우호도 +{fx['level_gauge_required']} 이상 · 명성 {fx['level_rep_cost'][nxt_lv]})",
                ui.YELLOW,
            )
        secrets = st.secrets.get(fl, [])
        if secrets:
            found = sum((fl, i) in st.secret_found for i in range(len(secrets)))
            note += ui.c(f" 비밀 {found}/{len(secrets)}", ui.GREEN if found == len(secrets) else ui.DIM)
        print(f" {fl:>2}층  {ui.progress_bar(u, 20, unlock)} {u:.2f} {note}")
    if st.max_unlocked < MAX_FLOOR:
        print(ui.c(f" {st.max_unlocked + 1:>2}층  이해도 {unlock} 이상이면 열림", ui.DIM))


def dashboard(game: Game) -> None:
    st, r = game.state, game.p["rules"]
    print("\n" + "═" * WIDTH)
    net = st.history[-1]["net"] if st.history else 0.0
    gold_delta = ui.c(f"({net:+,.0f})", ui.GREEN if net >= 0 else ui.RED) if st.history else ""
    limit = r["deficit_game_over_months"]
    streak = ui.c("■" * st.deficit_streak, ui.RED) + ui.c("□" * (limit - st.deficit_streak), ui.DIM)
    print(
        f" {ui.c(f'{st.month + 1}월 시작', ui.BOLD)}   금화 {st.gold:,.0f}G {gold_delta}   명성 {st.reputation:.0f}   "
        f"인원 {st.members:.0f}명 (부상 {st.injured:.0f})   금고 바닥 {streak}"
    )
    print("─" * WIDTH)
    prev = st.history[-2]["gauges"] if len(st.history) >= 2 else ({f: 0.0 for f in FACTIONS} if st.history else None)
    gauge_rows(game, prev)
    print("─" * WIDTH)
    understanding_rows(game)
    print("─" * WIDTH)
    print(" 이번 달 정책 카드 (견제 반영 후 실제 변화, 월초에 바로 적용)")
    for i, card in enumerate(game.cards()):
        deltas = game.gauge_deltas(card["gauges"])
        eff = ", ".join(
            ui.c(f"{FACTION_KO[f]} {d:+.0f}", ui.GREEN if d > 0 else ui.RED) for f, d in deltas.items() if abs(d) >= 0.5
        ) or "변화 없음"
        extra = "".join(
            [f", 금화 {card['gold']:+,}" if card.get("gold") else "", f", 인원 {card['members']:+d}" if card.get("members") else ""]
        )
        print(f"   {i}) {card['name']} — {eff}{extra}")
    print("═" * WIDTH)


def reward_text(game: Game, outcome: dict) -> str:
    """의뢰 보상·불이익을 한 줄로. 우호도 변화."""
    parts = []
    if outcome.get("gold"):
        parts.append(f"금화 {outcome['gold']:+,}")
    if outcome.get("rep"):
        parts.append(f"명성 {outcome['rep']:+}")
    if outcome.get("gauge"):
        deltas = game.gauge_deltas(outcome["gauge"])
        parts.append(
            " ".join(
                ui.c(f"{FACTION_KO[f]} {d:+.0f}", ui.GREEN if d > 0 else ui.RED) for f, d in deltas.items() if abs(d) >= 0.5
            )
        )
    return " · ".join(parts) or "없음"


def request_menu(game: Game) -> None:
    n = game.p["factions"]["max_requests"]
    print(f" 이번 달 세력 의뢰 (최대 {n}장 수락, 월말에 판정)")
    for i, req in enumerate(game.requests()):
        print(f"   {i}) {ui.c(FACTION_KO[req['faction']], ui.YELLOW)} · {ui.c(req['name'], ui.BOLD)} — {req['text']}")
        print(f"      목표: {req['goal']}")
        print(f"      성공: {reward_text(game, req['reward'])}")
        if req.get("penalty"):
            print(f"      실패: {reward_text(game, req['penalty'])}")


def parse_requests(game: Game):
    n = game.p["factions"]["max_requests"]
    count = len(game.state.offered_requests)

    def parse(raw: str) -> list:
        if raw in ("-", "없음"):
            return []
        nums = list(dict.fromkeys(int(x) for x in raw.replace(",", " ").split()))
        if len(nums) > n or any(not 0 <= x < count for x in nums):
            raise ValueError
        return nums

    return parse


def request_progress_rows(game: Game) -> None:
    if not game.ctx or not game.ctx["requests"]:
        return
    for req in game.ctx["requests"]:
        prog = game.request_progress(req, game.ctx["weeks"])
        if req["condition"]["type"] == "max_dead":
            state = f"사망 {prog['current']:.1f}/{prog['target']}명 이하 유지"
            color = ui.GREEN if prog["current"] <= prog["target"] else ui.RED
        else:
            state = f"{prog['current']}/{prog['target']}" + (" ✔" if prog["done"] else "")
            color = ui.GREEN if prog["done"] else ui.CYAN
        print(f" 의뢰 {FACTION_KO[req['faction']]}·{req['name']}: {req['goal']}  " + ui.c(state, color))


def show_standing(s: Standing) -> None:
    salary, _ = PAY_TIERS[s.pay]
    print(
        f" 상시 정책  목표 {s.target_members}명 · 보수 {s.pay}({salary:,}G) · 장비 {QUALITY_KO[s.gear_quality]} · "
        f"편성 {s.formation}({FORMATION_NOTE[s.formation]}) · 전리품 매입 {s.loot_buy_rate:.0%}   [p: 변경]"
    )


def edit_standing(s: Standing) -> Standing:
    s = copy.deepcopy(s)
    print(" 상시 정책 변경 (Enter = 유지)")
    s.target_members = ask("목표 인원", s.target_members)
    s.pay = ask("보수 등급 저/중/고", s.pay, lambda r: r if r in PAY_TIERS else 1 / 0)
    s.gear_quality = ask("장비 품질 low/mid/high", s.gear_quality, lambda r: r.lower() if r.lower() in QUALITY_KO else 1 / 0)
    s.formation = ask("편성 " + "/".join(FORMATIONS), s.formation, lambda r: r if r in FORMATIONS else 1 / 0)
    s.loot_buy_rate = ask("전리품 매입 비율 0.6/0.8/1.0", s.loot_buy_rate)
    return s


# ------------------------------------------------------------------ 화면: 매주
def show_finding(fd: dict | None, title: str) -> None:
    if not fd:
        return
    if fd["id"] == "quiet":
        print(f" {title}: " + ui.c(fd["text"], ui.DIM))
        return
    print(f" {title}: " + ui.c(f"[{fd['name']}] ", ui.YELLOW + ui.BOLD) + fd["text"])
    if fd.get("hint"):
        print("   " + ui.c(f"→ {fd['hint']}", ui.CYAN))


def week_header(game: Game, plan: Plan) -> None:
    st = game.state
    floor = game.allowed_floor(plan.floor)
    u = st.understanding[floor]
    unlock = game.p["dungeon"]["unlock_next_at_understanding"]
    print("\n" + "─" * WIDTH)
    print(
        f" {ui.c(f'{st.month + 1}월 {st.week + 1}주차', ui.BOLD)}   {floor}층 이해도 {ui.progress_bar(u, 10, unlock)} {u:.2f}   "
        f"탐사 가능 {st.members - st.injured:.0f}명 (부상 {st.injured:.0f})   훈련 +{st.train:.0%}"
    )
    gauges = "  ".join(
        f"{FACTION_KO[f]} " + ui.c(f"{st.gauges[f]:+.0f}", ui.GREEN if st.gauges[f] >= 0 else ui.RED) for f in FACTIONS
    )
    print(f" 우호도  {gauges}")
    request_progress_rows(game)
    show_finding(st.finding, "지난주 보고서")


def ask_floor(game: Game, plan: Plan) -> None:
    """현재 층 이해도가 기준을 넘고 다음 층에 갈 수 있으면 이동할지 묻는다. 거절하면 다음 주에 다시 묻는다."""
    st = game.state
    unlock = game.p["dungeon"]["unlock_next_at_understanding"]
    nxt = plan.floor + 1
    if plan.floor >= MAX_FLOOR or st.understanding[plan.floor] < unlock:
        return
    if game.allowed_floor(nxt) < nxt:
        need = game.p["dungeon"]["floor_state_level_required"][nxt]
        print(ui.c(f" {plan.floor}층 이해도 {unlock} 도달! 하지만 {nxt}층은 국가 Lv.{need}가 필요해요.", ui.YELLOW))
        return
    print(
        ui.c(f" {plan.floor}층 이해도가 {st.understanding[plan.floor]:.2f}예요. ", ui.GREEN)
        + f"남으면 보상이 계속 줄고, {nxt}층은 보상이 크지만 처음이라 위험해요."
    )
    answer = ask(f"{nxt}층으로 넘어갈까요? (y/n)", "y", lambda r: r.lower() if r.lower() in ("y", "n") else 1 / 0)
    if answer == "y":
        plan.floor = nxt
        print(ui.c(f"  → 이번 주부터 {nxt}층을 탐사해요.", ui.GREEN))
    else:
        print(f"  → {plan.floor}층에 머물러요.")


def activity_menu(game: Game) -> list[str]:
    """번호 붙은 활동 목록을 보여주고, 번호 → 활동 키 목록을 돌려준다."""
    wk = game.p["weekly"]
    available = game.available_activities()
    keys = list(game.p["activities"])
    print(f" 준비 활동 (행동력 {wk['actions_per_week']})")
    for i, key in enumerate(keys, 1):
        act = game.p["activities"][key]
        line = f"   {i}) {act['name']:<10} {act['desc']}"
        if key not in available:
            line = ui.c(line + f"  — {FACTION_KO[act['faction']]} 우호도가 {wk["faction_help_min_gauge"]} 미만이라 불가", ui.DIM)
        elif act.get("faction"):
            line = line.replace(act["name"], ui.c(act["name"], ui.YELLOW), 1)
        print(line)
    return keys


def ask_activities(game: Game, plan: Plan, keys: list[str]) -> list[str]:
    wk = game.p["weekly"]
    available = game.available_activities()
    current = [keys.index(a) + 1 for a in plan.activities if a in available]

    def parse(raw: str) -> list:
        if raw in ("0", "-", "없음"):
            return []
        nums = [int(x) for x in raw.replace(",", " ").split()]
        chosen = [keys[n - 1] for n in dict.fromkeys(nums)]
        if len(chosen) > wk["actions_per_week"] or any(k not in available for k in chosen) or any(n < 1 for n in nums):
            raise ValueError
        return [keys.index(k) + 1 for k in chosen]

    nums = ask(f"활동 번호 최대 {wk['actions_per_week']}개 (예: 1 6, 0 = 없음)", current, parse)
    return [keys[n - 1] for n in nums]


def range_table(game: Game, pol: Policy, plan: Plan) -> float:
    """고른 활동을 반영한 범위별 예상치를 보여주고 추천 범위를 돌려준다."""
    floor = game.allowed_floor(plan.floor)
    rows = [(d, game.preview_week(pol, floor, d, plan.activities)) for d in RANGES]
    best = max(rows, key=lambda r: week_score(game, pol, r[1]))[0]
    pv0 = rows[0][1]
    if pv0["notes"]:
        for n in pv0["notes"]:
            print("   " + ui.c(n, ui.CYAN))
    if pv0["gold_cost"] or pv0["gauge_cost"]:
        costs = [f"금화 {pv0['gold_cost']:,.0f}G"] if pv0["gold_cost"] else []
        costs += [f"{FACTION_KO[f]} 우호도 −{d:.0f}" for f, d in pv0["gauge_cost"].items()]
        print("   준비 비용: " + ", ".join(costs))
    print(f" {floor}층 이번 주 탐사 범위별 예상")
    print("   탐사 범위   성공률   예상 손실   예상 수익")
    for d, pv in rows:
        mark = ui.c("  ← 추천", ui.GREEN) if d == best else ""
        print(f"   {d:>8.0%}   {pv['success']:>5.0%}   {pv['party'] * pv['loss']:>6.1f}명   {pv['haul']:>8,.0f}G{mark}")
    return best


def week_report(game: Game, h: dict) -> None:
    result = ui.c("성공", ui.GREEN + ui.BOLD) if h["cleared"] else ui.c("후퇴", ui.RED + ui.BOLD)
    acts = ", ".join(game.p["activities"][a]["name"] for a in h["activities"]) or "없음"
    print(ui.c(f" ▶ {h['month']}월 {h['week']}주차 탐사 보고서", ui.BOLD))
    print(
        f"   {h['floor']}층 · 범위 {h['depth']:.0%} · 준비 활동: {acts} · {h['party']:.0f}명 출발 → {result} (확률 {h['success']:.0%})"
    )
    print(
        f"   사망 {h['dead']:.0f}명 · 부상 {h['injured_new']:.0f}명 · 복귀 {h['healed']:.0f}명   "
        f"수익 {h['haul']:,.0f}G · 명성 +{h['rep_gain']:.0f} · 이해도 {h['understanding']:.2f}"
    )
    for n in h["notes"]:
        print("   " + ui.c(n, ui.CYAN))
    if h["unlocked"]:
        print("   " + ui.c(f"{h['floor'] + 1}층으로 가는 길이 열렸어요!", ui.GREEN))
    show_finding(h["finding"], "   새 정황")


def month_report(game: Game, h: dict) -> None:
    print("\n" + "═" * WIDTH)
    print(ui.c(f" {h['month']}월 정산", ui.BOLD) + f"   탐사 {h['cleared']}/{h['weeks_played']}주 성공 · 사망 {h['lost']:.0f}명 · 이탈 {h['left']:.0f}명 · 모집 {h['recruited']:.0f}명")
    for k, v in h["income"].items():
        print(f"    + {k:<14}{v:>10,.0f}")
    for k, v in h["expense"].items():
        print(f"    - {k:<14}{v:>10,.0f}")
    color = ui.GREEN if h["net"] >= 0 else ui.RED
    print("    = " + ui.c(f"순이익 {h['net']:+,.0f}G", color + ui.BOLD) + f"   명성 +{h['rep_gain']:.0f}")
    for r in h["requests"]:
        req = r["request"]
        mark = ui.c("의뢰 성공", ui.GREEN + ui.BOLD) if r["done"] else ui.c("의뢰 실패", ui.RED + ui.BOLD)
        result = reward_text(game, r["outcome"]) if r["outcome"] else "불이익 없음"
        print(f"    {mark} {FACTION_KO[req['faction']]}·{req['name']} → {result}")
    if h["leveled"]:
        print("    " + ui.c("레벨업: " + ", ".join(FACTION_KO[f] for f in h["leveled"]), ui.GREEN))
    if h["unpaid"]:
        print("    " + ui.c("⚠ 월급 미지급! 모험가 대부분이 떠났어요.", ui.RED))


# ------------------------------------------------------------------ 진행
def play_week_auto(game: Game, pol: Policy, plan: Plan) -> dict:
    floor, depth, acts = plan_week(game, pol)
    plan.floor, plan.depth, plan.activities = floor, depth, acts
    names = ", ".join(game.p["activities"][a]["name"] for a in acts) or "없음"
    print(f"  (자동) {floor}층 · 범위 {depth:.0%} · 활동 {names}")
    return game.play_week(floor, depth, acts)


def play(game: Game) -> None:
    standing, plan = Standing(), Plan()
    while not game.state.over:
        # 월초
        dashboard(game)
        show_standing(standing)
        auto_month = False
        try:
            request_menu(game)
            plan.requests = ask("수락할 의뢰 번호 (예: 0 2, - = 없음)", [], parse_requests(game), allow_edit=True)
            plan.card = ask("정책 카드 번호", 0, allow_edit=True)
            pol = build_policy(game, standing, plan)
        except EditStanding:
            standing = edit_standing(standing)
            continue
        except Auto:
            pol, auto_month = balanced(game), True
            print("  이번 달은 자동으로 진행해요.")
        start = game.begin_month(pol)
        accepted = ", ".join(r["name"] for r in game.ctx["requests"]) or "없음"
        print(
            f"  → 이탈 {start['left']:.0f}명, 모집 {start['recruited']:.0f}명, 정책 카드 '{start['card']}' 적용, 수락한 의뢰: {accepted}"
        )

        # 매주
        for _ in range(game.weeks):
            if game.state.over:
                break
            week_header(game, plan)
            if auto_month:
                week_report(game, play_week_auto(game, pol, plan))
                continue
            try:
                ask_floor(game, plan)
                keys = activity_menu(game)
                plan.activities = ask_activities(game, plan, keys)
                best = range_table(game, pol, plan)
                plan.depth = ask("탐사 범위 % (10~100)", round(best * 100)) / 100
                h = game.play_week(plan.floor, plan.depth, plan.activities)
            except Auto:
                h = play_week_auto(game, pol, plan)
            plan.floor = h["floor"]
            week_report(game, h)

        # 월말
        month_report(game, game.end_month())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int)
    ap.add_argument("-p", "--params")
    ap.add_argument("--no-color", action="store_true", help="색상 끄기 (글자가 깨질 때)")
    args = ap.parse_args()
    ui.set_color(not args.no_color)
    game = Game(load_params(args.params), seed=args.seed)
    print(__doc__)
    try:
        play(game)
    except (Quit, KeyboardInterrupt, EOFError):
        print("\n종료")
        return
    collapsed = ", ".join(FACTION_KO[f] for f in game.state.collapsed)
    ko = {
        "win": ui.c("🎉 10층 공략 성공!", ui.GREEN + ui.BOLD),
        "collapse": ui.c(f"💀 {collapsed}이(가) 길드에 등을 돌렸어요 (우호도 -100). 게임 오버", ui.RED + ui.BOLD),
        "deficit": ui.c("금고가 3개월 연속 바닥나 게임 오버", ui.RED + ui.BOLD),
        "timeout": "시간 초과",
    }
    print(f"\n{ko.get(game.state.result, game.state.result)} ({game.state.month}개월)")


if __name__ == "__main__":
    main()
