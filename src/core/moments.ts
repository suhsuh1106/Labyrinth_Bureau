// 결재 뒤의 순간들: 방금 지난 달에 일어난 일을 연출에 쓸 모양으로 모은다.
// 신문과 마찬가지로 이미 남은 기록(탐사 기록 · 로그 · 용사 · 평가)만 읽고, 상태에는 아무것도 쓰지 않는다.
import { CLASSES } from './data';
import { S } from './state';
import { josa } from './util';

export type Party = { f: number; c: string[]; g: string; s: boolean; a: boolean; t: boolean; h: boolean };
export type Moments = {
  m: number;
  ret: null | {
    parties: Party[];
    floors: { f: number; n: number; w: number; d: number; got: number; per: number }[];
    wins: number; n: number; deaths: number; loot: number; stored: boolean;
    verdicts: { f: number; aw: number; an: number; ow: number; on: number }[];
  };
  guide: null | { f: number; ok: boolean; order: string; issued: number; mon: string | null; gains: string[] };
  obits: { name: string; cls: string; origin: string; joined: number; f: number; after: 'saint' | 'blame' | null }[];
  review: null | { year: number; items: { label: string; target: string; actual: string; ok: boolean }[]; grade: string; reward: string };
};

const logsOf = (m: number) => S.log.filter(e => e.m === m).map(e => e.t);

// 공략본 문구: "마법사가 있는 파티로 가라", "화염 장비를 들고 가라"
export const guideOrder = (key: string) => key.startsWith('c:') ? `${key.slice(2)}${josa(key.slice(2))} 있는 파티로 가라` : `${key.slice(2)} 장비를 들고 가라`;

export function monthMoments(m = S.month - 1): Moments {
  const logs = logsOf(m);
  const out: Moments = { m, ret: null, guide: null, obits: [], review: null };

  // 귀환 보고: 파티 하나하나의 기록과 층별 합계
  const parties: Party[] = S.exped.filter(e => e.m === m).map(e => ({ f: e.f, c: e.c, g: e.g, s: !!e.s, a: !!e.a, t: !!e.t, h: !!e.h }));
  const L = S.last && S.last.month === m ? S.last : null;
  if (parties.length && L) {
    const ex = L.ex;
    const floors = ex.byFloor.map((b, f) => ({ f, n: b.n, w: b.w, d: b.d, got: b.got, per: 0 })).filter(x => x.n);
    if (L.hr && L.hr.runs) {
      const hf = floors.find(x => x.f === L.hr.f);
      if (hf) { hf.n += L.hr.runs; hf.w += L.hr.wins; hf.d += L.hr.dead.length; }
      else floors.push({ f: L.hr.f, n: L.hr.runs, w: L.hr.wins, d: L.hr.dead.length, got: 0, per: 0 });
    }
    const got = floors.reduce((a, x) => a + x.got, 0) + Math.round(L.hr?.loot || 0);
    const loot = (L.loot || 0) + (L.heroLoot || 0);
    // 성공한 파티 하나가 들고 온 몫: 층에서 꺼낸 전리품을 그 층 성공 파티 수로 나누고, 판로 값(감정가 배율)을 곱한다
    const exGot = ex.byFloor.reduce((a, b) => a + b.got, 0), rate = exGot && L.loot ? L.loot / exGot : 1;
    floors.forEach(x => { const w = ex.byFloor[x.f].w; x.per = w ? Math.round(ex.byFloor[x.f].got / w * rate) : 0; });
    // 공략본이 있던 층마다, 따른 조와 안 따른 조의 성적
    const verdicts = S.floors.map((fl, f) => {
      const here = parties.filter(p => p.f === f && !p.t && !p.h);
      const A = here.filter(p => p.a), O = here.filter(p => !p.a);
      return { f, aw: A.filter(p => p.s).length, an: A.length, ow: O.filter(p => p.s).length, on: O.length };
    }).filter(v => v.an > 0);
    out.ret = { parties, floors: floors.sort((a, b) => a.f - b.f), wins: parties.filter(p => p.s).length, n: parties.length,
      deaths: ex.deaths + (L.hr?.dead?.length || 0), loot: loot || got, stored: !loot && got > 0, verdicts };
  }

  // 공략본 적중 / 빗나감 (발간 다음 달에 판가름)
  const hit = logs.map(t => t.match(/^(\d+)층 공략본(?: 적중|이 빗나감)/)).find(Boolean);
  if (hit) {
    const f = +hit[1] - 1, fl = S.floors[f], ok = hit[0].endsWith('적중');
    out.guide = { f, ok, order: fl.guide ? guideOrder(fl.guide) : '', issued: fl.guideMonth ?? m, mon: fl.known >= 2 ? fl.mon.name : null,
      gains: ok ? ['용병 신뢰 +10', '공략본을 따르는 파티가 늘어요'] : ['용병 신뢰 −8', '공략본을 믿는 파티가 줄어요'] };
  }

  // 부고: 이번 달 쓰러진 용사
  out.obits = S.heroFallen.filter(h => h.end === '전사' && h.em === m).map(h => {
    const fm = logs.map(t => t.match(new RegExp(`^용사 ${h.name}\\(.+\\) 전사 · (\\d+)층`))).find(Boolean);
    const after = logs.some(t => t.includes(`용사 ${h.name}`) && /성인으로 추대/.test(t)) ? 'saint' as const
      : logs.some(t => t.includes(`용사 ${h.name}`) && /관리국 탓/.test(t)) ? 'blame' as const : null;
    return { name: h.name, cls: h.cls, origin: h.origin, joined: h.joined ?? m, f: fm ? +fm[1] : S.unlocked, after };
  });

  // 임기 평가: 이 달 말에 평가가 있었다면
  const ev = S.evals.find(e => e.month === m + 1);
  if (ev) out.review = { year: ev.year, items: ev.items, grade: ev.grade, reward: ev.reward };
  return out;
}

