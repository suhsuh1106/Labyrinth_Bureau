"""주·월 이원화 턴 시뮬레이션 코어.

한 달 = 4주.
  begin_month(policy)  월초: 인력 모집·이탈, 물약·장비 발주, 정책 카드
  play_week(...)       매주: 준비 활동 2개 + 탐사 범위 → 탐사 → 보고서(다음 주 정황)
  end_month()          월말: 전리품 판매, 세력 거래 게이지, 정산, 명성 레벨업, 종료 판정
step(policy, planner)는 위 셋을 한 번에 돌린다 (봇 대량 시뮬레이션용).

경제 수치(보상·손실·이해도)는 params.json에 '한 달 기준'으로 적혀 있고, 주간 계산에서 주 수로 나눈다.
"""
from __future__ import annotations

import json
import random
from dataclasses import dataclass, field
from pathlib import Path

GRADES = ("low", "mid", "high")
TYPES = ("combat", "scout", "scholar")
FACTIONS = ("merchant", "church", "state")
FACTION_KO = {"merchant": "상단", "church": "교회", "state": "국가"}
MAX_FLOOR = 10

DEFAULT_PARAMS = Path(__file__).with_name("params.json")


def load_params(path: str | Path | None = None) -> dict:
    with open(path or DEFAULT_PARAMS, encoding="utf-8") as f:
        return json.load(f)


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


@dataclass
class Policy:
    """한 달 동안 유지되는 운영 정책. floor/depth/activities는 planner가 없을 때 매주 쓰는 기본값."""

    # 모험가 단
    target_members: int = 20
    salary: int = 1000
    promo: int = 500
    grade_mix: dict = field(default_factory=lambda: {"low": 1.0, "mid": 0.0, "high": 0.0})
    type_mix: dict = field(default_factory=lambda: {"combat": 0.5, "scout": 0.3, "scholar": 0.2})
    # 시설
    potion_qty: int = 60
    potion_price: int = 50
    gear_quality: str = "low"
    gear_qty: int = 20
    gear_price: int = 90
    # 탐사 (주간 기본값)
    floor: int = 1
    depth: float = 0.5
    activities: list = field(default_factory=list)
    healers: int = 0  # 인사부가 고용하는 힐러 수
    care: float = 0.0  # 인사부 처우비 (1인당 G). 이탈을 줄인다
    # 전리품 (매입 비율만 정한다. 장비는 상단, 물약은 교회, 전리품은 시장으로 고정)
    loot_buy_rate: float = 0.8
    # 도시
    card: int = 0  # 이번 달 제시된 카드 중 몇 번째를 고를지
    requests: list = field(default_factory=list)  # 이번 달 제시된 의뢰 중 수락할 번호들
    rep_levels: list = field(default_factory=list)  # 레벨업을 시도할 세력 순서
    rep_to_gauge: dict = field(default_factory=dict)  # 세력 -> 남은 명성 중 게이지로 바꿀 비율


@dataclass
class Mods:
    """준비 활동과 보고서 정황이 이번 주 탐사에 주는 보정."""

    success: float = 0.0  # 성공 확률 가산 (%p)
    difficulty: float = 1.0
    power: float = 1.0
    reward: float = 1.0
    loss: float = 1.0
    party: float = 1.0  # 탐사에 나가는 인원 배율
    understanding: float = 0.0
    potion_off: bool = False
    no_heal: bool = False
    heal: bool = False
    train: float = 0.0
    gold: float = 0.0
    gold_per_member: float = 0.0
    gold_per_injured: float = 0.0
    gauge_cost: dict = field(default_factory=dict)
    gauge_gain: dict = field(default_factory=dict)
    notes: list = field(default_factory=list)
    seized: list = field(default_factory=list)  # 대응하거나 살린 정황 id (의뢰 판정용)
    secrets: list = field(default_factory=list)  # 이번 주 들어맞은 층의 비밀 번호

    def apply(self, effect: dict) -> None:
        for k, v in effect.items():
            if k in ("success", "understanding", "train", "gold", "gold_per_member", "gold_per_injured"):
                setattr(self, k, getattr(self, k) + v)
            elif k in ("difficulty", "power", "reward", "loss", "party"):
                setattr(self, k, getattr(self, k) * v)
            elif k in ("potion_off", "no_heal", "heal"):
                setattr(self, k, getattr(self, k) or v)
            elif k in ("gauge_cost", "gauge"):
                target = self.gauge_cost if k == "gauge_cost" else self.gauge_gain
                for f, d in v.items():
                    target[f] = target.get(f, 0) + d


