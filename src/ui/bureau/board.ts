// 미궁관리국 게임판: HTML 문자열을 만든다. 상태에 아무것도 쓰지 않고 난수도 쓰지 않는다(그리기만).
// 위 띠(날 · 예산 · 입지 · 다음 날) · 왼쪽 관할 지도(map.ts) · 오른쪽 탭(살펴보기 · 요청서 · 조항 · 회의 · 보고)
import { lookHtml } from './map';
import { B, type FacId, FACS, type World, facOf, nameOf, pactK, relOf, seenLevel, teamsIn, willOf } from '../../bureau/engine';
import { CLAUSE, CLAUSES, CLAUSE_MAX, type Clause, type Clauses, type ClauseId, FORM_NAME, FORM_OF, type Form, TO_NAME, type To, clauseLock, fits, toLock } from '../../bureau/clauses';

export type Tab = 'look' | 'asks' | 'rules' | 'meet' | 'news';
// sel: 지도에서 고른 것('dg:0' · 'fac:big', 비우면 관할 요약). draft: 쓰고 있는 서류(받는 쪽 · 미궁 · 기간 · 조항과 값)
export interface Draft { to: To; dg: number; days: number; cl: Clauses }
export interface BuUi { tab: Tab; invite: FacId[]; give: Record<number, number>; intro: boolean; seenNews: number; sel?: string; draft?: Draft }
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
  for (const d of W.dungeons) { const n = teamsIn(d); fee += n * B.FEE * (1 - W.lordShare / 100); sub += n * d.sub; }
  return { fee, sub, net: fee - sub };
}

export function topHtml(W: World) {
  const f = dayFlow(W), month = Math.floor(W.day / B.MONTH) + 1, toGrant = B.MONTH - (W.day % B.MONTH);
  const grant = B.GRANT + W.standing * B.GRANT_K;
  return `<div class="t-day"><b class="num">${Math.min(W.day + 1, B.DAYS)}</b><span>일 / ${B.DAYS} · ${month}달째</span></div>
  <div class="t-cell"><span>예산</span><b class="num ${W.budget < 0 ? 'neg' : ''}">${n0(W.budget)}G</b><small class="num ${f.net < 0 ? 'neg' : ''}">하루 ${sgn(f.net)}</small></div>
  <div class="t-cell"><span>입지</span><b class="num">${n1(W.standing)}</b><i class="gauge"><i style="width:${W.standing}%"></i></i></div>
  <div class="t-cell"><span>중앙 배정</span><b class="num">${n0(grant)}G</b><small>${toGrant}일 뒤</small></div>
  <div class="t-btns"><button type="button" class="go" data-act="next" ${W.day >= B.DAYS ? 'disabled' : ''}>다음 날 <kbd>N</kbd></button><button type="button" data-act="ff" ${W.day >= B.DAYS ? 'disabled' : ''}>닷새</button></div>`;
}

export function dungeonHtml(W: World, i: number) {
  const d = W.dungeons[i], s = W.seen[i], lv = seenLevel(W, i), prev = s.at(-6) ?? s[0], tr = (lv - prev) / Math.min(5, s.length - 1 || 1);
  const n = teamsIn(d);
  return `<article class="dg ${levelCls(lv)}">
    <header><h3>${d.name}</h3><span class="lord">${d.lord} · 거리 ${d.dist}일</span></header>
    <div class="lv"><div class="lv-bar"><i style="height:${Math.min(100, lv)}%"></i><b style="bottom:${B.DANGER}%"></b></div>
      <div class="lv-num"><b class="num">${n0(lv)}</b><span class="tag">${levelWord(lv)}</span><small class="num">${tr >= 0.05 ? '▲' : tr <= -0.05 ? '▼' : '–'} 하루 ${n1(Math.abs(tr))}</small><small>${d.dist}일 전 보고</small></div></div>
    <dl class="dg-teams"><dt>붉은 깃발단</dt><dd class="num">${n1(d.teams.big)}조</dd><dt>중소 연합</dt><dd class="num">${n1(d.teams.small)}조</dd><dt>범람 · 잃은 조</dt><dd class="num">${d.floods} · ${n1(d.dead)}</dd></dl>
    <div class="dg-sub"><span>진입 보조금 <small>${noticeWord(W, i)}</small></span><b class="num">${d.sub}G</b><small class="num">하루 ${n0(n * d.sub)}G</small><button type="button" data-act="write:${i}">서류 쓰기</button></div>
  </article>`;
}

const noticeWord = (W: World, i: number) => {
  const n = W.notices.find(x => x.dg === i);
  return n ? `공고문 · ${n.until - W.day}일 남음` : W.dungeons[i].sub > 0 ? '조마다 하루' : '공고 없음';
};

