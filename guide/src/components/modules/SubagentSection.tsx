"use client";

import { SectionHeader } from "../SectionHeader";
import { FilePath } from "../FilePath";
import { MermaidDiagram } from "../MermaidDiagram";
import { Callout } from "../Callout";
import { ImplDirection } from "../ImplDirection";
import { RevealOnScroll } from "../RevealOnScroll";

const subagentChart = `graph TD
    MAIN["Main Agent"] -->|"agent tool"| SPAWNER["Subagent Spawner"]
    SPAWNER --> TYPE{"에이전트 타입"}
    TYPE -->|"explore"| EXPLORE["Explore Agent 읽기 전용"]
    TYPE -->|"plan"| PLAN["Plan Agent 읽기 전용"]
    TYPE -->|"general"| GENERAL["General Agent 전체 도구"]
    TYPE -->|"custom"| CUSTOM["Custom Agent 커스텀"]
    EXPLORE --> TOOLS_RO["읽기 전용 도구"]
    PLAN --> TOOLS_RO
    GENERAL --> TOOLS_ALL["전체 도구"]
    CUSTOM --> TOOLS_CUSTOM["정의에 따라 결정"]
    subgraph ISOLATION["격리 옵션"]
        direction LR
        SAME["Same FS"]
        WORKTREE["Git Worktree"]
    end
    TOOLS_ALL --> ISOLATION
    TOOLS_RO --> SAME
    TOOLS_CUSTOM --> ISOLATION
    subgraph EXEC["실행"]
        direction TB
        NEW_LOOP["독립 Agent Loop 생성"]
        NEW_LOOP --> RESULT["결과 반환"]
    end
    SAME --> NEW_LOOP
    WORKTREE --> NEW_LOOP
    style MAIN fill:#2a1e4a,stroke:#8b5cf6,color:#f1f5f9
    style ISOLATION fill:#1e2a4a,stroke:#3b82f6,color:#f1f5f9
    style EXEC fill:#1e3a2a,stroke:#10b981,color:#f1f5f9`;

const teamChart = `graph TD
    USER["사용자 /team 명령"] --> TM["Team Manager"]
    TM --> ANALYZE["파일 충돌 분석"]
    ANALYZE --> SPLIT["태스크 분배"]
    SPLIT --> W1["Worker 1 Worktree A"]
    SPLIT --> W2["Worker 2 Worktree B"]
    SPLIT --> W3["Worker 3 Worktree C"]
    W1 & W2 & W3 --> SHARED["Shared State"]
    W1 --> R1["결과 1"]
    W2 --> R2["결과 2"]
    W3 --> R3["결과 3"]
    R1 & R2 & R3 --> MERGE_R["결과 병합"]
    MERGE_R --> DONE["최종 결과"]
    style TM fill:#1e3a2a,stroke:#10b981,color:#f1f5f9
    style SHARED fill:#3a2e1e,stroke:#f59e0b,color:#f1f5f9
    style DONE fill:#1e3a2a,stroke:#10b981,color:#f1f5f9`;

export function SubagentSection() {
  return (
    <section id="subagent" className="py-20">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
        <RevealOnScroll>
          <SectionHeader
            label="MODULE 09"
            labelColor="purple"
            title="Subagent & Team — 작업 분산 시스템"
            description="복잡한 작업을 하위 에이전트에게 위임하고, 팀 단위로 병렬 실행하는 오케스트레이션입니다."
          />
        </RevealOnScroll>

        <RevealOnScroll><FilePath path="src/core/subagent-spawner.ts" /></RevealOnScroll>

        <RevealOnScroll>
          <MermaidDiagram chart={subagentChart} title="서브에이전트 스폰 & 실행 흐름" titleColor="purple" />
        </RevealOnScroll>

        <RevealOnScroll>
          <MermaidDiagram chart={teamChart} title="Team 시스템 — 병렬 워커 오케스트레이션" titleColor="green" />
        </RevealOnScroll>

        <RevealOnScroll>
          <h3 className="text-lg font-bold mb-4">핵심 설계 원칙</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Callout type="warn" icon="⚠️">
              <strong>컨텍스트 격리:</strong> 서브에이전트는 메인 에이전트의 컨텍스트 윈도우를 공유하지 않습니다. 완전히 독립적인 Agent Loop를 생성합니다.
            </Callout>
            <Callout type="info" icon="💡">
              <strong>Worktree 격리:</strong> Git Worktree를 사용하면 서브에이전트가 독립 브랜치에서 작업합니다. 파일 충돌 없이 병렬 수정이 가능합니다.
            </Callout>
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <Callout type="tip" icon="🔧">
            <strong>Custom Agent 정의:</strong>{" "}
            <code className="bg-[rgba(255,255,255,0.05)] px-1.5 py-0.5 rounded text-xs">.dbcode/agents/*.md</code> 파일에 마크다운으로 에이전트를 정의합니다.
            프론트매터로 이름, 도구 제한, 모델 지정 가능.
          </Callout>
        </RevealOnScroll>

        <RevealOnScroll>
          <ImplDirection items={[
            "<strong>에이전트 간 통신</strong>: 현재 결과 반환만 가능 → 메시지 패싱으로 실시간 협업",
            "<strong>워커 수 자동 조정</strong>: CPU 코어 수, 작업 복잡도 기반 자동 워커 수 결정",
            "<strong>에이전트 마켓플레이스</strong>: 커뮤니티에서 에이전트 정의 공유/다운로드",
            "<strong>태스크 우선순위</strong>: 의존 관계 분석 → 크리티컬 패스 우선 실행",
          ]} />
        </RevealOnScroll>
      </div>
    </section>
  );
}
