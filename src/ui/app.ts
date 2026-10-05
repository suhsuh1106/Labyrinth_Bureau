// 화면 전체 그리기와 시작
import { loadGame } from '../core/save';
import { C } from '../core/data';
import { prices, project } from '../core/economy';
import { partyCount } from '../core/explore';
import { founding } from '../core/founding';
import { S, newGame } from '../core/state';
import { fmt } from '../core/util';
import { renderBooksTab } from './books';
import { buildLines, lineSig, syncBudget } from './budget';
import { renderBuildTab } from './build';
import { renderDocsTab } from './docs';
import { renderExploreTab } from './explore';
import { renderFactionTab } from './faction';
import { renderHeroTab } from './hero';

// 화면 요소는 입력값(value)과 상태(disabled, open)를 바로 다루므로 느슨하게 받는다
const $ = (id: string): any => document.getElementById(id);

export function renderStats() {
  const P = prices();
  $('stats').innerHTML = `
    <div class="stat"><span>현재</span><b>제${Math.min(S.month, C.MONTHS)}월</b></div>
    <div class="stat"><span>금고</span><b class="${S.treasury < 0 ? 'neg' : ''}">${fmt(S.treasury)}G</b></div>
    <div class="stat"><span>용병</span><b>${S.M}명</b></div>
    <div class="stat"><span>개척</span><b>${S.unlocked}층 ${Math.round(S.floors[S.unlocked - 1].prog)}%</b></div>
    <div class="stat"><span>명성</span><b>${Math.round(S.fame)}</b></div>
    <div class="stat"><span>포션 단가 상단 · 교회</span><b>${P.m} · ${P.c}G</b></div>`;
}

export function renderPanel(flash) {
  ['docs', 'faction', 'explore', 'hero', 'build', 'books'].forEach(t => {
    const b = $('tab-' + t);
    b.setAttribute('aria-selected', S.tab === t ? 'true' : 'false');
    const fresh = t === 'docs' && (S.agenda || (S.intel && S.intel.month === S.month) || S.offers.length || S.eventDocs.some(d => d.month === S.month)) ? true : t === 'build' ? S.log.some(e => e.m === S.month - 1 && /완공/.test(e.t)) : t === 'docs' ? (S.notices.length || S.ledgers || S.talk) : t === 'faction' ? S.archive.some(a => a.m === S.month && a.who !== 'other') : t === 'hero' ? S.log.some(e => e.m === S.month - 1 && /용사/.test(e.t)) || (!S.hero && S.heroApps.some(a => a.m === S.month)) : S.log.some(e => e.m === S.month - 1 && /층/.test(e.t));
    b.innerHTML = { docs: '서류함', faction: '세력 동향', explore: '탐사 기록', hero: '용사 파티', build: '개척 시설', books: '수입·지출' }[t] + (fresh && S.tab !== t && !S.seenTabs[t + S.month] ? '<span class="badge">새 소식</span>' : '');
  });
  S.seenTabs[S.tab + S.month] = 1;
  const el = $('panel');
  el.innerHTML = S.tab === 'books' ? renderBooksTab() : S.tab === 'build' ? renderBuildTab() : S.tab === 'hero' ? renderHeroTab() : S.tab === 'faction' ? renderFactionTab() : S.tab === 'explore' ? renderExploreTab() : renderDocsTab();
  if (flash) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
}

export function render(flash = true) {
  if (lineSig() !== S._sig) buildLines();
  renderStats(); renderPanel(flash);
  $('b-title').textContent = S.over ? '임기 종료' : `제${S.month}월 예산안`;
  $('b-lead').textContent = S.over ? '서류함의 평가서를 확인하세요.' : founding() ? `개척기 · 용병 ${S.M}명 · 파티 약 ${partyCount()}개 · 필요한 포션 ${S.M * C.NEED}병${S.unsold ? ` · 팔지 못한 전리품 ${fmt(S.unsold)}G어치` : ''} · 결재하면 한 달이 흐릅니다` : `용병 ${S.M}명 · 파티 약 ${partyCount()}개 · 필요한 포션 ${S.M * C.NEED}병 · 결재하면 한 달이 흐릅니다`;
  $('approve').disabled = !!S.over;
  syncBudget();
}

export function start(data) {
  loadGame(data);
  buildLines(); render();
}
