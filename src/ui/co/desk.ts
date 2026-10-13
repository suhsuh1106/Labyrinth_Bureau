// 행정실 책상: 한 달을 두 주차로 나눈다.
// 정보 주차 — 자료함(보고서·신문·도감·조사 결과)을 열어 읽고, 조사 의뢰를 걸고, 정보망과 내정(건물·보급·창고·세력)을 정한다.
// 탐험 주차 — 작전 메모를 옆에 두고 층마다 몇 조를 무엇을 챙겨 보낼지 정하고 도장을 찍는다. 결과는 다음 달 보고서가 된다.
// 화면은 HTML 문자열만 만든다. 상태를 쓰지 않고 난수도 쓰지 않는다
import { carryOf, torchRate, tripOdds, CO, FLOORS, INTEL, ITEMS, TAX, type Filing, type Job, type Person, clamp, jobsExplore, mapOf, torchOf, undMods, jobsOpen, jobsSign, taxGuess, torchBuy, wageCo, candPrice, candWants, hqCost, hqKeep, hqLv, fcRank, forecast, townOf, type Plan, SRCS, type World, bedsOf, isRook, rookCount, churchPrice, dormCost, dormKeep, roomOf, wageOf, gearBuy, hireCost, intelBlock, intelCost, lootMul, maxParties, needOf, potsExpiring, potsOf, probeCost, probesLeft, sanitize, sortieCost, succRate, supOf, toolCost, trainBonus, us } from '../../core/company';
import { CLASSES, GEARS, BUYERS } from '../../core/data';
import { bookHtml, condLabel, kitHint } from './book';
import { SRC_INFO, intelHtml, rumorsHtml } from './intel';
import { coIssue, paperHtml } from './paper';
import { revealHtml } from './reveal';
import { fcChart, fmtG } from './charts';
import { PLACES, townSceneHtml } from './town';
import { lawsHtml } from './books';
import { assignHtml, candHtml, rosterHtml } from './roster';
import { KTAG, depthsHtml, fieldHtml, fmt, newsLines, pct, resultsHtml, sgn, stepper } from './view';

export type DeskUi = { phase: number; tab: string; pins: string[]; rival?: string; open?: boolean; mute?: boolean;
  file?: Partial<Filing>;   // 가정산에서 고치는 신고서
  pick?: { t?: number; s?: number; id?: number } | null;
  sort?: Record<string, string>;   // 명단 정렬 (rs 인원 명단 · cd 지원자 · as 편성표): "열:방향"
  place?: string };   // 내정에서 열어 둔 장소 창 (인원 · 건물 · 상단 거리 · 교회 · 정보망)   // 편성판에서 집어 든 사람 (조의 자리, 또는 대기 인원)
const lvOf = (W: World, k: keyof typeof INTEL.BASE) => (W.intel ? W.intel.lv[k] : INTEL.BASE[k]);
const GEAR_NAMES = GEARS.filter(g => g !== '일반');
const wage = (W: World) => wageCo(us(W));

// 이번 달 들어온 조사 결과 (시장 조사 · 타 용병단 조사)
function probesHtml(W: World) {
  const ps = (W.probes || []).filter(x => x.m === W.month);
  if (!ps.length) return '<p class="note">이번 달 맡긴 조사가 없어요.</p>';
  return ps.map(x => {
    if (x.k === 'mkt') {
      const ds = x.dem || [];
      return `<section class="pr"><h3>시장 조사</h3>${ds.length ? `<table class="grid slim"><thead><tr><th>찾는 곳</th><th>소재</th><th class="n">값</th><th>기한</th></tr></thead><tbody>${ds.map(d => `<tr><td>${BUYERS[d.who].who}</td><td><b>${d.m}</b></td><td class="n pos">평소 +${Math.round(d.mul * 100)}%</td><td>제${d.until}월까지</td></tr>`).join('')}</tbody></table>` : '<p class="note">지금 웃돈을 얹어 찾는 소재는 없대요.</p>'}</section>`;
    }
    const c = W.cos.find(y => y.id === x.id), n = (x.parties || []).map((v, f) => v + ((x.hire || [])[f] || 0));
    return `<section class="pr"><h3>${c ? c.name : x.id} 조사</h3><p>이번 달 ${n.map((v, f) => (v ? `${FLOORS[f].name} ${v}조` : '')).filter(Boolean).join(' · ') || '출정하지 않음'}을 보낼 채비를 한다.${(x.guide || []).some(Boolean) ? ` ${(x.guide || []).map((g, f) => (g ? `${FLOORS[f].name}에 ${condLabel(g)}` : '')).filter(Boolean).join(', ')}을 챙긴다.` : ''}</p></section>`;
  }).join('');
}

// 소문: 최근 석 달 기록에서 확인되지 않은 말과 동향을 모은다 (신문 아래에 붙인다)
function rumorHtml(W: World) {
  const recent = W.log.filter(l => l.m >= W.month - 3).slice(-8).reverse();
  const news = newsLines(W);
  if (!recent.length && !news.length) return '';
  return `<h3>동향과 소문</h3><ul class="co-news">${news.map(t => `<li>${t}</li>`).join('')}${recent.map(l => `<li><span class="dim">제${l.m}월</span> ${l.t}</li>`).join('')}</ul>`;
}

export const DOC_TABS: [string, string][] = [['report', '보고서'], ['paper', '신문'], ['book', '도감'], ['probe', '조사 결과']];
function docBody(W: World, tab: string) {
  if (tab === 'report') return resultsHtml(W);
  if (tab === 'paper') return (W.last ? paperHtml(W) : '<p class="note">첫 정산이 끝나면 변경 일보가 나와요.</p>') + rumorHtml(W);
  if (tab === 'book') return bookHtml(W);
  return `<h3>이번 주 조사</h3>${probesHtml(W)}${intelHtml(W)}<h3>현장 기록</h3>${fieldHtml(W)}`;
}
const docCount = (W: World, tab: string) => (tab === 'probe' ? (W.probes || []).filter(x => x.m === W.month).length : 0);
// 작전 메모: 고정한 자료를 한두 줄로 줄여 탐험 주차 옆에 둔다
function memoLine(W: World, tab: string): string {
  const L = W.last;
  if (tab === 'report') return L ? `제${L.month}월 · ${L.res[0].sent.reduce((a, b) => a + b, 0)}조 중 ${L.res[0].ok.reduce((a, b) => a + b, 0)}조 성공 · 순이익 ${sgn(L.res[0].net)}G` : '아직 보고서가 없어요';
  if (tab === 'paper') { const I = W.last ? coIssue(W) : null; return I ? `${I.hed} · ${I.dek}` : '아직 신문이 없어요'; }
  if (tab === 'book') { const ds = W.mat ? W.mat.dem.filter(d => d.until >= W.month) : []; return ds.length ? ds.map(d => `${d.m} +${Math.round(d.mul * 100)}%`).join(' · ') : '찾는 곳 소식 없음'; }
  return '';
}
export function memoHtml(W: World, ui: DeskUi) {
  const name = Object.fromEntries(DOC_TABS);
  const probes = (W.probes || []).filter(x => x.m === W.month);
  const items = [
    ...probes.map(x => ({ src: '이번 주 조사', fresh: true, t: x.k === 'mkt' ? `<b>시장 조사</b> · ${(x.dem || []).map(d => `${d.m} +${Math.round(d.mul * 100)}%`).join(', ') || '웃돈 얹어 찾는 것 없음'}` : `<b>${W.cos.find(c => c.id === x.id)?.name} 조사</b> · ${(x.parties || []).map((v, f) => (v + ((x.hire || [])[f] || 0) ? `${FLOORS[f].name} ${v + ((x.hire || [])[f] || 0)}조` : '')).filter(Boolean).join(' · ')}` })),
    ...ui.pins.filter(p => p !== 'probe').map(p => ({ src: name[p] || p, fresh: false, t: memoLine(W, p) })),
  ];
  return items.length ? items.map(m => `<div class="slip${m.fresh ? ' fresh' : ''}"><span class="slip-src">${m.src}</span><span>${m.t}</span></div>`).join('')
    : '<div class="empty">고정한 자료가 없어요</div>';
}

// ---------- 정보 주차 ----------
// 조사 의뢰: 시장 조사 · 타 용병단 조사 모두 정보상에서 맡긴다 (남은 횟수는 함께 쓴다)
function probePanel(W: World, ui: DeskUi) {
  const left = probesLeft(W), rivals = W.cos.filter(c => c.style !== 'player' && c.style !== 'crowd');
  const dots = Array.from({ length: CO.PROBE_MAX }, (_, i) => `<i class="${i < left ? 'on' : ''}"></i>`).join('');
  return `<div class="panel"><header><h2>조사 의뢰</h2><span class="sub">답은 책장의 조사 봉투로</span><span class="right">남은 횟수 <span class="slots" aria-label="${left}번 남음">${dots}</span></span></header>
    <div class="probes">
      <div class="probe"><b>시장 조사 · <span class="num">${fmt(CO.PROBE_MKT)}G</span></b><p>소재 웃돈 · 찾는 곳</p>
        <div class="row"><button type="button" class="go" data-act="probe-mkt"${left ? '' : ' disabled'}>맡기기</button></div></div>
      <div class="probe"><b>타 용병단 조사 · <span class="num">${fmt(CO.PROBE_RIV)}G</span></b><p>이번 달 층별 조 수</p>
        <div class="row"><select id="probe-rival" data-k="rival" aria-label="조사할 용병단">${rivals.map(c => `<option value="${c.id}"${ui.rival === c.id ? ' selected' : ''}>${c.name}</option>`).join('')}</select><button type="button" class="go" data-act="probe-riv"${left ? '' : ' disabled'}>맡기기</button></div></div>
    </div></div>`;
}

