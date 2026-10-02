"""이사회로 한 판 플레이하기 (조항 설계 + 불완전한 보고서).

    python play.py              # 무작위 시드
    python play.py --seed 3     # 같은 판 다시 하기
    python play.py --no-color   # 색상 코드가 글자로 보일 때

월초 이사회: 지난달 보고서 검토 → (k) 조항 편집 · (g) 감사 지정 · (f) 부서장 교체
            → 정치 협상 (세력 관계 = 소모품 가격·힐러 고용비·세율) → 의뢰 수락 (탐사부 조항 슬롯 차지) → 이사회 결의 카드
4주 자동 진행: 탐사부가 조항대로 움직이고 매주 보고한다. 이상 징후가 보고되면 멈춘다.

금고와 세력 우호도만 진짜 숫자다. 부서 보고는 부서장 성향과 조항 압박만큼 틀릴 수 있다.
q = 종료.
"""
from __future__ import annotations

import argparse

import ui
import agenda
from org import DEPTS, GEAR_TIERS, PAY_TIERS, Guild, Slot
from play_weekly import STANDING_COLOR, STANDING_KO, gauge_rows, show_finding, understanding_rows
from sim import FACTION_KO, Game, load_params, weighted_avg

WIDTH = 78


class Quit(Exception):
    pass


def prompt(label: str) -> str:
    raw = input(f"  {label}: ").strip()
    if raw == "q":
        raise Quit
    return raw


def fmt_value(kdef: dict, v: float) -> str:
    if kdef["metric"] == "gear_tier":
        return GEAR_TIERS[int(round(v))].capitalize()
    if kdef["metric"] == "grade_tier":
        return "저중고"[int(round(v))] + " 보수"
    if kdef["unit"] == "명" and abs(v - round(v)) < 1e-9:
        return f"{v:.0f}명"
    return f"{v:{kdef['fmt']}}{kdef['unit']}"


def clause_name(kdef: dict, floor: int | None = None) -> str:
    return f"{floor}층 이해도" if kdef["metric"] == "floor_und" and floor else kdef["name"]


def kpi_text(kdef: dict, target: float, floor: int | None = None) -> str:
    sign = "≥" if kdef["dir"] == "min" else "≤"
    return f"{clause_name(kdef, floor)} {sign} {fmt_value(kdef, target)}"


def achieved(kdef: dict, value: float, target: float) -> bool:
    return value >= target if kdef["dir"] == "min" else value <= target


# ------------------------------------------------------------------ 이사회 화면
def dashboard(guild: Guild) -> None:
    g, st, r = guild.game, guild.game.state, guild.game.p["rules"]
    print("\n" + "═" * WIDTH)
    limit = r["deficit_game_over_months"]
    streak = ui.c("■" * st.deficit_streak, ui.RED) + ui.c("□" * (limit - st.deficit_streak), ui.DIM)
    print(
        f" {ui.c(f'{st.month + 1}월 이사회', ui.BOLD)}   금고 {st.gold:,.0f}G   명성 {st.reputation:.0f}   "
        f"금고 바닥 {streak}   탐사 승인 층 {guild.approved_floor}층"
    )
    print("─" * WIDTH)
    prev = st.history[-2]["gauges"] if len(st.history) >= 2 else None
    gauge_rows(g, prev)
    print("─" * WIDTH)
    understanding_rows(g)


def kpi_marks(guild: Guild, rep: dict, dept: str) -> str:
    audited = dept in rep["audited"]
    src = rep["true"] if audited else rep["reported"]
    out = []
    for sl in rep["kpis"][dept]:
        kd = guild.kpi_def(sl.kpi)
        v = guild.slot_value(src, sl)
        ok = achieved(kd, v, sl.target)
        mark = ui.c("✔", ui.GREEN) if ok else ui.c("✘", ui.RED)
        out.append(f"{mark} {clause_name(kd, sl.floor)} {fmt_value(kd, v)} (목표 {fmt_value(kd, sl.target)} · {sl.level})")
    return " · ".join(out) or ui.c("조항 없음", ui.DIM)


def promise_text(guild: Guild, pr: dict) -> str:
    kd = guild.kpi_def(pr["kpi"])
    name = clause_name(kd, pr.get("floor"))
    if pr["say"] == "achieve":
        return f"{name} 목표({fmt_value(kd, pr['target'])}) 달성하겠습니다"
    return f"{name} 목표는 어렵습니다. {fmt_value(kd, pr['forecast'])} 정도 예상합니다"


def board_report(guild: Guild) -> None:
    if not guild.reports:
        print(ui.c(" 아직 보고서가 없어요. 첫 달이에요.", ui.DIM))
        return
    rep = guild.reports[-1]
    h = rep["engine"]
    print("─" * WIDTH)
    cash_color = ui.GREEN if rep["cash"] >= 0 else ui.RED
    tax = h["expense"].get("국가 세금", 0.0)
    print(
        ui.c(f" {rep['month']}월 보고", ui.BOLD)
        + "   금고 실제 변화 "
        + ui.c(f"{rep['cash']:+,.0f}G", cash_color + ui.BOLD)
        + ui.c(f"  ← 이 숫자만은 진짜 (세금 {tax:,.0f}G, 세율 {h['tax_rate']:.0%} 포함)", ui.DIM)
    )
    # 비서: 무엇을 비교해 볼지만 짚는다
    for line in agenda.secretary(guild, rep):
        print(ui.c(f"   🗒 비서: \"{line}\"", ui.CYAN + ui.BOLD))
    # 부서장 브리핑
    for dept in DEPTS:
        head = guild.heads[dept]
        print(f"   {DEPTS[dept]}장 {head.name}: \"{agenda.briefing(guild, rep, dept)}\"")
        print(f"      {kpi_marks(guild, rep, dept)}")
        con = rep["contract"]
        if con["bonus"].get(dept):
            print(ui.c(f"      → 성과급 {con['bonus'][dept]:,}G (다음 달 이사회 금고에서)", ui.DIM))
        if dept in con["breach"]:
            print(ui.c(f"      ⚠ {guild.miss_streak[dept]}달 연속 미달: 계약 위반이에요. 퇴직금 없이 교체할 수 있어요 (f).", ui.YELLOW))
        for d, old, new in con["resigned"]:
            if d == dept:
                print(ui.c(f"      ✉ {DEPTS[d]}장 {old}이(가) 계속된 미달 끝에 사표를 냈어요. 새 부서장 {new}이(가) 왔어요.", ui.RED))
        if dept == "explore":
            for r in h["requests"]:
                req = r["request"]
                v = ui.c("✔ 의뢰 달성", ui.GREEN) if r["done"] else ui.c("✘ 의뢰 실패", ui.RED)
                print(f"      {v} {FACTION_KO[req['faction']]}·{req['name']}")
    # 감사 결과
    for dept in rep["audited"]:
        head = guild.heads[dept]
        if dept in rep["caught"]:
            print("   " + ui.c(f"🔎 감사: {DEPTS[dept]}장 {head.name}의 허위 보고 적발 (적발 {head.caught}회). 위 {DEPTS[dept]} 조항은 실제값이에요.", ui.RED))
        else:
            print("   " + ui.c(f"🔎 감사: {DEPTS[dept]} 보고는 정확했어요.", ui.GREEN))
    # 약속 장부
    if rep["promises"]:
        print("   지난달 약속")
        for pr in rep["promises"]:
            head = guild.heads[pr["dept"]]
            if pr["say"] == "achieve":
                res = ui.c("✔ 지킴", ui.GREEN) if pr["kept"] else ui.c("✘ 빗나감", ui.RED)
            else:
                res = ui.c("✔ 미리 알림", ui.GREEN) + (ui.c(" (결과는 달성)", ui.DIM) if pr["achieved"] else "")
            print(f"     {DEPTS[pr['dept']]}장 {pr['head']}: \"{promise_text(guild, pr)}\" → {res}   신뢰 {head.trust_text()}")
    # 앞뒤가 안 맞는 곳
    rumors(guild, h)
    for line in rep.get("diplomacy", []) + rep.get("fin_notes", []):
        print(ui.c(f"   · {line}", ui.YELLOW))
    for line in rep.get("sanctions", []):
        print(ui.c(f"   ⚔ {line}", ui.RED))
    for dept, t in rep["revealed"]:
        td, head = guild.o["traits"][t], guild.heads[dept]
        if head.name and t in head.traits:
            print("   " + ui.c(f"💡 {DEPTS[dept]}장 {head.name}: {td['evidence']} → [{td['name']}]", ui.CYAN)
                  + ui.c(f" 장점 {td['pro']} / 단점 {td['con']}", ui.DIM))
    if h["leveled"]:
        print("   " + ui.c("레벨업: " + ", ".join(FACTION_KO[f] for f in h["leveled"]), ui.GREEN))
    if h["unpaid"]:
        print("   " + ui.c("⚠ 금고가 바닥나 월급이 밀렸어요. 모험가 일부가 떠났어요. 3개월 연속이면 게임 오버예요.", ui.RED))
    g = guild.game
    for floor, i in rep["secrets_new"]:
        sec = g.state.secrets[floor][i]
        print("   " + ui.c(f"📜 {floor}층 공략 공식 발견: {guild.secret_label(sec)}", ui.GREEN + ui.BOLD))
    for miss in rep["directive_miss"]:
        print("   " + ui.c(f"✘ 지침이 통하지 않았어요: {miss} (층 기록에 표시했어요)", ui.YELLOW))
    if rep["clues"]:
        print("   📜 이번 달 층 기록")
        for cl in rep["clues"]:
            print(f"     · {cl['floor']}층 \"{cl['text']}\" " + ui.c(f"({'확실' if cl['sure'] else '추측'}, 탐사부장 {cl['head']})", ui.DIM))
    print(ui.c("   (세부 장부는 d, 층 기록과 공략 지침은 p)", ui.DIM))


