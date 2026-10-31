// 미궁관리국 게임판: HTML 문자열을 만든다. 상태에 아무것도 쓰지 않고 난수도 쓰지 않는다(그리기만).
// 화면 전체가 국장의 책상(desk.ts)이고 그 위에 지도(map.ts, 타일)가 누워 있다. 왼쪽 위 정보(날 · 예산 · 입지 → 집무실 · 폐광 인계) · 오른쪽 아래 다음 날 ·
// 책상 위 물건(깃펜 → 서류, 기록 더미 → 기록, 종 → 회의) · 지도에서 고른 것(살펴보기)을 여는 시트 · 테사의 한마디
import { lookHtml } from './map';
import { askLetter, dateOf, docOf, floodNews, govHtml, introNews, letterHtml, newsHtml } from './docs';
import { B, type FacId, FACS, GUILDS, type GuildId, type Report, type World, pnlAvg, pnlSum, wayDayG, devStage, wayOf, hqOf, depOf, docsOut, escrowOf, trustOf, withdrawFav, facOf, levelOf, nameOf, pactK, relOf, seenLevel, subAt, teamsIn, willOf } from '../../bureau/engine';
import { CLAUSE, CLAUSES, CLAUSE_MAX, type Clause, type Clauses, type ClauseId, FORM_NAME, type Tag, FORM_OF, type Form, toName, type To, clauseLock, fits, toLock } from '../../bureau/clauses';

export type Tab = 'look' | 'asks' | 'lib' | 'meet' | 'office';
// 기록 탭의 서가: 조항 · 미궁 손익 자료 · 낸 서류 기록 · 받은 서류
export type Shelf = 'cl' | 'pnl' | 'out' | 'in';
// sel: 지도에서 고른 것('dg:0' · 'fac:red', 비우면 관할 요약). draft: 쓰고 있는 서류(받는 쪽 · 미궁 · 기간 · 조항과 값)
export interface Draft { to: To; dg: number; days: number; cl: Clauses }
// open: 지도 위 시트가 열려 있나(탭 단추 · 지도 표식으로 연다). modal: 서류 쓰기 창이 열려 있나. docSeen: 받은 서류 창으로 읽은 보고 자리 · askSeen: 오른쪽 위 쪽지로 본 마지막 청 · ask: 펼쳐 읽는 청
export interface BuUi { tab: Tab; invite: FacId[]; give: Record<number, number>; intro: boolean; seenNews: number; open?: boolean; sel?: string; draft?: Draft; modal?: 'write' | 'set'; ask?: number; docSeen?: number; askSeen?: number; shelf?: Shelf; read?: number; tutPnl?: boolean }
export const DRAFT0: Draft = { to: 'all', dg: 0, days: 20, cl: { sub: 10 } };

export const n0 = (v: number) => Math.round(v).toLocaleString('ko-KR');
export const n1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString('ko-KR');
const sgn = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + n0(Math.abs(v));

export const relWord = (v: number) => v <= -60 ? '원수' : v <= -25 ? '험악' : v < -5 ? '서먹' : v < 25 ? '무난' : v < 60 ? '우호' : '맹우';
export const favWord = (v: number) => v < 25 ? '싸늘' : v < 40 ? '냉담' : v < 55 ? '보통' : v < 70 ? '호의' : '두터움';
export const levelWord = (v: number) => v >= B.DANGER ? '위험' : v >= B.RISK_AT ? '주의' : '안정';
export const levelCls = (v: number) => v >= B.DANGER ? 'bad' : v >= B.RISK_AT ? 'warn' : 'ok';
const stepper = (act: string, val: string, label: string) =>
  `<span class="step" role="group" aria-label="${label}"><button type="button" data-act="${act}" data-d="-1" aria-label="${label} 내리기">−</button><output>${val}</output><button type="button" data-act="${act}" data-d="1" aria-label="${label} 올리기">+</button></span>`;

// 하루 예산 흐름의 어림: 입장료(중앙 몫 뺌) − 보조금
export function dayFlow(W: World) {
  let fee = 0, sub = 0;
  W.dungeons.forEach((d, i) => { const n = teamsIn(d); fee += n * B.FEE * (1 - W.crownShare / 100); sub += n * subAt(W, i); });
  return { fee, sub, net: fee - sub };
}

// 설정 단추(왼쪽 위 정보 끝): 톱니 모양
const GEAR = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>';
// 설정 창: 새 임기는 여기에만 둔다(누르면 한 번 더 묻는다)
export function setHtml(W: World) {
  return `<div class="card modal set"><h2>설정</h2>
  <p class="note num">임기 ${Math.min(W.day + 1, B.DAYS)}일째 / ${B.DAYS}일 · 이 브라우저에 저장됨</p>
  <button type="button" class="danger" data-act="reset">새 임기 시작 <small>지금 판을 지움</small></button>
  <button type="button" class="go wide" data-act="close">닫기</button></div>`;
}

// 받은 청 · 독촉: 지도 오른쪽 위에 쪽지로 늘 떠 있다. 누르면 편지가 펼쳐지고 거기서 답한다
export function asksFloatHtml(W: World, ui: BuUi) {
  const asks = openAsks(W);
  if (!asks.length) return '';
  const shown = asks.slice(0, 3);
  return shown.map(a => `<button type="button" class="ask-note f-${a.from}${a.id > (ui.askSeen ?? 0) ? ' new pulse' : ''}" data-act="ask:${a.id}">
    <span><b>${nameOf(W, a.from)}</b><small class="tag ${a.kind === 'dun' ? 'warn' : ''}">${a.kind === 'dun' ? '독촉' : '청'}</small></span>
    <span class="num">${n0(a.want)}G · ${a.due - W.day}일 안에</span></button>`).join('')
    + (asks.length > shown.length ? `<button type="button" class="ask-note more" data-act="tab:asks">그 밖에 ${asks.length - shown.length}장</button>` : '');
}

