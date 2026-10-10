// 행정실 책상: 한 달을 두 주차로 나눈다.
// 정보 주차 — 자료함(보고서·신문·도감·조사 결과)을 열어 읽고, 조사 의뢰를 걸고, 정보망과 내정(건물·보급·창고·세력)을 정한다.
// 탐험 주차 — 작전 메모를 옆에 두고 층마다 몇 조를 무엇을 챙겨 보낼지 정하고 도장을 찍는다. 결과는 다음 달 보고서가 된다.
// 화면은 HTML 문자열만 만든다. 상태를 쓰지 않고 난수도 쓰지 않는다
import { CO, FLOORS, INTEL, ITEMS, type Person, fcRank, forecast, townOf, type Plan, SRCS, type World, bedsOf, classCap, isRook, recruitWants, rookCount, churchPrice, dormCost, dormKeep, roomOf, wageOf, gearBuy, hireCost, intelBlock, intelCost, lootMul, maxParties, needOf, potsExpiring, potsOf, probeCost, probesLeft, sanitize, sortieCost, succRate, supOf, toolCost, trainBonus, us } from '../../core/company';
import { CLASSES, GEARS, BUYERS } from '../../core/data';
import { bookHtml, condLabel, kitHint } from './book';
import { SRC_INFO, intelHtml, rumorsHtml } from './intel';
import { coIssue, paperHtml } from './paper';
import { revealHtml } from './reveal';
import { fcChart, fcNums } from './charts';
import { PLACES, townSceneHtml } from './town';
import { KTAG, depthsHtml, fieldHtml, fmt, newsLines, pct, resultsHtml, sgn, stepper } from './view';

export type DeskUi = { phase: number; tab: string; pins: string[]; rival?: string; open?: boolean; mute?: boolean;
  pick?: { t?: number; s?: number; id?: number } | null;
  place?: string };   // 정보 주차에 열어 둔 장소 창 (인원 · 건물 · 상단 거리 · 교회 · 정보망)   // 편성판에서 집어 든 사람 (조의 자리, 또는 대기 인원)
