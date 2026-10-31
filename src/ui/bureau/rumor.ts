// 화면 아래 소문 한 줄: 판 상태에서 마을에 돌 만한 말을 고른다. 상태에 쓰지 않고 난수도 쓰지 않는다(날과 차례로 고름).
// 숫자는 말하지 않는다. 사실에서 나오지만 말투는 술집의 말이다
import { B, GUILDS, type World, devStage, levelOf, teamsIn } from '../../bureau/engine';

// 판과 상관없이 늘 도는 말 (세계관: 폐광 · 왕국군 · 길드의 일상)
const AIR = [
  '왕국군 병사들이 폐광 앞 막사에서 겨울을 날 걱정을 한다더라.',
  '로이드 성 시장에서 마석 값을 두고 상인들이 또 언성을 높였대.',
  '수몰 갱도 쪽 뱃사공이 요즘 짐삯을 올려 받는다지.',
  '강나루 주막에선 새로 생긴 관리국이 몇 달이나 갈지 내기를 한다던데.',
  '검은숲 나무꾼들이 밤마다 땅 밑에서 울리는 소리를 듣는대.',
  '중앙에서 온 서기가 징세청 장부를 통째로 날랐다는 말이 있어.',
];

// 받침에 따라 이/가
const iga = (w: string) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return w + (c >= 0 && c % 28 ? '이' : '가'); };

export function rumorsOf(W: World): string[] {
  const out: string[] = [];
  W.dungeons.forEach((d, i) => {
    const n = teamsIn(d);
    const most = GUILDS.reduce((m, g) => d.teams[g] > d.teams[m] ? g : m, GUILDS[0]);
    if (n >= 1 && d.teams[most] > 0) out.push(`${W.guilds[most].name} 조들이 ${d.name} 쪽으로 줄지어 가더라.`);
    else out.push(`${d.name} 가는 길엔 요새 사람 그림자도 없대.`);
    if (d.level >= B.DANGER) out.push(`${d.name} 아래서 물소리가 커졌대. 근처 마을은 짐을 싸 둔다더라.`);
    else if (d.level >= B.RISK_AT) out.push(`${d.name} 입구 돌계단이 축축해졌다는 말이 돌아.`);
    if (d.dead > 0) out.push(`${d.name}에서 돌아오지 못한 조가 있대. 등불회가 초를 켰다더라.`);
    const st = devStage(d);
    if (d.wild > 0 && st === 1) out.push(`${d.name} 길목에 여관이 들어선대. 목수들이 바빠졌어.`);
    if (d.branch) out.push(`${iga(W.guilds[d.branch].name)} ${d.name} 곁에 지부 깃발을 꽂았대.`);
  });
  for (const g of GUILDS) {
    const o = W.guilds[g];
    if (o.money < 0) out.push(`${o.name} 금고가 바닥이라 조원들 품삯이 밀렸다더라.`);
    if (o.fav < 25) out.push(`${o.name} 사람들은 관리국 얘기만 나오면 혀를 찬대.`);
    else if (o.fav >= 70) out.push(`${o.name}에선 관리국 국장 칭찬이 자자하더라.`);
  }
  if (W.order && !W.order.done) out.push('폐광 앞 왕국군이 언제 물러나느냐고 다들 묻는다.');
  if (W.order?.done === 'ok') out.push('폐광 앞 막사가 걷혔대. 이제 관리국 몫이라더라.');
  if (levelOf(W.standing) >= 2) out.push('관리국 서류라면 길드 장부꾼들도 한 번 더 읽는대.');
  return [...out, ...AIR];
}

// 지금 들을 소문 하나: 날과 시간 칸(몇 초마다)으로 차례를 돌린다
export function rumorAt(W: World, slot: number) {
  const rs = rumorsOf(W);
  return rs[(slot + W.day * 7) % rs.length];
}
