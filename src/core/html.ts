// 서류 문서와 표를 HTML 문자열로 만드는 도우미. 게임 규칙이 만드는 사건 문서도 이걸 쓴다

export function doc({ cls = '', kind, title, from, stamp, body }: { cls?: string; kind: string; title: string; from?: string; stamp?: string; body: string }) {
  return `<article class="doc ${cls}"><header><div><div class="kind">${kind}</div><h3>${title}</h3></div>${from ? `<div class="from">${from}</div>` : ''}</header>${stamp ? `<div class="stampmark">${stamp}</div>` : ''}${body}</article>`;
}

export function rows(list: any[]) {
  return `<div class="tablewrap"><table class="ledger">${list.map(r => r.sec ? `<tr class="sec"><td colspan="2">${r.sec}</td></tr>` : `<tr class="${r.sum ? 'sum' : ''}"><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table></div>`;
}
