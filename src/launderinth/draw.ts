// Launderinth 지도 그리기: 칸 경계가 보이지 않게 번지는 땅, 둥글게 이어진 길, 건물 · 영주성 · 마을 그림.
// 읽어서 그리기만 한다. 판 상태를 바꾸지 않고, 판의 난수도 쓰지 않는다(칸 번호 해시와 시간만 쓴다).
import { World, Kind, MW, MH, CASTLE, VILLAGE, TOWN, jobsOf, townStage, xy } from './engine';

const hash = (i: number, s = 0) => { let h = (i * 2654435761 + s * 40503) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h = (h ^ (h >>> 15)) >>> 0; return (h % 10000) / 10000; };

const GROUND: Record<string, [number, number, number]> = {
  grass: [66, 86, 46], forest: [40, 58, 36], rock: [88, 82, 74], water: [38, 66, 84], castle: [70, 88, 48], plot: [84, 80, 50],
};

// ── 땅 ────────────────────────────────────────────────
// 칸마다 한 점씩 칠한 작은 그림을 부드럽게 늘려, 칸 사이가 번지게 한다
export function buildBg(w: World, TS: number, dpr: number): HTMLCanvasElement {
  const W = MW * TS, H = MH * TS;
  const out = document.createElement('canvas'); out.width = Math.round(W * dpr); out.height = Math.round(H * dpr);
  const g = out.getContext('2d')!; g.scale(dpr, dpr);
  const lo = document.createElement('canvas'); lo.width = MW; lo.height = MH;
  const lg = lo.getContext('2d')!; const im = lg.createImageData(MW, MH);
  for (let i = 0; i < MW * MH; i++) {
    const t = w.tiles[i]; const c = GROUND[t.t]; const v = (hash(i) - 0.5) * 12;
    im.data.set([c[0] + v, c[1] + v * 1.1, c[2] + v * 0.8, 255], i * 4);
  }
  lg.putImageData(im, 0, 0);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(lo, 0, 0, W, H);
  // 잔 얼룩: 풀빛이 한결같지 않게
  for (let n = 0; n < MW * MH * 7; n++) {
    const x = hash(n, 1) * W, y = hash(n, 2) * H, i = Math.floor(y / TS) * MW + Math.floor(x / TS), t = w.tiles[i]?.t;
    if (t === 'water') continue;
    g.fillStyle = hash(n, 3) < 0.5 ? 'rgba(255,255,220,.045)' : 'rgba(0,0,0,.06)';
    g.beginPath(); g.ellipse(x, y, TS * (0.12 + hash(n, 4) * 0.22), TS * (0.06 + hash(n, 5) * 0.12), 0, 0, 7); g.fill();
  }
  // 개울: 가장자리 하이라이트
  for (let i = 0; i < MW * MH; i++) if (w.tiles[i].t === 'water') {
    const [x, y] = xy(i); g.strokeStyle = 'rgba(190,225,235,.22)'; g.lineWidth = 1.2; g.beginPath();
    g.moveTo(x * TS + TS * 0.1, y * TS + TS * 0.35); g.quadraticCurveTo(x * TS + TS * 0.5, y * TS + TS * 0.2, x * TS + TS * 0.9, y * TS + TS * 0.4); g.stroke();
  }
  // 풀 · 꽃 · 숲 · 바위: 칸 안 여러 곳에 흩어서
  for (let i = 0; i < MW * MH; i++) {
    const t = w.tiles[i]; const [tx, ty] = xy(i); const x0 = tx * TS, y0 = ty * TS;
    if (t.b === 'road') continue;
    if (t.t === 'grass' || t.t === 'plot') {
      for (let k = 0; k < 3; k++) {
        const x = x0 + hash(i, 10 + k) * TS, y = y0 + hash(i, 20 + k) * TS;
        g.strokeStyle = t.t === 'plot' ? 'rgba(60,50,25,.35)' : 'rgba(30,48,22,.5)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - 1, y - TS * 0.12); g.moveTo(x, y); g.lineTo(x + 1.5, y - TS * 0.1); g.stroke();
      }
      if (t.t === 'grass' && hash(i, 30) > 0.9) { g.fillStyle = hash(i, 31) < 0.5 ? '#e6d36a' : '#e8e4da'; g.beginPath(); g.arc(x0 + hash(i, 32) * TS, y0 + hash(i, 33) * TS, Math.max(1, TS * 0.04), 0, 7); g.fill(); }
    }
    if (t.t === 'forest') {
      const n = 2 + Math.floor(hash(i, 40) * 3);
      for (let k = 0; k < n; k++) tree(g, x0 + (0.2 + hash(i, 41 + k) * 0.6) * TS, y0 + (0.45 + hash(i, 51 + k) * 0.5) * TS, TS * (0.34 + hash(i, 61 + k) * 0.14), hash(i, 71 + k));
    }
    if (t.t === 'rock') {
      const n = 1 + Math.floor(hash(i, 80) * 2.4);
      for (let k = 0; k < n; k++) boulder(g, x0 + (0.25 + hash(i, 81 + k) * 0.5) * TS, y0 + (0.4 + hash(i, 91 + k) * 0.45) * TS, TS * (0.22 + hash(i, 101 + k) * 0.16), hash(i, 111 + k));
    }
  }
  roads(g, w, TS);
  return out;
}
function tree(g: CanvasRenderingContext2D, x: number, y: number, r: number, v: number) {
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(x, y + r * 0.35, r * 0.95, r * 0.35, 0, 0, 7); g.fill();
  g.fillStyle = '#4a3322'; g.fillRect(x - r * 0.1, y - r * 0.2, r * 0.2, r * 0.6);
  const c = ['#26381f', '#2b4222', '#33492a'][Math.floor(v * 3)];
  g.fillStyle = c; g.beginPath(); g.arc(x, y - r * 0.55, r * 0.72, 0, 7); g.arc(x - r * 0.45, y - r * 0.25, r * 0.5, 0, 7); g.arc(x + r * 0.45, y - r * 0.25, r * 0.5, 0, 7); g.fill();
  g.fillStyle = 'rgba(190,230,140,.14)'; g.beginPath(); g.arc(x - r * 0.2, y - r * 0.8, r * 0.3, 0, 7); g.fill();
}
function boulder(g: CanvasRenderingContext2D, x: number, y: number, r: number, v: number) {
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x + 1, y + r * 0.5, r, r * 0.38, 0, 0, 7); g.fill();
  g.fillStyle = v < 0.5 ? '#6a645b' : '#5c574f'; g.beginPath();
  g.moveTo(x - r, y + r * 0.35); g.lineTo(x - r * 0.7, y - r * 0.4); g.lineTo(x - r * 0.1, y - r * 0.8); g.lineTo(x + r * 0.7, y - r * 0.45); g.lineTo(x + r, y + r * 0.35); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.moveTo(x - r * 0.6, y - r * 0.3); g.lineTo(x - r * 0.1, y - r * 0.75); g.lineTo(x + r * 0.1, y - r * 0.4); g.closePath(); g.fill();
}
// 길: 이어진 칸의 가운데를 굵은 둥근 선으로 잇는다
function roads(g: CanvasRenderingContext2D, w: World, TS: number) {
  const pts: [number, number, number][] = [];
  for (let i = 0; i < MW * MH; i++) if (w.tiles[i].b === 'road') { const [x, y] = xy(i); pts.push([i, x * TS + TS / 2, y * TS + TS / 2]); }
  const seg = (f: (i: number, x: number, y: number, n: [number, number] | null) => void) => {
    for (const [i, x, y] of pts) {
      const [tx, ty] = xy(i);
      const E = tx + 1 < MW && w.tiles[i + 1].b === 'road', S = ty + 1 < MH && w.tiles[i + MW].b === 'road';
      f(i, x, y, null); if (E) f(i, x, y, [x + TS, y]); if (S) f(i, x, y, [x, y + TS]);
    }
  };
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [wd, col] of [[0.74, '#4d3d27'], [0.62, '#8a7350']] as const) {
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = TS * wd;
    seg((_i, x, y, n) => { if (n) { g.beginPath(); g.moveTo(x, y); g.lineTo(n[0], n[1]); g.stroke(); } else { g.beginPath(); g.arc(x, y, TS * wd / 2, 0, 7); g.fill(); } });
  }
  for (const [i, x, y] of pts) { // 자갈 · 바퀴 자국
    for (let k = 0; k < 4; k++) { g.fillStyle = hash(i, 200 + k) < 0.5 ? 'rgba(255,240,200,.16)' : 'rgba(40,28,10,.2)'; g.beginPath(); g.arc(x + (hash(i, 210 + k) - 0.5) * TS * 0.6, y + (hash(i, 220 + k) - 0.5) * TS * 0.5, Math.max(1, TS * 0.04), 0, 7); g.fill(); }
  }
}

