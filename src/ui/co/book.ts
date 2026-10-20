// 미궁 도감(헌터 노트): ① 어디서 무엇을 찾나(시장 소식) ② 몬스터마다 한 장 — 이해도 · 생태 · 전적 · 소재 · 단장 조사.
// 도감은 기록만 보여 준다 (약점을 별점이나 "~인 듯"으로 알려 주지 않는다. 짐작은 플레이어가 한다).
// 기록을 읽어 보여 주기만 한다. 상태를 쓰지 않고 난수도 쓰지 않는다
import { FLOORS, INTEL, type Plan, type World, allMats, floorMons, guideParts, condsOf, us } from '../../core/company';
import { BUYERS, FAUNA, MONSTERS, SRC_NAME } from '../../core/data';
import { ecoOf } from '../../core/monsters';
import { ASK_KEYS, CLASS_KEYS, DEX, type Dex, GEAR_KEYS, MAT_KEYS, askable, keyName, keySure, weakName } from '../../core/dex';
import { classWeaks } from '../../core/data';
import { el, gearTag } from './icons';

const lvOf = (W: World, k: keyof typeof INTEL.BASE) => (W.intel ? W.intel.lv[k] : INTEL.BASE[k]);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// 찾는 곳 소식을 들을 수 있는가: 게시판은 누구나, 상단 시세표·교회 소식지는 그 정보망 단계만큼
export const demandSeen = (W: World, who: number) => {
  const B = BUYERS[who];
  return B.src === 'board' || (B.src === 'mkt' ? lvOf(W, 'mkt') : lvOf(W, 'chu')) >= B.lv;
};
// 갖춘 것의 이름: "궁수", "냉기 장비", "사제 + 은 장비"
export const condLabel = (k: string) => guideParts(k).map(p => (p.startsWith('c:') ? p.slice(2) : gearTag(p))).join(' + ');
// 직업 · 장비 칸 이름: 직업은 글, 장비는 속성 아이콘
const keyTag = (k: string) => (k.startsWith('c:') ? k.slice(2) : gearTag(k));
// 지금 나와 있는 찾는 곳 (보이는 것과 안 보이는 수)
export function demandsNow(W: World) {
  const ds = W.mat ? W.mat.dem.filter(d => d.until >= W.month) : [];
  return { seen: ds.filter(d => demandSeen(W, d.who)), hidden: ds.filter(d => !demandSeen(W, d.who)).length };
}

// 결정표 편성 칸 아래: 고른 직업·장비로 갔던 조가 얻은 것 (옛 도감 기록이 있는 것만)
export function kitHint(W: World, f: number, guide: string) {
  const B = W.mat ? W.mat.book[f] : null, ps = guideParts(guide);
  if (!B || !ps.length) return '';
  const want = condsOf(ps).filter(k => (B.n[k] || 0) > 0), out: string[] = [];
  floorMons(W, f).forEach(M => M.mats.forEach(x => {
    const g = B.got[x.n]; if (!g || !g['*']) return;
    want.forEach(k => { const a = g[k] || 0, n = B.n[k], base = g['*'] / Math.max(1, B.n['*']); if (a && a / n > base + 0.05) out.push(`${x.n} ${a}/${n}조`); });
  }));
  if (!want.length) return '이 조합으로 성공한 기록 없음 · 가 봐야 알아요';
  return out.length ? `기록상 ${out.slice(0, 3).join(' · ')}` : '이 조합에서 특별히 더 나온 소재는 아직 없어요';
}

const pctOf = (w: number, n: number) => (n ? `${Math.round(w / n * 100)}%` : '-');
const badStamp = '<span class="dx-st bad" title="단장 조사로 확정한 역효과">역효과</span>';
const stamp = (a: string | undefined) => (a === 'yes' ? '<span class="dx-st yes">확정</span>' : a === 'no' ? '<span class="dx-st no">아님</span>' : '');
// 전적표 한 칸: 그 조우에서 성공 비율 (작은 글씨는 마주친 수). 마주침이 적으면 흐리게. 기록이 없어도 칸은 그대로 둔다
const cell = (r: { n: number; w: number; k?: number; p?: number } | undefined) => (r && r.n ? `<td class="n${r.n < 3 ? ' thin' : ''}" title="마주침 ${r.n} · 승 ${r.w}">${pctOf(r.k || 0, r.p || 0)}<small>${r.n}번</small></td>` : '<td class="n dim">·<small>&nbsp;</small></td>');

