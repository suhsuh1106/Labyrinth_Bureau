// 용사 파티
import { flag } from './agendas';
import { C, CLASSES, CLASS_SHARE, HERO_NAMES } from './data';
import { habitOn, lootMul, rootLoot, satisfies } from './explore';
import { rows } from './html';
import { rnd } from './rng';
import { S, learn, log } from './state';
import { clamp, eul, fmt, josa, pick } from './util';
import { done } from './world';

export const heroDemand = () => S.hero ? S.hero.members.reduce((a, m) => a + m.pay, 0) : 0;

export const heroPicks = () => S.heroApps.filter(a => a.pick);

export const pickDemand = () => heroPicks().reduce((a, m) => a + m.pay, 0);

export const gearLvl = g => Math.min(1, (g || 0) / 2000);

export const pubMul = p => 0.6 + Math.min(1.4, (p || 0) / 1500);

export const appCount = pay => clamp(Math.round(1 + pay / 1500 + (S.fame - C.FAME0) / 25), 0, 6);

export const appSkill = pay => clamp(Math.round(40 + Math.min(30, pay / 150) + (S.fame - C.FAME0) / 5), 20, 95);

export const fameWord = () => S.fame < 20 ? '관리국을 아는 사람이 드묾' : S.fame < 40 ? '변경에서나 알려짐' : S.fame < 60 ? '이름이 나기 시작함' : S.fame < 80 ? '수도까지 소문이 남' : '제국이 칭송함';

export function fameAdd(v, why?) {
  S.fame = clamp(S.fame + v, 0, 100);
  if (why && Math.abs(v) >= 1) { S.fameLog.push({ m: S.month, v: Math.round(v), t: why }); S.fameLog = S.fameLog.slice(-8); }
}

// 이번 결재로 결성(또는 충원)될지: 후원금이 몸값 합계를 넘어야 한다
export function heroPlan(b) {
  const cur = S.hero ? S.hero.members.length : 0, take = heroPicks().slice(0, C.HERO_MAX - cur);
  const demand = heroDemand() + take.reduce((a, m) => a + m.pay, 0), pay = b.heroPay || 0;
  const forming = !S.hero && take.length >= 2 && pay >= demand, joining = !!S.hero && take.length > 0 && pay >= demand;
  const active = !!S.hero || forming;
  return { take: forming || joining ? take : [], demand, forming, joining, active, spend: active ? pay + (b.heroGear || 0) + (b.heroPub || 0) : 0 };
}

export function newApplicant(pay) {
  const wC = 1 + (S.gC <= -15 ? 1.5 : 0) + (S.budget.priest ? 0.5 : 0), wM = 1 + (S.gM <= -15 ? 1.5 : 0) + (S.budget.heroGear ? 0.5 : 0), wR = 2 + S.trust / 50;
  const origin = pick(['merc', 'church', 'merchant'], [wR, wC, wM]);
  const cls = origin === 'church' && rnd() < 0.6 ? '사제' : pick(CLASSES, CLASS_SHARE);
  const skill = clamp(Math.round(appSkill(pay) + (rnd() - 0.5) * 24), 20, 95);
  const amb = origin === 'church' ? (rnd() < 0.7 ? 0 : 1) : origin === 'merchant' ? (rnd() < 0.5 ? 2 : 1) : Math.floor(rnd() * 3);
  const used = new Set([...S.heroApps, ...(S.hero ? S.hero.members : []), ...S.heroFallen].map(m => m.name));
  const free = HERO_NAMES.filter(n => !used.has(n));
  const name = free.length ? free[Math.floor(rnd() * free.length)] : `무명 용사 ${S.heroSeq + 1}`;
  const fee = Math.round((150 + skill * 10) * (origin === 'church' ? 0.8 : origin === 'merchant' ? 0.9 : 1) * (1 + 0.15 * amb) / 50) * 50;
  return { id: ++S.heroSeq, m: S.month, name, cls, skill, amb, origin, pay: fee, pick: false };
}

// 지원자는 공고 금액과 명성을 보고 온다. 고르지 않은 지원자는 한 달 뒤, 명단에 올린 지원자도 석 달이면 떠난다
export function heroApplicants() {
  S.heroApps = S.heroApps.filter(a => a.pick && S.month - a.m < 3);
  if (S.heroCool > 0) { S.heroCool--; return; }
  const pay = S.budget.heroPay || 0;
  if (!pay || (S.hero && S.hero.members.length >= C.HERO_MAX)) return;
  const n = clamp(appCount(pay) + (rnd() < 0.5 ? 1 : 0) - S.heroApps.length, 0, 6);
  for (let i = 0; i < n; i++) S.heroApps.push(newApplicant(pay));
}

