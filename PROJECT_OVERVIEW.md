# dbcode 프로젝트 개요

## 프로젝트 개요
- 이름: dbcode
- 설명: 로컬 및 외부 LLM을 위한 AI 코딩 어시스턴트 CLI
- 언어: TypeScript
- Node.js 버전: >=20.0.0

## 주요 기능
- 다양한 LLM 모델 지원 및 API 키 설정
- 프로젝트 초기화 (init 커맨드)
- 세션 관리 및 재개 기능
- 다양한 명령어 지원 (clear, compact, help, model, resume, rewind, effort, fast, simplify, batch, debug, mcp, config, diff, doctor, stats, status, context, copy, export, fork, output-style, rename, cost, update, plan, undo, memory, keybindings 등)
- 스킬 매니저를 통한 확장성 있는 커맨드 추가
- 헤드리스 모드 지원 (프롬프트 실행 후 결과 출력)
- 동기화된 터미널 출력으로 깜빡임 최소화
- 설정 및 후킹 시스템 지원

## 설치 및 빌드
- 의존성 설치: `npm install`
- 빌드: `npm run build` (tsup 사용)
- 개발 모드: `npm run dev`
- 테스트: `npm test` (vitest 사용)
- 린트: `npm run lint` (eslint 사용)
- 포맷팅: `npm run format` (prettier 사용)
- 타입 체크: `npm run typecheck`

## 사용법
- CLI 실행: `dbcode [options] [command]`
- 주요 옵션:
  - `-m, --model <model>`: LLM 모델 이름 지정
  - `-u, --base-url <url>`: OpenAI 호환 API 기본 URL
  - `-k, --api-key <key>`: API 키 설정
  - `-v, --verbose`: 상세 로그 출력
  - `-c, --continue`: 최근 세션 계속 실행
  - `-r, --resume <session-id>`: 특정 세션 재개
  - `-p, --print <prompt>`: 헤드리스 모드에서 프롬프트 실행 및 결과 출력
  - `--output-format <format>`: 헤드리스 모드 출력 형식 (text, json, stream-json)
  - `--add-dir <dirs...>`: 추가 디렉토리 포함 (모노레포/멀티레포 지원)

## 프로젝트 구조
- `src/`: 소스 코드
  - `commands/`: CLI 명령어 구현
  - `core/`: 핵심 로직 (세션, 컨텍스트 관리 등)
  - `cli/`: CLI UI 컴포넌트 및 훅
  - `skills/`: 스킬 관리
  - `tools/definitions/`: 도구 정의 (파일 읽기, 쓰기, 웹 검색 등)
  - `llm/`: LLM 클라이언트 및 전략
  - `permissions/`: 권한 관리
  - `hooks/`: 후킹 시스템
  - `config/`: 설정 로더 및 기본값
- `bin/`: 실행 스크립트
- `dist/`: 빌드 결과물
- `test/`: 테스트 코드 및 테스트 프로젝트

## 주요 의존성
- chalk, commander, dotenv, fast-glob, ink, js-tiktoken, marked, mitt, openai, pdf-parse, pino, react, shiki, zod 등

## 에러 처리
- 연결 실패, 인증 실패, 모델 미발견, 속도 제한 등 상황별 친절한 에러 메시지 제공

---

이 문서는 프로젝트의 주요 정보를 요약한 것입니다. 자세한 내용은 소스 코드를 참고하세요.
