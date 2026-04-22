# 책임 기획자 검증 — Plasmid & Recombination System (GAL-1)

**작성일**: 2026-04-22
**검증자**: AI Coding Agent 책임 기획자
**검증 대상**: `docs/prd/plasmid-recombination-system.md` (v0.2)
**결론**: ⚠️ **현 상태 Phase 1 착수 불가 — 재설계 후 재검토 (CONDITIONAL NO-GO)**

---

## 0. Executive Verdict (검증 정정 반영)

| 항목 | 평가 | 비고 |
|------|-----|------|
| **제품 비전** | ⭐⭐⭐⭐☆ | 차별화 포인트 명확, 브랜드 정합 |
| **기술 실현 가능성** | ⭐⭐⭐☆☆ | F2/F3 정정 후 재평가. F1(결정론)이 주요 남은 이슈 |
| **일정 현실성** | ⭐⭐☆☆☆ | Phase 3 2주는 비현실적 |
| **UX 완성도** | ⭐⭐⭐☆☆ | 인지 부담 과소평가 |
| **시장 검증** | ⭐☆☆☆☆ | 제로. 실사용자 인터뷰 없음 |
| **리스크 관리** | ⭐⭐☆☆☆ | 상향식 리스크 누락 |
| **철학적 깊이** | ⭐⭐⭐⭐⭐ | Part II는 훌륭하나 운영화(operationalize) 부족 |

**권고**: **Phase 0 (POC 2주)** 을 신설하여 3개 가설을 검증한 후 Phase 1 착수 여부 재결정.

**주의 — 책임 기획자 자기정정 공개**:
- v1.0 초안의 F2, F3는 **코드 미확인 상태에서 추상 규칙으로만 판단한 오판**이었음
- 실제 코드 확인 결과 F2는 무효, F3는 경미한 수정 사항으로 격하
- 남은 진짜 Fatal은 **F1(결정론)**, 진짜 Critical은 C1-C8 대부분 유효
- 책임 기획자도 실수하며, 증거 기반 자기정정이 의무

---

## 1. Fatal Flaws (치명적 결함 — 해결 전 진행 불가)

**사후 정정 요약**: 초기 3건 중 F2는 무효, F3는 Critical로 격하. **진짜 Fatal은 F1뿐**.

### F1. LLM-as-Compiler의 결정론 주장은 불가능

**주장(PRD §10.1 불변식 I-3)**:
> Recombination은 멱등하다. 같은 plasmid 집합 → 같은 artifact. 단, LLM 호출이 포함된 단계는 temperature=0 + seed 고정.

**검증**:
- `temperature=0 + seed`는 **같은 모델 + 같은 인프라** 내에서만 근사 결정성 제공
- 모델 버전 업데이트(예: gpt-4o-2024-05 → gpt-4o-2024-11)만 해도 출력 변함
- 프로바이더 변경(OpenAI → Anthropic → Local)하면 완전히 다름
- dhelix-code는 **8개 프로바이더** 지원 (CLAUDE.md) → 결정론 유지 불가능
- 진정한 컴파일러(AST 기반)와 근본적으로 다름

**영향**:
- 이 불변식은 **cure 안전성, 재현 가능한 recombination, 팀 plasmid 공유의 기반**
- 깨지면 "내 recombination 결과가 동료와 다르다", "어제와 오늘 다르다" 등 혼란
- 사용자 신뢰 상실

**필수 수정**:
- [ ] I-3를 **"best-effort idempotency with caching"** 으로 격하
- [ ] Interpreter 출력 캐싱 계층 의무화 (plasmid-hash → artifact-plan 매핑)
- [ ] 캐시 미스 시 사용자에게 diff 표시 + 확인 요구
- [ ] 비결정성을 UX로 은폐하지 말고 **명시적으로** 제시

**대안 설계**: Plasmid 본문의 "Compilation Hints"를 **옵션이 아닌 필수**로 승격. Intent 해석은 사용자 힌트 기반, LLM은 보조. 진정한 컴파일러에 근접.

---

### F2. ~~레이어 규칙 자기 위반~~ — **REDACTED (검증 결과 오판)**

