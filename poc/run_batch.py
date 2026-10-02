"""봇 대량 시뮬레이션.

    py run_batch.py                      # 모든 봇 300판씩, 요약 표
    py run_batch.py -n 1000 -b balanced  # 특정 봇만
    py run_batch.py --trace balanced     # 한 판을 월별로 출력
    py run_batch.py --csv out.csv        # 판별 결과를 CSV로 저장
    py run_batch.py --plot               # 봇별 대표 한 판의 추이 그래프 (matplotlib 필요)
"""
from __future__ import annotations

import argparse
import csv
import statistics as stats
import sys

from bots import BOTS, plan_week
from sim import FACTION_KO, FACTIONS, Game, load_params

RESULT_KO = {"win": "승리", "collapse": "세력 붕괴", "deficit": "적자 오버", "bankrupt": "파산", "timeout": "시간 초과"}


def play(bot, params: dict, seed: int) -> Game:
    game = Game(params, seed=seed)
    planner = getattr(bot, "planner", plan_week)
    while not game.state.over:
        game.step(bot(game), planner)
    return game


def summarize(name: str, games: list[Game]) -> dict:
    results = [g.state.result for g in games]
    wins = [g.state.month for g in games if g.state.result == "win"]
    gauges = [g.state.gauges for g in games]
    return {
        "bot": name,
        "games": len(games),
        "win": results.count("win") / len(games),
        "deficit": results.count("deficit") / len(games),
        "collapse": results.count("collapse") / len(games),
        "bankrupt": results.count("bankrupt") / len(games),
        "timeout": results.count("timeout") / len(games),
        "win_month": stats.mean(wins) if wins else None,
        "max_floor": stats.mean(max(h["floor"] for h in g.state.history) for g in games),
        "members": stats.mean(g.state.members for g in games),
        "gold": stats.mean(g.state.gold for g in games),
        "gauge_spread": stats.mean(max(x.values()) - min(x.values()) for x in gauges),
        "first_deficit_month": stats.mean(
            next((h["month"] for h in g.state.history if h["net"] < 0), g.state.month) for g in games
        ),
    }


def pct(x: float) -> str:
    return f"{x * 100:5.1f}%"


def print_table(rows: list[dict]) -> None:
    head = f"{'봇':<16}{'승리':>7}{'세력붕괴':>9}{'적자오버':>9}{'시간초과':>9}{'승리월':>7}{'최대층':>7}{'최종인원':>9}{'최종금화':>10}{'게이지편차':>10}"
    print(head)
    print("-" * 97)
    for r in rows:
        wm = f"{r['win_month']:.1f}" if r["win_month"] else "-"
        print(
            f"{r['bot']:<16}{pct(r['win']):>7}{pct(r['collapse']):>9}{pct(r['deficit']):>9}{pct(r['timeout']):>9}"
            f"{wm:>7}{r['max_floor']:>7.1f}{r['members']:>9.1f}{r['gold']:>10,.0f}{r['gauge_spread']:>10.1f}"
        )


def trace(name: str, params: dict, seed: int) -> None:
    game = play(BOTS[name], params, seed)
    extra = f" ({', '.join(FACTION_KO[f] for f in game.state.collapsed)})" if game.state.collapsed else ""
    print(f"[{name}] seed={seed} → {RESULT_KO.get(game.state.result, game.state.result)}{extra} ({game.state.month}개월)\n")
    print(
        f"{'월':>3}{'층':>3}{'범위':>5}{'성공':>6}{'손실':>6}{'이탈':>6}{'인원':>6}{'이해도':>7}"
        f"{'순이익':>9}{'금화':>9}{'명성':>6}  {'상단':>4}{'교회':>5}{'국가':>5}  {'Lv':>5}  카드"
    )
    for h in game.state.history:
        g, lv = h["gauges"], h["levels"]
        print(
            f"{h['month']:>3}{h['floor']:>3}{h['depth']:>5.0%}{h['success']:>6.2f}{h['loss_rate']:>6.2f}{h['attrition']:>6.2f}"
            f"{h['members']:>6.1f}{h['understanding']:>7.2f}{h['net']:>9,.0f}{h['gold']:>9,.0f}{h['reputation']:>6.0f}"
            f"  {g['merchant']:>4.0f}{g['church']:>5.0f}{g['state']:>5.0f}  {lv['merchant']}/{lv['church']}/{lv['state']}"
            f"  {h['card']} | 의뢰 {' '.join(('✔' if x['done'] else '✘') + x['request']['name'] for x in h['requests']) or '-'}"
            f"{' ⚠미지급' if h['unpaid'] else ''}"
        )
    last = game.state.history[-1]
    print("\n마지막 달 손익")
    for k, v in last["income"].items():
        print(f"  + {k:<14}{v:>10,.0f}")
    for k, v in last["expense"].items():
        print(f"  - {k:<14}{v:>10,.0f}")