// 실력과 장비로 본 원정 성공률. 공략 조건이 맞는지는 섞지 않는다 (화면에 보이는 값)
export function heroBase(b) {
  const H = S.hero, f = S.unlocked - 1;
  const skill = H.members.reduce((a, m) => a + m.skill, 0) / H.members.length;
  return C.BASE_SUCC[f] + (skill - 50) / 120 + 0.1 * gearLvl(b.heroGear) + (done('seal' + f) ? 0.1 : 0) - 0.06 * (C.HERO_MAX - H.members.length);
}

export function heroJoin(take, forming, notes) {
  take.forEach(a => {
    S.heroApps = S.heroApps.filter(x => x.id !== a.id);
    const { pick: _, ...m } = a; m.joined = S.month;
    S.hero.members.push(m);
    if (!forming) { notes.push(`${m.name}${josa(m.name)} 용사 파티에 합류했습니다.`); }
    if (m.origin === 'church') { S.gC -= 5; learn('church', 'like', 'hero_priest'); }
    if (m.origin === 'merchant') { S.gM -= 5; learn('merchant', 'like', 'hero_backer'); }
  });
}

// 원정: 용사 파티는 늘 가장 깊은 층으로 간다. 기록은 일반 파티 기록에 섞여 증언과 통계가 된다
export function heroRuns(b, ex) {
  const H = S.hero, f = S.unlocked - 1, fl = S.floors[f], gl = gearLvl(b.heroGear);
  const g = fl.guide && fl.guide.startsWith('g:') && (b.heroGear || 0) >= 500 ? fl.guide.slice(2) : '일반';
  const hab = habitOn(fl, ex.byFloor[f].n);
  const r = { f, runs: 0, wins: 0, dead: [], loot: 0 };
  for (let i = 0; i < C.HERO_RUNS && H.members.length >= 2; i++) {
    const p = { c: H.members.map(m => m.cls), g };
    const ok = satisfies(fl.weak, p), bad = !ok && satisfies(fl.mon.bad, p);
    const pr = clamp(heroBase(b) + (ok ? C.KEY_BONUS : 0) - (bad ? 0.05 : 0) - (hab ? 0.05 : 0), 0.05, 0.92);
    const s = rnd() < pr;
    S.exped.push({ m: S.month, f, c: p.c, g, s, a: false, sh: false, t: false, h: true });
    r.runs++; fl.n++;
    if (s) { r.wins++; fl.wins++; r.loot += C.LOOT[f] * 1.2 * lootMul() * rootLoot(f); }
    else if (rnd() < 0.12 * (1 - 0.5 * gl) * (bad ? 1.3 : 1) * (hab ? 1.3 : 1)) r.dead.push(H.members.splice(Math.floor(rnd() * H.members.length), 1)[0]);
  }
  H.runs += r.runs; H.wins += r.wins; H.loot += r.loot;
  return r;
}

export function heroDoc(o) { S.eventDocs.push({ month: S.month + 1, cls: 'secret', kind: '현장 사무소 · 용사 파티', ...o }); }

export function heroDisband(why) {
  const H = S.hero, big = H.glory >= 40, pm = pubMul(S.budget.heroPub);
  fameAdd(-(big ? 15 : 8) * pm, '용사 파티 해체'); S.trust -= big ? 6 : 3;
  H.members.forEach(m => S.heroFallen.push({ ...m, end: '해체', em: S.month }));
  log(`용사 파티 해체: ${why}`);
  heroDoc({ title: '용사 파티가 흩어졌습니다', from: `제${H.formed}월 결성`, stamp: '해체',
    body: `<p>${why}</p>` + rows([['원정 / 성공', `${H.runs} / ${H.wins}번`], ['먼저 연 층', H.opened.length ? H.opened.map(i => `${i + 1}층`).join(', ') : '없음'], ['쌓은 영광', `${Math.round(H.glory)}`]])
      + `<p class="from">이름난 파티일수록 해체 소식이 크게 퍼집니다. 후원금을 다시 걸면 석 달 뒤부터 지원자가 옵니다.</p>` });
  S.hero = null; S.heroCool = 3; S.heroApps = [];
}

