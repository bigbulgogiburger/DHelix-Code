---
name: generate-class-docs
description: |
  dbcode 프로젝트의 TypeScript 클래스/모듈을 초보자도 이해할 수 있는 구조화된 개발 문서로 생성합니다.
  Next.js 기반 guide/ 사이트에 새 페이지를 추가하는 형태로 동작합니다.
  Spring Framework 공식 문서 + React 공식 문서의 구조를 벤치마킹한 3단 구조(Reference → Usage → Troubleshooting)를 사용합니다.

  이 스킬은 다음 상황에서 사용하세요:
  - "클래스 문서화해줘", "모듈 문서 만들어줘", "API 문서 생성"
  - "agent-loop.ts 문서화", "ContextManager 설명 페이지 만들어줘"
  - "개발 가이드에 문서 추가", "초보자용 코드 설명 페이지"
  - 특정 .ts 파일이나 클래스의 동작 원리를 시각적으로 설명하는 페이지가 필요할 때
  - guide/ 프로젝트에 새 문서 페이지를 추가할 때
  - 인자 없이 호출되면 git diff를 분석하여 변경된 소스 파일에 대응하는 문서를 자동으로 찾아 업데이트합니다
  - "문서 동기화", "docs 업데이트", "문서 최신화" 요청에도 사용하세요
---

# 클래스/모듈 개발 문서 생성 스킬

이 스킬은 dbcode 프로젝트의 TypeScript 소스 코드를 분석하여, 초보자도 이해할 수 있는
구조화된 개발 문서 페이지를 `guide/` Next.js 프로젝트에 생성합니다.

## 문서화 철학

Spring Framework와 React 공식 문서에서 검증된 3가지 핵심 원칙을 따릅니다:

1. **Progressive Disclosure** — 쉬운 내용을 먼저 보여주고, 복잡한 내용은 "Deep Dive"로 숨김
2. **Reference → Usage → Troubleshooting** — 매 페이지가 "이것은 무엇인가 → 어떻게 쓰는가 → 문제가 생기면" 순서
3. **One Concept Per Page** — 하나의 클래스/모듈 = 하나의 페이지. 혼합 금지

## 실행 모드

이 스킬은 두 가지 모드로 동작한다:

### 모드 A: 유지보수 모드 (인자 없이 호출 시)

사용자가 특정 모듈을 지정하지 않고 스킬을 호출하면, git diff를 분석하여 변경된 소스에 대응하는 문서를 자동 업데이트한다.

#### 유지보수 실행 절차

1. **git diff 분석**: `git diff --name-only HEAD` 또는 `git diff --name-only` (staged + unstaged)를 실행하여 변경된 `.ts`/`.tsx` 파일 목록을 수집한다.

2. **문서 매핑**: 변경된 소스 파일이 기존 문서 페이지에 매핑되는지 확인한다.
   - `src/core/circuit-breaker.ts` → `guide/src/app/docs/circuit-breaker/page.tsx`
   - `src/llm/client.ts` → `guide/src/app/docs/llm-client/page.tsx`
   - 매핑 규칙: `src/{layer}/{file}.ts` → `guide/src/app/docs/{file-slug}/page.tsx`

3. **변경 내용 분석**: 매핑된 각 소스 파일에 대해 `git diff`로 구체적 변경 내용을 확인한다.
   - 새 export 추가 → 레퍼런스 섹션에 추가
   - 함수 시그니처 변경 → 파라미터 테이블 업데이트
   - 새 에러 처리 → 트러블슈팅에 추가
   - 로직 변경 → 내부 구현 + Mermaid 다이어그램 업데이트
   - 새 import 추가 → 관련 문서(SeeAlso) 업데이트

4. **문서 업데이트**: 변경 사항을 기존 문서 페이지에 반영한다. 전체 페이지를 재작성하지 않고, 변경된 부분만 수정한다.

5. **결과 보고**: 어떤 문서가 어떻게 업데이트되었는지 요약한다.

#### 유지보수 모드에서의 판단 기준

| 변경 유형 | 문서 영향 | 조치 |
|----------|----------|------|
| 새 export 함수/클래스 추가 | 레퍼런스 섹션 | 시그니처 + ParamTable 추가 |
| 함수 파라미터 변경 | 레퍼런스 섹션 | ParamTable 업데이트 |
| 새 에러 타입/핸들링 추가 | 트러블슈팅 | FAQ 항목 추가 |
| 상태 변수 추가/제거 | 내부 구현 | 상태 변수 목록 + Mermaid 업데이트 |
| 새 import 의존성 | 개요 + 관련 문서 | 아키텍처 다이어그램 + SeeAlso 업데이트 |
| 상수/임계값 변경 | 해당 섹션 | 수치 업데이트 (예: 83.5% → 85%) |
| 주석/포맷만 변경 | 없음 | 문서 수정 불필요 — 스킵 |
| 파일 삭제 | 문서 삭제 | 페이지 삭제 + docs/page.tsx에서 제거 |

