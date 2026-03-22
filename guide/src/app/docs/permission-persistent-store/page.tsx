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

export default function PermissionPersistentStorePage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/permissions/persistent-store.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              PersistentPermissionStore
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            영속적 권한 저장 &mdash; 사용자가 &quot;항상 허용&quot; 또는 &quot;항상 거부&quot;를 선택하면
            settings.json에 기록하여 다음 세션에서도 그 결정이 유지되도록 하는 모듈입니다.
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
              세션 저장소(<code className="text-cyan-600">SessionApprovalStore</code>)는 프로세스가 종료되면
              기억이 사라집니다. 하지만 &quot;npm install은 항상 허용&quot;이나 &quot;rm -rf는 절대 거부&quot;처럼
              세션을 넘어 영구적으로 유지해야 하는 규칙도 있습니다.
              <code className="text-cyan-600">PersistentPermissionStore</code>가 이 역할을 담당합니다.
            </p>
            <p>
              규칙은 <code className="text-cyan-600">settings.json</code> 파일에 저장됩니다.
              두 가지 <strong>저장 범위(scope)</strong>가 있습니다:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>
                <strong>project</strong> &mdash; 프로젝트별 설정 (<code className="text-cyan-600">{"{프로젝트}/.dbcode/settings.json"}</code>).
                이 프로젝트에서만 적용됩니다.
              </li>
              <li>
                <strong>user</strong> &mdash; 사용자 전체 설정 (<code className="text-cyan-600">~/.dbcode/settings.json</code>).
                모든 프로젝트에서 적용됩니다.
              </li>
            </ul>
            <p>
              핵심 원칙은 두 가지입니다:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>
                <strong className="text-red-600">deny가 항상 allow보다 우선합니다</strong> (안전 제일 원칙).
                같은 도구에 allow와 deny가 동시에 있으면 deny가 이깁니다.
              </li>
              <li>
                <strong>project 범위가 user 범위를 덮어씁니다</strong> (프로젝트별 커스터마이징).
                글로벌 규칙을 특정 프로젝트에서 재정의할 수 있습니다.
              </li>
            </ul>
            <p>
              이 모듈은 <strong>클로저(closure) 패턴</strong>으로 구현되어 있습니다.
              <code className="text-cyan-600">createPersistentPermissionStore(projectDir)</code> 팩토리 함수가
              <code className="text-cyan-600">projectDir</code>을 캡처하고, <code className="text-cyan-600">Object.freeze()</code>된
              불변 객체를 반환합니다.
            </p>
          </div>

          <MermaidDiagram
            title="PersistentPermissionStore 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  PM["Permission Manager<br/><small>permissions/manager.ts</small>"]
  SS["SessionApprovalStore<br/><small>session-store.ts</small>"]
  PS["PersistentPermissionStore<br/><small>persistent-store.ts</small>"]
  AL["AuditLogger<br/><small>audit-log.ts</small>"]
  WC["wildcard.ts<br/><small>패턴 파싱/매칭</small>"]
  PROJ[".dbcode/settings.json<br/><small>프로젝트 범위</small>"]
  USER["~/.dbcode/settings.json<br/><small>사용자 범위</small>"]

  PM -->|"1. 세션 캐시"| SS
  PM -->|"2. 영구 규칙 조회"| PS
  PM -->|"결정 기록"| AL
  PS -->|"parseRuleString()<br/>matchToolArgs()"| WC
  PS -->|"로드/저장"| PROJ
  PS -->|"로드/저장"| USER

  style PS fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style PM fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style SS fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style AL fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style WC fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style PROJ fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style USER fill:#fef3c7,stroke:#f59e0b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 건물의 출입 카드 시스템을 떠올리세요.
            건물 관리자(user 범위)가 &quot;방문자 출입 금지&quot; 같은 전체 규칙을 설정하고,
            각 층 관리자(project 범위)가 &quot;3층은 방문자 허용&quot;처럼 층별 규칙을 덮어쓸 수 있습니다.
            그리고 &quot;출입 금지&quot;는 항상 &quot;출입 허용&quot;보다 우선합니다 &mdash;
            허용 카드가 있어도 금지 목록에 있으면 들어갈 수 없습니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* ── PersistentPermissionRule interface ── */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface PersistentPermissionRule
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            settings.json에서 로드된 개별 권한 규칙을 나타내는 인터페이스입니다.
            모든 프로퍼티가 <code className="text-cyan-600">readonly</code>이며,
            <code className="text-cyan-600">Object.freeze()</code>로 불변 처리됩니다.
          </p>
          <ParamTable
            params={[
              { name: "tool", type: "string", required: true, desc: "도구 이름 (예: \"Bash\", \"file_read\", \"file_write\")" },
              { name: "pattern", type: "string | undefined", required: false, desc: "선택적 인수 패턴 (예: \"npm *\"). 없으면 도구의 모든 호출에 매칭됨" },
              { name: "type", type: "\"allow\" | \"deny\"", required: true, desc: "허용 규칙(allow) 또는 거부 규칙(deny)" },
              { name: "scope", type: "\"project\" | \"user\"", required: true, desc: "프로젝트 범위(.dbcode/settings.json) 또는 사용자 범위(~/.dbcode/settings.json)" },
            ]}
          />
          <div className="text-[13px] text-gray-600 mt-3 space-y-1">
            <p>&bull; <code className="text-cyan-600">&quot;Bash(npm *)&quot;</code> &rarr; <code>{"{ tool: \"Bash\", pattern: \"npm *\", type: \"allow\" }"}</code></p>
            <p>&bull; <code className="text-cyan-600">&quot;file_read&quot;</code> &rarr; <code>{"{ tool: \"file_read\", pattern: undefined, type: \"allow\" }"}</code></p>
          </div>

          {/* ── PersistentPermissionStore interface ── */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface PersistentPermissionStore
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            settings.json을 통해 권한 규칙을 읽고, 추가, 삭제, 검사하는 CRUD 인터페이스입니다.
            <code className="text-cyan-600">createPersistentPermissionStore()</code> 팩토리 함수가 이 인터페이스를
            구현한 객체를 반환합니다.
          </p>

          {/* loadRules */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            loadRules()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            양쪽 범위(project + user)에서 모든 규칙을 <strong>병렬로</strong> 로드하고 병합합니다.
            project 범위의 규칙이 동일한 키를 가진 user 범위 규칙을 덮어씁니다.
            반환값은 <code className="text-cyan-600">Object.freeze()</code>로 동결된 불변 배열입니다.
          </p>
          <CodeBlock>
            <span className="fn">loadRules</span>(): <span className="type">Promise&lt;readonly PersistentPermissionRule[]&gt;</span>
          </CodeBlock>

          {/* addRule */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            addRule(rule, scope)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            새로운 규칙을 settings.json에 추가합니다.
            중복 검사를 수행하여 동일한 규칙 문자열이 이미 존재하면 추가하지 않습니다.
            기존 settings.json의 다른 속성(permissions 외)은 보존됩니다.
          </p>
          <CodeBlock>
            <span className="fn">addRule</span>(
            {"\n"}{"  "}<span className="prop">rule</span>: <span className="type">Omit&lt;PersistentPermissionRule, &quot;scope&quot;&gt;</span>,
            {"\n"}{"  "}<span className="prop">scope</span>: <span className="type">&quot;project&quot; | &quot;user&quot;</span>
            {"\n"}): <span className="type">Promise&lt;void&gt;</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "rule", type: "Omit<PersistentPermissionRule, \"scope\">", required: true, desc: "추가할 규칙 — tool, type 필수, pattern은 선택" },
              { name: "scope", type: "\"project\" | \"user\"", required: true, desc: "저장할 범위. project는 프로젝트 설정에, user는 사용자 전체 설정에 저장" },
            ]}
          />

          {/* removeRule */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            removeRule(tool, pattern?, scope?)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            규칙을 settings.json에서 삭제합니다.
            scope를 지정하면 해당 범위에서만, 생략하면 <strong>양쪽 범위 모두</strong>에서 삭제합니다.
            allow와 deny 목록 모두에서 해당 규칙 문자열을 제거합니다.
            대상 범위들에서 <strong>병렬로</strong> 삭제를 수행합니다.
          </p>
          <CodeBlock>
            <span className="fn">removeRule</span>(
            {"\n"}{"  "}<span className="prop">tool</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">pattern</span>?: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">scope</span>?: <span className="type">&quot;project&quot; | &quot;user&quot;</span>
            {"\n"}): <span className="type">Promise&lt;void&gt;</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "tool", type: "string", required: true, desc: "삭제할 도구 이름" },
              { name: "pattern", type: "string", required: false, desc: "삭제할 인수 패턴. 없으면 패턴 없는 규칙(도구 전체) 삭제" },
              { name: "scope", type: "\"project\" | \"user\"", required: false, desc: "삭제할 범위. 미지정 시 project와 user 양쪽에서 모두 삭제" },
            ]}
          />

          {/* getRulesForTool */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            getRulesForTool(tool)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            특정 도구에 적용되는 모든 규칙(allow + deny, project + user)을 가져옵니다.
            내부적으로 <code className="text-cyan-600">loadRules()</code>를 호출한 뒤
            <code className="text-cyan-600">tool</code> 필드로 필터링합니다.
            디버깅이나 UI에서 &quot;이 도구에 적용된 규칙 목록&quot;을 보여줄 때 유용합니다.
          </p>
          <CodeBlock>
            <span className="fn">getRulesForTool</span>(<span className="prop">tool</span>: <span className="type">string</span>): <span className="type">Promise&lt;readonly PersistentPermissionRule[]&gt;</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "tool", type: "string", required: true, desc: "조회할 도구 이름 (예: \"Bash\", \"file_read\")" },
            ]}
          />

          {/* checkPermission */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            checkPermission(tool, args?)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            도구 실행이 영구 규칙에 의해 허용/거부되는지 검사합니다.
            <strong>deny-first</strong> 원칙에 따라 deny 규칙을 먼저 확인합니다.
            와일드카드 패턴이 있는 규칙은 <code className="text-cyan-600">matchToolArgs()</code>로
            인수와 매칭을 확인합니다. 패턴이 없는 규칙은 도구의 모든 호출에 매칭됩니다.
          </p>
          <CodeBlock>
            <span className="fn">checkPermission</span>(
            {"\n"}{"  "}<span className="prop">tool</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">args</span>?: <span className="type">Record&lt;string, unknown&gt;</span>
            {"\n"}): <span className="type">Promise&lt;&quot;allow&quot; | &quot;deny&quot; | &quot;none&quot;&gt;</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "tool", type: "string", required: true, desc: "검사할 도구 이름" },
              { name: "args", type: "Record<string, unknown>", required: false, desc: "도구 인수. 규칙의 와일드카드 패턴과 매칭 확인에 사용" },
            ]}
          />
          <div className="text-[13px] text-gray-600 mt-2 space-y-1">
            <p>&bull; <code className="text-emerald-600">&quot;allow&quot;</code> &mdash; 영구 허용 규칙에 매칭됨. 사용자 프롬프트 없이 바로 실행 가능</p>
            <p>&bull; <code className="text-red-600">&quot;deny&quot;</code> &mdash; 영구 거부 규칙에 매칭됨. 도구 실행을 차단해야 함</p>
            <p>&bull; <code className="text-gray-500">&quot;none&quot;</code> &mdash; 매칭되는 규칙 없음. 다음 검사 단계(세션 캐시 또는 사용자 프롬프트)로 진행</p>
          </div>

          {/* clearRules */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            clearRules(scope)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            특정 범위의 모든 권한 규칙을 삭제합니다.
            allow와 deny 목록을 모두 빈 배열로 초기화합니다.
            settings.json의 다른 속성은 보존됩니다.
          </p>
          <CodeBlock>
            <span className="fn">clearRules</span>(<span className="prop">scope</span>: <span className="type">&quot;project&quot; | &quot;user&quot;</span>): <span className="type">Promise&lt;void&gt;</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "scope", type: "\"project\" | \"user\"", required: true, desc: "삭제할 범위. 해당 범위의 allow/deny가 모두 빈 배열로 초기화됨" },
            ]}
          />

          {/* ── createPersistentPermissionStore factory ── */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            createPersistentPermissionStore(projectDir)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            팩토리 함수입니다. 클로저 패턴으로 <code className="text-cyan-600">projectDir</code>을 캡처하고,
            위 인터페이스를 구현한 <code className="text-cyan-600">Object.freeze()</code>된 객체를 반환합니다.
            이 객체의 메서드는 외부에서 교체하거나 삭제할 수 없습니다.
          </p>
          <CodeBlock>
            <span className="kw">export function</span> <span className="fn">createPersistentPermissionStore</span>(
            {"\n"}{"  "}<span className="prop">projectDir</span>: <span className="type">string</span>
            {"\n"}): <span className="type">PersistentPermissionStore</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "projectDir", type: "string", required: true, desc: "프로젝트 루트 디렉토리의 절대 경로. project 범위의 settings.json 위치를 결정" },
            ]}
          />

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <strong>deny는 항상 allow보다 우선합니다.</strong>{" "}
              <code className="text-cyan-600">checkPermission()</code>은 deny 규칙을 먼저 검사합니다.
              같은 도구에 allow와 deny가 모두 매칭되면 deny가 이깁니다.
            </li>
            <li>
              <strong>project 범위가 user 범위를 덮어씁니다.</strong>{" "}
              <code className="text-cyan-600">loadRules()</code>는 동일한 규칙 키를 가진 user 규칙을
              project 규칙으로 대체합니다. 규칙 키는 <code className="text-cyan-600">&quot;도구(패턴):타입&quot;</code> 형식입니다.
            </li>
            <li>
              <strong>매 호출마다 파일을 읽습니다.</strong>{" "}
              <code className="text-cyan-600">loadRules()</code>와 <code className="text-cyan-600">checkPermission()</code>은
              호출될 때마다 settings.json을 읽습니다. 캐싱은 하지 않으므로 파일을 직접 수정해도 즉시 반영됩니다.
              반면 빈번한 호출 시 I/O 오버헤드가 발생할 수 있습니다.
            </li>
            <li>
              <strong>settings.json 얕은 병합(shallow merge)입니다.</strong>{" "}
              <code className="text-cyan-600">addRule()</code>/<code className="text-cyan-600">removeRule()</code>은
              기존 파일을 읽은 뒤 <code className="text-cyan-600">permissions</code> 섹션만 업데이트하고
              다시 저장합니다. 다른 최상위 속성(예: <code className="text-cyan-600">model</code>,{" "}
              <code className="text-cyan-600">theme</code>)은 보존되지만,{" "}
              <code className="text-cyan-600">permissions</code> 내부는 전체가 다시 작성됩니다.
            </li>
            <li>
              <strong>와일드카드 매칭은 wildcard.ts에 의존합니다.</strong>{" "}
              <code className="text-cyan-600">parseRuleString()</code>,{" "}
              <code className="text-cyan-600">formatRuleString()</code>,{" "}
              <code className="text-cyan-600">matchToolArgs()</code>는 모두 별도 모듈에서 가져옵니다.
              <code className="text-cyan-600">*</code> 와일드카드를 지원합니다 (예: <code className="text-cyan-600">&quot;npm *&quot;</code>는
              &quot;npm install&quot;, &quot;npm test&quot; 등에 매칭).
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 영구 규칙 추가와 확인</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            사용자가 &quot;항상 허용&quot; 또는 &quot;항상 거부&quot;를 선택했을 때 영구 규칙을 추가하고,
            이후 도구 실행 시 확인하는 전체 흐름입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 1. 저장소 생성 — 프로젝트 루트 경로를 전달"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">store</span> = <span className="fn">createPersistentPermissionStore</span>(<span className="str">&quot;/home/user/my-app&quot;</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// 2. 사용자가 \"항상 허용\"을 선택 → 영구 규칙 추가"}</span>
            {"\n"}<span className="kw">await</span> <span className="prop">store</span>.<span className="fn">addRule</span>(
            {"\n"}{"  "}{"{"} <span className="prop">tool</span>: <span className="str">&quot;file_read&quot;</span>, <span className="prop">type</span>: <span className="str">&quot;allow&quot;</span> {"}"},
            {"\n"}{"  "}<span className="str">&quot;project&quot;</span>  <span className="cm">{"// 이 프로젝트에서만 적용"}</span>
            {"\n"});
            {"\n"}<span className="cm">{"// → .dbcode/settings.json에 저장됨:"}</span>
            {"\n"}<span className="cm">{"// { \"permissions\": { \"allow\": [\"file_read\"], \"deny\": [] } }"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 3. 와일드카드 패턴으로 특정 Bash 명령만 허용"}</span>
            {"\n"}<span className="kw">await</span> <span className="prop">store</span>.<span className="fn">addRule</span>(
            {"\n"}{"  "}{"{"} <span className="prop">tool</span>: <span className="str">&quot;Bash&quot;</span>, <span className="prop">pattern</span>: <span className="str">&quot;npm *&quot;</span>, <span className="prop">type</span>: <span className="str">&quot;allow&quot;</span> {"}"},
            {"\n"}{"  "}<span className="str">&quot;user&quot;</span>  <span className="cm">{"// 모든 프로젝트에서 적용"}</span>
            {"\n"});
            {"\n"}<span className="cm">{"// → ~/.dbcode/settings.json에 저장됨:"}</span>
            {"\n"}<span className="cm">{"// { \"permissions\": { \"allow\": [\"Bash(npm *)\"], \"deny\": [] } }"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 4. 위험한 명령 영구 거부"}</span>
            {"\n"}<span className="kw">await</span> <span className="prop">store</span>.<span className="fn">addRule</span>(
            {"\n"}{"  "}{"{"} <span className="prop">tool</span>: <span className="str">&quot;Bash&quot;</span>, <span className="prop">pattern</span>: <span className="str">&quot;rm -rf *&quot;</span>, <span className="prop">type</span>: <span className="str">&quot;deny&quot;</span> {"}"},
            {"\n"}{"  "}<span className="str">&quot;user&quot;</span>
            {"\n"});
            {"\n"}
            {"\n"}<span className="cm">{"// 5. 도구 실행 전 권한 확인"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">result</span> = <span className="kw">await</span> <span className="prop">store</span>.<span className="fn">checkPermission</span>(<span className="str">&quot;Bash&quot;</span>, {"{"} <span className="prop">command</span>: <span className="str">&quot;npm install&quot;</span> {"}"});
            {"\n"}<span className="cm">{"// → \"allow\" (\"npm *\" 패턴에 매칭)"}</span>
            {"\n"}
            {"\n"}<span className="kw">const</span> <span className="prop">result2</span> = <span className="kw">await</span> <span className="prop">store</span>.<span className="fn">checkPermission</span>(<span className="str">&quot;Bash&quot;</span>, {"{"} <span className="prop">command</span>: <span className="str">&quot;rm -rf /&quot;</span> {"}"});
            {"\n"}<span className="cm">{"// → \"deny\" (\"rm -rf *\" 패턴에 매칭, deny가 우선)"}</span>
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> deny 규칙은 항상 allow 규칙보다 우선합니다.
            같은 도구에 <code>&quot;Bash(npm *)&quot;</code> allow와 <code>&quot;Bash(npm audit *)&quot;</code> deny가 있으면,
            <code>npm audit fix</code>는 <strong>거부</strong>됩니다.
            deny 규칙을 추가할 때는 의도하지 않은 차단이 없는지 주의하세요.
          </Callout>

          {/* 고급: 규칙 관리 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 규칙 조회, 삭제, 초기화
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            추가된 규칙을 관리하는 패턴입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// ── 특정 도구의 모든 규칙 조회 ──"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">bashRules</span> = <span className="kw">await</span> <span className="prop">store</span>.<span className="fn">getRulesForTool</span>(<span className="str">&quot;Bash&quot;</span>);
            {"\n"}<span className="cm">{"// → ["}</span>
            {"\n"}<span className="cm">{"//   { tool: \"Bash\", pattern: \"npm *\", type: \"allow\", scope: \"user\" },"}</span>
            {"\n"}<span className="cm">{"//   { tool: \"Bash\", pattern: \"rm -rf *\", type: \"deny\", scope: \"user\" }"}</span>
            {"\n"}<span className="cm">{"// ]"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// ── 특정 규칙 삭제 ──"}</span>
            {"\n"}<span className="kw">await</span> <span className="prop">store</span>.<span className="fn">removeRule</span>(<span className="str">&quot;Bash&quot;</span>, <span className="str">&quot;npm *&quot;</span>, <span className="str">&quot;user&quot;</span>);
            {"\n"}<span className="cm">{"// user 범위에서 \"Bash(npm *)\" 규칙만 삭제"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// ── scope 미지정 → 양쪽 범위 모두에서 삭제 ──"}</span>
            {"\n"}<span className="kw">await</span> <span className="prop">store</span>.<span className="fn">removeRule</span>(<span className="str">&quot;Bash&quot;</span>, <span className="str">&quot;rm -rf *&quot;</span>);
            {"\n"}<span className="cm">{"// project + user 양쪽에서 \"Bash(rm -rf *)\" 삭제"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// ── 특정 범위의 모든 규칙 초기화 ──"}</span>
            {"\n"}<span className="kw">await</span> <span className="prop">store</span>.<span className="fn">clearRules</span>(<span className="str">&quot;project&quot;</span>);
            {"\n"}<span className="cm">{"// project 범위의 allow/deny가 모두 빈 배열로 초기화"}</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> <code>loadRules()</code>로 전체 규칙을 로드하면
            각 규칙의 <code>scope</code> 속성으로 어느 범위에서 온 것인지 알 수 있습니다.
            디버깅할 때 &quot;이 규칙이 프로젝트 설정인지 사용자 설정인지&quot; 구분하는 데 유용합니다.
          </Callout>

          <DeepDive title="settings.json 내 권한 형식 상세">
            <p className="mb-3">
              settings.json의 <code className="text-cyan-600">permissions</code> 섹션은 다음 형식입니다.
              이 형식은 사람이 직접 편집할 수도 있습니다:
            </p>
            <CodeBlock>
              {"{"}
              {"\n"}{"  "}<span className="str">&quot;permissions&quot;</span>: {"{"}
              {"\n"}{"    "}<span className="str">&quot;allow&quot;</span>: [
              {"\n"}{"      "}<span className="str">&quot;file_read&quot;</span>,         <span className="cm">{"// 패턴 없음 → 도구의 모든 호출 허용"}</span>
              {"\n"}{"      "}<span className="str">&quot;Bash(npm *)&quot;</span>        <span className="cm">{"// 패턴 있음 → npm으로 시작하는 명령만 허용"}</span>
              {"\n"}{"    ],"}
              {"\n"}{"    "}<span className="str">&quot;deny&quot;</span>:{" ["}
              {"\n"}{"      "}<span className="str">&quot;Bash(rm -rf *)&quot;</span>     <span className="cm">{"// rm -rf로 시작하는 명령은 항상 거부"}</span>
              {"\n"}{"    ]"}
              {"\n"}{"  "}&#125;
              {"\n"}&#125;
            </CodeBlock>
            <p className="mt-3 text-gray-600">
              규칙 문자열은 <code className="text-cyan-600">parseRuleString()</code>(<code className="text-cyan-600">wildcard.ts</code>)으로 파싱됩니다:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600 mt-2">
              <li><code>&quot;file_read&quot;</code> &rarr; <code>{"{ tool: \"file_read\", pattern: undefined }"}</code></li>
              <li><code>&quot;Bash(npm *)&quot;</code> &rarr; <code>{"{ tool: \"Bash\", pattern: \"npm *\" }"}</code></li>
            </ul>
            <p className="mt-3 text-amber-600">
              <code className="text-cyan-600">extractPermissions()</code> 내부 함수가 타입 안전성을 보장합니다.
              배열에 실수로 숫자나 객체가 포함되어도 문자열만 필터링합니다.
              permissions 속성 자체가 없거나 잘못된 형식이면 빈 배열을 반환합니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>checkPermission() deny-first 판정 흐름</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">checkPermission()</code>의 핵심 로직입니다.
            deny를 먼저 확인하는 <strong>deny-first</strong> 원칙이 여기서 구현됩니다.
          </p>

          <MermaidDiagram
            title="checkPermission() 판정 흐름"
            titleColor="purple"
            chart={`graph TD
  START(("checkPermission(tool, args)")) --> LOAD["loadRules()<br/><small>project + user 병합</small>"]
  LOAD --> FILTER{"해당 도구의<br/>규칙이 존재?"}
  FILTER -->|"0개"| NONE["return 'none'<br/><small>매칭 규칙 없음</small>"]
  FILTER -->|"1개 이상"| DENY_LOOP["deny 규칙 순회"]
  DENY_LOOP --> DENY_PAT{"패턴 있는가?"}
  DENY_PAT -->|"패턴 없음"| DENY_ALL["return 'deny'<br/><small>도구 전체 거부</small>"]
  DENY_PAT -->|"패턴 있음"| DENY_MATCH{"matchToolArgs()<br/>인수 매칭?"}
  DENY_MATCH -->|"매칭"| DENY_HIT["return 'deny'"]
  DENY_MATCH -->|"불일치"| DENY_NEXT{"다음 deny 규칙?"}
  DENY_NEXT -->|"있음"| DENY_PAT
  DENY_NEXT -->|"없음"| ALLOW_LOOP["allow 규칙 순회<br/><small>동일한 로직</small>"]
  ALLOW_LOOP -->|"매칭"| ALLOW_HIT["return 'allow'"]
  ALLOW_LOOP -->|"전부 불일치"| NONE2["return 'none'"]

  style START fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style LOAD fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style FILTER fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style DENY_LOOP fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style DENY_PAT fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style DENY_ALL fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style DENY_MATCH fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style DENY_HIT fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style DENY_NEXT fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style ALLOW_LOOP fill:#dcfce7,stroke:#10b981,color:#065f46
  style ALLOW_HIT fill:#dcfce7,stroke:#10b981,color:#065f46
  style NONE fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style NONE2 fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>loadRules() &mdash; 양쪽 범위 병합 전략</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">loadRules()</code>는 두 범위의 규칙을 <strong>병렬로</strong> 읽은 뒤
            project 규칙이 동일한 user 규칙을 덮어쓰도록 병합합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// [1] 두 범위의 규칙을 병렬로 로드 (I/O 대기 시간 절약)"}</span>
            {"\n"}<span className="kw">const</span> [<span className="prop">userRules</span>, <span className="prop">projectRules</span>] = <span className="kw">await</span> <span className="fn">Promise.all</span>([
            {"\n"}{"  "}<span className="fn">loadFromScope</span>(<span className="str">&quot;user&quot;</span>),
            {"\n"}{"  "}<span className="fn">loadFromScope</span>(<span className="str">&quot;project&quot;</span>),
            {"\n"}]);
            {"\n"}
            {"\n"}<span className="cm">{"// [2] project 규칙의 고유 키 집합을 생성"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">projectKeys</span> = <span className="kw">new</span> <span className="fn">Set</span>(<span className="prop">projectRules</span>.<span className="fn">map</span>(<span className="prop">ruleKey</span>));
            {"\n"}<span className="cm">{"// ruleKey 형식: \"Bash(npm *):allow\""}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// [3] project 규칙과 키가 겹치는 user 규칙을 제외"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">filtered</span> = <span className="prop">userRules</span>.<span className="fn">filter</span>(
            {"\n"}{"  "}<span className="prop">r</span> ={">"} !<span className="prop">projectKeys</span>.<span className="fn">has</span>(<span className="fn">ruleKey</span>(<span className="prop">r</span>))
            {"\n"});
            {"\n"}
            {"\n"}<span className="cm">{"// [4] project 규칙 우선 + 필터링된 user 규칙 → 불변 배열"}</span>
            {"\n"}<span className="kw">return</span> <span className="fn">Object.freeze</span>([...<span className="prop">projectRules</span>, ...<span className="prop">filtered</span>]);
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> <code className="text-cyan-600">Promise.all()</code>로 두 파일을 동시에 읽어 I/O 대기 시간을 줄입니다. 순차적으로 읽으면 2배의 시간이 걸립니다.</p>
            <p><strong className="text-gray-900">[2]</strong> <code className="text-cyan-600">ruleKey()</code>는 <code>&quot;Bash(npm *):allow&quot;</code> 형식의 고유 키를 생성합니다. 도구 이름 + 패턴 + 타입의 조합입니다.</p>
            <p><strong className="text-gray-900">[3]</strong> project 규칙의 키 집합에 포함된 user 규칙은 필터링됩니다. 예를 들어, user에 <code>&quot;Bash(npm *):allow&quot;</code>가 있고 project에도 동일한 키가 있으면 user 것은 버립니다.</p>
            <p><strong className="text-gray-900">[4]</strong> project 규칙을 앞에, 필터링된 user 규칙을 뒤에 놓은 배열을 <code className="text-cyan-600">Object.freeze()</code>로 동결하여 반환합니다.</p>
          </div>

          <DeepDive title="writeSettingsFile() — 얕은 병합으로 설정 보존">
            <p className="mb-3">
              규칙을 추가/삭제할 때 기존 settings.json의 다른 속성을 잃어버리면 안 됩니다.
              <code className="text-cyan-600">writeSettingsFile()</code>은 이를 위해 얕은 병합(shallow merge)을 수행합니다:
            </p>
            <CodeBlock>
              <span className="cm">{"// 1. 기존 설정 읽기"}</span>
              {"\n"}<span className="kw">const</span> <span className="prop">existing</span> = <span className="kw">await</span> <span className="fn">readSettingsFile</span>(<span className="prop">filePath</span>);
              {"\n"}<span className="cm">{"// existing = { model: \"gpt-4\", permissions: { allow: [...], deny: [] } }"}</span>
              {"\n"}
              {"\n"}<span className="cm">{"// 2. 업데이트와 얕은 병합 — 스프레드 연산자"}</span>
              {"\n"}<span className="kw">const</span> <span className="prop">merged</span> = {"{"} ...<span className="prop">existing</span>, ...<span className="prop">update</span> {"}"};
              {"\n"}<span className="cm">{"// model은 보존, permissions는 update의 것으로 교체"}</span>
              {"\n"}
              {"\n"}<span className="cm">{"// 3. 디렉토리 생성 + 2칸 들여쓰기 + 마지막 줄바꿈"}</span>
              {"\n"}<span className="kw">await</span> <span className="fn">mkdir</span>(<span className="fn">dirName</span>(<span className="prop">filePath</span>), {"{"} <span className="prop">recursive</span>: <span className="num">true</span> {"}"});
              {"\n"}<span className="kw">await</span> <span className="fn">writeFile</span>(<span className="prop">filePath</span>, <span className="fn">JSON.stringify</span>(<span className="prop">merged</span>, <span className="kw">null</span>, <span className="num">2</span>) + <span className="str">&quot;\n&quot;</span>);
            </CodeBlock>
            <p className="mt-3 text-amber-600">
              &quot;얕은&quot; 병합이므로 최상위 속성만 보존됩니다.
              <code className="text-cyan-600">permissions</code> 내부의
              <code className="text-cyan-600">allow</code>/<code className="text-cyan-600">deny</code>는
              전체가 교체됩니다. 깊은 중첩 구조를 직접 편집할 때는 이 점에 유의하세요.
            </p>
          </DeepDive>
        </section>
      </RevealOnScroll>

      {/* ─── 5. 트러블슈팅 (Troubleshooting) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>🔧</span> 트러블슈팅
          </h2>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;allow 규칙을 추가했는데 여전히 거부돼요.&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              deny 규칙이 항상 allow보다 우선합니다.
              <code className="text-cyan-600">getRulesForTool()</code>로 해당 도구의 모든 규칙을 확인하세요.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">rules</span> = <span className="kw">await</span> <span className="prop">store</span>.<span className="fn">getRulesForTool</span>(<span className="str">&quot;Bash&quot;</span>);
              {"\n"}<span className="fn">console</span>.<span className="fn">log</span>(<span className="prop">rules</span>);
              {"\n"}<span className="cm">{"// deny 규칙이 있다면 removeRule()로 먼저 삭제"}</span>
              {"\n"}<span className="kw">await</span> <span className="prop">store</span>.<span className="fn">removeRule</span>(<span className="str">&quot;Bash&quot;</span>, <span className="str">&quot;npm audit *&quot;</span>, <span className="str">&quot;user&quot;</span>);
            </CodeBlock>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;프로젝트 설정이 사용자 설정을 덮어쓰지 않아요.&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              덮어쓰기는 <strong>동일한 규칙 키</strong>인 경우에만 발생합니다.
              규칙 키는 <code className="text-cyan-600">&quot;도구(패턴):타입&quot;</code> 형식이므로,
              패턴이 다르면 다른 규칙으로 취급됩니다.
            </p>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              예를 들어, user의 <code className="text-cyan-600">&quot;Bash(npm *):allow&quot;</code>와
              project의 <code className="text-cyan-600">&quot;Bash(npm install):allow&quot;</code>는
              키가 다르므로 <strong>둘 다 살아남습니다</strong>.
              project에서 user의 npm 규칙을 덮어쓰려면 정확히 같은 패턴을 사용하세요.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;settings.json을 직접 수정했는데 반영이 안 돼요.&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              <code className="text-cyan-600">loadRules()</code>는 매 호출마다 파일을 다시 읽으므로
              직접 수정은 즉시 반영됩니다.
              하지만 Permission Manager가 세션 저장소에 결과를 캐시하고 있을 수 있습니다.
              이 경우 세션 저장소의 <code className="text-cyan-600">clear()</code>도 호출하거나
              dbcode를 재시작하세요.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;settings.json의 다른 설정이 사라졌어요.&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">writeSettingsFile()</code>은 얕은 병합입니다.
              최상위 속성은 보존되지만 <code className="text-cyan-600">permissions</code> 내부는 전체가 교체됩니다.
              직접 편집할 때는 <code className="text-cyan-600">allow</code>와{" "}
              <code className="text-cyan-600">deny</code>가 반드시 문자열 배열인지 확인하세요.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;checkPermission()이 &apos;none&apos;을 반환하는데 왜 도구가 실행되나요?&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">&quot;none&quot;</code>은 &quot;영구 규칙에 매칭되는 것이 없다&quot;는 뜻이지 거부가 아닙니다.
              Permission Manager는 이 경우 세션 캐시를 확인하고, 거기서도 없으면
              사용자에게 직접 물어봅니다. 사용자가 &quot;허용&quot;을 누르면 실행됩니다.
              <code className="text-cyan-600">&quot;none&quot;</code>은 &quot;판단 보류&quot;입니다.
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
                name: "manager.ts",
                slug: "permission-manager",
                relation: "parent",
                desc: "5단계 권한 결정 트리에서 1단계(deny)와 3단계(allow)에서 checkPermission()을 호출하는 오케스트레이터",
              },
              {
                name: "session-store.ts",
                slug: "permission-session-store",
                relation: "sibling",
                desc: "세션별 승인 캐시. 영구 저장소의 \"임시 버전\"으로, 메모리 기반 O(1) 조회",
              },
              {
                name: "audit-log.ts",
                slug: "permission-audit-log",
                relation: "sibling",
                desc: "권한 결정 이력을 JSONL로 기록하는 감사 로거. 영구 규칙 매칭 시 결정이 기록됨",
              },
              {
                name: "config-loader.ts",
                slug: "config-loader",
                relation: "sibling",
                desc: "5-Layer 설정 병합 시스템. settings.json의 전체 구조를 관리하는 상위 모듈",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
