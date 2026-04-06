"use client";

import { SectionHeader } from "../SectionHeader";
import { FilePath } from "../FilePath";
import { MermaidDiagram } from "../MermaidDiagram";
import { Callout } from "../Callout";
import { ImplDirection } from "../ImplDirection";
import { RevealOnScroll } from "../RevealOnScroll";

const subagentChart = `graph TD
    MAIN["Main Agent<br/><small>사용자와 직접 대화하는 루프</small>"] -->|"agent tool"| SPAWNER["Subagent Spawner<br/><small>서브에이전트 생성 및 설정 담당</small>"]
    SPAWNER --> TYPE{"에이전트 타입<br/><small>explore/plan/general/custom</small>"}
    TYPE -->|"explore"| EXPLORE["Explore Agent<br/><small>읽기 전용 도구만 코드베이스 탐색</small>"]
    TYPE -->|"plan"| PLAN["Plan Agent<br/><small>읽기 전용 구현 계획 수립</small>"]
    TYPE -->|"general"| GENERAL["General Agent<br/><small>모든 도구 사용 가능</small>"]
    TYPE -->|"custom"| CUSTOM["Custom Agent<br/><small>사용자 정의 도구 세트</small>"]
    EXPLORE --> TOOLS_RO["읽기 전용 도구<br/><small>Read Grep Glob만 허용</small>"]
    PLAN --> TOOLS_RO
    GENERAL --> TOOLS_ALL["전체 도구<br/><small>파일 수정 포함 전체 도구</small>"]
    CUSTOM --> TOOLS_CUSTOM["커스텀 도구<br/><small>명시적으로 지정된 도구만</small>"]
    subgraph ISOLATION["격리 옵션"]
        direction LR
        SAME["Same FS<br/><small>메인과 같은 작업 디렉토리</small>"]
        WORKTREE["Git Worktree<br/><small>격리된 Git worktree에서 실행</small>"]
    end
    TOOLS_ALL --> ISOLATION
    TOOLS_RO --> SAME
    TOOLS_CUSTOM --> ISOLATION
    subgraph EXEC["실행"]
        direction TB
        NEW_LOOP["독립 Agent Loop 생성<br/><small>별도의 에이전트 루프 인스턴스</small>"]
        NEW_LOOP --> RESULT["결과 반환<br/><small>메인 에이전트에 텍스트 결과 전달</small>"]
    end
    SAME --> NEW_LOOP
    WORKTREE --> NEW_LOOP
    style MAIN fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
    style ISOLATION fill:#dbeafe,stroke:#3b82f6,color:#1e293b
    style EXEC fill:#dcfce7,stroke:#10b981,color:#1e293b`;

const teamChart = `graph TD
    USER["사용자 /team 명령<br/><small>복잡한 작업 요청 입력</small>"] --> TM["Team Manager<br/><small>작업 분석 및 워커 배분</small>"]
    TM --> ANALYZE["파일 충돌 분석<br/><small>파일 충돌 검사 + 의존성 분석</small>"]
    ANALYZE --> SPLIT["태스크 분배<br/><small>독립 실행 가능한 단위로 분리</small>"]
    SPLIT --> W1["Worker 1 Worktree A<br/><small>독립 서브에이전트 인스턴스</small>"]
    SPLIT --> W2["Worker 2 Worktree B<br/><small>독립 서브에이전트 인스턴스</small>"]
    SPLIT --> W3["Worker 3 Worktree C<br/><small>독립 서브에이전트 인스턴스</small>"]
    W1 & W2 & W3 --> SHARED["Shared State<br/><small>워커 간 진행 상황 공유</small>"]
    W1 --> R1["결과 1<br/><small>각 워커의 실행 결과</small>"]
    W2 --> R2["결과 2<br/><small>각 워커의 실행 결과</small>"]
    W3 --> R3["결과 3<br/><small>각 워커의 실행 결과</small>"]
    R1 & R2 & R3 --> MERGE_R["결과 병합<br/><small>모든 워커 결과를 통합</small>"]
    MERGE_R --> DONE["최종 결과<br/><small>최종 결과를 사용자에게 전달</small>"]
    style TM fill:#dcfce7,stroke:#10b981,color:#1e293b
    style SHARED fill:#fef3c7,stroke:#f59e0b,color:#1e293b
    style DONE fill:#dcfce7,stroke:#10b981,color:#1e293b`;

export function SubagentSection() {
  return (
    <section
      id="subagent"
      className="py-16 bg-violet-50/50"
      style={{ paddingTop: "64px", paddingBottom: "64px" }}
    >
      <div className="center-container">
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <SectionHeader
              label="MODULE 09"
              labelColor="purple"
              title="Subagent & Team — 작업 분산 시스템"
              description="복잡한 작업을 하위 에이전트에게 위임하고, 팀 단위로 병렬 실행하는 오케스트레이션입니다."
            />
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <FilePath path="src/core/subagent-spawner.ts" />
        </RevealOnScroll>

        <RevealOnScroll>
          <MermaidDiagram
            chart={subagentChart}
            title="서브에이전트 스폰 & 실행 흐름"
            titleColor="purple"
          />
        </RevealOnScroll>

        <RevealOnScroll>
          <MermaidDiagram
            chart={teamChart}
            title="Team 시스템 — 병렬 워커 오케스트레이션"
            titleColor="green"
          />
        </RevealOnScroll>

        <RevealOnScroll>
          <h3
            className="text-lg font-semibold text-gray-900 mb-4"
            style={{ marginTop: "32px", marginBottom: "16px" }}
          >
            핵심 설계 원칙
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" style={{ gap: "20px" }}>
            <Callout type="warn" icon="⚠️">
              <strong>컨텍스트 격리:</strong> 서브에이전트는 메인 에이전트의 컨텍스트 윈도우를
              공유하지 않습니다. 완전히 독립적인 Agent Loop를 생성합니다.
            </Callout>
            <Callout type="info" icon="💡">
              <strong>Worktree 격리:</strong> Git Worktree를 사용하면 서브에이전트가 독립 브랜치에서
              작업합니다. 파일 충돌 없이 병렬 수정이 가능합니다.
            </Callout>
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <Callout type="tip" icon="🔧">
            <strong>Custom Agent 정의:</strong>{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800">
              .dhelix/agents/*.md
            </code>{" "}
            파일에 마크다운으로 에이전트를 정의합니다. 프론트매터로 이름, 도구 제한, 모델 지정 가능.
          </Callout>
        </RevealOnScroll>

        <RevealOnScroll>
          <ImplDirection
            items={[
              "<strong>에이전트 간 통신</strong>: 현재 결과 반환만 가능 → 메시지 패싱으로 실시간 협업",
              "<strong>워커 수 자동 조정</strong>: CPU 코어 수, 작업 복잡도 기반 자동 워커 수 결정",
              "<strong>에이전트 마켓플레이스</strong>: 커뮤니티에서 에이전트 정의 공유/다운로드",
              "<strong>태스크 우선순위</strong>: 의존 관계 분석 → 크리티컬 패스 우선 실행",
            ]}
          />
        </RevealOnScroll>
      </div>
    </section>
  );
}
