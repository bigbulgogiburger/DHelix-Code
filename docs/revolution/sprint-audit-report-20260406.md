# Sprint Audit Report — v0.3 ~ v0.7

> 2026-04-06 / 4개 병렬 감사 에이전트 실행 결과

---

## 1. 기본 검증

| Check              | Result                          |
| ------------------ | ------------------------------- |
| `npx tsc --noEmit` | **PASS** (0 errors)             |
| `npx vitest run`   | **304 files, 6,475 tests PASS** |
| `npm run build`    | **PASS** (ESM + DTS)            |

---

## 2. 감사 영역별 결과 요약

| 영역                     | 검증 항목 수 | 통과   | 실패  | 판정     |
| ------------------------ | ------------ | ------ | ----- | -------- |
| Core + Runtime           | 8            | 7      | 1     | FAIL     |
| LLM + Tools              | 8            | 4      | 4     | FAIL     |
| Security + MCP + Plugins | 11           | 11     | 0     | **PASS** |
| CLI + Skills + Platform  | 15           | 15     | 0     | **PASS** |
| **합계**                 | **42**       | **37** | **5** |          |

---

## 3. 발견된 문제 상세

### Issue #1: AsyncCompactionEngine barrel export 누락

| 항목      | 내용                                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| 심각도    | **MEDIUM**                                                                                                 |
| 파일      | `src/core/runtime/index.ts`                                                                                |
| 문제      | `AsyncCompactionEngine`, `CompactionTicket`, `CompactionResult`가 barrel export에 누락됨                   |
| 영향      | 외부 모듈이 `src/core/runtime/index.js`에서 import 불가 — 직접 경로(`./async-compaction.js`)로만 접근 가능 |
| 현재 상태 | `context-manager.ts`에서 직접 import하여 **런타임 동작에는 문제 없음**                                     |
| 수정 방법 | `src/core/runtime/index.ts` 하단에 추가:                                                                   |

```typescript
export {
  AsyncCompactionEngine,
  type CompactionTicket,
  type CompactionResult,
} from "./async-compaction.js";
```

---

### Issue #2: LOCAL_MODEL_MANIFEST registry 미등록

| 항목      | 내용                                                                            |
| --------- | ------------------------------------------------------------------------------- |
| 심각도    | **HIGH**                                                                        |
| 파일      | `src/llm/providers/registry.ts`                                                 |
| 문제      | `ProviderRegistry.create()`에 Local 프로바이더(Ollama/LMStudio)가 등록되지 않음 |
| 영향      | `registry.resolve("ollama:llama3")` 호출 시 Local 프로바이더를 찾을 수 없음     |
| 현재 상태 | `LOCAL_MODEL_MANIFEST`는 `local.ts`에 정의되어 있으나 registry에 미연결         |
| 수정 방법 | `registry.ts`의 `create()` 내부에 추가:                                         |

```typescript
import { LOCAL_MODEL_MANIFEST, LocalModelProvider } from "./local.js";

// create() 내부, GROQ_MANIFEST 등록 뒤에:
registry.register(
  LOCAL_MODEL_MANIFEST,
  overrides?.localFactory ??
    (() => {
      return createUnifiedAdapter(new LocalModelProvider(), LOCAL_MODEL_MANIFEST);
    }),
);
```

---

### Issue #3: LocalModelProvider barrel export 누락

| 항목      | 내용                                                                     |
| --------- | ------------------------------------------------------------------------ |
| 심각도    | **HIGH**                                                                 |
| 파일      | `src/llm/providers/index.ts`                                             |
| 문제      | `LocalModelProvider`, `LOCAL_MODEL_MANIFEST` 등이 barrel export에 누락됨 |
| 영향      | 외부에서 `src/llm/providers/index.js`로 Local 프로바이더 접근 불가       |
| 수정 방법 | `src/llm/providers/index.ts` 하단에 추가:                                |

```typescript
// Local model 프로바이더
export {
  LocalModelProvider,
  LOCAL_MODEL_MANIFEST,
  resolveOllamaEndpoint,
  resolveLMStudioEndpoint,
  resolveLocalEndpoint,
} from "./local.js";
```

---

### Issue #4: AnthropicProvider가 UnifiedLLMProvider 미구현