// 서류 쓰기: 받는 쪽이 양식을 정한다(길드 전체 공고문 · 길드 하나 요청서 · 상단 제안서). 조항을 넣고 빼고 숫자를 고친다.
// 잠긴 받는 쪽도 양식은 미리 볼 수 있지만 보내지 못한다
const PAPER: Record<Form, { head: (no: number) => string; to: (to: To) => string; body: (dg: string) => string; term: string }> = {
  notice: { head: no => `미궁관리국 공고 제${no}호`, to: () => '수신: 미궁 출입 길드 전체', body: dg => `${dg} 출입에 관하여 아래와 같이 알린다.`, term: '기한' },
  letter: { head: () => '미궁관리국 서신', to: to => `${TO_NAME[to]} 귀하`, body: dg => `${dg} 출입에 관하여 아래와 같이 요청드립니다.`, term: '약정 기간' },
  offer: { head: () => '미궁관리국 서신', to: () => '상단 귀중', body: dg => `${dg} 입구 보급에 관하여 아래와 같이 제안합니다.`, term: '약정 기간' },
};
const tagsHtml = (c: Clause) => c.give.map(t => `<span class="ctag give">${t} 내줌</span>`).join('') + c.take.map(t => `<span class="ctag take">${t} 받음</span>`).join('');

function writeHtml(W: World, ui: BuUi) {
  const f = ui.draft ?? DRAFT0, form = FORM_OF[f.to], P = PAPER[form], d = W.dungeons[f.dg], n = teamsIn(d);
  const lock = toLock(W, f.to), ids = Object.keys(f.cl) as ClauseId[], old = W.notices.find(x => x.dg === f.dg);
  const no = Math.max(0, ...W.notices.map(x => x.id)) + 1;
  const tos: To[] = ['all', 'big', 'small', 'trade'];
  const toBtn = (t: To) => `<button type="button" class="opt${t === f.to ? ' on' : ''}${toLock(W, t) ? ' lock' : ''}" data-act="wto:${t}" aria-pressed="${t === f.to}" ${toLock(W, t) ? `title="${toLock(W, t)}"` : ''}>${toLock(W, t) ? '🔒 ' : ''}${TO_NAME[t]} <small>${FORM_NAME[FORM_OF[t]]}</small></button>`;
  const row = (id: ClauseId, k: number) => {
    const c = CLAUSE[id], v = f.cl[id]!;
    return `<li><div class="c-head"><b>제${k + 1}조 ${c.name}</b>${c.needs ? `<small class="chain">⛓ ${CLAUSE[c.needs].name}</small>` : ''}<button type="button" class="x" data-act="wdel:${id}" aria-label="${c.name} 빼기">빼기</button></div>
      <p>${c.line(v)}</p>${c.field ? stepper(`wv:${id}`, `${v}${c.field.unit}`, c.name) : ''}</li>`;
  };
  // 이 양식에 넣을 수 있는 조항: 넣기 단추, 아니면 왜 못 넣는지. 잠긴 조항은 보이지 않는다
  const pal = CLAUSES.filter(c => c.forms.includes(form) && f.cl[c.id] == null && !clauseLock(W, c.id)).map(c => {
    const [ic, why] = c.needs && f.cl[c.needs] == null ? ['⛓', `${CLAUSE[c.needs].name} 먼저`] : ids.length >= CLAUSE_MAX ? ['·', `${CLAUSE_MAX}조가 다 참`] : ['+', ''];
    return `<button type="button" class="opt add${why ? ' lock' : ''}" data-act="wadd:${c.id}" ${why ? `disabled title="${why}"` : ''}>${ic} ${c.name}</button>`;
  }).join('');
  const sub = f.cl.sub ?? 0, comfort = f.cl.comfort;
  const cost = [sub ? `보조금 하루 ${n0(n * sub)}G · 기한 ${n0(n * sub * f.days)}G 어림` : '', comfort ? `잃은 조마다 ${comfort}G` : ''].filter(Boolean).join(' · ');
  const canPost = !lock && ids.length > 0 && ids.every(id => fits(W, form, f.cl, id));
  return `<article class="write">
    <h4>서류 쓰기</h4>
    <div class="w-row"><span>받는 쪽</span><div class="opts">${tos.map(toBtn).join('')}</div></div>
    <div class="w-row"><span>미궁</span><div class="opts">${W.dungeons.map((x, i) => `<button type="button" class="opt${i === f.dg ? ' on' : ''}" data-act="wdg:${i}" aria-pressed="${i === f.dg}">${x.name}</button>`).join('')}</div></div>
    <div class="paper f-${form}${lock ? ' locked' : ''}">
      <header><small>${P.head(no)}</small><h3>${FORM_NAME[form]}</h3></header>
      <p class="p-to">${P.to(f.to)}</p>
      <p>${P.body(d.name)}</p>
      ${ids.length ? `<ol class="p-cl">${ids.map(row).join('')}</ol>` : '<p class="empty">조항을 아래에서 넣는다.</p>'}
      <div class="p-term"><span>${P.term}</span>${stepper('wdays', `${f.days}일`, P.term)}<small class="num">${W.day + f.days}일까지</small></div>
      <p class="p-sign">미궁관리국장</p>
      ${lock ? `<p class="stamp">🔒 ${lock}</p>` : ''}
    </div>
    <div class="w-row"><span>조항 넣기 <small>${ids.length} / ${CLAUSE_MAX}</small></span><div class="opts">${pal || '<small class="note">더 넣을 조항 없음</small>'}</div></div>
    ${cost ? `<p class="w-cost num">지금 ${n1(n)}조 기준 · ${cost}</p>` : ''}
    <button type="button" class="go wide" data-act="post" ${canPost ? '' : 'disabled'}>${lock ? '보낼 수 없음' : form === 'notice' ? (old ? '공고문 고쳐 내걸기' : '공고문 내걸기') : '보내기'}</button>
  </article>`;
}

