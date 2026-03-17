# dbcode

**터미널에서 동작하는 AI 코딩 어시스턴트** — 자연어로 대화하면서 코드를 읽고, 수정하고, 실행할 수 있습니다.

```
$ dbcode
   ____  ____   ____ ___  ____  _____
  |  _ \| __ ) / ___/ _ \|  _ \| ____|
  | | | |  _ \| |  | | | | | | |  _|
  | |_| | |_) | |__| |_| | |_| | |___
  |____/|____/ \____\___/|____/|_____|

  AI coding assistant for local/external LLMs

> 이 프로젝트의 구조를 설명해줘

AI가 파일을 탐색하고 코드를 분석하여 답변합니다...
```

OpenAI, Anthropic Claude, Ollama 등 **OpenAI 호환 API라면 어디든** 연결할 수 있습니다.

---

## 목차

- [이런 걸 할 수 있어요](#이런-걸-할-수-있어요)
- [시작하기 전에 필요한 것](#시작하기-전에-필요한-것)
- [설치하기](#설치하기)
- [API 키 준비하기](#api-키-준비하기)
- [처음 실행하기](#처음-실행하기)
- [이렇게 사용하세요](#이렇게-사용하세요)
- [슬래시 명령어 모음](#슬래시-명령어-모음)
- [키보드 단축키](#키보드-단축키)
- [CLI 옵션 전체 목록](#cli-옵션-전체-목록)
- [무료로 사용하기 — Ollama 로컬 모델](#무료로-사용하기--ollama-로컬-모델)
- [내 프로젝트에 맞게 설정하기](#내-프로젝트에-맞게-설정하기)
- [자주 묻는 질문 (FAQ)](#자주-묻는-질문-faq)
- [문제 해결 가이드](#문제-해결-가이드)
- [지원하는 AI 모델](#지원하는-ai-모델)
- [개발에 참여하기](#개발에-참여하기)
- [라이선스](#라이선스)

---

## 이런 걸 할 수 있어요

| 요청 예시                                 | AI가 하는 일                         |
| ----------------------------------------- | ------------------------------------ |
| "이 프로젝트가 뭘 하는 건지 설명해줘"     | 파일을 탐색하고 구조를 분석해서 설명 |
| "src/index.ts에서 포트를 8080으로 바꿔줘" | 파일을 찾아서 직접 수정              |
| "테스트를 실행해줘"                       | 터미널 명령을 실행하고 결과를 분석   |
| "이 에러를 고쳐줘: TypeError..."          | 원인을 찾고 코드를 수정              |
| "User 모델에 email 필드를 추가해줘"       | 관련 파일을 모두 찾아서 일괄 수정    |
| "TODO 주석을 전부 찾아줘"                 | 프로젝트 전체를 검색해서 목록 작성   |

파일을 수정하거나 명령을 실행하기 전에는 **반드시 허용 여부를 물어봅니다** (안전합니다).

### 주요 기능

- **16개 내장 도구** — 파일 읽기/쓰기/편집, 셸 실행, 검색, 웹 검색 등
- **보안 가드레일** — 위험한 명령 차단, 비밀키 유출 방지, 프롬프트 인젝션 감지
- **세션 관리** — 대화를 저장하고 나중에 이어서 진행
- **MCP 연동** — Model Context Protocol로 외부 도구 확장 가능
- **헤드리스 모드** — UI 없이 스크립트에서 사용 가능

---

## 시작하기 전에 필요한 것

### 1. Node.js (필수)

dbcode는 Node.js 위에서 동작합니다. **버전 20 이상**이 필요합니다.

**이미 설치되어 있는지 확인:**

```bash
node --version
```

`v20.x.x` 이상이 출력되면 OK입니다.

**설치가 안 되어 있다면:**

1. [https://nodejs.org](https://nodejs.org) 접속
2. **LTS** (장기 지원 버전) 다운로드
3. 설치 파일 실행 → 안내에 따라 "다음" 클릭
4. **터미널을 새로 열고** `node --version`으로 확인

> npm은 Node.js에 포함되어 있으므로 따로 설치할 필요 없습니다.

### 2. Git (권장)

코드 관리를 위해 Git이 설치되어 있으면 좋습니다.

```bash
git --version
```

없다면 [https://git-scm.com](https://git-scm.com) 에서 설치하세요.

### 3. AI 모델 API 키 (또는 Ollama)

dbcode는 AI 모델과 통신해야 합니다. 두 가지 방법이 있습니다:

| 방법                                 | 비용               | 필요한 것 |
| ------------------------------------ | ------------------ | --------- |
| **클라우드 API** (OpenAI, Claude 등) | 유료 (사용량 기반) | API 키    |
| **Ollama** (내 컴퓨터에서 실행)      | 무료               | 8GB+ RAM  |

API 키 발급 방법은 [아래](#api-키-준비하기)에서 설명합니다.

---

## 설치하기

### 방법 A: 소스에서 빌드 (현재 권장)

```bash
# 1. 저장소 복제
git clone https://github.com/bigbulgogiburger/dbcode.git

# 2. 폴더로 이동
cd dbcode

# 3. 의존성 설치 (처음 한 번만)
npm install

# 4. 빌드
npm run build

# 5. 전역 명령어로 등록 (어디서든 'dbcode' 입력 가능)
npm link
```

설치가 끝나면 어디서든 `dbcode`를 실행할 수 있습니다.

> `npm link`를 하지 않으면 `node bin/dbcode.mjs`로 직접 실행할 수도 있습니다.

### 설치 확인

```bash
dbcode --version
```

`0.1.0`이 출력되면 설치 완료입니다.

---

## API 키 준비하기

AI를 사용하려면 API 키가 필요합니다. **처음 사용하는 분은 OpenAI를 추천합니다.**

### OpenAI API 키 발급 (5분)

1. [platform.openai.com](https://platform.openai.com) 접속 → 회원가입/로그인
2. 좌측 메뉴에서 **API keys** 클릭
3. **"Create new secret key"** 클릭
4. 이름 입력 (예: "dbcode") → **Create** 클릭
5. 생성된 키를 **복사** (⚠️ 이 화면을 닫으면 다시 볼 수 없습니다!)

> 키는 `sk-proj-...` 형태입니다. 안전한 곳에 보관하세요.

### Anthropic Claude API 키 발급

1. [console.anthropic.com](https://console.anthropic.com) 접속 → 회원가입/로그인
2. **Settings** → **API Keys** → **Create Key**
3. 생성된 키 복사 (`sk-ant-...` 형태)

### Ollama (무료, API 키 불필요)

로컬에서 AI를 실행하려면 [아래 섹션](#무료로-사용하기--ollama-로컬-모델)을 참고하세요.

---

## 처음 실행하기

### 방법 1: 설정 마법사로 시작 (가장 쉬움)

API 키 없이 그냥 실행하면 **설정 마법사**가 나타납니다:

```bash
dbcode
```

```
🔧 dbcode 초기 설정

모델을 선택하세요:
  1. Default (env: gpt-4o-mini)
  2. GPT-4o-mini (저렴)
  3. GPT-4o
  4. Claude Sonnet 4.5
  5. Claude Haiku 3.5
  6. Ollama (로컬 모델)

번호를 입력하세요 > 2

API 키를 입력하세요:
> sk-proj-여기에-키를-붙여넣으세요

✅ 설정이 저장되었습니다!
```

설정은 `~/.dbcode/config.json`에 저장되므로, **다음 실행부터는 바로 시작**됩니다.

### 방법 2: .env 파일로 설정

프로젝트 폴더에 `.env` 파일을 만들고 API 키를 넣습니다:

```bash
# .env 파일 (프로젝트 폴더에 생성)
OPENAI_API_KEY=sk-proj-여기에-키를-붙여넣으세요
```

그 다음 실행:

```bash
dbcode
```

> ⚠️ `.env` 파일은 반드시 `.gitignore`에 추가하세요! API 키가 Git에 올라가면 위험합니다.

### 방법 3: CLI 옵션으로 직접 전달

```bash
dbcode --api-key sk-proj-여기에키 --model gpt-4o
```

### 실행 성공!

아래와 같은 화면이 나타나면 성공입니다:

```
   ____  ____   ____ ___  ____  _____
  |  _ \| __ ) / ___/ _ \|  _ \| ____|
  | | | |  _ \| |  | | | | | | |  _|
  | |_| | |_) | |__| |_| | |_| | |___
  |____/|____/ \____\___/|____/|_____|

  gpt-4o-mini

>
```

`>` 프롬프트가 나타나면 자연어로 질문하면 됩니다.

### 종료하기

- `Ctrl+D` 누르기
- 또는 `exit` 입력

---

## 이렇게 사용하세요

### 코드에 대해 질문하기

```
> 이 프로젝트가 뭘 하는 건지 설명해줘
> src/utils/path.ts 파일을 읽고 설명해줘
> package.json에 있는 의존성을 정리해줘
```

### 코드 수정 요청하기

```
> 포트 번호를 3000에서 8080으로 변경해줘
> User 타입에 email 필드를 추가해줘
> 이 함수를 async/await로 변환해줘
```

수정이 필요하면 AI가 변경 내용을 보여주고 **허용 여부를 물어봅니다**:

```
🔧 file_edit: src/config.ts
 - const PORT = 3000;
 + const PORT = 8080;

Allow? [y/n]
```

`y`를 누르면 적용, `n`을 누르면 취소됩니다.

### 명령 실행 요청하기

```
> npm test를 실행해줘
> git status를 보여줘
> 이 프로젝트를 빌드해줘
```

셸 명령도 실행 전에 허용을 물어봅니다.

### 디버깅 도움받기

```
> 이 에러를 분석해줘: TypeError: Cannot read property 'map' of undefined
> 왜 테스트가 실패하는지 알려줘
> 빌드 에러를 고쳐줘
```

### 헤드리스 모드 (스크립트/CI용)

UI 없이 결과만 받고 싶을 때:

```bash
# 텍스트 출력
dbcode -p "package.json의 의존성 목록을 알려줘"

# JSON 출력
dbcode -p "src/ 폴더의 TypeScript 파일 개수" --output-format json

# 스트리밍 JSON
dbcode -p "이 코드를 리뷰해줘" --output-format stream-json
```

---

## 슬래시 명령어 모음

대화 중 `/`를 입력하면 사용 가능한 명령어 목록이 표시됩니다.

### 가장 자주 쓰는 명령어

| 명령어     | 하는 일                    | 사용 예시       |
| ---------- | -------------------------- | --------------- |
| `/help`    | 전체 도움말 보기           | `/help`         |
| `/model`   | AI 모델 바꾸기             | `/model gpt-4o` |
| `/cost`    | 지금까지 쓴 API 비용 확인  | `/cost`         |
| `/clear`   | 대화 처음부터 다시 시작    | `/clear`        |
| `/compact` | 대화 내용 압축 (토큰 절약) | `/compact`      |
| `/commit`  | Git 커밋 메시지 자동 생성  | `/commit`       |
| `/diff`    | 변경된 파일 보기           | `/diff`         |
| `/undo`    | 마지막 수정 되돌리기       | `/undo`         |

### 세션 (대화 저장/복원)

| 명령어    | 하는 일                   |
| --------- | ------------------------- |
| `/resume` | 이전 대화 이어하기        |
| `/fork`   | 현재 대화를 복사해서 분기 |
| `/rename` | 대화에 이름 붙이기        |
| `/export` | 대화를 파일로 저장        |
| `/copy`   | 대화를 클립보드에 복사    |

### 분석/진단

| 명령어       | 하는 일                        |
| ------------ | ------------------------------ |
| `/debug`     | 디버깅 모드                    |
| `/doctor`    | 설정이 올바른지 진단           |
| `/stats`     | 세션 통계 (메시지 수, 토큰 등) |
| `/context`   | 컨텍스트 사용량 확인           |
| `/analytics` | 상세 분석 대시보드             |

### 설정/모드 변경

| 명령어    | 하는 일                            |
| --------- | ---------------------------------- |
| `/config` | 현재 설정 보기                     |
| `/effort` | AI 사고 깊이 조절 (빠름/보통/깊음) |
| `/fast`   | 빠른 응답 모드 토글                |
| `/plan`   | 실행 전 계획만 보기 (dry-run)      |
| `/init`   | 프로젝트에 DBCODE.md 생성          |
| `/mcp`    | MCP 서버 관리                      |
| `/review` | 현재 변경사항 코드 리뷰            |
| `/memory` | 영구 메모리 관리                   |

---

## 키보드 단축키

| 단축키      | 동작                                       |
| ----------- | ------------------------------------------ |
| `Esc`       | AI 실행 중단 (진행 중인 작업 취소)         |
| `Ctrl+D`    | dbcode 종료                                |
| `Shift+Tab` | 권한 모드 전환 (매번 묻기 ↔ 자동 허용 등) |
| `Ctrl+O`    | 상세 출력 보기/숨기기                      |
| `Alt+T`     | AI 사고 과정 보기/숨기기                   |

> `~/.dbcode/keybindings.json`에서 단축키를 변경할 수 있습니다.

---

## CLI 옵션 전체 목록

```bash
dbcode [옵션]
```

| 옵션                     | 설명                             | 예시                                   |
| ------------------------ | -------------------------------- | -------------------------------------- |
| `-m, --model <모델>`     | 사용할 AI 모델 지정              | `dbcode -m gpt-4o`                     |
| `-u, --base-url <URL>`   | API 서버 주소                    | `dbcode -u http://localhost:11434/v1`  |
| `-k, --api-key <키>`     | API 키 직접 전달                 | `dbcode -k sk-proj-...`                |
| `-v, --verbose`          | 상세 로그 출력                   | `dbcode -v`                            |
| `-c, --continue`         | 마지막 대화 이어하기             | `dbcode -c`                            |
| `-r, --resume <ID>`      | 특정 세션 복원                   | `dbcode -r abc123`                     |
| `-p, --print <프롬프트>` | 헤드리스 모드 (UI 없이)          | `dbcode -p "설명해줘"`                 |
| `--output-format <형식>` | 출력 형식: text/json/stream-json | `dbcode -p "..." --output-format json` |
| `--add-dir <경로>`       | 추가 디렉토리 포함 (모노레포용)  | `dbcode --add-dir ../shared`           |
| `--version`              | 버전 출력                        | `dbcode --version`                     |
| `--help`                 | 도움말 출력                      | `dbcode --help`                        |

---

## 무료로 사용하기 — Ollama 로컬 모델

API 비용을 내고 싶지 않다면, 내 컴퓨터에서 AI를 돌릴 수 있습니다.

### 1단계: Ollama 설치

[https://ollama.com](https://ollama.com) 에서 OS에 맞는 버전을 다운로드 후 설치합니다.

설치 확인:

```bash
ollama --version
```

### 2단계: 모델 다운로드

```bash
# 가벼운 모델 (8B 파라미터, ~5GB, 8GB RAM이면 충분)
ollama pull qwen3:8b

# 더 똑똑한 모델 (32B 파라미터, ~20GB, 16GB+ RAM 권장)
ollama pull qwen3:32b
```

> 첫 다운로드는 시간이 걸립니다. 모델 크기에 따라 5~20분 소요됩니다.

### 3단계: dbcode와 연결

```bash
dbcode --base-url http://localhost:11434/v1 --model qwen3:8b
```

> Ollama는 API 키가 필요 없습니다! `--api-key` 옵션을 생략하면 됩니다.

### 매번 옵션을 안 치고 싶다면

프로젝트 폴더에 `.env` 파일을 만드세요:

```bash
# .env
DBCODE_BASE_URL=http://localhost:11434/v1
DBCODE_MODEL=qwen3:8b
```

이후 그냥 `dbcode`만 실행하면 됩니다.

---

## 내 프로젝트에 맞게 설정하기

### DBCODE.md — AI에게 프로젝트 규칙 알려주기

프로젝트 루트에 `DBCODE.md`를 만들면 AI가 프로젝트를 더 잘 이해합니다:

```bash
# 자동 생성
dbcode init
```

또는 직접 작성:

```markdown
# DBCODE.md

이 프로젝트는 React + TypeScript 웹 앱입니다.

## 빌드/실행

- npm run dev → 개발 서버
- npm run build → 프로덕션 빌드
- npm test → 테스트

## 규칙

- 컴포넌트는 함수형으로 작성
- CSS는 Tailwind CSS 사용
- API는 src/api/ 아래에 위치
```

### 설정 파일 우선순위

dbcode는 여러 곳에서 설정을 읽고, 아래로 갈수록 우선합니다:

```
1. 내장 기본값
2. ~/.dbcode/config.json       ← 사용자 전역 설정
3. .dbcode/settings.json       ← 프로젝트 설정
4. .env 환경변수                ← DBCODE_*, OPENAI_*
5. CLI 옵션                     ← --model, --api-key 등 (최우선)
```

### 환경변수 목록

| 변수명            | 설명                                     | 예시                        |
| ----------------- | ---------------------------------------- | --------------------------- |
| `OPENAI_API_KEY`  | OpenAI API 키                            | `sk-proj-...`               |
| `DBCODE_API_KEY`  | dbcode 전용 키 (OPENAI_API_KEY보다 우선) | `sk-proj-...`               |
| `DBCODE_MODEL`    | 기본 모델                                | `gpt-4o`                    |
| `DBCODE_BASE_URL` | API 서버 주소                            | `http://localhost:11434/v1` |
| `DBCODE_VERBOSE`  | `true`로 설정 시 상세 로그               | `true`                      |

### 권한 모드

AI가 파일을 수정하거나 명령을 실행할 때의 동작을 제어합니다.
대화 중 `Shift+Tab`으로 전환 가능:

| 모드                | 동작                                              |
| ------------------- | ------------------------------------------------- |
| `default`           | 위험한 작업은 매번 확인 (기본값, **초보자 추천**) |
| `acceptEdits`       | 파일 편집은 자동 허용, 셸 명령은 확인             |
| `plan`              | 실행 안 함 — 계획만 보여줌                        |
| `dontAsk`           | 대부분 자동 허용                                  |
| `bypassPermissions` | 모든 작업 자동 허용 (주의!)                       |

### 스킬 (커스텀 명령어) 만들기

마크다운 파일로 나만의 워크플로우를 만들 수 있습니다:

`.dbcode/skills/my-skill/SKILL.md`:

```markdown
---
name: my-skill
description: 프로젝트의 TODO를 분석합니다
---

프로젝트에서 TODO 주석을 모두 찾고, 우선순위별로 정리해주세요.
```

저장하면 `/my-skill` 명령어로 바로 사용할 수 있습니다.

---

## 자주 묻는 질문 (FAQ)

### Q: API 요금이 얼마나 나오나요?

모델마다 다릅니다:

- **GPT-4o-mini**: 매우 저렴 (하루 종일 써도 $1 이하)
- **GPT-4o**: 보통 (일반적인 사용 시 하루 $2~5)
- **Ollama**: **무료** (내 컴퓨터에서 실행)

`/cost` 명령어로 현재 세션의 비용을 확인할 수 있습니다.

### Q: 내 코드가 외부로 전송되나요?

클라우드 API(OpenAI, Claude 등)를 사용하면 **대화 내용이 API 서버로 전송됩니다**. 민감한 코드를 다룬다면 Ollama 같은 **로컬 모델**을 사용하세요.

### Q: 기존 프로젝트에서 바로 쓸 수 있나요?

네! 아무 프로젝트 폴더에서 `dbcode`를 실행하면 됩니다. 프로젝트를 수정하지 않아도 동작합니다. `DBCODE.md`를 추가하면 더 좋은 결과를 얻을 수 있습니다.

### Q: AI가 실수로 중요한 파일을 삭제할 수 있나요?

기본 설정(`default` 모드)에서는 **모든 수정/삭제/명령 실행 전에 사용자 확인을 요청**합니다. 또한 위험한 명령(`rm -rf /` 등)은 자동으로 차단됩니다.

### Q: Windows에서도 되나요?

네, Windows와 macOS 모두 지원합니다.

---

## 문제 해결 가이드

### "Cannot connect to ..." — 서버에 연결할 수 없음

```
Error: Cannot connect to https://api.openai.com/v1.
Is the server running?
```

**확인할 것:**

1. 인터넷이 연결되어 있나요?
2. VPN이나 프록시가 API를 차단하고 있지 않나요?
3. Ollama를 쓴다면: `ollama serve`가 실행 중인지 확인
   ```bash
   # Ollama 서버 상태 확인
   curl http://localhost:11434/v1/models
   ```

### "Invalid API key" — API 키가 잘못됨

```
Error: Invalid API key.
```

**확인할 것:**

1. API 키를 정확히 복사했나요? (앞뒤 공백 주의)
2. 키가 만료되지 않았나요? (API 대시보드에서 확인)
3. `.env` 파일의 형식이 맞나요?

   ```bash
   # 올바른 형식 (등호 앞뒤 공백 없음!)
   OPENAI_API_KEY=sk-proj-abc123

   # 잘못된 형식
   OPENAI_API_KEY = sk-proj-abc123    # 공백 있음
   OPENAI_API_KEY="sk-proj-abc123"    # 따옴표 있음
   ```

4. `/doctor` 명령어로 설정 진단:
   ```bash
   dbcode
   > /doctor
   ```

### "Model not found" — 모델을 찾을 수 없음

```
Error: Model 'my-model' not found.
```

**확인할 것:**

1. 모델 이름이 정확한가요?
   ```bash
   # 자주 쓰이는 모델 이름
   dbcode -m gpt-4o-mini     # OpenAI (저렴)
   dbcode -m gpt-4o          # OpenAI (고성능)
   ```
2. Ollama 사용 시 모델을 다운로드했나요?
   ```bash
   ollama list               # 설치된 모델 확인
   ollama pull qwen3:8b      # 없으면 다운로드
   ```

### "Rate limited" — 요청 제한 초과

```
Error: Rate limited. Please wait a moment and try again.
```

API 호출 한도를 초과했습니다. 1~2분 기다린 후 다시 시도하세요.
무료 플랜은 한도가 낮으므로, 유료 플랜 전환을 고려해보세요.

### Node.js 버전 에러

```
SyntaxError: Unexpected token 'import'
```

Node.js 20 이상이 필요합니다:

```bash
node --version   # v20.x.x 이상인지 확인
```

버전이 낮다면 [https://nodejs.org](https://nodejs.org) 에서 최신 LTS를 설치하세요.

### 빌드 에러 (소스에서 설치한 경우)

```bash
# 의존성 재설치
rm -rf node_modules
npm install

# 다시 빌드
npm run build
```

---

## 지원하는 AI 모델

| 제공업체         | API 서버 주소                             | 추천 모델                           | 비고                     |
| ---------------- | ----------------------------------------- | ----------------------------------- | ------------------------ |
| **OpenAI**       | `https://api.openai.com/v1`               | gpt-4o-mini, gpt-4o                 | 기본 설정                |
| **Anthropic**    | 프록시 경유                               | Claude Sonnet 4.5, Claude Haiku 3.5 | Extended Thinking 지원   |
| **Azure OpenAI** | `https://{resource}.openai.azure.com/...` | gpt-4o                              | 기업용                   |
| **Ollama**       | `http://localhost:11434/v1`               | qwen3:8b, llama3                    | 무료, 로컬               |
| **LM Studio**    | `http://localhost:1234/v1`                | 다양                                | 무료, 로컬               |
| **vLLM**         | `http://localhost:8000/v1`                | 다양                                | 셀프 호스팅              |
| **기타**         | 커스텀 URL                                | —                                   | OpenAI 호환 API면 어디든 |

---

## 개발에 참여하기

dbcode 개발에 기여하고 싶다면:

### 개발 환경 세팅

```bash
git clone https://github.com/bigbulgogiburger/dbcode.git
cd dbcode
npm install
```

### 개발 명령어

```bash
npm run dev            # 파일 변경 감지 모드로 자동 빌드
npm run build          # 프로덕션 빌드
npm test               # 전체 테스트 실행
npm run test:watch     # 테스트 감시 모드
npm run typecheck      # TypeScript 타입 검사
npm run lint           # 코드 스타일 검사
npm run format         # 코드 자동 포매팅
npm run check          # 전체 검증 (타입 + 린트 + 테스트 + 빌드)
```

### 기술 스택

| 기술            | 용도          |
| --------------- | ------------- |
| TypeScript 5.x  | 메인 언어     |
| Ink 5.x (React) | 터미널 UI     |
| Commander.js    | CLI 인자 파싱 |
| OpenAI SDK      | LLM API 통신  |
| Zod             | 입력 검증     |
| Vitest          | 테스트        |
| tsup            | 빌드          |

### 커밋 메시지 규칙

```
feat(tools): 새로운 도구 추가
fix(llm): API 타임아웃 버그 수정
docs(readme): 설치 가이드 개선
test(core): agent loop 테스트 추가
```

코드베이스에 대한 자세한 설명은 [ONBOARDING.md](ONBOARDING.md)를 참고하세요.

---

## 라이선스

MIT
