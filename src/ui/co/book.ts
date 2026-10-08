// 미궁 도감: ① 어디서 무엇을 찾나(시장 소식) ② 어떻게 얻었나(우리 조의 수집 기록).
// 기록을 읽어 보여 주기만 한다. 상태를 쓰지 않고 난수도 쓰지 않는다
import { FLOORS, INTEL, type World, allMats, floorMons, guideParts, condsOf } from '../../core/company';
import { BUYERS, SRC_NAME } from '../../core/data';

const lvOf = (W: World, k: keyof typeof INTEL.BASE) => (W.intel ? W.intel.lv[k] : INTEL.BASE[k]);
const pct = (v: number) => Math.round(v * 100) + '%';

// 찾는 곳 소식을 들을 수 있는가: 게시판은 누구나, 상단 시세표·교회 소식지는 그 정보망 단계만큼
export const demandSeen = (W: World, who: number) => {
  const B = BUYERS[who];
  return B.src === 'board' || (B.src === 'mkt' ? lvOf(W, 'mkt') : lvOf(W, 'chu')) >= B.lv;
};
// 도감 기록의 조건 이름: "궁수", "냉기 장비", "사제 + 은 장비"
export const condLabel = (k: string) => guideParts(k).map(p => (p.startsWith('c:') ? p.slice(2) : `${p.slice(2)} 장비`)).join(' + ');
// 지금 나와 있는 찾는 곳 (보이는 것과 안 보이는 수)
export function demandsNow(W: World) {
  const ds = W.mat ? W.mat.dem.filter(d => d.until >= W.month) : [];
  return { seen: ds.filter(d => demandSeen(W, d.who)), hidden: ds.filter(d => !demandSeen(W, d.who)).length };
}

// 한 소재의 기록: 성공한 조 전체에서의 비율과, 그보다 잘 나온 조건 몇 개. 짝 조건은 귀환 보고 2단계부터 나눠 본다
export function matRows(W: World, f: number, m: string) {
  const B = W.mat ? W.mat.book[f] : null, g = B && B.got[m];
  if (!B || !g || !g['*']) return null;
  const all = { k: '*', a: g['*'], n: B.n['*'] || 0 }, base = all.a / Math.max(1, all.n), pairs = lvOf(W, 'ret') >= 2;
  const rows = Object.keys(g).filter(k => k !== '*' && (pairs || !k.includes('+')) && (B.n[k] || 0) >= 5)
    .map(k => ({ k, a: g[k], n: B.n[k] })).filter(x => x.a / x.n > base + 0.05)
    .sort((x, y) => y.a / y.n - x.a / x.n).slice(0, 3);
  return [all, ...rows];
}

// 결정표 편성 칸 아래: 고른 직업·장비로 갔던 조가 얻은 것 (기록이 있는 것만)
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

export function bookHtml(W: World) {
  const { seen, hidden } = demandsNow(W), mats = allMats(W), byName = Object.fromEntries(mats.map(x => [x.n, x]));
  const news = seen.map(d => {
    const x = byName[d.m], B = BUYERS[d.who];
    return `<tr><td>${B.who}</td><td><b>${d.m}</b>${d.at >= W.month - 1 ? '<span class="bk-new">새 소식</span>' : ''}<small>${x ? FLOORS[x.f].name : ''}</small></td><td class="n pos">평소 +${Math.round(d.mul * 100)}%</td><td>제${d.until}월까지</td><td class="dim">${SRC_NAME[B.src]}</td></tr>`;
  }).join('');
  const lock = hidden ? `<tr class="bk-lock"><td colspan="5">${hidden}곳이 더 찾는다는 말이 있어요 · 상단 장부나 교회 기록 단계를 올리면 보여요</td></tr>` : '';
  const wanted = new Set(seen.map(d => d.m));
  const floors = FLOORS.slice(0, W.unlocked).map((F, f) => {
    const B = W.mat ? W.mat.book[f] : null;
    if (!B || !B.n['*']) return `<div class="bk-floor"><h4>${F.name}</h4><p class="note">아직 우리 조가 이 층에서 성공해 돌아온 적이 없어요.</p></div>`;
    const mons = floorMons(W, f).map(M => `<div class="bk-mon"><b class="bk-mn">${M.name}</b>${M.mats.map(x => {
      const rows = matRows(W, f, x.n), want = wanted.has(x.n) ? '<span class="dim"> · 찾는 곳 있음</span>' : '';
      if (!rows) return `<div class="bk-mat"><b>${rows === null && !wanted.has(x.n) ? '이름 모를 소재' : x.n}${want}</b><div class="bk-none">아직 못 얻음 · 어떻게 나오는지 몰라요</div></div>`;
      return `<div class="bk-mat"><b>${x.n}${want}</b>${rows.map(r => `<div class="bk-rec${r.n < 5 ? ' thin' : ''}"${r.n < 5 ? ' title="아직 몇 조 안 돼서 믿기 일러요"' : ''}><span>${r.k === '*' ? '성공한 조 전체' : condLabel(r.k)}</span><span class="bk-bar"><i style="width:${pct(r.a / Math.max(1, r.n))}"></i></span><span class="n">${r.a}/${r.n}조</span><span class="n">${pct(r.a / Math.max(1, r.n))}</span></div>`).join('')}</div>`;
    }).join('')}</div>`).join('');
    return `<div class="bk-floor"><h4>${F.name} <span class="dim">· 성공한 우리 조 ${B.n['*']}조</span></h4><div class="bk-mons">${mons}</div></div>`;
  }).join('');
  return `<div class="kind">회색늑대 용병단 · 미궁 도감</div>
    <h2>소재를 찾는 곳과 얻는 법</h2>
    <h3>① 어디서 무엇을 찾나</h3>
    <p class="note">찾는 곳이 있는 소재는 그 기간 동안 모든 용병단에게 값을 더 쳐줘요. 게시판은 누구나 보고, 상단 시세표와 교회 소식지는 정보망 단계만큼 들려요.</p>
    <div class="tw"><table class="grid bk-sold"><thead><tr><th>찾는 곳</th><th>소재</th><th class="n">값</th><th>기한</th><th>들은 곳</th></tr></thead>
      <tbody>${news || (hidden ? '' : '<tr><td colspan="5" class="dim">지금 들려오는 소식이 없어요</td></tr>')}${lock}</tbody></table></div>
    <h3>② 어떻게 얻었나</h3>
    <p class="note">성공한 우리 직영 조가 몬스터를 갈무리해 온 기록이에요. 소재를 골라 캘 수는 없고, 어떤 직업이나 장비를 갖춘 조에서 더 잘 나왔는지만 쌓여요. 막대는 그런 조 중 그 소재를 얻어 온 비율이에요.${lvOf(W, 'ret') < 2 ? ' 직업과 장비의 짝은 귀환 보고 2단계부터 나눠 봐요.' : ''}</p>
    ${floors}`;
}
