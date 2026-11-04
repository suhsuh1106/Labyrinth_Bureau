import { describe, it, expect } from 'vitest';
import { newWorld, build, canBuild, idx, L, preview, step, World } from '../src/launderinth/engine';
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
});
