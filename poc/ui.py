"""터미널 대시보드용 막대·색상 헬퍼."""
from __future__ import annotations

import os

RESET, BOLD, DIM = "\033[0m", "\033[1m", "\033[2m"
RED, GREEN, YELLOW, CYAN = "\033[31m", "\033[32m", "\033[33m", "\033[36m"

_color = True


def set_color(enabled: bool) -> None:
    global _color
    _color = enabled
    if enabled and os.name == "nt":
        os.system("")  # Windows 콘솔에서 ANSI 색상 켜기


def c(text: str, color: str) -> str:
    return f"{color}{text}{RESET}" if _color else text


def delta(d: float) -> str:
    if abs(d) < 0.5:
        return c("  -  ", DIM)
    return c(f"▲{d:>3.0f} ", GREEN) if d > 0 else c(f"▼{-d:>3.0f} ", RED)


def gauge_bar(value: float, marks: dict[float, str] | None = None, half: int = 20) -> str:
    """-100~+100 을 가운데(│) 기준 양쪽 막대로. marks = {값: 표시 문자} (예: 제재선, 종속선)."""
    marks = marks or {}
    cells = []
    for i in range(-half, half):
        # 칸 i는 [i, i+1) * (100/half) 구간을 뜻한다
        lo, hi = i * 100 / half, (i + 1) * 100 / half
        filled = (value < 0 and hi <= 0 and hi > value) or (value > 0 and lo >= 0 and lo < value)
        mark = next((ch for v, ch in marks.items() if lo <= v < hi), None)
        if filled:
            cells.append(c("█", GREEN if value > 0 else RED))
        elif mark:
            cells.append(c(mark, YELLOW))
        else:
            cells.append(c("·", DIM))
        if i == -1:
            cells.append("│")
    return "".join(cells)


def progress_bar(ratio: float, width: int = 10, goal: float | None = None, color: str = CYAN) -> str:
    """0~1 진행 막대. goal 위치에 ┆ 표시."""
    filled = round(max(0.0, min(1.0, ratio)) * width)
    goal_i = round(goal * width) if goal is not None else None
    cells = []
    for i in range(width):
        if i < filled:
            cells.append(c("█", color))
        elif i == goal_i:
            cells.append(c("┆", YELLOW))
        else:
            cells.append(c("░", DIM))
    return "".join(cells)
