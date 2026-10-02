"""정치 심화: 세력을 숨겨진 판단 기준과 기억을 가진 상대로 만든다.

  ① 빚 장부: 부탁으로 지금 혜택을 받고, 세력이 정한 때에 강제 요구로 갚는다. 거절하면 우호도 −20.
  ② 경계도: 우호도와 별개. 길드가 강해 보이면 오르고, 60 이상이면 견제, 90 이상이면 혜택이 한 단계 내려간다.
     값은 보이지 않고 강도가 담긴 소문으로만 전해진다.
  ③ 세력은 금고를 못 본다: 부서 보고서(포장된 값)를 입수해 반응한다. 포장으로 얻은 우호도는 기록되고,
     진실이 드러나면(교차 확인 · 검증 결의 카드 · 감사 적발 유출) 한 번에 회수당한다.
  감사로 허위 보고를 적발하면 이사회가 공개 징계(교체 + 진실 공개, 절반만 회수)와 은폐(당장은 조용, 매달 유출 확률 +10%, 유출되면 2배) 중 고른다.
"""
from __future__ import annotations

from sim import FACTION_KO, FACTIONS, clamp

RELATED = {"supply": "merchant", "hr": "church", "explore": "state"}  # 부서 → 그 부서 보고서를 입수하는 세력
DEPT_OF = {f: d for d, f in RELATED.items()}


