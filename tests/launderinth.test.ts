import { describe, it, expect } from 'vitest';
import { needsOf, upgrade, upCost, setPrice, capOf, newWorld, build, canBuild, idx, L, preview, step, World } from '../src/launderinth/engine';
import { botDay, Style } from '../src/launderinth/bots';

function play(seed: number, s: Style, months = 36): World {
  const w = newWorld(seed);
  while (!w.over && w.day < months * L.MONTH) botDay(w, s);
  return w;
}

describe('launderinth', () => {
  it('같은 시드면 같은 판', () => {
    const a = play(7, 'smart', 12), b = play(7, 'smart', 12);
    expect(a.clean).toBe(b.clean); expect(a.black).toBe(b.black); expect(a.risk).toBe(b.risk);
  });

  it('건물은 길 옆에만, 물 위에는 못 짓는다', () => {
    const w = newWorld(1);
    expect(canBuild(w, idx(5, 2), 'inn')).toBe('길 옆에만');
    expect(canBuild(w, idx(5, 7), 'inn')).toBeNull();
    expect(build(w, idx(5, 7), 'inn')).toBe(true);
    expect(canBuild(w, idx(5, 7), 'tavern')).toBe('이미 있음');
    expect(canBuild(w, idx(6, 9), 'cathedral')).toBe('자작 이상');
  });

  it('신고율을 낮추면 빼돌린 만큼 비자금, 대조 소견이 나빠진다', () => {
    const w = newWorld(3);
    build(w, idx(5, 7), 'inn'); build(w, idx(6, 7), 'tavern');
    for (let d = 0; d < 20; d++) step(w);
    w.led.report = 100; const honest = preview(w);
    w.led.report = 50; const crook = preview(w);
    expect(honest.skim).toBe(0);
    expect(crook.skim).toBeGreaterThan(0);
    expect(crook.look).toBeGreaterThan(honest.look);
    expect(crook.dRisk).toBeGreaterThan(honest.dRisk);
  });

  it('잘 두는 쪽이 앞선다: smart는 대공에 닿고, greedy는 잡히고, honest는 느리다', () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    const res = (s: Style) => seeds.map(n => play(n, s));
    const smart = res('smart'), greedy = res('greedy'), honest = res('honest');
    const duke = (ws: World[]) => ws.filter(w => w.over === 'duke').length;
    const caught = (ws: World[]) => ws.filter(w => w.over === 'arrest').length;
    const line = (n: string, ws: World[]) => `${n}: 대공 ${duke(ws)} · 체포 ${caught(ws)} · 계급 평균 ${(ws.reduce((a, w) => a + w.rank, 0) / ws.length).toFixed(2)} · 날 평균 ${Math.round(ws.reduce((a, w) => a + w.day, 0) / ws.length)}`;
    console.log([line('smart', smart), line('greedy', greedy), line('honest', honest)].join('\n'));
    expect(duke(smart)).toBeGreaterThanOrEqual(6);
    expect(caught(greedy)).toBeGreaterThanOrEqual(3);
    expect(duke(honest)).toBeLessThan(duke(smart));
  });

  it('현황: 입장객 · 건물별 매상이 쌓이고, 없는 시설은 부족한 것으로 나온다', () => {
    const w = newWorld(5);
    build(w, idx(5, 7), 'inn');
    for (let d = 0; d < 12; d++) step(w);
    expect(w.stat.hist.length).toBe(12);
    expect(w.stat.visits).toBe(w.stat.hist.reduce((a, d) => a + d.v, 0));
    expect(w.stat.tile[idx(5, 7)].served).toBeGreaterThan(0);
    const spent = (w.stat.kind.inn?.rev ?? 0) + w.stat.fee;
    expect(w.stat.spent).toBe(spent);
    expect(needsOf(w).some(n => n.what.startsWith('마실 곳'))).toBe(true);
  });

  const run = (f: (w: World) => void, seed = 9) => {
    const w = newWorld(seed); w.clean = 9000;
    build(w, idx(5, 7), 'inn'); build(w, idx(6, 7), 'inn'); build(w, idx(8, 7), 'tavern'); build(w, idx(9, 7), 'rental');
    f(w); for (let d = 0; d < 60; d++) step(w); return w;
  };

  it('요금: 지나치게 올리면 손님이 돈이 모자라거나 마음이 안 가서 매상이 깎인다', () => {
    const base = run(() => {}), greedy = run(w => setPrice(w, 'inn', 200));
    expect(greedy.stat.kind.inn!.served).toBeLessThan(base.stat.kind.inn!.served);
    expect(greedy.stat.hist.some(d => (d.x.inn ?? 0) > 0)).toBe(true);
    expect(greedy.stat.sat / greedy.stat.guests).toBeLessThan(base.stat.sat / base.stat.guests);
  });

  it('업그레이드: 돈이 들고, 수용이 늘고, 최고 단계에서 멈춘다', () => {
    const w = newWorld(2); w.clean = 5000; build(w, idx(5, 7), 'inn');
    const i = idx(5, 7), c = upCost(w, i), cap = capOf(w, i), before = w.clean;
    expect(upgrade(w, i)).toBeNull();
    expect(before - w.clean).toBe(c); expect(capOf(w, i)).toBeGreaterThan(cap);
    expect(upgrade(w, i)).toBeNull(); expect(upgrade(w, i)).toBe('최고 단계');
    w.clean = 0; expect(upgrade(w, idx(6, 7))).toBe('건물 아님');
  });

  it('손님이 넘치면 돌려보내고 불만이 쌓인다(만족 하락)', () => {
    const w = run(() => {}); const w2 = run(w => { for (const x of [5, 6]) w.tiles[idx(x, 7)].lv = 3; });
    expect(w.stat.kind.inn!.turned).toBeGreaterThanOrEqual(w2.stat.kind.inn!.turned);
  });
});
