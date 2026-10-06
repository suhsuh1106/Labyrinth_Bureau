// 결재 뒤의 순간들: 도장을 찍은 뒤, 신문이 오기 전에 이달의 큰 일을 한 장씩 책상 위에 올린다.
// 귀환 보고(매달) → 공략본 적중·빗나감 → 부고 → 임기 평가 순서. 건너뛰기나 Esc로 한 번에 넘길 수 있다.
import { keepsakes, monthMoments, type Moments } from '../core/moments';
import { S } from '../core/state';
import { fmt, pct } from '../core/util';

const $ = (id: string): any => document.getElementById(id);
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- 효과음: 버튼을 누른 뒤에만 나고, 끄면 그대로 꺼져 있다 ----------
const PREF = 'lb-sound';
export const soundOn = () => { try { return localStorage.getItem(PREF) !== 'off'; } catch { return true; } };
export function toggleSound() { const on = !soundOn(); try { localStorage.setItem(PREF, on ? 'on' : 'off'); } catch { /* 저장이 막혀도 이번 화면에서는 따른다 */ } renderSoundBtn(on); }
export function renderSoundBtn(on = soundOn()) { const b = $('sound'); if (b) { b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '효과음 켬' : '효과음 끔'; } }
let ac: AudioContext | null = null;
function audio() {
  if (!soundOn()) return null;
  try { ac = ac || new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { return null; }
  return ac;
}
function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15, when = 0) {
  const a = audio(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + when;
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur);
}
// 잡음도 게임 난수를 건드리지 않게 따로 굴린다
let ns = 0x9e3779b9;
const nrand = () => { ns ^= ns << 13; ns ^= ns >>> 17; ns ^= ns << 5; return ((ns >>> 0) / 0xffffffff) * 2 - 1; };
function noise(dur: number, vol = 0.2, lp = 800) {
  const a = audio(); if (!a) return;
  const b = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = nrand() * (1 - i / d.length);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = b; f.type = 'lowpass'; f.frequency.value = lp; g.gain.value = vol;
  s.connect(f).connect(g).connect(a.destination); s.start();
}
export const sfx = {
  thud() { tone(70, 0.25, 'sine', 0.35); noise(0.12, 0.25, 500); },
  paper() { noise(0.18, 0.12, 2400); },
  tick() { tone(1200, 0.04, 'square', 0.03); },
  coin() { tone(1567, 0.08, 'triangle', 0.08); tone(2093, 0.12, 'triangle', 0.06, 0.06); },
  fanfare() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, 'triangle', 0.1, i * 0.11)); },
  low() { tone(196, 0.5, 'triangle', 0.08); tone(147, 0.7, 'triangle', 0.07, 0.18); },
  bell() { tone(196, 2.2, 'sine', 0.14); tone(392, 1.6, 'sine', 0.05); },
  crack() { noise(0.08, 0.3, 3000); tone(140, 0.15, 'sine', 0.15); },
};