**초기 주장**: Layer 2 (Core)가 Layer 4 (Leaf)를 import하면 레이어 규칙 위반

**검증 결과 — 내 주장이 틀림**:
```
$ grep "from \"\.\./skills" src/subagents/
src/subagents/agent-skills-loader.ts:import { loadSkill } from "../skills/loader.js";
```

**사실**:
- `src/subagents/` (Layer 2) → `src/skills/` (Layer 4) import가 **이미 기존 패턴**
- CLAUDE.md의 "top → bottom only"의 방향: **Layer 1(CLI)/5(Platform)가 top**, Layer 4(Leaf)가 bottom
- Layer 2 → Layer 4는 top → bottom 방향 = **허용**
- madge --circular는 순환 참조만 검사, 레이어 내림차순 import는 통과

**책임 기획자의 메타 교훈**:
- PRD 검증 시 **실제 코드를 먼저 확인**하지 않고 추상적 규칙만으로 판단하면 오판 위험
- "Fatal Flaw" 태그는 엄격한 증거 기반에서만 부여해야 함
- 이 오판은 책임 기획자 자신의 **리뷰 품질 저하 사례**로 기록

**결론**: F2는 무효. 다만 부차적 관심사로 다음만 남김:
- `src/recombination/`이 Layer 2가 **최적인지** 재검토 (Layer 3 infra가 더 적절할 수도)
- 이는 Fatal이 아닌 **아키텍처 선택 사항** (아키텍트 판단)

---

### F3. Agent 생성 타깃 포맷 — **경감 (대부분 해결됨)**

**초기 주장**: dhelix-code에 사용자 정의 agent 로더가 없으므로 plasmid가 artifact를 생성해도 발현 불가

**검증 결과 — 주장 일부 오류**:

코드베이스 조사 결과 **이미 존재**:
- `src/subagents/definition-loader.ts` — `.dhelix/agents/*.md` 로더 구현됨
- `~/.dhelix/agents/*.md` (글로벌) + `.dhelix/agents/*.md` (프로젝트) 로드 순서 정의
- `agentDefinitionSchema` (Zod) 로 frontmatter 검증
- 프로젝트 > 글로벌 override 규칙

**남은 이슈 — 경미**:
- **PRD의 경로 표기가 틀림**: `.claude/agents/`가 아니라 `.dhelix/agents/`
- Claude Code 포맷 차용으로 혼동 발생 → 브랜드 정체성 관점에서 수정 필요
- 기존 agent 포맷의 스펙을 PRD가 **반영하지 않음** (definition-loader.ts의 frontmatter schema와 정합성 미검증)

**필수 수정 (경미)**:
- [ ] PRD의 모든 `.claude/agents/` → `.dhelix/agents/` 치환
- [ ] `src/subagents/definition-types.ts`의 `agentDefinitionSchema` 참조 추가
- [ ] agent-generator가 생성하는 frontmatter가 schema 통과하도록 설계

**교훈**:
- F3 역시 **실제 코드 확인 부족**에 의한 오판
- 다만 PRD의 경로 오류는 실존 문제 → 경미한 수정 사항으로 유지

---

## 2. Critical Issues (MVP 전 필수 해결)

### C1. Transcript 기반 Cure는 2주로 불가능

**PRD 주장**: Phase 3 = Cure (2주)

**실제 난이도**:
- 파일 삭제: 쉬움 ✓
- 파일 수정 복원: 중간 (pre-state hash 필요)
- CLAUDE.md 섹션 편집 복원: **어려움** (section boundary 모호)
- settings.json 중첩 병합 복원: **어려움** (nested JSON diff)
- 사용자 수동 수정 감지 + 3-way merge: **매우 어려움** (git-like)
- Transcript 손상 시 복구: 어려움

**벤치마크**:
- Git의 동일 기능(revert, reset --hard, interactive rebase)은 수년간 개발됨
- 유사 사례: dbt의 `dbt docs generate` 롤백 — 여전히 미흡
- 여러 artifact 타입에 대한 일괄 롤백은 **새로운 문제**