def rumors(guild: Guild, h: dict) -> None:
    """세력 동향. 우호도가 왜 움직였는지는 숫자 없이 소문으로만 전한다."""
    texts = guild.game.p["rumors"]
    lines = []
    for f, r in h["reactions"].items():
        for key, v in sorted(r["reasons"], key=lambda kv: -abs(kv[1]))[:2]:
            if abs(v) >= 1:
                lines.append(ui.c(f"   · {texts[key]}", ui.GREEN if v > 0 else ui.YELLOW))
    if lines:
        print("   세력 동향")
        for line in lines:
            print(line)


def money(v: float) -> str:
    return f"{v:,.0f}G"


def amount(rep: dict, dept: str, key: str, fmt=money) -> str:
    """보고값. 감사한 부서면 [실제 …]를 붙인다."""
    d = rep["details"][dept]
    shown = fmt(d["reported"][key])
    if dept in rep["audited"]:
        real = d["true"][key]
        gap = abs(d["reported"][key] - real) / max(abs(real), 1)
        color = ui.RED if gap > 0.15 else ui.DIM
        shown += " " + ui.c(f"[실제 {fmt(real)}]", color)
    return shown


def dept_details(guild: Guild, rep: dict) -> None:
    g = guild.game
    people = lambda v: f"{v:.0f}명"  # noqa: E731

    # 탐사부
    ex, ex_t = rep["details"]["explore"]["reported"], rep["details"]["explore"]["true"]
    buy = guild.policy.loot_buy_rate
    mk = g.p["facilities"]["market_sell_mult"]
    floors = ex_t["floors"]
    floor_s = (f"{floors[0]}층" if len(floors) == 1 else f"{floors[0]}~{floors[-1]}층") if floors else "-"
    acts = ", ".join(f"{g.p['activities'][a]['name']} ×{n}" for a, n in ex_t["acts"].most_common()) or "없음"
    gauge = ", ".join(f"{FACTION_KO[f]} −{v:.0f}" for f, v in ex_t["gauge_by_faction"].items()) or "없음"
    print("─" * WIDTH)
    print(ui.c(f" ▣ 탐사부 보고", ui.BOLD) + f" (부서장 {guild.heads['explore'].name})")
    print(f"   탐사 {ex_t['weeks']}주 · 성공 {ex_t['cleared']} · 후퇴 {ex_t['weeks'] - ex_t['cleared']} · {floor_s}")
    print(f"   + 탐험 수수료                                   {amount(rep, 'explore', 'commission')}")
    print(
        f"   + 전리품 차익  가치 {money(ex['loot'])}, {buy:.0%} 매입 → 시장 {mk:.0%} 판매   "
        f"{amount(rep, 'explore', 'margin')}"
    )
    print(f"   − 준비 활동    {acts}")
    print(f"                                                   {amount(rep, 'explore', 'prep_cost')}")
    print(f"   − 위약금       사망 {amount(rep, 'explore', 'deaths', people)} × {g.p['dungeon']['penalty_per_lost_member']}G   {amount(rep, 'explore', 'penalty')}")
    print(f"   = 탐사 순이익                                   {ui.c(amount(rep, 'explore', 'net'), ui.BOLD)}")
    print(
        f"   부상 {amount(rep, 'explore', 'injured', people)} · 이해도 +{ex['progress']:.2f} · "
        f"세력 협력 우호도 사용 {gauge}"
    )

    # 인사부
    hr, hr_t = rep["details"]["hr"]["reported"], rep["details"]["hr"]["true"]
    print(ui.c(f" ▣ 인사부 보고", ui.BOLD) + f" (부서장 {guild.heads['hr'].name})")
    prev = rep["prev_headcount"]
    prev_s = ui.c(f"  (지난달 보고한 월말 인원 {prev:.0f}명)", ui.DIM) if prev is not None else ""
    print(f"   월초 {hr_t['start']:.0f}명{prev_s}")
    print(
        f"   − 이탈 {amount(rep, 'hr', 'left', people)} · − 사망 {amount(rep, 'hr', 'deaths', people)} · "
        f"+ 모집 {amount(rep, 'hr', 'recruited', people)} → 월말 {ui.c(amount(rep, 'hr', 'end', people), ui.BOLD)}"
    )
    print(f"   월말 출전 가능 {ui.c(amount(rep, 'hr', 'ready', people), ui.BOLD)} (요양 {amount(rep, 'hr', 'injured', people)})")
    print(f"   − 홍보비(모집)                                  {amount(rep, 'hr', 'promo')}")
    print(f"   − 힐러 고용    {hr_t['healers']}명 × {hr_t['healer_wage']:,.0f}G                 {amount(rep, 'hr', 'healer_cost')}")
    print(f"   − 처우비       1인 {hr_t['care']:.0f}G                              {amount(rep, 'hr', 'care_cost')}")
    per_head = hr_t["salary"] * hr_t["wage_mult"]
    print(ui.c(f"   (이사회 지급) 월급  보수 {hr_t['pay']} 1인 {per_head:,.0f}G · {hr_t['salary_cost']:,.0f}G = {hr_t['salary_cost'] / max(per_head, 1):.0f}명분", ui.DIM))

    # 보급부
    sp, sp_t = rep["details"]["supply"]["reported"], rep["details"]["supply"]["true"]
    print(ui.c(f" ▣ 보급부 보고", ui.BOLD) + f" (부서장 {guild.heads['supply'].name})")
    pu = sp["potion_cost"] / sp["potion_qty"] if sp["potion_qty"] else 0
    gu = sp["gear_cost"] / sp["gear_qty"] if sp["gear_qty"] else 0
    deal = f", 상단 가격 ×{sp_t['supply_mult']:.2f}" if abs(sp_t["supply_mult"] - 1) > 1e-9 else ""
    potion_market = ui.c(f"(시세 {sp_t['potion_market']}G{deal})", ui.DIM)
    gear_market = ui.c(f"(시세 {sp_t['gear_market']}G{deal})", ui.DIM)
    print(
        f"   물약 {sp['potion_qty']}개 × {pu:,.1f}G {potion_market}"
        f" = 구매 {amount(rep, 'supply', 'potion_cost')} → 판매 {amount(rep, 'supply', 'potion_income')}"
    )
    print(
        f"   장비 {sp['gear'].capitalize()} {sp['gear_qty']}개 × {gu:,.1f}G {gear_market}"
        f" = 구매 {amount(rep, 'supply', 'gear_cost')} → 판매 {amount(rep, 'supply', 'gear_income')}"
    )
    print(
        f"   판매가  물약 {sp_t['potion_price']}G (기준 {sp_t['potion_ref']}G) · 장비 {sp_t['gear_price']}G (기준 {sp_t['gear_ref']}G)"
        f" · 마진 +{sp_t['markup']:.0%}"
    )
    print(f"   전초기지 매장 (일반 모험가 상대, 물량 {sp_t['stock']:.0%})")
    for f, st_f in sorted(sp_t["store_floors"].items()):
        camp = sp["camps"].get(f, "정상")
        camp_s = ui.c(camp, ui.GREEN if camp == "정상" else ui.YELLOW)
        audit = ""
        if "supply" in rep["audited"] and sp_t["camps"].get(f) != camp:
            audit = ui.c(f" [실제 {sp_t['camps'][f]}]", ui.RED)
        print(f"     {f}층 캠프 {camp_s}{audit} · 손님 {st_f['visitors']:.0f}명 · 이해도 {g.state.understanding[f]:.2f}")
    print(f"   + 매장 판매                                     {amount(rep, 'supply', 'store_income')}")
    print(f"   − 매장 물품 구매                                {amount(rep, 'supply', 'store_cost')}")
    print(f"   − 캠프 유지비 (보급 손익에는 안 들어감)          {amount(rep, 'supply', 'upkeep')}")
    net = sp["potion_income"] + sp["gear_income"] + sp["store_income"] - sp["potion_cost"] - sp["gear_cost"] - sp["store_cost"]
    print(f"   = 보급 손익 {ui.c(f'{net:+,.0f}G', ui.BOLD)}")

    # 예산 집행 (부서 보고. 모두 포장될 수 있다)
    b_r, b_t = rep["budget"]["reported"], rep["budget"]["true"]
    print(ui.c(" ▣ 예산 집행", ui.BOLD) + ui.c("  (부서가 보고한 값)", ui.DIM))
    for d in DEPTS:
        if d not in b_r["budget"]:
            continue
        line = (f"   {DEPTS[d]}  요청 {b_r['requested'].get(d, 0):,.0f}G · 배정 {b_r['budget'][d]:,.0f}G · "
                f"집행 {b_r['spent'][d]:,.0f}G")
        if d in rep["audited"]:
            line += ui.c(f" [실제 필요 지출 {b_t['spent'][d]:,.0f}G", ui.RED if b_t["waste"].get(d, 0) > 0 else ui.DIM)
            if b_t["embezzled"].get(d, 0) > 0:
                line += ui.c(f", 착복 {b_t['embezzled'][d]:,.0f}G", ui.RED + ui.BOLD)
            line += ui.c("]", ui.DIM)
        print(line)
    if b_r["credit"].get("merchant", 0) > 0:
        print(f"   상단 외상 잔액 {b_r['credit']['merchant']:,.0f}G " + ui.c("(다음 달 보급부 예산에서 먼저 갚아요)", ui.DIM))


