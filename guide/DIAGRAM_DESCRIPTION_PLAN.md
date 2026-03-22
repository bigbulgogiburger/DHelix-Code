# Mermaid 다이어그램 노드 설명 추가 계획

> 작성일: 2026-03-22
> 대상: Deep Dive 모듈 섹션 (12개 다이어그램) + Source Reference 문서 (약 80개 다이어그램)
> 목표: 모든 노드에 `<br/><small>설명</small>` 형태의 인라인 설명 추가

---

## 설명 형식 표준

```mermaid
NODE_ID["노드 이름<br/><small>한 줄 설명</small>"]
```

예시:

```
CLOSED["CLOSED (정상)<br/><small>recordIteration() 반복 실행 중</small>"]
```

---

## Part 1: Deep Dive 모듈 섹션 (modules/\*.tsx)

### 1. AgentLoopSection.tsx — Agent Loop 내부 상태머신

**타입**: stateDiagram-v2 → **graph TD로 변환 권장** (stateDiagram은 `<small>` 미지원)

| 노드             | 현재 라벨        | 추가할 설명                               |
| ---------------- | ---------------- | ----------------------------------------- |
| INIT             | INIT             | 시스템 프롬프트 + 도구 목록 초기화        |
| CONTEXT_PREPARE  | CONTEXT_PREPARE  | 메시지 배열 조립 + 토큰 계산              |
| CHECK_COMPACT    | CHECK_COMPACT    | 사용률 >= 83.5% 인지 확인                 |
| AUTO_COMPACT     | AUTO_COMPACT     | LLM 요약으로 오래된 메시지 압축           |
| INPUT_GUARD      | INPUT_GUARD      | 프롬프트 인젝션 + 비밀 키 검사            |
| LLM_CALL         | LLM_CALL         | OpenAI API 스트리밍 요청                  |
| OUTPUT_PARSE     | OUTPUT_PARSE     | 텍스트 / 도구 호출 분리                   |
| NO_TOOLS         | NO_TOOLS         | 도구 호출 없음 → 응답 반환                |
| VALIDATE_TOOLS   | VALIDATE_TOOLS   | Zod 스키마로 인자 타입 검증               |
| TOOL_CORRECT     | TOOL_CORRECT     | 저성능 모델의 잘못된 인자 자동 교정       |
| PERMISSION_CHECK | PERMISSION_CHECK | 5단계 권한 결정 트리 확인                 |
| DENIED           | DENIED           | 사용자가 도구 실행 거부                   |
| CHECKPOINT       | CHECKPOINT       | 파일 수정 전 SHA-256 스냅샷               |
| TOOL_GROUP       | TOOL_GROUP       | 병렬/직렬 실행 그룹 분류                  |
| PARALLEL_EXEC    | PARALLEL_EXEC    | Promise.allSettled 병렬 실행              |
| SERIAL_EXEC      | SERIAL_EXEC      | 순차적 도구 실행                          |
| OBS_MASK         | OBS_MASK         | 읽기 전용 도구 출력을 플레이스홀더로 대체 |
| CIRCUIT_CHECK    | CIRCUIT_CHECK    | 무변경/에러 반복 횟수 확인                |
| RECOVERY         | RECOVERY         | 에러 유형별 복구 전략 실행                |
| STRATEGY_SWITCH  | STRATEGY_SWITCH  | 도구 호출 전략 변경 (parallel↔serial)    |
| BLOCKED          | BLOCKED          | 서킷 차단 → 루프 중단                     |

---

### 2. ContextSection.tsx — 3-Layer 압축 파이프라인

**타입**: graph TB (3개 subgraph)

**Layer 1: Microcompaction**
| 노드 | 현재 라벨 | 추가할 설명 |
|------|----------|-----------|
| TOOL_OUT | 도구 결과 200+ tokens | 토큰이 200 이상인 도구 출력만 대상 |
| SIZE_CHECK | 크기 > 200? | 토큰 수 기준 필터링 |
| COLD | Cold Storage 디스크 저장 | JSON 파일로 디스크에 영구 저장 |
| KEEP | 인라인 유지 | 작은 출력은 메시지에 그대로 유지 |
| REF | ColdStorageRef 참조만 남김 | 원본 대신 경로 참조로 대체 |

