// 행정실 책상: 한 달을 두 주차로 나눈다.
// 정보 주차 — 자료함(보고서·신문·도감·조사 결과)을 열어 읽고, 조사 의뢰를 걸고, 정보망과 내정(건물·보급·창고·세력)을 정한다.
// 탐험 주차 — 작전 메모를 옆에 두고 층마다 몇 조를 무엇을 챙겨 보낼지 정하고 도장을 찍는다. 결과는 다음 달 보고서가 된다.
// 화면은 HTML 문자열만 만든다. 상태를 쓰지 않고 난수도 쓰지 않는다
import { CO, FLOORS, INTEL, ITEMS, type Plan, SRCS, type World, churchPrice, gearBuy, hireCost, intelBlock, intelCost, lootMul, maxParties, needOf, potsExpiring, potsOf, probeCost, probesLeft, sanitize, sortieCost, succRate, supOf, toolCost, trainBonus, us } from '../../core/company';
import { CLASSES, GEARS, BUYERS } from '../../core/data';
import { bookHtml, condLabel, kitHint } from './book';
import { SRC_INFO, intelHtml, rumorsHtml } from './intel';
import { coIssue, paperHtml } from './paper';
import { revealHtml } from './reveal';
import { KTAG, depthsHtml, fieldHtml, fmt, newsLines, pct, resultsHtml, sgn, stepper } from './view';

export type DeskUi = { phase: number; tab: string; pins: string[]; rival?: string; open?: boolean; mute?: boolean };
const lvOf = (W: World, k: keyof typeof INTEL.BASE) => (W.intel ? W.intel.lv[k] : INTEL.BASE[k]);
const GEAR_NAMES = GEARS.filter(g => g !== '일반');
const wage = (W: World) => { const c = us(W); return Math.round(c.members * CO.WAGE * (1 + c.members / CO.OVERHEAD)); };

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
// 자료함 칸에 붙는 한 줄
function docLine(W: World, tab: string) {
  const L = W.last;
  if (tab === 'report') return L ? `제${L.month}월 · 순이익 ${sgn(L.res[0].net)}G · ${L.rank.indexOf('us') + 1}위` : '첫 정산 전';
  if (tab === 'paper') { const I = W.last ? coIssue(W) : null; return I ? I.hed : '아직 없음'; }
  if (tab === 'book') { const n = W.mat ? W.mat.dem.filter(d => d.until >= W.month).length : 0; return n ? `찾는 소재 소식 ${n}건` : '찾는 곳 소식 없음'; }
  const n = docCount(W, 'probe'); return n ? `이번 주 조사 ${n}건 · 정보망 그래프` : '정보망 그래프 · 현장 기록';
}

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
function probePanel(W: World, ui: DeskUi) {
  const left = probesLeft(W), rivals = W.cos.filter(c => c.style !== 'player' && c.style !== 'crowd');
  const dots = Array.from({ length: CO.PROBE_MAX }, (_, i) => `<i class="${i < left ? 'on' : ''}"></i>`).join('');
  return `<div class="panel"><header><h2>조사 의뢰</h2><span class="sub">답은 바로 와요</span><span class="right">남은 횟수 <span class="slots" aria-label="${left}번 남음">${dots}</span></span></header>
    <div class="probes">
      <div class="probe"><b>시장 조사 · <span class="num">${fmt(CO.PROBE_MKT)}G</span></b><p>어떤 소재를 누가 더 쳐주고 찾나</p>
        <div class="row"><button type="button" class="go" data-act="probe-mkt"${left ? '' : ' disabled'}>조사 맡기기</button></div></div>
      <div class="probe"><b>타 용병단 조사 · <span class="num">${fmt(CO.PROBE_RIV)}G</span></b><p>이번 달 몇 층에 몇 조를 보내나</p>
        <div class="row"><select id="probe-rival" data-k="rival" aria-label="조사할 용병단">${rivals.map(c => `<option value="${c.id}"${ui.rival === c.id ? ' selected' : ''}>${c.name}</option>`).join('')}</select><button type="button" class="go" data-act="probe-riv"${left ? '' : ' disabled'}>조사 맡기기</button></div></div>
    </div>${probeCost(W) ? `<p class="note">이번 달 조사비 ${fmt(probeCost(W))}G</p>` : ''}</div>`;
}

