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

export default function TaskManagerPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/core/task-manager.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              TaskManager
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="core" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            작업 목록 CRUD + 진행률 추적
          </p>
        </div>
      </RevealOnScroll>

      {/* ─── 1. 개요 (Overview) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📋</span> 개요
          </h2>
          <div className="text-[14px] text-gray-600 leading-[1.85] mb-8 space-y-3">
            <p>
              <code className="text-cyan-600">TaskManager</code>는 프로젝트 내 작업(할 일)을 생성, 수정, 삭제, 추적하는
              &quot;투두 리스트&quot; 시스템입니다. AI 에이전트가 복잡한 작업을 수행할 때,
              전체 작업을 작은 단위로 나누고 진행 상태를 관리하는 데 사용됩니다.
            </p>
            <p>
              각 작업은 5가지 상태 중 하나를 가집니다: <code className="text-cyan-600">pending</code>(대기),
              <code className="text-cyan-600">in_progress</code>(진행 중),
              <code className="text-cyan-600">completed</code>(완료),
              <code className="text-cyan-600">failed</code>(실패),
              <code className="text-cyan-600">cancelled</code>(취소).
            </p>
            <p>
              작업 간 <strong>의존성(dependency)</strong>을 설정할 수 있어서,
              선행 작업이 완료되어야만 다음 작업을 시작할 수 있습니다.
              또한 <strong>부모-자식 관계</strong>로 작업을 계층적으로 구조화할 수 있습니다.
              모든 데이터는 JSON 파일로 디스크에 저장되어 프로그램 재시작 시에도 유지됩니다.
            </p>
          </div>

          <MermaidDiagram
            title="TaskManager 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  AGENT["Agent Loop<br/><small>agent-loop.ts</small>"]
  TM["TaskManager<br/><small>task-manager.ts</small>"]
  TOOL["Task Tool<br/><small>tools/task.ts</small>"]
  DISK["JSON Storage<br/><small>tasks.json</small>"]

  AGENT -->|"작업 관리 요청"| TOOL
  TOOL -->|"CRUD 호출"| TM
  TM -->|"읽기/쓰기"| DISK

  style TM fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AGENT fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style TOOL fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style DISK fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> TaskManager는 &quot;칸반 보드&quot;와 비슷합니다.
            각 작업 카드에 제목, 상태, 의존 관계를 적어두고,
            선행 카드가 &quot;완료&quot; 열로 이동해야만 다음 카드를 &quot;진행 중&quot;으로 옮길 수 있습니다.
            작업 카드는 JSON 파일에 자동 저장되므로, 프로그램을 껐다 켜도 보드가 유지됩니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* TaskStatus type */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            type TaskStatus
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            작업이 가질 수 있는 5가지 상태를 나타내는 유니온 타입입니다.
          </p>
          <CodeBlock>
            <span className="kw">type</span> <span className="type">TaskStatus</span> = <span className="str">&quot;pending&quot;</span> | <span className="str">&quot;in_progress&quot;</span> | <span className="str">&quot;completed&quot;</span> | <span className="str">&quot;failed&quot;</span> | <span className="str">&quot;cancelled&quot;</span>;
          </CodeBlock>
          <div className="text-[13px] text-gray-600 mt-2 space-y-1">
            <p>&bull; <code className="text-cyan-600">&quot;pending&quot;</code> &mdash; 대기 중 (아직 시작하지 않음)</p>
            <p>&bull; <code className="text-cyan-600">&quot;in_progress&quot;</code> &mdash; 진행 중</p>
            <p>&bull; <code className="text-emerald-600">&quot;completed&quot;</code> &mdash; 완료됨</p>
            <p>&bull; <code className="text-red-600">&quot;failed&quot;</code> &mdash; 실패함</p>
            <p>&bull; <code className="text-amber-600">&quot;cancelled&quot;</code> &mdash; 취소됨</p>
          </div>

          {/* Task interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface Task
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            단일 작업을 나타내는 인터페이스입니다. 모든 프로퍼티가 <code className="text-cyan-600">readonly</code>이므로 불변입니다.
          </p>
          <ParamTable
            params={[
              { name: "id", type: "string", required: true, desc: "작업 고유 식별자 (UUID)" },
              { name: "title", type: "string", required: true, desc: "작업 제목" },
              { name: "description", type: "string | undefined", required: false, desc: "작업에 대한 상세 설명" },
              { name: "status", type: "TaskStatus", required: true, desc: "현재 상태 (pending, in_progress, completed, failed, cancelled)" },
              { name: "parentId", type: "string | undefined", required: false, desc: "부모 작업의 ID (하위 작업인 경우)" },
              { name: "dependencies", type: "readonly string[]", required: true, desc: "이 작업이 의존하는 다른 작업들의 ID 목록" },
              { name: "createdAt", type: "string", required: true, desc: "작업 생성 시각 (ISO 8601)" },
              { name: "updatedAt", type: "string", required: true, desc: "마지막 수정 시각 (ISO 8601)" },
              { name: "metadata", type: "Record<string, unknown> | undefined", required: false, desc: "추가 메타데이터 (자유 형식 키-값 쌍)" },
            ]}
          />

          {/* CreateTaskParams interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface CreateTaskParams
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            작업 생성 시 필요한 매개변수입니다. <code className="text-cyan-600">title</code>만 필수이고 나머지는 선택입니다.
          </p>
          <ParamTable
            params={[
              { name: "title", type: "string", required: true, desc: "작업 제목 (필수)" },
              { name: "description", type: "string | undefined", required: false, desc: "상세 설명" },
              { name: "parentId", type: "string | undefined", required: false, desc: "부모 작업 ID (하위 작업으로 만들 때)" },
              { name: "dependencies", type: "readonly string[] | undefined", required: false, desc: "의존 작업 ID 목록" },
              { name: "metadata", type: "Record<string, unknown> | undefined", required: false, desc: "추가 메타데이터" },
            ]}
          />

          {/* UpdateTaskParams interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface UpdateTaskParams
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            작업 수정 시 사용하는 매개변수입니다. 모든 필드가 선택사항이며, 제공된 필드만 업데이트됩니다.
          </p>
          <ParamTable
            params={[
              { name: "title", type: "string | undefined", required: false, desc: "새 제목" },
              { name: "description", type: "string | undefined", required: false, desc: "새 설명" },
              { name: "status", type: "TaskStatus | undefined", required: false, desc: "새 상태" },
              { name: "metadata", type: "Record<string, unknown> | undefined", required: false, desc: "새 메타데이터 (기존 메타데이터와 머지됨)" },
            ]}
          />

          {/* TaskManager class */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class TaskManager
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            작업의 CRUD 및 의존성 추적을 담당하는 메인 클래스입니다.
            내부적으로 <code className="text-cyan-600">Map</code>을 사용하여 빠른 조회를 지원합니다.
          </p>

          {/* Constructor */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            constructor
          </h4>
          <CodeBlock>
            <span className="kw">constructor</span>(<span className="prop">storePath</span>: <span className="type">string</span>)
          </CodeBlock>
          <ParamTable
            params={[
              { name: "storePath", type: "string", required: true, desc: "작업 데이터를 저장할 JSON 파일 경로" },
            ]}
          />

          {/* load */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            load()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            디스크에서 작업 데이터를 로드합니다. 파일이 없으면 빈 상태로 시작합니다.
            인스턴스 생성 후 반드시 호출해야 합니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">load</span>(): <span className="type">Promise</span>{"<"}<span className="type">void</span>{">"}
          </CodeBlock>

          {/* create */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            create(params)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            새 작업을 생성합니다. UUID를 자동 생성하고 초기 상태는 <code className="text-cyan-600">&quot;pending&quot;</code>입니다.
            부모 작업과 의존 작업이 존재하는지 검증합니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">create</span>(<span className="prop">params</span>: <span className="type">CreateTaskParams</span>): <span className="type">Promise</span>{"<"}<span className="type">Task</span>{">"}
          </CodeBlock>

          {/* update */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            update(id, params)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            기존 작업을 수정합니다. <code className="text-cyan-600">&quot;in_progress&quot;</code>로 변경하려면
            모든 의존 작업이 완료 상태여야 합니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">update</span>(<span className="prop">id</span>: <span className="type">string</span>, <span className="prop">params</span>: <span className="type">UpdateTaskParams</span>): <span className="type">Promise</span>{"<"}<span className="type">Task</span>{">"}
          </CodeBlock>

          {/* get */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            get(id)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            ID로 작업을 조회합니다.
          </p>
          <CodeBlock>
            <span className="fn">get</span>(<span className="prop">id</span>: <span className="type">string</span>): <span className="type">Task</span> | <span className="type">undefined</span>
          </CodeBlock>

          {/* getAll / listByStatus */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            getAll() / listByStatus(status)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            모든 작업을 반환하거나 특정 상태의 작업만 필터링합니다.
          </p>
          <CodeBlock>
            <span className="fn">getAll</span>(): <span className="kw">readonly</span> <span className="type">Task</span>[]
            {"\n"}<span className="fn">listByStatus</span>(<span className="prop">status</span>: <span className="type">TaskStatus</span>): <span className="kw">readonly</span> <span className="type">Task</span>[]
          </CodeBlock>

          {/* getChildren / getRootTasks */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            getChildren(parentId) / getRootTasks()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            계층 구조를 탐색합니다. <code className="text-cyan-600">getChildren</code>은 특정 부모의 자식 작업들을,
            <code className="text-cyan-600">getRootTasks</code>는 최상위 작업(부모가 없는 작업)들을 반환합니다.
          </p>
          <CodeBlock>
            <span className="fn">getChildren</span>(<span className="prop">parentId</span>: <span className="type">string</span>): <span className="kw">readonly</span> <span className="type">Task</span>[]
            {"\n"}<span className="fn">getRootTasks</span>(): <span className="kw">readonly</span> <span className="type">Task</span>[]
          </CodeBlock>

          {/* getBlockingDependencies */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            getBlockingDependencies(id)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            아직 완료되지 않은 의존 작업(차단 요소)들을 반환합니다.
            빈 배열이면 해당 작업을 시작할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="fn">getBlockingDependencies</span>(<span className="prop">id</span>: <span className="type">string</span>): <span className="kw">readonly</span> <span className="type">Task</span>[]
          </CodeBlock>

          {/* delete */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            delete(id, cascade?)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            작업을 삭제합니다. <code className="text-cyan-600">cascade</code>가 <code className="text-cyan-600">true</code>이면 자식 작업도 함께 삭제합니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">delete</span>(<span className="prop">id</span>: <span className="type">string</span>, <span className="prop">cascade</span>?: <span className="type">boolean</span>): <span className="type">Promise</span>{"<"}<span className="type">void</span>{">"}
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">load()</code>를 호출하지 않으면 작업 목록이 항상 비어 있습니다.
              인스턴스 생성 후 반드시 <code className="text-cyan-600">load()</code>를 먼저 호출하세요.
            </li>
            <li>
              <code className="text-cyan-600">&quot;in_progress&quot;</code>로 상태를 변경하려면
              모든 의존 작업이 <code className="text-emerald-600">&quot;completed&quot;</code> 상태여야 합니다.
              의존 작업이 미완료이면 <code className="text-cyan-600">TaskError</code>가 발생합니다.
            </li>
            <li>
              <code className="text-cyan-600">delete()</code>에서 <code className="text-cyan-600">cascade = false</code>(기본값)이면
              부모만 삭제되고 자식은 남습니다. 자식의 <code className="text-cyan-600">parentId</code>는 존재하지 않는 ID를 가리키게 되므로 주의하세요.
            </li>
            <li>
              파일 잠금이 없으므로, 같은 파일에 대해 여러 <code className="text-cyan-600">TaskManager</code> 인스턴스가 동시에 쓰면 데이터 경쟁이 발생할 수 있습니다.
            </li>
          </ul>
        </section>
      </RevealOnScroll>

      {/* ─── 3. 사용법 (Usage) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>🚀</span> 사용법
          </h2>

          {/* 기본 사용법 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 작업 생성 및 상태 변경</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            작업을 생성하고 상태를 변경하는 가장 기본적인 패턴입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 1. TaskManager 인스턴스 생성 + 로드"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">tm</span> = <span className="kw">new</span> <span className="fn">TaskManager</span>(<span className="str">&quot;./tasks.json&quot;</span>);
            {"\n"}<span className="kw">await</span> <span className="prop">tm</span>.<span className="fn">load</span>();
            {"\n"}
            {"\n"}<span className="cm">{"// 2. 작업 생성"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">task</span> = <span className="kw">await</span> <span className="prop">tm</span>.<span className="fn">create</span>({"{"}{"\n"}{"  "}<span className="prop">title</span>: <span className="str">&quot;API 엔드포인트 구현&quot;</span>,
            {"\n"}{"  "}<span className="prop">description</span>: <span className="str">&quot;GET /users 엔드포인트 추가&quot;</span>,
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 3. 상태 변경: 대기 → 진행 중"}</span>
            {"\n"}<span className="kw">await</span> <span className="prop">tm</span>.<span className="fn">update</span>(<span className="prop">task</span>.<span className="prop">id</span>, {"{"} <span className="prop">status</span>: <span className="str">&quot;in_progress&quot;</span> {"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 4. 작업 완료"}</span>
            {"\n"}<span className="kw">await</span> <span className="prop">tm</span>.<span className="fn">update</span>(<span className="prop">task</span>.<span className="prop">id</span>, {"{"} <span className="prop">status</span>: <span className="str">&quot;completed&quot;</span> {"}"});
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>new TaskManager()</code> 후에 반드시 <code>await tm.load()</code>를 호출해야 합니다.
            <code>load()</code>를 빠뜨리면 기존 작업이 보이지 않고, 새 작업만 저장됩니다.
            기존 작업 데이터가 덮어써질 수 있으므로 각별히 주의하세요.
          </Callout>

          {/* 의존성 활용 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            의존성을 활용한 작업 순서 보장
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            작업 간 의존 관계를 설정하면, 선행 작업이 완료되어야 다음 작업을 시작할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 1단계: DB 스키마 작업 생성"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">dbTask</span> = <span className="kw">await</span> <span className="prop">tm</span>.<span className="fn">create</span>({"{"}{"\n"}{"  "}<span className="prop">title</span>: <span className="str">&quot;DB 스키마 마이그레이션&quot;</span>,
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 2단계: API 작업 (DB 작업에 의존)"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">apiTask</span> = <span className="kw">await</span> <span className="prop">tm</span>.<span className="fn">create</span>({"{"}{"\n"}{"  "}<span className="prop">title</span>: <span className="str">&quot;API 엔드포인트 구현&quot;</span>,
            {"\n"}{"  "}<span className="prop">dependencies</span>: [<span className="prop">dbTask</span>.<span className="prop">id</span>],
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// DB 작업이 미완료 → API 작업 시작 불가!"}</span>
            {"\n"}<span className="kw">await</span> <span className="prop">tm</span>.<span className="fn">update</span>(<span className="prop">apiTask</span>.<span className="prop">id</span>, {"{"} <span className="prop">status</span>: <span className="str">&quot;in_progress&quot;</span> {"}"}); <span className="cm">{"// TaskError!"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// DB 작업을 먼저 완료"}</span>
            {"\n"}<span className="kw">await</span> <span className="prop">tm</span>.<span className="fn">update</span>(<span className="prop">dbTask</span>.<span className="prop">id</span>, {"{"} <span className="prop">status</span>: <span className="str">&quot;completed&quot;</span> {"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 이제 API 작업 시작 가능"}</span>
            {"\n"}<span className="kw">await</span> <span className="prop">tm</span>.<span className="fn">update</span>(<span className="prop">apiTask</span>.<span className="prop">id</span>, {"{"} <span className="prop">status</span>: <span className="str">&quot;in_progress&quot;</span> {"}"}); <span className="cm">{"// 성공!"}</span>
          </CodeBlock>

          {/* 부모-자식 관계 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 부모-자식 관계로 작업 분해
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            큰 작업을 하위 작업으로 나누어 관리할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 상위 작업 생성"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">parentTask</span> = <span className="kw">await</span> <span className="prop">tm</span>.<span className="fn">create</span>({"{"}{"\n"}{"  "}<span className="prop">title</span>: <span className="str">&quot;사용자 인증 시스템 구현&quot;</span>,
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 하위 작업들 생성"}</span>
            {"\n"}<span className="kw">await</span> <span className="prop">tm</span>.<span className="fn">create</span>({"{"} <span className="prop">title</span>: <span className="str">&quot;로그인 폼 UI&quot;</span>, <span className="prop">parentId</span>: <span className="prop">parentTask</span>.<span className="prop">id</span> {"}"});
            {"\n"}<span className="kw">await</span> <span className="prop">tm</span>.<span className="fn">create</span>({"{"} <span className="prop">title</span>: <span className="str">&quot;JWT 토큰 발급&quot;</span>, <span className="prop">parentId</span>: <span className="prop">parentTask</span>.<span className="prop">id</span> {"}"});
            {"\n"}<span className="kw">await</span> <span className="prop">tm</span>.<span className="fn">create</span>({"{"} <span className="prop">title</span>: <span className="str">&quot;권한 미들웨어&quot;</span>, <span className="prop">parentId</span>: <span className="prop">parentTask</span>.<span className="prop">id</span> {"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 하위 작업 조회"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">children</span> = <span className="prop">tm</span>.<span className="fn">getChildren</span>(<span className="prop">parentTask</span>.<span className="prop">id</span>);
            {"\n"}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">`하위 작업 수: ${"{"}</span><span className="prop">children</span>.<span className="prop">length</span><span className="str">{"}"}`</span>); <span className="cm">{"// 3"}</span>
          </CodeBlock>

          <DeepDive title="불변 상태 관리 패턴">
            <p className="mb-3">
              <code className="text-cyan-600">TaskManager</code>는 내부적으로 작업을 수정할 때
              기존 <code className="text-cyan-600">Map</code>을 직접 변경하지 않고 새로운 <code className="text-cyan-600">Map</code>을 생성합니다:
            </p>
            <CodeBlock>
              <span className="cm">{"// 기존 Map에 set()으로 추가하지 않고, 새 Map을 생성"}</span>
              {"\n"}<span className="kw">this</span>.<span className="prop">tasks</span> = <span className="kw">new</span> <span className="fn">Map</span>([...<span className="kw">this</span>.<span className="prop">tasks</span>, [<span className="prop">id</span>, <span className="prop">updated</span>]]);
            </CodeBlock>
            <p className="mt-3 text-gray-600">
              이 패턴은 기존 참조를 통해 이전 상태에 접근하는 코드가 있더라도
              데이터 일관성이 깨지지 않도록 보장합니다.
              React의 <code className="text-cyan-600">setState</code>에서 이전 상태를 복사한 뒤
              새 객체를 만드는 것과 같은 원리입니다.
            </p>
          </DeepDive>
        </section>
      </RevealOnScroll>

      {/* ─── 4. 내부 구현 (Internals) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>⚙️</span> 내부 구현
          </h2>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>작업 상태 전이 다이어그램</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            작업은 5가지 상태 사이를 전이합니다. 의존 작업이 모두 완료되어야
            <code className="text-cyan-600">&quot;in_progress&quot;</code>로 이동할 수 있습니다.
          </p>

          <MermaidDiagram
            title="Task 상태 전이"
            titleColor="purple"
            chart={`graph TD
  START(("생성")) --> PENDING["Pending<br/><small>대기 중 — 아직 시작 안 함</small>"]
  PENDING -->|"의존 작업 완료 확인"| INPROG["In Progress<br/><small>진행 중</small>"]
  INPROG -->|"성공"| COMPLETED["Completed<br/><small>완료됨</small>"]
  INPROG -->|"실패"| FAILED["Failed<br/><small>실패함</small>"]
  PENDING -->|"사용자 취소"| CANCELLED["Cancelled<br/><small>취소됨</small>"]
  INPROG -->|"사용자 취소"| CANCELLED

  BLOCK["getBlockingDependencies()<br/><small>미완료 의존 작업 확인</small>"] -.-> PENDING

  style PENDING fill:#dbeafe,stroke:#3b82f6,color:#1e293b,stroke-width:2px
  style INPROG fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style COMPLETED fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style FAILED fill:#fee2e2,stroke:#ef4444,color:#991b1b,stroke-width:2px
  style CANCELLED fill:#f1f5f9,stroke:#64748b,color:#1e293b,stroke-width:2px
  style BLOCK fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석 &mdash; 의존성 검증</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">update()</code> 메서드에서 <code className="text-cyan-600">&quot;in_progress&quot;</code>로
            전이할 때 의존성을 검증하는 핵심 로직입니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">update</span>(<span className="prop">id</span>: <span className="type">string</span>, <span className="prop">params</span>: <span className="type">UpdateTaskParams</span>): <span className="type">Promise</span>{"<"}<span className="type">Task</span>{">"} {"{"}
            {"\n"}{"  "}<span className="cm">{"// [1] 작업 존재 확인"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">existing</span> = <span className="kw">this</span>.<span className="prop">tasks</span>.<span className="fn">get</span>(<span className="prop">id</span>);
            {"\n"}{"  "}<span className="kw">if</span> (!<span className="prop">existing</span>) <span className="kw">throw new</span> <span className="fn">TaskError</span>(...);
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [2] 의존성 검증 — in_progress로 변경 시만"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">params</span>.<span className="prop">status</span> === <span className="str">&quot;in_progress&quot;</span>) {"{"}
            {"\n"}{"    "}<span className="kw">const</span> <span className="prop">blockers</span> = <span className="kw">this</span>.<span className="fn">getBlockingDependencies</span>(<span className="prop">id</span>);
            {"\n"}{"    "}<span className="kw">if</span> (<span className="prop">blockers</span>.<span className="prop">length</span> {">"} <span className="num">0</span>) {"{"}
            {"\n"}{"      "}<span className="kw">throw new</span> <span className="fn">TaskError</span>(<span className="str">&quot;Cannot start task: dependencies not complete&quot;</span>);
            {"\n"}{"    "}{"}"}
            {"\n"}{"  "}{"}"}
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [3] 스프레드로 기존 값 복사 + 제공된 필드만 덮어쓰기"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">updated</span>: <span className="type">Task</span> = {"{"} ...<span className="prop">existing</span>, ...<span className="prop">params</span>, <span className="prop">updatedAt</span>: <span className="kw">new</span> <span className="fn">Date</span>().<span className="fn">toISOString</span>() {"}"};
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> 존재하지 않는 작업을 수정하려 하면 즉시 <code className="text-cyan-600">TaskError</code>가 발생합니다.</p>
            <p><strong className="text-gray-900">[2]</strong> <code className="text-cyan-600">&quot;in_progress&quot;</code> 전이 시에만 의존성 검증이 수행됩니다. 다른 상태로의 전이는 제약 없이 허용됩니다.</p>
            <p><strong className="text-gray-900">[3]</strong> 스프레드 연산자로 기존 값을 복사한 뒤, 제공된 필드만 덮어씁니다. <code className="text-cyan-600">updatedAt</code>은 항상 현재 시각으로 갱신됩니다.</p>
          </div>
        </section>
      </RevealOnScroll>

      {/* ─── 5. 트러블슈팅 (Troubleshooting) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>🔧</span> 트러블슈팅
          </h2>

          {/* FAQ 1 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Cannot start task: dependencies not complete 에러가 발생해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              이 작업이 의존하는 다른 작업들이 아직 <code className="text-emerald-600">&quot;completed&quot;</code> 상태가 아닙니다.
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">getBlockingDependencies(taskId)</code>를 호출하여 어떤 의존 작업이 미완료인지 확인하세요.
              </li>
              <li>
                의존 작업을 먼저 <code className="text-emerald-600">&quot;completed&quot;</code>로 변경한 뒤 다시 시도하세요.
              </li>
            </ul>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;load() 후에도 작업이 비어 있어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              JSON 파일 경로가 올바른지 확인하세요. 파일이 존재하지 않으면(ENOENT)
              빈 상태로 시작하는 것이 정상 동작입니다.
              기존 작업 파일이 있다면 경로가 정확한지, 파일이 유효한 JSON인지 확인하세요.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;cascade 삭제 후에도 고아 작업이 남아있어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">cascade</code> 옵션은 직접적인 자식만 삭제합니다.
              손자(grandchild) 이상의 깊은 계층은 재귀적으로 삭제되지 않습니다.
              깊은 트리 구조를 삭제하려면 리프(leaf)부터 순서대로 삭제하세요.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Parent task not found 에러가 발생해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">parentId</code>로 지정한 작업이 존재하지 않습니다.
              부모 작업을 먼저 생성한 뒤 자식 작업을 생성해야 합니다.
              삭제된 작업의 ID를 <code className="text-cyan-600">parentId</code>로 사용하고 있지 않은지 확인하세요.
            </p>
          </div>
        </section>
      </RevealOnScroll>

      {/* ─── 6. 관련 문서 (See Also) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>🔗</span> 관련 문서
          </h2>
          <SeeAlso
            items={[
              {
                name: "agent-loop.ts",
                slug: "agent-loop",
                relation: "parent",
                desc: "에이전트 루프가 작업 도구를 통해 TaskManager를 호출하는 메인 루프",
              },
              {
                name: "session-manager.ts",
                slug: "session-manager",
                relation: "sibling",
                desc: "세션 생명주기 관리 — 작업 데이터와 함께 세션 내에서 유지됨",
              },
              {
                name: "activity.ts",
                slug: "activity-collector",
                relation: "sibling",
                desc: "턴 활동 수집 — 작업 상태 변경도 활동 항목으로 기록됨",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
