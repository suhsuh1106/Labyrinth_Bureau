// 개척 시설 탭
import { doc, rows } from '../core/html';
import { S } from '../core/state';
import { fmt } from '../core/util';
import { allFacs, facUpkeep } from '../core/world';

export function renderBuildTab() {
  const up = facUpkeep();
  const cards = allFacs().map(fa => {
    const st = S.fac[fa.id];
    const state = !st ? '착공 전' : st.state === 'pending' ? '다음 결재 때 착공' : st.state === 'building' ? `공사 중 · ${st.left}개월 남음` : '운영 중';
    const blocked = fa.excl && S.fac[fa.excl];
    const btn = S.over ? '' : !st && blocked ? `<span class="dim">${allFacs().find(x => x.id === fa.excl).name}과(와) 함께 둘 수 없어요</span>` : !st ? `<button type="button" class="btn" data-action="build" data-fac="${fa.id}">착공 (${fmt(fa.cost)}G)</button>`
      : st.state === 'pending' ? `<button type="button" class="btn ghost" data-action="cancel-build" data-fac="${fa.id}">착공 취소</button>` : '';
    return doc({ cls: st && st.state === 'done' ? '' : 'secret', kind: '개척 시설', title: fa.name, from: state,
      body: rows([
        ['착공비 (목돈)', `${fmt(fa.cost)}G`],
        ['공사 기간', `${fa.months}개월`],
        ['완공 뒤 유지비', fa.upkeep ? `매달 ${fmt(fa.upkeep)}G` : '없음'],
      ]) + `<p>${fa.effect}</p><p class="from">서기의 귀띔: ${fa.hint}</p>${btn ? `<div class="guide">${btn}</div>` : ''}` });
  }).join('');
  return `<div class="memo">시설은 착공비를 한 번에 내고, 공사가 끝나면 매달 유지비가 나갑니다. 착공 소식이 퍼지는 순간 세력들이 반응합니다. 지금 매달 나가는 유지비는 ${fmt(up)}G입니다.</div><div class="grid2">${cards}</div>`;
}
