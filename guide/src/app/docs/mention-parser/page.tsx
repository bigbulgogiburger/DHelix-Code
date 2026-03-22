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

export default function MentionParserPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/mentions/parser.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">Mention Parser</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              사용자 입력에서 <code className="text-cyan-600">@file</code>,{" "}
              <code className="text-cyan-600">@url</code>,{" "}
              <code className="text-cyan-600">@mcp</code> 멘션을 추출하는 파서 모듈입니다.
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
                <code className="text-cyan-600">parseMentions()</code>는 사용자가 입력한 텍스트에서
                <code className="text-cyan-600">@</code>로 시작하는 참조(멘션)를 정규식으로 파싱하여
                파일, URL, MCP 리소스를 식별합니다.
              </p>
              <p>
                파싱은 <strong>3단계 우선순위</strong>로 수행됩니다: URL 멘션을 가장 먼저 매칭하여
                파일 패턴과의 오탐(false match)을 방지하고, MCP 멘션, 파일 멘션 순으로 처리합니다.
                이미 파싱된 멘션과 위치가 겹치는 후순위 멘션은 자동으로 필터링됩니다.
              </p>
              <p>
                <code className="text-cyan-600">stripMentions()</code>는 파싱 결과를 활용하여
                텍스트에서 멘션 문법을 제거하고 참조 값만 남기는 유틸리티 함수입니다.
              </p>
            </div>

            <MermaidDiagram
              title="Mention Parser 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  INPUT["사용자 입력<br/><small>@file:src/index.ts @https://...</small>"]
  PARSER["parseMentions()<br/><small>mentions/parser.ts</small>"]
  RESOLVER["resolveMentions()<br/><small>mentions/resolver.ts</small>"]
  RESOURCE["MCPResourceResolver<br/><small>mentions/resource-resolver.ts</small>"]
  CONTEXT["buildMentionContext()<br/><small>LLM 컨텍스트 주입</small>"]

  INPUT -->|"텍스트"| PARSER
  PARSER -->|"ParsedMention[]"| RESOLVER
  PARSER -->|"ResourceMention[]"| RESOURCE
  RESOLVER -->|"ResolvedMention[]"| CONTEXT

  style PARSER fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style INPUT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style RESOLVER fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style RESOURCE fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style CONTEXT fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 이메일에서 @를 사용해 사람을 태그하는 것처럼, dbcode에서는 @를
              사용해 파일, URL, MCP 리소스를 태그합니다. 이 파서는 그 태그를 인식하고 구조화된
              데이터로 변환하는 역할입니다.
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

            {/* MentionType */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              type MentionType
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              멘션의 세 가지 타입을 나타내는 유니온 타입입니다.
            </p>
            <CodeBlock>
              <span className="kw">type</span> <span className="type">MentionType</span> ={" "}
              <span className="str">&quot;file&quot;</span> |{" "}
              <span className="str">&quot;url&quot;</span> |{" "}
              <span className="str">&quot;mcp&quot;</span>;
            </CodeBlock>
            <div className="text-[13px] text-gray-600 mt-2 space-y-1">
              <p>
                &bull; <code className="text-cyan-600">&quot;file&quot;</code> &mdash; 로컬 파일
                참조 (<code>@file:src/index.ts</code> 또는 <code>@src/index.ts</code>)
              </p>
              <p>
                &bull; <code className="text-cyan-600">&quot;url&quot;</code> &mdash; 웹 URL 참조 (
                <code>@https://example.com</code> 또는 <code>@url:https://...</code>)
              </p>
              <p>
                &bull; <code className="text-cyan-600">&quot;mcp&quot;</code> &mdash; MCP 리소스
                참조 (<code>@postgres:sql://users/schema</code>)
              </p>
            </div>

            {/* ParsedMention interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface ParsedMention
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              파싱된 멘션 하나를 나타내는 불변(readonly) 인터페이스입니다. 원본 텍스트에서의 위치
              정보(start, end)를 포함합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "type",
                  type: "MentionType",
                  required: true,
                  desc: "멘션 타입 (file, url, mcp)",
                },
                {
                  name: "raw",
                  type: "string",
                  required: true,
                  desc: '원본 텍스트 (예: "@file:src/index.ts")',
                },
                {
                  name: "value",
                  type: "string",
                  required: true,
                  desc: "참조 값 — 경로, URL, 또는 MCP 리소스 URI",
                },
                {
                  name: "server",
                  type: "string | undefined",
                  required: false,
                  desc: "MCP 멘션의 서버 이름 (MCP 타입에서만 사용)",
                },
                {
                  name: "start",
                  type: "number",
                  required: true,
                  desc: "원본 문자열에서의 시작 인덱스",
                },
                {
                  name: "end",
                  type: "number",
                  required: true,
                  desc: "원본 문자열에서의 끝 인덱스",
                },
              ]}
            />

            {/* parseMentions function */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              parseMentions(text)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              사용자 입력 텍스트에서 @멘션을 3단계 우선순위로 파싱합니다. 중복 멘션(같은 raw
              텍스트)은 첫 번째만 포함하며, 결과는 위치(start) 순으로 정렬됩니다.
            </p>
            <CodeBlock>
              <span className="fn">parseMentions</span>(<span className="prop">text</span>:{" "}
              <span className="type">string</span>): <span className="kw">readonly</span>{" "}
              <span className="type">ParsedMention</span>[]
            </CodeBlock>
            <ParamTable
              params={[
                { name: "text", type: "string", required: true, desc: "파싱할 입력 텍스트" },
                {
                  name: "(반환)",
                  type: "readonly ParsedMention[]",
                  required: true,
                  desc: "파싱된 멘션 배열 (위치순 정렬)",
                },
              ]}
            />

            {/* stripMentions function */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              stripMentions(text)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              텍스트에서 멘션 구문을 제거하고 참조 값만 남깁니다. 예를 들어{" "}
              <code className="text-cyan-600">&quot;@file:src/index.ts&quot;</code>는{" "}
              <code className="text-cyan-600">&quot;src/index.ts&quot;</code>로 변환됩니다.
            </p>
            <CodeBlock>
              <span className="fn">stripMentions</span>(<span className="prop">text</span>:{" "}
              <span className="type">string</span>): <span className="type">string</span>
            </CodeBlock>
            <ParamTable
              params={[
                { name: "text", type: "string", required: true, desc: "멘션이 포함된 텍스트" },
                {
                  name: "(반환)",
                  type: "string",
                  required: true,
                  desc: "멘션이 값으로 대체된 텍스트",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                URL 멘션이 <strong>가장 먼저</strong> 파싱됩니다.
                <code className="text-cyan-600">@https://example.com</code>은 파일 멘션이 아닌 URL
                멘션으로 인식됩니다.
              </li>
              <li>
                MCP 멘션에서 <code className="text-cyan-600">http://</code>와{" "}
                <code className="text-cyan-600">https://</code> 프로토콜은 명시적으로 제외됩니다.
                URL과 MCP가 충돌하지 않도록 설계되어 있습니다.
              </li>
              <li>
                <code className="text-cyan-600">stripMentions()</code>는 역순(reverse)으로 대체하여
                문자열 인덱스가 밀리지 않도록 처리합니다.
              </li>
              <li>
                정규식 기반이므로 코드 블록이나 인용문 내부의 @도 멘션으로 인식될 수 있습니다.
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
              기본 사용법 &mdash; 멘션 파싱하기
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              사용자 입력에서 멘션을 추출하는 가장 일반적인 패턴입니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{ "}
              <span className="fn">parseMentions</span>
              {" }"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./mentions/parser.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="kw">const</span> <span className="prop">text</span> ={" "}
              <span className="str">
                &quot;@file:src/index.ts와 @https://docs.com을 참조하세요&quot;
              </span>
              ;{"\n"}
              <span className="kw">const</span> <span className="prop">mentions</span> ={" "}
              <span className="fn">parseMentions</span>(<span className="prop">text</span>);
              {"\n"}
              {"\n"}
              <span className="cm">
                {
                  '// mentions[0]: { type: "file", value: "src/index.ts", raw: "@file:src/index.ts" }'
                }
              </span>
              {"\n"}
              <span className="cm">
                {
                  '// mentions[1]: { type: "url",  value: "https://docs.com", raw: "@https://docs.com" }'
                }
              </span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 정규식 패턴은 공백(<code>,</code> <code>)</code>{" "}
              <code>{"}"}</code> <code>]</code>)을 멘션 종료 구분자로 사용합니다. 파일 경로에 공백이
              포함되면 올바르게 파싱되지 않습니다.
            </Callout>

            {/* MCP 멘션 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; MCP 리소스 멘션
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              MCP 멘션은 <code className="text-cyan-600">@서버이름:프로토콜://경로</code>{" "}
              형식입니다. 서버 이름과 리소스 URI가 분리되어{" "}
              <code className="text-cyan-600">server</code> 필드에 저장됩니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">mentions</span> ={" "}
              <span className="fn">parseMentions</span>(
              <span className="str">&quot;@postgres:sql://users/schema를 보여줘&quot;</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// mentions[0]:"}</span>
              {"\n"}
              <span className="cm">{"// {"}</span>
              {"\n"}
              <span className="cm">{'//   type: "mcp",'}</span>
              {"\n"}
              <span className="cm">{'//   value: "sql://users/schema",'}</span>
              {"\n"}
              <span className="cm">{'//   server: "postgres",'}</span>
              {"\n"}
              <span className="cm">{'//   raw: "@postgres:sql://users/schema"'}</span>
              {"\n"}
              <span className="cm">{"// }"}</span>
            </CodeBlock>

            {/* stripMentions */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 멘션 제거 (stripMentions)
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              멘션 구문을 제거하고 값만 남겨 LLM에 전달할 깨끗한 텍스트를 만듭니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{ "}
              <span className="fn">stripMentions</span>
              {" }"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./mentions/parser.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="fn">stripMentions</span>(
              <span className="str">&quot;@file:src/index.ts를 수정해주세요&quot;</span>);
              {"\n"}
              <span className="cm">{'// result → "src/index.ts를 수정해주세요"'}</span>
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> <code>stripMentions()</code>는 내부적으로{" "}
              <code>parseMentions()</code>를 호출하므로 별도의 파싱 호출이 필요 없습니다. 멘션
              데이터가 필요하면
              <code>parseMentions()</code>를, 깨끗한 텍스트만 필요하면 <code>stripMentions()</code>
              를 사용하세요.
            </Callout>
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
              3단계 파싱 파이프라인
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              오탐을 방지하기 위해 URL → MCP → 파일 순서로 파싱하며, 이전 단계에서 매칭된 위치
              범위와 겹치는 멘션은 필터링합니다.
            </p>

            <MermaidDiagram
              title="3단계 파싱 우선순위"
              titleColor="purple"
              chart={`graph TD
  TEXT["입력 텍스트"] --> S1["1단계: URL 멘션 파싱<br/><small>@url:https://... 또는 @https://...</small>"]
  S1 --> S2["2단계: MCP 멘션 파싱<br/><small>@server:protocol://resource</small><br/><small>http/https 제외</small>"]
  S2 --> S3["3단계: 파일 멘션 파싱<br/><small>@file:path 또는 @path/file.ext</small><br/><small>URL/MCP와 겹치지 않는 것만</small>"]
  S3 --> DEDUP["중복 제거<br/><small>Set으로 raw 기준 필터</small>"]
  DEDUP --> SORT["위치순 정렬<br/><small>start 기준 오름차순</small>"]
  SORT --> RESULT["ParsedMention[]"]

  style S1 fill:#dbeafe,stroke:#3b82f6,color:#1e293b,stroke-width:2px
  style S2 fill:#e0e7ff,stroke:#6366f1,color:#1e293b,stroke-width:2px
  style S3 fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style DEDUP fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style SORT fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style TEXT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              정규식 패턴 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              세 가지 타입 각각에 대해 전용 정규식 패턴이 정의되어 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// URL 멘션: @url:https://... 또는 @https://..."}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">URL_MENTION_PATTERN</span> ={" "}
              <span className="str">/@(?:url:)?(https?:\/\/[^\s,){"}\\{"}]]+)/g</span>;{"\n"}
              {"\n"}
              <span className="cm">
                {"// MCP 멘션: @서버이름:프로토콜://리소스 (http/https 제외)"}
              </span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">MCP_MENTION_PATTERN</span> ={" "}
              <span className="str">/@(\w+):((?!https?:\/\/)\w+:\/\/[^\s,){"}\\{"}]]+)/g</span>;
              {"\n"}
              {"\n"}
              <span className="cm">
                {"// 파일 멘션: @file:경로/파일.확장자 또는 @경로/파일.확장자"}
              </span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">FILE_MENTION_PATTERN</span> ={" "}
              <span className="str">/@(?:file:)?(.?[/\\]?\w[^\s,){"}\\{"}]*\.\w+)/g</span>;
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">URL 패턴</strong> &mdash;{" "}
                <code className="text-cyan-600">url:</code> 접두사는 선택적이며, http:// 또는
                https://로 시작하는 URL을 캡처합니다.
              </p>
              <p>
                <strong className="text-gray-900">MCP 패턴</strong> &mdash; 부정 전방탐색(
                <code className="text-cyan-600">(?!https?://)</code>)으로 URL과의 충돌을 방지합니다.
                캡처 그룹 1은 서버 이름, 그룹 2는 리소스 URI입니다.
              </p>
              <p>
                <strong className="text-gray-900">파일 패턴</strong> &mdash;{" "}
                <code className="text-cyan-600">file:</code> 접두사는 선택적이며, 확장자가 있는 파일
                경로를 캡처합니다. 상대 경로(<code className="text-cyan-600">./</code>)도
                지원합니다.
              </p>
            </div>

            <DeepDive title="overlapsExisting() — 위치 겹침 방지 로직">
              <p className="mb-3">
                이전 단계에서 파싱된 멘션과 위치가 겹치는지 확인하는 헬퍼 함수입니다. MCP 파싱 시
                URL과, 파일 파싱 시 URL/MCP와의 겹침을 방지합니다.
              </p>
              <CodeBlock>
                <span className="kw">function</span> <span className="fn">overlapsExisting</span>(
                <span className="prop">start</span>: <span className="type">number</span>,{" "}
                <span className="prop">end</span>: <span className="type">number</span>,{" "}
                <span className="prop">existing</span>: <span className="kw">readonly</span>{" "}
                <span className="type">ParsedMention</span>[]):{" "}
                <span className="type">boolean</span> {"{"}
                {"\n"}
                {"  "}
                <span className="kw">return</span> <span className="prop">existing</span>.
                <span className="fn">some</span>({"\n"}
                {"    "}(<span className="prop">m</span>) {"=>"} (
                <span className="prop">start</span> {">="} <span className="prop">m</span>.
                <span className="prop">start</span> && <span className="prop">start</span> {"<"}{" "}
                <span className="prop">m</span>.<span className="prop">end</span>) ||
                {"\n"}
                {"           "}(<span className="prop">end</span> {">"}{" "}
                <span className="prop">m</span>.<span className="prop">start</span> &&{" "}
                <span className="prop">end</span> {"<="} <span className="prop">m</span>.
                <span className="prop">end</span>),
                {"\n"}
                {"  "});
                {"\n"}
                {"}"}
              </CodeBlock>
              <p className="mt-3 text-gray-600">
                시작/끝 인덱스가 기존 멘션 범위 내에 하나라도 포함되면{" "}
                <code className="text-cyan-600">true</code>를 반환합니다. 이 검사 덕분에{" "}
                <code>@https://example.com</code>이 URL로 먼저 파싱되면, 같은 위치의 파일 멘션
                시도는 자동으로 무시됩니다.
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
                &quot;URL이 파일 멘션으로 인식돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                URL 멘션은 가장 먼저 파싱되므로 정상적인 http/https URL이 파일로 인식되는 경우는
                드뭅니다. 혹시 <code className="text-cyan-600">ftp://</code>이나 커스텀 프로토콜을
                사용하고 있다면 MCP 멘션으로 인식될 수 있습니다. URL 패턴은{" "}
                <code className="text-cyan-600">https?://</code>만 지원합니다.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;파일 경로에 공백이 있으면 잘려요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                정규식 패턴은 공백(<code>\s</code>)을 멘션 종료 구분자로 사용합니다. 공백이 포함된
                경로는 <code className="text-cyan-600">@file:</code> 접두사를 사용하더라도 공백
                이전까지만 파싱됩니다. 이는 의도된 동작입니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;같은 파일이 두 번 멘션되는데 하나만 파싱돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                중복 멘션(같은 <code className="text-cyan-600">raw</code> 텍스트)은{" "}
                <code className="text-cyan-600">Set</code>으로 추적되어 첫 번째만 결과에 포함됩니다.
                이는 동일한 파일을 여러 번 로드하는 것을 방지하기 위한 의도된 동작입니다.
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
                  name: "resolver.ts",
                  slug: "mention-resolver",
                  relation: "sibling",
                  desc: "파싱된 멘션의 실제 콘텐츠를 병렬로 로드하는 리졸버",
                },
                {
                  name: "resource-resolver.ts",
                  slug: "resource-resolver",
                  relation: "sibling",
                  desc: "MCP 리소스 멘션의 해석과 자동완성을 담당하는 리졸버",
                },
                {
                  name: "system-prompt-builder.ts",
                  slug: "system-prompt-builder",
                  relation: "parent",
                  desc: "해석된 멘션 콘텐츠를 시스템 프롬프트에 주입하는 빌더",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
