// 탐사 재생 장면: 귀환한 조 하나의 하루하루를 오토 배틀러처럼 다시 보여 준다.
// 왼쪽에 조원 카드, 오른쪽에 그 구간의 사건(만난 몬스터 · 채집 지점 · 흔적). 조원마다 해냈나가 차례로 뜨고, 승 · 패, 짐, 부상 주사위(포션 · 다침 · 죽음)가 이어진다.
// 기록(W.last.ours[i].days · trip)을 읽어 보여 주기만 한다. 상태를 쓰지 않고 난수도 쓰지 않는다.
// 약점 · 역효과는 도감에서 확정해 둔 것만 띄운다 (모르는 것을 화면이 알려 주지 않는다)
import { FLOORS, ITEMS, type Person, type World, floorMons, synTags } from '../../core/company';
import { PAIR_CLASS } from '../../core/data';
import { badSure } from '../../core/dex';
import { TRIP_END } from '../../core/events';
import { EV_NAME, dayCls, dayMark, packBar } from './roster';
import { evOf } from '../../core/expedition';

const ICON: Record<string, string> = { 전사: '🛡️', 궁수: '🏹', 마법사: '🔮', 사제: '✝️', 도적: '🗡️' };
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const DICE: Record<string, [string, string]> = { p: ['포션', 'pot'], h: ['다침', 'hurt'], d: ['†', 'dead'], s: ['버팀', 'save'] };
const SPEEDS = [1, 2, 4];

type Step = { ms: number; fn: () => void };
let cur: { el: HTMLElement; stop: () => void } | null = null;

export function closeScene() { if (cur) cur.stop(); }

