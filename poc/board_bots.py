"""이사회 모드 봇: play.py에서 사람이 하는 결정(층 승인 · KPI · 감사 · 교체 · 정치 · 의뢰 · 결의 카드)을 자동으로 한다.

    py board_bots.py                 # 모든 봇 200판씩, 요약 표
    py board_bots.py -n 500 -b tuned # 특정 봇만
    py board_bots.py --trace tuned   # 한 판을 월별로 출력

봇은 사람과 같은 정보만 쓴다: 금고 · 세력 우호도 · 부서 보고값 (감사한 부서는 실제값).
"""
from __future__ import annotations

import argparse
import statistics as stats

import agenda
from org import DEPTS, Guild, Slot
from sim import FACTION_KO, FACTIONS, Game, load_params

RESULT_KO = {"win": "승리", "collapse": "세력 붕괴", "deficit": "금고 바닥", "bankrupt": "파산", "timeout": "시간 초과"}
POLITICS_FOR = {"merchant": "banquet", "church": "offering", "state": "lobby"}


class BoardBot:
    """아무것도 안 하는 이사회: 기본 KPI 그대로, 층 승인만, 결의는 '중립 유지'."""

    name = "passive"

    def __init__(self, guild: Guild):
        self.guild = guild
        self.g = guild.game

    def month(self) -> tuple[int, list[int]]:
        g = self.guild
        for dept in g.dip.pending_disclosure:  # 감사 적발 처리
            g.dip.disclose(dept, self.disclose_public(dept))
        g.dip.pending_disclosure = []
        for f in g.dip.demands:  # 빚 청구
            g.dip.answer_demand(f, self.accept_demand(f))
        g.dip.demands = []
        if g.floor_proposal():
            g.approve_floor(g.floor_proposal())
        if g.assault_ready():
            g.assault = self.approve_assault()
        for pr in agenda.proposals(g):
            if self.accept(pr):
                agenda.apply_proposal(g, pr)
        self.board()
        self.politics()
        reqs = self.requests()
        return self.card(), reqs

    def board(self) -> None:
        pass

    def draft(self) -> None:
        """창립 이사회: 후보 중 첫 번째를 임명한다 (아무 생각 없이)."""
        for d, cands in self.guild.founding_candidates().items():
            self.guild.appoint(d, cands[0])

    def accept(self, pr: agenda.Proposal) -> bool:
        return False

    def disclose_public(self, dept: str) -> bool:
        return False  # 아무 생각 없는 이사회는 덮는다

    def accept_demand(self, f: str) -> bool:
        return True

    def field(self, ev: agenda.Event) -> int:
        """현장 판단. 0 = 탐사부 뜻대로."""
        return 0

    def approve_assault(self) -> bool:
        """보고된 추정 성공률만 보고 결정한다."""
        claimed, _ = self.guild.assault_estimate()
        return claimed >= 0.7 and self.g.state.members >= self.g.p["rules"]["win_min_members"] + 3

    def politics(self) -> None:
        pass

    def requests(self) -> list[int]:
        return []

    def card(self) -> int:
        names = [c["name"] for c in self.g.cards()]
        return names.index("중립 유지") if "중립 유지" in names else 0

    def seen(self, metric: str) -> float | None:
        """지난달 보고서에서 이사회가 본 값 (감사했으면 실제값)."""
        if not self.guild.reports:
            return None
        rep = self.guild.reports[-1]
        dept = next(d for d, sl in rep["kpis"].items() for s in sl if self.guild.kpi_def(s.kpi)["metric"] == metric) \
            if any(self.guild.kpi_def(s.kpi)["metric"] == metric for sl in rep["kpis"].values() for s in sl) else None
        return rep["true"][metric] if dept in rep["audited"] else rep["reported"][metric]


class Politician(BoardBot):
    """기본 KPI + 정치: 가장 낮은 세력을 챙기고, 그 세력을 올리는 결의 카드를 고른다."""

    name = "politician"

    def politics(self) -> None:
        g, st = self.guild, self.g.state
        for _ in range(2):
            low = sorted(FACTIONS, key=lambda f: st.gauges[f])
            for f in low:
                if st.gauges[f] >= 25:
                    return
                key = POLITICS_FOR[f]
                if g.can_do_politics(key) is None and (key == "lobby" or st.gold > 8000):
                    g.do_politics(key)
                    break
            else:
                return

    def card(self) -> int:
        st = self.g.state
        best, idx = None, super().card()
        for i, c in enumerate(self.g.cards()):
            d = self.g.gauge_deltas(c.get("gauges", {}))
            score = sum(v * (2.0 if st.gauges[f] < 0 else 1.0) for f, v in d.items()) + c.get("gold", 0) / 1000
            if best is None or score > best:
                best, idx = score, i
        return idx


