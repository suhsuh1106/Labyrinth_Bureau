// 물자 시트 (docs/board.md 3단계): 세로 카드. 구매(품목마다 단가 · 창고 · 한 달 몫 · 살 수) · 배분(조마다 포션 · 수리 도구 · 장비) · 팔기(창고 채집품 · 전리품 · 시장 소식)
// 보급(식량)은 명령서의 일할 날 · 여유로 저절로 셈하고, 남은 보급 · 수리 도구는 검문소가 태운다. 읽기만 한다 (상태를 쓰지 않는다)
import { CO, FLOORS, type Person, type Plan, type World, boughtOf, buyPrice, holyRoom, potShock, potsExpiring, potsOf, rushOn, sanitize, supOf, teamMend, teamPots, us, zoneAt } from '../../core/company';
import { GEARS, PAIR_CLASS } from '../../core/data';
import { type DeskUi, fillOf, kitWarn, orderCost, orderOf } from './desk';
import { lootStock, matStock } from './hall';
import { nameOf } from './roster';
import { stepper } from './view';
import { gearTag } from './icons';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
const pz = (v: number) => (Math.round(v * 10) / 10).toLocaleString('ko-KR');
const GEAR_NAMES = GEARS.filter(g => g !== '일반');

// 구매: 품목 카드. 한 달 몫(본부의 조가 이번 달 다녀올 만큼 − 창고)을 누르면 그만큼 담고, "지금 사기"가 담은 대로 산다 (1일 정가 · 2일부터 긴급 구매)
export function buyHtml(W: World, raw: Plan) {
  const c = us(W), S = supOf(c), H = potsOf(c), X = potsExpiring(c), o = orderOf(W, raw), F = fillOf(W, raw), rush = rushOn(W), B = boughtOf(W);
  const card = (name: string, note: string, k: 'pot' | 'holy' | 'food' | 'mend', have: number, key: string, n: number, fill: number | null) =>
    `<section class="gc"><header><b>${name}</b><span class="dim">${pz(buyPrice(W, k))}G · 창고 ${fmt(have)}</span></header><p class="note">${note}</p>
      <div class="gc-r">${stepper(key, 0, n, `${name} 살 수`)}${fill == null ? '' : n === fill ? '<small class="dim">한 달 몫</small>' : `<button type="button" class="mini" data-act="fill" data-k="${k}">한 달 몫 ${fill}</button>`}<b class="gc-v">${n ? `${fmt(n * buyPrice(W, k))}G` : ''}</b></div></section>`;
  const gears = GEAR_NAMES.map((g, i) => { const n = (raw.buy && raw.buy.gear && raw.buy.gear[g]) || 0, f = F.gear[g] || 0;
    return `<div class="gl"><span>${gearTag(g)} <small class="dim">${PAIR_CLASS[g]} 대신 · 창고 ${S.gear[g] || 0}</small></span>${stepper('buyGear', i, n, `${g} 장비 살 수`)}${f && f !== n ? `<button type="button" class="mini" data-act="fill" data-k="gear" data-g="${g}">${f}</button>` : ''}</div>`; }).join('');
  const oc = orderCost(W, o), fc = orderCost(W, { ...F, holy: 0 }), spent = B.cost.potion + B.cost.torch + B.cost.food + B.cost.mend + B.cost.gear;
  const shock = potShock(W.month) > 1 ? ` · 약초 흉년 값 ×${CO.POT_SHOCK}` : potShock(W.month + 1) > 1 ? ` · 다음 달부터 약초 흉년 소문 (값 ×${CO.POT_SHOCK})` : '';
  return `<div class="gs-h ${rush ? 'rush' : 'ok'}"><b>${rush ? `긴급 구매 · 정가 ×${CO.RUSH}` : '오늘 정가'}</b><span>${rush ? '정가는 매달 1일' : '2일부터 긴급 구매'} · 이달 산 것 ${fmt(spent)}G · 금고 ${fmt(c.cash)}G</span></div>
    ${card('상단 포션', `부상 주사위를 먼저 막는다 · 쓰지 않으면 돌아온다 · 보관 ${CO.POT_KEEP}달${X.pot ? ` · <span class="neg">이달 상할 것 ${X.pot}</span>` : ''}${shock}`, 'pot', H.pot, 'buyPot', o.pot, F.pot)}
    ${card('교회 성수', `${Math.round(CO.HOLY * 100)}% 확률로 병을 비우지 않고 막는다 · 보관 ${CO.HOLY_KEEP}달 · 이달 ${holyRoom(W)}병 더`, 'holy', H.holy, 'buyHoly', o.holy, null)}
    ${card('보급', `한 사람 하루 하나 (오가는 날 포함) · 짐 한 칸에 ${CO.FOOD_SLOT}개 · 남은 것은 검문소가 태운다`, 'food', S.food || 0, 'buyFood', o.food, F.food)}
    ${card('수리 도구', '진 날 하나 써서 무기를 고친다 · 남은 것은 검문소가 태운다', 'mend', S.mend || 0, 'buyMend', o.mend, F.mend)}
    <details class="gc"><summary><b>장비</b><span class="dim">약점 속성 · 한 벌을 조 하나가 들고 간다 · 탐사마다 파손 확률</span></summary><div class="gls">${gears}</div></details>
    <div class="gs-f"><button type="button" class="mini" data-act="auto-buy" aria-pressed="${raw.autoBuy !== false}" title="조를 보낼 때 창고에 모자란 채비를 상단에서 바로 산다 (2일부터 긴급 구매)">${raw.autoBuy !== false ? '떠날 때 모자라면 자동 구매 ✓' : '떠날 때 자동 구매 끔'}</button>
      ${fc >= 1 ? `<button type="button" class="mini" data-act="fill-all">한 달 몫 모두 담기 ${fmt(fc)}G</button>` : ''}
      <button type="button" class="go" data-act="buy-now"${oc ? '' : ' disabled'}>지금 사기 ${oc ? `${fmt(oc)}G` : ''}</button></div>`;
}

