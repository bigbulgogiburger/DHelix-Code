# dbcode Guide 개선 마스터 플랜

> 작성일: 2026-03-22
> 기준: 사이트 감사 48개 이슈 + 업계 Best Practice 리서치 (React.dev, Stripe, Tailwind, Next.js, Spring.io)
> 현재 상태: 89페이지 문서화 완료, 라이트 테마, 기본 네비게이션

---

## 목차

1. [Quick Wins — 즉시 적용 가능 (3-4시간)](#1-quick-wins)
2. [검색 & 네비게이션 혁신 (8시간)](#2-검색--네비게이션)
3. [코드 블록 고도화 (4시간)](#3-코드-블록-고도화)
4. [다크 모드 (3시간)](#4-다크-모드)
5. [접근성 개선 (3시간)](#5-접근성)
6. [Mermaid 다이어그램 UX (4시간)](#6-mermaid-다이어그램)
7. [컴포넌트 리디자인 (5시간)](#7-컴포넌트-리디자인)
8. [성능 최적화 (4시간)](#8-성능-최적화)
9. [Deep Dive 페이지 개편 (6시간)](#9-deep-dive-개편)
10. [장기 로드맵](#10-장기-로드맵)

---

## 1. Quick Wins

**예상 소요: 3-4시간 | 영향도: 높음 | 난이도: 쉬움**

즉시 적용할 수 있는 10개 개선 항목. 각각 15-30분 소요.

### 1-1. CodeBlock 복사 버튼 추가

**현재**: 코드를 수동 드래그 → 복사해야 함
**개선**: 우측 상단 "Copy" 버튼 + "Copied!" 토스트

```tsx
// CodeBlock.tsx에 추가
<button onClick={() => navigator.clipboard.writeText(code)}
        className="absolute top-3 right-3 text-xs text-gray-400 hover:text-white">
  {copied ? "Copied!" : "Copy"}
</button>
```

**벤치마크**: React.dev, Stripe, Tailwind, Next.js 모두 복사 버튼 제공. 업계 표준.

### 1-2. CodeBlock 언어 라벨 추가

**현재**: 코드가 TypeScript인지 Bash인지 구분 불가
**개선**: 좌측 상단에 `language` prop으로 라벨 표시 (e.g., "TypeScript", "Bash")

### 1-3. Back-to-Top 버튼

**현재**: 긴 문서에서 스크롤 올리기 번거로움
**개선**: 스크롤 400px 이상 시 우측 하단에 FAB 표시

### 1-4. "Edit on GitHub" 링크

**현재**: 문서 개선 기여 방법 없음
**개선**: 각 페이지 헤더에 GitHub 편집 링크
**벤치마크**: Next.js, Spring Boot 모두 제공

### 1-5. 섹션 앵커 링크

**현재**: h2/h3에 id 없어서 특정 섹션 직접 링크 불가
**개선**: 각 h2/h3에 자동 id 생성 + hover 시 🔗 아이콘 표시
**벤치마크**: React.dev, Tailwind 모두 제공

### 1-6. ARIA 라벨 보강

**현재**: Sidebar 토글 버튼에 aria-expanded 없음, DeepDive에 aria-controls 없음
**개선**: 모든 인터랙티브 요소에 ARIA 속성 추가

### 1-7. 색상 대비 수정

**현재**: text-gray-400 (#9ca3af) on white — 대비율 3:1 (WCAG 미달)
**개선**: text-gray-500 이상으로 변경 (대비율 4.5:1 이상)

### 1-8. Skip to Content 링크

**현재**: 키보드 사용자가 매번 Navigation + Sidebar를 탭해야 함
**개선**: `<a href="#main" className="sr-only focus:not-sr-only">콘텐츠로 건너뛰기</a>`

### 1-9. Previous / Next 네비게이션

**현재**: 문서 끝에서 다음 모듈로 이동 방법 없음
**개선**: 페이지 하단에 "← 이전 모듈 | 다음 모듈 →" 버튼
**벤치마크**: Next.js, React.dev 모두 제공

### 1-10. 포커스 링 스타일

**현재**: 키보드 포커스 시 아무 표시 없음
**개선**: `a:focus-visible, button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`

---

## 2. 검색 & 네비게이션

**예상 소요: 8시간 | 영향도: 최고 | 난이도: 중간~높음**

### 2-1. Cmd+K 글로벌 검색 (필수)

**현재**: 검색 기능 없음. 200+ 페이지에서 모듈 찾기 불가능.
**벤치마크**: 2025-2026 기준 모든 주요 문서 사이트의 필수 기능.

**구현 방안**:

| 옵션 | 장점 | 단점 | 추천 |
|------|------|------|------|
| **Fuse.js** (클라이언트) | 무료, 설치 쉬움, 오프라인 | 빌드 시 인덱스 생성 필요 | ★★★★ |
| **Algolia DocSearch** | 무료(OSS), 초고속, AI 검색 | 외부 의존성 | ★★★★★ |
| **MiniSearch** | 경량, 타입스크립트 | 기능 제한 | ★★★ |

**UI 패턴**:
- Navigation 바에 검색 입력 + "⌘K" 힌트
- 모달 오버레이에 실시간 검색 결과
- 결과에 breadcrumb 컨텍스트 표시 (e.g., "Layer 2 > Core > agent-loop")
- 최근 검색 + 인기 검색어

### 2-2. On This Page (우측 TOC 사이드바)

**현재**: 긴 문서에서 섹션 점프 불가
**벤치마크**: Next.js, Tailwind 모두 우측 TOC 제공

**구현**:
- 데스크톱 1200px 이상: 우측에 고정 TOC 표시
- h2/h3 자동 추출 + IntersectionObserver로 현재 섹션 하이라이트
- 태블릿/모바일: 숨김

### 2-3. 브레드크럼

**현재**: 현재 위치 파악 어려움
**개선**: `Home > Source Reference > Layer 2: Core > agent-loop`

### 2-4. 사이드바 확장성 개선

**현재**: 하드코딩된 모듈 목록, 200+ 페이지 시 관리 불가
**개선**:
- 사이드바 데이터를 JSON으로 분리
- 하위 그룹 추가 (LLM, Tools, Permissions 등)
- 사이드바 내 필터/검색 기능
- auto-scroll to active item (Tailwind 패턴)

### 2-5. 모바일 사이드바 수정

**현재**: 햄버거 메뉴 클릭 시 사이드바가 열리지 않음 (이벤트 리스너 미구현)
**개선**: Sidebar 컴포넌트에 `toggle-mobile-sidebar` 이벤트 리스너 추가

---

## 3. 코드 블록 고도화

**예상 소요: 4시간 | 영향도: 높음 | 난이도: 중간**

### 3-1. 구문 강조 엔진 교체

**현재**: 수동 CSS 클래스 7개 (kw, str, type, fn, cm, prop, num)
**개선**: Shiki 또는 Prism.js로 교체

| 옵션 | 장점 | 단점 | 추천 |
|------|------|------|------|
| **Shiki** | VS Code 테마 호환, 빌드 타임 하이라이팅 | 번들 크기 | ★★★★★ |
| **Prism.js** | 경량, 플러그인 풍부 | 설정 필요 | ★★★★ |
| **현재 유지** | 변경 없음 | 7개 토큰만 지원 | ★★ |

### 3-2. 라인 넘버 표시

**현재**: 라인 번호 없음
**개선**: CSS counter 또는 Shiki의 라인 넘버 기능

### 3-3. 라인 하이라이팅

**현재**: 특정 라인 강조 불가
**개선**: `highlightLines` prop으로 특정 라인 배경색 변경
**벤치마크**: React.dev, Tailwind 모두 지원

### 3-4. 언어 탭 (선택)

**현재**: 하나의 언어만 표시
**개선**: TypeScript / JavaScript 탭 전환 (Stripe, Next.js 패턴)

---

## 4. 다크 모드

**예상 소요: 3시간 | 영향도: 높음 | 난이도: 중간**

**현재**: globals.css에 다크 모드 변수가 정의되어 있지만 활성화되지 않음
**벤치마크**: 2025-2026 기준 **기본 기대치**. 모든 주요 문서 사이트 지원.

### 구현 계획

1. Navigation에 다크 모드 토글 버튼 추가
2. `<html>` 요소에 `.dark` 클래스 토글
3. `prefers-color-scheme` 미디어 쿼리로 시스템 설정 존중
4. `localStorage`에 사용자 선택 저장
5. MermaidDiagram 컴포넌트: 테마에 따라 themeVariables 전환
6. CodeBlock: 다크/라이트 색상 분기

### Mermaid 다크 모드 색상

```
Light: background #ffffff, primaryColor #eef2ff
Dark:  background #0f172a, primaryColor #1e293b
```

---

## 5. 접근성

**예상 소요: 3시간 | 영향도: 높음 | 난이도: 쉬움~중간**

### 5-1. 시맨틱 HTML 보강

| 컴포넌트 | 현재 | 개선 |
|---------|------|------|
| Sidebar 토글 | `<button>` (aria 없음) | `aria-expanded`, `aria-controls` 추가 |
| DeepDive | `<button>` | `aria-expanded`, `aria-controls` 추가 |
| MermaidDiagram | SVG (접근성 없음) | `role="img"`, `aria-label` 추가 |
| Navigation 탭 | `<Link>` | `role="tablist"`, `aria-selected` 추가 |

### 5-2. Mermaid 다이어그램 접근성

**현재**: 스크린 리더에서 다이어그램 내용을 읽을 수 없음
**개선**:
```tsx
<div role="img" aria-label="Agent Loop 내부 상태머신 — INIT에서 시작하여 LLM_CALL, TOOL_EXEC를 거쳐 OUTPUT으로 종료">
  <div ref={containerRef} />
</div>
```

### 5-3. 키보드 네비게이션

- `/` → 검색 열기
- `j` / `k` → 이전/다음 모듈
- `Escape` → 모달/오버레이 닫기
- `[` / `]` → 사이드바 토글

---

## 6. Mermaid 다이어그램

**예상 소요: 4시간 | 영향도: 중간 | 난이도: 중간**

### 6-1. CLS (Cumulative Layout Shift) 해결

**현재**: 다이어그램이 클라이언트에서 렌더링되면서 레이아웃 시프트 발생
**개선**:
- 컨테이너에 `min-height` 설정 (스켈레톤 로더)
- 또는 빌드 타임에 SVG 사전 생성 (remark-mermaid 플러그인)

### 6-2. 반응형 다이어그램

**현재**: 모바일에서 큰 다이어그램이 잘림
**개선**:
```tsx
<div className="overflow-x-auto">
  <div style={{ minWidth: 'fit-content' }} ref={containerRef} />
</div>
```
+ 모바일에서 핀치 줌 지원

### 6-3. 노드 수 가이드라인

**업계 Best Practice**: 다이어그램당 **7-12 노드** 이하
**현재**: 일부 다이어그램이 20+ 노드로 과밀
**개선**: 복잡한 다이어그램은 2-3개로 분리

### 6-4. 인터랙티브 다이어그램 (장기)

**현재**: 정적 SVG
**장기 개선**: React Flow 또는 D3.js로 클릭 가능한 아키텍처 뷰
- 노드 클릭 → 해당 문서 페이지로 이동
- 호버 → 모듈 요약 팝오버

---

## 7. 컴포넌트 리디자인

**예상 소요: 5시간 | 영향도: 중간 | 난이도: 중간**

### 7-1. DeepDive 확장/축소 애니메이션

**현재**: display toggle (즉시 나타남/사라짐)
**개선**: `max-height` + `transition-all duration-300` 애니메이션

### 7-2. Callout 아이콘 SVG 교체

**현재**: 이모지 아이콘 (OS별 렌더링 차이)
**개선**: Lucide Icons SVG로 교체 (일관된 디자인)

### 7-3. ParamTable 모바일 반응형

**현재**: 4열 테이블이 모바일에서 잘림
**개선**: 640px 이하에서 카드 레이아웃으로 전환

### 7-4. SeeAlso 카드 호버 효과

**현재**: 미약한 호버 (bg-gray-50)
**개선**: `transform: translateX(4px)` + 화살표 이동 애니메이션

### 7-5. FilePath 컴포넌트 클릭 가능

**현재**: 정적 배지
**개선**: 클릭 시 GitHub 소스 파일로 이동

### 7-6. LayerBadge 색상 + 아이콘

**현재**: 텍스트만
**개선**: 각 레이어별 아이콘 추가 (🖥️ CLI, ⚙️ Core, 🔧 Infra, 🍃 Leaf)

---

## 8. 성능 최적화

**예상 소요: 4시간 | 영향도: 중간 | 난이도: 중간~높음**

### 8-1. Mermaid 프리로드

**현재**: 각 다이어그램에서 동적 import → 중복 로딩
**개선**: `_app.tsx`에서 Mermaid 1회 프리로드 후 전역 인스턴스 공유

### 8-2. RevealOnScroll 최적화

**현재**: 각 섹션마다 IntersectionObserver 생성 (200+ 옵저버)
**개선**: 단일 루트 IntersectionObserver + data attribute 기반 감지

### 8-3. 폰트 셀프 호스팅

**현재**: Pretendard CDN 로딩 (네트워크 요청)
**개선**: WOFF2 셀프 호스팅 + `<link rel="preload">`

### 8-4. 정적 다이어그램 생성 (장기)

**현재**: 클라이언트에서 Mermaid 렌더링
**장기 개선**: 빌드 타임에 SVG 사전 생성 → 클라이언트 JS 제거

---

## 9. Deep Dive 개편

**예상 소요: 6시간 | 영향도: 높음 | 난이도: 중간**

### 9-1. 히어로 섹션 CTA

**현재**: 히어로에 행동 유도 버튼 없음
**개선**: "모듈 상세 문서 보기 →" 버튼 추가 (Source Reference로 이동)

### 9-2. 모듈 섹션 시각 차별화

**현재**: 모든 섹션이 동일한 흰 배경
**개선**: 레이어별 미세 배경색 차이
- Core: 연보라 배경
- Infra: 연파랑 배경
- Leaf: 연주황 배경

### 9-3. 섹션 간 전환 효과

**현재**: 단순 fade-in만 반복
**개선**: 섹션별 stagger delay + 미세 parallax 효과

### 9-4. 인터랙티브 아키텍처 뷰 (장기)

**현재**: 정적 Mermaid 다이어그램
**장기**: React Flow 기반 클릭 가능한 아키텍처 맵
- 각 노드 클릭 → 해당 모듈 Deep Dive 섹션으로 스크롤
- 호버 → 모듈 요약 + 의존성 하이라이트

### 9-5. 프로그레스 인디케이터

**현재**: 스크롤 위치 파악 불가
**개선**: 상단 고정 프로그레스 바 (전체 페이지 대비 현재 위치)

### 9-6. 모듈 섹션 앵커

**현재**: 특정 모듈 섹션으로 직접 링크 불가
**개선**: `<section id="agent-loop">` 추가 → `/#agent-loop`로 접근 가능

---

## 10. 장기 로드맵

### Phase A: MDX 마이그레이션 (2-3주)

**현재**: 모든 문서가 TSX 컴포넌트 (하드코딩)
**장기**: MDX로 마이그레이션 → 마크다운 기반 문서 작성

**장점**:
- 비개발자도 문서 수정 가능
- 빌드 타임 콘텐츠 검증
- 자동 TOC 생성
- frontmatter 메타데이터

### Phase B: AI 검색 통합

**벤치마크**: Algolia DocSearch v4의 "Ask AI" 기능
**구현**: 검색 모달에 "AI에게 물어보기" 탭 추가
- 사용자의 자연어 질문 → 관련 문서 섹션 자동 추출

### Phase C: 버전 관리

**현재**: 단일 버전
**장기**: 버전 드롭다운 (v1.0, v2.0) + 버전별 문서 트리

### Phase D: 피드백 위젯

**벤치마크**: Next.js의 "Was this helpful?" 위젯
**구현**: 각 페이지 하단에 👍/👎 피드백 + 선택적 코멘트

### Phase E: 인쇄 스타일

**현재**: 인쇄 시 네비게이션, 사이드바 포함
**개선**: `@media print` 스타일 추가

---

## 우선순위 매트릭스

```
        높은 영향도                   낮은 영향도
       ┌─────────────────────────────────────────┐
쉬움   │ ★ Quick Wins (1장)          │ 포커스 링  │
       │ ★ ARIA 라벨                │ 앵커 링크  │
       │ ★ Skip to Content          │ 인쇄 스타일│
       ├─────────────────────────────────────────┤
중간   │ ★★ Cmd+K 검색              │ 언어 탭    │
       │ ★★ 다크 모드                │ 피드백     │
       │ ★★ On This Page TOC        │ 버전 관리  │
       │ ★★ 코드 복사 버튼           │           │
       ├─────────────────────────────────────────┤
어려움 │ ★★★ MDX 마이그레이션        │ AI 검색   │
       │ ★★★ 인터랙티브 아키텍처 뷰   │           │
       │ ★★★ Shiki 구문 강조         │           │
       └─────────────────────────────────────────┘
```

### 추천 실행 순서

1. **Sprint 1** (1일): Quick Wins 10개 (Section 1)
2. **Sprint 2** (2일): 검색 + 사이드바 + 모바일 (Section 2)
3. **Sprint 3** (1일): 코드 블록 고도화 (Section 3)
4. **Sprint 4** (1일): 다크 모드 (Section 4)
5. **Sprint 5** (1일): 접근성 + 컴포넌트 (Section 5, 7)
6. **Sprint 6** (2일): Deep Dive 개편 + 성능 (Section 8, 9)

**총 예상: 8일 (40시간)**

---

## 참고 자료

| 자료 | URL | 핵심 인사이트 |
|------|-----|-------------|
| React.dev | react.dev | Interactive Sandpack, Learn/Reference 분리 |
| Stripe Docs | docs.stripe.com | Markdoc 빌드타임 검증, 언어 탭 |
| Tailwind Docs | tailwindcss.com/docs | 300+ 페이지 flat sidebar, auto-scroll |
| Next.js Docs | nextjs.org/docs | 3-column layout, feedback widget |
| Spring Boot | spring.io/projects | 버전 관리, 크로스 프로젝트 링크 |
| Algolia DocSearch | docsearch.algolia.com | Cmd+K 검색 + AI Ask |
| WCAG 2.2 | w3.org/WAI | 대비율 4.5:1, 타겟 크기 24x24 |
| Mermaid Best Practices | mermaid.js.org | 7-12 노드/다이어그램, ELK 렌더러 |