class Tuned(Politician):
    """사람이 할 법한 운영: 인원과 인건비를 같이 묶고, 층 허가가 막히면 국가부터 챙기고, 의뢰를 받고, 감사한다."""

    name = "tuned"

    def board(self) -> None:
        g, st = self.guild, self.g.state
        floor = g.approved_floor
        g.kpis["explore"] = [Slot("progress", 0.25), Slot("deaths", 1.5 + 0.2 * floor)]
        if self.floor_locked() or min(st.gauges.values()) < -10:  # 세력 협력 요청이 우호도를 갉아먹는다
            g.kpis["explore"][1] = Slot("help_limit", 12)
        # 지나온 층 중 지도가 엉성한 곳을 다지게 한다 (그 층 매장 손님이 는다)
        past = [f for f in g.outposts if f < floor and st.understanding[f] < 0.85]
        if past:
            f = min(past, key=lambda x: st.understanding[x])
            g.kpis["explore"].append(Slot("floor_und", 0.9, f))
        # 인원은 금고 사정에 맞춰 조금씩: 지난달 금고가 줄었으면 인원을 늘리지 않는다
        cash = self.guild.reports[-1]["cash"] if self.guild.reports else 0
        grow = 8 if cash > 0 else 0
        head = min(60, max(15, st.members + grow))
        g.kpis["hr"] = [Slot("ready", round(head * 0.92, 1)), Slot("left", max(2.0, round(st.members * 0.08, 1)))]
        if floor >= 8:  # 깊은 층: 보수를 올려 고급 인력을 부른다 (월급은 이사회가 지급)
            g.pay = "고"
            g.kpis["hr"][0] = Slot("ready", max(52.0, round(head * 0.92, 1)))
        gear = 0 if floor <= 2 else (1 if floor <= 6 else 2)
        g.kpis["supply"] = [Slot("maint", 1.0), Slot("gear", gear)]
        # 감사: 3개월마다 탐사부. 약속을 자주 어기거나 적발되면 교체
        g.audits = {"explore"} if st.month % 3 == 2 else set()
        self.manage_heads()
        self.allocate()

    def allocate(self) -> None:
        """예산: 요청을 받고, 인사부는 지난달 수입에 맞춰 상한을 둔다 (인원 욕심이 금고를 넘지 않게)."""
        g = self.guild
        g.make_budget_requests()
        # 요청에는 성향만큼 거품이 있다: 공격형은 15%, 균형형은 8%, 신중형은 3% 깎는다
        cut = {"공격형": 0.85, "균형형": 0.92, "신중형": 0.97}
        for d in g.budget:
            g.budget[d] = round(g.budget[d] * cut[g.heads[d].aggression], -2)
        # 적자가 이어지는데 금고가 얇으면 인사부 예산을 10% 깎는다 (그만큼 증원을 멈춘다)
        if g.reports and g.reports[-1]["cash"] < 0 and self.g.state.gold < 20000:
            g.budget["hr"] = round(g.budget["hr"] * 0.9, -2)

    def floor_locked(self) -> bool:
        g, st = self.g, self.g.state
        nxt = self.guild.approved_floor + 1
        req = g.p["dungeon"]["floor_state_level_required"]
        return nxt < len(req) and st.levels["state"] < req[nxt]

    def disclose_public(self, dept: str) -> bool:
        return True  # 공개 징계: 부서장을 바꾸고 절반만 맞는다

    def accept_demand(self, f: str) -> bool:
        return f != "merchant" or self.guild.board_treasury() > 8000 or self.g.state.gold > 20000

    def politics(self) -> None:
        g, st = self.guild, self.g.state
        need = self.g.p["factions"]["level_gauge_required"]
        g.dip.give_credit = max(g.dip.vigilance.values()) >= 50  # 경계가 심하면 공을 세력에 돌린다
        if self.floor_locked() and st.gauges["state"] < need and len(g.dip.debts["state"]) < 2 and g.dip.can_ask("state") is None:
            g.dip.ask("state")  # 국가에 부탁: 층 허가 우호도 조건 면제 (빚 1장)
        for _ in range(2):
            if self.floor_locked() and st.gauges["state"] < need + 5 and g.can_do_politics("lobby") is None:
                g.do_politics("lobby")
                continue
            f = min(FACTIONS, key=lambda x: st.gauges[x])
            if st.gauges[f] >= 0:
                return
            key = POLITICS_FOR[f]
            if key != "lobby" and st.gold < 20000:
                key = "mediate"
            if g.can_do_politics(key) is not None:
                return
            g.do_politics(key)

    def requests(self) -> list[int]:
        free = self.guild.explore_slots_free()
        out = []
        for i, r in enumerate(self.g.requests()):
            if len(out) >= free:
                break
            c = r["condition"]
            if c["type"] in ("seize", "weeks") or (c["type"] == "unlock" and self.guild.floor_proposal() is None):
                out.append(i)
        return out


    def field(self, ev: agenda.Event) -> int:
        """예상치를 보고 고른다: 성공률이 5%p 넘게 오르거나, 손실이 크게 줄 때만 탐사부 계획을 뒤집는다."""
        base = ev.options[0][1].get("_est")
        if not base:
            return 0
        best, pick = 0.0, 0
        for i, (_, act) in enumerate(ev.options[1:], 1):
            est = act.get("_est")
            if not est:
                continue
            gain = (est[0] - base[0]) - 0.03 * (est[1] - base[1])
            if gain > max(best, 0.05):
                best, pick = gain, i
        return pick

    @staticmethod
    def pick(cands: list) -> object:
        """후보 이력서의 특성을 보고 고른다. 나쁜 조합(겁쟁이, 상단 연줄, 구두쇠)은 피한다."""
        bad = {"timid", "connected", "miser"}
        good = {"field", "scholar", "principled", "watchdog", "devout", "frugal", "ties_state"}
        score = lambda h: sum(1 for t in h.known if t in good) - 2 * sum(1 for t in h.known if t in bad)  # noqa: E731
        return max(cands, key=score)

    def draft(self) -> None:
        for d, cands in self.guild.founding_candidates().items():
            self.guild.appoint(d, self.pick(cands))

    def hire(self, dept: str) -> None:
        self.guild.fire(dept, self.pick(self.guild.candidates(dept)))

    def manage_heads(self) -> None:
        g = self.guild
        for d, h in g.heads.items():
            broken = h.promises[-4:].count(False)
            if h.caught >= 2 or (h.revealed and h.honesty > 0.75) or broken >= 3:
                self.hire(d)
            elif d == "explore" and "timid" in h.known and g.approved_floor >= 8:
                self.hire(d)
            elif d == "supply" and "connected" in h.known and self.g.state.month >= 6:
                self.hire(d)


