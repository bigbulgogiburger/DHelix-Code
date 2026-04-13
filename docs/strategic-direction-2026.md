# dhelix 전략 방향 2026 — Coding Agent 경쟁력 분석 & 로드맵

> **작성일**: 2026-03-28
> **분석 범위**: 63,124 LOC 코드 분석 + 6개 경쟁사 리서치
> **목적**: "OpenCode보다 낫지 않다"는 평가에 대한 냉정한 진단과 전략적 방향 수립

---

## 1. 냉정한 현황 진단

### 1.1 핵심 지표

| 지표           | 값       | 평가                             |
| -------------- | -------- | -------------------------------- |
| 종합 성숙도    | 7.2 / 10 | 내부 아키텍처는 견고하나 DX 부족 |
| Lines of Code  | 63,124   | 충분한 규모의 코드베이스         |
| 테스트 파일 수 | 216개    | 양호한 테스트 커버리지           |
| 현재 버전      | 0.1.0    | 아직 초기 단계                   |
| 내장 도구      | 16개     | 경쟁사 대비 적절                 |
| 슬래시 명령어  | 41개     | 경쟁사 대비 풍부                 |

### 1.2 영역별 성숙도

| 영역                               | 성숙도 | 상태         |
| ---------------------------------- | ------ | ------------ |
| LLM 클라이언트                     | 90%    | ✅ 우수      |
| 컨텍스트 관리 (3-Layer Compaction) | 88%    | ✅ 우수      |
| 에이전트 루프 (ReAct)              | 85%    | ✅ 양호      |
| 도구 시스템                        | 82%    | ✅ 양호      |
| 권한 / 보안                        | 78%    | ⚠️ 개선 필요 |
| MCP 시스템                         | 75%    | ⚠️ 개선 필요 |
| 서브에이전트                       | 65%    | ❌ 미흡      |
| DX (개발자 경험)                   | 55%    | ❌ 심각      |

### 1.3 왜 "OpenCode보다 낫지 않다"는 평가인가

dhelix의 내부 아키텍처(ReAct Loop, 3-Layer Compaction, 5-Mode Permission)는 실제로 잘 설계되어 있다. 문제는 **"보이지 않는 곳에 투자"**했다는 것이다. 사용자가 체감하는 DX(개발자 경험)와 가시적 차별화 기능에서 OpenCode에 뒤처진다.

**격차 1: 코드 수정 후 자동 품질 검증 루프 부재**

코드 수정 후 타입 에러나 lint 문제를 자동으로 잡아주는 피드백 루프가 없다. 참고로 네이티브 LSP 통합은 OpenCode만 유일하게 보유한 기능이며, Claude Code, Codex CLI, Gemini CLI 모두 LSP를 내장하지 않는다. 다만 Claude Code는 `tsc --noEmit`, `eslint` 등 빌드/린트 도구를 bash로 실행해서 에러를 잡고, Aider는 코드 생성 후 자동 lint/test → 실패 시 LLM에 에러 피드백 → 자동 수정 루프를 돈다. dhelix는 이 두 가지 접근 모두 없어서, 사용자가 직접 빌드해보고 에러를 알려줘야 한다.

**격차 2: 세션 영속성 없음**

OpenCode는 Go 기반 persistent server로 터미널 끊김, SSH 드롭에도 세션이 유지된다. dhelix는 프로세스 종료 = 세션 소멸. 장시간 작업에서 치명적이다.

**격차 3: 선언형 에이전트 커스터마이즈 부재**

OpenCode는 YAML frontmatter로 커스텀 에이전트를 선언적으로 정의할 수 있다. dhelix는 코드 수정이 필요하다. 파워유저의 확장성 진입장벽이 높다.

**격차 4: 데스크톱 앱 & 멀티플랫폼 부재**

OpenCode는 Tauri 기반 데스크톱 앱을 제공하고, Claude Code는 IDE 통합을 지원한다. dhelix는 순수 터미널만 지원하여 비-CLI 사용자에게 진입장벽이 높다.

**격차 5: 벤치마크 / 가시적 성과 부재**

