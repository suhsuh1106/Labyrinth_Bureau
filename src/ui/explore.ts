// 탐사 기록 탭
import { C, CLASSES, GEARS, KEYS, SRC } from '../core/data';
import { guideKeys, nextCycle, onTrail, partyCount, pools, satisfies, supply } from '../core/explore';
import { doc, rows } from '../core/html';
import { S } from '../core/state';
import { fmt, josa, keyLabel, keyWord, pct, sgn } from '../core/util';
import { done } from '../core/world';

export function trustWord() { const t = S.trust; return t < 30 ? '용병들이 이 미궁을 꺼림' : t < 45 ? '용병들이 반신반의함' : t < 60 ? '용병들의 평판 보통' : t < 75 ? '용병들이 기대를 품음' : '용병들이 몰려들고 있음'; }

export function hypo(f, key) {
  const rec = S.exped.filter(e => e.f === f && e.m >= S.month - 3);
  const a = rec.filter(e => satisfies(key, e)), o = rec.filter(e => !satisfies(key, e));
  const r = arr => !arr.length ? '-' : arr.length < C.MIN_SAMPLE ? '표본 부족' : pct(arr.filter(e => e.s).length / arr.length);
  return `<div class="memo" style="padding:10px 14px"><div class="memo-head">가설 검토 · 최근 3개월 ${f + 1}층 기록</div>
    <div class="tablewrap"><table class="stats"><tr><th>파티</th><th>수</th><th>성공률</th></tr>
    <tr><td>${keyLabel(key)}</td><td>${a.length}</td><td>${r(a)}</td></tr>
    <tr><td>그렇지 않은 파티</td><td>${o.length}</td><td>${r(o)}</td></tr></table></div></div>`;
}

export function adoptLine(f) {
  const rec = S.exped.filter(e => e.f === f && e.m === S.month - 1 && !e.h);
  if (!rec.length) return '';
  const a = rec.filter(e => e.a), o = rec.filter(e => !e.a);
  const r = arr => arr.length ? pct(arr.filter(e => e.s).length / arr.length) : '-';
  const sh = rec.filter(e => e.sh).length, want = a.length + sh;
  const exp = S.last && S.last.adopt != null ? ` <span class="dim">(지원금 ${fmt(S.last.b.support)}G 기준 기대 ${pct(S.last.adopt)})</span>` : '';
  const fl = S.floors[f], what = fl.guide.startsWith('c:') ? fl.guide.slice(2) : `${fl.guide.slice(2)} 장비`;
  const lever = !fl.guide.startsWith('c:') ? '예산안의 장비 대여로 늘릴 수 있어요' : fl.guide === 'c:사제' ? '교회에 사제 파견을 요청해 늘릴 수 있어요' : '예산안의 직업 장려금으로 불러올 수 있어요';
  return `<p style="margin:0;font-size:13px">지난달 공략본을 따르려던 파티 <b>${want}/${rec.length}개</b>${exp} · 그중 실제로 편성한 파티 <b>${a.length}개</b> (성공 ${r(a)}) · 따르지 않은 파티 성공 ${r(o)}</p>
    ${sh ? `<p class="ng" style="margin:0;font-size:12px">${what}${josa(what)} 모자라 ${sh}개 파티가 공략본대로 못 꾸렸어요. ${lever}</p>` : ''}`;
}

export function sayList(fl) {
  if (!fl.say.length) return `<p class="dim" style="margin:0">아직 모인 증언이 없습니다. 증언은 그 조건을 실제로 데려간 파티에서만 나옵니다 (지금까지 ${fl.n}개 파티).</p>`;
  const li = x => `<li><span class="num">${x.m}월</span> <span class="src src-${x.src}">${SRC[x.src]}</span> "${x.t}"</li>`;
  const recent = fl.say.slice(-4).reverse(), old = fl.say.slice(0, -4).reverse();
  return `<ul class="feed">${recent.map(li).join('')}</ul>${old.length ? `<details><summary style="cursor:pointer;font-size:12px">지난 증언 ${old.length}건</summary><ul class="feed">${old.map(li).join('')}</ul></details>` : ''}`;
}

