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

export default function ToneProfilesPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/core/tone-profiles.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">ToneProfiles</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="core" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              응답 톤 프로필(normal, concise, verbose 등) 정의 및 관리 모듈입니다.
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
                <code className="text-cyan-600">ToneProfiles</code>는 AI 어시스턴트의 응답
                스타일(톤)을 정의하고 관리하는 모듈입니다. 같은 코딩 작업이라도 &quot;전문가
                스타일&quot;, &quot;친구 스타일&quot;, &quot;귀여운 스타일&quot; 등 다양한 어조로
                응답할 수 있으며, 사용자가 선호하는 톤을 선택할 수 있습니다.
              </p>
              <p>
                6가지 프로필이 미리 정의되어 있습니다:
                <code className="text-cyan-600">normal</code>(전문적),
                <code className="text-cyan-600">cute</code>(친근한),
                <code className="text-cyan-600">senior</code>(시니어 개발자),
                <code className="text-cyan-600">friend</code>(친구 반말),
                <code className="text-cyan-600">mentor</code>(교육적),
                <code className="text-cyan-600">minimal</code>(최소 출력). 각 프로필은 시스템
                프롬프트에 삽입되는 <code className="text-cyan-600">systemPromptSection</code>을
                포함하여 LLM의 응답 스타일을 제어합니다.
              </p>
              <p>
                <code className="text-cyan-600">getToneProfile(tone)</code> 함수로 ID 기반 조회가
                가능하며, 알 수 없는 ID가 전달되면 안전하게{" "}
                <code className="text-cyan-600">&quot;normal&quot;</code>을 기본값으로 반환합니다.
              </p>
            </div>

            <MermaidDiagram
              title="ToneProfiles 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  USER["사용자 설정<br/><small>/tone 명령 또는 config</small>"]
  TP["ToneProfiles<br/><small>tone-profiles.ts</small>"]
  SPB["System Prompt Builder<br/><small>system-prompt.ts</small>"]
  LLM["LLM Client<br/><small>llm/client.ts</small>"]
  RESP["AI 응답<br/><small>톤에 맞는 스타일</small>"]

  USER -->|"톤 ID 전달"| TP
  TP -->|"getToneProfile()"| SPB
  SPB -->|"systemPromptSection 삽입"| LLM
  LLM -->|"톤에 맞춘 응답 생성"| RESP

  style TP fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style USER fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style SPB fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style LLM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style RESP fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 라디오 채널을 돌리는 것과 같습니다. 같은 뉴스(코딩 결과)를
              전달하더라도 채널(톤 프로필)에 따라 아나운서 스타일(전문적), DJ 스타일(친근), 친구끼리
              대화(반말) 등 다른 방식으로 전달됩니다. 채널 번호(톤 ID)만 바꾸면 즉시 전환됩니다.
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

            {/* ToneProfile interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface ToneProfile
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              톤 프로필 정의 인터페이스입니다. 각 프로필은 ID, 이름, 설명, 시스템 프롬프트 섹션을
              포함합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "id",
                  type: "string",
                  required: true,
                  desc: '프로필 고유 식별자 (예: "normal", "cute", "senior")',
                },
                {
                  name: "name",
                  type: "string",
                  required: true,
                  desc: '영문 표시 이름 (예: "Professional")',
                },
                {
                  name: "nameKo",
                  type: "string",
                  required: true,
                  desc: '한국어 표시 이름 (예: "일반")',
                },
                {
                  name: "description",
                  type: "string",
                  required: true,
                  desc: "이 톤의 간단한 설명",
                },
                {
                  name: "systemPromptSection",
                  type: "string",
                  required: true,
                  desc: "시스템 프롬프트에 삽입될 마크다운 형식의 스타일 지시문",
                },
              ]}
            />

            {/* TONE_PROFILES 상수 */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              TONE_PROFILES
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              사용 가능한 6가지 톤 프로필을 담은 Record 객체입니다.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-[12px] text-gray-600 border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-3 text-gray-900 font-bold">ID</th>
                    <th className="text-left py-2 pr-3 text-gray-900 font-bold">이름</th>
                    <th className="text-left py-2 pr-3 text-gray-900 font-bold">한국어</th>
                    <th className="text-left py-2 pr-3 text-gray-900 font-bold">특징</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3">
                      <code className="text-cyan-600">normal</code>
                    </td>
                    <td className="py-2 pr-3">Professional</td>
                    <td className="py-2 pr-3">일반</td>
                    <td className="py-2 pr-3">명확하고 전문적인 기본 스타일</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3">
                      <code className="text-pink-600">cute</code>
                    </td>
                    <td className="py-2 pr-3">Cute</td>
                    <td className="py-2 pr-3">귀여운</td>
                    <td className="py-2 pr-3">따뜻하고 친근, ~요체, 이모지 허용</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3">
                      <code className="text-emerald-600">senior</code>
                    </td>
                    <td className="py-2 pr-3">Senior Developer</td>
                    <td className="py-2 pr-3">시니어 개발자</td>
                    <td className="py-2 pr-3">간결, 기술 전문용어, 코드 위주</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3">
                      <code className="text-amber-600">friend</code>
                    </td>
                    <td className="py-2 pr-3">Friend</td>
                    <td className="py-2 pr-3">친구</td>
                    <td className="py-2 pr-3">캐주얼 반말, 직설적, 의견 자유</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3">
                      <code className="text-purple-600">mentor</code>
                    </td>
                    <td className="py-2 pr-3">Mentor</td>
                    <td className="py-2 pr-3">스승님</td>
                    <td className="py-2 pr-3">교육적, 단계별 설명, 질문 유도</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3">
                      <code className="text-gray-500">minimal</code>
                    </td>
                    <td className="py-2 pr-3">Minimal</td>
                    <td className="py-2 pr-3">미니멀</td>
                    <td className="py-2 pr-3">최소 출력, 코드만, 설명 없음</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* getToneProfile function */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              getToneProfile(tone)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              ID로 톤 프로필을 가져옵니다. 알 수 없는 ID가 전달되면
              <code className="text-cyan-600">&quot;normal&quot;</code> 프로필을 기본값으로
              반환합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">getToneProfile</span>(
              <span className="prop">tone</span>: <span className="type">string</span>):{" "}
              <span className="type">ToneProfile</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "tone",
                  type: "string",
                  required: true,
                  desc: '톤 프로필 ID (예: "normal", "cute", "senior")',
                },
                {
                  name: "(반환)",
                  type: "ToneProfile",
                  required: true,
                  desc: "해당 톤 프로필 객체 (없으면 normal 반환)",
                },
              ]}
            />

            <CodeBlock>
              <span className="cm">{"// 내부 구현"}</span>
              {"\n"}
              <span className="kw">return</span> <span className="prop">TONE_PROFILES</span>[
              <span className="prop">tone</span>] ?? <span className="prop">TONE_PROFILES</span>.
              <span className="prop">normal</span>;
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                알 수 없는 톤 ID는 <strong>에러를 발생시키지 않고</strong>
                <code className="text-cyan-600">&quot;normal&quot;</code>을 반환합니다. 잘못된
                설정이 있어도 앱이 크래시하지 않도록 설계되었습니다.
              </li>
              <li>
                <code className="text-cyan-600">TONE_PROFILES</code>는{" "}
                <code>Readonly&lt;Record&gt;</code>로, 런타임에 프로필을 추가/수정할 수 없습니다.
              </li>
              <li>
                <code className="text-cyan-600">systemPromptSection</code>은 마크다운 형식의
                문자열입니다. 시스템 프롬프트 빌더가 이 섹션을 최종 프롬프트에 그대로 삽입합니다.
              </li>
              <li>
                톤 프로필은 LLM에게 &quot;지시&quot;만 할 뿐, LLM이 반드시 따른다고 보장하지는
                않습니다. 특히 <code className="text-cyan-600">minimal</code> 톤에서도 LLM이 추가
                설명을 할 수 있습니다.
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
              기본 사용법 &mdash; 시스템 프롬프트에 톤 적용
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              사용자 설정에서 톤 ID를 읽고, 해당 프로필의{" "}
              <code className="text-cyan-600">systemPromptSection</code>을 시스템 프롬프트에
              삽입합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 1. 사용자 설정에서 톤 가져오기"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">toneId</span> ={" "}
              <span className="prop">config</span>.<span className="prop">tone</span> ??{" "}
              <span className="str">&quot;normal&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 2. 톤 프로필 조회"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">profile</span> ={" "}
              <span className="fn">getToneProfile</span>(<span className="prop">toneId</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 3. 시스템 프롬프트에 톤 섹션 추가"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">systemPrompt</span> ={" "}
              <span className="str">`${"{"}</span>
              <span className="prop">basePrompt</span>
              <span className="str">{"}"}</span>
              {"\n"}
              {"\n"}
              <span className="str">{`\${profile.systemPromptSection}`}</span>
              <span className="str">`</span>;{"\n"}
              {"\n"}
              <span className="fn">logger</span>.<span className="fn">info</span>(
              <span className="str">{"`톤: ${profile.nameKo} (${profile.id})`"}</span>);
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 톤 프로필을 변경하면 시스템 프롬프트가 달라지므로,
              <code>SystemPromptCache</code>를 무효화해야 합니다. 캐시를 무효화하지 않으면 이전 톤의
              프롬프트가 계속 사용됩니다.
            </Callout>

            {/* /tone 명령 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; /tone 명령으로 런타임 변경
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              사용자는 <code className="text-cyan-600">/tone</code> 슬래시 명령으로 대화 도중에도
              톤을 변경할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// /tone cute 명령 처리"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">newProfile</span> ={" "}
              <span className="fn">getToneProfile</span>(
              <span className="str">&quot;cute&quot;</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 시스템 프롬프트 캐시 무효화"}</span>
              {"\n"}
              <span className="prop">promptCache</span>.<span className="fn">invalidate</span>();
              {"\n"}
              {"\n"}
              <span className="cm">{"// 다음 LLM 호출부터 새 톤 적용"}</span>
              {"\n"}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="str">{"`톤이 ${newProfile.nameKo}(으)로 변경되었습니다`"}</span>);
            </CodeBlock>

            {/* 톤별 응답 예시 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              톤별 응답 비교 예시
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              같은 질문에 대한 각 톤의 예상 응답 스타일을 비교합니다.
            </p>

            <div className="space-y-3">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-[12px] font-bold text-cyan-600 mb-1">normal (전문적)</p>
                <p className="text-[13px] text-gray-600">
                  &quot;해당 파일의 타입 에러는 제네릭 매개변수가 누락되어 발생합니다. 다음과 같이
                  수정하세요.&quot;
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-[12px] font-bold text-pink-600 mb-1">cute (귀여운)</p>
                <p className="text-[13px] text-gray-600">
                  &quot;아, 이 부분에 제네릭 타입이 빠져있었네요~ 이렇게 추가하면 해결될
                  거예요!&quot;
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-[12px] font-bold text-emerald-600 mb-1">senior (시니어)</p>
                <p className="text-[13px] text-gray-600">
                  &quot;Generic param missing. Add <code>&lt;T&gt;</code> to the call.&quot;
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-[12px] font-bold text-gray-500 mb-1">minimal (미니멀)</p>
                <p className="text-[13px] text-gray-600">
                  <code>fn&lt;T&gt;(arg)</code>
                </p>
              </div>
            </div>

            <DeepDive title="systemPromptSection이 LLM에게 미치는 영향">
              <p className="mb-3">
                각 프로필의 <code className="text-cyan-600">systemPromptSection</code>은
                <code>## Response Style</code> 마크다운 헤딩으로 시작하는 지시문입니다. LLM은 이
                지시문을 읽고 응답 스타일을 조절합니다:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <strong>normal:</strong> &quot;Respond professionally and clearly&quot;
                </li>
                <li>
                  <strong>cute:</strong> &quot;Use warm, friendly tone with ~요체&quot; + 이모지
                  허용
                </li>
                <li>
                  <strong>senior:</strong> &quot;Be extremely concise - code over explanation&quot;
                </li>
                <li>
                  <strong>friend:</strong> &quot;Use casual, informal language (반말 in
                  Korean)&quot;
                </li>
                <li>
                  <strong>mentor:</strong> &quot;Explain concepts step by step, ask guiding
                  questions&quot;
                </li>
                <li>
                  <strong>minimal:</strong> &quot;Maximum brevity - one-liners when possible, code
                  only&quot;
                </li>
              </ul>
              <p className="mt-3 text-amber-600">
                톤 지시문은 LLM의 &quot;성격&quot;을 정의하는 소프트 제약입니다. LLM이 반드시
                따르지는 않지만, 대부분의 경우 응답 스타일이 눈에 띄게 달라집니다. 특히{" "}
                <code>minimal</code>과 <code>mentor</code>는 출력 길이에 큰 차이를 만듭니다.
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
              톤 적용 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              사용자 설정에서 LLM 응답까지 톤이 적용되는 전체 흐름입니다.
            </p>

            <MermaidDiagram
              title="톤 프로필 적용 흐름"
              titleColor="purple"
              chart={`graph TD
  CFG["사용자 설정<br/><small>config.tone = 'cute'</small>"]
  GET["getToneProfile('cute')<br/><small>TONE_PROFILES 조회</small>"]
  FOUND{"프로필 존재?"}
  PROFILE["ToneProfile<br/><small>id, name, systemPromptSection</small>"]
  DEFAULT["기본값: normal<br/><small>nullish coalescing</small>"]
  SPB["System Prompt Builder<br/><small>systemPromptSection 삽입</small>"]
  LLM["LLM 호출<br/><small>톤이 적용된 시스템 프롬프트</small>"]

  CFG --> GET
  GET --> FOUND
  FOUND -->|"Yes"| PROFILE
  FOUND -->|"No"| DEFAULT
  PROFILE --> SPB
  DEFAULT --> SPB
  SPB --> LLM

  style GET fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style PROFILE fill:#dcfce7,stroke:#10b981,color:#065f46
  style DEFAULT fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style LLM fill:#e0e7ff,stroke:#3b82f6,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              전체 모듈은 놀라울 정도로 간결합니다.
              <code className="text-cyan-600">TONE_PROFILES</code> 객체 리터럴과
              <code className="text-cyan-600">getToneProfile()</code> 함수 하나가 전부입니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// TONE_PROFILES: Record<string, ToneProfile>"}</span>
              {"\n"}
              <span className="kw">export const</span> <span className="prop">TONE_PROFILES</span> ={" "}
              {"{"}
              {"\n"}
              {"  "}
              <span className="prop">normal</span>: {"{"} <span className="prop">id</span>:{" "}
              <span className="str">&quot;normal&quot;</span>, <span className="prop">name</span>:{" "}
              <span className="str">&quot;Professional&quot;</span>, ... {"}"},{"\n"}
              {"  "}
              <span className="prop">cute</span>: {"{"} <span className="prop">id</span>:{" "}
              <span className="str">&quot;cute&quot;</span>, <span className="prop">name</span>:{" "}
              <span className="str">&quot;Cute&quot;</span>, ... {"}"},{"\n"}
              {"  "}
              <span className="prop">senior</span>: {"{"} <span className="prop">id</span>:{" "}
              <span className="str">&quot;senior&quot;</span>, <span className="prop">name</span>:{" "}
              <span className="str">&quot;Senior Developer&quot;</span>, ... {"}"},{"\n"}
              {"  "}
              <span className="cm">{"// ... friend, mentor, minimal"}</span>
              {"\n"}
              {"}"};{"\n"}
              {"\n"}
              <span className="cm">{"// 안전한 조회: 없으면 normal 반환"}</span>
              {"\n"}
              <span className="kw">export function</span> <span className="fn">getToneProfile</span>
              (<span className="prop">tone</span>: <span className="type">string</span>):{" "}
              <span className="type">ToneProfile</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">return</span> <span className="prop">TONE_PROFILES</span>[
              <span className="prop">tone</span>] ?? <span className="prop">TONE_PROFILES</span>.
              <span className="prop">normal</span>;{"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">Readonly Record:</strong>{" "}
                <code className="text-cyan-600">
                  Readonly&lt;Record&lt;string, ToneProfile&gt;&gt;
                </code>
                로 선언되어 런타임 수정이 불가합니다. 프로필 추가는 소스 코드 수정이 필요합니다.
              </p>
              <p>
                <strong className="text-gray-900">Nullish Coalescing (??):</strong>{" "}
                <code>TONE_PROFILES[tone]</code>이 <code>undefined</code>이면{" "}
                <code>TONE_PROFILES.normal</code>을 반환합니다. <code>||</code> 대신 <code>??</code>
                를 사용하여 빈 문자열 등 falsy 값도 올바르게 처리합니다.
              </p>
              <p>
                <strong className="text-gray-900">순수 데이터 모듈:</strong> 클래스나 상태 없이,
                상수 객체 + 순수 함수만으로 구성됩니다. 사이드 이펙트가 없으므로 테스트가
                간단합니다.
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
                &quot;톤을 변경했는데 응답 스타일이 바뀌지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                두 가지 가능성을 확인하세요:
              </p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  <strong>캐시 문제:</strong> 시스템 프롬프트 캐시가 무효화되지 않으면 이전 톤의
                  프롬프트가 계속 사용됩니다. 톤 변경 시{" "}
                  <code className="text-cyan-600">SystemPromptCache.invalidate()</code>를
                  호출하세요.
                </li>
                <li>
                  <strong>LLM 한계:</strong> 톤 프로필은 소프트 제약이므로, LLM이 반드시 따르지는
                  않습니다. 특히 기술적 설명이 필요한 상황에서{" "}
                  <code className="text-cyan-600">minimal</code> 톤이 무시될 수 있습니다.
                </li>
              </ul>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;커스텀 톤 프로필을 추가하고 싶어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                현재 <code className="text-cyan-600">TONE_PROFILES</code>는 소스 코드에 하드코딩되어
                있으므로,
                <code className="text-cyan-600">tone-profiles.ts</code> 파일을 직접 수정하여 새
                프로필을 추가해야 합니다. <code className="text-cyan-600">systemPromptSection</code>
                에 원하는 스타일 지시문을 마크다운 형식으로 작성하면 됩니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;알 수 없는 톤 ID를 전달했는데 에러가 없어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                의도된 동작입니다. <code className="text-cyan-600">getToneProfile()</code>은 알 수
                없는 ID에 대해 에러를 발생시키지 않고, 안전하게
                <code className="text-cyan-600">&quot;normal&quot;</code> 프로필을 반환합니다.
                사용자가 설정 파일에 잘못된 톤 ID를 입력해도 앱이 크래시하지 않도록 설계되었습니다.
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
                  name: "system-prompt-cache.ts",
                  slug: "system-prompt-cache",
                  relation: "sibling",
                  desc: "톤 변경 시 캐시 무효화가 필요 - SHA-256 기반 프롬프트 캐싱",
                },
                {
                  name: "config-loader.ts",
                  slug: "config-loader",
                  relation: "sibling",
                  desc: "사용자 설정에서 tone 값을 로드하는 5-layer 설정 병합 모듈",
                },
                {
                  name: "adaptive-context.ts",
                  slug: "adaptive-context",
                  relation: "sibling",
                  desc: "톤과 함께 컨텍스트 전략도 시스템 프롬프트 구성에 영향을 미침",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