class Diplomacy:
    def __init__(self, guild):
        self.guild = guild
        self.p = guild.game.p["diplomacy"]
        self.debts: dict[str, list[dict]] = {f: [] for f in FACTIONS}
        self.vigilance = {f: 0.0 for f in FACTIONS}
        self.deceit = {f: 0.0 for f in FACTIONS}  # 포장으로 얻은 우호도 (들키면 회수)
        self.hidden: list[dict] = []  # 은폐한 적발 기록 {"faction", "chance"}
        self.demands: list[str] = []  # 이번 달 세력이 청구한 빚 (세력 키)
        self.pending_disclosure: list[str] = []  # 이사회가 공개/은폐를 고를 적발 부서
        self.favor_now: set[str] = set()
        self.give_credit = False  # 이번 달 의뢰가 성공하면 공을 세력에 돌린다
        self.news: list[str] = []
        self.last_loot = 0.0

    # ------------------------------------------------------------ 부탁 (정치 행동 슬롯 공유)
    def can_ask(self, f: str) -> str | None:
        g = self.guild
        if len(g.politics_used) >= g.game.p["politics"]["actions_per_month"]:
            return "이번 달 정치 행동을 모두 썼어요"
        if len(self.debts[f]) >= self.p["max_debts"]:
            return f"{FACTION_KO[f]}에 빚이 {self.p['max_debts']}장이라 더 부탁할 수 없어요"
        if f in self.favor_now:
            return "이번 달 이미 부탁했어요"
        return None

    def ask(self, f: str) -> None:
        g = self.guild
        self.debts[f].append({"month": g.game.state.month})
        self.vigilance[f] = clamp(self.vigilance[f] + self.p["debt_vigilance"], 0, 100)
        self.favor_now.add(f)
        g.politics_used.append(f"favor_{f}")
        if f == "state":
            g.game.state.level_waiver = True

    # ------------------------------------------------------------ 월초: 견제 · 부탁 효과
    def month_start(self) -> list[str]:
        """이번 달 perk 보정과 견제를 정한다. 반환: 이번 달 적용되는 견제 설명."""
        g, st = self.guild, self.guild.game.state
        st.perk_mod = {}
        st.level_gauge_extra = 0.0
        g.store_mult = 1.0
        g.forced_cross = False
        notes = []
        sanction, severe = self.p["sanction_at"], self.p["severe_at"]
        for f in FACTIONS:
            v = self.vigilance[f]
            if v >= severe:
                st.perk_mod[f] = st.perk_mod.get(f, 0) - 1
            if v >= sanction:
                if f == "merchant":
                    g.store_mult = 0.85  # 경쟁 길드 후원: 매장 손님이 준다
                    notes.append("상단 견제: 경쟁 길드 후원으로 매장 손님 −15%, 전리품 매입가 인상 요구")
                elif f == "church":
                    st.perk_mod["church"] = st.perk_mod.get("church", 0) - 1
                    notes.append("교회 견제: 힐러 파견을 꺼려 힐러 고용비가 한 단계 비싸짐")
                else:
                    st.perk_mod["state"] = st.perk_mod.get("state", 0) - 1
                    st.level_gauge_extra = 10.0
                    g.forced_cross = True
                    notes.append("국가 견제: 세율 한 단계 인상, 감찰관 파견, 다음 층 허가 조건 강화(국가 우호도 +10)")
        if "merchant" in self.favor_now:
            st.perk_mod["merchant"] = st.perk_mod.get("merchant", 0) + 1
        return notes

    def loot_rate(self) -> float:
        return 0.9 if self.vigilance["merchant"] >= self.p["sanction_at"] else 0.8

    # ------------------------------------------------------------ 세력이 입수하는 보고서
    def seen(self, ex: dict, hr: dict, s_ex: float, s_hr: float, s_sp: float) -> dict:
        """세력별로 입수한 보고값. 부서장의 포장이 그대로 세력에게 간다 (포장은 방패)."""
        g = self.guild
        weeks = max(1, ex["weeks"])
        rate = ex["cleared"] / weeks
        members = max(g.game.state.members, 1.0)
        out = {}
        if s_sp > 0:
            out["markup"] = g.markup * (1 - min(1.0, 2 * s_sp))  # 마진을 낮게 보고한다
        if s_hr > 0:
            out["dead"] = ex["deaths"] * (1 - s_hr)
            out["injured_ratio"] = hr["injured"] / members * (1 - s_hr)
        if s_ex > 0:
            out["success"] = rate + s_ex * (1 - rate)
        self.seen_now = {"rate_true": rate, **out}
        return out

    # ------------------------------------------------------------ 월말
    def month_end(self, report: dict, rep_gain: float) -> list[str]:
        g, st, h = self.guild, self.guild.game.state, report["engine"]
        news: list[str] = []
        # 포장으로 얻은 우호도를 기록한다
        for f, gain in h.get("deceit_gain", {}).items():
            if gain > 0:
                self.deceit[f] += gain
        # 진실이 드러나는 길: 검증 결의 카드, 국가 교차 확인, 은폐 유출
        org = report["card_org"]
        if org.get("honest") == "supply":
            news += self.expose("merchant", 1.0, "상단 회계사가 보급부 장부를 들여다봤습니다")
        if org.get("cross_exact"):
            news += self.expose("state", 1.0, "국가 감찰관이 탐사 기록을 확인했습니다")
        if org.get("reveal"):
            news += self.expose("church", 1.0, "고해성사로 인사부의 속사정이 교회에 전해졌습니다")
        told = self.seen_now.get("dead")
        if told is not None and report["true"]["deaths"] >= 1 and told < report["true"]["deaths"] * 0.7:
            if g.rng.random() < self.p["cross_expose"]:
                news += self.expose("church", 1.0, "국가 사망자 집계가 교회에 전해졌습니다")
        for rec in list(self.hidden):
            rec["chance"] += self.p["leak_step"]
            if g.rng.random() < rec["chance"]:
                self.hidden.remove(rec)
                news += self.expose(rec["faction"], 2.0, "은폐했던 허위 보고가 새어 나갔습니다")
        # 감사 적발 → 다음 이사회에서 공개/은폐 결정
        self.pending_disclosure = sorted(report["caught"])
        # 경계도
        self.update_vigilance(report, rep_gain)
        for f in FACTIONS:
            band = int(self.vigilance[f] >= 30) + int(self.vigilance[f] >= self.p["sanction_at"]) + int(self.vigilance[f] >= self.p["severe_at"])
            if band:
                news.append(self.p["rumors"][f][band - 1])
        # 공 돌리기
        if self.give_credit:
            for r in h["requests"]:
                if r["done"]:
                    f = r["request"]["faction"]
                    st.reputation = max(0.0, st.reputation - self.p["give_credit_rep"])
                    self.vigilance[f] = clamp(self.vigilance[f] + self.p["give_credit_vigilance"], 0, 100)
                    news.append(f"의뢰 성공의 공을 {FACTION_KO[f]}에 돌렸습니다. {FACTION_KO[f]}이(가) 흡족해합니다.")
        self.give_credit = False
        # 빚 청구
        self.demands = []
        for f in FACTIONS:
            if not self.debts[f]:
                continue
            age = st.month - self.debts[f][0]["month"]
            p = self.p["collect_base"] + self.p["collect_per_month"] * age
            if (f == "state" and any(w["unlocked"] for w in h["weeks"])) or (f == "merchant" and st.gold > 60000) or \
               (f == "church" and report["true"]["deaths"] >= 3):
                p += self.p["collect_trigger"]
            if g.rng.random() < p:
                self.demands.append(f)
        self.favor_now = set()
        self.news = news
        return news

    def update_vigilance(self, report: dict, rep_gain: float) -> None:
        g, h = self.guild, report["engine"]
        v = self.vigilance
        for f in FACTIONS:
            v[f] -= self.p["vigilance_decay"]
        profit = report["reported"]["supply_profit"]
        if profit > 15000:
            v["merchant"] += min(8.0, (profit - 15000) / 2500)
        loot = h.get("loot_value", 0.0)
        if self.last_loot and loot > self.last_loot * 1.3:
            v["merchant"] += 4
        self.last_loot = loot
        hr = report["details"]["hr"]["true"]
        if hr["end"] - hr["start"] > 8:
            v["church"] += 5
        if g.healers == 0 and hr["end"] > 20 and report["reported"]["injured"] / max(hr["end"], 1) < 0.05:
            v["church"] += 3
        if rep_gain > 150:
            v["state"] += 4
        if any(w["unlocked"] for w in h["weeks"]):
            v["state"] += 8
        if self.seen_now.get("success", self.seen_now["rate_true"]) >= 0.9:
            v["state"] += 3
        for f in FACTIONS:
            v[f] = clamp(v[f], 0, 100)

    def expose(self, f: str, mult: float, why: str) -> list[str]:
        """기만 판정: 포장으로 얻은 우호도를 한 번에 회수하고 추가로 −15, 경계도 +20."""
        if self.deceit[f] <= 0.5:
            return []
        hit = (self.deceit[f] + self.p["deceit_penalty"]) * mult
        self.guild.game.apply_gauges({f: -hit})
        self.vigilance[f] = clamp(self.vigilance[f] + self.p["deceit_vigilance"] * min(mult, 1.0), 0, 100)
        self.deceit[f] = 0.0
        return [f"{why}. 길드가 숫자를 속였다는 말이 {FACTION_KO[f]}에 돕니다. ({FACTION_KO[f]} 우호도 −{hit:.0f})"]

    # ------------------------------------------------------------ 이사회 결정
    def disclose(self, dept: str, public: bool) -> str:
        """감사 적발 처리. 공개 징계 = 부서장 교체 + 관련 세력에 진실 공개(절반). 은폐 = 유출 위험을 안고 간다."""
        f = RELATED[dept]
        if public:
            self.guild.fire(dept)
            lines = self.expose(f, 0.5, "이사회가 허위 보고를 공개하고 부서장을 징계했습니다")
            return " ".join(lines) or "공개 징계했어요. 길드가 스스로 바로잡았다는 소문이 돕니다."
        self.hidden.append({"faction": f, "chance": 0.0})
        return "은폐했어요. 세력은 당장 모르지만, 새어 나갈 위험이 매달 쌓여요."

    def answer_demand(self, f: str, accept: bool) -> str:
        g, st = self.guild, self.guild.game.state
        d = self.p["demands"][f]
        if not accept:
            g.game.apply_gauges({f: self.p["refuse_gauge"]})
            return f"{FACTION_KO[f]}의 요구를 거절했어요. 우호도 {self.p['refuse_gauge']}, 빚은 그대로예요."
        if d.get("gold"):
            g.add_cost(f"{FACTION_KO[f]} 요구 이행", d["gold"])
        if d.get("gauges"):
            g.game.apply_gauges(d["gauges"])
        if d.get("members"):
            st.members = max(0, st.members + int(d["members"]))
        self.debts[f].pop(0)
        return f"{FACTION_KO[f]}의 요구({d['text']})에 응했어요. 빚 1장을 갚았어요."
