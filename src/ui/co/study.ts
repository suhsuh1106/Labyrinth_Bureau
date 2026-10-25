// 영주청 조사 의뢰: 판 위 띠의 진행 칸(●●○), 의뢰서 시트(단계마다 조건 · 상금 · 우리 진행), 게시판의 카드.
// 기록을 읽어 보여 주기만 한다. 상태를 쓰지 않고 난수도 쓰지 않는다 (내는 것은 core의 submitStudy)
import { CO, FLOORS, type Study, type World, studiesOpen, studyBy, studyCan, studyDone } from '../../core/company';
import { DEX } from '../../core/dex';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const STEP = ['목격', '전적', '약점'];
const pips = (d: number, can: number) => [1, 2, 3].map(s => `<i class="${s <= d ? 'on' : s <= can ? 'can' : ''}"></i>`).join('');
// 다음 단계까지 (숫자로)
function nextOf(W: World, S: Study) {
  const d = studyDone(S, 0), D = (W.dex || {})[S.mon];
  return d === 0 ? '다음 목격 · 만나기' : d === 1 ? `다음 전적 · 이해도 ${Math.floor(D ? D.u : 0)}/${DEX.REC_AT}` : d === 2 ? '다음 약점 · 단장 조사' : '다 냄';
}
// 그 단계 상금 (이미 남이 냈으면 STUDY_LATE배)
const payOf = (S: Study, s: number, i = 0) => { const by = studyBy(S, s), first = !by.length || by[0] === i; return Math.round(CO.STUDY_PAY[s - 1] * (first ? 1 : CO.STUDY_LATE)); };

// 판 위 띠: 아직 다 내지 않은 의뢰 하나 (낼 수 있는 것부터)
export function studyChip(W: World) {
  const SS = studiesOpen(W).filter(S => studyDone(S, 0) < 3), S = SS.find(x => studyCan(W, x) > studyDone(x, 0)) || SS[0];
  if (!S) return '';
  const d = studyDone(S, 0), can = studyCan(W, S), ready = can > d;
  return `<button type="button" class="bs-study${ready ? ' ready' : ''}" data-act="study" data-id="${S.id}" aria-label="영주청 ${esc(S.mon)} 조사 보고서 ${d}/3단계">
    <span class="by">영주청</span><span class="nm">${esc(S.mon)} 보고서</span><span class="pips" aria-hidden="true">${pips(d, can)}</span><b>${ready ? `${can}단계 낼 수 있음` : nextOf(W, S)}</b></button>`;
}

// 의뢰서 시트
export function studySheet(W: World, S: Study, book: boolean) {
  const d = studyDone(S, 0), can = studyCan(W, S), D = (W.dex || {})[S.mon];
  const cond = [`${esc(S.mon)}${D && D.n ? ` · 마주침 ${D.n}번` : ''}`, `이해도 ${DEX.REC_AT} · 지금 ${Math.floor(D ? D.u : 0)}`, '약점 확정 (단장 조사)'];
  const rows = [1, 2, 3].map(s => {
    const by = studyBy(S, s), mine = s <= d, first = by[0] === 0;
    const st = mine ? `<b class="pos">냄${first ? ' · 1착' : ''}</b>` : s <= can ? '<b class="pos">낼 수 있음</b>' : '';
    return `<li class="${mine ? 'done' : s <= can ? 'can' : ''}"><div class="h"><b>${s} ${STEP[s - 1]}</b><span>${cond[s - 1]}</span>${st}</div>
      <p>상금 <b>${payOf(S, s)}G</b> · 명성 ${CO.STUDY_FAME[s - 1]}${s === 3 ? ' · 회계관 신뢰' : ''}${by.length && !first ? ` · <span class="neg">${by.length}곳 먼저 냄</span>` : by.length ? '' : ' · 낸 곳 없음'}</p></li>`;
  }).join('');
  return `<h2>${esc(S.mon)} 조사 보고서 <small>영주청 · ${FLOORS[S.f].name} · ${S.until}월 마감</small><button type="button" class="x" data-act="bs-close" aria-label="닫기">×</button></h2>
    <ol class="study-l">${rows}</ol>
    <p class="note">단계마다 먼저 낸 곳이 상금 전부 · 늦으면 ×${CO.STUDY_LATE} · 그믐에 받음</p>
    <div class="acts">${can > d ? `<button type="button" class="seal" data-act="study-go" data-id="${S.id}">${can}단계까지 내기</button>` : ''}${book ? `<button type="button" class="ghost" data-act="study-dex" data-mon="${esc(S.mon)}">도감</button>` : ''}</div>`;
}

// 게시판 카드 (열린 의뢰마다 한 장)
export function studyCards(W: World) {
  return studiesOpen(W).map(S => {
    const d = studyDone(S, 0), can = studyCan(W, S);
    return `<article class="job"><div class="job-h"><span class="who lord">영주</span><b>${esc(S.mon)} 조사 보고서</b><span class="due">${S.until}월 마감 · ${S.until - W.month + 1}달 남음</span></div>
      <div class="job-sum">상금 ${CO.STUDY_PAY.join(' · ')}G · ${FLOORS[S.f].name} · 목격 · 전적 · 약점 · 늦으면 ×${CO.STUDY_LATE}</div>
      <div class="prog"><p><span class="bs-pips">${pips(d, can)}</span> 우리 ${d}단계${can > d ? ` · <b class="pos">${can}단계 낼 수 있음</b> <button type="button" class="mini" data-act="study-go" data-id="${S.id}">내기</button>` : ` · ${nextOf(W, S)}`}</p></div></article>`;
  }).join('');
}