export function topHtml(W: World, ui?: BuUi) {
  const wait = ui && tutOf(W, ui) === 'wait';
  const f = dayFlow(W), month = Math.floor(W.day / B.MONTH) + 1, toGrant = B.MONTH - (W.day % B.MONTH);
  const grant = B.GRANT + W.standing * B.GRANT_K;
  return `<div class="t-day"><b class="num">${Math.min(W.day + 1, B.DAYS)}</b><span>일 / ${B.DAYS} · ${month}달째</span></div>
  <div class="t-cell"><span>예산</span><b class="num ${W.budget < 0 ? 'neg' : ''}">${n0(W.budget)}G</b><small class="num ${f.net < 0 ? 'neg' : ''}">하루 ${sgn(f.net)}${escrowOf(W) > 0 ? ` · 공탁 ${n0(escrowOf(W))}` : ''}</small></div>
  <button type="button" class="t-cell t-office${ui?.open && ui.tab === 'office' ? ' on' : ''}" data-act="tab:office" title="집무실"><span>입지</span><b class="num">${n1(W.standing)}</b><i class="gauge"><i style="width:${W.standing}%"></i></i>${ui && !(ui.open && ui.tab === 'office') && W.reports.length - ui.seenNews + W.pts > 0 ? `<i class="badge">${W.reports.length - ui.seenNews + W.pts}</i>` : ''}</button>
  ${W.order && !W.order.done ? `<div class="t-cell t-order"><span>폐광 인계</span><b class="num">${W.order.got} / ${W.order.need}일</b><small class="num">${n1(teamsIn(W.dungeons[W.order.dg]))} / ${W.order.min}조 · 중앙 ${patWord(W.order.pat)}</small></div>`
    : `<div class="t-cell"><span>중앙 배정</span><b class="num">${n0(grant)}G</b><small>${toGrant}일 뒤</small></div>`}
  <div class="t-btns"><button type="button" class="go${wait ? ' pulse' : ''}" data-act="next" ${W.day >= B.DAYS ? 'disabled' : ''}>다음 날 <kbd>N</kbd></button><button type="button" data-act="ff" ${W.day >= B.DAYS ? 'disabled' : ''}>닷새</button></div>
  <button type="button" class="t-set" data-act="set" aria-label="설정" title="설정">${GEAR}</button>`;
}

export function dungeonHtml(W: World, i: number) {
  const d = W.dungeons[i], s = W.seen[i], lv = seenLevel(W, i), prev = s.at(-6) ?? s[0], tr = (lv - prev) / Math.min(5, s.length - 1 || 1);
  const n = teamsIn(d);
  return `<article class="dg ${levelCls(lv)}">
    <header><h3>${d.name}</h3><span class="lord">${d.land} · 거리 ${d.dist}일</span></header>
    <div class="lv"><div class="lv-bar"><i style="height:${Math.min(100, lv)}%"></i><b style="bottom:${B.DANGER}%"></b></div>
      <div class="lv-num"><b class="num">${n0(lv)}</b><span class="tag">${levelWord(lv)}</span><small class="num">${tr >= 0.05 ? '▲' : tr <= -0.05 ? '▼' : '–'} 하루 ${n1(Math.abs(tr))}</small><small>${d.dist}일 전 보고</small></div></div>
    <dl class="dg-teams">${[...GUILDS].sort((a, b) => d.teams[b] - d.teams[a]).map(g => `<dt>${B.GUILD[g].name} <small>본부에서 ${wayOf(W, g, i)}일</small></dt><dd class="num">${n1(d.teams[g])}조</dd>`).join('')}<dt>범람 · 잃은 조</dt><dd class="num">${d.floods} · ${n1(d.dead)}</dd></dl>
    ${devHtml(W, i)}
    <div class="dg-sub"><span>진입 보조금 <small>${noticeWord(W, i)}</small></span><b class="num">${subAt(W, i)}G</b><small class="num">하루 ${n0(n * subAt(W, i))}G</small><button type="button" data-act="write:${i}">서류 쓰기</button></div>
  </article>`;
}

// 외진 미궁의 발전도: 단계 · 다음 단계까지 막대 · 지금 길의 모습
const DEV_WORD = ['길 없음', '길 · 여관', '마을'];
export function devHtml(W: World, i: number) {
  const d = W.dungeons[i];
  if (d.wild <= 0) return '';
  const st = devStage(d), lo = st ? B.DEV[st - 1] : 0, hi = B.DEV[st];
  const pct = hi == null ? 100 : Math.min(100, (d.dev - lo) / (hi - lo) * 100);
  return `<div class="dg-dev"><span>발전도 <b class="num">${st}</b>단계 <small>${DEV_WORD[st]}${d.branch ? ` · ${nameOf(W, d.branch)} 지부` : ''}</small></span>
    <i class="gauge"><i style="width:${pct.toFixed(0)}%"></i></i><small>${hi == null ? '다 오름' : `다음: ${DEV_WORD[st + 1]}${st + 1 === B.DEV.length ? ' · 지부' : ''}`}</small></div>`;
}

// 미궁 손익 자료: 조 하나가 하루 남기는 값(길드 장부 어림, 보조금 빼고). 답을 주지 않고 견줄 자료만 보인다
export function pnlHtml(W: World, on = -1) {
  const sg = (v: number) => `<span class="num ${v < 0 ? 'neg' : ''}">${v > 0 ? '+' : v < 0 ? '−' : ''}${n0(Math.abs(v))}G</span>`;
  const n = W.pnl[0]?.length ?? 0;
  // 달마다 평균 (첫 칸은 징세청 이관 기록, 그 뒤 30일씩). 최근 여섯 달까지
  const months = Math.ceil(Math.max(0, n - 1) / B.MONTH), from = Math.max(0, months - 6);
  const mAvg = (i: number, m: number) => { const a = W.pnl[i].slice(1 + m * B.MONTH, 1 + (m + 1) * B.MONTH); return a.reduce((x, y) => x + y, 0) / a.length; };
  const ms = Array.from({ length: months - from }, (_, k) => from + k);
  return `<table class="pnl"><caption>미궁 손익 자료 <small>현장 수익 · 조당 하루 · 보조금 빼고</small></caption>
    <thead><tr><th></th><th>징세청 이관</th>${ms.map(m => `<th>${m + 1}월</th>`).join('')}<th>최근 7일</th><th>든 조</th></tr></thead>
    <tbody>${W.dungeons.map((d, i) => `<tr class="${i === on ? 'on' : ''}"><td>${d.name}</td><td>${sg(W.pnl[i][0])}</td>${ms.map(m => `<td>${sg(mAvg(i, m))}</td>`).join('')}<td>${n > 1 ? sg(pnlAvg(W, i, 7)) : '—'}</td><td class="num">${n1(teamsIn(d))}</td></tr>`).join('')}</tbody></table>`;
}
// 오늘 길드들이 남기는 값의 요약: 현장 수익에서 오가는 날의 값을 뺀 것의 중간값 · 평균값. 길드 하나하나의 장부는 보이지 않는다
export function pnlSumHtml(W: World) {
  const sg = (v: number) => `<span class="num ${v < 0 ? 'neg' : ''}">${v > 0 ? '+' : v < 0 ? '−' : ''}${n0(Math.abs(v))}G</span>`;
  return `<table class="pnl"><caption>오늘 길드가 남기는 값 <small>조당 하루 · 오가는 하루 ${wayDayG()}G · 보조금 빼고</small></caption>
    <thead><tr><th></th><th>현장 수익</th><th>오가는 날</th><th>중간값</th><th>평균값</th></tr></thead>
    <tbody>${W.dungeons.map((d, i) => { const p = pnlSum(W, i); return `<tr><td>${d.name}</td><td>${sg(W.pnl[i].at(-1)!)}</td><td class="num">평균 ${p.way.toFixed(1)}일</td><td>${sg(p.mid)}</td><td>${sg(p.avg)}</td></tr>`; }).join('')}</tbody></table>`;
}

