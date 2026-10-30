// 미궁관리국 게임판: HTML 문자열을 만든다. 상태에 아무것도 쓰지 않고 난수도 쓰지 않는다(그리기만).
// 위 띠(날 · 예산 · 입지 · 다음 날) · 왼쪽 관할 지도(map.ts) · 오른쪽 탭(살펴보기 · 요청서 · 조항 · 회의 · 보고)
import { lookHtml } from './map';
import { askLetter, dateOf, docOf, floodNews, govHtml, introNews, letterHtml, newsHtml } from './docs';
import { B, type FacId, FACS, type Report, type World, pnlAvg, depOf, docsOut, escrowOf, trustOf, withdrawFav, facOf, levelOf, nameOf, pactK, relOf, seenLevel, subAt, teamsIn, willOf } from '../../bureau/engine';
import { CLAUSE, CLAUSES, CLAUSE_MAX, type Clause, type Clauses, type ClauseId, FORM_NAME, FORM_OF, type Form, TO_NAME, type To, clauseLock, fits, toLock } from '../../bureau/clauses';

export type Tab = 'look' | 'asks' | 'lib' | 'meet' | 'office';
// 기록 탭의 서가: 조항 · 미궁 손익 자료 · 낸 서류 기록 · 받은 서류
export type Shelf = 'cl' | 'pnl' | 'out' | 'in';
// sel: 지도에서 고른 것('dg:0' · 'fac:big', 비우면 관할 요약). draft: 쓰고 있는 서류(받는 쪽 · 미궁 · 기간 · 조항과 값)
export interface Draft { to: To; dg: number; days: number; cl: Clauses }
// modal: 서류 쓰기 창이 열려 있나. docSeen: 받은 서류 창으로 읽은 보고 자리 · askSeen: 창으로 본 마지막 청
export interface BuUi { tab: Tab; invite: FacId[]; give: Record<number, number>; intro: boolean; seenNews: number; sel?: string; draft?: Draft; modal?: 'write'; docSeen?: number; askSeen?: number; shelf?: Shelf; read?: number; tutPnl?: boolean }
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

// 하루 예산 흐름의 어림: 입장료(영주 몫 뺌) − 보조금
export function dayFlow(W: World) {
  let fee = 0, sub = 0;
  W.dungeons.forEach((d, i) => { const n = teamsIn(d); fee += n * B.FEE * (1 - W.lordShare / 100); sub += n * subAt(W, i); });
  return { fee, sub, net: fee - sub };
}

export function topHtml(W: World, ui?: BuUi) {
  const wait = ui && tutOf(W, ui) === 'wait';
  const f = dayFlow(W), month = Math.floor(W.day / B.MONTH) + 1, toGrant = B.MONTH - (W.day % B.MONTH);
  const grant = B.GRANT + W.standing * B.GRANT_K;
  return `<div class="t-day"><b class="num">${Math.min(W.day + 1, B.DAYS)}</b><span>일 / ${B.DAYS} · ${month}달째</span></div>
  <div class="t-cell"><span>예산</span><b class="num ${W.budget < 0 ? 'neg' : ''}">${n0(W.budget)}G</b><small class="num ${f.net < 0 ? 'neg' : ''}">하루 ${sgn(f.net)}${escrowOf(W) > 0 ? ` · 공탁 ${n0(escrowOf(W))}` : ''}</small></div>
  <div class="t-cell"><span>입지</span><b class="num">${n1(W.standing)}</b><i class="gauge"><i style="width:${W.standing}%"></i></i></div>
  ${W.order && !W.order.done ? `<div class="t-cell t-order"><span>폐광 인계</span><b class="num">${W.order.got} / ${W.order.need}일</b><small class="num">${n1(teamsIn(W.dungeons[W.order.dg]))} / ${W.order.min}조 · 중앙 ${patWord(W.order.pat)}</small></div>`
    : `<div class="t-cell"><span>중앙 배정</span><b class="num">${n0(grant)}G</b><small>${toGrant}일 뒤</small></div>`}
  <div class="t-btns"><button type="button" class="go${wait ? ' pulse' : ''}" data-act="next" ${W.day >= B.DAYS ? 'disabled' : ''}>다음 날 <kbd>N</kbd></button><button type="button" data-act="ff" ${W.day >= B.DAYS ? 'disabled' : ''}>닷새</button></div>`;
}