// ---------- 장면 HTML (화면 밖에서도 그릴 수 있게 문자열로 만든다) ----------
const ORIGIN = { church: '교회 추천', merchant: '상단 추천' };
const partyLine = (p) => {
  const who = p.h ? '용사 파티' : p.t ? '시험 탐사' : p.c.join('·');
  const tags = `${p.g && p.g !== '일반' ? `<span class="pt-gear">${p.g}</span>` : ''}${p.a ? '<span class="pt-guide">공략본대로</span>' : ''}`;
  return `<span class="pc ${p.s ? 'ok' : 'no'}${p.h ? ' hero' : ''}"><i>${p.s ? '✓' : '–'}</i><span>${who}</span>${tags}</span>`;
};
export function returnHtml(M: Moments) {
  const R = M.ret; if (!R) return '';
  const floors = R.floors.map(F => `<section class="rf" data-f="${F.f}">
      <div class="rf-h"><b>${F.f + 1}층</b><span class="rf-sum">${F.n}조 중 ${F.w}조 성공${F.d ? ` · <span class="neg">${F.d}명 사망</span>` : ''}${F.got ? ` · 전리품 ${fmt(F.got)}G` : ''}</span></div>
      <div class="rf-p">${R.parties.filter(p => p.f === F.f).map(partyLine).join('')}</div></section>`).join('');
  const verdicts = R.verdicts.map(v => `<div class="verdict"><b>${v.f + 1}층 공략본대로 간 조 ${v.aw} / ${v.an} 성공</b>${v.on ? `<span>따르지 않은 조는 ${v.ow} / ${v.on} 성공 (${pct(v.ow / v.on)})</span>` : ''}</div>`).join('');
  return `<div class="mo-doc m-return"><div class="kind">현장 사무소 · 귀환 보고</div><h2>제${M.m}월, 파티들이 돌아왔습니다</h2>
    <div class="counters"><div class="counter"><span>성공</span><b id="c-win">${R.wins} / ${R.n}</b></div><div class="counter"><span>사망</span><b id="c-dead">${R.deaths}명</b></div><div class="counter"><span>${R.stored ? '꺼낸 전리품' : '전리품'}</span><b id="c-loot">${fmt(R.loot)}G</b></div></div>
    ${floors}
    ${R.stored ? '<p class="from">판로가 없어 꺼낸 전리품은 관리국 창고에 쌓였습니다.</p>' : ''}
    <div class="verdicts">${verdicts}</div></div>`;
}
export function guideHtml(M: Moments) {
  const G = M.guide; if (!G) return '';
  return `<div class="m-guide ${G.ok ? 'hit' : 'miss'}"><div class="kind">관리국 공략본 · ${G.f + 1}층 · 제${G.issued}월 발간</div>
      <h2>${G.f + 1}층: ${G.order}</h2>
      <p>${G.ok ? '공략본을 따른 조들이 눈에 띄게 많은 전리품을 들고 나왔습니다.' : '공략본대로 했다가 크게 당했다는 원성이 숙소에 가득합니다.'}</p>
      <div class="bigstamp" id="bs">${G.ok ? '적중' : '빗나감'}</div></div>
    <div class="dex"><div class="dexcard" id="dex"><span class="pic">${G.mon ? G.mon[0] : '?'}</span><span><span class="from">미궁 도감 · ${G.f + 1}층</span><h3>${G.mon || '아직 이름이 없는 것'}</h3>
      <span class="gains" id="gains">${G.gains.map(g => `<span class="gain ${G.ok ? '' : 'bad'}">${g}</span>`).join('')}</span></span></div></div>`;
}
export function obitHtml(M: Moments, i: number) {
  const O = M.obits[i]; if (!O) return '';
  const after = O.after === 'saint' ? '<b>교회가 용사를 미궁의 첫 성인으로 모시기로 했습니다.</b><p class="from">교회 출신 용사였고, 교회와 관리국의 사이가 나쁘지 않았습니다. 추모 미사에 용병과 신도가 줄을 섰습니다.</p>'
    : O.after === 'blame' ? '<b>교회가 이 죽음을 관리국 탓으로 돌렸습니다.</b><p class="from">"교회가 내어 준 아이를 관리국이 사지로 몰았다." 장례 설교가 변경 곳곳에 퍼졌습니다.</p>'
    : '<p class="from">숙소의 용병들이 그의 이름을 술잔에 새겼습니다. 용사 파티의 사기가 떨어졌습니다.</p>';
  return `<div class="m-obit"><div class="kind">부고</div><h2>용사 ${O.name}</h2>
    <div class="years">제${O.joined}월 합류 · 제${M.m}월 ${O.f}층에서 잠들다</div>
    <p>${O.cls} · ${ORIGIN[O.origin] || '용병'} 출신</p><div class="after">${after}</div></div>`;
}
export function reviewHtml(M: Moments) {
  const V = M.review; if (!V) return '';
  const score = V.items.filter(i => i.ok).length;
  return `<div class="m-letter" id="letter"><div class="env"><span class="secret">친전</span>
      <span class="from">제국 행정성 → 서부 변경</span><span class="to">미궁 관리국장 귀하</span><span class="from">${V.year}년 차 임기 평가 결과 재중</span>
      <button class="wax" id="wax" type="button" aria-label="봉랍을 깨고 평가서 열기">수도</button><span class="hint">봉랍을 눌러 뜯기</span></div>
    <div class="body"><div class="kind">제국 행정성 · ${V.year}년 차 임기 평가</div><h2>관리국장에게</h2>
      <div class="checks">${V.items.map(i => `<div class="check"><span class="mk ${i.ok ? 'ok' : 'ng'}">${i.ok ? '✓' : '✕'}</span><span>${i.label} · ${i.target}</span><span class="num ${i.ok ? 'pos' : 'neg'}">${i.actual}</span></div>`).join('')}</div>
      <div class="grade g-${V.grade === '우수' ? 'top' : V.grade === '미흡' ? 'low' : 'mid'}"><span class="medal">${V.grade}</span><span><b>5개 중 ${score}개 달성</b><br><span class="from">${V.reward}</span></span></div></div></div>`;
}

