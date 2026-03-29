# Issue 6: /model 선택이 재시작 후 유지되지 않는 문제

> 작성일: 2026-03-20
> 심각도: **CRITICAL**
> 근거: 5명 Agent Teams 병렬 분석 (웹 리서치 + 코드 심층 분석)
> 상태: 분석 완료, 구현 계획 수립

---

## 1. 문제 요약

사용자가 `/model` 슬래시 명령으로 모델을 변경한 후 dhelix를 종료하고 재시작하면,
선택한 모델이 아닌 **환경변수에 설정된 기본 모델**로 되돌아간다.

### 재현 시나리오

```
1. dhelix 시작 (기본 모델: MiniMax-M2.5 via LOCAL_MODEL 환경변수)
2. /model gpt-4o 실행 → 모델 변경 성공, config.json에 저장됨
3. dhelix 종료 (Ctrl+D)
4. dhelix 재시작
5. 결과: MiniMax-M2.5로 되돌아감 (gpt-4o가 아님)
```

---

## 2. 근본 원인 분석

### 2-1. 3가지 독립적인 버그

| #     | 원인                                 | 심각도   | 위치                           |
| ----- | ------------------------------------ | -------- | ------------------------------ |
| **A** | 환경변수가 사용자 설정을 항상 덮어씀 | CRITICAL | `src/config/loader.ts:153-160` |
| **B** | 세션 resume 시 저장된 모델 무시      | HIGH     | `src/index.ts:453-471`         |
| **C** | Provider 트리플 미영속화             | MEDIUM   | `src/commands/model.ts:27-44`  |

---

### 2-2. 원인 A: 환경변수 우선순위 오류 (CRITICAL)

**현재 config 로딩 순서** (`src/config/loader.ts:120-182`):

```
Level 1: 기본값 (defaults.ts)       → model: "gpt-4o-mini"
Level 2: 사용자 설정 (~/.dhelix/config.json) → model: "gpt-4o"  ← /model이 저장한 값
Level 3: 프로젝트 설정 (.dhelix/config.json) → (없음)
Level 4: 환경변수 (LOCAL_MODEL, OPENAI_MODEL) → model: "MiniMax-M2.5"  ← 이것이 Level 2를 덮어씀!
Level 5: CLI 플래그 (--model)        → (없음)
```

**문제**: Level 4(환경변수)가 Level 2(사용자가 `/model`로 명시 저장한 설정)를 무조건 덮어쓴다.

**코드 위치** (`src/config/loader.ts:153-160`):

```typescript
// Level 4: 환경변수 — 배포 환경별 설정 주입에 유용
const envConfig = loadEnvConfig();
if (Object.keys(envConfig).length > 0) {
  merged = deepMerge(merged, envConfig as Record<string, unknown>);
}
```

`loadEnvConfig()` (`src/config/loader.ts:56-100`):

```typescript
// 모델명 결정: LOCAL_MODEL > DHELIX_MODEL > OPENAI_MODEL > 기본값
if (process.env.LOCAL_MODEL) {
  llm.model = process.env.LOCAL_MODEL; // ← 항상 환경변수가 승리
}
```

**정상적인 우선순위** (Claude Code 참고):

```
Managed > CLI args > Local > Project > User > Env > Defaults
                                                ↑
                                    사용자 명시 설정이 환경변수보다 높아야 함
```

### 2-3. 원인 B: 세션 Resume 시 모델 무시 (HIGH)

**`SessionMetadata`에 model 필드가 존재하지만 사용되지 않음:**

`src/core/session-manager.ts:186-194`:

```typescript
export interface SessionMetadata {
  readonly id: string;
  readonly model: string; // ← 저장되지만 resume 시 읽히지 않음!
  // ...
}
```

`src/index.ts:453-471` (resume 로직):

```typescript
if (opts.continue) {
  sessionId = (await sessionManager.getMostRecentSessionId()) ?? undefined;
  // sessionId만 가져오고, 메타데이터에서 model을 읽지 않음!
}

// App 렌더링 시 항상 config에서 로딩
render(
  React.createElement(App, {
    model: config.llm.model, // ← 항상 config, 세션 메타데이터 무시
  }),
);
```

