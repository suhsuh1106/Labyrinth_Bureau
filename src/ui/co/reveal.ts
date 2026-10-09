// 귀환 장부: 결재 도장을 찍으면 조가 하나씩 돌아오고, 층마다 판 값이 더해지고, 지출이 빠지고, 마지막에 순이익이 나온다.
// 줄마다 data-v(장부에 더할 금액)와 data-k(종류: ok·no·die·gain·cost·net)를 달아 두고, 한 줄씩 띄우는 것은 coMain이 한다.
// 기록을 읽어 HTML만 만든다. 상태를 쓰지 않고 난수도 쓰지 않는다
import { FLOORS, ITEMS, type World } from '../../core/company';

const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
const sgn = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n));

export function revealHtml(W: World, live: boolean, mute = false) {
  const L = W.last; if (!L) return '';
  const r = L.res[0], s = r.spend;
  const lines: { k: string; v: number; t: string; amt?: string }[] = [];
  let no = 0;
  // 조마다: 어느 층에서 무엇을 갖추고 어떻게 돌아왔나
  FLOORS.forEach((F, f) => L.ours.filter(x => x.f === f).forEach(x => {
    const cls = x.keys.filter(k => k.startsWith('c:')).map(k => k.slice(2)).join('·'), gear = x.keys.find(k => k.startsWith('g:'));
    const mats = (x.mats || []).map(([m, n]) => `${m} ×${n}`).join(', ');
    lines.push({ k: x.ok ? 'ok' : x.d ? 'die' : 'no', v: 0, t: `<b>${++no}조</b> ${F.name} <span class="dim">${cls || '혼성'}${gear ? ` · ${gear.slice(2)}` : ''}</span>`,
      amt: `${x.ok ? `성공${mats ? ` · ${mats}` : ''}` : '실패'}${x.crisis ? ` · 위기 ${x.crisis}${x.pots ? ` · 포션 ${x.pots}` : ''}` : ''}${x.d ? ` · ${x.d}명 사망` : ''}` });
  }));
  // 층마다 판 전리품 (상단 단골 값을 얹은 실제 판매 수입을 층별 몫으로 나눈다)
  const loot = r.sales - r.matSales, base = ITEMS.map((_, j) => r.sold[j] * L.price[j]), bsum = base.reduce((a, b) => a + b, 0);
  let left = loot;
  const sold = ITEMS.map((_, j) => j).filter(j => r.sold[j] > 0);
  sold.forEach((j, i) => {
    const v = i === sold.length - 1 ? left : Math.round(loot * base[j] / Math.max(1, bsum)); left -= v;
    lines.push({ k: 'gain', v, t: `${ITEMS[j].name} ${r.sold[j]}개 × ${fmt(L.price[j])}G`, amt: sgn(v) });
  });
  if (r.matSales) lines.push({ k: 'gain', v: r.matSales, t: `갈무리 소재 ${Object.values(r.matSold).reduce((a, b) => a + b, 0)}개`, amt: sgn(r.matSales) });
  const costs: [string, number][] = [['급여 · 신입', s.wage + s.recruit], ['출정 · 계약', s.sortie + s.hire + s.tool], ['포션 · 장비', s.potion + s.gear], ['정보 · 조사', s.intel + s.probe], ['훈련 · 건물 · 후원', s.train + s.base + s.proc + s.donate + s.root]];
  costs.filter(([, v]) => v > 0).forEach(([t, v]) => lines.push({ k: 'cost', v: -v, t, amt: sgn(-v) }));
  lines.push({ k: 'net', v: 0, t: '순이익', amt: sgn(r.net) });
  const ok = r.ok.reduce((a, b) => a + b, 0), sent = r.sent.reduce((a, b) => a + b, 0) + r.hired.reduce((a, b) => a + b, 0);
  return `<section class="run${live ? ' live' : ''}" aria-label="제${L.month}월 귀환 장부" data-net="${r.net}">
    <header><h3>제${L.month}월 귀환</h3><span class="dim">${ok}/${sent}조 성공${r.deaths ? ` · <b class="neg">${r.deaths}명 사망</b>` : ''}</span>
      <span class="tally" aria-live="polite"><small>이번 달 장부</small><b class="tv" data-final="${r.net}">${live ? '0' : sgn(r.net)}</b></span>
      <button type="button" class="mute" data-act="mute">${mute ? '소리 켜기' : '소리 끄기'}</button>${live ? '<button type="button" class="skip" data-act="skip-run">건너뛰기</button>' : ''}</header>
    <ol>${lines.map(l => `<li class="rv ${l.k}${live ? '' : ' on'}" data-k="${l.k}" data-v="${l.v}"><span class="mk" aria-hidden="true">${l.k === 'ok' ? '✓' : l.k === 'no' ? '✗' : l.k === 'die' ? '†' : l.k === 'gain' ? '+' : l.k === 'cost' ? '−' : '='}</span><span class="tx">${l.t}</span><span class="am">${l.amt || ''}</span></li>`).join('')}</ol>
  </section>`;
}
