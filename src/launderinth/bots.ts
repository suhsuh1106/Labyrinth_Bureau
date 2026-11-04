// 시험용 봇: honest(장부 그대로) · greedy(마구 빼돌림) · smart(냄새가 나기 전에 씻고 바친다)
import { World, Kind, BDEF, canBuild, build, step, L, washCap, clampLed, roadNet, nbrs, MW, MH, idx } from './engine';

export type Style = 'honest' | 'greedy' | 'smart';

function spotFor(w: World, k: Kind): number | null {
  const net = roadNet(w);
  for (const i of net) for (const n of nbrs(i)) if (!canBuild(w, n, k)) return n;
  return null;
}
function extendRoad(w: World): boolean {
  // 처음 길 위아래로 한 칸씩 가지를 낸다
  for (let x = 2; x < MW - 4; x += 3) for (const y of [7, 9, 6, 10, 5, 11]) {
    const i = idx(x, y); if (y >= 0 && y < MH && !canBuild(w, i, 'road')) return build(w, i, 'road');
  }
  return false;
}
const PLAN_HONEST: Kind[] = ['tavern', 'inn', 'rental', 'tavern', 'inn', 'casino', 'hospital', 'rental', 'inn', 'casino', 'cathedral', 'tavern', 'inn', 'hospital', 'cathedral', 'casino'];
const PLAN: Kind[] = ['tavern', 'inn', 'casino', 'rental', 'tavern', 'inn', 'hospital', 'rental', 'inn', 'casino', 'cathedral', 'tavern', 'inn', 'hospital', 'cathedral', 'casino'];

export function botDay(w: World, s: Style) {
  // 짓기: 계획 순서대로, 여유 자금이 있을 때
  const built = w.tiles.filter(t => t.b && t.b !== 'road').length;
  const plan = s === 'honest' ? PLAN_HONEST : PLAN;
  const next = plan[Math.min(built, plan.length - 1)];
  const keep = 150 + w.mo.take * 0.5;
  if (built < 24 && BDEF[next].rank <= w.rank && w.clean - BDEF[next].cost > keep) {
    const at = spotFor(w, next);
    if (at != null) build(w, at, next); else extendRoad(w);
  }
  const l = w.led;
  if (s === 'honest') { l.report = 100; l.ghosts = 0; l.smuggle = 0; }
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