export function dungeonHtml(W: World, i: number) {
  const d = W.dungeons[i], s = W.seen[i], lv = seenLevel(W, i), prev = s.at(-6) ?? s[0], tr = (lv - prev) / Math.min(5, s.length - 1 || 1);
  const n = teamsIn(d);
  return `<article class="dg ${levelCls(lv)}">
    <header><h3>${d.name}</h3><span class="lord">${d.lord} · 거리 ${d.dist}일</span></header>
    <div class="lv"><div class="lv-bar"><i style="height:${Math.min(100, lv)}%"></i><b style="bottom:${B.DANGER}%"></b></div>
      <div class="lv-num"><b class="num">${n0(lv)}</b><span class="tag">${levelWord(lv)}</span><small class="num">${tr >= 0.05 ? '▲' : tr <= -0.05 ? '▼' : '–'} 하루 ${n1(Math.abs(tr))}</small><small>${d.dist}일 전 보고</small></div></div>
    <dl class="dg-teams"><dt>붉은 깃발단</dt><dd class="num">${n1(d.teams.big)}조</dd><dt>중소 연합</dt><dd class="num">${n1(d.teams.small)}조</dd><dt>범람 · 잃은 조</dt><dd class="num">${d.floods} · ${n1(d.dead)}</dd></dl>
    <div class="dg-sub"><span>진입 보조금 <small>${noticeWord(W, i)}</small></span><b class="num">${subAt(W, i)}G</b><small class="num">하루 ${n0(n * subAt(W, i))}G</small><button type="button" data-act="write:${i}">서류 쓰기</button></div>
  </article>`;
}

// 미궁 손익 자료: 조 하나가 하루 남기는 값(길드 장부 어림, 보조금 빼고). 답을 주지 않고 견줄 자료만 보인다
export function pnlHtml(W: World, on = -1) {
  const sg = (v: number) => `<span class="num ${v < 0 ? 'neg' : ''}">${v > 0 ? '+' : v < 0 ? '−' : ''}${n0(Math.abs(v))}G</span>`;
  const n = W.pnl[0]?.length ?? 0;
  // 달마다 평균 (첫 칸은 영주청 이관 기록, 그 뒤 30일씩). 최근 여섯 달까지
  const months = Math.ceil(Math.max(0, n - 1) / B.MONTH), from = Math.max(0, months - 6);
  const mAvg = (i: number, m: number) => { const a = W.pnl[i].slice(1 + m * B.MONTH, 1 + (m + 1) * B.MONTH); return a.reduce((x, y) => x + y, 0) / a.length; };
  const ms = Array.from({ length: months - from }, (_, k) => from + k);
  return `<table class="pnl"><caption>미궁 손익 자료 <small>조당 하루 · 보조금 빼고</small></caption>
    <thead><tr><th></th><th>영주청 이관</th>${ms.map(m => `<th>${m + 1}월</th>`).join('')}<th>최근 7일</th><th>든 조</th></tr></thead>
    <tbody>${W.dungeons.map((d, i) => `<tr class="${i === on ? 'on' : ''}"><td>${d.name}</td><td>${sg(W.pnl[i][0])}</td>${ms.map(m => `<td>${sg(mAvg(i, m))}</td>`).join('')}<td>${n > 1 ? sg(pnlAvg(W, i, 7)) : '—'}</td><td class="num">${n1(teamsIn(d))}</td></tr>`).join('')}</tbody></table>`;
}

const noticeWord = (W: World, i: number) => {
  const n = W.notices.find(x => x.dg === i);
  return n ? `공고문 · ${n.until - W.day}일 남음` : subAt(W, i) > 0 ? '조마다 하루' : '공고 없음';
};