@dataclass
class State:
    month: int = 0
    week: int = 0  # 이번 달 안에서 진행한 주 수 (0~4)
    gold: float = 0.0
    reputation: float = 0.0
    members: int = 0  # 부상자 포함 전체 인원 (월급은 전원에게). 사람 수는 정수
    injured: int = 0
    train: float = 0.0  # 훈련으로 쌓인 전력 보너스
    gauges: dict = field(default_factory=lambda: {f: 0.0 for f in FACTIONS})
    levels: dict = field(default_factory=lambda: {f: 0 for f in FACTIONS})
    understanding: list = field(default_factory=lambda: [0.0] * (MAX_FLOOR + 1))
    max_unlocked: int = 1
    deficit_streak: int = 0
    over: bool = False
    result: str = ""  # win / collapse / deficit / bankrupt / timeout
    collapsed: list = field(default_factory=list)  # 게이지 -100으로 등을 돌린 세력
    offered_cards: list = field(default_factory=list)
    offered_requests: list = field(default_factory=list)  # 세력별 의뢰 1장씩
    last_tax: float = 0.0
    finding: dict | None = None  # 지난주 보고서의 정황 → 이번 주에 영향
    history: list = field(default_factory=list)  # 월간 리포트
    secrets: dict = field(default_factory=dict)  # 층 → [{"kind": gear/formation/prep, "key": ...}] (숨김)
    secret_found: set = field(default_factory=set)  # 발견한 (층, 번호)
    perk_mod: dict = field(default_factory=dict)  # 세력 → 혜택 단계 보정 (이사회 모드: 경계도 견제 · 부탁)
    level_waiver: bool = False  # 국가 부탁: 다음 레벨업의 우호도 조건 1회 면제
    level_gauge_extra: float = 0.0  # 국가 경계도 견제: 층 허가 우호도 조건 강화


def weighted_avg(mix: dict, values: dict) -> float:
    total = sum(mix.values()) or 1.0
    return sum(mix.get(k, 0) * values[k] for k in values) / total


def majority(mix: dict, key: str, threshold: float) -> bool:
    total = sum(mix.values()) or 1.0
    return mix.get(key, 0) / total >= threshold


def demand_factor(price: float, ref: float, elasticity: float = 1.0) -> float:
    """기준가에서 1.0. 가격이 기준가보다 x% 비싸면 판매량이 elasticity × x% 줄어든다 (최대 1.5)."""
    return clamp(1 - elasticity * (price - ref) / ref, 0.0, 1.5)