def trait_tags(guild: Guild, head) -> str:
    known = [guild.trait_name(t) for t in head.traits if t in head.known]
    hidden = len(head.traits) - len(known)
    tags = [ui.c(f"[{n}]", ui.CYAN) for n in known] + [ui.c("[?]", ui.DIM)] * hidden
    return " ".join(tags)


def heads_rows(guild: Guild) -> None:
    print("─" * WIDTH)
    print(" 부서장")
    for dept, head in guild.heads.items():
        slots = guild.kpis[dept]
        n = guild.o["slots"][dept]
        k = " / ".join(kpi_text(guild.kpi_def(s.kpi), s.target, s.floor) + ui.c(f" [{guild.level_of(dept, s)}]", ui.DIM)
                       for s in slots) or ui.c("조항 없음", ui.DIM)
        if guild.breach(dept):
            k += ui.c(f"  ⚠ {guild.miss_streak[dept]}달 연속 미달 (계약 위반: 퇴직금 없이 교체 가능)", ui.YELLOW)
        audit = ui.c(" [이번 달 감사]", ui.YELLOW) if dept in guild.audits else ""
        honest = head.honesty_label()
        honest_s = "" if honest == "미확인" else f" · 정직도 {ui.c(honest, ui.RED if honest == '과장' else ui.GREEN)}"
        print(f"   {DEPTS[dept]} {head.name} ({head.aggression}) {trait_tags(guild, head)}  신뢰 {head.trust_text()}{honest_s}{audit}")
        for t in head.traits:
            if t in head.known:
                td = guild.o["traits"][t]
                print(ui.c(f"      {td['name']}: 장점 {td['pro']} / 단점 {td['con']}", ui.DIM))
        print(f"      조항 {len(slots)}/{n}: {k}")


