// 시험용 봇: honest(장부 그대로) · greedy(마구 빼돌림) · smart(냄새가 나기 전에 씻고 바친다)
import { World, Kind, BDEF, canBuild, build, step, L, washCap, clampLed, firstFree } from './engine';

export type Style = 'honest' | 'greedy' | 'smart';

// 짓는 순서(앞에서부터 카드를 하나씩 놓는다). 놓을 수 없으면 다음 카드로
const PLAN_HONEST: Kind[] = ['checkpoint', 'buyer', 'tavern', 'inn', 'rental', 'chapel', 'tavern', 'inn', 'lodge', 'hospital', 'casino', 'lodge', 'cathedral', 'guild', 'casino', 'theater', 'auction'];
const PLAN: Kind[] = ['checkpoint', 'buyer', 'tavern', 'inn', 'rental', 'chapel', 'casino', 'tavern', 'inn', 'lodge', 'hospital', 'casino', 'cathedral', 'guild', 'lodge', 'theater', 'auction'];

export function botDay(w: World, s: Style) {
  // 짓기: 계획 순서대로, 여유 자금이 있을 때
  const plan = s === 'honest' ? PLAN_HONEST : PLAN;
  const keep = 150 + w.mo.take * 0.5;
  const at = firstFree(w);
  if (at >= 0) {
    const have: Record<string, number> = {}, want: Record<string, number> = {};
    for (const t of w.tiles) if (t.b) have[t.b] = (have[t.b] ?? 0) + 1;
    for (const k of plan) {
      want[k] = (want[k] ?? 0) + 1;
      if ((have[k] ?? 0) >= want[k]) continue;
      const why = canBuild(w, at, k);
      if (why && why !== '자금 부족') continue; // 계급 · 상한에 막힌 카드는 건너뛴다
      if (!why && w.clean - BDEF[k].cost > keep) build(w, at, k);
      break; // 돈을 모아서 놓는다
    }
  }
  const l = w.led;
  if (s === 'honest') { l.report = 100; l.ghosts = 0; l.smuggle = 0; l.backdoor = 0; }
  if (s === 'greedy') { l.report = 40; l.ghosts = 120; l.smuggle = 100; l.wash.casino = washCap(w, 'casino'); l.wash.cathedral = washCap(w, 'cathedral'); }
  if (s === 'smart') {
    const calm = w.risk < 30 && !w.audit;
    l.report = calm ? 75 : 95;
    l.ghosts = calm ? Math.round(w.mo.visits * 0.25 + 10) : 0;
    l.smuggle = calm ? 60 : 0;
    l.wash.casino = washCap(w, 'casino'); l.wash.cathedral = washCap(w, 'cathedral');
  }
  // 상납: 달 끝 무렵, 남는 합법 자금
  if (w.day % L.MONTH === L.MONTH - 1) {
    const spare = s === 'honest' ? w.clean - 900 : w.clean - 700;
    l.bribe = Math.max(0, Math.floor(spare * (s === 'honest' ? 0.5 : 0.8)));
  }
  clampLed(w);
  step(w);
}