### 2-4. 원인 C: Provider 트리플 미영속화 (MEDIUM)

`/model` 명령으로 Local↔Cloud 프로바이더를 전환하면,
`persistModelChoice()`는 **모델 이름만** 저장하고 `baseURL`과 `apiKey`는 저장하지 않는다.

`src/commands/model.ts:27-44`:

```typescript
async function persistModelChoice(model: string): Promise<void> {
  // ...
  existing.llm = { ...llm, model }; // ← model만 저장, baseURL/apiKey 미저장
  await writeFile(configPath, JSON.stringify(existing, null, 2) + "\n", "utf-8");
}
```

재시작 시 모델 이름은 `gpt-4o`이지만, baseURL이 여전히 로컬 서버(`http://210.127.33.120:30449`)를 가리킬 수 있다.

---

## 3. 경쟁 도구 비교 분석

| 도구            | 영속화 위치                  | 영속화 시점               | 우선순위                               |
| --------------- | ---------------------------- | ------------------------- | -------------------------------------- |
| **Claude Code** | `settings.json` (4개 스코프) | /model 즉시               | Managed > CLI > Local > Project > User |
| **Aider**       | `.aider.conf.yml`            | 사전 편집 (런타임 비영속) | CLI > CWD > Git root > Home            |
| **Cursor**      | SQLite `state.vscdb`         | UI 변경 즉시              | 단일 레벨                              |
| **Continue**    | `config.yaml`                | 파일 편집                 | 단일 레벨                              |
| **dhelix**      | `~/.dhelix/config.json`      | /model 즉시 (정상)        | 환경변수가 사용자 설정 덮어씀 (버그)   |

### 핵심 인사이트

- **Claude Code**: 사용자 명시 설정 > 환경변수 (dhelix와 반대)
- **Aider**: 환경변수 `AIDER_MODEL`이 config보다 높지만, 런타임 `/model`은 영속화 안 함
- **공통 함정**: "환경변수 override blindness" — 사용자가 `.env`에 설정한 것을 잊고 `/model`이 안 되는 것처럼 느낌

---

## 4. 해결 방안

### 방안 A: "사용자 명시 설정 우선" (권장)

사용자가 `/model`로 **명시적으로** 선택한 모델은 환경변수보다 높은 우선순위를 가져야 한다.

```
기존: defaults < user config < project config < env vars < CLI flags
수정: defaults < env vars < project config < user config < CLI flags
                    ↑                              ↑
           환경변수를 아래로              사용자 명시 설정을 위로
```

**구현**:

```typescript
// src/config/loader.ts — loadConfig() 수정
// Level 2: 환경변수 (기본 fallback으로 격하)
const envConfig = loadEnvConfig();
if (Object.keys(envConfig).length > 0) {
  merged = deepMerge(merged, envConfig as Record<string, unknown>);
}

// Level 3: 프로젝트 설정
const projectConfig = await loadProjectConfig();
merged = deepMerge(merged, projectConfig);

// Level 4: 사용자 설정 (~/.dhelix/config.json) — 환경변수보다 높음
const userConfig = await loadUserConfig();
merged = deepMerge(merged, userConfig);

// Level 5: CLI 플래그 (최우선)
merged = deepMerge(merged, cliOverrides);
```

**장점**: 사용자 의도 존중, Claude Code 패턴과 일치
**단점**: 기존 환경변수 의존 사용자에게 영향 (마이그레이션 필요)

### 방안 B: "명시적 플래그 방식"

`persistModelChoice()`에서 저장할 때 `_explicit: true` 플래그를 함께 저장.
config 로딩 시 explicit 플래그가 있으면 환경변수를 무시.

```typescript
// ~/.dhelix/config.json
{
  "llm": {
    "model": "gpt-4o",
    "modelExplicit": true,  // /model 명령으로 명시 설정됨
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "sk-..."
  }
}
```