function netPanel(W: World, raw: Plan) {
  const I = W.intel, rivals = W.cos.filter(c => c.style !== 'player' && c.style !== 'crowd');
  const rows = SRCS.map((k, i) => {
    const lv = lvOf(W, k), keep = INTEL.KEEP[k][lv], b = (raw.intel && raw.intel[k]) || 0, blk = intelBlock(W, k);
    const note = b < keep ? `<span class="neg">유지비 ${fmt(keep)}G보다 적어 다음 달 한 단계 내려가요</span>` : blk && b > keep ? `<span class="neg">${blk.who}과 사이가 ${INTEL.REL} 이상이어야 올라요 (지금 ${blk.now})</span>` : lv >= 3 ? '가장 높은 단계' : b > keep ? `${fmt(b - keep)}G씩 쌓여 ${lv + 1}단계로 (${fmt(I ? I.acc[k] : 0)}/${fmt(INTEL.UP[k][lv])})` : `유지 ${fmt(keep)}G${INTEL.BASE[k] ? ' (1단계는 공짜)' : ''} · 더 넣으면 쌓여요`;
    return `<div class="netrow"><span>${SRC_INFO[k].n}</span><span class="pips" aria-label="${lv}단계">${[1, 2, 3].map(n => `<i class="${n <= lv ? 'on' : ''}"></i>`).join('')}</span><span class="nnote">${note}</span>${stepper('intel', i, b, `${SRC_INFO[k].n} 정보비`, 50)}</div>`;
  }).join('');
  const slots = Math.max(1, lvOf(W, 'spy')), on = raw.spyOn || [];
  const sel = Array.from({ length: slots }, (_, s) => `<select data-k="spyOn" data-i="${s}" aria-label="정보원 ${s + 1}"><option value="">붙이지 않음</option>${rivals.map(c => `<option value="${c.id}"${on[s] === c.id ? ' selected' : ''}>${c.name}</option>`).join('')}</select>`).join(' ');
  return `<div class="panel"><header><h2>정보망</h2><span class="sub">단계만큼 자료가 자세해져요</span><span class="right">이번 달 <b>${fmt(intelCost(raw))}G</b></span></header>
    <div class="nets">${rows}<div class="netrow"><span>정보원 붙일 곳</span><span class="nnote" style="grid-column: 2 / -1">${sel}</span></div></div></div>`;
}