# ------------------------------------------------------------------ 이사회 결정
def edit_kpis(guild: Guild, only: str | None = None) -> None:
    depts = list(DEPTS)
    while True:
        if only:
            dept = only
        else:
            raw = prompt("조항을 바꿀 부서 (1 탐사부 · 2 인사부 · 3 보급부, Enter = 끝)")
            if raw == "":
                return
            if raw not in ("1", "2", "3"):
                continue
            dept = depts[int(raw) - 1]
        slots, n = guild.kpis[dept], guild.o["slots"][dept]
        print(f"  {DEPTS[dept]} 조항 슬롯")
        for i in range(n):
            text = kpi_text(guild.kpi_def(slots[i].kpi), slots[i].target, slots[i].floor) if i < len(slots) else ui.c("(비어 있음)", ui.DIM)
            print(f"    {i + 1}) {text}")
        raw = prompt("바꿀 슬롯 번호 (Enter = 돌아가기)")
        if raw == "":
            if only:
                return
            continue
        if not raw.isdigit() or not 1 <= int(raw) <= n:
            continue
        idx = min(int(raw) - 1, len(slots))
        cards = [k for k, d in guild.o["kpis"].items() if d["dept"] == dept]
        # 같은 조항은 한 부서에 한 번만 (층 지정 조항은 층이 다르면 따로)
        taken = {(s.kpi, s.floor) for i, s in enumerate(slots) if i != idx}
        print("    0) 슬롯 비우기")
        for j, k in enumerate(cards, 1):
            kd_ = guild.kpi_def(k)
            used = not kd_.get("floor") and (k, None) in taken
            line = f"    {j}) {kd_['name']}" + ui.c(f" — {kd_.get('desc', '')}", ui.DIM)
            print(ui.c(f"    {j}) {kd_['name']} (이미 걸려 있음)", ui.DIM) if used else line)
        raw = prompt("조항 카드 번호")
        if raw == "0":
            if idx < len(slots):
                slots.pop(idx)
            continue
        if not raw.isdigit() or not 1 <= int(raw) <= len(cards):
            continue
        kpi = cards[int(raw) - 1]
        kd = guild.kpi_def(kpi)
        floor = None
        if kd.get("floor"):  # 지정 층 이해도: 어느 층을 다질지 정한다
            camps = sorted(guild.outposts)
            raw = prompt(f"다질 층 (캠프가 있는 층 {', '.join(map(str, camps))}, Enter = {camps[0]})")
            floor = int(raw) if raw.isdigit() and int(raw) in camps else camps[0]
        if (kpi, floor) in taken:
            print(ui.c("    같은 조항이 이미 걸려 있어요. 그 슬롯의 목표를 바꾸세요.", ui.YELLOW))
            continue
        # 부서장이 지난달 실적 기준으로 쉬움 · 적당 · 어려움 목표를 제시한다 (부정직하면 실적을 낮춰 말한다)
        pre = guild.presets(dept, kpi, floor)
        bonus = guild.o["contract"]["bonus"]
        basis = "지난달 실적 기준" if guild.reports else "첫 달이라 기본값 기준"
        print(f"    {DEPTS[dept]}장 {agenda.josa(guild.heads[dept].name, '이', '가')} 제시하는 목표 ({basis}, 달성하면 성과급):")
        levels = list(pre)
        for j, lv in enumerate(levels, 1):
            print(f"      {j}) {lv:<3} {kpi_text(kd, pre[lv], floor)}  " + ui.c(f"성과급 {bonus[lv]:,}G", ui.DIM))
        c = guild.o["contract"]
        print(ui.c(f"      (못 지키는 달이 {c['free_fire_after']}달 이어지면 퇴직금 없이 교체할 수 있고, {c['resign_after']}달이면 부서장이 사표를 내요)", ui.DIM))
        raw = prompt("번호 또는 목표치 직접 입력 (Enter = 적당)")
        if raw in ("1", "2", "3"):
            target = pre[levels[int(raw) - 1]]
        else:
            try:
                target = float(raw.replace(",", "")) if raw else pre["적당"]
                if kd["unit"] == "명":
                    target = round(target)
            except ValueError:
                target = pre["적당"]
        slot = Slot(kpi, target, floor)
        slot.level = guild.level_of(dept, slot)
        print(ui.c(f"    → {kpi_text(kd, target, floor)} [{slot.level}]", ui.GREEN))
        if idx < len(slots):
            slots[idx] = slot
        else:
            slots.append(slot)


def agenda_meeting(guild: Guild) -> None:
    props = agenda.proposals(guild)
    if not props:
        return
    print("─" * WIDTH)
    print(ui.c(" 📋 이번 달 안건", ui.BOLD) + ui.c("  (y 승인 · Enter 거절)", ui.DIM))
    for i, pr in enumerate(props, 1):
        head = guild.heads[pr.dept]
        print(f"   {i}) {DEPTS[pr.dept]}장 {head.name} ({head.aggression}): \"{pr.say}\"")
        risk = ui.c(f"  · {pr.risk}", ui.DIM) if pr.risk else ""
        print(f"      → 승인하면 {pr.effect}{risk}")
        if prompt("승인? (y/Enter)") == "y":
            note = agenda.apply_proposal(guild, pr)
            print(ui.c("    → 승인" + (f" ({note})" if note else ""), ui.GREEN))


def pick_dept(label: str) -> str | None:
    d = prompt(f"{label} (1 탐사부 · 2 인사부 · 3 보급부)")
    return list(DEPTS)[int(d) - 1] if d in ("1", "2", "3") else None


def hire_menu(guild: Guild, dept: str) -> None:
    print(f"    {DEPTS[dept]}장 후보 (퇴직금 {guild.o['fire_cost']:,}G)")
    cands = guild.candidates(dept)
    for i, c in enumerate(cands, 1):
        known = [guild.o["traits"][t] for t in c.traits if t in c.known]
        more = len(c.traits) - len(known)
        desc = " · ".join(f"[{t['name']}] 장점 {t['pro']} / 단점 {t['con']}" for t in known)
        more_s = ui.c(f"  + 알 수 없는 특성 {more}개", ui.DIM) if more else ""
        print(f"     {i}) {c.name} ({c.aggression}) {desc}{more_s}")
    raw = prompt("고를 후보 번호 (Enter = 취소)")
    if raw.isdigit() and 1 <= int(raw) <= len(cands):
        old = guild.heads[dept].name
        new = guild.fire(dept, cands[int(raw) - 1])
        print(f"    {DEPTS[dept]}장 {old} → {new.name}")


HELP = """
 ── 무엇이 무엇을 바꾸나 ──────────────────────────────────────────────
 성공률  = 전력 ÷ 난이도로 정해져요. 전력이 난이도를 넉넉히 넘으면 급격히 올라요.
          전력: 인력 등급(보수 저 1.0 · 중 약 1.4 · 고 약 2.2) × 장비 등급(Low 1.0 · Mid 1.35 · High 1.8)
                × 물약(+25%) × 층 이해도(최대 +60%) × 훈련 × 발견한 층의 비밀
          난이도: 층이 깊을수록, 탐사 범위가 넓을수록 올라가요(범위 100%는 30%보다 약 2배 어려움).
          ※ 인원 수는 성공률을 바꾸지 않아요. 사람이 많아도 약하면 약해요.
          ※ 성공률은 최대 97%예요. 전력이 넉넉하면 범위를 좁혀도 더 안전해지지 않아요("97%(최대)").
 수익    = 탐사 나간 인원 × 층 보상 × 탐사 범위 × 성공 여부. 인원이 많을수록, 넓게 갈수록 커요.
          후퇴하면 보상 25%만. 이해도가 쌓인 층은 보상이 줄어요(최대 −50%).
          월급은 인원 × 보수 등급만큼 이사회가 자동 지급해요. 깊은 층일수록 위험 수당(층마다 +4.5%)이 붙어요.
 손실    = 난이도 ÷ 전력이 클수록, 후퇴하면 범위에 비례해 크게. 절반은 사망(위약금 400G), 절반은 부상.
          요양 중인 사람은 탐사에 못 나가지만 월급은 받아요. 인사부 힐러가 있으면 빨리 복귀해요.
 이해도  = 탐사할수록 쌓여요(성공하면 온전히, 후퇴하면 절반). 넓게 훑을수록 많이 쌓여요
          (범위 30%는 ×0.84, 100%는 ×1.4). 0.7이면 다음 층이 열려요.
          쌓일수록 전력은 오르고 보상은 줄어요. 학자 중심 편성·지도 연구로 빨라져요.
 편성    = 과반인 유형이 보너스: 전투 → 손실 −25% · 정찰 → 넓게 갈수록 성공률 + · 학자 → 이해도 +50%
          (이해도가 쌓일수록 보너스가 줄어요)
 부서    = 탐사부: 출전 인원과 물자로 층을 열고 수수료 · 전리품 · 지도 · 비밀을 가져와요.
          인사부: 모집 · 힐러 · 처우비로 다음 달 출전할 수 있는 인원을 만들어요. (돈은 못 벌어요)
          보급부: 물자를 사서 길드에 팔고, 전초기지 매장으로 일반 모험가에게 팔아 돈을 벌어요.
          보수 등급(월급)은 이사회가 예산 회의에서 정해요.
 이탈    = 월급이 기대 월급보다 낮으면 많이 떠나요. 처우비로 줄일 수 있어요. 금고가 0G 미만인 달엔 월급이 밀려 25%가 떠나요.
 층 매장 = 캠프가 있는 층마다 일반 모험가 손님 × 그 층 이해도 × 정비 상태 × 가격 반응. 길드의 주 수입이에요.
          지나온 층을 다지면(지정 층 이해도 조항) 손님이 늘어요. 유지비를 못 받은 캠프는 노후 → 방치.
 예산    = 부서는 배정액 안에서만 움직여요. 덜 주면 조항 밖부터 자르고(캠프 유지비 · 매장 물량 · 힐러),
          보급부는 모자라면 상단에 외상을 져요. 더 주면 남은 돈을 다 써 버려요(부정직하면 착복).
 우호도  = 세력 협력(사제·호위대·기사단)을 부르면 줄고, 정치 행동·의뢰·결의로 올라요. −100이면 게임 오버.
          세력은 금고를 못 보고 부서 보고서로 판단해요. 포장이 들통나면 한 번에 깎여요.
 빚 · 경계 = 부탁은 공짜지만 빚이 되고 세력이 원할 때 청구해요(거절하면 −20). 길드가 강해 보이면
          세력의 경계가 높아져 견제가 들어와요(소문으로만 알 수 있어요).
 패배    = 월말 금고가 3개월 연속 0G 미만 · 어느 세력이든 우호도 −100 · 36개월 시간 초과
 승리    = 10층 이해도 0.7 → 최심부 공략 승인 → 그 달 범위 90% 이상 돌파 (인원 50명 이상)
 ────────────────────────────────────────────────────────────────────────
 이사회 조치: p 공략 지침 · k 조항 편집 · g 감사 · f 부서장 교체 · r 평판 조회 · d 세부 장부 · h 도움말
"""