| 항목               | 내용                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 심각도             | **INFO** (런타임 영향 없음)                                                                                                                                   |
| 파일               | `src/llm/providers/anthropic.ts:514`                                                                                                                          |
| 문제               | v0.2.0 기존 코드인 `AnthropicProvider`가 `LLMProvider`만 구현하고 `UnifiedLLMProvider`는 미구현                                                               |
| 영향               | **없음** — registry에서 `createUnifiedAdapter()`로 래핑하여 `manifest`, `healthCheck()`, `estimateCost()`를 자동 제공                                         |
| 비교               | v0.4+ 신규 프로바이더(Gemini, Azure, Bedrock, Mistral, Groq, Local)는 모두 `UnifiedLLMProvider` 직접 구현                                                     |
| 수정 방법 (선택적) | `AnthropicProvider`에 `implements UnifiedLLMProvider` 추가 + 3개 메서드 구현. 단, 기존 동작을 깨뜨릴 위험이 있으므로 **별도 리팩토링 스프린트에서 처리 권장** |

---

### Issue #5: Anthropic factory가 어댑터 래핑 사용

| 항목   | 내용                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------ |
| 심각도 | **INFO** (설계 차이, 문제 아님)                                                                  |
| 파일   | `src/llm/providers/registry.ts:373-384`                                                          |
| 문제   | Anthropic factory가 다른 프로바이더와 달리 `createUnifiedAdapter()`로 래핑                       |
| 영향   | **없음** — 어댑터가 정상 동작하며 다른 프로바이더와 동일한 인터페이스를 제공                     |
| 설명   | AnthropicProvider는 v0.2.0 기존 코드이므로 래핑 방식이 의도된 설계. v0.4+ 프로바이더는 직접 구현 |

---

## 4. 영역별 상세 검증 결과

### 4.1 Core + Runtime (7/8 PASS)