Claude Code는 SWE-bench Verified 80.9%, Codex CLI는 Terminal-Bench 77.3%를 달성했다. dhelix는 벤치마크 결과가 없어 설득력이 부족하다.

---

## 2. 2026 Coding Agent 경쟁 지형

### 2.1 6대 CLI Coding Agent 비교

| 차원                      | dhelix             | OpenCode            | Claude Code      | Aider             | Gemini CLI  | Codex CLI   |
| ------------------------- | ------------------ | ------------------- | ---------------- | ----------------- | ----------- | ----------- |
| **언어**                  | TypeScript         | Go                  | TypeScript       | Python            | TypeScript  | TypeScript  |
| **LLM 지원**              | 75+ (OpenAI 호환)  | 75+ (models.dev)    | Claude only      | 100+ 모델         | Gemini only | OpenAI only |
| **LSP 통합**              | ❌ 없음            | ✅ 네이티브         | ❌ 없음          | ⚠ lint/test 연동 | ❌ 없음     | ❌ 없음     |
| **세션 영속성**           | 파일 기반          | SQLite + daemon     | 클라우드 동기    | 없음              | 파일 기반   | 파일 기반   |
| **에이전트 커스터마이즈** | 코드 수정 필요     | YAML 선언형         | CLAUDE.md        | 제한적            | GEMINI.md   | AGENTS.md   |
| **서브에이전트**          | 팀 오케스트레이션  | 선언형 서브에이전트 | 병렬 에이전트 팀 | 없음              | 기본적      | 기본적      |
| **MCP 지원**              | 3-스코프 브리지    | 완전 지원           | 완전 지원        | 없음              | 지원        | 지원        |
| **보안 가드레일**         | ✅ 5-Layer         | 기본적              | 완전             | 기본적            | 권한 확인만 | 샌드박스    |
| **컨텍스트 관리**         | 3-Layer Compaction | 기본 truncation     | 고급 (1M window) | Repo Map          | 1M window   | 기본        |
| **데스크톱 앱**           | ❌                 | Tauri               | Electron         | ❌                | ❌          | ❌          |
| **Repo Map / 인덱싱**     | ❌ 기본적          | LSP 기반            | 기본 탐색        | ✅ Tree-sitter    | 기본        | 기본        |
| **비용 추적**             | ✅ 정밀            | 기본                | 상세             | 상세              | ❌          | 기본        |
| **음성 지원**             | ✅                 | ❌                  | push-to-talk     | ❌                | ❌          | ❌          |
| **커뮤니티**              | 내부 프로젝트      | 112K+ ⭐            | Anthropic 공식   | 30K+ ⭐           | Google 공식 | OpenAI 공식 |

### 2.2 2026 시장 핵심 트렌드

경쟁 축이 "어떤 모델이 가장 똑똑한가?"에서 **"어떤 에이전트 아키텍처가 같은 모델로 더 나은 결과를 내는가?"**로 이동하고 있다. Scaffolding(에이전트 프레임워크)이 모델만큼 중요해졌으며, 조직의 도메인 컨텍스트를 얼마나 잘 녹이느냐가 진짜 차별화 포인트다.

또한 **비용 효율성**이 개발자 커뮤니티에서 가장 뜨거운 대화 주제로 부상했다. "어떤 도구가 가장 똑똑한가?"가 아니라 "어떤 도구가 내 크레딧을 태우지 않는가?"가 핵심이다. 같은 결과를 4x 적은 토큰으로 내는 에이전트가 승리한다.

Gartner 예측에 따르면 2026년 말까지 엔터프라이즈 애플리케이션의 40%가 task-specific AI Agent를 내장할 것이며, 에이전트가 개발자 도구 관심의 55%를 차지하고 있다.

---

## 3. SWOT 분석

### 3.1 Strengths (dhelix 우위)