```typescript
// src/config/loader.ts — loadEnvConfig() 수정
if (userConfig?.llm?.modelExplicit) {
  // 사용자가 /model로 명시 설정했으므로 환경변수 무시
  delete envConfig.llm?.model;
}
```

**장점**: 기존 환경변수 동작 유지, 최소 변경
**단점**: 플래그 관리 복잡성

### 방안 C: "세션 모델 복원" (B와 병행)

세션 resume 시 저장된 모델을 복원.

```typescript
// src/index.ts — resume 로직 수정
if (sessionId) {
  const metadata = await sessionManager.getMetadata(sessionId);
  if (metadata?.model) {
    // 세션에 저장된 모델을 config에 오버라이드
    config.llm.model = metadata.model;
  }
}
```

---

## 5. 권장 구현 계획

### Phase 1: 핵심 수정 (방안 A + C 조합)

| #   | 작업                                                              | 파일                          | 예상 난이도 |
| --- | ----------------------------------------------------------------- | ----------------------------- | ----------- |
| 1   | config 우선순위 재정렬: env → user config 순서 변경               | `src/config/loader.ts`        | Medium      |
| 2   | `persistModelChoice()`에 provider 트리플 저장                     | `src/commands/model.ts`       | Low         |
| 3   | 세션 resume 시 `getMetadata()` → model 복원                       | `src/index.ts`                | Low         |
| 4   | `loadEnvConfig()`에서 model이 user config에 이미 설정된 경우 스킵 | `src/config/loader.ts`        | Medium      |
| 5   | 세션 생성 시 provider 정보도 metadata에 저장                      | `src/core/session-manager.ts` | Low         |

### Phase 2: 안전장치

| #   | 작업                                                   | 파일                    | 예상 난이도 |
| --- | ------------------------------------------------------ | ----------------------- | ----------- |
| 6   | `/model` 실행 후 "Saved as default" 메시지에 경고 추가 | `src/commands/model.ts` | Low         |
| 7   | 시작 시 "Using model from: [source]" 로그 추가         | `src/index.ts`          | Low         |
| 8   | config.json 백업/복구 메커니즘                         | `src/config/loader.ts`  | Medium      |

### Phase 3: 테스트

| #   | 작업                               | 파일                                         | 예상 난이도 |
| --- | ---------------------------------- | -------------------------------------------- | ----------- |
| 9   | config 우선순위 단위 테스트        | `test/unit/config/loader.test.ts`            | Medium      |
| 10  | model persistence 통합 테스트      | `test/integration/model-persistence.test.ts` | Medium      |
| 11  | session resume + model 복원 테스트 | `test/unit/core/session-manager.test.ts`     | Low         |

---

## 6. 상세 구현 명세

### 6-1. Config 우선순위 재정렬

```typescript
// src/config/loader.ts — loadConfig() 수정

export async function loadConfig(cliOverrides?: Partial<AppConfig>): Promise<ResolvedConfig> {
  // Level 1: 기본값 (최저 우선순위)
  let merged = { ...DEFAULT_CONFIG };

  // Level 2: 환경변수 (기본 fallback — 사용자 설정보다 낮음)
  const envConfig = loadEnvConfig();
  if (Object.keys(envConfig).length > 0) {
    merged = deepMerge(merged, envConfig as Record<string, unknown>);
  }

  // Level 3: 프로젝트 설정 (.dhelix/config.json)
  const projectConfigPath = joinPath(process.cwd(), ".dhelix", "config.json");
  try {
    const raw = await readFile(projectConfigPath, "utf-8");
    const projectConfig = JSON.parse(raw);
    merged = deepMerge(merged, projectConfig);
  } catch { /* 없으면 무시 */ }

  // Level 4: 사용자 설정 (~/.dhelix/config.json) — 환경변수보다 높음!
  const userConfigPath = joinPath(CONFIG_DIR, "config.json");
  try {
    const raw = await readFile(userConfigPath, "utf-8");
    const userConfig = JSON.parse(raw);
    merged = deepMerge(merged, userConfig);
  } catch { /* 없으면 무시 */ }

  // Level 5: CLI 플래그 (최우선)
  if (cliOverrides) {
    merged = deepMerge(merged, cliOverrides as Record<string, unknown>);
  }

  return { config: merged as AppConfig, sources: [...] };
}
```

