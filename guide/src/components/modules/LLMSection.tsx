"use client";

import { SectionHeader } from "../SectionHeader";
import { FilePath } from "../FilePath";
import { MermaidDiagram } from "../MermaidDiagram";
import { ImplDirection } from "../ImplDirection";
import { RevealOnScroll } from "../RevealOnScroll";

const llmPipelineChart = `graph LR
    REQ["요청 생성"] --> DETECT{"모델 감지"}
    DETECT -->|"Codex"| RESP_API["Responses API"]
    DETECT -->|"일반"| CHAT_API["Chat Completions"]
    RESP_API --> TRANSFORM["메시지 변환"]
    CHAT_API --> TRANSFORM
    TRANSFORM --> TOOLS_FMT["도구 포맷팅"]
    TOOLS_FMT --> URL_NORM["URL 정규화"]
    URL_NORM --> HTTP["HTTP 요청 120s"]
    HTTP --> STREAM{"스트리밍?"}
    STREAM -->|"Yes"| SSE["SSE 파싱"]
    STREAM -->|"No"| BATCH["일괄 응답"]
    SSE --> RETRY_CHECK{"에러?"}
    BATCH --> RETRY_CHECK
    RETRY_CHECK -->|"500/502/503"| RETRY["재시도 1s-2s-4s 최대3회"]
    RETRY_CHECK -->|"429"| FAIL["즉시 실패"]
    RETRY_CHECK -->|"성공"| DONE["응답 반환"]
    RETRY --> HTTP
    style REQ fill:#1e2a4a,stroke:#3b82f6,color:#f1f5f9
    style DONE fill:#1e3a2a,stroke:#10b981,color:#f1f5f9
    style FAIL fill:#3a1e1e,stroke:#ef4444,color:#f1f5f9`;

const dualModelChart = `graph TD
    MSG["사용자 메시지"] --> DETECT["detectPhase()"]
    DETECT --> KW_CHECK{"키워드 감지"}
    KW_CHECK -->|"plan, 설계, design, RFC"| PLAN["Plan Phase"]
    KW_CHECK -->|"review, 리뷰, analyze"| REVIEW["Review Phase"]
    KW_CHECK -->|"기타"| EXECUTE["Execute Phase"]
    PLAN --> ARCH["Architect Model 고추론"]
    REVIEW --> ARCH
    EXECUTE --> EDIT["Editor Model 빠른응답"]
    style PLAN fill:#2a1e4a,stroke:#8b5cf6,color:#f1f5f9
    style REVIEW fill:#2a1e4a,stroke:#8b5cf6,color:#f1f5f9
    style EXECUTE fill:#1e3a2a,stroke:#10b981,color:#f1f5f9`;

export function LLMSection() {
  return (
    <section id="llm" className="py-20">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
        <RevealOnScroll>
          <SectionHeader
            label="MODULE 03"
            labelColor="blue"
            title="LLM Client + Dual-Model Router"
            description="OpenAI 호환 API 클라이언트와 작업 단계별 모델 자동 전환 라우터입니다."
          />
        </RevealOnScroll>

        <RevealOnScroll>
          <div className="flex gap-2 flex-wrap mb-5">
            <FilePath path="src/llm/client.ts" />
            <FilePath path="src/llm/dual-model-router.ts" />
            <FilePath path="src/llm/model-capabilities.ts" />
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <MermaidDiagram chart={llmPipelineChart} title="LLM 요청 처리 파이프라인" titleColor="blue" />
        </RevealOnScroll>

        <RevealOnScroll>
          <MermaidDiagram chart={dualModelChart} title="Dual-Model Router — 단계별 모델 전환" titleColor="purple" />
        </RevealOnScroll>

        <RevealOnScroll>
          <h3 className="text-lg font-bold mb-4">모델 설정 우선순위</h3>
          <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-3 px-5 text-left text-[11px] font-bold uppercase tracking-wider text-text-muted bg-[rgba(255,255,255,0.02)] border-b border-border">우선순위</th>
                  <th className="p-3 px-5 text-left text-[11px] font-bold uppercase tracking-wider text-text-muted bg-[rgba(255,255,255,0.02)] border-b border-border">설정 소스</th>
                  <th className="p-3 px-5 text-left text-[11px] font-bold uppercase tracking-wider text-text-muted bg-[rgba(255,255,255,0.02)] border-b border-border">설명</th>
                </tr>
              </thead>
              <tbody className="text-[13px]">
                {[
                  { p: "1 (최고)", color: "text-accent-red", src: "LOCAL_API_BASE_URL + LOCAL_MODEL", desc: "환경변수 로컬 모델. 무조건 최우선" },
                  { p: "2", color: "text-accent-orange", src: "CLI --model 플래그", desc: "실행 시 명시적 지정" },
                  { p: "3", color: "text-accent-orange", src: "/model 슬래시 명령", desc: "세션 중 모델 변경" },
                  { p: "4", color: "text-accent-blue", src: "settings.json → model", desc: "프로젝트/사용자 설정" },
                  { p: "5", color: "text-text-muted", src: "defaults.ts", desc: "하드코딩 기본값" },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-[rgba(59,130,246,0.03)] border-b border-[rgba(255,255,255,0.03)]">
                    <td className={`p-3 px-5 font-extrabold ${row.color}`}>{row.p}</td>
                    <td className="p-3 px-5 font-mono text-accent-cyan font-semibold">{row.src}</td>
                    <td className="p-3 px-5">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <ImplDirection items={[
            "<strong>새 LLM 제공자 추가</strong>: LLMProvider 인터페이스 구현 → model-capabilities.ts에 capabilities 등록",
            "<strong>Dual Model 확장</strong>: TaskPhase에 'debug' | 'test' 추가 → 디버깅 전문 모델 라우팅",
            "<strong>스트리밍 최적화</strong>: 현재 SSE → WebSocket 지원 추가로 양방향 통신 가능",
            "<strong>비용 최적화</strong>: 간단한 질문은 자동으로 저비용 모델 → 복잡한 작업만 고비용 모델",
          ]} />
        </RevealOnScroll>
      </div>
    </section>
  );
}
