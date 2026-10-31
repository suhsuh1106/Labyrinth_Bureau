// 종이의 꼴: 신문 지면 · 관청 공문 · 길드 서신. 그리기만 한다(상태에 쓰지 않고 난수도 쓰지 않는다).
// 받은 보고(Report)를 그 서식에 맞는 문체의 글로 옮기는 것도 여기서 한다.
import { B, GUILDS, type GuildId, type Report, type World } from '../../bureau/engine';

// 날짜: 한 달 서른 날, 임기 첫날이 왕국력 412년 1월 1일
export const dateOf = (day: number) => `왕국력 412년 ${Math.floor(day / 30) + 1}월 ${(day % 30) + 1}일`;
const num = (v: number) => Math.round(v).toLocaleString('ko-KR');

export interface News { day: number; no: number; extra?: boolean; head: string; deck?: string; lead: string; cols: { h: string; p: string }[]; box?: { h: string; rows: [string, string][] } }
// 신문 한 면: 제호 · 날짜 띠 · 머리기사(부제 · 첫머리) · 단 나눔 · 곁 상자
export function newsHtml(n: News) {
  return `<article class="newspaper">
    <header class="np-mast"><small class="np-ear">왕도와 변경의 소식</small><h1>왕 도 일 보</h1><small class="np-ear">${n.extra ? '호 외' : '조 간'}</small></header>
    <div class="np-line"><span>${dateOf(n.day)}</span><span>제${num(1203 + n.no)}호</span><span>한 부 동전 한 닢</span></div>
    <h2 class="np-head">${n.head}</h2>
    ${n.deck ? `<p class="np-deck">${n.deck}</p>` : ''}
    <div class="np-body">
      <p class="np-lead">${n.lead}</p>
      ${n.cols.map(c => `<section><h3>${c.h}</h3><p>${c.p}</p></section>`).join('')}
      ${n.box ? `<aside class="np-box"><h3>${n.box.h}</h3><dl>${n.box.rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></aside>` : ''}
    </div>
  </article>`;
}

export interface Gov { org: string; no: string; day: number; to: string; title: string; body: string[]; attach?: string[]; sign: string; seal: string }
// 관청 공문: 기관명 · 수신 · 제목 · 번호 붙인 본문 · 붙임 · 끝. · 발신 명의와 직인 · 문서번호 · 시행일
export function govHtml(g: Gov) {
  return `<article class="gov-doc">
    <header class="gd-org">${g.org.replace(/ /g, '').split('').join(' ')}</header>
    <dl class="gd-meta"><dt>수신</dt><dd>${g.to}</dd><dt>제목</dt><dd><b>${g.title}</b></dd></dl>
    <ol class="gd-body">${g.body.map(p => `<li>${p}</li>`).join('')}</ol>
    ${g.attach?.length ? `<p class="gd-attach"><span>붙임</span>${g.attach.join(' · ')}. <b>끝.</b></p>` : '<p class="gd-attach"><b>끝.</b></p>'}
    <footer class="gd-sign"><b>${g.sign}</b><i class="seal sq" aria-label="직인">${g.seal}</i></footer>
    <p class="gd-no"><span>${g.no}</span><span>시행 ${dateOf(g.day)}</span></p>
  </article>`;
}

export interface Letter { house: string; day: number; to: string; title: string; body: string[]; sign: string; seal: string; tone?: string }
// 길드 서신: 편지지 머리(길드 이름) · 날짜 · 받는 이 · 제목 · 인사로 여닫는 본문 · 서명과 둥근 인장
export function letterHtml(l: Letter) {
  return `<article class="guild-letter${l.tone ? ` f-${l.tone}` : ''}">
    <header class="gl-head"><b>${l.house}</b><small>${dateOf(l.day)}</small></header>
    <p class="gl-to">${l.to}</p>
    <p class="gl-title">${l.title}</p>
    ${l.body.map(p => `<p>${p}</p>`).join('')}
    <footer class="gl-sign"><span>${l.sign}</span><i class="seal rd" aria-label="인장">${l.seal}</i></footer>
  </article>`;
}

// 첫 화면: 범람 · 왕국군 투입 · 미궁관리국 신설
export const introNews = (): News => ({
  day: 0, no: 1, extra: true,
  head: '폐광 아래 미궁 넘쳐, 마을 셋 잠겨',
  deck: '왕국군이 막아 서 · 미궁관리국 새로 생겨',
  lead: '지난밤 로이드 백작령 산속, 버려진 폐광 아래 미궁이 넘쳤다. 아랫마을 셋이 물과 마물에 잠겼다. 길도 없는 외진 곳이라 아무도 돌보지 않던 미궁이었다.',
  cols: [
    { h: '왕국군, 폐광을 막다', p: '왕국군이 새벽에 들어가 물길을 막고 그대로 머물고 있다. "군은 미궁을 지키는 곳이 아니다." 한 장교의 말이다.' },
    { h: '미궁관리국 새로 둬', p: '중앙 행정원이 미궁을 살필 관리국을 새로 두었다. 관리국은 길드에 명령할 수 없어, 공고와 편지로 길드를 움직여야 한다. 초대 국장은 오늘 부임한다.' },
    { h: '벌이는 좋으나 길이 멀다', p: '광부들은 폐광 아래 소재가 넉넉하다고 입을 모은다. 하지만 어느 길드 본부에서도 사흘 넘게 걸린다. "남는 게 길에서 다 샌다." 한 조장의 말이다.' },
  ],
  box: { h: '관할 미궁', rows: [['폐광', '범람 직후 · 군 주둔'], ['검은숲 미궁', '안정'], ['수몰 갱도', '주의']] },
});

// 범람 기사: 보고 한 줄을 지면으로 (길 · 마을 소식은 그 기사로)
export const floodNews = (W: World, r: Report, no: number): News => {
  const grow = growNews(r, no);
  if (grow) return grow;
  const d = W.dungeons.find(x => r.title.startsWith(x.name));
  return {
    day: r.day, no, extra: true,
    head: r.title.replace(' 범람', ' 다시 범람') + `, ${d?.land ?? ''} 마을 피해`,
    deck: r.chips.join(' · '),
    lead: `${d?.name ?? '미궁'}이 넘쳐 ${d?.land ?? '인근'} 마을이 피해를 입었다. 복구비는 관리국 예산에서 나간다. 중앙과 길드들은 관리국이 무엇을 했느냐고 묻고 있다.`,
    cols: [{ h: '길드들 발길 끊겨', p: '범람 뒤 미궁에 드는 조가 크게 줄었다. 한 길드 관계자는 "사람을 잃은 곳에 다시 들어가려면 그만한 까닭이 있어야 한다"고 말했다.' }],
  };
};

// 발전 기사: 외진 미궁에 길이 나고 마을이 선 소식 (발전도 같은 판의 수치는 지면에 적지 않는다)
function growNews(r: Report, no: number): News | null {
  const name = r.title.split(/ 가는 | 곁에 /)[0];
  if (r.title.includes('길 닦여')) return {
    day: r.day, no, head: `${name} 가는 길 닦여, 길목에 여관`, deck: '오가는 길 하루 줄어',
    lead: `발길이 이어지자 ${name} 쪽으로 새 길이 났다. 길목에는 여관이 문을 열었다.`,
    cols: [{ h: '길드들 반겨', p: '"이제 길에서 덜 샌다." 한 조장의 말이다. 짐수레가 드나들기 시작했다.' }],
  };
  if (r.title.includes('곁에 마을')) {
    const g = r.chips.at(-1)?.replace(/는 하루 길$/, '') ?? '';
    return {
      day: r.day, no, head: r.title.replace(' · ', ', ').replace(/ 지부$/, ' 지부 열어'), deck: '오가는 길 하루 더 줄어',
      lead: `${name} 곁에 집이 들어서고 마을이 섰다.${g ? ` ${g}는 이곳에 지부를 냈다.` : ''}`,
      cols: [{ h: '외진 곳이 마을로', p: '처음엔 왕국군만 지키던 곳이다. 이제는 장이 서고 연기가 오른다.' }],
    };
  }
  return null;
}

// 길드 서신의 서명 · 인장 · 색: 길드 이름으로 찾는다
const guildBy = (name: string) => { const g = GUILDS.find(x => B.GUILD[x].name === name); return g ? { sign: B.GUILD[g].sign, seal: B.GUILD[g].seal, tone: g as string } : null; };
const gov = (r: Report, title: string, body: string[], attach?: string[]): Gov =>
  ({ org: '중앙 행정원', no: `행정원 제412-${String(r.day + 1).padStart(3, '0')}호`, day: r.day, to: '미궁관리국장', title, body, attach, sign: '중앙 행정원장', seal: '行政院印' });

// 받은 보고를 서식에 맞는 글로: 중앙 행정원은 공문, 길드는 서신
export function docOf(r: Report): { gov: Gov } | { letter: Letter } {
  if (r.from === '중앙 행정원') {
    if (r.day === 0) {
      const o = B.ORDER;
      return { gov: gov(r, '폐광 인계에 관한 요구', [
        '왕국군이 폐광을 막고 있으나, 군을 미궁에 오래 둘 수는 없습니다.',
        `길드의 조를 폐광에 들여 군에게서 넘겨받으십시오. <b>하루 ${o.min}조 이상, ${o.need}일 이어서</b> 들면 넘겨받은 것으로 봅니다.`,
        `넘겨받으면 예산 ${num(o.pay)}G를 더 보냅니다. 길드가 끝내 들지 않으면 군은 넘겨주지 않고 물러납니다.`,
      ], ['폐광 수위 보고 1부', '징세청 길드 출입 장부 사본 1부(기록실)']) };
    }
    // 붙임에는 세상 안의 것만 (입지 같은 판의 수치는 서류에 적지 않는다)
    const att = r.chips.filter(c => !c.startsWith('입지'));
    if (r.title.startsWith('폐광 인계')) return { gov: gov(r, '폐광 인계 완료 통보', [
      '귀 국이 폐광을 왕국군에게서 넘겨받았음을 확인합니다.',
      `약속한 예산 ${num(B.ORDER.pay)}G를 보냅니다.`,
      '군은 오늘 물러나며, 이제 폐광의 물은 귀 국이 살핍니다.',
    ], att) };
    if (r.title.startsWith('인내가 다함')) return { gov: gov(r, '폐광 주둔 왕국군 철수 통보', [
      '폐광에 드는 길드의 조가 끝내 모자랐습니다.',
      '왕국군은 넘겨주지 않고 오늘 물러납니다. 이제 폐광의 물은 귀 국이 살핍니다.',
      '본원은 이 일을 귀 국의 기록에 남깁니다.',
    ], att) };
    if (r.title.startsWith('입지')) return { gov: gov(r, '미궁관리국 직제 확대 통보', [
      '귀 국의 그간 업무를 살펴 직제를 한 단계 넓힙니다.',
      '서기 한 명을 더 들일 수 있음을 알리니 집무실에서 정하시기 바랍니다.',
      ...(r.chips.some(c => c.includes('요청서')) ? ['아울러 길드 한 곳을 지정하여 요청서를 보낼 수 있습니다.'] : []),
    ]) };
    return { gov: gov(r, r.title, ['아래와 같이 알립니다.'], att) };
  }
  const g = guildBy(r.from) ?? { sign: r.from, seal: '印', tone: undefined };
  const L = (title: string, body: string[]): { letter: Letter } =>
    ({ letter: { house: r.from, day: r.day, to: '미궁관리국장 귀하', title, body, sign: g.sign, seal: g.seal, tone: g.tone } });
  const why = r.chips.filter(c => /^[＋－]/.test(c)).map(c => c.slice(2));
  const WHY: Record<string, string> = { '돈': '보조금을 약속해 주신 뜻', '안전': '잃은 이들을 위로해 주시려는 뜻', '관청 기록': '저희 출입을 관청 기록에 올려 주시는 뜻' };
  const glad = why.filter(w => WHY[w]).map(w => WHY[w]);
  if (r.title.startsWith('요청서 서명')) return L(`제목: 귀 국 요청서(${r.title.split(': ')[1]})에 대한 회신`, [
    '국장님께. 보내 주신 요청서는 잘 받아 보았습니다.',
    `단원들과 조항을 하나하나 살펴본 끝에${glad.length ? ` ${glad.join('과 ')}을 고맙게 여겨` : ''} 기꺼이 서명하여 돌려보냅니다. 약정 기간은 ${r.chips.at(-1)}입니다.`,
    '앞으로도 좋은 뜻으로 함께하기를 바랍니다. 평안하시기를.',
  ]);
  if (r.title.startsWith('요청서:')) return L(`제목: 귀 국 요청서(${r.chips[0]})에 대한 회신`, [
    '국장님께. 보내 주신 요청서는 감사히 받았습니다.',
    `다만 지금 저희 사정으로는 조항을 그대로 받기가 어려워${why.includes('정보 내주기') ? ' 특히 출입 기록을 내는 일은' : ''} 돌아가서 조금 더 검토해 보겠습니다.`,
    '너그러이 헤아려 주시기를 바랍니다.',
  ]);
  if (r.title.includes('서운함')) return L('제목: 지난 회의에 관하여', [
    '국장님께. 지난번 회의 소식을 전해 들었습니다.',
    `저희를 빼고 정하신 일이라 단원들 사이에 서운한 말이 돕니다. 다음에는 저희 자리도 헤아려 주시기를 청합니다.`,
  ]);
  if (r.title.includes('지부 개설')) return L(`제목: ${r.chips[0]} 곁 지부 개설 알림`, [
    `국장님께. 길이 닦이고 마을이 서서, 저희가 ${r.chips[0]} 곁에 지부를 내었습니다.`,
    '이제 저희 조는 하루 길로 드나듭니다. 외진 곳을 나라가 돌봐 주신 덕이라 여깁니다. 평안하시기를.',
  ]);
  if (r.title.includes('협정 이행')) return L('제목: 출입 협정 이행 알림', ['국장님께. 서명한 출입 협정을 오늘부터 이행합니다. 늦어진 점 양해를 바랍니다.']);
  return L(`제목: ${r.title}`, ['국장님께. 아래와 같이 알려 드립니다.', r.chips.join(' · ')]);
}

// 청원 · 독촉: 길드 서신
export function askLetter(W: World, a: { day: number; from: string; kind: 'aid' | 'dun'; want: number; chips: string[] }): Letter {
  const name = W.guilds[a.from as GuildId].name;
  const g = guildBy(name) ?? { sign: '', seal: '', tone: undefined };
  return {
    house: name, day: a.day, to: '미궁관리국장 귀하', sign: g.sign, seal: g.seal, tone: g.tone,
    title: a.kind === 'dun' ? '제목: 지난 신세에 관하여' : '제목: 도움을 청하는 글',
    body: a.kind === 'dun'
      ? ['국장님께. 늘 애써 주시는 데 감사드립니다.', `지난번 회의에서 저희가 서명해 드린 일을 기억하시리라 믿습니다. 이제 저희 사정도 넉넉지 않아 <b>${num(a.want)}G</b>를 돌려받고자 하니 헤아려 주시기 바랍니다.`]
      : ['국장님께. 염치 불고하고 글을 올립니다.', `요즘 저희 금고가 바닥을 드러내 조를 꾸리기도 버겁습니다. <b>${num(a.want)}G</b>를 도와주시기를 청합니다. 이 은혜는 잊지 않겠습니다.`],
  };
}