def plot(names: list[str], params: dict, seed: int) -> None:
    try:
        import matplotlib.pyplot as plt
    except ImportError:
        sys.exit("matplotlib이 없어요. 프로젝트 .venv를 활성화했는지 확인하세요 (README 참고).")
    plt.rcParams["font.family"] = "Malgun Gothic"
    fig, axes = plt.subplots(2, 2, figsize=(12, 8))
    for name in names:
        h = play(BOTS[name], params, seed).state.history
        m = [x["month"] for x in h]
        axes[0][0].plot(m, [x["gold"] for x in h], label=name)
        axes[0][1].plot(m, [x["members"] for x in h], label=name)
        axes[1][0].plot(m, [x["floor"] for x in h], label=name)
        axes[1][1].plot(m, [max(x["gauges"].values()) - min(x["gauges"].values()) for x in h], label=name)
    for ax, title in zip(axes.flat, ["금화", "인원", "탐험 층", "세력 게이지 편차(최대-최소)"]):
        ax.set_title(title)
        ax.set_xlabel("월")
        ax.grid(alpha=0.3)
    axes[0][0].legend(fontsize=8)
    fig.tight_layout()
    out = "batch_plot.png"
    fig.savefig(out, dpi=120)
    print(f"그래프 저장: {out}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-n", "--games", type=int, default=300)
    ap.add_argument("-b", "--bot", action="append", choices=BOTS, help="여러 번 지정 가능, 생략하면 전부")
    ap.add_argument("-p", "--params", help="params.json 경로")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--trace", choices=BOTS, help="한 판을 월별로 출력")
    ap.add_argument("--csv", help="판별 결과 CSV 경로")
    ap.add_argument("--plot", action="store_true")
    args = ap.parse_args()

    params = load_params(args.params)
    names = args.bot or list(BOTS)

    if args.trace:
        trace(args.trace, params, args.seed)
        return
    if args.plot:
        plot(names, params, args.seed)
        return

    rows, per_game = [], []
    for name in names:
        games = [play(BOTS[name], params, args.seed + i) for i in range(args.games)]
        rows.append(summarize(name, games))
        for i, g in enumerate(games):
            per_game.append(
                {
                    "bot": name,
                    "seed": args.seed + i,
                    "result": g.state.result,
                    "months": g.state.month,
                    "max_floor": max(h["floor"] for h in g.state.history),
                    "members": round(g.state.members, 1),
                    "gold": round(g.state.gold),
                    **{f"gauge_{f}": round(g.state.gauges[f]) for f in FACTIONS},
                    **{f"level_{f}": g.state.levels[f] for f in FACTIONS},
                }
            )

    print(f"봇별 {args.games}판 결과 (최대 {params['rules']['max_months']}개월)\n")
    print_table(rows)
    print(f"\n게이지 편차 = 게임 종료 시 세력 게이지 최대값 - 최소값 ({'/'.join(FACTION_KO.values())})")

    if args.csv:
        with open(args.csv, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=per_game[0].keys())
            w.writeheader()
            w.writerows(per_game)
        print(f"CSV 저장: {args.csv}")


if __name__ == "__main__":
    main()