// ── 건물 ──────────────────────────────────────────────
function shadow(g: CanvasRenderingContext2D, x: number, y: number, w: number) { g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x + w * 0.08, y, w * 0.62, w * 0.17, 0, 0, 7); g.fill(); }
function roof(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string, dark = 'rgba(0,0,0,.25)') {
  g.fillStyle = col; g.beginPath(); g.moveTo(x - w * 0.62, y); g.lineTo(x, y - h); g.lineTo(x + w * 0.62, y); g.closePath(); g.fill();
  g.fillStyle = dark; g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + w * 0.62, y); g.lineTo(x, y); g.closePath(); g.fill();
}
function house(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, wall: string, rf: string) {
  shadow(g, x, y, w);
  g.fillStyle = wall; g.fillRect(x - w / 2, y - h, w, h);
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + w * 0.1, y - h, w * 0.4, h);
  roof(g, x, y - h, w, h * 0.7, rf);
  g.fillStyle = '#2a1d12'; g.fillRect(x - w * 0.09, y - h * 0.5, w * 0.18, h * 0.5);
  g.fillStyle = 'rgba(255,225,140,.85)'; g.fillRect(x - w * 0.38, y - h * 0.72, w * 0.16, w * 0.16); g.fillRect(x + w * 0.22, y - h * 0.72, w * 0.16, w * 0.16);
}
export function drawBuilding(g: CanvasRenderingContext2D, k: Kind, x: number, y: number, TS: number, lv: number, now: number, lit: boolean) {
  const w = TS * 0.92; g.save(); if (!lit) g.globalAlpha = 0.5;
  if (k === 'inn') { house(g, x, y, w, TS * 0.7, '#b9955f', '#8f3a2c'); g.fillStyle = '#e9dcc0'; g.fillRect(x + w * 0.3, y - TS * 1.1, w * 0.3, w * 0.22); g.fillStyle = '#3a2a1a'; g.fillRect(x + w * 0.44, y - TS * 1.2, 1.5, w * 0.3); }
  else if (k === 'tavern') { house(g, x, y, w * 0.95, TS * 0.58, '#9a7448', '#6b4a2a'); g.fillStyle = '#6a4a28'; g.fillRect(x - w * 0.62, y - TS * 0.2, w * 0.18, TS * 0.2); g.fillStyle = '#e8c35a'; g.beginPath(); g.arc(x + w * 0.5, y - TS * 0.62, TS * 0.07, 0, 7); g.fill(); }
  else if (k === 'rental') { shadow(g, x, y, w); g.fillStyle = '#6f7882'; g.fillRect(x - w / 2, y - TS * 0.5, w, TS * 0.5); roof(g, x, y - TS * 0.5, w, TS * 0.3, '#434b55'); g.strokeStyle = '#c9ced3'; g.lineWidth = 1.5; for (let n = 0; n < 3; n++) { g.beginPath(); g.moveTo(x - w * 0.3 + n * w * 0.3, y - TS * 0.12); g.lineTo(x - w * 0.2 + n * w * 0.3, y - TS * 0.42); g.stroke(); } }
  else if (k === 'hospital') { shadow(g, x, y, w * 1.05); g.fillStyle = '#ddd7c8'; g.fillRect(x - w * 0.55, y - TS * 0.72, w * 1.1, TS * 0.72); roof(g, x, y - TS * 0.72, w * 1.1, TS * 0.22, '#9a4a42'); g.fillStyle = '#c2483d'; g.fillRect(x - w * 0.06, y - TS * 0.56, w * 0.12, w * 0.34); g.fillRect(x - w * 0.17, y - TS * 0.45, w * 0.34, w * 0.12); }
  else if (k === 'casino') { shadow(g, x, y, w * 1.05); g.fillStyle = '#5b2346'; g.fillRect(x - w * 0.55, y - TS * 0.8, w * 1.1, TS * 0.8); g.fillStyle = '#3d1730'; g.fillRect(x - w * 0.55, y - TS * 0.8, w * 1.1, TS * 0.14);
    const on = Math.floor(now / 380) % 2; for (let n = 0; n < 6; n++) { g.fillStyle = (n + on) % 2 ? '#e8c35a' : '#b4609a'; g.beginPath(); g.arc(x - w * 0.45 + n * w * 0.18, y - TS * 0.72, Math.max(1.4, TS * 0.04), 0, 7); g.fill(); }
    g.fillStyle = '#e8c35a'; g.font = `700 ${Math.floor(TS * 0.26)}px "IBM Plex Mono"`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('777', x, y - TS * 0.42); g.fillStyle = '#2a1020'; g.fillRect(x - w * 0.1, y - TS * 0.22, w * 0.2, TS * 0.22); }
  else if (k === 'cathedral') { shadow(g, x, y, w * 1.2); g.fillStyle = '#9a9588'; g.fillRect(x - w * 0.5, y - TS * 0.7, w, TS * 0.7); g.fillStyle = '#85806f'; g.fillRect(x + w * 0.1, y - TS * 0.7, w * 0.4, TS * 0.7); roof(g, x, y - TS * 0.7, w, TS * 0.3, '#5b6270');
    g.fillStyle = '#9a9588'; g.fillRect(x - w * 0.12, y - TS * 1.3, w * 0.24, TS * 0.6); g.fillStyle = '#5b6270'; g.beginPath(); g.moveTo(x - w * 0.16, y - TS * 1.3); g.lineTo(x, y - TS * 1.62); g.lineTo(x + w * 0.16, y - TS * 1.3); g.fill(); g.fillStyle = '#e8c35a'; g.fillRect(x - 0.8, y - TS * 1.78, 1.6, TS * 0.2); g.fillRect(x - TS * 0.06, y - TS * 1.72, TS * 0.12, 1.6); }
  for (let n = 1; n < lv; n++) { g.fillStyle = '#d9b45a'; g.beginPath(); g.moveTo(x - w * 0.5 + n * TS * 0.16, y + 3); g.lineTo(x - w * 0.5 + n * TS * 0.16 + TS * 0.06, y + 3 - TS * 0.12); g.lineTo(x - w * 0.5 + n * TS * 0.16 + TS * 0.12, y + 3); g.fill(); }
  g.restore();
}
// 미궁 어귀: 층이 깊을수록 붉게 달아오른다
export function drawGateArt(g: CanvasRenderingContext2D, x: number, y: number, TS: number, delve: number, now: number) {
  const r = TS * 0.5, glow = 0.25 + 0.07 * delve + 0.15 * Math.sin(now / 500);
  g.fillStyle = `rgba(194,72,61,${glow})`; g.beginPath(); g.arc(x, y, r * 1.5, 0, 7); g.fill();
  g.fillStyle = '#4b463f'; g.beginPath(); g.moveTo(x - r * 1.3, y + r); g.lineTo(x - r * 1.1, y - r * 0.6); g.lineTo(x, y - r * 1.45); g.lineTo(x + r * 1.1, y - r * 0.6); g.lineTo(x + r * 1.3, y + r); g.closePath(); g.fill();
  g.fillStyle = '#0b0807'; g.beginPath(); g.moveTo(x - r * 0.62, y + r); g.lineTo(x - r * 0.62, y - r * 0.2); g.arc(x, y - r * 0.2, r * 0.62, Math.PI, 0); g.lineTo(x + r * 0.62, y + r); g.fill();
  g.strokeStyle = '#7a7064'; g.lineWidth = 1.5; g.stroke();
  for (let n = 1; n < delve; n++) { g.fillStyle = '#c2483d'; g.fillRect(x - r * 1.0 + n * r * 0.38, y - r * 1.2, 2, r * 0.3); }
}