#### 문서가 없는 파일이 변경된 경우

매핑되는 문서 페이지가 아직 없으면 사용자에게 알린다:
```
⚠️ src/core/observation-masking.ts가 변경되었지만 대응하는 문서가 아직 없습니다.
   문서를 생성하려면: /generate-class-docs observation-masking.ts 문서화해줘
```

---

### 모드 B: 생성 모드 (특정 모듈 지정 시)

## 실행 절차

### Step 1: 대상 소스 코드 분석

사용자가 문서화할 클래스/모듈 파일을 지정하면:

1. **파일 읽기**: 해당 .ts 파일의 전체 소스 코드를 읽는다
2. **심볼 추출**: export된 클래스, 인터페이스, 함수, 타입을 식별한다
3. **의존성 파악**: import 관계를 분석하여 어떤 모듈과 연결되는지 파악한다
4. **레이어 확인**: CLAUDE.md의 4-Layer 아키텍처에서 이 모듈이 어디에 위치하는지 확인한다
5. **사용처 추적**: 이 모듈을 import하는 다른 파일들을 grep으로 찾는다

### Step 2: 문서 구조 설계

아래 페이지 템플릿에 따라 문서 구조를 설계한다. 핵심은 초보자의 관점에서 생각하는 것이다.
"이 코드를 처음 보는 주니어 개발자가 무엇을 먼저 알아야 하는가?"를 기준으로 내용 순서를 정한다.

### Step 3: React 컴포넌트로 페이지 생성

`guide/src/app/docs/[module-name]/page.tsx` 형태로 Next.js 페이지를 생성한다.
기존 `guide/` 프로젝트의 컴포넌트(MermaidDiagram, CodeBlock, Callout 등)를 재사용한다.

### Step 4: 네비게이션에 추가

`guide/` 프로젝트의 Navigation 컴포넌트에 새 문서 페이지 링크를 추가한다.

---

## 페이지 템플릿

모든 문서 페이지는 아래 구조를 따른다. React 공식 문서의 Hook/Component 페이지 구조를 벤치마킹했다.

```
┌─────────────────────────────────────────────┐
│ 📄 모듈명 (한 줄 설명)                       │
│ 파일 경로 + 레이어 배지                      │
├─────────────────────────────────────────────┤
│                                             │
│ ## 개요 (Overview)                          │
│ 이 모듈이 무엇이고, 왜 존재하는지 2-3문장.   │
│ 아키텍처에서의 위치를 Mermaid로 시각화.       │
│                                             │
│ ## 레퍼런스 (Reference)                     │
│ ### 클래스/함수 시그니처                      │
│ #### 파라미터                               │
│ #### 반환값                                 │
│ #### 주의사항 (Caveats)                     │
│                                             │
│ ## 사용법 (Usage)                           │
│ ### 기본 사용법 (가장 흔한 케이스)            │
│ ### 고급 사용법 1                            │
│ ### 고급 사용법 2                            │
│ > Pitfall: 흔한 실수 경고                    │
│ <Deep Dive> 내부 동작 원리 </Deep Dive>      │
│                                             │
│ ## 내부 구현 (Internals)                    │
│ 상태 머신, 데이터 흐름 등 Mermaid 다이어그램  │
│ 핵심 코드 발췌 + 라인별 설명                 │
│                                             │
│ ## 트러블슈팅 (Troubleshooting)             │
│ ### "X가 동작하지 않아요"                    │
│ ### "Y 에러가 발생해요"                      │
│                                             │
│ ## 관련 문서 (See Also)                     │
│ 연관 모듈 링크                              │
└─────────────────────────────────────────────┘
```

---

## 각 섹션 작성 가이드

### 1. 개요 (Overview)

목적: 이 모듈을 처음 접하는 사람이 10초 안에 "이게 뭔지" 파악하게 한다.

작성 규칙:
- 첫 문장: "X는 Y를 담당하는 모듈입니다." (명확한 역할 정의)
- 둘째 문장: 왜 이 모듈이 필요한지 (동기/문제)
- 셋째 문장: 핵심 특징 1-2개 (차별점)
- Mermaid 다이어그램: 이 모듈이 전체 아키텍처에서 어디에 위치하는지 시각화
  - 현재 모듈을 강조 색상으로 표시
  - 직접 연결된 모듈만 표시 (전체 아키텍처 아님)