// 한 달 치 용사 파티 처리. 돌려주는 값은 결산과 개척에 쓴다
export function heroMonth(b, pr, ex, notes) {
  const out = { runs: 0, wins: 0, dead: [], loot: 0, prog: 0, spend: pr.hero.spend };
  if (pr.hero.forming) {
    S.hero = { formed: S.month, members: [], morale: 60, glory: 0, runs: 0, wins: 0, loot: 0, opened: [] };
    heroJoin(pr.hero.take, true, notes);
    flag('hero');
    fameAdd(4 * pubMul(b.heroPub), '용사 파티 결성');
    log(`용사 파티 결성: ${S.hero.members.map(m => `${m.name}(${m.cls})`).join(', ')}`);
    notes.push(`용사 파티가 결성되었습니다. ${S.hero.members.map(m => m.name).join(', ')}. 다음 원정부터 가장 깊은 층으로 갑니다.`);
  } else if (pr.hero.joining) heroJoin(pr.hero.take, false, notes);
  else if (!S.hero && heroPicks().length >= 2) notes.push('후원금이 명단의 몸값 합계에 못 미쳐 용사 파티를 꾸리지 못했습니다.');
  const H = S.hero;
  if (!H || pr.hero.forming) return out;
  const r = heroRuns(b, ex), pm = pubMul(b.heroPub);
  Object.assign(out, { runs: r.runs, wins: r.wins, dead: r.dead, loot: r.loot, f: r.f });
  out.prog = r.wins * C.HERO_PROG * (done('camp') ? 1.5 : 1);
  H.glory += r.wins * 2;
  if (r.wins) fameAdd(r.wins * 0.6 * pm, `${r.f + 1}층 원정 ${r.wins}번 성공`);
  // 용사의 죽음은 교회와 상단이 각자 셈한다. 이름난 교회 출신 용사가 쓰러지면 교회가 그 죽음을 두고 판단한다
  r.dead.forEach(m => {
    S.heroFallen.push({ ...m, end: '전사', em: S.month });
    fameAdd(-6 * pm, `용사 ${m.name} 전사`); H.morale -= 12;
    S.gC += m.origin === 'church' ? 10 : 5; learn('church', 'hate', 'hero_death');
    if (m.origin === 'merchant') S.gM += 4;
    log(`용사 ${m.name}(${m.cls}) 전사 · ${r.f + 1}층`);
    notes.push(`용사 ${m.name}${josa(m.name)} ${r.f + 1}층에서 돌아오지 못했습니다.`);
    if (m.origin === 'church' && H.glory >= 40) {
      if (S.gC <= 10) {
        S.gC -= 18; fameAdd(6, '교회가 용사를 성인으로 추대'); S.trust += 4; flag('hero_saint');
        log(`교회가 용사 ${m.name}${eul(m.name)} 성인으로 추대`);
        heroDoc({ cls: 'church', kind: '교회 · 추모 미사', title: `교회가 ${m.name}${eul(m.name)} 성인으로 모십니다`, from: '대사제', stamp: '추대',
          body: `<p>교회가 추천한 용사가 최전선에서 쓰러지자, 교회는 그를 미궁의 첫 성인으로 모시기로 했습니다. 미사에는 용병과 신도가 줄을 섰습니다.</p><p class="from">교회와 사이가 나쁘지 않았기에 교회가 이 죽음을 관리국과 함께 기리기로 했습니다.</p>` });
      } else {
        S.gC += 15; fameAdd(-6, '교회가 용사의 죽음을 관리국 탓으로 돌림'); flag('hero_blame');
        log(`교회가 용사 ${m.name}의 죽음을 관리국 탓으로 돌림`);
        heroDoc({ cls: 'church', kind: '교회 · 장례 설교', title: `교회가 ${m.name}의 죽음을 관리국 탓으로 돌립니다`, from: '대사제', stamp: '비난',
          body: `<p>"교회가 내어 준 아이를 관리국이 사지로 몰았습니다." 장례 설교가 변경 곳곳에 퍼졌습니다.</p><p class="from">교회와 사이가 나쁠 때 교회 추천 용사가 쓰러지면 이렇게 됩니다.</p>` });
      }
    }
  });
  // 사기: 몸값을 다 받고, 이기고, 이름이 나면 오른다
  const dem = heroDemand(), pay = b.heroPay || 0, short = dem ? clamp(1 - pay / dem, 0, 1) : 0;
  H.morale += r.wins * 2 - 25 * short + (pay > dem ? Math.min(5, (pay - dem) / 200) : 0) + (S.fame >= 60 ? 2 : 0) - (r.runs && !r.wins ? 5 : 0);
  H.morale = clamp(H.morale + (55 - H.morale) * 0.05, 0, 100);
  if (short > 0 && H.members.length && rnd() < short) {
    const m = [...H.members].sort((x, y) => y.amb - x.amb || y.pay - x.pay)[0];
    H.members = H.members.filter(x => x !== m); S.heroFallen.push({ ...m, end: '이탈', em: S.month });
    log(`용사 ${m.name}${josa(m.name)} 몸값을 못 받아 파티를 떠남`); notes.push(`몸값을 다 받지 못한 용사 ${m.name}${josa(m.name)} 파티를 떠났습니다.`);
  }
  // 이름이 날수록 야심 큰 용사는 몸값을 올린다
  if (H.glory >= 40) H.members.forEach(m => { if (rnd() < [0, 0.05, 0.12][m.amb]) { m.pay = Math.round(m.pay * 1.2 / 50) * 50; notes.push(`용사 ${m.name}${josa(m.name)} 몸값을 ${fmt(m.pay)}G로 올려 달라고 합니다.`); log(`용사 ${m.name}의 몸값이 ${fmt(m.pay)}G로 오름`); } });
  // 배신: 백작이 손을 뻗었고, 야심 큰 용사가 몸값을 넉넉히 받지 못하면
  const ambi = H.members.filter(m => m.amb === 2);
  if (S.lord && H.glory >= 25 && ambi.length && pay < 1.3 * heroDemand() && rnd() < 0.3) {
    const m = ambi[0], go = [m, ...(H.morale < 40 ? H.members.filter(x => x !== m).slice(0, 1) : [])];
    H.members = H.members.filter(x => !go.includes(x)); go.forEach(x => S.heroFallen.push({ ...x, end: '백작령으로', em: S.month }));
    fameAdd(-10 * pm, '용사가 하르덴 백작에게 넘어감'); S.M = Math.max(0, S.M - Math.round(S.M * 0.02)); flag('hero_lord');
    log(`용사 ${go.map(x => x.name).join('·')}${josa(go[go.length - 1].name)} 하르덴 백작령으로 넘어감`);
    heroDoc({ title: `${m.name}${josa(m.name)} 하르덴 백작에게 갔습니다`, from: '서기 보고', stamp: '배신',
      body: `<p>백작령 경비대장 자리를 받아들였습니다.${go.length > 1 ? ` 사기가 떨어져 있던 ${go[1].name}도 따라갔습니다.` : ''} 그를 따르던 용병 몇도 함께 떠났습니다.</p><p class="from">야심 큰 용사에게 몸값을 넉넉히 주지 않으면, 백작이 손을 뻗을 때 흔들립니다.</p>` });
  }
  const mer = H.members.find(m => m.origin === 'merchant' && m.amb >= 1);
  if (mer && S.gM >= 35 && H.glory >= 25 && !S.privateExp && rnd() < 0.25) {
    H.members = H.members.filter(x => x !== mer); S.heroFallen.push({ ...mer, end: '상단 탐사대로', em: S.month });
    S.privateExp = { left: 6 }; S.gM -= 10; fameAdd(-8 * pm, '용사가 상단 사설 탐사대로 감'); flag('hero_merchant');
    log(`용사 ${mer.name}${josa(mer.name)} 상단 사설 탐사대로 감 → 6개월간 최전선 전리품 일부를 상단이 가로챔`);
    heroDoc({ cls: 'merchant', title: `${mer.name}${josa(mer.name)} 상단의 사설 탐사대를 맡았습니다`, from: '상단 조합장', stamp: '이탈',
      body: `<p>"관리국이 저희를 홀대하니, 저희가 추천한 사람은 저희가 데려가겠습니다." 상단이 ${mer.name}${eul(mer.name)} 앞세워 최전선에서 전리품을 먼저 챙기기 시작했습니다.</p><p class="from">여섯 달 동안 전리품 수입이 10% 줄어듭니다. 상단이 서운할 때 상단 추천 용사를 두면 생기는 일입니다.</p>` });
  }
  // 몰락: 사기가 바닥나거나 둘 아래로 줄면 파티가 흩어진다
  if (H.morale <= 15 || H.members.length < 2) {
    heroDisband(H.members.length < 2 ? '남은 용사가 혼자가 되어 파티가 흩어졌습니다.'
      : short >= 0.5 ? '후원금이 끊기자 용사들이 하나둘 짐을 쌌습니다.'
      : r.dead.length ? '동료를 잃은 용사들이 더는 최전선에 서지 않겠다고 합니다.' : '성과 없는 원정이 이어지자 용사들이 흩어졌습니다.');
  }
  return out;
}

// 용사가 그 층 개척의 절반 이상을 해내고 길을 열면, 새 층에 용병이 뒤따른다
export function heroOpened(prevFloor, notes) {
  const fl = S.floors[prevFloor];
  if (!S.hero || (fl.heroProg || 0) < 50) return;
  const nf = S.floors[prevFloor + 1];
  if (nf) nf.trail = S.month + C.TRAIL_M;
  S.hero.opened.push(prevFloor + 1); S.hero.glory += 15; S.hero.morale = Math.min(100, S.hero.morale + 10);
  fameAdd(8 * pubMul(S.budget.heroPub), `용사 파티가 ${prevFloor + 2}층 길을 엶`); S.trust += 3;
  log(`용사 파티가 ${prevFloor + 1}층 개척을 이끌어 ${prevFloor + 2}층 길을 엶 → 용병이 뒤따름`);
  notes.push(`용사 파티가 ${prevFloor + 2}층으로 가는 길을 먼저 냈습니다. 용병들이 그 뒤를 따라 내려갑니다.`);
}