const noticeWord = (W: World, i: number) => {
  const n = W.notices.find(x => x.dg === i);
  return n ? `공고문 · ${n.until - W.day}일 남음` : subAt(W, i) > 0 ? '조마다 하루' : '공고 없음';
};

// 서류 쓰기: 받는 쪽이 양식을 정한다(길드 전체 공고문 · 길드 하나 요청서 · 상단 제안서). 조항을 넣고 빼고 숫자를 고친다.
// 책상 한 장(목업 '조항 계약서'): 왼쪽 받는 곳 · 미궁, 가운데 서류 종이(제n조 · 숫자 칸 · 빼기), 오른쪽 조항 서랍(넣기).
// 열리지 않은 받는 쪽 · 조항은 보이지 않는다
const PAPER: Record<Form, { head: (no: number) => string; to: (to: To) => string; body: (dg: string) => string; term: string }> = {
  notice: { head: no => `미궁관리국 공고 제${no}호`, to: () => '미궁 출입 길드 전체', body: dg => `${dg} 출입에 관하여 아래와 같이 알린다.`, term: '기한' },
  letter: { head: () => '미궁관리국 서신', to: to => `${toName(to)} 귀하`, body: dg => `${dg} 출입에 관하여 아래와 같이 요청드립니다.`, term: '약정 기간' },
  offer: { head: () => '미궁관리국 서신', to: () => '상단 귀중', body: dg => `${dg} 입구 보급에 관하여 아래와 같이 제안합니다.`, term: '약정 기간' },
};
// 꼬리표: 관리국이 내주는 것 · 받는 것. 색은 무엇(돈 · 정보 · 권리 · 안전)인지로
const TAG_CLS: Record<Tag, string> = { '돈': 'money', '정보': 'info', '권리': 'right', '안전': 'safe' };
const tagsHtml = (c: Clause) => c.give.map(t => `<span class="ctag t-${TAG_CLS[t]}">${t} 내줌</span>`).join('') + c.take.map(t => `<span class="ctag t-${TAG_CLS[t]} take">${t} 받음</span>`).join('')
  + (c.needs ? `<span class="ctag chain">⛓ ${CLAUSE[c.needs].name}에 걸림</span>` : '');
const NUM_KO = ['제1조', '제2조', '제3조', '제4조', '제5조', '제6조'];

