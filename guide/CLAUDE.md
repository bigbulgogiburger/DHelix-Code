# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

dbcode 개발가이드 — Next.js 16 / React 19 / Tailwind CSS v4 / Mermaid.js 기반 문서 사이트.
두 개의 탭으로 구성: **Deep Dive** (모듈 아키텍처 개요) + **Source Reference** (모듈별 상세 문서).

## Commands

```bash
npm run dev          # Next.js dev server (Turbopack)
npm run build        # 프로덕션 빌드 — 전체 라우트 정적 생성
npm run lint         # ESLint
```

## Architecture

```
src/
├── app/
│   ├── layout.tsx          # 루트 레이아웃 (Navigation + main padding)
│   ├── page.tsx            # Deep Dive 메인 (히어로 + 10개 모듈 섹션)
│   └── docs/
│       ├── page.tsx        # Source Reference 목록 (Layer 1→2→3→4 순서)
│       └── [module]/page.tsx  # 모듈별 상세 문서 (10개 완료, 11개 예정)
├── components/
│   ├── Navigation.tsx      # 상단 고정 네비 (Deep Dive | Source Reference 탭)
│   ├── MermaidDiagram.tsx  # Mermaid 다이어그램 (동적 import, 다크 테마)
│   ├── CodeBlock.tsx       # 구문 강조 코드 블록
│   ├── Callout.tsx         # info/warn/tip/danger 콜아웃
│   ├── DeepDive.tsx        # 접을 수 있는 고급 내용 (details/summary)
│   ├── ParamTable.tsx      # 파라미터 테이블
│   ├── LayerBadge.tsx      # Layer 1~4 배지
│   ├── FilePath.tsx        # 소스 파일 경로 태그
│   ├── SeeAlso.tsx         # 관련 문서 링크 카드
│   ├── ImplDirection.tsx   # 구현 방향 & 확장 포인트
│   ├── RevealOnScroll.tsx  # IntersectionObserver 페이드인
│   ├── SectionHeader.tsx   # 섹션 제목 (라벨 + 타이틀)
│   └── modules/            # Deep Dive 10개 모듈 섹션 컴포넌트
└── app/globals.css         # 디자인 시스템 (Ethereal Glass)
```

## 디자인 시스템: Ethereal Glass

### 색상 팔레트 (globals.css :root)

| 용도 | 변수 | 값 |
|------|------|-----|
| 배경 | `--bg-primary` | `#0c1222` (깊은 네이비) |
| 카드 | `--bg-card` | `rgba(255,255,255,0.04)` (글래스) |
| 텍스트 | `--text-primary` | `#f0f4fc` |
| 보조 텍스트 | `--text-secondary` | `#a8b8d8` |
| Accent Blue | `--accent-blue` | `#4d8df5` |
| Accent Cyan | `--accent-cyan` | `#22c5dc` |
| Accent Purple | `--accent-purple` | `#9d7af5` |

### 글래스 카드 (`.glass-card` CSS 클래스)

```css
backdrop-blur-xl + border-white/6 + inset shadow + hover lift
```

카드 배경에는 항상 `glass-card` CSS 클래스를 사용한다. 인라인 `bg-bg-card border border-border` 금지.

## 핵심 규칙 (반드시 준수)

### Tailwind v4 함정

- **`mx-auto` 사용 금지** — Tailwind v4 + @theme inline 환경에서 작동하지 않음
- **대신 CSS 클래스 사용**:
  - `.center-wide` (max-width: 1280px) — 메인 페이지, 모듈 섹션, 네비게이션
  - `.center-container` (max-width: 1024px) — docs 목록 페이지
  - `.center-narrow` (max-width: 900px) — 개별 문서 페이지
- **`max-w-2xl mx-auto` 같은 패턴도 금지** — 인라인 style로 처리: `style={{ maxWidth: "42rem", marginLeft: "auto", marginRight: "auto" }}`

### Navigation

- Navigation은 `layout.tsx`에만 위치 — 개별 page.tsx에서 `<Navigation />` 중복 import 절대 금지
- `layout.tsx`의 `<main>`에 `padding-top: 72px` 적용됨 — 개별 페이지에서 nav 높이 고려한 padding 불필요

### 한글 텍스트

- **유니코드 이스케이프 금지** — `\uXXXX` 형태로 한글을 쓰면 안 됨, 반드시 한글 직접 입력
- `word-break: keep-all` (globals.css에 적용됨)
- 헤딩에 `text-wrap: balance` (globals.css에 적용됨)

### 문서 페이지 통일 규칙

모든 Source Reference 문서 페이지(`docs/[module]/page.tsx`)는 동일한 구조:

```
1. Header: FilePath + h1 (그라디언트) + LayerBadge + 한 줄 설명
2. 개요: 2-3문장 + MermaidDiagram (아키텍처 위치)
3. 레퍼런스: 시그니처 + ParamTable + Caveats
4. 사용법: 기본→고급 순서, Callout warn 필수, DeepDive 포함
5. 내부 구현: Mermaid 상태 다이어그램 + 핵심 코드 발췌
6. 트러블슈팅: 사용자 관점 FAQ 3-5개
7. 관련 문서: SeeAlso 컴포넌트
```

- h2 헤더: `text-2xl font-extrabold` + 이모지 (`📋 개요`, `📖 레퍼런스`, `🚀 사용법`, `⚙️ 내부 구현`, `🔧 트러블슈팅`, `🔗 관련 문서`)
- 최외곽 컨테이너: `<div className="min-h-screen pt-10 pb-20"><div className="center-narrow">`
- 각 섹션을 `<RevealOnScroll>`로 감싸기
- Mermaid 다이어그램 최소 1개
- Callout type="warn" (Pitfall) 최소 1개

### Mermaid 다이어그램

- 다크 테마: background `#131b2e`, fontSize `13px`
- 컨테이너: `glass-card` + `p-8 sm:p-12` + `min-h-[280px]`
- 노드 강조: `fill:#2a1e4a,stroke:#8b5cf6,color:#f1f5f9` (보라)

### Deep Dive 모듈 섹션 (modules/*.tsx)

- 컨테이너: `center-wide`
- 섹션 패딩: `py-24`
- 짝수 섹션: `bg-bg-secondary` 배경

## Source Reference 문서화 계획

상세 계획: `SOURCE_REFERENCE_PLAN.md`

| 완료 (10) | 예정 (11) |
|-----------|-----------|
| agent-loop, context-manager, circuit-breaker, recovery-executor | system-prompt-builder, checkpoint-manager, observation-masking |
| token-counter, model-capabilities, secret-scanner | llm-client, dual-model-router, tool-executor, mcp-manager |
| tool-registry, permission-manager, config-loader | skill-manager, instruction-loader, use-agent-loop, activity-feed |
