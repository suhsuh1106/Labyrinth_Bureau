// 숫자·문자 표시와 작은 계산 도우미
import { rnd } from './rng';

export const josa = w => ((w.charCodeAt(w.length - 1) - 0xAC00) % 28 ? "이" : "가");

export const keyLabel = k => k.startsWith("c:") ? `${k.slice(2)}${josa(k.slice(2))} 있는 파티` : `${k.slice(2)} 장비`;

export const val = (v) => typeof v === 'function' ? v() : v;

export const fmt = n => Math.round(n).toLocaleString('ko-KR');

export const sgn = n => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const r5 = v => Math.round(v / 5) * 5;

export const pick = (arr, w) => { let x = rnd() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < arr.length; i++) { x -= w[i]; if (x <= 0) return arr[i]; } return arr[arr.length - 1]; };

export const pct = v => `${Math.round(v * 100)}%`;

export const keyWord = k => k.startsWith('c:') ? k.slice(2) : `${k.slice(2)} 장비`;

export const eul = w => ((w.charCodeAt(w.length - 1) - 0xAC00) % 28 ? '을' : '를');
