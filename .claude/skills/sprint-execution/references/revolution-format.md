# Revolution Document Format Guide

docs/revolution/ 문서들의 구조와 파싱 방법.

## 문서 구조

### 핵심 계획 문서 (01-06)

```
# NN — 제목

> Version, Scope, Status 메타 정보

## 1. 현황 분석
  - 컴포넌트별 평가 테이블

## 2. 경쟁사 분석
  - Feature comparison matrix

## 3. Gap 분석
  ### Gap A: 제목 — CRITICAL/HIGH/MEDIUM
  - 파일 참조, 코드 예시

## 4. Improvement Plan
  ### Phase 1: 제목 (Week N-M)
  - 작업 테이블: | 작업 | 우선순위 | LOC | 대상 파일 |
  - TypeScript 인터페이스 (구현 가이드)

## 5. Implementation Details
  - 파일별 상세 변경 계획

## 6. Success Metrics
  - | Metric | Current | Target |

## 7. Risk Assessment
```

### 마스터 로드맵 (99)

```
## Version Roadmap

### v0.3.0 — 제목 (N weeks)
  **영역 (NN)**
  | 작업 | 우선순위 | LOC | 대상 파일 |

### v0.4.0 — 제목 (N weeks)
  ...
```

## 작업 항목 추출 규칙

1. 테이블 행이 `| 작업명 | P0/P1/P2 | +NNN | src/path.ts |` 형식이면 → 작업 항목
2. `(신규)` / `(NEW)` → 파일 새로 생성
3. `(수정)` / `(MODIFY)` → 기존 파일 수정
4. P0 = 필수, P1 = 중요, P2 = 선택

## 버전 → 문서 매핑

| Version | Primary Docs | Wave |
|---------|-------------|------|
| v0.3.0 | 01, 02 | Runtime Foundation |
| v0.4.0 | 03, 06 | Orchestration & Security |
| v0.5.0 | 04, 05 | UX & Features |
| v0.6.0 | 03, 05, 06 | Platform Maturation |
| v0.7.0 | 04, 05 | GUI & Advanced |