### 6-2. Provider 트리플 영속화

```typescript
// src/commands/model.ts — persistModelChoice() 확장

async function persistModelChoice(
  model: string,
  provider?: { baseUrl: string; apiKey: string },
): Promise<void> {
  const configPath = joinPath(CONFIG_DIR, "config.json");
  await mkdir(CONFIG_DIR, { recursive: true });

  let existing: Record<string, unknown> = {};
  try {
    const raw = await readFile(configPath, "utf-8");
    existing = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    /* 새 파일 */
  }

  const llm = (existing.llm ?? {}) as Record<string, unknown>;
  const updated = { ...llm, model };

  // Provider 트리플 영속화 (Local↔Cloud 전환 시)
  if (provider) {
    updated.baseUrl = provider.baseUrl;
    updated.apiKey = provider.apiKey;
  }

  existing.llm = updated;
  await writeFile(configPath, JSON.stringify(existing, null, 2) + "\n", "utf-8");
}
```

### 6-3. 세션 Resume 시 모델 복원

```typescript
// src/index.ts — resume 로직에 모델 복원 추가

let sessionId: string | undefined;
const sessionManager = new SessionManager();

if (opts.continue) {
  sessionId = (await sessionManager.getMostRecentSessionId()) ?? undefined;
} else if (opts.resume) {
  sessionId = opts.resume;
}

// 세션 resume 시 저장된 모델 복원
let resolvedModel = config.llm.model;
if (sessionId) {
  try {
    const metadata = await sessionManager.getMetadata(sessionId);
    if (metadata?.model && metadata.model !== resolvedModel) {
      resolvedModel = metadata.model;
      // LLM 클라이언트도 세션 모델에 맞게 재생성
      // client = createLLMClientForModel({ model: resolvedModel, ... });
    }
  } catch {
    /* 메타데이터 로딩 실패 시 config 모델 사용 */
  }
}
```

---

## 7. 영향 범위 및 사이드 이펙트

### 변경 영향 받는 파일

| 파일                          | 변경 내용                     | 사이드 이펙트 위험                                        |
| ----------------------------- | ----------------------------- | --------------------------------------------------------- |
| `src/config/loader.ts`        | 우선순위 재정렬               | **HIGH** — `.env`에 `LOCAL_MODEL` 설정한 기존 사용자 영향 |
| `src/commands/model.ts`       | provider 트리플 저장          | LOW — 기존 동작 superset                                  |
| `src/index.ts`                | resume 모델 복원              | MEDIUM — resume 동작 변경                                 |
| `src/core/session-manager.ts` | provider 정보 메타데이터 추가 | LOW — 인터페이스 확장                                     |

### 마이그레이션 고려사항

1. **기존 `.env` 사용자**: `LOCAL_MODEL=MiniMax-M2.5`를 `.env`에 설정한 사용자는,
   `/model`로 변경 후 재시작하면 이제 변경된 모델이 유지됨 (이전에는 `.env`가 우선)
2. **알림 필요**: 첫 실행 시 "Config priority changed" 로그 메시지 출력 권장
3. **하위 호환성**: `~/.dhelix/config.json`이 없는 기존 사용자는 환경변수가 그대로 적용됨 (영향 없음)

### 테스트 매트릭스