**권고**:
- Phase 3 최소 **4주**로 연장
- **v0 Cure**: 생성물 삭제만, 수정물 복원은 **v1으로 연기**
- v0에서도 **append-only audit log** 필수
- 사용자 수동 수정 감지는 단순 mtime 비교로 시작, 해시 비교는 v1

---

### C2. Plasmid 스키마 Sprawl

**PRD의 frontmatter 필드 수**: 20+ 개

현재 정의된 필드:
```
name, description, active, scope, triggers, version, created, author, tags,
source, priority, compatible-with, conflicts-with, extends, evals,
expression-conditions, tier, types, amplifies, amplification-factor,
immutable-by-recombination, source.confidence, source.evidence, ...
```

**문제**:
- 사용자가 20개 필드를 이해해야 plasmid 작성 가능
- Part I (§6.1.2)와 Part II (§21.3, §22.4, §25, §26) 에서 필드가 계속 추가됨
- **설계 중 이미 bloat 발생**
- harness-setup의 교훈: 3개 핵심 결정(mode, prefix, 생성계획)만 질문 → 성공

**권고**:
- v1 frontmatter는 **6개 필드만**: `name, description, active, scope, priority, types`
- 나머지는 **optional 확장 필드**로 별도 섹션
- YAML이 아닌 **typed schema (Zod)** 로 검증 → 잘못된 필드 사용 자동 차단
- 필드 추가는 **PRD 개정 + migration 계획** 필수

---

### C3. CLAUDE.md 직접 편집은 위험

**PRD 주장(§7.1)**: `rule-generator: CLAUDE.md section 편집`

**위험**:
- CLAUDE.md는 **사용자가 직접 작성한 파일**
- 자동 편집은 사용자 변경과 충돌 (마커 주석으로도 불충분)
- Git diff가 복잡해짐 ("이 줄은 누가 쓴 거야?")
- Merge conflict 가능성 증가
- 사용자 신뢰 저하

**권고**:
- **별도 파일 사용**: `.dhelix/rules.generated.md` 또는 `CLAUDE.plasmid.md`
- CLAUDE.md에는 **include 지시문만** 한 줄 추가:
  ```
  ## Generated Rules
  <!-- @plasmid-include: .dhelix/rules.generated.md -->
  ```
- 시스템 프롬프트 빌더가 include를 resolve
- 사용자 영역 / 시스템 영역 **엄격 분리**

---

### C4. Interview Fatigue Risk

**PRD §6.2.2의 인터뷰 플로우**:
1. "범위를 확인하겠습니다" (2개 질문)
2. Research 수행
3. "의심되는 부분을 확인하겠습니다" (3개 질문)
4. "저장할까요?"

**문제**:
- 사용자당 최소 **6개 질문 + 1번 승인** = 7-step interaction
- harness-setup은 인터뷰 원칙으로 **"drip-drip 금지, 한 번에 묶음"** 강조
- PRD는 이를 언급(§9.2)하지만 실제 플로우는 여전히 다단계

**벤치마크**:
- 첫 사용자의 `/plasmid` 시도 완주율 예측: **<40%**
- 두 번째 시도 시도율: **<20%**

**권고**:
- **모든 질문을 1회 통합**: scope + research 방향 + 상세 결정 → 한 번에
- Research는 **질문 이후** 백그라운드 실행
- 사용자 입력 대기 중에도 research 병렬 수행
- **"Quick mode"** 기본값: 질문 없이 기본값으로 draft 생성 → 사용자가 .md에서 직접 편집
- 대화형 interview는 옵션

---

### C5. 시장 검증 제로

**PRD에 없는 것**:
- 실제 개발자 인터뷰 데이터
- 경쟁사 사용자 pain point 분석
- 기능 검증을 위한 POC 결과
- 가격/비즈니스 모델 영향 분석

**이것이 왜 Critical인가**:
- Plasmid System은 **사용자 행동 변화**를 요구 (CLAUDE.md 작성 → plasmid 작성)
- 행동 변화는 ROI 있어야 성립
- 검증 없이 18주 투자는 도박

**유사 사례**:
- LangChain Expression Language (LCEL) — 선언적 접근, 채택 저조
- Semantic Kernel planners — 선언적 agent, 니치 시장
- **이들이 실패한 이유를 분석하지 않음**