export function writeHtml(W: World, ui: BuUi) {
  const tos = (['all', ...GUILDS, 'trade'] as To[]).filter(t => !toLock(W, t));
  const f0 = ui.draft ?? DRAFT0, f = tos.includes(f0.to) ? f0 : { ...f0, to: 'all' as To };
  const form = FORM_OF(f.to), P = PAPER[form], d = W.dungeons[f.dg];
  const n = f.to !== 'all' && f.to !== 'trade' ? d.teams[f.to] : teamsIn(d);
  const ids = Object.keys(f.cl) as ClauseId[], old = form === 'notice' && W.notices.find(x => x.dg === f.dg);
  // 왼쪽: 받는 곳 · 미궁. 누르면 바뀐다(양식이 바뀌면 그 양식에 없는 조항은 빠진다)
  const whoNote = (t: To) => t === 'all' ? `공고문 · 지금 ${n1(teamsIn(d))}조` : t === 'trade' ? '제안서' : `요청서 · 호감 ${favWord(facOf(W, t).fav)} · ${n1(d.teams[t])}조`;
  const who = tos.map(t => `<button type="button" class="w-who${t !== 'all' && t !== 'trade' ? ` f-${t}` : ''}" data-act="wto:${t}" aria-pressed="${t === f.to}"><b>${toName(t)}</b><small class="num">${whoNote(t)}</small></button>`).join('');
  const dgs = W.dungeons.map((x, i) => `<button type="button" class="opt" data-act="wdg:${i}" aria-pressed="${i === f.dg}">${x.name}</button>`).join('');
  // 가운데 종이: 조항마다 한 줄. 숫자 칸은 − +, 오른쪽 ✕로 뺀다
  const row = (id: ClauseId, k: number) => {
    const c = CLAUSE[id], v = f.cl[id]!;
    return `<li><b class="c-no">${NUM_KO[k]}</b><div class="c-body"><p>${c.line(v)}</p><div class="c-tags">${tagsHtml(c)}</div></div>
      ${c.field ? stepper(`wv:${id}`, `${v}${c.field.unit}`, c.name) : ''}<button type="button" class="c-x" data-act="wdel:${id}" aria-label="${c.name} 빼기" title="${c.name} 빼기">✕</button></li>`;
  };
  // 오른쪽 서랍: 이 양식에 넣을 수 있는 열린 조항. 넣은 것 · 바탕이 없는 것 · 다 찬 것은 까닭만
  const full5 = ids.length >= CLAUSE_MAX;
  const drawer = CLAUSES.filter(c => c.forms.includes(form) && !clauseLock(W, c.id)).map(c => {
    const inDoc = f.cl[c.id] != null, noBase = !!c.needs && f.cl[c.needs] == null;
    const state = inDoc ? '넣음' : noBase ? `${CLAUSE[c.needs!].name} 먼저` : full5 ? '다섯 조 가득' : '';
    return `<article class="drw${inDoc ? ' in' : ''}"><header><b>${c.name}</b>${state ? `<small>${state}</small>` : `<button type="button" class="go" data-act="wadd:${c.id}">넣기</button>`}</header>
      <p title="${c.fx}">${c.fx}</p><div class="c-tags">${tagsHtml(c)}</div></article>`;
  }).join('');
  const sub = f.cl.sub ?? 0, comfort = f.cl.comfort;
  const cost = [sub ? `보조금 하루 ${n0(n * sub)}G · 기한 ${n0(n * sub * f.days)}G 어림` : '', comfort ? `잃은 조마다 ${comfort}G` : ''].filter(Boolean).join(' · ');
  const full = !old && docsOut(W) >= W.clerks;
  // 공고문: 공탁(기한 동안 쓸 돈을 떼어 둠)과 길드마다의 믿음(기한으로)
  const dep = form === 'notice' ? depOf(f.cl, f.days) : 0, poor = dep > W.budget + (old ? old.dep : 0);
  const trust = form === 'notice' && sub ? `<p class="w-cost num">믿음 · ${GUILDS.map(g => `${B.GUILD[g].name} ${n0(trustOf(g, f.days) * 100)}%`).join(' · ')}</p>` : '';
  const canPost = !full && !poor && ids.length > 0 && ids.every(id => fits(W, form, f.cl, id));
  return `<div class="desk-w">
    <section class="w-side">
      <h4>받는 곳 <small class="num">서기 ${W.clerks}명 · 낸 서류 ${docsOut(W)} / ${W.clerks}</small></h4>
      <div class="w-whos">${who}</div>
      <h4>미궁</h4><div class="opts">${dgs}</div>
      ${form === 'letter' ? `<p class="w-cost">${B.LETTER_DAYS}일 뒤 답이 온다. 서명하면 ${toName(f.to)}에만 걸린다.</p>` : ''}
    </section>
    <section class="w-paper f-${form}">
      <button type="button" class="x close" data-act="close" aria-label="닫기">✕</button>
      <header class="wp-kind">${FORM_NAME[form].split('').join(' ')}</header>
      <p class="wp-meta"><span>갑: 미궁관리국</span><span>을: ${P.to(f.to)}</span></p>
      <p class="wp-lead">${P.body(d.name)}</p>
      ${ids.length ? `<ol class="wp-cl">${ids.map(row).join('')}</ol>` : '<p class="empty">조항을 서랍에서 넣는다.</p>'}
      <div class="p-term"><span>${P.term}</span>${stepper('wdays', `${f.days}일`, P.term)}<small class="num">${W.day + f.days}일까지</small></div>
      <footer class="gd-sign"><b>미궁관리국장</b><i class="seal sq" aria-label="직인">管理局印</i></footer>
      <p class="gd-no"><span>${P.head(W.docN + 1)}</span><span>시행 ${dateOf(W.day)} · ${ids.length} / ${CLAUSE_MAX}조</span></p>
    </section>
    <section class="w-foot">
      ${cost ? `<p class="w-cost num">지금 ${n1(n)}조 기준 · ${cost}</p>` : ''}
      ${dep ? `<p class="w-cost num ${poor ? 'neg' : ''}">공탁 ${n0(dep)}G${old && old.dep ? ` · 옛 공탁 ${n0(old.dep)}G 돌려받음` : ''}${poor ? ' · 예산 모자람' : ''}</p>` : ''}
      ${trust}
    </section>
    <button type="button" class="go wide w-post" data-act="post" ${canPost ? '' : 'disabled'}>${full ? '서기가 모자람 · 집무실' : poor ? '공탁할 예산이 모자람' : form === 'notice' ? (old ? '공고문 고쳐 내걸기' : '공고문 내걸기') : '요청서 보내기'}</button>
    <section class="w-drawer"><h4>조항 서랍</h4>${drawer}</section>
  </div>`;
}

const clLine = (cl: Clauses) => (Object.keys(cl) as ClauseId[]).map(k => CLAUSE[k].name + (CLAUSE[k].field ? ` <b class="num">${cl[k]}${CLAUSE[k].field!.unit}</b>` : '')).join(' · ');
function postedHtml(W: World) {
  if (!docsOut(W)) return '';
  return `<h4>낸 서류</h4>${W.notices.map(x => `<p class="past notice"><span>공고문 · ${W.dungeons[x.dg].name} · ${clLine(x.cl)}</span><small class="num">${x.until - W.day}일 남음${x.dep > 0 ? ` · 공탁 ${n0(x.dep)}G` : ''}</small><button type="button" data-act="withdraw:${x.id}" title="길드마다 호감 −${n1(withdrawFav(W, x))}">철회</button></p>`).join('')}
  ${W.letters.map(l => `<p class="past notice"><span>요청서 · ${nameOf(W, l.to)} · ${W.dungeons[l.dg].name} · ${clLine(l.cl)}</span><small class="num">${l.until == null ? `답 ${l.at - W.day}일 뒤` : `서명 · ${l.until - W.day}일 남음`}</small><button type="button" data-act="recall:${l.id}">거두기</button></p>`).join('')}`;
}

// 조항 탭: 국장이 서류에 쓸 수 있는 조항의 설명서 (잠긴 조항은 열리기 전까지 보이지 않는다)
function clausesHtml(W: World) {
  const card = (c: Clause) => `<article class="clause">
      <header><b>${c.name}</b>${tagsHtml(c)}</header>
      <p class="c-forms">${c.forms.map(x => FORM_NAME[x]).join(' · ')}${c.field ? ` · 숫자 칸 ${c.field.min} ~ ${c.field.max}${c.field.unit}` : ''}</p>
      <p>${c.fx}</p>
    </article>`;
  return `<p class="note">서류에 넣는 조항. 받는 쪽이 양식을 정한다: 길드 전체는 공고문, 길드 하나는 요청서, 상단은 제안서. 한 서류에 ${CLAUSE_MAX}조까지, 걸린 조항(⛓)은 바탕 조항이 있어야 넣고 바탕을 빼면 함께 빠진다.</p>
  ${CLAUSES.filter(c => !clauseLock(W, c.id)).map(card).join('')}`;
}