function homePanel(W: World, raw: Plan, P: Plan) {
  const c = us(W), S = supOf(c), H = potsOf(c), X = potsExpiring(c), need = needOf(P), gb = gearBuy(c, P);
  const buyPot = raw.buy && raw.buy.pot != null ? raw.buy.pot : null, autoPot = Math.max(0, need.pot - H.pot - H.holy - ((raw.buy && raw.buy.holy) || 0));
  const bf = raw.base ? raw.base.f : Math.max(0, W.unlocked - 1), ba = raw.base ? raw.base.amt : 0;
  const rel = (v: number | undefined) => { const x = Math.round(v ?? 50); return `${x} ${x >= 65 ? '(가까움)' : x <= 35 ? '(멀어짐)' : '(보통)'}`; };
  const K = W.cartel;
  const cartel = K ? (K.churchOut ? `담합 중 · 교회는 빠졌어요 (${K.left}개월 남음)${K.donated[0] ? '' : '. 후원하면 교회 성수를 예전 값으로 살 수 있어요'}` : `<b class="neg">담합 중</b> · 상단과 교회가 값을 ${Math.round((CO.CARTEL_MARKUP - 1) * 100)}% 올렸어요 (${K.left}개월 남음). 교회 후원이 모두 합쳐 ${fmt(CO.BREAK_DONATION)}G 쌓이면 교회가 빠져요 (지금 ${fmt(K.donated.reduce((a, b) => a + b, 0))}G)`) : '담합 없음';
  const gearRows = GEAR_NAMES.map((g, i) => {
    const b = raw.buy && raw.buy.gear && raw.buy.gear[g] != null ? raw.buy.gear[g] : gb[g] || 0, n = need.gear[g] || 0;
    return `<div class="hrow"><span>${g} 장비 <span class="dim">· 창고 ${S.gear[g] || 0}벌</span></span>${stepper('buyGear', i, b, `${g} 장비 살 벌 수`)}${n ? `<small>편성에 ${n}벌</small>` : ''}</div>`;
  }).join('');
  const roots = depthsHtml(W, raw);
  return `<div class="panel"><header><h2>내정</h2><span class="sub">건물을 올리고 보급을 사 둬요</span></header>
    <div class="home">
      <div class="hbox"><h3>건물</h3>
        <div class="hrow"><span>훈련장</span>${stepper('train', 0, raw.train, '훈련비', 100)}<small>성공률 +${(trainBonus(c.skill) * 100).toFixed(1)}%p → 이대로면 +${(trainBonus(raw.train / 10 * CO.SIZE_REF / Math.max(CO.SIZE_REF / 2, c.members)) * 100).toFixed(1)}%p</small></div>
        <div class="hrow"><span>갈무리장 · ${(c.proc || 0).toFixed(1)}단계${c.pendingProc ? ' · 공사 중' : ''}</span>${stepper('proc', 0, raw.proc || 0, '갈무리장 투자', 500)}<small>${fmt(CO.PROC_STEP)}G마다 캐 오는 양 +${Math.round(CO.PROC_BONUS * 100)}%</small></div>
        <div class="hrow"><span>전진 거점 <select data-k="basef" aria-label="거점을 둘 층">${FLOORS.slice(0, W.unlocked).map((F, f) => `<option value="${f}"${f === bf ? ' selected' : ''}>${F.name}</option>`).join('')}</select></span>${stepper('base', 0, ba, '거점 투자', 500)}<small>${fmt(CO.BASE_STEP)}G마다 그 층 성공률 +5%p${c.bases.some(Boolean) ? ` · 지금 ${FLOORS.slice(0, W.unlocked).map((F, f) => (c.bases[f] ? `${F.name} ${c.bases[f].toFixed(1)}` : '')).filter(Boolean).join(' · ')}` : ''}</small></div>
        <div class="hrow"><span>채집 도구</span>${stepper('tool', 0, raw.tool || 0, '채집 도구 수준')}<small>조당 ${CO.TOOL_COST.slice(1).join(' / ')}G · 캐 오는 양 +${CO.TOOL_BONUS.slice(1).map(v => Math.round(v * 100) + '%').join(' / ')}</small></div>
      </div>
      <div class="hbox"><h3>보급 · 사 두기</h3>
        <div class="hrow"><span>상단 포션 <span class="num">${W.potion}G</span> <span class="dim">· 창고 ${H.pot}병</span></span>${stepper('buyPot', 0, buyPot ?? autoPot, '상단 포션 살 병 수', 10)}<small>${buyPot == null ? '필요한 만큼 자동' : '<button type="button" class="link" data-act="auto-pot">자동으로</button>'} · 쓸 양 ${need.pot}병${X.pot ? ` · <b class="neg">${X.pot}병 이번 달 지나면 상함</b>` : ''}</small></div>
        <div class="hrow"><span>교회 성수 <span class="num">${churchPrice(W, 0)}G</span> <span class="dim">· 창고 ${H.holy}병</span></span>${stepper('buyHoly', 0, (raw.buy && raw.buy.holy) || 0, '교회 성수 살 병 수', 10)}<small>사망을 더 줄여요${X.holy ? ` · <b class="neg">${X.holy}병 이번 달 지나면 상함</b>` : ''}</small></div>
        ${gearRows}
        <p class="note">포션 보관 ${CO.POT_KEEP}달(성수 ${CO.HOLY_KEEP}달) · 장비 한 벌 ${CO.GEAR_PRICE}G</p>
      </div>
      <div class="hbox"><h3>세력</h3>
        <p class="note">상단 ${rel(c.relM)} · 교회 ${rel(c.relC)}. ${cartel}</p>
        <div class="hrow"><span>교회 후원금</span>${stepper('donate', 0, raw.donate || 0, '교회 후원금', 100)}</div>
      </div>
      <div class="hbox soon"><h3>고용 <span class="soon-tag">나중에</span></h3>
        <div class="hrow"><span>신입 모집</span><span class="step"><button type="button" disabled aria-label="신입 줄이기">−</button><input type="number" disabled value="0" aria-label="신입 모집"><button type="button" disabled aria-label="신입 늘리기">+</button></span><small>준비 중</small></div>
      </div>
      ${roots ? `<div class="hbox wide">${roots}</div>` : ''}
    </div></div>`;
}

// 이번 달 결재에 드는 돈 (정보 주차에 정한 것 + 탐험 주차에 정한 것)
export function monthCost(W: World, raw: Plan) {
  const c = us(W), P = sanitize(W, c, raw), H = potsOf(c), need = needOf(P);
  const holy = (P.buy && P.buy.holy) || 0, pot = P.buy && P.buy.pot != null ? P.buy.pot : Math.max(0, need.pot - H.pot - H.holy - holy);
  const gear = Object.values(gearBuy(c, P)).reduce((a, b) => a + b, 0);
  const info = probeCost(W) + intelCost(P);
  const home = P.train + (P.base ? P.base.amt : 0) + (P.proc || 0) + (P.donate || 0) + (P.root ? P.root.seal + P.root.mine : 0) + pot * W.potion + holy * churchPrice(W, 0) + gear * CO.GEAR_PRICE;
  const exp = sortieCost(P).reduce((a, b) => a + b, 0) + hireCost(P) + toolCost(P);
  return { info, home, exp, wage: wage(W), all: info + home + exp + wage(W) };
}