**Layer 2: Auto-compaction (83.5%)**
| 노드 | 현재 라벨 | 추가할 설명 |
|------|----------|-----------|
| USAGE | 컨텍스트 사용률 >= 83.5% | 토큰 사용률이 임계값 초과 시 트리거 |
| PRESERVE | 보존: system + 최근 N턴 | 시스템 프롬프트와 최근 대화는 보호 |
| COMPRESS | 압축: 오래된 메시지 | 오래된 메시지를 LLM으로 요약 |
| SUMMARY | LLM 요약 핵심 정보 추출 | 핵심 결정사항 + 코드 변경사항 요약 |
| MERGED | 요약 + 보존 = 새 컨텍스트 | 요약 결과와 보존 메시지를 합쳐 새 컨텍스트 구성 |

**Layer 3: Rehydration**
| 노드 | 현재 라벨 | 추가할 설명 |
|------|----------|-----------|
| COMPACT_DONE | 압축 완료 | Auto-compaction 결과물 |
| STRATEGY | 복원 전략 선택 | 어떤 Cold Storage 항목을 복원할지 결정 |
| RECENT_F | 최근 파일 우선 | 가장 최근에 저장된 항목부터 복원 |
| FREQ_F | 빈도 우선 | 자주 참조된 항목을 우선 복원 |
| MIX_F | 혼합 전략 | 최근성 + 빈도를 종합하여 복원 |

---

### 3. RecoverySection.tsx

**3a. Circuit Breaker 상태 전이** (graph TD) — ✅ 대부분 완료

| 노드     | 현재 상태                        | 필요한 조치                 |
| -------- | -------------------------------- | --------------------------- |
| START    | ✅ 설명 있음                     | 유지                        |
| CLOSED   | ✅ 설명 있음                     | 유지                        |
| OPEN1    | "OPEN: 파일 미수정 + LLM 무출력" | 설명 분리: 이름 + `<small>` |
| OPEN2    | "OPEN: 같은 에러 메시지 반복"    | 설명 분리                   |
| OPEN3    | "OPEN: 최대 반복 초과"           | 설명 분리                   |
| RECOVERY | ✅ 설명 있음                     | 유지                        |
| ABORT    | ✅ 설명 있음                     | 유지                        |

**3b. 에러 유형별 복구 전략 라우팅** (graph LR → **graph TD 변환 권장**)

| 노드       | 현재 라벨        | 추가할 설명                           |
| ---------- | ---------------- | ------------------------------------- |
| ERROR      | 에러 발생        | 도구 실행 또는 LLM 호출에서 에러 감지 |
| CLASSIFY   | 에러 분류        | RecoveryStrategy 매핑으로 유형 판별   |
| COMPACT    | context_overflow | 컨텍스트 토큰 초과 에러               |
| RETRY      | transient_error  | 일시적 네트워크/API 에러              |
| FALLBACK   | model_error      | 모델 능력 부족 에러                   |
| RETRY_LOCK | lock_conflict    | 파일 잠금 충돌                        |
| C_ACT      | compact + retry  | 압축 후 재시도                        |
| R_ACT      | backoff + retry  | 지수 백오프 후 재시도                 |
| F_ACT      | switch model     | 대체 모델로 전환                      |
| RL_ACT     | wait + retry     | 대기 후 재시도                        |
| RESULT     | 결과             | 복구 시도 결과 판정                   |
| OK         | 루프 계속        | 복구 성공 → 에이전트 루프 재개        |
| ABORT_R    | 루프 중단        | 복구 실패 → 사용자에게 에러 보고      |

---

### 4. SubagentSection.tsx

**4a. 서브에이전트 스폰 & 실행 흐름** (graph TD)

