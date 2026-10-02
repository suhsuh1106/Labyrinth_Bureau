"""조직 레이어: 부서 · 부서장 · KPI · 보고서.

플레이어는 이사회다. 던전도 탐사 결정도 직접 보지 않는다.
  - 부서마다 KPI 카드를 슬롯에 끼우고 목표치를 정한다.
  - 부서는 KPI 점수를 최대화하도록 스스로 결정한다 (KPI에 없는 것은 신경 쓰지 않는다).
  - 부서가 올리는 숫자는 부서장 성향(정직도)과 KPI 압박(목표 미달 정도)만큼 왜곡된다.
  - 금고(금화)와 세력 우호도만은 거짓말을 하지 않는다. 감사와 국가 집계로 교차 확인할 수 있다.

엔진(sim.Game)의 월초·주간·월말 호출을 Guild가 대신 한다.
"""
from __future__ import annotations

import math
import random
from collections import Counter
from dataclasses import dataclass, field

from bots import stocked
from diplomacy import Diplomacy
from sim import FACTION_KO, FACTIONS, MAX_FLOOR, Game, Policy, clamp, demand_factor, weighted_avg

DEPTS = {"explore": "탐사부", "hr": "인사부", "supply": "보급부"}
PAY_TIERS = {  # 보수 등급 → (1층 기준 1인 월급, 인력 등급 비율). 좋은 보수가 좋은 인력을 부른다. 깊은 층일수록 위험 수당만큼 오른다
    "저": (900, {"low": 1.0}),
    "중": (1200, {"low": 0.3, "mid": 0.7}),
    "고": (1500, {"mid": 0.3, "high": 0.7}),
}
GEAR_TIERS = ("low", "mid", "high")
FORMATION = {"combat": 0.4, "scout": 0.3, "scholar": 0.3}
RANGES = (0.3, 0.5, 0.7, 0.9, 1.0)
AGGRESSION = {  # 부서장 성향 → KPI 지표별 가중치
    "공격형": {"revenue": 1.3, "progress": 1.3, "deaths": 0.7, "gauge_spent": 0.7},
    "균형형": {},
    "신중형": {"revenue": 0.8, "progress": 0.8, "deaths": 1.4, "gauge_spent": 1.3},
}
# 왜곡 방향: +1 = 부풀림, -1 = 줄임, 0 = 왜곡 불가(눈에 보이는 것)
LIE_DIRECTION = {
    "revenue": 1,
    "progress": 1,
    "headcount": 1,
    "ready": 1,
    "deaths": -1,
    "payroll": -1,
    "supply_cost": -1,
    "gauge_spent": -1,
    "gear_tier": 0,
    "grade_tier": 0,
    "injured": -1,
    "supply_profit": 1,
    "floor_und": 0,  # 층 이해도는 대시보드에 진짜 숫자로 보인다
    "left": -1,
    "floor_sales": 1,
    "maint": 1,
}
MARKUPS = (0.0, 0.2, 0.4)  # 보급부가 고르는 판매 마진 (기준가 대비, 길드·일반 모험가 공통)
STOCKS = (1.0, 0.5)  # 보급부가 전초기지 매장에 들여놓는 물량 (예상 수요 대비)
CAMP_STATES = ("정상", "노후", "방치")


@dataclass
class Head:
    name: str
    aggression: str
    honesty: float  # 0 = 정직, 1 = 거짓말을 잘 함 (숨겨진 값)
    revealed: bool = False
    caught: int = 0
    traits: list = field(default_factory=list)  # 특성 키 (장점과 단점이 함께 있다)
    known: set = field(default_factory=set)  # 이사회가 파악한 특성
    promises: list = field(default_factory=list)  # 약속을 지켰는지 (True/False)

    def trust_text(self, n: int = 6) -> str:
        if not self.promises:
            return "기록 없음"
        return "".join("●" if k else "○" for k in self.promises[-n:])

    def honesty_label(self) -> str:
        if not self.revealed:
            return "미확인"
        return "정직" if self.honesty < 0.3 else ("보통" if self.honesty < 0.65 else "과장")


@dataclass
class Slot:
    kpi: str
    target: float
    floor: int | None = None  # "지정 층 이해도" 조항이 가리키는 층
    level: str = "적당"  # 난이도 (쉬움 · 적당 · 어려움): 부서장이 제시한 수준 대비. 성과급이 달라진다


def satisfaction(value: float, target: float, direction: str) -> float:
    """KPI 달성도. 1 = 딱 달성, 1 미만 = 미달 (미달은 크게 감점), 1 초과는 조금만 가점."""
    if direction == "min":
        r = value / target if target > 0 else 1.0
    else:  # max
        r = target / value if value > 1e-9 else 2.0
    if r >= 1:
        return 1 + 0.1 * min(r - 1, 2)
    return r - (1 - r)  # 미달은 두 배로 아프다


def achieved(kdef: dict, value: float, target: float) -> bool:
    return value >= target if kdef["dir"] == "min" else value <= target


def shortfall(value: float, target: float, direction: str) -> float:
    """목표에서 얼마나 벗어났는지 0~1. 보고서 왜곡 압박."""
    if direction == "min":
        return clamp(1 - value / target, 0, 1) if target > 0 else 0.0
    return clamp(value / target - 1, 0, 1) if target > 0 else (1.0 if value > 0 else 0.0)


