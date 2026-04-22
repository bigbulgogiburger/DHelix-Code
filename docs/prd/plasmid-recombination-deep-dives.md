# Deep Dives — Plasmid & Recombination System

**작성일**: 2026-04-22
**상태**: v1.0 — Engineering-grade resolution of review blockers
**관련 문서**:
- `docs/prd/plasmid-recombination-system.md` (PRD v0.2)
- `docs/prd/plasmid-recombination-review.md` (Review v1.1)

**목적**: 리뷰가 지적한 Fatal 1건 + Critical 8건 중 **구조적 해결이 필요한 6개 이슈**에 대해 실제 구현 레벨 해법 제시. 각 deep dive는 독립 읽기 가능.

| # | 주제 | 원래 이슈 | 전달물 |
|---|------|---------|-------|
| DD-1 | Deterministic Compiler Problem | F1 | Hybrid DSL + 캐시 아키텍처 |
| DD-2 | Cure as Version Control | C1 | Git-inspired transcript 모델 |
| DD-3 | Minimal Plasmid Schema | C2 | Zod 스키마 코드 + migration 전략 |
| DD-4 | CLAUDE.md Ownership Boundaries | C3 | Include resolver 메커니즘 |
| DD-5 | Market Validation Protocol | C5 | 인터뷰 스크립트 + POC 체크리스트 |
| DD-6 | Observability Semantic Conventions | C8 | OTLP 스펙 + dashboard 설계 |

---

## DD-1. Deterministic Compiler Problem

### 1.1 문제 재정의

PRD는 Recombination을 "컴파일러"로 명명하지만, **진정한 컴파일러가 아니다**:

| 속성 | 전통 컴파일러 (gcc, tsc) | PRD Recombination | 해법 |
|------|--------------------|------------------|-----|
| 입력 파싱 | AST (deterministic) | LLM semantic parse (non-det) | **DSL 도입** |
| IR | 중간표현 (fixed) | LLM-inferred intent graph | **JSON schema IR** |
| 백엔드 | code-gen rules (fixed) | LLM-generated artifact (non-det) | **Template + LLM guided** |
| 재현성 | bit-for-bit | 모델 버전 의존 | **Cache + Hash** |

**근본 문제**: 자연어를 입력으로 받는 시스템은 **기본적으로 결정적이지 않다**. 이를 "컴파일러"라고 부르는 순간 사용자 기대가 형성되고, 깨지면 신뢰 상실.

### 1.2 해결 패러다임: Hybrid DSL + Reproducibility Layer

**원칙**: 결정론을 **포기하지 않되**, 달성 경로를 재설계.

```
┌─────────────────────────────────────────────────────────────┐
│ Plasmid File                                                │
│                                                             │
│ ┌─────────────────────────┐  ┌──────────────────────────┐ │
│ │ Frontmatter (DSL)       │  │ Body (Natural Language)   │ │
│ │ - Structured            │  │ - Guidance                 │ │
│ │ - Deterministic         │  │ - LLM-interpreted          │ │
│ │ - Authoritative         │  │ - Non-authoritative        │ │
│ └─────────────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
         │                                  │
         │ DSL Compiler                     │ Semantic Extractor
         │ (deterministic)                  │ (LLM, cached)
         ▼                                  ▼
┌─────────────────────────┐      ┌──────────────────────────┐
│ Structured Intent IR    │ ←──  │ Body Annotations          │
│ (canonical JSON)        │ merge│ (LLM-suggested fields)    │
└─────────────────────────┘      └──────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Cache (content-addressed)│
│ hash(plasmid) → artifact │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Template-based Generator │
│ (Handlebars + LLM fills) │
└─────────────────────────┘
         │
         ▼
     Artifact
```

**핵심 설계 결정**:

1. **Frontmatter가 authoritative** — body는 힌트
2. **Body에서 LLM이 추출한 annotation은 frontmatter로 승격 후 저장**
3. **Plasmid content hash가 cache key** — 같은 입력 → 같은 출력 (LLM 호출 회피)
4. **Generator는 template + 제한적 LLM fill** — free-form 생성 금지

### 1.3 DSL: 결정적 부분

**Plasmid의 결정적 부분**은 frontmatter + 본문 내 **헤딩 기반 구조**:

```yaml
---
# 결정적 필드 (이것만으로 artifact 생성 가능)
name: owasp-gate
scope: [hooks, rules]
types: [ritualistic, structural]

# Compilation directives — generator에 직접 전달
artifacts:
  - kind: hook
    event: PreToolUse
    matcher:
      tool: Bash
      command-pattern: "^git commit"
    action:
      template: security-scan-gate
      vars:
        severity-threshold: high
  - kind: rule
    location:
      file: .dhelix/rules.generated.md
      section: "[Review Rules] OWASP Gate"
    template: owasp-review-checklist
    vars:
      categories: [A01, A03, A07]
---
```

**핵심**: `artifacts` 필드가 있으면 LLM 호출 없이 **deterministic compilation**. Generator는 template + vars로 artifact 생성.

### 1.4 Natural Language: 비결정적 부분

`artifacts` 필드 없는 plasmid는 본문이 **intent source**. Interpreter LLM이 이를 읽고 `artifacts` 필드로 변환.

```yaml
---
name: owasp-gate
scope: [hooks, rules]
---

## Intent
커밋 전에 OWASP Top 10 기반 보안 검사를 수행한다.
```

**처리 플로우**:
```
1. Plasmid 파일 hash 계산 (frontmatter + body + llm-model-id)
2. Cache lookup: hash → canonicalized plasmid with artifacts field
3. Cache miss → LLM interpreter 호출
   - 입력: plasmid body + available templates + project context
   - 출력: artifacts 필드 (structured JSON)
   - 검증: JSON schema 통과 필수
4. Cache 저장 (disk + memory)
5. 이후 artifacts 필드 기반 deterministic generation
```

### 1.5 Cache 구조

```
.dhelix/recombination/cache/
  interpretations/
    <plasmid-hash>.json   ← LLM이 생성한 artifacts 필드
    <plasmid-hash>.meta   ← 모델ID, 온도, 생성시각, 사용토큰
  artifacts/
    <artifact-hash>.blob  ← 최종 artifact 내용
```

**plasmid-hash 구성**:
```typescript
sha256([
  plasmid.frontmatter (canonical JSON),
  plasmid.body (trimmed),
  llm.modelId,           // 모델 변경 시 cache 무효
  interpreter.version,    // 인터프리터 프롬프트 변경 시 cache 무효
].join("\x00"))
```

**핵심**: 모델 업그레이드 → 해시 변경 → 재인터프리트. 사용자는 "모델이 바뀌어 re-interpret이 필요합니다. 기존 출력과 비교할까요?" 다이얼로그를 본다. **명시적 체인지 매니지먼트**.

### 1.6 LLM-generated artifacts의 고정