// 서류 쓰기: 받는 쪽이 양식을 정한다(길드 전체 공고문 · 길드 하나 요청서 · 상단 제안서). 조항을 넣고 빼고 숫자를 고친다.
// 잠긴 받는 쪽도 양식은 미리 볼 수 있지만 보내지 못한다
const PAPER: Record<Form, { head: (no: number) => string; to: (to: To) => string; body: (dg: string) => string; term: string }> = {
  notice: { head: no => `미궁관리국 공고 제${no}호`, to: () => '미궁 출입 길드 전체', body: dg => `${dg} 출입에 관하여 아래와 같이 알린다.`, term: '기한' },
  letter: { head: () => '미궁관리국 서신', to: to => `${TO_NAME[to]} 귀하`, body: dg => `${dg} 출입에 관하여 아래와 같이 요청드립니다.`, term: '약정 기간' },
  offer: { head: () => '미궁관리국 서신', to: () => '상단 귀중', body: dg => `${dg} 입구 보급에 관하여 아래와 같이 제안합니다.`, term: '약정 기간' },
};
const tagsHtml = (c: Clause) => c.give.map(t => `<span class="ctag give">${t} 내줌</span>`).join('') + c.take.map(t => `<span class="ctag take">${t} 받음</span>`).join('');

// 고르는 칸: 열린 것만 담는 드롭다운. 고르면 data-act에 값을 붙여 보낸다(bureauMain의 change)
const pick = (act: string, label: string, opts: { v: string; name: string; on?: boolean; off?: string }[], ph = '') =>
  `<select data-act="${act}" aria-label="${label}">${ph ? `<option value="" selected>${ph}</option>` : ''}${opts.map(o => `<option value="${o.v}"${o.on ? ' selected' : ''}${o.off ? ' disabled' : ''}>${o.name}${o.off ? ` (${o.off})` : ''}</option>`).join('')}</select>`;