// ── 영주성 ────────────────────────────────────────────
export function drawCastle(g: CanvasRenderingContext2D, TS: number, ox: number, oy: number, rank: number, now: number, sel: boolean) {
  const [x0, y0] = xy(CASTLE[0][1] * MW + CASTLE[0][0]); // 왼쪽 위 칸
  const L = ox + x0 * TS, T = oy + y0 * TS, w = TS * 2, bY = T + TS * 2 - TS * 0.1;
  shadow(g, L + w / 2, bY + 2, w * 0.95);
  g.fillStyle = '#8d877a'; g.fillRect(L + w * 0.08, bY - TS * 0.8, w * 0.84, TS * 0.8); // 성벽
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(L + w * 0.5, bY - TS * 0.8, w * 0.42, TS * 0.8);
  g.fillStyle = '#8d877a'; for (let n = 0; n < 7; n++) g.fillRect(L + w * 0.08 + n * w * 0.14, bY - TS * 0.92, w * 0.08, TS * 0.12); // 총안
  for (const tx of [L + w * 0.08, L + w * 0.92]) { // 탑
    g.fillStyle = '#a29c8e'; g.fillRect(tx - TS * 0.22, bY - TS * 1.35, TS * 0.44, TS * 1.35);
    g.fillStyle = '#3d5a78'; g.beginPath(); g.moveTo(tx - TS * 0.32, bY - TS * 1.35); g.lineTo(tx, bY - TS * 1.95); g.lineTo(tx + TS * 0.32, bY - TS * 1.35); g.fill();
    g.fillStyle = '#2a2218'; g.fillRect(tx - TS * 0.04, bY - TS * 1.0, TS * 0.08, TS * 0.16);
  }
  g.fillStyle = '#a29c8e'; g.fillRect(L + w * 0.36, bY - TS * 1.3, w * 0.28, TS * 1.3); // 본성
  g.fillStyle = '#3d5a78'; g.beginPath(); g.moveTo(L + w * 0.32, bY - TS * 1.3); g.lineTo(L + w * 0.5, bY - TS * 1.8); g.lineTo(L + w * 0.68, bY - TS * 1.3); g.fill();
  g.fillStyle = '#2a1d12'; g.beginPath(); g.moveTo(L + w * 0.62, bY); g.lineTo(L + w * 0.62, bY - TS * 0.34); g.arc(L + w * 0.75, bY - TS * 0.34, w * 0.13, Math.PI, 0); g.lineTo(L + w * 0.88, bY); g.fill(); // 성문
  const fx = L + w * 0.5, fy = bY - TS * 1.8; const wave = Math.sin(now / 260) * TS * 0.05; // 깃발: 계급이 오르면 길어진다
  g.strokeStyle = '#3a2a1a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx, fy - TS * 0.45); g.stroke();
  g.fillStyle = ['#7a2e63', '#2f6a8a', '#d9b45a'][rank] ?? '#7a2e63'; g.beginPath(); g.moveTo(fx, fy - TS * 0.45); g.quadraticCurveTo(fx + TS * (0.2 + rank * 0.05), fy - TS * 0.45 + wave, fx + TS * (0.36 + rank * 0.1), fy - TS * 0.36); g.quadraticCurveTo(fx + TS * 0.2, fy - TS * 0.28 - wave, fx, fy - TS * 0.22); g.fill();
  if (sel) { g.strokeStyle = '#d9b45a'; g.lineWidth = 2; g.strokeRect(L - 2, T - TS * 1.0, w + 4, TS * 3.0); }
}