| 노드         | 현재 라벨       | 추가할 설명                       |
| ------------ | --------------- | --------------------------------- |
| MAIN         | 메인 에이전트   | 사용자와 직접 대화하는 루프       |
| SPAWNER      | SubagentSpawner | 서브에이전트 생성 및 설정 담당    |
| TYPE         | 타입 선택       | explore / plan / general / custom |
| EXPLORE      | Explore         | 읽기 전용 도구만, 코드베이스 탐색 |
| PLAN         | Plan            | 읽기 전용, 구현 계획 수립         |
| GENERAL      | General         | 모든 도구 사용 가능               |
| CUSTOM       | Custom          | 사용자 정의 도구 세트             |
| TOOLS_RO     | 읽기 전용 도구  | Read, Grep, Glob만 허용           |
| TOOLS_ALL    | 모든 도구       | 파일 수정 포함 전체 도구          |
| TOOLS_CUSTOM | 커스텀 도구     | 명시적으로 지정된 도구만          |
| SAME         | 동일 디렉토리   | 메인과 같은 작업 디렉토리         |
| WORKTREE     | Git Worktree    | 격리된 Git worktree에서 실행      |
| NEW_LOOP     | 독립 Agent Loop | 별도의 에이전트 루프 인스턴스     |
| RESULT       | 결과 반환       | 메인 에이전트에 텍스트 결과 전달  |

**4b. Team 시스템 — 병렬 워커 오케스트레이션** (graph TD)

| 노드     | 현재 라벨   | 추가할 설명                  |
| -------- | ----------- | ---------------------------- |
| USER     | 사용자 요청 | 복잡한 작업 요청 입력        |
| TM       | TeamManager | 작업 분석 및 워커 배분       |
| ANALYZE  | 작업 분석   | 파일 충돌 검사 + 의존성 분석 |
| SPLIT    | 태스크 분할 | 독립 실행 가능한 단위로 분리 |
| W1       | Worker 1    | 독립 서브에이전트 인스턴스   |
| W2       | Worker 2    | 독립 서브에이전트 인스턴스   |
| W3       | Worker 3    | 독립 서브에이전트 인스턴스   |
| SHARED   | 공유 상태   | 워커 간 진행 상황 공유       |
| R1/R2/R3 | 결과 1/2/3  | 각 워커의 실행 결과          |
| MERGE_R  | 결과 병합   | 모든 워커 결과를 통합        |
| DONE     | 완료        | 최종 결과를 사용자에게 전달  |

---

### 5. MCPSection.tsx — MCP 서버 수명주기

**타입**: sequenceDiagram — 노드 설명은 participant alias로 추가

| 참여자 | 현재 이름    | 추가할 설명                      |
| ------ | ------------ | -------------------------------- |
| APP    | App          | CLI 앱 진입점                    |
| MGR    | MCPManager   | MCP 서버 수명주기 관리           |
| SCOPE  | ScopeManager | local > project > user 설정 병합 |
| CLIENT | MCPClient    | 개별 MCP 서버 연결 담당          |
| SERVER | MCP Server   | 외부 MCP 서버 프로세스           |
| BRIDGE | ToolBridge   | MCP 도구를 dbcode 도구로 변환    |
| REG    | ToolRegistry | 도구 등록 저장소                 |

**메시지 화살표에 추가할 설명:**
| 현재 메시지 | 추가할 설명 |
|------------|-----------|
| loadScopedConfigs() | 3-Scope(local>project>user) 설정 파일 로드 |
| connectAll() | Promise.allSettled로 모든 서버 병렬 연결 |
| connect() | stdio/SSE 트랜스포트로 서버 프로세스 시작 |
| JSON-RPC initialize | MCP 프로토콜 핸드셰이크 |
| tools/list | 서버가 제공하는 도구 목록 요청 |
| registerTools() | mcp**{server}**{tool} 형태로 도구 등록 |

---

### 6. DataFlowSection.tsx — End-to-End 데이터 흐름