def floor_record(guild: Guild, floor: int) -> None:
    """층 기록장: 발견한 공식과 지금까지 모인 단서."""
    st = guild.game.state
    found, n = guild.secrets_status(floor)
    print(ui.c(f"  📜 {floor}층 기록", ui.BOLD) + f"  공략 공식 {found}/{n} 발견")
    for i, sec in enumerate(st.secrets.get(floor, [])):
        if (floor, i) in st.secret_found:
            print(ui.c(f"     ✔ {guild.secret_label(sec)}", ui.GREEN))
    for key in sorted(guild.failed.get(floor, set())):
        kind, val = key.split(":")
        print(ui.c(f"     ✘ {guild.secret_label({'kind': kind, 'key': val})} (걸어 봤지만 통하지 않음)", ui.DIM))
    clues = guild.clues.get(floor, [])
    if not clues:
        print(ui.c("     아직 단서가 없어요. 넓게 탐사하거나 학자 중심 편성, 지도 연구를 하면 단서가 잘 나와요.", ui.DIM))
    for cl in clues:
        print(f"     · {cl['month']}월 \"{cl['text']}\" " + ui.c(f"({'확실' if cl['sure'] else '추측'}, 탐사부장 {cl['head']})", ui.DIM))


def directive_menu(guild: Guild) -> None:
    """공략 지침: 이번 달 탐사 층에 장비 계열 · 편성 · 준비 활동을 정한다."""
    g = guild.game
    cfg = g.p["secrets"]
    floor = g.allowed_floor(guild.approved_floor)
    floor_record(guild, floor)
    d = guild.directive(floor)
    prep_name = g.p["activities"][d["prep"]]["name"] if d["prep"] else "없음"
    print(f"  현재 지침: 장비 계열 {cfg['gear_types'][d['gear_type']]} · 편성 {cfg['formations'][d['formation']]['name']} · 준비 {prep_name}")
    print(ui.c(f"  (장비 계열을 바꾸면 인원 × {cfg['switch_cost']['gear']}G, 편성을 바꾸면 인원 × {cfg['switch_cost']['formation']}G. "
               "준비 활동은 이 층에서 매주 해요)", ui.DIM))
    gears = list(cfg["gear_types"])
    raw = prompt("장비 계열 (" + " · ".join(f"{i} {cfg['gear_types'][k]}" for i, k in enumerate(gears)) + ", Enter = 그대로)")
    new = dict(guild.directives.get(floor, {}))
    if raw.isdigit() and int(raw) < len(gears):
        new["gear_type"] = gears[int(raw)]
    forms = list(cfg["formations"])
    raw = prompt("편성 (" + " · ".join(f"{i} {cfg['formations'][k]['name']}" for i, k in enumerate(forms)) + ", Enter = 그대로)")
    if raw.isdigit() and int(raw) < len(forms):
        new["formation"] = forms[int(raw)]
    preps = [None] + list(cfg["preps"])
    raw = prompt("준비 활동 (" + " · ".join(f"{i} {g.p['activities'][k]['name'] if k else '없음'}" for i, k in enumerate(preps))
                 + ", Enter = 그대로)")
    if raw.isdigit() and int(raw) < len(preps):
        new["prep"] = preps[int(raw)]
    guild.directives[floor] = new
    d = guild.directive(floor)
    prep_name = g.p["activities"][d["prep"]]["name"] if d["prep"] else "없음"
    print(ui.c(f"    → {floor}층 지침: 장비 계열 {cfg['gear_types'][d['gear_type']]} · 편성 {cfg['formations'][d['formation']]['name']}"
               f" · 준비 {prep_name}", ui.GREEN))


def board_actions(guild: Guild) -> None:
    while True:
        raw = prompt("이사회 조치 (p 공략 지침 · k 조항 편집 · g 감사 · f 부서장 교체 · r 평판 조회 · d 세부 장부 · h 도움말 · Enter 다음)")
        if raw == "":
            return
        if raw == "h":
            print(HELP)
            continue
        if raw == "p":
            directive_menu(guild)
            continue
        if raw == "k":
            guild.player_checks += 1
            edit_kpis(guild)
        elif raw == "d" and guild.reports:
            dept_details(guild, guild.reports[-1])
            continue
        elif raw == "g":
            guild.player_checks += 1
            dept = pick_dept(f"감사할 부서 (한 곳당 {guild.o['audit_cost']:,}G)")
            if dept:
                guild.audits ^= {dept}
                print(f"    {DEPTS[dept]} 감사 {'지정' if dept in guild.audits else '취소'}")
        elif raw == "f":
            dept = pick_dept("교체할 부서장")
            if dept:
                hire_menu(guild, dept)
        elif raw == "r":
            dept = pick_dept(f"평판을 조회할 부서장 ({guild.o['reference_cost']:,}G)")
            if dept:
                t = guild.reference(dept)
                if t:
                    td = guild.o["traits"][t]
                    print(ui.c(f"    → [{td['name']}] 장점 {td['pro']} / 단점 {td['con']}", ui.CYAN))
                else:
                    print("    → 새로 알아낸 게 없어요. 이미 다 파악했어요.")
        else:
            continue
        heads_rows(guild)


