import { describe, it, expect } from 'vitest';
import { townStage, popOf, jobsOf, slotsOf, firstFree, live, RANKS, delveUp, delveCost, lootMean, deathRate, setBudget, needsOf, upgrade, upCost, setPrice, capOf, newWorld, build, canBuild, Kind, L, preview, step, World } from '../src/launderinth/engine';
import { botDay, Style } from '../src/launderinth/bots';

const put = (w: World, k: Kind) => build(w, firstFree(w), k);

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

  it('카드는 열린 칸에만, 종류마다 상한이 있고, 계급이 모자라면 못 놓는다', () => {
    const w = newWorld(1);
    expect(slotsOf(w)).toBe(6);
    expect(canBuild(w, 6, 'inn')).toBe('닫힌 자리');
    expect(canBuild(w, 0, 'inn')).toBeNull();
    expect(build(w, 0, 'inn')).toBe(true);
    expect(canBuild(w, 0, 'tavern')).toBe('이미 있음');
    put(w, 'inn');
    expect(canBuild(w, 2, 'inn')).toBe('2장까지');
    expect(canBuild(w, 2, 'cathedral')).toBe('백작 이상');
    expect(canBuild(w, 2, 'casino')).toBe('자작 이상');
  });

  it('신고율을 낮추면 빼돌린 만큼 비자금, 대조 소견이 나빠진다', () => {
    const w = newWorld(3);
    put(w, 'inn'); put(w, 'tavern');
    for (let d = 0; d < 20; d++) step(w);
    w.led.report = 100; const honest = preview(w);
    w.led.report = 50; const crook = preview(w);
    expect(honest.skim).toBe(0);
    expect(crook.skim).toBeGreaterThan(0);
    expect(crook.look).toBeGreaterThan(honest.look);
    expect(crook.dRisk).toBeGreaterThan(honest.dRisk);
  });

  it('잘 두는 쪽이 앞선다: smart는 공작에 닿고, greedy는 잡히고, honest는 느리다', () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    const res = (s: Style) => seeds.map(n => play(n, s));
    const smart = res('smart'), greedy = res('greedy'), honest = res('honest');
    const duke = (ws: World[]) => ws.filter(w => w.over === 'duke').length;
    const caught = (ws: World[]) => ws.filter(w => w.over === 'arrest').length;
    const line = (n: string, ws: World[]) => `${n}: 공작 ${duke(ws)} · 체포 ${caught(ws)} · 계급 평균 ${(ws.reduce((a, w) => a + w.rank, 0) / ws.length).toFixed(2)} · 날 평균 ${Math.round(ws.reduce((a, w) => a + w.day, 0) / ws.length)}`;
    console.log([line('smart', smart), line('greedy', greedy), line('honest', honest)].join('\n'));
    expect(duke(smart)).toBeGreaterThanOrEqual(6);
    expect(caught(greedy)).toBeGreaterThanOrEqual(3);
    expect(duke(honest)).toBeLessThan(duke(smart));
  });

  it('현황: 입장객 · 건물별 매상이 쌓이고, 없는 시설은 부족한 것으로 나온다', () => {
    const w = newWorld(5);
    put(w, 'inn');
    for (let d = 0; d < 12; d++) step(w);
    expect(w.stat.hist.length).toBe(12);
    expect(w.stat.visits).toBe(w.stat.hist.reduce((a, d) => a + d.v, 0));
    expect(w.stat.tile[0].served).toBeGreaterThan(0);
    const spent = (w.stat.kind.inn?.rev ?? 0) + w.stat.fee;
    expect(w.stat.spent).toBe(spent);
    expect(needsOf(w).some(n => n.what.startsWith('마실 곳'))).toBe(true);
  });

  const run = (f: (w: World) => void, seed = 9) => {
    const w = newWorld(seed); w.clean = 9000;
    put(w, 'inn'); put(w, 'inn'); put(w, 'tavern'); put(w, 'rental');
    f(w); for (let d = 0; d < 60; d++) step(w); return w;
  };

  it('요금: 지나치게 올리면 손님이 돈이 모자라거나 마음이 안 가서 매상이 깎인다', () => {
    const base = run(() => {}), greedy = run(w => setPrice(w, 'inn', 200));
    expect(greedy.stat.kind.inn!.served).toBeLessThan(base.stat.kind.inn!.served);
    expect(greedy.stat.hist.some(d => (d.x.inn ?? 0) > 0)).toBe(true);
    expect(greedy.stat.sat / greedy.stat.guests).toBeLessThan(base.stat.sat / base.stat.guests);
  });

  it('업그레이드: 돈이 들고, 수용이 늘고, 최고 단계에서 멈춘다', () => {
    const w = newWorld(2); w.clean = 5000; put(w, 'inn');
    const i = 0, c = upCost(w, i), cap = capOf(w, i), before = w.clean;
    expect(upgrade(w, i)).toBeNull();
    expect(before - w.clean).toBe(c); expect(capOf(w, i)).toBeGreaterThan(cap);
    expect(upgrade(w, i)).toBeNull(); expect(upgrade(w, i)).toBe('최고 단계');
    w.clean = 0; expect(upgrade(w, 1)).toBe('빈 자리');
  });

  it('손님이 넘치면 돌려보내고 불만이 쌓인다(만족 하락)', () => {
    const w = run(() => {}); const w2 = run(w => { for (const x of [0, 1]) w.tiles[x].lv = 3; });
    expect(w.stat.kind.inn!.turned).toBeGreaterThanOrEqual(w2.stat.kind.inn!.turned);
  });

  it('월 결산: 들어온 돈과 나간 돈이 금고 증감과 정확히 맞는다', () => {
    const w = newWorld(4); w.clean = 4000; w.flags.from = 4000; w.rank = 1;
    for (const k of ['inn', 'tavern', 'casino'] as const) put(w, k);
    w.led.report = 70; w.led.ghosts = 15; w.led.wash.casino = 500; w.led.bribe = 300; setBudget(w, 'promo', 300);
    for (let d = 0; d < 30; d++) step(w);
    const b = w.books[0]; expect(b).toBeTruthy();
    const inc = b.town + b.fee + Object.values(b.sales).reduce((a, n) => a + (n ?? 0), 0) + b.subsidy + b.wash;
    const out = b.upkeep + b.budget + b.capex + b.tax + b.bribe + b.toBlack;
    expect(Math.round(b.from + inc - out)).toBe(Math.round(b.to));
    expect(b.budget).toBe(300); expect(b.capex).toBe(180 + 280 + 900);
    expect(w.mb.fee).toBe(0);
    expect(b.black).toBeCloseTo(w.black, 5);
  });

  it('예산: 홍보는 입장객을, 안전은 사망률을, 정비는 만족을 올린다. 돈은 달마다 나간다', () => {
    const none = run(() => {}), promo = run(w => setBudget(w, 'promo', 1500));
    expect(promo.stat.visits).toBeGreaterThan(none.stat.visits);
    expect(promo.mb.budget + promo.books.reduce((a, b) => a + b.budget, 0)).toBeCloseTo(3000, 0);
    const safe = run(w => setBudget(w, 'safety', 1500)); expect(deathRate(safe)).toBeLessThan(deathRate(none));
    const care = run(w => setBudget(w, 'upkeep', 1500));
    expect(care.stat.sat / care.stat.guests).toBeGreaterThan(none.stat.sat / none.stat.guests);
  });

  it('미궁: 살아 돌아온 손님이 전리품을 지갑에 담아 다음 날 다시 와서 쓴다', () => {
    const w = run(() => {});
    expect(w.stat.loot).toBeGreaterThan(0);
    expect(w.stat.hist.some(d => d.b > 0)).toBe(true);
    const day = w.stat.hist.filter(d => d.b > 0).length; expect(day).toBeGreaterThan(20);
  });

  it('미궁 개척: 돈이 들고, 전리품 · 발길 · 사망률이 함께 오른다', () => {
    const w = newWorld(3); w.clean = 9000; const dr = deathRate(w), loot = lootMean(w), c = delveCost(w), before = w.clean;
    expect(delveUp(w)).toBeNull();
    expect(before - w.clean).toBe(c); expect(lootMean(w)).toBeGreaterThan(loot); expect(deathRate(w)).toBeGreaterThan(dr);
    const a = run(() => {}), b = run(w => { w.delve = 3; });
    expect(b.stat.visits).toBeGreaterThan(a.stat.visits); expect(b.stat.loot / b.stat.visits).toBeGreaterThan(a.stat.loot / a.stat.visits);
    const z = newWorld(3); z.clean = 0; expect(delveUp(z)).toBe('자금 부족');
  });

  it('아무것도 안 하고 두어도 임기 안에 체포 · 파산으로 끝나지 않는다', () => {
    for (const seed of [1, 2, 3, 4]) { const w = newWorld(seed); while (!w.over) step(w); expect(w.over).toBe('term'); }
  });

  it('처음 판: 남작은 여섯 칸, 계급이 오르면 칸이 늘고 마을 주민이 있다', () => {
    const w = newWorld(1);
    for (const k of ['inn', 'inn', 'tavern', 'tavern', 'rental', 'rental'] as const) expect(put(w, k)).toBe(true);
    expect(firstFree(w)).toBe(-1); expect(live(w).length).toBe(6);
    expect(canBuild(w, 6, 'rental')).toBe('닫힌 자리');
    w.rank = 1; expect(slotsOf(w)).toBe(8); expect(firstFree(w)).toBe(6);
    expect(RANKS.length).toBe(5);
    const z = newWorld(2);
    expect(popOf(z)).toBeGreaterThanOrEqual(40); expect(townStage(z)).toBe(0);
    expect(jobsOf(z).farm).toBeGreaterThan(jobsOf(z).guide);
  });

  it('마을: 미궁이 돈이 될수록 농촌에서 관광 도시로 바뀌고 주민이 는다', () => {
    const w = newWorld(6); w.clean = 20000; w.rank = 2;
    const pop0 = popOf(w), farm0 = jobsOf(w).farm / popOf(w);
    for (const k of ['inn', 'tavern', 'casino', 'inn', 'rental', 'lodge', 'tavern'] as const) put(w, k);
    for (let d = 0; d < 400; d++) step(w);
    expect(townStage(w)).toBeGreaterThanOrEqual(2); expect(popOf(w)).toBeGreaterThan(pop0 * 2);
    expect(jobsOf(w).farm / popOf(w)).toBeLessThan(farm0);
    expect(w.notes.some(n => n.text.includes('관광'))).toBe(true);
  });
});
