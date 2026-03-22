# Spacing & Padding 전면 수정 계획서

> 작성일: 2026-03-22
> 역할: 최고의 UX/UI 디자이너
> 문제: 모든 요소가 다닥다닥 붙어있어서 가독성 최악

---

## 1. 근본 원인 분석

### 핵심 원인: Tailwind v4 spacing 유틸리티 미작동

브라우저 DevTools 측정 결과:

```
┌──────────────────────────────────────────────────┐
│  측정 결과 (전부 0px으로 확인됨)                    │
├──────────────────────────────────────────────────┤
│  Hero padding-top:        0px  (예상: 80px)       │
│  Hero padding-bottom:     0px  (예상: 96px)       │
│  Section padding-top:     0px  (예상: 64px)       │
│  Section padding-bottom:  0px  (예상: 64px)       │
│  h2 margin-bottom:        0px  (예상: 24px)       │
│  h3 margin-bottom:        0px  (예상: 16px)       │
│  Section gap:             0px  (예상: 64px)       │
│  Card padding:            0px  (예상: 20px)       │
│  Callout padding:         0px  (예상: 16px)       │
│  Code block padding:      0px  (예상: 20px)       │
│  Code block margin:       0px  (예상: 16px)       │
│  Table cell padding:      0px  (예상: 12px)       │
│  Footer padding:          0px  (예상: 48px)       │
│  Wrapper padding-top:     0px  (예상: 32px)       │
│  FilePath to h1 gap:      -88px (겹쳐있음!)       │
│                                                  │
│  유일하게 작동하는 것:                              │
│  - 인라인 style={{}} 으로 지정한 것                 │
│  - CSS 클래스 (.center-wide 등)                   │
│  - Tailwind 색상 클래스 (bg-white, text-gray-900) │
└──────────────────────────────────────────────────┘
```

### 원인: Tailwind v4 + @theme inline 환경

Tailwind v4에서 `@theme inline` 블록에 정의되지 않은 유틸리티 중 일부가 작동하지 않음.
특히 **spacing 유틸리티** (`p-*`, `m-*`, `gap-*`, `py-*`, `px-*`, `mb-*`, `mt-*`)가
컴파일 시 CSS로 변환되지 않는 문제 발생.

**색상 유틸리티는 작동** (bg-white, text-gray-900, border-gray-200 등)
**spacing 유틸리티는 미작동** (p-5, mb-4, gap-3, py-16 등)

---

## 2. 해결 전략

### 전략 A: 인라인 style로 전면 교체 (확실하지만 노가다)

모든 spacing을 `style={{ padding: "...", margin: "..." }}`로 교체.
장점: 100% 확실하게 작동
단점: 코드가 지저분해짐, 유지보수 어려움

### 전략 B: globals.css에 spacing 유틸리티 CSS 클래스 직접 정의 (추천)

center-wide처럼 자주 쓰는 spacing 패턴을 CSS 클래스로 정의.
기존 Tailwind 클래스 대신 커스텀 CSS 클래스 사용.

### 전략 C: @theme inline에 spacing 토큰 등록

Tailwind v4의 `@theme inline` 블록에 spacing 값을 명시적으로 등록.
이렇게 하면 Tailwind spacing 유틸리티가 다시 작동할 수 있음.

### 선택: 전략 C (근본 해결) + 전략 B (보험)

`@theme inline`에 spacing 변수를 추가하되,
핵심 레이아웃 패턴은 CSS 클래스로도 보장.

---

## 3. globals.css 수정 계획

### 3-1. @theme inline에 spacing 등록

```css
@theme inline {
  /* 기존 색상 변수들... */

  /* Spacing 토큰 */
  --spacing-0: 0px;
  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 20px;
  --spacing-6: 24px;
  --spacing-8: 32px;
  --spacing-10: 40px;
  --spacing-12: 48px;
  --spacing-16: 64px;
  --spacing-20: 80px;
  --spacing-24: 96px;
}
```

