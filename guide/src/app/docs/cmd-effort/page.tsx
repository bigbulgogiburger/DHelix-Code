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

export default function CmdEffortPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/commands/effort.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">/effort</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
              <span
                className="text-xs font-semibold rounded-md bg-cyan-100 text-cyan-700"
                style={{ padding: "5px 14px" }}
              >
                Slash Command
              </span>
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              LLM 응답의 추론 깊이와 최대 토큰 수를 4단계(low/medium/high/max)로 조절하는 노력 수준
              설정 명령어입니다.
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
                <code className="text-cyan-600">/effort</code>는 LLM이 응답을 생성할 때 사용하는
                최대 토큰 수(maxTokens)와 temperature를 한 번에 조정하는 명령어입니다. 노력 수준이
                높을수록 더 상세하고 긴 분석이 가능하지만 응답 시간과 비용이 증가합니다.
              </p>
              <p>
                4가지 수준을 제공합니다: <strong>low</strong>(1024 토큰, 간단한 답변),{" "}
                <strong>medium</strong>(2048 토큰, 일반적인 답변), <strong>high</strong>(4096 토큰,
                기본값 — 상세한 답변), <strong>max</strong>(8192 토큰, 최대한 상세한 답변). 모든
                수준에서 temperature는 0.0으로 고정되어 결정적인 응답을 보장합니다.
              </p>
              <p>
                노력 수준은 모듈 레벨 상태(<code className="text-cyan-600">currentEffort</code>)로
                세션 동안 유지됩니다. 에이전트 루프는{" "}
                <code className="text-cyan-600">getEffortLevel()</code>과{" "}
                <code className="text-cyan-600">getEffortConfig()</code>를 통해 현재 설정을 읽어 LLM
                호출에 반영합니다.
              </p>
            </div>

            <MermaidDiagram
              title="/effort 명령어 동작 흐름"
              titleColor="purple"
              chart={`graph TD
  USER["사용자 입력<br/><small>/effort [low|medium|high|max]</small>"]
  CMD["effortCommand.execute()"]
  CHECK{"인자 있음?"}
  SHOW["현재 수준 표시<br/><small>Current effort level: high</small>"]
  VALID{"유효한 수준?"}
  ERR["에러 반환<br/><small>Invalid effort level</small>"]
  SET["currentEffort 업데이트<br/><small>모듈 상태 갱신</small>"]
  CONFIG["getEffortConfig()<br/><small>maxTokens + temperature 반환</small>"]
  OUTPUT["설정 확인 메시지<br/><small>Effort level set to: max (maxTokens: 8192)</small>"]

  USER --> CMD
  CMD --> CHECK
  CHECK -->|"없음"| SHOW
  CHECK -->|"있음"| VALID
  VALID -->|"아님"| ERR
  VALID -->|"맞음"| SET
  SET --> CONFIG
  CONFIG --> OUTPUT

  style CMD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style SET fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CONFIG fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style OUTPUT fill:#dcfce7,stroke:#10b981,color:#065f46
  style ERR fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
            />

            <Callout type="info" icon="💡">
              <strong>기본값:</strong> 초기 노력 수준은 <code>high</code>입니다(maxTokens: 4096).
              대부분의 코딩 작업에 적합한 수준으로, 복잡한 분석이 필요할 때만 <code>max</code>로
              올리는 것을 권장합니다.
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

            {/* EFFORT_LEVELS */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              EFFORT_LEVELS
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              유효한 노력 수준 상수 배열입니다. <code className="text-cyan-600">as const</code>로
              선언되어 타입 리터럴 유니온을 생성합니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">EFFORT_LEVELS</span> = [
              <span className="str">&quot;low&quot;</span>,{" "}
              <span className="str">&quot;medium&quot;</span>,{" "}
              <span className="str">&quot;high&quot;</span>,{" "}
              <span className="str">&quot;max&quot;</span>] <span className="kw">as const</span>;
              {"\n"}
              <span className="kw">type</span> <span className="type">EffortLevel</span> = (
              <span className="kw">typeof</span> <span className="prop">EFFORT_LEVELS</span>)[
              <span className="type">number</span>];{" "}
              <span className="cm">{'// "low" | "medium" | "high" | "max"'}</span>
            </CodeBlock>

            {/* getEffortLevel */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              getEffortLevel()
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              현재 노력 수준을 반환하는 getter 함수입니다. 에이전트 루프 등 외부 모듈에서 현재
              설정을 읽을 때 사용합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">getEffortLevel</span>():{" "}
              <span className="type">EffortLevel</span>
            </CodeBlock>

            {/* getEffortConfig */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              getEffortConfig(level)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              노력 수준을 LLM 호출 파라미터(temperature, maxTokens)로 변환합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">getEffortConfig</span>(
              <span className="prop">level</span>: <span className="type">EffortLevel</span>): {"{"}{" "}
              <span className="kw">readonly</span> <span className="prop">temperature</span>:{" "}
              <span className="type">number</span>; <span className="kw">readonly</span>{" "}
              <span className="prop">maxTokens</span>: <span className="type">number</span> {"}"}
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "level",
                  type: "EffortLevel",
                  required: true,
                  desc: '노력 수준 ("low" | "medium" | "high" | "max")',
                },
              ]}
            />

            {/* effortCommand */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              effortCommand: SlashCommand
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">/effort</code> 슬래시 명령어의 정의 객체입니다.
            </p>
            <ParamTable
              params={[
                { name: "name", type: '"effort"', required: true, desc: "명령어 이름" },
                {
                  name: "description",
                  type: "string",
                  required: true,
                  desc: '"Set reasoning effort level (low/medium/high/max)"',
                },
                {
                  name: "usage",
                  type: "string",
                  required: true,
                  desc: '"/effort [low|medium|high|max]"',
                },
                {
                  name: "execute",
                  type: "(args, context) => Promise<CommandResult>",
                  required: true,
                  desc: "명령어 실행 함수",
                },
              ]}
            />

            {/* 수준별 매핑 표 */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              수준별 파라미터 매핑
            </h3>
            <ParamTable
              params={[
                {
                  name: "low",
                  type: "EffortLevel",
                  required: false,
                  desc: "temperature: 0.0, maxTokens: 1024 — 간단한 질문, 짧은 답변",
                },
                {
                  name: "medium",
                  type: "EffortLevel",
                  required: false,
                  desc: "temperature: 0.0, maxTokens: 2048 — 일반적인 개발 질문",
                },
                {
                  name: "high",
                  type: "EffortLevel",
                  required: false,
                  desc: "temperature: 0.0, maxTokens: 4096 — 기본값, 상세한 코드 분석",
                },
                {
                  name: "max",
                  type: "EffortLevel",
                  required: false,
                  desc: "temperature: 0.0, maxTokens: 8192 — 아키텍처 설계, 복잡한 리팩토링",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                노력 수준은 <strong>세션 내 모듈 상태</strong>로 유지됩니다. 세션을 재시작하면
                기본값 <code className="text-cyan-600">high</code>로 초기화됩니다.
              </li>
              <li>
                모든 수준에서 <code className="text-cyan-600">temperature</code>는 0.0으로
                고정됩니다. 창의적 응답이 필요하면 다른 방법을 사용하세요.
              </li>
              <li>
                <code className="text-cyan-600">maxTokens</code>는 LLM 모델이 지원하는 최대 출력
                토큰 한도를 초과할 수 없습니다. 모델 자체 한도가 더 낮으면 모델 한도가 적용됩니다.
              </li>
              <li>인자를 제공하지 않으면 현재 수준만 표시하고 변경하지 않습니다.</li>
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
              기본 사용법 &mdash; 현재 수준 확인
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              인자 없이 실행하면 현재 노력 수준을 표시합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 현재 수준 확인"}</span>
              {"\n"}
              <span className="fn">/effort</span>
              {"\n"}
              <span className="cm">{"// Current effort level: high"}</span>
            </CodeBlock>

            {/* 수준 변경 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              수준 변경 &mdash; 비용 절감 또는 깊은 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              수준 이름을 인자로 전달하면 즉시 변경됩니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 간단한 질문에 비용 절감"}</span>
              {"\n"}
              <span className="fn">/effort</span> <span className="str">low</span>
              {"\n"}
              <span className="cm">{"// Effort level set to: low (maxTokens: 1024)"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 복잡한 아키텍처 분석"}</span>
              {"\n"}
              <span className="fn">/effort</span> <span className="str">max</span>
              {"\n"}
              <span className="cm">{"// Effort level set to: max (maxTokens: 8192)"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 잘못된 수준 입력"}</span>
              {"\n"}
              <span className="fn">/effort</span> <span className="str">ultra</span>
              {"\n"}
              <span className="cm">
                {'// Invalid effort level: "ultra". Use: low, medium, high, max'}
              </span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>max</code> 수준(8192 토큰)은 응답이 매우 길어질 수 있어
              비용과 응답 시간이 크게 증가합니다. 일상적인 코딩 작업에는 기본값 <code>high</code>를
              사용하고, 설계 검토나 대규모 리팩토링 계획 수립 시에만
              <code>max</code>로 전환하세요.
            </Callout>

            <DeepDive title="노력 수준 선택 가이드">
              <p className="mb-3">작업 유형에 따른 권장 수준:</p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <strong>low</strong>: 단순 변수명 제안, 짧은 코드 스니펫 생성, Yes/No 확인
                </li>
                <li>
                  <strong>medium</strong>: 함수 구현, 단순 버그 수정, 짧은 설명 요청
                </li>
                <li>
                  <strong>high</strong> (기본값): 모듈 설계, 코드 리뷰, 테스트 작성, 상세 분석
                </li>
                <li>
                  <strong>max</strong>: 전체 아키텍처 설계, 복잡한 리팩토링 계획, 대규모
                  마이그레이션 전략
                </li>
              </ul>
              <p className="mt-3 text-amber-600">
                에이전트 루프는 <code>getEffortConfig()</code>를 통해 각 LLM 호출 시마다 현재 설정을
                적용합니다. 대화 중간에 변경해도 다음 메시지부터 즉시 반영됩니다.
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
              모듈 상태와 에이전트 루프 연결
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">currentEffort</code>는 모듈 레벨 변수로 세션 동안
              유지되며, 에이전트 루프가 LLM을 호출할 때마다 읽어 파라미터에 반영합니다.
            </p>

            <MermaidDiagram
              title="/effort 상태 관리 흐름"
              titleColor="purple"
              chart={`stateDiagram-v2
  [*] --> high: 초기값 (기본값)
  high --> low: /effort low
  high --> medium: /effort medium
  high --> max: /effort max
  low --> medium: /effort medium
  low --> high: /effort high
  low --> max: /effort max
  medium --> low: /effort low
  medium --> high: /effort high
  medium --> max: /effort max
  max --> low: /effort low
  max --> medium: /effort medium
  max --> high: /effort high`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              수준 유효성 검사와 상태 갱신의 핵심 로직입니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// [1] 인자 없으면 현재 수준 반환"}</span>
              {"\n"}
              <span className="kw">if</span> (!<span className="prop">level</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="kw">return</span> {"{"} <span className="prop">output</span>:{" "}
              <span className="str">
                `Current effort level: ${"{"}
                <span className="prop">currentEffort</span>
                {"}"}`
              </span>
              , <span className="prop">success</span>: <span className="kw">true</span> {"}"};{"\n"}
              {"}"}
              {"\n"}
              {"\n"}
              <span className="cm">{"// [2] 유효하지 않은 수준 검사"}</span>
              {"\n"}
              <span className="kw">if</span> (!<span className="prop">EFFORT_LEVELS</span>.
              <span className="fn">includes</span>(<span className="prop">level</span>{" "}
              <span className="kw">as</span> <span className="type">EffortLevel</span>)) {"{"}
              {"\n"}
              {"  "}
              <span className="kw">return</span> {"{"} <span className="prop">output</span>:{" "}
              <span className="str">
                `Invalid effort level: &quot;${"{"}
                <span className="prop">level</span>
                {"}"}&quot;...`
              </span>
              , <span className="prop">success</span>: <span className="kw">false</span> {"}"};
              {"\n"}
              {"}"}
              {"\n"}
              {"\n"}
              <span className="cm">{"// [3] 상태 갱신 후 설정 조회"}</span>
              {"\n"}
              <span className="prop">currentEffort</span> = <span className="prop">level</span>{" "}
              <span className="kw">as</span> <span className="type">EffortLevel</span>;{"\n"}
              <span className="kw">const</span> <span className="prop">config</span> ={" "}
              <span className="fn">getEffortConfig</span>(
              <span className="prop">currentEffort</span>);
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> 빈 인자는 수준 변경 없이 현재 상태만
                반환합니다. 읽기 전용 조회로 동작합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong>{" "}
                <code className="text-cyan-600">EFFORT_LEVELS.includes()</code>로 배열 멤버십을
                검사합니다. <code className="text-cyan-600">as const</code> 타입 어서션 덕분에
                TypeScript가 타입 가드로 인식합니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 상태 갱신 직후{" "}
                <code className="text-cyan-600">getEffortConfig()</code>를 호출하여 새 maxTokens
                값을 확인 메시지에 포함합니다. 사용자가 즉시 변경 효과를 확인할 수 있습니다.
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
                &quot;/effort max로 설정했는데 응답이 여전히 짧아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                모델 자체의 최대 출력 토큰 한도가 8192보다 낮을 수 있습니다.{" "}
                <code className="text-cyan-600">/context</code>로 현재 모델의{" "}
                <code className="text-cyan-600">Max output</code> 값을 확인하세요. 모델 한도가 더
                낮으면 그 값이 우선 적용됩니다. 고출력이 필요하다면{" "}
                <code className="text-cyan-600">/model</code>로 더 높은 출력 한도를 지원하는 모델로
                전환하세요.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;세션을 재시작하면 수준이 초기화돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                의도된 동작입니다. <code className="text-cyan-600">currentEffort</code>는 메모리 상
                모듈 상태로, 프로세스 종료 시 초기화됩니다. 특정 수준을 기본값으로 유지하려면
                프로젝트의 <code className="text-cyan-600">DHELIX.md</code>에 시작 지침으로
                추가하거나 <code className="text-cyan-600">/memory</code>에 기록해두고 세션 시작 시
                적용하세요.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;low로 설정하면 응답 품질이 떨어지나요?&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                최대 출력 길이가 줄어들 뿐, 모델의 추론 능력 자체는 변하지 않습니다. 짧은 답변이
                충분한 작업(예: 변수명 제안, 오타 수정)에서는{" "}
                <code className="text-cyan-600">low</code>가 오히려 빠르고 경제적입니다. 단, 긴 코드
                생성이나 복잡한 설명이 필요한 경우 토큰 부족으로 응답이 중간에 잘릴 수 있습니다.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;temperature는 왜 항상 0.0인가요?&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                코딩 어시스턴트 맥락에서는 재현 가능하고 결정적인 응답이 중요합니다. temperature
                0.0은 동일 입력에 대해 일관된 출력을 보장하여 디버깅과 반복 작업을 예측 가능하게
                합니다. 창의적인 글쓰기나 다양한 제안이 필요한 경우에는 직접 LLM에 요청하는 방식을
                사용하세요.
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
                  name: "commands/registry.ts",
                  slug: "cmd-registry",
                  relation: "parent",
                  desc: "모든 슬래시 명령어를 등록하고 관리하는 레지스트리 — effortCommand도 여기에 등록됩니다",
                },
                {
                  name: "commands/model.ts",
                  slug: "cmd-model",
                  relation: "sibling",
                  desc: "/model — 활성 LLM 모델을 전환하는 명령어, /effort와 함께 LLM 동작을 조정합니다",
                },
                {
                  name: "llm/model-capabilities.ts",
                  slug: "model-capabilities",
                  relation: "sibling",
                  desc: "모델별 능력 레지스트리 — 모델의 최대 출력 토큰 한도를 확인할 때 참조합니다",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