function recTable(D: Dex, open: boolean) {
  const cls = CLASS_KEYS.map(k => `<tr><th>${keyName(k)} <span class="els">${classWeaks(k).map(w => el(w)).join('')}</span>${stamp(classWeaks(k).map(w => D.key[w]).find(a => a === 'yes') || (classWeaks(k).every(w => D.key[w] === 'no') ? 'no' : undefined))}${classWeaks(k).some(w => D.bad && D.bad[w] === 'yes') ? badStamp : ''}</th>${[0, 1, 2].map(v => cell(open ? D.rec[`${k}:${v}`] : undefined)).join('')}</tr>`).join('');
  const gear = GEAR_KEYS.map(k => `<tr><th>${gearTag(k)}${stamp(D.key[k])}${D.bad && D.bad[k] === 'yes' ? badStamp : ''}</th>${[0, 1].map(v => cell(open ? D.rec[`${k}:${v}`] : undefined)).join('')}<td class="n dim"></td></tr>`).join('');
  return `<div class="nb-rec${open ? '' : ' locked'}"><table class="grid slim dx-rec"><thead><tr><th>직업 · 장비</th><th class="n">없음</th><th class="n">하나 · 있음</th><th class="n">둘 이상</th></tr></thead><tbody>${cls}${gear}</tbody></table>
    ${open ? '' : `<span class="nb-lock">이해도 ${DEX.REC_AT}에서</span>`}</div>`;
}
// 소재: 그 몬스터의 소재 칸을 모두 두고(얻지 못한 것은 ???), 얻은 것은 이긴 조우 중 얻은 비율(획득률) 막대 · 획득률이 높았던 직업 · 장비 둘 · 단장 답
function matsHtml(W: World, D: Dex, mats: { n: string; val: number }[]) {
  const ref = (n: string, v: number) => (W.mat && W.mat.ref[n]) || v;
  const rows = mats.map(x => {
    const X = D.mats[x.n];
    if (!X || !X.got) return `<tr class="unk"><td><b>???</b><small>아직 얻지 못함</small></td><td class="n dim">-</td><td></td><td></td></tr>`;
    const r = (k: string) => X.rec[k] || { n: 0, g: 0 };
    const all = [0, 1, 2].reduce((a, v) => ({ n: a.n + r(`c:전사:${v}`).n, g: a.g + r(`c:전사:${v}`).g }), { n: 0, g: 0 });
    const by = MAT_KEYS.map(k => { const on = k.startsWith('c:') ? [r(`${k}:1`), r(`${k}:2`)] : [r(`${k}:1`)]; const n = on.reduce((a, y) => a + y.n, 0), g = on.reduce((a, y) => a + y.g, 0); return { k, n, g }; })
      .filter(y => y.n >= 3 && y.g > 0).sort((a, b) => b.g / b.n - a.g / a.n).slice(0, 2);
    const asked = Object.entries(D.mat[x.n] || {}).map(([k, a]) => `<span class="nb-chip">${keyTag(k)}${stamp(a)}</span>`).join('');
    const pc = all.n ? Math.round(all.g / all.n * 100) : 0;
    return `<tr><td><b>${x.n}</b><small>${ref(x.n, x.val)}G 안팎 · ${X.got}개 얻음</small></td>
      <td class="n"><span class="nb-rate" title="이긴 조우 ${all.n}번 중 ${all.g}번 얻음"><i style="width:${pc}%"></i></span><small>${all.g}/${all.n}</small></td>
      <td>${by.map(y => `<span class="nb-chip" title="${keyName(y.k)}: 이긴 조우 ${y.n}번 중 ${y.g}번 얻음">${keyTag(y.k)} ${y.g}/${y.n}</span>`).join('') || '<span class="dim">-</span>'}</td><td>${asked}</td></tr>`;
  }).join('');
  return `<table class="grid slim dx-mats"><thead><tr><th>소재</th><th class="n">획득률</th><th>잘 나온 직업 · 장비</th><th>단장 답</th></tr></thead><tbody>${rows}</tbody></table>`;
}
// 단장 조사 고르기: 약점(확정 전까지) · 얻은 소재의 조건. 이미 답을 받은 것은 뺀다
// 단장 조사 고르기 (출정 화면): 열린 층의 몬스터 중 이해도 ASK_AT 이상인 것에 물을 것 하나. 이미 답을 받은 것은 뺀다
export function askPanel(W: World, P: Plan) {
  const dex = W.dex || {}, cur = P.ask;
  const groups = FLOORS.slice(0, W.unlocked).flatMap((F, f) => floorMons(W, f).map(M => {
    const D = dex[M.name]; if (!D || D.u < DEX.ASK_AT) return '';
    const opt = (A: { mon: string; k: string; m?: string; b?: boolean }, t: string) => `<option value="${esc(JSON.stringify(A))}"${cur && cur.mon === A.mon && cur.k === A.k && (cur.m || '') === (A.m || '') && !!cur.b === !!A.b ? ' selected' : ''}>${t}</option>`;
    const keys = keySure(D) ? [] : ASK_KEYS.filter(k => askable(D, { mon: M.name, k })).map(k => opt({ mon: M.name, k }, `약점이 ${weakName(k)}인가`));
    const mats = M.mats.filter(x => D.mats[x.n] && D.mats[x.n].got > 0).flatMap(x => MAT_KEYS.filter(k => askable(D, { mon: M.name, k, m: x.n })).map(k => opt({ mon: M.name, k, m: x.n }, `${x.n}: ${keyName(k)}을 갖추면 잘 나오나`)));
    const bads = ASK_KEYS.filter(k => askable(D, { mon: M.name, k, b: true })).map(k => opt({ mon: M.name, k, b: true }, `역효과가 ${weakName(k)}인가`));
    return keys.length || bads.length || mats.length ? `<optgroup label="${esc(`${F.name} ${M.name}`)}">${[...keys, ...bads, ...mats].join('')}</optgroup>` : '';
  })).join('');
  const c = us(W), lead = (c.crew || []).find(x => x.lead), LT = lead && P.teams ? P.teams.find(T => T.m.includes(lead.id)) : null;
  const where = !lead ? '' : lead.hurt ? `단장 ${esc(lead.n || '')} 부상 · 이번 달 못 나감` : LT ? `단장 ${esc(lead.n || '')} · ${LT ? `${P.teams!.indexOf(LT) + 1}조 · ${FLOORS[LT.f].name}` : ''}` : `단장 ${esc(lead.n || '')} 대기 중`;
  const ok = !cur || (LT && floorMons(W, LT.f).some(M => M.name === cur.mon));
  return `<div class="panel ask-p"><header><h2>단장 조사</h2><span class="sub">한 달에 하나 · 단장이 나선 날 그 몬스터를 만나면 답 (맞으면 확정, 아니면 아님)</span><span class="right">${where}</span></header>
    ${groups ? `<select data-k="ask" aria-label="단장 조사"><option value="">이번 달엔 묻지 않음</option>${groups}</select>${cur && !ok ? '<p class="note neg">단장이 그 몬스터가 사는 층의 조에 있어야 해요</p>' : ''}` : `<p class="note">물을 몬스터 없음 · 도감 이해도 ${DEX.ASK_AT}부터</p>`}</div>`;
}