// 첫 사건의 업무 안내: 비서 테사가 한 줄로 다음 할 일을 가리킨다. 날짜가 아니라 상태로 넘어가고, 고르는 단추는 없다.
// 요구서를 받음 → 기록실의 징세청 장부 보기 → 서류 쓰기 → 날 넘기며 지켜보기 → 조가 들기 시작함. 요구서가 끝나면 사라진다
export type Tut = 'lib' | 'write' | 'wait' | 'see' | 'road' | 'town' | '';
export function tutOf(W: World, ui: BuUi): Tut {
  if (!W.order || ui.intro) return '';
  // 요구서가 끝난 뒤: 폐광에 마을이 설 때까지 다음 목표(보조금 없이도 발길이 이어지는 폐광)를 가리킨다
  if (W.order.done) { const st = devStage(W.dungeons[W.order.dg]); return st >= B.DEV.length ? '' : st ? 'town' : 'road'; }
  const k = W.reports.findIndex(r => r.from === '중앙 행정원');
  if (k < 0 || (ui.docSeen ?? 0) <= k) return '';
  if (!ui.tutPnl) return 'lib';
  if (!W.docN) return 'write';
  return teamsIn(W.dungeons[W.order.dg]) < 1 ? 'wait' : 'see';
}
// 테사(집무실의 첫 서기, 부상으로 일찍 은퇴한 중소 길드 조장 출신): 해요체로 짧게, 현장 감각만. 숫자나 정답은 말하지 않는다
const TUT: Record<Exclude<Tut, ''>, string> = {
  lib: '징세청 장부 사본이 <b>기록</b> 더미(책상 오른쪽)에 와 있어요. 폐광 벌이는 나쁘지 않아요. 길이 없어서 어느 본부에서든 오가는 데만 며칠이에요. <b>손익 자료</b> 보세요.',
  write: '길드는 명령으론 안 움직여요. 남는 데로 가요. 폐광 공고문은 책상 왼쪽 <b>깃펜</b>으로 써요.',
  wait: '공고문은 본부가 가까운 길드부터 닿아요. 먼 데는 사흘 걸려요. <b>다음 날</b> 넘기며 지도 보세요.',
  see: `폐광 쪽으로 발길이 생겼어요. ${B.ORDER.need}일 이어져야 군이 넘겨줘요. 왼쪽 위 <b>폐광 인계</b> 칸이에요.`,
  road: '사람이 다니면 길이 나요. 길이 닦이면 길드가 알아서 와요. 폐광 <b>발전도</b>는 지도에서 폐광을 눌러 보세요.',
  town: '길이 났어요. 마을이 서면 보조금 없이도 와요. 가장 많이 다닌 길드가 지부를 낼 거예요.',
};
export const tutHtml = (W: World, ui: BuUi) => { const t = tutOf(W, ui); return t ? `<aside class="tut"><b>테사</b><p>${TUT[t]}</p></aside>` : ''; };

// 기록 탭: 도서관. 가진 조항 · 미궁 손익 자료 · 낸 서류의 기록 · 받은 서류 철. 서류를 쓸 때 참고할 것은 여기서 찾는다
const OUT_RE = /^(공고문:|요청서:|공고 철회|공고 기한 끝|요청서 거둠|요청서 기한 끝)/;
function libHtml(W: World, ui: BuUi) {
  const sh = ui.shelf ?? 'cl';
  const b = (id: Shelf, name: string) => `<button type="button" class="opt ${sh === id ? 'on' : ''}${id === 'pnl' && tutOf(W, ui) === 'lib' && sh !== 'pnl' ? ' pulse' : ''}" data-act="shelf:${id}" aria-pressed="${sh === id}">${name}</button>`;
  const nav = `<div class="opts shelf">${b('cl', '조항')}${b('pnl', '손익 자료')}${b('out', '낸 서류')}${b('in', '받은 서류')}</div>`;
  if (sh === 'pnl') return nav + `<p class="note">미궁마다 조 하나가 현장에서 하루 버는 값의 어림(오가는 날 빼기 전). 첫 칸은 징세청(중앙의 지방 관청)이 입장세를 걷으며 길드 장부에서 옮겨 적은 사본(관리국이 생기며 넘겨받음)이고, 그 뒤는 관리국 검문소가 드나든 조의 짐과 다친 사람을 보고 적는다.</p><div class="pnl-wrap">${pnlHtml(W)}</div><p class="note">남는 값 = 현장 수익 − 오가는 날 × 하루 값 − 위험을 꺼리는 몫. 길드마다 본부가 달라 갈리고, 중간값이 0보다 낮으면 절반 넘는 길드에게 밑지는 곳이다.</p><div class="pnl-wrap">${pnlSumHtml(W)}</div>`;
  if (sh === 'out') {
    const rs = W.reports.filter(x => x.from === '관리국' && OUT_RE.test(x.title)).reverse();
    return nav + (rs.length ? `<ul class="news">${rs.map(x => `<li><small>${dateOf(x.day)}</small><b>${x.title}</b>${x.chips.map(c => `<span class="chip">${c}</span>`).join('')}</li>`).join('')}</ul>` : '<p class="empty">낸 서류 없음</p>');
  }
  if (sh === 'in') {
    const ks = W.reports.map((x, k) => isDoc(x) ? k : -1).filter(k => k >= 0 && k < (ui.docSeen ?? 0)).reverse();
    return nav + (ks.length ? `<ul class="news">${ks.map(k => { const x = W.reports[k]; return `<li><small>${dateOf(x.day)} · ${x.from}</small><b>${x.title}</b><button type="button" class="link" data-act="read:${k}">다시 보기</button></li>`; }).join('')}</ul>` : '<p class="empty">받은 서류 없음</p>');
  }
  return nav + clausesHtml(W);
}

