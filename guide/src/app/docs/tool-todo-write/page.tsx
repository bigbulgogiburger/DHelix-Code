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

export default function ToolTodoWritePage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/tools/definitions/todo-write.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">todo_write Tool</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
              <span className="text-sm text-gray-500">작업 목록 관리</span>
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              복잡한 작업을 단계별로 분해하고 진행 상태를 추적하는 도구입니다. 항상 정확히 1개의
              항목이 진행 중 상태여야 합니다.
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
                <code className="text-cyan-600">todo_write</code>는 LLM이 복잡한 다단계 작업을
                수행할 때 전체 계획을 명시적으로 추적하는 도구입니다. 할 일 목록을 UI에 표시하여
                사용자가 에이전트의 현재 작업 상태를 실시간으로 파악할 수 있게 합니다.
              </p>
              <p>
                세 가지 상태를 지원합니다:{" "}
                <code className="text-cyan-600">&quot;pending&quot;</code>(대기),{" "}
                <code className="text-cyan-600">&quot;in_progress&quot;</code>(진행 중),{" "}
                <code className="text-cyan-600">&quot;completed&quot;</code>(완료). 핵심 제약은
                항상 정확히 1개의 항목만{" "}
                <code className="text-cyan-600">in_progress</code> 상태여야 한다는 것입니다. 이 규칙은
                LLM이 한 번에 하나의 작업에만 집중하도록 강제합니다.
              </p>
              <p>
                상태는 세션 메모리에만 저장되며, 세션이 종료되면 초기화됩니다. 매번 전체 목록을
                새로 전달해야 합니다 (부분 업데이트 불가). 권한 수준은{" "}
                <code className="text-emerald-600">&quot;safe&quot;</code>로, 메모리 상태만
                변경하므로 사용자 확인이 필요하지 않습니다.
              </p>
            </div>

            <MermaidDiagram
              title="todo_write 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  AGENT["Agent Loop<br/><small>agent-loop.ts</small>"]
  EXEC["Tool Executor<br/><small>tools/executor.ts</small>"]
  TW["todo_write<br/><small>todo-write.ts</small>"]
  MEM["인메모리 상태<br/><small>currentTodos[]</small>"]
  UI["UI 컴포넌트<br/><small>TodoList display</small>"]
  GT["getTodos()<br/><small>외부 읽기 API</small>"]

  AGENT -->|"도구 호출"| EXEC
  EXEC --> TW
  TW -->|"Object.freeze()"| MEM
  MEM -->|"getTodos()"| GT
  GT -->|"상태 읽기"| UI

  style TW fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AGENT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style EXEC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style MEM fill:#fef3c7,stroke:#f59e0b,color:#78350f
  style UI fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 포스트잇 메모를 화이트보드에 붙이는 것과 같습니다. 에이전트가
              작업 목록을 공개적으로 선언하고, 각 단계를 마칠 때마다 업데이트합니다. 사용자는
              실시간으로 진행 상황을 볼 수 있습니다.
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

            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              TodoItem 스키마
            </h3>
            <ParamTable
              params={[
                {
                  name: "content",
                  type: "string",
                  required: true,
                  desc: "할 일 항목의 설명 텍스트",
                },
                {
                  name: "status",
                  type: '"pending" | "in_progress" | "completed"',
                  required: true,
                  desc: '현재 상태 — 항상 정확히 1개만 "in_progress"여야 함',
                },
              ]}
            />

            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              매개변수 스키마 (paramSchema)
            </h3>
            <ParamTable
              params={[
                {
                  name: "todos",
                  type: "TodoItem[] (min: 1)",
                  required: true,
                  desc: "전체 할 일 목록 — 매번 완전한 목록을 전달해야 합니다",
                },
              ]}
            />

            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              공개 API
            </h3>
            <ParamTable
              params={[
                {
                  name: "getTodos()",
                  type: "readonly TodoItem[]",
                  required: false,
                  desc: "현재 할 일 상태를 외부에서 읽기 — UI 컴포넌트나 테스트에서 사용",
                },
                {
                  name: "resetTodos()",
                  type: "void",
                  required: false,
                  desc: "상태 초기화 — 테스트에서 클린 상태로 리셋할 때 사용",
                },
              ]}
            />

            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">in_progress</code> 항목이 0개이거나 2개 이상이면{" "}
                <code className="text-cyan-600">isError: true</code>를 반환합니다. Zod 검증을 통과해도
                이 규칙은 실행 함수에서 추가로 검증합니다.
              </li>
              <li>
                상태는 모듈 수준 변수{" "}
                <code className="text-cyan-600">currentTodos</code>에 저장됩니다.{" "}
                <code className="text-cyan-600">Object.freeze()</code>로 불변(immutable) 배열을 유지합니다.
              </li>
              <li>
                5초 타임아웃이 설정됩니다. 단순한 인메모리 연산이므로 타임아웃이 발생할 가능성은 없지만
                안전망으로 존재합니다.
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

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              기본 패턴 &mdash; 작업 시작 선언
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              복잡한 작업을 시작할 때 전체 계획을 먼저 선언합니다. 첫 번째 항목을{" "}
              <code className="text-cyan-600">in_progress</code>로 설정합니다.
            </p>
            <CodeBlock>
              {"// 작업 시작 선언\n"}
              {"{\n"}
              {"  todos: [\n"}
              {"    { content: '파일 구조 분석', status: 'in_progress' },\n"}
              {"    { content: '타입 정의 작성', status: 'pending' },\n"}
              {"    { content: '구현 코드 작성', status: 'pending' },\n"}
              {"    { content: '테스트 작성', status: 'pending' }\n"}
              {"  ]\n"}
              {"}\n"}
              {"\n"}
              {"// 출력 예시:\n"}
              {"// Todo List Updated:\n"}
              {"// 1. [→] 파일 구조 분석\n"}
              {"// 2. [ ] 타입 정의 작성\n"}
              {"// 3. [ ] 구현 코드 작성\n"}
              {"// 4. [ ] 테스트 작성"}
            </CodeBlock>

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              진행 업데이트 &mdash; 단계 완료
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              각 단계를 완료할 때마다 전체 목록을 업데이트합니다. 완료된 항목은{" "}
              <code className="text-cyan-600">completed</code>로, 다음 항목은{" "}
              <code className="text-cyan-600">in_progress</code>로 변경합니다.
            </p>
            <CodeBlock>
              {"// 첫 번째 단계 완료, 두 번째 단계 시작\n"}
              {"{\n"}
              {"  todos: [\n"}
              {"    { content: '파일 구조 분석', status: 'completed' },\n"}
              {"    { content: '타입 정의 작성', status: 'in_progress' },\n"}
              {"    { content: '구현 코드 작성', status: 'pending' },\n"}
              {"    { content: '테스트 작성', status: 'pending' }\n"}
              {"  ]\n"}
              {"}\n"}
              {"\n"}
              {"// 출력 예시:\n"}
              {"// Todo List Updated:\n"}
              {"// 1. [✓] 파일 구조 분석\n"}
              {"// 2. [→] 타입 정의 작성\n"}
              {"// 3. [ ] 구현 코드 작성\n"}
              {"// 4. [ ] 테스트 작성"}
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>in_progress</code> 항목이 정확히 1개가 아니면 에러를
              반환합니다. 0개(모두 completed 또는 pending)이거나 2개 이상이면 안 됩니다. 각 호출에서
              반드시 하나의 &quot;진행 중&quot; 항목을 지정해야 합니다.
            </Callout>

            <DeepDive title="부분 업데이트가 아닌 전체 교체 패턴의 이유">
              <p className="mb-3">
                <code className="text-cyan-600">todo_write</code>는 &ldquo;부분 업데이트&rdquo;가 아닌
                &ldquo;전체 교체&rdquo; 방식을 사용합니다. 이유는 다음과 같습니다:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600 text-[13px]">
                <li>
                  <strong>단순성:</strong> LLM이 &ldquo;item_id로 status 변경&rdquo;이라는 복잡한
                  조작 대신 전체 목록만 알면 됩니다.
                </li>
                <li>
                  <strong>일관성 보장:</strong> 전체 상태를 한 번에 전달하므로 부분 업데이트 중
                  발생할 수 있는 중간 불일치 상태가 없습니다.
                </li>
                <li>
                  <strong>불변성:</strong>{" "}
                  <code className="text-cyan-600">Object.freeze()</code>로 이전 상태를 보존하고 새
                  상태로 교체하는 immutable 패턴을 자연스럽게 구현합니다.
                </li>
              </ul>
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
              실행 흐름 다이어그램
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">execute()</code> 함수의 전체 흐름입니다. in_progress
              검증 후 Object.freeze()로 불변 저장합니다.
            </p>

            <MermaidDiagram
              title="todo_write 실행 흐름"
              titleColor="purple"
              chart={`graph TD
  START(("execute()")) --> VALIDATE["in_progress 개수 확인"]
  VALIDATE --> CHECK{"개수 == 1?"}
  CHECK -->|"아님"| ERR["isError: true 반환<br/><small>found N</small>"]
  CHECK -->|"정확히 1"| FREEZE["Object.freeze(todos.map(...))"]
  FREEZE --> STORE["currentTodos 갱신"]
  STORE --> FORMAT["formatTodoList()"]
  FORMAT --> RESULT["ToolResult 반환<br/><small>포맷팅된 목록 텍스트</small>"]

  style START fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CHECK fill:#fef3c7,stroke:#f59e0b,color:#78350f
  style ERR fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style FREEZE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              불변 저장과 상태 표시 아이콘 매핑 패턴입니다.
            </p>
            <CodeBlock>
              {"// 상태별 아이콘 (읽기 전용 Record)\n"}
              {"const STATUS_INDICATORS = {\n"}
              {"  completed: '✓',   // \\u2713\n"}
              {"  in_progress: '→', // \\u2192\n"}
              {"  pending: ' ',\n"}
              {"} as const;\n"}
              {"\n"}
              {"// Object.freeze()로 불변 배열 저장\n"}
              {"currentTodos = Object.freeze(\n"}
              {"  todos.map(t => ({ ...t }))\n"}
              ");"}
            </CodeBlock>
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

            <div className="space-y-6">
              <div className="glass-card p-5">
                <h4 className="text-sm font-bold text-gray-900 mb-2">
                  Q: &ldquo;exactly one todo must have status &lsquo;in_progress&rsquo;&rdquo; 에러가
                  납니다.
                </h4>
                <p className="text-[13px] text-gray-600">
                  전달한 목록에서{" "}
                  <code className="text-cyan-600">in_progress</code> 항목이 0개이거나 2개 이상입니다.
                  반드시 정확히 1개의 항목을 <code>in_progress</code>로 설정하세요. 모든 작업이
                  완료된 경우에도 마지막 항목을 <code>in_progress</code>로 유지해야 합니다.
                </p>
              </div>

              <div className="glass-card p-5">
                <h4 className="text-sm font-bold text-gray-900 mb-2">
                  Q: 세션을 재시작했는데 이전 할 일 목록이 사라졌습니다.
                </h4>
                <p className="text-[13px] text-gray-600">
                  <code className="text-cyan-600">currentTodos</code>는 모듈 수준 메모리에만
                  저장됩니다. 세션 재시작 시 프로세스가 종료되면 상태가 초기화됩니다. 영속화가
                  필요하면 <code className="text-cyan-600">file_write</code>로 별도 파일에 저장하세요.
                </p>
              </div>

              <div className="glass-card p-5">
                <h4 className="text-sm font-bold text-gray-900 mb-2">
                  Q: 특정 항목만 업데이트할 수 없나요?
                </h4>
                <p className="text-[13px] text-gray-600">
                  <code className="text-cyan-600">todo_write</code>는 부분 업데이트를 지원하지
                  않습니다. 매번 전체 목록을 전달해야 합니다. 먼저{" "}
                  <code className="text-cyan-600">getTodos()</code>로 현재 상태를 읽고, 업데이트할
                  항목을 수정한 전체 목록을 다시 전달하세요.
                </p>
              </div>

              <div className="glass-card p-5">
                <h4 className="text-sm font-bold text-gray-900 mb-2">
                  Q: 할 일 목록이 UI에 표시되지 않습니다.
                </h4>
                <p className="text-[13px] text-gray-600">
                  <code className="text-cyan-600">todo_write</code>는 상태를 저장하지만 UI 표시는
                  프론트엔드 컴포넌트가 담당합니다.{" "}
                  <code className="text-cyan-600">getTodos()</code>를 주기적으로 폴링하거나 이벤트로
                  연결되어 있어야 합니다. 헤드리스 모드에서는 UI가 없으므로 표시되지 않습니다.
                </p>
              </div>
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
              links={[
                {
                  href: "/docs/tool-executor",
                  title: "Tool Executor",
                  desc: "도구 실행 파이프라인 — 타임아웃 및 검증 처리",
                },
                {
                  href: "/docs/tool-registry",
                  title: "Tool Registry",
                  desc: "도구 등록 및 조회 — todo_write가 등록되는 레지스트리",
                },
                {
                  href: "/docs/agent-loop",
                  title: "Agent Loop",
                  desc: "에이전트가 도구를 호출하는 ReAct 루프",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
