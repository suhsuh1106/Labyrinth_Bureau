// 변경 일보: 결재가 끝나면 책상 위로 날아오는 신문. 지난 호도 넘겨 볼 수 있다
import { hasIssue, issue, latestIssue } from '../core/news';
import { S } from '../core/state';

let view: number | null = null;   // 펼쳐 둔 호. null이면 가장 최근 호
let arriving = false;             // 방금 결재해서 새로 날아온 참인가

export function showIssue(m: number | null, fresh = false) { view = m; arriving = fresh; }
export const viewedIssue = () => (view != null && hasIssue(view) ? view : latestIssue());

export function renderNewsTab() {
  const m = viewedIssue();
  const I = m >= 1 ? issue(m) : null;
  if (!I) return `<article class="news empty"><div class="top"><div class="title"><span class="hanja">邊境日報</span><h1>변경 일보</h1></div></div>
    <p class="wait">변경 일보는 매달 말일에 나옵니다. 첫 호는 제1월 예산안을 결재하면 책상 위로 날아옵니다.</p></article>`;
  const anim = arriving ? (I.extra ? ' drop' : ' fold') : '';
  arriving = false;
  const nums = I.figures.map(f => `<tr><td>${f.label}</td><td>${f.value}${f.delta ? ` <span class="${f.dir || ''}">${f.delta}</span>` : ''}</td></tr>`).join('');
  const last = latestIssue();
  const opts = Array.from({ length: last }, (_, i) => last - i).filter(hasIssue)
    .map(n => `<option value="${n}" ${n === m ? 'selected' : ''}>제${n}호</option>`).join('');
  return `<nav class="news-nav" aria-label="지난 호 넘겨 보기">
      <button type="button" data-action="paper" data-m="${m - 1}" ${hasIssue(m - 1) ? '' : 'disabled'}>← 지난 호</button>
      <label><span>호수</span> <select data-paper="pick" aria-label="호수">${opts}</select></label>
      <button type="button" data-action="paper" data-m="${m + 1}" ${hasIssue(m + 1) ? '' : 'disabled'}>다음 호 →</button>
    </nav>
    <article class="news${anim}" aria-label="변경 일보 제${I.no}호">
    <div class="top"><div class="ear">${I.ears[0]}</div>
      <div class="title"><span class="hanja">邊境日報</span><h1>변경 일보</h1></div>
      <div class="ear">${I.ears[1]}</div></div>
    <div class="dateline"><span>제${I.no}호${I.first ? ' · 창간호' : ''}${I.extra ? ' · 호외' : ''}</span><span>${I.date}</span><span>변경 상인 조합 발행</span><span>값 3동전</span></div>
    ${I.extra ? '<div class="extra" aria-label="호외">號外<small>호외</small></div>' : ''}
    <div class="lead"><div>
        <div class="kicker">${I.kicker}</div><h2 class="hed">${I.hed}</h2><p class="dek">${I.dek}</p><div class="byline">${I.by}</div>
        <div class="body">${I.body.map(t => `<p>${t}</p>`).join('')}</div></div>
      <aside>
        <div><div class="box-h">이달의 숫자</div><table>${nums}</table></div>
        ${I.briefs.length ? `<div><div class="box-h">단신</div><ul class="briefs">${I.briefs.map(b => `<li>${b}</li>`).join('')}</ul></div>` : ''}
      </aside></div>
    <div class="lower">${I.lower.map(x => `<section><div class="tag">${x.tag}</div><h4>${x.hed}</h4><p>${x.text}</p></section>`).join('')}</div>
    <div class="ads">${I.ads.map(a => `<div class="ad${a.inv ? ' inv' : ''}"><b>${a.title}</b>${a.text}</div>`).join('')}</div>
  </article>`;
}

// 책상 위 신문 꼭지 표시: 이번 호가 호외인가
export const latestIsExtra = () => { const I = latestIssue() >= 1 ? issue(latestIssue()) : null; return !!(I && I.extra); };
export const issueSeen = () => !!S.seenTabs['news' + S.month];