// 세 겹의 비밀 중 알아낸 것과, 다음 겹으로 가는 실마리
export function secretRows(fl, i) {
  const H = fl.mon.habit;
  const habit = !fl.habitKnown ? '<span class="unknown">아직 모름 · 놈들이 유난히 사나운 때가 있는지 지켜보세요</span>'
    : H.k === 'cycle' ? `${H.label}마다 사나워져요. 다음은 제${nextCycle(fl)}월 · 알고 대비해 사망이 줄었어요. 그달엔 입장료로 파티를 돌릴 수 있어요`
    : H.k === 'crowd' ? `파티가 ${C.CROWD_N}개를 넘게 몰리면 사나워져요 · 알고 대비해 사망이 줄었어요. 입장료로 파티를 흩을 수 있어요`
    : `공략본에 ${keyWord(H.pk)}까지 갖추면 훨씬 잘 통해요 · 공략본을 따르는 파티가 함께 구하고, 수급 줄로 늘릴 수 있어요`;
  const root = done('seal' + i) ? '봉인함' : done('mine' + i) ? '채굴 중' : fl.root ? '찾음 · 개척 시설 탭에서 봉인하거나 채굴장을 낼 수 있어요'
    : fl.habitKnown ? `<span class="unknown">아직 못 찾음 · 맞는 공략본이 서 있어야 해요${rootNeeds(fl).length ? `. 그 밖에 더 필요한 것: ${rootNeeds(fl).join(', ')}` : '. 나머지는 갖춰졌어요'}</span>`
    : '<span class="unknown">습성을 알아내면 실마리가 보여요</span>';
  return `<p class="secret-row"><b>습성</b> ${habit}</p><p class="secret-row"><b>근원</b> ${root}</p>`;
}

// 공략본이 맞는지는 여기서 알려 주지 않는다 (적응을 눈치채는 것도 플레이어 몫)
export const rootNeeds = fl => [fl.wins >= 30 ? null : `이 층 성공 30번 (지금 ${fl.wins}번)`, done('mapper') || done('camp') ? null : '지도 제작소나 전진 야영지'].filter(Boolean);

export function trialDoc() {
  const T = S.trial || {}, L = S.last && S.last.ex.trial;
  const res = L && L.n ? (() => {
    const rec = S.exped.filter(e => e.f === L.f && e.m === S.last.month && !e.t && !e.h), r = rec.length ? rec.filter(e => e.s).length / rec.length : null;
    return `<p style="margin:0">지난달 ${L.f + 1}층 · ${keyWord(L.key)} 시험 파티 <b>${L.n}개</b> 중 성공 <b>${L.w}개 (${pct(L.w / L.n)})</b>${L.d ? ` · 사망 ${L.d}명` : ''} · 같은 층 다른 파티 성공 ${r == null ? '-' : pct(r)}</p>`;
  })() : '';
  return doc({ kind: '관리국 시험반', title: '시험 탐사 의뢰', from: `파티당 ${fmt(C.TRIAL_COST)}G`,
    body: `<p class="from">궁금한 조건을 갖춘 파티를 관리국 돈으로 보내 결과를 받아 봅니다. 사람과 장비는 관리국이 구해 주고, 그 층에 공략본이 있으면 공략본대로도 갖춰요. 파티 수는 예산안의 <b>시험 탐사비</b>로 정해요.</p>
      ${res}
      <div class="guide">
        <label for="t-f" class="dim">층</label>
        <select id="t-f" data-trial="f">${S.floors.slice(0, S.unlocked).map((_, i) => `<option value="${i}" ${i === T.f ? 'selected' : ''}>${i + 1}층</option>`).join('')}</select>
        <label for="t-k" class="dim">조건</label>
        <select id="t-k" data-trial="key"><option value="">고르기</option>${KEYS.map(k => `<option value="${k}" ${k === T.key ? 'selected' : ''}>${keyLabel(k)}</option>`).join('')}</select>
        ${S.trial ? '<button type="button" class="btn ghost" data-action="trial-stop">시험 그만두기</button>' : ''}
      </div>` });
}

export function floorEconomy() {
  const L = S.last;
  if (!L) return '';
  const rowsHtml = S.floors.slice(0, S.unlocked).map((fl, i) => {
    const bf = L.ex.byFloor[i] || { n: 0, w: 0, d: 0, got: 0, crowd: 1 };
    const crowd = bf.crowd < 1 ? `<span class="ng">${pct(1 - bf.crowd)} 줄어듦</span>` : '<span class="dim">여유</span>';
    const fee = (L.fees || [])[i] || 0;
    return `<tr><td>${i + 1}층</td><td>${fee ? sgn(fee) : '<span class="dim">0</span>'}</td><td>${bf.n}</td><td>${bf.n ? pct(bf.w / bf.n) : '-'}</td><td>${fmt(bf.got)}</td><td>${crowd}</td><td>${bf.d}</td><td>${fmt(fl.lootTotal || 0)}</td></tr>`;
  }).join('');
  return doc({ kind: '재무과 · 층별 수익', title: `제${L.month}월 층별 탐사 수익`, from: `층당 파티 ${C.FLOOR_CAP}개가 넘으면 전리품이 나뉘어요`,
    body: `<div class="tablewrap"><table class="stats"><tr><th>층</th><th>입장료</th><th>파티</th><th>성공률</th><th>전리품 수익</th><th>붐빔</th><th>사망</th><th>누적 수익</th></tr>${rowsHtml}</table></div>
      <p class="from">용병들은 층마다 기대 전리품, 사망 위험, 지난달 붐빔, 입장료를 따져 갈 곳을 고릅니다. 개척은 가장 깊은 층에서만 진행되니, 예산안의 층별 입장료로 파티를 원하는 층에 보내세요.</p>` });
}