class Sleuth(Tuned):
    """tuned + 층의 비밀 추리: 단서에 표를 매겨(확실 2표, 추측 1표) 가장 유력한 공식을 지침으로 걸고,
    한 달 걸어도 발견되지 않은 공식은 후보에서 지운다. 단서 문장이 가리키는 공식은 알지만, 그 단서가 참인지는 모른다."""

    name = "sleuth"

    def __init__(self, guild: Guild):
        super().__init__(guild)
        self.tried: dict[int, set] = {}
        self.last: dict[int, list] = {}

    def board(self) -> None:
        super().board()
        g, st = self.guild, self.g.state
        floor = self.g.allowed_floor(g.approved_floor)
        found = {f"{s['kind']}:{s['key']}" for i, s in enumerate(st.secrets.get(floor, [])) if (floor, i) in st.secret_found}
        tried = self.tried.setdefault(floor, set())
        tried.update(k for k in self.last.get(floor, []) if k not in found)  # 걸어 봤는데 안 통한 공식
        votes: dict[str, int] = {}
        for cl in g.clues.get(floor, []):
            votes[cl["key"]] = votes.get(cl["key"], 0) + (2 if cl["sure"] else 1)
        d = {"gear_type": "none", "formation": "balanced", "prep": None}
        field_of = {"gear": "gear_type", "formation": "formation", "prep": "prep"}
        chosen = []
        for kind, fld in field_of.items():
            keep = [k for k in found if k.startswith(kind + ":")]
            if keep:
                d[fld] = keep[0].split(":")[1]
                continue
            cands = sorted(((v, k) for k, v in votes.items() if k.startswith(kind + ":") and k not in tried and k not in found), reverse=True)
            if cands and cands[0][0] >= 2:
                d[fld] = cands[0][1].split(":")[1]
                chosen.append(cands[0][1])
        g.directives[floor] = d
        self.last[floor] = chosen


class Listener(BoardBot):
    """KPI를 직접 만지지 않고 부서장 안건만 모두 승인한다. 현장 판단은 탐사부에 맡긴다."""

    name = "listener"

    def accept(self, pr: agenda.Proposal) -> bool:
        return pr.action["type"] != "audit" or self.g.state.gold > 10000