예시:
```
Context Manager는 LLM의 제한된 컨텍스트 윈도우를 효율적으로 관리하는 모듈입니다.
대화가 길어지면 토큰 한도를 초과하는 문제를 해결하기 위해, 3단계 압축 파이프라인을 구현합니다.
83.5% 사용률에서 자동 압축이 트리거되며, Cold Storage로 디스크에 결과를 저장하여 토큰을 절약합니다.
```

### 2. 레퍼런스 (Reference)

목적: API 사양을 정확하고 완전하게 기술한다. "이 함수에 뭘 넣으면 뭐가 나오는지."

작성 규칙:
- 모든 public export를 문서화 (private/internal은 "내부 구현" 섹션에서)
- 파라미터는 테이블 형태: `이름 | 타입 | 필수여부 | 설명`
- 반환 타입을 명확히 기술
- Caveats(주의사항)는 반드시 포함 — 초보자가 실수하기 쉬운 부분
- 코드 블록에 타입 시그니처 표시 (구문 강조 포함)

코드 표시 스타일:
```tsx
// CodeBlock 컴포넌트 사용, 구문 강조 클래스 적용
<span className="kw">interface</span> <span className="type">ContextUsage</span> {
  <span className="prop">currentTokens</span>: <span className="type">number</span>;
  <span className="prop">maxTokens</span>: <span className="type">number</span>;
}
```

### 3. 사용법 (Usage)

목적: "실제로 어떻게 쓰는지"를 구체적 시나리오로 보여준다.

작성 규칙:
- 첫 번째 사용법: 가장 흔하고 단순한 케이스 (80%의 사용자가 필요한 것)
- 이후 사용법: 점진적으로 복잡한 시나리오
- 각 사용법에 반드시 동작하는 코드 예시 포함
- **Pitfall 콜아웃**: 흔한 실수를 미리 경고 (React의 Pitfall 패턴)
  ```tsx
  <Callout type="warn" icon="⚠️">
    <strong>Pitfall:</strong> shouldCompact()를 직접 호출하지 마세요.
    Agent Loop가 매 반복마다 자동으로 확인합니다.
  </Callout>
  ```
- **Deep Dive**: 고급 내용은 접을 수 있는 영역에 배치
  - "왜 83.5%인가?" 같은 설계 결정 배경
  - 내부 알고리즘 상세 설명
  - 성능 최적화 팁

### 4. 내부 구현 (Internals)

목적: "어떻게 동작하는지"를 코드 레벨에서 설명한다. 기여자나 깊이 이해하고 싶은 사람을 위한 섹션.

작성 규칙:
- Mermaid 다이어그램으로 내부 상태 흐름 시각화 (stateDiagram, flowchart, sequenceDiagram 중 적합한 것)
- 핵심 코드 발췌: 전체 코드가 아닌, 가장 중요한 20-30줄을 발췌하여 라인별 설명
- 상태 변수 목록: 클래스가 관리하는 주요 상태와 그 역할
- 알고리즘 설명: 복잡한 로직은 단계별로 번호를 매겨 설명

### 5. 트러블슈팅 (Troubleshooting)

목적: 사용자가 겪을 수 있는 문제를 미리 답변한다.

작성 규칙:
- 제목은 사용자의 관점에서 작성: "X가 동작하지 않아요" (React Troubleshooting 패턴)
- 각 문제에 대해: 원인 → 해결책 → 예방법
- 실제 에러 메시지가 있다면 포함
- 3-5개 정도 (너무 많으면 FAQ로 분리)

### 6. 관련 문서 (See Also)

- 같은 레이어의 연관 모듈 링크
- 이 모듈을 사용하는 상위 모듈 링크
- 이 모듈이 의존하는 하위 모듈 링크

---

## 콜아웃 타입 분류

React + Spring 문서에서 검증된 5가지 콜아웃 타입을 사용한다:

| 타입 | 아이콘 | 용도 | Callout type |
|------|--------|------|-------------|
| Note | 💡 | 알아두면 좋은 보충 정보 | `info` |
| Tip | ✅ | 효율적인 사용법 제안 | `tip` |
| Pitfall | ⚠️ | 흔한 실수 경고 (필수) | `warn` |
| Warning | 🚫 | 심각한 문제 야기 가능 | `danger` |
| Deep Dive | 🔬 | 고급 내용 (접을 수 있게) | 별도 컴포넌트 |