| #   | 항목                                     | 결과     | 비고                                                  |
| --- | ---------------------------------------- | -------- | ----------------------------------------------------- |
| 1   | pipeline.ts → 9 stage import             | PASS     | 모든 stage 올바르게 import                            |
| 2   | runtime/index.ts barrel export           | **FAIL** | async-compaction 누락 (Issue #1)                      |
| 3   | async-compaction ↔ compact-context 연결 | PASS     | stage에서 AsyncCompactionEngine 사용 확인             |
| 4   | metrics.ts StageName ��� types.ts 일치   | PASS     | 동일 타입 import                                      |
| 5   | session-manager SQLite dual-path         | PASS     | `DHELIX_SESSION_STORE` env 기반 분기                  |
| 6   | session/ barrel export                   | PASS     | sqlite-store, streaming-writer, migration 모두 export |
| 7   | session-fork → session-manager 참조      | PASS     | SessionManager import 확인                            |
| 8   | context-manager cold storage GC          | PASS     | gzip 압축 + enforceColdStorageLimit + 5분 GC 타이머   |

### 4.2 LLM + Tools (4/8 PASS)

| #   | 항목                                          | 결과     | 비고                                                       |
| --- | --------------------------------------------- | -------- | ---------------------------------------------------------- |
| 1   | registry에 8개 프로바이더 등록                | **FAIL** | Local 미등록 (Issue #2)                                    |
| 2   | providers/index.ts barrel                     | **FAIL** | Local 미export (Issue #3)                                  |
| 3   | UnifiedLLMProvider 구현                       | **FAIL** | Anthropic만 미구현 (Issue #4, INFO)                        |
| 4   | TaskClassifier → dual-model-router            | PASS     | L17에서 import + L69에서 사용                              |
| 5   | classifyError → executor.ts                   | PASS     | L28에서 import + L130, L143에서 사용                       |
| 6   | pipeline.ts → preflight/scheduler/postprocess | PASS     | L24-31에서 올바른 import                                   |
| 7   | ToolStreamEvent → AppEvents                   | PASS     | events.ts L217에 `"tool:stream"` 등록                      |
| 8   | 새 도구 4개 ToolDefinition 구조               | PASS     | apply_patch, batch_file_ops, code_mode, refactor 모두 정상 |

### 4.3 Security + MCP + Plugins (11/11 PASS)

| #   | 항목                        | 결과 | 비고                                    |
| --- | --------------------------- | ---- | --------------------------------------- |
| 1   | env-sanitizer → bash-exec   | PASS | L30에서 import + L173-184에서 사용      |
| 2   | policy-engine TOML 파서     | PASS | 자체 구현 (L141-197)                    |
| 3   | approval-db better-sqlite3  | PASS | L36 import, L118 인스턴스 생성          |
| 4   | trust-tiers 참조 가능성     | PASS | TrustTier enum + resolveTier() export   |
| 5   | health-monitor 독립성       | PASS | pingFn/reconnectFn 외부 주입            |
| 6   | tool-filter glob 패턴       | PASS | globToRegExp (L43-58) + deny-first 평가 |
| 7   | agent-to-agent 독립성       | PASS | 인메모리 브리지, 외부 의존성 없음       |
| 8   | registry-client 독립성      | PASS | HTTP 기반, mock 폴백                    |
| 9   | plugins 구조                | PASS | types + loader + registry 올바른 분리   |
| 10  | agent-manifest 8개 built-in | PASS | 8개 정확히 정의 + BUILTIN_MANIFESTS Map |
| 11  | message-bus 독립성          | PASS | 인메모리, crypto.randomUUID만 사용      |
| 12  | orchestration-store 이벤트  | PASS | 6개 이벤트 유니온 타입                  |

### 4.4 CLI + Skills + Platform (15/15 PASS)

| #   | 항목                                    | 결과 | 비고                                               |
| --- | --------------------------------------- | ---- | -------------------------------------------------- |
| 1   | CLI layout Ink 준수                     | PASS | Box/Text/useStdout만 사용                          |
| 2   | DiffViewer → diff-utils                 | PASS | computeDiff, detectLanguage, formatLineNumber 사용 |
| 3   | Panel components Ink 준수               | PASS | Job/Task/Approval 모두 Box/Text만                  |
| 4   | AgentTabs → utils                       | PASS | 4개 함수/타입 사용                                 |
| 5   | MessageList windowing                   | PASS | 5개 util 함수 사용                                 |
| 6   | Accessibility barrel export             | PASS | contrast, screen-reader, keyboard-nav 모두 export  |
| 7   | Skill manifest ↔ SkillFrontmatter 호환 | PASS | extends + schema.extend()                          |
| 8   | Composer → manifest 참조                | PASS | SkillManifest import 확인                          |
| 9   | Hook events 12개 페이로드               | PASS | 12개 인터페이스 + HookEventRegistry                |
| 10  | Event-emitter-adapter → AppEventEmitter | PASS | 5개 이벤트 매핑                                    |
| 11  | Dashboard Node.js API만 사용            | PASS | node:http, node:crypto만                           |
| 12  | Cloud 모듈 독립성                       | PASS | node:crypto만 사용                                 |
| 13  | Incremental-indexer 충돌 없음           | PASS | 기존 모듈과 분리                                   |
| 14  | Semantic-search ML 독립                 | PASS | 자체 TF-IDF 벡터화                                 |
| 15  | Command-graph 구조                      | PASS | register/resolve/search 모두 구현                  |

---

## 5. 수정 우선순위

| 순위 | Issue                                   | 심각도 | 예상 수정 시간 |
| ---- | --------------------------------------- | ------ | -------------- |
| 1    | #2 LOCAL_MODEL_MANIFEST registry 등록   | HIGH   | 5분            |
| 2    | #3 LocalModelProvider barrel export     | HIGH   | 2분            |
| 3    | #1 AsyncCompactionEngine barrel export  | MEDIUM | 2분            |
| 4    | #4 AnthropicProvider UnifiedLLMProvider | INFO   | 별도 스프린트  |
| 5    | #5 Anthropic factory 어댑터             | INFO   | 수정 불필요    |

**수정 필요: 3건 (Issue #1, #2, #3) — 총 ~10분 작업**
**수정 불필요: 2건 (Issue #4, #5) — 설계 차이, 런타임 영향 없음**

---

## 6. 전체 스프린트 통계

| 버전      | 커밋          | 파일          | LOC             | 테스트           |
| --------- | ------------- | ------------- | --------------- | ---------------- |
| v0.3.0    | `b92fed7`     | 55            | +12,809         | 4,635            |
| v0.4.0 P1 | `95a1c45`     | 13            | +2,937          | 4,781            |
| v0.4.0 P2 | `9c6a94d`     | 18            | +6,285          | 5,025            |
| v0.5.0 P1 | `2d382d6`     | 18            | +4,770          | 5,187            |
| v0.5.0 P2 | `d4c20be`     | 27            | +6,577          | 5,468            |
| v0.6.0 P1 | `762d3da`     | 37            | +13,932         | 5,906            |
| v0.6.0 P2 | `d061c07`     | 15            | +5,335          | 6,124            |
| v0.7.0 P1 | `0944c7d`     | 17            | +5,427          | 6,352            |
| v0.7.0 P2 | `185ce6f`     | 15            | +3,766          | 6,475            |
| **합계**  | **9 commits** | **215 files** | **+61,838 LOC** | **+2,149 tests** |

---

## 7. 결론

- **42개 검증 항목 중 37개 통과 (88%)**
- **실제 수정 필요: 3건** (barrel export 누락 2건 + registry 등록 누락 1건)
- **런타임 영향 있는 문제: 1건** (Local 프로바이더 registry 미등록)
- **tsc, vitest, build 모두 통과** — 타입 시스템과 테스트는 정상
- 문제들은 모두 "연결 누락" (wiring gap)이며 로직 버그는 발견되지 않음
