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

export default function ObservationMaskingPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/core/observation-masking.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              Observation Masking
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="core" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            재생성 가능한 도구 출력을 플레이스홀더로 대체하여 토큰 사용량을 절약하는 순수 함수형 모듈입니다.
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
              <code className="text-cyan-600">observation-masking</code>은 JetBrains Research의 관측 마스킹 기법을
              구현한 모듈입니다. 에이전트 루프가 진행되면서 대화 히스토리가 길어지면 LLM에 보내는 토큰 수가
              급격히 증가합니다. 이때 &quot;다시 실행하면 같은 결과를 얻을 수 있는&quot; 도구 출력을 짧은
              플레이스홀더로 교체하여 토큰 비용을 절감합니다.
            </p>
            <p>
              예를 들어, <code className="text-cyan-600">file_read</code>로 500줄짜리 파일을 읽은 결과는
              나중에 다시 읽으면 동일한 내용을 얻을 수 있습니다. 이런 결과를
              <code className="text-cyan-600">[Observation masked &mdash; file_read output (1250 tokens). Re-read if needed.]</code>
              같은 한 줄로 대체하면 수천 토큰을 절약할 수 있습니다.
            </p>
            <p>
              반면 <code className="text-cyan-600">file_edit</code>이나 <code className="text-cyan-600">file_write</code>의
              결과는 변이(mutation) 기록이므로 절대 마스킹하지 않습니다. 파일을 어떻게 수정했는지는
              다시 실행해도 재현할 수 없기 때문입니다. 또한 최근 N개의 읽기 전용 출력은 LLM이
              직전 맥락을 이해하는 데 필요하므로 마스킹에서 보호합니다.
            </p>
          </div>

          <MermaidDiagram
            title="Observation Masking 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  AL["Agent Loop<br/><small>agent-loop.ts</small>"]
  OM["Observation Masking<br/><small>observation-masking.ts</small>"]
  CM["Context Manager<br/><small>context-manager.ts</small>"]
  LLM["LLM Client<br/><small>llm/client.ts</small>"]
  TC["Token Counter<br/><small>token-counter.ts</small>"]

  AL -->|"messages 전달"| OM
  OM -->|"마스킹된 messages"| AL
  AL --> LLM
  AL --> CM
  CM -->|"토큰 절약 협력"| OM
  OM -.->|"토큰 추정"| TC

  style OM fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style LLM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TC fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 도서관에서 책을 빌려 읽은 후, 메모장에 &quot;3번 서가에서 빌린 책 내용 (120페이지)&quot;
            라고만 적어두는 것과 같습니다. 필요하면 다시 도서관에 가서 같은 책을 빌리면 되니까요.
            하지만 책에 직접 메모를 썼다면(변이), 그 기록은 절대 지워서는 안 됩니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* isReadOnlyToolOutput */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            isReadOnlyToolOutput(message)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            주어진 메시지가 안전하게 마스킹할 수 있는 읽기 전용 도구 출력인지 판별합니다.
            <code className="text-cyan-600">role</code>이 <code className="text-cyan-600">&quot;tool&quot;</code>이고,
            알려진 읽기 전용 도구의 출력이며, 변이 패턴이 감지되지 않을 때만 <code className="text-cyan-600">true</code>를
            반환합니다.
          </p>
          <CodeBlock>
            <span className="kw">export</span> <span className="kw">function</span> <span className="fn">isReadOnlyToolOutput</span>(<span className="prop">message</span>: <span className="type">ChatMessage</span>): <span className="type">boolean</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "message", type: "ChatMessage", required: true, desc: "판별할 메시지 객체. role, name, content 필드를 분석합니다." },
            ]}
          />
          <div className="text-[13px] text-gray-600 mt-3 space-y-1">
            <p>&bull; <code className="text-emerald-600">true</code> &mdash; 마스킹 가능. file_read, grep_search, glob_search 또는 읽기 전용 bash_exec 출력</p>
            <p>&bull; <code className="text-red-600">false</code> &mdash; 마스킹 불가. role이 tool이 아니거나, 변이 도구이거나, 변이 bash 패턴이 감지된 경우</p>
          </div>

          {/* getOutputSize */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            getOutputSize(message)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            메시지 콘텐츠의 대략적인 토큰 수를 추정합니다.
            영어 기준 약 4글자 = 1토큰이라는 간단한 휴리스틱을 사용합니다.
          </p>
          <CodeBlock>
            <span className="kw">export</span> <span className="kw">function</span> <span className="fn">getOutputSize</span>(<span className="prop">message</span>: <span className="type">ChatMessage</span>): <span className="type">number</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "message", type: "ChatMessage", required: true, desc: "토큰 수를 추정할 메시지 객체" },
            ]}
          />
          <div className="text-[13px] text-gray-600 mt-3">
            <p>반환값: <code className="text-cyan-600">Math.ceil(content.length / 4)</code> &mdash; 콘텐츠 문자 수를 4로 나눈 올림 값</p>
          </div>

          {/* applyObservationMasking */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            applyObservationMasking(messages, options?)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            메시지 히스토리에 관측 마스킹을 적용합니다.
            재현 가능한 도구 출력을 짧은 플레이스홀더로 교체하여 토큰 사용량을 절약합니다.
            원본 배열은 절대 변경하지 않고 새 배열을 반환합니다 (불변성 보장).
          </p>
          <CodeBlock>
            <span className="kw">export</span> <span className="kw">function</span> <span className="fn">applyObservationMasking</span>(
            {"\n"}{"  "}<span className="prop">messages</span>: <span className="kw">readonly</span> <span className="type">ChatMessage</span>[],
            {"\n"}{"  "}<span className="prop">options</span>?: {"{"} <span className="kw">readonly</span> <span className="prop">keepRecentN</span>?: <span className="type">number</span> {"}"},
            {"\n"}): <span className="type">ChatMessage</span>[]
          </CodeBlock>
          <ParamTable
            params={[
              { name: "messages", type: "readonly ChatMessage[]", required: true, desc: "전체 메시지 히스토리. 원본은 변경되지 않습니다." },
              { name: "options.keepRecentN", type: "number", required: false, desc: "마스킹하지 않고 유지할 최근 읽기 전용 출력 수 (기본값: 3)" },
            ]}
          />

          {/* Internal helpers */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            내부 헬퍼 함수 (미export)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            다음 함수들은 모듈 내부에서만 사용되며 외부에 노출되지 않습니다.
          </p>
          <div className="bg-white border border-gray-200 rounded-xl p-5 text-[13px] text-gray-600 space-y-3">
            <p>
              <code className="text-cyan-600">createMaskedPlaceholder(originalSize, toolName)</code> &mdash;
              마스킹된 도구 출력을 대체할 플레이스홀더 문자열을 생성합니다.
            </p>
            <p>
              <code className="text-cyan-600">detectToolName(message)</code> &mdash;
              메시지의 <code>name</code> 필드 또는 콘텐츠 패턴으로부터 도구 이름을 추론합니다.
              알 수 없으면 <code>&quot;unknown&quot;</code>을 반환합니다.
            </p>
            <p>
              <code className="text-cyan-600">isBashReadOnly(content)</code> &mdash;
              bash 실행 결과가 읽기 전용 명령어의 출력인지 판별합니다.
              변이 패턴이 먼저 검사되어, 파일 삭제/이동 등은 절대 읽기 전용으로 판정하지 않습니다.
            </p>
          </div>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">applyObservationMasking</code>은 <strong>순수 함수</strong>입니다.
              원본 메시지 배열을 변경하지 않으며, 항상 새 배열을 반환합니다.
            </li>
            <li>
              <code className="text-cyan-600">bash_exec</code> 출력은 무조건 마스킹되지 않습니다.
              변이 패턴(rm, mv, git commit 등)이 감지되면 읽기 전용으로 판정하지 않습니다.
            </li>
            <li>
              토큰 추정은 <code className="text-cyan-600">chars / 4</code>라는 매우 단순한 휴리스틱입니다.
              한국어나 CJK 문자에서는 실제 토큰 수와 차이가 있을 수 있습니다.
            </li>
            <li>
              <code className="text-cyan-600">keepRecentN</code>의 기본값은 3이지만,
              실제 agent-loop에서는 5로 설정하여 호출합니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 에이전트 루프에서 마스킹 적용하기</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            가장 일반적인 사용 패턴입니다. LLM에 메시지를 보내기 직전에
            <code className="text-cyan-600">applyObservationMasking()</code>을 호출하여
            토큰 사용량을 줄입니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{"} <span className="fn">applyObservationMasking</span> {"}"} <span className="kw">from</span> <span className="str">&quot;./observation-masking.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// 에이전트 루프 내부"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">messages</span>: <span className="type">ChatMessage</span>[] = <span className="fn">getHistory</span>();
            {"\n"}
            {"\n"}<span className="cm">{"// LLM 호출 직전에 마스킹 적용 (최근 5개 보호)"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">masked</span> = <span className="fn">applyObservationMasking</span>(<span className="prop">messages</span>, {"{"}
            {"\n"}{"  "}<span className="prop">keepRecentN</span>: <span className="num">5</span>,
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 마스킹된 히스토리로 LLM 호출 → 토큰 절약!"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">response</span> = <span className="kw">await</span> <span className="fn">callLLM</span>(<span className="prop">masked</span>);
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>applyObservationMasking()</code>의 결과는 LLM 호출에만 사용하세요.
            마스킹된 메시지를 원본 히스토리에 다시 저장하면 도구 출력이 영구적으로 손실됩니다.
            원본 히스토리는 항상 마스킹 전 상태로 유지해야 합니다.
          </Callout>

          {/* 고급 사용법: 읽기 전용 판별 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 개별 메시지의 마스킹 가능 여부 확인
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">isReadOnlyToolOutput()</code>을 사용하면
            특정 메시지가 마스킹 가능한지 개별적으로 확인할 수 있습니다.
            디버깅이나 커스텀 마스킹 로직을 구현할 때 유용합니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{"} <span className="fn">isReadOnlyToolOutput</span>, <span className="fn">getOutputSize</span> {"}"} <span className="kw">from</span> <span className="str">&quot;./observation-masking.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="kw">for</span> (<span className="kw">const</span> <span className="prop">msg</span> <span className="kw">of</span> <span className="prop">messages</span>) {"{"}
            {"\n"}{"  "}<span className="kw">if</span> (<span className="fn">isReadOnlyToolOutput</span>(<span className="prop">msg</span>)) {"{"}
            {"\n"}{"    "}<span className="kw">const</span> <span className="prop">tokens</span> = <span className="fn">getOutputSize</span>(<span className="prop">msg</span>);
            {"\n"}{"    "}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">`마스킹 가능: ${"{"}</span><span className="prop">msg</span>.<span className="prop">name</span><span className="str">{"}"} (${"{"}</span><span className="prop">tokens</span><span className="str">{"}"} tokens)`</span>);
            {"\n"}{"  "}{"}"}
            {"\n"}{"}"}
          </CodeBlock>

          {/* 고급 사용법: keepRecentN 조정 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; keepRecentN 값 조정
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">keepRecentN</code>은 마스킹에서 보호할 최근 읽기 전용 출력의 개수입니다.
            값이 클수록 LLM이 더 많은 맥락을 유지하지만, 토큰 절약 효과는 줄어듭니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 토큰 절약 우선 — 최근 2개만 보호"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">aggressive</span> = <span className="fn">applyObservationMasking</span>(<span className="prop">messages</span>, {"{"} <span className="prop">keepRecentN</span>: <span className="num">2</span> {"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 맥락 유지 우선 — 최근 10개 보호"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">conservative</span> = <span className="fn">applyObservationMasking</span>(<span className="prop">messages</span>, {"{"} <span className="prop">keepRecentN</span>: <span className="num">10</span> {"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 기본값 사용 — 최근 3개 보호"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">defaultMasked</span> = <span className="fn">applyObservationMasking</span>(<span className="prop">messages</span>);
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> <code>keepRecentN</code>을 0으로 설정하면 모든 읽기 전용 출력이 마스킹됩니다.
            극도의 토큰 절약이 필요한 상황(컨텍스트 윈도우 거의 가득 참)에서 유용할 수 있지만,
            LLM이 직전 작업 맥락을 완전히 잃으므로 주의하세요.
          </Callout>

          <DeepDive title="마스킹 대상 vs 비대상 완전 정리">
            <div className="space-y-4">
              <div>
                <p className="font-bold text-emerald-600 mb-2">마스킹 대상 (다시 얻을 수 있는 것들)</p>
                <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                  <li><code className="text-cyan-600">file_read</code> &mdash; 파일 읽기 결과. 같은 파일을 다시 읽으면 동일한 내용</li>
                  <li><code className="text-cyan-600">grep_search</code> &mdash; 검색 결과. 같은 패턴으로 다시 검색 가능</li>
                  <li><code className="text-cyan-600">glob_search</code> &mdash; 파일 목록. 같은 패턴으로 다시 조회 가능</li>
                  <li><code className="text-cyan-600">bash_exec</code> (읽기 전용만) &mdash; cat, ls, find, head, tail, wc 등의 출력</li>
                </ul>
              </div>
              <div>
                <p className="font-bold text-red-600 mb-2">마스킹 비대상 (절대 마스킹하면 안 되는 것들)</p>
                <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                  <li><code className="text-cyan-600">file_edit</code> / <code className="text-cyan-600">file_write</code> &mdash; 변이 기록. 어떤 수정을 했는지 보존 필수</li>
                  <li>어시스턴트의 추론/응답 텍스트 &mdash; LLM이 생각한 내용은 재현 불가</li>
                  <li>사용자 메시지 &mdash; 사용자의 지시는 항상 보존</li>
                  <li>도구 호출 기록 &mdash; 무엇을 호출했는지(인자 포함)는 보존</li>
                  <li><code className="text-cyan-600">bash_exec</code> (변이 명령) &mdash; rm, mv, cp, git commit/push, npm install 등</li>
                </ul>
              </div>
            </div>
          </DeepDive>
        </section>
      </RevealOnScroll>

      {/* ─── 4. 내부 구현 (Internals) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>⚙️</span> 내부 구현
          </h2>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>마스킹 처리 흐름</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">applyObservationMasking()</code>이 호출되면
            다음과 같은 3단계 프로세스를 거칩니다.
          </p>

          <MermaidDiagram
            title="Observation Masking 처리 흐름"
            titleColor="purple"
            chart={`flowchart TD
  IN["입력: messages 배열<br/><small>전체 메시지 히스토리</small>"]
  S1["1단계: 읽기 전용 인덱스 수집<br/><small>isReadOnlyToolOutput() 호출</small>"]
  S2["2단계: 보호 대상 결정<br/><small>마지막 keepRecentN개 보호</small>"]
  S3["3단계: 마스킹 적용<br/><small>보호 안 된 읽기전용 → 플레이스홀더</small>"]
  OUT["출력: 마스킹된 새 배열<br/><small>토큰 절약된 결과</small>"]

  IN --> S1
  S1 --> S2
  S2 --> S3
  S3 --> OUT

  style S1 fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style S2 fill:#e0e7ff,stroke:#22c55e,color:#1e293b
  style S3 fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style IN fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style OUT fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석 &mdash; applyObservationMasking</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            메인 함수의 핵심 로직입니다. 3단계로 나뉘며, 각 단계가 명확하게 분리되어 있습니다.
          </p>
          <CodeBlock>
            <span className="kw">export function</span> <span className="fn">applyObservationMasking</span>(
            {"\n"}{"  "}<span className="prop">messages</span>: <span className="kw">readonly</span> <span className="type">ChatMessage</span>[],
            {"\n"}{"  "}<span className="prop">options</span>?: {"{"} <span className="kw">readonly</span> <span className="prop">keepRecentN</span>?: <span className="type">number</span> {"}"},
            {"\n"}): <span className="type">ChatMessage</span>[] {"{"}
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">keepRecentN</span> = <span className="prop">options</span>?.<span className="prop">keepRecentN</span> ?? <span className="num">3</span>;
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [1] 읽기 전용 도구 출력의 인덱스를 모두 수집"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">readOnlyIndices</span>: <span className="type">number</span>[] = [];
            {"\n"}{"  "}<span className="kw">for</span> (<span className="kw">let</span> <span className="prop">i</span> = <span className="num">0</span>; <span className="prop">i</span> {"<"} <span className="prop">messages</span>.<span className="prop">length</span>; <span className="prop">i</span>++) {"{"}
            {"\n"}{"    "}<span className="kw">if</span> (<span className="fn">isReadOnlyToolOutput</span>(<span className="prop">messages</span>[<span className="prop">i</span>])) {"{"}
            {"\n"}{"      "}<span className="prop">readOnlyIndices</span>.<span className="fn">push</span>(<span className="prop">i</span>);
            {"\n"}{"    "}{"}"}
            {"\n"}{"  "}{"}"}
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [2] 마지막 keepRecentN개는 마스킹에서 보호"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">protectedIndices</span> = <span className="kw">new</span> <span className="type">Set</span>(
            {"\n"}{"    "}<span className="prop">readOnlyIndices</span>.<span className="fn">slice</span>(-<span className="prop">keepRecentN</span>)
            {"\n"}{"  "});
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [3] 보호되지 않은 읽기 전용 출력 → 플레이스홀더로 교체"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">result</span>: <span className="type">ChatMessage</span>[] = [];
            {"\n"}{"  "}<span className="kw">for</span> (<span className="kw">let</span> <span className="prop">i</span> = <span className="num">0</span>; <span className="prop">i</span> {"<"} <span className="prop">messages</span>.<span className="prop">length</span>; <span className="prop">i</span>++) {"{"}
            {"\n"}{"    "}<span className="kw">if</span> (<span className="prop">readOnlyIndices</span>.<span className="fn">includes</span>(<span className="prop">i</span>) && !<span className="prop">protectedIndices</span>.<span className="fn">has</span>(<span className="prop">i</span>)) {"{"}
            {"\n"}{"      "}<span className="kw">const</span> <span className="prop">toolName</span> = <span className="fn">detectToolName</span>(<span className="prop">msg</span>);
            {"\n"}{"      "}<span className="kw">const</span> <span className="prop">size</span> = <span className="fn">getOutputSize</span>(<span className="prop">msg</span>);
            {"\n"}{"      "}<span className="prop">result</span>.<span className="fn">push</span>({"{"} ...<span className="prop">msg</span>, <span className="prop">content</span>: <span className="fn">createMaskedPlaceholder</span>(<span className="prop">size</span>, <span className="prop">toolName</span>) {"}"});
            {"\n"}{"    "}<span className="kw">{"}"} else {"{"}</span>
            {"\n"}{"      "}<span className="prop">result</span>.<span className="fn">push</span>({"{"} ...<span className="prop">msg</span> {"}"});
            {"\n"}{"    "}{"}"}
            {"\n"}{"  "}{"}"}
            {"\n"}{"  "}<span className="kw">return</span> <span className="prop">result</span>;
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> 전체 메시지 배열을 순회하며 <code className="text-cyan-600">isReadOnlyToolOutput()</code>으로 읽기 전용 도구 출력의 인덱스를 수집합니다.</p>
            <p><strong className="text-gray-900">[2]</strong> <code className="text-cyan-600">slice(-keepRecentN)</code>으로 마지막 N개의 읽기 전용 인덱스를 Set에 담아 보호 대상으로 지정합니다. LLM이 직전 작업 맥락을 유지하려면 최근 출력이 필요하기 때문입니다.</p>
            <p><strong className="text-gray-900">[3]</strong> 보호 대상이 아닌 읽기 전용 출력은 <code className="text-cyan-600">createMaskedPlaceholder()</code>로 교체합니다. 모든 메시지는 <code className="text-cyan-600">{"{ ...msg }"}</code>로 복사되어 원본 불변성이 보장됩니다.</p>
          </div>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>bash_exec 읽기 전용 판별 로직</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">bash_exec</code>는 읽기 전용일 수도 있고 변이일 수도 있어서,
            콘텐츠 내용을 추가로 검사합니다. <strong>변이 패턴이 우선</strong>으로 검사되어
            안전성을 보장합니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">isBashReadOnly</span>(<span className="prop">content</span>: <span className="type">string</span>): <span className="type">boolean</span> {"{"}
            {"\n"}{"  "}<span className="cm">{"// 변이 패턴이 감지되면 → 절대 읽기 전용 아님"}</span>
            {"\n"}{"  "}<span className="kw">for</span> (<span className="kw">const</span> <span className="prop">pattern</span> <span className="kw">of</span> <span className="prop">MUTATION_BASH_PATTERNS</span>) {"{"}
            {"\n"}{"    "}<span className="kw">if</span> (<span className="prop">pattern</span>.<span className="fn">test</span>(<span className="prop">content</span>)) <span className="kw">return</span> <span className="num">false</span>;
            {"\n"}{"  "}{"}"}
            {"\n"}{"  "}<span className="cm">{"// 읽기 전용 패턴이 감지되면 → 마스킹 가능"}</span>
            {"\n"}{"  "}<span className="kw">for</span> (<span className="kw">const</span> <span className="prop">pattern</span> <span className="kw">of</span> <span className="prop">READ_ONLY_BASH_PATTERNS</span>) {"{"}
            {"\n"}{"    "}<span className="kw">if</span> (<span className="prop">pattern</span>.<span className="fn">test</span>(<span className="prop">content</span>)) <span className="kw">return</span> <span className="num">true</span>;
            {"\n"}{"  "}{"}"}
            {"\n"}{"  "}<span className="cm">{"// STDOUT:으로 시작 → 기본적으로 읽기 전용"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">content</span>.<span className="fn">startsWith</span>(<span className="str">&quot;STDOUT:&quot;</span>)) <span className="kw">return</span> <span className="num">true</span>;
            {"\n"}{"  "}<span className="kw">return</span> <span className="num">false</span>;
            {"\n"}{"}"}
          </CodeBlock>

          <DeepDive title="변이 패턴 전체 목록 (13개)">
            <p className="mb-3">
              다음 정규식 중 하나라도 매칭되면 해당 bash 출력은 변이로 판정되어 마스킹하지 않습니다.
              안전한 쪽으로 보수적으로 판단합니다.
            </p>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-[13px] text-gray-600 space-y-1.5">
              <p><code className="text-red-600">/^STDERR:/</code> &mdash; 에러 출력 (문제가 발생한 기록)</p>
              <p><code className="text-red-600">/^Error:/</code> &mdash; 에러 메시지</p>
              <p><code className="text-red-600">/\brm\s/</code> &mdash; 파일 삭제</p>
              <p><code className="text-red-600">/\bmv\s/</code> &mdash; 파일 이동/이름 변경</p>
              <p><code className="text-red-600">/\bcp\s/</code> &mdash; 파일 복사</p>
              <p><code className="text-red-600">/\bmkdir\s/</code> &mdash; 디렉토리 생성</p>
              <p><code className="text-red-600">/\bchmod\s/</code> &mdash; 권한 변경</p>
              <p><code className="text-red-600">/\bchown\s/</code> &mdash; 소유자 변경</p>
              <p><code className="text-red-600">/\bnpm\s+(install|run|exec)/</code> &mdash; npm 패키지 설치/실행</p>
              <p><code className="text-red-600">/\bgit\s+(commit|push|merge|rebase|reset|checkout)/</code> &mdash; git 변이 명령</p>
              <p><code className="text-red-600">/\bpip\s+install/</code> &mdash; Python 패키지 설치</p>
            </div>
            <p className="mt-3 text-amber-600">
              <strong>주의:</strong> <code>STDERR:</code>와 <code>Error:</code>도 변이 패턴에 포함되어 있습니다.
              에러 메시지는 디버깅에 필수적이므로 마스킹하지 않습니다.
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

          {/* FAQ 1 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;마스킹 후에도 토큰 사용량이 줄지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              몇 가지 가능성을 확인하세요:
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <strong>읽기 전용 출력이 적은 경우:</strong> 히스토리에 <code className="text-cyan-600">file_edit</code>이나
                <code className="text-cyan-600">file_write</code> 결과가 대부분이면 마스킹 대상이 거의 없습니다.
                이런 경우는 정상적인 동작입니다.
              </li>
              <li>
                <strong>keepRecentN이 너무 큰 경우:</strong> 보호 대상이 많으면 실제로 마스킹되는 메시지가 적습니다.
                값을 줄여보세요.
              </li>
              <li>
                <strong>마스킹 결과를 LLM에 전달하지 않은 경우:</strong> <code className="text-cyan-600">applyObservationMasking()</code>의
                반환값을 LLM 호출에 사용하고 있는지 확인하세요.
              </li>
            </ul>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;bash_exec 출력이 마스킹되어야 하는데 안 돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              <code className="text-cyan-600">bash_exec</code>는 다른 도구와 달리 콘텐츠를 추가로 검사합니다.
              변이 패턴(rm, mv, git commit 등)이 출력 텍스트 어디에든 포함되어 있으면
              읽기 전용으로 판정하지 않습니다.
            </p>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              예를 들어, <code className="text-cyan-600">ls -la</code>의 결과에 <code className="text-cyan-600">rm</code>이라는
              파일 이름이 포함되어 있으면 변이로 오판될 수 있습니다. 이는 안전 우선 설계의 결과입니다.
            </p>
            <Callout type="tip" icon="*">
              <code>isReadOnlyToolOutput()</code>으로 개별 메시지를 테스트해보면
              해당 메시지가 왜 마스킹 대상이 아닌지 확인할 수 있습니다.
            </Callout>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;LLM이 마스킹된 내용을 필요로 해서 다시 도구를 호출해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              이것은 <strong>정상적이고 의도된 동작</strong>입니다. 플레이스홀더에
              &quot;Re-read from environment if needed&quot;라고 안내하고 있으며,
              LLM은 필요하면 <code className="text-cyan-600">file_read</code> 등을 다시 호출하여
              최신 내용을 가져옵니다. 이 재호출 비용이 마스킹으로 절약한 토큰보다 적기 때문에
              전체적으로는 이득입니다.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;원본 히스토리가 손상됐어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              <code className="text-cyan-600">applyObservationMasking()</code>은 순수 함수로,
              입력 배열을 절대 수정하지 않습니다. 만약 원본 히스토리가 마스킹된 상태라면,
              반환된 마스킹 결과를 원본 히스토리에 다시 저장하는 버그가 있을 가능성이 높습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// ❌ 잘못된 사용 — 원본에 마스킹 결과를 다시 저장"}</span>
              {"\n"}<span className="prop">history</span> = <span className="fn">applyObservationMasking</span>(<span className="prop">history</span>);
              {"\n"}
              {"\n"}<span className="cm">{"// ✅ 올바른 사용 — 별도 변수에 저장하여 LLM 호출에만 사용"}</span>
              {"\n"}<span className="kw">const</span> <span className="prop">masked</span> = <span className="fn">applyObservationMasking</span>(<span className="prop">history</span>);
              {"\n"}<span className="kw">await</span> <span className="fn">callLLM</span>(<span className="prop">masked</span>);
            </CodeBlock>
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
                name: "agent-loop.ts",
                slug: "agent-loop",
                relation: "parent",
                desc: "applyObservationMasking(messages, { keepRecentN: 5 })을 호출하여 LLM 호출 전에 토큰을 절약하는 메인 루프",
              },
              {
                name: "context-manager.ts",
                slug: "context-manager",
                relation: "sibling",
                desc: "3-Layer 컴팩션으로 토큰을 관리하는 모듈. 관측 마스킹과 함께 토큰 절약을 담당",
              },
              {
                name: "token-counter.ts",
                slug: "token-counter",
                relation: "child",
                desc: "정밀한 토큰 수 계산 모듈. observation-masking의 chars/4 추정보다 정확한 토큰 카운팅 제공",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