def ask_assault(guild: Guild) -> None:
    if guild.assault_possible() and not guild.assault_ready():
        head = guild.heads["explore"]
        head.known.add("timid")
        print(ui.c(f" 10층을 충분히 파악했지만, 탐사부장 {agenda.josa(head.name, '은', '는')} 최심부 공략을 요청하지 않아요. [겁쟁이]", ui.YELLOW))
        print(ui.c("   공략하려면 탐사부장을 바꿔야 해요 (f).", ui.DIM))
    if not guild.assault_ready():
        return
    g, r = guild.game, guild.game.p["rules"]
    claimed, _ = guild.assault_estimate()
    st = g.state
    print(ui.c(f" 탐사부 요청: 10층 최심부(범위 {r['win_depth']:.0%} 이상) 공략을 승인해 주세요.", ui.YELLOW + ui.BOLD))
    print(
        f"   탐사부 추정 성공률 {claimed:.0%} (부서장 보고) · 인원 {st.members:.0f}명 (공략 인정 {r['win_min_members']}명 이상)"
    )
    print(ui.c(f"   공략 달에는 매주 최심부로만 들어가요. 후퇴하면 큰 피해가 나고, 실제 성공률이 {r['win_success']:.0%} 미만이면 돌파해도 공략으로 인정되지 않아요.", ui.DIM))
    raw = prompt("최심부 공략 승인? (y/n, Enter = n)")
    guild.assault = raw == "y"
    if guild.assault:
        print(ui.c("    → 이번 달 최심부 공략 승인", ui.GREEN + ui.BOLD))


def budget_meeting(guild: Guild) -> None:
    """예산 배정: 부서장이 요청하고 이사회가 정한다. 남은 돈이 이사회 금고(정치·감사·결의·설치비)."""
    guild.make_budget_requests()
    last = guild.reports[-1]["budget"]["reported"] if guild.reports else None
    print("─" * WIDTH)
    print(ui.c(" 💰 예산 배정", ui.BOLD) + ui.c("  덜 주면 조항 밖부터 자르고 외상을 져요 · 더 주면 남김없이 써 버려요", ui.DIM))
    # 월급: 이사회가 보수 등급을 정하고 인원만큼 자동 지급한다 (부서 예산이 아니다)
    st = guild.game.state
    tiers = list(PAY_TIERS)
    wm = {t: weighted_avg(PAY_TIERS[t][1], guild.game.p["adventurers"]["grade_wage_mult"]) for t in tiers}
    opts = " · ".join(f"{i + 1} {t}({guild.salary_of(t) * wm[t]:,.0f}G)" for i, t in enumerate(tiers))
    print(f"   월급 (이사회 자동 지급)  {st.members:.0f}명 × 보수 {guild.pay} = 약 {guild.expected_payroll():,.0f}G"
          + ui.c(f"  [보수 등급 1인: {opts}]", ui.DIM))
    raw = prompt(f"보수 등급 (1 저 · 2 중 · 3 고, Enter = {guild.pay} 유지)")
    if raw in ("1", "2", "3") and tiers[int(raw) - 1] != guild.pay:
        guild.pay = tiers[int(raw) - 1]
        print(ui.c(f"    → 보수 {guild.pay}, 월급 약 {guild.expected_payroll():,.0f}G. 높을수록 강한 인력이 오고 덜 떠나요", ui.GREEN))
    for d in DEPTS:
        head = guild.heads[d]
        what = {"explore": "준비 활동 · 위약금", "hr": "모집(홍보비) · 힐러 · 처우비", "supply": "물약 · 장비 · 매장 물품 · 캠프 유지비"}[d]
        prev = ""
        if last and d in last["budget"]:
            prev = ui.c(f"  (지난달 배정 {last['budget'][d]:,.0f}G · 집행 보고 {last['spent'][d]:,.0f}G)", ui.DIM)
        print(f"   {DEPTS[d]}장 {head.name} 요청 {guild.requests_budget[d]:,.0f}G  " + ui.c(f"[{what}]", ui.DIM) + prev)
    if guild.credit["merchant"] > 0:
        print(ui.c(f"   (보급부 요청에는 상단 외상 상환이 들어 있어요)", ui.DIM))
    for d in DEPTS:
        raw = prompt(f"{DEPTS[d]} 배정액 (Enter = {guild.budget[d]:,.0f}G)")
        try:
            if raw:
                guild.budget[d] = max(0.0, float(raw.replace(",", "")))
        except ValueError:
            pass
    # 들어올 돈: 수입은 월말에 이사회 금고로 들어온다. 지난달 기준으로 보여 준다
    if guild.reports:
        inc = guild.reports[-1]["engine"]["income"]
        groups = {"탐사 (수수료 · 전리품)": ("탐험 수수료", "전리품 판매"), "보급 (길드 판매)": ("물약 판매", "장비 판매"),
                  "층 매장": ("층 매장 판매",)}
        parts = [f"{k} {sum(inc.get(x, 0.0) for x in v):,.0f}G" for k, v in groups.items()]
        other = sum(inc.values()) - sum(inc.get(x, 0.0) for v in groups.values() for x in v)
        if other > 0:
            parts.append(f"의뢰 · 기타 {other:,.0f}G")
        print(ui.c(f"   지난달 수입 {sum(inc.values()):,.0f}G = " + " · ".join(parts) + " (전리품은 매입가를 빼기 전)", ui.DIM))
    else:
        print(ui.c("   수입은 월말에 들어와요: 탐사 수수료 · 전리품 되팔기 · 길드에 물자 판매 · 1층 매장", ui.DIM))
    left = guild.board_treasury()
    color = ui.GREEN if left > 0 else ui.YELLOW
    note = "" if left > 0 else " ← 이만큼은 이번 달 수입으로 메워야 해요"
    print("   월급 + 배정 합계 " + f"{guild.expected_payroll() + sum(guild.budget.values()):,.0f}G → 이사회 금고 " + ui.c(f"{left:,.0f}G{note}", color)
          + ui.c(" (세금 · 정치 · 감사 · 결의 · 설치비는 이사회 금고에서, 수입은 모두 월말에 이사회 금고로)", ui.DIM))


def ask_floor(guild: Guild) -> None:
    ask_assault(guild)
    nxt = guild.floor_proposal()
    if not nxt:
        return
    g = guild.game
    op = g.p["outposts"]
    u = g.state.understanding[guild.approved_floor]
    upkeep_now = guild.upkeep_total()
    print(ui.c(f" 탐사부 요청: {guild.approved_floor}층 이해도 {u:.2f}. {nxt}층 진출을 승인해 주세요.", ui.YELLOW))
    print(f"   {nxt}층 전초기지 설치비 {op['install'][nxt]:,}G (이사회 금고) · 캠프 유지비 월 {upkeep_now:,.0f}G → "
          f"{upkeep_now + op['upkeep'][nxt]:,.0f}G (보급부 예산)")
    print(ui.c(f"   새 층 매장: 손님 최대 {op['visitors'][nxt]}명 × 1인 {op['spend'][nxt]}G (이해도가 쌓일수록 손님이 늘어요)", ui.DIM))
    raw = prompt(f"{nxt}층 진출 승인? (y/n, Enter = y)")
    if raw in ("", "y"):
        guild.approve_floor(nxt)
        print(ui.c(f"    → {nxt}층 진출 승인, 전초기지 설치", ui.GREEN))


def perk_text(g: Game, name: str) -> str:
    """관계 단계에 따른 효과. 좋으면 초록, 나쁘면 빨강."""
    v = g.perk(name)
    if name == "tax_rate":
        base = g.p["politics"]["perks"]["tax_rate"]["by_standing"]["0"]
        color = ui.GREEN if v < base else (ui.RED if v > base else ui.DIM)
        return ui.c(f"세율 {v:.0%}", color)
    label = {"supply_discount": "소모품 가격", "healer_discount": "힐러 고용비"}[name]
    if not v:
        return ui.c(f"{label} 기본", ui.DIM)
    return ui.c(f"{label} ×{1 - v:.2f}", ui.GREEN if v > 0 else ui.RED)


