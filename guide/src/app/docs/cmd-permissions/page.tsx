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

export default function CmdPermissionsPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/commands/permissions.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">/permissions</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              LLM 도구 호출 권한을 세밀하게 관리하는 영구 규칙 관리 명령어입니다.
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
                <code className="text-cyan-600">/permissions</code>는 LLM이 파일 쓰기, 명령 실행
                등의 도구(tool)를 호출할 때 자동으로 허용하거나 거부할 규칙을 관리합니다. 규칙은{" "}
                <code className="text-cyan-600">~/.dhelix/settings.json</code>에 영구 저장되어
                세션을 재시작해도 유지됩니다.
              </p>
              <p>
                4가지 서브커맨드(<code className="text-cyan-600">allow</code>,
                <code className="text-cyan-600">deny</code>,
                <code className="text-cyan-600">remove</code>,
                <code className="text-cyan-600">reset</code>)로 규칙을 추가/제거/초기화할 수 있으며,
                인자 없이 호출하면 현재 권한 상태를 표시합니다.
              </p>
              <p>
                패턴은 두 가지 형식을 지원합니다: 단순 도구 이름(
                <code className="text-cyan-600">bash_exec</code>)과 도구+인자 패턴(
                <code className="text-cyan-600">Bash(npm *)</code>). 후자는 특정 인자 패턴에만
                매칭되는 세밀한 제어가 가능합니다.
              </p>
            </div>

            <MermaidDiagram
              title="/permissions 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  USER["사용자 입력<br/><small>/permissions [sub] [pattern]</small>"]
  REG["Command Registry<br/><small>registry.ts</small>"]
  PERM["permissionsCommand<br/><small>permissions.ts</small>"]
  SETTINGS["settings.json<br/><small>~/.dhelix/settings.json</small>"]
  MODES["Permission Modes<br/><small>modes.ts</small>"]
  ENGINE["Permission Engine<br/><small>permission-manager.ts</small>"]

  USER -->|"슬래시 명령"| REG
  REG -->|"execute()"| PERM
  PERM -->|"read/write"| SETTINGS
  PERM -->|"getModeDescription"| MODES
  SETTINGS -.->|"규칙 로드"| ENGINE

  style PERM fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style SETTINGS fill:#fef3c7,stroke:#f59e0b,color:#1e293b,stroke-width:2px
  style REG fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style MODES fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style ENGINE fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 건물의 출입 허가 목록을 떠올리세요. 특정 사람(도구)이 특정
              구역(인자 패턴)에 들어갈 수 있는지를 허용/거부 목록으로 관리하듯,{" "}
              <code>/permissions</code>는 LLM의 도구 호출 권한을 세밀하게 제어합니다.
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

            {/* PermissionsSettings interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface PermissionsSettings
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              <code className="text-cyan-600">settings.json</code>의 permissions 섹션 구조입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "allow",
                  type: "readonly string[]",
                  required: true,
                  desc: "허용 규칙 배열 (매칭되는 도구는 자동 허용)",
                },
                {
                  name: "deny",
                  type: "readonly string[]",
                  required: true,
                  desc: "거부 규칙 배열 (매칭되는 도구는 자동 거부)",
                },
              ]}
            />

            {/* validatePattern */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              validatePattern(pattern)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              권한 패턴의 유효성을 검증합니다. 유효하면 <code className="text-cyan-600">null</code>,
              무효하면 에러 메시지 문자열을 반환합니다.
            </p>
            <CodeBlock>
              <span className="fn">validatePattern</span>(<span className="prop">pattern</span>:{" "}
              <span className="type">string</span>): <span className="type">string</span> |{" "}
              <span className="type">null</span>
            </CodeBlock>
            <ParamTable
              params={[
                { name: "pattern", type: "string", required: true, desc: "검증할 패턴 문자열" },
              ]}
            />
            <div className="text-[13px] text-gray-600 mt-2 space-y-1">
              <p>
                &bull; <code className="text-cyan-600">bash_exec</code> &mdash; 도구 이름 매칭
                (유효)
              </p>
              <p>
                &bull; <code className="text-cyan-600">Bash(npm *)</code> &mdash; 도구 + 인자 글로브
                패턴 (유효)
              </p>
              <p>
                &bull; <code className="text-red-600">Bash(</code> &mdash; 괄호 불균형 (무효)
              </p>
              <p>
                &bull; <code className="text-red-600">&quot;&quot;</code> &mdash; 빈 문자열 (무효)
              </p>
            </div>

            {/* permissionsCommand */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              permissionsCommand: SlashCommand
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              4가지 서브커맨드를 지원하는 <code className="text-cyan-600">/permissions</code> 명령어
              정의입니다.
            </p>
            <CodeBlock>
              <span className="prop">name</span>:{" "}
              <span className="str">&quot;permissions&quot;</span>
              {"\n"}
              <span className="prop">usage</span>:{" "}
              <span className="str">
                &quot;/permissions [allow|deny|remove|reset] [pattern]&quot;
              </span>
            </CodeBlock>

            {/* 서브커맨드 테이블 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              서브커맨드
            </h3>
            <div className="bg-white border border-gray-200 rounded-xl p-5 text-[13px] text-gray-600 space-y-2">
              <p>
                <strong className="text-gray-900">(없음)</strong> &mdash; 현재 권한 모드, 허용 규칙,
                거부 규칙 표시
              </p>
              <p>
                <strong className="text-gray-900">allow &lt;pattern&gt;</strong> &mdash; 영구 허용
                규칙 추가 (중복 시 무시)
              </p>
              <p>
                <strong className="text-gray-900">deny &lt;pattern&gt;</strong> &mdash; 영구 거부
                규칙 추가 (중복 시 무시)
              </p>
              <p>
                <strong className="text-gray-900">remove &lt;pattern&gt;</strong> &mdash; allow/deny
                양쪽에서 규칙 제거
              </p>
              <p>
                <strong className="text-gray-900">reset</strong> &mdash; 모든 영구 규칙 초기화
                (0개면 &quot;No persistent rules&quot;)
              </p>
            </div>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                규칙은 <code className="text-cyan-600">~/.dhelix/settings.json</code>에 저장되므로
                모든 프로젝트에서 전역으로 적용됩니다. 프로젝트별 규칙은 지원하지 않습니다.
              </li>
              <li>
                <code className="text-cyan-600">remove</code>는 allow와 deny 양쪽을 모두 검색합니다.
                동일한 패턴이 양쪽에 있으면 둘 다 제거됩니다.
              </li>
              <li>
                패턴에 글로브 문자(<code className="text-cyan-600">*</code>,{" "}
                <code className="text-cyan-600">?</code>)를 사용할 수 있습니다. 예:{" "}
                <code className="text-cyan-600">file_*</code>는 file_read, file_write 등에
                매칭됩니다.
              </li>
              <li>
                <code className="text-cyan-600">settings.json</code> 파일이 없으면 자동 생성됩니다.
                디렉토리(<code className="text-cyan-600">~/.dhelix</code>)도 함께 생성됩니다.
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

            {/* 기본: 상태 확인 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              기본 사용법 &mdash; 현재 상태 확인
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              인자 없이 <code className="text-cyan-600">/permissions</code>를 입력하면 현재 권한
              모드와 규칙을 표시합니다.
            </p>
            <CodeBlock>
              <span className="str">/permissions</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 출력 예시"}</span>
              {"\n"}
              <span className="prop">Permission Status</span>
              {"\n"}
              <span className="prop">────────────────────────────────────────</span>
              {"\n"}
              {"\n"}
              {"  "}
              <span className="prop">Mode</span>: default
              {"\n"}
              {"  "}Ask before executing tools that modify files or run commands
              {"\n"}
              {"\n"}
              {"  "}
              <span className="prop">Persistent Allow Rules</span>:{"\n"}
              {"    "}
              <span className="str">+ Bash(npm *)</span>
              {"\n"}
              {"    "}
              <span className="str">+ file_read</span>
              {"\n"}
              {"\n"}
              {"  "}
              <span className="prop">Persistent Deny Rules</span>:{"\n"}
              {"    "}
              <span className="str">- Bash(rm -rf *)</span>
            </CodeBlock>

            {/* 규칙 추가/제거 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              규칙 추가와 제거
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">allow</code>와{" "}
              <code className="text-cyan-600">deny</code>로 규칙을 추가하고,{" "}
              <code className="text-cyan-600">remove</code>로 제거합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// npm 관련 명령을 항상 허용"}</span>
              {"\n"}
              <span className="str">/permissions allow Bash(npm *)</span>
              {"\n"}
              <span className="cm">{"// → Added allow rule: Bash(npm *)"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 위험한 명령 차단"}</span>
              {"\n"}
              <span className="str">/permissions deny Bash(rm -rf *)</span>
              {"\n"}
              <span className="cm">{"// → Added deny rule: Bash(rm -rf *)"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 규칙 제거"}</span>
              {"\n"}
              <span className="str">/permissions remove Bash(npm *)</span>
              {"\n"}
              <span className="cm">{"// → Removed rule from allow: Bash(npm *)"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 모든 규칙 초기화"}</span>
              {"\n"}
              <span className="str">/permissions reset</span>
              {"\n"}
              <span className="cm">{"// → Cleared 3 persistent permission rules."}</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>/permissions reset</code>은 모든 영구 규칙을 즉시
              삭제합니다. 되돌릴 수 없으므로, 중요한 규칙이 있다면 먼저 <code>/permissions</code>로
              현재 상태를 확인하세요.
            </Callout>

            {/* 고급: 패턴 형식 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 패턴 형식 가이드
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              두 가지 패턴 형식을 지원합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 형식 1: 도구 이름만 (해당 도구의 모든 호출에 적용)"}</span>
              {"\n"}
              <span className="str">file_read</span>
              {"       "}
              <span className="cm">{"// file_read 도구 전체"}</span>
              {"\n"}
              <span className="str">bash_exec</span>
              {"      "}
              <span className="cm">{"// bash_exec 도구 전체"}</span>
              {"\n"}
              <span className="str">file_*</span>
              {"         "}
              <span className="cm">{"// file_ 로 시작하는 모든 도구 (글로브)"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 형식 2: 도구(인자 패턴) — 특정 인자에만 적용"}</span>
              {"\n"}
              <span className="str">Bash(npm *)</span>
              {"    "}
              <span className="cm">{"// Bash에서 npm으로 시작하는 명령만"}</span>
              {"\n"}
              <span className="str">Bash(git *)</span>
              {"    "}
              <span className="cm">{"// Bash에서 git으로 시작하는 명령만"}</span>
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> 보안을 위해 <code>/permissions deny Bash(rm -rf *)</code>처럼
              위험한 명령 패턴을 미리 차단해두면, LLM이 실수로 파괴적인 명령을 실행하는 것을 방지할
              수 있습니다.
            </Callout>

            <DeepDive title="validatePattern() 검증 로직 상세">
              <p className="mb-3">패턴 검증은 다음 순서로 진행됩니다:</p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>빈 문자열 검사 &rarr; &quot;Pattern cannot be empty&quot;</li>
                <li>
                  괄호가 있는 경우: <code className="text-cyan-600">^([A-Za-z_]...)\((.+)\)$</code>{" "}
                  정규식으로 도구명+인자 추출
                </li>
                <li>
                  괄호가 없는 경우:{" "}
                  <code className="text-cyan-600">^[A-Za-z_*?][A-Za-z0-9_*?]*$</code> 정규식으로
                  도구 이름 형식 검증
                </li>
                <li>불균형 괄호 감지 &rarr; &quot;unbalanced parentheses&quot; 에러</li>
              </ul>
              <p className="mt-3 text-amber-600">
                패턴 검증은 allow/deny 서브커맨드에서만 수행됩니다. remove는 정확한 문자열
                매칭이므로 검증하지 않습니다.
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
              서브커맨드 라우팅 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              인자 문자열을 파싱하여 서브커맨드를 분리하고, switch문으로 해당 핸들러에 라우팅합니다.
            </p>

            <MermaidDiagram
              title="/permissions 서브커맨드 라우팅"
              titleColor="purple"
              chart={`graph TD
  INPUT["args 파싱<br/><small>spaceIdx로 subcommand / subArgs 분리</small>"]
  EMPTY{"subcommand<br/>비어있음?"}
  STATUS["formatPermissionStatus()<br/><small>현재 모드 + 규칙 표시</small>"]
  SWITCH{"switch<br/>subcommand"}
  ALLOW["handleAllow(pattern)<br/><small>검증 → 중복확인 → 저장</small>"]
  DENY["handleDeny(pattern)<br/><small>검증 → 중복확인 → 저장</small>"]
  REMOVE["handleRemove(pattern)<br/><small>allow/deny 양쪽 검색 → 제거</small>"]
  RESET["handleReset()<br/><small>allow/deny 모두 비우기</small>"]
  SETTINGS["settings.json<br/><small>readSettings / writeSettings</small>"]

  INPUT --> EMPTY
  EMPTY -->|"예"| STATUS
  EMPTY -->|"아니오"| SWITCH
  SWITCH -->|"allow"| ALLOW
  SWITCH -->|"deny"| DENY
  SWITCH -->|"remove"| REMOVE
  SWITCH -->|"reset"| RESET
  ALLOW --> SETTINGS
  DENY --> SETTINGS
  REMOVE --> SETTINGS
  RESET --> SETTINGS

  style INPUT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style SETTINGS fill:#fef3c7,stroke:#f59e0b,color:#1e293b,stroke-width:2px
  style STATUS fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              settings.json 읽기/쓰기 패턴과 불변성 유지 방식입니다.
            </p>
            <CodeBlock>
              <span className="cm">
                {"// settings.json에서 permissions 섹션 추출 (기본값 보장)"}
              </span>
              {"\n"}
              <span className="kw">function</span>{" "}
              <span className="fn">getPermissionsFromSettings</span>(
              <span className="prop">settings</span>):{" "}
              <span className="type">PermissionsSettings</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">perms</span> ={" "}
              <span className="prop">settings</span>.<span className="prop">permissions</span>;
              {"\n"}
              {"  "}
              <span className="kw">return</span> {"{"}
              {"\n"}
              {"    "}
              <span className="prop">allow</span>: Array.<span className="fn">isArray</span>(
              <span className="prop">perms</span>?.<span className="prop">allow</span>) ?{" "}
              <span className="prop">perms</span>.<span className="prop">allow</span> : [],
              {"\n"}
              {"    "}
              <span className="prop">deny</span>: Array.<span className="fn">isArray</span>(
              <span className="prop">perms</span>?.<span className="prop">deny</span>) ?{" "}
              <span className="prop">perms</span>.<span className="prop">deny</span> : [],
              {"\n"}
              {"  "}
              {"}"};{"\n"}
              {"}"}
              {"\n"}
              {"\n"}
              <span className="cm">{"// 규칙 추가 — 스프레드 연산자로 불변성 유지"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">updatedAllow</span> = [...
              <span className="prop">perms</span>.<span className="prop">allow</span>,{" "}
              <span className="prop">pattern</span>];
              {"\n"}
              <span className="prop">settings</span>.<span className="prop">permissions</span> ={" "}
              {"{"}
              {"\n"}
              {"  "}...<span className="prop">settings</span>.
              <span className="prop">permissions</span>,{"\n"}
              {"  "}
              <span className="prop">allow</span>: <span className="prop">updatedAllow</span>,{"\n"}
              {"  "}
              <span className="prop">deny</span>: [...<span className="prop">perms</span>.
              <span className="prop">deny</span>],
              {"\n"}
              {"}"};
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">ENOENT 처리:</strong>{" "}
                <code className="text-cyan-600">readSettings()</code>는 파일이 없으면(ENOENT) 빈
                객체를 반환합니다. 최초 실행 시에도 에러 없이 동작합니다.
              </p>
              <p>
                <strong className="text-gray-900">스프레드 불변성:</strong> 기존 배열을 직접
                수정하지 않고, 스프레드 연산자로 새 배열을 생성합니다. 원본 데이터가 보존됩니다.
              </p>
              <p>
                <strong className="text-gray-900">디렉토리 자동 생성:</strong>{" "}
                <code className="text-cyan-600">writeSettings()</code>는{" "}
                <code className="text-cyan-600">mkdir(CONFIG_DIR, {"{ recursive: true }"})</code>를
                먼저 호출하여 디렉토리가 없어도 안전합니다.
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
                &quot;규칙을 추가했는데 적용이 안 돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                <code className="text-cyan-600">/permissions</code>로 현재 규칙을 확인하세요. 규칙이
                저장되어 있다면, 패턴 형식이 실제 도구 이름과 일치하는지 확인하세요. 대소문자가
                정확히 맞아야 합니다.
              </p>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                예를 들어 <code className="text-cyan-600">bash_exec</code>과
                <code className="text-cyan-600">Bash_exec</code>는 다른 패턴입니다.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Invalid pattern 에러가 나와요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                패턴 형식이 올바르지 않을 때 발생합니다. 다음을 확인하세요:
              </p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  괄호가 올바르게 열리고 닫혀야 합니다:{" "}
                  <code className="text-cyan-600">Bash(npm *)</code>
                </li>
                <li>도구 이름은 영문자, 숫자, 밑줄, 글로브 문자만 허용됩니다</li>
                <li>빈 패턴은 허용되지 않습니다</li>
              </ul>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;settings.json을 직접 편집해도 되나요?&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                네, <code className="text-cyan-600">~/.dhelix/settings.json</code>을 직접 편집해도
                됩니다. 다만 JSON 형식이 올바라야 하며, permissions 섹션의 allow/deny 배열에
                문자열만 넣어야 합니다. 편집 후 dhelix를 재시작하면 변경사항이 적용됩니다.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;allow와 deny에 같은 패턴이 있으면 어떻게 되나요?&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">/permissions</code> 명령어 자체는 중복을 허용합니다.
                실제 권한 판정은 <code className="text-cyan-600">permission-manager.ts</code>에서
                수행되며, deny가 allow보다 우선합니다.
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
                  name: "permission-manager.ts",
                  slug: "permission-manager",
                  relation: "parent",
                  desc: "영구 규칙을 실제로 적용하여 도구 호출 허용/거부를 판정하는 엔진",
                },
                {
                  name: "permission-modes.ts",
                  slug: "permission-modes",
                  relation: "sibling",
                  desc: "default, plan, yolo 등 5가지 권한 모드 정의와 설명",
                },
                {
                  name: "permission-patterns.ts",
                  slug: "permission-patterns",
                  relation: "sibling",
                  desc: "도구 이름 + 인자 패턴 매칭 로직 구현",
                },
                {
                  name: "config-loader.ts",
                  slug: "config-loader",
                  relation: "sibling",
                  desc: "settings.json을 포함한 5-layer 설정 병합 시스템",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
