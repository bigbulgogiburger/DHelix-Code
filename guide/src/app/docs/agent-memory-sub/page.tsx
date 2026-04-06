"use client";

import { MermaidDiagram } from "@/components/MermaidDiagram";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";
import { FilePath } from "@/components/FilePath";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import { DeepDive } from "@/components/DeepDive";
import { ParamTable } from "@/components/ParamTable";
import { LayerBadge } from "@/components/LayerBadge";
import { SeeAlso } from "@/components/SeeAlso";

export default function AgentMemorySubPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/subagents/agent-memory.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">AgentMemoryManager</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              서브에이전트의 세션 간 영속적(persistent) 메모리를 관리하는 모듈입니다.
            </p>
          </div>
        </RevealOnScroll>

        {/* ─── 1. 개요 (Overview) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>📋</span> 개요
            </h2>
            <div className="text-[14px] text-gray-600 leading-[1.85] mb-8 space-y-3">
              <p>
                <code className="text-cyan-600">AgentMemoryManager</code>는 서브에이전트가
                세션(대화) 간에 지식을 유지할 수 있도록 파일 기반의 영속적 메모리 시스템을
                제공합니다. 일반적으로 서브에이전트는 실행이 끝나면 모든 컨텍스트가 사라지지만, 이
                모듈을 사용하면 이전 세션의 경험을 다음 세션에서 활용할 수 있습니다.
              </p>
              <p>
                메모리는 세 가지 스코프(범위)로 관리됩니다:
                <code className="text-cyan-600">user</code>(사용자 전역 &mdash; 모든 프로젝트에서
                공유),
                <code className="text-cyan-600">project</code>(프로젝트 단위 &mdash; 해당
                프로젝트에서만 사용),
                <code className="text-cyan-600">local</code>(로컬 전용 &mdash; Git에 커밋하지 않는
                개인 메모리).
              </p>
              <p>
                메모리 내용은 <code className="text-cyan-600">MEMORY.md</code> 파일로 저장되며,
                시스템 프롬프트에 주입되어 에이전트가 축적된 지식을 참조할 수 있습니다. 최대 200줄
                제한이 있어 시스템 프롬프트가 비대해지는 것을 방지합니다.
              </p>
            </div>

            <MermaidDiagram
              title="AgentMemoryManager 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  AGENT["Sub Agent<br/><small>코드 리뷰, 보안 분석 등</small>"]
  MM["AgentMemoryManager<br/><small>agent-memory.ts</small>"]
  USER_DIR["~/.dhelix/agent-memory/<br/><small>user 스코프</small>"]
  PROJ_DIR[".dhelix/agent-memory/<br/><small>project 스코프</small>"]
  LOCAL_DIR[".dhelix/agent-memory-local/<br/><small>local 스코프</small>"]
  PROMPT["System Prompt<br/><small>getMemoryPromptSection()</small>"]

  AGENT -->|"readMemory()"| MM
  AGENT -->|"writeMemory()"| MM
  MM -->|"user"| USER_DIR
  MM -->|"project"| PROJ_DIR
  MM -->|"local"| LOCAL_DIR
  MM -->|"getMemoryPromptSection()"| PROMPT
  PROMPT -->|"시스템 프롬프트에 주입"| AGENT

  style MM fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AGENT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style USER_DIR fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style PROJ_DIR fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style LOCAL_DIR fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style PROMPT fill:#dcfce7,stroke:#10b981,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 업무 노트북을 떠올리세요. 신입 직원(새 서브에이전트)이 와도
              이전 담당자가 남긴 노트(MEMORY.md)를 읽으면 바로 업무에 투입될 수 있습니다. 노트를
              업데이트하면 다음 담당자에게도 전달됩니다.
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ─── 2. 레퍼런스 (Reference) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>📖</span> 레퍼런스
            </h2>

            {/* AgentMemoryScope type */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              type AgentMemoryScope
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              에이전트 메모리의 저장 범위를 나타내는 타입입니다.
            </p>
            <CodeBlock>
              <span className="kw">type</span> <span className="type">AgentMemoryScope</span> ={" "}
              <span className="str">&quot;user&quot;</span> |{" "}
              <span className="str">&quot;project&quot;</span> |{" "}
              <span className="str">&quot;local&quot;</span>;
            </CodeBlock>
            <div className="text-[13px] text-gray-600 mt-2 space-y-1">
              <p>
                &bull; <code className="text-blue-600">&quot;user&quot;</code> &mdash; 사용자 전역 (
                <code>~/.dhelix/agent-memory/</code>) &mdash; 모든 프로젝트에서 공유
              </p>
              <p>
                &bull; <code className="text-emerald-600">&quot;project&quot;</code> &mdash;
                프로젝트 단위 (<code>.dhelix/agent-memory/</code>) &mdash; Git 추적 가능
              </p>
              <p>
                &bull; <code className="text-amber-600">&quot;local&quot;</code> &mdash; 로컬 전용 (
                <code>.dhelix/agent-memory-local/</code>) &mdash; Git 무시
              </p>
            </div>

            {/* AgentMemoryManager class */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class AgentMemoryManager
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              특정 에이전트 유형의 영속적 메모리를 관리하는 클래스입니다. 각 에이전트는 자신만의
              메모리 디렉토리를 가지며, 스코프별로 분리됩니다.
            </p>

            {/* Constructor */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">constructor</h4>
            <CodeBlock>
              <span className="kw">constructor</span>(<span className="prop">agentName</span>:{" "}
              <span className="type">string</span>, <span className="prop">scope</span>:{" "}
              <span className="type">AgentMemoryScope</span>,{" "}
              <span className="prop">workingDirectory</span>?: <span className="type">string</span>)
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "agentName",
                  type: "string",
                  required: true,
                  desc: '에이전트 이름 (디렉토리 이름으로 사용, 예: "code-reviewer")',
                },
                {
                  name: "scope",
                  type: "AgentMemoryScope",
                  required: true,
                  desc: "메모리 저장 범위 (user / project / local)",
                },
                {
                  name: "workingDirectory",
                  type: "string | undefined",
                  required: false,
                  desc: "작업 디렉토리 (기본값: process.cwd())",
                },
              ]}
            />

            {/* initialize */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">initialize()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              메모리 디렉토리를 생성합니다. 이미 존재하면 아무 작업도 하지 않습니다. 실패해도 경고만
              기록하고 진행합니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">initialize</span>():{" "}
              <span className="type">Promise</span>&lt;<span className="type">void</span>&gt;
            </CodeBlock>

            {/* readMemory */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">readMemory()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              MEMORY.md 파일의 내용을 읽어 반환합니다 (최대 200줄). 파일이 없거나 읽을 수 없으면 빈
              문자열을 반환합니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">readMemory</span>():{" "}
              <span className="type">Promise</span>&lt;<span className="type">string</span>&gt;
            </CodeBlock>

            {/* writeMemory */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">writeMemory(content)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              MEMORY.md 파일에 내용을 저장합니다. 파일이 없으면 새로 생성합니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">writeMemory</span>(
              <span className="prop">content</span>: <span className="type">string</span>):{" "}
              <span className="type">Promise</span>&lt;<span className="type">void</span>&gt;
            </CodeBlock>

            {/* getMemoryPromptSection */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">getMemoryPromptSection()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              에이전트의 시스템 프롬프트에 삽입할 메모리 컨텍스트 섹션을 생성합니다. 메모리 디렉토리
              경로, 사용 가이드, 현재 MEMORY.md 내용을 포함합니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">getMemoryPromptSection</span>
              (): <span className="type">Promise</span>&lt;<span className="type">string</span>&gt;
            </CodeBlock>

            {/* getRequiredTools */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">static getRequiredTools()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              메모리 기능에 필요한 도구 이름 목록을 반환합니다. 에이전트가 자체적으로 메모리를 읽고
              쓰려면 이 도구들이 필요합니다.
            </p>
            <CodeBlock>
              <span className="kw">static</span> <span className="fn">getRequiredTools</span>():{" "}
              <span className="kw">readonly</span> <span className="type">string</span>[]
              {"\n"}
              <span className="cm">{"// → ['file_read', 'file_write', 'file_edit']"}</span>
            </CodeBlock>

            {/* getMemoryDir */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">getMemoryDir()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              스코프에 따른 메모리 디렉토리의 절대 경로를 반환합니다.
            </p>
            <CodeBlock>
              <span className="fn">getMemoryDir</span>(): <span className="type">string</span>
              {"\n"}
              <span className="cm">{"// user:    ~/.dhelix/agent-memory/{agent-name}/"}</span>
              {"\n"}
              <span className="cm">{"// project: .dhelix/agent-memory/{agent-name}/"}</span>
              {"\n"}
              <span className="cm">{"// local:   .dhelix/agent-memory-local/{agent-name}/"}</span>
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                MEMORY.md 파일은 최대 <code className="text-cyan-600">200줄</code>까지만 읽습니다.
                200줄을 초과하면 앞부분만 반환되고 나머지는 잘립니다. 핵심 정보를 파일 앞쪽에
                배치하세요.
              </li>
              <li>
                <code className="text-cyan-600">initialize()</code> 실패는 치명적이지 않습니다.
                경고만 기록하고 계속 진행하므로, 디렉토리 생성 실패 시에도 에이전트가 정상
                동작합니다.
              </li>
              <li>
                <code className="text-cyan-600">local</code> 스코프의 디렉토리 이름은
                <code className="text-cyan-600">agent-memory-local</code>입니다.{" "}
                <code className="text-cyan-600">.gitignore</code>에 등록하여 Git 추적에서 제외해야
                합니다.
              </li>
              <li>
                <code className="text-cyan-600">writeMemory()</code>는 파일 전체를 덮어씁니다. 기존
                내용에 추가(append)하려면 먼저 <code className="text-cyan-600">readMemory()</code>로
                읽은 후 결합하여 저장하세요.
              </li>
            </ul>
          </section>
        </RevealOnScroll>

        {/* ─── 3. 사용법 (Usage) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🚀</span> 사용법
            </h2>

            {/* 기본 사용법 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              기본 사용법 &mdash; 메모리 읽기/쓰기
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              에이전트 메모리를 초기화하고, 이전 메모리를 읽고, 새로운 인사이트를 저장하는 기본
              흐름입니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 1. 메모리 매니저 생성"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">memory</span> ={" "}
              <span className="kw">new</span> <span className="fn">AgentMemoryManager</span>({"\n"}
              {"  "}
              <span className="str">&quot;code-reviewer&quot;</span>,{"\n"}
              {"  "}
              <span className="str">&quot;project&quot;</span>,{"\n"}
              {"  "}
              <span className="str">&quot;/path/to/project&quot;</span>,{"\n"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// 2. 디렉토리 초기화"}</span>
              {"\n"}
              <span className="kw">await</span> <span className="prop">memory</span>.
              <span className="fn">initialize</span>();
              {"\n"}
              {"\n"}
              <span className="cm">{"// 3. 이전 메모리 읽기"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">existing</span> ={" "}
              <span className="kw">await</span> <span className="prop">memory</span>.
              <span className="fn">readMemory</span>();
              {"\n"}
              <span className="cm">{"// → 빈 문자열이면 아직 메모리가 없음"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 4. 새로운 인사이트 저장"}</span>
              {"\n"}
              <span className="kw">await</span> <span className="prop">memory</span>.
              <span className="fn">writeMemory</span>(
              <span className="str">
                &quot;# 학습한 패턴\n- 이 프로젝트는 const를 선호함\n- ESM only&quot;
              </span>
              );
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>writeMemory()</code>는 기존 내용을 완전히 덮어씁니다.
              기존 메모리를 유지하면서 추가하려면 <code>readMemory()</code>로 먼저 읽은 후 문자열을
              결합하여 저장하세요.
            </Callout>

            {/* 고급 사용법: 시스템 프롬프트 주입 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 시스템 프롬프트에 메모리 주입
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">getMemoryPromptSection()</code>으로 생성한 텍스트를
              서브에이전트의 시스템 프롬프트에 추가하면, 에이전트가 이전 경험을 참조할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 시스템 프롬프트에 메모리 섹션 삽입"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">memorySection</span> ={" "}
              <span className="kw">await</span> <span className="prop">memory</span>.
              <span className="fn">getMemoryPromptSection</span>();
              {"\n"}
              {"\n"}
              <span className="kw">const</span> <span className="prop">systemPrompt</span> = [{"\n"}
              {"  "}
              <span className="str">&quot;당신은 코드 리뷰 전문가입니다.&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">memorySection</span>,{" "}
              <span className="cm">{"// ← 메모리 컨텍스트 삽입"}</span>
              {"\n"}].<span className="fn">join</span>(<span className="str">&quot;\n\n&quot;</span>
              );
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> 메모리가 없으면 &quot;No memory file yet. Create one to start
              building knowledge.&quot; 라는 안내 메시지가 자동으로 표시됩니다. 에이전트가 이
              메시지를 보고 메모리를 생성하기 시작합니다.
            </Callout>

            {/* 고급 사용법: 스코프별 활용 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 스코프별 활용 전략
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              세 가지 스코프를 목적에 맞게 사용하면 효과적입니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// user: 전역 코딩 스타일, 선호하는 패턴 저장"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">globalMemory</span> ={" "}
              <span className="kw">new</span> <span className="fn">AgentMemoryManager</span>(
              <span className="str">&quot;reviewer&quot;</span>,{" "}
              <span className="str">&quot;user&quot;</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// project: 프로젝트 고유 컨벤션, 아키텍처 결정 저장"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">projectMemory</span> ={" "}
              <span className="kw">new</span> <span className="fn">AgentMemoryManager</span>(
              <span className="str">&quot;reviewer&quot;</span>,{" "}
              <span className="str">&quot;project&quot;</span>, <span className="prop">cwd</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// local: 개인적인 실험 메모, 커밋하지 않을 내용"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">localMemory</span> ={" "}
              <span className="kw">new</span> <span className="fn">AgentMemoryManager</span>(
              <span className="str">&quot;reviewer&quot;</span>,{" "}
              <span className="str">&quot;local&quot;</span>, <span className="prop">cwd</span>);
            </CodeBlock>

            <DeepDive title="MEMORY.md 200줄 제한의 의미">
              <p className="mb-3">
                시스템 프롬프트에 메모리를 주입할 때{" "}
                <code className="text-cyan-600">MEMORY_MAX_LINES = 200</code> 제한이 적용됩니다.
                이는 시스템 프롬프트의 크기가 과도하게 커지는 것을 방지합니다.
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>200줄을 초과하면 앞부분 200줄만 반환되고 나머지는 잘립니다.</li>
                <li>가장 중요한 정보를 파일 앞쪽에 배치하세요.</li>
                <li>
                  주제별로 상세한 내용은 별도 파일로 분리하고, MEMORY.md에는 요약만 기록하세요.
                </li>
              </ul>
              <p className="mt-3 text-amber-600">
                이 제한은 모듈 내부에 하드코딩되어 있어 외부에서 변경할 수 없습니다.
              </p>
            </DeepDive>
          </section>
        </RevealOnScroll>

        {/* ─── 4. 내부 구현 (Internals) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>⚙️</span> 내부 구현
            </h2>

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              스코프별 디렉토리 구조
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              스코프에 따라 메모리가 저장되는 디렉토리가 달라집니다. 각 에이전트는 자신의 이름으로
              하위 디렉토리를 갖습니다.
            </p>

            <MermaidDiagram
              title="스코프별 메모리 디렉토리"
              titleColor="purple"
              chart={`graph TD
  MM["AgentMemoryManager<br/><small>getMemoryDir()</small>"]

  MM -->|"user"| U["~/.dhelix/agent-memory/<br/>code-reviewer/<br/><small>MEMORY.md</small>"]
  MM -->|"project"| P["./dhelix/agent-memory/<br/>code-reviewer/<br/><small>MEMORY.md</small>"]
  MM -->|"local"| L[".dhelix/agent-memory-local/<br/>code-reviewer/<br/><small>MEMORY.md</small>"]

  U -.->|"모든 프로젝트 공유"| GLOBAL["전역 지식"]
  P -.->|"Git 추적 가능"| SHARED["팀 공유 가능"]
  L -.->|"Git 무시"| PRIVATE["개인 메모"]

  style MM fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style U fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style P fill:#dcfce7,stroke:#10b981,color:#1e293b
  style L fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style GLOBAL fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style SHARED fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style PRIVATE fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석 &mdash; getMemoryPromptSection
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              시스템 프롬프트에 삽입할 메모리 섹션을 생성하는 핵심 로직입니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">getMemoryPromptSection</span>
              (): <span className="type">Promise</span>&lt;<span className="type">string</span>&gt;{" "}
              {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">dir</span> ={" "}
              <span className="kw">this</span>.<span className="fn">getMemoryDir</span>();
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">content</span> ={" "}
              <span className="kw">await</span> <span className="kw">this</span>.
              <span className="fn">readMemory</span>();
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [1] 메모리가 없으면 안내 메시지 표시"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">memoryContent</span> ={" "}
              <span className="prop">content</span>
              {"\n"}
              {"    "}? <span className="prop">content</span>
              {"\n"}
              {"    "}:{" "}
              <span className="str">
                &quot;No memory file yet. Create one to start building knowledge.&quot;
              </span>
              ;{"\n"}
              {"\n"}
              {"  "}
              <span className="cm">
                {"// [2] 메모리 디렉토리 경로 + 사용 가이드 + 현재 내용을 결합"}
              </span>
              {"\n"}
              {"  "}
              <span className="kw">return</span> [{"\n"}
              {"    "}
              <span className="str">&quot;# Agent Memory&quot;</span>,{"\n"}
              {"    "}
              <span className="str">
                {"`You have a persistent agent memory directory at \\`${dir}\\`.`"}
              </span>
              ,{"\n"}
              {"    "}
              <span className="str">&quot;## How to use your memory:&quot;</span>,{"\n"}
              {"    "}
              <span className="str">&quot;- Consult MEMORY.md before starting work...&quot;</span>,
              {"\n"}
              {"    "}
              <span className="str">&quot;## Current MEMORY.md:&quot;</span>,{"\n"}
              {"    "}
              <span className="prop">memoryContent</span>,{"\n"}
              {"  "}].<span className="fn">join</span>(<span className="str">&quot;\n&quot;</span>);
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> 메모리 파일이 없으면 에이전트에게
                &quot;메모리를 만들라&quot;는 안내 메시지를 제공합니다. 에이전트는 이 메시지를 보고
                첫 메모리를 생성합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> 디렉토리 경로, 사용 가이드, 현재
                메모리 내용을 하나의 문자열로 결합하여 시스템 프롬프트에 주입합니다.
              </p>
            </div>
          </section>
        </RevealOnScroll>

        {/* ─── 5. 트러블슈팅 (Troubleshooting) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🔧</span> 트러블슈팅
            </h2>

            {/* FAQ 1 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;readMemory()가 항상 빈 문자열을 반환해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                두 가지 가능성이 있습니다:
              </p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  MEMORY.md 파일이 아직 생성되지 않았습니다.{" "}
                  <code className="text-cyan-600">writeMemory()</code>를 먼저 호출하세요.
                </li>
                <li>
                  스코프와 workingDirectory 조합이 맞는지 확인하세요. 다른 디렉토리를 가리키고 있을
                  수 있습니다.
                </li>
              </ul>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;메모리가 200줄에서 잘려요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                시스템 프롬프트 크기를 제한하기 위해 의도된 동작입니다. 중요한 정보를 파일 앞쪽에
                배치하고, 상세 내용은 별도 파일(예:{" "}
                <code className="text-cyan-600">PATTERNS.md</code>)로 분리하세요. 에이전트가{" "}
                <code className="text-cyan-600">file_read</code> 도구로 별도 파일을 읽을 수
                있습니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;local 스코프 메모리가 Git에 커밋되었어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">.dhelix/agent-memory-local/</code> 디렉토리를
                <code className="text-cyan-600">.gitignore</code>에 추가하세요. local 스코프는 개인
                메모용으로 설계되었으므로 Git 추적에서 제외해야 합니다.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;에이전트가 메모리를 자체적으로 업데이트하지 못해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                에이전트가 메모리를 직접 읽고 쓰려면{" "}
                <code className="text-cyan-600">file_read</code>,
                <code className="text-cyan-600">file_write</code>,{" "}
                <code className="text-cyan-600">file_edit</code>
                도구가 허용되어야 합니다.{" "}
                <code className="text-cyan-600">AgentMemoryManager.getRequiredTools()</code>로
                필요한 도구 목록을 확인하고, 에이전트 정의의{" "}
                <code className="text-cyan-600">tools</code> 필드에 포함시키세요.
              </p>
            </div>
          </section>
        </RevealOnScroll>

        {/* ─── 6. 관련 문서 (See Also) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🔗</span> 관련 문서
            </h2>
            <SeeAlso
              items={[
                {
                  name: "definition-loader.ts",
                  slug: "definition-loader",
                  relation: "sibling",
                  desc: "에이전트 정의 파일(.md)을 파싱 — 메모리 스코프 설정도 프론트매터에 기술",
                },
                {
                  name: "shared-state.ts",
                  slug: "shared-state",
                  relation: "sibling",
                  desc: "세션 내 실시간 공유 상태 — 영속적 메모리와 보완적 역할",
                },
                {
                  name: "task-list.ts",
                  slug: "subagent-task-list",
                  relation: "sibling",
                  desc: "팀 작업 목록 관리 — 메모리와 함께 팀 협업의 기반",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