// 집무실: 입지 단계 · 서기 · 다음 단계에 열리는 것, 그리고 책상에 온 보고
function officeHtml(W: World, ui: BuUi) {
  const lv = W.rank, next = B.STAND_LV[lv], prev = B.STAND_LV[lv - 1];
  const prog = next == null ? 100 : Math.max(0, Math.min(100, (W.standing - prev) / (next - prev) * 100));
  const opens = (k: number) => k === B.LETTER_LV ? '길드 지정 서신(요청서)' : '';
  const rs = W.reports.slice().reverse().slice(0, 40);
  return `<section class="office">
    ${W.order ? `<div class="o-order ${W.order.done}"><span>중앙 요구서</span><b>폐광 인계: 하루 ${W.order.min}조 이상 ${W.order.need}일 이어서</b><small class="num">${orderLine(W)}</small></div>` : ''}
    <div class="o-rank"><span>입지 단계</span><b class="num">${lv}</b><i class="gauge"><i style="width:${prog}%"></i></i>
      <small class="num">${next == null ? '끝 단계' : `입지 ${n1(W.standing)} / ${next} → ${lv + 1}단계${opens(lv + 1) ? ` · ${opens(lv + 1)} 열림` : ''} · 서기 한 명`}</small></div>
    <div class="o-clerk"><span>서기</span><b class="num">${W.clerks}명</b><small>한꺼번에 낼 서류 ${W.clerks}장 · 지금 ${docsOut(W)}장</small>
      <button type="button" class="go" data-act="clerk" ${W.pts > 0 ? '' : 'disabled'}>서기 들이기${W.pts > 0 ? ` (${W.pts})` : ''}</button></div>
    ${levelOf(W.standing) < lv ? `<p class="note">입지가 단계 기준 아래로 내려갔다. 단계와 서기는 그대로다.</p>` : ''}
  </section>
  <h4>보고</h4>
  <ul class="news">${rs.map((r, k) => `<li class="${W.reports.length - k > ui.seenNews ? 'new' : ''}"><small>${r.day}일 · ${r.from}</small><b>${r.title}</b>${r.chips.map(c => `<span class="chip">${c}</span>`).join('')}</li>`).join('')}</ul>`;
}

// 길드 일곱의 몸집: 조 막대 · 금고 · 영향력. 큰 길드 둘을 위에, 작은 길드 다섯을 아래에
export function guildsHtml(W: World) {
  const top = Math.max(1, ...GUILDS.map(g => W.guilds[g].size));
  const row = (g: GuildId) => { const o = W.guilds[g]; return `<div class="gs-row f-${g}"><b title="${B.GUILD[g].trait}">${o.name}</b><i class="gs-bar"><i style="width:${Math.max(2, o.size / top * 100)}%"></i><b class="num">${n0(o.size)}조</b></i><span class="num ${o.money < 0 ? 'neg' : ''}">${n0(o.money)}G</span><span class="num">${n0(o.infl)}</span></div>`; };
  return `<section class="gscale"><h2>길드 몸집</h2>
    <div class="gs-row gs-head"><span></span><i>조</i><span>금고</span><span>영향</span></div>
    ${GUILDS.filter(g => B.GUILD[g].big).map(row).join('')}<div class="gs-gap"></div>${GUILDS.filter(g => !B.GUILD[g].big).map(row).join('')}</section>`;
}

export function facHtml(W: World, f: FacId) {
  const o = facOf(W, f), owe = W.owe[f], g = W.guilds[f], t = B.GUILD[f];
  return `<article class="fac f-${f}">
    <h3>${o.name}${t ? ` <small class="tag">${t.big ? '큰 길드' : '작은 길드'}</small>` : ''}</h3>
    ${t ? `<p class="trait">${t.trait}</p>` : ''}
    <dl>
      ${g && t ? `<dt>조</dt><dd class="num">${n0(g.size)}</dd><dt>금고</dt><dd class="num ${g.money < 0 ? 'neg' : ''}">${n0(g.money)}G</dd><dt>본부에서</dt><dd class="num">${W.dungeons.map((d, i) => `${d.name.split(" ")[0]} ${wayOf(W, f as GuildId, i)}일`).join(' · ')}</dd><dt>공고가 닿는 날</dt><dd class="num">${hqOf(f as GuildId)}일 뒤</dd>` : ''}
      <dt>영향력</dt><dd class="num">${n0(o.infl)}${o.infl > B.NOTICE ? ' <span class="tag warn">눈에 띔</span>' : ''}</dd>
      <dt>호감</dt><dd><span class="tag">${favWord(o.fav)}</span> <span class="num">${n0(o.fav)}</span></dd>
      <dt>신세</dt><dd class="num ${owe < -0.5 ? 'neg' : ''}">${Math.abs(owe) < 0.5 ? '없음' : owe > 0 ? `받을 것 ${n1(owe)}` : `진 빚 ${n1(-owe)}`}</dd>
    </dl>
  </article>`;
}

export function relRow(W: World, a: FacId, b: FacId) {
  const v = relOf(W, a, b);
  return `<div class="rel"><span>${nameOf(W, a)} ↔ ${nameOf(W, b)}</span><i class="rel-bar"><i style="left:${v < 0 ? 50 + v / 2 : 50}%;width:${Math.abs(v) / 2}%" class="${v < 0 ? 'neg' : 'pos'}"></i></i><b>${relWord(v)}</b><small class="num">${sgn(v)}</small></div>`;
}

export function pactLine(W: World) {
  if (!W.pact || W.day >= W.pact.until) return `<p class="pact none">협정 없음</p>`;
  const who = W.pact.who.map(g => W.guilds[g].name).join(' · ');
  if (pactK(W) > 0) return `<p class="pact on">출입 협정 이행 중 · ${who} · ${W.pact.until - W.day}일 남음</p>`;
  return `<p class="pact wait">협정 서명 · 이행 대기 · ${who}</p>`;
}
// 눈여겨볼 세력 사이: 가장 나쁜 짝부터, 좋은 짝 하나
export function relsTop(W: World, n = 4) {
  const ps = FACS.flatMap((a, i) => FACS.slice(i + 1).map(b => [a, b] as [FacId, FacId]));
  const bad = ps.slice().sort((x, y) => relOf(W, ...x) - relOf(W, ...y)).slice(0, n);
  const good = ps.reduce((m, p) => relOf(W, ...p) > relOf(W, ...m) ? p : m, ps[0]);
  return [...bad, ...(relOf(W, ...good) >= 25 ? [good] : [])].map(([a, b]) => relRow(W, a, b)).join('');
}

