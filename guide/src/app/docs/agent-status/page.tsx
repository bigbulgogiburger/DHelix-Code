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

export default function AgentStatusPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/cli/components/AgentStatus.tsx" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">AgentStatus</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="cli" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              에이전트가 LLM 응답을 기다리는 동안 표시되는 애니메이션 상태 컴포넌트입니다.
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
                <code className="text-cyan-600">AgentStatus</code>는 에이전트 루프가 LLM 호출
                중이거나 도구를 실행하는 동안 사용자에게 &quot;무언가 진행 중&quot;임을 알려주는
                컴포넌트입니다. 별 아이콘(✦/✧)이 깜빡이고, 재미있는 한국어 상태 메시지가 표시되며,
                경과 시간과 토큰 소비량을 실시간으로 보여줍니다.
              </p>
              <p>
                26개의 한국어 상태 메시지(&quot;생각하는 중…&quot;, &quot;뇌세포 굴리는 중…&quot;,
                &quot;버그 퇴마 의식 중…&quot; 등)가 정의되어 있으며, 컴포넌트가 마운트될 때
                랜덤으로 하나를 선택합니다. 3개의 독립적인 타이머가 별 깜빡임(400ms), 경과
                시간(1초), 메시지 선택을 각각 관리합니다.
              </p>
              <p>
                <code className="text-cyan-600">React.memo</code>로 감싸져 있어
                <code className="text-cyan-600">tokenCount</code> prop이 변경될 때만 리렌더링됩니다.
              </p>
            </div>

            <MermaidDiagram
              title="AgentStatus 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  APP["App.tsx<br/><small>메인 앱 컴포넌트</small>"]
  AF["ActivityFeed<br/><small>활동 피드</small>"]
  AS["AgentStatus<br/><small>에이전트 상태 표시</small>"]
  TB["TurnBlock<br/><small>대화 턴 블록</small>"]
  AGENT["Agent Loop<br/><small>agent-loop.ts</small>"]

  APP --> AF
  AF -->|"isProcessing=true"| AS
  AF --> TB
  AGENT -->|"tokenCount 전달"| AS

  style AS fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style APP fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style AF fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style TB fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style AGENT fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> IDE의 하단 상태 표시줄에서 &quot;인덱싱 중…&quot;이 뱅글뱅글
              돌아가는 것과 같습니다. 사용자에게 &quot;멈춘 게 아니라 열심히 일하고 있다&quot;는
              시각적 피드백을 제공합니다.
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

            {/* AgentStatusProps interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface AgentStatusProps
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              AgentStatus 컴포넌트에 전달하는 props입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "tokenCount",
                  type: "number | undefined",
                  required: false,
                  desc: "현재까지 소비한 토큰 수 (기본값: 0). 0보다 크면 '↓ 1,234 tokens' 형태로 표시됩니다.",
                },
              ]}
            />

            {/* STATUS_MESSAGES */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              const STATUS_MESSAGES
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              에이전트 처리 중 랜덤으로 표시되는 26개의 한국어 상태 메시지 배열입니다.
              <code className="text-cyan-600">readonly string[]</code> 타입으로, 컴포넌트 마운트 시
              1개가 랜덤 선택됩니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">STATUS_MESSAGES</span>:{" "}
              <span className="kw">readonly</span> <span className="type">string</span>[] = [{"\n"}
              {"  "}
              <span className="str">&quot;생각하는 중…&quot;</span>,{"\n"}
              {"  "}
              <span className="str">&quot;코드 읽는 중…&quot;</span>,{"\n"}
              {"  "}
              <span className="str">&quot;뇌세포 굴리는 중…&quot;</span>,{"\n"}
              {"  "}
              <span className="str">&quot;버그 퇴마 의식 중…&quot;</span>,{"\n"}
              {"  "}
              <span className="cm">{"// ... 총 26개"}</span>
              {"\n"}] <span className="kw">as const</span>;
            </CodeBlock>

            {/* 상수 */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              애니메이션 상수
            </h3>
            <ParamTable
              params={[
                {
                  name: "STAR_FRAMES",
                  type: '["✦", "✧"]',
                  required: true,
                  desc: "별 애니메이션 프레임 — 두 문자가 번갈아 표시됨",
                },
                {
                  name: "STAR_INTERVAL",
                  type: "400 (ms)",
                  required: true,
                  desc: "별 깜빡임 간격 (밀리초)",
                },
                {
                  name: "ELAPSED_INTERVAL",
                  type: "1000 (ms)",
                  required: true,
                  desc: "경과 시간 업데이트 간격 (1초)",
                },
              ]}
            />

            {/* formatElapsed */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              formatElapsed(seconds)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              경과 시간을 &quot;N초&quot; 또는 &quot;N분 N초&quot; 형식의 한국어 문자열로
              변환합니다.
            </p>
            <CodeBlock>
              <span className="fn">formatElapsed</span>(<span className="prop">seconds</span>:{" "}
              <span className="type">number</span>): <span className="type">string</span>
              {"\n"}
              <span className="cm">{"// formatElapsed(45) → '45초'"}</span>
              {"\n"}
              <span className="cm">{"// formatElapsed(125) → '2분 5초'"}</span>
              {"\n"}
              <span className="cm">{"// formatElapsed(120) → '2분'"}</span>
            </CodeBlock>

            {/* buildMeta */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              buildMeta(elapsed, tokenCount)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              상태 메시지 옆에 표시할 메타 정보 문자열을 생성합니다.
            </p>
            <CodeBlock>
              <span className="fn">buildMeta</span>(<span className="prop">elapsed</span>:{" "}
              <span className="type">number</span>, <span className="prop">tokenCount</span>:{" "}
              <span className="type">number</span>): <span className="type">string</span>
              {"\n"}
              <span className="cm">{"// buildMeta(3, 1234) → '(3초 · ↓ 1,234 tokens)'"}</span>
              {"\n"}
              <span className="cm">{"// buildMeta(3, 0)    → '(3초)'"}</span>
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                메시지는 컴포넌트 마운트 시 1회만 랜덤 선택됩니다. 순환하지 않으므로,
                <code className="text-cyan-600">AgentStatus</code>가 화면에 다시 나타날 때마다 새
                메시지가 보입니다.
              </li>
              <li>
                3개의 <code className="text-cyan-600">setInterval</code> 타이머가 동시에 실행됩니다.
                컴포넌트 언마운트 시 모두 정리(cleanup)됩니다.
              </li>
              <li>
                <code className="text-cyan-600">React.memo</code>로 감싸져 있으므로, 부모가
                리렌더링되어도 <code className="text-cyan-600">tokenCount</code>가 변경되지 않으면
                이 컴포넌트는 리렌더링되지 않습니다.
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
              기본 사용법 &mdash; ActivityFeed에서 렌더링
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              에이전트가 처리 중일 때 ActivityFeed가 자동으로 이 컴포넌트를 렌더링합니다. 직접
              사용할 일은 드물지만, 필요하다면 다음과 같이 사용합니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"} <span className="type">AgentStatus</span>{" "}
              {"}"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./AgentStatus.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 토큰 수 없이 기본 표시"}</span>
              {"\n"}
              {"<"}
              <span className="type">AgentStatus</span> {"/>"}
              {"\n"}
              {"\n"}
              <span className="cm">{"// 토큰 수와 함께 표시"}</span>
              {"\n"}
              {"<"}
              <span className="type">AgentStatus</span> <span className="prop">tokenCount</span>=
              {"{"}
              <span className="num">4521</span>
              {"}"} {"/>"}
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 이 컴포넌트는 Ink(터미널 React) 환경에서만 동작합니다. 브라우저
              React에서는 <code>ink</code>의 <code>Text</code> 컴포넌트를 사용할 수 없으므로 에러가
              발생합니다.
            </Callout>

            {/* 고급: 출력 형식 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 터미널 출력 형식
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              렌더링 결과는 터미널에 다음과 같은 형태로 표시됩니다:
            </p>
            <CodeBlock>
              <span className="cm">{"// ✦ 뇌세포 굴리는 중… (3초 · ↓ 1,234 tokens)"}</span>
              {"\n"}
              <span className="cm">{"// ✧ 뇌세포 굴리는 중… (4초 · ↓ 1,567 tokens)"}</span>
              {"\n"}
              <span className="cm">{"// ✦ 뇌세포 굴리는 중… (5초 · ↓ 1,890 tokens)"}</span>
            </CodeBlock>
            <div className="text-[13px] text-gray-600 mt-2 space-y-1">
              <p>
                &bull; <span className="text-magenta-500 font-bold">✦/✧</span> &mdash; 마젠타 색상,
                굵게. 400ms마다 토글
              </p>
              <p>
                &bull; <span className="font-medium">상태 메시지</span> &mdash; 기본 색상. 마운트 시
                랜덤 고정
              </p>
              <p>
                &bull; <span className="text-gray-400">(경과 시간 &middot; 토큰)</span> &mdash; dim
                처리. 1초마다 업데이트
              </p>
            </div>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> 상태 메시지를 커스터마이즈하려면
              <code>STATUS_MESSAGES</code> 배열에 원하는 문자열을 추가하면 됩니다. 유머러스한 한국어
              메시지를 넣으면 사용 경험이 더 즐거워집니다.
            </Callout>
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
              타이머 생명주기 다이어그램
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              AgentStatus는 마운트 시 3개의 독립적인 타이머를 시작하고, 언마운트 시 모두 정리합니다.
            </p>

            <MermaidDiagram
              title="AgentStatus 타이머 생명주기"
              titleColor="purple"
              chart={`graph LR
  MOUNT(("마운트")) --> T1["별 타이머<br/><small>setInterval 400ms</small>"]
  MOUNT --> T2["시간 타이머<br/><small>setInterval 1000ms</small>"]
  MOUNT --> T3["메시지 선택<br/><small>useState 초기값 1회</small>"]

  T1 -->|"starIndex 토글"| RENDER["렌더<br/><small>✦ 메시지 (시간·토큰)</small>"]
  T2 -->|"elapsed +1"| RENDER
  T3 -->|"messageIndex 고정"| RENDER

  RENDER --> UNMOUNT(("언마운트"))
  UNMOUNT -->|"clearInterval x2"| CLEANUP["정리 완료"]

  style MOUNT fill:#dcfce7,stroke:#10b981,color:#065f46
  style UNMOUNT fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style RENDER fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style T1 fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style T2 fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style T3 fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CLEANUP fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              컴포넌트의 핵심은 3개의 <code className="text-cyan-600">useEffect</code>와 1개의{" "}
              <code className="text-cyan-600">useState</code> 초기화 함수입니다.
            </p>
            <CodeBlock>
              <span className="kw">export const</span> <span className="type">AgentStatus</span> ={" "}
              <span className="fn">React.memo</span>(<span className="kw">function</span>{" "}
              <span className="fn">AgentStatus</span>({"{"} <span className="prop">tokenCount</span>{" "}
              = <span className="num">0</span> {"}"}) {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [1] 별 프레임 인덱스 (0 또는 1)"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> [<span className="prop">starIndex</span>,{" "}
              <span className="fn">setStarIndex</span>] = <span className="fn">useState</span>(
              <span className="num">0</span>);
              {"\n"}
              {"  "}
              <span className="cm">{"// [2] 경과 시간 (초 단위)"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> [<span className="prop">elapsed</span>,{" "}
              <span className="fn">setElapsed</span>] = <span className="fn">useState</span>(
              <span className="num">0</span>);
              {"\n"}
              {"  "}
              <span className="cm">{"// [3] 메시지 인덱스 — 마운트 시 1회 랜덤 선택"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> [<span className="prop">messageIndex</span>] ={" "}
              <span className="fn">useState</span>(() =&gt;
              {"\n"}
              {"    "}
              <span className="fn">Math.floor</span>(<span className="fn">Math.random</span>() *{" "}
              <span className="prop">STATUS_MESSAGES</span>.<span className="prop">length</span>)
              {"\n"}
              {"  "});
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [4] 별 깜빡임 타이머 (400ms)"}</span>
              {"\n"}
              {"  "}
              <span className="fn">useEffect</span>(() =&gt; {"{"}
              {"\n"}
              {"    "}
              <span className="kw">const</span> <span className="prop">timer</span> ={" "}
              <span className="fn">setInterval</span>(() =&gt;
              {"\n"}
              {"      "}
              <span className="fn">setStarIndex</span>(<span className="prop">prev</span> =&gt; (
              <span className="prop">prev</span> + <span className="num">1</span>) %{" "}
              <span className="num">2</span>),
              {"\n"}
              {"    "}
              <span className="num">400</span>);
              {"\n"}
              {"    "}
              <span className="kw">return</span> () =&gt; <span className="fn">clearInterval</span>(
              <span className="prop">timer</span>);
              {"\n"}
              {"  "}
              {"}"}, []);
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [5] 경과 시간 카운터 (1초마다 +1)"}</span>
              {"\n"}
              {"  "}
              <span className="fn">useEffect</span>(() =&gt; {"{"}
              {"\n"}
              {"    "}
              <span className="kw">const</span> <span className="prop">timer</span> ={" "}
              <span className="fn">setInterval</span>(() =&gt;
              {"\n"}
              {"      "}
              <span className="fn">setElapsed</span>(<span className="prop">prev</span> =&gt;{" "}
              <span className="prop">prev</span> + <span className="num">1</span>),
              {"\n"}
              {"    "}
              <span className="num">1000</span>);
              {"\n"}
              {"    "}
              <span className="kw">return</span> () =&gt; <span className="fn">clearInterval</span>(
              <span className="prop">timer</span>);
              {"\n"}
              {"  "}
              {"}"}, []);
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong>{" "}
                <code className="text-cyan-600">starIndex</code>는 0과 1 사이를 토글하며,{" "}
                <code>STAR_FRAMES[starIndex]</code>로 ✦ 또는 ✧를 선택합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong>{" "}
                <code className="text-cyan-600">elapsed</code>는 초 단위로 증가하며,{" "}
                <code>formatElapsed()</code>를 통해 &quot;N초&quot; 또는 &quot;N분 N초&quot;로
                변환됩니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong>{" "}
                <code className="text-cyan-600">useState</code>의 초기화 함수(lazy initializer)로
                랜덤 인덱스를 생성합니다. setter가 없으므로 값이 고정됩니다.
              </p>
              <p>
                <strong className="text-gray-900">[4-5]</strong> 두 타이머는 독립적으로 실행되며,
                각각의 <code>useEffect</code> cleanup에서 <code>clearInterval</code>로 정리됩니다.
              </p>
            </div>

            <DeepDive title="React.memo 최적화 상세">
              <p className="mb-3">
                <code className="text-cyan-600">React.memo</code>는 props의 얕은 비교(shallow
                comparison)를 수행하여, props가 변경되지 않으면 리렌더링을 건너뜁니다.
              </p>
              <p className="mb-3 text-gray-600">
                이 컴포넌트의 유일한 prop인 <code className="text-cyan-600">tokenCount</code>는
                숫자이므로, 값이 동일하면 <code>===</code> 비교에서 true가 반환되어 리렌더링이
                생략됩니다.
              </p>
              <p className="text-amber-600">
                내부 상태(<code>starIndex</code>, <code>elapsed</code>)의 변경은
                <code>React.memo</code>와 무관하게 항상 리렌더링을 유발합니다.
                <code>React.memo</code>는 <em>부모로부터의</em> 불필요한 리렌더링만 방지합니다.
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
                &quot;상태 메시지가 매번 같아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                메시지는 컴포넌트 마운트 시 1회만 랜덤 선택됩니다. 동일한 AgentStatus 인스턴스가
                언마운트되지 않고 계속 표시되면 같은 메시지가 유지됩니다. 새 메시지를 보려면
                컴포넌트가 언마운트되었다가 다시 마운트되어야 합니다 (에이전트 루프가 끝났다가 다시
                시작될 때 자동으로 발생).
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;토큰 수가 표시되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">tokenCount</code>가 0이거나 전달되지 않으면 토큰
                부분이 표시되지 않습니다.
                <code className="text-cyan-600">buildMeta()</code>는
                <code className="text-cyan-600">tokenCount &gt; 0</code>일 때만 토큰 정보를
                포함합니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;별 아이콘이 너무 빠르게/느리게 깜빡여요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">STAR_INTERVAL</code> 상수를 변경하면 깜빡임 속도를
                조절할 수 있습니다. 기본값은 400ms이며, 200ms로 줄이면 더 빠르게, 800ms로 늘리면 더
                느리게 깜빡입니다. 모듈 내부에 하드코딩되어 있으므로 소스를 직접 수정해야 합니다.
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
                  name: "ActivityFeed",
                  slug: "activity-feed",
                  relation: "parent",
                  desc: "AgentStatus를 포함하여 전체 활동 스트림을 렌더링하는 컴포넌트",
                },
                {
                  name: "TurnBlock",
                  slug: "turn-block",
                  relation: "sibling",
                  desc: "단일 대화 턴을 렌더링하는 컴포넌트 — AgentStatus와 함께 ActivityFeed에서 표시",
                },
                {
                  name: "StreamingMessage",
                  slug: "streaming-message",
                  relation: "sibling",
                  desc: "LLM 응답 텍스트를 스트리밍으로 표시하는 컴포넌트",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