### 3-2. 레이아웃 spacing CSS 클래스 추가

```css
/* ─── Spacing Utilities (Tailwind v4 fallback) ─── */

/* 섹션 간 패딩 */
.section-padding {
  padding-top: 64px;
  padding-bottom: 64px;
}
.section-padding-sm {
  padding-top: 40px;
  padding-bottom: 40px;
}
.section-padding-lg {
  padding-top: 96px;
  padding-bottom: 96px;
}

/* 컨텐츠 내부 간격 */
.content-gap {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.content-gap-sm {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.content-gap-lg {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* 카드 패딩 */
.card-padding {
  padding: 20px;
}
.card-padding-lg {
  padding: 24px;
}

/* 섹션 헤더 (h2) 아래 간격 */
.section-title {
  margin-bottom: 24px;
}

/* 요소 간 간격 */
.mb-element {
  margin-bottom: 16px;
}
.mb-section {
  margin-bottom: 48px;
}
.mb-subsection {
  margin-bottom: 32px;
}

/* 페이지 wrapper */
.page-padding {
  padding-top: 40px;
  padding-bottom: 80px;
}
.hero-padding {
  padding-top: 80px;
  padding-bottom: 64px;
}
```

---

## 4. 이상적인 spacing 기준 (Spring.io / React.dev 벤치마크)

### 4-1. 페이지 레벨

| 요소              | 현재 | 목표 | 근거                           |
| ----------------- | ---- | ---- | ------------------------------ |
| 히어로 pt         | 0px  | 80px | Spring.io 히어로 상단 여백     |
| 히어로 pb         | 0px  | 64px | 히어로와 본문 사이 충분한 분리 |
| Deep Dive 섹션 py | 0px  | 64px | 섹션 간 시각적 분리            |
| Doc 페이지 pt     | 0px  | 40px | 콘텐츠 시작 전 여백            |
| Doc 페이지 pb     | 0px  | 80px | 페이지 끝 여유                 |
| Footer py         | 0px  | 48px | 푸터 내부 여백                 |

### 4-2. 섹션 내부

| 요소                       | 현재 | 목표 | 근거                 |
| -------------------------- | ---- | ---- | -------------------- |
| h2 mb                      | 0px  | 24px | 제목과 콘텐츠 사이   |
| h3 mb                      | 0px  | 16px | 소제목과 콘텐츠 사이 |
| h2 mt (섹션 내 두번째 h2+) | 0px  | 48px | 섹션 내 구분         |
| p mb                       | 0px  | 16px | 문단 간 간격         |
| ul/ol mb                   | 0px  | 16px | 리스트 아래 간격     |

### 4-3. 컴포넌트 내부

| 컴포넌트       | 요소         | 현재 | 목표       | 근거               |
| -------------- | ------------ | ---- | ---------- | ------------------ |
| CodeBlock      | padding      | 0px  | 20px (p-5) | 코드 주변 여백     |
| CodeBlock      | margin-y     | 0px  | 24px       | 본문과 분리        |
| Callout        | padding      | 0px  | 16px (p-4) | 콜아웃 내부 여백   |
| Callout        | margin-y     | 0px  | 20px       | 본문과 분리        |
| ParamTable     | cell padding | 0px  | 12px 16px  | 셀 내부 여백       |
| ParamTable     | margin-y     | 0px  | 24px       | 테이블 전후 간격   |
| MermaidDiagram | padding      | 0px  | 24px       | 다이어그램 여백    |
| MermaidDiagram | margin-b     | 0px  | 32px       | 아래 콘텐츠와 분리 |
| DeepDive       | button py    | 0px  | 16px       | 클릭 영역          |
| DeepDive       | content p    | 0px  | 20px       | 내용 여백          |
| SeeAlso card   | padding      | 0px  | 16px       | 카드 내부 여백     |
| SeeAlso        | gap          | 0px  | 12px       | 카드 간 간격       |
| ImplDirection  | padding      | 0px  | 24px       | 블록 내부 여백     |
| FilePath       | padding      | 0px  | 4px 12px   | 태그 내부          |
| LayerBadge     | padding      | 0px  | 2px 10px   | 배지 내부          |