| 노드       | 현재 라벨            | 추가할 설명                           |
| ---------- | -------------------- | ------------------------------------- |
| USER       | 사용자 입력          | 텍스트 또는 슬래시 명령               |
| SYS_PROMPT | System Prompt 빌드   | 모듈식 섹션 조립 + 토큰 예산 적용     |
| CTX_MGR    | Context Manager 체크 | 토큰 사용률 확인 + 필요시 압축        |
| GUARD_IN   | Input Guard 검사     | 프롬프트 인젝션 + 비밀 키 탐지        |
| DUAL       | Dual-Model 라우터    | 작업 페이즈에 따라 모델 선택          |
| LLM        | LLM 호출             | OpenAI 호환 API 스트리밍 요청         |
| PARSE      | 출력 파싱            | 텍스트 응답 vs 도구 호출 분리         |
| PERM       | 권한 확인            | 5단계 결정 트리로 도구 허용 여부 판단 |
| CKPT       | Checkpoint 생성      | 파일 수정 전 SHA-256 스냅샷 저장      |
| GROUP      | 도구 그룹화          | 병렬/직렬 실행 그룹 분류              |
| EXEC       | 도구 실행            | Zod 검증 → 실행 → 결과 수집           |
| OBS        | Observation 마스킹   | 읽기 전용 도구 출력 플레이스홀더 대체 |
| COLD       | Cold Storage 저장    | 큰 도구 출력을 디스크에 영구 저장     |
| CB         | Circuit Breaker 체크 | 무변경/에러 반복 감지                 |
| RECOVER    | Recovery 실행        | 에러 유형별 복구 전략                 |
| RESPONSE   | 응답 출력            | 최종 텍스트를 사용자에게 표시         |
| DONE       | 턴 완료              | 세션 저장 + 다음 입력 대기            |

---

### 7. ConfigSection.tsx

**7a. 5-Layer 설정 병합 과정** (graph BT)

| 노드  | 현재 라벨             | 추가할 설명                  |
| ----- | --------------------- | ---------------------------- |
| D     | defaults.ts           | 하드코딩 기본값 (안전망)     |
| U     | ~/.dbcode/config.json | 사용자 전역 설정             |
| P     | .dbcode/config.json   | 프로젝트별 팀 공유 설정      |
| E     | 환경변수              | DBCODE*\*, OPENAI*\* 등      |
| C     | CLI 플래그            | --model, --verbose 등 일회성 |
| MERGE | deepMerge             | 5개 레이어를 깊은 병합       |
| FINAL | ResolvedConfig        | Zod 스키마 검증된 최종 설정  |

**7b. DBCODE.md 6단계 로딩 체인** (graph LR)

| 노드   | 현재 라벨            | 추가할 설명                             |
| ------ | -------------------- | --------------------------------------- |
| G      | Global               | ~/.dbcode/DBCODE.md                     |
| GR     | Global Rules         | ~/.dbcode/rules/\*.md (경로 조건부)     |
| PD     | Parents              | 부모 디렉토리 DBCODE.md (모노레포)      |
| P      | Project              | {root}/DBCODE.md 또는 .dbcode/DBCODE.md |
| PR     | Project Rules        | .dbcode/rules/\*.md (경로 조건부)       |
| L      | Local                | DBCODE.local.md (개인, gitignore)       |
| CONCAT | 연결                 | '\n\n---\n\n' 구분자로 합침             |
| PROMPT | System Prompt에 주입 | buildSystemPrompt()에서 사용            |

---

### 8. ToolsSection.tsx — 도구 등록 → 실행 파이프라인

| 노드      | 현재 라벨           | 추가할 설명                       |
| --------- | ------------------- | --------------------------------- |
| BUILTIN   | 16개 빌트인 도구    | Read, Edit, Write, Bash 등        |
| MCP_TOOLS | MCP 외부 도구       | MCP 서버에서 브릿지된 도구        |
| HOT       | Hot Tools 우선 등록 | 자주 사용되는 도구 먼저 등록      |
| REGISTRY  | ToolRegistry        | 이름→정의 Map 저장소              |
| TIER      | 모델 능력 티어 감지 | high / medium / low               |
| FULL      | 전체 스키마         | 모든 파라미터 포함 (high 모델용)  |
| REDUCED   | 축소 스키마         | 필수 파라미터만 (medium 모델용)   |
| MINIMAL   | 최소 스키마         | 이름 + 설명만 (low 모델용)        |
| CALL      | LLM 도구 호출       | LLM이 반환한 tool_call 객체       |
| CORRECT   | 인자 자동 교정      | 잘못된 경로/타입 자동 수정        |
| ZOD       | Zod 검증            | 스키마 기반 타입 검증             |
| ABORT     | AbortSignal 연결    | 타임아웃 + 취소 신호 체이닝       |
| RUN       | 도구 실행           | tool.execute(args, context)       |
| RETRY_T   | 일시적 에러 재시도  | ECONNRESET 등 1회 재시도          |
| BACKOFF   | 지수 백오프         | 1s → 2s 대기                      |
| RESULT    | 결과 반환           | ToolResult를 에이전트 루프에 전달 |