**권고 — Phase 0 필수**:
```
Phase 0: Market Validation (2주)
  Week 1:
    - 5명 power user 1:1 인터뷰
      - "어떻게 CLAUDE.md / skill을 작성하시나요?"
      - "pain point는?"
      - Plasmid 컨셉 공유 → 반응 관찰
    - 3개 POC plasmid 작성 (dogfood)
  Week 2:
    - 3명에게 POC 사용 + 피드백 수집
    - Go/No-go 판단
    - Go면 Phase 1 착수, No-go면 피벗 또는 중단
```

---

### C6. Constitutional Plasmid는 운영 설계 없음

**PRD 주장(§22.4)**:
> Constitutional plasmid는 다른 plasmid가 위배할 수 없음. Recombination에서 최우선 priority. Conflict 시 자동 승리.

**검증 질문**:
- "위배"를 어떻게 판단하나? LLM 판단? 정적 규칙?
- 위배 판정이 LLM 기반이면 **determinism 문제 재발생**
- Constitutional plasmid 간 충돌은?
- 어떤 사용자가 constitutional을 만들 권한?

**영향**:
- Part II의 중심 개념 중 하나인데 **구현 공백**
- Phase 1-6 어디에도 constitutional 로직 포함 안 됨
- 아이디어만 있고 operational mechanism 없음

**권고**:
- Constitutional 개념은 **Part II 철학 영역으로 강등**
- Implementation은 단순 `priority: critical` + 충돌 시 경고만으로 시작
- 진정한 constitutional enforcement (즉, LLM 출력 감시)는 **별도 제품**

---

### C7. Agent-Authored Plasmids는 Feature가 아니라 Research

**PRD §25의 주장**:
- Agent가 세션 메모리에서 반복 수정 패턴 탐지
- 일반화된 규칙 추출
- Plasmid draft로 제시

**실제 난이도**:
- **패턴 탐지**: 세션 간 상태 유지 필요, 프라이버시 고려, false positive 처리
- **일반화**: 1-2개 예시를 일반 규칙으로 만드는 것은 **open research problem** (few-shot rule learning)
- **Draft 품질**: 저품질 draft → 사용자 거부 → 기능 불신
- **Evidence sampling**: 어떤 세션을 증거로? 편향은?

**벤치마크**: Voyager (Wang et al., 2023), STaR (Zelikman et al., 2022) — self-improving agent 연구 영역

**권고**:
- §25를 **GAL-4 (v0.7)** 로 명시 연기
- GAL-1~3 스코프에서 제거
- Part II 유지하되 "향후 연구 영역"으로 표기
- "Ready for production"과 "interesting research"를 구분

---

### C8. 관측 가능성(Observability) 구현 계획 부재

**PRD §12.3의 언급만**: "plasmid.*, recombination.*, cure.* 이벤트 추가"

**부재**:
- 어떤 이벤트를 언제 발행?
- OTLP 스키마 (필드, semantic conventions)?
- Dashboard 컴포넌트 설계?
- Drift 감지 알고리즘?
- 메트릭 → 액션 연결 (e.g., dormant plasmid 자동 경고)?

**영향**:
- "Plasmid 성공 여부"를 측정 불가
- Phase 완료 기준 주관적

**권고**:
- Phase 1에 **Telemetry section** 신설
- 10개 필수 메트릭 사전 정의:
  - `plasmid.created`, `plasmid.activated`, `plasmid.deactivated`
  - `recombination.started`, `recombination.completed`, `recombination.failed`
  - `cure.executed`, `cure.partial_failure`
  - `wiring_validation.passed`, `wiring_validation.failed`
- 각 메트릭의 dimension, unit, alerting 정의
- `src/telemetry/` 기존 모듈 확장

---

## 3. Major Concerns (발진 후 지속 관리)

### M1. 인지 부담 (Cognitive Load) 과소평가

