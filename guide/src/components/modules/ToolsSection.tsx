"use client";

import { SectionHeader } from "../SectionHeader";
import { FilePath } from "../FilePath";
import { MermaidDiagram } from "../MermaidDiagram";
import { CodeBlock } from "../CodeBlock";
import { ImplDirection } from "../ImplDirection";
import { RevealOnScroll } from "../RevealOnScroll";

const toolPipelineChart = `graph TD
    subgraph REG["Registration Phase"]
        direction LR
        BUILTIN["16 Built-in"] --> REGISTRY["ToolRegistry Map"]
        MCP_TOOLS["MCP Tools mcp__*"] -->|"Deferred"| REGISTRY
        HOT["Hot Tools 6개"] --> REGISTRY
    end
    subgraph SCHEMA["Schema Phase"]
        direction LR
        TIER{"모델 티어"} -->|"HIGH"| FULL["Full Schema"]
        TIER -->|"MEDIUM"| REDUCED["Reduced Schema"]
        TIER -->|"LOW"| MINIMAL["Minimal + few-shot"]
    end
    subgraph EXEC["Execution Phase"]
        direction TB
        CALL["LLM tool_call"] --> CORRECT["tool-call-corrector"]
        CORRECT --> ZOD["Zod 스키마 검증"]
        ZOD --> ABORT["AbortController"]
        ABORT --> RUN["tool.execute()"]
        RUN --> RETRY_T{"일시적 에러?"}
        RETRY_T -->|"Yes"| BACKOFF["지수 백오프 재시도"]
        RETRY_T -->|"No"| RESULT["ToolResult"]
        BACKOFF --> RUN
    end
    REG --> SCHEMA
    SCHEMA --> EXEC
    style REG fill:#0d2a1a,stroke:#10b981,color:#f1f5f9
    style SCHEMA fill:#1a1a3e,stroke:#8b5cf6,color:#f1f5f9
    style EXEC fill:#1e2a4a,stroke:#3b82f6,color:#f1f5f9`;

const hotTools = ["file_read", "file_write", "file_edit", "bash_exec", "glob_search", "grep_search"];

