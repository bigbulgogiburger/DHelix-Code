# dbcode

## 프로젝트 개요
dbcode는 로컬 및 외부 LLM(대형 언어 모델)을 위한 CLI AI 코딩 어시스턴트입니다.  
TypeScript로 작성되었으며, 다양한 도구와 명령어를 통해 개발자의 코딩 작업을 지원합니다.

## 주요 기능
- 파일 읽기, 쓰기, 편집 도구 지원
- 쉘 명령 실행 도구
- 파일 및 디렉터리 검색 도구
- 웹 검색 및 웹 페이지 내용 가져오기 도구
- Jupyter 노트북 편집 도구
- 사용자 입력 요청 도구
- 에이전트 기능을 통한 복잡한 작업 자동화
- 세션 관리 및 컨텍스트 관리
- 다양한 커맨드(undo, rewind, plan, memory 등) 지원
- 스킬(사용자 정의 명령어) 로딩 및 실행
- 헤드리스 모드 지원 (명령어 실행 후 결과 출력 및 종료)

## 기술 스택
- Node.js 20 이상
- TypeScript
- React 및 Ink (CLI UI 렌더링)
- Vitest (테스트)
- ESLint, Prettier (코드 품질 및 포맷팅)
- tsup (빌드)

## 빌드 및 실행
- 빌드: `npm run build` (tsup 사용)
- 테스트: `npm test` (vitest 사용)
- 린트: `npm run lint` (eslint 사용)

## 주요 파일 및 디렉터리
- `src/index.ts`: CLI 진입점, 명령어 및 도구 등록, 세션 및 컨텍스트 관리, UI 렌더링
- `src/commands/`: 다양한 CLI 명령어 구현
- `src/tools/definitions/`: 도구(툴) 정의 (파일 읽기, 쓰기, 웹 검색 등)
- `src/core/`: 세션, 컨텍스트, 에이전트 루프 등 핵심 로직
- `src/cli/`: CLI UI 컴포넌트 및 훅
- `src/skills/`: 사용자 정의 스킬 관리
- `bin/dbcode.mjs`: 실행 가능한 CLI 바이너리

## 사용법 예시
- 프로젝트 초기화: `dbcode init`
- 특정 명령어 실행: `dbcode <command>`
- 헤드리스 모드에서 프롬프트 실행 및 결과 출력: `dbcode --print "your prompt here"`

## 라이선스
MIT

---

이 설명서는 프로젝트의 주요 구조와 사용법을 간략히 정리한 것입니다.  
더 자세한 내용은 소스 코드를 참고하거나, 각 명령어의 도움말을 확인하세요.