- **3-Layer Context Compaction** — 대부분 경쟁자는 단순 truncation. Cold Storage + Rehydration은 고유 강점. 긴 대화에서도 컨텍스트를 효과적으로 유지한다.
- **5-Layer Security Guardrails** — Command/Path/Secret/Injection/Entropy 다층 방어. 엔터프라이즈급 보안 수준으로, OpenCode보다 확실히 우수하다.
- **계층형 권한 시스템** — 패턴 기반 규칙(`Bash(npm *)`), 5-Mode 권한, 감사 로그. 세밀한 제어가 가능하다.
- **Dual-Model Router** — Architect/Editor 패턴으로 비용 최적화가 내장되어 있다.
- **풍부한 CLI 명령어** — 41개 슬래시 명령어로 파워 유저에게 높은 생산성을 제공한다.
- **Extended Thinking 지원** — Claude 모델의 thinking budget을 활용하는 고급 기능.
- **음성 입력** — CLI에서 음성을 지원하는 유일한 코딩 에이전트.

### 3.2 Weaknesses (dhelix 열위)

- **코드 수정 후 자동 검증 루프 없음** — 파일 수정 후 lint/test/typecheck 자동 실행이 없다. 참고: 네이티브 LSP 통합은 OpenCode만 보유, Claude Code/Codex/Gemini CLI도 LSP 없음. 하지만 Claude Code는 bash로 빌드 도구를 실행하고, Aider는 auto lint/test 루프를 돌린다. dhelix는 이 두 방식 모두 없다.
- **Repo Map / 코드 인덱싱 부재** — Aider의 Tree-sitter 기반 repo map 대비 원시적. 대규모 코드베이스에서 LLM이 구조를 파악하기 어렵다.
- **세션 영속성 취약** — 파일 기반 복원만 지원. daemon/SQLite 수준에 못 미친다.
- **선언형 에이전트 부재** — 커스텀 에이전트 정의에 코드 수정이 필요하다.
- **벤치마크 부재** — SWE-bench, Terminal-Bench 결과가 없어 객관적 비교가 불가능하다.
- **느린 부트스트랩** — Node.js 런타임 오버헤드(2-3초)로 Go 기반 OpenCode의 <500ms 대비 느리다.
- **커뮤니티 / 생태계 부재** — 오픈소스 기여자와 플러그인 마켓이 없다.
- **자동 lint/test 루프 없음** — Aider는 코드 생성 후 자동 lint/test/fix를 수행한다.

### 3.3 Opportunities (기회)

- **Context Flywheel** — 조직 컨텍스트 축적이 진짜 해자(moat). dhelix의 Memory 시스템을 강화하면 강력한 경쟁 우위가 된다.
- **엔터프라이즈 보안 니즈** — 규제 환경에서 로컬 우선 + 5-Layer 가드레일은 큰 장점. 금융, 의료, 공공 분야에서 유일한 선택지가 될 수 있다.
- **비용 효율성 경쟁** — "4x 적은 토큰으로 같은 결과"가 핫 토픽. Compaction + Dual Model 강화로 비용 혁신 가능.
- **한국 시장 특화** — 한국어 UX, 국내 클라우드(NHN, Naver) 통합, 한국 개발 문화 반영으로 국내 시장 1위 가능.
- **AI Agent 표준화 물결** — ACP(Agent Communication Protocol) 등 새로운 표준을 선점할 기회.
- **IDE 통합 대세** — Zed, JetBrains, VS Code 플러그인으로 확장 가능.

### 3.4 Threats (위협)

- **Big Tech 자원 격차** — Anthropic, Google, OpenAI가 공식 CLI 에이전트를 투입하고 있다.
- **오픈소스 네트워크 효과** — OpenCode 112K⭐, Aider 30K⭐. 커뮤니티 기여가 격차를 확대한다.
- **모델 종속성** — Claude/GPT API 가격 정책 변동에 취약하다.
- **AI 코딩 도구 범용화** — 에이전트 기능이 코모디티화되면서 차별화가 어려워진다.
- **IDE 에이전트 확대** — Cursor, Windsurf가 터미널 에이전트 기능을 흡수하고 있다.

---

## 4. 전략적 방향: 3가지 핵심 전략

### 포지셔닝

> **"가장 지능적인 코드 이해"와 "가장 안전한 엔터프라이즈 에이전트"의 교차점.
> 범용 에이전트가 아닌, "코드를 가장 깊이 이해하는 Secure-First Coding Agent"로 포지셔닝.**

