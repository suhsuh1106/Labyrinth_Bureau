// 정보실: 정보망 단계만큼 보이는 기록을 그래프로 모은다. 층에 남은 양 짐작, 누가 캐 갔나, 장례, 교차 확인, 경쟁 용병단의 다음 수.
// 지난 기록(W.history, W.log)과 엔진이 매달 만든 짐작(W.intel.est)만 읽는다. 상태를 쓰지 않고 난수도 쓰지 않는다.
// 정보는 단계가 오르면 지난 달 것까지 함께 열린다 (장부·기록을 열람하는 셈이다)
import { CO, FLOORS, ITEMS, INTEL, type Src, SRCS, type World, guideParts, intelBlock, keyOf } from '../../core/company';
import { keyLabel } from '../../core/util';

const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
const esc = (t: string) => t.replace(/"/g, '&quot;');

export const SRC_INFO: Record<Src, { n: string; lv: string[]; how: string }> = {
  ret: { n: '귀환 보고', lv: ['—', '우리 성공 조당 캐 온 양', '구성별 성공률 (지침이 아직 맞나)', '몬스터가 바뀐 달을 짚어 냄'], how: '기록관 급여' },
  mkt: { n: '상단 장부', lv: ['시세만', '전체 판매량 (우리와 남들)', '용병단별 판매량', '다음 달 주문 (경쟁자 계획)'], how: `상단과 사이 ${INTEL.REL} 이상 (2단계부터) · 장부 열람료` },
  chu: { n: '교회 장례 기록', lv: ['—', '층별 장례 합계', '층 × 용병단 장례', '부상자까지'], how: `교회와 사이 ${INTEL.REL} 이상 (2단계부터) · 기부` },
  gate: { n: '입구 출입 기록', lv: ['—', '층별 전체 파티 수', '용병단별 파티 수', '파티 구성까지'], how: '관리국 서기 사례금' },
  spy: { n: '정보원', lv: ['—', '한 곳 · 엉성함', '두 곳 · 쓸 만함', '세 곳 · 오래 쓸수록 정확'], how: '정보원 몸값' },
};
// 경쟁자 색: 용병단을 따라간다. 이름 있는 셋만 따로 칠하고 나머지는 '그 밖'
const NAMED = [{ id: 'red', c: '--c-red' }, { id: 'holy', c: '--c-holy' }, { id: 'iron', c: '--c-iron' }];
const WIN = 12;   // 그래프는 최근 12달

const lvOf = (W: World, k: Src) => (W.intel ? W.intel.lv[k] : INTEL.BASE[k]);
const niceMax = (v: number) => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; return ([1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(s => m <= s) || 10) * p; };
const topRound = (x: number, y: number, w: number, h: number, r: number) => { if (h <= 0) return ''; r = Math.min(r, h, w / 2); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };

// ---------- 층별 기록 ----------
type Ser = { n: string; c: string; v: (number | null)[] };
function floorData(W: World, f: number) {
  const H = W.history.slice(-WIN), mkt = lvOf(W, 'mkt');
  const months = H.map(M => M.month), open = (M: typeof H[0]) => M.floors[f] && (M.floors[f].crowd > 0 || M.res[0].sent[f] > 0);
  const haul = H.map(M => (M.res[0].ok[f] ? +(M.res[0].got[f] / M.res[0].ok[f]).toFixed(1) : null));
  const got = (M: typeof H[0], i: number) => M.res[i].got[f];
  const take: Ser[] = [{ n: '우리', c: '--c-us', v: H.map(M => (open(M) ? got(M, 0) : null)) }];
  if (mkt === 1) take.push({ n: '남들', c: '--c-etc', v: H.map(M => (open(M) ? M.res.reduce((a, r, i) => a + (i ? r.got[f] : 0), 0) : null)) });
  if (mkt >= 2) {
    NAMED.forEach(x => { const i = W.cos.findIndex(c => c.id === x.id); take.push({ n: W.cos[i].name, c: x.c, v: H.map(M => (open(M) ? got(M, i) : null)) }); });
    const named = new Set(NAMED.map(x => W.cos.findIndex(c => c.id === x.id)));
    take.push({ n: '그 밖', c: '--c-etc', v: H.map(M => (open(M) ? M.res.reduce((a, r, i) => a + (i && !named.has(i) ? r.got[f] : 0), 0) : null)) });
  }
  const dead = H.map(M => (open(M) ? M.res.reduce((a, r) => a + ((r.dF && r.dF[f]) || 0), 0) : null));
  return { months, haul, take, dead };
}

// ---------- 그래프 ----------
const W_ = 300, L = 28, R = 6;
function frame(n: number) { const colW = (W_ - L - R) / Math.max(1, n); return { colW, X: (k: number) => L + (k + 0.5) * colW }; }
const xTicks = (months: number[], X: (k: number) => number, H: number) => months.map((m, k) => (k === 0 || k === months.length - 1 || k % 3 === 0 ? `<text x="${X(k)}" y="${H - 3}" text-anchor="middle">${m}월</text>` : '')).join('');
const hits = (months: number[], X: (k: number) => number, colW: number, H: number, tip: (k: number) => string) => months.map((_, k) => `<rect class="hit" x="${X(k) - colW / 2}" y="0" width="${colW}" height="${H}" data-tip="${esc(tip(k))}"/>`).join('');

function haulChart(name: string, months: number[], haul: (number | null)[], yMax: number, tip: (k: number) => string) {
  const H = 92, T = 6, B = 16, { colW, X } = frame(months.length), y = (v: number) => T + (1 - v / yMax) * (H - T - B);
  const pts = haul.map((v, k) => (v == null ? null : [X(k), y(v)])).filter(Boolean) as number[][];
  const ticks = [0, yMax / 2, yMax];
  const best = Math.max(0, ...haul.filter((v): v is number => v != null)), lastK = haul.map((v, k) => (v == null ? -1 : k)).filter(k => k >= 0).pop();
  return `<svg viewBox="0 0 ${W_} ${H}" role="img" aria-label="${name} 우리 성공 조당 캐 온 양">
    ${ticks.map(v => `<line class="gl" x1="${L}" x2="${W_ - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 4}" y="${y(v) + 3}" text-anchor="end">${+v.toFixed(1)}</text>`).join('')}
    ${best ? `<line class="ref" x1="${L}" x2="${W_ - R}" y1="${y(best)}" y2="${y(best)}"/><text class="lab" x="${L + 3}" y="${y(best) - 3}">가장 많이 캐 온 달 ${best}개</text>` : ''}
    ${pts.length > 1 ? `<polyline class="ln" points="${pts.map(p => p.join(',')).join(' ')}"/>` : ''}
    ${lastK != null ? `<circle class="end" cx="${X(lastK)}" cy="${y(haul[lastK]!)}" r="4.5"/><text class="lab" x="${X(lastK) - 7}" y="${y(haul[lastK]!) + 14}" text-anchor="end">${haul[lastK]}개</text>` : ''}
    ${xTicks(months, X, H)}${hits(months, X, colW, H, tip)}</svg>`;
}
function stackChart(name: string, months: number[], S: Ser[], yMax: number, tip: (k: number) => string) {
  const H = 78, T = 4, B = 4, { colW, X } = frame(months.length), y = (v: number) => T + (1 - v / yMax) * (H - T - B), bw = Math.min(14, colW - 4);
  const bars = months.map((_, k) => {
    const vis = S.filter(s => (s.v[k] || 0) > 0); let acc = 0;
    return vis.map((s, j) => {
      const v = s.v[k]!, y0 = y(acc), y1 = y(acc + v); acc += v;
      const top = j === vis.length - 1, gap = j ? 1 : 0, x = X(k) - bw / 2;
      return top ? `<path d="${topRound(x, y1, bw, Math.max(0, y0 - y1 - gap), 3)}" style="fill:var(${s.c})"/>` : `<rect x="${x}" y="${y1 + 1}" width="${bw}" height="${Math.max(0, y0 - y1 - 1 - gap)}" style="fill:var(${s.c})"/>`;
    }).join('');
  }).join('');
  const ticks = [0, yMax / 2, yMax];
  return `<svg viewBox="0 0 ${W_} ${H}" role="img" aria-label="${name} 달마다 캐 간 양">${ticks.map(v => `<line class="gl" x1="${L}" x2="${W_ - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 4}" y="${y(v) + 3}" text-anchor="end">${fmt(v)}</text>`).join('')}${bars}${hits(months, X, colW, H, tip)}</svg>`;
}
function deadChart(name: string, months: number[], dead: (number | null)[], yMax: number, tip: (k: number) => string) {
  const H = 40, T = 4, B = 4, { colW, X } = frame(months.length), y = (v: number) => T + (1 - v / yMax) * (H - T - B), bw = Math.min(10, colW - 6);
  const bars = dead.map((d, k) => (!d ? '' : `<path d="${topRound(X(k) - bw / 2, y(d), bw, y(0) - y(d), 2)}" style="fill:var(--c-etc)"/>`)).join('');
  return `<svg viewBox="0 0 ${W_} ${H}" role="img" aria-label="${name} 달마다 장례 건수"><line class="ax" x1="${L}" x2="${W_ - R}" y1="${y(0)}" y2="${y(0)}"/><text x="${L - 4}" y="${y(yMax) + 6}" text-anchor="end">${yMax}</text>${bars}${hits(months, X, colW, H, tip)}</svg>`;
}

// 지침 상태: 구성별 성공률(귀환 보고 2단계)로 지금 지침을 갖춘 조와 안 갖춘 조를 견준다. 3단계면 바뀐 달을 짚는다
function guideChip(W: World, f: number) {
  const gs = guideParts(W.last ? W.last.plans[0].guide[f] : '');
  if (!gs.length) return '<span class="chip">지침 없음</span>';
  return gs.map(g => keyChip(W, f, g)).join(' ');
}
function keyChip(W: World, f: number, g: string) {
  const ret = lvOf(W, 'ret');
  if (ret < 2) return `<span class="chip">지침 ${keyLabel(g)}</span>`;
  const all = W.obs[f]['*'], o = W.obs[f][g];
  if (!all || !o || o.n < 2 || all.n - o.n < 2) return `<span class="chip">지침 ${keyLabel(g)} · <b>기록 모자람</b></span>`;
  const d = o.w / o.n - (all.w - o.w) / (all.n - o.n);
  const adapted = W.adapted && W.adapted[f], keyNow = keyOf(W, f);
  if (ret >= 3 && adapted && g !== keyNow) return `<span class="chip bad">지침 ${keyLabel(g)} · <b>제${adapted}월부터 안 먹힘</b></span>`;
  const [cls, t] = d >= 0.12 ? ['ok', '아직 맞음'] : d >= 0.03 ? ['warn', '약해지는 중'] : ['bad', '안 먹히는 듯'];
  return `<span class="chip ${cls}">지침 ${keyLabel(g)} · <b>${t}</b></span>`;
}

function floorsHtml(W: World) {
  const openF = FLOORS.map((_, f) => f).filter(f => f < W.unlocked);
  const data = openF.map(f => floorData(W, f));
  // 세 그래프 모두 열린 층끼리 같은 눈금. 최댓값은 관측한 값에서 잡는다 (층의 크기를 드러내지 않는다)
  const hMax = niceMax(Math.max(1, ...data.flatMap(d => d.haul.filter((v): v is number => v != null))) * 1.15);
  const tMax = niceMax(Math.max(1, ...data.flatMap(d => d.months.map((_, k) => d.take.reduce((a, s) => a + (s.v[k] || 0), 0)))));
  const dMax = Math.max(4, ...data.flatMap(d => d.dead.map(v => v || 0)));
  const chu = lvOf(W, 'chu');
  return openF.map((f, j) => {
    const F = FLOORS[f], d = data[j], e = W.intel && W.intel.est.floors[f];
    const tip = (k: number) => [`${F.name} · 제${d.months[k]}월`, `우리 성공 조당 ${d.haul[k] ?? '-'}개`, ...d.take.map(s => `${s.n} ${s.v[k] ?? '-'}개`), ...(chu ? [`장례 ${d.dead[k] ?? '-'}건`] : [])].join('|');
    const w = e ? e.hi - e.lo : 100;
    return `<article class="fp" aria-label="${F.name}">
      <header><h3>${F.name}<small>${ITEMS[f].name}</small></h3>${guideChip(W, f)}</header>
      <div class="est"><div class="row"><span>다음 달 남은 양 짐작 (가득 대비)</span><b>${e ? `${e.lo}–${e.hi}%` : '모름'}</b></div>
        <div class="track" role="img" aria-label="${F.name} 남은 양 ${e ? `${e.lo}에서 ${e.hi}퍼센트` : '모름'}">${e ? `<span class="band" style="left:${e.lo}%;width:${w}%"></span><span class="dot" style="left:${e.mid}%"></span>` : ''}<span class="tick" style="left:0%">0</span><span class="tick" style="left:50%">50</span><span class="tick" style="left:100%">100%</span></div>
        <div class="why">${!e ? '' : w >= 40 ? '근거가 모자람: 우리 귀환 보고뿐' : w >= 15 ? '귀환 보고 × 시장 전체 판매' : '귀환 보고 × 용병단별 판매'}</div></div>
      <div class="ct">우리 성공 조당 캐 온 양 (개)</div>${d.months.length ? haulChart(F.name, d.months, d.haul, hMax, tip) : '<div class="lockbox">아직 기록이 없어요</div>'}
      <div class="ct">누가 캐 갔나 (개)<small>상단 장부 ${lvOf(W, 'mkt')}단계</small></div>${d.months.length ? stackChart(F.name, d.months, d.take, tMax, tip) : ''}
      <div class="ct">장례 (건)<small>${chu ? `교회 기록 ${chu}단계` : ''}</small></div>${chu ? (d.months.length ? deadChart(F.name, d.months, d.dead, dMax, tip) : '') : '<div class="lockbox">교회 장례 기록 1단계부터 보여요</div>'}
    </article>`;
  }).join('');
}

function legendHtml(W: World) {
  const mkt = lvOf(W, 'mkt'), out = ['<span><i class="line" style="--c:var(--c-us)"></i>우리 성공 조당 캐 온 양</span>', '<span><i style="--c:var(--c-us)"></i>우리</span>'];
  if (mkt === 1) out.push('<span><i style="--c:var(--c-etc)"></i>남들 (시장 판매로 짐작)</span>');
  if (mkt >= 2) { NAMED.forEach(x => out.push(`<span><i style="--c:var(${x.c})"></i>${W.cos.find(c => c.id === x.id)!.name}</span>`)); out.push('<span><i style="--c:var(--c-etc)"></i>그 밖</span>'); }
  if (lvOf(W, 'chu')) out.push('<span><i style="--c:var(--c-etc)"></i>장례 (교회 기록)</span>');
  if (!mkt) out.push('<span class="dim">· 남들이 캔 양은 상단 장부 1단계부터 보여요</span>');
  return out.join('');
}

// ---------- 교차 확인 ----------
function crossHtml(W: World) {
  const lv = (k: Src) => lvOf(W, k), H = W.history.slice(-3);
  const cards: { need: Partial<Record<Src, number>>; t: string; body: () => [string, string] }[] = [
    { need: { ret: 1, mkt: 1 }, t: '층에 남은 양', body: () => {
      const es = (W.intel ? W.intel.est.floors : []).map((e, f) => (e ? `${FLOORS[f].name} ${e.lo}–${e.hi}%` : '')).filter(Boolean);
      return [es.slice(0, 2).join(' · ') || '—', lv('mkt') >= 2 ? '용병단별 판매량까지 맞대어 폭이 좁아졌어요' : '우리 성공 조당 양과 남들이 판 양을 맞대어 짐작해요'];
    } },
    { need: { gate: 2, chu: 2 }, t: '경쟁자별 층별 사망률', body: () => {
      let best: [number, string, number] = [-1, '', 0], ours = 0, on = 0;
      W.cos.forEach((c, i) => FLOORS.forEach((F, f) => {
        const n = H.reduce((a, M) => a + M.res[i].sent[f], 0), d = H.reduce((a, M) => a + ((M.res[i].dF && M.res[i].dF[f]) || 0), 0);
        if (n < 3) return; const r = d / (n * CO.PARTY);
        if (i === 0) { ours += d; on += n * CO.PARTY; return; }
        if (c.style !== 'crowd' && r > best[0]) best = [r, `${c.name} ${F.name}`, f];
      }));
      if (best[0] < 0) return ['—', '최근 석 달 기록이 모자라요'];
      return [`${best[1]} ${Math.round(best[0] * 100)}%`, `우리는 ${on ? Math.round(ours / on * 100) : 0}%. 포션을 줄였거나 그 층에 맞지 않는 구성으로 들어가고 있을 수 있어요`];
    } },
    { need: { ret: 3, chu: 2 }, t: '몬스터가 바뀐 달', body: () => {
      const a = (W.adapted || []).map((m, f) => (m ? `${FLOORS[f].name} 제${m}월` : '')).filter(Boolean);
      return [a.join(' · ') || '아직 없음', a.length ? '그달부터 예전 지침을 갖춘 조의 성공률이 떨어지고 장례가 늘었어요' : '약점대로 들어가는 파티가 몰리면 몬스터가 적응해요'];
    } },
    { need: { mkt: 3, spy: 2 }, t: '경쟁자 다음 달 계획 (확실)', body: () => {
      const on = W.intel ? W.intel.spyOn : [];
      return [on.length ? on.map(id => W.cos.find(c => c.id === id)!.name).join(' · ') : '정보원 없음', '상단이 받은 다음 달 주문과 정보원 보고가 맞아떨어져 범위가 한 점으로 줄어요'];
    } },
  ];
  return cards.map(C => {
    const ok = Object.entries(C.need).every(([k, v]) => lv(k as Src) >= (v as number));
    const from = Object.entries(C.need).map(([k, v]) => `<span>${SRC_INFO[k as Src].n} ${v}단계</span>`).join(' × ');
    if (!ok) return `<div class="cx locked"><div class="from">${from}</div><div><b>${C.t}</b></div><div class="big">잠김</div></div>`;
    const [big, so] = C.body();
    return `<div class="cx"><div class="from">${from}</div><div><b>${C.t}</b></div><div class="big">${big}</div><div class="so">${so}</div></div>`;
  }).join('');
}

// ---------- 경쟁 용병단 ----------
function rivalsHtml(W: World) {
  const L = W.last, gate = lvOf(W, 'gate'), chu = lvOf(W, 'chu'), openF = FLOORS.map((_, f) => f).filter(f => f < W.unlocked);
  const head = `<div class="h" role="columnheader">용병단</div>${openF.map(f => `<div class="h" role="columnheader">${FLOORS[f].name} (조)</div>`).join('')}`;
  const cols = `grid-template-columns: 128px repeat(${openF.length}, minmax(130px, 1fr))`;
  if (!L) return `<div class="rg" style="${cols}">${head}<div class="unk" style="grid-column: 1 / -1">첫 입장 뒤부터 보여요</div></div>`;
  if (gate < 2) {
    const tot = openF.map(f => L.res.reduce((a, r, i) => a + (i ? r.sent[f] + r.hired[f] : 0), 0));
    return `<div class="rg" style="${cols}">${head}<div class="name">남들 모두<small>입구 기록 1단계 · 용병단별로는 모름</small></div>${tot.map(n => `<div class="cell"><div class="v"><span>지난달 <b>${n}</b></span></div></div>`).join('')}</div>`;
  }
  const DMAX = Math.max(10, ...W.cos.flatMap((c, i) => (c.style === 'player' || c.style === 'crowd' ? [] : openF.map(f => L.res[i].sent[f] + L.res[i].hired[f] + 3))));
  const rows = W.cos.map((c, i) => {
    if (c.style === 'player' || c.style === 'crowd') return '';
    const est = W.intel && W.intel.est.rivals[c.id], spied = W.intel && W.intel.spyOn.includes(c.id);
    const why = spied ? `정보원 ${W.intel!.lv.spy}단계 · ${W.intel!.tenure[c.id] || 0}달째` : lvOf(W, 'mkt') >= 3 ? '상단 다음 달 주문' : '지난달 그대로라고 봄';
    return `<div class="name">${c.name}<small>근거: ${why}</small></div>` + openF.map(f => {
      const last = L.res[i].sent[f] + L.res[i].hired[f], e = est && est[f], sx = (v: number) => 4 + Math.min(v, DMAX) / DMAX * 152;
      const H3 = W.history.slice(-3), n = H3.reduce((a, M) => a + M.res[i].sent[f], 0), d = H3.reduce((a, M) => a + ((M.res[i].dF && M.res[i].dF[f]) || 0), 0);
      const rate = chu >= 2 && n >= 3 ? Math.round(d / (n * CO.PARTY) * 100) : null;
      const lo = e ? Math.max(0, e.mid - e.w) : 0, hi = e ? e.mid + e.w : 0;
      const tip = [`${c.name} · ${FLOORS[f].name}`, `지난달 ${last}조`, e ? `다음 달 ${lo === hi ? e.mid : `${lo}–${hi}`}조` : '다음 달 모름', ...(rate != null ? [`최근 석 달 사망률 ${rate}%`] : [])].join('|');
      return `<div class="cell" data-tip="${esc(tip)}"><svg viewBox="0 0 160 26" role="img" aria-label="${c.name} ${FLOORS[f].name} 지난달 ${last}조">
        <line class="gl" x1="4" x2="156" y1="9" y2="9"/>${last ? `<path d="M4,4H${sx(last) - 2}Q${sx(last)},4 ${sx(last)},6V12Q${sx(last)},14 ${sx(last) - 2},14H4Z" style="fill:var(--c-etc)"/>` : ''}
        ${e ? `<line class="rng" x1="${sx(lo)}" x2="${sx(hi)}" y1="21" y2="21"/><circle class="rdot" cx="${sx(e.mid)}" cy="21" r="4"/>` : ''}</svg>
        <div class="v"><span>지난달 <b>${last}</b></span>${rate != null && n ? `<span>사망 <b>${rate}%</b></span>` : ''}<span>다음 <b>${e ? (lo === hi ? e.mid : `${lo}–${hi}`) : '?'}</b></span></div></div>`;
    }).join('');
  }).join('');
  return `<div class="rg" style="${cols}">${head}${rows}</div>`;
}

// 소문: 확인되지 않은 말은 문장으로 둔다. 최근 두 달 기록에서 소문꼴인 것만
export function rumorsHtml(W: World) {
  const rs = W.log.filter(l => l.m >= W.month - 2 && /말이 돈다|이상 징후|마주 앉는다/.test(l.t)).slice(-3).reverse();
  if (!rs.length) return '<p class="note">최근 두 달은 별다른 소문이 없었어요.</p>';
  return `<div class="rumors">${rs.map(r => `<div class="rumor"><div class="top">제${r.m}월</div><div>${r.t.replace(/^이상 징후: /, '')}</div></div>`).join('')}</div>`;
}

export function netHtml(W: World) {
  return SRCS.map(k => {
    const S = SRC_INFO[k], lv = lvOf(W, k), keep = INTEL.KEEP[k][lv], acc = W.intel ? W.intel.acc[k] : 0, block = intelBlock(W, k);
    return `<div class="src"><div class="nm">${S.n}<span class="pips" aria-label="${lv}단계">${[1, 2, 3].map(i => `<i class="${i <= lv ? 'on' : ''}"></i>`).join('')}</span></div>
      <div class="now">${lv ? S.lv[lv] : k === 'mkt' ? S.lv[0] : '아직 없음'}</div>
      ${lv < 3 ? `<div class="next">다음 단계: <b>${S.lv[lv + 1]}</b> · 쌓인 ${fmt(acc)} / ${fmt(INTEL.UP[k][lv])}G</div>` : '<div class="next">가장 높은 단계</div>'}
      ${block ? `<div class="next neg">${block.who}과 사이가 ${INTEL.REL} 이상이어야 올라요 (지금 ${block.now})</div>` : ''}
      <div class="how">${S.how} · 유지 월 ${fmt(keep)}G</div></div>`;
  }).join('');
}

export function intelHtml(W: World) {
  return `<h3>층은 얼마나 남았나</h3>
    <div class="legend">${legendHtml(W)}</div>
    <div class="floors">${floorsHtml(W)}</div>
    <h3>교차 확인</h3>
    <div class="cross">${crossHtml(W)}</div>
    <h3>다음 달 누가 어디로 오나</h3>
    <div class="legend"><span><i style="--c:var(--c-etc)"></i>지난달</span><span><i class="line" style="--c:var(--ink-soft)"></i>다음 달 짐작</span></div>
    <div class="tw">${rivalsHtml(W)}</div>`;
}