---

## React 컴포넌트 작성 규칙

### 파일 위치

```
guide/src/app/docs/[module-name]/page.tsx
```

예: `context-manager` → `guide/src/app/docs/context-manager/page.tsx`

### 기존 컴포넌트 재사용

guide/ 프로젝트에 이미 존재하는 컴포넌트를 반드시 재사용한다:

- `MermaidDiagram` — Mermaid 다이어그램 렌더링
- `CodeBlock` — 구문 강조된 코드 블록
- `SectionHeader` — 섹션 제목 (라벨 + 타이틀 + 설명)
- `FilePath` — 소스 파일 경로 태그
- `Callout` — 콜아웃 (info, warn, tip, danger)
- `ImplDirection` — 구현 방향 & 확장 포인트
- `RevealOnScroll` — 스크롤 시 페이드인 애니메이션

### 이미 존재하는 컴포넌트 (모두 재사용)

- `DeepDive` — 접을 수 있는 고급 내용 영역 (details/summary)
- `ParamTable` — 파라미터 테이블 (name, type, required, desc)
- `LayerBadge` — Layer 배지 (core, infra, leaf, cli)
- `SeeAlso` — 관련 문서 링크 카드 (name, slug, relation, desc)
- `Sidebar` — 좌측 사이드바 네비게이션 (자동 표시)

### 페이지 컴포넌트 구조 (실제 동작하는 패턴)

```tsx
"use client";

import { MermaidDiagram } from "@/components/MermaidDiagram";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";
import { FilePath } from "@/components/FilePath";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import { DeepDive } from "@/components/DeepDive";
import { ParamTable } from "@/components/ParamTable";
import { LayerBadge } from "@/components/LayerBadge";
import { SeeAlso } from "@/components/SeeAlso";

export default function ModuleNamePage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">

        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/core/module-name.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">ModuleName</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="core" />  {/* core | infra | leaf | cli */}
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">한 줄 설명</p>
          </div>
        </RevealOnScroll>

        {/* ─── 1. 개요 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3"
                style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>📋</span> 개요
            </h2>
            {/* 2-3문장 설명 + MermaidDiagram + Callout */}
          </section>
        </RevealOnScroll>

        {/* ─── 2. 레퍼런스 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3"
                style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>📖</span> 레퍼런스
            </h2>
            {/* h3: text-lg font-bold text-indigo-600 font-mono */}
            {/* ParamTable + CodeBlock + Caveats */}
          </section>
        </RevealOnScroll>

        {/* ─── 3. 사용법 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3"
                style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>🚀</span> 사용법
            </h2>
            {/* CodeBlock + Callout type="warn" + DeepDive */}
          </section>
        </RevealOnScroll>

        {/* ─── 4. 내부 구현 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3"
                style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>⚙️</span> 내부 구현
            </h2>
            {/* MermaidDiagram + 핵심 코드 발췌 */}
          </section>
        </RevealOnScroll>

        {/* ─── 5. 트러블슈팅 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3"
                style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>🔧</span> 트러블슈팅
            </h2>
            {/* FAQ 형태 */}
          </section>
        </RevealOnScroll>

        {/* ─── 6. 관련 문서 ─── */}
        <RevealOnScroll>
          <section>
            <h2 className="text-2xl font-extrabold flex items-center gap-3"
                style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>🔗</span> 관련 문서
            </h2>
            <SeeAlso items={[
              { name: "module-name", slug: "module-slug", relation: "parent", desc: "설명" },
            ]} />
          </section>
        </RevealOnScroll>

      </div>
    </div>
  );
}
```

### CSS 일관성 규칙 (반드시 준수)

| 요소 | 클래스/스타일 | 주의 |
|------|-------------|------|
| 최외곽 | `<div className="min-h-screen">` + `<div className="center-narrow">` | `mx-auto` 사용 금지 |
| h2 | `text-2xl font-extrabold flex items-center gap-3` | **gap-2 아님, gap-3** |
| h2 margin | `style={{ marginBottom: "24px", marginTop: "0" }}` | CSS 기본 h2 마진 제거 |
| h3 (API 항목) | `text-lg font-bold text-indigo-600 font-mono` | |
| 섹션 margin | `style={{ marginBottom: "64px" }}` | |
| 본문 텍스트 | `text-[14px] text-gray-600 leading-[1.85]` | |
| h2 이모지 | 📋 개요, 📖 레퍼런스, 🚀 사용법, ⚙️ 내부 구현, 🔧 트러블슈팅, 🔗 관련 문서 | 순서 고정 |