### 4-4. 카드/그리드

| 요소              | 현재        | 목표 | 근거           |
| ----------------- | ----------- | ---- | -------------- |
| 모듈 카드 padding | 0px         | 20px | 카드 내부 여백 |
| 카드 간 gap       | 12px (작동) | 12px | 유지           |
| Layer 그룹 간 gap | 40px (작동) | 40px | 유지           |
| 그리드 카드 gap   | 0px         | 20px | 카드 사이 간격 |

### 4-5. 네비게이션 & 사이드바

| 요소             | 현재        | 목표 | 근거      |
| ---------------- | ----------- | ---- | --------- |
| 사이드바 내부 py | 24px (작동) | 24px | 유지      |
| 사이드바 항목 py | 0px         | 8px  | 클릭 영역 |
| 사이드바 항목 px | 0px         | 16px | 좌우 여백 |
| 네비 높이        | 60px (작동) | 60px | 유지      |

---

## 5. 수정 대상 파일 목록

### 우선순위 P0: globals.css (근본 해결)

- `@theme inline`에 spacing 토큰 등록
- spacing CSS 유틸리티 클래스 추가
- 기본 요소 spacing 규칙 추가 (h1~h4, p, ul, table 등)

### 우선순위 P1: 공용 컴포넌트 7개 (인라인 style 보강)

Tailwind spacing이 작동하지 않을 경우를 대비해 인라인 style로 spacing 보장.

| 파일               | 추가할 인라인 style                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| CodeBlock.tsx      | `style={{ padding: "20px", margin: "24px 0" }}`                                                        |
| Callout.tsx        | `style={{ padding: "16px", margin: "20px 0" }}`                                                        |
| MermaidDiagram.tsx | `style={{ padding: "24px", marginBottom: "32px" }}`                                                    |
| DeepDive.tsx       | button: `style={{ padding: "16px 20px" }}`, content: `style={{ padding: "12px 20px 20px" }}`           |
| ParamTable.tsx     | container: `style={{ margin: "24px 0" }}`, cells: `style={{ padding: "12px 16px" }}`                   |
| FilePath.tsx       | `style={{ padding: "4px 12px" }}`                                                                      |
| SeeAlso.tsx        | cards: `style={{ padding: "16px" }}`, container: `style={{ gap: "12px" }}` (flex gap은 작동할 수 있음) |

### 우선순위 P2: 페이지 파일 (인라인 style 보강)

| 파일                    | 수정 내용                                                       |
| ----------------------- | --------------------------------------------------------------- |
| page.tsx (메인)         | hero `style={{ paddingTop: "80px", paddingBottom: "64px" }}`    |
| docs/page.tsx           | wrapper `style={{ paddingTop: "40px", paddingBottom: "80px" }}` |
| docs/\*/page.tsx (10개) | wrapper `style={{ paddingTop: "40px", paddingBottom: "80px" }}` |

### 우선순위 P3: 모듈 섹션 10개

| 파일                  | 수정 내용                                                       |
| --------------------- | --------------------------------------------------------------- |
| modules/\*.tsx (10개) | section `style={{ paddingTop: "64px", paddingBottom: "64px" }}` |

---

## 6. 수정 원칙

### 인라인 style 사용 기준

```
1. Tailwind 클래스 먼저 시도 (예: p-5, mb-6)
2. 작동하지 않으면 → 인라인 style={{ }} 으로 보장
3. 핵심 레이아웃은 CSS 클래스 (.section-padding 등)로 이중 보장
```

### spacing 단위 통일 (8px 그리드)