// 몬스터 한 장 (노트 두 쪽): 왼쪽은 그림 · 이해도 · 생태, 오른쪽은 전적 · 소재. 기록이 없어도 칸 자리는 그대로 둔다
function monPage(W: World, P: Plan | undefined, f: number, j: number) {
  const M = floorMons(W, f)[j], raw = j ? FAUNA[f][j - 1] : MONSTERS[W.mons[f]], D = (W.dex || {})[M.name];
  const tag = `<span class="dx-tag">${FLOORS[f].name} · ${j ? '곁 몬스터' : '주 몬스터'}</span>`;
  if (!D) return `<div class="nb-pages unk"><section class="nb-page"><div class="nb-img" aria-hidden="true">?</div><h4>???</h4>${tag}<p class="note">아직 만나지 못했어요</p></section><section class="nb-page"></section></div>`;
  const eco = ecoOf(raw).map((t, k) => (D.u >= DEX.ECO_AT[k] ? `<li>${t}</li>` : `<li class="lock">이해도 ${DEX.ECO_AT[k]}에서</li>`)).join('');
  const marks = [DEX.REC_AT, DEX.TARGET_AT, ...(j ? [] : [DEX.ROOT_AT])].map(v => `<i style="left:${v}%" title="${v}"></i>`).join('');
  const target = D.u >= DEX.TARGET_AT ? '<span class="pos">사냥 임무로 노릴 수 있음</span>' : `사냥 임무로 노리기: 이해도 ${DEX.TARGET_AT}부터`;
  const root = j ? '' : ` · 근원: ${(W.roots && W.roots[f] && W.roots[f].found) ? '<span class="pos">찾음</span>' : `이해도 ${DEX.ROOT_AT} + 약점 확정`}`;
  const asking = P && P.ask && P.ask.mon === M.name ? `<p class="note"><b>이번 달 단장 조사</b> · ${P.ask.m ? `${P.ask.m}: ${keyTag(P.ask.k)}` : `${P.ask.b ? '역효과' : '약점'} ${el(P.ask.k)}`}</p>` : '';
  return `<div class="nb-pages"><section class="nb-page">
      <div class="nb-img" aria-hidden="true">그림</div>
      <h4>${M.name}</h4>${tag}
      <p class="nb-tally">마주침 <b>${D.n}</b> · 승 <b>${D.w}</b> · 패 <b>${D.n - D.w}</b> · 처음 만난 달 제${D.at}월</p>
      <div class="dx-u"><span class="dx-bar" role="img" aria-label="이해도 ${Math.round(D.u)}"><b style="width:${Math.min(100, D.u)}%"></b>${marks}</span><span>이해도 <b>${Math.round(D.u)}</b></span></div>
      <h5>생태</h5><ul class="dx-eco">${eco}</ul>
      <p class="note">${target}${root}${D.u < DEX.ASK_AT ? ` · 단장 조사: 이해도 ${DEX.ASK_AT}부터` : ''}</p>${asking}
    </section><section class="nb-page">
      <h5>전적 <small class="dim">그 몬스터를 만난 날 성공 비율 · 아래는 마주친 수</small></h5>${recTable(D, D.u >= DEX.REC_AT)}
      <h5>소재</h5>${matsHtml(W, D, M.mats)}
    </section></div>`;
}