class Game:
    def __init__(self, params: dict | None = None, seed: int | None = None):
        self.p = params or load_params()
        self.rng = random.Random(seed)
        s = self.p["start"]
        self.state = State(gold=s["gold"], reputation=s["reputation"], members=s["members"])
        self.ctx: dict | None = None  # 진행 중인 달의 장부
        self._preview = False  # 예측 계산 중이면 아직 모르는 비밀을 반영하지 않는다
        self.state.understanding[1] = s.get("understanding_1", 0.0)  # 1층은 길드가 서기 전부터 조금 알려져 있다
        self.state.secrets = self.make_secrets()
        self.offer_cards()
        self.offer_requests()

    # ------------------------------------------------------------ 조회용
    @property
    def weeks(self) -> int:
        return self.p["weekly"]["weeks_per_month"]

    def allowed_floor(self, floor: int) -> int:
        """해금 층과 국가 레벨 조건을 모두 만족하는 가장 깊은 층으로 보정한다."""
        req = self.p["dungeon"]["floor_state_level_required"]
        f = clamp(floor, 1, self.state.max_unlocked)
        while f > 1 and self.state.levels["state"] < req[int(f)]:
            f -= 1
        return int(f)

    def salary_ref(self, floor: int = 1) -> float:
        """모험가가 기대하는 월급. 깊은 층으로 보낼수록 위험 수당을 원한다."""
        adv = self.p["adventurers"]
        return adv["salary_ref"] * (1 + adv.get("risk_pay_per_floor", 0.0) * (floor - 1))

    def sanctioned(self, faction: str) -> bool:
        return self.standing(faction) == -2

    def standing(self, faction: str) -> int:
        """우호도 단계: -2 적대, -1 냉담, 0 중립, 1 우호, 2 신뢰. tiers = [적대 미만, 냉담 미만, 우호 이상, 신뢰 이상]."""
        g = self.state.gauges[faction]
        hostile, cold, friendly, trusted = self.p["politics"]["tiers"]
        if g < hostile:
            return -2
        if g < cold:
            return -1
        return (g >= friendly) + (g >= trusted)

    def perk(self, name: str) -> float:
        """세력 우위 혜택 값. supply_discount(상단) · healer_discount(교회) · tax_rate(국가).
        perk_mod: 경계도 견제(−)나 부탁(+)으로 혜택 단계를 이번 달만 옮긴다."""
        pol = self.p["politics"]
        faction = pol["perks"][name]["faction"]
        tier = clamp(self.standing(faction) + self.state.perk_mod.get(faction, 0), -2, 2)
        return pol["perks"][name]["by_standing"][str(int(tier))]

    def supply_price_mult(self) -> float:
        """소모품(물약·장비) 가격 배율. 상단 우호도가 높으면 싸지고, 낮으면 비싸진다."""
        return 1 - self.perk("supply_discount")

    def healer_wage(self) -> float:
        wk = self.p["weekly"]
        return wk["healer_wage"] * (1 - self.perk("healer_discount"))

    def cards(self) -> list[dict]:
        return [self.p["policy_cards"][i] for i in self.state.offered_cards]

    def offer_cards(self) -> None:
        n = self.p["factions"]["cards_per_month"]
        self.state.offered_cards = self.rng.sample(range(len(self.p["policy_cards"])), n)

    def wage_mult(self, policy: Policy) -> float:
        return weighted_avg(policy.grade_mix, self.p["adventurers"]["grade_wage_mult"])

    def gauge_deltas(self, changes: dict) -> dict:
        """세력 견제: 어느 세력이든 게이지가 오르면 나머지 두 세력이 그 rivalry 비율만큼 떨어진다."""
        rivalry = self.p["factions"]["rivalry"]
        out = {f: 0.0 for f in FACTIONS}
        for f, d in changes.items():
            out[f] += d
            if d > 0:
                for other in FACTIONS:
                    if other != f:
                        out[other] -= d * rivalry
        return out

    def apply_gauges(self, changes: dict) -> None:
        for f, d in self.gauge_deltas(changes).items():
            self.state.gauges[f] = clamp(self.state.gauges[f] + d, -100, 100)

    def depth_mult(self, depth: float, kind: str = "reward") -> float:
        """탐사 범위(depth) 배율. kind = "difficulty" 또는 "reward". 난이도 쪽이 더 가파르면 무작정 넓게 가는 게 손해가 된다."""
        dun = self.p["dungeon"]
        return dun[f"depth_{kind}_min"] + dun[f"depth_{kind}_range"] * depth

    def available_activities(self) -> dict[str, dict]:
        """이번 주 고를 수 있는 준비 활동. 세력 협력은 그 세력 게이지가 기준 이상일 때만."""
        wk = self.p["weekly"]
        out = {}
        for key, act in self.p["activities"].items():
            f = act.get("faction")
            if f and self.state.gauges[f] < wk["faction_help_min_gauge"]:
                continue
            out[key] = act
        return out

    def week_mods(self, depth: float, activities: list[str], floor: int | None = None) -> Mods:
        """준비 활동 + 지난주 보고서 정황 → 이번 주 보정."""
        m = Mods()
        for key in activities:
            m.apply(self.p["activities"][key]["effect"])
        fd = self.state.finding
        if fd and fd.get("effect"):
            if "requires" in fd:
                if fd["requires"] in activities:
                    m.apply(fd["effect"])
                    m.seized.append(fd["id"])
                    m.notes.append(f"{fd['name']}: 기회를 살렸어요")
            elif "min_range" in fd:
                if depth >= fd["min_range"]:
                    m.apply(fd["effect"])
                    m.seized.append(fd["id"])
                    m.notes.append(f"{fd['name']}: 기회를 살렸어요")
            elif any(c in activities for c in fd.get("counters", [])):
                m.apply(fd.get("bonus", {}))
                m.seized.append(fd["id"])
                m.notes.append(f"{fd['name']}: 대비했어요")
            else:
                m.apply(fd["effect"])
                m.notes.append(f"{fd['name']}: 대비하지 못했어요")
        # 이사회 모드: 부서장 특성이 주는 상시 보정
        ctx = self.ctx or {}
        if ctx.get("org_mods"):
            m.apply(ctx["org_mods"])
        for f, mult in ctx.get("help_discount", {}).items():
            if f in m.gauge_cost:
                m.gauge_cost[f] *= mult
        # 전초기지 정비 상태: 노후 캠프 층은 손실이 늘고, 방치 캠프가 있으면 그 층과 더 깊은 층이 보급선 단절
        camps = ctx.get("camps") or {}
        if floor and camps:
            op = self.p["outposts"]
            if camps.get(floor) == "노후":
                m.loss *= op["worn_loss"]
            if any(s == "방치" and f <= floor for f, s in camps.items()):
                m.success += op["abandoned_success"]
        # 층의 비밀: 공략 지침(장비 계열 · 편성 · 준비 활동)이 맞으면 난이도와 손실이 준다.
        # 예측(preview)에는 이미 발견한 비밀만 반영한다. 모르는 비밀은 탐사부도 이사회도 계산에 넣을 수 없다.
        st = self.state
        for i, sec in enumerate(st.secrets.get(floor, []) if floor else []):
            if self._preview and (floor, i) not in st.secret_found:
                continue
            if self.secret_hit(sec, activities):
                m.apply(self.p["secrets"]["effect"])
                m.secrets.append(i)
        return m

    def secret_hit(self, sec: dict, activities: list[str]) -> bool:
        ctx = self.ctx or {}
        if sec["kind"] == "gear":
            return ctx.get("gear_type") == sec["key"]
        if sec["kind"] == "formation":
            return ctx.get("formation") == sec["key"]
        return sec["key"] in activities

    def make_secrets(self) -> dict:
        """판마다 층별 공략 공식을 무작위로 정한다. 1~4층은 1개, two_secrets_from층부터 2개."""
        cfg = self.p.get("secrets")
        if not cfg:
            return {}
        rng = random.Random(self.rng.random())
        options = {
            "gear": [k for k in cfg["gear_types"] if k != "none"],
            "formation": [k for k in cfg["formations"] if k != "balanced"],
            "prep": list(cfg["preps"]),
        }
        out = {}
        for floor in range(1, MAX_FLOOR + 1):
            n = 1 if floor < cfg["two_secrets_from"] else 2
            out[floor] = [{"kind": k, "key": rng.choice(options[k])} for k in rng.sample(list(options), n)]
        return out

    def odds(
        self,
        policy: Policy,
        floor: int,
        depth: float,
        potion_cov: float = 1.0,
        gear_cov: float = 1.0,
        mods: Mods | None = None,
    ) -> tuple[float, float]:
        """(성공 확률, 난이도/전력 비율)."""
        mods = mods or Mods()
        adv, typ, fac, dun = self.p["adventurers"], self.p["types"], self.p["facilities"], self.p["dungeon"]
        und = self.state.understanding[floor]
        synergy = (1 - und) if typ["synergy_fades_with_understanding"] else 1.0
        q = policy.gear_quality
        gear_mult = 0.7 + gear_cov * (fac["gear_power"][q] - 0.7)
        if mods.potion_off:
            potion_cov = 0.0
        power = (
            weighted_avg(policy.grade_mix, adv["grade_power"])
            * gear_mult
            * (1 + potion_cov * fac["potion_power_bonus"])
            * (1 + und * dun["understanding_power_bonus"])
            * (1 + self.state.train)
            * mods.power
            * dun["power_scale"]
        )
        ratio = dun["floor_difficulty"][floor] * self.depth_mult(depth, "difficulty") * mods.difficulty / power
        success = 1 / (1 + ratio ** dun["success_steepness"])
        if majority(policy.type_mix, "scout", typ["majority"]):
            success += typ["scout_depth_bonus"] * depth * synergy
        return clamp(success + mods.success, 0.0, 0.97), ratio

    def loss_rate(
        self, policy: Policy, floor: int, depth: float, ratio: float, routed: float, mods: Mods | None = None
    ) -> float:
        """한 번(1주) 탐사의 손실률. routed = 후퇴 여부(0/1), 기대값을 볼 때는 후퇴 확률."""
        mods = mods or Mods()
        typ, dun = self.p["types"], self.p["dungeon"]
        loss = (dun["base_loss"] * ratio + routed * dun["rout_loss"] * depth) / self.weeks * mods.loss
        if majority(policy.type_mix, "combat", typ["majority"]):
            und = self.state.understanding[floor]
            synergy = (1 - und) if typ["synergy_fades_with_understanding"] else 1.0
            loss *= 1 - typ["combat_survival_bonus"] * synergy
        return clamp(loss, 0.0, dun["max_loss"])

    def weekly_understanding_gain(self) -> float:
        """월 기준 이해도 증가량을 같은 결과가 나오는 주간 값으로."""
        g = self.p["dungeon"]["understanding_gain"]
        return 1 - (1 - g) ** (1 / self.weeks)

    def activity_cost(self, mods: Mods) -> float:
        party_base = self.state.members - self.state.injured
        heal = mods.gold_per_injured * self.state.injured * (1 - self.perk("healer_discount"))
        return mods.gold + mods.gold_per_member * party_base + heal

    def whole(self, x: float) -> int:
        """사람 수는 정수: 기댓값은 그대로 두고 확률적으로 반올림한다 (2.3명 → 70% 2명, 30% 3명)."""
        x = max(0.0, x)
        n = int(x)
        return n + (1 if self.rng.random() < x - n else 0)

    def preview_week(self, policy: Policy, floor: int, depth: float, activities: list[str]) -> dict:
        """실제로 굴리지 않고 이번 주 예상치를 계산한다 (화면의 예상 표와 봇 판단에 사용)."""
        st, dun = self.state, self.p["dungeon"]
        floor = self.allowed_floor(floor)
        self._preview = True
        try:
            m = self.week_mods(depth, activities, floor)
        finally:
            self._preview = False
        cov = self.ctx or {"potion_cov": 1.0, "gear_cov": 1.0}
        success, ratio = self.odds(policy, floor, depth, cov["potion_cov"], cov["gear_cov"], m)
        loss = self.loss_rate(policy, floor, depth, ratio, 1 - success, m)
        injured = 0.0 if m.heal else st.injured
        party = (st.members - injured) * m.party
        und = st.understanding[floor]
        outcome = success + (1 - success) * dun["retreat_reward_share"]
        freshness = 1 - und * dun["understanding_reward_decay"]
        haul = party * (1 - loss) * dun["floor_reward_per_member"][floor] * self.depth_mult(depth) * outcome * freshness * m.reward / self.weeks
        gain = self.weekly_understanding_gain() * (success + (1 - success) * dun["retreat_understanding_share"])
        gain *= self.depth_mult(depth, "und")  # 넓게 훑을수록 지도를 많이 그린다
        if majority(policy.type_mix, "scholar", self.p["types"]["majority"]):
            gain *= 1 + self.p["types"]["scholar_understanding_bonus"]
        gain = (gain + m.understanding) * (1 - und)
        return {
            "floor": floor,
            "success": success,
            "loss": loss,
            "party": party,
            "haul": haul,
            "understanding_gain": gain,
            "gold_cost": self.activity_cost(m),
            "gauge_cost": dict(m.gauge_cost),
            "notes": list(m.notes),
            "seized": list(m.seized),
        }

    # ------------------------------------------------------------ 고정 공급처
    def gear_unit_cost(self, quality: str) -> float:
        """장비는 상단 경로로 산다. 상단 우위면 할인, 제재 시 가산."""
        return self.p["facilities"]["gear_cost"][quality] * self.supply_price_mult()

    def potion_unit_cost(self) -> float:
        return self.p["facilities"]["potion_cost"] * self.supply_price_mult()

    def loot_revenue(self, loot_value: float) -> float:
        """전리품은 시장에 판다."""
        return loot_value * self.p["facilities"]["market_sell_mult"]

    # ------------------------------------------------------------ 세력 의뢰
    def offer_requests(self) -> None:
        """세력마다 의뢰 1장씩 제시한다."""
        pool = self.p["requests"]
        self.state.offered_requests = [
            self.rng.choice([i for i, r in enumerate(pool) if r["faction"] == f]) for f in FACTIONS
        ]

    def requests(self) -> list[dict]:
        return [self.p["requests"][i] for i in self.state.offered_requests]

    def request_progress(self, req: dict, weeks: list[dict], final: bool = False) -> dict:
        """의뢰 진행도. final=True면 월말 판정(최대 사망자 같은 조건은 이때 확정)."""
        c = req["condition"]
        t = c["type"]
        if t == "weeks":

            def ok(w: dict) -> bool:
                return (
                    w["depth"] >= c.get("min_range", 0)
                    and (w["cleared"] or not c.get("cleared"))
                    and (w["deepest"] or not c.get("deepest"))
                    and (c.get("activity") is None or c["activity"] in w["activities"])
                )

            cur, target = sum(ok(w) for w in weeks), c["count"]
            done = cur >= target
        elif t == "seize":
            cur, target = sum(c["finding"] in w["seized"] for w in weeks), 1
            done = cur >= 1
        elif t == "unlock":
            cur, target = sum(w["unlocked"] for w in weeks), 1
            done = cur >= 1
        elif t == "max_dead":
            cur, target = sum(w["dead"] for w in weeks), c["max"]
            done = final and cur <= target and len(weeks) >= c.get("min_weeks", 0)
        else:
            raise ValueError(f"모르는 의뢰 조건: {t}")
        return {"current": cur, "target": target, "done": done}

    # ------------------------------------------------------------ 월초
    def begin_month(self, policy: Policy) -> dict:
        if self.state.over:
            raise RuntimeError("이미 끝난 게임이다")
        if self.ctx is not None:
            raise RuntimeError("이번 달이 아직 끝나지 않았다")
        st, p = self.state, self.p
        adv, fac, fx = p["adventurers"], p["facilities"], p["factions"]
        income: dict[str, float] = {}
        expense: dict[str, float] = {}

        # 모험가 단: 이탈 → 모집
        attrition = (
            adv["base_attrition"]
            - adv["salary_attrition_eff"] * (policy.salary / self.salary_ref(policy.floor) - 1)
            + adv["loot_rate_attrition_eff"] * (1 - policy.loot_buy_rate)
            - adv.get("care_attrition_eff", 0.0) * policy.care / 100
        )
        attrition = clamp(attrition, adv["min_attrition"], adv["max_attrition"])
        left = min(st.members, self.whole(st.members * attrition))
        st.members -= left
        st.injured = min(st.injured, st.members)
        recruited = 0.0
        if st.members < policy.target_members:
            speed = adv["base_recruit"] + policy.promo / 100 * adv["recruit_per_100_promo"]
            if self.sanctioned("state"):
                speed *= fx["sanction_recruit_mult"]
            recruited = self.whole(min(policy.target_members - st.members, speed * self.rng.uniform(0.7, 1.3)))
            st.members += recruited
        elif st.members > policy.target_members:
            left += st.members - int(policy.target_members)
            st.members = int(policy.target_members)
        members = st.members
        expense["모험가 보수"] = members * policy.salary * self.wage_mult(policy)
        expense["홍보비"] = policy.promo
        if policy.care:
            expense["처우비"] = members * policy.care

        # 시설: 물약(교회 고정) · 장비(구매처 선택)
        expense["물약 구매"] = policy.potion_qty * self.potion_unit_cost()
        if policy.healers:
            expense["힐러 고용"] = policy.healers * self.healer_wage()
        potion_need = members * fac["potions_per_member"]
        potion_sold = min(policy.potion_qty, potion_need * demand_factor(policy.potion_price, fac["potion_ref_price"], fac["demand_elasticity"]))
        income["물약 판매"] = potion_sold * policy.potion_price

        q = policy.gear_quality
        expense["장비 구매"] = policy.gear_qty * self.gear_unit_cost(q)
        gear_need = members * fac["gear_per_member"]
        gear_sold = min(policy.gear_qty, gear_need * demand_factor(policy.gear_price, fac["gear_ref_price"][q], fac["demand_elasticity"]))
        income["장비 판매"] = gear_sold * policy.gear_price

        # 정책 카드는 월초에 바로 적용 (이번 달 세력 협력에 쓸 게이지가 달라진다)
        card = self.cards()[clamp(policy.card, 0, len(st.offered_cards) - 1)]
        if card.get("gold"):
            (income if card["gold"] > 0 else expense)[f"카드: {card['name']}"] = abs(card["gold"])
        self.apply_gauges(card["gauges"])
        st.members = max(0, st.members + int(card.get("members", 0)))

        self.ctx = {
            "policy": policy,
            "income": income,
            "expense": expense,
            "requests": [
                self.requests()[i] for i in dict.fromkeys(policy.requests) if 0 <= i < len(st.offered_requests)
            ][: fx["max_requests"]],
            "potion_cov": potion_sold / potion_need if potion_need else 0.0,
            "gear_cov": gear_sold / gear_need if gear_need else 0.0,
            "healer_cov": min(1.0, policy.healers * self.p["weekly"]["healer_covers"] / members) if members else 0.0,
            "attrition": attrition,
            "recruited": recruited,
            "left": left,
            "card": card,
            "loot_value": 0.0,
            "rep_gain": 0.0,
            "dead": 0.0,
            "weeks": [],
        }
        st.week = 0
        return {"attrition": attrition, "recruited": recruited, "left": left, "card": card["name"]}

    # ------------------------------------------------------------ 매주
    def play_week(self, floor: int, depth: float, activities: list[str]) -> dict:
        if self.ctx is None:
            raise RuntimeError("begin_month를 먼저 호출해야 한다")
        if self.state.week >= self.weeks:
            raise RuntimeError("이번 달 탐사를 모두 마쳤다")
        st, p, ctx = self.state, self.p, self.ctx
        dun, typ, wk = p["dungeon"], p["types"], p["weekly"]
        policy: Policy = ctx["policy"]

        available = self.available_activities()
        activities = [a for a in dict.fromkeys(activities) if a in available][: wk["actions_per_week"]]
        floor = self.allowed_floor(floor)
        depth = clamp(depth, 0.0, 1.0)
        m = self.week_mods(depth, activities, floor)
        new_secrets = [i for i in m.secrets if (floor, i) not in st.secret_found]
        st.secret_found.update((floor, i) for i in m.secrets)
        finding = st.finding

        # 준비 활동 비용: 금화는 장부에, 게이지는 바로 소모
        cost = self.activity_cost(m)
        if cost:
            ctx["expense"]["준비 활동"] = ctx["expense"].get("준비 활동", 0.0) + cost
        for f, d in m.gauge_cost.items():
            st.gauges[f] = clamp(st.gauges[f] - d, -100, 100)
        if m.gauge_gain:
            self.apply_gauges(m.gauge_gain)
        st.train = min(wk["train_cap"], st.train + m.train)

        # 부상자 회복
        if m.heal:
            healed = st.injured
            st.injured = 0
        elif m.no_heal:
            healed = 0.0
        else:
            cov = ctx["healer_cov"]
            healed = min(st.injured, self.whole(st.injured * (wk["injured_recovery"] + (wk["healer_recovery"] - wk["injured_recovery"]) * cov)))
            st.injured -= healed

        # 탐사
        und = st.understanding[floor]
        deepest = floor == st.max_unlocked
        success, ratio = self.odds(policy, floor, depth, ctx["potion_cov"], ctx["gear_cov"], m)
        cleared = self.rng.random() < success
        loss_rate = self.loss_rate(policy, floor, depth, ratio, 0.0 if cleared else 1.0, m)
        party = self.whole((st.members - st.injured) * m.party)
        lost = min(party, self.whole(party * loss_rate))
        new_injured = self.whole(lost * wk["injured_share"])
        dead = lost - new_injured
        st.members -= dead
        st.injured += new_injured
        ctx["dead"] += dead
        survivors = party - lost

        outcome = (1.0 if cleared else dun["retreat_reward_share"]) * (1 - und * dun["understanding_reward_decay"])
        haul = survivors * dun["floor_reward_per_member"][floor] * self.depth_mult(depth) * outcome * m.reward / self.weeks
        loot = haul * dun["loot_share_of_reward"]
        ctx["income"]["탐험 수수료"] = ctx["income"].get("탐험 수수료", 0.0) + haul - loot
        ctx["loot_value"] += loot
        rep = survivors * floor * dun["rep_per_member_floor"] * self.depth_mult(depth) * outcome / self.weeks
        ctx["rep_gain"] += rep

        gain = self.weekly_understanding_gain() * (1.0 if cleared else dun["retreat_understanding_share"])
        gain *= self.depth_mult(depth, "und")  # 넓게 훑을수록 지도를 많이 그린다
        if majority(policy.type_mix, "scholar", typ["majority"]):
            gain *= 1 + typ["scholar_understanding_bonus"]
        st.understanding[floor] = min(1.0, und + (gain + m.understanding) * (1 - und))
        unlocked = False
        if floor == st.max_unlocked and floor < MAX_FLOOR and st.understanding[floor] >= dun["unlock_next_at_understanding"]:
            st.max_unlocked += 1
            unlocked = True

        st.week += 1
        r = p["rules"]
        if (
            floor == MAX_FLOOR
            and self.ctx.get("assault", True)  # 이사회 모드: 최심부 공략을 승인한 달에만 인정
            and cleared
            and depth >= r["win_depth"]
            and success >= r["win_success"]
            and st.members >= r["win_min_members"]
        ):
            st.over, st.result = True, "win"
        self._check_collapse()

        # 다음 주에 영향을 줄 보고서 정황
        st.finding = self._draw_finding(floor)

        report = {
            "month": st.month + 1,
            "week": st.week,
            "floor": floor,
            "depth": depth,
            "activities": activities,
            "success": success,
            "cleared": cleared,
            "loss_rate": loss_rate,
            "party": party,
            "dead": dead,
            "injured_new": new_injured,
            "healed": healed,
            "injured": st.injured,
            "members": st.members,
            "haul": haul,
            "rep_gain": rep,
            "activity_cost": cost,
            "gauge_cost": dict(m.gauge_cost),
            "understanding": st.understanding[floor],
            "unlocked": unlocked,
            "deepest": deepest,
            "seized": list(m.seized),
            "past_finding": finding,
            "notes": m.notes,
            "secrets_hit": list(m.secrets),
            "secrets_new": new_secrets,
            "finding": st.finding,
            "result": st.result,
        }
        ctx["weeks"].append(report)
        return report

    def _draw_finding(self, floor: int | None = None) -> dict:
        """다음 주 정황. 노후·방치 캠프가 있는 층은 보급로 습격이 잦다."""
        items = self.p["findings"]
        camp = ((self.ctx or {}).get("camps") or {}).get(floor)
        raid = self.p["outposts"]["worn_raid_weight"] if camp in ("노후", "방치") else 1.0
        weights = [f["weight"] * (raid if f["id"] == "supply" else 1.0) for f in items]
        return self.rng.choices(items, weights=weights)[0]

    def _check_collapse(self) -> None:
        st, r = self.state, self.p["rules"]
        if not st.over and any(st.gauges[f] <= r["faction_collapse_at"] for f in FACTIONS):
            st.over, st.result = True, "collapse"
            st.collapsed = [f for f in FACTIONS if st.gauges[f] <= r["faction_collapse_at"]]

    # ------------------------------------------------------------ 세력 반응
    def faction_reactions(self, policy: Policy, ctx: dict, dead: float, tax: float, seen: dict | None = None) -> dict:
        """이번 달 길드 행동 → 세력별 우호도 변화와 그 이유(소문 키).
        seen: 세력이 입수한 길드 보고값 (이사회 모드). 세력은 금고를 못 보고 보고서로 판단한다. 세금만 실제값."""
        rx, fac, st = self.p["reactions"], self.p["facilities"], self.state
        out = {f: {"delta": 0.0, "reasons": []} for f in FACTIONS}
        seen = seen or {}

        def add(f: str, key: str, v: float) -> None:
            if abs(v) >= 0.05:
                out[f]["delta"] += v
                out[f]["reasons"].append((key, v))

        # 상단: 거래량 · 폭리 · 헐값 매입
        m = rx["merchant"]
        bought = ctx["expense"].get("물약 구매", 0.0) + ctx["expense"].get("장비 구매", 0.0)
        add("merchant", "trade", min(m["trade_cap"], bought / 1000 * m["trade_per_1000"]))
        markup = (
            policy.potion_price / fac["potion_ref_price"] + policy.gear_price / fac["gear_ref_price"][policy.gear_quality]
        ) / 2 - 1
        markup = seen.get("markup", markup)
        if markup > m["markup_free"]:
            add("merchant", "gouging", -(markup - m["markup_free"]) * m["markup_penalty"] * ctx.get("gouging_mult", 1.0))
        if policy.loot_buy_rate < m["fair_loot_rate"]:
            add("merchant", "lowball", -(m["fair_loot_rate"] - policy.loot_buy_rate) * m["lowball_penalty"])

        # 교회: 사망 · 박봉 · 방치된 부상자 · 선행
        c = rx["church"]
        dead = seen.get("dead", dead)
        add("church", "deaths", -min(c["death_cap"], dead * c["per_death"]))
        fair = c["fair_salary"] * self.salary_ref(policy.floor) / self.p["adventurers"]["salary_ref"]
        salary = seen.get("salary", policy.salary)
        if salary < fair:
            add("church", "low_pay", -(fair - salary) / 100 * c["low_pay_per_100"])
        members = max(st.members, 1.0)
        injured_ratio = seen.get("injured_ratio", st.injured / members)
        if injured_ratio > c["injured_ratio_ok"]:
            add("church", "neglect", -(injured_ratio - c["injured_ratio_ok"]) * c["neglect_penalty"])
        if dead < c["kind_max_dead"] and policy.healers > 0:
            add("church", "kind", c["kind_bonus"])

        # 국가: 탐사 성공률 · 세수 변화 · 새 층
        s = rx["state"]
        weeks = ctx["weeks"]
        if weeks:
            rate = seen.get("success", sum(w["cleared"] for w in weeks) / len(weeks))
            add("state", "success" if rate >= s["success_ok"] else "failure", (rate - s["success_ok"]) * s["success_weight"])
        if st.last_tax > 0:
            change = (tax - st.last_tax) / st.last_tax
            add("state", "tax_up" if change > 0 else "tax_down", clamp(change * s["tax_weight"], -s["tax_cap"], s["tax_cap"]))
        if any(w["unlocked"] for w in weeks):
            add("state", "new_floor", s["new_floor"])
        return out

    # ------------------------------------------------------------ 월말
    def end_month(self) -> dict:
        if self.ctx is None:
            raise RuntimeError("begin_month를 먼저 호출해야 한다")
        st, p, ctx = self.state, self.p, self.ctx
        adv, fac, dun, fx = p["adventurers"], p["facilities"], p["dungeon"], p["factions"]
        policy: Policy = ctx["policy"]
        income, expense = ctx["income"], ctx["expense"]

        # 전리품: 모험가에게 사서 시장에 판다
        loot_value = ctx["loot_value"]
        expense["전리품 매입"] = loot_value * policy.loot_buy_rate
        income["전리품 판매"] = self.loot_revenue(loot_value)

        # 세력 의뢰 판정
        request_results = []
        for req in ctx["requests"]:
            prog = self.request_progress(req, ctx["weeks"], final=True)
            outcome = req["reward"] if prog["done"] else req.get("penalty", {})
            if outcome.get("gauge"):
                self.apply_gauges(outcome["gauge"])
            if outcome.get("gold"):
                (income if outcome["gold"] > 0 else expense)[f"의뢰: {req['name']}"] = abs(outcome["gold"])
            ctx["rep_gain"] += outcome.get("rep", 0)
            request_results.append({"request": req, "done": prog["done"], "outcome": outcome})

        # 정산
        dead = ctx["dead"]
        expense["위약금"] = dead * dun["penalty_per_lost_member"]
        # 세금은 수익에 매긴다: 총수입에서 전리품 매입가(되팔기 원가)를 뺀 금액
        gross = sum(income.values()) - expense.get("전리품 매입", 0.0)
        tax_rate = self.perk("tax_rate")
        tax = gross * tax_rate
        expense["국가 세금"] = tax

        # 세력 반응: 길드가 이번 달 한 행동에 따라 우호도가 오르내린다 (플레이어에게는 소문으로만)
        reactions = self.faction_reactions(policy, ctx, dead, tax, ctx.get("seen"))
        honest = self.faction_reactions(policy, ctx, dead, tax) if ctx.get("seen") else reactions
        ctx["deceit_gain"] = {f: reactions[f]["delta"] - honest[f]["delta"] for f in FACTIONS}  # 포장으로 얻은 우호도
        for f, r in reactions.items():
            st.gauges[f] = clamp(st.gauges[f] + r["delta"], -100, 100)
        st.last_tax = tax

        net = sum(income.values()) - sum(expense.values())
        st.gold += net
        # 적자 판정은 금고 잔액으로: 월말 금고가 0G 미만인 달이 이어지면 게임 오버
        st.deficit_streak = st.deficit_streak + 1 if st.gold < 0 else 0
        unpaid = st.gold < 0
        if unpaid:
            st.members = round(st.members * adv["unpaid_exodus_keep"])
            st.injured = min(st.injured, st.members)

        # 명성 → 레벨업
        st.reputation += ctx["rep_gain"]
        leveled = []
        for f in policy.rep_levels:
            lv = st.levels[f]
            costs = fx["level_rep_cost"]
            gauge_ok = st.gauges[f] >= fx["level_gauge_required"] + (st.level_gauge_extra if f == "state" else 0)
            if f == "state" and st.level_waiver:
                gauge_ok = True
            if lv + 1 < len(costs) and st.reputation >= costs[lv + 1] and gauge_ok:
                if f == "state" and st.level_waiver:
                    st.level_waiver = False
                st.reputation -= costs[lv + 1]
                st.levels[f] += 1
                self.apply_gauges({f: fx["level_up_gauge_gain"]})
                leveled.append(f)
        spare = st.reputation
        for f, share in policy.rep_to_gauge.items():
            spend = spare * share
            st.reputation -= spend
            self.apply_gauges({f: spend * fx["rep_to_gauge"]})
        if p["rules"]["reputation_mode"] == "use_or_lose":
            st.reputation *= 1 - p["rules"]["use_or_lose_decay"]

        # 종료 판정
        st.month += 1
        r = p["rules"]
        self._check_collapse()
        if not st.over:
            if st.deficit_streak >= r["deficit_game_over_months"]:
                st.over, st.result = True, "deficit"
            elif unpaid and r["bankrupt_game_over"]:
                st.over, st.result = True, "bankrupt"
            elif st.month >= r["max_months"]:
                st.over, st.result = True, "timeout"

        weeks = ctx["weeks"]
        members_start = st.members + dead
        report = {
            "month": st.month,
            "floor": weeks[-1]["floor"] if weeks else 1,
            "depth": sum(w["depth"] for w in weeks) / len(weeks) if weeks else 0.0,
            "success": sum(w["success"] for w in weeks) / len(weeks) if weeks else 0.0,
            "cleared": sum(w["cleared"] for w in weeks),
            "weeks_played": len(weeks),
            "loss_rate": dead / members_start if members_start else 0.0,
            "attrition": ctx["attrition"],
            "recruited": ctx["recruited"],
            "left": ctx["left"],
            "lost": dead,
            "injured": st.injured,
            "members": st.members,
            "understanding": st.understanding[weeks[-1]["floor"]] if weeks else 0.0,
            "max_unlocked": st.max_unlocked,
            "income": income,
            "expense": expense,
            "net": net,
            "gold": st.gold,
            "rep_gain": ctx["rep_gain"],
            "loot_value": loot_value,
            "reputation": st.reputation,
            "gauges": dict(st.gauges),
            "levels": dict(st.levels),
            "card": ctx["card"]["name"],
            "requests": request_results,
            "tax_rate": tax_rate,
            "reactions": reactions,
            "deceit_gain": ctx.get("deceit_gain", {}),
            "leveled": leveled,
            "unpaid": unpaid,
            "weeks": weeks,
            "result": st.result,
        }
        st.history.append(report)
        self.ctx = None
        if not st.over:
            self.offer_cards()
            self.offer_requests()
        return report

    # ------------------------------------------------------------ 한 달 통째로 (봇용)
    def step(self, policy: Policy, planner=None) -> dict:
        """planner(game, policy) -> (floor, depth, activities). 없으면 policy의 기본값을 매주 쓴다."""
        self.begin_month(policy)
        for _ in range(self.weeks):
            if self.state.over:
                break
            if planner:
                floor, depth, acts = planner(self, policy)
            else:
                floor, depth, acts = policy.floor, policy.depth, policy.activities
            self.play_week(floor, depth, acts)
        return self.end_month()