// ── 마을 ──────────────────────────────────────────────
// 터 여덟 칸: 처음엔 밭과 농가, 미궁이 돈이 되면 밭이 골목과 가게로 바뀐다
const LOTS = (() => { const a: { x: number; y: number }[] = []; for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) a.push({ x: VILLAGE.x0 + 0.1 + c * 1.72, y: VILLAGE.y0 + 0.1 + r * 1.95 }); return a; })();
function lotKind(stage: number, i: number): 'house' | 'field' | 'market' {
  const houses = [2, 4, 6, 8][stage], market = [0, 1, 1, 2][stage];
  if (i < houses) return 'house'; if (i < houses + market) return 'market'; return 'field';
}
function field(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, i: number) {
  g.fillStyle = '#6b5632'; g.fillRect(x, y, w, h);
  for (let n = 0; n < 5; n++) { g.fillStyle = i % 2 ? '#b8a24a' : '#5f8a3c'; g.fillRect(x + w * 0.06 + n * w * 0.18, y + h * 0.08, w * 0.11, h * 0.84); }
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; g.strokeRect(x, y, w, h);
}
function person(g: CanvasRenderingContext2D, x: number, y: number, s: number, col: string, hat: string, tool: boolean) {
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x, y + s * 0.5, s * 0.6, s * 0.22, 0, 0, 7); g.fill();
  g.fillStyle = col; g.fillRect(x - s * 0.32, y - s * 0.2, s * 0.64, s * 0.7);
  g.fillStyle = '#e0b890'; g.beginPath(); g.arc(x, y - s * 0.42, s * 0.34, 0, 7); g.fill();
  g.fillStyle = hat; g.beginPath(); g.ellipse(x, y - s * 0.6, s * 0.55, s * 0.2, 0, 0, 7); g.fill(); g.fillRect(x - s * 0.28, y - s * 0.85, s * 0.56, s * 0.28);
  if (tool) { g.strokeStyle = '#6b4a2a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + s * 0.5, y + s * 0.4); g.lineTo(x + s * 0.8, y - s * 0.7); g.stroke(); }
}
export function villageStage(w: World) { return townStage(w); }
export function drawVillage(g: CanvasRenderingContext2D, w: World, TS: number, ox: number, oy: number, now: number, sel: boolean): { y: number; draw: () => void }[] {
  const st = townStage(w), items: { y: number; draw: () => void }[] = [];
  const P = (tx: number, ty: number) => [ox + tx * TS, oy + ty * TS] as const;
  LOTS.forEach((lot, i) => {
    const kind = lotKind(st, i); const [lx, ly] = P(lot.x, lot.y), lw = TS * 1.5, lh = TS * 1.7;
    if (kind === 'field') { field(g, lx, ly + lh * 0.12, lw, lh * 0.72, i); return; }
    items.push({ y: ly + lh, draw: () => {
      const cx = lx + lw / 2, by = ly + lh * 0.82;
      g.fillStyle = 'rgba(120,98,60,.5)'; g.beginPath(); g.ellipse(cx, by, lw * 0.52, lh * 0.2, 0, 0, 7); g.fill(); // 마당
      if (kind === 'market') { // 장터: 천막 가판
        shadow(g, cx, by, lw * 0.8); for (let n = 0; n < 3; n++) { g.fillStyle = n % 2 ? '#e9dcc0' : '#b4483d'; g.fillRect(cx - lw * 0.42 + n * lw * 0.28, by - TS * 0.62, lw * 0.28, TS * 0.2); }
        g.fillStyle = '#6b4a2a'; g.fillRect(cx - lw * 0.42, by - TS * 0.42, 2, TS * 0.42); g.fillRect(cx + lw * 0.42 - 2, by - TS * 0.42, 2, TS * 0.42); g.fillStyle = '#8a6a3a'; g.fillRect(cx - lw * 0.38, by - TS * 0.22, lw * 0.76, TS * 0.12);
        return;
      }
      const tall = st >= 3, wallw = lw * (0.66 + st * 0.05);
      const wall = ['#a98c5a', '#b89c68', '#c6ab78', '#d1c1a2'][st], rf = st === 3 ? ['#5e4f8a', '#8a3a4a', '#3d6a8a', '#7a6a2c'][i % 4] : ['#9b7c36', '#7a4a2c', '#8f3a2c'][st];
      house(g, cx, by, wallw, TS * (0.52 + st * 0.12), wall, rf);
      if (tall) { g.fillStyle = 'rgba(255,200,90,.9)'; g.beginPath(); g.arc(cx + wallw * 0.55, by - TS * 0.4, TS * 0.05, 0, 7); g.fill(); }
      if (st >= 2 && i % 2 === 0) { g.fillStyle = '#e9dcc0'; g.fillRect(cx - wallw * 0.5 - TS * 0.12, by - TS * 0.5, TS * 0.24, TS * 0.16); g.fillStyle = '#3a2a1a'; g.fillRect(cx - wallw * 0.5 - 1, by - TS * 0.34, 1.5, TS * 0.34); }
    } });
  });
  // 주민들
  const jobs = jobsOf(w);
  const nF = st >= 3 ? 1 : Math.min(7, Math.max(2, Math.round(jobs.farm / 30)));
  const fields = LOTS.map((l, i) => ({ l, i })).filter(({ i }) => lotKind(st, i) === 'field');
  for (let n = 0; n < nF && fields.length; n++) {
    const { l, i } = fields[n % fields.length]; const ph = now / 1700 + n * 1.9; const [lx, ly] = P(l.x, l.y);
    const px = lx + TS * (0.2 + (0.5 + 0.5 * Math.sin(ph)) * 1.1), py = ly + TS * (0.5 + 0.35 * Math.sin(ph * 0.7 + i));
    items.push({ y: py + 4, draw: () => person(g, px, py, TS * 0.3, '#8a6a3a', '#d8c26a', true) });
  }
  const street = (n: number, col: string, hat: string, speed: number, seed: number, tool = false) => {
    for (let k = 0; k < n; k++) {
      const u = (now / (9000 / speed) + hash(k, seed)) % 1, dir = k % 2 ? 1 : -1;
      const tx = VILLAGE.x0 + 0.4 + (dir > 0 ? u : 1 - u) * (VILLAGE.x1 - VILLAGE.x0 - 0.4), ty = 8.0 + 0.12 * Math.sin(now / 500 + k);
      const [px, py] = P(tx, ty + 0.5); items.push({ y: py + 6, draw: () => person(g, px, py, TS * 0.3, col, hat, tool) });
    }
  };
  if (st >= 1) street(Math.min(5, Math.round(jobs.trade / 14)), '#3d6a8a', '#e9dcc0', 1, 7);
  if (st >= 2) street(Math.min(4, Math.round(jobs.inn / 18)), '#e9dcc0', '#c2483d', 1.3, 17);
  if (st >= 3) street(Math.min(3, Math.round(jobs.guide / 18)), '#d9b45a', '#26381f', 1.6, 27, true);
  // 단계 이름표
  items.push({ y: 1e9, draw: () => {
    const [tx, ty] = P(VILLAGE.x0, VILLAGE.y1 + 0.95); g.font = `600 ${Math.max(9, Math.floor(TS * 0.34))}px "Gowun Batang"`; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(20,17,13,.7)'; const label = `${TOWN[st]} · 주민 ${jobs.pop}`, tw = g.measureText(label).width; g.fillRect(tx - 3, ty - TS * 0.22, tw + 10, TS * 0.44);
    g.fillStyle = sel ? '#d9b45a' : '#e9dcc0'; g.fillText(label, tx + 2, ty + 1);
  } });
  return items;
}
