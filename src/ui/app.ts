// 화면 전체 그리기와 시작
import { loadGame } from '../core/save';
import { leadText, renderDesk, renderReader } from './desk';
import { C } from '../core/data';
import { prices } from '../core/economy';
import { S } from '../core/state';
import { fmt } from '../core/util';
import { founding } from '../core/founding';
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
    <div class="stat"><span>금고</span><b id="st-treasury" class="${S.treasury < 0 ? 'neg' : ''}">${fmt(S.treasury)}G</b></div>
    ${founding() && S.fund > 0 ? `<div class="stat"><span>영주 개척 자금</span><b>${fmt(S.fund)}G</b></div>` : ''}
    <div class="stat"><span>용병</span><b>${S.M}명</b></div>
    <div class="stat"><span>개척</span><b>${S.unlocked}층 ${Math.round(S.floors[S.unlocked - 1].prog)}%</b></div>
    <div class="stat"><span>명성</span><b>${Math.round(S.fame)}</b></div>
    <div class="stat"><span>포션 단가 상단 · 교회</span><b>${P.m} · ${P.c}G</b></div>`;
}

// 집어 든 서류 안쪽: 지금 고른 물건(S.tab)의 내용을 그린다. 펼쳐 본 물건은 이번 달 새 소식 표시를 끈다
export function renderPanel(flash) {
  S.seenTabs[S.tab + S.month] = 1;
  const el = $('panel');
  el.innerHTML = S.tab === 'books' ? renderBooksTab() : S.tab === 'build' ? renderBuildTab() : S.tab === 'hero' ? renderHeroTab() : S.tab === 'faction' ? renderFactionTab() : S.tab === 'explore' ? renderExploreTab() : renderDocsTab();
  if (flash) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
}

export function render(flash = true) {
  if (lineSig() !== S._sig) buildLines();
  renderStats();
  $('b-title').textContent = S.over ? '임기 종료' : `제${S.month}월 예산안`;
  $('b-lead').textContent = leadText() + (S.over ? '' : ' · 결재하면 한 달이 흐릅니다');
  $('approve').disabled = !!S.over;
  syncBudget();
  renderReader(flash);
  renderDesk();
}

export function start(data) {
  loadGame(data);
  buildLines(); render();
}