| 시나리오                                      | 기대 결과                              |
| --------------------------------------------- | -------------------------------------- |
| `/model gpt-4o` → 재시작                      | gpt-4o 유지                            |
| `/model gpt-4o` → `--continue`                | gpt-4o 유지 (세션 메타데이터)          |
| `/model gpt-4o` → `--resume <id>`             | gpt-4o 유지 (세션 메타데이터)          |
| `LOCAL_MODEL=X` + `/model Y` → 재시작         | Y 유지 (사용자 명시 > 환경변수)        |
| `LOCAL_MODEL=X` + config.json 없음 → 시작     | X 사용 (환경변수 fallback)             |
| `--model Z` + `/model Y` → 재시작             | Y 유지 (config에 Y 저장, CLI 없으면 Y) |
| `--model Z` + `/model Y` → `--model Z` 재시작 | Z 사용 (CLI가 최우선)                  |
| Local↔Cloud 전환 → 재시작                    | provider 트리플 정상 복원              |

---

## 8. 관련 파일 인덱스

| 파일                            | 역할                     | 핵심 라인                                             |
| ------------------------------- | ------------------------ | ----------------------------------------------------- |
| `src/config/loader.ts`          | 5-Level config 병합      | L120-182 (loadConfig), L56-100 (loadEnvConfig)        |
| `src/config/defaults.ts`        | 기본 설정값              | L21-25 (DEFAULT_CONFIG)                               |
| `src/constants.ts`              | DEFAULT_MODEL 상수       | L101-102                                              |
| `src/commands/model.ts`         | /model 명령 핸들러       | L27-44 (persistModelChoice), L204-247 (execute)       |
| `src/index.ts`                  | 앱 진입점, 모델 초기화   | L264-283 (config), L453-471 (resume), L567 (App 렌더) |
| `src/core/session-manager.ts`   | 세션 메타데이터          | L186-194 (SessionMetadata), L315 (model 저장)         |
| `src/cli/hooks/useAgentLoop.ts` | activeModel React 상태   | L131 (useState), L738-740 (setActiveModel)            |
| `src/cli/App.tsx`               | App 컴포넌트, model prop | 최초 모델 전달                                        |

---

## 9. 웹 리서치 참고 자료

| 출처                                                                            | 핵심 내용                                                 |
| ------------------------------------------------------------------------------- | --------------------------------------------------------- |
| [Claude Code Settings](https://code.claude.com/docs/en/settings)                | 4-scope 설정 계층: Managed > CLI > Local > Project > User |
| [Claude Code Model Config](https://code.claude.com/docs/en/model-config)        | 모델 별칭 시스템, 환경변수 오버라이드                     |
| [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams)          | 팀 리더/멤버 모델 설정, 세션 복원 제한                    |
| [Aider Config](https://aider.chat/docs/config.html)                             | YAML 기반 설정, 런타임 /model 미영속                      |
| [Aider Model Settings](https://aider.chat/docs/config/adv-model-settings.html)  | 모델별 설정 YAML                                          |
| [Continue Config](https://docs.continue.dev/customize/deep-dives/configuration) | config.yaml 기반, 수동 편집                               |
| [Cursor Models](https://docs.cursor.com/settings/models)                        | SQLite 기반 설정 영속화                                   |
| [electron-store](https://github.com/sindresorhus/electron-store)                | 원자적 쓰기, JSON Schema 검증                             |

---

## 10. 결론

### 요약

`/model` 선택이 재시작 후 유지되지 않는 문제는 **3가지 독립 버그의 복합체**이다:

1. **환경변수 우선순위 오류** (CRITICAL) — 사용자 명시 설정보다 `.env` 환경변수가 높음
2. **세션 resume 모델 무시** (HIGH) — `SessionMetadata.model` 존재하지만 읽지 않음
3. **Provider 트리플 미영속** (MEDIUM) — model만 저장, baseURL/apiKey 누락

### 권장 접근

**Phase 1**에서 config 우선순위 재정렬 + 세션 모델 복원을 동시 수정.
**Phase 2**에서 provider 트리플 영속화 + 사용자 피드백 개선.
**Phase 3**에서 포괄적 테스트 추가.

### 예상 작업량

- Phase 1: 5개 파일, ~100줄 변경
- Phase 2: 3개 파일, ~50줄 변경
- Phase 3: 3개 테스트 파일, ~150줄 추가
- 총합: ~300줄, 위험도 **MEDIUM** (config 우선순위 변경의 기존 사용자 영향 주의)
