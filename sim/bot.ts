// 봇 플레이어: 부서 방침을 고르고 부서를 키우며, 개척 사업과 안건과 제안, 공략본과 용사 파티까지 건드린다.
// 봇의 선택은 게임 난수와 따로 도는 자기 난수로 정해서, 봇이 바뀌어도 게임 난수 흐름이 흔들리지 않게 한다.
import { compileBudget, dept, deptOk, type DeptId } from '../src/core/org';

export type GameApi = {
  S: () => any;
  prices: () => any;
  project: (b: any) => any;
  heroPlan?: (b: any) => any;
  DEV?: any[];
  AGENDAS: any[];
  KEYS: string[];
};

export function botRng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// smart: 증언을 모아 약점을 알아낸 플레이어 흉내. 새 층이 열리고 몇 달 지나면 맞는 공략본을 내고, 공략 지원금을 댄다
export type BotStyle = { hero?: boolean; cartel?: 'donate' | 'audit' | 'none'; wild?: boolean; smart?: boolean };

// 이번 달 결재 전에 예산과 선택을 채운다
export function botTurn(api: GameApi, r: () => number, style: BotStyle = {}) {
  const S = api.S();
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  // 부서 신설·확장: 한 달에 하나, 금고에 여유가 있을 때만
  const want: [DeptId, number][] = [];
  const run = !api.DEV || S.phase === 'run';
  if (style.cartel === 'donate' && run) want.push(['outer', 1]);
  if (style.cartel === 'audit' && run) want.push(['audit', 2]);
  if (style.smart && run) want.push(['explore', 1]);
  if (style.wild && run) want.push(['audit', 1], ['explore', 1], ['press', 1]);
  const up = want.find(([id, n]) => S.org.lv[id] < n && deptOk(dept(id)));
  S.org.up = up && S.treasury > dept(up[0]).cost[S.org.lv[up[0]]] + 5000 ? up[0] : null;
  // 방침
  const pol = S.org.pol;
  pol.supply = 2;
  pol.outer = S.cartel && style.cartel === 'donate' ? 2 : 1;
  pol.audit = style.cartel === 'audit' ? (S.cartel ? 2 : 0) : style.wild && S.month % 3 === 0 ? 1 : 0;
  pol.explore = style.wild ? 2 : style.smart ? 1 : 0;
  pol.press = style.wild ? 1 : 0;
  if (style.wild) {
    S.offers.forEach(o => { if (r() < 0.5) o.accepted = true; });
    const f = S.unlocked - 1;
    if (!S.floors[f].guide && !S.pendingGuide && S.month % 4 === 0) S.pendingGuide = { f, key: r() < 0.5 ? S.floors[f].weak : pick(api.KEYS) };
    if (S.month % 7 === 0) S.fees[0] = 50; else if (S.month % 7 === 3) S.fees[0] = 0;
  }
  if (style.smart && run) {
    const f = S.unlocked - 1, fl = S.floors[f];
    if (fl.guide !== fl.weak && !S.pendingGuide && fl.n >= 30) S.pendingGuide = { f, key: fl.weak };
  }
  pol.hero = 0;
  if (style.hero && S.month >= 8 && run) {
    if (!S.hero) { S.heroApps.forEach(a => { a.pick = false; }); S.heroApps.slice().sort((a, b) => b.skill - a.skill).slice(0, 3).forEach(a => { a.pick = true; }); }
    pol.hero = 2;
  }
  compileBudget();
  if (S.agenda) {
    const A = api.AGENDAS.find(a => a.id === S.agenda.id);
    const ok = A.opts.map((o, i) => (!o.need || o.need()) ? i : -1).filter(i => i >= 0);
    S.agenda.pick = style.wild ? pick(ok) : null;
  }
}
