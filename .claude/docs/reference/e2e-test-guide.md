# E2E 멀티턴 테스트 가이드

> 참조 시점: dbcode CLI를 headless 모드로 E2E / QA 테스트할 때

실제 QA 세션(2026-03-18~19)에서 발견한 패턴.

---

## 핵심 원칙

**QA 에이전트는 절대 코드를 직접 작성하지 않는다.**

```
QA 에이전트 → dbcode CLI 실행 → dbcode가 파일 생성/수정/실행
QA 에이전트는 결과 채점만 한다
```

- ✅ QA가 직접 만들어도 되는 것: **fixture 파일** (버그 있는 파일, 타입에러 파일 등 — dbcode가 수정할 대상), **NEXUS.md** 같은 컨텍스트 파일
- ❌ QA가 직접 만들면 안 되는 것: dbcode가 생성해야 하는 코드/파일

---

## Headless 멀티턴 동작 방식

### `-p` + `--resume` 조합의 한계

- `-p`(headless) 모드는 세션 관리 코드 실행 전에 early return → **대화 컨텍스트가 이어지지 않음**
- `--resume SESSION_ID`를 함께 써도 이전 대화 내용을 불러오지 못함

### 파일시스템 기반 멀티턴은 작동함

- T1에서 dbcode가 파일 생성/수정 → T2에서 "이 파일을 실행해줘" → 파일이 존재하므로 연결됨
- 대화 컨텍스트가 아닌 **파일 상태**로 턴을 연결하는 방식은 정상 작동

```bash
# 파일 기반 멀티턴 예시 (TC-03: 버그 수정 후 실행 확인)
# T1: dbcode가 파일 읽고 수정
node /c/Users/DBInc/dbcode/dist/index.js \
  -p "sum1to10.js를 읽고 버그를 수정해줘" --output-format text

# T2: 수정된 파일로 실행 확인 (파일이 존재하므로 연결됨)
node /c/Users/DBInc/dbcode/dist/index.js \
  -p "node sum1to10.js를 실행해서 결과를 확인해줘" --output-format text
```

---

## NEXUS.md 패턴 — 헤드리스 컨텍스트 우회

> TC-25 (컨텍스트 유지 스트레스 테스트)에서 발견. 5/10(N/A) → **10/10** 달성.

### 개념

`NEXUS.md`는 dbcode의 공식 파일이 **아니다**. QA 에이전트가 **테스트 픽스처**로 생성하는 임의 파일 (이름은 무관). 헤드리스 호출 간 "공유 메모리" 역할을 파일시스템으로 구현하는 패턴.

### 동작 방식

```
[QA 에이전트] NEXUS.md 생성
   ├─ 프로젝트 사실 5개 기록 (test runner, DB, port, ...)
   └─ 각 Turn에서 "NEXUS.md를 읽고 답하라" 지시

[T1] dbcode → "NEXUS.md 읽고 테스트 프레임워크가 뭔지 알려줘"
       └─ 파일에서 Vitest 읽음 → 정확히 응답

[T2] dbcode → "NEXUS.md 읽고 DB가 뭔지 알려줘"
       └─ 파일에서 PostgreSQL 읽음 → 정확히 응답
```

### 구현 예시

```bash
# QA 에이전트가 NEXUS.md 생성 (fixture)
cat > /tmp/dbcode-qa-tc25/NEXUS.md << 'EOF'
# Project NEXUS — Context Reference

## Stack
- Test runner: Vitest (ESM)
- Database: PostgreSQL 15
- Port: 3001
- Auth: JWT (RS256)
- Cache: Redis 7

EOF

# T1: NEXUS.md 기반 질의
node /c/Users/DBInc/dbcode/dist/index.js \
  -p "NEXUS.md를 읽고, 이 프로젝트의 테스트 프레임워크는 무엇인지 알려줘" \
  --output-format text

# T2: NEXUS.md 기반 질의 (별도 호출이지만 파일로 연결됨)
node /c/Users/DBInc/dbcode/dist/index.js \
  -p "NEXUS.md를 읽고, DB는 무엇인지 알려줘" \
  --output-format text
```

