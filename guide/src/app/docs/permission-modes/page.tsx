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

export default function PermissionModesPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/permissions/modes.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              Permission Modes
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            5가지 권한 모드에 따라 도구 실행 허용 여부를 결정하는 모듈입니다.
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
              <code className="text-cyan-600">modes.ts</code>는 권한 시스템의 두 번째 방어선입니다.
              개별 규칙 매칭(<code className="text-cyan-600">rules.ts</code>)에서 매칭되는 규칙이 없을 때,
              현재 전역 권한 모드와 도구의 위험 수준을 기반으로 실행 허용 여부를 결정합니다.
            </p>
            <p>
              다섯 가지 모드가 있으며, 각 모드는 도구의 권한 수준(<code className="text-emerald-600">safe</code>,
              <code className="text-amber-600">confirm</code>, <code className="text-red-600">dangerous</code>)에
              따라 다르게 동작합니다. 가장 관대한 <code className="text-cyan-600">bypassPermissions</code>부터
              가장 엄격한 <code className="text-cyan-600">plan</code> 모드까지 스펙트럼을 형성합니다.
            </p>
            <p>
              이 모듈은 순수 함수 두 개로 구성됩니다: 권한 검사(<code className="text-cyan-600">checkPermissionByMode</code>)와
              모드 설명 조회(<code className="text-cyan-600">getModeDescription</code>).
              상태를 가지지 않으며, 부작용이 없는 결정론적 함수입니다.
            </p>
          </div>

          <MermaidDiagram
            title="Permission Modes 결정 매트릭스"
            titleColor="purple"
            chart={`graph LR
  MODE["현재 권한 모드"]
  LEVEL["도구 권한 수준"]
  CHECK["checkPermissionByMode"]
  RESULT["허용/거부/사용자확인"]

  MODE --> CHECK
  LEVEL --> CHECK
  CHECK --> RESULT

  subgraph "5가지 모드"
    M1["bypassPermissions<br/><small>모든 것 허용</small>"]
    M2["dontAsk<br/><small>자동 승인</small>"]
    M3["acceptEdits<br/><small>편집 허용</small>"]
    M4["default<br/><small>기본 모드</small>"]
    M5["plan<br/><small>읽기 전용</small>"]
  end

  subgraph "3가지 수준"
    L1["safe<br/><small>읽기 전용</small>"]
    L2["confirm<br/><small>수정 도구</small>"]
    L3["dangerous<br/><small>위험한 도구</small>"]
  end

  style CHECK fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style MODE fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style LEVEL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 건물의 보안 등급 시스템을 떠올리세요. &quot;공개(plan)&quot; 모드에서는
            로비만 출입 가능하고, &quot;직원(default)&quot; 모드에서는 신분증 확인 후 입장,
            &quot;VIP(bypassPermissions)&quot; 모드에서는 모든 구역에 자유롭게 출입할 수 있습니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* PermissionMode type */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            type PermissionMode
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            5가지 권한 모드를 나타내는 유니온 타입입니다.
          </p>
          <CodeBlock>
            <span className="kw">type</span> <span className="type">PermissionMode</span> = <span className="str">&quot;bypassPermissions&quot;</span> | <span className="str">&quot;dontAsk&quot;</span> | <span className="str">&quot;plan&quot;</span> | <span className="str">&quot;acceptEdits&quot;</span> | <span className="str">&quot;default&quot;</span>;
          </CodeBlock>
          <div className="text-[13px] text-gray-600 mt-2 space-y-1">
            <p>&bull; <code className="text-red-600">&quot;bypassPermissions&quot;</code> &mdash; 모든 권한 검사를 건너뜀 (개발/디버깅 전용)</p>
            <p>&bull; <code className="text-amber-600">&quot;dontAsk&quot;</code> &mdash; 모든 작업을 확인 없이 자동 허용</p>
            <p>&bull; <code className="text-blue-600">&quot;acceptEdits&quot;</code> &mdash; 파일 수정까지 자동 허용, 위험한 명령만 확인</p>
            <p>&bull; <code className="text-emerald-600">&quot;default&quot;</code> &mdash; 읽기만 자동 허용, 나머지는 사용자 확인</p>
            <p>&bull; <code className="text-purple-600">&quot;plan&quot;</code> &mdash; 읽기 전용, 수정/실행 완전 차단</p>
          </div>

          {/* PermissionLevel type */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            type PermissionLevel (from tools/types.ts)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            도구의 위험 수준을 나타내는 타입입니다. 각 도구가 시스템에 미치는 영향도를 분류합니다.
          </p>
          <CodeBlock>
            <span className="kw">type</span> <span className="type">PermissionLevel</span> = <span className="str">&quot;safe&quot;</span> | <span className="str">&quot;confirm&quot;</span> | <span className="str">&quot;dangerous&quot;</span>;
          </CodeBlock>
          <div className="text-[13px] text-gray-600 mt-2 space-y-1">
            <p>&bull; <code className="text-emerald-600">&quot;safe&quot;</code> &mdash; 읽기 전용 (파일 읽기, 검색 등)</p>
            <p>&bull; <code className="text-amber-600">&quot;confirm&quot;</code> &mdash; 수정 도구 (파일 편집 등)</p>
            <p>&bull; <code className="text-red-600">&quot;dangerous&quot;</code> &mdash; 위험한 도구 (쉘 명령어 실행 등)</p>
          </div>

          {/* PermissionCheckResult interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface PermissionCheckResult
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            권한 검사 결과를 나타내는 인터페이스입니다.
          </p>
          <ParamTable
            params={[
              { name: "allowed", type: "boolean", required: true, desc: "실행 허용 여부 (true면 즉시 실행 가능)" },
              { name: "requiresPrompt", type: "boolean", required: true, desc: "사용자 확인이 필요한지 여부" },
              { name: "reason", type: "string | undefined", required: false, desc: "결정 이유 (디버깅용)" },
            ]}
          />

          {/* checkPermissionByMode */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            function checkPermissionByMode
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            현재 권한 모드와 도구의 권한 수준을 기반으로 실행 허용 여부를 결정합니다.
          </p>
          <CodeBlock>
            <span className="fn">checkPermissionByMode</span>(
            {"\n"}{"  "}<span className="prop">mode</span>: <span className="type">PermissionMode</span>,
            {"\n"}{"  "}<span className="prop">permissionLevel</span>: <span className="type">PermissionLevel</span>,
            {"\n"}): <span className="type">PermissionCheckResult</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "mode", type: "PermissionMode", required: true, desc: "현재 권한 모드 (5가지 중 하나)" },
              { name: "permissionLevel", type: "PermissionLevel", required: true, desc: "도구의 권한 수준 (safe/confirm/dangerous)" },
            ]}
          />

          {/* 결정 매트릭스 테이블 */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">모드별 결정 매트릭스</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] text-gray-600 border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-3 py-2 text-left font-bold text-gray-900">모드</th>
                  <th className="border border-gray-200 px-3 py-2 text-center font-bold text-emerald-600">safe (읽기)</th>
                  <th className="border border-gray-200 px-3 py-2 text-center font-bold text-amber-600">confirm (수정)</th>
                  <th className="border border-gray-200 px-3 py-2 text-center font-bold text-red-600">dangerous (위험)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-200 px-3 py-2 font-mono text-red-600">bypassPermissions</td>
                  <td className="border border-gray-200 px-3 py-2 text-center">자동 허용</td>
                  <td className="border border-gray-200 px-3 py-2 text-center">자동 허용</td>
                  <td className="border border-gray-200 px-3 py-2 text-center">자동 허용</td>
                </tr>
                <tr className="bg-gray-50/50">
                  <td className="border border-gray-200 px-3 py-2 font-mono text-amber-600">dontAsk</td>
                  <td className="border border-gray-200 px-3 py-2 text-center">자동 허용</td>
                  <td className="border border-gray-200 px-3 py-2 text-center">자동 허용</td>
                  <td className="border border-gray-200 px-3 py-2 text-center">자동 허용</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-3 py-2 font-mono text-purple-600">plan</td>
                  <td className="border border-gray-200 px-3 py-2 text-center">자동 허용</td>
                  <td className="border border-gray-200 px-3 py-2 text-center text-red-500 font-bold">차단</td>
                  <td className="border border-gray-200 px-3 py-2 text-center text-red-500 font-bold">차단</td>
                </tr>
                <tr className="bg-gray-50/50">
                  <td className="border border-gray-200 px-3 py-2 font-mono text-blue-600">acceptEdits</td>
                  <td className="border border-gray-200 px-3 py-2 text-center">자동 허용</td>
                  <td className="border border-gray-200 px-3 py-2 text-center">자동 허용</td>
                  <td className="border border-gray-200 px-3 py-2 text-center text-amber-500 font-bold">사용자 확인</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-3 py-2 font-mono text-emerald-600">default</td>
                  <td className="border border-gray-200 px-3 py-2 text-center">자동 허용</td>
                  <td className="border border-gray-200 px-3 py-2 text-center text-amber-500 font-bold">사용자 확인</td>
                  <td className="border border-gray-200 px-3 py-2 text-center text-amber-500 font-bold">사용자 확인</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* getModeDescription */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            function getModeDescription
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            권한 모드의 사람이 읽을 수 있는 설명을 반환합니다. UI에서 현재 모드를 표시할 때 사용합니다.
          </p>
          <CodeBlock>
            <span className="fn">getModeDescription</span>(<span className="prop">mode</span>: <span className="type">PermissionMode</span>): <span className="type">string</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "mode", type: "PermissionMode", required: true, desc: "설명을 가져올 권한 모드" },
            ]}
          />

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">&quot;bypassPermissions&quot;</code>와
              <code className="text-cyan-600">&quot;dontAsk&quot;</code>는 동작이 동일하지만,
              의미가 다릅니다. bypass는 개발/디버깅용이고, dontAsk는 사용자가 의도적으로 모든 작업을 허용하는 것입니다.
            </li>
            <li>
              <code className="text-cyan-600">&quot;plan&quot;</code> 모드에서 차단된 도구는
              <code className="text-cyan-600">requiresPrompt: false</code>입니다.
              사용자에게 확인을 묻지 않고 <strong>완전히 차단</strong>합니다.
            </li>
            <li>
              <code className="text-cyan-600">&quot;safe&quot;</code> 권한 수준의 도구는
              모든 모드에서 항상 자동 허용됩니다. 읽기 전용 도구는 위험이 없기 때문입니다.
            </li>
            <li>
              이 함수는 규칙 매칭(<code className="text-cyan-600">rules.ts</code>) 이후에 호출됩니다.
              규칙에서 명시적으로 허용/거부된 경우 이 함수는 호출되지 않습니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 도구 실행 허용 여부 결정</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            도구 실행 전에 현재 권한 모드와 도구의 위험 수준을 기반으로 허용 여부를 확인합니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{"} <span className="fn">checkPermissionByMode</span> {"}"} <span className="kw">from</span> <span className="str">&quot;./permissions/modes.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// 기본 모드에서 파일 읽기 → 자동 허용"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">r1</span> = <span className="fn">checkPermissionByMode</span>(<span className="str">&quot;default&quot;</span>, <span className="str">&quot;safe&quot;</span>);
            {"\n"}<span className="cm">{"// r1 = { allowed: true, requiresPrompt: false }"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 기본 모드에서 파일 편집 → 사용자 확인 필요"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">r2</span> = <span className="fn">checkPermissionByMode</span>(<span className="str">&quot;default&quot;</span>, <span className="str">&quot;confirm&quot;</span>);
            {"\n"}<span className="cm">{"// r2 = { allowed: false, requiresPrompt: true }"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// plan 모드에서 쉘 명령 → 완전 차단"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">r3</span> = <span className="fn">checkPermissionByMode</span>(<span className="str">&quot;plan&quot;</span>, <span className="str">&quot;dangerous&quot;</span>);
            {"\n"}<span className="cm">{"// r3 = { allowed: false, requiresPrompt: false, reason: \"Plan mode: only read-only tools allowed\" }"}</span>
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>requiresPrompt: false</code>이면서 <code>allowed: false</code>인 경우,
            사용자에게 확인도 묻지 않고 <strong>완전히 차단</strong>됩니다.
            이것은 <code>plan</code> 모드에서만 발생합니다.
          </Callout>

          {/* 고급 사용법: 모드 전환 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 상황별 모드 선택
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            작업 특성에 따라 적절한 모드를 선택하는 가이드입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 코드 분석만 할 때 → plan 모드 (가장 안전)"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">analyzeMode</span> = <span className="str">&quot;plan&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// 파일 편집까지 허용, 쉘 명령은 확인 → acceptEdits (권장)"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">editMode</span> = <span className="str">&quot;acceptEdits&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// 모든 작업에 사용자 확인 → default (기본값)"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">safeMode</span> = <span className="str">&quot;default&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// 자동화 파이프라인 → dontAsk (CI/CD에서 사용)"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">autoMode</span> = <span className="str">&quot;dontAsk&quot;</span>;
          </CodeBlock>

          {/* 고급 사용법: UI 모드 표시 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; UI에서 모드 설명 표시
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">getModeDescription</code>으로 현재 모드를 사용자에게 표시합니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{"} <span className="fn">getModeDescription</span> {"}"} <span className="kw">from</span> <span className="str">&quot;./permissions/modes.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// 각 모드의 설명"}</span>
            {"\n"}<span className="fn">getModeDescription</span>(<span className="str">&quot;default&quot;</span>);
            {"\n"}<span className="cm">{"// → \"Ask for confirmation on file edits and command execution\""}</span>
            {"\n"}
            {"\n"}<span className="fn">getModeDescription</span>(<span className="str">&quot;plan&quot;</span>);
            {"\n"}<span className="cm">{"// → \"Read-only mode — no file modifications or commands\""}</span>
            {"\n"}
            {"\n"}<span className="fn">getModeDescription</span>(<span className="str">&quot;acceptEdits&quot;</span>);
            {"\n"}<span className="cm">{"// → \"Auto-approve file edits, ask for commands\""}</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> <code>Shift+Tab</code> 단축키로 권한 모드를 순환할 수 있습니다.
            현재 모드는 UI 하단에 표시됩니다.
          </Callout>

          <DeepDive title="bypassPermissions vs dontAsk 차이점">
            <p className="mb-3">
              두 모드 모두 결과적으로 &quot;모든 것 허용&quot;이지만, 설계 의도가 다릅니다:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li><code className="text-red-600">bypassPermissions</code> &mdash; 개발자가 디버깅 목적으로 사용. 감사 로그에 &quot;bypass&quot;로 기록됨</li>
              <li><code className="text-amber-600">dontAsk</code> &mdash; 사용자가 의도적으로 모든 확인을 건너뜀. 감사 로그에 &quot;auto-approved&quot;로 기록됨</li>
            </ul>
            <p className="mt-3 text-amber-600">
              프로덕션 환경에서는 두 모드 모두 사용을 권장하지 않습니다.
              <code className="text-emerald-600">default</code> 또는
              <code className="text-blue-600">acceptEdits</code> 모드를 사용하세요.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>모드별 결정 흐름</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">checkPermissionByMode</code>는 switch 문으로 각 모드별
            결정 로직을 실행합니다.
          </p>

          <MermaidDiagram
            title="checkPermissionByMode 결정 흐름"
            titleColor="purple"
            chart={`graph TD
  START(("입력")) --> MODE{"현재 모드?"}
  MODE -->|"bypass / dontAsk"| AUTO["자동 허용<br/><small>allowed: true</small>"]
  MODE -->|"plan"| PLAN_CHECK{"safe 수준?"}
  PLAN_CHECK -->|"Yes"| PLAN_ALLOW["자동 허용"]
  PLAN_CHECK -->|"No"| PLAN_DENY["완전 차단<br/><small>allowed: false<br/>requiresPrompt: false</small>"]
  MODE -->|"acceptEdits"| EDIT_CHECK{"safe 또는<br/>confirm 수준?"}
  EDIT_CHECK -->|"Yes"| EDIT_ALLOW["자동 허용"]
  EDIT_CHECK -->|"No"| EDIT_PROMPT["사용자 확인<br/><small>requiresPrompt: true</small>"]
  MODE -->|"default"| DEF_CHECK{"safe 수준?"}
  DEF_CHECK -->|"Yes"| DEF_ALLOW["자동 허용"]
  DEF_CHECK -->|"No"| DEF_PROMPT["사용자 확인<br/><small>requiresPrompt: true</small>"]

  style MODE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style AUTO fill:#dcfce7,stroke:#10b981,color:#065f46
  style PLAN_DENY fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style EDIT_PROMPT fill:#fef3c7,stroke:#f59e0b,color:#78350f
  style DEF_PROMPT fill:#fef3c7,stroke:#f59e0b,color:#78350f`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">checkPermissionByMode</code>의 switch 문 구조입니다.
            각 case가 모드별 결정 로직을 담당합니다.
          </p>
          <CodeBlock>
            <span className="kw">switch</span> (<span className="prop">mode</span>) {"{"}
            {"\n"}{"  "}<span className="cm">{"// [1] 우회/자동 모드: 모든 도구 즉시 허용"}</span>
            {"\n"}{"  "}<span className="kw">case</span> <span className="str">&quot;bypassPermissions&quot;</span>:
            {"\n"}{"  "}<span className="kw">case</span> <span className="str">&quot;dontAsk&quot;</span>:
            {"\n"}{"    "}<span className="kw">return</span> {"{"} <span className="prop">allowed</span>: <span className="kw">true</span>, <span className="prop">requiresPrompt</span>: <span className="kw">false</span> {"}"};
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [2] 계획 모드: safe만 허용, 나머지 차단"}</span>
            {"\n"}{"  "}<span className="kw">case</span> <span className="str">&quot;plan&quot;</span>:
            {"\n"}{"    "}<span className="kw">if</span> (<span className="prop">permissionLevel</span> === <span className="str">&quot;safe&quot;</span>)
            {"\n"}{"      "}<span className="kw">return</span> {"{"} <span className="prop">allowed</span>: <span className="kw">true</span>, <span className="prop">requiresPrompt</span>: <span className="kw">false</span> {"}"};
            {"\n"}{"    "}<span className="kw">return</span> {"{"} <span className="prop">allowed</span>: <span className="kw">false</span>, <span className="prop">requiresPrompt</span>: <span className="kw">false</span> {"}"};
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [3] 편집 허용 모드: safe+confirm 허용, dangerous만 확인"}</span>
            {"\n"}{"  "}<span className="kw">case</span> <span className="str">&quot;acceptEdits&quot;</span>:
            {"\n"}{"    "}<span className="kw">if</span> (<span className="prop">permissionLevel</span> === <span className="str">&quot;safe&quot;</span> || <span className="prop">permissionLevel</span> === <span className="str">&quot;confirm&quot;</span>)
            {"\n"}{"      "}<span className="kw">return</span> {"{"} <span className="prop">allowed</span>: <span className="kw">true</span>, <span className="prop">requiresPrompt</span>: <span className="kw">false</span> {"}"};
            {"\n"}{"    "}<span className="kw">return</span> {"{"} <span className="prop">allowed</span>: <span className="kw">false</span>, <span className="prop">requiresPrompt</span>: <span className="kw">true</span> {"}"};
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [4] 기본 모드: safe만 허용, confirm+dangerous 확인"}</span>
            {"\n"}{"  "}<span className="kw">default</span>:
            {"\n"}{"    "}<span className="kw">if</span> (<span className="prop">permissionLevel</span> === <span className="str">&quot;safe&quot;</span>)
            {"\n"}{"      "}<span className="kw">return</span> {"{"} <span className="prop">allowed</span>: <span className="kw">true</span>, <span className="prop">requiresPrompt</span>: <span className="kw">false</span> {"}"};
            {"\n"}{"    "}<span className="kw">return</span> {"{"} <span className="prop">allowed</span>: <span className="kw">false</span>, <span className="prop">requiresPrompt</span>: <span className="kw">true</span> {"}"};
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> <code className="text-cyan-600">bypassPermissions</code>와 <code className="text-cyan-600">dontAsk</code>는 동일한 동작을 합니다. 모든 도구를 무조건 허용합니다.</p>
            <p><strong className="text-gray-900">[2]</strong> <code className="text-cyan-600">plan</code> 모드는 차단할 때 <code className="text-cyan-600">requiresPrompt: false</code>를 반환합니다. 사용자에게 확인 기회도 주지 않습니다.</p>
            <p><strong className="text-gray-900">[3]</strong> <code className="text-cyan-600">acceptEdits</code>는 편집 도구까지 자동 허용하되, 쉘 명령어 같은 위험한 도구만 사용자 확인을 요구합니다.</p>
            <p><strong className="text-gray-900">[4]</strong> <code className="text-cyan-600">default</code> 모드는 가장 보수적인 일반 모드입니다. 읽기만 자동이고 나머지는 모두 확인합니다.</p>
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
              &quot;plan 모드인데 파일 편집이 아예 안 돼요. 확인도 안 물어봐요.&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              정상 동작입니다. <code className="text-cyan-600">plan</code> 모드는 읽기 전용 모드로,
              수정(<code className="text-amber-600">confirm</code>)과 위험(<code className="text-red-600">dangerous</code>)
              도구를 <strong>완전 차단</strong>합니다. 사용자 확인 없이 즉시 거부됩니다.
              편집이 필요하면 <code className="text-cyan-600">Shift+Tab</code>으로 모드를 전환하세요.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;acceptEdits 모드인데 쉘 명령이 매번 확인을 물어봐요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              <code className="text-cyan-600">acceptEdits</code>는 파일 편집까지만 자동 허용합니다.
              쉘 명령(<code className="text-red-600">dangerous</code>)은 여전히 사용자 확인이 필요합니다.
              쉘 명령도 자동 허용하려면 두 가지 방법이 있습니다:
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>특정 명령만 허용: <code className="text-cyan-600">rules.ts</code>에 규칙 추가 (예: <code>&quot;Bash(npm *)&quot;</code>)</li>
              <li>모든 명령 허용: <code className="text-cyan-600">dontAsk</code> 모드 사용 (주의 필요)</li>
            </ul>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;현재 권한 모드가 뭔지 어떻게 확인하나요?&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              UI 하단 상태바에 현재 모드가 표시됩니다. <code className="text-cyan-600">Shift+Tab</code>으로
              모드를 순환하면 변경된 모드가 즉시 반영됩니다. 프로그래밍 방식으로는
              <code className="text-cyan-600">getModeDescription(mode)</code>를 호출하여 모드 설명을 확인할 수 있습니다.
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
                name: "permission-manager.ts",
                slug: "permission-manager",
                relation: "parent",
                desc: "규칙 매칭 + 모드 검사를 통합하여 최종 권한을 결정하는 메인 매니저",
              },
              {
                name: "rules.ts",
                slug: "permission-rules",
                relation: "sibling",
                desc: "allow/deny 규칙 매칭 엔진 — 모드 검사 이전의 첫 번째 방어선",
              },
              {
                name: "pattern-parser.ts",
                slug: "permission-patterns",
                relation: "sibling",
                desc: "권한 패턴 문자열을 구조화된 객체로 파싱하는 모듈",
              },
              {
                name: "wildcard.ts",
                slug: "permission-wildcard",
                relation: "sibling",
                desc: "경로 안전한 와일드카드 매칭 — * vs ** 구분",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