// 서류 쓰기: 받는 쪽이 양식을 정한다. 열리지 않은 받는 쪽 · 조항은 보이지 않는다
export function writeHtml(W: World, ui: BuUi) {
  const tos = (['all', 'big', 'small', 'trade'] as To[]).filter(t => !toLock(W, t));
  const f0 = ui.draft ?? DRAFT0, f = tos.includes(f0.to) ? f0 : { ...f0, to: 'all' as To };
  const form = FORM_OF[f.to], P = PAPER[form], d = W.dungeons[f.dg];
  const n = f.to === 'big' || f.to === 'small' ? d.teams[f.to] : teamsIn(d);
  const ids = Object.keys(f.cl) as ClauseId[], old = form === 'notice' && W.notices.find(x => x.dg === f.dg);
  const row = (id: ClauseId, k: number) => {
    const c = CLAUSE[id], v = f.cl[id]!;
    return `<li><div class="c-head"><b>제${k + 1}조 ${c.name}</b>${c.needs ? `<small class="chain">⛓ ${CLAUSE[c.needs].name}</small>` : ''}<button type="button" class="x" data-act="wdel:${id}" aria-label="${c.name} 빼기">빼기</button></div>
      <p>${c.line(v)}</p>${c.field ? stepper(`wv:${id}`, `${v}${c.field.unit}`, c.name) : ''}</li>`;
  };
  // 이 양식에 넣을 수 있는 열린 조항. 바탕이 없는 걸린 조항은 고를 수 없게
  const pal = CLAUSES.filter(c => c.forms.includes(form) && f.cl[c.id] == null && !clauseLock(W, c.id))
    .map(c => ({ v: c.id, name: c.name, off: c.needs && f.cl[c.needs] == null ? `⛓ ${CLAUSE[c.needs].name} 먼저` : '' }));
  const sub = f.cl.sub ?? 0, comfort = f.cl.comfort;
  const cost = [sub ? `보조금 하루 ${n0(n * sub)}G · 기한 ${n0(n * sub * f.days)}G 어림` : '', comfort ? `잃은 조마다 ${comfort}G` : ''].filter(Boolean).join(' · ');
  const full = !old && docsOut(W) >= W.clerks;
  // 공고문: 공탁(기한 동안 쓸 돈을 떼어 둠)과 길드마다의 믿음(기한으로)
  const dep = form === 'notice' ? depOf(f.cl, f.days) : 0, poor = dep > W.budget + (old ? old.dep : 0);
  const trust = form === 'notice' && sub ? `<p class="w-cost num">믿음 · 붉은 깃발단 ${n0(trustOf('big', f.days) * 100)}% · 중소 연합 ${n0(trustOf('small', f.days) * 100)}%</p>` : '';
  const canPost = !full && !poor && ids.length > 0 && ids.every(id => fits(W, form, f.cl, id));
  return `<article class="write">
    <h4>서류 쓰기 <small class="num">서기 ${W.clerks}명 · 낸 서류 ${docsOut(W)} / ${W.clerks}</small><button type="button" class="x close" data-act="close" aria-label="닫기">닫기</button></h4>
    <div class="w-row"><span>받는 쪽</span>${pick('wto', '받는 쪽', tos.map(t => ({ v: t, name: `${TO_NAME[t]} · ${FORM_NAME[FORM_OF[t]]}`, on: t === f.to })))}</div>
    <div class="w-row"><span>미궁</span>${pick('wdg', '미궁', W.dungeons.map((x, i) => ({ v: String(i), name: x.name, on: i === f.dg })))}</div>
    <div class="gov-doc out f-${form}">
      <header class="gd-org">미 궁 관 리 국</header>
      <p class="gd-kind">${FORM_NAME[form].split('').join(' ')}</p>
      <dl class="gd-meta"><dt>수신</dt><dd>${P.to(f.to)}</dd><dt>제목</dt><dd><b>${d.name} 출입에 관한 ${FORM_NAME[form]}</b></dd></dl>
      <p>${P.body(d.name)}</p>
      ${ids.length ? `<ol class="p-cl">${ids.map(row).join('')}</ol>` : '<p class="empty">조항을 아래에서 넣는다.</p>'}
      <div class="p-term"><span>${P.term}</span>${stepper('wdays', `${f.days}일`, P.term)}<small class="num">${W.day + f.days}일까지</small></div>
      <footer class="gd-sign"><b>미궁관리국장</b><i class="seal sq" aria-label="직인">管理局印</i></footer>
      <p class="gd-no"><span>${P.head(W.docN + 1)}</span><span>시행 ${dateOf(W.day)}</span></p>
    </div>
    <div class="w-row"><span>조항 넣기 <small>${ids.length} / ${CLAUSE_MAX}</small></span>${pal.length && ids.length < CLAUSE_MAX ? pick('wadd', '조항 넣기', pal, '조항 고르기') : '<small class="note">더 넣을 조항 없음</small>'}</div>
    ${cost ? `<p class="w-cost num">지금 ${n1(n)}조 기준 · ${cost}</p>` : ''}
    ${dep ? `<p class="w-cost num ${poor ? 'neg' : ''}">공탁 ${n0(dep)}G${old && old.dep ? ` · 옛 공탁 ${n0(old.dep)}G 돌려받음` : ''}${poor ? ' · 예산 모자람' : ''}</p>` : ''}
    ${trust}
    ${form === 'letter' ? `<p class="w-cost">${B.LETTER_DAYS}일 뒤 답이 온다. 서명하면 ${TO_NAME[f.to]}에만 걸린다.</p>` : ''}
    <button type="button" class="go wide" data-act="post" ${canPost ? '' : 'disabled'}>${full ? '서기가 모자람 · 집무실' : poor ? '공탁할 예산이 모자람' : form === 'notice' ? (old ? '공고문 고쳐 내걸기' : '공고문 내걸기') : '요청서 보내기'}</button>
  </article>`;
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
      <p class="c-forms">${c.forms.map(x => FORM_NAME[x]).join(' · ')}${c.field ? ` · 숫자 칸 ${c.field.min} ~ ${c.field.max}${c.field.unit}` : ''}${c.needs ? ` · ⛓ ${CLAUSE[c.needs].name}에 걸림` : ''}</p>
      <p>${c.fx}</p>
    </article>`;
  return `<p class="note">서류에 넣는 조항. 받는 쪽이 양식을 정한다: 길드 전체는 공고문, 길드 하나는 요청서, 상단은 제안서. 한 서류에 ${CLAUSE_MAX}조까지, 걸린 조항(⛓)은 바탕 조항이 있어야 넣고 바탕을 빼면 함께 빠진다.</p>
  ${CLAUSES.filter(c => !clauseLock(W, c.id)).map(card).join('')}`;
}

// 첫 사건의 업무 안내: 서기가 한 줄로 다음 할 일을 가리킨다. 날짜가 아니라 상태로 넘어가고, 고르는 단추는 없다.
// 요구서를 받음 → 기록실의 영주청 장부 보기 → 서류 쓰기 → 날 넘기며 지켜보기 → 조가 들기 시작함. 요구서가 끝나면 사라진다
export type Tut = 'lib' | 'write' | 'wait' | 'see' | '';
export function tutOf(W: World, ui: BuUi): Tut {
  if (!W.order || W.order.done || ui.intro) return '';
  const k = W.reports.findIndex(r => r.from === '중앙 행정원');
  if (k < 0 || (ui.docSeen ?? 0) <= k) return '';
  if (!ui.tutPnl) return 'lib';
  if (!W.docN) return 'write';
  return teamsIn(W.dungeons[W.order.dg]) < 1 ? 'wait' : 'see';
}
const TUT: Record<Exclude<Tut, ''>, string> = {
  lib: '영주청에서 넘어온 길드 출입 장부 사본이 기록실에 와 있습니다. 길드가 폐광을 꺼리는 까닭이 거기 적혀 있을 겁니다. <b>기록</b> 탭의 <b>손익 자료</b>입니다.',
  write: '길드에 명령은 못 하니 서류로 청해야지요. <b>서류</b> 탭에서 길드 전체에 폐광 공고문을 씁니다. 다른 미궁과 견주어 얼마를 얹을지, 얼마나 오래 걸지 정하시면 됩니다.',
  wait: '공고는 신문에 실려 퍼집니다. 중소 연합 회관까지 하루, 붉은 깃발단 본부까지 이틀. <b>다음 날</b>을 넘기며 지도에서 길드가 움직이는지 보시지요.',
  see: '폐광으로 가는 길드의 발길이 지도에 보입니다. 위 띠의 <b>폐광 인계</b> 칸이 하루 몇 조가 들었는지 셉니다. 모자라면 공고문을 고쳐 내걸 수 있습니다.',
};
export const tutHtml = (W: World, ui: BuUi) => { const t = tutOf(W, ui); return t ? `<aside class="tut"><b>서기</b><p>${TUT[t]}</p></aside>` : ''; };

// 기록 탭: 도서관. 가진 조항 · 미궁 손익 자료 · 낸 서류의 기록 · 받은 서류 철. 서류를 쓸 때 참고할 것은 여기서 찾는다
const OUT_RE = /^(공고문:|요청서:|공고 철회|공고 기한 끝|요청서 거둠|요청서 기한 끝)/;
function libHtml(W: World, ui: BuUi) {
  const sh = ui.shelf ?? 'cl';
  const b = (id: Shelf, name: string) => `<button type="button" class="opt ${sh === id ? 'on' : ''}${id === 'pnl' && tutOf(W, ui) === 'lib' && sh !== 'pnl' ? ' pulse' : ''}" data-act="shelf:${id}" aria-pressed="${sh === id}">${name}</button>`;
  const nav = `<div class="opts shelf">${b('cl', '조항')}${b('pnl', '손익 자료')}${b('out', '낸 서류')}${b('in', '받은 서류')}</div>`;
  if (sh === 'pnl') return nav + `<p class="note">미궁마다 조 하나가 하루 남기는 값의 어림. 첫 칸은 영주청이 입장세를 걷으며 길드 장부에서 옮겨 적은 사본(관리국이 생기며 넘겨받음)이고, 그 뒤는 관리국 검문소가 드나든 조의 짐과 다친 사람을 보고 적는다.</p><div class="pnl-wrap">${pnlHtml(W)}</div>`;
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

// 두 길드의 몸집: 조 · 금고 · 영향력을 같은 막대에 견준다
export function guildsHtml(W: World) {
  const G = [W.guilds.big, W.guilds.small];
  const row = (name: string, v: (g: typeof G[0]) => number, fmt: (x: number) => string) => {
    const top = Math.max(1, ...G.map(v));
    return `<div class="gs-row"><span>${name}</span>${G.map(g => `<i class="gs-bar f-${g.id}" title="${g.name} ${fmt(v(g))}"><i style="width:${Math.max(2, v(g) / top * 100)}%"></i><b class="num">${fmt(v(g))}</b></i>`).join('')}</div>`;
  };
  return `<section class="gscale"><h2>길드 몸집</h2>
    <div class="gs-row gs-head"><span></span>${G.map(g => `<b class="f-${g.id}">${g.name}</b>`).join('')}</div>
    ${row('조', g => g.size, x => `${n0(x)}조`)}${row('금고', g => Math.max(0, g.money), x => `${n0(x)}G`)}${row('영향력', g => g.infl, x => n0(x))}</section>`;
}

export function facHtml(W: World, f: FacId) {
  const o = facOf(W, f), owe = W.owe[f], g = f === 'lord' ? null : W.guilds[f];
  return `<article class="fac f-${f}">
    <h3>${o.name}</h3>
    <dl>
      ${g ? `<dt>조</dt><dd class="num">${n0(g.size)}</dd><dt>금고</dt><dd class="num ${g.money < 0 ? 'neg' : ''}">${n0(g.money)}G</dd>` : `<dt>입장료 몫</dt><dd class="num">${W.lordShare}%</dd>`}
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
  if (pactK(W) > 0) return `<p class="pact on">출입 협정 이행 중 · ${W.pact.until - W.day}일 남음</p>`;
  return `<p class="pact wait">협정 서명 · 이행 대기</p>`;
}

