// 봇 플레이어: 예산을 채우고, 개척 사업과 안건과 제안을 고르고, 공략본과 용사 파티까지 건드린다.
// 게임 함수 묶음(api)만 받기 때문에 새 코드와 옛 프로토타입에 똑같이 쓸 수 있다.
// 봇의 선택은 게임 난수와 따로 도는 자기 난수로 정해서, 두 코드의 난수 흐름이 섞이지 않게 한다.

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

export type BotStyle = { hero?: boolean; cartel?: 'donate' | 'audit' | 'none'; wild?: boolean };

// 이번 달 결재 전에 예산과 선택을 채운다
export function botTurn(api: GameApi, r: () => number, style: BotStyle = {}) {
  const S = api.S();
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  if (api.DEV && S.phase === 'found') {
    api.DEV.forEach(d => {
      if (S.dev[d.id] || S.devPick[d.id] != null || (d.need && !d.need())) return;
      if (d.core || r() < 0.4) S.devPick[d.id] = Math.floor(r() * d.opts.length);
    });
  }
  const P = api.prices(), need = S.M * 2, qC = Math.min(S.cap, need);
  S.budget.potC = qC * P.c; S.budget.potM = Math.max(0, need - qC) * P.m;
  const pv = api.project({ ...S.budget, food: 1e9, repair: 1e9, haul: 1e9 }).pv;
  ['food', 'repair', 'haul'].forEach(k => { S.budget[k] = Math.ceil(pv[k].full / 100) * 100; });
  S.budget.donation = S.cartel && style.cartel === 'donate' ? S.custom + 2500 : S.custom;
  S.budget.audit = S.cartel && style.cartel === 'audit' ? 3000 : style.wild && S.month % 5 === 0 ? 1500 : 0;
  if (style.wild) {
    S.budget.intel = S.month % 3 === 0 ? 1500 : 0;
    S.budget.support = 1500;
    S.offers.forEach(o => { if (r() < 0.5) o.accepted = true; });
    const f = S.unlocked - 1;
    if (!S.floors[f].guide && !S.pendingGuide && S.month % 4 === 0) S.pendingGuide = { f, key: r() < 0.5 ? S.floors[f].weak : pick(api.KEYS) };
    if (S.month % 7 === 0) S.fees[0] = 50; else if (S.month % 7 === 3) S.fees[0] = 0;
  }
  if (style.hero && api.heroPlan && S.month >= 8 && (!api.DEV || S.phase === 'run')) {
    if (!S.hero) { S.heroApps.forEach(a => { a.pick = false; }); S.heroApps.slice().sort((a, b) => b.skill - a.skill).slice(0, 3).forEach(a => { a.pick = true; }); }
    S.budget.heroPay = Math.max(2000, Math.ceil(api.heroPlan(S.budget).demand * 1.1 / 100) * 100);
    S.budget.heroGear = 800;
  }
  if (S.agenda) {
    const A = api.AGENDAS.find(a => a.id === S.agenda.id);
    const ok = A.opts.map((o, i) => (!o.need || o.need()) ? i : -1).filter(i => i >= 0);
    S.agenda.pick = style.wild ? pick(ok) : null;
  }
}