Interpreter가 `artifacts` 필드를 제안한 후:

```
[dhelix] 다음으로 해석했습니다:

  plasmid: owasp-gate
  ──────────────────
  artifacts:
    - hook: PreToolUse on git commit → security-scan-gate
    - rule: .dhelix/rules.generated.md [Review Rules]

이대로 확정할까요?
  (y) 확정 — plasmid 파일에 artifacts 필드 저장 (이후 LLM 호출 없음)
  (n) 재해석
  (e) 수동 편집
```

사용자 승인 시 `artifacts` 필드가 plasmid 파일에 **merge**됨. 이후 recombination은 **fully deterministic**.

즉, **첫 recombination만 비결정적, 이후는 결정적**. 결정론이 "만남"이 아니라 "수렴"을 통해 확보됨.

### 1.7 Generator: Template + Limited Fill

Generator는 순수 LLM 생성이 아니라 **Handlebars template + 제한된 LLM slot fill**.

```typescript
// src/recombination/generators/templates/security-scan-gate.hbs
export const template = `
#!/usr/bin/env bash
# Generated by plasmid: {{plasmid.name}}
# Severity threshold: {{vars.severity-threshold}}

set -euo pipefail

{{#each vars.categories}}
  # OWASP {{this}} check
  {{>owasp-check category=this severity=../vars.severity-threshold}}
{{/each}}

{{llm-fill:"Error message if check fails" max-tokens=200}}
`;
```

**핵심**:
- 구조는 고정 (template)
- LLM fill은 **명시된 슬롯에서만, 토큰 상한 있음**
- LLM fill 결과도 cache
- 변경은 template edit → diff review

### 1.8 실측 결정성 벤치마크

**목표 수치** (Phase 2 완료 시):
- Artifact 필드 명시 plasmid: **100% reproducible** (같은 파일 → 같은 artifact)
- Artifact 필드 미명시 plasmid (첫 인터프리트): **N/A (non-deterministic by design)**
- 한 번 확정된 plasmid 재recombination: **100% reproducible**
- Cross-machine reproducibility: **≥98%** (file system 차이만 허용)
- Cross-model reproducibility: **0% (intended — 명시적 cache invalidation)**

### 1.9 투명성 원칙

**사용자 시각화**:
```
/plasmid info owasp-gate

  Plasmid: owasp-gate
  Hash: sha256:a3f5c9...
  
  Determinism status:
    ✓ artifacts field present
    ✓ Cache hit rate: 100% (3/3 recombinations)
    ✓ No LLM call needed since 2026-04-22
    
  Last interpretation:
    Model: gpt-4o-2024-11-20
    Timestamp: 2026-04-22T10:30:00Z
    Tokens: 1,234 in / 567 out
    
  If you upgrade LLM:
    → Cache will be invalidated
    → You'll be prompted to re-interpret
    → Existing artifacts will be compared before replacement
```

### 1.10 불변식 I-3 재작성

**기존**:
> Recombination은 멱등하다. 같은 plasmid 집합 → 같은 artifact. 단, LLM 호출이 포함된 단계는 temperature=0 + seed 고정.

**수정**:
> Recombination은 **두 단계 멱등성**을 보장한다:
> 1. **Structural 멱등**: `artifacts` 필드가 있는 plasmid는 bit-for-bit 재현 가능.
> 2. **Post-interpretation 멱등**: 한 번 LLM 인터프리트 후 사용자 승인을 받은 plasmid는 structural 멱등으로 승격.
>
> 단, 다음 상황에서 cache 무효화가 발생:
> - LLM 모델 변경 (model ID 또는 provider 변경)
> - Interpreter 프롬프트 버전 변경
> - Plasmid 파일 수정
>
> 이때 사용자에게 명시적 재인터프리트를 요구하고, 기존 artifact와 새 artifact 간 diff를 제시한다.

---

## DD-2. Cure as Version Control

### 2.1 문제의 본질

PRD의 cure는 **git revert**에 해당하지만, 여러 층위의 복잡성을 추상화하지 못했다:

1. **파일 생성 rollback**: 삭제만 하면 됨 (쉬움)
2. **파일 수정 rollback**: pre-state 복원 (중간)
3. **부분 수정 rollback**: 일부는 유지, 일부는 되돌리기 (어려움)
4. **Interleaved modification**: 사용자가 중간에 수동 수정 (3-way merge)
5. **Cascading cure**: 한 plasmid cure가 다른 plasmid에 영향
6. **Pre-state 손실**: transcript 파일 손상

### 2.2 Git 개념의 차용

Git이 이미 푼 문제이므로 **패러다임을 차용**:

| Git | Cure System |
|-----|------------|
| Commit | Recombination transcript |
| Tree | Artifact snapshot |
| Blob | Individual artifact content |
| HEAD | Current active transcript |
| Refs | Plasmid → last transcript map |
| Index | Staged plasmid changes |
| Merge | Plasmid composition |
| Revert | Cure |
| Reflog | Transcript audit log |

### 2.3 Internal Object Store

**제안**: `.dhelix/recombination/objects/` — git과 유사한 content-addressed 저장소.

```
.dhelix/recombination/
  HEAD                              ← 현재 transcript ref
  refs/
    plasmids/
      owasp-gate                    ← 해당 plasmid의 최신 transcript
  objects/
    ab/
      ab3f5c9...                    ← artifact blob (content-addressed)
    cd/
      cd7e2f1...                    ← transcript tree
  transcripts/
    2026-04-22T10-30-00.json        ← 기존 transcript 포맷 유지
  audit.log                         ← append-only reflog
```

### 2.4 Transcript 구조 (enriched)

```typescript
interface RecombinationTranscript {
  readonly id: string;              // ISO timestamp
  readonly parent: string | null;   // 이전 transcript (linked list)
  readonly plasmids: readonly {
    name: string;
    hash: string;                   // plasmid content hash
    version: string;
  }[];
  readonly operations: readonly Operation[];
  readonly llm: {
    modelId: string;
    interpreterVersion: string;
    tokenUsage: { in: number; out: number };
  };
  readonly timing: {
    start: string;
    end: string;
    durationMs: number;
  };
}

type Operation = 
  | CreateOp 
  | ModifyOp 
  | DeleteOp;  // cure 자체도 Delete 연산으로 기록

interface CreateOp {
  type: "create";
  target: string;                   // 파일 경로
  contentHash: string;              // objects/ 내 blob 참조
  plasmidSource: string;            // 어느 plasmid에서 유래
}

interface ModifyOp {
  type: "modify";
  target: string;
  preHash: string;                  // 수정 전 상태 (복원용)
  postHash: string;                 // 수정 후 상태
  diff: {
    kind: "section" | "json-merge" | "line-range";
    data: unknown;                  // 복원 알고리즘별 delta
  };
  plasmidSource: string;
}
```

### 2.5 Three-Way Merge for Interleaved Modifications

사용자가 plasmid-generated 파일을 **수동 수정**한 후 cure를 시도하는 경우:

```
      transcript.postHash (recombination 직후 상태)
       /                              \
      /                                \
transcript.preHash                    current file (사용자 수정 후)
(cure의 타깃 — 복원해야 할 상태)
```

**3-way merge**:
- `base` = `postHash` (recombination 결과)
- `ours` = `preHash` (복원 목표)
- `theirs` = current file (사용자 수정본)

**예상 결과**:
- 사용자가 건드리지 않은 부분: `preHash` 적용 (깨끗한 복원)
- 사용자가 수정한 부분: conflict → 사용자 개입

**UX**:
```
⚠️  Conflict during cure

  File: .dhelix/skills/owasp-scan/SKILL.md
  
  Generator wrote (recombination):
    L15-L25: OWASP checklist
    
  You modified (manual edit):
    L18-L22: Added custom rules
    
  Cure wants to restore:
    Original content (before recombination)
    
  Options:
    [k] Keep your modifications (skip this file)
    [r] Restore original (lose your modifications)
    [m] Merge — launch editor
    [q] Abort cure
```

### 2.6 Audit Log (append-only)

```
.dhelix/recombination/audit.log

2026-04-22T10:30:00Z recombination t1 plasmids=owasp-gate,ddd-review ops=8
2026-04-22T14:00:00Z cure t2 target=t1 restored=2 deleted=6
2026-04-23T09:15:00Z recombination t3 plasmids=owasp-gate,otel,ddd-review ops=11
2026-04-24T16:45:00Z plasmid-modify name=owasp-gate reason=version-bump
2026-04-25T10:00:00Z recombination t4 parent=t3 partial=owasp-gate-only ops=3
2026-04-26T11:30:00Z cure t5 target=t4 ...
```

**특성**:
- 절대 수정하지 않음 (append-only)
- git에 커밋
- 사용자 action + 자동 action 모두 기록
- cure 실행도 로그에 남김 (cure의 cure도 가능하게)

### 2.7 Cure 모드 재설계

**v0 (Phase 3, 4주)**:
- Create operation만 rollback (삭제로 복원)
- Modify operation rollback은 "수정 전 상태로 덮어쓰기" 단순 모드
- Conflict 감지 시 **abort + 사용자 가이드**, 3-way merge 미구현
- Cascading cure 미지원 (한 번에 한 transcript만)

**v1 (Phase 4-5, +3주)**:
- Modify rollback 3-way merge
- Cascading cure (의존성 그래프 추적)
- Cure --interactive 모드 (파일별 선택)

**v2 (Phase 6+, 추가)**:
- Cure preview UI (diff viewer)
- Conflict resolver DSL
- Cure dry-run + comparison

### 2.8 Cure 알고리즘 (v0)

```typescript
async function cureTranscript(transcriptId: string): Promise<CureResult> {
  const transcript = await loadTranscript(transcriptId);
  const plan = planCure(transcript);
  
  // Phase 1: Validation
  for (const op of plan.operations) {
    if (op.type === "modify") {
      const currentHash = await hashFile(op.target);
      if (currentHash !== op.postHash) {
        // 사용자 수동 수정 감지
        if (CONFIG.cureStrategy === "abort-on-conflict") {
          throw new CureError("INTERLEAVED_MODIFICATION", op.target);
        }
        if (CONFIG.cureStrategy === "keep-user-changes") {
          plan.skip(op);
          continue;
        }
      }
    }
  }
  
  // Phase 2: Dry-run preview
  if (options.dryRun) {
    return buildPreview(plan);
  }
  
  // Phase 3: Git auto-commit (안전장치)
  if (hasGit() && !options.skipBackup) {
    await autoCommit(`dhelix: before cure ${transcriptId}`);
  }
  
  // Phase 4: Execute in reverse dependency order
  const ordered = topologicalSort(plan.operations).reverse();
  const executed: Operation[] = [];
  
  try {
    for (const op of ordered) {
      switch (op.type) {
        case "create":
          await unlinkFile(op.target);
          break;
        case "modify":
          const preContent = await loadBlob(op.preHash);
          await writeFile(op.target, preContent);
          break;
        case "delete":
          const content = await loadBlob(op.contentHash);
          await writeFile(op.target, content);
          break;
      }
      executed.push(op);
    }
  } catch (err) {
    // Rollback the cure itself
    await rollbackCure(executed);
    throw err;
  }
  
  // Phase 5: Append to audit log
  await appendAudit({
    type: "cure",
    target: transcriptId,
    operations: executed.length,
    timestamp: new Date().toISOString()
  });
  
  return { restored: executed.length, conflicts: [] };
}
```

### 2.9 Garbage Collection

시간이 지나면 `objects/` 내 orphan blob이 쌓임. Git의 `git gc`처럼:

```bash
/plasmid gc
```

- 모든 reachable transcript 스캔
- 참조되지 않는 blob 삭제
- Audit log는 유지 (reflog 개념)

### 2.10 요약: Phase 재산정

**Cure Phase 재추정**:

| 서브항목 | 복잡도 | 추정 (1인 주 단위) |
|---------|-------|----------------|
| Object store (content-addressed) | Medium | 1주 |
| Transcript 포맷 확장 | Low | 0.5주 |
| CreateOp rollback | Low | 0.3주 |
| ModifyOp rollback (simple) | Medium | 0.7주 |
| Interleaved 감지 (mtime + hash) | Medium | 0.5주 |
| Audit log | Low | 0.3주 |
| CLI (/cure all modes) | Medium | 0.7주 |
| 테스트 (E2E + edge cases) | High | 1주 |

**총: 5주** — 기존 PRD 2주에서 2.5배 증가. 리뷰 권고치(4주)보다도 1주 더 필요.

---

## DD-3. Minimal Plasmid Schema (실제 Zod)

### 3.1 설계 원칙

1. **Progressive disclosure**: 처음엔 6개 필드, 점진적 확장
2. **Zod 기반**: 런타임 검증 + 타입 추론
3. **Migration-ready**: schema 버전 필드 + 자동 업그레이드
4. **Readable errors**: 잘못된 필드 → 명확한 메시지

### 3.2 v1 Core Schema

```typescript
// src/plasmids/schema/v1.ts
import { z } from "zod";

/**
 * Plasmid schema v1 — 최소 필수 필드만.
 * 이후 확장 필드는 v2, v3로 추가되며 자동 마이그레이션 지원.
 */
export const plasmidSchemaV1 = z.object({
  // ===== Core 6 fields (필수) =====
  
  /** Kebab-case 고유 식별자, 파일명과 일치 권장 */
  name: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/, "name must be kebab-case starting with lowercase letter")
    .max(64),
  
  /** 1문장 설명 — LLM이 이 plasmid를 언제 사용할지 판단하는 기준 */
  description: z
    .string()
    .min(10, "description must be at least 10 characters")
    .max(500),
  
  /** 활성화 여부 */
  active: z.boolean().default(true),
  
  /** 생성 가능한 artifact 종류 — recombination 엔진이 이것만 처리 */
  scope: z
    .array(z.enum(["hooks", "rules", "skills", "commands", "agents", "harness"]))
    .min(1, "scope must include at least one artifact type")
    .max(6),
  
  /** 충돌 해소 우선순위 */
  priority: z
    .enum(["low", "normal", "high"])
    .default("normal"),
  
  /** 의도 유형 — interpreter가 컴파일 경로 선택에 사용 */
  types: z
    .array(z.enum(["behavioral", "structural", "ritualistic", "epistemic", "value"]))
    .min(1)
    .max(3),
  
  // ===== Schema 버전 필드 =====
  
  /** Schema 버전 — 자동 마이그레이션 기준 */
  schemaVersion: z.literal(1).default(1),
  
} as const);

export type PlasmidV1 = z.infer<typeof plasmidSchemaV1>;
```

### 3.3 Extension Schema (선택 필드)

Core v1을 extend하지 않고 별도 파서에서 처리:

```typescript
// src/plasmids/schema/extensions.ts
export const plasmidExtensionsSchema = z.object({
  // Composition
  compatibleWith: z.array(z.string()).optional(),
  conflictsWith: z.array(z.string()).optional(),
  extends: z.array(z.object({
    plasmid: z.string(),
    mode: z.enum(["merge", "override"]).default("merge"),
  })).optional(),
  
  // Source tracking
  source: z.discriminatedUnion("type", [
    z.object({ type: z.literal("manual") }),
    z.object({
      type: z.literal("research"),
      references: z.array(z.object({
        type: z.enum(["url", "paper", "doc"]),
        value: z.string().url().or(z.string()),
        quote: z.string().optional(),
      })),
    }),
    z.object({
      type: z.literal("agent-proposed"),
      confidence: z.number().min(0).max(1),
      evidence: z.array(z.object({
        session: z.string(),
        turn: z.number(),
        excerpt: z.string(),
      })),
    }),
    z.object({
      type: z.literal("template"),
      templateId: z.string(),
    }),
  ]).optional(),
  
  // Metadata
  version: z.string().regex(/^\d+\.\d+\.\d+$/).default("0.1.0"),
  created: z.string().datetime().optional(),
  updated: z.string().datetime().optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
  
  // Compilation hints — deterministic compilation key
  artifacts: z.array(z.object({
    kind: z.enum(["hook", "rule", "skill", "command", "agent", "harness"]),
    // kind-specific fields (conditional)
  }).passthrough()).optional(),
  
  // Expression conditions (GAL-3+)
  expressionConditions: z.object({
    gitBranch: z.array(z.string()).optional(),
    fileTypes: z.array(z.string()).optional(),
    notFileTypes: z.array(z.string()).optional(),
  }).optional(),
  
  // Trust (CAUTION: constitutional / agent-authored는 GAL-4+)
  tier: z.enum(["tactical", "policy", "constitutional"]).default("tactical").optional(),
}).partial();

export type PlasmidExtensions = z.infer<typeof plasmidExtensionsSchema>;
```

### 3.4 Complete Plasmid Type

```typescript
export type Plasmid = PlasmidV1 & {
  extensions: PlasmidExtensions;
  body: string;  // markdown body after frontmatter
  filePath: string;
  hash: string;  // content-addressed hash
};
```

### 3.5 Migration 전략

```typescript
// src/plasmids/schema/migrations.ts
interface Migration<From, To> {
  fromVersion: number;
  toVersion: number;
  migrate(data: From): To;
}

const migrations: Migration<any, any>[] = [
  // v0 → v1 (가상의 미래)
  {
    fromVersion: 0,
    toVersion: 1,
    migrate(v0) {
      return {
        ...v0,
        schemaVersion: 1,
        types: v0.type ? [v0.type] : ["behavioral"],  // 단수 → 복수
      };
    },
  },
];

export function migratePlasmid(raw: unknown): PlasmidV1 {
  const parsed = z.object({ schemaVersion: z.number().default(0) }).parse(raw);
  let current = parsed;
  
  for (const m of migrations) {
    if (current.schemaVersion === m.fromVersion) {
      current = m.migrate(current);
    }
  }
  
  return plasmidSchemaV1.parse(current);
}
```

### 3.6 Error Messages

Zod의 기본 에러는 불친절. 커스텀 issue formatter:

```typescript
export function formatPlasmidError(error: z.ZodError): string {
  const lines: string[] = ["Plasmid validation failed:"];
  
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    const location = path || "(root)";
    
    switch (issue.code) {
      case "invalid_string":
        if (issue.validation === "regex") {
          lines.push(`  ✗ ${location}: ${issue.message}`);
          lines.push(`    Hint: names must be kebab-case (lowercase, hyphens only)`);
        }
        break;
      case "invalid_enum_value":
        lines.push(`  ✗ ${location}: got "${issue.received}", expected one of [${issue.options?.join(", ")}]`);
        break;
      case "too_small":
        lines.push(`  ✗ ${location}: ${issue.message}`);
        break;
      default:
        lines.push(`  ✗ ${location}: ${issue.message}`);
    }
  }
  
  return lines.join("\n");
}
```

예시 출력:
```
Plasmid validation failed:
  ✗ name: name must be kebab-case starting with lowercase letter
    Hint: names must be kebab-case (lowercase, hyphens only)
  ✗ scope: got "hook" (invalid), expected one of [hooks, rules, skills, commands, agents, harness]
  ✗ description: String must contain at least 10 character(s)
```

### 3.7 Frontmatter Parser 통합

기존 `src/skills/creator/packaging/package.ts`의 frontmatter 파서 재사용:

```typescript
// src/plasmids/frontmatter.ts
export function parsePlasmidFile(
  content: string,
  filePath: string,
): Plasmid {
  // 1. YAML frontmatter 추출 (기존 로직 재사용)
  const { frontmatter, body } = extractFrontmatter(content);
  
  // 2. Schema 마이그레이션 + 검증
  const core = migratePlasmid(frontmatter);
  
  // 3. Extensions 분리 파싱
  const extensions = plasmidExtensionsSchema.parse(frontmatter);
  
  // 4. Hash 계산
  const hash = computePlasmidHash(core, extensions, body);
  
  return {
    ...core,
    extensions,
    body: body.trim(),
    filePath,
    hash,
  };
}
```

### 3.8 사용자 관점의 단순함

Power user가 작성한 full plasmid:
```yaml
---
name: my-custom-rule
description: "프로젝트 파일은 500줄 넘지 말 것"
scope: [rules]
types: [structural]
---

500줄 넘는 파일은 기능 분리를 권장한다.
```

**6개 필드만**. 나머지는 필요 시 추가.

---

## DD-4. CLAUDE.md Ownership Boundaries

### 4.1 문제 재정의

PRD는 `CLAUDE.md`를 편집하여 plasmid-generated rules를 삽입. 이는 **사용자 파일을 침범**.

3가지 근본 위험:
1. **데이터 손실**: auto-edit이 사용자 내용을 덮어쓸 수 있음
2. **Merge 지옥**: git diff가 "user-authored vs plasmid-generated" 구분 불가
3. **신뢰 붕괴**: "내 파일을 마음대로 수정하는 도구"

### 4.2 해결: Include 메커니즘

**원칙**: 사용자 파일 = 사용자 영역, 시스템 파일 = 시스템 영역. 경계를 **명시적 include**로 연결.

```
.dhelix/
  rules.generated.md       ← 시스템 영역 (plasmid 관리)
  CLAUDE.md                ← 사용자 영역 (직접 편집)
```

**CLAUDE.md에 한 줄만 추가** (사용자 수동 또는 자동):
```markdown
## Project Rules

<!-- @plasmid-include: .dhelix/rules.generated.md -->

## My Custom Notes
...
```

### 4.3 Include Resolver 구현

dhelix의 boot 시점 system prompt builder에 resolver 삽입:

```typescript
// src/instructions/include-resolver.ts
const INCLUDE_REGEX = /<!--\s*@plasmid-include:\s*([^\s]+)\s*-->/g;

export async function resolveIncludes(
  content: string,
  baseDir: string,
  maxDepth = 5,
): Promise<{ resolved: string; sources: ResolvedSource[] }> {
  const sources: ResolvedSource[] = [];
  
  async function resolveOnce(text: string, depth: number): Promise<string> {
    if (depth >= maxDepth) {
      throw new Error(`Include depth exceeded: ${maxDepth}`);
    }
    
    return await replaceAsync(text, INCLUDE_REGEX, async (match, path) => {
      const absPath = resolve(baseDir, path);
      
      // 보안: baseDir 외부 경로 차단
      if (!absPath.startsWith(baseDir)) {
        throw new SecurityError(`Include path escapes base: ${path}`);
      }
      
      // 파일 존재 확인
      if (!existsSync(absPath)) {
        return `<!-- @plasmid-include-missing: ${path} -->`;
      }
      
      const included = await readFile(absPath, "utf8");
      sources.push({ path, hash: hashContent(included) });
      
      // 재귀 (중첩 include)
      return await resolveOnce(included, depth + 1);
    });
  }
  
  const resolved = await resolveOnce(content, 0);
  return { resolved, sources };
}
```

### 4.4 rules.generated.md 구조

Plasmid별 섹션이 명확히 구분된 파일:

```markdown
<!-- GENERATED by dhelix plasmid-system. Do not edit directly. -->
<!-- To modify, edit the plasmid file in .dhelix/plasmids/ -->

<!-- BEGIN plasmid: owasp-gate -->
## Security Review Rules (OWASP Gate)

All code must pass OWASP Top 10 (2021) review before merge:
- A01 Broken Access Control
- A03 Injection
- A07 Authentication Failures

<!-- END plasmid: owasp-gate -->


<!-- BEGIN plasmid: ddd-review -->
## Domain-Driven Design Rules

Service layer must follow DDD patterns:
- Aggregate roots control entity mutations
- Domain events for cross-aggregate communication
- Repositories abstract persistence

<!-- END plasmid: ddd-review -->
```

**특성**:
- Plasmid별 BEGIN/END 마커로 격리
- Cure는 해당 마커 쌍만 제거
- 섹션 간 순서 = plasmid priority (high → normal → low)

### 4.5 Rule Generator의 쓰기 로직

```typescript
// src/recombination/generators/rule-generator.ts
async function generateRules(
  plasmids: Plasmid[],
  transcript: TranscriptBuilder,
): Promise<void> {
  const rulesPath = join(projectDir, ".dhelix", "rules.generated.md");
  
  // 1. 기존 파일 파싱 (이전 plasmid 섹션 추출)
  const existing = existsSync(rulesPath) 
    ? await readFile(rulesPath, "utf8") 
    : HEADER;
  const sections = parseSections(existing);
  
  // 2. 이번 recombination의 plasmid별로 섹션 재생성
  for (const plasmid of plasmids.filter(p => p.scope.includes("rules"))) {
    const ruleContent = await generateRuleSection(plasmid);
    sections.set(plasmid.name, ruleContent);
    
    transcript.recordModify({
      target: rulesPath,
      section: plasmid.name,
      preContent: sections.get(plasmid.name) ?? "",
      postContent: ruleContent,
    });
  }
  
  // 3. Priority 순 정렬 후 직렬화
  const ordered = sortByPriority([...sections.entries()]);
  const output = HEADER + "\n\n" + ordered
    .map(([name, content]) => wrapInMarkers(name, content))
    .join("\n\n\n");
  
  await writeFile(rulesPath, output);
}
```

### 4.6 CLAUDE.md 자동 세팅 (1회)

사용자가 처음 plasmid 시스템 사용 시:

```
사용자: /plasmid ...

dhelix: Plasmid 시스템을 처음 사용하시네요. 
        CLAUDE.md에 include 한 줄을 추가할까요?
        
        현재 CLAUDE.md:
          ## Project Rules
          - ... (사용자 내용)
        
        추가될 내용 (한 줄):
          <!-- @plasmid-include: .dhelix/rules.generated.md -->
        
        [y/n/edit]
```

이후에는 CLAUDE.md를 **절대 건드리지 않음**.

### 4.7 Non-dhelix reader 호환성

Claude Code, Cursor 등 다른 도구가 CLAUDE.md를 읽을 때:
- Include 마커는 **주석으로 취급** → 무시됨
- 사용자 영역 규칙만 인식
- **의도된 동작**: dhelix-specific rules은 dhelix에서만 발현

만약 cross-tool 호환이 필요하면:
```bash
/plasmid flatten > CLAUDE.flattened.md
```
- Include를 전개한 full CLAUDE.md 생성
- 해당 파일을 다른 도구용으로 사용

### 4.8 Migration 경로

기존 CLAUDE.md에 이미 auto-generated 내용이 있으면?
1. Detect: `<!-- BEGIN plasmid: -->` 마커 스캔
2. Extract: 해당 섹션을 `.dhelix/rules.generated.md`로 이동
3. Replace: CLAUDE.md에 include 한 줄만 남김
4. Commit: git에 migration commit

---

## DD-5. Market Validation Protocol (Phase 0)

### 5.1 가설 선언

**H1**: Power user 중 ≥60%는 현재 customization artifact (skill/agent/hook/rule) 작성 시 명시적인 painpoint가 있다.

**H2**: 사용자에게 plasmid 컨셉을 보여주면 ≥50%가 "당장 쓰고 싶다"고 답한다.

**H3**: Plasmid 작성 POC 실험에서 사용자의 실제 완료율은 ≥70%이고, 작성 시간은 15분 이내다.

**Go 조건**: H1 + H2 + H3 모두 충족.

### 5.2 대상자 선정 (5명)

| 페르소나 | 수 | 특성 |
|---------|---|-----|
| Heavy Claude Code 사용자 | 2 | CLAUDE.md 200줄+, skill 3개+ 작성 경험 |
| 팀 리드 (팀 표준 관심) | 1 | 팀에 AI 코딩 도구 도입 책임 |
| 솔로 개발자 (여러 프로젝트) | 1 | Polyglot, 3+ 프로젝트에서 dhelix 사용 |
| 신규 사용자 (통제군) | 1 | dhelix 사용 <1개월 |

### 5.3 Week 1: 인터뷰 (1시간 × 5명)

#### 5.3.1 Background (10분)
```
Q1. 최근 6개월간 AI 코딩 도구에서 customization을 얼마나 자주 하나요?
    a. 매일 / b. 매주 / c. 매월 / d. 드물게 / e. 한 적 없음

Q2. 가장 최근에 작성한 customization은 무엇인가요?
    → 실제 파일을 함께 보기 요청

Q3. 그것을 작성하는 데 얼마나 걸렸나요?
    → 실제 시간, 재시도 횟수
```

#### 5.3.2 Current Workflow (15분)
```
실제 작업 시연 요청:
"지금 CLAUDE.md에 '모든 SQL은 parameterized만 사용'이라는 규칙을 
추가해주세요. 저는 옆에서 관찰만 하겠습니다."

관찰 항목:
[ ] 어느 파일 열었는가 (CLAUDE.md? skill? hook?)
[ ] 망설임이 있었는가 (어디 쓸지 결정 고민)
[ ] 검색/조사 했는가 (기존 예시 참고?)
[ ] 포맷/문법에서 막혔는가
[ ] 완성까지 걸린 시간
[ ] 완성 후 테스트 했는가
```

#### 5.3.3 Pain Points (15분)
```
Q4. 방금 작업에서 가장 불편했던 점은?
Q5. 작성한 규칙이 실제로 AI 동작에 반영됐는지 어떻게 확인하시나요?
Q6. 규칙을 **되돌리고 싶었던** 경험이 있나요? (있다면) 어떻게 하셨나요?
Q7. 여러 팀원이 이 규칙을 공유하는 방식은?
Q8. 실패한 customization을 어떻게 관리하시나요?
```

#### 5.3.4 Concept Exposure (15분)

**Plasmid 컨셉 설명** (3분 스크립트, 미리 준비):
```
"Plasmid는 당신이 원하는 에이전트 동작을 자연어로 선언하는 파일입니다.
 예를 들어 'OWASP 검사를 커밋 전에 강제'라고 쓰면, 
 dhelix가 자동으로 hook + agent + rule을 생성합니다.
 마음에 안 들면 /cure 한 번에 다 지워집니다.
 다시 쓰고 싶으면 plasmid 파일만 수정하면 됩니다."
```

**POC 예시 보여주기**:
- 실제 작성된 plasmid .md 파일 3개
- Recombination 결과 (생성된 파일 목록)
- Cure 결과 (깨끗이 지워진 상태)

```
Q9. 방금 보신 개념을 간단히 설명해주실 수 있나요? (이해도 체크)
Q10. 이것이 당신의 current workflow를 개선할까요?
    [1-5점 스케일 + 이유]
Q11. 당장 쓰고 싶으신가요?
    [yes / no / 조건부]
Q12. 어떤 우려가 있으신가요?
```

#### 5.3.5 POC Scheduling (5분)
```
Q13. 다음 주에 실제 plasmid 하나를 직접 작성해보실 수 있나요?
     30분 녹화 세션이면 됩니다.
     자신의 실제 프로젝트에서 시도.
```

### 5.4 Week 1 평가 기준

**H1 (Painpoint 존재) 측정**:
- Q5-Q7에서 **3개 이상의 구체적 painpoint** 언급 시 Painpoint 존재
- 5명 중 3명 이상이 Painpoint 존재 → H1 ✓

**H2 (컨셉 매력도) 측정**:
- Q10에서 ≥4점 & Q11이 "yes" 또는 "조건부(합리적 조건)" → 관심
- 5명 중 3명 이상 관심 → H2 ✓

### 5.5 Week 2: POC 실험 (30분 × 3명)

H1+H2 통과한 인터뷰이 중 3명 선정.

#### 5.5.1 Setup (5분)
- 사전 작성된 plasmid 예시 3개 공유 (참고용)
- Plasmid 작성 가이드 1페이지 제공

#### 5.5.2 Task (20분)
```
"당신의 프로젝트에서 실제로 필요한 customization을 하나 떠올려주세요.
 그것을 plasmid로 작성해주세요.
 
 작성은 다음 형식을 따라주세요 [minimal template 제시]:
 
 ---
 name: <your-name>
 description: <한 줄 설명>
 scope: [hooks/rules/skills/commands/agents/harness 중]
 types: [behavioral/structural/ritualistic/epistemic/value 중]
 priority: normal
 ---
 
 ## Intent
 [자연어로 의도]
 
 ## Behavior
 [원하는 동작]
 
 20분 타이머 시작합니다. 막히시면 질문 주세요."
```

**관찰 항목** (타임스탬프 기록):
- [ ] name/description 결정 시간
- [ ] scope 선택 어려움 (몇 개 scope 고민?)
- [ ] types 선택 어려움 (5종이 구분이 잘 되는지)
- [ ] 자연어 섹션 작성 막힘
- [ ] 첫 시도에서 완성 여부
- [ ] 질문 횟수 및 내용
- [ ] 완성도 self-rating

#### 5.5.3 Debrief (5분)
```
Q1. 가장 어려웠던 부분은?
Q2. 어떤 도움이 있었으면 했나요?
Q3. 이것을 dhelix가 실제로 동작시킨다면 어떤 아웃풋을 기대하나요?
    → 사용자가 기대하는 artifact 유형 기록
Q4. 이 plasmid를 매주 작성할 의향이 있나요? (1-5)
```

### 5.6 Week 2 평가 기준

**H3 (실제 작성 가능) 측정**:
- 3명 중 ≥2명이 20분 내 완성
- 완성된 plasmid가 Zod schema 통과
- Self-rating ≥3
- Q4 응답 ≥3 (매주 쓸 의향)

### 5.7 Go/No-Go Gate (Week 2 말)

| H1 | H2 | H3 | 결정 |
|----|----|----|-----|
| ✓ | ✓ | ✓ | **Go** — Phase 1 착수 |
| ✓ | ✓ | ✗ | **Pivot** — POC 피드백 반영 후 Phase 0 재실행 (2주) |
| ✓ | ✗ | - | **Pivot** — 컨셉 재설계 또는 포지셔닝 변경 |
| ✗ | - | - | **Stop** — 시장 문제가 존재하지 않음, 프로젝트 중단 |

### 5.8 결과 문서화

```
.dhelix/research/phase-0-results/
  interview-notes/
    <id>-session-1.md
    <id>-session-2.md
  poc-plasmids/
    <user>-<plasmid-name>.md
  poc-recordings/
    <id>-screen.mp4
  hypothesis-evaluation.md
  go-no-go-decision.md
```

**모든 결과는 internal repo에 커밋** → Phase 1 설계 참조 자료.

### 5.9 예산

- 인터뷰 5명 × 1시간 = 5시간
- POC 3명 × 30분 = 1.5시간 (+ 분석 시간)
- 자료 준비: 10시간
- 분석 + 문서화: 8시간
- **총 약 25시간 = 3인일** (1인 기준 Phase 0은 2주 내 완료 가능)

---

## DD-6. Observability Semantic Conventions

### 6.1 설계 원칙

1. **OpenTelemetry 준수**: semantic conventions 따르기
2. **3층 메트릭**: Business / Functional / Technical
3. **Cardinality 통제**: plasmid.name 같은 high-cardinality는 신중히
4. **Actionable**: 각 메트릭은 액션으로 연결 가능
5. **Privacy**: plasmid 내용 자체는 로깅하지 않음 (해시만)

### 6.2 3층 메트릭 구조

```
Business Layer    (북극성)
  └─ plasmid.adoption_rate
  └─ plasmid.retention_rate (30d)

Functional Layer  (기능 건강도)
  └─ recombination.success_rate
  └─ cure.success_rate
  └─ wiring_validation.pass_rate
  └─ plasmid.authoring_time_p95

Technical Layer   (시스템 건강)
  └─ interpreter.cache_hit_rate
  └─ generator.latency_p95
  └─ llm.tokens_per_recombination
```

### 6.3 Metric 카탈로그

```typescript
// src/plasmids/telemetry/metrics.ts

export const PlasmidMetrics = {
  // ========== Counters ==========
  
  "plasmid.created": {
    type: "counter",
    description: "Plasmid file creation events",
    unit: "{plasmid}",
    attributes: [
      "source_type",    // manual | research | template | agent-proposed
      "scope_count",    // 1-6
      "types_count",    // 1-3
    ],
  },
  
  "plasmid.activated": {
    type: "counter",
    description: "Plasmid activation (active=true) events",
    unit: "{plasmid}",
    attributes: ["source_type"],
  },
  
  "plasmid.deactivated": {
    type: "counter",
    description: "Plasmid deactivation events",
    unit: "{plasmid}",
    attributes: ["reason"],  // manual | conflict | archived
  },
  
  "recombination.started": {
    type: "counter",
    description: "Recombination command invocations",
    unit: "{recombination}",
    attributes: ["mode"],  // extend | rebuild | dry-run
  },
  
  "recombination.completed": {
    type: "counter",
    description: "Successfully completed recombinations",
    unit: "{recombination}",
    attributes: [
      "mode",
      "plasmid_count_bucket",   // 1 | 2-5 | 6-10 | 10+
      "artifact_count_bucket",  // 0 | 1-5 | 6-20 | 20+
      "had_cache_hit",          // true | false
    ],
  },
  
  "recombination.failed": {
    type: "counter",
    description: "Failed recombination attempts",
    unit: "{recombination}",
    attributes: [
      "stage",          // interpret | plan | generate | validate
      "error_code",     // PLASMID_PARSE_ERROR | etc
    ],
  },
  
  "cure.executed": {
    type: "counter",
    description: "Cure command executions",
    unit: "{cure}",
    attributes: [
      "mode",                    // last | all | transcript | plasmid
      "had_conflict",            // true | false
      "had_manual_modifications", // true | false
    ],
  },
  
  "wiring_validation.failed": {
    type: "counter",
    description: "Wiring validation failures",
    unit: "{validation}",
    attributes: [
      "check_type",     // reference | permission | cyclic | syntactic
      "auto_recovered", // true | false
    ],
  },
  
  // ========== Histograms ==========
  
  "plasmid.authoring_duration_ms": {
    type: "histogram",
    description: "Time from /plasmid start to plasmid file save",
    unit: "ms",
    buckets: [1000, 5000, 30000, 60000, 300000, 900000, 1800000],
    attributes: ["mode"],  // quick | interview | research-assisted
  },
  
  "recombination.duration_ms": {
    type: "histogram",
    description: "Recombination end-to-end duration",
    unit: "ms",
    buckets: [100, 500, 2000, 10000, 30000, 60000, 120000],
    attributes: ["mode", "plasmid_count_bucket"],
  },
  
  "interpreter.latency_ms": {
    type: "histogram",
    description: "LLM interpreter call latency",
    unit: "ms",
    buckets: [500, 1000, 3000, 10000, 30000, 60000],
    attributes: ["model_id", "cache_hit"],
  },
  
  "generator.latency_ms": {
    type: "histogram",
    description: "Single artifact generation latency",
    unit: "ms",
    buckets: [10, 50, 200, 1000, 5000],
    attributes: ["kind"],  // hook | rule | skill | ...
  },
  
  "llm.tokens_in": {
    type: "histogram",
    description: "Input tokens per recombination",
    unit: "{tokens}",
    buckets: [1000, 5000, 20000, 50000, 150000],
    attributes: ["model_id"],
  },
  
  "llm.tokens_out": {
    type: "histogram",
    description: "Output tokens per recombination",
    unit: "{tokens}",
    buckets: [500, 2000, 10000, 30000],
    attributes: ["model_id"],
  },
  
  // ========== Gauges ==========
  
  "plasmid.active_count": {
    type: "gauge",
    description: "Currently active plasmids",
    unit: "{plasmid}",
    attributes: [],
  },
  
  "plasmid.total_count": {
    type: "gauge",
    description: "Total plasmids (active + inactive)",
    unit: "{plasmid}",
    attributes: [],
  },
  
  // ========== Derived (computed dashboard-side) ==========
  
  "interpreter.cache_hit_rate": {
    type: "derived",
    formula: "cache_hits / (cache_hits + cache_misses)",
    target: 0.8,  // 80% hit rate 목표
  },
  
  "recombination.success_rate": {
    type: "derived",
    formula: "recombination.completed / recombination.started",
    target: 0.95,
  },
  
  "cure.success_rate": {
    type: "derived",
    formula: "cure.completed / cure.executed",
    target: 1.0,  // 100% 목표
  },
  
  "plasmid.adoption_rate_30d": {
    type: "derived",
    formula: "unique_users_with_active_plasmid_30d / unique_users_30d",
    target: 0.1,  // 10% adoption 목표 (보수적)
  },
} as const;
```

### 6.4 Event (Log) 스키마

고-카디널리티 정보는 **event** 로 OTLP log로 전송:

```typescript
interface PlasmidEvent {
  timestamp: string;
  event: "plasmid.recombination.completed";
  
  // Business context
  user_id_hash: string;       // hashed, not raw
  session_id: string;
  
  // Plasmid details (hashed names, not content)
  plasmids: {
    name_hash: string;
    hash: string;              // plasmid content hash
    version: string;
  }[];
  
  // Operation
  mode: "extend" | "rebuild" | "dry-run";
  artifacts_generated: number;
  artifacts_modified: number;
  wiring_pass: boolean;
  duration_ms: number;
  
  // LLM
  interpreter_calls: number;
  interpreter_cache_hits: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;  // estimated
  
  // Outcome
  transcript_id: string;
  validation_errors?: string[];  // error codes, not messages
}
```

### 6.5 Alerting 규칙

```yaml
# Prometheus-compatible alert rules
groups:
  - name: plasmid-critical
    rules:
      - alert: CureSuccessRateDropped
        expr: cure_success_rate_1h < 0.95
        for: 15m
        severity: critical
        annotation: "Cure 성공률이 95% 밑. 데이터 손실 위험."
        
      - alert: RecombinationFailureSpike
        expr: rate(recombination_failed[15m]) > 0.3
        for: 15m
        severity: warning
        annotation: "Recombination 실패율 급증. Interpreter 또는 generator 문제 가능성."
        
      - alert: WiringValidationDegraded
        expr: wiring_validation_pass_rate_1h < 0.8
        for: 30m
        severity: warning
        annotation: "와이어링 검증 통과율 저하. Generator 품질 확인 필요."
        
      - alert: InterpreterCacheMiss
        expr: interpreter_cache_hit_rate_1h < 0.5
        for: 1h
        severity: info
        annotation: "캐시 히트율 저조. 모델 변경 또는 plasmid 빈번 수정 확인."
```

### 6.6 Dashboard 설계

**Panel 1: Health Overview**
- Plasmid active count (gauge)
- Recombination success rate 24h (trend)
- Cure success rate 24h (trend)
- Wiring pass rate 24h (trend)

**Panel 2: User Flow**
- Plasmid creations / day (bar)
- Authoring time distribution (histogram)
- Mode breakdown (quick / interview / research)

**Panel 3: System Performance**
- Recombination latency p50/p95/p99
- Interpreter cache hit rate
- Artifacts per recombination (histogram)

**Panel 4: Cost Tracking**
- Tokens in/out trend
- Estimated USD cost per user per month
- Cost per plasmid (avg)

**Panel 5: Errors**
- Error code breakdown
- Recent failures log (last 20)
- Drift detection (plasmid behavior change)

### 6.7 Privacy 고려사항

**절대 로깅하지 않는 것**:
- Plasmid body 내용 (description도 부분적으로만)
- Generated artifact 내용
- 사용자 프로젝트 파일 경로 (hash만)
- LLM prompt 내용

**허용되는 것**:
- Plasmid 메타데이터 (name hash, scope, types, priority)
- 수치 메트릭
- 에러 코드 (메시지 아님)
- 전반적 timing

### 6.8 Implementation 위치

기존 `src/telemetry/` 확장:

```
src/telemetry/
  events.ts           ← 기존
  otlp.ts             ← 기존
  config.ts           ← 기존
  plasmid/            ← 신규
    metrics.ts        ← 위 카탈로그
    events.ts         ← 이벤트 타입
    emitter.ts        ← 메트릭 발행 helper
```

### 6.9 Phase별 도입

- **Phase 1**: `plasmid.created`, `plasmid.activated`, `plasmid.total_count`, `plasmid.active_count` — 최소 4개
- **Phase 2**: recombination.* 메트릭 전체 + interpreter.cache_hit_rate
- **Phase 3**: cure.* 메트릭 + 모든 histogram
- **Phase 4+**: Derived 메트릭 dashboard + alerting

---

## 7. 종합: 아키텍처 재설계 요약

Deep dive를 거친 **핵심 아키텍처 변화**:

### 7.1 Plasmid 포맷

```
Before: 20+ 필드 단일 스키마
After:  6 필드 core + optional extensions (Zod 기반)
```

### 7.2 Compilation Model

```
Before: LLM-as-compiler (non-deterministic)
After:  DSL-first (deterministic) + LLM semantic bridge (cached, converges to deterministic)
```

### 7.3 File Ownership

```
Before: CLAUDE.md 직접 편집
After:  Include resolver + .dhelix/rules.generated.md (격리)
```

### 7.4 Cure

```
Before: 2주, 단순 삭제
After:  5주, git-inspired object store + 3-way merge 준비
```

### 7.5 Validation

```
Before: 시장 검증 0
After:  3주 Phase 0 (5 인터뷰 + 3 POC) — 실증 기반 Go/No-go
```

### 7.6 Observability

```
Before: "이벤트 추가" 한 줄
After:  3-tier 메트릭 / OTLP / Dashboard / Alert 스펙
```

---

## 8. 재산정 일정

| Phase | 기존 | Deep dive 반영 후 | Δ |
|-------|-----|----------------|---|
| Phase -1 (PRD 수정) | - | 1주 | +1 |
| Phase 0 (시장 검증) | - | 2주 | +2 |
| Phase 1 (Foundation) | 4주 | 5주 | +1 |
| Phase 2 (Recombination MVP) | 4주 | 5주 | +1 |
| Phase 3 (Cure) | 2주 | 5주 | +3 |
| Phase 4 (Advanced Gen) | 3주 | 4주 | +1 |
| Phase 5 (Research-assisted) | 3주 | 3주 | 0 |
| Phase 6 (Polish) | 2주 | 2주 | 0 |
| **Total** | **18주** | **27주** | **+9** |

**해석**:
- 9주 증가는 **품질 투자**, 빠른 시간에 낮은 품질 제품 내는 것보다 느린 시간에 높은 품질 제품이 장기 승률 높음
- Phase 0/1 안에서 Go/No-go 결정 → 시장 피드백에 따라 후속 phase 재조정 가능
- Phase 3 (Cure) +3주는 **git-inspired 모델** 투자. 이 투자가 장기적으로 cure의 신뢰성을 담보

---

## 9. 다음 액션

1. 이 Deep Dive 문서를 기획자 + 아키텍트 + 개발 리드가 리뷰
2. 각 DD별 **구현 담당자 지정**
3. Phase -1 착수 (PRD 수정, 1주)
4. Phase 0 인터뷰 대상자 섭외 시작 (병행)
5. Phase 1 개발 환경 준비 (Phase 0 결과 대기 중 병행)

---

**문서 상태**: Deep Dive v1.0 — 엔지니어링 해법 제시
**검토 필요**: 각 DD의 해법이 기존 dhelix 아키텍처와 정합하는지 최종 확인
**시간 투자 대비**: 27주 계획으로 초기 18주 대비 +50%, 대신 **성공 확률 대폭 상승 예측**
