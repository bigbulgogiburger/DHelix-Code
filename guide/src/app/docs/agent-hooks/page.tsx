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

export default function AgentHooksPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/subagents/agent-hooks.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              Agent Hooks
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            에이전트 정의의 훅(Hook)을 기존 훅 시스템 형식으로 변환하는 서브에이전트 전용 훅 모듈입니다.
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
              <code className="text-cyan-600">agent-hooks</code>는 에이전트 정의 파일(.md)의 프론트매터에
              설정된 훅(Hook)을 기존 훅 러너(hook runner) 시스템이 이해하는 형식으로 변환합니다.
              훅이란 특정 이벤트가 발생했을 때 자동으로 실행되는 셸 명령(콜백)입니다.
            </p>
            <p>
              세 가지 훅 이벤트를 지원합니다: <code className="text-cyan-600">PreToolUse</code>(도구 사용 전),
              <code className="text-cyan-600">PostToolUse</code>(도구 사용 후),
              <code className="text-cyan-600">Stop</code>(서브에이전트 종료 시). 특히 Stop 이벤트는
              내부적으로 <code className="text-cyan-600">SubagentStop</code>이라는 이름으로 매핑됩니다.
            </p>
            <p>
              또한 부모 세션의 훅 설정과 에이전트 고유 훅 설정을 병합하는 기능을 제공합니다.
              에이전트 규칙이 부모 규칙 뒤에 연결되어, 에이전트 훅이 더 높은 우선순위를 가집니다.
            </p>
          </div>

          <MermaidDiagram
            title="Agent Hooks 변환 흐름"
            titleColor="purple"
            chart={`graph TD
  DEF["Agent Definition<br/><small>.md 프론트매터</small>"]
  AHC["AgentHookConfig<br/><small>PreToolUse / PostToolUse / Stop</small>"]
  CONVERT["convertAgentHooks()<br/><small>agent-hooks.ts</small>"]
  HC["HookConfig<br/><small>훅 러너 형식</small>"]
  MERGE["mergeHookConfigs()<br/><small>부모 + 에이전트 병합</small>"]
  PARENT["부모 세션 HookConfig"]
  FINAL["최종 HookConfig"]
  RUNNER["Hook Runner<br/><small>hooks/runner.ts</small>"]

  DEF --> AHC
  AHC --> CONVERT
  CONVERT --> HC
  PARENT --> MERGE
  HC --> MERGE
  MERGE --> FINAL
  FINAL --> RUNNER

  style CONVERT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style MERGE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style DEF fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style AHC fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style HC fill:#dcfce7,stroke:#10b981,color:#1e293b
  style PARENT fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style FINAL fill:#dcfce7,stroke:#10b981,color:#1e293b
  style RUNNER fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 전기 어댑터를 떠올리세요. 에이전트 정의의 훅 형식(한국 플러그)을
            훅 러너 시스템의 형식(미국 콘센트)으로 변환하는 어댑터 역할을 합니다.
            Stop &rarr; SubagentStop 이름 변환도 전압 변환과 같은 맥락입니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* AgentHookEntry interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface AgentHookEntry
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            에이전트 훅 항목으로, 실행할 셸 명령 하나를 나타냅니다.
          </p>
          <ParamTable
            params={[
              { name: "type", type: '"command"', required: true, desc: '항상 "command" (셸 명령 실행)' },
              { name: "command", type: "string", required: true, desc: '실행할 셸 명령어 (예: "npm run lint")' },
            ]}
          />

          {/* AgentHookRule interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface AgentHookRule
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            어떤 도구에 대해 어떤 훅을 실행할지 정의하는 규칙입니다.
          </p>
          <ParamTable
            params={[
              { name: "matcher", type: "string | undefined", required: false, desc: '도구 이름 매칭 패턴 (예: "file_*"). 생략하면 모든 도구에 적용' },
              { name: "hooks", type: "readonly AgentHookEntry[]", required: true, desc: "이 규칙에 해당할 때 실행할 훅 목록" },
            ]}
          />

          {/* AgentHookConfig interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface AgentHookConfig
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            에이전트 프론트매터에서 읽어온 훅 설정 구조입니다.
          </p>
          <ParamTable
            params={[
              { name: "PreToolUse", type: "readonly AgentHookRule[]", required: false, desc: "도구 사용 전에 실행할 훅 규칙 목록" },
              { name: "PostToolUse", type: "readonly AgentHookRule[]", required: false, desc: "도구 사용 후에 실행할 훅 규칙 목록" },
              { name: "Stop", type: "readonly AgentHookRule[]", required: false, desc: "서브에이전트 종료 시 실행할 훅 규칙 목록" },
            ]}
          />

          {/* convertAgentHooks */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            convertAgentHooks(agentHooks)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            에이전트 프론트매터의 훅 설정을 훅 러너 시스템이 기대하는 <code className="text-cyan-600">HookConfig</code> 형식으로
            변환합니다. Stop 이벤트는 &quot;SubagentStop&quot;으로 이름이 변경됩니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">convertAgentHooks</span>(<span className="prop">agentHooks</span>: <span className="type">AgentHookConfig</span>): <span className="type">HookConfig</span>
          </CodeBlock>

          {/* mergeHookConfigs */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            mergeHookConfigs(parentHooks, agentHooks)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            부모 세션의 훅 설정과 에이전트 고유 훅 설정을 병합합니다.
            같은 이벤트에 양쪽 모두 규칙이 있으면 부모 규칙 뒤에 에이전트 규칙을 연결합니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">mergeHookConfigs</span>(
            {"\n"}{"  "}<span className="prop">parentHooks</span>: <span className="type">HookConfig</span> | <span className="type">undefined</span>,
            {"\n"}{"  "}<span className="prop">agentHooks</span>: <span className="type">HookConfig</span>,
            {"\n"}): <span className="type">HookConfig</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "parentHooks", type: "HookConfig | undefined", required: false, desc: "부모 세션의 훅 설정 (없을 수 있음)" },
              { name: "agentHooks", type: "HookConfig", required: true, desc: "에이전트 고유의 훅 설정" },
            ]}
          />

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              에이전트 정의에서 <code className="text-cyan-600">&quot;Stop&quot;</code>이라고 쓴 훅은
              내부적으로 <code className="text-cyan-600">&quot;SubagentStop&quot;</code> 이벤트로 매핑됩니다.
              훅 러너에서 디버깅할 때 이 이름 차이를 주의하세요.
            </li>
            <li>
              병합 시 에이전트 규칙이 부모 규칙 <strong>뒤에</strong> 연결되므로, 훅 러너가 순서대로
              평가할 경우 에이전트 규칙이 나중에 실행됩니다.
            </li>
            <li>
              현재 <code className="text-cyan-600">AgentHookEntry</code>의 type은 <code className="text-cyan-600">&quot;command&quot;</code>만
              지원합니다. 다른 핸들러 타입(예: JavaScript 함수)은 지원하지 않습니다.
            </li>
            <li>
              <code className="text-cyan-600">matcher</code>를 생략하면 해당 이벤트의 모든 도구에 훅이 적용됩니다.
              의도치 않은 광범위 적용을 방지하려면 matcher를 명시하세요.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 에이전트 훅 변환</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            에이전트 정의에서 파싱된 훅 설정을 훅 러너 형식으로 변환하는 기본 패턴입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 에이전트 프론트매터에서 읽은 훅 설정"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">agentHooks</span>: <span className="type">AgentHookConfig</span> = {"{"}
            {"\n"}{"  "}<span className="prop">PostToolUse</span>: [{"{"}
            {"\n"}{"    "}<span className="prop">matcher</span>: <span className="str">&quot;file_*&quot;</span>,
            {"\n"}{"    "}<span className="prop">hooks</span>: [{"{"} <span className="prop">type</span>: <span className="str">&quot;command&quot;</span>, <span className="prop">command</span>: <span className="str">&quot;npm run lint&quot;</span> {"}"}],
            {"\n"}{"  "}{"}"}],
            {"\n"}{"  "}<span className="prop">Stop</span>: [{"{"}
            {"\n"}{"    "}<span className="prop">hooks</span>: [{"{"} <span className="prop">type</span>: <span className="str">&quot;command&quot;</span>, <span className="prop">command</span>: <span className="str">&quot;npm test&quot;</span> {"}"}],
            {"\n"}{"  "}{"}"}],
            {"\n"}{"}"};
            {"\n"}
            {"\n"}<span className="cm">{"// 훅 러너 형식으로 변환"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">hookConfig</span> = <span className="fn">convertAgentHooks</span>(<span className="prop">agentHooks</span>);
            {"\n"}<span className="cm">{"// hookConfig.PostToolUse → [{matcher: 'file_*', hooks: [...]}]"}</span>
            {"\n"}<span className="cm">{"// hookConfig.SubagentStop → [{hooks: [...]}]  ← Stop이 SubagentStop으로 변환!"}</span>
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>Stop</code> 이벤트가 <code>SubagentStop</code>으로 변환되는 것을
            잊지 마세요. 변환 후 <code>hookConfig.Stop</code>은 존재하지 않고
            <code>hookConfig.SubagentStop</code>에 규칙이 들어갑니다.
          </Callout>

          {/* 고급 사용법: 병합 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 부모 세션과 에이전트 훅 병합
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            서브에이전트가 부모 세션의 훅을 상속하면서 자체 훅을 추가하는 패턴입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 부모 세션의 훅"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">parentHooks</span> = {"{"}
            {"\n"}{"  "}<span className="prop">PostToolUse</span>: [{"{"} <span className="prop">hooks</span>: [{"{"} <span className="prop">type</span>: <span className="str">&quot;command&quot;</span>, <span className="prop">command</span>: <span className="str">&quot;prettier --write&quot;</span> {"}"}] {"}"}],
            {"\n"}{"}"};
            {"\n"}
            {"\n"}<span className="cm">{"// 에이전트 고유 훅"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">agentConfig</span> = <span className="fn">convertAgentHooks</span>(<span className="prop">agentHooks</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// 병합 — 부모 규칙 먼저, 에이전트 규칙 나중"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">merged</span> = <span className="fn">mergeHookConfigs</span>(<span className="prop">parentHooks</span>, <span className="prop">agentConfig</span>);
            {"\n"}<span className="cm">{"// merged.PostToolUse → [부모 규칙, 에이전트 규칙]"}</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> 부모 훅이 undefined이면 에이전트 훅만 그대로 반환됩니다.
            불필요한 null 체크 없이 안전하게 호출할 수 있습니다.
          </Callout>

          <DeepDive title="이벤트 이름 매핑 상세">
            <p className="mb-3">
              현재 이름이 변경되는 이벤트는 <code className="text-cyan-600">Stop</code> &rarr;
              <code className="text-cyan-600">SubagentStop</code> 하나뿐입니다.
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li><code>PreToolUse</code> &rarr; 이름 그대로 유지</li>
              <li><code>PostToolUse</code> &rarr; 이름 그대로 유지</li>
              <li><code>Stop</code> &rarr; <code>SubagentStop</code>으로 변환</li>
            </ul>
            <p className="mt-3 text-amber-600">
              이 매핑은 <code className="text-cyan-600">STOP_EVENT_MAPPING</code> 상수에 하드코딩되어 있습니다.
              새로운 이벤트 매핑이 필요하면 이 상수를 수정해야 합니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>변환 + 병합 파이프라인</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            에이전트 훅은 변환과 병합의 2단계 파이프라인을 거칩니다.
          </p>

          <MermaidDiagram
            title="훅 변환 + 병합 파이프라인"
            titleColor="purple"
            chart={`graph LR
  INPUT["AgentHookConfig<br/><small>PreToolUse / PostToolUse / Stop</small>"]
  RULES["convertRules()<br/><small>AgentHookRule[] → HookRule[]</small>"]
  HANDLER["toCommandHandler()<br/><small>AgentHookEntry → CommandHookHandler</small>"]
  MAPPING["Stop → SubagentStop<br/><small>이벤트 이름 매핑</small>"]
  OUTPUT["HookConfig"]

  INPUT --> RULES
  RULES --> HANDLER
  RULES --> MAPPING
  HANDLER --> OUTPUT
  MAPPING --> OUTPUT

  style INPUT fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style RULES fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style HANDLER fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style MAPPING fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style OUTPUT fill:#dcfce7,stroke:#10b981,color:#1e293b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석 &mdash; mergeHookConfigs</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            부모와 에이전트 훅을 병합하는 핵심 로직입니다.
          </p>
          <CodeBlock>
            <span className="fn">mergeHookConfigs</span>(<span className="prop">parentHooks</span>, <span className="prop">agentHooks</span>): <span className="type">HookConfig</span> {"{"}
            {"\n"}{"  "}<span className="cm">{"// [1] 부모 훅이 없으면 에이전트 훅만 사용"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (!<span className="prop">parentHooks</span>) <span className="kw">return</span> <span className="prop">agentHooks</span>;
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [2] 부모 훅을 기본값으로 복사"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">merged</span> = {"{"} ...<span className="prop">parentHooks</span> {"}"};
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [3] 에이전트 훅의 각 이벤트를 순회하며 병합"}</span>
            {"\n"}{"  "}<span className="kw">for</span> (<span className="kw">const</span> [<span className="prop">event</span>, <span className="prop">agentRules</span>] <span className="kw">of</span> <span className="fn">Object</span>.<span className="fn">entries</span>(<span className="prop">agentHooks</span>)) {"{"}
            {"\n"}{"    "}<span className="kw">const</span> <span className="prop">parentRules</span> = <span className="prop">merged</span>[<span className="prop">event</span>];
            {"\n"}{"    "}<span className="kw">if</span> (<span className="prop">parentRules</span> && <span className="prop">parentRules</span>.<span className="prop">length</span> {">"} <span className="num">0</span>) {"{"}
            {"\n"}{"      "}<span className="cm">{"// [4] 양쪽 모두: 부모 먼저 + 에이전트 나중"}</span>
            {"\n"}{"      "}<span className="prop">merged</span>[<span className="prop">event</span>] = [...<span className="prop">parentRules</span>, ...<span className="prop">agentRules</span>];
            {"\n"}{"    "}<span className="kw">{"}"} else {"{"}</span>
            {"\n"}{"      "}<span className="cm">{"// [5] 에이전트에만 있으면 그대로 추가"}</span>
            {"\n"}{"      "}<span className="prop">merged</span>[<span className="prop">event</span>] = <span className="prop">agentRules</span>;
            {"\n"}{"    "}{"}"}
            {"\n"}{"  "}{"}"}
            {"\n"}{"  "}<span className="kw">return</span> <span className="prop">merged</span>;
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> 부모 훅이 없으면 에이전트 훅만 그대로 반환합니다. null 체크가 내장되어 있습니다.</p>
            <p><strong className="text-gray-900">[2]</strong> 스프레드 연산자로 부모 훅을 얕은 복사합니다. 원본 객체를 수정하지 않습니다.</p>
            <p><strong className="text-gray-900">[3]</strong> 에이전트 훅의 모든 이벤트를 순회하며 부모와 병합합니다.</p>
            <p><strong className="text-gray-900">[4]</strong> 같은 이벤트가 양쪽에 있으면 배열을 연결합니다. 부모 규칙이 먼저 평가되고 에이전트 규칙이 나중에 평가됩니다.</p>
            <p><strong className="text-gray-900">[5]</strong> 에이전트에만 있는 이벤트는 새로 추가합니다.</p>
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
              &quot;Stop 훅이 실행되지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              에이전트 정의에서 <code className="text-cyan-600">Stop</code>으로 설정한 훅은 내부적으로
              <code className="text-cyan-600">SubagentStop</code> 이벤트로 변환됩니다. 훅 러너에서
              <code className="text-cyan-600">SubagentStop</code> 이벤트를 지원하는지 확인하세요.
              일반 에이전트의 <code className="text-cyan-600">Stop</code> 이벤트와는 다른 이벤트입니다.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;에이전트 훅이 부모 훅보다 먼저 실행돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">mergeHookConfigs()</code>는 부모 규칙을 먼저,
              에이전트 규칙을 나중에 배열에 넣습니다. 훅 러너가 배열 순서대로 실행하는지 확인하세요.
              만약 역순으로 실행되면 실행 순서가 뒤바뀔 수 있습니다.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;matcher를 생략했더니 모든 도구에 훅이 적용돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">matcher</code>가 없으면 해당 이벤트의 모든 도구 호출에
              훅이 적용됩니다. 이것은 의도된 동작입니다. 특정 도구에만 적용하려면
              <code className="text-cyan-600">matcher: &quot;file_*&quot;</code>처럼 패턴을 지정하세요.
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
                name: "definition-loader.ts",
                slug: "definition-loader",
                relation: "sibling",
                desc: "에이전트 정의 파일(.md)을 파싱하고 로드하는 모듈 — 프론트매터에서 훅 설정을 읽음",
              },
              {
                name: "shared-state.ts",
                slug: "shared-state",
                relation: "sibling",
                desc: "워커 에이전트 간 키-값 저장소, 메시지 큐, 진행도 추적을 제공하는 공유 상태 모듈",
              },
              {
                name: "task-list.ts",
                slug: "subagent-task-list",
                relation: "sibling",
                desc: "여러 에이전트가 협업할 때 작업을 조율하는 팀 작업 목록 관리 모듈",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