```
4px  (0.25rem) — 최소 간격 (인라인 요소 내부)
8px  (0.5rem)  — 요소 내부 작은 간격
12px (0.75rem) — 카드 간 간격, 리스트 항목
16px (1rem)    — 문단 간격, 컴포넌트 내부 패딩
20px (1.25rem) — 카드 패딩
24px (1.5rem)  — 섹션 제목 아래, 코드 블록 마진
32px (2rem)    — 서브섹션 간격
40px (2.5rem)  — 페이지 상단 패딩
48px (3rem)    — 섹션 간 간격 (작은)
64px (4rem)    — 섹션 간 간격 (표준)
80px (5rem)    — 히어로 상단, 페이지 하단
96px (6rem)    — 히어로 하단
```

---

## 7. 기대 효과

### Before (현재)

```
┌─ nav ─────────────────────────────────┐
├───────────────────────────────────────┤
│제목h2콘텐츠코드블록콜아웃테이블다음섹션│  ← 전부 다닥다닥
│h3내용코드제목h2내용...                │
└───────────────────────────────────────┘
```

### After (목표)

```
┌─ nav ─────────────────────────────────┐
│                                       │
│          (40px 상단 여백)              │
│                                       │
│  📄 src/core/agent-loop.ts            │
│                                       │  ← 16px
│  Agent Loop                           │
│  Layer 2: Core                        │
│                                       │  ← 24px
│  ── 개요 ─────────────────────────    │
│                                       │  ← 24px (h2 mb)
│  Agent Loop는 dbcode의 심장입니다...  │
│                                       │  ← 16px (p mb)
│  ┌─ Mermaid 다이어그램 ──────────┐    │
│  │        (24px 내부 패딩)        │    │
│  └───────────────────────────────┘    │
│                                       │  ← 32px
│  ── 레퍼런스 ─────────────────────    │
│                                       │  ← 24px
│  ┌─ 코드 블록 ───────────────────┐   │
│  │     (20px 패딩, 다크 배경)     │   │
│  └───────────────────────────────┘   │
│                                       │  ← 24px
│  ┌─ 파라미터 테이블 ─────────────┐   │
│  │ (12px 16px 셀 패딩)           │   │
│  └───────────────────────────────┘   │
│                                       │  ← 48px (다음 섹션)
│  ── 사용법 ───────────────────────    │
│                                       │
│  ...                                  │
│                                       │
│          (80px 하단 여백)              │
│                                       │
└───────────────────────────────────────┘
```

---

## 8. 컬러 톤 통일 계획

### 8-1. 현재 문제: 색상 혼재

브라우저 DevTools + grep 분석 결과:

```
┌─────────────────────────────────────────────────────┐
│  컬러 혼재 현황                                      │
├─────────────────────────────────────────────────────┤
│  ❌ rgba() 잔재: 7개 doc 페이지에 29~11건씩 존재      │
│  ❌ gradient 잔재: 7개 doc 페이지에 남아있음            │
│  ❌ accent-* 변수 참조: 일부 페이지에 1~11건 존재      │
│  ❌ 인라인 hex 색상: #22c5dc, #9d7af5 등 다크 테마용   │
│  ❌ lab() 색상: Tailwind 내부 변환 결과, 일관성 불명    │
│  ✅ 컴포넌트 자체는 라이트화 완료 (bg-white 등)        │
│  ✅ 코드 블록 구문 강조 색상은 다크 배경 전용이므로 OK  │
└─────────────────────────────────────────────────────┘
```

### 8-2. 확정 컬러 팔레트 (Spring.io 벤치마크)

모든 페이지/컴포넌트에서 아래 색상만 사용한다.
인라인 hex(`#22c5dc`, `#9d7af5` 등)는 전부 Tailwind 표준 클래스로 교체.

#### 텍스트 색상 (3단계만)