---

### 9. LLMSection.tsx

**9a. LLM 요청 처리 파이프라인** (graph TD) — 최근 수정됨

| 노드        | 현재 라벨                   | 추가할 설명                   |
| ----------- | --------------------------- | ----------------------------- |
| REQ         | 요청 생성                   | ChatRequest 객체 조립         |
| DETECT      | 모델 감지                   | isResponsesApiModel() 확인    |
| RESP_API    | Responses API               | Codex 모델 전용 API 포맷      |
| CHAT_API    | Chat Completions            | 일반 OpenAI 호환 API 포맷     |
| TRANSFORM   | 메시지 변환 + 도구 포맷팅   | 내부 메시지 → API 형식 변환   |
| URL_NORM    | URL 정규화                  | Azure/Ollama 등 baseURL 처리  |
| HTTP        | HTTP 요청 (120s 타임아웃)   | OpenAI SDK로 API 호출         |
| STREAM      | 스트리밍?                   | 스트리밍 vs 일괄 응답 분기    |
| SSE         | SSE 파싱                    | Server-Sent Events 청크 처리  |
| BATCH       | 일괄 응답                   | 전체 응답 한 번에 수신        |
| RETRY_CHECK | 에러?                       | HTTP 상태 코드 확인           |
| RETRY       | 재시도 (1s→2s→4s, 최대 3회) | 지수 백오프 재시도            |
| FAIL        | 즉시 실패                   | 429 Rate Limit은 재시도 안 함 |
| DONE        | 응답 반환                   | ChatResponse로 변환하여 반환  |

**9b. Dual-Model Router — 단계별 모델 전환** (graph TD)

| 노드     | 현재 라벨              | 추가할 설명                  |
| -------- | ---------------------- | ---------------------------- |
| MSG      | 사용자 메시지          | 가장 최근 user role 메시지   |
| DETECT   | detectPhase()          | 키워드 기반 페이즈 자동 감지 |
| KW_CHECK | 키워드 감지            | PLAN_KEYWORDS 13개 매칭      |
| PLAN     | Plan Phase             | 설계/분석 단계               |
| REVIEW   | Review Phase           | 검토/리뷰 단계               |
| EXECUTE  | Execute Phase          | 코드 생성/실행 단계 (기본값) |
| ARCH     | Architect Model 고추론 | 고성능 모델 (e.g. Opus)      |
| EDIT     | Editor Model 빠른응답  | 비용 효율 모델 (e.g. Sonnet) |

---

### 10. PermissionsSection.tsx — 권한 확인 결정 트리

| 노드        | 현재 라벨       | 추가할 설명                               |
| ----------- | --------------- | ----------------------------------------- |
| START       | 도구 호출 요청  | LLM이 tool_call을 반환                    |
| DENY_RULES  | Deny 규칙?      | .dbcode/settings.json의 deny 패턴 매칭    |
| SESSION     | 세션 허용?      | 이번 세션에서 이미 허용된 도구인지        |
| ALLOW_RULES | Allow 규칙?     | settings.json의 allow 패턴 매칭           |
| EXPLICIT    | 명시적 허용?    | 도구별 항상 허용 설정 확인                |
| MODE        | 권한 모드?      | plan / auto / default / bypassPermissions |
| DENIED      | 거부            | 사용자에게 거부 사유 표시                 |
| ALLOWED     | 허용            | 도구 실행 진행                            |
| ONCE        | 1회 허용        | 이번 한 번만 허용 (기록 안 함)            |
| EDIT_CHECK  | 파일 수정?      | Write/Edit 도구인지 확인                  |
| READ_CHECK  | 읽기 전용?      | Read/Grep/Glob인지 확인                   |
| ASK         | 사용자에게 질문 | 터미널에 허용/거부 프롬프트 표시          |
| USER_DECIDE | 사용자 결정     | y/n/always 선택                           |
| RECORD      | 세션에 기록     | always → 이후 같은 도구 자동 허용         |

