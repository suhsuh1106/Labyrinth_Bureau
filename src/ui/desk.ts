// 책상 화면: 결재 서류 요약, 달력, 물건마다 새 소식 표시, 집어 든 서류(읽기 화면), 도장으로 결재
import { C, TARGETS } from '../core/data';
import { project } from '../core/economy';
import { partyCount } from '../core/explore';
import { founding } from '../core/founding';
import { S } from '../core/state';
import { evalItems, resolve } from '../core/turn';
import { fmt, pct, sgn } from '../core/util';
import { rows } from '../core/html';
import { render, renderPanel } from './app';
import { BUDGET_GROUPS, VIS, syncBudget } from './budget';
import { latestIsExtra, renderNewsTab, showIssue } from './news';
import { playMoments } from './moments';

const $ = (id: string): any => document.getElementById(id);
const TABS = ['docs', 'news', 'faction', 'explore', 'hero', 'build', 'books'];
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// 예산안 아래 한 줄 설명. 예산 편집 화면 머리말과 책상 위 서류가 같이 쓴다
export function leadText() {
  if (S.over) return '서류함의 평가서를 확인하세요.';
  const base = `용병 ${S.M}명 · 파티 약 ${partyCount()}개 · 필요한 포션 ${S.M * C.NEED}병`;
  return founding() ? `개척기 · ${base}${S.unsold ? ` · 팔지 못한 전리품 ${fmt(S.unsold)}G어치` : ''}` : base;
}

// 물건마다 이번 달 새로 볼 것이 있는지 (예전 탭의 '새 소식' 표시와 같은 기준)
export function freshTabs(): Record<string, number> {
  const out: Record<string, number> = {};
  const docs = (S.agenda ? 1 : 0) + (S.intel && S.intel.month === S.month ? 1 : 0) + S.offers.length + S.eventDocs.filter(d => d.month === S.month).length
    + (S.notices.length ? 1 : 0) + (S.ledgers ? 1 : 0) + (S.talk ? 1 : 0);
  out.docs = docs;
  out.build = S.log.some(e => e.m === S.month - 1 && /완공/.test(e.t)) ? 1 : 0;
  out.faction = S.archive.some(a => a.m === S.month && a.who !== 'other') ? 1 : 0;
  out.hero = S.log.some(e => e.m === S.month - 1 && /용사/.test(e.t)) || (!S.hero && S.heroApps.some(a => a.m === S.month)) ? 1 : 0;
  out.explore = S.log.some(e => e.m === S.month - 1 && /층/.test(e.t)) ? 1 : 0;
  out.news = S.month > 1 ? 1 : 0;
  out.books = 0;
  return out;
}

// 책상 가운데 결재 서류: 묶음별 합계와 예상 손익만 적는다. 자세한 조정은 집어 들어서
export function deskBudgetHtml() {
  const p = project(S.budget);
  const groups = BUDGET_GROUPS.filter(g => g.show ? g.show() : (g.id === 'fixed' || VIS.some(l => l.cat === g.id)));
  const line = (lbl: string, val: string, cls = '') => `<span class="sl ${cls}"><span class="lbl">${lbl}</span><span class="dots"></span><span class="val">${val}</span></span>`;
  const gl = groups.map(g => {
    const v = g.sub(p, S.budget);
    return line(g.name, g.signed ? (v ? `${v > 0 ? '수입' : '보조금'} ${fmt(Math.abs(v))}` : '0') : fmt(v), g.id === 'fixed' ? 'dim' : '');
  }).join('');
  const warns = [];
  if (!S.over && p.cov < 0.95) warns.push(`포션이 모자라요 (${pct(p.cov)})`);
  if (!S.over && S.treasury + p.net < 0) warns.push('이대로면 금고가 마이너스가 돼요');
  const no = String(Math.min(S.month, C.MONTHS)).padStart(4, '0');
  return `<span class="head"><span>
      <span class="kind">미궁 관리국 · 예산 품의서</span>
      <h2>${S.over ? '임기 종료' : `제${S.month}월 예산안`}</h2>
      <span class="docno">관리국 제${no}호 · ${leadText()}</span></span>
    <span class="approval" aria-label="결재란">
      <span><b>담당</b><i><span class="seal">서기</span></i></span>
      <span><b>과장</b><i><span class="seal">재무</span></i></span>
      <span class="chief"><b>국장</b><i><span class="seal">국장</span></i></span>
    </span></span>
    <span class="sls">${gl}
      ${line('예상 수입 (전리품은 지난달 기준)', fmt(p.income), 'dim')}
      ${line('예산 합계', fmt(p.spend))}
      ${line('예상 손익', `<span class="${p.net < 0 ? 'neg' : 'pos'}">${sgn(p.net)}</span>`, 'total')}</span>
    <span class="foot"><span class="${warns.length ? 'warn' : ''}">${warns.length ? warns.join(' · ') : '누르면 서류를 집어 들어 금액을 고칠 수 있어요'}</span><span>${S.over ? '' : '결재는 도장으로'}</span></span>
    <span class="bigseal" aria-hidden="true"><span>결재<small>제${S.month}월</small></span></span>`;
}
export function renderDeskBudget() { const el = $('desk-budget'); if (el) el.innerHTML = deskBudgetHtml(); }