// ---------- 정보망: 출처마다 단계가 이어진 줄 (스킬트리) ----------
// 작은 그림: 16×16, 선으로만 그린다 (색은 글자색을 따른다)
const ICON: Record<string, string> = {
  scroll: '<path d="M4 2h7l2 2v10H4z"/><path d="M6 6h5M6 8.5h5M6 11h3"/>',
  grid: '<rect x="2.5" y="3" width="11" height="10" rx="1"/><path d="M2.5 6.5h11M2.5 10h11M6.5 3v10"/>',
  eye: '<path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>',
  bars: '<path d="M3 13V8M6.5 13V4.5M10 13V7M13.5 13V2.5"/><path d="M2 13.5h12.5"/>',
  flags: '<path d="M3 14V2.5M3 3h6l-1 2 1 2H3"/><path d="M9.5 14V7.5M9.5 8h4l-.8 1.5.8 1.5h-4"/>',
  letter: '<rect x="2" y="3.5" width="12" height="9" rx="1"/><path d="M2.5 4.5 8 9l5.5-4.5"/>',
  candle: '<path d="M6 7h4v7H6z"/><path d="M8 7V5.5"/><path d="M8 2.2c1 1.1 1.2 2 0 3.3-1.2-1.3-1-2.2 0-3.3z"/>',
  cross: '<path d="M6.5 2h3v4.5H14v3H9.5V14h-3V9.5H2v-3h4.5z"/>',
  door: '<path d="M3.5 14V2.5h9V14"/><path d="M2 14h12"/><circle cx="10" cy="8.5" r=".8"/>',
  house: '<path d="M2 7.5 8 2.5l6 5V14H2z"/><path d="M6 14v-3.5h4V14"/>',
  recruit: '<circle cx="6" cy="5" r="2.2"/><path d="M1.8 13.5c.4-2.8 2-4.3 4.2-4.3s3.8 1.5 4.2 4.3"/><path d="M12.5 4.5v4M10.5 6.5h4"/>',
  people: '<circle cx="5.5" cy="5" r="2"/><circle cx="11" cy="5.5" r="1.7"/><path d="M1.8 13c.4-2.6 1.8-4 3.7-4s3.3 1.4 3.7 4M8.8 13c.3-2.1 1.2-3.3 2.4-3.3s2.3 1.2 2.6 3.3"/>',
  mask: '<path d="M2 5c2-1 4-1.3 6-1.3S12 4 14 5c0 4-2.5 6.5-6 6.5S2 9 2 5z"/><path d="M4.8 7.2h1.8M9.4 7.2h1.8"/>',
};
const icon = (k: string) => `<svg class="ico" viewBox="0 0 16 16" aria-hidden="true">${ICON[k] || ''}</svg>`;
// 출처마다: 대표 그림, 단계마다 그림과 짧은 이름
export const NET_TREE: Record<string, { ico: string; lv: [string, string][] }> = {
  ret: { ico: 'scroll', lv: [['scroll', '조당 캐 온 양'], ['grid', '구성별 성공률'], ['eye', '몬스터가 바뀐 달']] },
  mkt: { ico: 'bars', lv: [['bars', '시장 전체 판매'], ['flags', '용병단별 판매'], ['letter', '다음 달 주문']] },
  chu: { ico: 'candle', lv: [['candle', '층별 장례'], ['flags', '용병단별 장례'], ['cross', '부상자까지']] },
  gate: { ico: 'door', lv: [['door', '층별 파티 수'], ['flags', '용병단별 파티 수'], ['people', '파티 구성']] },
  spy: { ico: 'mask', lv: [['mask', '한 곳'], ['mask', '두 곳'], ['mask', '세 곳']] },
};
function netPanel(W: World, raw: Plan) {
  const I = W.intel, rivals = W.cos.filter(c => c.style !== 'player' && c.style !== 'crowd'), P = sanitize(W, us(W), raw);
  const rows = SRCS.map((k, i) => {
    const T = NET_TREE[k], lv = lvOf(W, k), keep = INTEL.KEEP[k][lv], up = (raw.intelUp && raw.intelUp[k]) || 0, cut = (raw.intelCut || []).includes(k), blk = intelBlock(W, k);
    const acc = I ? I.acc[k] : 0, need = lv < 3 ? INTEL.UP[k][lv] : 0;
    const st = cut && keep ? ['bad', '축소 예정'] : lv >= 3 ? ['top', '최고 단계'] : blk && up ? ['bad', `막힘 · ${blk.who}과 사이 ${INTEL.REL} 필요 (지금 ${blk.now})`] : up ? ['up', '확장 중'] : ['', '유지'];
    const nodes = T.lv.map(([ic, name], n) => {
      const L = n + 1, on = L <= lv, next = L === lv + 1;
      return `<div class="nt-node${on ? ' on' : ''}${next ? ' next' : ''}" title="${SRC_INFO[k].n} ${L}단계 · ${name}">${icon(ic)}<b>${L}</b><span>${name}</span>${next ? `<i class="nt-prog"><i style="width:${Math.min(100, Math.round(acc / Math.max(1, need) * 100))}%"></i></i>` : ''}</div>`;
    }).join('<span class="nt-edge" aria-hidden="true"></span>');
    return `<div class="nt-track">
      <div class="src-h">${icon(T.ico)}<b>${SRC_INFO[k].n}</b><span class="lvl">${lv}단계</span><span class="st ${st[0]}">${st[1]}</span></div>
      <div class="nt-nodes">${nodes}</div>
      <div class="src-c"><span>유지비 <b>${fmt(keep)}G</b>/월${keep ? ` <button type="button" class="tgl" data-act="intel-cut" data-src="${k}" aria-pressed="${!cut}">${cut ? '끊음' : '내는 중'}</button>` : ''}</span>
        ${lv < 3 ? `<span>다음 단계 <b>${fmt(acc)} / ${fmt(need)}G</b></span><label class="exp">영향력 넓히기 ${stepper('intelUp', i, up, `${SRC_INFO[k].n} 확장 투자`, 50)}</label>` : ''}</div>
    </div>`;
  }).join('');
  const slots = Math.max(1, lvOf(W, 'spy')), on = raw.spyOn || [];
  const sel = Array.from({ length: slots }, (_, s) => `<select data-k="spyOn" data-i="${s}" aria-label="정보원 ${s + 1}"><option value="">붙이지 않음</option>${rivals.map(c => `<option value="${c.id}"${on[s] === c.id ? ' selected' : ''}>${c.name}</option>`).join('')}</select>`).join(' ');
  return `<div class="panel"><header><h2>정보망</h2><span class="right">이번 달 <b>${fmt(intelCost(P))}G</b></span></header>
    <div class="nt-tree">${rows}</div>
    <div class="spyrow">${icon('mask')}<span>정보원 붙일 곳</span>${sel}</div></div>`;
}

