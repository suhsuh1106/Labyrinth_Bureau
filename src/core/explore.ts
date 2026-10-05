// 탐사, 보급품, 직업·장비 수급
import { C, CLASSES, CLASS_SHARE, GEARS, GEAR_SHARE } from './data';
import { prices } from './economy';
import { rnd } from './rng';
import { S } from './state';
import { clamp, pick } from './util';
import { done } from './world';

export const partyCount = () => Math.max(1, Math.round(S.M / 4));

export const onTrail = i => !!(S.floors[i].trail && S.month <= S.floors[i].trail);

export const lootMul = () => done('appraise') ? 1.4 : done('consign') ? 1.15 : 1;

export function deathRisk(f, cov) {
  return 0.3 * (1 + 1.5 * (1 - cov)) * (done('clinic') ? 0.6 : 1) * (S.deals.novice ? 0.7 : 1) * (done('camp') && f === S.unlocked - 1 ? 0.6 : 1) * (onTrail(f) ? 0.75 : 1) * S.deathMul;
}

// 용병은 층마다 기대 전리품, 사망 위험, 붐빔, 입장료를 따져 갈 곳을 고른다
export function floorValue(i, cov) {
  const rec = S.exped.filter(e => e.f === i && e.m >= S.month - 3);
  const base = clamp(C.BASE_SUCC[i] * (0.6 + 0.4 * cov), 0.05, 0.95);
  const pS = rec.length >= 4 ? 0.5 * base + 0.5 * rec.filter(e => e.s).length / rec.length : base;
  const lastN = S.last && S.last.ex.byFloor[i] ? S.last.ex.byFloor[i].n : 0;
  const crowd = Math.min(1, C.FLOOR_CAP / Math.max(1, lastN));
  // 용사가 먼저 길을 낸 층은 한동안 용병이 뒤따라 몰린다
  const frontier = (i === S.unlocked - 1 && S.floors[i].prog < 100 ? C.FRONTIER : 0) + (onTrail(i) ? C.TRAIL : 0);
  return pS * C.LOOT[i] * crowd - (1 - pS) * deathRisk(i, cov) * C.LIFE + frontier - S.fees[i];
}

export function floorShares(cov) {
  const v = S.floors.slice(0, S.unlocked).map((_, i) => floorValue(i, cov));
  const top = Math.max(...v), w = v.map(x => Math.exp((x - top) / C.CHOICE_T)), t = w.reduce((a, b) => a + b, 0);
  return S.floors.map((_, i) => i < S.unlocked ? w[i] / t : 0);
}

export const repairPrice = () => Math.round(prices().m / 10) * 10;

// 교회는 서운함이 쌓이면 곳간을 덜 연다
export const foodFulfill = () => clamp(1 - Math.max(0, S.gC - 15) / 100, 0.5, 1);

export function provisions(b, sh) {
  const n = partyCount();
  const haulUnit = sh.reduce((a, x, i) => a + x * C.HAUL_COST * (i + 1), 0);
  const item = (k, need, unit, fulfill = 1) => {
    const full = Math.ceil(need * unit), paid = Math.min(b[k] || 0, full);
    const got = need ? Math.min(need, Math.floor(need * paid / Math.max(1, full) * fulfill + 1e-9)) : 0;
    return { need, unit, full, spend: Math.round(got * unit), paidCov: full ? paid / full : 1, cov: need ? got / need : 1, fulfill };
  };
  const r: any = { food: item('food', S.M, C.FOOD_COST, foodFulfill()), repair: item('repair', n, repairPrice()), haul: item('haul', n, haulUnit) };
  r.spend = r.food.spend + r.repair.spend + r.haul.spend;
  return r;
}

// 부족했을 때의 결과: 식량은 이탈, 정비는 성공률, 운송은 전리품
export const repairMul = c => 0.8 + 0.2 * c;

export const haulMul = c => 0.4 + 0.6 * c;

export const foodLeave = (c, M) => Math.round((1 - c) * M * 0.06);

export const rentPrice = () => Math.round(prices().m * 3 / 10) * 10;

export const churchFulfill = () => clamp(1 - Math.max(0, S.gC) / 100, 0.3, 1);

export function guideKeys() {
  const ks = S.floors.slice(0, S.unlocked).map((f, i) => S.pendingGuide && S.pendingGuide.f === i ? S.pendingGuide.key : f.guide).filter(Boolean);
  // 짝 습성을 알아낸 층은 공략본을 따르는 파티가 짝까지 구하러 다닌다
  S.floors.slice(0, S.unlocked).forEach(f => { if (f.guide && f.habitKnown && f.mon.habit.k === 'pair') ks.push(f.mon.habit.pk); });
  return [...new Set(ks)] as string[];
}