// 배분: 조마다 포션 · 수리 도구 · 장비 (보급은 명령서의 날 · 여유로). 떠날 조의 채비가 창고에 모자라면 위에 띄운다
export function kitHtml(W: World, raw: Plan, _ui: DeskUi) {
  const c = us(W), P = sanitize(W, c, raw), T = P.teams || [], byId = new Map((c.crew || []).map(p => [p.id, p])), S = supOf(c), H = potsOf(c);
  const need = T.reduce((a, x) => [a[0] + teamPots(P, x), a[1] + teamMend(P, x)], [0, 0]);
  const rows = T.map((x, t) => {
    const ms = x.m.filter((id): id is number => id != null).map(id => byId.get(id)).filter((p): p is Person => !!p), z = zoneAt(W, x.z), n = ms.length;
    return `<section class="gc"><header><b>${t + 1}조</b><span class="dim">${ms[0] ? esc(nameOf(ms[0])) : '빈 조'} · ${n}명 · ${z ? `${FLOORS[z.f].name} ${esc(z.nm)}` : FLOORS[x.f].name}</span></header>
      <div class="gc-k"><label>포션 ${stepper('tpots', t, teamPots(P, x), `${t + 1}조 포션`)}</label><label>수리 도구 ${stepper('tmend', t, teamMend(P, x), `${t + 1}조 수리 도구`)}</label>
      <label>장비 <select data-k="teamG" data-i="${t}" aria-label="${t + 1}조 장비"><option value="">없음</option>${GEAR_NAMES.map(g => `<option value="g:${g}"${x.g === 'g:' + g ? ' selected' : ''}>${g} (${PAIR_CLASS[g]} 대신) · 창고 ${S.gear[g] || 0}</option>`).join('')}</select></label>
      <small class="dim">보급 ${n * (x.food || 0)}개 (${x.food || 0}일치 × ${n}명)</small></div></section>`;
  }).join('');
  return `<div class="crew-sum"><span>포션 챙김 <b>${need[0]}</b> / 창고 <b>${H.pot + H.holy}</b></span><span>수리 도구 <b>${need[1]}</b> / <b>${S.mend || 0}</b></span><span>보급 창고 <b>${S.food || 0}</b></span></div>
    ${kitWarn(W, raw)}${rows || '<p class="note">짠 조가 없어요 (인원 → 조 편성)</p>'}
    <p class="note">포션은 쓰지 않으면 돌아오고, 보급 · 수리 도구는 남으면 검문소가 태운다 · 장비는 약점을 찌르고(직업과 함께면 다), 역효과 몬스터를 만나면 잘 망가진다</p>`;
}

// 팔기: 창고 채집품(오늘 시세 · 상함 · 팔기 · 시장 소식)과 전리품(그믐에 팔 양)
export function sellHtml(W: World, raw: Plan) {
  const P = sanitize(W, us(W), raw);
  return `${lootStock(W, P)}${matStock(W, P)}`;
}