// ---------- 건물 (훈련장 · 공방), 보급 구매 (상단 거리 · 교회) ----------
const bldCard = (ic: string, name: string, lv: string, body: string, ctl: string) => `<div class="bld">${icon(ic)}<div><b>${name}</b><span class="lvl">${lv}</span><small>${body}</small></div>${ctl}</div>`;
// 본부 증축: 가지 넷(숙소 · 훈련장 · 기록실 · 의무실)과 단계마다 하는 일. 한 달에 공사 하나
export const HQ_NAME: Record<string, string> = { dorm: '숙소', train: '훈련장', rec: '기록실', med: '의무실' };
const HQ_DO: Record<string, string[]> = {
  dorm: CO.HQ_BEDS.map(n => `침상 ${n}`).map((t, i) => (i === CO.HQ_BEDS.length - 1 ? t + ' (끝)' : t)),
  train: ['', `실력 오르는 속도 ×${CO.TRAIN_GROW}`, '신입이 수련까지 두 배 빠르게', '명인 단계가 열림'],
  rec: ['', '지도에 보태는 몫 +25%', '정찰 조 (둘 · 셋만 보내 지도를 크게)', '다 그린 지도의 사본을 관리국에 팔 수 있음'],
  med: ['', '치료비 절반', `죽을 사람 넷에 하나는 다치고 버팀 (한 달 쉼)`, '죽을 사람 절반 가까이 다치고 버팀'],
};
const HQ_WHY: Record<string, string> = { dorm: '사람 수 상한', train: '사람의 실력', rec: '지도 완성도', med: '잃는 사람' };
function hqPanel(W: World, raw: Plan) {
  const c = us(W); if (!c.hq) return '';
  const pend = c.pendingHq, pick = !pend && raw.build;
  const br = (k: string) => {
    const lv = hqLv(c, k), top = CO.HQ_COST[k].length, rows = HQ_DO[k].map((t, i) => {
      if (k !== 'dorm' && i === 0) return '';
      const done = i <= lv, next = i === lv + 1, cost = CO.HQ_COST[k][i - 1];
      return `<div class="lv${done ? ' done' : next ? ' next' : ' lock'}"><b>${k === 'dorm' ? i + 1 : i}</b><span>${t}${next && !pend ? `<br><button type="button" class="tog" data-act="build" data-k="${k}" aria-pressed="${pick === k}">${pick === k ? '공사 취소' : '증축 결재'}</button>` : ''}${next && pend === k ? '<br><small>공사 중 · 다음 달 완공</small>' : ''}</span><span class="c">${done ? '완공' : `${fmt(cost)}G${k !== 'dorm' ? `<br>유지 +${CO.HQ_KEEP}/달` : ''}`}</span></div>`;
    }).join('');
    return `<div class="br"><h4>${HQ_NAME[k]}</h4><p class="why">${HQ_WHY[k]} · ${lv >= top ? '끝까지 올림' : `${k === 'dorm' ? lv + 1 : lv}단계`}</p>${rows}</div>`;
  };
  const sell = hqLv(c, 'rec') >= 3 ? FLOORS.slice(0, W.unlocked).map((F, f) => (c.map && c.map[f] >= 100 && !(c.mapSold && c.mapSold[f]) ? `<button type="button" class="tog" data-act="sellmap" data-f="${f}" aria-pressed="${raw.sellMap === f}">${F.name} 지도 사본 팔기 +${fmt(CO.MAP_COPY)}G</button>` : '')).filter(Boolean).join('') : '';
  return `<div class="panel"><header><h2>회색늑대 본부</h2><span class="sub">한 달에 공사 하나 · 다음 달 정산 때 완공${pend ? ` · 지금 ${HQ_NAME[pend]} 공사 중` : ''} · 본부 유지비 월 ${fmt(hqKeep(c))}G</span></header>
    <div class="hq">${['dorm', 'train', 'rec', 'med'].map(br).join('')}</div>
    ${sell ? `<div class="sellmap">${sell}<small>사 간 관리국이 다른 용병단에도 지도를 돌려, 그들의 지도도 ${CO.MAP_GIVE}만큼 오른다</small></div>` : ''}
    <p class="note">사람이 늘수록 관리비가 가파르게 붙어요: 급여 × (1 + ${CO.OH_K} × 인원²). 16명이면 ×${(1 + CO.OH_K * 256).toFixed(2)}, 32명 ×${(1 + CO.OH_K * 1024).toFixed(2)}, 40명 ×${(1 + CO.OH_K * 1600).toFixed(2)}, 50명 ×${(1 + CO.OH_K * 2500).toFixed(2)}.</p></div>`;
}
// 교관: 월 급료 네 칸. 효과는 훈련도가 차오르는 만큼
export const COACH_N = ['없음', '조교 한 명', '교관 둘', '검술 사범'];
const coachOf = (train: number) => Math.max(0, CO.COACH_PAY.findIndex(v => v >= train));
function trainPanel(W: World, raw: Plan) {
  const c = us(W), P = sanitize(W, c, raw), ci = raw.coach ?? coachOf(P.train);
  return `${hqPanel(W, raw)}<div class="panel"><header><h2>교관</h2><span class="sub">성공 지금 +${(trainBonus(c.skill) * 100).toFixed(1)}%p · 이대로면 +${(trainBonus(CO.COACH_PAY[ci] / 10 * CO.SIZE_REF / Math.max(CO.SIZE_REF / 2, c.members)) * 100).toFixed(1)}%p까지 (석 달쯤)</span></header>
    <div class="coach"><span class="seg sm" role="group" aria-label="교관">${COACH_N.map((n, i) => `<button type="button" data-act="coach" data-i="${i}" aria-pressed="${ci === i}" title="월 ${CO.COACH_PAY[i]}G">${n} <small>${CO.COACH_PAY[i]}G</small></button>`).join('')}</span></div></div>`;
}
// 이번 달 살 포션 (비워 두면 편성에 모자란 만큼)
const potBuy = (W: World, raw: Plan, P: Plan) => { const H = potsOf(us(W)), need = needOf(P); return raw.buy && raw.buy.pot != null ? raw.buy.pot : Math.max(0, need.pot - H.pot - H.holy - ((raw.buy && raw.buy.holy) || 0)); };
const gearOf = (W: World, raw: Plan, P: Plan, g: string) => (raw.buy && raw.buy.gear && raw.buy.gear[g] != null ? raw.buy.gear[g] : gearBuy(us(W), P)[g] || 0);
// 창고: 품목마다 보유 · 이번 달 구매 · 쓸 어림 · 상할 것 · 다음 달 남음. 막대는 (보유 + 구매)를 쓸 것 · 남을 것 · 상할 것으로 나눈다.
// 포션은 위기에 쓴 만큼만 빠지고(성수부터, 오래된 것부터), 쓸 어림은 수입 어림의 위기 기대값이다
export function storeHtml(W: World, raw: Plan, P: Plan) {
  const c = us(W), S = supOf(c), H = potsOf(c), X = potsExpiring(c), need = needOf(P), fc = forecast(W, P);
  const potN = potBuy(W, raw, P), holyN = (raw.buy && raw.buy.holy) || 0, use = Math.min(Math.round(fc.crisis || 0), need.pot);
  const useH = Math.min(H.holy + holyN, use), useP = Math.max(0, use - useH);
  const spoilH = Math.max(0, X.holy - useH), spoilP = Math.max(0, X.pot - useP);
  const row = (name: string, have: number, buy: number, carry: number | string, u: number, spoil: number, note = '') => {
    const tot = have + buy, left = Math.max(0, tot - u - spoil), w = (v: number) => (tot ? Math.round(v / tot * 100) : 0);
    return `<tr><td><b>${name}</b>${note ? `<small>${note}</small>` : ''}</td><td class="n">${fmt(have)}</td><td class="n">${buy ? '+' + fmt(buy) : '-'}</td><td class="n">${carry}</td><td class="n">${u ? '−' + fmt(u) : '-'}</td><td class="n ${spoil ? 'neg' : ''}">${spoil ? '−' + fmt(spoil) : '-'}</td><td class="n"><b>${fmt(left)}</b></td>
      <td class="sbar"><span class="bar" role="img" aria-label="${name}: 쓸 ${u}, 남음 ${left}, 상함 ${spoil}"><i class="use" style="width:${w(u)}%"></i><i class="keep" style="width:${w(left)}%"></i><i class="rot" style="width:${w(spoil)}%"></i></span></td></tr>`;
  };
  const gears = GEAR_NAMES.filter(g => (S.gear[g] || 0) || gearOf(W, raw, P, g) || need.gear[g]).map(g => {
    const have = S.gear[g] || 0, buy = gearOf(W, raw, P, g), carry = Math.min(have + buy, need.gear[g] || 0), lost = Math.round(carry * (CO.GEAR_BREAK + CO.GEAR_LOST) / 2);
    return row(`${g} 장비`, have, buy, carry, lost, 0, '쓸 어림 = 망가질 어림');
  });
  const tor = need.torch;
  return `<div class="panel store"><header><h2>창고</h2><span class="sub">이번 달 어림 · 포션 보관 ${CO.POT_KEEP}달 · 성수 ${CO.HOLY_KEEP}달</span></header>
    <div class="tw"><table class="grid slim store"><thead><tr><th>품목</th><th class="n">보유</th><th class="n">구매</th><th class="n">휴대</th><th class="n">쓸 어림</th><th class="n">상함</th><th class="n">다음 달</th><th></th></tr></thead><tbody>
      ${row('상단 포션', H.pot, potN, need.pot - Math.min(need.pot, H.holy + holyN), useP, spoilP)}
      ${H.holy || holyN ? row('교회 성수', H.holy, holyN, Math.min(need.pot, H.holy + holyN), useH, spoilH) : ''}
      ${gears.join('')}
      ${row('횃불', S.torch || 0, torchBuy(c, P), tor, Math.min(tor, (S.torch || 0) + torchBuy(c, P), fc.torch || 0), 0, '상하지 않음 · 남은 것은 돌아옴')}
    </tbody></table></div>
    <div class="legend"><span><i class="sw use"></i>쓸 어림</span><span><i class="sw keep"></i>다음 달 남음</span><span><i class="sw rot"></i>상함</span></div></div>`;
}
// 보급 구매: 상단 포션 · 교회 성수 · 횃불 · 장비를 한 표에서. 비워 둔 칸은 편성에 모자란 만큼
function buyPanel(W: World, raw: Plan, P: Plan) {
  const c = us(W), S = supOf(c), H = potsOf(c), need = needOf(P);
  const potN = potBuy(W, raw, P), holyN = (raw.buy && raw.buy.holy) || 0, auto = !(raw.buy && raw.buy.pot != null), tN = torchBuy(c, P), tAuto = !(raw.buy && raw.buy.torch != null);
  const autoBtn = (on: boolean, act: string) => (on ? '<small>자동</small>' : `<button type="button" class="link" data-act="${act}">자동</button>`);
  const rows = [
    `<tr><td><b>상단 포션</b></td><td class="n">${W.potion}G</td><td class="n">${H.pot}</td><td class="n">${need.pot}</td><td>${stepper('buyPot', 0, potN, '상단 포션 구매', 5)}${autoBtn(auto, 'auto-pot')}</td><td class="n">${fmt(potN * W.potion)}G</td></tr>`,
    `<tr><td><b>교회 성수</b><small>사망 −${Math.round(CO.HOLY * 100)}% · 보관 ${CO.HOLY_KEEP}달</small></td><td class="n">${churchPrice(W, 0)}G</td><td class="n">${H.holy}</td><td class="n dim">-</td><td>${stepper('buyHoly', 0, holyN, '교회 성수 구매', 5)}</td><td class="n">${fmt(holyN * churchPrice(W, 0))}G</td></tr>`,
    `<tr><td><b>횃불</b><small>조당 개수는 출정 표에서 · 남으면 창고로</small></td><td class="n">${CO.TORCH_PRICE}G</td><td class="n">${S.torch || 0}</td><td class="n">${need.torch}</td><td>${stepper('buyTorch', 0, tN, '횃불 구매', 5)}${autoBtn(tAuto, 'auto-torch')}</td><td class="n">${fmt(tN * CO.TORCH_PRICE)}G</td></tr>`,
    ...GEAR_NAMES.map((g, i) => { const b = gearOf(W, raw, P, g); return `<tr><td><b>${g} 장비</b></td><td class="n">${CO.GEAR_PRICE}G</td><td class="n">${S.gear[g] || 0}</td><td class="n">${need.gear[g] || '-'}</td><td>${stepper('buyGear', i, b, `${g} 장비 구매`)}</td><td class="n">${fmt(b * CO.GEAR_PRICE)}G</td></tr>`; }),
  ];
  return `<div class="panel"><header><h2>보급 구매</h2><span class="sub">상단 · 교회 · 포션 보관 ${CO.POT_KEEP}달</span></header>
    <div class="tw"><table class="grid buy"><thead><tr><th>품목</th><th class="n">단가</th><th class="n">창고</th><th class="n">필요</th><th>구매</th><th class="n">금액</th></tr></thead><tbody>${rows.join('')}</tbody></table></div></div>`;
}