| 용도      | Tailwind 클래스 | Hex     | 사용처                    |
| --------- | --------------- | ------- | ------------------------- |
| 제목/강조 | `text-gray-900` | #0f172a | h1, h2, h3, strong        |
| 본문      | `text-gray-700` | #334155 | p, li, td                 |
| 보조/설명 | `text-gray-500` | #64748b | caption, 날짜, 메타       |
| 비활성    | `text-gray-400` | #9ca3af | planned 상태, placeholder |

#### 배경 색상 (4단계만)

| 용도        | Tailwind 클래스 | Hex     | 사용처                             |
| ----------- | --------------- | ------- | ---------------------------------- |
| 기본        | `bg-white`      | #ffffff | 페이지 배경, 카드                  |
| 대체        | `bg-gray-50`    | #f9fafb | 교대 섹션, 사이드바, DeepDive 내용 |
| 코드        | `bg-slate-800`  | #1e293b | 코드 블록 (유일한 다크)            |
| 테이블 헤더 | `bg-gray-50`    | #f9fafb | 테이블 th                          |

#### 보더 색상 (2단계만)

| 용도  | Tailwind 클래스   | Hex     | 사용처            |
| ----- | ----------------- | ------- | ----------------- |
| 기본  | `border-gray-200` | #e5e7eb | 카드, 테이블, nav |
| hover | `border-gray-300` | #d1d5db | 카드 hover        |

#### Accent 색상 (역할별 1개씩)

| 역할          | Tailwind 클래스                       | 사용처                          |
| ------------- | ------------------------------------- | ------------------------------- |
| 브랜드/링크   | `text-indigo-600` / `bg-indigo-50`    | 링크, 활성 탭, 모듈명, FilePath |
| Layer 1 CLI   | `text-blue-600` / `bg-blue-100`       | LayerBadge, border-left         |
| Layer 2 Core  | `text-violet-600` / `bg-violet-100`   | LayerBadge, border-left         |
| Layer 3 Infra | `text-emerald-600` / `bg-emerald-100` | LayerBadge, border-left         |
| Layer 4 Leaf  | `text-amber-600` / `bg-amber-100`     | LayerBadge, border-left         |
| 성공/Ready    | `text-emerald-600` / `bg-emerald-100` | 상태 배지                       |
| 경고/Pitfall  | `text-amber-700` / `bg-amber-50`      | Callout warn                    |
| 에러/위험     | `text-red-700` / `bg-red-50`          | Callout danger                  |
| 정보          | `text-blue-700` / `bg-blue-50`        | Callout info                    |
| 팁            | `text-emerald-700` / `bg-emerald-50`  | Callout tip                     |

#### 코드 구문 강조 (다크 배경 전용 — 변경 불필요)

| 요소     | CSS 클래스 | 색상    |
| -------- | ---------- | ------- |
| 키워드   | `.kw`      | #ff7b72 |
| 문자열   | `.str`     | #a5d6ff |
| 타입     | `.type`    | #79c0ff |
| 함수     | `.fn`      | #d2a8ff |
| 주석     | `.cm`      | #8b949e |
| 프로퍼티 | `.prop`    | #7ee787 |
| 숫자     | `.num`     | #ffa657 |

### 8-3. 제거해야 할 색상 패턴

doc 페이지 10개에서 일괄 제거/교체할 패턴:

```
제거 대상 (grep으로 찾아서 교체):

1. rgba(...) 배경/보더 → Tailwind 표준 클래스로
   - rgba(255,255,255,0.xx) → bg-white 또는 bg-gray-50
   - rgba(139,92,246,0.xx) → bg-violet-100 또는 제거
   - rgba(59,130,246,0.xx) → bg-blue-100 또는 제거

2. gradient 텍스트 → 단색으로
   - bg-gradient-to-r from-* to-* bg-clip-text text-transparent
     → text-gray-900 (제목) 또는 text-indigo-600 (강조)

3. 인라인 hex → Tailwind 클래스로
   - text-[#22c5dc] → text-cyan-600 (사이드바 전용) 또는 text-indigo-600
   - text-[#9d7af5] → text-violet-600
   - text-[#a8b8d8] → text-gray-500
   - text-[#6b7fa3] → text-gray-500
   - text-[#f472b6] → text-pink-600 (제거 권장)
   - bg-[#f8fafc] → bg-gray-50
   - border-[#e2e8f0] → border-gray-200

4. accent-* CSS 변수 참조 → 직접 Tailwind 클래스
   - text-accent-purple → text-violet-600
   - bg-accent-light → bg-indigo-50
   - border-accent → border-indigo-600
```

---

## 9. 컴포넌트화 계획

### 9-1. 현재 문제: 중복 + 비일관성

각 doc 페이지(10개)가 600~1000줄씩 되면서 동일한 UI 패턴을 제각각 구현:

```
┌─────────────────────────────────────────────────────┐
│  중복 패턴 (10개 페이지에서 반복)                      │
├─────────────────────────────────────────────────────┤
│  ❌ h2 섹션 헤더 — 이모지 + 텍스트 조합이 페이지마다 다름 │
│  ❌ FAQ/트러블슈팅 카드 — 각자 다른 스타일로 구현       │
│  ❌ 상태 변수 테이블 — 일부는 ParamTable, 일부는 직접  │
│  ❌ 핵심 코드 발췌 영역 — CodeBlock + 설명 레이아웃 비일관│
│  ❌ 페이지 헤더 (FilePath + h1 + Badge) — 미세한 차이  │
│  ❌ 섹션 구분선 — 있는 곳/없는 곳 혼재                  │
└─────────────────────────────────────────────────────┘
```

### 9-2. 추가 컴포넌트 목록

기존 컴포넌트를 유지하면서, 반복 패턴을 새 컴포넌트로 추출:

#### DocPageHeader (신규)

```tsx
// 모든 doc 페이지 상단을 통일
interface DocPageHeaderProps {
  filePath: string; // "src/core/agent-loop.ts"
  title: string; // "Agent Loop"
  layer: "core" | "infra" | "leaf" | "cli";
  description: string; // 한 줄 설명
}

// 렌더링:
// 📄 src/core/agent-loop.ts
//
// Agent Loop
// Layer 2: Core    ReAct 패턴 메인 루프...
```

#### DocSection (신규)

```tsx
// 모든 섹션의 h2 + 내용을 통일
interface DocSectionProps {
  id: string; // "reference", "usage" 등
  icon: string; // "📖", "🚀" 등
  title: string; // "레퍼런스"
  children: React.ReactNode;
}

// 렌더링:
// 일관된 h2 스타일 + 아래 24px 간격 + 섹션 간 48px 간격
```

#### TroubleshootItem (신규)

```tsx
// FAQ/트러블슈팅 항목을 통일
interface TroubleshootItemProps {
  question: string; // "루프가 무한 반복해요"
  children: React.ReactNode; // 답변 내용
}

// 렌더링:
// Q. 루프가 무한 반복해요
// ────────
// 원인: ...
// 해결: ...
```

#### CodeExcerpt (신규)

```tsx
// 핵심 코드 발췌 + 라인별 설명을 통일
interface CodeExcerptProps {
  title?: string; // "recordIteration() 핵심 로직"
  code: React.ReactNode; // CodeBlock 내용
  explanations?: Array<{
    // 라인별 설명
    line: string;
    desc: string;
  }>;
}
```

#### StateTable (신규)

```tsx
// 상태 변수 테이블을 통일
interface StateVar {
  name: string;
  type: string;
  desc: string;
}

// ParamTable과 유사하지만 "필수" 열 대신 "기본값" 열
```

### 9-3. 기존 컴포넌트 개선

