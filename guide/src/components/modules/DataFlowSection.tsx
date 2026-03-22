"use client";

import { SectionHeader } from "../SectionHeader";
import { MermaidDiagram } from "../MermaidDiagram";
import { RevealOnScroll } from "../RevealOnScroll";

const dataFlowChart = `graph TD
    USER["User Input<br/><small>텍스트 또는 슬래시 명령</small>"] --> SYS_PROMPT["System Prompt Builder<br/><small>모듈식 섹션 조립 + 토큰 예산 적용</small>"]
    SYS_PROMPT --> CTX_MGR["Context Manager<br/><small>토큰 사용률 확인 + 필요시 압축</small>"]
    CTX_MGR --> GUARD_IN["Input Guardrails<br/><small>프롬프트 인젝션 + 비밀 키 탐지</small>"]
    GUARD_IN --> DUAL["Dual-Model Router<br/><small>작업 페이즈에 따라 모델 선택</small>"]
    DUAL --> LLM["LLM Client<br/><small>OpenAI 호환 API 스트리밍 요청</small>"]
    LLM --> PARSE["응답 파싱<br/><small>텍스트 응답 vs 도구 호출 분리</small>"]
    PARSE --> PERM["Permission Manager<br/><small>5단계 결정 트리로 도구 허용 여부 판단</small>"]
    PERM -->|"승인"| CKPT["Checkpoint Manager<br/><small>파일 수정 전 SHA-256 스냅샷 저장</small>"]
    PERM -->|"거부"| FEEDBACK["거부 사유 피드백"]
    CKPT --> GROUP["Tool Grouping<br/><small>병렬/직렬 실행 그룹 분류</small>"]
    GROUP --> EXEC["Tool Executor<br/><small>Zod 검증 → 실행 → 결과 수집</small>"]
    EXEC --> OBS["Observation Masking<br/><small>읽기 전용 도구 출력 플레이스홀더 대체</small>"]
    OBS --> COLD["Cold Storage<br/><small>큰 도구 출력을 디스크에 영구 저장</small>"]
    COLD --> CB["Circuit Breaker<br/><small>무변경/에러 반복 감지</small>"]
    CB -->|"OK"| CTX_MGR
    CB -->|"Trip"| RECOVER["Recovery Executor<br/><small>에러 유형별 복구 전략</small>"]
    RECOVER -->|"성공"| CTX_MGR
    RECOVER -->|"실패"| DONE["루프 종료<br/><small>세션 저장 + 다음 입력 대기</small>"]
    PARSE -->|"도구 없음"| RESPONSE["최종 응답<br/><small>최종 텍스트를 사용자에게 표시</small>"]
    FEEDBACK --> LLM
    style USER fill:#dbeafe,stroke:#3b82f6,color:#1e293b
    style LLM fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
    style EXEC fill:#dcfce7,stroke:#10b981,color:#1e293b
    style PERM fill:#fef3c7,stroke:#f59e0b,color:#1e293b
    style RESPONSE fill:#dcfce7,stroke:#10b981,color:#1e293b
    style DONE fill:#fee2e2,stroke:#ef4444,color:#1e293b`;

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
    <section
      id="dataflow"
      className="py-16 bg-amber-50/50"
      style={{ paddingTop: "64px", paddingBottom: "64px" }}
    >
      <div className="center-container">
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <SectionHeader
              label="SUMMARY"
              labelColor="blue"
              title="전체 데이터 흐름 요약"
              description="사용자 입력부터 최종 응답까지, 모든 모듈이 어떻게 협력하는지 한눈에 봅니다."
            />
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <MermaidDiagram chart={dataFlowChart} title="End-to-End 데이터 흐름" titleColor="blue" />
        </RevealOnScroll>

        <RevealOnScroll>
          <h3
            className="text-lg font-semibold text-gray-900 mb-4"
            style={{ marginTop: "32px", marginBottom: "16px" }}
          >
            핵심 아키텍처 결정 10가지
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ gap: "20px" }}>
            {[0, 1].map((col) => (
              <div key={col} className="flex flex-col gap-4 relative pl-7">
                <div className="absolute left-[11px] top-6 bottom-6 w-0.5 rounded-full bg-gradient-to-b from-blue-600 via-violet-600 to-emerald-600" />
                {decisions.slice(col * 5, col * 5 + 5).map(([title, desc], i) => (
                  <div
                    key={i}
                    className="relative border border-[#e2e8f0] rounded-lg p-5 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all"
                    style={{ padding: "20px" }}
                  >
                    <div className="absolute -left-7 top-5 w-[22px] h-[22px] rounded-full bg-blue-600 text-white text-[10px] font-extrabold flex items-center justify-center shadow-[0_0_12px_rgba(37,99,235,0.3)]">
                      {col * 5 + i + 1}
                    </div>
                    <h4 className="text-sm font-bold mb-1">{title}</h4>
                    <p className="text-[12.5px] text-gray-600">{desc}</p>
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