// ---------- 관리국 게시판: 의뢰 ----------
// 공표된 경쟁은 순위가 공개된다(신문에도 실린다). 납품은 받는 달에 맡을 양을 정하고, 남이 얼마를 맡았는지는 상단 장부 1단계부터 보인다
const BY_CLS: Record<string, string> = { 영주: 'lord', 상단: 'mkt', 교회: 'chu', 마법학교: 'mag', '수도 수집가': 'mag', 수도: 'mag' };
function jobCard(W: World, raw: Plan, J: Job) {
  const c = us(W), L = W.last, months = J.until - J.from + 1, sign = J.kind === 'deliver' && J.from === W.month, left = J.until - W.month + 1;
  // 한 줄 요약 (명사로): 무엇을 받나 · 어디서 · 언제까지
  const rk = J.kind === 'race' ? W.cos.map((_, k) => k).filter(k => W.cos[k].style !== 'crowd').sort((x, y) => ((J.score || [])[y] || 0) - ((J.score || [])[x] || 0)).indexOf(0) + 1 : 0;
  const sum = J.kind === 'race' ? `포상 ${(J.prize || []).map(fmt).join(' · ')}G · ${FLOORS[J.f].name} 해낸 조 수 상위 ${(J.prize || []).length}곳${W.month > J.from ? ` · 우리 ${rk}위` : ''}`
    : J.kind === 'explore' ? `선금 ${fmt(J.prem)}G/조 · ${FLOORS[J.f].name} · 덜 보내면 반납 ×${J.pen}`
    : `웃돈 +${fmtG(J.prem)}G/개 · ${ITEMS[J.f].name} ${fmt(J.qty)}개 · 위약금 ${fmtG(J.pen)}G/개`;
  const head = `<div class="job-h"><span class="who ${BY_CLS[J.by] || 'mkt'}">${J.by}</span><b>${J.title}</b><span class="due">${J.until}월 마감${J.until >= W.month ? ` · ${left}달 남음` : ' · 끝남'}</span></div><div class="job-sum">${sum}</div>`;
  if (J.kind === 'race') {
    const order = W.cos.map((o, k) => [k, (J.score || [])[k] || 0] as [number, number]).filter(([k]) => W.cos[k].style !== 'crowd').sort((a, b) => b[1] - a[1]), top = Math.max(1, ...order.map(x => x[1]));
    return `<article class="job race">${head}<p>방식: 신청 없음 · ${FLOORS[J.f].name}에 보낸 조가 곧 참여 · 해낸 조 수(4명 기준) 석 달 합</p>
      
      ${W.month > J.from ? `<div class="race-t">${order.slice(0, 5).map(([k, v], r) => `<div class="race-r${k === 0 ? ' us' : ''}"><span>${r + 1}. ${W.cos[k].name}</span><i><b style="width:${Math.round(v / top * 100)}%"></b></i><span class="n">${v.toFixed(1)}</span></div>`).join('')}</div>` : '<p class="note">첫 달이라 아직 순위가 없어요. 다음 달부터 이 판과 신문에 지난달까지의 순위가 붙어요.</p>'}</article>`;
  }
  if (J.kind === 'explore') {
    const P = sanitize(W, c, raw), n = (raw.take && raw.take[J.id]) || 0, sent = P.parties[J.f];
    return `<article class="job explore">${head}<p>방식: 적어 낸 조 수만큼 선금 즉시 · 달마다 새로 · 덜 보낸 조 가정산에서 반납 · 지도 ${Math.round(c.map ? c.map[J.f] : 0)}%</p>
      
      <div class="take"><span>적어 낼 조</span>${stepper('take', J.id, n, `${J.title} 적어 낼 조`)}<span class="est">지금 편성은 ${FLOORS[J.f].name} <b>${sent}조</b>.${n ? ` 선금 <b class="pos">+${fmt(n * J.prem)}G</b>${n > sent ? `, 이대로면 ${n - sent}조 몫 <b class="neg">${fmt(Math.round((n - sent) * J.prem * J.pen))}G</b>를 돌려내요` : ''}.` : ''}</span></div></article>`;
  }
  const per = L && L.res[0].sent[J.f] ? L.res[0].got[J.f] / L.res[0].sent[J.f] : FLOORS[J.f].take * 0.8;
  const P = sanitize(W, c, raw), est = Math.round(per * P.parties[J.f] * months), take = (raw.take && raw.take[J.id]) || 0;
  const seeOthers = lvOf(W, 'mkt') >= 1, others = J.take.reduce((a, v, k) => a + (k ? v : 0), 0);
  const body = sign
    ? `<div class="take"><span>맡을 양</span>${stepper('take', J.id, take, `${J.title} 맡을 양`, CO.TAKE_STEP)}<span class="est">지금 편성(${FLOORS[J.f].name} ${P.parties[J.f]}조)이면 석 달 약 <b>${fmt(est)}개</b>.${take ? ` 다 채우면 웃돈 <b class="pos">+${fmt(take * J.prem)}G</b>, 못 채운 개수마다 ${fmtG(J.pen)}G 위약금.` : ''}</span></div>`
    : `<div class="prog"><div class="meter"><span class="done" style="width:${J.take[0] ? Math.round(J.done[0] / J.take[0] * 100) : 0}%"></span></div><p>${J.take[0] ? `맡은 ${fmt(J.take[0])}개 중 <b>${fmt(J.done[0])}개</b> 넘김 · 남은 ${fmt(J.take[0] - J.done[0])}개` : '이 의뢰는 맡지 않았어요'}${seeOthers ? ` · 다른 용병단이 맡은 양 모두 ${fmt(others)}개` : ''}</p></div>`;
  return `<article class="job">${head}<p>방식: 받는 달에 맡을 양 결정 · 판 것 중 맡은 만큼 자동 납품 · 겹치면 명성 순</p>
    ${body}</article>`;
}
// 출정: 맡은 의뢰의 진행 띠 (넘긴 양, 이번 편성의 어림, 남은 양). 무엇을 하라고 말하지 않고 숫자만
function jobsTrack(W: World, P: Plan) {
  const L = W.last, rows = jobsOpen(W).filter(J => J.kind === 'race' || (J.kind === 'explore' ? P.take && P.take[J.id] : J.take[0] || (J.from === W.month && P.take && P.take[J.id]))).map(J => {
    if (J.kind === 'explore') {
      const n = (P.take && P.take[J.id]) || 0, sent = P.parties[J.f];
      return `<div class="tk"><div class="tk-h"><b>${J.title}</b><span>적어 낸 ${n}조 · 선금 ${fmt(n * J.prem)}G</span></div>
        <p>${FLOORS[J.f].name}에 지금 <b class="n">${sent}</b>조${sent < n ? ` · <b class="neg">${n - sent}조 모자람</b> (가정산에서 ${fmt(Math.round((n - sent) * J.prem * J.pen))}G 반납)` : ' · 계획대로'}</p></div>`;
    }
    if (J.kind === 'race') {
      const sc = J.score || [], order = W.cos.map((_, k) => k).filter(k => W.cos[k].style !== 'crowd').sort((a, b) => sc[b] - sc[a]), rk = order.indexOf(0) + 1, lead = order[0];
      return `<div class="tk"><div class="tk-h"><b>${J.title}</b><span>${J.until - W.month + 1}달 남음 · 우리 ${rk}등</span></div>
        <p>우리 <b class="n">${(sc[0] || 0).toFixed(1)}</b>조 · 1등 ${W.cos[lead].name} <b class="n">${(sc[lead] || 0).toFixed(1)}</b>조 · 이번 달 ${FLOORS[J.f].name} ${P.parties[J.f]}조</p></div>`;
    }
    const take = J.from === W.month ? (P.take && P.take[J.id]) || 0 : J.take[0], done = J.from === W.month ? 0 : J.done[0];
    const per = L && L.res[0].sent[J.f] ? L.res[0].got[J.f] / L.res[0].sent[J.f] : FLOORS[J.f].take * 0.8, fc = Math.round(per * P.parties[J.f]);
    const w = (v: number) => Math.min(100, Math.round(v / Math.max(1, take) * 100));
    return `<div class="tk"><div class="tk-h"><b>${J.title}</b><span>${J.until - W.month + 1}달 남음 · 맡은 양 ${fmt(take)}개${J.from === W.month ? ' (받는 중)' : ''}</span></div>
      <div class="meter" role="img" aria-label="넘긴 ${done}개, 이번 달 어림 ${fc}개, 맡은 양 ${take}개"><span class="done" style="width:${w(done)}%"></span><span class="fc" style="left:${w(done)}%;width:${Math.max(0, Math.min(100 - w(done), w(fc)))}%"></span></div>
      <p>넘긴 <b class="n">${fmt(done)}</b> · 이번 달 어림 <b class="n">+${fmt(fc)}</b> · 남은 <b class="n">${fmt(Math.max(0, take - done))}</b></p></div>`;
  });
  return rows.length ? `<div class="panel jobs-t"><header><h2>맡은 의뢰</h2></header><div class="jtrack">${rows.join('')}</div></div>` : '';
}
function boardPanel(W: World, raw: Plan) {
  const open = [...jobsOpen(W)].sort((a, b) => (a.kind === 'explore' ? -2 : a.from === W.month ? -1 : 0) - (b.kind === 'explore' ? -2 : b.from === W.month ? -1 : 0));
  const done = (W.jobs || []).filter(J => J.until < W.month && J.until >= W.month - 3);
  return `<div class="panel board"><header><h2>관리국 게시판</h2><span class="sub">영주 · 상단 · 교회 · 마법학교가 모든 용병단에 똑같이 내건 의뢰</span></header>
    ${open.length ? open.map(J => jobCard(W, raw, J)).join('') : '<p class="note">지금 붙은 의뢰가 없어요. 시장에 모자란 전리품이 생기면 납품 의뢰가 붙어요.</p>'}
    <h3 class="rs-h">영주청 고시</h3>${lawsHtml(W)}
    ${done.length ? `<h3 class="rs-h">끝난 의뢰</h3>${done.filter(J => J.kind !== 'explore').map(J => `<p class="note">${J.by} · ${J.title} (${J.from}~${J.until}월)${J.kind === 'deliver' ? ` · 우리 ${fmt(J.done[0])} / ${fmt(J.take[0])}개` : ` · 우리 ${((J.score || [])[0] || 0).toFixed(1)}조`}</p>`).join('')}` : ''}</div>`;
}