const openAsks = (W: World) => W.asks.filter(a => a.got == null);
export function tabsHtml(W: World, ui: BuUi) {
  const news = W.reports.length - ui.seenNews, asks = openAsks(W).length;
  const tut = tutOf(W, ui), pulse = (id: Tab) => (tut === 'lib' && id === 'lib' && ui.tab !== 'lib') || (tut === 'write' && id === 'asks' && ui.tab !== 'asks');
  const t = (id: Tab, name: string, badge = 0) => `<button type="button" role="tab" class="${pulse(id) ? 'pulse' : ''}" data-act="tab:${id}" aria-selected="${ui.tab === id}">${name}${badge ? ` <span class="badge">${badge}</span>` : ''}</button>`;
  return t('look', '살펴보기') + t('asks', '서류', asks) + t('lib', '기록') + t('meet', '회의') + t('office', '집무실', ui.tab === 'office' ? 0 : news + W.pts);
}

export function paneHtml(W: World, ui: BuUi) {
  return tutHtml(W, ui) + paneBody(W, ui);
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
    const cool = B.MEET_COOL - (W.day - W.meetAt), lord = ui.invite.includes('lord');
    const signWord = (f: FacId) => { const w = willOf(W, f) + (lord ? 5 : 0); return w >= B.SIGN_AT ? '서명할 듯' : w >= B.SIGN_AT - 20 ? '마지못해' : '거절할 듯'; };
    return `<p class="note">두 길드를 다 불러야 협정이 선다. 부르는 것은 부탁이라 부른 세력마다 신세 ${B.MEET_OWE}을 쓴다. 빠진 세력은 서운해한다.</p>
    <div class="invite">${FACS.map(f => `<label><input type="checkbox" data-act="inv:${f}" ${ui.invite.includes(f) ? 'checked' : ''}> ${nameOf(W, f)}${f !== 'lord' ? ` <span class="tag">${signWord(f)}</span>` : ''}</label>`).join('')}</div>
    <button type="button" class="go wide" data-act="meet" ${cool > 0 || !ui.invite.includes('big') || !ui.invite.includes('small') ? 'disabled' : ''}>회의 열기${cool > 0 ? ` · ${cool}일 뒤` : ''}</button>
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
const GUILD_NAMES = ['붉은 깃발단', '중소 길드 연합'];
export const isDoc = (r: Report) => r.from === '중앙 행정원' || GUILD_NAMES.includes(r.from) || r.from === '왕도일보';
// 창으로 띄울 서류: 첫날 신문은 첫 화면에서 이미 읽었다
const popDoc = (r: Report) => isDoc(r) && !(r.from === '왕도일보' && r.day === 0);
// 아직 창으로 보지 않은 서류: 청 · 독촉이 먼저, 그다음 보고 순서대로
export function nextDoc(W: World, ui: BuUi) {
  const ask = W.asks.find(a => a.got == null && a.id > (ui.askSeen ?? 0));
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
      <div class="ask-do">${stepper(`give:${a.id}`, `${n0(v)}G`, '줄 값')}<button type="button" class="go" data-act="answer:${a.id}">보내기</button><button type="button" data-act="refuse:${a.id}">거절</button><button type="button" data-act="later:${a.id}">나중에 · ${a.due - W.day}일 안에</button></div></div>`;
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