class Reader(Tuned):
    """사람을 읽는 이사회: KPI 메뉴를 직접 만지지 않고, 안건을 골라 승인한다.
    이기적인 제안(사망자 상한 풀기, 적자 중 증원, 마진 인상)과 신뢰가 무너진 부서장의 제안은 거절한다.
    정치 · 현장 판단 · 부서장 교체는 tuned와 같다."""

    name = "reader"

    def board(self) -> None:
        g, st = self.guild, self.g.state
        g.audits = {"explore"} if st.month % 3 == 2 else set()
        self.manage_heads()
        self.allocate()

    def accept(self, pr: agenda.Proposal) -> bool:
        a = pr.action
        h = self.guild.heads[pr.dept]
        if h.promises[-4:].count(False) >= 2:
            return False
        cash = self.guild.reports[-1]["cash"] if self.guild.reports else 0
        if a["type"] == "remove_kpi" and a["kpi"] == "deaths":
            return False
        if a.get("kpi") == "ready" and cash < 0:
            return False
        if a["type"] == "pay" and cash < 0 and a["tier"] != "저":
            return False
        if a.get("kpi") == "supply_profit":
            return False
        if a["type"] == "audit":
            return self.g.state.gold > 8000
        return True


BOTS = {b.name: b for b in (BoardBot, Politician, Listener, Tuned, Reader, Sleuth)}


def play(bot_cls, params: dict, seed: int, log: list | None = None) -> Guild:
    game = Game(params, seed=seed)
    guild = Guild(game, seed=seed)
    bot = bot_cls(guild)
    bot.draft()
    while not game.state.over:
        card, reqs = bot.month()
        guild.start_month(card, reqs)
        while game.state.week < game.weeks and not game.state.over and not guild.halted:
            rec = guild.run_week()
            for ev in agenda.field_events(guild, rec):
                if ev.options:
                    agenda.apply_choice(guild, ev.options[bot.field(ev)][1])
        rep = guild.end_month()
        if log is not None:
            log.append(rep)
    return guild


def summarize(name: str, guilds: list[Guild]) -> dict:
    gs = [x.game for x in guilds]
    res = [g.state.result for g in gs]
    wins = [g.state.month for g in gs if g.state.result == "win"]
    col = [f for g in gs for f in g.state.collapsed]
    return {
        "bot": name,
        **{k: res.count(k) / len(gs) for k in RESULT_KO},
        "win_month": stats.mean(wins) if wins else None,
        "months": stats.mean(g.state.month for g in gs),
        "floor": stats.mean(g.state.max_unlocked for g in gs),
        "members": stats.mean(g.state.members for g in gs),
        "collapsed_by": {FACTION_KO[f]: col.count(f) for f in FACTIONS},
    }


def trace(name: str, params: dict, seed: int) -> None:
    log: list = []
    guild = play(BOTS[name], params, seed, log)
    st = guild.game.state
    print(f"[{name}] seed={seed} → {RESULT_KO.get(st.result, st.result)} ({st.month}개월)")
    print(f"{'월':>3}{'층':>3}{'인원':>6}{'금고변화':>9}{'금고':>9}{'세금':>7}{'사망':>6}  {'상단':>4}{'교회':>5}{'국가':>5}  의뢰")
    for rep in log:
        h = rep["engine"]
        gg = h["gauges"]
        print(
            f"{rep['month']:>3}{h['floor']:>3}{h['members']:>6.1f}{rep['cash']:>9,.0f}{h['gold']:>9,.0f}"
            f"{h['expense'].get('국가 세금', 0):>7,.0f}{rep['true']['deaths']:>6.1f}  "
            f"{gg['merchant']:>4.0f}{gg['church']:>5.0f}{gg['state']:>5.0f}  {', '.join(rep['requests'])}"
        )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("-n", type=int, default=200)
    ap.add_argument("-b", "--bot")
    ap.add_argument("-p", "--params")
    ap.add_argument("--trace")
    ap.add_argument("--seed", type=int, default=1)
    args = ap.parse_args()
    params = load_params(args.params)
    if args.trace:
        trace(args.trace, params, args.seed)
        return
    names = [args.bot] if args.bot else list(BOTS)
    print(f"{'봇':<12}{'승리':>7}{'붕괴':>7}{'적자':>7}{'시간초과':>9}{'승리월':>7}{'평균월':>7}{'도달층':>7}{'인원':>6}  붕괴 세력")
    for n in names:
        r = summarize(n, [play(BOTS[n], params, s) for s in range(args.n)])
        wm = f"{r['win_month']:.1f}" if r["win_month"] else "-"
        print(
            f"{n:<12}{r['win']:>7.0%}{r['collapse']:>7.0%}{r['deficit']:>7.0%}{r['timeout']:>9.0%}{wm:>7}"
            f"{r['months']:>7.1f}{r['floor']:>7.1f}{r['members']:>6.1f}  {r['collapsed_by']}"
        )


if __name__ == "__main__":
    main()
