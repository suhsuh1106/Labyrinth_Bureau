// 미궁의 비밀: 증언 · 습성 · 적응 · 근원
import { C, GEARS, ROOT_LORE, SRC } from './data';
import { guideKeys, habitOn, satisfies } from './explore';
import { rnd } from './rng';
import { S, log } from './state';
import { clamp, eul, keyWord } from './util';
import { done } from './world';

export function sayLine(fl, i, src, t, notes, id) {
  if (id) fl.heard[id] = S.month;
  fl.say.push({ m: S.month, src, t });
  log(`${i + 1}층 증언 (${SRC[src]}): "${t}"`);
  notes.push(`${i + 1}층 · ${SRC[src]}: "${t}"`);
}

export function floorSecrets(notes, ex) {
  const boost = done('mapper') ? 1.6 : 1, th = done('mapper') ? [5, 20] : [8, 30];
  let lines = 0;
  S.floors.forEach((fl, i) => {
    if (i >= S.unlocked) return;
    const rec = S.exped.filter(e => e.m === S.month && e.f === i), H = fl.mon.habit;
    // 1. 증언: 겉모습은 다녀간 파티 수만큼, 반응은 그 조건을 실제로 데려간 파티에서만 나온다
    if (lines < 3) {
      const cands = [];
      [0, 1].forEach(k => { if (!fl.heard['look' + k] && (k === 0 || fl.heard.look0) && fl.n >= th[k]) cands.push({ id: 'look' + k, t: fl.mon.look[k], src: 'merc', p: 1 }); });
      const odds = (id, list) => 1 - list.reduce((a, e) => a * (1 - (e.t ? 0.3 : e.h ? 0.2 : 0.04 * boost)), 1);
      const srcOf = l => l.some(e => e.t) ? 'trial' : l.some(e => e.h) ? 'hero' : 'merc';
      const goodId = 'good:' + fl.weak;
      if (!fl.heard[goodId]) { const l = rec.filter(e => e.s && satisfies(fl.weak, e)); if (l.length) cands.push({ id: goodId, t: fl.adapted ? fl.mon.altSay : fl.mon.good, src: srcOf(l), p: odds(goodId, l) }); }
      if (!fl.heard.bad) { const l = rec.filter(e => !e.s && satisfies(fl.mon.bad, e)); if (l.length) cands.push({ id: 'bad', t: fl.mon.badSay, src: srcOf(l), p: odds('bad', l) }); }
      if (ex.trial && ex.trial.f === i && ex.trial.n >= 3) {
        const k = ex.trial.key, id = 'nil:' + k;
        if (k !== fl.weak && k !== fl.mon.bad && !fl.heard[id]) cands.push({ id, t: `${keyWord(k)}${eul(keyWord(k))} 앞세운 시험반은 다른 조와 별 차이를 느끼지 못했습니다.`, src: 'trial', p: 0.6 });
      }
      const hit = cands.find(c => rnd() < c.p);
      if (hit) { sayLine(fl, i, hit.src, hit.t, notes, hit.id); lines++; }
    }
    // 2. 습성: 사나워지는 조건을 실제로 겪어야 알게 된다. 짝 습성은 시험반만 알아챈다
    if (!fl.habitKnown) {
      if (H.k === 'cycle' && habitOn(fl, 0)) fl.hv += rec.filter(e => !e.s).length;
      if (H.k === 'crowd' && rec.length > C.CROWD_N) fl.hv += rec.filter(e => !e.s).length;
      if (H.k === 'pair') fl.hv += rec.filter(e => e.t && e.s && satisfies(fl.weak, e) && satisfies(H.pk, e)).length;
      if (fl.hv >= (H.k === 'pair' ? 4 : 10)) {
        fl.habitKnown = S.month;
        sayLine(fl, i, H.k === 'pair' ? 'trial' : 'merc', H.say, notes, 'habit');
        log(`${i + 1}층 몬스터의 습성을 알아냄`);
      }
    }
    // 3. 적응: 맞는 공략본을 많은 파티가 오래 따르면 몬스터가 버릇을 바꾼다
    if (fl.guide && fl.guide === fl.weak && !fl.adapted) {
      fl.exploit += rec.filter(e => satisfies(fl.weak, e)).length;
      if (fl.exploit >= C.ADAPT) {
        fl.adapted = S.month; fl.weak = fl.mon.alt; fl.guideOk = fl.guide === fl.weak; S.trust -= 2;
        log(`${i + 1}층 몬스터가 공략법에 적응한 것 같음`);
        notes.push(`${i + 1}층 공략본대로 했는데 요즘은 잘 안 통한다는 말이 돕니다. 놈들이 달라진 것 같습니다.`);
      }
    }
    // 4. 근원: 약점을 맞히고, 습성을 알고, 이 층에서 성공이 쌓이고, 지도나 야영지가 있어야 찾아 나설 수 있다
    if (!fl.root && rootReady(fl) && rnd() < 0.3) {
      fl.root = S.month;
      const nr = S.floors.filter(f => f.root).length, lore = ROOT_LORE[Math.min(nr, ROOT_LORE.length) - 1];
      log(`${i + 1}층 근원 발견`);
      notes.push(`${i + 1}층에서 몬스터의 근원을 찾았습니다.`);
      S.eventDocs.push({ month: S.month + 1, cls: 'secret', kind: '현장 사무소 · 탐사 보고', title: `${i + 1}층의 근원을 찾았습니다`, from: `${fl.mon.name}`, stamp: '근원',
        body: `<p>${fl.mon.root}</p><p>${lore}</p><p class="from">개척 시설 탭에서 이 근원을 봉인하거나 채굴장을 낼 수 있습니다. 봉인하면 미궁이 덜 차오르고, 채굴하면 돈이 됩니다.</p>` });
    }
  });
  factionRumor(notes);
}

export const rootReady = fl => fl.habitKnown && fl.guide === fl.weak && fl.wins >= 30 && (done('mapper') || done('camp'));

// 세력도 증언을 퍼뜨린다. 자기 물건이 팔리는 쪽으로. 서운한 세력일수록 사실이 아닌 말도 섞는다
export function factionRumor(notes) {
  const open = S.floors.slice(0, S.unlocked).map((_, i) => i).filter(i => S.floors[i].guide !== S.floors[i].weak);
  if (!open.length || rnd() > 0.35) return;
  const who = rnd() < 0.5 ? 'church' : 'merchant', g = who === 'church' ? S.gC : S.gM;
  const i = open[Math.floor(rnd() * open.length)], fl = S.floors[i];
  const rented = guideKeys().filter(k => k.startsWith('g:'));
  const claim = who === 'church' ? 'c:사제' : rented.length ? rented[Math.floor(rnd() * rented.length)] : 'g:' + GEARS[1 + Math.floor(rnd() * 4)];
  const id = 'rumor:' + claim;
  if (fl.heard[id]) return;
  const truth = claim === fl.weak;
  if (truth ? rnd() > 0.6 : (g <= -15 || rnd() > clamp(0.35 + g / 150, 0.1, 0.8))) return;
  sayLine(fl, i, who, who === 'church' ? '사제가 기도를 올린 조는 무사했다고 합니다. 교회는 사제를 더 보내 드릴 수 있답니다.'
    : `${claim.slice(2)} 장비가 제값을 했다고 합니다. 상단 창고에 물량이 넉넉하답니다.`, notes, id);
}
