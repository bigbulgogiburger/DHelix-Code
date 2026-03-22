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

export default function ActivityFeedPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/cli/components/ActivityFeed.tsx" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">ActivityFeed</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="cli" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              Progressive Static Flushing으로 완료된 항목은 재렌더링 없이 고정하고, 진행 중인 항목만
              동적으로 렌더링하는 대화 피드 컴포넌트입니다.
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
                <code className="text-cyan-600">ActivityFeed</code>는 CLI 화면에 대화의 모든 활동을
                시간순으로 표시하는 핵심 UI 컴포넌트입니다. 사용자 메시지, AI 응답, 도구 호출 결과,
                에러 메시지 등 에이전트 루프에서 발생하는 모든 이벤트를 하나의 피드로 렌더링합니다.
              </p>
              <p>
                터미널 환경에서 대화가 길어지면 수백 개의 항목이 쌓이는데, 이를 매번 전부 다시
                그리면 심각한 깜빡임(flickering)이 발생합니다. 이 컴포넌트는{" "}
                <strong>Progressive Static Flushing</strong> 패턴을 사용하여, 완료된 항목은 Ink의{" "}
                <code className="text-cyan-600">&lt;Static&gt;</code> 컴포넌트로 이동시켜 한 번만
                렌더링하고 다시 그리지 않습니다. 진행 중인 항목(스트리밍 텍스트, 실행 중인 도구)만
                동적 영역에서 실시간 업데이트됩니다.
              </p>
              <p>
                추가로, 연속된 파일 읽기 도구 호출을 하나의 그룹으로 묶어 &quot;Read 5
                files&quot;처럼 간결하게 표시하는{" "}
                <code className="text-cyan-600">groupConsecutiveReads()</code> 유틸리티도 함께
                제공합니다. <code className="text-cyan-600">App.tsx</code>가 유일한 소비자이며,
                <code className="text-cyan-600">React.memo</code>로 감싸져 불필요한 렌더링을 추가로
                방지합니다.
              </p>
            </div>

            <MermaidDiagram
              title="ActivityFeed 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  APP["App.tsx<br/><small>CLI 엔트리포인트</small>"]
  AF["ActivityFeed<br/><small>ActivityFeed.tsx</small>"]
  UAL["useAgentLoop<br/><small>hooks/useAgentLoop.ts</small>"]
  TCB["ToolCallBlock<br/><small>ToolCallBlock.tsx</small>"]
  RGB["ReadGroupBlock<br/><small>ReadGroupBlock.tsx</small>"]
  SM["StreamingMessage<br/><small>StreamingMessage.tsx</small>"]
  TB["ThinkingBlock<br/><small>ThinkingBlock.tsx</small>"]
  ACT["ActivityCollector<br/><small>core/activity.ts</small>"]

  APP -->|"completedTurns, currentTurn"| AF
  UAL -->|"턴 데이터 공급"| APP
  ACT -->|"TurnActivity 생성"| UAL
  AF -->|"도구 호출 렌더링"| TCB
  AF -->|"파일 읽기 그룹"| RGB
  AF -->|"AI 텍스트 스트리밍"| SM
  AF -->|"사고 과정 표시"| TB

  style AF fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style APP fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style UAL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style TCB fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style RGB fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style SM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TB fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style ACT fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 채팅 앱의 메시지 목록을 떠올리세요. 이미 읽은 메시지는 화면에
              &quot;고정&quot;되어 스크롤해도 다시 그려지지 않고, 새로 도착하는 메시지만 실시간으로
              업데이트됩니다. ActivityFeed도 동일한 원리로, 완료된 항목은 Static 영역에
              &quot;고정&quot;하고 진행 중인 항목만 동적으로 렌더링합니다.
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

            {/* ActivityFeedProps interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface ActivityFeedProps
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              ActivityFeed 컴포넌트가 받는 Props입니다.
              <code className="text-cyan-600">App.tsx</code>에서 전달하며, 모든 프로퍼티는{" "}
              <code className="text-cyan-600">readonly</code>입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "completedTurns",
                  type: "readonly TurnActivity[]",
                  required: true,
                  desc: "완료된 대화 턴 목록. Static 영역에 한 번만 렌더링됩니다.",
                },
                {
                  name: "currentTurn",
                  type: "TurnActivity | null",
                  required: false,
                  desc: "현재 진행 중인 턴. 동적 영역에서 실시간 업데이트됩니다.",
                },
                {
                  name: "isExpanded",
                  type: "boolean",
                  required: false,
                  desc: "true이면 도구 출력을 확장 표시합니다. Ctrl+O로 토글합니다.",
                },
              ]}
            />

            {/* groupConsecutiveReads function */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              groupConsecutiveReads(entries)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              연속된 <code className="text-cyan-600">file_read</code> 도구 완료 항목을 하나의
              그룹으로 묶어 간결하게 표시합니다. 2개 이상 연속되면{" "}
              <code className="text-cyan-600">read-group</code>
              타입으로 변환하고, 1개뿐이면 개별 항목 그대로 유지합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">groupConsecutiveReads</span>
              ({"\n"}
              {"  "}
              <span className="prop">entries</span>: <span className="kw">readonly</span>{" "}
              <span className="type">ActivityEntry</span>[]
              {"\n"}): <span className="kw">readonly</span> (
              <span className="type">ActivityEntry</span> | {"{"} <span className="prop">type</span>
              : <span className="str">&quot;read-group&quot;</span>;{" "}
              <span className="prop">entries</span>: <span className="kw">readonly</span>{" "}
              <span className="type">ActivityEntry</span>[] {"}"})[]
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "entries",
                  type: "readonly ActivityEntry[]",
                  required: true,
                  desc: "그룹화할 활동 항목 배열. tool-complete 중 name이 'file_read'인 항목이 대상입니다.",
                },
              ]}
            />
            <div className="text-[13px] text-gray-600 mt-2 space-y-1">
              <p>
                &bull; 반환값에는 원본 <code className="text-cyan-600">ActivityEntry</code>와{" "}
                <code className="text-cyan-600">read-group</code> 객체가 섞여 있습니다.
              </p>
              <p>
                &bull; 연속되지 않은 file_read는 그룹화되지 않습니다. (중간에 다른 항목이 끼면 별도
                그룹)
              </p>
            </div>

            {/* ActivityFeed component */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              ActivityFeed (React.memo)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              Progressive Static Flushing을 사용하는 메인 컴포넌트입니다.
              <code className="text-cyan-600">React.memo</code>로 감싸져 있어 props가 변경되지
              않으면 리렌더링을 건너뜁니다.
            </p>
            <CodeBlock>
              <span className="kw">export const</span> <span className="fn">ActivityFeed</span> ={" "}
              <span className="type">React</span>.<span className="fn">memo</span>(
              <span className="kw">function</span> <span className="fn">ActivityFeed</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">completedTurns</span>,{"\n"}
              {"  "}
              <span className="prop">currentTurn</span>,{"\n"}
              {"  "}
              <span className="prop">isExpanded</span>,{"\n"}
              {"}"}: <span className="type">ActivityFeedProps</span>)
            </CodeBlock>

            {/* 내부 상태 변수 */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">내부 상태 변수</h4>
            <ParamTable
              params={[
                {
                  name: "nextIdRef",
                  type: "useRef<number>",
                  required: true,
                  desc: "단조 증가 ID 생성기. Static 항목의 고유 키로 사용됩니다.",
                },
                {
                  name: "flushedSetRef",
                  type: "useRef<WeakSet<ActivityEntry>>",
                  required: true,
                  desc: "이미 Static으로 플러시한 항목을 추적. WeakSet이므로 원본 객체가 GC되면 자동 정리됩니다.",
                },
                {
                  name: "processedTurnCountRef",
                  type: "useRef<number>",
                  required: true,
                  desc: "처리 완료한 completedTurns 수. 새 턴만 선별적으로 플러시하기 위해 사용합니다.",
                },
                {
                  name: "staticItems",
                  type: "useState<FlushedItem[]>",
                  required: true,
                  desc: "Static 영역에 렌더링할 항목 배열. append-only로 절대 줄어들지 않습니다.",
                },
              ]}
            />

            {/* Entry Types */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">지원하는 Entry 타입</h4>
            <div className="text-[13px] text-gray-600 space-y-1">
              <p>
                &bull; <code className="text-emerald-600">&quot;user-message&quot;</code> &mdash;
                사용자 입력 (초록색 &quot;&gt;&quot; 프롬프트)
              </p>
              <p>
                &bull; <code className="text-emerald-600">&quot;assistant-text&quot;</code> &mdash;
                AI 응답 텍스트 (StreamingMessage로 렌더링)
              </p>
              <p>
                &bull; <code className="text-emerald-600">&quot;assistant-intermediate&quot;</code>{" "}
                &mdash; 도구 호출 사이의 중간 AI 텍스트
              </p>
              <p>
                &bull; <code className="text-emerald-600">&quot;thinking&quot;</code> &mdash; AI
                사고 과정 (ThinkingBlock으로 렌더링)
              </p>
              <p>
                &bull; <code className="text-emerald-600">&quot;tool-start&quot;</code> &mdash; 도구
                실행 시작
              </p>
              <p>
                &bull; <code className="text-emerald-600">&quot;tool-complete&quot;</code> &mdash;
                도구 실행 완료
              </p>
              <p>
                &bull; <code className="text-emerald-600">&quot;tool-denied&quot;</code> &mdash;
                도구 실행 권한 거부
              </p>
              <p>
                &bull; <code className="text-emerald-600">&quot;error&quot;</code> &mdash; 에러 발생
                (빨간색 텍스트)
              </p>
              <p>
                &bull; <code className="text-emerald-600">&quot;read-group&quot;</code> &mdash;
                그룹화된 파일 읽기 (ReadGroupBlock으로 렌더링)
              </p>
            </div>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">staticItems</code>는 <strong>append-only</strong>
                입니다. 한 번 Static 영역에 플러시된 항목은 제거하거나 수정할 수 없습니다. 터미널
                스크롤 안정성을 위한 의도적 설계입니다.
              </li>
              <li>
                <code className="text-cyan-600">flushedSetRef</code>는{" "}
                <code className="text-cyan-600">WeakSet</code>을 사용하므로, 객체의{" "}
                <strong>참조 동일성(identity)</strong>으로 중복을 판단합니다. 같은 내용이라도 새
                객체면 중복으로 인식되지 않습니다.
              </li>
              <li>
                <code className="text-cyan-600">isExpanded</code>가 변경되어도 이미 Static으로
                플러시된 항목의 확장/축소 상태는 바뀌지 않습니다. 플러시 시점의{" "}
                <code className="text-cyan-600">isExpanded</code>
                값이 영구적으로 적용됩니다.
              </li>
              <li>
                <code className="text-cyan-600">liveEntries</code>는{" "}
                <code className="text-cyan-600">useMemo</code>로 계산되며,{" "}
                <code className="text-cyan-600">staticItems</code>가 변경될 때마다 재계산됩니다.
                플러시 직후 동적 영역에서 해당 항목이 즉시 사라집니다.
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
              기본 사용법 &mdash; App.tsx에서 사용하기
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">App.tsx</code>가 유일한 소비자입니다.
              <code className="text-cyan-600">useAgentLoop</code> 훅에서 반환된 턴 데이터를 그대로
              전달합니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"} <span className="type">ActivityFeed</span>{" "}
              {"}"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./components/ActivityFeed.js&quot;</span>;{"\n"}
              <span className="kw">import</span> {"{"} <span className="fn">useAgentLoop</span>{" "}
              {"}"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./hooks/useAgentLoop.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="kw">function</span> <span className="fn">App</span>() {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// useAgentLoop에서 턴 데이터를 받아옴"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> {"{"} <span className="prop">completedTurns</span>,{" "}
              <span className="prop">liveTurn</span> {"}"} ={" "}
              <span className="fn">useAgentLoop</span>(<span className="prop">config</span>);
              {"\n"}
              {"\n"}
              {"  "}
              <span className="kw">return</span> ({"\n"}
              {"    "}
              <span className="cm">{"// completedTurns → Static 영역, liveTurn → 동적 영역"}</span>
              {"\n"}
              {"    "}&lt;<span className="type">ActivityFeed</span>
              {"\n"}
              {"      "}
              <span className="prop">completedTurns</span>={"{"}
              <span className="prop">completedTurns</span>
              {"}"}
              {"\n"}
              {"      "}
              <span className="prop">currentTurn</span>={"{"}
              <span className="prop">liveTurn</span>
              {"}"}
              {"\n"}
              {"      "}
              <span className="prop">isExpanded</span>={"{"}
              <span className="prop">isVerbose</span>
              {"}"}
              {"\n"}
              {"    "}
              {"/>"}
              {"\n"}
              {"  "});
              {"\n"}
              {"}"}
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>completedTurns</code> 배열에 이미 포함된 턴 객체를
              변경(mutate)하면 WeakSet 기반 중복 방지가 깨질 수 있습니다. 항상 새 턴 객체를
              추가하고, 기존 객체는 수정하지 마세요.
            </Callout>

            {/* 고급: groupConsecutiveReads */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; groupConsecutiveReads 활용
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              파일 읽기가 여러 번 연속되면 하나의 블록으로 그룹화하여 화면을 간결하게 만듭니다.
              내부의 <code className="text-cyan-600">renderEntry()</code> 함수가 이 그룹을
              <code className="text-cyan-600">ReadGroupBlock</code>으로 렌더링합니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"}{" "}
              <span className="fn">groupConsecutiveReads</span> {"}"}{" "}
              <span className="kw">from</span>{" "}
              <span className="str">&quot;./components/ActivityFeed.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 5개의 연속 file_read가 포함된 entries"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">grouped</span> ={" "}
              <span className="fn">groupConsecutiveReads</span>(
              <span className="prop">entries</span>);
              {"\n"}
              {"\n"}
              <span className="cm">
                {
                  "// 결과: [user-msg, assistant-text, { type: 'read-group', entries: [...5개] }, tool-start, ...]"
                }
              </span>
              {"\n"}
              <span className="cm">{"// → 5개의 개별 항목 대신 1개의 그룹으로 표시"}</span>
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> <code>groupConsecutiveReads</code>는 <code>tool-complete</code>{" "}
              타입 중<code>name</code>이 <code>&quot;file_read&quot;</code>인 항목만 그룹화합니다.
              <code>tool-start</code>나 다른 도구의 <code>tool-complete</code>는 영향받지 않습니다.
            </Callout>

            {/* 고급: isExpanded 토글 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; Verbose 모드 토글 (Ctrl+O)
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">isExpanded</code>를{" "}
              <code className="text-cyan-600">true</code>로 설정하면 도구 호출의 입출력 상세 내용과
              사고 과정이 확장됩니다. 사용자는 <strong>Ctrl+O</strong>로 이 값을 토글할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// isExpanded=false (기본): 간결한 한 줄 표시"}</span>
              {"\n"}
              <span className="str">⏺ Read src/core/agent-loop.ts (245 lines)</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// isExpanded=true (Ctrl+O): 상세 내용 확장"}</span>
              {"\n"}
              <span className="str">⏺ Read src/core/agent-loop.ts (245 lines)</span>
              {"\n"}
              <span className="str">
                {"  "}1│ import {"{"} CircuitBreaker {"}"} from ...
              </span>
              {"\n"}
              <span className="str">
                {"  "}2│ import {"{"} ContextManager {"}"} from ...
              </span>
              {"\n"}
              <span className="str">{"  "}...</span>
            </CodeBlock>

            <DeepDive title="isExpanded 변경 시 Static 영역 제한">
              <p className="mb-3">
                <code className="text-cyan-600">isExpanded</code>를 토글해도{" "}
                <strong>이미 Static 영역에 플러시된 항목</strong>에는 반영되지 않습니다. Ink의{" "}
                <code className="text-cyan-600">&lt;Static&gt;</code>은 한 번 렌더링된 후 절대 다시
                그려지지 않기 때문입니다.
              </p>
              <p className="text-gray-600">
                따라서 Verbose 모드를 켜면 <strong>현재 동적 영역에 있는 항목</strong>과
                <strong>이후 새로 플러시되는 항목</strong>만 확장됩니다. 과거 항목까지 확장하려면
                세션을 다시 시작해야 합니다.
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
              Progressive Static Flushing 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              ActivityFeed의 핵심 메커니즘입니다. 항목이 생성에서 Static 고정까지 이동하는 과정을
              단계별로 보여줍니다. 두 개의 <code className="text-cyan-600">useEffect</code>가 각각
              완료된 턴과 현재 턴의 완료 항목을 플러시합니다.
            </p>

            <MermaidDiagram
              title="Progressive Static Flushing 상태 흐름"
              titleColor="purple"
              chart={`graph TD
  START(("●")) -->|"새 항목 생성"| LIVE["LiveEntry<br/><small>동적 영역에서 렌더링</small>"]
  LIVE -->|"스트리밍 업데이트"| LIVE
  LIVE -->|"완료 조건 충족"| DUPCHECK["DuplicateCheck<br/><small>WeakSet 중복 확인</small>"]
  DUPCHECK -->|"이미 플러시됨"| SKIP["Skip<br/><small>건너뜀</small>"]
  DUPCHECK -->|"새 항목"| ASSIGN["AssignId<br/><small>nextIdRef++ 할당</small>"]
  ASSIGN --> RENDER["RenderNode<br/><small>renderEntry 호출</small>"]
  RENDER --> STATIC["StaticItem<br/><small>FlushedItem 생성</small>"]
  STATIC -->|"setStaticItems에 append"| AREA["StaticArea<br/><small>영구 고정 완료</small>"]

  style LIVE fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style DUPCHECK fill:#fef9c3,stroke:#eab308,color:#1e293b
  style ASSIGN fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style RENDER fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style STATIC fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AREA fill:#dcfce7,stroke:#22c55e,color:#1e293b
  style SKIP fill:#fee2e2,stroke:#ef4444,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              완료된 턴 플러시 (useEffect #1)
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">completedTurns</code> 배열이 길어지면 새로 추가된 턴의
              항목만 선별적으로 Static에 플러시합니다.
              <code className="text-cyan-600">processedTurnCountRef</code>로 이미 처리한 턴 수를
              추적합니다.
            </p>
            <CodeBlock>
              <span className="fn">useEffect</span>(() =&gt; {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [1] 새로운 완료 턴이 없으면 무시"}</span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">completedTurns</span>.
              <span className="prop">length</span> &lt;={" "}
              <span className="prop">processedTurnCountRef</span>.
              <span className="prop">current</span>) <span className="kw">return</span>;{"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [2] 새 턴만 순회 (이전에 처리한 턴은 건너뜀)"}</span>
              {"\n"}
              {"  "}
              <span className="kw">for</span> (<span className="kw">let</span>{" "}
              <span className="prop">t</span> = <span className="prop">processedTurnCountRef</span>.
              <span className="prop">current</span>; <span className="prop">t</span> &lt;{" "}
              <span className="prop">completedTurns</span>.<span className="prop">length</span>;{" "}
              <span className="prop">t</span>++) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">for</span> (<span className="kw">const</span>{" "}
              <span className="prop">entry</span> <span className="kw">of</span>{" "}
              <span className="prop">turn</span>.<span className="prop">entries</span>) {"{"}
              {"\n"}
              {"      "}
              <span className="cm">
                {"// [3] WeakSet으로 중복 체크 — 이미 live에서 플러시했으면 건너뜀"}
              </span>
              {"\n"}
              {"      "}
              <span className="kw">if</span> (<span className="prop">flushedSetRef</span>.
              <span className="prop">current</span>.<span className="fn">has</span>(
              <span className="prop">entry</span>)) <span className="kw">continue</span>;{"\n"}
              {"      "}
              <span className="prop">flushedSetRef</span>.<span className="prop">current</span>.
              <span className="fn">add</span>(<span className="prop">entry</span>);
              {"\n"}
              {"\n"}
              {"      "}
              <span className="cm">{"// [4] 고유 ID 할당 + 렌더링 노드 생성"}</span>
              {"\n"}
              {"      "}
              <span className="kw">const</span> <span className="prop">id</span> ={" "}
              <span className="prop">nextIdRef</span>.<span className="prop">current</span>++;
              {"\n"}
              {"      "}
              <span className="kw">const</span> <span className="prop">node</span> ={" "}
              <span className="fn">renderEntry</span>(<span className="prop">entry</span>,{" "}
              <span className="kw">false</span>, ...);
              {"\n"}
              {"    "}
              {"}"}
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [5] 처리 완료 카운터 업데이트"}</span>
              {"\n"}
              {"  "}
              <span className="prop">processedTurnCountRef</span>.
              <span className="prop">current</span> = <span className="prop">completedTurns</span>.
              <span className="prop">length</span>;{"\n"}
              {"  "}
              <span className="cm">
                {"// [6] staticItems에 append (절대 기존 항목 제거 안 함)"}
              </span>
              {"\n"}
              {"  "}
              <span className="fn">setStaticItems</span>(<span className="prop">prev</span> =&gt;
              [...<span className="prop">prev</span>, ...<span className="prop">newItems</span>]);
              {"\n"}
              {"}"}, [<span className="prop">completedTurns</span>]);
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong>{" "}
                <code className="text-cyan-600">processedTurnCountRef</code>와 비교하여 새로운 완료
                턴이 없으면 early return합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> 이전에 처리한 턴 인덱스부터 순회하여
                중복 처리를 방지합니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> WeakSet으로 객체 동일성 체크. 현재
                턴에서 이미 live 플러시했던 항목은 건너뜁니다.
              </p>
              <p>
                <strong className="text-gray-900">[4]</strong> 단조 증가 ID를 할당하여 Static 항목
                간 순서를 보장합니다.
              </p>
              <p>
                <strong className="text-gray-900">[5-6]</strong> 카운터를 업데이트하고, 새 항목을
                기존 배열 뒤에 추가합니다. (append-only)
              </p>
            </div>

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              현재 턴 실시간 플러시 (useEffect #2)
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              현재 진행 중인 턴(<code className="text-cyan-600">currentTurn</code>) 내에서 완료된
              개별 항목을 즉시 Static으로 이동시킵니다. 턴이 완전히 끝나기 전에도 완료된 도구
              호출이나 사용자 메시지는 바로 고정됩니다.
            </p>
            <CodeBlock>
              <span className="cm">
                {"// 완료 판정 조건 — 이 중 하나라도 만족하면 Static으로 플러시"}
              </span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">isComplete</span> ={"\n"}
              {"  "}
              <span className="prop">entry</span>.<span className="prop">type</span> ==={" "}
              <span className="str">&quot;user-message&quot;</span> ||
              {"\n"}
              {"  "}
              <span className="prop">entry</span>.<span className="prop">type</span> ==={" "}
              <span className="str">&quot;error&quot;</span> ||
              {"\n"}
              {"  "}
              <span className="prop">entry</span>.<span className="prop">type</span> ==={" "}
              <span className="str">&quot;assistant-intermediate&quot;</span> ||
              {"\n"}
              {"  "}
              <span className="prop">entry</span>.<span className="prop">type</span> ==={" "}
              <span className="str">&quot;tool-complete&quot;</span> ||
              {"\n"}
              {"  "}
              <span className="prop">entry</span>.<span className="prop">type</span> ==={" "}
              <span className="str">&quot;tool-denied&quot;</span> ||
              {"\n"}
              {"  "}(<span className="prop">entry</span>.<span className="prop">type</span> ==={" "}
              <span className="str">&quot;assistant-text&quot;</span> &&{" "}
              <span className="prop">entry</span>.<span className="prop">data</span>.
              <span className="prop">isComplete</span>) ||
              {"\n"}
              {"  "}(<span className="prop">entry</span>.<span className="prop">type</span> ==={" "}
              <span className="str">&quot;thinking&quot;</span> &&{" "}
              <span className="prop">entry</span>.<span className="prop">data</span>.
              <span className="prop">isComplete</span>) ||
              {"\n"}
              {"  "}(<span className="prop">entry</span>.<span className="prop">type</span> ==={" "}
              <span className="str">&quot;tool-start&quot;</span> &&{" "}
              <span className="prop">completedToolIds</span>.<span className="fn">has</span>(
              <span className="prop">entry</span>.<span className="prop">data</span>.
              <span className="prop">id</span>));
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                &bull; <code className="text-cyan-600">user-message</code>,{" "}
                <code className="text-cyan-600">error</code>,{" "}
                <code className="text-cyan-600">assistant-intermediate</code> &mdash; 생성 즉시
                완료로 간주합니다.
              </p>
              <p>
                &bull; <code className="text-cyan-600">tool-complete</code>,{" "}
                <code className="text-cyan-600">tool-denied</code> &mdash; 도구 실행이 끝난
                결과이므로 바로 플러시합니다.
              </p>
              <p>
                &bull; <code className="text-cyan-600">assistant-text</code>,{" "}
                <code className="text-cyan-600">thinking</code> &mdash; <code>isComplete</code>{" "}
                플래그가 <code>true</code>여야만 플러시합니다. 스트리밍 중에는 동적 영역에
                유지됩니다.
              </p>
              <p>
                &bull; <code className="text-cyan-600">tool-start</code> &mdash; 해당 도구의{" "}
                <code>tool-complete</code>/<code>tool-denied</code>가 이미 도착한 경우에만
                플러시합니다.
              </p>
            </div>

            <DeepDive title="WeakSet을 사용하는 이유">
              <p className="mb-3">
                일반 <code className="text-cyan-600">Set</code> 대신{" "}
                <code className="text-cyan-600">WeakSet</code>을 사용하는 이유는{" "}
                <strong>메모리 누수 방지</strong>입니다. 대화가 길어지면 수천 개의
                <code className="text-cyan-600">ActivityEntry</code> 객체가 생성되는데, 일반 Set은
                이 모든 객체에 대한 강한 참조(strong reference)를 유지하여 GC가 수거하지 못합니다.
              </p>
              <p className="mb-3 text-gray-600">
                WeakSet은 약한 참조(weak reference)를 사용하므로, 원본 턴 객체가 더 이상 필요 없어
                GC 대상이 되면 WeakSet의 엔트리도 자동으로 정리됩니다.
              </p>
              <p className="text-amber-600">
                단, WeakSet은 순회(iteration)가 불가능합니다. &quot;플러시된 항목 수&quot; 같은
                통계를 내려면 별도의 카운터가 필요합니다.
              </p>
            </DeepDive>
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
                &quot;터미널 화면이 심하게 깜빡거려요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                Static 플러싱이 정상적으로 동작하지 않을 때 발생합니다. 확인할 사항:
              </p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  <strong>completedTurns 객체가 매번 새로 생성되는지 확인:</strong> 배열 자체가 매
                  렌더링마다 새 참조이면 useEffect가 불필요하게 반복 실행됩니다.
                  <code className="text-cyan-600">useAgentLoop</code>에서 안정적인 참조를 반환하는지
                  확인하세요.
                </li>
                <li>
                  <strong>entry 객체가 mutate되지 않는지 확인:</strong> WeakSet은 객체 동일성으로
                  중복을 판단합니다. 기존 entry를 수정하면 새 객체로 인식되어 같은 항목이 두 번
                  플러시될 수 있습니다.
                </li>
              </ul>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;같은 메시지가 두 번 표시돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                중복 렌더링의 원인은 대부분 <strong>객체 동일성(identity) 문제</strong>입니다.
              </p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  턴 데이터를 전달할 때 스프레드(
                  <code className="text-cyan-600">
                    {"{"}...entry{"}"}
                  </code>
                  )로 복사하면 새 객체가 되어 WeakSet이 중복으로 인식하지 못합니다. 반드시{" "}
                  <strong>원본 객체 참조</strong>를 유지하세요.
                </li>
                <li>
                  <code className="text-cyan-600">currentTurn</code>에서 이미 플러시된 항목이
                  <code className="text-cyan-600">completedTurns</code>에도 포함되는 경우, WeakSet
                  덕분에 두 번째는 자동으로 건너뜁니다. 이 로직이 깨졌다면
                  <code className="text-cyan-600">flushedSetRef</code>가 초기화되었는지 확인하세요.
                </li>
              </ul>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Ctrl+O로 Verbose 모드를 켰는데 과거 메시지에는 적용이 안 돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                이것은 의도된 동작입니다. Ink의{" "}
                <code className="text-cyan-600">&lt;Static&gt;</code> 컴포넌트는 한 번 렌더링된 후
                절대 다시 그려지지 않으므로, <code className="text-cyan-600">isExpanded</code>
                변경이 이미 고정된 항목에는 반영되지 않습니다. Verbose 모드 토글은 현재 진행 중인
                항목과 이후 새로 생성되는 항목에만 적용됩니다.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;연속 파일 읽기가 그룹으로 안 묶여요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                <code className="text-cyan-600">groupConsecutiveReads()</code>는 다음 조건을 모두
                만족해야 그룹화합니다:
              </p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  항목의 타입이 <code className="text-cyan-600">&quot;tool-complete&quot;</code>
                  이어야 합니다.
                  <code className="text-cyan-600">&quot;tool-start&quot;</code>는 대상이 아닙니다.
                </li>
                <li>
                  <code className="text-cyan-600">entry.data.name</code>이 정확히
                  <code className="text-cyan-600">&quot;file_read&quot;</code>여야 합니다.
                </li>
                <li>
                  <strong>2개 이상</strong> 연속되어야 합니다. 1개짜리는 개별 항목으로 표시됩니다.
                </li>
                <li>
                  중간에 다른 타입의 항목이 끼면 연속이 끊어져 별도 그룹(또는 개별 항목)이 됩니다.
                </li>
              </ul>
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
                  name: "useAgentLoop",
                  slug: "use-agent-loop",
                  relation: "sibling",
                  desc: "ActivityFeed에 completedTurns와 currentTurn 데이터를 공급하는 React 훅",
                },
                {
                  name: "agent-loop.ts",
                  slug: "agent-loop",
                  relation: "parent",
                  desc: "에이전트 루프의 핵심 로직 — ActivityCollector를 통해 턴 데이터를 생성하는 상위 모듈",
                },
                {
                  name: "circuit-breaker.ts",
                  slug: "circuit-breaker",
                  relation: "sibling",
                  desc: "에이전트 루프의 무한 반복 방지 — 루프 중단 시 ActivityFeed에 더 이상 새 항목이 추가되지 않음",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