// 자료함: 네 칸. 누르면 그 자료만 크게 펼친다
function shelfHtml(W: World) {
  return `<div class="shelf">${DOC_TABS.map(([id, n]) => `<button type="button" class="folder" data-act="open-doc" data-tab="${id}"><b>${n}</b>${docCount(W, id) ? `<span class="cnt">${docCount(W, id)}</span>` : ''}<small>${docLine(W, id)}</small></button>`).join('')}</div>`;
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

export function infoWeekHtml(W: World, raw: Plan, ui: DeskUi) {
  const P = sanitize(W, us(W), raw), cost = monthCost(W, raw);
  return `<div class="panel"><header><h2>자료함</h2></header>${shelfHtml(W)}</div>
    <div class="main even">
      <div class="col">${probePanel(W, ui)}${netPanel(W, raw)}</div>
      <div class="col">${homePanel(W, raw, P)}</div>
    </div>
    <div class="foot"><span class="tot">정보 <b>${fmt(cost.info)}G</b> · 내정 <b>${fmt(cost.home)}G</b> · 급여 ${fmt(cost.wage)}G</span><button type="button" class="btn-next" data-act="phase" data-phase="1">탐험 주차로 →</button></div>
    ${readerHtml(W, ui)}`;
}

// ---------- 탐험 주차 ----------
function kitSelects(f: number, k: number, g: string) {
  const ps = g.split('+'), c = ps.find(x => x.startsWith('c:')) || '', e = ps.find(x => x.startsWith('g:')) || '';
  return `<select data-k="kitC" data-i="${f}" data-j="${k}" aria-label="${FLOORS[f].name} ${KTAG[k]}줄 직업"><option value="">직업 섞인 대로</option>${CLASSES.map(x => `<option value="c:${x}"${c === 'c:' + x ? ' selected' : ''}>${x}</option>`).join('')}</select>
    <select data-k="kitG" data-i="${f}" data-j="${k}" aria-label="${FLOORS[f].name} ${KTAG[k]}줄 장비"><option value="">장비 섞인 대로</option>${GEAR_NAMES.map(x => `<option value="g:${x}"${e === 'g:' + x ? ' selected' : ''}>${x} 장비</option>`).join('')}</select>`;
}
function kitStep(f: number, k: number, v: number) {
  const lab = `${FLOORS[f].name} ${KTAG[k]}줄 조 수`;
  return `<span class="step"><button type="button" data-k="kitN" data-i="${f}" data-j="${k}" data-d="-1" aria-label="${lab} 줄이기">−</button><input type="number" inputmode="numeric" data-k="kitN" data-i="${f}" data-j="${k}" value="${v}" min="0" aria-label="${lab}"><button type="button" data-k="kitN" data-i="${f}" data-j="${k}" data-d="1" aria-label="${lab} 늘리기">+</button></span>`;
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
    const ks = (raw.kits && raw.kits[f]) || [], used = (P.kits && P.kits[f] ? P.kits[f] : []).reduce((a, x) => a + x.n, 0), rest = P.parties[f] - used;
    const lines = ks.map((x, k) => {
      const g = P.kits && P.kits[f] && P.kits[f][k] ? P.kits[f][k].g : '';
      return `<div class="grp"><span class="ktag">${KTAG[k]}</span>${kitStep(f, k, x.n)}<span class="kitsel">${kitSelects(f, k, g)}</span><span class="cost n">${x.n && g.includes('c:') ? `+${fmt(x.n * CO.GUIDE_COST)}G` : ''}</span><button type="button" class="del" data-act="kit-del" data-f="${f}" data-j="${k}" aria-label="${F.name} ${KTAG[k]}줄 지우기">×</button>
        ${g ? `<span class="hint">${kitHint(W, f, g)}</span>` : ''}</div>`;
    }).join('');
    const restLine = `<div class="grp rest"><span class="ktag rest">–</span><span class="num restn">${Math.max(0, rest)}조</span><span class="kitsel dim">섞인 대로</span><span></span><span></span></div>`;
    return `<div class="floor"><div class="fh"><b>${F.name}</b><span class="meta">${ITEMS[f].name} · 위험 ${pct(F.risk)} · 지난달 남들 ${others(f)}조${per === '-' ? '' : ` · 성공 조당 ${per}개`}</span><span class="tot">예상 성공률 <b>${P.parties[f] + P.hire[f] ? pct(p) : '-'}</b></span></div>
      <div class="fctl">
        <label>우리 조 ${stepper('parties', f, raw.parties[f], `${F.name} 우리 조`)}</label>
        <label>계약 조 ${stepper('hire', f, raw.hire[f], `${F.name} 계약 조`)}</label>
        <label>조당 포션 ${stepper('pots', f, raw.pots[f], `${F.name} 조당 포션`)}</label>
        <span class="cost">출정비 <b>${fmt(sc[f] + P.hire[f] * CO.HIRE_FEE)}G</b></span>
      </div>
      ${lines}${restLine}
      ${ks.length < CO.KIT_MAX ? `<button type="button" class="add" data-act="kit-add" data-f="${f}">+ 편성 줄 나누기</button>` : `<span class="add off">줄은 층마다 ${CO.KIT_MAX}개까지</span>`}
    </div>`;
  }).join('');
  const gearShort = GEAR_NAMES.filter(g => (need.gear[g] || 0) > (S.gear[g] || 0) + (gb[g] || 0));
  const sent = P.parties.reduce((a, b) => a + b, 0), hired = P.hire.reduce((a, b) => a + b, 0);
  const warn: string[] = [];
  if (raw.parties.reduce((a, b) => a + b, 0) > maxParties(c)) warn.push(`단원이 모자라 ${maxParties(c)}조까지만 보내요`);
  if (need.pot > potHave) warn.push(`포션이 ${need.pot - potHave}병 모자라 조당 포션을 줄여 보내요`);
  if (gearShort.length) warn.push(`${gearShort.map(g => `${g} 장비 ${(need.gear[g] || 0) - (S.gear[g] || 0) - (gb[g] || 0)}벌`).join(', ')}이 모자라 그만큼은 장비 없이 가요`);
  if (c.cash - cost.all < 0) warn.push('이대로면 금고가 마이너스가 돼요');
  return `<div class="main">
    <div class="col">
      <div class="panel"><header><h2>작전 메모</h2></header><div class="memo">${memoHtml(W, ui)}</div></div>
      <div class="panel"><header><h2>보급</h2></header>
        <div class="stock"><span>포션 <b>${potHave}</b>병 <span class="dim">/ 쓸 양 ${need.pot}</span></span>${GEAR_NAMES.map(g => ((S.gear[g] || 0) + (gb[g] || 0) || need.gear[g] ? `<span>${g} 장비 <b>${(S.gear[g] || 0) + (gb[g] || 0)}</b>벌 <span class="dim">/ ${need.gear[g] || 0}</span></span>` : '')).join('')}</div>
</div>
    </div>
    <div class="col">
      <div class="panel"><header><h2>어느 층에 몇 조를</h2><span class="sub">계약 조 한 조 ${CO.HIRE_FEE}G, 캔 것의 ${pct(CO.HIRE_CUT)}는 그들 몫</span><span class="right">보낼 조 <b>${sent}</b>/${maxParties(c)}${hired ? ` + 계약 ${hired}` : ''}</span></header>
        <div class="floors">${floors}</div></div>
      ${warn.length ? `<div class="warn">${warn.join(' · ')}</div>` : ''}
      <div class="foot"><button type="button" class="ghost" data-act="phase" data-phase="0">← 정보 주차</button><span class="tot">이번 달 나갈 돈 <b>${fmt(cost.all)}G</b> <span class="dim">(정보 ${fmt(cost.info)} · 내정 ${fmt(cost.home)} · 출정 ${fmt(cost.exp)} · 급여 ${fmt(cost.wage)})</span></span><button type="button" class="seal" id="go" data-act="go">결재 도장 찍기</button></div>
    </div></div>`;
}

// ---------- 결과 ----------
export function resultWeekHtml(W: World, live = false, mute = false) {
  return `<div class="resultwrap${live ? '' : ' done'}">${revealHtml(W, live, mute)}<article class="co-sheet doc${live ? ' after-run' : ''}" id="results"><span class="stampmark">결재</span>${resultsHtml(W)}</article>
    <div class="foot"><button type="button" class="btn-next" data-act="phase" data-phase="0">제${W.month}월 정보 주차로 →</button></div></div>`;
}

export const weeksHtml = (W: World, phase: number) => [['정보 주차', 0], ['탐험 주차', 1], ['결과', 2]].map(([n, p], i) =>
  `<button type="button" class="wk${(p as number) < phase ? ' done' : ''}" data-act="phase" data-phase="${p}"${p === phase ? ' aria-current="step"' : ''}${p === 2 && !W.last ? ' disabled' : ''}><i>${i + 1}</i>${n}</button>`).join('');
