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

export default function PermissionSessionStorePage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/permissions/session-store.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">SessionApprovalStore</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              세션별 권한 허용 캐시 &mdash; 사용자가 한 번 &quot;허용&quot;을 누르면 같은 세션
              안에서 동일한 도구를 다시 물어보지 않도록 기억해두는 모듈입니다.
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
                dhelix는 AI가 도구를 실행하기 전에 사용자에게 &quot;이 작업을
                허용하시겠습니까?&quot;라고 묻습니다. 그런데 매번 같은 도구를 쓸 때마다 반복적으로
                물어보면 사용자 경험이 나빠집니다.
                <code className="text-cyan-600">SessionApprovalStore</code>는 이 문제를 해결합니다
                &mdash; 사용자가 한 번 승인하면 그 결과를 <strong>캐시</strong>해두고, 같은 세션
                안에서 동일한 도구를 다시 쓸 때는 자동으로 통과시킵니다.
              </p>
              <p>
                내부적으로 자바스크립트의 <code className="text-cyan-600">Set&lt;string&gt;</code>{" "}
                자료구조를 사용합니다. Set은 해시 기반이므로 &quot;이 키가 있는가?&quot;를{" "}
                <strong>O(1)</strong> 시간에 확인할 수 있습니다. 배열이었다면 매번 전체를 순회해야
                하지만, Set은 항목이 수천 개여도 한 번의 조회로 끝납니다.
              </p>
              <p>승인은 두 가지 수준으로 관리됩니다:</p>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li>
                  <strong>구체적 승인</strong> &mdash; 특정 인수까지 포함한 승인 (예:{" "}
                  <code className="text-cyan-600">&quot;file_read:/src/index.ts&quot;</code>). 같은
                  도구라도 다른 경로를 읽으면 다시 물어봅니다.
                </li>
                <li>
                  <strong>전체 승인</strong> &mdash; 도구 이름만으로 등록 (예:{" "}
                  <code className="text-cyan-600">&quot;file_read&quot;</code>). 어떤 인수로
                  호출하든 전부 승인됩니다.
                </li>
              </ul>
              <p>
                기본적으로 메모리에만 존재하므로 프로세스가 종료되면 사라집니다. 하지만{" "}
                <code className="text-cyan-600">save()</code>/
                <code className="text-cyan-600">load()</code>를 호출하면{" "}
                <code className="text-cyan-600">~/.dhelix/session-approvals.json</code> 파일에
                저장/복원하여 재시작 후에도 이전 승인을 이어서 사용할 수 있습니다.
              </p>
            </div>

            <MermaidDiagram
              title="SessionApprovalStore 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  TOOL["Tool Executor<br/><small>도구 실행 요청</small>"]
  PM["Permission Manager<br/><small>permissions/manager.ts</small>"]
  SS["SessionApprovalStore<br/><small>session-store.ts</small>"]
  PS["PersistentPermissionStore<br/><small>persistent-store.ts</small>"]
  AL["AuditLogger<br/><small>audit-log.ts</small>"]
  USER["사용자 프롬프트<br/><small>UI에서 승인/거부</small>"]

  TOOL -->|"1. 권한 확인 요청"| PM
  PM -->|"2. 세션 캐시 조회"| SS
  SS -->|"캐시 히트 → 자동 허용"| PM
  PM -->|"3. 캐시 미스 → 영구 규칙 확인"| PS
  PM -->|"4. 규칙 없음 → 사용자에게 질문"| USER
  USER -->|"승인 → 캐시에 등록"| SS
  PM -->|"5. 결정 기록"| AL

  style SS fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style PM fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style PS fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style AL fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TOOL fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style USER fill:#fef3c7,stroke:#f59e0b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 놀이공원의 자유이용권을 떠올리세요. 입구에서 한 번 표를
              보여주면 팔찌를 채워주고, 이후 각 놀이기구에서는 팔찌만 확인합니다. 세션 저장소가 바로
              이 &quot;팔찌&quot;입니다 &mdash; 한 번 승인받으면 같은 세션 안에서는 다시 표를 보여줄
              필요가 없습니다. 단, 놀이공원을 나갔다 다시 들어오면(프로세스 재시작) 팔찌는
              사라집니다.
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

            {/* class SessionApprovalStore */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class SessionApprovalStore
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              세션 범위의 승인 캐시를 관리하는 클래스입니다. 내부에{" "}
              <code className="text-cyan-600">Set&lt;string&gt;</code> 하나를 갖고 있으며, 모든 승인
              조회와 등록이 이 Set을 통해 이루어집니다. 별도의 생성자 인수 없이{" "}
              <code className="text-cyan-600">new SessionApprovalStore()</code>로 만듭니다.
            </p>

            {/* ── isApproved ── */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              isApproved(toolName, args?)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              도구 호출이 이번 세션에서 이미 승인되었는지 확인합니다. 내부적으로 2단계 조회를
              수행합니다: 먼저 인수까지 포함한 <strong>구체적 키</strong>(
              <code className="text-cyan-600">&quot;file_read:/src/index.ts&quot;</code>)로 정확히
              매칭되는지 확인하고, 없으면 <strong>도구 이름만</strong>(
              <code className="text-cyan-600">&quot;file_read&quot;</code>)으로 전체 승인 여부를
              확인합니다.
            </p>
            <CodeBlock>
              <span className="fn">isApproved</span>(<span className="prop">toolName</span>:{" "}
              <span className="type">string</span>, <span className="prop">args</span>?:{" "}
              <span className="type">Readonly&lt;Record&lt;string, unknown&gt;&gt;</span>):{" "}
              <span className="type">boolean</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "toolName",
                  type: "string",
                  required: true,
                  desc: '확인할 도구 이름 (예: "file_read", "Bash")',
                },
                {
                  name: "args",
                  type: "Readonly<Record<string, unknown>>",
                  required: false,
                  desc: '도구 인수 객체. path 속성이 있으면 "도구:경로" 형태의 구체적 키로 조회',
                },
              ]}
            />
            <div className="text-[13px] text-gray-600 mt-2 space-y-1">
              <p>
                &bull; 반환값 <code className="text-emerald-600">true</code> &mdash; 세션 캐시에
                승인이 있음, 사용자에게 다시 묻지 않고 바로 실행 가능
              </p>
              <p>
                &bull; 반환값 <code className="text-red-600">false</code> &mdash; 캐시에 없음, 다른
                권한 검사 단계를 진행해야 함
              </p>
            </div>

            {/* ── approve ── */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">approve(toolName, args?)</h4>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              특정 도구 호출을 이번 세션에서 승인합니다. 인수에{" "}
              <code className="text-cyan-600">path</code> 속성이 있으면 해당 경로의 호출만
              승인됩니다. 다른 경로로 같은 도구를 호출하면 별도의 승인이 필요합니다.
            </p>
            <CodeBlock>
              <span className="fn">approve</span>(<span className="prop">toolName</span>:{" "}
              <span className="type">string</span>, <span className="prop">args</span>?:{" "}
              <span className="type">Readonly&lt;Record&lt;string, unknown&gt;&gt;</span>):{" "}
              <span className="type">void</span>
            </CodeBlock>
            <ParamTable
              params={[
                { name: "toolName", type: "string", required: true, desc: "승인할 도구 이름" },
                {
                  name: "args",
                  type: "Readonly<Record<string, unknown>>",
                  required: false,
                  desc: '도구 인수. path가 있으면 "도구:경로" 키를 생성, 없으면 도구 이름만 키로 사용',
                },
              ]}
            />

            {/* ── approveAll ── */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">approveAll(toolName)</h4>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              도구의 <strong>모든</strong> 향후 호출을 이번 세션에서 한꺼번에 승인합니다. 도구
              이름만을 키로 Set에 등록하므로, 이후{" "}
              <code className="text-cyan-600">isApproved()</code>가 어떤 인수로 호출되든 2단계
              조회에서 항상 <code className="text-emerald-600">true</code>를 반환합니다. 사용자가
              &quot;이 도구는 앞으로 묻지 마세요&quot;를 선택했을 때 사용합니다.
            </p>
            <CodeBlock>
              <span className="fn">approveAll</span>(<span className="prop">toolName</span>:{" "}
              <span className="type">string</span>): <span className="type">void</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "toolName",
                  type: "string",
                  required: true,
                  desc: "전체 승인할 도구 이름. 이후 어떤 인수로 호출해도 자동 통과",
                },
              ]}
            />

            {/* ── clear ── */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">clear()</h4>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              모든 세션 승인을 초기화합니다. 내부 Set이 비워지므로 이후 모든 도구 호출에 다시 승인이
              필요합니다. 사용자가 권한 모드를 변경하거나(
              <code className="text-cyan-600">Shift+Tab</code>), 보안 재설정이 필요할 때 호출됩니다.
            </p>
            <CodeBlock>
              <span className="fn">clear</span>(): <span className="type">void</span>
            </CodeBlock>

            {/* ── get size ── */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">get size</h4>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              현재 등록된 승인 항목의 수를 반환합니다. 디버깅이나 UI에서 &quot;현재 N개의 승인이
              캐시됨&quot;을 표시할 때 유용합니다.
            </p>
            <CodeBlock>
              <span className="kw">get</span> <span className="prop">size</span>:{" "}
              <span className="type">number</span>
            </CodeBlock>

            {/* ── save ── */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">save()</h4>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              현재 승인 상태를 디스크에 저장합니다. 저장 경로는{" "}
              <code className="text-cyan-600">~/.dhelix/session-approvals.json</code>이며, Set의
              내용을 JSON 배열로 직렬화합니다.
              <strong>최선 노력(best-effort)</strong> 방식이므로, 저장에 실패해도 에러를 던지지
              않습니다. 세션 데이터는 유실되어도 사용자가 다시 승인하면 되므로 안전합니다.
            </p>
            <CodeBlock>
              <span className="fn">save</span>(): <span className="type">void</span>
              {"\n"}
              <span className="cm">// 동기(sync) I/O 사용 — writeFileSync</span>
              {"\n"}
              <span className="cm">// 디렉토리 없으면 자동 생성 — mkdirSync(recursive: true)</span>
            </CodeBlock>

            {/* ── load ── */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">load()</h4>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              디스크에서 저장된 승인 상태를 복원합니다. 이전 세션의 승인 상태를 이어서 사용하고 싶을
              때 호출합니다. 중요한 점은 기존 Set에 <strong>추가(add)</strong>하는 방식이라는
              것입니다 &mdash; 현재 세션에서 이미 승인된 항목은 유지되고, 파일에서 읽은 항목이
              합쳐집니다. 파일이 없거나 JSON 파싱에 실패하면 아무 일도 일어나지 않습니다.
            </p>
            <CodeBlock>
              <span className="fn">load</span>(): <span className="type">void</span>
              {"\n"}
              <span className="cm">// 동기(sync) I/O 사용 — readFileSync</span>
              {"\n"}
              <span className="cm">// 기존 승인에 추가(add), 덮어쓰기 아님</span>
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <strong>path 속성만 키에 반영됩니다.</strong>{" "}
                <code className="text-cyan-600">approve()</code>에 인수를 전달해도,
                <code className="text-cyan-600">path</code> 속성만 캐시 키에 포함됩니다.
                <code className="text-cyan-600">command</code>,{" "}
                <code className="text-cyan-600">content</code> 등 다른 속성은 무시됩니다. Bash처럼
                경로가 아닌 인수를 사용하는 도구는
                <code className="text-cyan-600">approveAll()</code>을 사용하는 것이 일반적입니다.
              </li>
              <li>
                <strong>save()/load()는 동기 I/O입니다.</strong>{" "}
                <code className="text-cyan-600">readFileSync</code>/
                <code className="text-cyan-600">writeFileSync</code>를 사용하므로 메인 스레드를 잠시
                블록합니다. 일반적인 사용에서는 문제없지만, 승인 항목이 수만 개 이상이면 체감될 수
                있습니다.
              </li>
              <li>
                <strong>load()는 덮어쓰기가 아닌 추가입니다.</strong> 이미 승인된 항목이 있는
                상태에서 <code className="text-cyan-600">load()</code>를 호출하면 기존 승인 + 파일의
                승인이 합쳐집니다. 파일의 내용으로 완전히 교체하려면
                <code className="text-cyan-600">clear()</code> 후{" "}
                <code className="text-cyan-600">load()</code>를 호출하세요.
              </li>
              <li>
                <strong>clear()는 메모리만 초기화합니다.</strong> 디스크의{" "}
                <code className="text-cyan-600">session-approvals.json</code> 파일은 그대로
                남아있습니다. 완전히 초기화하려면 <code className="text-cyan-600">clear()</code> 후
                <code className="text-cyan-600">save()</code>를 호출하여 빈 상태를 디스크에
                반영하세요.
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
              기본 사용법 &mdash; 권한 승인 캐싱
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              가장 일반적인 사용 패턴입니다. Permission Manager 내부에서 이런 흐름으로 동작합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 1. 세션 저장소 생성 (인수 없음)"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">sessionStore</span> ={" "}
              <span className="kw">new</span> <span className="fn">SessionApprovalStore</span>();
              {"\n"}
              {"\n"}
              <span className="cm">{"// 2. 도구 실행 전 — 세션 캐시 확인"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">args</span> = {"{"}{" "}
              <span className="prop">path</span>:{" "}
              <span className="str">&quot;/src/index.ts&quot;</span> {"}"};{"\n"}
              <span className="kw">if</span> (<span className="prop">sessionStore</span>.
              <span className="fn">isApproved</span>(
              <span className="str">&quot;file_read&quot;</span>, <span className="prop">args</span>
              )) {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// 캐시 히트! 사용자에게 다시 묻지 않고 바로 실행"}</span>
              {"\n"}
              {"  "}
              <span className="kw">await</span> <span className="fn">executeTool</span>(
              <span className="str">&quot;file_read&quot;</span>, <span className="prop">args</span>
              );
              {"\n"}
              <span className="kw">
                {"}"} else {"{"}
              </span>
              {"\n"}
              {"  "}
              <span className="cm">{"// 캐시 미스 → 사용자에게 승인 요청"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">userChoice</span> ={" "}
              <span className="kw">await</span> <span className="fn">askUserPermission</span>(
              <span className="str">&quot;file_read&quot;</span>, <span className="prop">args</span>
              );
              {"\n"}
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">userChoice</span> ==={" "}
              <span className="str">&quot;allow-once&quot;</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="cm">{"// 이번 인수에 대해서만 승인"}</span>
              {"\n"}
              {"    "}
              <span className="prop">sessionStore</span>.<span className="fn">approve</span>(
              <span className="str">&quot;file_read&quot;</span>, <span className="prop">args</span>
              );
              {"\n"}
              {"  "}
              <span className="kw">{"}"} else if</span> (<span className="prop">userChoice</span>{" "}
              === <span className="str">&quot;allow-all&quot;</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="cm">{"// 이 도구의 모든 호출을 한꺼번에 승인"}</span>
              {"\n"}
              {"    "}
              <span className="prop">sessionStore</span>.<span className="fn">approveAll</span>(
              <span className="str">&quot;file_read&quot;</span>);
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"}"}
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>approve()</code>는 <code>path</code> 인수만 키에
              반영합니다.
              <code>{'{ command: "npm install" }'}</code>처럼 path가 없는 인수를 전달하면 도구
              이름만으로 키가 생성되어, 사실상 <code>approveAll()</code>과 동일한 효과가 됩니다.
              의도하지 않은 전체 승인을 방지하려면 이 동작을 이해해두세요.
            </Callout>

            {/* approve vs approveAll 비교 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              approve() vs approveAll() 비교
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              두 메서드의 차이를 구체적인 예시로 비교합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// ── approve(): 특정 경로만 승인 ──"}</span>
              {"\n"}
              <span className="prop">store</span>.<span className="fn">approve</span>(
              <span className="str">&quot;file_read&quot;</span>, {"{"}{" "}
              <span className="prop">path</span>: <span className="str">&quot;/src/a.ts&quot;</span>{" "}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="prop">store</span>.<span className="fn">isApproved</span>(
              <span className="str">&quot;file_read&quot;</span>, {"{"}{" "}
              <span className="prop">path</span>: <span className="str">&quot;/src/a.ts&quot;</span>{" "}
              {"}"}); <span className="cm">{"// → true  (정확히 같은 경로)"}</span>
              {"\n"}
              <span className="prop">store</span>.<span className="fn">isApproved</span>(
              <span className="str">&quot;file_read&quot;</span>, {"{"}{" "}
              <span className="prop">path</span>: <span className="str">&quot;/src/b.ts&quot;</span>{" "}
              {"}"}); <span className="cm">{"// → false (다른 경로)"}</span>
              {"\n"}
              <span className="prop">store</span>.<span className="fn">isApproved</span>(
              <span className="str">&quot;file_read&quot;</span>);{" "}
              <span className="cm">{"// → false (인수 없이 호출)"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// ── approveAll(): 도구 전체 승인 ──"}</span>
              {"\n"}
              <span className="prop">store</span>.<span className="fn">approveAll</span>(
              <span className="str">&quot;file_read&quot;</span>);
              {"\n"}
              {"\n"}
              <span className="prop">store</span>.<span className="fn">isApproved</span>(
              <span className="str">&quot;file_read&quot;</span>, {"{"}{" "}
              <span className="prop">path</span>: <span className="str">&quot;/src/a.ts&quot;</span>{" "}
              {"}"}); <span className="cm">{"// → true  (어떤 경로든 OK)"}</span>
              {"\n"}
              <span className="prop">store</span>.<span className="fn">isApproved</span>(
              <span className="str">&quot;file_read&quot;</span>, {"{"}{" "}
              <span className="prop">path</span>: <span className="str">&quot;/any/path&quot;</span>{" "}
              {"}"}); <span className="cm">{"// → true  (어떤 경로든 OK)"}</span>
              {"\n"}
              <span className="prop">store</span>.<span className="fn">isApproved</span>(
              <span className="str">&quot;file_read&quot;</span>);{" "}
              <span className="cm">{"// → true  (인수 없어도 OK)"}</span>
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> <code>approve()</code>와 <code>approveAll()</code>은 공존할 수
              있습니다. Set 기반이므로 같은 도구에 구체적 키와 전체 키가 동시에 들어가도
              문제없습니다.
              <code>isApproved()</code>가 2단계 조회를 하기 때문에 전체 키가 있으면 항상 통과합니다.
            </Callout>

            {/* 고급: 영속화 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 세션 승인 영속화
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              프로세스 재시작 후에도 이전 세션의 승인 상태를 이어서 사용하고 싶을 때의 패턴입니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// ── 프로세스 종료 시 ──"}</span>
              {"\n"}
              <span className="prop">sessionStore</span>.<span className="fn">save</span>();
              {"\n"}
              <span className="cm">{"// → ~/.dhelix/session-approvals.json에 저장"}</span>
              {"\n"}
              <span className="cm">
                {'// → ["file_read:/src/a.ts", "file_read", "Bash"] 형태의 JSON 배열'}
              </span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// ── 새 프로세스 시작 시 ──"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">newStore</span> ={" "}
              <span className="kw">new</span> <span className="fn">SessionApprovalStore</span>();
              {"\n"}
              <span className="prop">newStore</span>.<span className="fn">load</span>();{" "}
              <span className="cm">{"// 파일에서 이전 승인 복원"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 이전 세션의 승인이 살아있음"}</span>
              {"\n"}
              <span className="prop">newStore</span>.<span className="fn">isApproved</span>(
              <span className="str">&quot;file_read&quot;</span>, {"{"}{" "}
              <span className="prop">path</span>: <span className="str">&quot;/src/a.ts&quot;</span>{" "}
              {"}"}); <span className="cm">{"// → true"}</span>
            </CodeBlock>

            <DeepDive title="save()/load()의 best-effort 설계 이유">
              <p className="mb-3">
                <code className="text-cyan-600">save()</code>와{" "}
                <code className="text-cyan-600">load()</code>는 실패해도 에러를 던지지 않습니다.
                이를 <strong>최선 노력(best-effort)</strong> 패턴이라고 합니다. 왜 이렇게
                설계했을까요?
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  세션 승인은 <strong>편의 기능</strong>이지 핵심 기능이 아닙니다. 유실되면 사용자가
                  다시 승인하면 됩니다.
                </li>
                <li>
                  파일 시스템 에러(권한 부족, 디스크 풀 등)로 인해 전체 앱이 크래시되면 안 됩니다.
                </li>
                <li>
                  <code className="text-cyan-600">try/catch</code>에서 빈{" "}
                  <code className="text-cyan-600">catch</code>로 에러를 삼켜서 조용히 실패합니다.
                </li>
              </ul>
              <p className="mt-3 text-amber-600">
                반면 <strong>영구 권한 저장소</strong>(<code>persistent-store.ts</code>)는 비동기
                I/O를 사용하고, 핵심 보안 규칙을 저장하므로 더 신중하게 에러를 처리합니다.
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
              isApproved() 2단계 조회 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">isApproved()</code>는 항상 두 번의 Set.has()를
              시도합니다. 첫 번째가 실패해도 두 번째에서 전체 승인(
              <code className="text-cyan-600">approveAll()</code>)을 잡아낼 수 있으므로, 구체적
              승인과 전체 승인이 자연스럽게 공존합니다.
            </p>

            <MermaidDiagram
              title="isApproved() 2단계 조회"
              titleColor="purple"
              chart={`graph TD
  CALL(("isApproved(tool, args)")) --> BUILD["buildKey(tool, args)<br/><small>캐시 키 생성</small>"]
  BUILD --> HAS_PATH{"args에 path가 있으면<br/>키 = 'tool:path'<br/>없으면 키 = 'tool'"}
  HAS_PATH --> CHECK1{"1단계: 구체적 키<br/>Set.has(키)?"}
  CHECK1 -->|"있음"| TRUE1["return true<br/><small>정확히 같은 호출이 승인됨</small>"]
  CHECK1 -->|"없음"| CHECK2{"2단계: 도구 이름<br/>Set.has(tool)?"}
  CHECK2 -->|"있음"| TRUE2["return true<br/><small>approveAll()로 전체 승인됨</small>"]
  CHECK2 -->|"없음"| FALSE["return false<br/><small>캐시에 없음</small>"]

  style CALL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style BUILD fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style HAS_PATH fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style CHECK1 fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style CHECK2 fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style TRUE1 fill:#dcfce7,stroke:#10b981,color:#065f46
  style TRUE2 fill:#dcfce7,stroke:#10b981,color:#065f46
  style FALSE fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              buildKey() &mdash; 캐시 키 생성 전략
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">buildKey()</code>는 private 메서드로, 승인 키를
              생성하는 핵심 로직입니다. 모든 public 메서드(
              <code className="text-cyan-600">isApproved</code>,{" "}
              <code className="text-cyan-600">approve</code>)가 이 메서드를 거칩니다.
            </p>
            <CodeBlock>
              <span className="kw">private</span> <span className="fn">buildKey</span>(
              <span className="prop">toolName</span>: <span className="type">string</span>,{" "}
              <span className="prop">args</span>?:{" "}
              <span className="type">Readonly&lt;Record&lt;string, unknown&gt;&gt;</span>):{" "}
              <span className="type">string</span> {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [1] args 객체에 path 속성이 있고, 문자열이면"}</span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">args</span> &&{" "}
              <span className="str">&quot;path&quot;</span> <span className="kw">in</span>{" "}
              <span className="prop">args</span> && <span className="kw">typeof</span>{" "}
              <span className="prop">args</span>.<span className="prop">path</span> ==={" "}
              <span className="str">&quot;string&quot;</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="cm">{'// [2] "file_read:/src/index.ts" 형태의 구체적 키'}</span>
              {"\n"}
              {"    "}
              <span className="kw">return</span>{" "}
              <span className="str">{"`${toolName}:${args.path}`"}</span>;{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [3] path가 없으면 도구 이름만 사용"}</span>
              {"\n"}
              {"  "}
              <span className="kw">return</span> <span className="prop">toolName</span>;{"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> 세 가지 조건을 AND로 검사합니다:
                args가 존재하는지, path 속성이 있는지, 그 값이 문자열인지. 하나라도 실패하면 도구
                이름만 사용합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong>{" "}
                <code className="text-cyan-600">&quot;file_read:/src/index.ts&quot;</code> 형태의
                키를 생성합니다. 콜론(<code>:</code>)이 구분자입니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> path가 없는 경우 (예: Bash 도구의{" "}
                <code>{'{ command: "npm install" }'}</code>), 도구 이름만 키가 됩니다. 이 경우{" "}
                <code>approve()</code>와 <code>approveAll()</code>의 효과가 동일해집니다.
              </p>
            </div>

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              save()/load() 영속화 구현
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              세션 승인 영속화는 <strong>동기 I/O</strong>를 사용합니다. 비동기가 아닌 이유는, 보통
              프로세스 종료 직전에 호출되므로 비동기로 하면 저장 완료 전에 프로세스가 끝날 수 있기
              때문입니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// save() — Set → Array → JSON → 파일"}</span>
              {"\n"}
              <span className="fn">mkdirSync</span>(<span className="prop">dir</span>, {"{"}{" "}
              <span className="prop">recursive</span>: <span className="num">true</span> {"}"});
              {"\n"}
              <span className="fn">writeFileSync</span>({"\n"}
              {"  "}
              <span className="kw">this</span>.<span className="prop">persistPath</span>,{"\n"}
              {"  "}
              <span className="fn">JSON.stringify</span>([...<span className="kw">this</span>.
              <span className="prop">approved</span>]),
              {"\n"}
              {"  "}
              <span className="str">&quot;utf-8&quot;</span>
              {"\n"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// load() — 파일 → JSON → Array → Set에 추가"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">data</span> ={" "}
              <span className="fn">readFileSync</span>(<span className="kw">this</span>.
              <span className="prop">persistPath</span>,{" "}
              <span className="str">&quot;utf-8&quot;</span>);
              {"\n"}
              <span className="kw">const</span> <span className="prop">approvals</span> ={" "}
              <span className="fn">JSON.parse</span>(<span className="prop">data</span>){" "}
              <span className="kw">as</span> <span className="type">string[]</span>;{"\n"}
              <span className="kw">for</span> (<span className="kw">const</span>{" "}
              <span className="prop">key</span> <span className="kw">of</span>{" "}
              <span className="prop">approvals</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="kw">this</span>.<span className="prop">approved</span>.
              <span className="fn">add</span>(<span className="prop">key</span>);{" "}
              <span className="cm">{"// 기존 항목에 추가, 덮어쓰기 아님!"}</span>
              {"\n"}
              {"}"}
            </CodeBlock>

            <DeepDive title="Set vs Map vs Array 선택 이유">
              <p className="mb-3">
                승인 캐시에 <code className="text-cyan-600">Set</code>을 선택한 이유:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <strong>Array</strong>: <code>includes()</code>가 O(N)이라 항목이 많아지면
                  느려집니다.
                </li>
                <li>
                  <strong>Map</strong>: 키-값 쌍이 필요하지 않습니다. 승인은 &quot;있다/없다&quot;의
                  이진 판단입니다.
                </li>
                <li>
                  <strong>Set</strong>: <code>has()</code>가 O(1)이고, &quot;존재 여부만&quot;
                  판단하는 데 최적입니다.
                </li>
              </ul>
              <p className="mt-3 text-gray-600">
                또한 <code className="text-cyan-600">Set.add()</code>는 중복을 자동으로 무시하므로,
                같은 승인을 여러 번 호출해도 항목이 하나만 유지됩니다.
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
                &quot;같은 도구인데 매번 승인을 요청해요.&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                <code className="text-cyan-600">approve()</code>는 인수의{" "}
                <code className="text-cyan-600">path</code> 속성을 키에 포함합니다. 경로가 다른
                파일을 읽을 때마다 새로운 승인이 필요합니다.
              </p>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <strong>해결:</strong> 모든 경로에 대해 자동 승인하려면
                <code className="text-cyan-600">approveAll(&quot;file_read&quot;)</code>를
                사용하세요. 사용자에게 &quot;이 도구 전체 허용&quot; 옵션을 제공하는 것이 좋습니다.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;세션을 재시작하면 승인이 초기화돼요.&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                기본적으로 세션 저장소는 메모리에만 유지됩니다. 프로세스가 종료되면 Set의 내용이
                사라집니다.
              </p>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                <strong>해결 1:</strong> 프로세스 종료 전{" "}
                <code className="text-cyan-600">save()</code>, 시작 시{" "}
                <code className="text-cyan-600">load()</code>를 호출하세요.
              </p>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <strong>해결 2:</strong> 세션을 넘어 영구적으로 유지해야 하는 규칙이라면
                <code className="text-cyan-600">PersistentPermissionStore</code>의
                <code className="text-cyan-600">addRule()</code>을 사용하세요. settings.json에
                저장되어 영구적으로 유지됩니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;clear() 호출 후에도 다음 load()에서 승인이 복원돼요.&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">clear()</code>는 메모리의 Set만 비웁니다. 디스크의{" "}
                <code className="text-cyan-600">~/.dhelix/session-approvals.json</code>은
                그대로입니다.
                <code className="text-cyan-600">load()</code>를 다시 호출하면 파일에서 복원됩니다.
                <strong>해결:</strong> <code className="text-cyan-600">clear()</code> 직후
                <code className="text-cyan-600">save()</code>를 호출하면 빈 배열(<code>[]</code>)이
                저장되어 디스크도 깨끗해집니다.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Bash 도구에서 approve()를 호출했는데 모든 Bash 명령이 자동 승인돼요.&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                Bash 도구의 인수는{" "}
                <code className="text-cyan-600">{'{ command: "npm install" }'}</code> 형태입니다.
                <code className="text-cyan-600">path</code> 속성이 없으므로
                <code className="text-cyan-600">buildKey()</code>가 도구 이름만 키로 생성합니다.
                결과적으로{" "}
                <code className="text-cyan-600">
                  approve(&quot;Bash&quot;, {'{ command: "npm install" }'})
                </code>
                는<code className="text-cyan-600">approveAll(&quot;Bash&quot;)</code>와 동일한
                효과입니다.
                <strong>이것은 의도된 동작입니다.</strong> Bash 명령어의 세분화된 권한 관리는
                <code className="text-cyan-600">PersistentPermissionStore</code>의 와일드카드 패턴(
                <code>&quot;Bash(npm *)&quot;</code>)으로 처리합니다.
              </p>
            </div>

            {/* FAQ 5 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;size가 예상보다 많아요.&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                같은 도구에 <code className="text-cyan-600">approve()</code>와
                <code className="text-cyan-600">approveAll()</code>을 모두 호출하면 Set에 두 개의
                키가 들어갑니다 (예:{" "}
                <code className="text-cyan-600">&quot;file_read:/src/a.ts&quot;</code>와
                <code className="text-cyan-600">&quot;file_read&quot;</code>). 기능상 문제는 없지만,{" "}
                <code className="text-cyan-600">approveAll()</code> 후에는 구체적 키가 사실상 의미가
                없어집니다.
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
                  name: "manager.ts",
                  slug: "permission-manager",
                  relation: "parent",
                  desc: "5단계 권한 결정 트리의 2단계에서 SessionApprovalStore.isApproved()를 호출하는 오케스트레이터",
                },
                {
                  name: "persistent-store.ts",
                  slug: "permission-persistent-store",
                  relation: "sibling",
                  desc: 'settings.json에 영구 저장되는 권한 규칙. 세션 저장소의 "영구 버전"으로, deny/allow 와일드카드 패턴 지원',
                },
                {
                  name: "audit-log.ts",
                  slug: "permission-audit-log",
                  relation: "sibling",
                  desc: '권한 결정을 JSONL 형식으로 기록하는 감사 로거. 세션 저장소가 캐시 히트하면 "auto-approved" 결정이 기록됨',
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
