// 테스트 사이마다 이벤트 루프를 한 바퀴 돌린다: vitest는 테스트를 마이크로태스크로 줄줄이 이어 돌려서,
// 동기로 오래 도는 테스트가 이어지면 워커가 메시지를 못 받고 60초 뒤 "Timeout calling onTaskUpdate"를 낸다(CI에서 가끔)
import { afterEach } from 'vitest';
afterEach(() => new Promise<void>(r => setTimeout(r, 0)));