OpenCode는 "유연성", Claude Code는 "지능", Aider는 "경량"이 핵심 정체성이다. dhelix는 **"Code Intelligence + Enterprise Trust + Context Flywheel"**의 삼각형으로 독자적 포지션을 구축한다.

### 전략 1: Code Intelligence Layer — "코드를 이해하는 에이전트"

CLI 코딩 에이전트 중 네이티브 LSP를 내장한 것은 OpenCode뿐이다. Claude Code, Codex CLI, Gemini CLI 모두 LSP가 없다. 그러나 Claude Code는 bash로 `tsc --noEmit`, `eslint`를 실행해서 에러를 잡고, Aider는 자동 lint/test → 실패 시 LLM 피드백 → 재수정 루프를 돈다. dhelix는 이 두 접근 모두 없어서 체감 격차가 크다. 따라서 현실적인 단계별 전략을 취한다.

**Auto Lint/Test/Typecheck Loop** `CRITICAL` — Phase 1 최우선

코드 생성 후 자동으로 lint → typecheck → test를 실행하고, 실패 시 에러 출력을 LLM에 피드백하여 자동 수정하는 루프. 기존 Hook 시스템 + bash_exec 도구를 활용하면 **2주 내 MVP 구현 가능**. Aider/Claude Code 방식의 "빌드 도구 실행" 접근.

**Semantic Repo Map** `CRITICAL`

Tree-sitter 기반 AST 파싱으로 함수/클래스/모듈 관계도를 자동 생성한다. Aider의 repo-map을 벤치마킹하여, 의존성 그래프 + 호출 체인을 LLM에 프로젝트 구조 컨텍스트로 제공한다.

**LSP Integration Hub** `HIGH` — Phase 2 차별화

TypeScript(tsserver), Go(gopls), Python(pylsp) 등 LSP 자동 감지 & 연결. OpenCode만 가진 기능을 흡수하여 차별화. 단, Auto Lint/Test Loop가 먼저 안정화된 후 추가하는 것이 현실적.

### 전략 2: Enterprise-Grade Trust — "가장 신뢰할 수 있는 에이전트"

이미 보유한 5-Layer Guardrails + Permission System을 엔터프라이즈 킬러 피처로 발전시킨다. 규제 산업(금융, 의료, 공공)에서 "유일하게 쓸 수 있는 코딩 에이전트"가 되는 것이 목표다.

**Policy-as-Code Engine** `HIGH`

OPA(Open Policy Agent) 스타일 정책 엔진을 구현한다. 팀별/프로젝트별 보안 정책을 코드로 관리하며, 기존 권한 시스템을 기업용으로 확장한다.

**Compliance Dashboard** `MEDIUM`

에이전트의 모든 행동을 추적하는 감사 대시보드를 제공한다. "어떤 파일을 수정했는지, 어떤 명령을 실행했는지" 완전한 추적성을 보장한다.

**Air-Gap Mode** `HIGH`

완전 오프라인 모드를 구현한다. Ollama/vLLM + 로컬 MCP 서버만으로 동작하여 군사/보안 기관, 금융권에서의 유일한 선택지가 된다.

### 전략 3: Context Flywheel — "쓸수록 똑똑해지는 에이전트"

2026년의 핵심 경쟁 우위는 "조직의 도메인 컨텍스트를 얼마나 깊이 축적하는가"다. dhelix의 Memory 시스템을 Context Flywheel로 발전시켜, 사용할수록 더 정확해지는 에이전트를 만든다.

**Project DNA** `CRITICAL`

프로젝트의 코딩 컨벤션, 아키텍처 패턴, 자주 쓰는 라이브러리를 자동 학습한다. "이 프로젝트에서는 이렇게 코딩한다"를 아는 에이전트를 만든다.

**Decision Memory** `HIGH`

과거 결정의 이유(WHY)를 기록한다. "이전에 Redis 대신 Memcached를 선택한 이유"를 기억하는 에이전트. 기존 memory 시스템을 structured decisions으로 확장한다.

