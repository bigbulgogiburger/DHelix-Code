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

export default function SubagentTaskListPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/subagents/task-list.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">SharedTaskList</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              여러 서브에이전트가 협업할 때 작업을 조율하는 팀 작업 목록 관리 모듈입니다.
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
                <code className="text-cyan-600">SharedTaskList</code>는 여러 서브에이전트가 하나의
                큰 목표를 달성하기 위해 협업할 때, 누가 어떤 작업을 하고 있는지, 어떤 작업이 먼저
                완료되어야 하는지를 관리하는 공유 태스크 리스트입니다.
              </p>
              <p>
                태스크 생성/조회/수정/완료/실패/취소, 의존성(dependency) 관리, 우선순위(priority)
                기반 정렬, 배타적 잠금(lock), 파일 기반 영속성(persistence)을 지원합니다. 모든 상태
                변경은 불변 업데이트 패턴(immutable update pattern)을 따라 기존 객체를 수정하지 않고
                새 객체를 생성하여 교체합니다.
              </p>
              <p>
                팀 리더 에이전트가 태스크 목록을 생성하고, 각 워커 에이전트가
                <code className="text-cyan-600">getNextAvailableTask()</code>로 할당 가능한 태스크를
                가져가고,
                <code className="text-cyan-600">tryLock()</code>으로 태스크를 잠근 뒤 작업을
                수행하며, 완료 시 <code className="text-cyan-600">completeTask()</code>를 호출하는
                흐름으로 동작합니다.
              </p>
            </div>

            <MermaidDiagram
              title="SharedTaskList 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  LEADER["Team Leader<br/><small>태스크 생성 + 분배</small>"]
  TL["SharedTaskList<br/><small>task-list.ts</small>"]
  W1["Worker Agent A<br/><small>getNextAvailableTask()</small>"]
  W2["Worker Agent B<br/><small>getNextAvailableTask()</small>"]
  W3["Worker Agent C<br/><small>getNextAvailableTask()</small>"]
  DISK["JSON File<br/><small>persist / load</small>"]

  LEADER -->|"createTasks()"| TL
  TL -->|"tryLock + 할당"| W1
  TL -->|"tryLock + 할당"| W2
  TL -->|"tryLock + 할당"| W3
  W1 -->|"completeTask()"| TL
  W2 -->|"completeTask()"| TL
  W3 -->|"failTask()"| TL
  TL -->|"persist()"| DISK

  style TL fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style LEADER fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style W1 fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style W2 fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style W3 fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style DISK fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 팀 프로젝트의 칸반 보드(Kanban board)를 떠올리세요. 리더가
              카드를 만들고, 각 팀원이 자신이 할 카드를 집어가서 작업하고, 완료하면 &quot;Done&quot;
              열로 옮깁니다. 의존성이 걸린 카드는 선행 작업이 끝나야 &quot;To Do&quot; 열로
              이동합니다.
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

            {/* TaskListError class */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class TaskListError
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              태스크 리스트 작업 중 발생하는 에러 클래스입니다.
              <code className="text-cyan-600">BaseError</code>를 확장하며 에러 코드
              <code className="text-cyan-600">&quot;TASK_LIST_ERROR&quot;</code>를 사용합니다.
              태스크를 찾을 수 없을 때 등의 상황에서 throw됩니다.
            </p>
            <CodeBlock>
              <span className="kw">class</span> <span className="type">TaskListError</span>{" "}
              <span className="kw">extends</span> <span className="type">BaseError</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">constructor</span>(<span className="prop">message</span>:{" "}
              <span className="type">string</span>, <span className="prop">context</span>?:{" "}
              <span className="type">Record</span>&lt;<span className="type">string</span>,{" "}
              <span className="type">unknown</span>&gt;)
              {"\n"}
              {"}"}
            </CodeBlock>

            {/* TaskPriority type */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              type TaskPriority
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              태스크의 우선순위 레벨을 나타내는 유니온 타입입니다.
            </p>
            <CodeBlock>
              <span className="kw">type</span> <span className="type">TaskPriority</span> ={" "}
              <span className="str">&quot;critical&quot;</span> |{" "}
              <span className="str">&quot;high&quot;</span> |{" "}
              <span className="str">&quot;medium&quot;</span> |{" "}
              <span className="str">&quot;low&quot;</span>;
            </CodeBlock>
            <div className="text-[13px] text-gray-600 mt-2 space-y-1">
              <p>
                &bull; <code className="text-red-600">&quot;critical&quot;</code> &mdash; 즉시 처리
                필요 (가장 높음, 정렬 순서 0)
              </p>
              <p>
                &bull; <code className="text-amber-600">&quot;high&quot;</code> &mdash; 높은
                우선순위 (정렬 순서 1)
              </p>
              <p>
                &bull; <code className="text-cyan-600">&quot;medium&quot;</code> &mdash; 보통,
                기본값 (정렬 순서 2)
              </p>
              <p>
                &bull; <code className="text-gray-500">&quot;low&quot;</code> &mdash; 낮은 우선순위
                (정렬 순서 3)
              </p>
            </div>

            {/* TaskStatus type */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              type TaskStatus
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              태스크의 현재 상태를 나타내는 유니온 타입입니다.
            </p>
            <CodeBlock>
              <span className="kw">type</span> <span className="type">TaskStatus</span> ={" "}
              <span className="str">&quot;pending&quot;</span> |{" "}
              <span className="str">&quot;in_progress&quot;</span> |{" "}
              <span className="str">&quot;completed&quot;</span>
              {"\n"}
              {"  "}| <span className="str">&quot;failed&quot;</span> |{" "}
              <span className="str">&quot;blocked&quot;</span> |{" "}
              <span className="str">&quot;cancelled&quot;</span>;
            </CodeBlock>
            <div className="text-[13px] text-gray-600 mt-2 space-y-1">
              <p>
                &bull; <code className="text-emerald-600">&quot;pending&quot;</code> &mdash; 대기 중
                (처리 준비 완료)
              </p>
              <p>
                &bull; <code className="text-blue-600">&quot;in_progress&quot;</code> &mdash; 진행
                중
              </p>
              <p>
                &bull; <code className="text-emerald-600">&quot;completed&quot;</code> &mdash; 완료
              </p>
              <p>
                &bull; <code className="text-red-600">&quot;failed&quot;</code> &mdash; 실패
              </p>
              <p>
                &bull; <code className="text-amber-600">&quot;blocked&quot;</code> &mdash; 의존
                태스크가 완료되지 않아 대기 중
              </p>
              <p>
                &bull; <code className="text-gray-500">&quot;cancelled&quot;</code> &mdash; 취소됨
              </p>
            </div>

            {/* SharedTask interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface SharedTask
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              공유 태스크 리스트의 개별 태스크 구조입니다. 모든 속성이{" "}
              <code className="text-cyan-600">readonly</code>인 불변 객체입니다.
            </p>
            <ParamTable
              params={[
                { name: "id", type: "string", required: true, desc: "태스크 고유 식별자 (UUID)" },
                { name: "title", type: "string", required: true, desc: "태스크 제목" },
                { name: "description", type: "string", required: true, desc: "태스크 상세 설명" },
                {
                  name: "priority",
                  type: "TaskPriority",
                  required: true,
                  desc: "우선순위 (critical > high > medium > low)",
                },
                { name: "status", type: "TaskStatus", required: true, desc: "현재 상태" },
                {
                  name: "assignedTo",
                  type: "string | undefined",
                  required: false,
                  desc: "이 태스크를 담당하는 에이전트 ID",
                },
                {
                  name: "dependsOn",
                  type: "readonly string[]",
                  required: false,
                  desc: "이 태스크가 의존하는 다른 태스크들의 ID 목록",
                },
                {
                  name: "createdAt",
                  type: "number",
                  required: true,
                  desc: "생성 시각 (Unix 타임스탬프, 밀리초)",
                },
                { name: "updatedAt", type: "number", required: true, desc: "마지막 수정 시각" },
                {
                  name: "completedAt",
                  type: "number | undefined",
                  required: false,
                  desc: "완료 시각",
                },
                {
                  name: "result",
                  type: "string | undefined",
                  required: false,
                  desc: "완료 결과 텍스트",
                },
                {
                  name: "error",
                  type: "string | undefined",
                  required: false,
                  desc: "실패 시 에러 메시지",
                },
                {
                  name: "metadata",
                  type: "Record<string, unknown>",
                  required: false,
                  desc: "추가 메타데이터 (자유 형식)",
                },
              ]}
            />

            {/* CreateTaskInput interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface CreateTaskInput
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              태스크 생성 시 필요한 입력 데이터입니다. <code className="text-cyan-600">id</code>,
              <code className="text-cyan-600">status</code>,{" "}
              <code className="text-cyan-600">createdAt</code> 등은 자동 생성되므로 입력하지
              않습니다.
            </p>
            <ParamTable
              params={[
                { name: "title", type: "string", required: true, desc: "태스크 제목" },
                { name: "description", type: "string", required: true, desc: "태스크 상세 설명" },
                {
                  name: "priority",
                  type: "TaskPriority | undefined",
                  required: false,
                  desc: '우선순위 (기본값: "medium")',
                },
                {
                  name: "dependsOn",
                  type: "readonly string[]",
                  required: false,
                  desc: "의존하는 태스크 ID 목록 (해당 태스크들이 완료되어야 시작 가능)",
                },
                {
                  name: "metadata",
                  type: "Record<string, unknown>",
                  required: false,
                  desc: "추가 메타데이터",
                },
              ]}
            />

            {/* UpdateTaskInput interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface UpdateTaskInput
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              태스크 수정 시 변경할 필드입니다. 모든 필드가 선택적(optional)이며, 지정한 필드만
              업데이트됩니다. <code className="text-cyan-600">metadata</code>는 기존 값과
              병합됩니다.
            </p>
            <ParamTable
              params={[
                { name: "status", type: "TaskStatus", required: false, desc: "변경할 상태" },
                { name: "assignedTo", type: "string", required: false, desc: "담당 에이전트 ID" },
                { name: "result", type: "string", required: false, desc: "완료 결과 텍스트" },
                { name: "error", type: "string", required: false, desc: "에러 메시지" },
                {
                  name: "metadata",
                  type: "Record<string, unknown>",
                  required: false,
                  desc: "추가 메타데이터 (기존 값과 병합)",
                },
              ]}
            />

            {/* SharedTaskList class */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class SharedTaskList
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              여러 에이전트의 작업을 조율하는 메인 클래스입니다. 태스크 CRUD, 의존성 스케줄링,
              우선순위 정렬, 배타적 잠금, 파일 영속성을 지원합니다.
            </p>

            {/* Constructor */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">constructor</h4>
            <CodeBlock>
              <span className="kw">constructor</span>(<span className="prop">options</span>?: {"{"}{" "}
              <span className="prop">persistPath</span>?: <span className="type">string</span> {"}"}
              )
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "options.persistPath",
                  type: "string | undefined",
                  required: false,
                  desc: "태스크 목록 JSON 파일 저장 경로 (설정하지 않으면 영속화 비활성)",
                },
              ]}
            />

            {/* createTask */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">createTask(input)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              새 태스크를 생성합니다. 의존 태스크가 미완료이면 자동으로 &quot;blocked&quot; 상태로
              생성됩니다.
            </p>
            <CodeBlock>
              <span className="fn">createTask</span>(<span className="prop">input</span>:{" "}
              <span className="type">CreateTaskInput</span>):{" "}
              <span className="type">SharedTask</span>
            </CodeBlock>

            {/* createTasks */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">createTasks(inputs)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              여러 태스크를 한 번에 생성합니다. 내부적으로{" "}
              <code className="text-cyan-600">createTask()</code>를 반복 호출합니다.
            </p>
            <CodeBlock>
              <span className="fn">createTasks</span>(<span className="prop">inputs</span>:{" "}
              <span className="kw">readonly</span> <span className="type">CreateTaskInput</span>[]):{" "}
              <span className="kw">readonly</span> <span className="type">SharedTask</span>[]
            </CodeBlock>

            {/* getTask / getAllTasks / getTasksByStatus / getTasksByPriority */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              getTask(id) / getAllTasks() / getTasksByStatus(status) / getTasksByPriority()
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              태스크를 조회하는 메서드들입니다. ID로 단일 조회, 전체 목록, 상태별 필터링, 우선순위별
              정렬을 지원합니다.
            </p>
            <CodeBlock>
              <span className="fn">getTask</span>(<span className="prop">id</span>:{" "}
              <span className="type">string</span>): <span className="type">SharedTask</span> |{" "}
              <span className="type">undefined</span>
              {"\n"}
              <span className="fn">getAllTasks</span>(): <span className="kw">readonly</span>{" "}
              <span className="type">SharedTask</span>[]
              {"\n"}
              <span className="fn">getTasksByStatus</span>(<span className="prop">status</span>:{" "}
              <span className="type">TaskStatus</span>): <span className="kw">readonly</span>{" "}
              <span className="type">SharedTask</span>[]
              {"\n"}
              <span className="fn">getTasksByPriority</span>(): <span className="kw">readonly</span>{" "}
              <span className="type">SharedTask</span>[]
            </CodeBlock>

            {/* getNextAvailableTask */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              getNextAvailableTask(agentId)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              특정 에이전트가 처리할 수 있는 다음 태스크를 반환합니다. pending 상태 + 잠금 없음 +
              의존성 충족 조건을 만족하는 태스크 중 가장 높은 우선순위를 선택합니다.
            </p>
            <CodeBlock>
              <span className="fn">getNextAvailableTask</span>(<span className="prop">agentId</span>
              : <span className="type">string</span>): <span className="type">SharedTask</span> |{" "}
              <span className="type">undefined</span>
            </CodeBlock>

            {/* tryLock / releaseLock */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              tryLock(taskId, agentId) / releaseLock(taskId, agentId)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              태스크에 대한 배타적 잠금을 시도하거나 해제합니다. 다른 에이전트가 이미 잠금을 보유
              중이면 <code className="text-cyan-600">tryLock</code>은 false를 반환합니다.
            </p>
            <CodeBlock>
              <span className="fn">tryLock</span>(<span className="prop">taskId</span>:{" "}
              <span className="type">string</span>, <span className="prop">agentId</span>:{" "}
              <span className="type">string</span>): <span className="type">boolean</span>
              {"\n"}
              <span className="fn">releaseLock</span>(<span className="prop">taskId</span>:{" "}
              <span className="type">string</span>, <span className="prop">agentId</span>:{" "}
              <span className="type">string</span>): <span className="type">boolean</span>
            </CodeBlock>

            {/* isLocked / getLockHolder */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              isLocked(taskId) / getLockHolder(taskId)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              태스크의 잠금 상태를 확인합니다. <code className="text-cyan-600">isLocked</code>는
              잠금 여부를,
              <code className="text-cyan-600">getLockHolder</code>는 잠금을 보유한 에이전트 ID를
              반환합니다.
            </p>
            <CodeBlock>
              <span className="fn">isLocked</span>(<span className="prop">taskId</span>:{" "}
              <span className="type">string</span>): <span className="type">boolean</span>
              {"\n"}
              <span className="fn">getLockHolder</span>(<span className="prop">taskId</span>:{" "}
              <span className="type">string</span>): <span className="type">string</span> |{" "}
              <span className="type">undefined</span>
            </CodeBlock>

            {/* updateTask */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">updateTask(id, update)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              태스크를 업데이트합니다. 불변 패턴으로 새 객체를 생성하여 교체합니다.
              &quot;completed&quot;로 변경 시 의존 태스크의 자동 승격이 트리거됩니다.
            </p>
            <CodeBlock>
              <span className="fn">updateTask</span>(<span className="prop">id</span>:{" "}
              <span className="type">string</span>, <span className="prop">update</span>:{" "}
              <span className="type">UpdateTaskInput</span>):{" "}
              <span className="type">SharedTask</span>
            </CodeBlock>

            {/* completeTask / failTask */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              completeTask(id, result) / failTask(id, error)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              태스크를 완료 또는 실패 처리합니다. 완료 시 의존 태스크가 자동으로 &quot;blocked&quot;
              &rarr; &quot;pending&quot;으로 승격됩니다.
            </p>
            <CodeBlock>
              <span className="fn">completeTask</span>(<span className="prop">id</span>:{" "}
              <span className="type">string</span>, <span className="prop">result</span>:{" "}
              <span className="type">string</span>): <span className="type">SharedTask</span>
              {"\n"}
              <span className="fn">failTask</span>(<span className="prop">id</span>:{" "}
              <span className="type">string</span>, <span className="prop">error</span>:{" "}
              <span className="type">string</span>): <span className="type">SharedTask</span>
            </CodeBlock>

            {/* cancelTask */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">cancelTask(id)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              태스크를 취소하고 이 태스크에 의존하는 모든 태스크를 연쇄적으로 취소합니다 (전이적
              취소).
            </p>
            <CodeBlock>
              <span className="fn">cancelTask</span>(<span className="prop">id</span>:{" "}
              <span className="type">string</span>): <span className="kw">readonly</span>{" "}
              <span className="type">SharedTask</span>[]
            </CodeBlock>

            {/* persist / load */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">persist() / load()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              태스크 리스트를 JSON 파일로 저장하거나 복원합니다. persistPath가 설정되어 있을 때만
              동작합니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">persist</span>():{" "}
              <span className="type">Promise</span>&lt;<span className="type">void</span>&gt;
              {"\n"}
              <span className="kw">async</span> <span className="fn">load</span>():{" "}
              <span className="type">Promise</span>&lt;<span className="type">void</span>&gt;
            </CodeBlock>

            {/* getStats */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">getStats()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              태스크 리스트의 통계 요약을 반환합니다. 각 상태별 태스크 수와 전체 수를 포함합니다.
            </p>
            <CodeBlock>
              <span className="fn">getStats</span>(): {"{"} <span className="prop">total</span>:{" "}
              <span className="type">number</span>; <span className="prop">pending</span>:{" "}
              <span className="type">number</span>; <span className="prop">inProgress</span>:{" "}
              <span className="type">number</span>;{"\n"}
              {"  "}
              <span className="prop">completed</span>: <span className="type">number</span>;{" "}
              <span className="prop">failed</span>: <span className="type">number</span>;{" "}
              <span className="prop">blocked</span>: <span className="type">number</span>;{" "}
              <span className="prop">cancelled</span>: <span className="type">number</span> {"}"}
            </CodeBlock>

            {/* areDependenciesMet / getDependentTasks */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              areDependenciesMet(taskId) / getDependentTasks(taskId)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              의존성 관련 유틸리티입니다. <code className="text-cyan-600">areDependenciesMet</code>
              는 모든 의존 태스크가 완료되었는지 확인하고,{" "}
              <code className="text-cyan-600">getDependentTasks</code>는 특정 태스크에 의존하는
              태스크들을 찾습니다.
            </p>
            <CodeBlock>
              <span className="fn">areDependenciesMet</span>(<span className="prop">taskId</span>:{" "}
              <span className="type">string</span>): <span className="type">boolean</span>
              {"\n"}
              <span className="fn">getDependentTasks</span>(<span className="prop">taskId</span>:{" "}
              <span className="type">string</span>): <span className="kw">readonly</span>{" "}
              <span className="type">SharedTask</span>[]
            </CodeBlock>

            {/* clear */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">clear()</h4>
            <p className="text-[13px] text-gray-600 mb-3">모든 태스크와 잠금을 제거합니다.</p>
            <CodeBlock>
              <span className="fn">clear</span>(): <span className="type">void</span>
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">tryLock()</code>은 단일 프로세스 내에서만
                유효합니다. 멀티 프로세스 환경에서는 파일 기반 잠금을 별도로 구현해야 합니다.
              </li>
              <li>
                <code className="text-cyan-600">cancelTask()</code>는 전이적 취소(transitive
                cancellation)를 수행합니다. 태스크 A를 취소하면 A에 의존하는 B, B에 의존하는 C도
                연쇄 취소됩니다.
              </li>
              <li>
                <code className="text-cyan-600">load()</code> 호출 시 기존 메모리 내 데이터와 잠금이
                모두 초기화됩니다. 파일에는 잠금 정보가 저장되지 않으므로 복원 후 잠금은
                비어있습니다.
              </li>
              <li>
                우선순위 정렬 순서는{" "}
                <code className="text-cyan-600">
                  critical(0) &gt; high(1) &gt; medium(2) &gt; low(3)
                </code>
                으로 하드코딩되어 있어 외부에서 변경할 수 없습니다.
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
              기본 사용법 &mdash; 팀 협업 태스크 관리
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              팀 리더가 태스크를 생성하고, 워커 에이전트가 가져가 처리하는 기본 흐름입니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 1. 태스크 리스트 생성 (영속화 경로 지정)"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">taskList</span> ={" "}
              <span className="kw">new</span> <span className="fn">SharedTaskList</span>({"{"}{" "}
              <span className="prop">persistPath</span>:{" "}
              <span className="str">&quot;/tmp/tasks.json&quot;</span> {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// 2. 리더가 태스크를 생성"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">tasks</span> ={" "}
              <span className="prop">taskList</span>.<span className="fn">createTasks</span>([
              {"\n"}
              {"  "}
              {"{"} <span className="prop">title</span>:{" "}
              <span className="str">&quot;API 설계&quot;</span>,{" "}
              <span className="prop">description</span>:{" "}
              <span className="str">&quot;REST 엔드포인트 정의&quot;</span>,{" "}
              <span className="prop">priority</span>:{" "}
              <span className="str">&quot;critical&quot;</span> {"}"},{"\n"}
              {"  "}
              {"{"} <span className="prop">title</span>:{" "}
              <span className="str">&quot;구현&quot;</span>,{" "}
              <span className="prop">description</span>:{" "}
              <span className="str">&quot;핸들러 작성&quot;</span>,{" "}
              <span className="prop">dependsOn</span>: [<span className="prop">tasks</span>[
              <span className="num">0</span>].<span className="prop">id</span>] {"}"},{"\n"}]);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 3. 워커가 다음 태스크를 가져감"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">next</span> ={" "}
              <span className="prop">taskList</span>.
              <span className="fn">getNextAvailableTask</span>(
              <span className="str">&quot;worker-a&quot;</span>);
              {"\n"}
              <span className="kw">if</span> (<span className="prop">next</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="prop">taskList</span>.<span className="fn">tryLock</span>(
              <span className="prop">next</span>.<span className="prop">id</span>,{" "}
              <span className="str">&quot;worker-a&quot;</span>);
              {"\n"}
              {"  "}
              <span className="cm">{"// ... 작업 수행 ..."}</span>
              {"\n"}
              {"  "}
              <span className="prop">taskList</span>.<span className="fn">completeTask</span>(
              <span className="prop">next</span>.<span className="prop">id</span>,{" "}
              <span className="str">&quot;API 설계 완료&quot;</span>);
              {"\n"}
              {"}"}
              {"\n"}
              {"\n"}
              <span className="cm">{"// 4. 영속화"}</span>
              {"\n"}
              <span className="kw">await</span> <span className="prop">taskList</span>.
              <span className="fn">persist</span>();
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>createTasks()</code>에서 의존성 있는 태스크를 생성할 때,
              의존 대상 태스크의 ID는 이미 생성된 태스크에서만 참조할 수 있습니다. 아직 생성되지
              않은 태스크 ID를 <code>dependsOn</code>에 넣으면 영원히 &quot;blocked&quot; 상태에
              머뭅니다.
            </Callout>

            {/* 고급 사용법: 의존성 관리 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 의존성 기반 자동 승격
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              태스크 A가 완료되면 A에 의존하던 &quot;blocked&quot; 태스크들이 자동으로
              &quot;pending&quot;으로 승격됩니다. 이 과정은{" "}
              <code className="text-cyan-600">completeTask()</code>
              내부에서 자동으로 수행됩니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 태스크 A: 선행 작업"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">taskA</span> ={" "}
              <span className="prop">taskList</span>.<span className="fn">createTask</span>({"{"}{" "}
              <span className="prop">title</span>:{" "}
              <span className="str">&quot;DB 스키마&quot;</span>,{" "}
              <span className="prop">description</span>:{" "}
              <span className="str">&quot;...&quot;</span> {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// 태스크 B: A에 의존 → 자동으로 'blocked' 상태로 생성"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">taskB</span> ={" "}
              <span className="prop">taskList</span>.<span className="fn">createTask</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">title</span>:{" "}
              <span className="str">&quot;마이그레이션&quot;</span>,{" "}
              <span className="prop">description</span>:{" "}
              <span className="str">&quot;...&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">dependsOn</span>: [<span className="prop">taskA</span>.
              <span className="prop">id</span>],
              {"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// taskB.status === 'blocked'"}</span>
              {"\n"}
              <span className="prop">taskList</span>.<span className="fn">completeTask</span>(
              <span className="prop">taskA</span>.<span className="prop">id</span>,{" "}
              <span className="str">&quot;스키마 완료&quot;</span>);
              {"\n"}
              <span className="cm">{"// → taskB가 자동으로 'pending'으로 승격!"}</span>
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> <code>getStats()</code>로 전체 진행 상황을 한눈에 파악할 수
              있습니다.
              <code className="text-cyan-600">blocked</code> 수가 줄어들지 않으면 의존성 순환이나
              실패한 선행 태스크가 있는지 확인하세요.
            </Callout>

            <DeepDive title="전이적 취소(Transitive Cancellation)의 동작">
              <p className="mb-3">
                <code className="text-cyan-600">cancelTask()</code>는 BFS(너비 우선 탐색)로 취소
                대상을 전파합니다. 태스크 A &rarr; B &rarr; C 의존 체인에서 A를 취소하면 B와 C도
                함께 취소됩니다.
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>이미 &quot;cancelled&quot; 상태인 태스크는 중복 처리하지 않습니다.</li>
                <li>취소된 태스크의 잠금(lock)도 자동으로 해제됩니다.</li>
                <li>반환값에는 원래 태스크와 연쇄 취소된 모든 태스크가 포함됩니다.</li>
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
              태스크 상태 전이 다이어그램
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              태스크는 6가지 상태 사이를 전이합니다. 의존성이 충족되면 자동으로
              <code className="text-emerald-600">&quot;blocked&quot;</code>에서
              <code className="text-cyan-600">&quot;pending&quot;</code>으로 승격됩니다.
            </p>

            <MermaidDiagram
              title="SharedTask 상태 전이"
              titleColor="purple"
              chart={`graph TD
  CREATE(("생성")) --> PENDING["pending<br/><small>대기 중</small>"]
  CREATE -->|"의존성 미충족"| BLOCKED["blocked<br/><small>선행 작업 대기</small>"]
  BLOCKED -->|"의존 태스크 완료"| PENDING
  PENDING -->|"updateTask(in_progress)"| INPROG["in_progress<br/><small>진행 중</small>"]
  INPROG -->|"completeTask()"| DONE["completed<br/><small>완료</small>"]
  INPROG -->|"failTask()"| FAILED["failed<br/><small>실패</small>"]
  PENDING -->|"cancelTask()"| CANCELLED["cancelled<br/><small>취소됨</small>"]
  BLOCKED -->|"cancelTask()"| CANCELLED
  INPROG -->|"cancelTask()"| CANCELLED

  style PENDING fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f,stroke-width:2px
  style BLOCKED fill:#fef3c7,stroke:#f59e0b,color:#78350f,stroke-width:2px
  style INPROG fill:#e0e7ff,stroke:#6366f1,color:#312e81,stroke-width:2px
  style DONE fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style FAILED fill:#fee2e2,stroke:#ef4444,color:#991b1b,stroke-width:2px
  style CANCELLED fill:#f1f5f9,stroke:#64748b,color:#334155,stroke-width:2px`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석 &mdash; getNextAvailableTask
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              워커 에이전트가 다음 처리할 태스크를 선택하는 핵심 로직입니다. 세 가지 필터 조건을
              통과한 후 우선순위로 정렬합니다.
            </p>
            <CodeBlock>
              <span className="fn">getNextAvailableTask</span>(<span className="prop">agentId</span>
              : <span className="type">string</span>): <span className="type">SharedTask</span> |{" "}
              <span className="type">undefined</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">candidates</span> = [...
              <span className="kw">this</span>.<span className="prop">tasks</span>.
              <span className="fn">values</span>()]
              {"\n"}
              {"    "}.<span className="fn">filter</span>((<span className="prop">t</span>) {"=>"}{" "}
              {"{"}
              {"\n"}
              {"      "}
              <span className="cm">{"// [1] 대기 중인 태스크만 대상"}</span>
              {"\n"}
              {"      "}
              <span className="kw">if</span> (<span className="prop">t</span>.
              <span className="prop">status</span> !=={" "}
              <span className="str">&quot;pending&quot;</span>) <span className="kw">return</span>{" "}
              <span className="kw">false</span>;{"\n"}
              {"      "}
              <span className="cm">{"// [2] 다른 에이전트가 잠금 보유 중이면 제외"}</span>
              {"\n"}
              {"      "}
              <span className="kw">const</span> <span className="prop">lockHolder</span> ={" "}
              <span className="kw">this</span>.<span className="prop">locks</span>.
              <span className="fn">get</span>(<span className="prop">t</span>.
              <span className="prop">id</span>);
              {"\n"}
              {"      "}
              <span className="kw">if</span> (<span className="prop">lockHolder</span> &&{" "}
              <span className="prop">lockHolder</span> !== <span className="prop">agentId</span>){" "}
              <span className="kw">return</span> <span className="kw">false</span>;{"\n"}
              {"      "}
              <span className="cm">{"// [3] 의존 태스크가 모두 완료되었는지 확인"}</span>
              {"\n"}
              {"      "}
              <span className="kw">if</span> (!<span className="kw">this</span>.
              <span className="fn">areDependenciesMet</span>(<span className="prop">t</span>.
              <span className="prop">id</span>)) <span className="kw">return</span>{" "}
              <span className="kw">false</span>;{"\n"}
              {"      "}
              <span className="kw">return</span> <span className="kw">true</span>;{"\n"}
              {"    "}
              {"}"}){"\n"}
              {"    "}
              <span className="cm">{"// [4] 우선순위 순 정렬 (critical 먼저)"}</span>
              {"\n"}
              {"    "}.<span className="fn">sort</span>((<span className="prop">a</span>,{" "}
              <span className="prop">b</span>) {"=>"} <span className="prop">PRIORITY_ORDER</span>[
              <span className="prop">a</span>.<span className="prop">priority</span>] -{" "}
              <span className="prop">PRIORITY_ORDER</span>[<span className="prop">b</span>.
              <span className="prop">priority</span>]);
              {"\n"}
              {"  "}
              <span className="kw">return</span> <span className="prop">candidates</span>[
              <span className="num">0</span>];
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> &quot;pending&quot; 상태가 아닌
                태스크(진행 중, 완료, 차단 등)는 할당 대상에서 제외합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> 다른 에이전트가 이미 잠금을 보유한
                태스크는 제외합니다. 본인이 잠근 태스크는 통과합니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 모든 의존 태스크가
                &quot;completed&quot; 상태인지 확인합니다. 미충족이면 제외합니다.
              </p>
              <p>
                <strong className="text-gray-900">[4]</strong> 필터를 통과한 후보를 우선순위 순으로
                정렬하여 첫 번째 항목을 반환합니다.
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
                &quot;getNextAvailableTask()가 항상 undefined를 반환해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                세 가지 가능성을 확인하세요:
              </p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  <strong>모든 태스크가 &quot;blocked&quot; 상태:</strong> 의존 태스크가 아직
                  완료되지 않았습니다.
                  <code className="text-cyan-600">areDependenciesMet()</code>으로 의존성 충족 여부를
                  확인하세요.
                </li>
                <li>
                  <strong>다른 에이전트가 잠금 보유:</strong>{" "}
                  <code className="text-cyan-600">getLockHolder()</code>로 누가 잠금을 보유 중인지
                  확인하세요.
                </li>
                <li>
                  <strong>&quot;pending&quot; 상태의 태스크가 없음:</strong>{" "}
                  <code className="text-cyan-600">getTasksByStatus(&quot;pending&quot;)</code>으로
                  확인하세요.
                </li>
              </ul>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;태스크가 영원히 blocked 상태에 머물러요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                의존 태스크가 &quot;completed&quot;가 아닌 다른 상태(failed, cancelled 등)로
                전이되었을 수 있습니다.
                <code className="text-cyan-600">promoteBlockedDependents()</code>는{" "}
                <strong>completed일 때만</strong>
                호출되므로, 실패한 태스크에 의존하는 태스크는 자동 승격되지 않습니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;load() 후 잠금 상태가 사라졌어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                잠금(lock) 정보는 파일에 저장되지 않습니다.{" "}
                <code className="text-cyan-600">persist()</code>는 태스크 데이터만 직렬화하며,
                잠금은 메모리 내 <code className="text-cyan-600">Map</code>에만 존재합니다.
                <code className="text-cyan-600">load()</code> 호출 시{" "}
                <code className="text-cyan-600">locks.clear()</code>가 실행되어 모든 잠금이
                초기화됩니다.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;cancelTask() 호출 후 예상보다 많은 태스크가 취소되었어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">cancelTask()</code>는 전이적 취소를 수행합니다. 의존
                체인을 따라 연쇄적으로 취소되므로, 의존 그래프를 사전에 확인하는 것이 좋습니다.
                <code className="text-cyan-600">getDependentTasks(id)</code>로 어떤 태스크가
                영향받는지 미리 확인할 수 있습니다.
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
                  name: "shared-state.ts",
                  slug: "shared-state",
                  relation: "sibling",
                  desc: "워커 에이전트 간 키-값 저장소, 메시지 큐, 진행도 추적을 제공하는 공유 상태 모듈",
                },
                {
                  name: "definition-loader.ts",
                  slug: "definition-loader",
                  relation: "sibling",
                  desc: "에이전트 정의 파일(.md)을 파싱하고 로드하는 모듈",
                },
                {
                  name: "agent-memory.ts",
                  slug: "agent-memory-sub",
                  relation: "sibling",
                  desc: "서브에이전트의 영속적 메모리를 관리하는 모듈",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