class Guild:
    def __init__(self, game: Game, seed: int | None = None):
        self.game = game
        self.o = game.p["org"]
        self.rng = random.Random(seed)
        self.heads = {d: self.hire(d) for d in DEPTS}
        self.kpis = {d: [Slot(k, self.o["kpis"][k]["default"]) for k in self.o["default_kpis"][d]] for d in DEPTS}
        for s in self.kpis["hr"]:
            if s.kpi == "ready":
                s.target = math.floor(game.state.members * 0.95)  # 첫 달 기본 조항은 지금 인원 유지 (시작부터 대량 채용을 요구하지 않게)
        self.approved_floor = 1
        self.pay, self.target_members, self.gear, self.markup = "저", 20, "low", 0.0
        self.care = 0.0  # 인사부 처우비 (1인당 G)
        self.promo = 0.0
        self.audits: set[str] = set()
        self.halted = False
        self.assault = False  # 이번 달 10층 최심부 공략 승인 여부
        self.week_order: dict = {}  # 현장 판단으로 내린 다음 주 지시 (범위 하한·상한, 강제 준비 활동)
        self.month_order: dict = {}  # 이번 달 남은 기간 지시
        self.promises: dict = {}  # 이번 달 부서장 약속
        self.skim = 0.0
        self.events_used = 0
        self.directives: dict[int, dict] = {}  # 층 → 공략 지침 {"gear_type", "formation", "prep"}
        self.gear_type, self.formation = "none", "balanced"  # 지금 쓰는 장비 계열 · 편성 (바꾸면 비용)
        self.clues: dict[int, list[dict]] = {}  # 층 → 탐사부가 가져온 단서
        self.failed: dict[int, set] = {}  # 층 → 한 달 걸어 봤는데 통하지 않은 공식 ("kind:key")
        # 전초기지: 층 → {"state": 정상/노후/방치, "unpaid": 유지비를 못 받은 달 수}. 1층 캠프는 처음부터 있다
        self.outposts: dict[int, dict] = {1: {"state": "정상", "unpaid": 0}}
        self.stock = 1.0  # 매장 물량 (예상 수요 대비)
        self.pay_upkeep = True  # 이번 달 전초기지 유지비를 낼지 (보급부 결정)
        # 예산: 부서 요청액 · 배정액. 배정하지 않으면 요청액 그대로
        self.requests_budget: dict[str, float] = {}
        self.budget: dict[str, float] = {}
        self.credit = {"merchant": 0.0, "church": 0.0}  # 외상 잔액 (보고서에 잘 안 드러나는 숨은 부채)
        self.budget_cut: dict[str, float] = {}  # 안건으로 승인한 예산 삭감 (요청액 대비 비율, 이번 달만)
        self.store_mult = 1.0  # 상단 견제(경쟁 길드 후원) 중이면 매장 손님이 준다
        self.forced_cross = False  # 국가 견제(감찰관 파견) 중이면 사망자 교차 확인이 정확해진다
        self.sanction_notes: list[str] = []
        self.dip = Diplomacy(self)
        self.player_checks = 0  # 이사회가 감사 · 조항 조정을 한 횟수 (비서가 말을 줄이는 기준)
        self.miss_streak = {d: 0 for d in DEPTS}  # 조항을 연속으로 못 지킨 달 수 (계약 위반 · 사표)
        self.plan_cost: dict[str, float] = {}  # 이번 달 부서 계획 지출
        self.month_clues: list[dict] = []
        self.month_weeks: list[dict] = []  # 이번 달 주간 기록 (실제값 + 보고값)
        self.reports: list[dict] = []  # 월간 이사회 보고서
        self.announcements: list[str] = []
        self.healers = 0
        self.month_org: dict = {}  # 이번 달 이사회 결의(정책 카드)의 조직 효과
        self.board_costs: dict[str, float] = {}  # 다음 달 장부에 올릴 이사회 지출
        self.politics_used: list[str] = []

    # ------------------------------------------------------------ 인사
    def hire(self, dept: str, known: int = 0, exclude: set | None = None) -> Head:
        """새 부서장. 부서 특성 1개 + 확률적으로 공통 특성 1개. known = 처음부터 알려진 특성 수."""
        names = self.o["head_names"][dept]
        used = {h.name for h in getattr(self, "heads", {}).values()} | (exclude or set())
        name = self.rng.choice([n for n in names if n not in used] or names)
        tdefs = self.o["traits"]
        traits = [self.rng.choice([k for k, t in tdefs.items() if t["dept"] == dept])]
        if self.rng.random() < self.o["generic_trait_chance"]:
            traits.append(self.rng.choice([k for k, t in tdefs.items() if t["dept"] == "any"]))
        self.rng.shuffle(traits)
        return Head(
            name=name,
            aggression=self.rng.choice(list(AGGRESSION)),
            honesty=self.rng.random(),
            traits=traits,
            known=set(traits[:known]),
        )

    def candidates(self, dept: str) -> list[Head]:
        """교체 후보. 이력서에 특성 하나가 적혀 있다 (나머지는 써 봐야 안다)."""
        out: list[Head] = []
        for _ in range(self.o["candidates"]):
            out.append(self.hire(dept, known=1, exclude={h.name for h in out}))
        return out

    def founding_candidates(self) -> dict[str, list[Head]]:
        """창립 이사회: 부서마다 후보를 보여 주고 이사회가 직접 임명한다 (퇴직금 없음)."""
        return {d: self.candidates(d) for d in DEPTS}

    def appoint(self, dept: str, head: Head) -> None:
        self.heads[dept] = head

    def fire(self, dept: str, new: Head | None = None) -> Head:
        """부서장 교체. 퇴직금은 이번 달 지출로. 계약 위반(연속 미달) 중이면 퇴직금 없이."""
        if not self.breach(dept):
            self.add_cost("부서장 퇴직금", self.o["fire_cost"])
        self.heads[dept] = new or self.hire(dept)
        self.miss_streak[dept] = 0
        return self.heads[dept]

    def breach(self, dept: str) -> bool:
        """계약 위반: 조항을 연속으로 못 지켜서 퇴직금 없이 교체할 수 있다."""
        return self.miss_streak[dept] >= self.o["contract"]["free_fire_after"]

    # ------------------------------------------------------------ 계약 조항 난이도
    def claimed_baseline(self, dept: str, slot: Slot) -> float | None:
        """부서장이 말하는 '지난달 실력'. 부정직한 부서장은 목표를 쉽게 받으려고 낮춰 말한다(성과급을 노린다)."""
        if not self.reports:
            return None
        kd = self.kpi_def(slot.kpi)
        true = self.slot_value(self.reports[-1]["true"], slot)
        if kd["metric"] == "floor_und":
            true = min(1.0, true + 0.1)  # 한 달 더 다지면
        lean = self.heads[dept].honesty * self.o["contract"]["sandbag"]
        return true * (1 - lean) if kd["dir"] == "min" else true * (1 + lean)

    def presets(self, dept: str, kpi: str, floor: int | None = None) -> dict[str, float]:
        """부서장이 제시하는 쉬움 · 적당 · 어려움 목표."""
        kd = self.kpi_def(kpi)
        m = kd["metric"]
        if m in ("gear_tier", "grade_tier"):
            cur = GEAR_TIERS.index(self.gear) if m == "gear_tier" else list(PAY_TIERS).index(self.pay)
            return {"쉬움": cur, "적당": min(2, cur + 1), "어려움": 2}
        if m == "maint":
            return {"쉬움": 0.5, "적당": 1.0, "어려움": 1.0}
        base = self.claimed_baseline(dept, Slot(kpi, kd["default"], floor))
        if base is None and m == "ready":
            base = self.game.state.members  # 첫 달: 지금 인원 기준
        if base is None or base <= 0:
            base = kd["default"]
        if m == "ready":
            # 인원은 비율이 아니라 한 달에 뽑을 수 있는 폭으로 잰다 (홍보비 최대면 월 20명 안팎)
            base = round(base)
            return {"쉬움": max(1, math.floor(base * 0.95)), "적당": min(60, base + 5), "어려움": min(60, base + 12)}
        out = {}
        for level, r in self.o["contract"]["presets"].items():
            v = base * r if kd["dir"] == "min" else base / r
            if m == "floor_und":
                v = min(1.0, v)
            out[level] = round(v, 2) if kd["unit"] == "" else (round(v, -2) if kd["unit"] == "G" else round(v))
        return out

    def level_of(self, dept: str, slot: Slot) -> str:
        p = self.presets(dept, slot.kpi, slot.floor)
        kd = self.kpi_def(slot.kpi)
        harder = (lambda a, b: a >= b) if kd["dir"] == "min" else (lambda a, b: a <= b)
        if harder(slot.target, p["어려움"]) and p["어려움"] != p["적당"]:
            return "어려움"
        if harder(slot.target, p["적당"]):
            return "적당"
        return "쉬움"

    def settle_contracts(self, reported: dict, true: dict) -> dict:
        """월말: 조항 달성이면 성과급(난이도별), 미달이 이어지면 계약 위반 · 사표. 판단은 이사회가 본 값(감사하면 실제값)."""
        c = self.o["contract"]
        out = {"bonus": {}, "resigned": [], "breach": []}
        for dept, slots in self.kpis.items():
            if not slots:
                self.miss_streak[dept] = 0
                continue
            src = true if dept in self.audits else reported
            missed = False
            for s in slots:
                if achieved(self.kpi_def(s.kpi), self.slot_value(src, s), s.target):
                    out["bonus"][dept] = out["bonus"].get(dept, 0) + c["bonus"][s.level]
                else:
                    missed = True
            self.miss_streak[dept] = self.miss_streak[dept] + 1 if missed else 0
            if self.miss_streak[dept] >= c["resign_after"]:
                old = self.heads[dept].name
                self.heads[dept] = self.hire(dept)
                self.miss_streak[dept] = 0
                out["resigned"].append((dept, old, self.heads[dept].name))
            elif self.breach(dept):
                out["breach"].append(dept)
        total = sum(out["bonus"].values())
        if total:
            self.add_cost("부서장 성과급", total)
        return out

    def has(self, dept: str, trait: str) -> bool:
        return trait in self.heads[dept].traits

    def trait_name(self, key: str) -> str:
        return self.o["traits"][key]["name"]

    def reference(self, dept: str) -> str | None:
        """평판 조회: 부서장의 숨은 특성 하나를 알아낸다."""
        head = self.heads[dept]
        hidden = [t for t in head.traits if t not in head.known]
        self.add_cost("평판 조회", self.o["reference_cost"])
        if not hidden:
            return None
        head.known.add(hidden[0])
        return hidden[0]

    def add_cost(self, label: str, amount: float) -> None:
        self.board_costs[label] = self.board_costs.get(label, 0.0) + amount

    # ------------------------------------------------------------ 정치 (플레이어가 직접)
    def explore_slots_free(self) -> int:
        return self.o["slots"]["explore"] - len(self.kpis["explore"])

    def can_do_politics(self, key: str) -> str | None:
        """할 수 없으면 이유를, 할 수 있으면 None."""
        pol, st = self.game.p["politics"], self.game.state
        act = pol["actions"][key]
        if len(self.politics_used) >= pol["actions_per_month"]:
            return "이번 달 정치 행동을 모두 썼어요"
        if act.get("gold", 0) > st.gold - sum(self.board_costs.values()):
            return "금고가 부족해요"
        if act.get("rep", 0) > st.reputation:
            return "명성이 부족해요"
        return None

    def do_politics(self, key: str) -> str:
        g, st = self.game, self.game.state
        act = g.p["politics"]["actions"][key]
        if act.get("gold"):
            self.add_cost("정치 활동", act["gold"])
        st.reputation -= act.get("rep", 0)
        if act.get("gauge"):
            g.apply_gauges(act["gauge"])
            target = next(iter(act["gauge"]))
        else:  # 중재: 관계가 가장 나쁜 세력만 올린다 (견제 없음)
            target = min(FACTIONS, key=lambda f: st.gauges[f])
            st.gauges[target] = clamp(st.gauges[target] + act["mediate"], -100, 100)
        self.politics_used.append(key)
        return target

    # ------------------------------------------------------------ KPI
    def kpi_def(self, kpi: str) -> dict:
        return self.o["kpis"][kpi]

    def weight(self, dept: str, metric: str) -> float:
        extra = self.month_org.get("weights", {}).get(dept, {}).get(metric, 1.0)
        if self.has(dept, "ambitious") and metric in ("progress", "floor_und", "ready", "supply_profit", "floor_sales"):
            extra *= 1.3
        if self.has(dept, "watchdog"):
            extra *= 0.85
        return AGGRESSION[self.heads[dept].aggression].get(metric, 1.0) * extra

    def slot_value(self, values: dict, slot: Slot) -> float:
        """조항이 보는 값. '지정 층 이해도'는 그 층의 이해도."""
        m = self.kpi_def(slot.kpi)["metric"]
        if m == "floor_und":
            und = values.get("und_by_floor") or {}
            return und.get(slot.floor, self.game.state.understanding[slot.floor or 1])
        return values[m]

    def dept_score(self, dept: str, metrics: dict, capped: bool = False) -> float:
        """조항 점수. capped = 초과 달성 가점 없이 (예산 요청액을 셀 때: 조항을 딱 채우는 데 드는 돈)."""
        score = 0.0
        for s in self.kpis[dept]:
            d = self.kpi_def(s.kpi)
            sat = satisfaction(self.slot_value(metrics, s), s.target, d["dir"])
            if capped or self.has(dept, "principled") or d["metric"] in ("gear_tier", "grade_tier", "ready"):
                sat = min(sat, 1.0)  # 목표만 딱 맞춘다 (등급 조항은 넘겨도 가점 없음. 인원은 넘기면 월급만 는다)
            score += self.weight(dept, d["metric"]) * sat
        return score

    # ------------------------------------------------------------ 월초: 인사부 · 보급부 결정
    def projected_injured(self, members: float, healers: int) -> float:
        """이번 달 말 예상 부상자 수. 주마다 새 부상자가 생기고, 힐러가 많을수록 빨리 회복된다."""
        wk = self.game.p["weekly"]
        cov = min(1.0, healers * wk["healer_covers"] / members) if members else 0.0
        r = wk["injured_recovery"] + (wk["healer_recovery"] - wk["injured_recovery"]) * cov
        new = members * self.o["injury_rate_guess"]
        keep = (1 - r) ** 4
        return self.game.state.injured * keep + new * (1 - keep) / r

    # ------------------------------------------------------------ 예산 안에서 고르기
    @staticmethod
    def pick_option(options: list[dict], budget: float | None) -> tuple[dict, bool]:
        """조항 점수가 가장 높은 안들 중, 예산에 맞으면서 조항 밖 서비스가 가장 많은 안.
        반환 (안, 조항을 지켰는지). 조항 최고안이 예산에 안 맞으면 (None 대신) 가장 싼 조항 최고안과 False."""
        best = max(o["score"] for o in options)
        top = [o for o in options if o["score"] >= best - 1e-9]  # 동점 처리(공정한 값 등)는 점수에 1e-6 단위로 들어 있다
        fit = top if budget is None else [o for o in top if o["cost"] <= budget + 1e-6]
        if fit:
            return max(fit, key=lambda o: (o["service"], -o["cost"])), True
        return min(top, key=lambda o: o["cost"]), False

    @staticmethod
    def need_of(options: list[dict]) -> float:
        """부서가 생각하는 필요액: 조항을 딱 채우는(초과 달성 가점 없이) 안 중, 조항 밖 서비스를 다 챙기는 가장 싼 안."""
        best = max(o["capped"] for o in options)
        top = [o for o in options if o["capped"] >= best - 1e-9]
        best_service = max(o["service"] for o in top)
        return min(o["cost"] for o in top if o["service"] == best_service)

    def clauses_met(self, dept: str, metrics: dict) -> bool:
        return all(achieved(self.kpi_def(s.kpi), self.slot_value(metrics, s), s.target) for s in self.kpis[dept])

    def hr_options(self) -> list[dict]:
        """인사부 안: 모집 목표(홍보비) · 힐러 · 처우비. 월급은 이사회가 정한 보수 등급대로 자동 지급되니 여기 안 든다."""
        st, adv = self.game.state, self.game.p["adventurers"]
        salary = self.salary_of(self.pay) * self.month_org.get("salary_mult", 1.0)
        wage_h = self.game.healer_wage() * (0.7 if self.has("hr", "devout") else 1.0)
        floor = self.game.allowed_floor(self.approved_floor)
        popular = 0.5 if self.has("hr", "popular") else 1.0
        out = []
        for care in (0, 50, 100):
            attr = clamp(
                adv["base_attrition"] - adv["salary_attrition_eff"] * (salary / self.game.salary_ref(floor) - 1)
                + adv["loot_rate_attrition_eff"] * 0.2 - adv["care_attrition_eff"] * care / 100,
                adv["min_attrition"],
                adv["max_attrition"],
            )
            m = st.members * (1 - attr)
            # 인사부는 해고하지 않는다: 지금 남을 인원 이상만 목표로 잡는다 (해고는 이사회 몫)
            for target in sorted({math.ceil(m)} | {t for t in range(5, 65, 5) if t > m}):
                promo = min(2000.0, max(0.0, target - m) * 100)
                rec = min(max(0.0, target - m), adv["base_recruit"] + promo / 100 * adv["recruit_per_100_promo"])
                head = min(m + rec, target)
                left = st.members * attr + max(0.0, m - target)
                for healers in sorted({0, math.ceil(head / 20), math.ceil(head / 10)}):
                    if self.has("hr", "devout") and healers < math.ceil(head / 20):
                        continue
                    injured = self.projected_injured(head, healers)
                    metrics = {"ready": head * 0.97 - injured, "headcount": head * 0.97, "injured": injured, "left": left}
                    cost = healers * wage_h + promo * popular + care * m
                    out.append({"score": self.dept_score("hr", metrics), "capped": self.dept_score("hr", metrics, True),
                                "metrics": metrics, "cost": cost,
                                # 조항 밖 서비스: 20명당 힐러 1명을 두는 것
                                "service": int(healers >= math.ceil(head / 20)),
                                "target": target, "healers": healers, "care": care, "promo": promo})
        return out

    def decide_hr(self) -> None:
        """인사부: 조항 점수를 최대로, 예산 안에서. 모자라면 조항 밖(힐러)부터, 그래도 모자라면 모집 · 처우를 줄인다.
        보수 등급은 이사회가 정한다 (인사부는 안건으로 요청만)."""
        opts = self.hr_options()
        budget = self.budget.get("hr")
        choice, ok = self.pick_option(opts, budget)
        if not ok:
            fit = [o for o in opts if o["cost"] <= budget]
            choice = max(fit, key=lambda o: (o["score"], o["service"], -o["cost"])) if fit else min(opts, key=lambda o: o["cost"])
        self.target_members, self.healers, self.care = choice["target"], choice["healers"], choice["care"]
        self.promo = choice["promo"]  # 예산 안에서 고른 홍보비만큼만 모집한다
        if self.has("hr", "popular"):
            self.target_members += 5
        self.plan_cost["hr"] = choice["cost"]

    def expected_payroll(self) -> float:
        """이번 달 월급 예상: 지금 인원 × 1인 월급 (이사회가 자동 지급)."""
        st = self.game.state
        salary = self.salary_of(self.pay) * self.month_org.get("salary_mult", 1.0)
        return st.members * salary * weighted_avg(PAY_TIERS[self.pay][1], self.game.p["adventurers"]["grade_wage_mult"])

    def salary_of(self, pay: str) -> float:
        """보수 등급의 이번 달 1인 월급 (승인한 층의 위험 수당 포함)."""
        g = self.game
        floor = g.allowed_floor(self.approved_floor)
        miser = 0.9 if self.has("hr", "miser") else 1.0
        return round(PAY_TIERS[pay][0] * g.salary_ref(floor) / g.p["adventurers"]["salary_ref"] * miser)

    # ------------------------------------------------------------ 전초기지 · 층 매장
    def store_floor(self, floor: int, markup: float, state: str | None = None) -> dict:
        """전초기지 매장 한 곳의 한 달: 손님 = 기본 유동 인구 × 이해도 × 정비 계수 × 가격 반응."""
        g, op = self.game, self.game.p["outposts"]
        state = state or self.outposts[floor]["state"]
        visitors = (
            op["visitors"][floor]
            * g.state.understanding[floor]
            * op["maint_factor"][state]
            * demand_factor(1 + markup, 1.0, op["elasticity"])
            * getattr(self, "store_mult", 1.0)
        )
        spend = op["spend"][floor]
        return {
            "visitors": visitors,
            "revenue_per": spend * (1 + markup),
            "cost_per": spend * op["goods_cost_ratio"] * g.supply_price_mult() * self.supply_cost_mult(),
        }

    # ------------------------------------------------------------ 예산
    def explore_need(self) -> float:
        """탐사부 필요액 = 이번 달 계획의 예상치: (주간 준비 활동비 + 예상 사망 × 위약금) × 4주.
        예산 제약 없이 지금 층 · 범위 · 준비 활동을 고른다고 치고 계산한다."""
        if getattr(self, "policy", None) is None:
            return self.o["budget"]["explore_default"]
        g = self.game
        saved = self.budget.get("explore")
        self.budget["explore"] = None  # 예산 제약 없이 계획
        self._planning = True
        try:
            floor, depth, acts = self._decide_explore()
            pv = g.preview_week(self.policy, floor, depth, acts)
        finally:
            self.budget["explore"] = saved
            self._planning = False
        dead = pv["party"] * pv["loss"] * (1 - g.p["weekly"]["injured_share"])
        self.explore_plan_need = {"prep": pv["gold_cost"] * g.weeks,
                                  "penalty": dead * g.p["dungeon"]["penalty_per_lost_member"] * g.weeks}
        return max(500.0, sum(self.explore_plan_need.values()))

    def make_budget_requests(self) -> dict[str, float]:
        """부서장이 예산을 요청한다. 필요액에 성향과 정직도만큼 부풀림이 붙는다."""
        st, b = self.game.state, self.o["budget"]
        needs = {
            "explore": self.explore_need(),
            "hr": self.need_of(self.hr_options()),
            "supply": self.need_of(self.supply_options(max(st.members, self.target_members))),
        }
        self.true_need = needs
        for d, need in needs.items():
            head = self.heads[d]
            infl = b["inflate"][head.aggression] + head.honesty * b["inflate_honesty"] + abs(self.rng.gauss(0, 0.03))
            self.requests_budget[d] = math.ceil(need * (1 + infl) / 100) * 100
        # 기본 배정 = 요청액 그대로 (안건으로 삭감을 승인했으면 그만큼 깎아서)
        self.budget = {d: round(v * self.budget_cut.get(d, 1.0), -2) for d, v in self.requests_budget.items()}
        self.budget_cut = {}
        return self.requests_budget

    def board_treasury(self) -> float:
        """배정하고 남은 이사회 금고."""
        return self.game.state.gold - self.expected_payroll() - sum(self.budget.values()) - sum(self.board_costs.values())

    def settle_month(self) -> dict:
        """월말: 매장 매출 · 캠프 유지비 · 정비 상태 · 부서별 집행과 잔여 예산 소진 · 외상. 엔진 정산 전에 장부에 올린다."""
        g, st = self.game, self.game.state
        inc, exp = g.ctx["income"], g.ctx["expense"]
        op = g.p["outposts"]
        # 매장
        floors = {}
        for f, plan in self.store_plan.items():
            s = self.store_floor(f, self.markup, plan["state"])
            demand = s["visitors"] * self.rng.uniform(0.85, 1.15)
            sold = min(demand, plan["visitors"] * self.stock)
            floors[f] = {"visitors": sold, "revenue": sold * s["revenue_per"], "cost": plan["cost"],
                         "state": plan["state"], "missed": max(0.0, demand - sold)}
        store_rev = sum(x["revenue"] for x in floors.values())
        store_cost = sum(x["cost"] for x in floors.values())
        if store_rev:
            inc["층 매장 판매"] = store_rev
        if store_cost:
            exp["매장 물품 구매"] = store_cost
        upkeep = self.upkeep_total() if self.pay_upkeep else 0.0
        if upkeep:
            exp["전초기지 유지비"] = upkeep
        # 정비 상태: 다 받으면 정상, 못 받으면 노후, 두 달 넘게 못 받으면 방치
        for camp in self.outposts.values():
            camp["unpaid"] = 0 if self.pay_upkeep else camp["unpaid"] + 1
            camp["state"] = "정상" if camp["unpaid"] == 0 else ("노후" if camp["unpaid"] <= 2 else "방치")
        # 부서별 집행
        spent = {
            "explore": exp.get("준비 활동", 0.0) + g.ctx["dead"] * g.p["dungeon"]["penalty_per_lost_member"],
            "hr": exp.get("힐러 고용", 0.0) + exp.get("홍보비", 0.0) + exp.get("처우비", 0.0),  # 월급은 이사회가 자동 지급
            "supply": exp.get("물약 구매", 0.0) + exp.get("장비 구매", 0.0) + store_cost + upkeep + exp.get("외상 상환", 0.0),
        }
        b = self.o["budget"]
        waste, embezzled, overflow = {}, {}, {}
        for d, s in spent.items():
            budget = self.budget.get(d)
            if budget is None:
                continue
            if budget > s:  # 남은 예산은 반납하지 않고 다 쓴다. 부정직한 부서장은 일부를 챙긴다
                waste[d] = budget - s
                embezzled[d] = waste[d] * max(0.0, self.heads[d].honesty - 0.5) * 2 * b["embezzle"]
                exp[f"{DEPTS[d]} 잔여 예산 소진"] = waste[d]
            elif s > budget:
                overflow[d] = s - budget
        if overflow.get("supply"):  # 보급부 초과분은 상단 외상으로 다음 달에 청구된다
            self.credit["merchant"] += overflow["supply"]
            exp["상단 외상 (다음 달 청구)"] = -overflow["supply"]
        notes = []
        if self.credit["merchant"] > b["credit_limit"]:
            hit = self.credit["merchant"] / 1000 * b["credit_gauge_per_1000"]
            g.apply_gauges({"merchant": -hit})
            notes.append("상단이 밀린 대금을 독촉하고 있습니다.")
        return {"floors": floors, "store_rev": store_rev, "store_cost": store_cost, "upkeep": upkeep,
                "spent": spent, "waste": waste, "embezzled": embezzled, "overflow": overflow,
                "credit": dict(self.credit), "budget": dict(self.budget), "requested": dict(self.requests_budget),
                "notes": notes}

    def upkeep_total(self) -> float:
        return sum(self.game.p["outposts"]["upkeep"][f] for f in self.outposts)

    def supply_options(self, members: float) -> list[dict]:
        fac, g = self.game.p["facilities"], self.game
        cm = self.supply_cost_mult()
        upkeep = self.upkeep_total()
        bill = self.credit["merchant"]  # 지난달 외상 청구서는 먼저 갚는다
        out = []
        for i, q in enumerate(GEAR_TIERS):
            potion_cost = members * fac["potions_per_member"] * g.potion_unit_cost() * cm
            gear_cost = members * g.gear_unit_cost(q) * cm
            for mk in MARKUPS:
                if mk == 0 and self.has("supply", "trader"):
                    continue
                p_price, g_price = fac["potion_ref_price"] * (1 + mk), fac["gear_ref_price"][q] * (1 + mk)
                sold = min(1.0, demand_factor(p_price, fac["potion_ref_price"], fac["demand_elasticity"]))
                guild_income = sold * members * (fac["potions_per_member"] * p_price + g_price)
                stores = [self.store_floor(f, mk) for f in self.outposts]
                for stock in STOCKS:
                    store_rev = sum(s["visitors"] * min(1.0, stock) * s["revenue_per"] for s in stores)
                    store_cost = sum(s["visitors"] * stock * s["cost_per"] for s in stores)
                    for pay in (True, False):
                        metrics = {
                            "gear_tier": i,
                            "supply_profit": guild_income + store_rev - potion_cost - gear_cost - store_cost,
                            "floor_sales": store_rev,
                            "maint": 1.0 if pay else 0.0,
                        }
                        tie = -mk / 1e6 - (0.3 * i if self.has("supply", "frugal") else 0.0)  # 공정한 값 · 알뜰은 싼 장비
                        score = self.dept_score("supply", metrics) + tie
                        out.append({
                            "score": score, "capped": self.dept_score("supply", metrics, True) + tie,
                            "metrics": metrics, "gear": q, "markup": mk, "stock": stock, "pay": pay,
                            "cost": potion_cost + gear_cost + store_cost + (upkeep if pay else 0.0) + bill,
                            # 조항 밖 서비스: 캠프 유지비 납부, 매장 물량 채우기
                            "service": int(pay) + int(stock >= 1.0),
                        })
        return out

    def decide_supply(self, members: float) -> None:
        """보급부: 장비 품질 · 판매 마진 · 매장 물량 · 캠프 유지비를 조항 점수로, 예산 안에서 고른다.
        모자라면 조항 밖(캠프 관리, 매장 물량)부터 자르고, 그래도 모자라면 상단에 외상을 진다."""
        opts = self.supply_options(members)
        choice, _ = self.pick_option(opts, self.budget.get("supply"))
        self.gear, self.markup, self.stock, self.pay_upkeep = choice["gear"], choice["markup"], choice["stock"], choice["pay"]
        self.plan_cost["supply"] = choice["cost"]

    def supply_cost_mult(self) -> float:
        m = 1.0
        if self.has("supply", "connected"):
            m *= 0.85
        if self.has("supply", "frugal"):
            m *= 0.9
        return m

    def apply_traits(self) -> None:
        """부서장 특성을 이번 달 장부와 탐사 보정에 반영한다."""
        g, exp = self.game, self.game.ctx["expense"]
        tdefs = self.o["traits"]
        if self.has("hr", "popular") and "홍보비" in exp:
            exp["홍보비"] *= 0.5
        if self.has("hr", "devout") and "힐러 고용" in exp:
            exp["힐러 고용"] *= 0.7
        cm = self.supply_cost_mult()
        for k in ("물약 구매", "장비 구매"):
            if k in exp:
                exp[k] *= cm
        self.skim = 0.0
        if self.has("supply", "connected"):
            self.skim = 0.08 * (exp.get("물약 구매", 0.0) + exp.get("장비 구매", 0.0))
            exp["출처 불명 지출"] = self.skim
        mods: dict = {}
        for t in self.heads["explore"].traits:
            for k, v in tdefs[t].get("effect", {}).items():
                mods[k] = mods[k] * v if k in ("loss", "reward") and k in mods else v
        g.ctx["org_mods"] = mods
        g.ctx["help_discount"] = {
            tdefs[t]["faction"]: 0.5 for t in self.heads["explore"].traits if tdefs[t].get("faction")
        }
        g.ctx["gouging_mult"] = 0.5 if self.has("supply", "trader") else 1.0

    # ------------------------------------------------------------ 층의 비밀 · 공략 지침
    def directive(self, floor: int) -> dict:
        d = {"gear_type": "none", "formation": "balanced", "prep": None}
        d.update(self.directives.get(floor, {}))
        return d

    def apply_directive(self) -> None:
        """이번 달 탐사 층의 공략 지침을 적용한다. 장비 계열이나 편성을 바꾸면 인원수만큼 비용이 든다."""
        g, st = self.game, self.game.state
        cfg = g.p["secrets"]
        d = self.directive(g.allowed_floor(self.approved_floor))
        exp = g.ctx["expense"]
        if d["gear_type"] != self.gear_type:
            if d["gear_type"] != "none":
                exp["장비 계열 교체"] = st.members * cfg["switch_cost"]["gear"]
            self.gear_type = d["gear_type"]
        if d["formation"] != self.formation:
            exp["재편성"] = st.members * cfg["switch_cost"]["formation"]
            self.formation = d["formation"]
        g.ctx["gear_type"], g.ctx["formation"] = self.gear_type, self.formation

    def secrets_status(self, floor: int) -> tuple[int, int]:
        st = self.game.state
        n = len(st.secrets.get(floor, []))
        return sum((floor, i) in st.secret_found for i in range(n)), n

    def secret_label(self, sec: dict) -> str:
        cfg = self.game.p["secrets"]
        if sec["kind"] == "gear":
            return f"장비 계열: {cfg['gear_types'][sec['key']]}"
        if sec["kind"] == "formation":
            return f"편성: {cfg['formations'][sec['key']]['name']}"
        return f"준비: {self.game.p['activities'][sec['key']]['name']}"

    def check_directive(self, weeks: list[dict]) -> list[str]:
        """이번 달 탐사한 층에서 걸어 둔 지침 중 통하지 않은 것. 층 기록에 남기고 보고서에 알린다."""
        g, st = self.game, self.game.state
        floors = {w["engine"]["floor"] for w in weeks}
        out = []
        for floor in floors:
            d = self.directive(floor)
            found = {f"{s['kind']}:{s['key']}" for i, s in enumerate(st.secrets.get(floor, [])) if (floor, i) in st.secret_found}
            tried = []
            if d["gear_type"] != "none":
                tried.append(f"gear:{d['gear_type']}")
            if d["formation"] != "balanced":
                tried.append(f"formation:{d['formation']}")
            if d["prep"]:
                tried.append(f"prep:{d['prep']}")
            for key in tried:
                if key not in found and key not in self.failed.setdefault(floor, set()):
                    self.failed[floor].add(key)
                    kind, val = key.split(":")
                    out.append(f"{floor}층 {self.secret_label({'kind': kind, 'key': val})}")
        return out

    def gather_clue(self, floor: int, depth: float, acts: list) -> dict | None:
        """탐사 한 주에 단서를 하나 가져올 수 있다. 넓게, 학자와 함께, 지도 연구를 할수록 잘 나온다.
        정직하지 않은 부서장은 틀린 단서를 섞고 추측도 확실하다고 말한다."""
        g, st = self.game, self.game.state
        cfg = g.p["secrets"]
        c = cfg["clue"]
        secrets = st.secrets.get(floor, [])
        unknown = [s for i, s in enumerate(secrets) if (floor, i) not in st.secret_found]
        if not unknown:
            return None
        p = c["base"] + c["per_depth"] * depth
        p += c["scholar_formation"] if self.formation == "scholar" else 0
        p += c["map"] if "map" in acts else 0
        p += c["scholar_trait"] if self.has("explore", "scholar") else 0
        if self.rng.random() >= min(c["max"], p):
            return None
        head = self.heads["explore"]
        lie = not self.has("explore", "principled") and self.rng.random() < head.honesty * c["lie"]
        if lie:
            real = {f"{s['kind']}:{s['key']}" for s in secrets}
            key = self.rng.choice([k for k in cfg["clues"] if k not in real])
        else:
            s = self.rng.choice(unknown)
            key = f"{s['kind']}:{s['key']}"
        used = {x["text"] for x in self.clues.get(floor, [])}
        pool = [t for t in cfg["clues"][key] if t[0] not in used] or cfg["clues"][key]
        text, strong = self.rng.choice(pool)
        candid = self.has("explore", "principled") or self.rng.random() > head.honesty
        sure = strong if candid else True  # 솔직하지 않으면 뭐든 확실하다고 한다
        clue = {"floor": floor, "text": text, "sure": sure, "head": head.name, "key": key, "true": not lie,
                "month": st.month + 1}
        self.clues.setdefault(floor, []).append(clue)
        self.month_clues.append(clue)
        return clue

    def start_month(self, card: int, requests: list[int]) -> dict:
        g, st = self.game, self.game.state
        chosen = g.cards()[card] if 0 <= card < len(g.cards()) else g.cards()[0]
        self.month_org = dict(chosen.get("org", {}))
        requests = requests[: max(0, self.explore_slots_free())]  # 의뢰는 탐사부 KPI 슬롯을 차지한다
        self.apply_card_org()
        for dept, slots in self.kpis.items():  # 이번 달 조항 난이도 (부서장이 제시한 수준 대비)
            for s in slots:
                if self.kpi_def(s.kpi)["unit"] == "명":
                    s.target = round(s.target)  # 사람 수 목표는 정수
                s.level = self.level_of(dept, s)
        self.sanction_notes = self.dip.month_start()  # 경계도 견제와 부탁 효과 (가격 · 세율 · 매장 손님)
        if not self.budget:  # 이사회가 예산을 따로 정하지 않았으면 요청액 그대로 배정
            self.make_budget_requests()
        self.decide_hr()
        self.decide_supply(max(st.members, self.target_members))
        grades = PAY_TIERS[self.pay][1]
        salary = self.salary_of(self.pay) * self.month_org.get("salary_mult", 1.0)
        missing = max(0.0, self.target_members - st.members)
        pol = Policy(
            target_members=self.target_members,
            salary=salary,
            healers=self.healers,
            care=self.care,
            promo=int(self.promo),
            grade_mix=dict(grades),
            type_mix=dict(g.p["secrets"]["formations"][self.directive(g.allowed_floor(self.approved_floor))["formation"]]["mix"]),
            loot_buy_rate=self.dip.loot_rate(),
            floor=g.allowed_floor(self.approved_floor),
            card=card,
            requests=requests,
            rep_levels=["state"],  # 명성 레벨업은 층 허가에 필요한 국가만. 나머지 명성은 정치에 쓴다
        )
        pol = stocked(pol, g, self.gear)
        pol.potion_price = round(pol.potion_price * (1 + self.markup))
        pol.gear_price = round(pol.gear_price * (1 + self.markup))
        self.policy = pol
        self.members_start = st.members
        info = g.begin_month(pol)
        g.ctx["assault"] = self.assault
        g.ctx["camps"] = {f: c["state"] for f, c in self.outposts.items()}
        self.apply_traits()
        self.apply_directive()
        # 전초기지 매장: 월초에 예상 손님만큼 물건을 들여놓는다
        self.store_plan = {}
        for f, camp in self.outposts.items():
            s = self.store_floor(f, self.markup)
            self.store_plan[f] = {"visitors": s["visitors"], "cost": s["visitors"] * self.stock * s["cost_per"],
                                  "state": camp["state"]}
        if self.credit["merchant"]:
            g.ctx["expense"]["외상 상환"] = self.credit["merchant"]
            self.credit["merchant"] = 0.0
        if "church" in self.dip.favor_now and "힐러 고용" in g.ctx["expense"]:
            g.ctx["expense"]["힐러 고용"] = 0.0  # 교회 부탁: 이번 달 힐러 무상 파견
        for req in g.ctx["requests"]:  # 의뢰 수락은 종속의 신호: 그 세력 경계도가 내려간다
            f = req["faction"]
            self.dip.vigilance[f] = clamp(self.dip.vigilance[f] + self.dip.p["request_vigilance"], 0, 100)
        paid_audits = self.audits - self.free_audits
        if paid_audits:
            self.add_cost("감사 비용", self.o["audit_cost"] * len(paid_audits))
        for label, amount in self.board_costs.items():
            g.ctx["expense"][label] = g.ctx["expense"].get(label, 0.0) + amount
        self.board_costs = {}
        self.month_weeks, self.halted = [], False
        self.politics_used = []
        self.events_used = 0  # 이번 달 현장 판단으로 멈춘 횟수
        self.month_clues = []
        self.make_promises()
        cut = []
        if not self.pay_upkeep:
            cut.append("캠프 유지비 미납")
        if self.stock < 1.0:
            cut.append(f"매장 물량 {self.stock:.0%}")
        self.announcements = [
            f"인사부({self.heads['hr'].name}): 보수 {self.pay}({salary:,.0f}G), 목표 인원 {self.target_members}명, 힐러 {self.healers}명",
            f"보급부({self.heads['supply'].name}): 장비 {self.gear.capitalize()}, 판매 마진 +{self.markup:.0%}, "
            f"전초기지 {len(self.outposts)}곳" + (f" ({', '.join(cut)})" if cut else ""),
        ]
        return info

    def apply_card_org(self) -> None:
        """이사회 결의의 조직 효과 중 월초에 바로 적용되는 것."""
        o, st = self.month_org, self.game.state
        self.free_audits: set[str] = set()
        self.card_notes: list[str] = []
        if o.get("reveal"):
            hidden = [d for d, h in self.heads.items() if not h.revealed]
            for d in self.rng.sample(hidden, min(o["reveal"], len(hidden))):
                self.heads[d].revealed = True
                self.card_notes.append(f"{DEPTS[d]}장 {self.heads[d].name}의 정직도가 드러났어요: {self.heads[d].honesty_label()}")
        if o.get("free_audit"):
            d = self.rng.choice(list(DEPTS))
            self.audits.add(d)
            self.free_audits.add(d)
            self.card_notes.append(f"내부 고발로 {DEPTS[d]}가 이번 달 감사를 받아요 (무료)")
        if o.get("honesty_shift"):
            for h in self.heads.values():
                h.honesty = clamp(h.honesty + o["honesty_shift"], 0, 1)
            self.card_notes.append(f"부서장 전원의 정직도가 {'올랐' if o['honesty_shift'] < 0 else '내려갔'}어요")
        if o.get("power"):
            st.train += o["power"]

    # ------------------------------------------------------------ 매주: 탐사부 결정
    def month_so_far(self) -> dict:
        w = self.month_weeks
        return {
            "revenue": sum(x["true"]["revenue"] for x in w),
            "deaths": sum(x["true"]["deaths"] for x in w),
            "progress": sum(x["true"]["progress"] for x in w),
            "gauge_spent": sum(x["true"]["gauge_spent"] for x in w),
        }

    def request_sat(self, req: dict, pv: dict, depth: float, acts: list, weeks_left: int) -> float:
        g = self.game
        c = req["condition"]
        prog = g.request_progress(req, g.ctx["weeks"])
        if prog["done"] and c["type"] != "max_dead":
            return 1.0
        if c["type"] == "weeks":
            p = 1.0
            p *= depth >= c.get("min_range", 0)
            p *= (c.get("activity") is None) or (c["activity"] in acts)
            p *= (not c.get("deepest")) or (pv["floor"] == g.state.max_unlocked)
            p *= pv["success"] if c.get("cleared") else 1.0
            return min(1.0, (prog["current"] + p * weeks_left) / c["count"])
        if c["type"] == "seize":
            return 1.0 if c["finding"] in pv["seized"] else 0.0
        if c["type"] == "unlock":
            und = g.state.understanding[pv["floor"]] + pv["understanding_gain"] * weeks_left
            return min(1.0, und / g.p["dungeon"]["unlock_next_at_understanding"])
        if c["type"] == "max_dead":
            dead = prog["current"] + pv["party"] * pv["loss"] * (1 - g.p["weekly"]["injured_share"]) * weeks_left
            return satisfaction(dead, c["max"], "max")
        return 0.0

    def keep_ratio(self) -> float:
        """탐사 총가치 중 길드에 남는 비율: 수수료 + (시장 판매가 − 매입가) × 전리품 몫."""
        ls = self.game.p["dungeon"]["loot_share_of_reward"]
        mk = self.game.p["facilities"]["market_sell_mult"]
        return (1 - ls) + ls * (mk - self.policy.loot_buy_rate)

    def explore_net(self, haul: float, prep_cost: float, dead: float) -> float:
        """탐사부 순이익 = 수수료 + 전리품 차익 − 준비 활동 비용 − 위약금."""
        return haul * self.keep_ratio() - prep_cost - dead * self.game.p["dungeon"]["penalty_per_lost_member"]

    def explore_score(self, pv: dict, depth: float, acts: list) -> float:
        g = self.game
        planning = getattr(self, "_planning", False)  # 월초 예산 요청용: 새 달 4주 전체를 계획한다
        weeks_left = g.weeks if planning else g.weeks - g.state.week
        so_far = {k: 0.0 for k in ("revenue", "deaths", "progress", "gauge_spent")} if planning else self.month_so_far()
        dead = pv["party"] * pv["loss"] * (1 - g.p["weekly"]["injured_share"])
        und = {f: g.state.understanding[f] for f in self.outposts}
        und[pv["floor"]] = min(1.0, und.get(pv["floor"], 0.0) + pv["understanding_gain"] * weeks_left)
        metrics = {
            "revenue": so_far["revenue"] + self.explore_net(pv["haul"], pv["gold_cost"], dead) * weeks_left,
            "deaths": so_far["deaths"] + dead * weeks_left,
            "progress": so_far["progress"] + pv["understanding_gain"] * weeks_left,
            "gauge_spent": so_far["gauge_spent"] + sum(pv["gauge_cost"].values()) * weeks_left,
            "und_by_floor": und,
        }
        score = self.dept_score("explore", metrics)
        for req in ([] if planning or g.ctx is None else g.ctx["requests"]):
            score += self.o["request_weight"] * self.request_sat(req, pv, depth, acts, weeks_left)
        return score + metrics["revenue"] / 1e7  # 동점이면 많이 버는 쪽

    def blind_spot(self, fd: dict | None) -> bool:
        """탐사부장이 이 정황을 무시하는지. 공격형·도박사는 위험을, 신중형은 기회를 흘려듣는다."""
        if not fd or not fd.get("effect") or self.has("explore", "scholar"):
            return False
        opportunity = "min_range" in fd or "requires" in fd
        head = self.heads["explore"]
        if opportunity:
            return head.aggression == "신중형"
        return head.aggression == "공격형" or self.has("explore", "gambler")

    def decide_explore(self) -> tuple[int, float, list]:
        st, fd = self.game.state, self.game.state.finding
        if not self.blind_spot(fd):
            return self._decide_explore()
        st.finding = None  # 보고서의 정황을 계산에 넣지 않는다
        try:
            return self._decide_explore()
        finally:
            st.finding = fd

    def explore_floors(self) -> list[int]:
        """탐사부가 고를 수 있는 층: 최전선 + 조항이 지정한 지나온 층. 최심부 공략 달에는 10층만."""
        g = self.game
        front = g.allowed_floor(self.approved_floor)
        if self.assault and front == MAX_FLOOR:
            return [front]
        floors = {front}
        for s in self.kpis["explore"]:
            if s.floor and s.floor <= front and s.floor in self.outposts:
                floors.add(s.floor)
        return sorted(floors)

    def explore_budget_left(self) -> float | None:
        budget = self.budget.get("explore")
        if budget is None:
            return None
        g = self.game
        spent = sum(w["engine"]["activity_cost"] for w in self.month_weeks)
        spent += g.ctx["dead"] * g.p["dungeon"]["penalty_per_lost_member"] if g.ctx else 0.0
        return budget - spent

    def _decide_explore(self) -> tuple[int, float, list]:
        best = None
        for floor in self.explore_floors():
            plan = self._plan_floor(floor)
            if best is None or plan[0] > best[0]:
                best = plan
        return best[1], best[2], best[3]

    def _plan_floor(self, floor: int) -> tuple[float, int, float, list]:
        g = self.game
        ranges = RANGES
        order = {**self.month_order, **self.week_order}
        tdefs = self.o["traits"]
        if self.assault and floor == MAX_FLOOR:  # 이사회가 최심부 공략을 승인했다: 범위를 고를 수 없다
            ranges = tuple(d for d in RANGES if d >= g.p["rules"]["win_depth"])
        else:
            if self.has("explore", "timid"):
                ranges = tuple(d for d in ranges if d <= 0.7)
            if "min_depth" in order:
                ranges = tuple(d for d in ranges if d >= order["min_depth"]) or (max(ranges),)
            if "max_depth" in order:
                ranges = tuple(d for d in ranges if d <= order["max_depth"]) or (min(RANGES),)
        available = list(g.available_activities())
        left = self.explore_budget_left()
        if left is not None:  # 예산이 모자라면 돈 드는 준비 활동을 뺀다 (이사회 지시는 예외)
            weeks_left = max(1, g.weeks - g.state.week)
            available = [a for a in available if g.activity_cost(g.week_mods(1.0, [a])) <= max(0.0, left) / weeks_left]
        forced = [a for a in order.get("acts", []) if a in g.available_activities()]
        prep = self.directive(floor)["prep"]  # 공략 지침의 준비 활동은 그 층에서 매주 한다 (이사회 지시라 예산과 무관)
        if prep and prep in g.available_activities() and prep not in forced:
            forced.insert(0, prep)
        for t in self.heads["explore"].traits:  # 인맥: 그 세력 협력을 늘 부른다
            key = tdefs[t].get("faction")
            if key and key in available and key not in forced:
                forced.append(key)
        forced = forced[: g.p["weekly"]["actions_per_week"]]
        n = g.p["weekly"]["actions_per_week"]

        def best_for(acts: list) -> tuple[float, float]:
            return max((self.explore_score(g.preview_week(self.policy, floor, d, acts), d, acts), d) for d in ranges)

        acts: list = list(forced)
        score, depth = best_for(acts)
        for _ in range(n - len(acts)):
            options = [(best_for(acts + [a]), a) for a in available if a not in acts]
            if not options:
                break
            (s, d), a = max(options)
            if s <= score:
                break
            acts, score, depth = acts + [a], s, d
        if self.has("explore", "gambler") and not self.assault and "max_depth" not in order:
            deeper = [d for d in ranges if d > depth]
            depth = deeper[0] if deeper else depth
        return score, floor, depth, acts

    # ------------------------------------------------------------ 보고서 왜곡
    def kpi_slot(self, dept: str, metric: str) -> Slot | None:
        for s in self.kpis[dept]:
            if self.kpi_def(s.kpi)["metric"] == metric:
                return s
        return None

    def distort(self, dept: str, metric: str, true: float, pressure_value: float | None = None, scale: float = 1.0) -> float:
        """부서장이 보고하는 값. pressure_value = 압박을 계산할 기준값 (주간 보고는 월 목표를 진행 비율로 나눠 본다)."""
        head = self.heads[dept]
        direction = LIE_DIRECTION[metric]
        if direction == 0 or self.month_org.get("honest") == dept or self.has(dept, "principled"):
            return true
        noise = self.rng.gauss(0, self.noise_sd(dept))
        bias = 0.0
        slot = self.kpi_slot(dept, metric)
        if slot:
            d = self.kpi_def(slot.kpi)
            basis = true if pressure_value is None else pressure_value
            bias = head.honesty * shortfall(basis, slot.target * scale, d["dir"]) * self.o["max_bias"]
            bias *= self.month_org.get("spin_mult", 1.0) * (1.5 if self.has(dept, "ambitious") else 1.0)
        value = (true + direction * bias * abs(true)) * (1 + noise)
        return value if metric == "revenue" else max(0.0, value)

    # ------------------------------------------------------------ 한 주 진행
    def run_week(self) -> dict:
        """탐사부가 결정해서 한 주를 굴린다. 반환: 실제값, 보고값, 경보."""
        g, st = self.game, self.game.state
        floor, depth, acts = self.decide_explore()
        before = st.understanding[g.allowed_floor(floor)]
        h = g.play_week(floor, depth, acts)
        true = {
            "revenue": self.explore_net(h["haul"], h["activity_cost"], h["dead"]),
            "deaths": h["dead"],
            "progress": h["understanding"] - before,
            "gauge_spent": sum(h["gauge_cost"].values()),
        }
        # 주간 보고: 월 목표를 지금까지 진행한 비율만큼 나눠서 압박을 느낀다
        so_far = self.month_so_far()
        scale = st.week / g.weeks
        reported = {
            m: self.distort("explore", m, true[m], pressure_value=so_far[m] + true[m], scale=scale)
            for m in ("revenue", "deaths")
        }
        reported["deaths"] = round(reported["deaths"])
        rec = {"true": true, "reported": reported, "engine": h, "decision": (floor, depth, acts)}
        rec["clue"] = self.gather_clue(h["floor"], depth, h["activities"])
        self.month_weeks.append(rec)
        self.week_order = {}
        rec["alerts"] = self.alerts(rec)
        return rec

    def alerts(self, rec: dict) -> list[str]:
        out = []
        st = self.game.state
        if rec["reported"]["deaths"] >= self.o["alert_week_deaths"]:
            out.append(f"탐사부 보고: 이번 주 사망 {rec['reported']['deaths']:.0f}명")
        if not rec["engine"]["cleared"]:
            out.append("탐사부 보고: 탐사대가 후퇴했습니다")
        for f in FACTIONS:
            if st.gauges[f] <= self.o["alert_gauge"]:
                out.append(f"{FACTION_KO[f]} 관계 악화: 우호도 {st.gauges[f]:+.0f}")
        return out

    def emergency_audit(self) -> dict:
        """이번 주 실제 숫자를 즉시 확인한다. 비용은 이번 달 지출로."""
        exp = self.game.ctx["expense"]
        exp["감사·인사 비용"] = exp.get("감사·인사 비용", 0.0) + self.o["audit_cost"]
        return self.month_weeks[-1]["true"]

    # ------------------------------------------------------------ 월말
    def spin(self, dept: str, true_metrics: dict) -> float:
        """부서장이 이번 달 보고서 전체를 얼마나 좋게 포장하는지 (0 ~ max_bias)."""
        pressure = max(
            (shortfall(self.slot_value(true_metrics, sl), sl.target, self.kpi_def(sl.kpi)["dir"]) for sl in self.kpis[dept]),
            default=0.0,
        )
        # 예산을 요청보다 깎을수록 조항 압박이 커진다
        req, got = self.requests_budget.get(dept), self.budget.get(dept)
        if req and got is not None and got < req:
            pressure = min(1.0, pressure + (req - got) / req)
        if self.month_org.get("honest") == dept or self.has(dept, "principled"):
            return -1.0  # 표식: 이 부서는 이번 달 있는 그대로 보고한다
        amb = 1.5 if self.has(dept, "ambitious") else 1.0
        return self.heads[dept].honesty * pressure * self.o["max_bias"] * self.month_org.get("spin_mult", 1.0) * amb

    def noise_sd(self, dept: str) -> float:
        return self.o["noise_sd"] * (2.0 if self.has(dept, "field") else 1.0)

    def spun(self, value: float, s: float, good: bool, dept: str = "") -> float:
        """좋은 항목(수입·인원·진척)은 부풀리고, 나쁜 항목(비용·사망)은 줄인다. 항목마다 노이즈."""
        if s < 0:
            return value
        noise = self.rng.gauss(0, self.noise_sd(dept) if dept else self.o["noise_sd"])
        return max(0.0, (value + (s if good else -s) * abs(value)) * (1 + noise))

    def end_month(self) -> dict:
        g, st = self.game, self.game.state
        ctx = g.ctx
        dun, fac = g.p["dungeon"], g.p["facilities"]
        weeks = self.month_weeks
        income, expense = dict(ctx["income"]), dict(ctx["expense"])
        attr_left, recruited = ctx["left"], ctx["recruited"]
        gold_before = st.gold
        fin = self.settle_month()
        income, expense = dict(ctx["income"]), dict(ctx["expense"])
        # ---- 실제값 (엔진 정산 전에 계산: 세력은 이 달의 보고서를 입수해 반응한다)
        ls, mk, buy = dun["loot_share_of_reward"], fac["market_sell_mult"], self.policy.loot_buy_rate
        pen = dun["penalty_per_lost_member"]
        haul = sum(w["engine"]["haul"] for w in weeks)
        ex = {
            "weeks": len(weeks),
            "cleared": sum(w["engine"]["cleared"] for w in weeks),
            "floors": sorted({w["engine"]["floor"] for w in weeks}),
            "acts": Counter(a for w in weeks for a in w["engine"]["activities"]),
            "gauge_by_faction": Counter(),
            "commission": haul * (1 - ls),
            "loot": haul * ls,
            "prep_cost": sum(w["engine"]["activity_cost"] for w in weeks),
            "gauge_spent": sum(w["true"]["gauge_spent"] for w in weeks),
            "deaths": sum(w["engine"]["dead"] for w in weeks),
            "injured": sum(w["engine"]["injured_new"] for w in weeks),
            "progress": sum(w["true"]["progress"] for w in weeks),
        }
        for w in weeks:
            ex["gauge_by_faction"].update(w["engine"]["gauge_cost"])
        salary, grades = self.policy.salary, PAY_TIERS[self.pay][1]
        hr = {
            "start": self.members_start,
            "left": attr_left,
            "recruited": recruited,
            "deaths": ex["deaths"],
            "end": st.members,
            "pay": self.pay,
            "salary": salary,
            "wage_mult": weighted_avg(grades, g.p["adventurers"]["grade_wage_mult"]),
            "payroll": expense.get("모험가 보수", 0.0) + expense.get("힐러 고용", 0.0),
            "salary_cost": expense.get("모험가 보수", 0.0),
            "healers": self.healers,
            "healer_wage": g.healer_wage(),
            "healer_cost": expense.get("힐러 고용", 0.0),
            "injured": st.injured,
            "promo": expense.get("홍보비", 0.0),
            "care": self.care,
            "care_cost": expense.get("처우비", 0.0),
        }
        pol = self.policy
        sp = {
            "potion_qty": pol.potion_qty,
            "potion_cost": expense.get("물약 구매", 0.0),
            "potion_income": income.get("물약 판매", 0.0),
            "potion_market": fac["potion_cost"],
            "supply_mult": g.supply_price_mult(),
            "gear": self.gear,
            "gear_qty": pol.gear_qty,
            "gear_cost": expense.get("장비 구매", 0.0),
            "gear_income": income.get("장비 판매", 0.0),
            "gear_market": fac["gear_cost"][self.gear],
            "potion_price": pol.potion_price,
            "potion_ref": fac["potion_ref_price"],
            "gear_price": pol.gear_price,
            "gear_ref": fac["gear_ref_price"][self.gear],
            "markup": self.markup,
            "store_floors": fin["floors"],
            "store_income": fin["store_rev"],
            "store_cost": fin["store_cost"],
            "upkeep": fin["upkeep"],
            "stock": self.stock,
            "camps": {f: c["state"] for f, c in self.outposts.items()},
        }
        for d in (ex,):
            d["margin"] = d["loot"] * (mk - buy)
            d["penalty"] = d["deaths"] * pen
            d["net"] = d["commission"] + d["margin"] - d["prep_cost"] - d["penalty"]
        true = {
            "revenue": ex["net"],
            "deaths": ex["deaths"],
            "progress": ex["progress"],
            "gauge_spent": ex["gauge_spent"],
            "headcount": hr["end"],
            "payroll": hr["payroll"],
            "supply_cost": sp["potion_cost"] + sp["gear_cost"],
            "gear_tier": GEAR_TIERS.index(self.gear),
            "grade_tier": list(PAY_TIERS).index(self.pay),
            "injured": hr["injured"],
            "ready": hr["end"] - hr["injured"],
            "supply_profit": sp["potion_income"] + sp["gear_income"] + sp["store_income"]
            - sp["potion_cost"] - sp["gear_cost"] - sp["store_cost"],
            "floor_sales": sp["store_income"],
            "maint": sum(c == "정상" for c in sp["camps"].values()) / max(1, len(sp["camps"])),
            "left": attr_left,
            "und_by_floor": {f: st.understanding[f] for f in self.outposts},
        }

        # ---- 부서장이 포장한 보고값 (항목마다 같은 방향으로 포장, 노이즈는 항목별)
        s_ex, s_hr, s_sp = self.spin("explore", true), self.spin("hr", true), self.spin("supply", true)
        # 세력은 금고를 못 본다: 입수한 보고서(포장된 값)로 판단한다
        ctx["seen"] = self.dip.seen(ex, hr, s_ex, s_hr, s_sp)
        rep_before = st.reputation
        h = g.end_month()
        hr["end"] = st.members
        hr["injured"] = st.injured
        hr["ready"] = st.members - st.injured
        true["headcount"] = st.members
        true["injured"] = st.injured
        true["ready"] = st.members - st.injured
        ex_r = dict(ex)
        for k in ("commission", "loot", "progress"):
            ex_r[k] = self.spun(ex[k], s_ex, True, "explore")
        for k in ("prep_cost", "gauge_spent", "deaths", "injured"):
            ex_r[k] = self.spun(ex[k], s_ex, False, "explore")
        for k in ("deaths", "injured"):  # 사람 수는 정수로 보고한다
            ex_r[k] = round(ex_r[k])
        ex_r["margin"] = ex_r["loot"] * (mk - buy)
        ex_r["penalty"] = ex_r["deaths"] * pen
        ex_r["net"] = ex_r["commission"] + ex_r["margin"] - ex_r["prep_cost"] - ex_r["penalty"]
        hr_r = dict(hr)
        for k in ("end", "recruited"):
            hr_r[k] = self.spun(hr[k], s_hr, True, "hr")
        for k in ("left", "deaths", "healer_cost", "promo", "care_cost", "injured"):  # 월급은 이사회가 직접 줘서 못 속인다
            hr_r[k] = self.spun(hr[k], s_hr, False, "hr")
        for k in ("end", "recruited", "left", "deaths", "injured"):
            hr_r[k] = round(hr_r[k])
        hr_r["payroll"] = hr_r["salary_cost"] + hr_r["healer_cost"]
        hr_r["ready"] = hr_r["end"] - hr_r["injured"]
        sp_r = dict(sp)
        for k in ("potion_income", "gear_income", "store_income"):
            sp_r[k] = self.spun(sp[k], s_sp, True, "supply")
        for k in ("potion_cost", "gear_cost", "store_cost", "upkeep"):
            sp_r[k] = self.spun(sp[k], s_sp, False, "supply")
        # 캠프 상태: 포장하는 보급부장은 노후·방치 캠프를 정상이라고 보고한다
        hides = s_sp > 0.05 or (s_sp >= 0 and self.heads["supply"].honesty > 0.6)
        sp_r["camps"] = {f: ("정상" if hides else c) for f, c in sp["camps"].items()}
        # 예산 집행: 부서는 배정액을 다 정당하게 썼다고 보고하고, 외상은 줄여 보고한다
        spins = {"explore": s_ex, "hr": s_hr, "supply": s_sp}
        budget_true = {"requested": fin["requested"], "budget": fin["budget"], "spent": fin["spent"],
                       "waste": fin["waste"], "embezzled": fin["embezzled"], "credit": fin["credit"]}
        budget_rep = {
            "requested": fin["requested"],
            "budget": fin["budget"],
            "spent": {d: max(s, fin["budget"].get(d, s)) for d, s in fin["spent"].items()},
            "credit": {f: self.spun(v, spins["supply"], False, "supply") for f, v in fin["credit"].items()},
        }
        reported = {
            "revenue": ex_r["net"],
            "deaths": ex_r["deaths"],
            "progress": ex_r["progress"],
            "gauge_spent": ex_r["gauge_spent"],
            "headcount": hr_r["end"],
            "payroll": hr_r["payroll"],
            "supply_cost": sp_r["potion_cost"] + sp_r["gear_cost"],
            "gear_tier": true["gear_tier"],
            "grade_tier": true["grade_tier"],
            "injured": hr_r["injured"],
            "ready": hr_r["ready"],
            "supply_profit": sp_r["potion_income"] + sp_r["gear_income"] + sp_r["store_income"]
            - sp_r["potion_cost"] - sp_r["gear_cost"] - sp_r["store_cost"],
            "floor_sales": sp_r["store_income"],
            "maint": sum(c == "정상" for c in sp_r["camps"].values()) / max(1, len(sp_r["camps"])),
            "left": hr_r["left"],
            "und_by_floor": true["und_by_floor"],
        }

        # ---- 감사
        caught = []
        for dept in self.audits:
            for sl in self.kpis[dept]:
                t, r = self.slot_value(true, sl), self.slot_value(reported, sl)
                if abs(r - t) / max(abs(t), 1.0) > self.o["audit_catch_threshold"]:
                    caught.append(dept)
                    break
            if fin["embezzled"].get(dept, 0) > 200:  # 예산 착복은 감사로만 드러난다
                caught.append(dept)
            if dept == "supply" and sp_r["camps"] != sp["camps"]:
                caught.append(dept)
            self.heads[dept].revealed = True
        for dept in set(caught):
            self.heads[dept].caught += 1

        report = {
            "month": h["month"],
            "engine": h,
            "true": true,
            "reported": reported,
            "details": {
                "explore": {"true": ex, "reported": ex_r},
                "hr": {"true": hr, "reported": hr_r},
                "supply": {"true": sp, "reported": sp_r},
            },
            "prev_headcount": self.reports[-1]["reported"]["headcount"] if self.reports else None,
            "audited": set(self.audits),
            "caught": set(caught),
            "cross_deaths": true["deaths"]
            if self.month_org.get("cross_exact") or self.forced_cross
            else max(0, round(true["deaths"] * (1 + self.rng.gauss(0, self.o["cross_check_sd"])))),
            "requests": [r["request"]["name"] for r in h["requests"]],
            "card_org": dict(self.month_org),
            "cash": st.gold - gold_before,
            "kpis": {d: [Slot(sl.kpi, sl.target, sl.floor, sl.level) for sl in slots] for d, slots in self.kpis.items()},
            "contract": self.settle_contracts(reported, true),
            "budget": {"true": budget_true, "reported": budget_rep},
            "fin_notes": fin["notes"],
            "weeks": weeks,
            "halted": self.halted,
            "spin": {"explore": s_ex, "hr": s_hr, "supply": s_sp},
            "skim": self.skim,
            "promises": self.judge_promises(true),
            "revealed": self.reveal_traits(),
            "clues": list(self.month_clues),
            "directive_miss": self.check_directive(weeks),
            "secrets_new": [(w["engine"]["floor"], i) for w in weeks for i in w["engine"]["secrets_new"]],
        }
        report["diplomacy"] = self.dip.month_end(report, h["rep_gain"])
        report["sanctions"] = list(self.sanction_notes)
        self.reports.append(report)
        self.audits = set()
        if self.month_org.get("power"):
            st.train = max(0.0, st.train - self.month_org["power"])
        self.month_org = {}
        self.assault = False
        self.month_order = {}
        self.budget, self.requests_budget = {}, {}
        return report

    # ------------------------------------------------------------ 약속 장부 · 특성 발견
    def make_promises(self) -> None:
        """부서장마다 첫 번째 KPI를 두고 약속한다. 정직한 부서장은 어려우면 어렵다고 말한다."""
        self.promises = {}
        last = self.reports[-1]["true"] if self.reports else None
        for dept, slots in self.kpis.items():
            if not slots:
                continue
            sl, head = slots[0], self.heads[dept]
            kd = self.kpi_def(sl.kpi)
            candid = self.has(dept, "principled") or self.rng.random() > head.honesty
            forecast = self.slot_value(last, sl) if last else None
            likely = forecast is None or achieved(kd, forecast, sl.target)
            say = "achieve" if likely or not candid else "miss"
            self.promises[dept] = {"kpi": sl.kpi, "target": sl.target, "floor": sl.floor, "say": say, "forecast": forecast}

    def judge_promises(self, true: dict) -> list[dict]:
        out = []
        for dept, pr in self.promises.items():
            kd = self.kpi_def(pr["kpi"])
            ok = achieved(kd, self.slot_value(true, Slot(pr["kpi"], pr["target"], pr["floor"])), pr["target"])
            kept = ok if pr["say"] == "achieve" else True  # 어렵다고 미리 말했으면 약속을 어긴 게 아니다
            self.heads[dept].promises.append(kept)
            out.append({**pr, "dept": dept, "head": self.heads[dept].name, "achieved": ok, "kept": kept})
        return out

    def reveal_traits(self) -> list[tuple[str, str]]:
        """한 달 같이 일하면서 부서장 특성이 드러난다."""
        out = []
        for dept, head in self.heads.items():
            for t in head.traits:
                if t not in head.known and self.rng.random() < self.o["trait_reveal_chance"]:
                    head.known.add(t)
                    out.append((dept, t))
        return out

    def assault_ready(self) -> bool:
        """10층을 충분히 이해하면 탐사부가 최심부 공략 승인을 요청한다. 겁쟁이 부서장은 요청하지 않는다."""
        return self.assault_possible() and not self.has("explore", "timid")

    def assault_possible(self) -> bool:
        g, st = self.game, self.game.state
        unlock = g.p["dungeon"]["unlock_next_at_understanding"]
        return (
            self.approved_floor == MAX_FLOOR
            and g.allowed_floor(MAX_FLOOR) == MAX_FLOOR
            and st.understanding[MAX_FLOOR] >= unlock
            and bool(self.reports)
        )

    def assault_estimate(self) -> tuple[float, float]:
        """(탐사부가 보고하는 예상 성공률, 실제 예상 성공률). 과장형 부서장일수록 낙관적으로 보고한다."""
        g = self.game
        pv = g.preview_week(self.policy, MAX_FLOOR, g.p["rules"]["win_depth"], [])
        true = pv["success"]
        head = self.heads["explore"]
        claimed = clamp(true + head.honesty * self.o["assault_optimism"] + self.rng.gauss(0, 0.04), 0.01, 0.99)
        return claimed, true

    def approve_floor(self, floor: int) -> float:
        """층 진출 승인 = 그 층에 전초기지 설치. 설치비는 이사회 금고에서."""
        cost = self.game.p["outposts"]["install"][floor]
        self.approved_floor = floor
        if floor not in self.outposts:
            self.outposts[floor] = {"state": "정상", "unpaid": 0}
            if cost:
                self.add_cost("전초기지 설치", cost)
        return cost

    def floor_proposal(self) -> int | None:
        """탐사부가 다음 층 진출 승인을 요청할 조건이면 그 층 번호."""
        g, st = self.game, self.game.state
        nxt = self.approved_floor + 1
        unlock = g.p["dungeon"]["unlock_next_at_understanding"]
        if nxt <= MAX_FLOOR and st.understanding[self.approved_floor] >= unlock and g.allowed_floor(nxt) == nxt:
            return nxt
        return None
