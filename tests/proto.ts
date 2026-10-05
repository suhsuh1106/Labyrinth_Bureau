// 옛 단일 HTML 프로토타입을 Node에서 돌리는 도우미 (동작 비교용).
// 스크립트에서 화면 이벤트 연결부를 떼어 내고, Math.random을 시드 난수로 바꿔 끼운다.
import fs from 'node:fs';
import { botRng, type GameApi } from '../sim/bot';

export function loadProto(path = 'proto/budget-potion.html') {
  const html = fs.readFileSync(path, 'utf8');
  const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const core = script.slice(0, script.indexOf("document.getElementById('lines').addEventListener"));
  const make = new Function('Math', 'localStorage', core + `
    return { S: () => S, newGame, resolve, prices, project, heroPlan, DEV, AGENDAS, KEYS,
      render: () => [renderDocsTab(), renderFactionTab(), renderExploreTab(), renderBuildTab(), renderBooksTab(), renderHeroTab()].join('') };`);
  return (seed: number) => {
    const fake = Object.create(Math); fake.random = botRng(seed);
    return make(fake, undefined) as GameApi & { newGame: () => void; resolve: () => void; render: () => string };
  };
}
