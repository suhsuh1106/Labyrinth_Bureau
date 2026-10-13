// 귀환 장부: 결재 도장을 찍으면 조가 하나씩 돌아오고, 층마다 판 값이 더해지고, 지출이 빠지고, 마지막에 순이익이 나온다.
// 줄마다 data-v(장부에 더할 금액)와 data-k(종류: ok·no·die·gain·cost·net)를 달아 두고, 한 줄씩 띄우는 것은 coMain이 한다.
// 기록을 읽어 HTML만 만든다. 상태를 쓰지 않고 난수도 쓰지 않는다
import { CO, FLOORS, ITEMS, type World, gradeOf } from '../../core/company';
import { packBar } from './roster';
import { fmtG } from './charts';

const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
const sgn = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n));

const END: Record<string, string> = { done: '다 돌고 귀환', torch: '횃불 다 씀', pack: '짐 다 참', flee: '쓰러진 사람이 많아 물러남' };
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
// 조마다 한 줄: 어느 층에서 누가 갔고, 날마다(칸 하나가 하루) 이겼나 졌나, 짐이 얼마나 찼나, 누가 죽었나.
// 날마다의 자세한 것(몬스터 · 갈무리 · 위기)은 칸에 마우스를 올리면 보인다
function teamLines(W: World) {
  const L = W.last!, lines: { k: string; v: number; t: string; amt?: string }[] = [];
  let no = 0;
  FLOORS.forEach((F, f) => L.ours.filter(x => x.f === f).forEach(x => {
    const cls = x.keys.filter(k => k.startsWith('c:')).map(k => k.slice(2)).join('·'), gear = x.keys.find(k => k.startsWith('g:'));
    const n = x.n || 4, k = x.k != null ? x.k : x.ok ? n : 0, T = x.trip, D = x.days, dead = x.dead || [];
    const mats = (x.mats || []).map(([m, c]) => `${m} ×${c}`);
    const head = `<b>${++no}조</b> ${F.name} <span class="grade g${Math.min(4, Math.max(1, k))}">${gradeOf(k)}</span> <span class="dim">${cls || '혼성'}${gear ? ` · ${gear.slice(2)}` : ''}${n < 4 ? ` · ${n}명` : ''}</span>`;
    if (!D || !T) { lines.push({ k: x.d ? 'die' : x.ok ? 'ok' : 'no', v: 0, t: head, amt: `${mats.join(', ') || (k ? '' : '빈손')}${x.d ? ` · ${x.d}명 사망` : ''}` }); return; }
    // 날 칸: 승(초록) · 패(빨강) · 위기(!) · 사망(†). 못 간 날은 빈 칸, 돌아선 날은 어둠
    const back = T.end === 'torch' || T.end === 'flee';
    const days = Array.from({ length: CO.DAYS }, (_, j) => {
      const d = D[j], dd = dead.filter(z => z.day === j + 1);
      if (d) return `<i class="${d.win ? 'w' : 'x'}${dd.length ? ' dead' : ''}" style="--j:${j}" title="${esc(`${j + 1}일 · ${d.mon} · ${d.win ? '승' : '패'} ${d.k}/${d.n}${d.mats.length ? ` · ${d.mats.map(([m, c]) => `${m} ×${c}`).join(', ')}` : ''}${d.cr ? ` · 위기 ${d.cr}` : ''}${dd.length ? ` · 사망 ${dd.map(z => z.n).join(', ')}` : ''}`)}">${dd.length ? '†' : d.cr ? '!' : ''}</i>`;
      if (j === D.length && back) { const z = dead.filter(y => y.day === 0); return `<i class="dk${z.length ? ' dead' : ''}" style="--j:${j}" title="${esc(`${END[T.end]} · 어둠 속 귀환${T.dark ? ` · 위기 ${T.dark}` : ''}${z.length ? ` · 사망 ${z.map(y => y.n).join(', ')}` : ''}`)}">${z.length ? '†' : T.dark ? '!' : ''}</i>`; }
      return `<i class="o" style="--j:${j}"></i>`;
    }).join('');
    const potLeft = Math.max(0, T.rest - (T.torch - T.tu)), wins = D.filter(d => d.win).length;
    const strip = `<span class="trip"><span class="days" role="img" aria-label="${D.length}일 다님 · ${wins}승 ${D.length - wins}패 · ${END[T.end]}">${days}</span>${packBar(T.slots, T.torch - T.tu, potLeft, T.pack)}<small>${END[T.end]}</small></span>`;
    const deadTxt = dead.length ? `<b class="dead-n">† ${dead.map(z => `${esc(z.n)}${z.pot ? ' (포션 쓰고도)' : ''}`).join(', ')}</b>` : '';
    lines.push({ k: dead.length ? 'die' : x.ok ? 'ok' : 'no', v: 0, t: `${head}${strip}`,
      amt: [deadTxt, mats.length ? `${mats.slice(0, 3).join(', ')}${mats.length > 3 ? ` 외 ${mats.length - 3}` : ''}` : '', x.hurt ? `부상 ${x.hurt}` : ''].filter(Boolean).join(' · ') || '빈손' });
  }));
  return lines;
}
// 가정산 위에 붙이는 귀환 결과: 조마다 한 줄 (돈은 신고서를 낸 뒤 정산에서)
export function returnsHtml(W: World, live = false) {
  const L = W.last; if (!L) return '';
  const r = L.res[0], ok = r.ok.reduce((a, b) => a + b, 0), sent = r.sent.reduce((a, b) => a + b, 0) + r.hired.reduce((a, b) => a + b, 0);
  // 잃은 사람: 이름과 어디서 (크게 따로 적는다)
  let no = 0; const fallen: string[] = [];
  FLOORS.forEach((F, f) => L.ours.filter(x => x.f === f).forEach(x => { no++; (x.dead || []).forEach(z => fallen.push(`<b>${esc(z.n)}</b> <span>${no}조 · ${F.name} · ${z.day ? `${z.day}일` : '어둠 속 귀환'}${z.pot ? ' · 포션 쓰고도' : ' · 포션 없이'}</span>`)); }));
  return `<section class="run${live ? ' live' : ''}" aria-label="제${L.month}월 귀환"><header><h3>제${L.month}월 귀환</h3><span class="dim">${ok}/${sent}조 해냄${r.hurt ? ` · 부상 ${r.hurt}` : ''}${r.deaths ? ` · <b class="neg">사망 ${r.deaths}</b>` : ''}</span>
      <span class="legend-d"><i class="w"></i>승 <i class="x"></i>패 <i class="o"></i>못 감 · ! 위기 · † 사망 · 칸 하나가 하루 (최대 ${CO.DAYS}일) · 짐 <i class="l"></i>전리품 <i class="t"></i>횃불 <i class="p"></i>포션</span></header>
    ${fallen.length ? `<div class="fallen"><span class="fx">†</span><div><small>잃은 사람</small>${fallen.map(t => `<p>${t}</p>`).join('')}</div></div>` : ''}
    <ol>${teamLines(W).map(l => `<li class="rv ${l.k}${live ? '' : ' on'}" data-k="${l.k}"><span class="mk" aria-hidden="true">${l.k === 'ok' ? '✓' : l.k === 'no' ? '✗' : '†'}</span><span class="tx">${l.t}</span><span class="am">${l.amt || ''}</span></li>`).join('')}</ol></section>`;
}
export function revealHtml(W: World, live: boolean, mute = false) {
  const L = W.last; if (!L) return '';
  const r = L.res[0], s = r.spend;
  // 조마다의 귀환은 가정산에서 띄웠다. 정산은 돈 줄만
  const lines: { k: string; v: number; t: string; amt?: string }[] = [];
  // 층마다 판 전리품 (상단 단골 값을 얹은 실제 판매 수입을 층별 몫으로 나눈다)
  const loot0 = r.lootSales ?? r.sales - r.matSales, loot = loot0, base = ITEMS.map((_, j) => r.sold[j] * L.price[j]), bsum = base.reduce((a, b) => a + b, 0);
  let left = loot;
  const sold = ITEMS.map((_, j) => j).filter(j => r.sold[j] > 0);
  sold.forEach((j, i) => {
    const v = i === sold.length - 1 ? left : Math.round(loot * base[j] / Math.max(1, bsum)); left -= v;
    lines.push({ k: 'gain', v, t: `${ITEMS[j].name} ${fmt(r.sold[j])}개 × ${fmtG(L.price[j])}G`, amt: sgn(v) });
  });
  if (r.matSales) lines.push({ k: 'gain', v: r.matSales, t: `갈무리 소재 ${Object.values(r.matSold).reduce((a, b) => a + b, 0)}개`, amt: sgn(r.matSales) });
  // 영주청: 탐사 선금과 보급 · 층 지원금 (의뢰 포상 · 지도 판매도 같은 줄에)
  const other = r.sales - loot0 - r.matSales;
  if (other) lines.push({ k: 'gain', v: other, t: `의뢰 · 영주청 지원금${r.adv ? ' · 탐사 선금' : ''}`, amt: sgn(other) });
  const costs: [string, number][] = [['급여 · 신입 · 치료', s.wage + s.recruit + (s.heal || 0)], ['출정 · 계약', s.sortie + s.hire + s.tool], ['포션 · 장비 · 횃불', s.potion + s.gear + (s.torch || 0)], ['정보 · 조사', s.intel + s.probe], ['훈련 · 숙소 · 건물', s.train + s.base + s.proc + s.donate + s.root + (s.dorm || 0) + (s.hq || 0) + (s.job || 0)], ['영주세', s.tax || 0], ['추징금', s.fine || 0]];
  costs.filter(([, v]) => v > 0).forEach(([t, v]) => lines.push({ k: 'cost', v: -v, t, amt: sgn(-v) }));
  lines.push({ k: 'net', v: 0, t: '순이익', amt: sgn(r.net) });
  const ok = r.ok.reduce((a, b) => a + b, 0), sent = r.sent.reduce((a, b) => a + b, 0) + r.hired.reduce((a, b) => a + b, 0);
  return `<section class="run${live ? ' live' : ''}" aria-label="제${L.month}월 귀환 장부" data-net="${r.net}">
    <header><h3>제${L.month}월 귀환</h3><span class="dim">${ok}/${sent}조 해냄${r.hurt ? ` · ${r.hurt}명 부상` : ''}${r.deaths ? ` · <b class="neg">${r.deaths}명 사망</b>` : ''}</span>
      <span class="tally" aria-live="polite"><small>이번 달 장부</small><b class="tv" data-final="${r.net}">${live ? '0' : sgn(r.net)}</b></span>
      <button type="button" class="mute" data-act="mute">${mute ? '소리 켜기' : '소리 끄기'}</button>${live ? '<button type="button" class="skip" data-act="skip-run">건너뛰기</button>' : ''}</header>
    <ol>${lines.map(l => `<li class="rv ${l.k}${live ? '' : ' on'}" data-k="${l.k}" data-v="${l.v}"><span class="mk" aria-hidden="true">${l.k === 'ok' ? '✓' : l.k === 'no' ? '✗' : l.k === 'die' ? '†' : l.k === 'gain' ? '+' : l.k === 'cost' ? '−' : '='}</span><span class="tx">${l.t}</span><span class="am">${l.amt || ''}</span></li>`).join('')}</ol>
  </section>`;
}
