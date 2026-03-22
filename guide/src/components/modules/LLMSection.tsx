"use client";

import { SectionHeader } from "../SectionHeader";
import { FilePath } from "../FilePath";
import { MermaidDiagram } from "../MermaidDiagram";
import { ImplDirection } from "../ImplDirection";
import { RevealOnScroll } from "../RevealOnScroll";

const llmPipelineChart = `graph TD
    REQ["요청 생성<br/><small>ChatRequest 객체 조립</small>"] --> DETECT{"모델 감지<br/><small>isResponsesApiModel 확인</small>"}
    DETECT -->|"Codex"| RESP_API["Responses API<br/><small>Codex 모델 전용 API 포맷</small>"]
    DETECT -->|"일반"| CHAT_API["Chat Completions<br/><small>일반 OpenAI 호환 API 포맷</small>"]
    RESP_API --> TRANSFORM["메시지 변환 + 도구 포맷팅<br/><small>내부 메시지 → API 형식 변환</small>"]
    CHAT_API --> TRANSFORM
    TRANSFORM --> URL_NORM["URL 정규화<br/><small>Azure/Ollama 등 baseURL 처리</small>"]
    URL_NORM --> HTTP["HTTP 요청 (120s 타임아웃)<br/><small>OpenAI SDK로 API 호출</small>"]
    HTTP --> STREAM{"스트리밍?<br/><small>스트리밍 vs 일괄 응답 분기</small>"}
    STREAM -->|"Yes"| SSE["SSE 파싱<br/><small>Server-Sent Events 청크 처리</small>"]
    STREAM -->|"No"| BATCH["일괄 응답<br/><small>전체 응답 한 번에 수신</small>"]
    SSE --> RETRY_CHECK{"에러?<br/><small>HTTP 상태 코드 확인</small>"}
    BATCH --> RETRY_CHECK
    RETRY_CHECK -->|"500/502/503"| RETRY["재시도 (1s→2s→4s, 최대 3회)<br/><small>지수 백오프 재시도</small>"]
    RETRY_CHECK -->|"429"| FAIL["즉시 실패<br/><small>429 Rate Limit은 재시도 안 함</small>"]
    RETRY_CHECK -->|"성공"| DONE["응답 반환<br/><small>ChatResponse로 변환하여 반환</small>"]
    RETRY --> HTTP
    style REQ fill:#dbeafe,stroke:#3b82f6,color:#1e293b
    style DONE fill:#dcfce7,stroke:#10b981,color:#1e293b
    style FAIL fill:#fee2e2,stroke:#ef4444,color:#1e293b
    style HTTP fill:#ede9fe,stroke:#8b5cf6,color:#1e293b`;

const dualModelChart = `graph TD
    MSG["사용자 메시지<br/><small>가장 최근 user role 메시지</small>"] --> DETECT["detectPhase()<br/><small>키워드 기반 페이즈 자동 감지</small>"]
    DETECT --> KW_CHECK{"키워드 감지<br/><small>PLAN_KEYWORDS 13개 매칭</small>"}
    KW_CHECK -->|"plan, 설계, design, RFC"| PLAN["Plan Phase<br/><small>설계/분석 단계</small>"]
    KW_CHECK -->|"review, 리뷰, analyze"| REVIEW["Review Phase<br/><small>검토/리뷰 단계</small>"]
    KW_CHECK -->|"기타"| EXECUTE["Execute Phase<br/><small>코드 생성/실행 단계 기본값</small>"]
    PLAN --> ARCH["Architect Model 고추론<br/><small>고성능 모델 e.g. Opus</small>"]
    REVIEW --> ARCH
    EXECUTE --> EDIT["Editor Model 빠른응답<br/><small>비용 효율 모델 e.g. Sonnet</small>"]
    style PLAN fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
    style REVIEW fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
    style EXECUTE fill:#dcfce7,stroke:#10b981,color:#1e293b`;

export function LLMSection() {
  return (
    <section
      id="llm"
      className="py-16 bg-blue-50/50"
      style={{ paddingTop: "64px", paddingBottom: "64px" }}
    >
      <div className="center-container">
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
          <MermaidDiagram
            chart={llmPipelineChart}
            title="LLM 요청 처리 파이프라인"
            titleColor="blue"
          />
        </RevealOnScroll>

        <RevealOnScroll>
          <MermaidDiagram
            chart={dualModelChart}
            title="Dual-Model Router — 단계별 모델 전환"
            titleColor="purple"
          />
        </RevealOnScroll>

        <RevealOnScroll>
          <h3
            className="text-lg font-semibold text-gray-900 mb-4"
            style={{ marginTop: "32px", marginBottom: "16px" }}
          >
            모델 설정 우선순위
          </h3>
          <div
            className="border border-[#e2e8f0] rounded-lg overflow-hidden bg-white"
            style={{ marginBottom: "24px" }}
          >
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-200">
                    우선순위
                  </th>
                  <th className="p-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-200">
                    설정 소스
                  </th>
                  <th className="p-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-200">
                    설명
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {[
                  {
                    p: "1 (최고)",
                    color: "text-red-600",
                    src: "LOCAL_API_BASE_URL + LOCAL_MODEL",
                    desc: "환경변수 로컬 모델. 무조건 최우선",
                  },
                  {
                    p: "2",
                    color: "text-amber-600",
                    src: "CLI --model 플래그",
                    desc: "실행 시 명시적 지정",
                  },
                  {
                    p: "3",
                    color: "text-amber-600",
                    src: "/model 슬래시 명령",
                    desc: "세션 중 모델 변경",
                  },
                  {
                    p: "4",
                    color: "text-blue-600",
                    src: "settings.json → model",
                    desc: "프로젝트/사용자 설정",
                  },
                  { p: "5", color: "text-gray-400", src: "defaults.ts", desc: "하드코딩 기본값" },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 border-b border-gray-100">
                    <td className={`p-3 px-4 text-sm font-extrabold ${row.color}`}>{row.p}</td>
                    <td className="p-3 px-4 text-sm font-mono text-cyan-600 font-semibold">
                      {row.src}
                    </td>
                    <td className="p-3 px-4 text-sm">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <ImplDirection
            items={[
              "<strong>새 LLM 제공자 추가</strong>: LLMProvider 인터페이스 구현 → model-capabilities.ts에 capabilities 등록",
              "<strong>Dual Model 확장</strong>: TaskPhase에 'debug' | 'test' 추가 → 디버깅 전문 모델 라우팅",
              "<strong>스트리밍 최적화</strong>: 현재 SSE → WebSocket 지원 추가로 양방향 통신 가능",
              "<strong>비용 최적화</strong>: 간단한 질문은 자동으로 저비용 모델 → 복잡한 작업만 고비용 모델",
            ]}
          />
        </RevealOnScroll>
      </div>
    </section>
  );
}