const openAsks = (W: World) => W.asks.filter(a => a.got == null);
// 책상 위 물건: 지도 왼쪽 깃펜과 빈 서식(서류: 받은 청은 봉인 편지로 얹힌다), 오른쪽 기록 더미, 왼쪽 아래 종과 소집장(회의).
// 평면 위 자리(지도 단위)에 놓고, 서 있는 것(.st)은 책상 장면이 세운다. 누르면 그 탭의 시트를 연다
export function deskHtml(W: World, ui: BuUi) {
  const asks = openAsks(W).length, shown = (id: Tab) => !!ui.open && ui.tab === id;
  const tut = tutOf(W, ui), pulse = (id: Tab) => (tut === 'lib' && id === 'lib' && !shown('lib')) || (tut === 'write' && id === 'asks' && !shown('asks'));
  const pg = (n: number, col: string, top: string, jit = 2) => Array.from({ length: n }, (_, i) => `<i class="pg" style="background:${col};transform:translateZ(${(i * 1.8).toFixed(1)}px) rotate(${(Math.sin(i * 7.3 + n) * jit).toFixed(1)}deg)">${i === n - 1 ? top : ''}</i>`).join('');
  const stand = (x: number, y: number, w: number, h: number, svg: string) => `<span class="mini" style="left:${x}px;top:${y}px"><span class="st" style="left:${-w / 2}px;top:${-h}px;width:${w}px;height:${h}px"><svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${svg}</svg></span></span>`;
  const obj = (id: Tab, x: number, y: number, w: number, h: number, inner: string, name: string, plateY = h + 14) =>
    `<button type="button" class="obj${pulse(id) ? ' pulse' : ''}" data-act="tab:${id}" aria-pressed="${shown(id)}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"><i class="osh"></i><span class="lift">${inner}</span><span class="plate" style="top:${plateY}px">${name}</span></button>`;
  const writ = `낸 서류 ${docsOut(W)} / ${W.clerks}`;
  return obj('asks', -320, 60, 250, 330, pg(5, '#f3ecda', '<b class="hd">미궁관리국 공고</b><i class="lines"></i>')
      + openAsks(W).slice(0, 3).map((a, i) => `<i class="pg letter" style="top:${190 + i * 22}px;bottom:${-20 - i * 22}px;transform:translateZ(${12 + i * 3}px) rotate(${-8 + i * 9}deg)"><b class="hd">${nameOf(W, a.from)}${a.kind === 'dun' ? ' 독촉' : '의 청'}</b><i class="seal"></i></i>`).join('')
      + stand(210, 40, 90, 190, '<ellipse cx="45" cy="182" rx="30" ry="9" fill="#0e1013"/><path d="M15,182 V150 Q15,128 45,128 Q75,128 75,150 V182 Z" fill="#2a2f38" stroke="#0e1013" stroke-width="2"/><ellipse cx="45" cy="132" rx="16" ry="5" fill="#0e1013"/><path d="M38,8 Q72,-10 80,6 Q60,30 52,70 L47,134 L44,134 L48,70 Q40,40 38,8 Z" fill="#efe9dc" stroke="#6b5b45" stroke-width="1.5"/><path d="M78,6 Q60,40 46,134" stroke="#6b5b45" stroke-width="1.2" fill="none"/>'),
      `서류 <small>${asks ? `받은 청 ${asks}` : writ}</small>`, 420)
    + obj('lib', 1340, 120, 260, 320, pg(9, '#ece3cc', '<b class="hd">관할 일지</b><i class="lines"></i>', 3)
      + '<i class="tie"></i>' + ['#5b2b26', '#2f4a3a'].map((c, i) => `<i class="pg book" style="background:${c};left:${60 + i * 10}px;right:${-40 - i * 6}px;top:${210 + i * 24}px;bottom:${-50 - i * 24}px;transform:translateZ(${22 + i * 10}px) rotate(${6 - i * 10}deg)"></i>`).join(''),
      '기록', 400)
    + obj('meet', -215, 640, 210, 150, pg(2, '#e9dfc4', '<b class="hd">회의 소집장</b><i class="lines"></i>', 4)
      + stand(200, 140, 70, 84, '<rect x="32" y="0" width="6" height="16" fill="#3a2a1a"/><path d="M10,74 Q10,22 35,18 Q60,22 60,74 Z" fill="#c9a24a" stroke="#5c430f" stroke-width="2"/><rect x="3" y="74" width="64" height="9" rx="3" fill="#a8812c" stroke="#5c430f" stroke-width="2"/>'),
      '회의');
}

// 시트의 내용. 테사의 한마디(tutHtml)는 시트 밖, 지도 위에 따로 뜬다
export function paneHtml(W: World, ui: BuUi) {
  return paneBody(W, ui);
}
function paneBody(W: World, ui: BuUi) {
  if (ui.tab === 'look') return lookHtml(W, ui);
  if (ui.tab === 'asks') {
    const asks = openAsks(W), done = W.asks.filter(a => a.got != null).slice(-4).reverse();
    return `<button type="button" class="go wide${tutOf(W, ui) === 'write' ? ' pulse' : ''}" data-act="write:${(ui.draft ?? DRAFT0).dg}">서류 쓰기 <small class="num">낸 서류 ${docsOut(W)} / ${W.clerks}</small></button>` + postedHtml(W) + `<h4>받은 청 · 독촉</h4>` + (asks.length ? asks.map(a => {
      const v = ui.give[a.id] ?? a.want;
      return `<article class="ask ${a.kind}">
        <header><b>${nameOf(W, a.from)}</b><span class="tag ${a.kind === 'dun' ? 'warn' : ''}">${a.kind === 'dun' ? '독촉' : '청'}</span><small>${a.due - W.day}일 안에</small></header>
        <p class="num">청한 값 ${n0(a.want)}G</p>${a.chips.map(c => `<span class="chip">${c}</span>`).join('')}
        <div class="ask-do">${stepper(`give:${a.id}`, `${n0(v)}G`, '줄 값')}<button type="button" class="go" data-act="answer:${a.id}">보내기</button><button type="button" data-act="refuse:${a.id}">거절</button></div>
      </article>`;
    }).join('') : '<p class="empty">받은 청 없음</p>')
      + (done.length ? `<h4>지난 답</h4>${done.map(a => `<p class="past"><span>${a.day}일 · ${nameOf(W, a.from)} ${a.kind === 'dun' ? '독촉' : '청'}</span><b class="num">${n0(a.got!)} / ${n0(a.want)}G</b></p>`).join('')}` : '');
  }
  if (ui.tab === 'lib') return libHtml(W, ui);
  if (ui.tab === 'meet') {
    const cool = B.MEET_COOL - (W.day - W.meetAt);
    const signWord = (f: FacId) => { const w = willOf(W, f); return w >= B.SIGN_AT ? '서명할 듯' : w >= B.SIGN_AT - 20 ? '마지못해' : '거절할 듯'; };
    const gs = ui.invite;
    return `<p class="note">길드를 둘 이상 불러야 협정이 서고, 협정은 부른 길드 사이에만 걸린다. 부르는 것은 부탁이라 부른 길드마다 신세 ${B.MEET_OWE}을 쓴다. 한 곳이라도 거절하면 결렬. 빠진 길드 중 체면을 보는 쪽은 서운해한다.</p>
    <div class="invite">${FACS.map(f => `<label><input type="checkbox" data-act="inv:${f}" ${ui.invite.includes(f) ? 'checked' : ''}> ${nameOf(W, f)} <span class="tag">${signWord(f)}</span></label>`).join('')}</div>
    <button type="button" class="go wide" data-act="meet" ${cool > 0 || gs.length < 2 ? 'disabled' : ''}>회의 열기${cool > 0 ? ` · ${cool}일 뒤` : ''}</button>
    ${pactLine(W)}`;
  }
  return officeHtml(W, ui);
}

