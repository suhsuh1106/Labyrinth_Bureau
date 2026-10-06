// 세력 동향 탭
import { LIKES, OFFERS } from '../core/data';
import { fair, prices } from '../core/economy';
import { doc, rows } from '../core/html';
import { S } from '../core/state';
import { fmt } from '../core/util';
import { lineChart } from './charts';
import { ledgerDocC, ledgerDocM } from './docs';

export function attitude(g) { const i = g <= -40 ? 0 : g <= -15 ? 1 : g < 15 ? 2 : g < 45 ? 3 : 4; return `<span class="attitude att-${i}">${['신뢰함', '호의적', '무덤덤', '서운해함', '불만이 큼'][i]}</span>`; }

export function likesOld(who) { const L = LIKES[who]; return `<p class="from" style="margin-top:10px">반기는 것</p><ul class="feed">${L.like.map(x => `<li>${x}</li>`).join('')}</ul><p class="from">싫어하는 것</p><ul class="feed">${L.hate.map(x => `<li>${x}</li>`).join('')}</ul>`; }

export function dealList(who) { const d = Object.keys(S.deals).filter(k => OFFERS[k].who === who); return d.length ? d.map(k => [`진행 중: ${OFFERS[k].title}`, `${S.deals[k].left}개월 남음`]) : []; }

export function feed(who) {
  const list = S.archive.filter(a => a.who === who || a.who === 'both').slice(-8).reverse();
  return list.length ? `<ul class="feed">${list.map(a => `<li><span class="num">${a.m}월</span> ${a.t}</li>`).join('')}</ul>` : '<p class="dim">아직 들려온 이야기가 없습니다.</p>';
}

export function likes(who) {
  const L = LIKES[who], got = (Object.entries(S.learned[who]) as [string, number][]).sort((a, b) => a[1] - b[1]);
  const item = ([k, m]) => { const [t, key] = k.split(':'); return `<li>${L[t][key]} <span class="dim">(${m}월에 알게 됨)</span></li>`; };
  const lk = got.filter(([k]) => k.startsWith('like')), ht = got.filter(([k]) => k.startsWith('hate'));
  if (!got.length) return `<p class="from" style="margin-top:10px">알게 된 성향</p><p class="dim" style="margin:0">아직 이 세력이 무엇을 반기고 싫어하는지 겪어 보지 못했습니다.</p>`;
  return `<p class="from" style="margin-top:10px">겪어 보니 반기는 것</p>${lk.length ? `<ul class="feed">${lk.map(item).join('')}</ul>` : '<p class="dim" style="margin:0">아직 모릅니다</p>'}
    <p class="from">겪어 보니 싫어하는 것</p>${ht.length ? `<ul class="feed">${ht.map(item).join('')}</ul>` : '<p class="dim" style="margin:0">아직 모릅니다</p>'}`;
}

export function schismRows() {
  const SC = S.schism; if (!SC) return [];
  if (!SC.outcome) return [['교회 판세', SC.R >= 60 ? '개혁파 우세' : SC.R <= 25 ? '정통파 우세' : '팽팽함'], ['결론이 나는 때', '제24월 말']];
  return [['종파 다툼의 결과', { reform: '개혁파가 교회를 이끔', orthodox: '정통파(대사제)가 자리를 지킴', compromise: '두 종파가 나뉜 채 공존' }[SC.outcome]]];
}

export function renderFactionTab() {
  const P = prices(), F = fair();
  const out = [`<div class="grid2">
    ${doc({ cls: 'merchant', kind: '세력 · 상단 조합', title: '상단 조합', from: attitude(S.gM),
      body: rows([['현재 포션 단가', `${P.m}G/병`], ['최근 관리국 주문 (평균)', `${Math.round(S.avgVol)}병`], ...dealList('merchant')]) + likes('merchant') + `<p class="from" style="margin-top:10px">들려오는 말</p>${feed('merchant')}` })}
    ${doc({ cls: 'church', kind: '세력 · 교회', title: '서부 교구 교회', from: attitude(S.gC),
      body: rows([['현재 포션 단가', `${P.c}G/병 · 한 달 최대 ${S.cap}병`], [S.schism && S.schism.outcome === 'compromise' ? '관례 헌금 (정통파 · 개혁파)' : '관례 헌금', S.schism && S.schism.outcome === 'compromise' ? `${fmt(S.custom)}G · ${fmt(S.customR)}G` : `${fmt(S.custom)}G`], ...schismRows(), ...dealList('church')]) + likes('church') + `<p class="from" style="margin-top:10px">들려오는 말</p>${feed('church')}` })}
  </div>`];
  if (S.hist.length) {
    const h = S.hist;
    const pmax = Math.max(120, ...h.map(r => Math.max(r.pm, r.pc)));
    const pt = []; for (let v = 0; v <= pmax + 39; v += 40) pt.push(v);
    out.push(`<div class="chart"><h4>포션 단가 (G/병)</h4>
      <div class="legend"><span><i style="background:var(--merchant)"></i>상단</span><span><i style="background:var(--church)"></i>교회</span></div>
      ${lineChart([{ color: 'var(--merchant)', vals: h.map(r => r.pm) }, { color: 'var(--church)', vals: h.map(r => r.pc) }], { min: 0, max: pt[pt.length - 1], ticks: pt })}</div>`);
  }
  out.push(`<div class="tray-head">감찰 장부 보관함 · 최근 ${S.ledgerArchive.length}건</div>`);
  out.push(S.ledgerArchive.length ? S.ledgerArchive.map(l => l.m ? ledgerDocM(l.m) : ledgerDocC(l.c)).join('') : `<div class="memo">아직 확보한 장부가 없습니다. 감찰관실을 2단계로 키우고 정식 감찰 방침을 고르면 장부 사본을 얻을 수 있습니다.</div>`);
  return out.join('');
}
