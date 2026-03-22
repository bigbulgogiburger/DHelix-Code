# 문서화 벤치마크 분석

> 참조 시점: 문서 페이지의 품질이나 구조에 대해 고민할 때

## Spring Framework 문서 구조 (spring.io)

Spring은 3-tier 문서 시스템을 사용합니다:

### Tier 1: 프로젝트 랜딩 (spring.io/projects/)

- 기능 목록, 퀵스타트, 에코시스템 링크
- 마케팅 지향적

### Tier 2: 레퍼런스 가이드 (docs.spring.io/reference/)

- Antora 기반, 좌측 사이드바에 3-4 depth 트리
- 도메인별 구성: Core > IoC Container > Dependencies > DI
- 언어 탭: Java / Kotlin 병렬 표시
- Admonition 블록: Note, Tip, Warning, Important

### Tier 3: Javadoc API

- 자동 생성 클래스/메서드 레벨 API 문서
- 상속 계층, 메서드 시그니처, 파라미터, 반환값

## React 공식 문서 구조 (react.dev)

React는 2-tier 시스템을 사용합니다:

### Learn 섹션

- 튜토리얼/개념 콘텐츠, 온보딩용
- 단계별 학습 경로

### Reference 섹션

- 각 Hook/Component/API가 독립 페이지
- **핵심 템플릿**: Reference → Usage → Troubleshooting

#### useState 페이지 분석:

- Reference: 시그니처, Parameters, Returns, Caveats
- Usage: 6개 시나리오 (단순→복잡 순서)
- Troubleshooting: "I've updated the state, but the screen doesn't update"
- 34개 인터랙티브 Sandpack 예시
- 6개 Deep Dive 확장 영역
- 다수의 Pitfall 콜아웃

## 핵심 패턴 비교

| 패턴        | Spring                | React                           | 우리 적용                        |
| ----------- | --------------------- | ------------------------------- | -------------------------------- |
| 페이지 구조 | 서사적 서술           | Reference/Usage/Troubleshooting | React 스타일 채택                |
| 코드 예시   | 언어 탭 (Java/Kotlin) | 인터랙티브 Sandbox              | 구문 강조 코드 블록              |
| 초보자 배려 | Admonition 블록       | Pitfall + Deep Dive             | 둘 다 채택                       |
| 시각화      | 텍스트 위주           | 텍스트 위주                     | Mermaid 다이어그램 추가 (차별점) |
| 내비게이션  | 깊은 트리 사이드바    | 플랫 그룹 사이드바              | 레이어별 그룹 사이드바           |
| 버전/상태   | 버전 선택기           | Canary 배지                     | 레이어 배지                      |

## 우리만의 차별점

1. **Mermaid 다이어그램 필수** — 텍스트만으로는 전달하기 어려운 상태 흐름과 의존 관계를 시각화
2. **한국어 우선** — 개요, 설명, 콜아웃 모두 한국어. 코드와 타입명만 영어
3. **4-Layer 배지** — 각 모듈이 어떤 레이어에 속하는지 즉시 파악 가능
4. **구현 방향 섹션** — "이 모듈을 확장하려면 어디를 건드려야 하는지" 안내