export function supply(b) {
  const keys = guideKeys();
  const gk = keys.filter(k => k.startsWith('g:')), ck = keys.filter(k => k.startsWith('c:') && k !== 'c:사제');
  const rp = rentPrice();
  const sets = gk.length ? Math.floor((b.rent || 0) / rp) : 0;
  const priestPaid = Math.floor((b.priest || 0) / C.PRIEST_COST), priests = Math.floor(priestPaid * churchFulfill());
  const heads = ck.length && !S.union ? Math.floor((b.recruit || 0) / C.RECRUIT_COST) : 0;
  return { gk, ck, rp, sets, priestPaid, priests, heads, rentSpend: sets * rp, priestSpend: priestPaid * C.PRIEST_COST, recruitSpend: heads * C.RECRUIT_COST };
}

// 이번 달 파티에 들어갈 수 있는 직업별 인원과 장비 수
export function pools(sup) {
  const n = partyCount();
  const cls = S.cls.map(v => Math.max(0, Math.round(v)));
  cls[CLASSES.indexOf('사제')] += sup.priests + (S.deals.novice ? Math.round(S.M * 0.15) : 0);
  const gm = S.deals.gear ? 2 : 1;
  const gear = GEARS.map((g, i) => i ? Math.round(n * GEAR_SHARE[i] * gm * C.GEAR_MARKET) : 0);
  sup.gk.forEach((k, j) => { gear[GEARS.indexOf(k.slice(2))] += Math.floor(sup.sets / sup.gk.length) + (j < sup.sets % sup.gk.length ? 1 : 0); });
  return { cls, gear, gm };
}

export const satisfies = (key, p) => key.startsWith('c:') ? p.c.includes(key.slice(2)) : p.g === key.slice(2);

// 습성: 돌아오는 달(cycle)이나 파티가 몰린 달(crowd)에 사나워진다. pair는 약점과 짝이 맞으면 더 잘 통한다
export const habitOn = (fl, nf) => fl.mon.habit.k === 'cycle' ? (S.month + fl.ph) % 4 === 0 : fl.mon.habit.k === 'crowd' ? nf > C.CROWD_N : false;

export const nextCycle = fl => { for (let m = S.month; m < S.month + 4; m++) if ((m + fl.ph) % 4 === 0) return m; return S.month; };

export const rootLoot = i => done('seal' + i) ? 0.9 : done('mine' + i) ? 1.5 : 1;

export const rootPress = i => done('seal' + i) ? 0.3 : done('mine' + i) ? 2.5 : 1;

