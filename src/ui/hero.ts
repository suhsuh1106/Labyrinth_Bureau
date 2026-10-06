// 용사 파티 탭
import { AMB, C, ORIGIN } from '../core/data';
import { fameWord, heroBase, heroDemand, heroPicks, heroPlan, pubMul } from '../core/hero';
import { doc, rows } from '../core/html';
import { S } from '../core/state';
import { clamp, fmt, pct, sgn } from '../core/util';

export function heroTable(list, btn) {
  return `<div class="tablewrap"><table class="stats"><tr><th>이름</th><th>직업</th><th>실력</th><th>몸값</th><th>출신</th><th>야심</th>${btn ? '<th></th>' : ''}</tr>${list.map(m => `<tr>
    <td>${m.name}</td><td style="font-family:var(--f-body)">${m.cls}</td><td>${m.skill}</td><td>${fmt(m.pay)}G</td>
    <td style="font-family:var(--f-body)"><span class="src src-${m.origin === 'merc' ? 'merc' : m.origin}">${ORIGIN[m.origin]}</span></td>
    <td class="${m.amb === 2 ? 'ng' : ''}" style="font-family:var(--f-body)">${AMB[m.amb]}</td>
    ${btn ? `<td><button type="button" class="btn ${m.pick ? '' : 'ghost'}" data-action="hero-pick" data-id="${m.id}" aria-pressed="${m.pick}">${m.pick ? '✓ 명단' : '명단에 넣기'}</button></td>` : ''}</tr>`).join('')}</table></div>`;
}

export function renderHeroTab() {
  const out = [], b = S.budget, H = S.hero, plan = heroPlan(b), pm = pubMul(b.heroPub);
  const arr = Math.round((S.fame - C.FAME0) / 10);
  out.push(doc({ kind: '관리국 · 정치적 이미지', title: `명성 ${Math.round(S.fame)} · ${fameWord()}`, from: H ? `용사 파티 ${H.members.length}명` : '용사 파티 없음',
    body: rows([
      ['새로 오는 용병', `매달 ${sgn(arr)}명`],
      ['용병 신뢰', `매달 ${S.fame >= 50 ? '+' : '−'}${Math.abs((S.fame - 50) * 0.02).toFixed(1)}`],
      ['수도 평가', S.fame >= 60 ? (S.fameSaved ? '우수면 보조금 +3,000G' : '미흡이면 한 번 봐줌 · 우수면 보조금 +3,000G') : '60 이상이면 수도가 너그러워져요'],
    ]) + (S.fameLog.length ? `<ul class="feed">${S.fameLog.slice().reverse().map(f => `<li><span class="num">${f.m}월</span> 명성 <b>${sgn(f.v)}</b> · ${f.t}</li>`).join('')}</ul>` : '')
      + `<p class="from">명성은 용사의 승전과 길 개척으로 오르고, 죽음과 해체와 배신으로 떨어집니다. 가만두면 ${C.FAME0}으로 식어요.</p>` }));
  if (H) {
    const base = clamp(heroBase(b), 0.05, 0.92), dem = heroDemand();
    out.push(doc({ kind: '용사 파티', title: H.members.map(m => m.name).join(' · '), from: `제${H.formed}월 결성`,
      body: heroTable(H.members, false) + rows([
        ['사기', `<span class="${H.morale < 30 ? 'ng' : ''}">${Math.round(H.morale)}</span> · 15 아래면 흩어져요`],
        ['몸값 합계 / 후원금', `<span class="${(b.heroPay || 0) < dem ? 'ng' : ''}">${fmt(dem)} / ${fmt(b.heroPay || 0)}G</span>`],
        [`이번 달 원정 (${S.unlocked}층 ${C.HERO_RUNS}번)`, `실력·장비로 본 성공률 ${pct(base)} · 공략 조건이 맞으면 더 올라요`],
        ['지금까지 원정 / 성공', `${H.runs} / ${H.wins}번 · 전리품 ${fmt(H.loot)}G`],
        ['영광', `${Math.round(H.glory)}${H.glory >= 40 ? ' · 이름이 나서 야심 큰 용사는 몸값을 올려요' : ''}`],
        ['먼저 연 층', H.opened.length ? H.opened.map(i => `${i + 1}층`).join(', ') : '아직 없음'],
      ]) + `<p class="from">용사 파티는 늘 가장 깊은 층으로 갑니다. 그 층 개척의 절반 이상을 해내고 길을 열면, 새 층에 용병이 ${C.TRAIL_M}개월 동안 뒤따릅니다. 용사가 남긴 기록은 증언과 통계에 섞여요.</p>` }));
  }
  if (!H || H.members.length < C.HERO_MAX) {
    const apps = S.heroApps, picks = heroPicks();
    const avg = apps.length ? Math.round(apps.reduce((a, m) => a + m.skill, 0) / apps.length) : 0;
    const by = Object.keys(ORIGIN).map(k => `${ORIGIN[k]} ${apps.filter(a => a.origin === k).length}`).join(' · ');
    const status = H ? (picks.length ? (plan.joining ? `${picks.length}명이 결재 때 합류해요` : `후원금이 ${fmt(plan.demand)}G 이상이어야 합류해요`) : `빈자리 ${C.HERO_MAX - H.members.length}개`)
      : picks.length < 2 ? '2명 이상 명단에 넣으면 결성할 수 있어요'
      : plan.forming ? '결재 때 결성돼요' : `후원금을 ${fmt(plan.demand)}G 이상 걸어야 결성돼요`;
    out.push(doc({ kind: '관리국 · 지원자 통계', title: H ? '빈자리를 채울 지원자' : '용사 파티 결성', from: `공고 후원금 ${fmt(b.heroPay || 0)}G`,
      body: (apps.length ? rows([['이번 달 지원자', `${apps.length}명 · 평균 실력 ${avg}`], ['출신', by]]) + heroTable(apps, true)
        : `<p class="dim">${S.heroCool ? `파티가 흩어진 뒤라 ${S.heroCool}개월 동안 지원자가 오지 않아요.` : (b.heroPay || 0) ? '다음 달부터 지원자가 와요.' : '결재함의 용사 후원 방침을 정하면 공고가 걸리고 다음 달부터 지원자가 와요.'}</p>`)
        + `<p><b>${status}</b>${picks.length ? ` · 명단 몸값 합계 ${fmt(picks.reduce((a, m) => a + m.pay, 0))}G` : ''}</p>
        <p class="from">공고 금액이 높고 명성이 높을수록 실력 좋은 지원자가 와요. 교회와 사이가 좋으면 교회 추천이, 상단과 사이가 좋으면 상단 추천이 늘어요. 추천받은 용사는 몸값이 싸지만, 그 세력이 용사의 죽음과 대우를 따로 셈해요. 야심 큰 용사는 강하지만 배신하기 쉬워요.</p>` }));
  }
  if (S.heroFallen.length) out.push(`<div class="memo"><div class="memo-head">떠나거나 쓰러진 용사 ${S.heroFallen.length}명</div><ul class="feed">${S.heroFallen.slice().reverse().map(m => `<li><span class="num">${m.em}월</span> ${m.name} (${m.cls}) · ${m.end}</li>`).join('')}</ul></div>`);
  return out.join('');
}