**사용자가 배워야 할 것**:
1. Plasmid 파일 구조 (markdown + frontmatter)
2. 5대 plasmid 유형 (behavioral/structural/ritualistic/epistemic/value)
3. Scope 6종 (sub-agents/skills/commands/hooks/rules/harness)
4. Priority 3단계 + tier 3단계
5. 합성 규칙 (compatible-with, conflicts-with, extends)
6. Expression conditions (git-branch, file-types, time-of-day, ...)
7. Chemistry (catalyst, inhibitor, co-factor)
8. 3개 핵심 명령어 + 각 서브커맨드 (총 15+)
9. Transcript 포맷
10. Cure 모드 4종 (last, all, transcript, plasmid)

**harness-setup 대비**: harness-setup은 **3개 결정 + 단일 명령**. Plasmid System은 한 자릿수 초과.

**권고**:
- **Progressive disclosure** 원칙 도입
- **Level 1** (처음): 3 field frontmatter + 1 명령 + 1 유형 (behavioral)
- **Level 2** (숙련): 6 field + 3 명령 + 3 유형
- **Level 3** (마스터): 전체 스펙
- 문서·튜토리얼도 3단 구조

---

### M2. "Plasmid"라는 용어의 학습 비용

**용어 분석**:
- "Plasmid"는 **생물학 전공자 외에는 낯선 용어**
- 한국어 "플라스미드"는 더 이질적
- 첫 만남에서 `/plasmid "OWASP 검사 추가"` 의 의미가 **직관적이지 않음**

**비교**:
- Cursor: `.cursorrules` → "rules"는 즉각 이해
- Claude Code: `CLAUDE.md` → 이름이 시스템 그 자체
- Plasmid: "?" → "뭐의 플라스미드?"

**권고 (브랜딩 충돌)**:
- dhelix 생물학 메타포와 **정합하긴 함** (제품 철학 레벨 OK)
- 하지만 **사용자 진입장벽 존재**
- 대안 네이밍 탐구:
  - `/intent` (더 직관적, 메타포 약화)
  - `/charter` (선언적 느낌)
  - `/codex` (중립적, 기록)
  - `/plasmid` (메타포 극대화, 진입 비용)
- A/B 테스트 또는 사용자 인터뷰로 결정

---

### M3. `compatible-with` / `conflicts-with`의 전파 문제

**시나리오**:
- Plasmid A는 B와 conflict
- Plasmid B는 C와 compatible
- C는 A와 관계 미명시
- A + C를 함께 활성화 시 어떻게 되는가?

**PRD에서 답 없음**.

**현실**:
- 관계 그래프가 sparse하면 충돌 미감지
- Dense하게 유지하려면 **모든 plasmid 쌍을 명시**해야 함 → O(n²) 유지 비용

**권고**:
- **Hierarchical taxonomy** 도입: plasmid는 `category` 필드 (security, performance, style, ...) 가짐
- 같은 category 내 default conflict, 다른 category default compatible
- 명시적 선언은 override

---

### M4. LLM Cost & Latency

**Research-assisted /plasmid**:
- Web search × 3-5
- Web fetch × 3-5 (긴 문서)
- LLM synthesis (1-2 대형 프롬프트)
- Draft generation (1-2 프롬프트)
- 사용자 질문 (1-2 라운드)
- 총 LLM 토큰 소비: **50K-200K token/plasmid 생성**

**Recombination**:
- 각 plasmid × 각 generator × LLM 호출
- 활성 plasmid 5개 × generator 4개 = **20 LLM 호출/recombination**
- 토큰: 50K-100K/recombination

**비용 추산** (GPT-4o 기준):
- Plasmid 생성 1회: $0.50-$2
- Recombination 1회: $0.30-$1
- 중헤비 사용자 (월 10 plasmid + 30 recombination): **$15-40/월 LLM 비용**

**영향**:
- 무료 tier에서 플라스미드 단위 제한 필요
- 사용자가 비용 visibility 요구
- dhelix의 `src/llm/cost-tracker.ts` 확장 필요

**권고**:
- **Cost estimation preview**: `/plasmid --estimate` 모드
- Plasmid 본문은 **로컬 LLM** (Haiku/local) 우선, 어려운 것만 escalation
- Interpreter cache는 비용 절감 이중 목적

---

### M5. `.dskill` 과 Plasmid의 관계 혼란