// 달력: 지금 달과 임기 목표
function calendarPage() {
  const m = Math.min(S.month, C.MONTHS), year = Math.min(3, Math.ceil(m / 12)), left = year * 12 - S.month + 1;
  return `<span class="yr">임기 ${year}년 차</span><span class="mo">${m}월</span><span class="term">${S.over ? '임기 종료' : `평가까지 ${left}개월`}</span>`;
}
export function calendarHtml() {
  const year = Math.min(3, Math.ceil(Math.min(S.month, C.MONTHS) / 12)), T = TARGETS[year - 1];
  const goals = `<div class="tablewrap"><table class="stats"><tr><th>${year}년 차 목표 · 제${year * 12}월 말 평가</th><th>목표</th><th>지금</th></tr>${evalItems(T).map(i => `<tr><td>${i.label}</td><td>${i.target}</td><td class="${i.ok ? 'ok' : 'ng'}">${i.actual}</td></tr>`).join('')}</table></div>
    <p class="dim" style="font-size:12px;margin:6px 0 0">5개 중 4개 이상이면 우수(보조금), 1개 이하면 미흡. 미흡이 두 번이면 소환됩니다.</p>`;
  const past = S.evals.length ? rows(S.evals.map(e => [`${e.year}년 차 평가 (제${e.month - 1}월 말)`, e.grade])) : '<p class="dim">아직 받은 평가가 없습니다.</p>';
  return `<article class="doc"><header><div><div class="kind">임기 달력</div><h3>제${Math.min(S.month, C.MONTHS)}월 · 임기 ${C.MONTHS}개월 중 ${Math.min(S.month, C.MONTHS)}개월째</h3></div></header>${goals}</article>
    <article class="doc"><header><div><div class="kind">지난 평가</div><h3>수도의 평가 기록</h3></div></header>${past}</article>`;
}

export function renderDesk() {
  renderDeskBudget();
  const page = $('cal-page'); if (page) page.innerHTML = calendarPage();
  const fresh = freshTabs();
  TABS.forEach(t => {
    const b = $('tab-' + t); if (!b) return;
    const pin = b.querySelector('.pin'), on = fresh[t] > 0 && !S.seenTabs[t + S.month];
    if (pin) { pin.hidden = !on; pin.textContent = t === 'docs' ? `새 서류 ${fresh[t]}` : t === 'news' ? (latestIsExtra() ? '호외' : '새 호') : '새 소식'; }
    b.classList.toggle('fresh', on && t === 'docs');
  });
  $('stamp').disabled = !!S.over || busy;
}

// ---------- 집어 든 서류 ----------
let open: string | null = null, opener: HTMLElement | null = null;
export const readerKey = () => open;

export function renderReader(flash = false) {
  if (!open) return;
  const isBudget = open === 'budget';
  $('panel').hidden = isBudget; $('budget-editor').hidden = !isBudget;
  $('held').classList.toggle('narrow', isBudget || open === 'calendar');
  if (isBudget) syncBudget();
  else if (open === 'calendar') $('panel').innerHTML = calendarHtml();
  else if (open === 'news') { S.seenTabs['news' + S.month] = 1; $('panel').innerHTML = renderNewsTab(); }
  else { S.tab = open; renderPanel(flash); }
}
export function openReader(key: string, from?: HTMLElement) {
  if (key === 'news' && open !== 'news') showIssue(null);
  open = key; opener = from || null;
  $('reader').hidden = false;
  renderReader(true);
  renderDesk();
  $('held').scrollTop = 0; $('held').focus();
}
export function closeReader(restoreFocus = true) {
  if (!open) return;
  open = null; $('reader').hidden = true;
  renderDesk();
  if (restoreFocus && opener) opener.focus();
}

// ---------- 도장으로 결재 ----------
let busy = false;
function say(t: string) {
  const el = $('toast'); el.textContent = t; el.classList.add('show');
  clearTimeout((say as any).t); (say as any).t = setTimeout(() => el.classList.remove('show'), 3200);
}
export function approve() {
  if (busy || S.over) return;
  busy = true; closeReader(false); $('stamp').disabled = true;
  const sheet = $('desk-budget'), page = $('cal-page'), fast = reduced();
  const t0 = S.treasury, m0 = S.month;
  sheet.classList.remove('arriving'); sheet.classList.add('stamped');
  setTimeout(() => {
    sheet.classList.add('leaving');
    page.classList.remove('flip'); void page.offsetWidth; page.classList.add('flip');
  }, fast ? 0 : 800);
  setTimeout(async () => {
    resolve(); S.guideDraft = {}; S.bookView = 'last';
    sheet.classList.remove('stamped', 'leaving');
    render(false);
    // 금고는 귀환 보고가 끝날 때 올라가도록 잠시 결재 전 숫자로 둔다
    const st = $('st-treasury'); if (st) st.textContent = `${fmt(t0)}G`;
    sheet.classList.add('arriving');
    await playMoments(t0);
    busy = false; renderDesk();
    const n = freshTabs().docs;
    say(`제${m0}월 예산안을 결재했습니다 · 금고 ${sgn(S.treasury - t0)}G${n ? ` · 서류함에 새 서류 ${n}건` : ''}`);
    // 임기가 끝나면 평가서부터, 아니면 이달 신문이 책상 위로 날아온다
    if (S.over) openReader('docs', $('tab-docs'));
    else { showIssue(null, !fast); open = 'news'; opener = $('tab-news'); $('reader').hidden = false; renderReader(); renderDesk(); $('held').scrollTop = 0; $('held').focus(); }
  }, fast ? 0 : 1250);
}