// ---------- 인원: 숙소(침상이 상한)와 신입 모집. 신입은 수습으로 들어와 낀 조가 성공을 쌓으면 대원이 된다 ----------
// 이번 달 찾을 신입 (비워 두면 빈 침상만큼)
// 이번 달 지원자 어림 (가운데 값). 직업별 몫은 이것으로 어림한다

// 이번 달 뽑으려는 신입: 우리는 지원자 명단에서 고른 사람(고르지 않으면 빈 침상만큼 기본 편성 순), 계약금은 사람마다
const recruitPicks = (W: World, raw: Plan) => candWants(W, us(W), raw, roomOf(us(W)));
const recruitOf = (W: World, raw: Plan) => (us(W).crew ? recruitPicks(W, raw).length : raw.recruit == null ? roomOf(us(W)) : Math.min(roomOf(us(W)), raw.recruit));
const recruitCost = (W: World, raw: Plan) => (us(W).crew ? recruitPicks(W, raw).reduce((a, p) => a + candPrice(p, CO.RECRUIT), 0) : recruitOf(W, raw) * CO.RECRUIT);
function staffPanel(W: World, raw: Plan, ui: DeskUi) {
  const c = us(W), beds = bedsOf(c), rook = rookCount(c), hurtN = (c.crew || []).filter(x => x.hurt).length, pend = c.pendingBeds || 0, L = W.last;
  const want = recruitOf(W, raw), build = !!raw.dorm && !pend, est = W.intel && W.intel.est.apps;
  const fames = W.cos.filter(x => x.style !== 'crowd').map(x => x.fame || 0).sort((a, b) => b - a), fr = fames.indexOf(c.fame || 0) + 1;
  // 침상 그림: 칸 하나가 침상 하나 (대원 · 수습 · 이번 달 뽑을 신입 · 빈 침상 · 공사 중)
  const cells = [...Array(c.members - rook).fill('vet'), ...Array(rook).fill('rook'), ...Array(want).fill('new'), ...Array(Math.max(0, beds - c.members - want)).fill(''), ...Array(pend || (build ? CO.DORM_ADD : 0)).fill('build')];
  const lastW = L ? L.res.reduce((a, r) => a + r.recruitWant, 0) : 0, lastG = L ? L.res.reduce((a, r) => a + r.recruited, 0) : 0;
  return `<div class="panel staff"><header><h2>인원</h2><span class="sub">명성 ${Math.round(c.fame || 0)}${L ? ` · 변경 ${fr}위` : ''}</span></header>
    <div class="st-kpi">
      <div><small>인원</small><b>${c.members}</b><i>${rook ? `수습 ${rook}명` : c.crew ? `숙련 이상 ${c.crew.filter(x => (x.sk ?? 40) >= 2 * CO.TIER_STEP).length}명` : '모두 대원'}${hurtN ? ` · 부상 ${hurtN}명` : ''}</i></div>
      <div><small>침상</small><b>${beds}</b><i>${pend ? `공사 중 +${pend}` : `빈 침상 ${beds - c.members}`}</i></div>
      <div><small>보낼 수 있는 조</small><b>${maxParties(c)}</b><i>${hurtN ? '부상자 빼고 · ' : ''}4명이 한 조</i></div>
      <div><small>월 급여</small><b>${fmt(wage(W))}G</b><i>${c.crew ? '실력 단계대로 + 관리비' : want ? `신입 들면 ${fmt(wageOf(c.members + want))}G` : '1인 30G + 관리비'}</i></div>
    </div>
    <div class="beds" role="img" aria-label="침상 ${beds}개 중 대원 ${c.members - rook}, 수습 ${rook}, 이번 달 뽑을 신입 ${want}">${cells.map((k, i) => `<i class="bed ${k}${i && i % 4 === 0 ? ' gap' : ''}"></i>`).join('')}</div>
    <div class="legend"><span><i class="bed vet"></i>대원</span><span><i class="bed rook"></i>수습</span><span><i class="bed new"></i>이번 달 신입</span><span><i class="bed"></i>빈 침상</span><span><i class="bed build"></i>공사 중</span></div>
    <div class="blds">
      ${c.hq ? bldCard('house', '숙소', `${hqLv(c, 'dorm') + 1}단계 · 침상 ${beds}`, c.pendingHq === 'dorm' ? '증축 공사 중 · 다음 달 정산 때 완공' : hqCost(c, 'dorm') ? `다음 단계 침상 ${CO.HQ_BEDS[hqLv(c, 'dorm') + 1]} · 공사비 ${fmt(hqCost(c, 'dorm'))}G · 본부(건물 창)에서 올려요` : '끝까지 올렸어요 (50명)', '<button type="button" class="link" data-act="place" data-place="train">본부 보기</button>') : bldCard('house', '숙소', `침상 ${beds}${pend ? ` → ${beds + pend}` : ''}`, pend ? `증축 공사 중 · 다음 달 정산 때 침상 +${pend}` : `증축하면 다음 달 침상 +${CO.DORM_ADD} · 공사비 ${fmt(dormCost(c))}G · 침상마다 유지비 월 ${CO.DORM_KEEP}G`,
        pend ? '<span class="lvl dim">공사 중</span>' : `<button type="button" class="tog" data-act="dorm" aria-pressed="${build}">${build ? '증축 취소' : '증축하기'}</button>`)}
      ${c.crew ? '' : bldCard('recruit', '신입 모집', `1인 ${CO.RECRUIT}G부터`, `빈 침상 ${roomOf(c)}개까지 · 다음 달부터 수습으로 조에 끼고, 낀 조가 ${CO.ROOK_WINS}번 성공하면 대원`,
        `<span class="ctl2">${stepper('recruit', 0, want, '뽑을 신입 수')}${raw.recruit == null ? '<small>빈 침상만큼</small>' : '<button type="button" class="link" data-act="auto-recruit">빈 침상만큼</button>'}</span>`)}
    </div>
    ${c.crew ? `<h3 class="rs-h">단원 명단</h3>${rosterHtml(W, (ui.sort || {}).rs)}<h3 class="rs-h">지원자 명단 <span class="dim">이번 달 우리 문을 두드린 사람</span></h3>${candHtml(W, raw, (ui.sort || {}).cd)}` : ''}
    <p class="note">마을 지원자 이번 달 ${est ? (est.lo === est.hi ? `${est.lo}명` : `${est.lo}~${est.hi}명`) : '?'}${L ? (lastW ? ` · 지난달엔 모두 ${lastW}명을 찾아 ${lastG}명이 들어갔고 1인 ${fmt(L.res[0].recruitPrice || CO.RECRUIT)}G` : ' · 지난달엔 신입을 찾은 곳이 없었어요') : ''}. 찾는 사람이 더 많으면 값이 오르고, 명성이 높은 곳에 먼저 가요.</p>
  </div>`;
}