| 컴포넌트           | 개선 내용                                        |
| ------------------ | ------------------------------------------------ |
| **Callout**        | `style` prop 추가 — 커스텀 spacing 가능하게      |
| **CodeBlock**      | `title` prop 추가 — 코드 블록 상단에 파일명 표시 |
| **MermaidDiagram** | `size` prop 추가 — "sm", "md", "lg" 크기 제어    |
| **ParamTable**     | `compact` prop 추가 — 좁은 공간용 간결한 테이블  |
| **DeepDive**       | `defaultOpen` prop 추가 — 기본 열림 상태 제어    |
| **SeeAlso**        | 간격 인라인 style 보장                           |

### 9-4. 컴포넌트 spacing 표준

모든 컴포넌트가 따라야 할 외부/내부 spacing 규칙:

```
┌─ 컴포넌트 spacing 규칙 ─────────────────────────┐
│                                                │
│  [외부 margin]                                  │
│  ┌─────────────────────────────────────────┐   │
│  │ [내부 padding]                          │   │
│  │                                         │   │
│  │  컴포넌트 내용                           │   │
│  │                                         │   │
│  │ [내부 padding]                          │   │
│  └─────────────────────────────────────────┘   │
│  [외부 margin]                                  │
│                                                │
│  규칙:                                          │
│  1. 외부 margin은 컴포넌트 자체가 관리           │
│  2. 부모가 gap으로 관리할 때는 margin 0          │
│  3. 내부 padding은 인라인 style로 보장           │
└────────────────────────────────────────────────┘

표준 외부 margin (style={{ margin }}):
  - CodeBlock: 24px 0
  - Callout: 20px 0
  - MermaidDiagram: 0 0 32px 0
  - ParamTable: 24px 0
  - DeepDive: 20px 0
  - SeeAlso 카드: gap 12px (부모 flex gap)

표준 내부 padding (style={{ padding }}):
  - CodeBlock: 20px
  - Callout: 16px
  - MermaidDiagram: 24px
  - ParamTable 셀: 12px 16px
  - DeepDive 버튼: 16px 20px
  - DeepDive 내용: 12px 20px 20px
  - 카드: 20px
  - 사이드바 항목: 8px 16px
```

---

## 10. 진행 순서

### Phase 1: 기반 수정 (globals.css)

1. `@theme inline`에 spacing 토큰 등록
2. 기본 요소 spacing 규칙 추가 (h1~h4, p, ul, table의 margin/padding)
3. spacing CSS 유틸리티 클래스 추가
4. 인라인 hex 색상 → CSS 변수 또는 Tailwind 클래스 매핑

### Phase 2: 새 컴포넌트 생성

5. `DocPageHeader.tsx` — 페이지 헤더 통일
6. `DocSection.tsx` — 섹션 h2 + spacing 통일
7. `TroubleshootItem.tsx` — FAQ 항목 통일
8. `CodeExcerpt.tsx` — 코드 발췌 + 설명 통일
9. `StateTable.tsx` — 상태 변수 테이블

### Phase 3: 기존 컴포넌트 spacing 보강 (인라인 style)

10. CodeBlock, Callout, MermaidDiagram — 내부 padding + 외부 margin
11. ParamTable, DeepDive, FilePath — 동일
12. SeeAlso, ImplDirection, LayerBadge — 동일

### Phase 4: 페이지 레벨 spacing

13. `page.tsx` (메인) — hero padding + 섹션 간격
14. `docs/page.tsx` — wrapper padding
15. 모듈 섹션 10개 — section padding

### Phase 5: 컬러 톤 정리

16. Doc 페이지 10개 — rgba/gradient/인라인 hex 일괄 제거
17. accent-\* CSS 변수 참조 → Tailwind 표준 클래스

### Phase 6: 검증

18. 빌드 확인
19. E2E 스크린샷 (메인/docs/개별문서 3종)
20. 컬러 일관성 grep 확인 (rgba, gradient, #hex 잔재 0건)