---

## Part 2: Source Reference 문서 (docs/\*/page.tsx)

> 약 80개 다이어그램 — 대부분 아키텍처 위치 다이어그램 + 내부 플로우 다이어그램
> 아키텍처 위치 다이어그램은 `<small>파일 경로</small>`가 이미 있는 경우가 많음
> 내부 플로우 다이어그램의 노드에 설명 추가 필요

### 우선순위: 내부 구현 섹션의 플로우 다이어그램

각 문서의 "⚙️ 내부 구현" 섹션에 있는 상태머신/플로우 다이어그램이 설명 추가의 핵심 대상입니다.
아키텍처 위치 다이어그램은 이미 `<small>파일 경로</small>`로 충분한 설명이 있는 경우가 많습니다.

#### 설명 추가 대상 (파일별)

| 파일                           | 다이어그램 수 | 설명 필요 노드 수 (추정) | 우선도 |
| ------------------------------ | ------------- | ------------------------ | ------ |
| agent-loop/page.tsx            | 5             | ~30                      | ★★★★★  |
| context-manager/page.tsx       | 8             | ~40                      | ★★★★★  |
| circuit-breaker/page.tsx       | 4             | ~15                      | ★★★★   |
| recovery-executor/page.tsx     | 4             | ~20                      | ★★★★   |
| system-prompt-builder/page.tsx | 4             | ~25                      | ★★★★   |
| tool-executor/page.tsx         | 4             | ~20                      | ★★★    |
| llm-client/page.tsx            | 3             | ~15                      | ★★★    |
| use-agent-loop/page.tsx        | 4             | ~20                      | ★★★    |
| activity-feed/page.tsx         | 4             | ~15                      | ★★★    |
| permission-manager/page.tsx    | 3             | ~15                      | ★★★    |
| mcp-manager/page.tsx           | 3             | ~12                      | ★★     |
| checkpoint-manager/page.tsx    | 3             | ~12                      | ★★     |
| config-loader/page.tsx         | 3             | ~10                      | ★★     |
| instruction-loader/page.tsx    | 3             | ~10                      | ★★     |
| dual-model-router/page.tsx     | 3             | ~10                      | ★★     |
| observation-masking/page.tsx   | 4             | ~12                      | ★★     |
| skill-manager/page.tsx         | 3             | ~10                      | ★★     |
| token-counter/page.tsx         | 3             | ~8                       | ★      |
| model-capabilities/page.tsx    | 3             | ~8                       | ★      |
| secret-scanner/page.tsx        | 4             | ~10                      | ★      |
| tool-registry/page.tsx         | 3             | ~8                       | ★      |

---

## 작업 계획

### Phase 1: Deep Dive 모듈 섹션 (12개 다이어그램)

- stateDiagram-v2는 graph TD로 변환 (AgentLoopSection)
- 모든 노드에 `<br/><small>설명</small>` 추가
- sequenceDiagram은 participant 설명 + 메시지 설명 보강

### Phase 2: Source Reference — 고우선순위 (5개 파일, ~130 노드)

- agent-loop, context-manager, circuit-breaker, recovery-executor, system-prompt-builder

### Phase 3: Source Reference — 중간 우선순위 (11개 파일, ~140 노드)

- tool-executor, llm-client, use-agent-loop, activity-feed, permission-manager 등

### Phase 4: Source Reference — 저우선순위 (5개 파일, ~44 노드)

- token-counter, model-capabilities, secret-scanner, tool-registry 등

---

## 예상 총 작업량

| 구분                  | 파일 수 | 다이어그램 수 | 노드 수 (추정) |
| --------------------- | ------- | ------------- | -------------- |
| Deep Dive 모듈        | 10      | 12            | ~120           |
| Source Reference 문서 | 21      | ~80           | ~320           |
| **합계**              | **31**  | **~92**       | **~440**       |
