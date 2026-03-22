"use client";

import { SectionHeader } from "../SectionHeader";
import { MermaidDiagram } from "../MermaidDiagram";
import { RevealOnScroll } from "../RevealOnScroll";

const dataFlowChart = `graph TD
    USER["User Input"] --> SYS_PROMPT["System Prompt Builder"]
    SYS_PROMPT --> CTX_MGR["Context Manager"]
    CTX_MGR --> GUARD_IN["Input Guardrails"]
    GUARD_IN --> DUAL["Dual-Model Router"]
    DUAL --> LLM["LLM Client"]
    LLM --> PARSE["응답 파싱"]
    PARSE --> PERM["Permission Manager"]
    PERM -->|"승인"| CKPT["Checkpoint Manager"]
    PERM -->|"거부"| FEEDBACK["거부 사유 피드백"]
    CKPT --> GROUP["Tool Grouping"]
    GROUP --> EXEC["Tool Executor"]
    EXEC --> OBS["Observation Masking"]
    OBS --> COLD["Cold Storage"]
    COLD --> CB["Circuit Breaker"]
    CB -->|"OK"| CTX_MGR
    CB -->|"Trip"| RECOVER["Recovery Executor"]
    RECOVER -->|"성공"| CTX_MGR
    RECOVER -->|"실패"| DONE["루프 종료"]
    PARSE -->|"도구 없음"| RESPONSE["최종 응답"]
    FEEDBACK --> LLM
    style USER fill:#1e2a4a,stroke:#3b82f6,color:#f1f5f9
    style LLM fill:#2a1e4a,stroke:#8b5cf6,color:#f1f5f9
    style EXEC fill:#1e3a2a,stroke:#10b981,color:#f1f5f9
    style PERM fill:#3a2e1e,stroke:#f59e0b,color:#f1f5f9
    style RESPONSE fill:#1e3a2a,stroke:#10b981,color:#f1f5f9
    style DONE fill:#3a1e1e,stroke:#ef4444,color:#f1f5f9`;

const decisions = [
  ["단방향 레이어 의존성", "CLI → Core → Infra → Leaf. 절대 역방향 import 금지."],
  ["AbortSignal 패턴", "모든 장시간 작업은 AbortController로 취소 가능."],
  ["Immutable State", "readonly 프로퍼티 + spread copy. 상태 변경 추적 용이."],
  ["3-Layer 토큰 관리", "Microcompaction → Auto-compaction → Rehydration."],
  ["Dual Model 패턴", "Architect(추론) vs Editor(실행) 분리로 비용+품질 최적화."],
  ["Deferred Tool Loading", "MCP 도구 스키마를 On-demand 로딩. 토큰 최소화."],
  ["Deny-First 권한", "deny 규칙 최우선. 보안 사고 방지 기본 원칙."],
  ["에러 유형별 복구", "에러를 분류, 각 유형에 최적화된 전략 자동 실행."],
  ["Circuit Breaker", "무한 루프 방지. 무변경/에러 반복 감지 → 자동 중단."],
  ["Graceful Degradation", "잘못된 설정/패턴은 조용히 건너뜀. 전체를 멈추지 않음."],
];

export function DataFlowSection() {
  return (
    <section id="dataflow" className="py-20 bg-bg-secondary">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
        <RevealOnScroll>
          <SectionHeader
            label="SUMMARY"
            labelColor="blue"
            title="전체 데이터 흐름 요약"
            description="사용자 입력부터 최종 응답까지, 모든 모듈이 어떻게 협력하는지 한눈에 봅니다."
          />
        </RevealOnScroll>

        <RevealOnScroll>
          <MermaidDiagram chart={dataFlowChart} title="End-to-End 데이터 흐름" titleColor="blue" />
        </RevealOnScroll>

        <RevealOnScroll>
          <h3 className="text-lg font-bold mb-4">핵심 아키텍처 결정 10가지</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[0, 1].map((col) => (
              <div key={col} className="flex flex-col gap-3 relative pl-7">
                <div className="absolute left-[11px] top-6 bottom-6 w-0.5 rounded-full bg-gradient-to-b from-accent-blue via-accent-purple to-accent-green" />
                {decisions.slice(col * 5, col * 5 + 5).map(([title, desc], i) => (
                  <div key={i} className="relative bg-bg-card border border-border rounded-[10px] p-[18px] hover:border-[rgba(59,130,246,0.3)] transition-all">
                    <div className="absolute -left-7 top-[18px] w-[22px] h-[22px] rounded-full bg-accent-blue text-white text-[10px] font-extrabold flex items-center justify-center">
                      {col * 5 + i + 1}
                    </div>
                    <h4 className="text-sm font-bold mb-1">{title}</h4>
                    <p className="text-[12.5px] text-text-secondary">{desc}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