**Team Knowledge Sync** `MEDIUM`

팀원들의 에이전트 경험을 공유 메모리로 통합한다. "팀 전체가 축적한 컨텍스트"를 활용하는 진정한 팀 에이전트를 구현한다.

---

## 5. 12개월 실행 로드맵

### Phase 1: Foundation Fix — 기반 격차 해소

**기간**: Month 1-3 (2026 Q2) — "일단 따라잡기"

| 항목                          | 설명                                                                                              | 우선순위 | 기간      |
| ----------------------------- | ------------------------------------------------------------------------------------------------- | -------- | --------- |
| Auto Lint/Test/Typecheck Loop | 코드 수정 후 자동 lint → typecheck → test → fix 루프. 기존 Hook + bash_exec 활용. 2주 내 MVP 가능 | CRITICAL | Week 1-4  |
| Repo Map (Tree-sitter)        | tree-sitter 기반 코드 구조 파싱. 함수/클래스/모듈 관계 자동 인덱싱                                | CRITICAL | Week 3-6  |
| YAML 선언형 에이전트          | .dhelix/agents/ 디렉토리에 YAML로 커스텀 에이전트 정의                                            | HIGH     | Week 4-8  |
| Session Persistence (SQLite)  | 파일 기반 → SQLite 전환. 프로세스 재시작 후 완벽한 세션 복원. Daemon 모드 추가                    | HIGH     | Week 5-9  |
| 부트스트랩 최적화             | Cold start 2-3초 → 800ms 목표. 지연 import 강화, V8 snapshot                                      | MEDIUM   | Week 8-12 |
| LSP Integration Hub (기초)    | TS, Go, Python LSP 자동 감지 & 연결. Auto Loop 안정화 후 진행                                     | HIGH     | Week 9-12 |

### Phase 2: Differentiation — 차별화 구축

**기간**: Month 4-7 (2026 Q3) — "남들이 못 하는 것"

| 항목                     | 설명                                                                 | 우선순위 | 기간       |
| ------------------------ | -------------------------------------------------------------------- | -------- | ---------- |
| Project DNA Engine       | 코딩 컨벤션, 네이밍 규칙, 아키텍처 패턴 자동 학습                    | CRITICAL | Week 1-5   |
| Semantic Context Ranking | 3-Layer Compaction에 시맨틱 중요도 점수 추가. "관련성" 기반 우선순위 | CRITICAL | Week 3-7   |
| Policy-as-Code Engine    | 팀/프로젝트별 보안 정책을 .dhelix/policy.yaml로 관리                 | HIGH     | Week 5-8   |
| SWE-bench 도전           | SWE-bench Verified 벤치마크 참가. 목표: 75%+ (top-5 진입)            | HIGH     | Week 6-10  |
| Token Budget Optimizer   | Compaction + Dual Model + Selective Tool로 비용 혁신                 | HIGH     | Week 8-12  |
| IDE Plugin (VS Code)     | VS Code 사이드바에서 dhelix 에이전트 실행                            | MEDIUM   | Week 10-14 |

### Phase 3: Moat Building — 해자 구축

**기간**: Month 8-12 (2026 Q4 ~ 2027 Q1) — "따라올 수 없는 격차"

| 항목                      | 설명                                                            | 우선순위 | 기간       |
| ------------------------- | --------------------------------------------------------------- | -------- | ---------- |
| Context Flywheel v2       | 팀 메모리 동기화, 크로스-프로젝트 패턴 학습, 자동 의사결정 추적 | CRITICAL | Week 1-8   |
| Enterprise Suite          | SSO 통합, RBAC, 감사 대시보드, Air-Gap 배포                     | HIGH     | Week 4-12  |
| Agent Marketplace         | 커뮤니티 커스텀 에이전트/스킬/MCP 서버 마켓플레이스             | HIGH     | Week 6-14  |
| Tauri 데스크톱 앱         | CLI 파워 + GUI 편의성 결합 네이티브 앱                          | MEDIUM   | Week 8-16  |
| ACP (Agent Communication) | Agent-to-Agent 통신 프로토콜. 미래 표준 선점                    | MEDIUM   | Week 10-16 |
| 한국 시장 특화            | 한국어 UX, NHN Cloud/Naver Clova 통합                           | HIGH     | Week 6-12  |