### Mermaid 다이어그램 규칙 (반드시 준수)

1. **라이트 테마 색상만 사용** — 다크 fill 절대 금지

| 용도 | fill | stroke | color |
|------|------|--------|-------|
| 강조 노드 (보라) | `#ede9fe` | `#8b5cf6` | `#5b21b6` |
| 주요 노드 (파랑) | `#dbeafe` | `#3b82f6` | `#1e40af` |
| 보조 노드 (회색) | `#f1f5f9` | `#94a3b8` | `#334155` |
| 성공 (초록) | `#dcfce7` | `#10b981` | `#065f46` |
| 경고 (노랑) | `#fef3c7` | `#f59e0b` | `#92400e` |
| 에러 (빨강) | `#fee2e2` | `#ef4444` | `#991b1b` |
| 기본 (연파랑) | `#e0e7ff` | `#64748b` | `#1e293b` |

2. **모든 노드에 설명 필수**: `NODE_ID["이름<br/><small>한국어 설명</small>"]`
3. **stateDiagram-v2 사용 금지**: HTML 라벨 미지원 → `graph TD` 사용
4. **셀프 루프 금지**: `A --> A` 패턴은 렌더링 이상 → 노드 설명에 포함

---

## 문서화 현황 (21/21 완료)

모든 모듈의 Source Reference 문서가 완료되었다. 새 모듈이 추가되면 이 목록에 추가하고 문서를 생성한다.

### Layer 1: CLI (2/2)
- ✅ `cli/hooks/useAgentLoop.ts` → `/docs/use-agent-loop`
- ✅ `cli/components/ActivityFeed.tsx` → `/docs/activity-feed`

### Layer 2: Core (7/7)
- ✅ `agent-loop.ts` → `/docs/agent-loop`
- ✅ `context-manager.ts` → `/docs/context-manager`
- ✅ `circuit-breaker.ts` → `/docs/circuit-breaker`
- ✅ `recovery-executor.ts` → `/docs/recovery-executor`
- ✅ `system-prompt-builder.ts` → `/docs/system-prompt-builder`
- ✅ `checkpoint-manager.ts` → `/docs/checkpoint-manager`
- ✅ `observation-masking.ts` → `/docs/observation-masking`

### Layer 3: Infrastructure (7/7)
- ✅ `llm/token-counter.ts` → `/docs/token-counter`
- ✅ `llm/model-capabilities.ts` → `/docs/model-capabilities`
- ✅ `llm/client.ts` → `/docs/llm-client`
- ✅ `llm/dual-model-router.ts` → `/docs/dual-model-router`
- ✅ `guardrails/secret-scanner.ts` → `/docs/secret-scanner`
- ✅ `tools/registry.ts` → `/docs/tool-registry`
- ✅ `tools/executor.ts` → `/docs/tool-executor`
- ✅ `permissions/manager.ts` → `/docs/permission-manager`
- ✅ `mcp/manager.ts` → `/docs/mcp-manager`

### Layer 4: Leaf (3/3)
- ✅ `config/loader.ts` → `/docs/config-loader`
- ✅ `skills/manager.ts` → `/docs/skill-manager`
- ✅ `instructions/loader.ts` → `/docs/instruction-loader`

### 네비게이션 업데이트 위치
새 문서 추가 시 반드시 두 곳을 업데이트:
1. `guide/src/components/Sidebar.tsx` — status를 "ready"로 설정
2. `guide/src/app/docs/page.tsx` — 모듈 status를 "ready"로 + 통계 숫자 업데이트

---

## 품질 체크리스트

문서 페이지 생성 후 반드시 확인:

- [ ] 개요가 10초 안에 "이게 뭔지" 전달하는가
- [ ] 모든 public API가 레퍼런스에 기술되었는가
- [ ] 가장 흔한 사용법이 첫 번째에 위치하는가
- [ ] Pitfall 콜아웃이 최소 1개 있는가 (초보자 실수 방지)
- [ ] Mermaid 다이어그램이 최소 1개 있는가 (시각적 이해)
- [ ] Deep Dive가 고급 내용을 적절히 숨기고 있는가
- [ ] 트러블슈팅이 사용자 관점에서 작성되었는가
- [ ] 코드 예시가 실제 프로젝트 패턴을 반영하는가
- [ ] Next.js 빌드가 성공하는가 (`npm run build`)
- [ ] 네비게이션에 새 문서 링크가 추가되었는가