// 책상 위 기념품: 판에서 처음 겪은 큰 순간마다 하나씩 걸린다. 걸린 달(m)은 기록에서 찾는다
export type Keepsake = { id: string; name: string; how: string; m: number | null; note?: string };
export function keepsakes(): Keepsake[] {
  const first = (re: RegExp) => { const e = S.log.find(x => re.test(x.t)); return e ? e.m : null; };
  const opened = [...S.log].reverse().find(x => /층 개척 완료 → \d+층 개방/.test(x.t));
  const fallen = S.heroFallen.find(h => h.end === '전사');
  const medal = S.evals.find(e => e.grade === '우수');
  return [
    { id: 'market', name: '첫 판로 계약서', how: '판로를 열면', m: first(/^판로 개통/) },
    { id: 'guide', name: '첫 적중 공략본', how: '공략본을 맞히면', m: first(/층 공략본 적중/) },
    { id: 'key', name: opened ? `${opened.t.match(/(\d+)층 개방/)[1]}층 문 열쇠` : '새 층의 문 열쇠', how: '새 층을 열면', m: opened ? opened.m : null },
    { id: 'ledger', name: '깨진 담합 장부', how: '담합을 깨면', m: first(/담합에서 이탈|담합을 포기/) },
    { id: 'sword', name: fallen ? `${fallen.name}의 부러진 검` : '용사의 부러진 검', how: '용사를 잃으면', m: fallen ? fallen.em : null, note: fallen ? `${fallen.cls} · 제${fallen.em}월` : undefined },
    { id: 'medal', name: '수도의 훈장', how: '우수 평가를 받으면', m: medal ? medal.month - 1 : null },
  ];
}

// 귀환 보고에 쓰는 짧은 직업 표기 (전사 → 전)
export const clsShort = (c: string) => (CLASSES.includes(c) ? c[0] : c);