// 책상 위 기념품 선반
const ICON = {
  market: '<svg viewBox="0 0 40 40"><rect x="8" y="7" width="24" height="27" rx="1.5" fill="#efe4c6" stroke="#6b4a22" stroke-width="1.6"></rect><path d="M12 14h16M12 19h16M12 24h10" stroke="#8a7a5c" stroke-width="1.4"></path><circle cx="27" cy="29" r="4" fill="#b2342a"></circle></svg>',
  guide: '<svg viewBox="0 0 40 40"><rect x="9" y="6" width="22" height="28" rx="2" fill="#e8d6a8" stroke="#7a2a20" stroke-width="2"></rect><text x="20" y="24" text-anchor="middle" font-size="9" fill="#b2342a" font-weight="700">적중</text></svg>',
  key: '<svg viewBox="0 0 40 40"><circle cx="13" cy="20" r="7" fill="none" stroke="#8a6d2c" stroke-width="3"></circle><path d="M20 20H34M29 20v5M33 20v4" stroke="#8a6d2c" stroke-width="3" fill="none"></path></svg>',
  ledger: '<svg viewBox="0 0 40 40"><rect x="8" y="8" width="24" height="26" fill="#f1e8d2" stroke="#2c4a7a" stroke-width="1.6"></rect><path d="M12 15h16M12 20h16M12 25h16" stroke="#9a8c70" stroke-width="1.2"></path><ellipse cx="21" cy="20" rx="11" ry="4" fill="none" stroke="#c0281e" stroke-width="1.8"></ellipse></svg>',
  sword: '<svg viewBox="0 0 40 40"><path d="M10 30L22 18" stroke="#6a5f4f" stroke-width="3"></path><path d="M24 16L30 10" stroke="#6a5f4f" stroke-width="3" stroke-dasharray="3 3"></path><path d="M8 26l6 6" stroke="#5a3a1c" stroke-width="3"></path></svg>',
  medal: '<svg viewBox="0 0 40 40"><path d="M14 4L20 16L26 4" stroke="#b2342a" stroke-width="4" fill="none"></path><circle cx="20" cy="25" r="10" fill="#d9b45a" stroke="#8a6d2c" stroke-width="2"></circle><text x="20" y="29" text-anchor="middle" font-size="9" fill="#3a2a08" font-weight="700">우수</text></svg>',
};
export function shelfHtml(fresh = false) {
  return keepsakes().map(k => {
    const on = k.m != null, isNew = fresh && on && k.m >= S.month - 1;
    const tip = on ? `${k.name}${k.note ? ` (${k.note})` : ''} · 제${k.m}월에 책상에 걸었습니다` : `아직 비어 있음 · ${k.how}`;
    return `<span class="keep${on ? ' on' : ''}${isNew ? ' new' : ''}" title="${tip}" aria-label="${tip}"><span class="frame" aria-hidden="true">${on ? ICON[k.id] : '?'}</span><span class="kname">${on ? k.name : k.how}</span></span>`;
  }).join('');
}
export function renderShelf(fresh = false) { const el = $('shelf'); if (el) el.innerHTML = shelfHtml(fresh); }