// 결재안 줄: 이번 달 나갈 돈을 항목마다 (정보 주차에 정한 것 + 탐험 주차에 정한 것). place는 그 줄을 정하는 곳
export type CostLine = { k: string; name: string; place: string; now: number; last: number };
export function costLines(W: World, raw: Plan): CostLine[] {
  const c = us(W), P = sanitize(W, c, raw), s = W.last ? W.last.res[0].spend : null;
  const potN = potBuy(W, raw, P), holyN = (P.buy && P.buy.holy) || 0, gear = Object.values(gearBuy(c, P)).reduce((a, b) => a + b, 0);
  const rn = recruitOf(W, raw);
  const L = (k: string, name: string, place: string, now: number, last: number) => ({ k, name, place, now: Math.round(now), last: Math.round(last) });
  return [
    L('wage', '급여', 'staff', wage(W), s ? s.wage : 0),
    L('recruit', `신입 ${rn}명`, 'staff', recruitCost(W, raw), s ? s.recruit : 0),
    L('dorm', P.dorm || P.build === 'dorm' ? '숙소 유지비 · 증축' : '숙소 유지비', 'staff', dormKeep(bedsOf(c) + (c.pendingBeds || 0)) + (P.dorm || P.build === 'dorm' ? dormCost(c) : 0), s ? s.dorm || 0 : 0),
    L('hq', P.build && P.build !== 'dorm' ? `본부 공사 (${HQ_NAME[P.build]}) · 유지비` : '본부 유지비', 'train', hqKeep(c) + (P.build && P.build !== 'dorm' ? hqCost(c, P.build) : 0), s ? s.hq || 0 : 0),
    L('heal', '치료비', 'staff', 0, s ? s.heal || 0 : 0),
    L('train', `교관 (${COACH_N[P.coach ?? coachOf(P.train)]})`, 'train', P.train, s ? s.train : 0),
    L('potion', `포션 ${potN} · 성수 ${holyN}병`, 'market', potN * W.potion + holyN * churchPrice(W, 0), s ? s.potion : 0),
    L('torch', `횃불 ${torchBuy(c, P)}개`, 'market', torchBuy(c, P) * CO.TORCH_PRICE, s ? s.torch || 0 : 0),
    L('gear', `장비 ${gear}벌`, 'market', gear * CO.GEAR_PRICE, s ? s.gear : 0),
    L('root', '근원 기금 · 후원', 'church', (P.root ? P.root.seal + P.root.mine : 0) + (P.donate || 0), s ? s.root + s.donate : 0),
    L('intel', '정보망', 'alley', intelCost(P), s ? s.intel : 0),
    L('probe', `조사 의뢰 ${(W.probes || []).filter(x => x.m === W.month).length}건`, 'alley', probeCost(W), s ? s.probe : 0),
    L('sortie', '출정 · 계약 파티', 'gate', sortieCost(P).reduce((a, b) => a + b, 0) + hireCost(P), s ? s.sortie + s.hire : 0),
    L('tax', '영주세 (정직하게 낼 때)', 'board', taxGuess(W, P, forecast(W, P)).tax, s ? s.tax + s.fine : 0),
  ];
}
// 이번 달 결재에 드는 돈 (위 줄을 정보 · 내정 · 출정 · 급여로 묶은 것)
export function monthCost(W: World, raw: Plan) {
  const ls = costLines(W, raw), sum = (ks: string[]) => ls.filter(l => ks.includes(l.k)).reduce((a, l) => a + l.now, 0);
  const all = ls.reduce((a, l) => a + l.now, 0);
  // 묶음: 출정 · 급여 · 신입 · 본부(숙소 · 본부 · 교관 · 치료) · 보급(포션 · 횃불 · 장비) · 세금(어림) · 정보 · 그 밖(근원 기금 · 후원)
  const parts: [string, number][] = [['출정', sum(['sortie', 'tool'])], ['급여', sum(['wage'])], ['신입', sum(['recruit'])], ['본부', sum(['dorm', 'hq', 'train', 'heal'])],
    ['보급', sum(['potion', 'torch', 'gear'])], ['세금', sum(['tax'])], ['정보', sum(['intel', 'probe'])], ['기금', sum(['root'])]];
  return { all, exp: parts[0][1], parts: parts.filter(([, v]) => v > 0) };
}

export function readerHtml(W: World, ui: DeskUi) {
  if (!ui.open) return '';
  const tab = DOC_TABS.some(t => t[0] === ui.tab) ? ui.tab : 'report', pinned = ui.pins.includes(tab);
  const docId = tab === 'report' ? 'results' : tab === 'probe' ? 'intel' : tab === 'book' ? 'book' : 'doc-' + tab;
  return `<div class="reader" role="dialog" aria-modal="true" aria-label="자료함"><div class="reader-in">
    <div class="reader-bar"><div class="tabs" role="tablist">${DOC_TABS.map(([id, n]) => `<button type="button" class="tab" role="tab" data-tab="${id}" aria-selected="${id === tab}">${n}</button>`).join('')}</div>
      ${tab === 'probe' ? '' : `<button type="button" class="pin" data-pin="${tab}" aria-pressed="${pinned}">${pinned ? '메모에 고정됨' : '작전 메모에 고정'}</button>`}
      <button type="button" class="close" data-act="close-doc" aria-label="자료함 닫기">×</button></div>
    <article class="co-sheet doc" id="${docId}" role="tabpanel">${docBody(W, tab)}</article></div></div>`;
}