### 활용 시나리오

| 시나리오                     | NEXUS.md에 담을 내용      |
| ---------------------------- | ------------------------- |
| 컨텍스트 유지 테스트         | 스택 사실 5개             |
| 다중 파일 수정 일관성 테스트 | 인터페이스 정의, 요구사항 |
| 점진적 기능 추가 테스트      | 누적 상태, 완료된 단계    |

---

## 세션 ID 추출 (배열 기반)

`~/.dbcode/sessions/index.json`은 **배열(array)** — dict/object가 아님.

```bash
# Turn 1 전: 기존 세션 ID 수집
SESSIONS_BEFORE=$(node -e "
const data = JSON.parse(require('fs').readFileSync(
  process.env.USERPROFILE + '/.dbcode/sessions/index.json', 'utf8'));
console.log(data.map(s => s.id).join(' '));
" 2>/dev/null || echo "")

# Turn 1 실행
node /c/Users/DBInc/dbcode/dist/index.js -p "프롬프트" --output-format text

# 새 세션 ID 추출
SESSION_ID=$(node -e "
const before = new Set('$SESSIONS_BEFORE'.split(' ').filter(Boolean));
const data = JSON.parse(require('fs').readFileSync(
  process.env.USERPROFILE + '/.dbcode/sessions/index.json', 'utf8'));
const news = data.filter(s => !before.has(s.id))
  .sort((a,b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
console.log(news.length ? news[0].id : '');
" 2>/dev/null)
echo "SESSION_ID: $SESSION_ID"
```

> **Windows 주의**: `python3` 대신 `node -e` 사용이 더 안정적.

---

## 테스트 디렉토리 설정

```bash
# 각 TC마다 독립된 디렉토리 생성
mkdir -p /tmp/dbcode-qa-tc01
cp /c/Users/DBInc/dbcode/.env /tmp/dbcode-qa-tc01/.env  # API 키 필수
cd /tmp/dbcode-qa-tc01

# dbcode 실행 (절대 경로 + Azure fallback)
node /c/Users/DBInc/dbcode/dist/index.js \
  --model gpt-5.1-codex-mini \
  --base-url "https://dtsaas-openai.cognitiveservices.azure.com/openai/responses?api-version=2025-04-01-preview" \
  -p "프롬프트" --output-format text
```

> LOCAL_API_BASE_URL(MiniMax)이 .env에 있으면 우선 적용됨. 서버 오프라인 시 `--base-url`로 CLI 오버라이드 필요.

---

## 채점 시 주의사항

| 상황                         | 처리 방법                                                  |
| ---------------------------- | ---------------------------------------------------------- |
| headless 컨텍스트 유지 실패  | NEXUS.md 파일 기반 우회 시도 후 점수 부여                  |
| 파일 기반 멀티턴 실패        | 정상 채점 (dbcode 능력 문제)                               |
| 타임아웃 (exit 124)          | 해당 기준 0점, 나머지 기준 부분 채점                       |
| node_modules 포함 검색       | false positive로 감점                                      |
| dbcode가 아닌 QA가 직접 구현 | 해당 TC 0점 처리                                           |
| Silent exit 0 (무음 종료)    | 재시도 1회 허용. 명시적 파일명/경로 지정으로 프롬프트 강화 |

---

## 알려진 이슈 (2026-03-19 기준)

| 이슈                   | 발생 TC        | 원인                                    | 우회책                        |
| ---------------------- | -------------- | --------------------------------------- | ----------------------------- |
| Silent Failure         | TC-32,34,36,40 | LLM 질문 → headless 공백 자동응답       | 명시적 지시로 프롬프트 재작성 |
| Interactive Deadlock   | TC-14,18,36,37 | "어느 디렉토리?" 등 질문                | 경로/파일명 미리 명시         |
| Windows 경로 grep 실패 | TC-07,28       | `/c/Users/...` 경로 매핑 문제           | 상대 경로 `src/` 사용         |
| CJS/ESM 불일치         | TC-31,32,35    | `type: module` 없을 때 `require()` 생성 | vitest.config.ts + ESM 명시   |