def audit_disposal(guild: Guild) -> None:
    """감사 적발 처리. 부서장이 바뀌면 조항 · 예산 · 안건이 새 부서장 기준이 되도록 이사회 맨 앞에서 한다."""
    dip = guild.dip
    for dept in dip.pending_disclosure:
        f = FACTION_KO[{"supply": "merchant", "hr": "church", "explore": "state"}[dept]]
        print("─" * WIDTH)
        print(ui.c(f" 감사에서 {DEPTS[dept]}장 {guild.heads[dept].name}의 허위 보고가 드러났어요. 어떻게 처리할까요?", ui.YELLOW + ui.BOLD))
        print(ui.c(f"   1) 공개 징계: 부서장 교체 + {f}에 진짜 숫자 공개 (기만 판정 절반)", ui.DIM))
        print(ui.c(f"   2) 은폐: 부서장 유지. {f}는 당장 모르지만 매달 유출 위험 +10%, 유출되면 기만 판정 2배", ui.DIM))
        print("    → " + dip.disclose(dept, prompt("처리 (1 공개 / 2 은폐, Enter = 2)") == "1"))
    dip.pending_disclosure = []


def politics(guild: Guild) -> None:
    """플레이어가 직접 하는 정치 협상. 세력 관계 단계가 조직 운영비를 바꾼다."""
    g, st = guild.game, guild.game.state
    pol = g.p["politics"]
    print("─" * WIDTH)
    h1, h2, t1, t2 = pol["tiers"]
    print(ui.c(" 정치 협상", ui.BOLD) + ui.c(f"   우호도 단계: 적대({h1} 미만) · 냉담({h2} 미만) · 중립 · 우호(+{t1}) · 신뢰(+{t2})", ui.DIM))
    dip = guild.dip
    for name, perk in pol["perks"].items():
        f = perk["faction"]
        sd = g.standing(f)
        debts = dip.debts[f]
        debt_s = ui.c(f"  빚 {'▮' * len(debts)}", ui.YELLOW) if debts else ""
        print(f"   {FACTION_KO[f]} 우호도 {st.gauges[f]:+4.0f} {ui.c(STANDING_KO[sd], STANDING_COLOR[sd])}  → {perk_text(g, name)}{debt_s}")
    # 빚 청구
    for f in dip.demands:
        d = dip.p["demands"][f]
        print(ui.c(f"   {FACTION_KO[f]}이(가) 빚을 청구합니다: \"{d['text']}\" ({d['desc']})", ui.YELLOW + ui.BOLD))
        raw = prompt(f"응할까요? (y 응함 · n 거절 → {FACTION_KO[f]} 우호도 {dip.p['refuse_gauge']}, Enter = y)")
        print("    → " + dip.answer_demand(f, raw != "n"))
    dip.demands = []
    keys = list(pol["actions"])
    favors = list(dip.p["favors"])
    while len(guild.politics_used) < pol["actions_per_month"]:
        left = pol["actions_per_month"] - len(guild.politics_used)
        print(f"   정치 행동 (남은 횟수 {left}, 이사회 금고 {guild.board_treasury():,.0f}G · 명성 {st.reputation:.0f})")
        for i, k in enumerate(keys, 1):
            act = pol["actions"][k]
            why = guild.can_do_politics(k)
            line = f"     {i}) {act['name']} — {act['desc']}"
            print(ui.c(line + f"  ({why})", ui.DIM) if why else line)
        for j, f in enumerate(favors, len(keys) + 1):
            fv = dip.p["favors"][f]
            why = dip.can_ask(f)
            line = f"     {j}) {fv['name']} — {fv['desc']} (돈은 안 들고 빚 1장, 언제 청구될지 몰라요)"
            print(ui.c(line + f"  ({why})", ui.DIM) if why else line)
        raw = prompt("정치 행동 번호 (Enter = 그만)")
        if raw == "":
            return
        if not raw.isdigit() or not 1 <= int(raw) <= len(keys) + len(favors):
            continue
        i = int(raw) - 1
        if i >= len(keys):
            f = favors[i - len(keys)]
            why = dip.can_ask(f)
            if why:
                print(f"    {why}")
                continue
            dip.ask(f)
            print(ui.c(f"    → {dip.p['favors'][f]['name']}: {dip.p['favors'][f]['desc']}. {FACTION_KO[f]} 빚 {len(dip.debts[f])}장", ui.GREEN))
            continue
        k = keys[i]
        why = guild.can_do_politics(k)
        if why:
            print(f"    {why}")
            continue
        target = guild.do_politics(k)
        sd = g.standing(target)
        print(ui.c(f"    → {pol['actions'][k]['name']}: {FACTION_KO[target]} {st.gauges[target]:+.0f} ({STANDING_KO[sd]})", ui.GREEN))


def ask_requests_and_card(guild: Guild) -> tuple[int, list[int]]:
    g = guild.game
    free = guild.explore_slots_free()
    n = min(g.p["factions"]["max_requests"], guild.o["slots"]["explore"])
    print("─" * WIDTH)
    print(f" 세력 의뢰 (수락하면 탐사부 조항 슬롯을 하나씩 차지해요. 지금 빈 슬롯 {free}칸)")
    for i, req in enumerate(g.requests()):
        reward = []
        if req["reward"].get("gold"):
            reward.append(f"금화 +{req['reward']['gold']:,}")
        deltas = g.gauge_deltas(req["reward"].get("gauge", {}))
        reward += [ui.c(f"{FACTION_KO[f]} {d:+.0f}", ui.GREEN if d > 0 else ui.RED) for f, d in deltas.items() if abs(d) >= 0.5]
        pen = req.get("penalty", {}).get("gauge", {})
        pen_s = ", ".join(f"{FACTION_KO[f]} {d:+}" for f, d in pen.items()) or "없음"
        print(f"   {i}) {ui.c(FACTION_KO[req['faction']], ui.YELLOW)}·{req['name']} — {req['goal']}")
        print(f"      성공 {' · '.join(reward)}   실패 {pen_s}")
    raw = prompt("수락할 의뢰 번호 (예: 0 2, Enter = 없음)")
    try:
        reqs = list(dict.fromkeys(int(x) for x in raw.replace(",", " ").split()))[:n]
        reqs = [x for x in reqs if 0 <= x < len(g.state.offered_requests)]
    except ValueError:
        reqs = []
    while len(reqs) > guild.explore_slots_free():
        slots = guild.kpis["explore"]
        print(f"   탐사부 조항 슬롯이 부족해요. 뺄 조항을 고르세요 (Enter = 의뢰를 하나 덜 받기)")
        for i, sl in enumerate(slots, 1):
            print(f"     {i}) {kpi_text(guild.kpi_def(sl.kpi), sl.target)}")
        raw = prompt("뺄 조항 번호")
        if raw.isdigit() and 1 <= int(raw) <= len(slots):
            removed = slots.pop(int(raw) - 1)
            print(f"    → {guild.kpi_def(removed.kpi)['name']} 조항을 뺐어요")
        else:
            reqs.pop()
    if reqs:  # 공 돌리기: 성공해도 명성을 포기하고 세력의 공으로 돌리면 그 세력 경계도가 내려간다
        raw = prompt(f"의뢰가 성공하면 공을 세력에 돌릴까요? (명성 −{guild.dip.p['give_credit_rep']}, 그 세력 경계 완화, y/Enter = 아니오)")
        guild.dip.give_credit = raw == "y"
    print("─" * WIDTH)
    print(" 이사회 결의 (정책 카드)")
    for i, card in enumerate(g.cards()):
        deltas = g.gauge_deltas(card["gauges"])
        eff = ", ".join(
            ui.c(f"{FACTION_KO[f]} {d:+.0f}", ui.GREEN if d > 0 else ui.RED) for f, d in deltas.items() if abs(d) >= 0.5
        )
        extra = f", 금화 {card['gold']:+,}" if card.get("gold") else ""
        print(f"   {i}) {ui.c(card['name'], ui.BOLD)} — {card.get('desc', '')}")
        if eff or extra:
            print(f"      {eff}{extra}")
    raw = prompt("결의 카드 번호 (Enter = 0)")
    card = int(raw) if raw.isdigit() and int(raw) < len(g.cards()) else 0
    return card, reqs