// 내정: 책상 위 마을 지도(누르면 장소 창)와 옆에 붙은 결재안(이번 달 들어올 돈 · 나갈 돈 전부)
// 챙길 일: 장소마다 손볼 일이 있을 때만 짧은 말을 붙인다 (지도에 밀랍 봉인으로)
function sealsOf(W: World, raw: Plan): Record<string, string> {
  const c = us(W), P = sanitize(W, c, raw), X = potsExpiring(c), I = W.intel, need = needOf(P), H = potsOf(c);
  const hurt = (c.crew || []).filter(x => x.hurt).length, room = roomOf(c), rn = recruitOf(W, raw);
  const near = I ? SRCS.filter(k => I.lv[k] < 3 && INTEL.UP[k][I.lv[k]] - I.acc[k] <= 150 && INTEL.UP[k][I.lv[k]] > I.acc[k]) : [];
  const R = (W.roots || []).find(r => r.found && !r.done), news = W.mat ? W.mat.dem.filter(d => d.until >= W.month && d.at >= W.month - 1).length : 0;
  const sign = jobsSign(W).length + jobsExplore(W).length;
  return {
    board: sign ? String(sign) : '',
    staff: room && !rn && !P.dorm ? `빈 침상 ${room}` : hurt ? `부상 ${hurt}명 쉼` : '',
    market: X.pot ? `포션 ${X.pot}병 상함` : need.pot > H.pot + H.holy + potBuy(W, raw, P) + ((raw.buy && raw.buy.holy) || 0) ? '포션 모자람' : '',
    church: R ? '근원 기금' : '',
    alley: near.length ? `${SRC_INFO[near[0]].n} 곧 다음 단계` : '',
    paper: W.last ? '새' : '', book: news ? String(news) : '', probe: docCount(W, 'probe') ? String(docCount(W, 'probe')) : '',
  };
}
function placeBody(W: World, raw: Plan, ui: DeskUi, k: string) {
  const P = sanitize(W, us(W), raw);
  if (k === 'board') return boardPanel(W, raw);
  if (k === 'staff') return staffPanel(W, raw, ui);
  if (k === 'train') return trainPanel(W, raw);
  if (k === 'market') return buyPanel(W, raw, P);
  if (k === 'church') { const roots = depthsHtml(W, raw); return roots ? `<div class="panel">${roots}</div>` : '<p class="note">근원 기금: 근원을 찾으면 여기서 봉인 · 채굴장 기금을 넣어요. 성수는 보급 창에서.</p>'; }
  if (k === 'alley') return probePanel(W, ui) + netPanel(W, raw);
  return '';
}
export function placeHtml(W: World, raw: Plan, ui: DeskUi) {
  const k = ui.place; if (!k || !PLACES[k]) return '';
  return `<div class="reader place" role="dialog" aria-modal="true" aria-label="${PLACES[k].where}"><div class="reader-in">
    <div class="reader-bar"><div class="tabs" role="tablist">${Object.entries(PLACES).map(([id, x]) => `<button type="button" class="tab" role="tab" data-act="place" data-place="${id}" aria-selected="${id === k}">${x.where}</button>`).join('')}</div>
      <button type="button" class="close" data-act="close-place" aria-label="창 닫기">×</button></div>
    <div class="place-body">${placeBody(W, raw, ui, k)}</div></div></div>`;
}
// 결재안: 들어올 돈(수입 어림)과 나갈 돈 줄마다 이번 달 · 지난달. 줄 이름을 누르면 그 장소 창이 열린다
function ledgerHtml(W: World, raw: Plan) {
  const c = us(W), P = sanitize(W, c, raw), fc = forecast(W, P), L = W.last, ls = costLines(W, raw), G = taxGuess(W, P, fc), gov = G.sub + G.aid + G.adv;
  const govL = L ? L.res[0].sales - (L.res[0].lootSales ?? 0) - L.res[0].matSales - (L.res[0].jobPay || 0) - (L.res[0].mapSale || 0) : 0;
  const out = ls.reduce((a, l) => a + l.now, 0), outL = ls.reduce((a, l) => a + l.last, 0);
  const go = (l: { place: string; name: string }) => (l.place === 'gate' ? `<button type="button" class="lg" data-act="phase" data-phase="1">${l.name}</button>` : `<button type="button" class="lg" data-act="place" data-place="${l.place}">${l.name}</button>`);
  const row = (l: CostLine) => `<tr class="${l.now !== l.last && L ? 'changed' : ''}"><td>${go(l)}</td><td class="n now">${l.now ? '−' + fmt(l.now) : '0'}</td><td class="n last">${L ? (l.last ? '−' + fmt(l.last) : '0') : ''}</td></tr>`;
  const net = fc.mean + (P.sellMap != null ? CO.MAP_COPY : 0) + gov - out, netL = L ? L.res[0].net : 0;
  return `<aside class="ledger" aria-labelledby="h-ledger">
    <h2 id="h-ledger">제${W.month}월 결재안 <small>금고 ${fmt(c.cash)}G</small></h2>
    <table><thead><tr><th>들어올 돈</th><th>이번 달</th><th>${L ? '지난달' : ''}</th></tr></thead><tbody>
      <tr><td><button type="button" class="lg" data-act="phase" data-phase="1">전리품 · 소재 (어림)</button></td><td class="n now">${fmt(fc.mean)}</td><td class="n last">${L ? fmt((L.res[0].lootSales ?? 0) + L.res[0].matSales + (L.res[0].jobPay || 0)) : ''}</td></tr>
      ${gov || govL ? `<tr><td><button type="button" class="lg" data-act="place" data-place="board">영주청 지원금 · 선금 (어림)</button></td><td class="n now">${fmt(gov)}</td><td class="n last">${L ? fmt(govL) : ''}</td></tr>` : ''}
      ${P.sellMap != null || (L && L.res[0].mapSale) ? `<tr><td><button type="button" class="lg" data-act="place" data-place="train">지도 사본 판매</button></td><td class="n now">${P.sellMap != null ? fmt(CO.MAP_COPY) : '0'}</td><td class="n last">${L ? fmt(L.res[0].mapSale || 0) : ''}</td></tr>` : ''}</tbody></table>
    <table><thead><tr><th>나갈 돈</th><th>이번 달</th><th>${L ? '지난달' : ''}</th></tr></thead><tbody>
      ${ls.filter(l => l.now || l.last).map(row).join('')}
      <tr class="tot"><td>나갈 돈 합계</td><td class="n">−${fmt(out)}</td><td class="n last">${L ? '−' + fmt(outL) : ''}</td></tr>
      <tr class="tot"><td>순이익 (어림)</td><td class="n ${net < 0 ? 'neg' : 'pos'}">${sgn(net)}</td><td class="n last">${L ? sgn(netL) : ''}</td></tr>
      <tr><td>결재 뒤 금고 (어림)</td><td class="n">${fmt(c.cash + net)}</td><td></td></tr></tbody></table>
    <button type="button" class="gate" data-act="phase" data-phase="1">출정 편성으로 →</button>
  </aside>`;
}
// 지도 위 단추 줄: 지도의 장소와 책상 위 자료를 단추로도 연다 (봉인 표시도 같이). 숫자 키 1~6은 장소, 7~9 · 0은 자료
export const PLACE_KEYS = Object.keys(PLACES), DOC_KEYS = DOC_TABS.map(t => t[0]);
function placeBar(seals: Record<string, string>) {
  const mark = (k: string) => (seals[k] ? `<span class="mk" title="${seals[k]}">${seals[k].length <= 2 ? seals[k] : '!'}</span>` : '');
  return `<div class="placebar" role="toolbar" aria-label="장소와 자료">
    ${PLACE_KEYS.map((k, i) => `<button type="button" class="pb" data-act="place" data-place="${k}" title="${PLACES[k].where}${seals[k] ? ' · ' + seals[k] : ''}">${PLACES[k].name}<kbd>${i + 1}</kbd>${mark(k)}</button>`).join('')}
    <span class="sep" aria-hidden="true"></span>
    ${DOC_TABS.map(([k, n], i) => `<button type="button" class="pb doc" data-act="open-doc" data-tab="${k}">${n}<kbd>${(PLACE_KEYS.length + i + 1) % 10}</kbd>${mark(k === 'report' ? '' : k)}</button>`).join('')}
    <span class="sp"></span><button type="button" class="pb go" data-act="phase" data-phase="1">출정 편성으로 →</button></div>`;
}
export function infoWeekHtml(W: World, raw: Plan, ui: DeskUi) {
  const seals = sealsOf(W, raw);
  return `${placeBar(seals)}<div class="town">${townSceneHtml(fmt(townOf(W)), seals)}${ledgerHtml(W, raw)}</div>
    ${storeHtml(W, raw, sanitize(W, us(W), raw))}
    ${readerHtml(W, ui)}${placeHtml(W, raw, ui)}`;
}

// ---------- 출정 ----------
// 직업 표시: 색과 첫 글자
const CLS_TAG: Record<string, string> = { 전사: 'war', 궁수: 'arc', 마법사: 'mag', 사제: 'pri', 도적: 'thf' };
const pip = (p: Person) => `<i class="cls ${CLS_TAG[p.c] || ''}" aria-hidden="true">${p.c[0]}</i>`;