function postedHtml(W: World) {
  if (!W.notices.length) return '';
  return `<h4>내건 공고문</h4>${W.notices.map(x => {
    const d = W.dungeons[x.dg], cl = (Object.keys(x.cl) as ClauseId[]).map(k => CLAUSE[k].name + (CLAUSE[k].field ? ` <b class="num">${x.cl[k]}${CLAUSE[k].field!.unit}</b>` : '')).join(' · ');
    return `<p class="past notice"><span>${d.name} · ${cl}</span><small class="num">${x.until - W.day}일 남음</small><button type="button" data-act="withdraw:${x.id}">철회</button></p>`;
  }).join('')}`;
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

// 관리국 규정: 서류 없이 국장이 바로 정하는 것 (살펴보기의 관할 요약에 둔다)
export function rulesHtml(W: World) {
  const side = W.prio > 50 ? '붉은 깃발단 쪽' : W.prio < 50 ? '중소 연합 쪽' : '가운데';
  return `<section class="rules"><h2>관리국 규정</h2>
    <div class="rule"><h4>우선권</h4><p>미궁 몫을 나눌 때 어느 길드를 먼저 세우나</p>${stepper('prio', String(W.prio), '우선권')}<span class="tag">${side}</span></div>
    <div class="rule"><h4>입장료의 영주 몫</h4><p>조마다 하루 ${B.FEE}G 입장료에서 영주에게 가는 몫</p>${stepper('share', `${W.lordShare}%`, '영주 몫')}</div></section>`;
}

export function facHtml(W: World, f: FacId) {
  const o = facOf(W, f), owe = W.owe[f], g = f === 'lord' ? null : W.guilds[f];
  return `<article class="fac f-${f}">
    <h3>${o.name}</h3>
    <dl>
      ${g ? `<dt>조</dt><dd class="num">${n1(g.size)}</dd>` : `<dt>입장료 몫</dt><dd class="num">${W.lordShare}%</dd>`}
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
  const t = (id: Tab, name: string, badge = 0) => `<button type="button" role="tab" data-act="tab:${id}" aria-selected="${ui.tab === id}">${name}${badge ? ` <span class="badge">${badge}</span>` : ''}</button>`;
  return t('look', '살펴보기') + t('asks', '서류', asks) + t('rules', '조항') + t('meet', '회의') + t('news', '보고', ui.tab === 'news' ? 0 : news);
}

export function paneHtml(W: World, ui: BuUi) {
  if (ui.tab === 'look') return lookHtml(W, ui);
  if (ui.tab === 'asks') {
    const asks = openAsks(W), done = W.asks.filter(a => a.got != null).slice(-4).reverse();
    return writeHtml(W, ui) + postedHtml(W) + `<h4>받은 청 · 독촉</h4>` + (asks.length ? asks.map(a => {
      const v = ui.give[a.id] ?? a.want;
      return `<article class="ask ${a.kind}">
        <header><b>${nameOf(W, a.from)}</b><span class="tag ${a.kind === 'dun' ? 'warn' : ''}">${a.kind === 'dun' ? '독촉' : '청'}</span><small>${a.due - W.day}일 안에</small></header>
        <p class="num">청한 값 ${n0(a.want)}G</p>${a.chips.map(c => `<span class="chip">${c}</span>`).join('')}
        <div class="ask-do">${stepper(`give:${a.id}`, `${n0(v)}G`, '줄 값')}<button type="button" class="go" data-act="answer:${a.id}">보내기</button><button type="button" data-act="refuse:${a.id}">거절</button></div>
      </article>`;
    }).join('') : '<p class="empty">받은 청 없음</p>')
      + (done.length ? `<h4>지난 답</h4>${done.map(a => `<p class="past"><span>${a.day}일 · ${nameOf(W, a.from)} ${a.kind === 'dun' ? '독촉' : '청'}</span><b class="num">${n0(a.got!)} / ${n0(a.want)}G</b></p>`).join('')}` : '');
  }
  if (ui.tab === 'rules') return clausesHtml(W);
  if (ui.tab === 'meet') {
    const cool = B.MEET_COOL - (W.day - W.meetAt), lord = ui.invite.includes('lord');
    const signWord = (f: FacId) => { const w = willOf(W, f) + (lord ? 5 : 0); return w >= B.SIGN_AT ? '서명할 듯' : w >= B.SIGN_AT - 20 ? '마지못해' : '거절할 듯'; };
    return `<p class="note">두 길드를 다 불러야 협정이 선다. 부르는 것은 부탁이라 부른 세력마다 신세 ${B.MEET_OWE}을 쓴다. 빠진 세력은 서운해한다.</p>
    <div class="invite">${FACS.map(f => `<label><input type="checkbox" data-act="inv:${f}" ${ui.invite.includes(f) ? 'checked' : ''}> ${nameOf(W, f)}${f !== 'lord' ? ` <span class="tag">${signWord(f)}</span>` : ''}</label>`).join('')}</div>
    <button type="button" class="go wide" data-act="meet" ${cool > 0 || !ui.invite.includes('big') || !ui.invite.includes('small') ? 'disabled' : ''}>회의 열기${cool > 0 ? ` · ${cool}일 뒤` : ''}</button>
    ${pactLine(W)}`;
  }
  const rs = W.reports.slice().reverse().slice(0, 40);
  return `<ul class="news">${rs.map((r, k) => `<li class="${W.reports.length - k > ui.seenNews ? 'new' : ''}"><small>${r.day}일 · ${r.from}</small><b>${r.title}</b>${r.chips.map(c => `<span class="chip">${c}</span>`).join('')}</li>`).join('')}</ul>`;
}

// 처음 부임할 때 한 장
export function introHtml() {
  return `<div class="card intro"><small>중앙 행정원 · 임명장</small><h2>미궁관리국장 부임</h2>
  <p>폐광 아래 미궁이 넘쳐 마을이 잠겼다. 관리국은 길드에 명령하지 못한다. 돈과 조항과 회의로 길드 · 영주가 스스로 움직이게 한다.</p>
  <ul><li><b>수위</b>: 조가 미궁에 들어가 몬스터를 잡아야 내려간다. 보고는 거리만큼 늦게 온다.</li>
  <li><b>서류</b>: 조항을 골라 조합해 쓴다. 받는 쪽이 양식을 정한다(길드 전체 공고문 · 길드 하나 요청서 · 상단 제안서). 지금은 공고문만 보낼 수 있다.</li>
  <li><b>받은 청</b>: 길드 · 영주의 청을 들어주면 신세를 받고, 받은 신세로 회의 서명을 얻는다.</li>
  <li><b>회의</b>: 사이가 틀어진 두 길드를 불러 출입 협정을 맺게 한다.</li></ul>
  <p>임기는 ${B.DAYS}일. 범람을 줄이고 입지를 지킨다.</p>
  <button type="button" class="go wide" data-act="start">부임</button></div>`;
}

// 임기 끝: 같은 판을 손 놓은 국장 · 숙련 봇이 했다면
export function endHtml(W: World, idle: World, smart: World) {
  const row = (name: string, x: World, me = false) => `<tr class="${me ? 'me' : ''}"><td>${name}</td><td class="num">${x.stats.floods}</td><td class="num">${n1(x.stats.dead)}</td><td class="num">${n1(x.standing)}</td><td class="num">${n0(x.budget)}</td></tr>`;
  return `<div class="card end"><small>임기 ${B.DAYS}일 끝</small><h2>입지 ${n1(W.standing)}</h2>
  <table><thead><tr><th></th><th>범람</th><th>잃은 조</th><th>입지</th><th>예산</th></tr></thead><tbody>
  ${row('나', W, true)}${row('손 놓은 국장', idle)}${row('숙련 봇', smart)}</tbody></table>
  <p class="note">같은 판(시드)을 봇이 처음부터 했을 때.</p>
  <button type="button" class="go wide" data-act="new">새 임기</button></div>`;
}