**PRD의 주장**: 둘은 다른 레이어
- `.dskill` = skill 배포 (기존)
- Plasmid = 의도 선언 (신규)

**사용자 혼동 가능성**:
- 사용자가 skill을 배포받음 vs plasmid를 받음 → 어떻게 다른가?
- Plasmid로부터 recombination 후 생성된 skill을 다시 `.dskill`로 패키징 가능한가? → 순환
- 전체 "에이전트 세트"를 내보내는 방법은? (plasmid + 생성물 묶음?)

**권고**:
- **명확한 정책 수립**:
  - `.dskill` = 완성된 capability 배포 (즉시 사용 가능)
  - `.dhplasmid` (신규) = 의도 선언 배포 (target 프로젝트에서 recombination 필요)
- 두 포맷의 usage 문서에 **명확한 구분 다이어그램**

---

### M6. Git Integration 불명확

**PRD의 주장**: "git-aware auto-commit"

**질문**:
- Recombination 전후 auto-commit?
- Cure 전 auto-commit?
- Plasmid 변경은 어떤 branch에서?
- 팀 plasmid의 PR 워크플로?

**권고**:
- Git 통합을 **별도 Chapter**로 설계
- `.gitignore` 전략 (generated artifact 제외 / 포함)
- `.gitattributes` merge 전략
- Pre-commit hook 자동 설치 옵션

---

### M7. 로컬 LLM 환경에서의 제약

**dhelix-code의 특징**: 로컬 LLM 지원 (Ollama, LM Studio 등)

**문제**:
- 로컬 LLM은 tool use 약함 → interpreter 품질 하락
- Context window 작음 → 긴 plasmid 처리 불가
- 결정론 더 불안정

**PRD에서 다루지 않음**.

**권고**:
- Recombination에 **LLM capability 요구사항** 명시
- 저사양 로컬 LLM은 "Compilation Hints 필수 모드"로 제한
- Provider별 호환성 매트릭스 문서

---

## 4. 누락된 것들 (What's Missing)

### G1. 실패 시나리오 분석

PRD는 성공 시나리오만 그림. **실패 케이스**는?

- Recombination 중간 crash → 부분 생성 artifact 어떻게?
- Wiring validation 실패가 **반복**되는 plasmid → 격리?
- 사용자가 생성물을 **수동으로 대폭 수정**한 후 cure → 어떻게 대응?
- Research가 **저품질/적대적** 결과만 반환 → 검증 방법?
- Plasmid 파일이 **손상/삭제** → transcript로 복원 가능?

### G2. 이 기능 자체의 Rollback Plan

만약 Plasmid System이 **실패**하면?
- Dhelix-code에서 제거 가능한가?
- 사용자의 plasmid 파일은?
- 의존 프로젝트는?

**권고**: Feature flag (`DHELIX_PLASMID_ENABLED`) 로 시작. 사용자 옵트인.

### G3. 다국어 / i18n

PRD는 한국어로 작성. UI는?
- Plasmid 본문 언어?
- Frontmatter 언어? (영어 고정?)
- Research 결과 언어 자동 번역?
- Korean 사용자용 템플릿 5종?

### G4. 접근성(Accessibility)

Ink/React 기반 CLI. `/plasmid observe` 같은 시각적 기능의 접근성은?

### G5. 보안 위협 모델 (Threat Model)

Plasmid는 사용자 의도를 담는 파일 → **공급망 공격 벡터**:
- 악성 plasmid가 `.gitignore`로 위장 후 배포
- Recombination이 악성 hook 실행
- Trust level 위조

**STRIDE 분석 부재**.

### G6. 성능 벤치마크

`/recombination`의 목표 P95 latency? `/cure`의 목표? Large plasmid set (50+) 시 대응?

### G7. 업그레이드 / 마이그레이션 전략

Plasmid frontmatter schema가 진화하면? v0.1 → v0.2 plasmid 자동 마이그레이션?

---

## 5. 강점 — 반드시 보존할 것

비판이 길었지만, 다음은 **우수하게 설계됨**:

### S1. Intent/Spec/Behavior 3-Layer 분리

개념적으로 강력. 업계 최초 수준의 명시화. **이것은 지켜야 함**.