export function supplyDoc() {
  const sup = supply(S.budget), pl = pools(sup), need = guideKeys();
  const cl = CLASSES.map((c, i) => {
    const k = 'c:' + c, nd = need.includes(k);
    const extra = c === '사제' && pl.cls[i] > Math.round(S.cls[i]) ? ` <span class="dim">(파견 포함)</span>` : '';
    return `<tr><td>${nd ? `<b>${c} · 공략본</b>` : c}</td><td>${pl.cls[i]}명${extra}</td><td>${pct(pl.cls[i] / Math.max(1, S.M))}</td></tr>`;
  }).join('');
  const gr = GEARS.slice(1).map((g, j) => {
    const k = 'g:' + g, nd = need.includes(k);
    return `<tr><td>${nd ? `<b>${g} 장비 · 공략본</b>` : `${g} 장비`}</td><td>${pl.gear[j + 1]}벌</td><td></td></tr>`;
  }).join('');
  return doc({ kind: '현장 사무소 · 수급', title: '직업과 장비 수급', from: `이번 달 파티 약 ${partyCount()}개`,
    body: `<div class="tablewrap"><table class="stats"><tr><th>구분</th><th>쓸 수 있는 수</th><th>용병 중 비율</th></tr>${cl}${gr}</table></div>
      <p class="from">공략본이 필요하다고 해도 사람과 장비가 없으면 따를 수 없습니다. 장비는 상단에서 빌리고, 사제는 교회에 파견을 요청하고, 나머지 직업은 장려금으로 불러옵니다.</p>` });
}

