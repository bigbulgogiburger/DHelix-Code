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

export default function CmdResumePage() {
  return (
    <div className="min-h-screen pt-10 pb-20">
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/commands/resume.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">/resume</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              이전에 저장된 세션 목록을 조회하거나, 특정 세션을 재개하여 중단된 작업을 이어서 하는
              슬래시 명령어입니다.
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
                <code className="text-cyan-600">/resume</code>는 dhelix의 세션 영속화 시스템과
                연동되는 명령어입니다. 대화 히스토리는 디스크에 자동으로 저장되며, 이 명령어를 통해
                이전 세션을 조회하고 재개할 수 있습니다.
              </p>
              <p>
                인자 없이 실행하면 저장된 세션 목록을 대화형 선택 리스트(interactive select)로
                표시합니다. 사용자가 화살표 키로 세션을 선택하면 해당 세션이 재개됩니다. 세션 ID를
                직접 입력하면 부분 매칭(prefix match)을 지원하여 전체 ID를 기억할 필요가 없습니다.
              </p>
              <p>
                세션(session)이란 하나의 대화 흐름을 나타내는 단위로, 메시지 히스토리, 세션 ID,
                마지막 사용 시각, 이름 등의 메타데이터를 포함합니다.
                <code className="text-cyan-600">SessionManager</code>가 세션의 저장과 조회를
                담당합니다.
              </p>
            </div>

            <MermaidDiagram
              title="/resume 실행 흐름"
              titleColor="purple"
              chart={`graph TD
  USER["사용자 입력<br/><small>/resume [session-id]</small>"]
  CHECK{"세션 ID<br/>있음?"}

  USER --> CHECK
  CHECK -->|"없음"| LIST["세션 목록 조회<br/><small>SessionManager.listSessions()</small>"]
  CHECK -->|"있음"| FIND["세션 검색<br/><small>prefix match</small>"]

  LIST -->|"세션 없음"| EMPTY["No saved sessions found"]
  LIST -->|"세션 있음"| SELECT["대화형 선택 리스트<br/><small>interactiveSelect</small>"]
  SELECT -->|"사용자 선택"| RESUME["세션 재개<br/><small>/resume session-id</small>"]

  FIND -->|"매칭 없음"| NOTFOUND["Session not found"]
  FIND -->|"매칭"| RESUME

  style CHECK fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style SELECT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style USER fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style LIST fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style FIND fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style RESUME fill:#dcfce7,stroke:#10b981,color:#065f46
  style EMPTY fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style NOTFOUND fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
            />

            <Callout type="info" icon="💡">
              <strong>부분 ID 매칭:</strong> 세션 ID는 UUID 형식의 긴 문자열입니다. 처음 몇 글자만
              입력해도 <code className="text-cyan-600">startsWith()</code>로 매칭하여 찾아줍니다.
              예를 들어 <code>/resume a1b2</code>로<code>a1b2c3d4-...</code> 세션을 재개할 수
              있습니다.
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

            {/* resumeCommand */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              resumeCommand: SlashCommand
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              <code className="text-cyan-600">/resume</code> 슬래시 명령어의 정의 객체입니다. 세션
              목록 조회와 세션 재개를 처리합니다.
            </p>
            <ParamTable
              params={[
                { name: "name", type: '"resume"', required: true, desc: "명령어 이름" },
                {
                  name: "description",
                  type: "string",
                  required: true,
                  desc: '"List or resume a previous session"',
                },
                { name: "usage", type: "string", required: true, desc: '"/resume [session-id]"' },
                {
                  name: "execute",
                  type: "(args, context) => Promise<CommandResult>",
                  required: true,
                  desc: "명령어 실행 함수",
                },
              ]}
            />

            {/* execute 분기 */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              execute(args, context)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              인자 유무에 따라 두 가지 모드로 동작합니다.
            </p>

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              모드 1: 세션 목록 (인자 없음)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600">SessionManager.listSessions()</code>로 저장된 세션을
              조회하고, 최대 20개를 <code className="text-cyan-600">interactiveSelect</code>로
              반환합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 세션 목록 → 대화형 선택 리스트"}</span>
              {"\n"}
              <span className="kw">return</span> {"{"}
              {"\n"}
              {"  "}
              <span className="prop">output</span>: <span className="str">&quot;&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">success</span>: <span className="kw">true</span>,{"\n"}
              {"  "}
              <span className="prop">interactiveSelect</span>: {"{"}
              {"\n"}
              {"    "}
              <span className="prop">options</span>,{" "}
              <span className="cm">{"// SelectOption[]"}</span>
              {"\n"}
              {"    "}
              <span className="prop">prompt</span>:{" "}
              <span className="str">&quot;Select a session to resume:&quot;</span>,{"\n"}
              {"    "}
              <span className="prop">onSelect</span>:{" "}
              <span className="str">&quot;/resume&quot;</span>,{"\n"}
              {"  "}
              {"}"},{"\n"}
              {"}"};
            </CodeBlock>

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              모드 2: 세션 재개 (ID 지정)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              세션 ID를 <code className="text-cyan-600">startsWith()</code>로 부분 매칭합니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">match</span> ={" "}
              <span className="prop">sessions</span>.<span className="fn">find</span>({"\n"}
              {"  "}(<span className="prop">s</span>) =&gt; <span className="prop">s</span>.
              <span className="prop">id</span>.<span className="fn">startsWith</span>(
              <span className="prop">sessionId</span>){"\n"});
            </CodeBlock>

            {/* SelectOption */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              SelectOption (목록 항목)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              대화형 선택 리스트에 표시되는 각 세션 항목의 구조입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "label",
                  type: "string",
                  required: true,
                  desc: '세션 ID 앞 8자리 + 마지막 사용 시각 (예: "a1b2c3d4  2025/01/15 14:30:00")',
                },
                {
                  name: "value",
                  type: "string",
                  required: true,
                  desc: "전체 세션 ID (선택 시 /resume에 전달)",
                },
                {
                  name: "description",
                  type: "string",
                  required: false,
                  desc: '세션 이름 또는 메시지 수 (예: "(12 msgs)")',
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                세션 목록은 최대 <strong>20개</strong>까지만 표시됩니다.
                <code className="text-cyan-600">sessions.slice(0, 20)</code>으로 잘리므로 오래된
                세션은 목록에 나타나지 않을 수 있습니다.
              </li>
              <li>
                부분 ID 매칭은 <code className="text-cyan-600">startsWith()</code>를 사용하므로
                <strong>앞에서부터</strong> 매칭됩니다. 중간이나 끝부분 문자열로는 검색할 수
                없습니다.
              </li>
              <li>
                <code className="text-cyan-600">SessionManager</code>는 매 호출마다 새로 생성됩니다.
                세션 데이터는 디스크에서 매번 읽어오므로 상태가 항상 최신입니다.
              </li>
              <li>
                세션 재개 시 에러가 발생하면 <code className="text-cyan-600">try/catch</code>로
                잡아서 사용자 친화적 에러 메시지를 반환합니다.
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
              기본 사용법 &mdash; 세션 목록에서 선택
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              인자 없이 실행하면 저장된 세션 목록이 대화형 리스트로 표시됩니다. 화살표 키로 세션을
              선택할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 세션 목록 표시"}</span>
              {"\n"}
              <span className="fn">/resume</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 화살표 키로 선택:"}</span>
              {"\n"}
              <span className="cm">{"//  ▸ a1b2c3d4  2025/01/15 14:30:00  (auth 기능 구현)"}</span>
              {"\n"}
              <span className="cm">{"//    e5f6g7h8  2025/01/14 09:15:00  (12 msgs)"}</span>
              {"\n"}
              <span className="cm">{"//    i9j0k1l2  2025/01/13 16:45:00  (버그 수정)"}</span>
            </CodeBlock>

            {/* ID로 직접 재개 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 세션 ID로 직접 재개
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              세션 ID를 알고 있다면 직접 입력하여 즉시 재개할 수 있습니다. 부분 ID도 지원됩니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 전체 ID로 재개"}</span>
              {"\n"}
              <span className="fn">/resume</span>{" "}
              <span className="str">a1b2c3d4-e5f6-7890-abcd-ef1234567890</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 부분 ID로 재개 (앞 4글자만)"}</span>
              {"\n"}
              <span className="fn">/resume</span> <span className="str">a1b2</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 부분 ID가 여러 세션과 매칭될 경우 <code>find()</code>가
              배열에서 <strong>첫 번째</strong>로 매칭되는 세션을 반환합니다. 정확한 세션을
              지정하려면 충분히 긴 접두사를 사용하세요.
            </Callout>

            <DeepDive title="interactiveSelect 동작 원리">
              <p className="mb-3">
                <code className="text-cyan-600">interactiveSelect</code>는 CLI의 Ink 컴포넌트에서
                렌더링되는 대화형 선택 UI입니다:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <strong>options:</strong> 최대 20개의 <code>SelectOption</code> 배열
                </li>
                <li>
                  <strong>prompt:</strong> 선택 안내 메시지 (&quot;Select a session to
                  resume:&quot;)
                </li>
                <li>
                  <strong>onSelect:</strong> 사용자가 항목을 선택하면{" "}
                  <code>
                    /resume {"{"}selectedValue{"}"}
                  </code>
                  를 자동 실행
                </li>
              </ul>
              <p className="mt-3 text-gray-600">
                즉, 사용자가 목록에서 선택하면 내부적으로{" "}
                <code>
                  /resume {"{"}session.id{"}"}
                </code>
                가 다시 실행되어 모드 2(세션 재개)로 진입합니다.
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
              세션 데이터 구조
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">SessionManager.listSessions()</code>가 반환하는 세션
              객체의 주요 필드입니다.
            </p>

            <MermaidDiagram
              title="세션 → SelectOption 변환"
              titleColor="purple"
              chart={`graph LR
  SESSION["Session 객체<br/><small>id, name, lastUsedAt, messageCount</small>"]
  TRANSFORM["변환 로직<br/><small>slice + toLocaleString</small>"]
  OPTION["SelectOption<br/><small>label, value, description</small>"]

  SESSION --> TRANSFORM
  TRANSFORM --> OPTION

  SESSION -.->|"id"| LABEL["label:<br/>id.slice(0,8) + 시각"]
  SESSION -.->|"id"| VALUE["value:<br/>전체 id"]
  SESSION -.->|"name / messageCount"| DESC["description:<br/>이름 또는 (N msgs)"]

  style TRANSFORM fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style SESSION fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style OPTION fill:#dcfce7,stroke:#10b981,color:#065f46
  style LABEL fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style VALUE fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style DESC fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              세션 목록을 <code className="text-cyan-600">SelectOption</code> 배열로 변환하는 매핑
              로직입니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">options</span>:{" "}
              <span className="kw">readonly</span> <span className="type">SelectOption</span>[] ={" "}
              <span className="prop">sessions</span>
              {"\n"}
              {"  "}.<span className="fn">slice</span>(<span className="num">0</span>,{" "}
              <span className="num">20</span>){"\n"}
              {"  "}.<span className="fn">map</span>((<span className="prop">s</span>) =&gt; ({"{"}
              {"\n"}
              {"    "}
              <span className="prop">label</span>:{" "}
              <span className="str">
                `${"{"}
                <span className="prop">s</span>.<span className="prop">id</span>.
                <span className="fn">slice</span>(<span className="num">0</span>,{" "}
                <span className="num">8</span>){"}"} ${"{"}
                <span className="kw">new</span> <span className="type">Date</span>(
                <span className="prop">s</span>.<span className="prop">lastUsedAt</span>).
                <span className="fn">toLocaleString</span>(){"}"}`
              </span>
              ,{"\n"}
              {"    "}
              <span className="prop">value</span>: <span className="prop">s</span>.
              <span className="prop">id</span>,{"\n"}
              {"    "}
              <span className="prop">description</span>: <span className="prop">s</span>.
              <span className="prop">name</span> ||{" "}
              <span className="str">
                `(${"{"}
                <span className="prop">s</span>.<span className="prop">messageCount</span>
                {"}"} msgs)`
              </span>
              ,{"\n"}
              {"  "}
              {"}"});
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">ID 축약:</strong>{" "}
                <code className="text-cyan-600">id.slice(0, 8)</code>로 UUID의 앞 8자리만 표시하여
                가독성을 높입니다.
              </p>
              <p>
                <strong className="text-gray-900">시각 포맷:</strong>{" "}
                <code className="text-cyan-600">toLocaleString()</code>으로 사용자 로케일에 맞는
                날짜/시간 형식을 사용합니다.
              </p>
              <p>
                <strong className="text-gray-900">이름 폴백:</strong> 세션 이름이 없으면 메시지 수를
                &quot;(N msgs)&quot; 형태로 표시합니다.
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
                &quot;/resume를 실행했는데 &apos;No saved sessions found&apos;가 나와요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                저장된 세션이 없는 상태입니다. 세션은 대화를 진행하면 자동으로 저장됩니다. 처음
                사용하거나 세션 데이터가 삭제된 경우 이 메시지가 나타납니다.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Session not found 에러가 나와요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                입력한 세션 ID와 매칭되는 세션이 없습니다. 부분 ID를 사용한 경우 오타가 없는지
                확인하세요. <code className="text-cyan-600">/resume</code>를 인자 없이 실행하면 사용
                가능한 세션 목록을 확인할 수 있습니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;오래된 세션이 목록에 보이지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                세션 목록은 최대 20개까지만 표시됩니다. 오래된 세션은 목록에서 잘릴 수 있습니다.
                해당 세션의 ID를 기억하고 있다면{" "}
                <code className="text-cyan-600">
                  /resume {"{"}id{"}"}
                </code>
                로 직접 재개할 수 있습니다.
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
                  name: "registry.ts",
                  slug: "cmd-registry",
                  relation: "parent",
                  desc: "모든 슬래시 명령어를 등록하고 관리하는 레지스트리 — resumeCommand도 여기에 등록됩니다",
                },
                {
                  name: "session-manager.ts",
                  slug: "session-manager",
                  relation: "child",
                  desc: "세션의 저장, 조회, 삭제를 담당하는 핵심 매니저 클래스",
                },
                {
                  name: "stats.ts",
                  slug: "cmd-stats",
                  relation: "sibling",
                  desc: "/stats — 현재 세션의 사용 통계를 확인하는 명령어",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