---

## 6. 아키텍처 진화 방향

### 6.1 현재 아키텍처 (As-Is): 4-Layer

```
Layer 1: CLI (Ink/React)
  └─ App.tsx + 22 Components + 7 Hooks

Layer 2: Core (Zero UI)
  └─ Agent Loop + Context Manager
  └─ Recovery + Subagents

Layer 3: Infrastructure
  └─ LLM Client + Tool System
  └─ Guardrails + Permissions + MCP

Layer 4: Leaf Modules
  └─ Utils + Config + Skills + Memory

문제: Code Intelligence 없음
문제: 세션 영속성 취약
문제: 에이전트 커스터마이즈 어려움
```

### 6.2 목표 아키텍처 (To-Be): 5-Layer Code-Intelligent

```
Layer 0: Platform ← NEW
  └─ Daemon Process (persistent server)
  └─ SQLite Session Store
  └─ Auto Lint/Test Runner (Phase 1) → LSP Server Pool (Phase 2)

Layer 1: CLI + Desktop + IDE Plugin
  └─ Ink TUI / Tauri Desktop / VS Code

Layer 2: Intelligence Core ← EVOLVED
  └─ Agent Loop + Code Intelligence
  └─ Semantic Context + Project DNA
  └─ YAML Agent Loader

Layer 3: Infrastructure
  └─ LLM + Tools + Security + MCP
  └─ Policy-as-Code Engine ← NEW

Layer 4: Foundation
  └─ Utils + Config + Skills + Memory
  └─ Context Flywheel ← NEW
```

### 6.3 핵심 아키텍처 변화

**Layer 0: Platform Layer**

현재 CLI 프로세스 종료 = 세션 종료. 새로운 Platform Layer는 persistent background server를 도입하여 세션 영속성을 보장한다.

```
dhelix daemon start
  ├─ SQLite session store
  ├─ Auto lint/test runner (Phase 1)
  ├─ LSP server pool (Phase 2)
  ├─ File watcher (fsnotify)
  └─ IPC socket (/tmp/dhelix.sock)

dhelix chat
  └─ IPC → daemon → agent loop
```

**Code Intelligence Engine**

파일 수정 후 자동 품질 검증 → LLM 피드백 루프를 에이전트 루프에 내장한다. Phase 1은 빌드 도구 실행 방식, Phase 2에서 LSP를 추가한다.

```typescript
// Phase 1: 빌드 도구 실행 방식 (Aider/Claude Code 접근)
async executeToolWithIntelligence(call) {
  const result = await tool.execute(call)

  if (isFileModification(call)) {
    // 프로젝트 설정에 따라 적절한 검증 명령어 실행
    const checks = await runProjectChecks() // tsc --noEmit, eslint, pytest...
    if (checks.errors.length > 0) {
      // LLM에 에러 출력 피드백 → 자동 수정 시도
      context.addFeedback(checks)
      return { result, needsFix: true }
    }
  }
  return { result, needsFix: false }
}

// Phase 2: LSP 추가 (OpenCode 수준 달성)
// lsp.getDiagnostics()로 실시간 타입 체크 추가
```

**YAML Agent Definition**

선언형 커스텀 에이전트 정의를 지원한다.

```yaml
# .dhelix/agents/spring-expert.yaml
name: spring-expert
description: Spring Boot 전문 에이전트
model: claude-sonnet-4
temperature: 0.3
tools:
  - file_read
  - file_write
  - bash_exec
  - grep_search
system_prompt: |
  You are a Spring Boot expert.
  Follow our team conventions in DHELIX.md.
permissions:
  allow: ["Bash(./gradlew *)"]
  deny: ["Bash(rm *)"]
```

---

## 7. 즉시 실행 가능한 Quick Wins

### 1주 내 실행 가능

