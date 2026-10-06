// 브라우저 자동 저장: 판이 바뀔 때마다 이 브라우저에 저장해 두고, 다시 열면 이어 한다.
// 저장이 막힌 환경(사생활 보호 창 등)에서는 조용히 넘어가고, 그 판은 새로고침하면 처음부터다
import { S } from '../core/state';

const KEY = 'lb-save';
let timer: ReturnType<typeof setTimeout> | null = null;

export function saveLocal(now = false) {
  if (timer) clearTimeout(timer);
  const write = () => { timer = null; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* 저장 공간이 없거나 막혔으면 이번 판은 저장 없이 간다 */ } };
  if (now) write(); else timer = setTimeout(write, 300);
}

export function loadLocal(): any {
  try { const t = localStorage.getItem(KEY); return t ? JSON.parse(t) : null; } catch { return null; }
}

export function clearLocal() {
  if (timer) { clearTimeout(timer); timer = null; }
  try { localStorage.removeItem(KEY); } catch { /* 지울 수 없어도 새 게임은 시작한다 */ }
}