// ---------- 무대 ----------
let skipping = false;
const wait = (ms: number) => new Promise<void>(r => (skipping || reduced() ? r() : setTimeout(r, ms)));
// anim이 붙어 있는 동안만 아직 드러나지 않은 줄을 숨긴다 (화면 밖에서 그린 HTML은 처음부터 다 보인다)
function stage(html: string, cls = '') { $('stage').hidden = false; $('stage-box').className = `stage-box ${skipping || reduced() ? '' : 'anim'} ${cls}`; $('stage-box').innerHTML = html; $('stage-box').scrollTop = 0; }
function next(label = '계속') {
  return new Promise<void>(res => {
    if (skipping) return res();
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mo-next'; b.textContent = label;
    b.onclick = () => res(); $('stage-box').appendChild(b); b.focus();
    done = res;
  });
}
let done: (() => void) | null = null;
export function skipMoments() { skipping = true; if (done) { const d = done; done = null; d(); } }
function shake() { const s = document.querySelector('.scene'); if (!s) return; s.classList.remove('shake'); void (s as HTMLElement).offsetWidth; s.classList.add('shake'); }
function tickTreasury(from: number, to: number) {
  const el = $('st-treasury'); if (!el || from === to) return Promise.resolve();
  return (async () => {
    for (let i = 1; i <= 18; i++) { await wait(32); el.textContent = fmt(from + (to - from) * i / 18) + 'G'; if (i % 4 === 0) sfx.tick(); }
    el.textContent = fmt(to) + 'G'; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  })();
}

async function playReturn(M: Moments, t0: number) {
  const R = M.ret!;
  stage(returnHtml(M), 'wide');
  const box = $('stage-box');
  let wins = 0, dead = 0, loot = 0;
  $('c-win').textContent = `0 / ${R.n}`; $('c-dead').textContent = '0명'; $('c-loot').textContent = '0G';
  const step = Math.max(25, Math.min(160, 1400 / R.n));
  for (const sec of box.querySelectorAll('.rf') as any) {
    const F = R.floors.find(x => x.f === +sec.dataset.f)!;
    for (const pc of sec.querySelectorAll('.pc') as any) {
      await wait(step); pc.classList.add('in');
      if (pc.classList.contains('ok')) { wins++; sfx.coin(); } else sfx.tick();
      $('c-win').textContent = `${wins} / ${R.n}`;
    }
    dead += F.d; loot += F.got;
    sec.classList.add('done'); $('c-dead').textContent = `${dead}명`; $('c-loot').textContent = fmt(loot) + 'G';
    if (F.d) sfx.thud();
  }
  $('c-win').textContent = `${R.wins} / ${R.n}`; $('c-dead').textContent = `${R.deaths}명`; $('c-loot').textContent = fmt(R.loot) + 'G';
  if (R.verdicts.length) { await wait(250); box.querySelector('.verdicts').classList.add('in'); sfx.paper(); }
  await tickTreasury(t0, S.treasury);
  await next();
}
async function playGuide(M: Moments) {
  const G = M.guide!;
  stage(guideHtml(M));
  await wait(600);
  $('bs').classList.add('down'); sfx.thud(); if (G.ok) shake();
  await wait(450); G.ok ? sfx.fanfare() : sfx.low();
  $('dex').classList.add('open'); sfx.paper();
  await wait(500); $('gains').classList.add('in');
  await next();
}
async function playObit(M: Moments, i: number) {
  stage(obitHtml(M, i)); sfx.bell();
  await wait(1300);
  await next('묵념');
}
async function playReview(M: Moments) {
  stage(reviewHtml(M));
  await new Promise<void>(res => { if (skipping) return res(); done = res; $('wax').onclick = () => { done = null; res(); }; $('wax').focus(); });
  $('wax').classList.add('break'); sfx.crack();
  await wait(450); $('letter').classList.add('opened'); sfx.paper();
  await wait(400);
  for (const c of $('letter').querySelectorAll('.check') as any) { c.classList.add('in'); c.querySelector('.ok') ? sfx.tick() : sfx.thud(); await wait(380); }
  await wait(250); $('letter').querySelector('.grade').classList.add('in');
  M.review!.grade === '우수' ? sfx.fanfare() : M.review!.grade === '미흡' ? sfx.low() : sfx.paper();
  await next();
}

// 결재 직후에 부른다. 다 보면(또는 건너뛰면) 끝난다
export async function playMoments(t0: number) {
  const M = monthMoments();
  skipping = false; done = null;
  try {
    if (M.ret) await playReturn(M, t0);
    if (M.guide) await playGuide(M);
    for (let i = 0; i < M.obits.length; i++) await playObit(M, i);
    if (M.review) await playReview(M);
  } finally {
    $('stage').hidden = true; $('stage-box').innerHTML = ''; done = null;
    const el = $('st-treasury'); if (el) el.textContent = fmt(S.treasury) + 'G';
    renderShelf(true);
  }
}
export const momentsOpen = () => !!$('stage') && !$('stage').hidden;