| 항목                | 설명                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------- |
| SWE-bench Lite 도전 | 현재 아키텍처로 SWE-bench Lite 실행. 점수 확보만으로 마케팅 소재                      |
| README.md 리뉴얼    | "5-Layer Security Guardrails" "3-Layer Context Compaction" 등 고유 강점을 전면에 배치 |
| /doctor 명령어 강화 | 시스템 진단을 더 직관적으로. 처음 실행 시 "당신의 환경에 맞는 최적 설정" 안내         |

### 2주 내 실행 가능

| 항목                    | 설명                                                                  |
| ----------------------- | --------------------------------------------------------------------- |
| Auto Lint/Test Hook     | file_write/file_edit 후 자동 lint 실행. 기존 Hook 시스템 활용         |
| YAML 에이전트 로더 (v1) | 기존 subagent spawner에 YAML 파서만 추가. 선언형 에이전트 정의의 MVP  |
| 비용 최적화 대시보드    | 기존 cost-tracker를 풍부한 TUI 대시보드로. "이번 세션에서 $2.30 절약" |

---

## 8. 성공 지표 (KPI)

### Phase 1 KPI (Q2)

| 지표                 | 목표값                                |
| -------------------- | ------------------------------------- |
| Auto Fix Loop 성공률 | ≥ 70% (lint/typecheck 에러 자동 수정) |
| 세션 복원율          | 99%                                   |
| 부트스트랩 시간      | < 1초                                 |
| Auto-fix 성공률      | ≥ 60%                                 |

### Phase 2 KPI (Q3)

| 지표               | 목표값                |
| ------------------ | --------------------- |
| SWE-bench 점수     | ≥ 75%                 |
| 토큰 효율 개선     | ≥ 2x (동일 작업 대비) |
| Project DNA 정확도 | ≥ 80%                 |
| VS Code 플러그인   | 출시                  |

### Phase 3 KPI (Q4~)

| 지표                  | 목표값 |
| --------------------- | ------ |
| 엔터프라이즈 고객     | ≥ 3사  |
| 마켓플레이스 에이전트 | ≥ 20개 |
| 데스크톱 앱           | 출시   |
| GitHub Stars          | 5K+    |

---

## 9. 결론

dhelix는 "OpenCode의 카피캣"이 되어서는 안 된다. **"코드를 가장 깊이 이해하고, 가장 안전하며, 쓸수록 똑똑해지는"** 독자적 정체성을 가진 Coding Agent로 진화해야 한다.

내부 아키텍처는 이미 견고하다. 지금 필요한 것은 세 가지다:

1. **Auto Lint/Test Loop로 "보이는" 지능 추가** — 사용자가 즉시 체감하는 코드 품질 자동 검증 (이후 LSP로 확장)
2. **엔터프라이즈 신뢰 강화** — 규제 산업의 유일한 선택지
3. **Context Flywheel로 해자 구축** — 쓸수록 똑똑해지는 축적 효과

이 세 가지를 12개월 안에 실행하면, dhelix는 "OpenCode보다 낫지 않다"가 아닌 **"dhelix만이 할 수 있는 것이 있다"**는 평가를 받게 될 것이다.

---

## References

- [OpenCode GitHub](https://github.com/opencode-ai/opencode)
- [Claude Code Overview](https://code.claude.com/docs/en/overview)
- [Aider - AI Pair Programming](https://aider.chat/)
- [Gemini CLI GitHub](https://github.com/google-gemini/gemini-cli)
- [Best AI Coding Agents 2026 - Faros](https://www.faros.ai/blog/best-ai-coding-agents-2026)
- [15 AI Coding Agents Tested - MorphLLM](https://www.morphllm.com/ai-coding-agent)
- [Context Flywheel - Sonar Summit 2026](https://jedi.be/blog/2026/talk-2026-context-flywheel-how-best-ai-coding-teams-pull-ahead/)
- [OpenCode vs Claude Code - DEV Community](https://dev.to/tech_croc_f32fbb6ea8ed4/opencode-vs-claude-code-which-ai-cli-coding-agent-wins-in-2026-45md)
- [AI Coding Tools Landscape 2026](https://eastondev.com/blog/en/posts/ai/ai-coding-tools-panorama-2026/)