// i: W.last.ours의 자리 (src가 'back'이면 이번 달 돌아온 조 W.back의 자리). sfx: 소리 (coMain의 SOUND)
export function openScene(W: World, i: number, sfx: (k: string) => void = () => {}, src = 'last') {
  const L = W.last, x = src === 'back' ? (W.back || [])[i]?.rep : L && L.ours[i];
  if (!x || !x.days || !x.trip) return;
  closeScene();
  const D = x.days, T = x.trip, F = FLOORS[x.f], cls = x.cls || [], nm = x.nm || cls, n = cls.length, ld = x.ld ?? -1;
  const mons = floorMons(W, x.f), dex = W.dex || {};
  const gear = x.keys.filter(k => k.startsWith('g:'));
  const tags = synTags(cls.map((c, m) => ({ id: m, c, lead: m === ld }) as Person));
  // 확정해 둔 약점(장비 꼴 'g:화염')을 이 조원이 맡고 있나: 그 장비를 들고 갔거나 그 속성을 맡는 직업
  const keyHit = (mon: string, m: number) => { const K = dex[mon]; return !!K && Object.entries(K.key).some(([k, a]) => a === 'yes' && (gear.includes(k) || PAIR_CLASS[k.slice(2)] === cls[m])); };
  const badHit = (mon: string, m: number) => { const b = badSure(dex[mon]); return !!b && ld < 0 && PAIR_CLASS[b.slice(2)] === cls[m] && !gear.includes(b); };
  const badGear = (mon: string) => { const b = badSure(dex[mon]); return !!b && ld < 0 && gear.includes(b); };
  const no = (x.t ?? i) + 1;

  const el = document.createElement('div');
  el.className = 'sc-wrap';
  el.innerHTML = `<div class="sc-box" role="dialog" aria-modal="true" aria-label="${no}조 탐사 재생">
    <header><b>${no}조</b> <span>${esc(F.name)}</span> <span class="sc-day">출발</span>
      <span class="sc-ctl"><button type="button" data-sc="pause">일시정지</button><button type="button" data-sc="speed">×1</button><button type="button" data-sc="end">끝까지</button><button type="button" data-sc="close" aria-label="닫기">✕</button></span></header>
    <div class="sc-stage">
      <div class="sc-party">${cls.map((c, m) => `<div class="sc-m" data-m="${m}"><span class="ic" aria-hidden="true">${ICON[c] || '·'}</span><b>${esc(nm[m] || c)}</b><small>${esc(c)}${m === ld ? ' · 단장' : ''}</small><span class="mk"></span><span class="sc-fx"></span></div>`).join('')}</div>
      <div class="sc-vs"><span class="sc-verdict">VS</span></div>
      <div class="sc-mon"><span class="ic" aria-hidden="true">?</span><b>—</b><small></small><span class="sc-fx"></span></div>
    </div>
    ${tags.length ? `<p class="sc-tags">${tags.map(([a, b]) => `<span title="${esc(b)}">${esc(a)}</span>`).join('')}</p>` : ''}
    <p class="sc-log" aria-live="polite">횃불을 켜고 들어간다</p>
    <footer><span class="sc-days">${D.map((d, j) => `<i data-j="${j}"${j && d.dd !== D[j - 1].dd ? ' class="nd"' : ''}></i>`).join('')}${T.end === 'torch' ? '<i class="dk" data-j="dark"></i>' : ''}</span>
      <span class="sc-sup"></span><span class="sc-pack"></span></footer>
  </div>`;
  document.body.appendChild(el);
  const $ = (s: string) => el.querySelector(s) as HTMLElement;
  const card = (m: number) => $(`.sc-m[data-m="${m}"]`);
  const log = (t: string) => { $('.sc-log').innerHTML = t; };
  const pop = (box: HTMLElement, t: string, k: string) => { const f = box.querySelector('.sc-fx') as HTMLElement; f.className = `sc-fx on ${k}`; f.textContent = t; void f.offsetWidth; f.classList.add('go'); };
  const sup = (tl: number, pl: number, fl: number, ol: number, pk: number) => {
    $('.sc-sup').innerHTML = `<span class="t">횃불 ${tl}</span><span class="p">포션 ${pl}</span><span class="f">식량 ${fl}</span><span class="o">정비 ${ol}</span>`;
    $('.sc-pack').innerHTML = packBar(T.slots, tl, pl, pk, fl, ol);
  };
  sup(T.torch, x.potC ?? 0, T.food || 0, T.tools || 0, 0);
  if (ld >= 0) card(ld).classList.add('lead');

  const steps: Step[] = [];
  const dice = (ms: string, mon: string) => [...ms].forEach((ch, m) => {
    const R = DICE[ch]; if (!R) return;
    steps.push({ ms: 380, fn: () => { card(m).classList.add('roll'); pop(card(m), '🎲', 'dice'); sfx('no'); } });
    steps.push({ ms: ch === 'd' ? 1300 : 700, fn: () => {
      const c = card(m); c.classList.remove('roll');
      if (ch === 'h') c.classList.add('hurt');
      if (ch === 'd') c.classList.add('dead');
      pop(c, R[0], R[1]); if (ch === 'd') sfx('die');
      log(`${esc(nm[m] || cls[m])} · 부상 주사위 · <b class="${R[1]}">${ch === 'p' ? '포션으로 막음' : ch === 'h' ? '다침' : ch === 'd' ? '죽음' : '죽을 뻔하고 버팀'}</b>${mon && badHit(mon, m) ? ' · 맨몸 역효과' : ''}`);
    } });
  });
  D.forEach((d, j) => {
    const M = mons.find(y => y.name === d.mon), ms = d.ms || '', dd = d.dd ?? j + 1, e = D.slice(0, j).filter(y => (y.dd ?? 0) === dd).length + 1;
    const mon = d.mon || '', ev = evOf(d), nmE = mon || EV_NAME[ev];
    steps.push({ ms: 500, fn: () => {
      $('.sc-day').textContent = d.dd ? `${dd}일째 · ${e}번째 구간` : `${dd}일째`;
      el.classList.remove('dark');
      el.querySelectorAll('.sc-m').forEach(c => c.classList.remove('ok', 'no'));
      el.querySelectorAll('.sc-m .mk').forEach(k => { k.textContent = ''; });
      const mb = $('.sc-mon'); mb.classList.remove('beaten', 'won', 'in'); void mb.offsetWidth; mb.classList.add('in');
      mb.classList.toggle('main', !!M && M.main);
      mb.dataset.ev = ev;
      (mb.querySelector('.ic') as HTMLElement).textContent = ev === 'g' ? '⛏' : ev === 't' ? '👣' : mon.slice(0, 1);
      (mb.querySelector('b') as HTMLElement).textContent = ev === 'g' ? ITEMS[x.f].name : nmE;
      (mb.querySelector('small') as HTMLElement).textContent = ev === 'g' ? '채집 지점' : ev === 't' ? '지도' : `${M && M.main ? '주 몬스터' : '곁 몬스터'}${d.am ? ' · 들킴' : ''}`;
      $('.sc-verdict').textContent = ev === 'f' ? 'VS' : '…'; $('.sc-verdict').className = 'sc-verdict';
      log(`${dd}일 · <b>${esc(nmE)}</b>${ev === 'f' ? (d.am ? ' 들켜서 조우' : ' 조우') : ''}${d.hg ? ` · <b class="hurt">굶은 사람 ${d.hg}</b>` : ''}${mon && badGear(mon) ? ' · <b class="hurt">역효과 장비</b>' : ''}`);
      sup(d.tl ?? 0, j ? D[j - 1].pl ?? 0 : x.potC ?? 0, d.fl ?? 0, j ? D[j - 1].ol ?? 0 : T.tools || 0, j ? D[j - 1].pk ?? 0 : 0);
    } });
    // 조원마다 해냈나 (기록이 없는 옛 판은 해낸 수만)
    if (ms) [...ms].forEach((ch, m) => {
      if (ch === '-') return;
      steps.push({ ms: 180, fn: () => {
        const c = card(m), ok = ch === 'o';
        c.classList.add(ok ? 'ok' : 'no');
        (c.querySelector('.mk') as HTMLElement).textContent = ok ? '✓' : '✗';
        if (ok && mon && keyHit(mon, m)) pop(c, '약점!', 'key');
        sfx(ok ? 'ok' : 'no');
      } });
    });
    steps.push({ ms: 650, fn: () => {
      const vt = ev === 'f' ? (d.win ? '승' : '패') : d.win ? '해냄' : '놓침';
      const v = $('.sc-verdict'); v.textContent = vt; v.className = `sc-verdict ${d.win ? 'w' : 'x'}`;
      $('.sc-mon').classList.add(d.win ? 'beaten' : 'won');
      const mats = d.mats.map(([a, c]) => `${esc(a)} ×${c}`).join(', ');
      log(`${vt} · ${d.k}/${d.n} 해냄${d.loot ? ` · 채집품 ${d.loot}칸` : ''}${mats ? ` · <b class="mat">${mats}</b>` : ''}${d.fx ? ' · 정비 도구로 고침' : ''}${d.bl ? ` · <b class="hurt">무뎌짐 ${d.bl}</b>` : ''}`);
      if (mats) pop($('.sc-mon'), '갈무리', 'mat');
      else if (d.loot) pop($('.sc-mon'), '채집', 'mat');
      sup(d.tl ?? 0, d.pl ?? 0, d.fl ?? 0, d.ol ?? 0, d.pk ?? 0);
      sfx(d.win ? 'gain' : 'cost');
    } });
    if (ms) dice(ms, mon);
    steps.push({ ms: 250, fn: () => { const c = $(`.sc-days i[data-j="${j}"]`); c.className = `${dayCls(d)}${j && d.dd !== D[j - 1].dd ? ' nd' : ''}`; c.textContent = dayMark(d); } });
  });
  // 어둠 속 귀환: 횃불이 떨어진 채 돌아오는 길
  if (T.end === 'torch') {
    steps.push({ ms: 900, fn: () => {
      el.classList.add('dark'); $('.sc-day').textContent = '귀환';
      const mb = $('.sc-mon'); mb.classList.remove('main', 'beaten', 'won'); (mb.querySelector('.ic') as HTMLElement).textContent = '·'; (mb.querySelector('b') as HTMLElement).textContent = '어둠'; (mb.querySelector('small') as HTMLElement).textContent = '횃불 없음';
      log(`횃불 다 씀 · <b class="hurt">어둠 속 귀환</b>${T.dark ? '' : ' · 무사히'}`);
    } });
    if (T.dm) dice(T.dm, '');
    steps.push({ ms: 250, fn: () => { const c = $('.sc-days i[data-j="dark"]'); if (T.dark) c.textContent = '!'; c.classList.add('on'); } });
  }
  steps.push({ ms: 0, fn: () => {
    const w = D.filter(d => d.win).length, dead = x.dead || [];
    $('.sc-day').textContent = TRIP_END[T.end];
    log(`<b>${TRIP_END[T.end]}</b> · ${T.fd ?? D.length}일 · 구간 ${D.length} · ${w}번 해냄 · 짐 ${T.pack}/${T.slots}칸${dead.length ? ` · <b class="dead">† ${dead.map(z => esc(z.n)).join(', ')}</b>` : ''}`);
    sfx(dead.length ? 'lose' : w * 2 >= D.length ? 'win' : 'lose');
    el.classList.add('fin'); ($('[data-sc="pause"]')).hidden = true; ($('[data-sc="end"]')).hidden = true;
  } });

  let at = 0, speed = 0, paused = false, tm: number | null = null;
  const next = () => {
    tm = null; if (paused || at >= steps.length) return;
    const s = steps[at++]; s.fn();
    tm = window.setTimeout(next, s.ms / SPEEDS[speed]);
  };
  const toEnd = () => { if (tm) clearTimeout(tm); tm = null; while (at < steps.length) steps[at++].fn(); };
  const stop = () => { if (tm) clearTimeout(tm); el.remove(); document.removeEventListener('keydown', key); if (cur && cur.el === el) cur = null; opener?.focus(); };
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') stop(); };
  const opener = document.activeElement as HTMLElement | null;
  document.addEventListener('keydown', key);
  el.addEventListener('click', e => {
    if (e.target === el) return stop();
    const b = (e.target as HTMLElement).closest('[data-sc]') as HTMLElement | null; if (!b) return;
    const a = b.dataset.sc;
    if (a === 'close') stop();
    else if (a === 'end') toEnd();
    else if (a === 'speed') { speed = (speed + 1) % SPEEDS.length; b.textContent = `×${SPEEDS[speed]}`; }
    else if (a === 'pause') { paused = !paused; b.textContent = paused ? '재생' : '일시정지'; if (!paused && !tm) next(); }
  });
  cur = { el, stop };
  ($('[data-sc="close"]')).focus();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) toEnd(); else tm = window.setTimeout(next, 400);
}