export function bookHtml(W: World, P?: Plan, sel?: string) {
  const { seen, hidden } = demandsNow(W), mats = allMats(W), byName = Object.fromEntries(mats.map(x => [x.n, x]));
  const news = seen.map(d => {
    const x = byName[d.m], B = BUYERS[d.who];
    return `<tr><td>${B.who}</td><td><b>${d.m}</b>${d.at >= W.month - 1 ? '<span class="bk-new">새 소식</span>' : ''}<small>${x ? FLOORS[x.f].name : ''}</small></td><td class="n pos">평소 +${Math.round(d.mul * 100)}%</td><td>제${d.until}월까지</td><td class="dim">${SRC_NAME[B.src]}</td></tr>`;
  }).join('');
  const lock = hidden ? `<tr class="bk-lock"><td colspan="5">${hidden}곳이 더 찾는다는 말이 있어요 · 상단 장부나 교회 기록 단계를 올리면 보여요</td></tr>` : '';
  const ask = W.last && W.last.ask;
  // 몬스터 탭: 열린 층의 몬스터마다 하나 (만나지 못한 것은 ???). 고른 탭이 없으면 첫 몬스터
  const tabs = FLOORS.slice(0, W.unlocked).flatMap((F, f) => floorMons(W, f).map((M, j) => ({ f, j, name: M.name, met: !!(W.dex || {})[M.name] })));
  const cur = tabs.find(t => t.name === sel) || tabs[0];
  const tabBar = `<div class="nb-tabs" role="tablist" aria-label="도감 몬스터">${tabs.map(t => `<button type="button" role="tab" class="nb-tab${t.j ? '' : ' main'}${t.met ? '' : ' unk'}" data-act="dex-tab" data-mon="${esc(t.name)}" aria-selected="${t === cur}"><small>${FLOORS[t.f].name}</small>${t.met ? esc(t.name) : '???'}</button>`).join('')}</div>`;
  const floors = `<div class="nb">${tabBar}${cur ? monPage(W, P, cur.f, cur.j) : ''}</div>`;
  return `<h3>어디서 무엇을 찾나</h3>
    <div class="tw"><table class="grid bk-sold"><thead><tr><th>찾는 곳</th><th>소재</th><th class="n">값</th><th>기한</th><th>들은 곳</th></tr></thead>
      <tbody>${news || (hidden ? '' : '<tr><td colspan="5" class="dim">지금 들려오는 소식이 없어요</td></tr>')}${lock}</tbody></table></div>
    <h3>몬스터</h3>
    <p class="note">약점 <span class="els">${ASK_KEYS.map(k => el(k, { tip: weakName(k) })).join('')}</span> · 장비 ½ · 맡는 직업 ¼ · 둘 다 전부 · 이해도 ${DEX.REC_AT} 전적 · ${DEX.TARGET_AT} 사냥 노리기${ask ? ` · 지난달 단장 조사: ${ask.mon} — ${ask.m ? `${ask.m}, ${keyTag(ask.k)}` : `${ask.b ? '역효과 ' : ''}${el(ask.k)}`} ${ask.ans === 'yes' ? '확정' : ask.ans === 'no' ? '아님' : ask.ans === 'miss' ? '만나지 못함' : '단장이 나가지 않음'}` : ''}</p>
    ${floors}`;
}