export function renderExploreTab() {
  const out = [];
  const L = S.last;
  out.push(doc({ kind: '용병 동향', title: trustWord(), from: `용병 ${S.M}명`,
    body: rows([
      ['지난달 출발 / 성공', L ? `${L.ex.n} / ${L.ex.wins}개 파티 (${pct(L.ex.wins / Math.max(1, L.ex.n))})` : '-'],
      ['지난달 새로 온 용병 / 떠난 용병', L ? `${L.arrive} / ${L.leave + L.deaths}명 (사망 ${L.deaths})` : '-'],
    ]) + `<p class="from">공략이 잘 맞고 성공이 쌓이면 소문이 나서 용병이 늘어납니다. 사망이 잦으면 떠납니다.</p>` }));

  const floors = S.floors.map((fl, i) => {
    if (i >= S.unlocked) return `<div class="floor-row"><div class="floor-meta"><b>${i + 1}층</b><span class="unknown">아직 열리지 않음</span></div></div>`;
    const who = fl.known >= 2 ? `용병들은 '${fl.mon.name}'(이)라 부름` : '정체 미확인';
    const pending = S.pendingGuide && S.pendingGuide.f === i;
    const draft = S.guideDraft[i] || fl.guide || '';
    const guideState = pending ? `<b>발간 예정:</b> "${keyLabel(S.pendingGuide.key)}" (다음 결재 때 ${fmt(C.GUIDE_FEE)}G)` : fl.guide ? `현재 공략본: "${keyLabel(fl.guide)}"` : '공략본 없음';
    return `<div class="floor-row">
      <div class="floor-meta"><b>${i + 1}층</b><span class="${fl.known ? '' : 'unknown'}">${who}</span><span class="num">개척 ${Math.round(fl.prog)}%${fl.heroProg ? ` (용사 ${Math.round(fl.heroProg)}%)` : ''}</span></div>
      ${onTrail(i) ? `<p class="secret-row"><b>용사의 길</b> 용사 파티가 먼저 길을 냈어요. 제${fl.trail}월까지 용병이 몰리고 사망이 줄어요</p>` : ''}
      <div class="bar-track"><span style="width:${fl.prog}%"></span></div>
      ${sayList(fl)}
      ${secretRows(fl, i)}
      ${draft ? hypo(i, draft) : ''}
      ${fl.guide ? adoptLine(i) : ''}
      <div class="floor-meta"><span>${guideState}</span></div>
      <div class="guide">
        <label for="g-${i}" class="dim">공략 지침</label>
        <select id="g-${i}" data-floor="${i}">
          <option value="">고르기</option>
          ${KEYS.map(k => `<option value="${k}" ${k === draft ? 'selected' : ''}>${keyLabel(k)}</option>`).join('')}
        </select>
        ${pending ? `<button type="button" class="btn ghost" data-action="cancel-guide">발간 취소</button>` : `<button type="button" class="btn" data-action="guide" data-floor="${i}">${fl.guide ? '공략본 개정' : '공략본 발간'} (${fmt(C.GUIDE_FEE)}G)</button>`}
      </div>
    </div>`;
  }).join('<hr style="border:none;border-top:1px solid var(--rule);margin:6px 0">');
  if (S.anoms.length) out.push(doc({ cls: 'secret', kind: '현장 사무소 · 이상 징후', title: '미궁이 이상합니다', from: `${S.anoms.length}건`,
    body: `<ul class="feed">${S.anoms.map(a => `<li><span class="num">${a.m}월</span> ${a.t}</li>`).join('')}</ul>${S.overflow ? `<p class="ng">제${S.overflow.m}월 소규모 범람 · 용병 ${S.overflow.deaths}명 사망</p>` : ''}` }));
  out.push(trialDoc());
  out.push(floorEconomy());
  out.push(supplyDoc());
  out.push(doc({ kind: '미궁 개척 현황', title: '층별 개척과 공략본', from: '가장 깊은 층만 개척이 진행됩니다', body: `<div style="display:grid;gap:10px">${floors}</div>` }));

  // 통계
  const f = Math.min(S.statFloor, S.unlocked - 1);
  const minM = S.statRange === 0 ? 0 : S.month - S.statRange;
  const rec = S.exped.filter(e => e.f === f && e.m >= minM);
  const rateCell = (arr) => { if (!arr.length) return '<span class="dim">-</span>'; if (arr.length < C.MIN_SAMPLE) return '<span class="dim">표본 부족</span>'; const r = arr.filter(e => e.s).length / arr.length; return `<span class="rate"><i style="width:${Math.round(r * 40)}px"></i>${pct(r)}</span>`; };
  let body = `<div class="controls">
      <label for="sf">층</label><select id="sf" data-stat="floor">${S.floors.slice(0, S.unlocked).map((_, i) => `<option value="${i}" ${i === f ? 'selected' : ''}>${i + 1}층</option>`).join('')}</select>
      <label for="sr">기간</label><select id="sr" data-stat="range">${[[1, '지난달'], [3, '최근 3개월'], [0, '전체']].map(([v, t]) => `<option value="${v}" ${v === S.statRange ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <span class="dim">파티 ${rec.length}개 · 성공률 ${rec.length ? pct(rec.filter(e => e.s).length / rec.length) : '-'}</span>
    </div>`;
  if (!rec.length) body += `<p class="dim">이 기간에 이 층을 탐사한 파티가 없습니다.</p>`;
  else {
    let t = `<details ${S.statOpen ? 'open' : ''}><summary data-action="stat-toggle" style="cursor:pointer;font-size:13px">전체 통계표 펼치기</summary><div class="tablewrap"><table class="stats"><tr><th>조건</th><th>해당 파티</th><th>성공률</th><th>해당 없는 파티</th><th>성공률</th></tr>`;
    t += `<tr class="grp"><td colspan="5">파티 구성 (한 명 이상 포함)</td></tr>`;
    CLASSES.forEach(c => { const a = rec.filter(e => e.c.includes(c)), o = rec.filter(e => !e.c.includes(c)); t += `<tr><td>${c}</td><td>${a.length}</td><td>${rateCell(a)}</td><td>${o.length}</td><td>${rateCell(o)}</td></tr>`; });
    t += `<tr class="grp"><td colspan="5">주 장비</td></tr>`;
    GEARS.forEach(g => { const a = rec.filter(e => e.g === g), o = rec.filter(e => e.g !== g); t += `<tr><td>${g}</td><td>${a.length}</td><td>${rateCell(a)}</td><td>${o.length}</td><td>${rateCell(o)}</td></tr>`; });
    t += `</table></div></details>`;
    body += t;
    const recent = rec.slice(-8).reverse();
    body += `<p class="dim" style="margin:6px 0 0;font-size:12px">${C.MIN_SAMPLE}개 파티가 안 되는 칸은 표본 부족으로 가려요. 드문 조건은 시험 탐사로 표본을 모으세요.</p><p class="from" style="margin-top:12px">최근 파티 기록</p><div class="tablewrap"><table class="stats"><tr><th>월</th><th>구성</th><th>장비</th><th>결과</th></tr>${recent.map(e => `<tr><td>${e.m}월</td><td style="font-family:var(--f-body)">${e.t ? '<b>시험</b> ' : e.h ? '<b>용사</b> ' : ''}${e.c.join('·')}</td><td style="font-family:var(--f-body)">${e.g}</td><td class="${e.s ? 'ok' : 'ng'}" style="font-family:var(--f-body)">${e.s ? '성공' : '후퇴'}</td></tr>`).join('')}</table></div>`;
  }
  out.push(doc({ kind: '통계과 보고', title: `${f + 1}층 파티 통계`, from: '가설을 확인할 때 쓰세요', body }));
  return out.join('');
}
