"""자동 플레이 전략 봇. 각 봇은 Game을 보고 이번 달 Policy를 돌려준다.

'뻔한 정답 전략'이 있는지 보려고 성향이 뚜렷한 봇을 여러 개 둔다.
"""
from __future__ import annotations

from sim import FACTIONS, MAX_FLOOR, Game, Policy


def phase(month: int) -> str:
    """기획서의 예상 진행 시나리오 구간."""
    if month < 3:
        return "early"
    if month < 8:
        return "mid"
    if month < 15:
        return "late"
    return "end"


def pick_card(game: Game, score) -> int:
    """제시된 카드 중 score(카드 적용 후 게이지)가 가장 큰 카드의 번호."""
    best, best_i = None, 0
    for i, card in enumerate(game.cards()):
        deltas = game.gauge_deltas(card["gauges"])
        g = {f: game.state.gauges[f] + deltas[f] for f in deltas}
        s = score(g) + card.get("gold", 0) / 1000
        if best is None or s > best:
            best, best_i = s, i
    return best_i


def accept(game: Game, order: list[str]) -> list[int]:
    """제시된 의뢰(세력별 1장) 중 order 순서의 세력 것을 최대 개수만큼 수락."""
    offered = [r["faction"] for r in game.requests()]
    n = game.p["factions"]["max_requests"]
    return [offered.index(f) for f in dict.fromkeys(order) if f in offered][:n]


def by_gauge(game: Game) -> list[str]:
    """게이지가 낮은 세력부터."""
    return sorted(FACTIONS, key=lambda f: game.state.gauges[f])


def target_floor(game: Game) -> int:
    """이해도가 충분히 쌓인 층은 넘기고, 갈 수 있는 가장 깊은 층."""
    return game.allowed_floor(game.state.max_unlocked)


def best_depth(game: Game, pol: Policy, member_value: float = 2000) -> float:
    """기대 보상 − 기대 손실 비용이 가장 큰 탐사 범위. member_value = 모험가 1명을 잃는 비용(위약금 제외)."""
    dun = game.p["dungeon"]
    floor = game.allowed_floor(pol.floor)
    reward = dun["floor_reward_per_member"][floor]
    lost_cost = dun["penalty_per_lost_member"] + member_value
    best, best_d = None, 0.5
    for i in range(1, 11):
        d = i / 10
        s, ratio = game.odds(pol, floor, d)
        share = s + (1 - s) * dun["retreat_reward_share"]
        loss = game.loss_rate(pol, floor, d, ratio, routed=1 - s)
        score = reward * game.depth_mult(d) * share * (1 - loss) - loss * lost_cost
        if best is None or score > best:
            best, best_d = score, d
    return best_d


def with_depth(game: Game, pol: Policy) -> Policy:
    """10층에서 승리 조건을 노릴 만하면 탐사 범위 95%, 아니면 기대값이 가장 좋은 범위."""
    rules = game.p["rules"]
    if game.allowed_floor(pol.floor) == MAX_FLOOR:
        s, _ = game.odds(pol, MAX_FLOOR, 0.95)
        if s >= rules["win_success"] and game.state.members >= rules["win_min_members"]:
            pol.depth = 0.95
            return pol
    pol.depth = best_depth(game, pol)
    return pol


DEPTHS = (0.3, 0.5, 0.7, 0.9, 1.0)
GAUGE_VALUE = 300  # 게이지 1점을 금화로 치면 얼마인지 (봇 판단용)
MEMBER_VALUE = 2000  # 모험가 1명을 잃는 비용 (위약금 제외)


def week_score(game: Game, pol: Policy, pv: dict) -> float:
    """주간 예상치를 금화 기준 점수 하나로."""
    dun, wk = game.p["dungeon"], game.p["weekly"]
    reward = dun["floor_reward_per_member"][pv["floor"]]
    dead = pv["party"] * pv["loss"] * (1 - wk["injured_share"])
    und_value = game.state.members * reward / game.weeks * 3
    return (
        pv["haul"]
        - dead * (dun["penalty_per_lost_member"] + MEMBER_VALUE)
        - pv["gold_cost"]
        - sum(pv["gauge_cost"].values()) * GAUGE_VALUE
        + pv["understanding_gain"] * und_value
    )