// 편성판: 기본 편성 줄, 층마다 조 카드(자리 넷), 대기 인원. 사람을 누르고 자리를 누르면 들어가거나 서로 바뀐다
function tplBar(W: World, P: Plan) {
  const c = us(W), tpl = P.tpl || CO.TPL0, crew = c.crew || [];
  const counts = CLASSES.map(k => [k, crew.filter(x => x.c === k).length, crew.filter(x => x.c === k && isRook(x)).length] as const);
  return `<div class="tpl"><b>기본 편성</b>${tpl.map((k, s) => `<select data-k="tpl" data-i="${s}" aria-label="기본 편성 ${s + 1}번 자리"><option value="">아무나</option>${CLASSES.map(x => `<option${x === k ? ' selected' : ''}>${x}</option>`).join('')}</select>`).join('')}
      <button type="button" class="ghost" data-act="refill">기본 편성대로 다시 짜기</button></div>
    <div class="roster">${counts.map(([k, n, r]) => `<span>${pip({ id: -1, c: k })}${k} <b>${n}</b>${r ? ` <small>(수습 ${r})</small>` : ''}</span>`).join('')}</div>`;
}
export function expWeekHtml(W: World, raw: Plan, ui: DeskUi) {
  const c = us(W), P = sanitize(W, c, raw), L = W.last, S = supOf(c), need = needOf(P), gb = gearBuy(c, P), cost = monthCost(W, raw);
  const others = (f: number) => (L ? L.plans.reduce((a, Q, i) => a + (i ? Q.parties[f] + Q.hire[f] : 0), 0) : f === 0 ? 75 : 0);
  const sc = sortieCost(P);
  const H = potsOf(c), holyB = (P.buy && P.buy.holy) || 0, potB = P.buy && P.buy.pot != null ? P.buy.pot : Math.max(0, need.pot - H.pot - H.holy - holyB);
  const potHave = H.pot + H.holy + potB + holyB;
  // 층 선택: 층마다 한 줄. 시세 · 위험 · 지도 · 지난달 남들 · 성공 · 조당 어림, 그리고 우리 조 · 계약 조 · 포션 상한
  const rows = FLOORS.map((F, f) => {
    if (f >= W.unlocked) return f === W.unlocked ? `<tr class="closed"><td><b>${F.name}</b><small>${ITEMS[f].name}</small></td><td colspan="11">닫힘 · 길 뚫기 ${Math.min(99, Math.round(W.prog / CO.OPEN_WINS[W.unlocked - 1] * 100))}%</td></tr>` : '';
    // 지도(이해도)가 낮으면 성공도 캐 오는 양도 준다 (조원 경험 · 길잡이는 빼고 지도만으로)
    const n = P.parties[f] + P.hire[f], crowd = n + others(f), U = undMods(mapOf(c, f), mapOf(c, f), f), p = clamp(succRate(c, f, P.pots[f], crowd) + U.succ, 0.05, 0.97);
    const cut = L && L.floors[f] && L.floors[f].cut ? Math.min(1, L.floors[f].cut!) : 1, per = p * F.take * lootMul(c, f) * U.loot * cut * 0.925 * W.price[f];
    const pr = L && L.Q[f] ? W.price[f] - ITEMS[f].P0 : 0;
    // 횃불: 지도만큼 헤매는 것으로 셈한 돌아설 확률 (조원 경험 · 길잡이는 빼고)
    const dark = tripOdds(carryOf(raw, f), torchRate(f, mapOf(c, f))).dark;
    return `<tr class="${n ? 'on' : ''}"><td><b>${F.name}</b><small>${ITEMS[f].name}</small></td>
      <td class="n">${fmtG(W.price[f])}G<small class="${pr > 0 ? 'pos' : pr < 0 ? 'neg' : ''}">기준 ${fmtG(ITEMS[f].P0)}</small></td>
      <td class="n">${pct(F.risk)}</td><td class="n">${Math.round(mapOf(c, f))}%</td><td class="n">${others(f)}조</td>
      <td class="n"><b>${pct(p)}</b></td><td class="n"><b>${fmt(per)}G</b></td>
      <td class="n"><b>${P.parties[f]}</b>조</td>
      <td>${stepper('hire', f, raw.hire[f], `${F.name} 계약 조`)}</td><td>${stepper('pots', f, raw.pots[f], `${F.name} 조당 포션 상한`)}</td>
      <td>${stepper('torch', f, carryOf(raw, f), `${F.name} 조당 횃불`)}<small class="${dark >= 0.25 ? 'neg' : 'dim'}">돌아섬 ${pct(dark)}</small></td>
      <td class="n">${fmt(sc[f] + P.hire[f] * CO.HIRE_FEE)}G</td></tr>`;
  }).join('');
  const gearShort = GEAR_NAMES.filter(g => (need.gear[g] || 0) > (S.gear[g] || 0) + (gb[g] || 0));
  const sent = P.parties.reduce((a, b) => a + b, 0), hired = P.hire.reduce((a, b) => a + b, 0);
  const warn: string[] = [];
  const hurtN = (c.crew || []).filter(x => x.hurt).length, empty = (P.teams || []).reduce((a, T) => a + T.m.filter(x => x == null).length, 0), resting = (c.crew || []).filter(x => !x.hurt).length - (P.teams || []).reduce((a, T) => a + T.m.filter(x => x != null).length, 0);
  if (empty) warn.push(`빈자리 ${empty}`);
  if (c.crew && resting) warn.push(`대기 ${resting}명`);
  if (hurtN) warn.push(`부상 ${hurtN}명 쉼`);
  if (need.pot > potHave) warn.push(`포션 부족 ${need.pot - potHave}병`);
  if (gearShort.length) warn.push(`장비 부족: ${gearShort.map(g => `${g} ${(need.gear[g] || 0) - (S.gear[g] || 0) - (gb[g] || 0)}벌`).join(', ')}`);
  if (c.cash - cost.all < 0) warn.push('금고 마이너스');
  const memo = memoHtml(W, ui), hasMemo = !memo.includes('class="empty"');
  return `<div class="panel floors-pick"><header><h2>층 선택</h2><span class="sub">조당 = 성공 × 캐 오는 양 × 시세 · 지도 낮으면 둘 다 줄고 위기는 늘어남 · 우리 조는 아래 편성표에서</span><span class="right">우리 <b>${sent}</b>/${maxParties(c)}조${hired ? ` · 계약 ${hired}조` : ''}</span></header>
      <div class="tw"><table class="grid pick"><thead><tr><th>층</th><th class="n">시세</th><th class="n">위험</th><th class="n">지도</th><th class="n">남들</th><th class="n">성공</th><th class="n">조당</th><th class="n">우리 조</th><th>계약 조</th><th>포션 상한</th><th>횃불</th><th class="n">출정비</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="note">계약 조: 한 조 ${CO.HIRE_FEE}G · 캔 것의 ${pct(CO.HIRE_CUT)}는 그들 몫. 탐사: 최대 ${CO.DAYS}일 · 날마다 몬스터 하나. 포션: 위기 때 한 병. 횃불: 첫날 하나 · 그 뒤 날마다 확률로 하나(지도 낮을수록 자주) · 다 쓰면 돌아섬. 짐: 한 사람 ${CO.SLOT_PP}칸 · 횃불 · 포션이 먼저 차지. 남은 포션 · 횃불은 창고로.</p></div>
    ${fcPanel(W, P, cost.all)}
    ${warn.length ? `<div class="warn">${warn.join(' · ')}</div>` : ''}
    <div class="foot"><button type="button" class="ghost" data-act="phase" data-phase="0">← 내정으로</button><span class="tot">나갈 돈 <b>${fmt(cost.all)}G</b> <span class="dim">(${cost.parts.map(([n, v]) => `${n} ${fmt(v)}`).join(' · ')})</span></span><button type="button" class="seal" id="go" data-act="go">결재 도장 찍기</button></div>
    <div class="main">
      <div class="col">${jobsTrack(W, P)}${hasMemo ? `<div class="panel"><header><h2>작전 메모</h2></header><div class="memo">${memo}</div></div>` : ''}</div>
    </div>
    ${c.crew ? `<div class="panel sheetwrap"><header><h2>편성표</h2><span class="sub">배치 칸의 조를 누르면 그 조 빈자리로 · 머리글을 누르면 정렬</span></header>${tplBar(W, P)}${assignHtml(W, P, others, (ui.sort || {}).as)}
        <p class="note">조직력: 함께 나간 달만큼 성공 최대 +${Math.round(CO.CO_SUCC * 100)}%p · 위기 −${Math.round(CO.CO_CRISIS * 100)}%. 빈자리 하나당 성공 −${Math.round(CO.SHORT_PEN * 100)}%p.</p></div>` : ''}`;
}

// 이번 달 어림: 한 줄 (수입 · 지출 · 순이익 · 범위 · 적자 확률 · 사망). 그래프와 지난달 비교는 접어 둔다
function fcPanel(W: World, P: Plan, cost: number) {
  const fc = forecast(W, P), L = W.last, f0 = L && L.fc;
  if (!fc.mean) return '<div class="panel fc"><p class="note">보낼 조 없음</p></div>';
  const net = fc.mean - cost, loss = fcRank(fc, cost);
  const last = f0 ? `<p class="note">지난달 어림 ${fmt(f0.mean)}G → 실제 ${fmt(L!.res[0].sales)}G</p>` : '';
  return `<div class="panel fc"><dl class="fc-line">
      <div><dt>수입</dt><dd>${fmt(fc.mean)}</dd></div><div><dt>지출</dt><dd>${fmt(cost)}</dd></div>
      <div><dt>순이익</dt><dd class="${net < 0 ? 'neg' : 'pos'}">${sgn(net)}</dd></div>
      <div><dt>범위</dt><dd>${sgn(fc.p10 - cost)} ~ ${sgn(fc.p90 - cost)}</dd></div>
      <div><dt>적자 확률</dt><dd class="${loss > 0.3 ? 'neg' : ''}">${Math.round(loss * 100)}%</dd></div>
      <div><dt>사망 어림</dt><dd>${fc.dead.toFixed(1)}명</dd></div></dl>
    <details class="fold"><summary>수입 분포 그래프</summary>${fcChart(fc, cost, null, `수입 어림 ${fmt(fc.mean)}G, 지출 ${fmt(cost)}G`)}${last}<p class="note">가로: 이번 달 수입(G) · 막대: 그 수입이 나올 확률 · 빨간 점선: 지출. 약점 · 역효과는 모르는 채로 셈.</p></details></div>`;
}


// ---------- 결과 ----------
export function resultWeekHtml(W: World, live = false, mute = false) {
  return `<div class="resultwrap${live ? '' : ' done'}">${revealHtml(W, live, mute)}<article class="co-sheet doc${live ? ' after-run' : ''}" id="results"><span class="stampmark">결재</span>${resultsHtml(W)}</article>
    <div class="foot"><button type="button" class="btn-next" data-act="phase" data-phase="0">제${W.month}월 내정으로 →</button></div></div>`;
}

// 이번 달 진행 표시: 보여 주기만 한다 (주차를 옮기는 것은 각 화면 아래의 단추로)
export const weeksHtml = (W: World, phase: number) => [['내정', 0], ['출정', 1], ['가정산', 2], ['정산', 3]].map(([n, p], i) =>
  `<span class="wk${(p as number) < phase ? ' done' : ''}"${p === phase ? ' aria-current="step"' : ''}><i>${i + 1}</i>${n}</span>`).join('');