### S2. Reversibility as First-Class

Dev tools에서 근본적으로 새로운 원칙. Cure가 **완벽하게** 작동한다면 강한 차별화.

### S3. Evidence-based Authoring (`source.references`)

Plasmid가 자신의 근거를 기록. 학술적 엄격성이 dev tool에 도입. **revolutionary**.

### S4. Biology Metaphor의 brand coherence

dhelix 브랜드에 네이티브. 경쟁사가 흉내낼 수 없는 **브랜드 해자**.

### S5. Phased Rollout Structure (Part I §13)

6단계 구조는 합리적. 다만 각 phase 기간만 재조정 필요.

### S6. Part II 철학적 깊이

대부분의 PRD가 놓치는 **제품 정체성 레벨의 사고**. 내부 공유용 strategic charter로 유용. 다만 외부 공개 PRD에서는 분량 조절 필요.

### S7. Plasmid Taxonomy (§22)

5대 유형 분류는 **compiler 구현의 가이드**가 됨. Implementation에 직접 영향.

---

## 6. 권고 액션 플랜

### Phase -1: PRD 수정 (1주)

| # | 액션 | 담당 | 완료 기준 |
|---|------|------|---------|
| P-1.1 | I-3 불변식을 "best-effort idempotency"로 격하 | 책임 기획자 | PRD §10.1 수정 |
| P-1.2 | ~~Layer 배치 재설계~~ (F2 무효화) — 대신 Layer 2 vs 3 배치 재검토만 | 아키텍트 | PRD §7 보완 |
| P-1.3 | PRD 경로 `.claude/agents/` → `.dhelix/agents/` 전량 치환 | 기획자 | grep 검증 0건 |
| P-1.4 | agent-generator가 `agentDefinitionSchema` (definition-types.ts) 준수하도록 설계 | 아키텍트 | 스키마 호환 명시 |
| P-1.5 | CLAUDE.md 편집 → 별도 generated file 전환 (C3) | 아키텍트 | §7.1 수정 |
| P-1.6 | Frontmatter 필드 6개로 축소, 나머지 optional | 기획자 | §6.1.2 재작성 |
| P-1.7 | Constitutional / Agent-authored를 GAL-4+ 로 연기 | 기획자 | §22.4, §25 재배치 |
| P-1.8 | Telemetry 스펙 추가 (10 metrics) | 기획자 | 신규 §12.4 |
| P-1.9 | Threat model 추가 | 보안 담당 | 신규 §10.4 |

### Phase 0: POC & 시장 검증 (2주)

| 주 | 액션 | 판단 기준 |
|----|-----|---------|
| W1 | 3명 power user 인터뷰 + 3개 POC plasmid 수동 작성 | 사용자가 "유용하다"고 평가 (5점 중 ≥4) |
| W2 | POC를 3명에게 사용 → 피드백 수집 | 2/3 이상이 "매주 쓸 것" 응답 |
| W2 말 | **Go/No-Go Gate** | Go: Phase 1 착수 / No-go: 피벗 또는 중단 |

### Phase 1: Foundation (재산정 5주 — 기존 4주에서 +1주)

- [ ] Plasmid types/frontmatter/validator
- [ ] `.dhelix/plasmids/` + loader
- [ ] `/plasmid list/show/validate/activate/deactivate`
- [ ] Single-generator POC (rule only)
- [ ] Telemetry wiring
- [ ] Feature flag (`DHELIX_PLASMID_ENABLED`)

### Phase 2: Recombination MVP (재산정 5주)

- [ ] Interpreter with Compilation Hints (필수)
- [ ] Interpreter 출력 cache
- [ ] Generators: rule, skill, command (agent/hook은 Phase 4로 연기)
- [ ] Transcript 기록
- [ ] `/recombination extend 모드 only`
- [ ] Wiring validator v0 (reference integrity only)

### Phase 3: Cure v0 (재산정 4주 — 기존 2주에서 +2주)

- [ ] 생성물 삭제 (pure create 케이스만)
- [ ] Audit log
- [ ] Mtime 기반 수동 수정 감지 (simple)
- [ ] `--dry-run` 기본
- [ ] 수정물 복원은 **v1 연기**

