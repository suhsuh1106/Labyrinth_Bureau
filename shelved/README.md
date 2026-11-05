# shelved: 묻어 둔 기획

지우지 않고 보관만 하는 기획이다. 지금 주 작업물은 **미궁관리국**(`index.html`, 문서는 `docs/`)이다.

## Launderinth(론더린스), 2026-11
변방 미궁 영지의 영주가 겉으로는 타이쿤을, 속으로는 비자금을 굴려 대공까지 오르는 정치 · 부패 경영 시뮬 프로토타입. 미궁관리국을 다시 잡으며 여기로 옮겼다.

- `launderinth/launderinth.html`: 진입점(빌드에 그대로 들어간다. 개발 서버에서는 `/shelved/launderinth/launderinth.html`)
- `launderinth/src/`: 엔진 `engine.ts` · 화면 `main.ts` · 봇 `bots.ts` · Tailwind `style.css`(설정은 루트의 `tailwind.config.js` · `postcss.config.js`)
- `launderinth/launderinth.md`: 기획
- `launderinth/launderinth.test.ts`: 테스트(`npm test`에 함께 돈다)
- 프로젝트 파일(레포 밖)의 화면은 `shelved/launderinth/`에 있다.

Launderinth를 만들 때 미궁관리국 문서를 `old/docs/`로 옮겼던 것은 다시 `docs/`로 되돌렸다.