const lvOf = (W: World, k: keyof typeof INTEL.BASE) => (W.intel ? W.intel.lv[k] : INTEL.BASE[k]);
const GEAR_NAMES = GEARS.filter(g => g !== '일반');
const wage = (W: World) => wageOf(us(W).members);

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
// 조사 의뢰: 시장 조사는 상단 거리에서, 타 용병단 조사는 뒷골목에서 맡긴다 (남은 횟수는 함께 쓴다)
function probePanel(W: World, ui: DeskUi, kind: 'mkt' | 'riv') {
  const left = probesLeft(W), rivals = W.cos.filter(c => c.style !== 'player' && c.style !== 'crowd');
  const dots = Array.from({ length: CO.PROBE_MAX }, (_, i) => `<i class="${i < left ? 'on' : ''}"></i>`).join('');
  const body = kind === 'mkt'
    ? `<div class="probe"><b>시장 조사 · <span class="num">${fmt(CO.PROBE_MKT)}G</span></b><p>어떤 소재를 누가 더 쳐주고 찾나</p>
        <div class="row"><button type="button" class="go" data-act="probe-mkt"${left ? '' : ' disabled'}>조사 맡기기</button></div></div>`
    : `<div class="probe"><b>타 용병단 조사 · <span class="num">${fmt(CO.PROBE_RIV)}G</span></b><p>이번 달 몇 층에 몇 조를 보내나</p>
        <div class="row"><select id="probe-rival" data-k="rival" aria-label="조사할 용병단">${rivals.map(c => `<option value="${c.id}"${ui.rival === c.id ? ' selected' : ''}>${c.name}</option>`).join('')}</select><button type="button" class="go" data-act="probe-riv"${left ? '' : ' disabled'}>조사 맡기기</button></div></div>`;
  return `<div class="panel"><header><h2>조사 의뢰</h2><span class="sub">답은 바로 와서 책장의 조사 봉투에 쌓여요</span><span class="right">이번 달 남은 횟수 <span class="slots" aria-label="${left}번 남음">${dots}</span></span></header>
    <div class="probes one">${body}</div></div>`;
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
function trainPanel(W: World, raw: Plan) {
  const c = us(W), bf = raw.base ? raw.base.f : Math.max(0, W.unlocked - 1), ba = raw.base ? raw.base.amt : 0;
  return `<div class="panel"><header><h2>건물 · 훈련</h2></header><div class="blds">
      ${bldCard('people', '훈련장', `+${(trainBonus(c.skill) * 100).toFixed(1)}%p`, `월 훈련비 → 성공률 +${(trainBonus(raw.train / 10 * CO.SIZE_REF / Math.max(CO.SIZE_REF / 2, c.members)) * 100).toFixed(1)}%p까지`, stepper('train', 0, raw.train, '월 훈련비', 100))}
      ${bldCard('grid', '갈무리장', `${(c.proc || 0).toFixed(1)} / ${CO.PROC_MAX}단계${c.pendingProc ? ' · 공사 중' : ''}`, `${fmt(CO.PROC_STEP)}G마다 캐 오는 양 +${Math.round(CO.PROC_BONUS * 100)}%`, stepper('proc', 0, raw.proc || 0, '갈무리장 공사비', 500))}
      ${bldCard('door', '전진 거점', c.bases.some(Boolean) ? FLOORS.slice(0, W.unlocked).map((F, f) => (c.bases[f] ? `${F.name} ${c.bases[f].toFixed(1)}` : '')).filter(Boolean).join(' · ') : '없음', `${fmt(CO.BASE_STEP)}G마다 그 층 성공률 +5%p`, `<span class="ctl2"><select data-k="basef" aria-label="거점을 둘 층">${FLOORS.slice(0, W.unlocked).map((F, f) => `<option value="${f}"${f === bf ? ' selected' : ''}>${F.name}</option>`).join('')}</select>${stepper('base', 0, ba, '거점 공사비', 500)}</span>`)}
      ${bldCard('bars', '채집 도구', `${raw.tool || 0} / 2단계`, `조당 ${CO.TOOL_COST.slice(1).join(' / ')}G · 캐 오는 양 +${CO.TOOL_BONUS.slice(1).map(v => Math.round(v * 100) + '%').join(' / ')}`, stepper('tool', 0, raw.tool || 0, '채집 도구 단계'))}
    </div></div>`;
}
// 이번 달 살 포션 (비워 두면 편성에 모자란 만큼)
const potBuy = (W: World, raw: Plan, P: Plan) => { const H = potsOf(us(W)), need = needOf(P); return raw.buy && raw.buy.pot != null ? raw.buy.pot : Math.max(0, need.pot - H.pot - H.holy - ((raw.buy && raw.buy.holy) || 0)); };
const gearOf = (W: World, raw: Plan, P: Plan, g: string) => (raw.buy && raw.buy.gear && raw.buy.gear[g] != null ? raw.buy.gear[g] : gearBuy(us(W), P)[g] || 0);
function buyPanel(W: World, raw: Plan, P: Plan, kind: 'market' | 'church') {
  const c = us(W), S = supOf(c), H = potsOf(c), X = potsExpiring(c), need = needOf(P);
  const potN = potBuy(W, raw, P), holyN = (raw.buy && raw.buy.holy) || 0, auto = !(raw.buy && raw.buy.pot != null);
  const rows = kind === 'market' ? [
    `<tr><td><b>상단 포션</b>${X.pot ? `<small class="neg">${X.pot}병 이번 달 지나면 상함</small>` : ''}</td><td class="n">${W.potion}G</td><td class="n">${H.pot}</td><td class="n">${need.pot}</td><td>${stepper('buyPot', 0, potN, '상단 포션 구매', 10)}${auto ? '<small>자동</small>' : '<button type="button" class="link" data-act="auto-pot">자동</button>'}</td><td class="n">${fmt(potN * W.potion)}G</td></tr>`,
    ...GEAR_NAMES.map((g, i) => { const b = gearOf(W, raw, P, g); return `<tr><td><b>${g} 장비</b></td><td class="n">${CO.GEAR_PRICE}G</td><td class="n">${S.gear[g] || 0}</td><td class="n">${need.gear[g] || '-'}</td><td>${stepper('buyGear', i, b, `${g} 장비 구매`)}</td><td class="n">${fmt(b * CO.GEAR_PRICE)}G</td></tr>`; }),
  ] : [
    `<tr><td><b>교회 성수</b><small>${X.holy ? `<span class="neg">${X.holy}병 이번 달 지나면 상함</span> · ` : ''}사망을 더 줄임</small></td><td class="n">${churchPrice(W, 0)}G</td><td class="n">${H.holy}</td><td class="n dim">-</td><td>${stepper('buyHoly', 0, holyN, '교회 성수 구매', 10)}</td><td class="n">${fmt(holyN * churchPrice(W, 0))}G</td></tr>`,
  ];
  return `<div class="panel"><header><h2>${kind === 'market' ? '상단 포션 · 장비' : '교회 성수'}</h2><span class="sub">포션 보관 ${CO.POT_KEEP}달 · 성수 ${CO.HOLY_KEEP}달</span></header>
    <div class="tw"><table class="grid buy"><thead><tr><th>품목</th><th class="n">단가</th><th class="n">창고</th><th class="n">편성에 필요</th><th>구매</th><th class="n">금액</th></tr></thead><tbody>${rows.join('')}</tbody></table></div></div>`;
}

// ---------- 인원: 숙소(침상이 상한)와 신입 모집. 신입은 수습으로 들어와 낀 조가 성공을 쌓으면 대원이 된다 ----------
// 이번 달 찾을 신입 (비워 두면 빈 침상만큼)
// 이번 달 지원자 어림 (가운데 값). 직업별 몫은 이것으로 어림한다
const appsGuess = (W: World) => { const e = W.intel && W.intel.est.apps; return e ? Math.round((e.lo + e.hi) / 2) : W.apps ?? CO.APP0; };
// 직업별로 찾을 신입 (우리는 명단이 있다). 비워 두면 빈 침상만큼 기본 편성 순서대로
const recruitByClass = (W: World, raw: Plan) => recruitWants(us(W), raw, roomOf(us(W)), appsGuess(W));
const recruitOf = (W: World, raw: Plan) => Object.values(recruitByClass(W, raw)).reduce((a, b) => a + b, 0);
const recruitCost = (W: World, raw: Plan) => Object.entries(recruitByClass(W, raw)).reduce((a, [k, n]) => a + n * Math.round(CO.RECRUIT * (CO.CLASS_COST[k] || 1)), 0);
// 직업별 신입 모집: 직업마다 뽑을 수, 한 명 값(드문 직업은 비싸다), 지원자 중 그 직업의 몫(어림)
function recruitBox(W: World, raw: Plan) {
  const c = us(W), by = recruitByClass(W, raw), A = appsGuess(W), n = recruitOf(W, raw);
  return `<div class="bld rbox">${icon('recruit')}<div><b>신입 모집</b><span class="lvl">${n}명 · ${fmt(recruitCost(W, raw))}G부터</span>
      <small>${roomOf(c) ? `빈 침상 ${roomOf(c)}개까지` : '<span class="neg">빈 침상이 없어요 · 숙소를 늘려야 뽑을 수 있어요</span>'} · 다음 달부터 수습으로 조에 끼고, 낀 조가 ${CO.ROOK_WINS}번 성공하면 대원 · 찾는 사람이 많으면 값이 올라요</small></div>
    <span class="ctl2">${raw.recruitC ? '<button type="button" class="link" data-act="auto-recruit">빈 침상만큼 (기본 편성 순)</button>' : '<small>빈 침상만큼 기본 편성 순으로</small>'}</span>
    <div class="rcls">${CLASSES.map((k, i) => `<label><span>${pip({ id: -1, c: k })}${k}<small>${fmt(Math.round(CO.RECRUIT * (CO.CLASS_COST[k] || 1)))}G · 약 ${classCap(A, k)}명</small></span>${stepper('recruitC', i, by[k] || 0, `${k} 신입`)}</label>`).join('')}</div></div>`;
}
function staffPanel(W: World, raw: Plan) {
  const c = us(W), beds = bedsOf(c), rook = rookCount(c), hurtN = (c.crew || []).filter(x => x.hurt).length, pend = c.pendingBeds || 0, L = W.last;
  const want = recruitOf(W, raw), build = !!raw.dorm && !pend, est = W.intel && W.intel.est.apps;
  const fames = W.cos.filter(x => x.style !== 'crowd').map(x => x.fame || 0).sort((a, b) => b - a), fr = fames.indexOf(c.fame || 0) + 1;
  // 침상 그림: 칸 하나가 침상 하나 (대원 · 수습 · 이번 달 뽑을 신입 · 빈 침상 · 공사 중)
  const cells = [...Array(c.members - rook).fill('vet'), ...Array(rook).fill('rook'), ...Array(want).fill('new'), ...Array(Math.max(0, beds - c.members - want)).fill(''), ...Array(pend || (build ? CO.DORM_ADD : 0)).fill('build')];
  const lastW = L ? L.res.reduce((a, r) => a + r.recruitWant, 0) : 0, lastG = L ? L.res.reduce((a, r) => a + r.recruited, 0) : 0;
  return `<div class="panel staff"><header><h2>인원</h2><span class="sub">명성 ${Math.round(c.fame || 0)}${L ? ` · 변경 ${fr}위` : ''}</span></header>
    <div class="st-kpi">
      <div><small>인원</small><b>${c.members}</b><i>${rook ? `수습 ${rook}명` : '모두 대원'}${hurtN ? ` · 부상 ${hurtN}명` : ''}</i></div>
      <div><small>침상</small><b>${beds}</b><i>${pend ? `공사 중 +${pend}` : `빈 침상 ${beds - c.members}`}</i></div>
      <div><small>보낼 수 있는 조</small><b>${maxParties(c)}</b><i>${hurtN ? '부상자 빼고 · ' : ''}4명이 한 조</i></div>
      <div><small>월 급여</small><b>${fmt(wage(W))}G</b><i>${want ? `신입 들면 ${fmt(wageOf(c.members + want))}G` : '1인 30G + 관리비'}</i></div>
    </div>
    <div class="beds" role="img" aria-label="침상 ${beds}개 중 대원 ${c.members - rook}, 수습 ${rook}, 이번 달 뽑을 신입 ${want}">${cells.map((k, i) => `<i class="bed ${k}${i && i % 4 === 0 ? ' gap' : ''}"></i>`).join('')}</div>
    <div class="legend"><span><i class="bed vet"></i>대원</span><span><i class="bed rook"></i>수습</span><span><i class="bed new"></i>이번 달 신입</span><span><i class="bed"></i>빈 침상</span><span><i class="bed build"></i>공사 중</span></div>
    <div class="blds">
      ${bldCard('house', '숙소', `침상 ${beds}${pend ? ` → ${beds + pend}` : ''}`, pend ? `증축 공사 중 · 다음 달 정산 때 침상 +${pend}` : `증축하면 다음 달 침상 +${CO.DORM_ADD} · 공사비 ${fmt(dormCost(c))}G · 침상마다 유지비 월 ${CO.DORM_KEEP}G`,
        pend ? '<span class="lvl dim">공사 중</span>' : `<button type="button" class="tog" data-act="dorm" aria-pressed="${build}">${build ? '증축 취소' : '증축하기'}</button>`)}
      ${c.crew ? recruitBox(W, raw) : bldCard('recruit', '신입 모집', `1인 ${CO.RECRUIT}G부터`, `빈 침상 ${roomOf(c)}개까지 · 다음 달부터 수습으로 조에 끼고, 낀 조가 ${CO.ROOK_WINS}번 성공하면 대원`,
        `<span class="ctl2">${stepper('recruit', 0, want, '뽑을 신입 수')}${raw.recruit == null ? '<small>빈 침상만큼</small>' : '<button type="button" class="link" data-act="auto-recruit">빈 침상만큼</button>'}</span>`)}
    </div>
    <p class="note">마을 지원자 이번 달 ${est ? (est.lo === est.hi ? `${est.lo}명` : `${est.lo}~${est.hi}명`) : '?'}${L ? (lastW ? ` · 지난달엔 모두 ${lastW}명을 찾아 ${lastG}명이 들어갔고 1인 ${fmt(L.res[0].recruitPrice || CO.RECRUIT)}G` : ' · 지난달엔 신입을 찾은 곳이 없었어요') : ''}. 찾는 사람이 더 많으면 값이 오르고, 명성이 높은 곳에 먼저 가요.</p>
  </div>`;
}

// 결재안 줄: 이번 달 나갈 돈을 항목마다 (정보 주차에 정한 것 + 탐험 주차에 정한 것). place는 그 줄을 정하는 곳
export type CostLine = { k: string; name: string; place: string; now: number; last: number };
export function costLines(W: World, raw: Plan): CostLine[] {
  const c = us(W), P = sanitize(W, c, raw), s = W.last ? W.last.res[0].spend : null;
  const potN = potBuy(W, raw, P), holyN = (P.buy && P.buy.holy) || 0, gear = Object.values(gearBuy(c, P)).reduce((a, b) => a + b, 0);
  const rc = recruitByClass(W, raw), rn = Object.values(rc).reduce((a, b) => a + b, 0);
  const L = (k: string, name: string, place: string, now: number, last: number) => ({ k, name, place, now: Math.round(now), last: Math.round(last) });
  return [
    L('wage', '급여', 'staff', wage(W), s ? s.wage : 0),
    L('recruit', `신입 ${rn}명`, 'staff', recruitCost(W, raw), s ? s.recruit : 0),
    L('dorm', P.dorm ? '숙소 유지비 · 증축' : '숙소 유지비', 'staff', dormKeep(bedsOf(c) + (c.pendingBeds || 0)) + (P.dorm ? dormCost(c) : 0), s ? s.dorm || 0 : 0),
    L('heal', '치료비', 'staff', 0, s ? s.heal || 0 : 0),
    L('train', '훈련', 'train', P.train, s ? s.train : 0),
    L('build', '거점 · 갈무리장', 'train', (P.base ? P.base.amt : 0) + (P.proc || 0), s ? s.base + s.proc : 0),
    L('tool', `채집 도구 ${P.tool || 0}단계`, 'train', toolCost(P), s ? s.tool : 0),
    L('potion', `포션 ${potN} · 성수 ${holyN}병`, potN || !holyN ? 'market' : 'church', potN * W.potion + holyN * churchPrice(W, 0), s ? s.potion : 0),
    L('gear', `장비 ${gear}벌`, 'market', gear * CO.GEAR_PRICE, s ? s.gear : 0),
    L('root', '근원 기금 · 후원', 'church', (P.root ? P.root.seal + P.root.mine : 0) + (P.donate || 0), s ? s.root + s.donate : 0),
    L('intel', '정보망', 'alley', intelCost(P), s ? s.intel : 0),
    L('probe', `조사 의뢰 ${(W.probes || []).filter(x => x.m === W.month).length}건`, 'alley', probeCost(W), s ? s.probe : 0),
    L('sortie', '출정 · 계약 파티', 'gate', sortieCost(P).reduce((a, b) => a + b, 0) + hireCost(P), s ? s.sortie + s.hire : 0),
  ];
}
// 이번 달 결재에 드는 돈 (위 줄을 정보 · 내정 · 출정 · 급여로 묶은 것)
export function monthCost(W: World, raw: Plan) {
  const ls = costLines(W, raw), sum = (ks: string[]) => ls.filter(l => ks.includes(l.k)).reduce((a, l) => a + l.now, 0);
  const info = sum(['intel', 'probe']), exp = sum(['sortie', 'tool']), wg = sum(['wage']);
  const all = ls.reduce((a, l) => a + l.now, 0);
  return { info, home: all - info - exp - wg, exp, wage: wg, all };
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

// 정보 주차: 책상 위 마을 지도(누르면 장소 창)와 옆에 붙은 결재안(이번 달 들어올 돈 · 나갈 돈 전부)
// 챙길 일: 장소마다 손볼 일이 있을 때만 짧은 말을 붙인다 (지도에 밀랍 봉인으로)
function sealsOf(W: World, raw: Plan): Record<string, string> {
  const c = us(W), P = sanitize(W, c, raw), X = potsExpiring(c), I = W.intel, need = needOf(P), H = potsOf(c);
  const hurt = (c.crew || []).filter(x => x.hurt).length, room = roomOf(c), rn = recruitOf(W, raw);
  const near = I ? SRCS.filter(k => I.lv[k] < 3 && INTEL.UP[k][I.lv[k]] - I.acc[k] <= 150 && INTEL.UP[k][I.lv[k]] > I.acc[k]) : [];
  const R = (W.roots || []).find(r => r.found && !r.done), news = W.mat ? W.mat.dem.filter(d => d.until >= W.month && d.at >= W.month - 1).length : 0;
  return {
    staff: room && !rn && !P.dorm ? `빈 침상 ${room}` : hurt ? `부상 ${hurt}명 쉼` : '',
    market: X.pot ? `포션 ${X.pot}병 상함` : need.pot > H.pot + H.holy + potBuy(W, raw, P) + ((raw.buy && raw.buy.holy) || 0) ? '포션 모자람' : '',
    church: X.holy ? `성수 ${X.holy}병 상함` : R ? '근원 기금' : '',
    alley: near.length ? `${SRC_INFO[near[0]].n} 곧 다음 단계` : '',
    paper: W.last ? '새' : '', book: news ? String(news) : '', probe: docCount(W, 'probe') ? String(docCount(W, 'probe')) : '',
  };
}
function placeBody(W: World, raw: Plan, ui: DeskUi, k: string) {
  const P = sanitize(W, us(W), raw);
  if (k === 'staff') return staffPanel(W, raw);
  if (k === 'train') return trainPanel(W, raw);
  if (k === 'market') return buyPanel(W, raw, P, 'market') + probePanel(W, ui, 'mkt');
  if (k === 'church') { const roots = depthsHtml(W, raw); return buyPanel(W, raw, P, 'church') + (roots ? `<div class="panel">${roots}</div>` : '<p class="note">찾은 근원이 생기면 봉인 · 채굴장 기금을 여기서 넣어요. 세력 시스템을 다시 열면 후원 · 의뢰도 여기 붙어요.</p>'); }
  if (k === 'alley') return netPanel(W, raw) + probePanel(W, ui, 'riv');
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
  const c = us(W), P = sanitize(W, c, raw), fc = forecast(W, P), L = W.last, ls = costLines(W, raw);
  const out = ls.reduce((a, l) => a + l.now, 0), outL = ls.reduce((a, l) => a + l.last, 0);
  const go = (l: { place: string; name: string }) => (l.place === 'gate' ? `<button type="button" class="lg" data-act="phase" data-phase="1">${l.name}</button>` : `<button type="button" class="lg" data-act="place" data-place="${l.place}">${l.name}</button>`);
  const row = (l: CostLine) => `<tr class="${l.now !== l.last && L ? 'changed' : ''}"><td>${go(l)}</td><td class="n now">${l.now ? '−' + fmt(l.now) : '0'}</td><td class="n last">${L ? (l.last ? '−' + fmt(l.last) : '0') : ''}</td></tr>`;
  const net = fc.mean - out, netL = L ? L.res[0].net : 0;
  return `<aside class="ledger" aria-labelledby="h-ledger">
    <h2 id="h-ledger">제${W.month}월 결재안 <small>금고 ${fmt(c.cash)}G</small></h2>
    <table><thead><tr><th>들어올 돈</th><th>이번 달</th><th>${L ? '지난달' : ''}</th></tr></thead><tbody>
      <tr><td><button type="button" class="lg" data-act="phase" data-phase="1">전리품 · 소재 (어림)</button></td><td class="n now">${fmt(fc.mean)}</td><td class="n last">${L ? fmt(L.res[0].sales) : ''}</td></tr></tbody></table>
    <table><thead><tr><th>나갈 돈</th><th>이번 달</th><th>${L ? '지난달' : ''}</th></tr></thead><tbody>
      ${ls.filter(l => l.now || l.last).map(row).join('')}
      <tr class="tot"><td>나갈 돈 합계</td><td class="n">−${fmt(out)}</td><td class="n last">${L ? '−' + fmt(outL) : ''}</td></tr>
      <tr class="tot"><td>순이익 (어림)</td><td class="n ${net < 0 ? 'neg' : 'pos'}">${sgn(net)}</td><td class="n last">${L ? sgn(netL) : ''}</td></tr>
      <tr><td>결재 뒤 금고 (어림)</td><td class="n">${fmt(c.cash + net)}</td><td></td></tr></tbody></table>
    <button type="button" class="gate" data-act="phase" data-phase="1">미궁 입구로 (탐험 주차) →</button>
  </aside>`;
}
export function infoWeekHtml(W: World, raw: Plan, ui: DeskUi) {
  return `<div class="town">${townSceneHtml(fmt(townOf(W)), sealsOf(W, raw))}${ledgerHtml(W, raw)}</div>
    ${readerHtml(W, ui)}${placeHtml(W, raw, ui)}`;
}

// ---------- 탐험 주차 ----------
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
function teamCard(W: World, P: Plan, t: number, p0: number, ui: DeskUi) {
  const c = us(W), T = P.teams![t], crew = new Map((c.crew || []).map(x => [x.id, x])), tpl = P.tpl || CO.TPL0;
  const who = T.m.map(id => (id != null ? crew.get(id) : undefined));
  const n = who.filter(Boolean).length, rooks = who.filter(x => x && isRook(x)).length, q = P.teams!.slice(0, t).filter(x => x.f === T.f).length;
  const p = Math.max(0.05, p0 - rooks * CO.ROOK_PEN - (CO.PARTY - n) * CO.SHORT_PEN);
  const slots = who.map((x, s) => {
    const on = !!(ui.pick && ui.pick.t === t && ui.pick.s === s);
    if (!x) return `<button type="button" class="slot empty" data-act="slot" data-t="${t}" data-s="${s}" aria-label="${q + 1}조 ${s + 1}번 빈자리"><small>빈자리</small><small>${tpl[s] || '아무나'}</small></button>`;
    return `<button type="button" class="slot${isRook(x) ? ' rook' : ''}" data-act="slot" data-t="${t}" data-s="${s}" aria-pressed="${on}" aria-label="${q + 1}조 ${x.c}${isRook(x) ? ` 수습 ${x.rk}/${CO.ROOK_WINS}` : ''}">${pip(x)}<small>${x.c}${tpl[s] && x.c !== tpl[s] ? ' *' : ''}</small>${isRook(x) ? `<small class="rk">수습 ${x.rk}/${CO.ROOK_WINS}</small>` : ''}</button>`;
  }).join('');
  return `<div class="team${n < CO.PARTY ? ' short' : ''}"><header><b>${q + 1}조</b><span>${n}/${CO.PARTY}명</span>
      <select data-k="teamG" data-i="${t}" aria-label="${FLOORS[T.f].name} ${q + 1}조 장비"><option value="">장비 섞인 대로</option>${GEAR_NAMES.map(g => `<option value="g:${g}"${T.g === 'g:' + g ? ' selected' : ''}>${g} 장비</option>`).join('')}</select></header>
    <div class="tslots">${slots}</div>
    <div class="tfoot"><span>${rooks ? `수습 ${rooks} · −${Math.round(rooks * CO.ROOK_PEN * 100)}%p` : '모두 대원'}${n < CO.PARTY ? ` · 빈자리 ${CO.PARTY - n} · −${Math.round((CO.PARTY - n) * CO.SHORT_PEN * 100)}%p` : ''}</span><span>예상 <b>${pct(p)}</b></span></div></div>`;
}
function benchHtml(W: World, P: Plan, ui: DeskUi) {
  const c = us(W), on = new Set((P.teams || []).flatMap(T => T.m)), rest = (c.crew || []).filter(x => !on.has(x.id) && !x.hurt), hurt = (c.crew || []).filter(x => x.hurt);
  const empty = (P.teams || []).reduce((a, T) => a + T.m.filter(x => x == null).length, 0);
  const moving = ui.pick && ui.pick.t != null;
  return `<div class="bench"><h3>대기 <span class="dim">${rest.length}명 · 빈자리 ${empty}${hurt.length ? ` · 부상 ${hurt.length}명` : ''}</span>${moving ? '<button type="button" class="link" data-act="to-bench">집은 사람을 대기로</button>' : ''}</h3>
    <div class="pool">${rest.length ? rest.map(x => `<button type="button" class="chip${isRook(x) ? ' rook' : ''}" data-act="bench" data-id="${x.id}" aria-pressed="${!!(ui.pick && ui.pick.id === x.id)}">${pip(x)}${x.c}${isRook(x) ? '<small>수습</small>' : ''}</button>`).join('') : '<span class="dim">대기 인원 없음</span>'}${hurt.map(x => `<span class="chip hurt" title="이번 달은 쉬어요">${pip(x)}${x.c}<small>부상 · 다음 달 복귀</small></span>`).join('')}</div>
    <p class="note">사람을 누르고 자리를 누르면 들어가거나 서로 바뀌어요. 빈자리는 빈 채로 나가요 (빈자리 하나당 성공률 −${Math.round(CO.SHORT_PEN * 100)}%p, 캐 오는 양도 사람 수만큼).</p>
    ${rest.length && empty ? '<button type="button" class="ghost" data-act="fill-rest">남은 사람으로 빈자리 채우기</button>' : ''}</div>`;
}

export function expWeekHtml(W: World, raw: Plan, ui: DeskUi) {
  const c = us(W), P = sanitize(W, c, raw), L = W.last, S = supOf(c), need = needOf(P), gb = gearBuy(c, P), cost = monthCost(W, raw);
  const others = (f: number) => (L ? L.plans.reduce((a, Q, i) => a + (i ? Q.parties[f] + Q.hire[f] : 0), 0) : f === 0 ? 75 : 0);
  const sc = sortieCost(P);
  const H = potsOf(c), holyB = (P.buy && P.buy.holy) || 0, potB = P.buy && P.buy.pot != null ? P.buy.pot : Math.max(0, need.pot - H.pot - H.holy - holyB);
  const potHave = H.pot + H.holy + potB + holyB;
  const floors = FLOORS.map((F, f) => {
    if (f >= W.unlocked) return f === W.unlocked ? `<div class="floor closed"><div class="fh"><b>${F.name}</b><span class="meta">${ITEMS[f].name} · 아직 닫혀 있다 · 길 뚫기 ${Math.min(99, Math.round(W.prog / CO.OPEN_WINS[W.unlocked - 1] * 100))}%</span></div></div>` : '';
    const crowd = P.parties[f] + P.hire[f] + others(f), p = succRate(c, f, P.pots[f], crowd);
    const lr = L ? L.res[0] : null, per = lr && lr.ok[f] ? (lr.got[f] / lr.ok[f]).toFixed(1) : '-';
    const teams = (P.teams || []).map((T, t) => [T, t] as const).filter(([T]) => T.f === f).map(([, t]) => teamCard(W, P, t, p, ui)).join('');
    return `<div class="floor"><div class="fh"><b>${F.name}</b><span class="meta">${ITEMS[f].name} · 위험 ${pct(F.risk)} · 지난달 남들 ${others(f)}조${per === '-' ? '' : ` · 성공 조당 ${per}개`}</span><span class="tot">꽉 찬 대원 조 <b>${P.parties[f] + P.hire[f] ? pct(p) : '-'}</b></span></div>
      <div class="fctl">
        <label>우리 조 ${stepper('parties', f, P.parties[f], `${F.name} 우리 조`)}</label>
        <label>계약 조 ${stepper('hire', f, raw.hire[f], `${F.name} 계약 조`)}</label>
        <label title="위기가 올 때만 한 병씩 쓰고 남은 것은 창고로 돌아와요">포션 상한 ${stepper('pots', f, raw.pots[f], `${F.name} 조당 포션 상한`)}</label>
        <span class="cost">출정비 <b>${fmt(sc[f] + P.hire[f] * CO.HIRE_FEE)}G</b></span>
      </div>
      ${teams ? `<div class="teams">${teams}</div>` : ''}
    </div>`;
  }).join('');
  const gearShort = GEAR_NAMES.filter(g => (need.gear[g] || 0) > (S.gear[g] || 0) + (gb[g] || 0));
  const sent = P.parties.reduce((a, b) => a + b, 0), hired = P.hire.reduce((a, b) => a + b, 0);
  const warn: string[] = [];
  if (!c.crew && raw.parties.reduce((a, b) => a + b, 0) > maxParties(c)) warn.push(`단원이 모자라 ${maxParties(c)}조까지만 보내요`);
  const empty = (P.teams || []).reduce((a, T) => a + T.m.filter(x => x == null).length, 0), resting = (c.crew || []).length - (P.teams || []).reduce((a, T) => a + T.m.filter(x => x != null).length, 0);
  if (empty) warn.push(`빈자리 ${empty}개는 빈 채로 나가요`);
  if (c.crew && resting) warn.push(`대기 ${resting}명은 이번 달 쉬어요`);
  if (need.pot > potHave) warn.push(`포션이 ${need.pot - potHave}병 모자라 조당 포션을 줄여 보내요`);
  if (gearShort.length) warn.push(`${gearShort.map(g => `${g} 장비 ${(need.gear[g] || 0) - (S.gear[g] || 0) - (gb[g] || 0)}벌`).join(', ')}이 모자라 그만큼은 장비 없이 가요`);
  if (c.cash - cost.all < 0) warn.push('이대로면 금고가 마이너스가 돼요');
  return `<div class="main">
    <div class="col">
      <div class="panel"><header><h2>작전 메모</h2></header><div class="memo">${memoHtml(W, ui)}</div></div>
      <div class="panel"><header><h2>보급</h2></header>
        <div class="stock"><span>포션 <b>${potHave}</b>병 <span class="dim">/ 들고 갈 양 ${need.pot}</span></span>${GEAR_NAMES.map(g => ((S.gear[g] || 0) + (gb[g] || 0) || need.gear[g] ? `<span>${g} 장비 <b>${(S.gear[g] || 0) + (gb[g] || 0)}</b>벌 <span class="dim">/ ${need.gear[g] || 0}</span></span>` : '')).join('')}</div>
</div>
      ${fcPanel(W, P, cost.all)}
    </div>
    <div class="col">
      <div class="panel"><header><h2>어느 층에 몇 조를</h2><span class="sub">계약 조 한 조 ${CO.HIRE_FEE}G, 캔 것의 ${pct(CO.HIRE_CUT)}는 그들 몫</span><span class="right">보낼 조 <b>${sent}</b>/${maxParties(c)}${hired ? ` + 계약 ${hired}` : ''}</span></header>
        ${rookCount(c) ? `<p class="note">수습 ${rookCount(c)}명 · 낀 조는 수습 한 명당 성공률 −${Math.round(CO.ROOK_PEN * 100)}%p, 그 조가 ${CO.ROOK_WINS}번 성공하면 대원이 돼요</p>` : ''}
        ${c.crew ? tplBar(W, P) : ''}
        <div class="floors">${floors}</div>
        ${c.crew ? benchHtml(W, P, ui) : ''}</div>
      ${warn.length ? `<div class="warn">${warn.join(' · ')}</div>` : ''}
      <div class="foot"><button type="button" class="ghost" data-act="phase" data-phase="0">← 정보 주차</button><span class="tot">이번 달 나갈 돈 <b>${fmt(cost.all)}G</b> <span class="dim">(정보 ${fmt(cost.info)} · 내정 ${fmt(cost.home)} · 출정 ${fmt(cost.exp)} · 급여 ${fmt(cost.wage)})</span></span><button type="button" class="seal" id="go" data-act="go">결재 도장 찍기</button></div>
    </div></div>`;
}

// 이번 달 어림: 결정표대로 보내면 전리품 · 소재 수입이 얼마쯤 나올지, 나갈 돈과 견준다. 지난달 어림과 실제도 함께
function fcPanel(W: World, P: Plan, cost: number) {
  const fc = forecast(W, P), L = W.last, f0 = L && L.fc;
  const last = f0 ? (() => { const a = L!.res[0].sales, r = fcRank(f0, a); return `<div class="fc-last"><b>지난달</b> 어림 ${fmt(f0.mean)}G (${fmt(f0.p10)} ~ ${fmt(f0.p90)}) → 실제 <b class="${a < f0.p10 ? 'neg' : a > f0.p90 ? 'pos' : ''}">${fmt(a)}G</b> <span class="dim">· 어림의 아래에서 ${Math.round(r * 100)}%</span></div>`; })() : '';
  return `<div class="panel fc"><header><h2>이번 달 어림</h2><span class="sub">전리품 · 소재 수입</span></header>
    ${fc.mean ? fcChart(fc, cost, null, `이번 달 수입 어림: 기대 ${fmt(fc.mean)}G, 열에 여덟은 ${fmt(fc.p10)}~${fmt(fc.p90)}G, 나갈 돈 ${fmt(cost)}G`) + fcNums(fc, cost) : '<p class="note">보낼 조가 없어요.</p>'}
    ${last}
    <p class="note">성공률은 조 카드에 보이는 값(약점 · 역효과는 모르는 채로), 시세와 붐빔은 지난달만큼으로 셈해요. 실제가 어림보다 꾸준히 높으면 편성이 약점을 맞힌 거예요.</p></div>`;
}

// ---------- 결과 ----------
export function resultWeekHtml(W: World, live = false, mute = false) {
  return `<div class="resultwrap${live ? '' : ' done'}">${revealHtml(W, live, mute)}<article class="co-sheet doc${live ? ' after-run' : ''}" id="results"><span class="stampmark">결재</span>${resultsHtml(W)}</article>
    <div class="foot"><button type="button" class="btn-next" data-act="phase" data-phase="0">제${W.month}월 정보 주차로 →</button></div></div>`;
}

// 이번 달 진행 표시: 보여 주기만 한다 (주차를 옮기는 것은 각 화면 아래의 단추로)
export const weeksHtml = (W: World, phase: number) => [['정보 주차', 0], ['탐험 주차', 1], ['결과', 2]].map(([n, p], i) =>
  `<span class="wk${(p as number) < phase ? ' done' : ''}"${p === phase ? ' aria-current="step"' : ''}><i>${i + 1}</i>${n}</span>`).join('');