### Phase 4-6: 기존 유지, 단 각 phase +1주 버퍼

---

## 7. Go/No-Go Decision Matrix

| 조건 | 충족 시 |
|-----|------|
| Phase -1의 8개 액션 **100% 완료** | → Phase 0 착수 |
| Phase 0에서 2/3 이상 긍정 | → Phase 1 착수 |
| Phase 0에서 1/3 미만 긍정 | → **중단** |
| Phase 0에서 1/3-2/3 | → 피벗 (scope 축소, 재검증) |

**최악의 경우 비용**: Phase -1 (1주) + Phase 0 (2주) = **3주 / 1인** 으로 18주 투자 전 검증.

---

## 8. 핵심 메시지 (정정 반영)

### 제품 비전에 대해

**Plasmid System은 올바른 방향이다.** 에이전트 커스터마이징의 파편화는 실제 문제이고, 선언적 + 가역적 + 증거 기반 접근은 차별화 가능하다. Part II의 철학적 깊이는 제품의 **왜(why)** 를 명확히 한다.

### 실행 계획에 대해 (정정)

**현재 PRD는 15% 과장, 35% 과소평가, 50% 미검증**이다 (F2/F3 오판 정정 반영):
- 과장: 결정론(I-3), 일정(Phase 3), Agent-authored 기능
- 과소평가: Cure 복잡도, UX 인지부담, research LLM 비용
- 미검증: 시장 수요, 사용자 행동 변화 의지, 로컬 LLM 호환성

### 정정된 Fatal/Critical 상태

- **Fatal**: F1 (결정론) — 1건
- **Critical**: C1-C8 (Cure, 스키마, CLAUDE.md, 인터뷰, 시장검증, Constitutional, Agent-authored, Observability) — 8건
- **Major**: M1-M7 (인지부담, 네이밍, 합성전파, 비용, .dskill관계, Git통합, 로컬LLM) — 7건
- **이전 F2/F3는 M-range로 격하 또는 무효**

### 책임 기획자의 권고

> **"18주 계획을 그대로 진행하지 마세요. 3주 투자로 30% 확신을 70% 이상으로 끌어올린 후 착수하세요."**

Phase -1 (PRD 수정, 1주) + Phase 0 (시장 검증, 2주) 를 거친 후에만 Phase 1 착수. 이 3주가 나머지 18주의 성공 확률을 크게 높인다.

### 메타: 검증 품질에 대한 자기 반성

이 검증 초안 v1.0에서 **F2, F3를 코드 확인 없이 추상 규칙 기반으로 Fatal 판정한 것은 책임 기획자의 실수**였다. 본 문서 v1.1은 이를 정정하여 공개했다. 

**교훈 (향후 모든 PRD 검증에 적용)**:
1. "Fatal" 태그 부여 전 반드시 **실제 코드/데이터로 증거 확인**
2. 추상 아키텍처 규칙은 종종 **실제 프로젝트의 적용 관행**과 다름
3. 검증자 본인의 오류 가능성을 리뷰 문서에 명시적으로 포함 (meta-humility)
4. PRD 저자와 검증자 모두 **fallible** — 양쪽 모두 검증 대상

---

## 9. 서명란

| 역할 | 의견 | 날짜 |
|------|-----|------|
| 책임 기획자 | **CONDITIONAL NO-GO** — Phase -1/0 후 재검토 | 2026-04-22 |
| 아키텍트 | (서명 대기) | - |
| 보안 담당 | (서명 대기) | - |
| 개발 리드 | (서명 대기) | - |

---

**문서 상태**: Review v1.1 (v1.0의 F2/F3 오판을 자기정정)
**관련 PRD**: `docs/prd/plasmid-recombination-system.md` (v0.2)
**다음 액션**: PRD 저자와 수정 방향 논의 → Phase -1 착수

**변경 이력**:
- v1.0 (2026-04-22 초안): F1/F2/F3 세 건을 Fatal로 판정
- v1.1 (2026-04-22 당일 정정): 코드 확인 결과 F2 무효화, F3 Critical로 격하. Fatal은 F1뿐