// 처음 부임할 때: 신문 한 면. 업무를 시작하면 첫 서류(중앙 행정원의 요구서)가 책상에 온다
export function introHtml() {
  return `<div class="card intro news-page">${newsHtml(introNews())}
  <button type="button" class="go wide" data-act="start">업무 시작</button></div>`;
}

// 받은 서류: 중앙 행정원 · 길드가 보낸 것은 책상에 새 창으로 온다(보고 목록에도 남는다)
export const isDoc = (r: Report) => r.from === '중앙 행정원' || GUILDS.some(g => B.GUILD[g].name === r.from) || r.from === '왕도일보';
// 창으로 띄울 서류: 첫날 신문은 첫 화면에서 이미 읽었다
const popDoc = (r: Report) => isDoc(r) && !(r.from === '왕도일보' && r.day === 0);
// 창으로 띄울 서류: 쪽지에서 펼친 청 · 독촉, 그다음 아직 보지 않은 보고 순서대로
export function nextDoc(W: World, ui: BuUi) {
  const ask = ui.ask != null ? W.asks.find(a => a.got == null && a.id === ui.ask) : undefined;
  if (ask) return { ask };
  for (let k = ui.docSeen ?? 0; k < W.reports.length; k++) if (popDoc(W.reports[k])) return { k };
  return null;
}
export function docModalHtml(W: World, ui: BuUi) {
  const d = nextDoc(W, ui);
  if (!d) return '';
  if (d.ask) {
    const a = d.ask, v = ui.give[a.id] ?? a.want;
    return `<div class="card modal">${letterHtml(askLetter(W, a))}
      <div class="ask-do">${stepper(`give:${a.id}`, `${n0(v)}G`, '줄 값')}<button type="button" class="go" data-act="answer:${a.id}">보내기</button><button type="button" data-act="refuse:${a.id}">거절</button><button type="button" data-act="close">나중에 · ${a.due - W.day}일 안에</button></div></div>`;
  }
  return reportDocHtml(W, d.k!, false);
}
// 보고 한 장을 종이로: 처음 받을 때(받음) · 기록 탭에서 다시 볼 때(닫기)
export function reportDocHtml(W: World, k: number, again: boolean) {
  const r = W.reports[k];
  if (!r) return '';
  const btn = (label: string) => `<button type="button" class="go wide" data-act="${again ? 'unread' : `seen:${k}`}">${again ? '닫기' : label}</button>`;
  if (r.from === '왕도일보') {
    if (r.day === 0) return `<div class="card modal news-page">${newsHtml(introNews())}${btn('신문 접기')}</div>`;
    const no = W.reports.slice(0, k + 1).filter(x => x.from === '왕도일보').length;
    return `<div class="card modal news-page">${newsHtml(floodNews(W, r, no))}${btn('신문 접기')}</div>`;
  }
  const doc = docOf(r), first = r.from === '중앙 행정원' && r.day === 0;
  return `<div class="card modal">${'gov' in doc ? govHtml(doc.gov) : letterHtml(doc.letter)}${btn(first ? '요구서 받음' : '받음')}</div>`;
}

// 요구서의 진행: 위 띠와 집무실
export function orderLine(W: World) {
  const o = W.order;
  if (!o) return '';
  const now = teamsIn(W.dungeons[o.dg]);
  return o.done === 'ok' ? '인계 · 요구서 달성' : o.done === 'fail' ? '인내가 다함 · 왕국군 철수' : `폐광 ${n1(now)} / ${o.min}조 · ${o.got} / ${o.need}일 이어짐 · 중앙의 인내 ${patWord(o.pat)}`;
}
// 중앙의 인내는 숫자로 보이지 않는다
export const patWord = (v: number) => v > 60 ? '넉넉' : v > 30 ? '줄어듦' : v > 0 ? '바닥 가까움' : '다함';

// 임기 끝: 같은 판을 손 놓은 국장 · 숙련 봇이 했다면
export function endHtml(W: World, idle: World, smart: World) {
  const row = (name: string, x: World, me = false) => `<tr class="${me ? 'me' : ''}"><td>${name}</td><td class="num">${x.stats.floods}</td><td class="num">${n1(x.stats.dead)}</td><td class="num">${n1(x.standing)}</td><td class="num">${n0(x.budget)}</td></tr>`;
  return `<div class="card end"><small>임기 ${B.DAYS}일 끝</small><h2>입지 ${n1(W.standing)}</h2>
  <table><thead><tr><th></th><th>범람</th><th>잃은 조</th><th>입지</th><th>예산</th></tr></thead><tbody>
  ${row('나', W, true)}${row('손 놓은 국장', idle)}${row('숙련 봇', smart)}</tbody></table>
  <p class="note">같은 판(시드)을 봇이 처음부터 했을 때.</p>
  <button type="button" class="go wide" data-act="new">새 임기</button></div>`;
}
