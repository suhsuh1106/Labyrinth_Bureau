// 기록 시트 (docs/board.md 4단계): 세로 카드. 이달(들어올 돈 · 나갈 돈 · 순이익 예측) · 구역(구역마다 카드, 누르면 판의 구역 보고서)
// 귀환 · 지난달 보고서 · 신문 · 도감 · 정보는 원래 세로 문서라 그대로 띄운다. 읽기만 한다 (상태를 쓰지 않는다)
import { CO, FLOORS, type Plan, type World, boughtOf, dayAbs, richEst, riskEst, sanitize, taxGuess, us, zoneKnown, zoneWay } from '../../core/company';
import { type Zone, lvOf, zonesOn } from '../../core/zones';
import { costLines, monthFc } from './desk';
import { KIND_NAME } from './roster';
import { SECRET_NAME, lvBar } from './zones';
import { PLACE_MENU } from './board';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
const sgn = (n: number) => `${n < 0 ? '−' : '+'}${fmt(Math.abs(n))}`;
const f1 = (v: number) => (Math.round(v * 10) / 10).toString();
const riskWord = (v: number) => (v < 0.9 ? '낮음' : v < 1.15 ? '보통' : '높음');

// 이달: 큰 숫자는 순이익 예측. 줄마다 이번 달 · 지난달, 줄을 누르면 그 줄을 정하는 시트로
export function monthHtml(W: World, raw: Plan) {
  const c = us(W), P = sanitize(W, c, raw), fc = monthFc(W, P), L = W.last, ls = costLines(W, raw), G = taxGuess(W, P, fc), gov = G.sub + G.aid + G.adv;
  const out = ls.reduce((a, l) => a + l.now, 0), outL = ls.reduce((a, l) => a + l.last, 0), net = fc.mean + gov - out;
  const spent = Object.values(boughtOf(W).cost).reduce((a, b) => a + b, 0), lastIn = L ? (L.res[0].lootSales ?? 0) + L.res[0].matSales + (L.res[0].jobPay || 0) : 0;
  const go = (place: string) => { const m = place === 'gate' ? ['crew', 'team'] : PLACE_MENU[place] || ['hq', 'train']; return `data-act="bs-menu-tab" data-m="${m[0]}" data-k="${m[1]}"`; };
  const row = (name: string, now: number, last: number | null, attr = '', neg = true) => `<li${attr ? '' : ''}><button type="button" class="ml" ${attr}><span>${esc(name)}</span><b class="${neg && now ? 'neg' : ''}">${neg ? (now ? '−' + fmt(now) : '0') : fmt(now)}</b><small>${last == null ? '' : `지난달 ${neg ? (last ? '−' + fmt(last) : '0') : fmt(last)}`}</small></button></li>`;
  return `<div class="mh"><div><small>순이익 예측</small><b class="${net < 0 ? 'neg' : 'pos'}">${sgn(net)}G</b><span>범위 ${sgn(fc.p10 + gov - out)} ~ ${sgn(fc.p90 + gov - out)}</span></div>
      <div><small>금고</small><b>${fmt(c.cash)}G</b><span>그믐 뒤 예측 ${fmt(c.cash + net + spent)}G</span></div></div>
    <h3 class="mt">들어올 돈 <small>예측 · 제${W.month}월 ${W.day || 1}일</small></h3>
    <ul class="mls">${row('채집품 · 전리품', fc.mean, L ? lastIn : null, go('gate'), false)}${gov ? row('영주청 지원금 · 선금', gov, null, go('board'), false) : ''}</ul>
    <h3 class="mt">나갈 돈 <small>합계 −${fmt(out)}${L ? ` · 지난달 −${fmt(outL)}` : ''}</small></h3>
    <ul class="mls">${ls.filter(l => l.now || l.last).map(l => row(l.name, l.now, L ? l.last : null, go(l.place))).join('')}</ul>
    <p class="note">들어올 돈: 이번 달 돌아온 조 · 그믐 전에 돌아올 조 · 본부의 조가 남은 ${CO.MONTH_DAYS - (W.day || 1) + 1}일 동안 나갈 예측 · 급여 · 본부 유지비 · 영주세는 그믐에</p>`;
}

// 구역: 층마다 구역 카드 (이해도 단계만큼만 적는다). 누르면 판의 구역 보고서
export function zoneCards(W: World, P: Plan) {
  if (!W.zones) return '';
  const now = dayAbs(W), on = (z: Zone) => (P.teams || []).filter(T => T.z === z.id).length;
  return FLOORS.slice(0, W.unlocked).map((F, f) => {
    const zs = zonesOn(W.zones, f).filter(z => zoneKnown(W, z)).sort((a, b) => b.xp - a.xp || a.r - b.r || a.id - b.id);
    return `<h3 class="mt">${F.name} <small>구역 ${zs.length} · 이해도 높은 순</small></h3><ul class="zcs">${zs.map(z => {
      const L = lvOf(z), r = richEst(z), k = riskEst(z), rc = z.rec, n = on(z), way = zoneWay(W, z);
      const bits = [`거리 ${z.r}${way ? ` · 오감 ${2 * way}일` : ''}`, L >= 2 ? `위험 ${riskWord(k.mid)}` : '', L >= 3 ? `채집 몫 ×${f1(r.lo)}~${f1(r.hi)}` : '', L >= 3 && z.seen ? `남은 양 ${Math.round(z.seen.v)} (${now - z.seen.d <= 0 ? '오늘' : `${now - z.seen.d}일 전`})` : '', rc.md ? `실적 ${f1(rc.md)}인일 · 하루 ${f1(rc.got / rc.md)}개/인` : ''].filter(Boolean);
      return `<li><button type="button" class="zc" data-act="bs-zone" data-z="${z.id}"><span class="zc-h"><b>${esc(z.nm)}</b>${L >= 1 ? `<span class="zk ${z.kind}">${KIND_NAME[z.kind]}</span>` : '<span class="dim">하는 일 ?</span>'}${n ? `<span class="chip go">우리 ${n}조</span>` : ''}${lvBar(z)}</span>
        <span class="zc-b">${bits.join(' · ')}</span>${L >= 5 ? `<span class="zc-b ok">${SECRET_NAME[z.secret]}</span>` : ''}</button></li>`;
    }).join('')}</ul>`;
  }).join('') + `<p class="note">일한 인일이 이해도 경험치 · 단계마다 보고서가 한 겹씩 는다 · 구역을 누르면 판에서 그 구역 보고서</p>`;
}