# ------------------------------------------------------------------ 자동 진행
def week_line(guild: Guild, rec: dict) -> None:
    g = guild.game
    floor, depth, acts = rec["decision"]
    h = rec["engine"]
    names = ", ".join(g.p["activities"][a]["name"] for a in acts) or "없음"
    result = ui.c("성공", ui.GREEN) if h["cleared"] else ui.c("후퇴", ui.RED)
    print(
        f"  {h['week']}주차 탐사부: {floor}층 범위 {depth:.0%} · 준비 {names} → {result} · "
        f"보고 순이익 {rec['reported']['revenue']:+,.0f}G · 사망 {rec['reported']['deaths']:.0f}명"
    )
    for note in h["notes"]:
        color = ui.GREEN if "살렸" in note or "대비했" in note else ui.YELLOW
        print(ui.c(f"    · {note}", color))
    secrets = g.state.secrets.get(h["floor"], [])
    for i in h["secrets_new"]:
        sec = secrets[i]
        text = g.p["secrets"]["found"][f"{sec['kind']}:{sec['key']}"]
        print(ui.c(f"    📜 {h['floor']}층 공략 공식 발견! {text} → [{guild.secret_label(sec)}]", ui.GREEN + ui.BOLD))
    if h["secrets_hit"] and not h["secrets_new"]:
        print(ui.c(f"    · {h['floor']}층 공략 공식이 통하고 있어요", ui.GREEN))
    if rec.get("clue"):
        cl = rec["clue"]
        print(ui.c(f"    📜 단서: \"{cl['text']}\" ({'확실' if cl['sure'] else '추측'})", ui.CYAN))
    for a in rec["alerts"]:
        if "관계 악화" in a:
            print(ui.c(f"    ⚠ {a}", ui.YELLOW))


def field_decision(guild: Guild, rec: dict) -> None:
    """현장 판단 요청. 부서장들의 말을 듣고 고른다."""
    for ev in agenda.field_events(guild, rec):
        for line in ev.info:
            print(ui.c(f"    {line}", ui.DIM))
        if not ev.options:
            continue
        print(ui.c(f"  ⚑ {ev.title}", ui.YELLOW + ui.BOLD))
        for line in ev.lines:
            print(f"    {line}")
        options = list(ev.options)
        print(ui.c("     (다음 주 예상. " , ui.DIM) + ui.c("▲", ui.GREEN) + ui.c(" 1번보다 좋아짐 · ", ui.DIM)
              + ui.c("▼", ui.RED) + ui.c(" 1번보다 나빠짐)", ui.DIM))
        while True:
            for i, (label, action) in enumerate(options, 1):
                print(f"     {i}) {ui.c(label, ui.BOLD)}")
                view = agenda.option_cells(guild, action)
                if view:
                    cells, change = view
                    marks = {1: ui.c("▲", ui.GREEN), -1: ui.c("▼", ui.RED), 0: ""}
                    print("        " + " │ ".join(text + marks[m] for text, m in cells))
                    if change:
                        print(ui.c(f"        {change}", ui.DIM))
            raw = prompt("선택 (Enter = 1)")
            idx = int(raw) - 1 if raw.isdigit() and 1 <= int(raw) <= len(options) else 0
            label, action = options[idx]
            note = agenda.apply_choice(guild, action)
            if note:
                print(ui.c(f"    → {note}", ui.CYAN))
            if action.get("audit"):  # 감사 결과를 보고 다시 고른다
                options = [o for o in options if not o[1].get("audit")]
                continue
            break
        if guild.halted:
            return


def founding(guild: Guild) -> None:
    """창립 이사회: 부서장을 후보 중에서 직접 임명한다."""
    print("═" * WIDTH)
    print(ui.c(" 창립 이사회: 부서장 임명", ui.BOLD) + ui.c("  (후보마다 특성 하나가 이력서에 적혀 있어요. 나머지는 같이 일해 봐야 알아요)", ui.DIM))
    for dept, cands in guild.founding_candidates().items():
        print(f"  {DEPTS[dept]}장 후보")
        for i, c in enumerate(cands, 1):
            known = [guild.o["traits"][t] for t in c.traits if t in c.known]
            more = len(c.traits) - len(known)
            desc = " · ".join(f"[{t['name']}] 장점 {t['pro']} / 단점 {t['con']}" for t in known)
            more_s = ui.c(f"  + 알 수 없는 특성 {more}개", ui.DIM) if more else ""
            print(f"     {i}) {c.name} ({c.aggression}) {desc}{more_s}")
        raw = prompt("임명할 후보 번호 (Enter = 1)")
        idx = int(raw) - 1 if raw.isdigit() and 1 <= int(raw) <= len(cands) else 0
        guild.appoint(dept, cands[idx])
        print(ui.c(f"    → {DEPTS[dept]}장 {cands[idx].name} 임명", ui.GREEN))


def play(guild: Guild) -> None:
    g = guild.game
    if g.state.month == 0 and not guild.reports:
        print(HELP)
        founding(guild)
    while not g.state.over:
        dashboard(guild)
        board_report(guild)
        audit_disposal(guild)
        heads_rows(guild)
        print("═" * WIDTH)
        ask_floor(guild)
        agenda_meeting(guild)
        board_actions(guild)
        budget_meeting(guild)
        politics(guild)
        card, reqs = ask_requests_and_card(guild)
        guild.start_month(card, reqs)
        print("─" * WIDTH)
        for a in guild.announcements + guild.card_notes:
            print("  " + a)
        accepted = ", ".join(r["name"] for r in g.ctx["requests"]) or "없음"
        print(f"  탐사부 외부 조항(수락한 의뢰): {accepted}")
        for dept, pr in guild.promises.items():
            print(ui.c(f"  약속 · {DEPTS[dept]}장 {guild.heads[dept].name}: \"{promise_text(guild, pr)}\"", ui.DIM))
        while g.state.week < g.weeks and not g.state.over and not guild.halted:
            rec = guild.run_week()
            week_line(guild, rec)
            field_decision(guild, rec)
        guild.end_month()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int)
    ap.add_argument("-p", "--params")
    ap.add_argument("--no-color", action="store_true", help="색상 끄기 (글자가 깨질 때)")
    args = ap.parse_args()
    ui.set_color(not args.no_color)
    game = Game(load_params(args.params), seed=args.seed)
    guild = Guild(game, seed=args.seed)
    print(__doc__)
    try:
        play(guild)
    except (Quit, KeyboardInterrupt, EOFError):
        print("\n종료")
        return
    st = game.state
    collapsed = ", ".join(FACTION_KO[f] for f in st.collapsed)
    ko = {
        "win": ui.c("🎉 10층 공략 성공!", ui.GREEN + ui.BOLD),
        "collapse": ui.c(f"💀 {collapsed}이(가) 길드에 등을 돌렸어요 (우호도 -100). 게임 오버", ui.RED + ui.BOLD),
        "deficit": ui.c("금고가 3개월 연속 바닥나 게임 오버", ui.RED + ui.BOLD),
        "timeout": "시간 초과",
    }
    print(f"\n{ko.get(st.result, st.result)} ({st.month}개월)")


if __name__ == "__main__":
    main()