def plan_week(game: Game, pol: Policy, fixed_depth: float | None = None) -> tuple[int, float, list]:
    """가장 깊은 층에서, 준비 활동을 하나씩 욕심껏 더하며 점수가 가장 좋은 (층, 범위, 활동)을 고른다."""
    rules, wk = game.p["rules"], game.p["weekly"]
    floor = target_floor(game)
    depths = (fixed_depth,) if fixed_depth is not None else DEPTHS
    available = list(game.available_activities())

    # 10층에서 승리 조건(범위 90% 이상 + 성공률 70% 이상)을 맞출 수 있으면 바로 노린다
    if floor == MAX_FLOOR and game.state.members >= rules["win_min_members"]:
        best = None
        for a in [[]] + [[x] for x in available] + [[x, y] for i, x in enumerate(available) for y in available[i + 1 :]]:
            pv = game.preview_week(pol, floor, 0.95, a)
            if pv["success"] >= rules["win_success"] and (best is None or pv["success"] > best[0]):
                best = (pv["success"], a)
        if best:
            return floor, 0.95, best[1]

    def best_for(acts: list) -> tuple[float, float]:
        scored = [(week_score(game, pol, game.preview_week(pol, floor, d, acts)), d) for d in depths]
        return max(scored)

    acts: list = []
    score, depth = best_for(acts)
    for _ in range(wk["actions_per_week"]):
        options = [(best_for(acts + [a]), a) for a in available if a not in acts]
        if not options:
            break
        (s, d), a = max(options)
        if s <= score:
            break
        acts, score, depth = acts + [a], s, d
    return floor, depth, acts


def stocked(policy: Policy, game: Game, quality: str, coverage: float = 1.0) -> Policy:
    """예상 인원에 맞춰 물약·장비 수량과 기준가를 채운다."""
    fac = game.p["facilities"]
    expected = max(game.state.members, min(policy.target_members, game.state.members + 8))
    policy.potion_qty = int(expected * fac["potions_per_member"] * coverage)
    policy.potion_price = fac["potion_ref_price"]
    policy.gear_quality = quality
    policy.gear_qty = int(expected * fac["gear_per_member"] * coverage)
    policy.gear_price = fac["gear_ref_price"][quality]
    return policy


# ------------------------------------------------------------------ 봇들
def balanced(game: Game) -> Policy:
    """기획서 시나리오를 따라가며 세 세력 게이지를 고르게 유지한다."""
    st = game.state
    ph = phase(st.month)
    table = {
        "early": (20, 1000, 500, {"low": 1.0}, "low"),
        "mid": (40, 1200, 1000, {"low": 0.5, "mid": 0.5}, "mid"),
        "late": (50, 1500, 1500, {"mid": 0.5, "high": 0.5}, "high"),
        "end": (58, 1500, 1500, {"mid": 0.2, "high": 0.8}, "high"),
    }
    target, salary, promo, grades, quality = table[ph]
    floor = target_floor(game)
    pol = Policy(
        target_members=target,
        salary=salary,
        promo=promo,
        grade_mix=grades,
        type_mix={"combat": 0.5, "scout": 0.3, "scholar": 0.2},
        loot_buy_rate=0.8,
        floor=floor,
        card=pick_card(game, lambda g: min(g.values())),
        requests=accept(game, by_gauge(game)),
        rep_levels=["state", "church", "merchant"],
    )
    return with_depth(game, stocked(pol, game, quality))


def cheap(game: Game) -> Policy:
    """비용 최소화: 낮은 월급·저품질·전리품 60%."""
    floor = target_floor(game)
    pol = Policy(
        target_members=30,
        salary=800,
        promo=300,
        grade_mix={"low": 1.0},
        loot_buy_rate=0.6,
        floor=floor,
        card=pick_card(game, lambda g: min(g.values())),
        requests=accept(game, ["merchant"] + by_gauge(game)),
        rep_levels=["state", "merchant", "church"],
    )
    return with_depth(game, stocked(pol, game, "low"))