export function ToolsSection() {
  return (
    <section id="tools" className="py-20 bg-bg-secondary">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
        <RevealOnScroll>
          <SectionHeader
            label="MODULE 04"
            labelColor="green"
            title="Tool System — 등록 → 실행 파이프라인"
            description="16개 빌트인 도구 + MCP 외부 도구를 등록하고, 검증하고, 실행하는 전체 파이프라인입니다."
          />
        </RevealOnScroll>

        <RevealOnScroll>
          <div className="flex gap-2 flex-wrap mb-5">
            <FilePath path="src/tools/registry.ts" />
            <FilePath path="src/tools/executor.ts" />
            <FilePath path="src/tools/adaptive-schema.ts" />
            <FilePath path="src/tools/types.ts" />
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <MermaidDiagram chart={toolPipelineChart} title="도구 등록 → 실행 전체 파이프라인" titleColor="green" />
        </RevealOnScroll>

        <RevealOnScroll>
          <h3 className="text-lg font-bold mb-4">핵심 인터페이스: ToolDefinition</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CodeBlock>
              <span className="cm">{"// 도구 정의 — 새 도구 추가의 기본 단위"}</span>{"\n"}
              <span className="kw">interface</span> <span className="type">{"ToolDefinition<TParams>"}</span> {"{"}{"\n"}
              {"  "}<span className="kw">readonly</span> <span className="prop">name</span>: <span className="type">string</span>;{"\n"}
              {"  "}<span className="kw">readonly</span> <span className="prop">description</span>: <span className="type">string</span>;{"\n"}
              {"  "}<span className="kw">readonly</span> <span className="prop">parameterSchema</span>: <span className="type">{"z.ZodSchema<TParams>"}</span>;{"\n"}
              {"  "}<span className="kw">readonly</span> <span className="prop">permissionLevel</span>:{"\n"}
              {"    "}<span className="str">{'"safe"'}</span> | <span className="str">{'"confirm"'}</span> | <span className="str">{'"dangerous"'}</span>;{"\n"}
              {"  "}<span className="kw">readonly</span> <span className="fn">execute</span>: ({"\n"}
              {"    "}<span className="prop">params</span>: <span className="type">TParams</span>,{"\n"}
              {"    "}<span className="prop">context</span>: <span className="type">ToolContext</span>{"\n"}
              {"  "}) =&gt; <span className="type">{"Promise<ToolResult>"}</span>;{"\n"}
              {"}"}
            </CodeBlock>
            <CodeBlock>
              <span className="cm">{"// 도구 실행 컨텍스트"}</span>{"\n"}
              <span className="kw">interface</span> <span className="type">ToolContext</span> {"{"}{"\n"}
              {"  "}<span className="prop">workingDirectory</span>: <span className="type">string</span>;{"\n"}
              {"  "}<span className="prop">abortSignal</span>: <span className="type">AbortSignal</span>;{"\n"}
              {"  "}<span className="prop">timeoutMs</span>: <span className="type">number</span>;      <span className="cm">{"// 120,000"}</span>{"\n"}
              {"  "}<span className="prop">platform</span>: <span className="str">{'"darwin"'}</span> | <span className="str">{'"linux"'}</span> | <span className="str">{'"win32"'}</span>;{"\n"}
              {"  "}<span className="prop">events</span>?: <span className="type">AppEventEmitter</span>;{"\n"}
              {"  "}<span className="prop">toolCallId</span>?: <span className="type">string</span>;{"\n"}
              {"  "}<span className="prop">activeClient</span>?: <span className="type">LLMProvider</span>;{"\n"}
              {"  "}<span className="prop">activeModel</span>?: <span className="type">string</span>;{"\n"}
              {"}"}{"\n\n"}
              <span className="kw">interface</span> <span className="type">ToolResult</span> {"{"}{"\n"}
              {"  "}<span className="prop">output</span>: <span className="type">string</span>;{"\n"}
              {"  "}<span className="prop">isError</span>: <span className="type">boolean</span>;{"\n"}
              {"}"}
            </CodeBlock>
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <h3 className="text-lg font-bold mt-6 mb-4">Hot Tools vs Deferred Tools</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-bg-card border border-border rounded-2xl p-6 relative overflow-hidden before:absolute before:top-0 before:left-0 before:right-0 before:h-0.5 before:bg-gradient-to-r before:from-accent-green before:to-accent-cyan">
              <h4 className="text-[15px] mb-2.5 font-bold text-accent-green">🔥 Hot Tools (6개) — 항상 로딩</h4>
              <p className="text-[13px] text-text-secondary mb-3">매 LLM 요청마다 스키마가 포함되는 핵심 도구.</p>
              <div className="flex flex-wrap gap-1.5">
                {hotTools.map((t) => (
                  <span key={t} className="text-[11px] px-2.5 py-1 bg-[rgba(16,185,129,0.1)] rounded-[5px] font-mono text-accent-green">{t}</span>
                ))}
              </div>
            </div>
            <div className="bg-bg-card border border-border rounded-2xl p-6 relative overflow-hidden before:absolute before:top-0 before:left-0 before:right-0 before:h-0.5 before:bg-gradient-to-r before:from-accent-purple before:to-accent-pink">
              <h4 className="text-[15px] mb-2.5 font-bold text-accent-purple">💤 Deferred Tools (MCP) — 필요 시 로딩</h4>
              <p className="text-[13px] text-text-secondary mb-3">시스템 프롬프트에 이름만 노출하고, LLM이 요청하면 스키마를 로딩.</p>
              <div className="text-xs text-text-muted font-mono leading-relaxed">
                mcp__playwright__click<br/>
                mcp__serena__find_symbol<br/>
                mcp__chrome-devtools__navigate_page<br/>
                ... (수백 개 가능)
              </div>
            </div>
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <ImplDirection items={[
            "<strong>새 도구 추가</strong>: src/tools/definitions/에 파일 생성 → ToolDefinition 구현 → registry에 registerAll()",
            "<strong>Adaptive Schema 커스텀</strong>: 모델별 few-shot 예시를 adaptive-schema.ts에서 조정",
            "<strong>Tool Grouping 최적화</strong>: 현재 읽기/쓰기 분류 → 파일 경로 충돌 분석으로 세분화 가능",
            "<strong>도구 메트릭 수집</strong>: 실행 시간, 성공률, 토큰 비용 등 수집하여 도구 추천에 활용",
          ]} />
        </RevealOnScroll>
      </div>
    </section>
  );
}