export function explore(cov, adopt, sup, pv) {
  const n = partyCount();
  const u = S.unlocked, deep = u - 1;
  const sh = floorShares(cov);
  const pl = pools(sup);
  const res: any = { n, u, wins: 0, deaths: 0, loot: 0, repairLost: 0, haulLost: 0, want: 0, adopted: 0, short: 0, feeIn: 0, feeOut: 0, byFloor: S.floors.map(() => ({ n: 0, w: 0, loot: 0, d: 0, got: 0, want: 0, a: 0, short: 0 })) };
  const drawClass = () => {
    if (pl.cls.reduce((a, b) => a + b, 0) <= 0) return pick(CLASSES, CLASS_SHARE);
    const c = pick(CLASSES, pl.cls); pl.cls[CLASSES.indexOf(c)]--; return c;
  };
  const drawGear = () => {
    const g = pick(GEARS, GEARS.map((_, i) => i ? (pl.gear[i] > 0 ? GEAR_SHARE[i] * pl.gm : 0) : GEAR_SHARE[0]));
    if (g !== '일반') pl.gear[GEARS.indexOf(g)]--;
    return g;
  };
  // 시험 탐사: 관리국이 돈을 대 고른 층에 고른 조건으로 파티를 보낸다 (수급과 상관없이 갖춰 준다)
  const T = S.trial && S.trial.f < u ? S.trial : null;
  const nt = T ? Math.min(n, Math.floor((S.budget.trial || 0) / C.TRIAL_COST)) : 0;
  res.trial = T ? { f: T.f, key: T.key, n: 0, w: 0, d: 0 } : null;
  // 공략본을 따르려는 파티가 먼저 필요한 사람과 장비를 구하러 다닌다
  const plan = [];
  for (let i = 0; i < n; i++) {
    if (i < nt) { plan.push({ f: T.f, t: true, will: false, r: -1 }); continue; }
    const f = u === 1 ? 0 : pick(S.floors.slice(0, u).map((_, j) => j), sh.slice(0, u));
    plan.push({ f, will: !!S.floors[f].guide && rnd() < adopt, r: rnd() });
  }
  plan.sort((x, y) => (y.t ? 1 : 0) - (x.t ? 1 : 0) || (y.will - x.will) || (x.r - y.r));
  const nf = S.floors.map((_, i) => plan.filter(p => p.f === i).length);
  plan.forEach(({ f, will, t }) => {
    const bf = res.byFloor[f], fl = S.floors[f], gk = fl.guide;
    let c, g, a = false, short = false;
    if (t) {
      c = [drawClass(), drawClass(), drawClass(), drawClass()]; g = drawGear();
      const put = (k, slot) => { if (k.startsWith('c:')) c[slot] = k.slice(2); else g = k.slice(2); };
      if (gk && gk !== T.key && !(gk.startsWith('g:') && T.key.startsWith('g:'))) put(gk, 1);
      put(T.key, 0);
    } else if (will && gk.startsWith('c:')) {
      const ci = CLASSES.indexOf(gk.slice(2));
      if (pl.cls[ci] > 0) { pl.cls[ci]--; c = [gk.slice(2), drawClass(), drawClass(), drawClass()]; }
      else c = [drawClass(), drawClass(), drawClass(), drawClass()];
      g = drawGear();
    } else if (will) {
      const gi = GEARS.indexOf(gk.slice(2));
      c = [drawClass(), drawClass(), drawClass(), drawClass()];
      if (pl.gear[gi] > 0) { pl.gear[gi]--; g = gk.slice(2); } else g = drawGear();
    } else { c = [drawClass(), drawClass(), drawClass(), drawClass()]; g = drawGear(); }
    // 짝 습성을 아는 층에서는 공략본을 따르는 파티가 짝도 구해 본다
    const H = fl.mon.habit;
    if (will && fl.habitKnown && H.k === 'pair' && !satisfies(H.pk, { c, g })) {
      if (H.pk.startsWith('c:')) { const ci = CLASSES.indexOf(H.pk.slice(2)); if (pl.cls[ci] > 0) { pl.cls[ci]--; c[3] = H.pk.slice(2); } }
      else if (!gk.startsWith('g:')) { const gi = GEARS.indexOf(H.pk.slice(2)); if (pl.gear[gi] > 0) { pl.gear[gi]--; g = H.pk.slice(2); } }
    }
    if (will) { a = satisfies(gk, { c, g }); short = !a; res.want++; bf.want++; if (a) { res.adopted++; bf.a++; } else { res.short++; bf.short++; } }
    const p = { c, g };
    // 약점을 찔렀으면 역효과 조건이 섞여 있어도 덮인다
    const ok = satisfies(fl.weak, p), bad = !ok && satisfies(fl.mon.bad, p);
    const pair = ok && H.k === 'pair' && satisfies(H.pk, p), hab = habitOn(fl, nf[f]);
    const base = C.BASE_SUCC[f] + (ok ? C.KEY_BONUS : 0) - (bad ? 0.05 : 0) + (pair ? 0.12 : 0) + (done('seal' + f) ? 0.1 : 0) - (hab ? 0.05 : 0);
    // 장비 정비가 모자라면 그만큼 성공률이 깎인다
    const pr0 = clamp(base * (0.6 + 0.4 * cov), 0.05, 0.95);
    const pr = pr0 * repairMul(pv.repair.cov);
    res.repairLost += pr0 - pr;
    const s = rnd() < pr;
    S.exped.push({ m: S.month, f, c, g, s, a, sh: short, t: !!t });
    bf.n++; fl.n++;
    if (S.fees[f] > 0) res.feeIn += S.fees[f]; else res.feeOut -= S.fees[f];
    let died = false;
    if (s) { res.wins++; bf.w++; fl.wins++; bf.loot += C.LOOT[f] * lootMul() * rootLoot(f); }
    else if (rnd() < deathRisk(f, cov) * (bad ? 1.15 : 1) * (hab ? (fl.habitKnown ? 1 : 1.3) : 1)) { res.deaths++; bf.d++; died = true; }
    if (t) { res.trial.n++; if (s) res.trial.w++; if (died) res.trial.d++; }
  });
  // 한 층에 파티가 몰리면 전리품이 나뉘어 줄어든다 (층당 FLOOR_CAP 파티까지는 온전히)
  // 짐꾼이 모자라면 꺼낸 전리품을 다 들고 나오지 못한다
  const hm = haulMul(pv.haul.cov);
  res.byFloor.forEach((bf, i) => { bf.crowd = bf.n ? Math.min(1, C.FLOOR_CAP / bf.n) : 1; bf.got = Math.round(bf.loot * bf.crowd * hm); res.haulLost += Math.round(bf.loot * bf.crowd) - bf.got; res.loot += bf.got; S.floors[i].lootTotal = (S.floors[i].lootTotal || 0) + bf.got; });
  return res;
}