def premium(game: Game) -> Policy:
    """처음부터 고급: 높은 월급·고품질·전리품 100%."""
    floor = target_floor(game)
    pol = Policy(
        target_members=50,
        salary=1500,
        promo=1500,
        grade_mix={"mid": 0.3, "high": 0.7},
        loot_buy_rate=1.0,
        floor=floor,
        card=pick_card(game, lambda g: min(g.values())),
        requests=accept(game, by_gauge(game)),
        rep_levels=["state", "merchant", "church"],
    )
    return with_depth(game, stocked(pol, game, "high"))


def all_in(faction: str):
    """한 세력에 몰빵: 의뢰·카드·명성을 그 세력에 준다."""

    def bot(game: Game) -> Policy:
        pol = balanced(game)
        pol.requests = accept(game, [faction, "state"])
        pol.card = pick_card(game, lambda g: g[faction])
        pol.rep_levels = [faction, "state"] if faction != "state" else ["state"]
        return pol

    bot.__name__ = f"all_in_{faction}"
    return bot


def state_careful(game: Game) -> Policy:
    """국가 우선이되, 게이지가 -50 아래로 떨어진 세력이 있으면 그 세력부터 달랜다 (세력 붕괴 방지)."""
    pol = state_focus(game)
    worst = min(FACTIONS, key=lambda f: game.state.gauges[f])
    if game.state.gauges[worst] < -50:
        pol.requests = accept(game, [worst, "state"])
        pol.card = pick_card(game, lambda g: min(g.values()))
    return pol


def deep_diver(game: Game) -> Policy:
    """이해도가 낮아도 해금되자마자 넓게(95%) 탐사한다."""
    pol = balanced(game)
    pol.depth = 0.95
    pol.type_mix = {"combat": 0.3, "scout": 0.5, "scholar": 0.2}
    return pol


def scholar_rush(game: Game) -> Policy:
    """학자형 과반으로 이해도를 빨리 쌓아 층을 빨리 연다."""
    pol = balanced(game)
    pol.type_mix = {"combat": 0.3, "scout": 0.2, "scholar": 0.5}
    return with_depth(game, pol)


def state_focus(game: Game) -> Policy:
    """10층 허가(국가 Lv.3)를 받을 때까지 국가 편을 들고, 그 뒤엔 균형을 맞춘다."""
    pol = balanced(game)
    if game.state.levels["state"] < 3:
        pol.requests = accept(game, ["state"] + by_gauge(game))
        pol.card = pick_card(game, lambda g: g["state"] + 0.3 * min(g.values()))
        pol.rep_levels = ["state"]
    return pol


def random_bot(game: Game) -> Policy:
    """무작위 정책. 다른 봇과 비교할 하한선."""
    r = game.rng
    grades = {g: r.random() for g in ("low", "mid", "high")}
    quality = r.choice(["low", "mid", "high"])
    pol = Policy(
        target_members=r.randint(10, 60),
        salary=r.randint(600, 1800),
        promo=r.randint(0, 2000),
        grade_mix=grades,
        type_mix={t: r.random() for t in ("combat", "scout", "scholar")},
        requests=r.sample(range(len(game.state.offered_requests)), 2),
        loot_buy_rate=r.choice([0.6, 0.8, 1.0]),
        floor=r.randint(1, MAX_FLOOR),
        depth=r.random(),
        card=r.randrange(len(game.state.offered_cards)),
        rep_levels=r.sample(list(FACTIONS), 3),
    )
    return stocked(pol, game, quality, coverage=r.uniform(0.5, 1.2))


def random_week(game: Game, pol: Policy) -> tuple[int, float, list]:
    r = game.rng
    acts = r.sample(list(game.available_activities()), k=min(2, len(game.available_activities())))
    return r.randint(1, MAX_FLOOR), r.random(), acts


# 봇별 주간 계획. 지정하지 않은 봇은 plan_week(욕심쟁이 기대값)을 쓴다.
deep_diver.planner = lambda game, pol: plan_week(game, pol, fixed_depth=0.95)
random_bot.planner = random_week

BOTS = {
    "balanced": balanced,
    "cheap": cheap,
    "premium": premium,
    "all_in_merchant": all_in("merchant"),
    "all_in_church": all_in("church"),
    "all_in_state": all_in("state"),
    "state_focus": state_focus,
    "state_careful": state_careful,
    "deep_diver": deep_diver,
    "scholar_rush": scholar_rush,
    "random": random_bot,
}
