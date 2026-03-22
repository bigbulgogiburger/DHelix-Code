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

export default function RecoveryStrategyPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/core/recovery-strategy.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">RecoveryStrategy</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="core" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              에러 유형별 복구 전략을 매핑하는 테이블 모듈입니다.
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
                <code className="text-cyan-600">RecoveryStrategy</code>는 LLM 호출이나 도구 실행 중
                발생하는 에러에 대해 어떤 방식으로 복구할지 결정하는 전략 패턴을 정의합니다. 에러가
                발생하면 무조건 실패하지 않고, 에러 종류에 따라 &quot;재시도&quot;, &quot;컨텍스트
                압축&quot;, &quot;대체 전략&quot; 등 다른 복구 방법을 시도합니다.
              </p>
              <p>
                6개의 미리 정의된 전략이 에러 메시지 패턴(정규표현식)과 매핑되어 있으며, 배열
                순서대로 매칭을 시도하여 첫 번째 매칭된 전략이 사용됩니다.
                <code className="text-cyan-600">findRecoveryStrategy(error)</code> 함수 하나로 에러
                객체에 맞는 복구 전략을 조회할 수 있습니다.
              </p>
              <p>
                이 모듈은 &quot;무엇을&quot; 할지만 정의하고, 실제 복구 실행은
                <code className="text-cyan-600">Recovery Executor</code>가 담당합니다.
                전략(Strategy)과 실행(Executor)의 관심사가 분리되어 있어, 새로운 에러 유형 추가 시
                이 파일만 수정하면 됩니다.
              </p>
            </div>

            <MermaidDiagram
              title="RecoveryStrategy 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  CB["CircuitBreaker<br/><small>circuit-breaker.ts</small>"]
  RE["Recovery Executor<br/><small>recovery-executor.ts</small>"]
  RS["RECOVERY_STRATEGIES<br/><small>recovery-strategy.ts</small>"]
  AL["Agent Loop<br/><small>agent-loop.ts</small>"]
  LLM["LLM Client<br/><small>llm/client.ts</small>"]
  CTX["Context Manager<br/><small>context-manager.ts</small>"]

  AL -->|"에러 발생"| RE
  CB -->|"차단 시 복구 위임"| RE
  RE -->|"findRecoveryStrategy()"| RS
  RE -->|"action: retry"| LLM
  RE -->|"action: compact"| CTX

  style RS fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style RE fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CB fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style AL fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style LLM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style CTX fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 병원의 응급 프로토콜을 떠올리세요. 환자의 증상(에러 메시지)에
              따라 &quot;진통제 투여(재시도)&quot;, &quot;수술(압축)&quot;, &quot;다른 치료법(대체
              전략)&quot;이 미리 정해져 있습니다. 의사(Recovery Executor)는 프로토콜표(이 모듈)를
              보고 어떤 치료를 할지 결정합니다.
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

            {/* RecoveryStrategy interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface RecoveryStrategy
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              하나의 복구 전략을 정의하는 인터페이스입니다. 에러 패턴, 복구 행동, 재시도 횟수, 대기
              시간 등을 포함합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "errorPattern",
                  type: "RegExp",
                  required: true,
                  desc: "이 전략이 적용될 에러 메시지의 정규표현식 패턴",
                },
                {
                  name: "action",
                  type: '"retry" | "compact" | "fallback-strategy"',
                  required: true,
                  desc: "복구 행동: 재시도 / 메시지 압축 / 대체 전략",
                },
                {
                  name: "maxRetries",
                  type: "number",
                  required: true,
                  desc: "이 전략으로 최대 몇 번까지 재시도할지",
                },
                {
                  name: "backoffMs",
                  type: "number | undefined",
                  required: false,
                  desc: "재시도 전 기본 대기 시간 (밀리초, 지수적으로 증가)",
                },
                {
                  name: "description",
                  type: "string",
                  required: true,
                  desc: "사람이 읽을 수 있는 전략 설명",
                },
              ]}
            />

            {/* action types */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              action 유형 상세
            </h3>
            <CodeBlock>
              <span className="kw">type</span> <span className="type">Action</span> ={" "}
              <span className="str">&quot;retry&quot;</span> |{" "}
              <span className="str">&quot;compact&quot;</span> |{" "}
              <span className="str">&quot;fallback-strategy&quot;</span>;
            </CodeBlock>
            <div className="text-[13px] text-gray-600 mt-2 space-y-1">
              <p>
                &bull; <code className="text-emerald-600">&quot;retry&quot;</code> &mdash; 같은
                요청을 재시도합니다. 네트워크 타임아웃, 파일 잠금 등 일시적 에러에 사용합니다.
              </p>
              <p>
                &bull; <code className="text-amber-600">&quot;compact&quot;</code> &mdash; 메시지를
                압축(요약)한 뒤 재시도합니다. 컨텍스트 초과, MCP 연결 끊김 시 사용합니다.
              </p>
              <p>
                &bull; <code className="text-purple-600">&quot;fallback-strategy&quot;</code>{" "}
                &mdash; 대체 전략(텍스트 파싱 등)으로 전환합니다. JSON 파싱 에러 시 사용합니다.
              </p>
            </div>

            {/* RECOVERY_STRATEGIES 상수 */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              RECOVERY_STRATEGIES
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              미리 정의된 6개의 복구 전략 목록입니다. 배열 순서대로 매칭을 시도합니다.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-[12px] text-gray-600 border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-3 text-gray-900 font-bold">#</th>
                    <th className="text-left py-2 pr-3 text-gray-900 font-bold">에러 유형</th>
                    <th className="text-left py-2 pr-3 text-gray-900 font-bold">action</th>
                    <th className="text-left py-2 pr-3 text-gray-900 font-bold">maxRetries</th>
                    <th className="text-left py-2 pr-3 text-gray-900 font-bold">backoffMs</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3">1</td>
                    <td className="py-2 pr-3">컨텍스트 윈도우 초과</td>
                    <td className="py-2 pr-3">
                      <code className="text-amber-600">compact</code>
                    </td>
                    <td className="py-2 pr-3">1</td>
                    <td className="py-2 pr-3">&mdash;</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3">2</td>
                    <td className="py-2 pr-3">MCP 도구 타임아웃</td>
                    <td className="py-2 pr-3">
                      <code className="text-emerald-600">retry</code>
                    </td>
                    <td className="py-2 pr-3">1</td>
                    <td className="py-2 pr-3">3000</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3">3</td>
                    <td className="py-2 pr-3">MCP 서버 연결 에러</td>
                    <td className="py-2 pr-3">
                      <code className="text-amber-600">compact</code>
                    </td>
                    <td className="py-2 pr-3">1</td>
                    <td className="py-2 pr-3">&mdash;</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3">4</td>
                    <td className="py-2 pr-3">네트워크 타임아웃 (LLM)</td>
                    <td className="py-2 pr-3">
                      <code className="text-emerald-600">retry</code>
                    </td>
                    <td className="py-2 pr-3">2</td>
                    <td className="py-2 pr-3">2000</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3">5</td>
                    <td className="py-2 pr-3">JSON 파싱 에러</td>
                    <td className="py-2 pr-3">
                      <code className="text-purple-600">fallback-strategy</code>
                    </td>
                    <td className="py-2 pr-3">1</td>
                    <td className="py-2 pr-3">&mdash;</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3">6</td>
                    <td className="py-2 pr-3">파일 잠금 (lock)</td>
                    <td className="py-2 pr-3">
                      <code className="text-emerald-600">retry</code>
                    </td>
                    <td className="py-2 pr-3">3</td>
                    <td className="py-2 pr-3">1000</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* findRecoveryStrategy function */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              findRecoveryStrategy(error)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              에러 메시지를 RECOVERY_STRATEGIES의 각 패턴과 비교하여 첫 번째 매칭되는 전략을
              반환합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">findRecoveryStrategy</span>(
              <span className="prop">error</span>: <span className="type">Error</span>):{" "}
              <span className="type">RecoveryStrategy</span> |{" "}
              <span className="type">undefined</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "error",
                  type: "Error",
                  required: true,
                  desc: "발생한 에러 객체 (error.message가 패턴 매칭에 사용됨)",
                },
                {
                  name: "(반환)",
                  type: "RecoveryStrategy | undefined",
                  required: true,
                  desc: "매칭된 복구 전략, 없으면 undefined",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                배열 순서가 곧 <strong>우선순위</strong>입니다. 컨텍스트 초과가 첫 번째이므로, 에러
                메시지에 &quot;timeout&quot;과 &quot;token limit&quot; 모두 포함되면
                <code className="text-cyan-600">compact</code> 전략이 선택됩니다.
              </li>
              <li>
                <code className="text-cyan-600">undefined</code>가 반환되면 알 수 없는 에러입니다.
                Recovery Executor가 기본 동작(에러 메시지를 LLM에 전달)을 수행합니다.
              </li>
              <li>
                정규표현식의 <code className="text-cyan-600">i</code> 플래그로 대소문자를
                무시합니다. 에러 메시지의 대소문자에 상관없이 매칭됩니다.
              </li>
              <li>
                전략 목록은 <code className="text-cyan-600">readonly</code> 배열로, 런타임에 전략을
                추가/제거할 수 없습니다.
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
              기본 사용법 &mdash; 에러 발생 시 전략 조회
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              에러가 발생하면 <code className="text-cyan-600">findRecoveryStrategy()</code>로 적절한
              복구 전략을 조회하고, 전략의 <code className="text-cyan-600">action</code>에 따라 복구
              로직을 실행합니다.
            </p>
            <CodeBlock>
              <span className="kw">try</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">await</span> <span className="fn">callLLM</span>(
              <span className="prop">messages</span>);
              {"\n"}
              {"}"} <span className="kw">catch</span> (<span className="prop">error</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">strategy</span> ={" "}
              <span className="fn">findRecoveryStrategy</span>(<span className="prop">error</span>);
              {"\n"}
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">strategy</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="fn">logger</span>.<span className="fn">info</span>(
              <span className="str">{"`복구 전략: ${strategy.description}`"}</span>);
              {"\n"}
              {"\n"}
              {"    "}
              <span className="kw">switch</span> (<span className="prop">strategy</span>.
              <span className="prop">action</span>) {"{"}
              {"\n"}
              {"      "}
              <span className="kw">case</span> <span className="str">&quot;retry&quot;</span>:{"\n"}
              {"        "}
              <span className="kw">await</span> <span className="fn">sleep</span>(
              <span className="prop">strategy</span>.<span className="prop">backoffMs</span> ??{" "}
              <span className="num">1000</span>);
              {"\n"}
              {"        "}
              <span className="kw">await</span> <span className="fn">callLLM</span>(
              <span className="prop">messages</span>);
              {"\n"}
              {"        "}
              <span className="kw">break</span>;{"\n"}
              {"      "}
              <span className="kw">case</span> <span className="str">&quot;compact&quot;</span>:
              {"\n"}
              {"        "}
              <span className="kw">await</span> <span className="fn">compactMessages</span>(
              <span className="prop">messages</span>);
              {"\n"}
              {"        "}
              <span className="kw">break</span>;{"\n"}
              {"      "}
              <span className="kw">case</span>{" "}
              <span className="str">&quot;fallback-strategy&quot;</span>:{"\n"}
              {"        "}
              <span className="fn">switchToTextParsing</span>();
              {"\n"}
              {"        "}
              <span className="kw">break</span>;{"\n"}
              {"    "}
              {"}"}
              {"\n"}
              {"  "}
              <span className="kw">
                {"}"} else {"{"}
              </span>
              {"\n"}
              {"    "}
              <span className="cm">{"// 알 수 없는 에러 — 기본 처리"}</span>
              {"\n"}
              {"    "}
              <span className="kw">throw</span> <span className="prop">error</span>;{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"}"}
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>findRecoveryStrategy()</code>는 <code>Error</code> 객체를
              받습니다. 문자열이 아닌 에러 객체의 <code>message</code> 프로퍼티로 패턴 매칭합니다.
              에러를 문자열로 변환한 뒤 전달하면 매칭이 실패할 수 있습니다.
            </Callout>

            {/* 고급: 지수 백오프 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 지수 백오프(Exponential Backoff) 재시도
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">backoffMs</code>는 기본 대기 시간이며, 실제 Recovery
              Executor는 재시도 횟수에 따라 지수적으로 대기 시간을 늘립니다.
            </p>
            <CodeBlock>
              <span className="cm">
                {"// 네트워크 타임아웃 전략: backoffMs = 2000, maxRetries = 2"}
              </span>
              {"\n"}
              <span className="cm">{"// 1차 재시도: 2000ms 대기"}</span>
              {"\n"}
              <span className="cm">{"// 2차 재시도: 4000ms 대기 (2000 * 2^1)"}</span>
              {"\n"}
              {"\n"}
              <span className="kw">for</span> (<span className="kw">let</span>{" "}
              <span className="prop">i</span> = <span className="num">0</span>;{" "}
              <span className="prop">i</span> {"<"} <span className="prop">strategy</span>.
              <span className="prop">maxRetries</span>; <span className="prop">i</span>++) {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">delay</span> = (
              <span className="prop">strategy</span>.<span className="prop">backoffMs</span> ??{" "}
              <span className="num">1000</span>) * <span className="fn">Math</span>.
              <span className="fn">pow</span>(<span className="num">2</span>,{" "}
              <span className="prop">i</span>);
              {"\n"}
              {"  "}
              <span className="kw">await</span> <span className="fn">sleep</span>(
              <span className="prop">delay</span>);
              {"\n"}
              {"  "}
              <span className="cm">{"// 재시도..."}</span>
              {"\n"}
              {"}"}
            </CodeBlock>

            <DeepDive title="MCP 에러 전략의 설계 이유">
              <p className="mb-3">
                MCP(Model Context Protocol) 관련 에러가 2개의 별도 전략으로 분리되어 있는 이유가
                있습니다:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <strong>MCP 타임아웃</strong> (<code className="text-cyan-600">retry</code>):
                  서버가 살아있지만 응답이 느린 경우. 3초 대기 후 1회만 재시도하면 대부분
                  해결됩니다.
                </li>
                <li>
                  <strong>MCP 연결 끊김</strong> (<code className="text-cyan-600">compact</code>):
                  서버가 완전히 죽은 경우. 재시도해도 소용없으므로, 메시지를 정리하여 LLM이 MCP 없이
                  대안을 찾도록 유도합니다.
                </li>
              </ul>
              <p className="mt-3 text-amber-600">
                Claude Code에서도 MCP 타임아웃은 알려진 문제입니다 (issue #16837, #18684). 무한
                재시도를 방지하기 위해 <code>maxRetries: 1</code>로 제한되어 있습니다.
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
              전략 매칭 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              에러 발생 시 복구 전략이 결정되는 과정입니다. 배열을 순회하며 첫 번째 매칭된 전략을
              반환합니다.
            </p>

            <MermaidDiagram
              title="RecoveryStrategy 매칭 흐름"
              titleColor="purple"
              chart={`graph TD
  ERR["에러 발생<br/><small>error.message</small>"]
  S1{"패턴 1 매칭?<br/><small>context.*exceed</small>"}
  S2{"패턴 2 매칭?<br/><small>MCP.*timed out</small>"}
  S3{"패턴 3 매칭?<br/><small>MCP.*ECONNREFUSED</small>"}
  S4{"패턴 4 매칭?<br/><small>ETIMEDOUT|timeout</small>"}
  S5{"패턴 5 매칭?<br/><small>parse.*error</small>"}
  S6{"패턴 6 매칭?<br/><small>ELOCK|locked</small>"}
  COMPACT["compact<br/><small>메시지 압축 후 재시도</small>"]
  RETRY["retry<br/><small>지수 백오프 재시도</small>"]
  FALLBACK["fallback-strategy<br/><small>텍스트 파싱으로 전환</small>"]
  UNDEF["undefined<br/><small>알 수 없는 에러</small>"]

  ERR --> S1
  S1 -->|"Yes"| COMPACT
  S1 -->|"No"| S2
  S2 -->|"Yes"| RETRY
  S2 -->|"No"| S3
  S3 -->|"Yes"| COMPACT
  S3 -->|"No"| S4
  S4 -->|"Yes"| RETRY
  S4 -->|"No"| S5
  S5 -->|"Yes"| FALLBACK
  S5 -->|"No"| S6
  S6 -->|"Yes"| RETRY
  S6 -->|"No"| UNDEF

  style ERR fill:#fee2e2,stroke:#ef4444,color:#991b1b,stroke-width:2px
  style COMPACT fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style RETRY fill:#dcfce7,stroke:#10b981,color:#065f46
  style FALLBACK fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style UNDEF fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">findRecoveryStrategy()</code>의 구현은 극도로
              간결합니다.
              <code className="text-cyan-600">Array.find()</code>로 첫 번째 매칭 전략을 반환합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">findRecoveryStrategy</span>(
              <span className="prop">error</span>: <span className="type">Error</span>):{" "}
              <span className="type">RecoveryStrategy</span> |{" "}
              <span className="type">undefined</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">return</span> <span className="prop">RECOVERY_STRATEGIES</span>.
              <span className="fn">find</span>({"\n"}
              {"    "}(<span className="prop">s</span>) {"=>"} <span className="prop">s</span>.
              <span className="prop">errorPattern</span>.<span className="fn">test</span>(
              <span className="prop">error</span>.<span className="prop">message</span>){"\n"}
              {"  "});
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">설계 포인트:</strong> 단일 함수, 단일 책임. 전략
                테이블과 조회 로직만 제공하며, 실행은 Recovery Executor에 완전히 위임합니다.
              </p>
              <p>
                <strong className="text-gray-900">순서 의존성:</strong>{" "}
                <code className="text-cyan-600">find()</code>는 배열 순서대로 탐색하므로, 전략
                순서가 곧 우선순위입니다. 더 구체적인 패턴(MCP 타임아웃)이 더 일반적인 패턴(네트워크
                타임아웃) 앞에 위치합니다.
              </p>
              <p>
                <strong className="text-gray-900">readonly 배열:</strong>{" "}
                <code className="text-cyan-600">readonly RecoveryStrategy[]</code>로 선언되어
                런타임에 전략을 추가/수정할 수 없습니다. 확장 시 소스 코드를 직접 수정해야 합니다.
              </p>
            </div>

            <DeepDive title="정규표현식 패턴 설계 상세">
              <p className="mb-3">
                각 패턴은 가능한 한 넓은 범위의 에러 메시지를 매칭하되, 오탐(false positive)을
                방지하기 위해 신중하게 설계되었습니다:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <code>/request too large|context.*exceed|token.*limit/i</code> &mdash; 다양한 LLM
                  프로바이더의 컨텍스트 초과 메시지를 매칭
                </li>
                <li>
                  <code>/MCP tool error.*timed out/i</code> &mdash; MCP 전용 패턴. 일반 타임아웃과
                  구분하기 위해 &quot;MCP tool error&quot; 접두사 필요
                </li>
                <li>
                  <code>/ETIMEDOUT|timeout|timed out/i</code> &mdash; Node.js 네이티브 에러코드 +
                  일반적인 타임아웃 메시지
                </li>
                <li>
                  <code>/ELOCK|lock.*exist|locked/i</code> &mdash; 파일 잠금 관련 다양한 OS 에러
                  메시지 매칭
                </li>
              </ul>
              <p className="mt-3 text-amber-600">
                MCP 타임아웃 패턴이 일반 타임아웃 패턴보다 앞에 위치하는 이유는, &quot;MCP tool
                error... timed out&quot; 메시지가 일반 타임아웃 패턴에도 매칭되기 때문입니다. MCP
                전용 처리(3초 백오프, 1회 재시도)가 일반 타임아웃 처리(2초 백오프, 2회 재시도)와
                다르므로 정확한 전략 분기가 필요합니다.
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
                &quot;에러가 발생했는데 복구 전략이 적용되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                <code className="text-cyan-600">findRecoveryStrategy()</code>가{" "}
                <code>undefined</code>를 반환하고 있을 가능성이 높습니다. 에러 메시지가 6개 패턴 중
                어디에도 매칭되지 않는 것입니다.
              </p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  에러 객체의 <code className="text-cyan-600">message</code> 프로퍼티를 로그로
                  출력하여 실제 메시지를 확인하세요.
                </li>
                <li>
                  새로운 에러 패턴이 필요하면{" "}
                  <code className="text-cyan-600">RECOVERY_STRATEGIES</code>
                  배열에 항목을 추가하세요.
                </li>
              </ul>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;잘못된 복구 전략이 적용됩니다&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                배열 순서가 우선순위이므로, 에러 메시지가 여러 패턴에 매칭되는 경우 첫 번째 매칭된
                전략이 적용됩니다. 더 구체적인 패턴을 배열 앞쪽으로 이동시키세요.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;새로운 에러 유형에 대한 전략을 추가하고 싶어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                <code className="text-cyan-600">RECOVERY_STRATEGIES</code> 배열에 새 항목을 추가하면
                됩니다. 주의: 배열 순서가 매칭 우선순위이므로, 더 구체적인 패턴일수록 앞에
                배치하세요.
              </p>
              <CodeBlock>
                <span className="cm">{"// 예: 인증 에러 전략 추가"}</span>
                {"\n"}
                {"{"}
                {"\n"}
                {"  "}
                <span className="prop">errorPattern</span>:{" "}
                <span className="str">/unauthorized|auth.*failed|401/i</span>,{"\n"}
                {"  "}
                <span className="prop">action</span>: <span className="str">&quot;retry&quot;</span>
                ,{"\n"}
                {"  "}
                <span className="prop">maxRetries</span>: <span className="num">1</span>,{"\n"}
                {"  "}
                <span className="prop">backoffMs</span>: <span className="num">5000</span>,{"\n"}
                {"  "}
                <span className="prop">description</span>:{" "}
                <span className="str">&quot;Auth error - retry after token refresh&quot;</span>,
                {"\n"}
                {"}"}
              </CodeBlock>
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
                  name: "recovery-executor.ts",
                  slug: "recovery-executor",
                  relation: "parent",
                  desc: "이 모듈의 전략을 실제로 실행하는 복구 실행기",
                },
                {
                  name: "circuit-breaker.ts",
                  slug: "circuit-breaker",
                  relation: "sibling",
                  desc: "에이전트 루프 차단 후 Recovery Executor를 통해 이 전략 테이블을 참조",
                },
                {
                  name: "context-manager.ts",
                  slug: "context-manager",
                  relation: "sibling",
                  desc: "compact 액션 시 메시지 압축을 담당하는 3-Layer 컨텍스트 관리자",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
