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

export default function CmdCopyPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/commands/copy.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              /copy 출력 복사
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="leaf" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            대화 중 어시스턴트가 생성한 코드 블록을 시스템 클립보드에 복사하는 슬래시 명령어입니다.
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
              <code className="text-cyan-600">/copy</code> 명령어는 LLM이 생성한 코드를 바로 에디터에
              붙여넣고 싶을 때 유용합니다. 어시스턴트 메시지에서 마크다운 코드 블록
              (<code className="text-cyan-600">```</code>으로 감싼 부분)을 자동으로 추출하여
              시스템 클립보드에 복사합니다.
            </p>
            <p>
              기본적으로 마지막 코드 블록을 복사하며, 번호를 지정하면 특정 코드 블록을 선택할 수 있습니다.
              내부적으로 플랫폼을 감지하여 macOS는 <code className="text-cyan-600">pbcopy</code>,
              Linux는 <code className="text-cyan-600">xclip</code>,
              Windows는 <code className="text-cyan-600">clip</code>을 사용합니다.
            </p>
            <p>
              두 개의 내부 헬퍼 함수가 핵심 로직을 담당합니다:
              <code className="text-cyan-600">extractCodeBlocks()</code>는 정규식으로 코드 블록을 추출하고,
              <code className="text-cyan-600">copyToClipboard()</code>는 플랫폼별 클립보드 명령어를 실행합니다.
            </p>
          </div>

          <MermaidDiagram
            title="/copy 실행 흐름"
            titleColor="purple"
            chart={`graph TD
  USER["사용자 입력<br/><small>/copy [번호]</small>"]
  CMD["copyCommand.execute()<br/><small>commands/copy.ts</small>"]
  MSGS["context.messages 순회<br/><small>assistant 메시지만 필터</small>"]
  EXTRACT["extractCodeBlocks()<br/><small>정규식으로 코드 블록 추출</small>"]
  SELECT["블록 선택<br/><small>번호 지정 or 마지막</small>"]
  CLIP["copyToClipboard()<br/><small>플랫폼별 명령어 실행</small>"]
  OUT["성공 메시지<br/><small>블록 번호 + 언어 + 크기</small>"]

  USER --> CMD
  CMD --> MSGS
  MSGS --> EXTRACT
  EXTRACT --> SELECT
  SELECT --> CLIP
  CLIP --> OUT

  style CMD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style EXTRACT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CLIP fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style MSGS fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style SELECT fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style OUT fill:#dcfce7,stroke:#10b981,color:#065f46
  style USER fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 채팅 앱에서 메시지를 길게 눌러 &quot;복사&quot;하는 것처럼,
            <code>/copy</code>는 대화 속 코드 블록을 자동으로 찾아 클립보드에 넣어줍니다.
            번호를 지정하면 여러 코드 블록 중 원하는 것만 골라 복사할 수 있습니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* extractCodeBlocks */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            function extractCodeBlocks()
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            마크다운 텍스트에서 펜스드 코드 블록(<code className="text-cyan-600">```</code>으로 감싼 부분)을 추출합니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">extractCodeBlocks</span>(<span className="prop">text</span>: <span className="type">string</span>): <span className="kw">readonly</span> {"{"} <span className="prop">lang</span>: <span className="type">string</span>; <span className="prop">code</span>: <span className="type">string</span> {"}"}[]
          </CodeBlock>
          <ParamTable
            params={[
              { name: "text", type: "string", required: true, desc: "마크다운 텍스트 (어시스턴트 메시지 content)" },
            ]}
          />
          <div className="text-[13px] text-gray-600 mt-2 space-y-1">
            <p>&bull; <strong>반환값:</strong> <code className="text-cyan-600">{"{ lang, code }[]"}</code> &mdash; 언어명과 코드 내용의 배열</p>
            <p>&bull; 정규식: <code className="text-gray-500">/```(\w*)\n([\s\S]*?)```/g</code></p>
            <p>&bull; 언어 지정이 없으면 <code className="text-cyan-600">lang</code>은 빈 문자열</p>
          </div>

          {/* copyToClipboard */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            function copyToClipboard()
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            플랫폼에 맞는 명령어를 사용하여 텍스트를 시스템 클립보드에 복사합니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">copyToClipboard</span>(<span className="prop">text</span>: <span className="type">string</span>): <span className="type">Promise</span>&lt;<span className="type">void</span>&gt;
          </CodeBlock>
          <ParamTable
            params={[
              { name: "text", type: "string", required: true, desc: "클립보드에 복사할 텍스트" },
            ]}
          />
          <div className="text-[13px] text-gray-600 mt-2 space-y-1">
            <p>&bull; <strong>macOS:</strong> <code className="text-cyan-600">pbcopy</code></p>
            <p>&bull; <strong>Linux:</strong> <code className="text-cyan-600">xclip -selection clipboard</code></p>
            <p>&bull; <strong>Windows:</strong> <code className="text-cyan-600">clip</code></p>
          </div>

          {/* copyCommand */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            const copyCommand: SlashCommand
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            <code className="text-cyan-600">/copy</code> 슬래시 명령어의 등록 객체입니다.
          </p>
          <ParamTable
            params={[
              { name: "name", type: '"copy"', required: true, desc: "명령어 이름" },
              { name: "description", type: "string", required: true, desc: '"Copy last code block to clipboard"' },
              { name: "usage", type: "string", required: true, desc: '"/copy [block number]"' },
              { name: "execute", type: "(args, context) => Promise<CommandResult>", required: true, desc: "명령어 실행 함수" },
            ]}
          />

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              블록 번호는 <strong>1부터 시작</strong>합니다. <code className="text-cyan-600">/copy 1</code>은
              첫 번째 코드 블록, <code className="text-cyan-600">/copy 3</code>은 세 번째 코드 블록입니다.
            </li>
            <li>
              번호를 지정하지 않으면 <strong>마지막</strong> 코드 블록이 복사됩니다.
              가장 최근 어시스턴트 응답의 마지막 코드가 아니라, 대화 전체에서 가장 마지막 블록입니다.
            </li>
            <li>
              <code className="text-cyan-600">extractCodeBlocks()</code>는 <strong>어시스턴트 메시지만</strong> 탐색합니다.
              사용자 메시지의 코드 블록은 포함되지 않습니다.
            </li>
            <li>
              Linux에서 <code className="text-cyan-600">xclip</code>이 설치되지 않으면 클립보드 복사가 실패합니다.
              SSH 세션 등 GUI가 없는 환경에서는 동작하지 않을 수 있습니다.
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

          {/* 마지막 코드 블록 복사 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 마지막 코드 블록 복사</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            인자 없이 실행하면 대화의 마지막 코드 블록이 클립보드에 복사됩니다.
          </p>
          <CodeBlock>
            <span className="fn">/copy</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 출력: Copied code block #5 (typescript) to clipboard (342 chars)."}</span>
          </CodeBlock>

          {/* 특정 번호 복사 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>특정 코드 블록 복사</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            번호를 지정하여 원하는 코드 블록을 선택합니다.
          </p>
          <CodeBlock>
            <span className="fn">/copy</span> <span className="num">1</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 출력: Copied code block #1 (python) to clipboard (128 chars)."}</span>
            {"\n"}
            {"\n"}<span className="fn">/copy</span> <span className="num">3</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 출력: Copied code block #3 to clipboard (95 chars)."}</span>
            {"\n"}<span className="cm">{"// (언어 미지정 블록이면 언어 표시 없음)"}</span>
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> 존재하지 않는 번호를 지정하면 에러가 반환됩니다.
            예를 들어 코드 블록이 3개인데 <code>/copy 5</code>를 입력하면
            &quot;Block #5 not found. 3 code block(s) available.&quot;이 표시됩니다.
          </Callout>

          {/* 에러 케이스 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            에러 케이스
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            코드 블록이 없거나, 잘못된 인자를 입력한 경우의 처리입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 코드 블록이 없는 경우"}</span>
            {"\n"}<span className="fn">/copy</span>
            {"\n"}<span className="cm">{"// → No code blocks found in conversation."}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 숫자가 아닌 인자"}</span>
            {"\n"}<span className="fn">/copy</span> <span className="str">abc</span>
            {"\n"}<span className="cm">{"// → Usage: /copy [block number]"}</span>
          </CodeBlock>

          <DeepDive title="코드 블록 추출 정규식 상세">
            <p className="mb-3">
              사용되는 정규식: <code className="text-cyan-600">/```(\w*)\n([\s\S]*?)```/g</code>
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li><code>(\w*)</code> &mdash; 언어명 캡처 (선택적). <code>```typescript</code>에서 &quot;typescript&quot;를 추출</li>
              <li><code>\n</code> &mdash; 언어명 뒤의 줄바꿈 (코드 시작 전)</li>
              <li><code>([\s\S]*?)</code> &mdash; 코드 내용 캡처 (비탐욕적, 줄바꿈 포함)</li>
              <li><code>```</code> &mdash; 닫는 펜스</li>
              <li><code>g</code> 플래그 &mdash; 전역 검색 (모든 코드 블록 추출)</li>
            </ul>
            <p className="mt-3 text-amber-600">
              <strong>한계:</strong> 중첩된 코드 블록 (코드 블록 안에 ```)이나 들여쓴 코드 블록은
              올바르게 추출되지 않을 수 있습니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>플랫폼 감지 및 클립보드 명령어 선택</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">copyToClipboard()</code>는 플랫폼을 감지하여
            적절한 시스템 명령어를 선택합니다. 텍스트는 stdin으로 파이프됩니다.
          </p>

          <MermaidDiagram
            title="플랫폼별 클립보드 명령어 선택"
            titleColor="purple"
            chart={`graph TD
  START["copyToClipboard()"]
  DETECT["getPlatform()<br/><small>플랫폼 감지</small>"]

  START --> DETECT
  DETECT -->|"win32"| WIN["clip<br/><small>Windows 내장</small>"]
  DETECT -->|"darwin"| MAC["pbcopy<br/><small>macOS 내장</small>"]
  DETECT -->|"linux"| LIN["xclip -selection clipboard<br/><small>별도 설치 필요</small>"]

  WIN --> PIPE["exec(cmd)<br/><small>stdin.write(text)</small>"]
  MAC --> PIPE
  LIN --> PIPE
  PIPE --> DONE["resolve() or reject()"]

  style START fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style DETECT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style WIN fill:#dcfce7,stroke:#10b981,color:#065f46
  style MAC fill:#dcfce7,stroke:#10b981,color:#065f46
  style LIN fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style PIPE fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style DONE fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">execute()</code>의 블록 선택 및 복사 로직입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// [1] 모든 어시스턴트 메시지에서 코드 블록 수집"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">messages</span> = <span className="prop">context</span>.<span className="prop">messages</span> ?? [];
            {"\n"}<span className="kw">const</span> <span className="prop">allBlocks</span> = <span className="prop">messages</span>
            {"\n"}{"  "}.<span className="fn">filter</span>((<span className="prop">m</span>) {"=>"} <span className="prop">m</span>.<span className="prop">role</span> === <span className="str">&quot;assistant&quot;</span>)
            {"\n"}{"  "}.<span className="fn">flatMap</span>((<span className="prop">m</span>) {"=>"} <span className="fn">extractCodeBlocks</span>(<span className="prop">m</span>.<span className="prop">content</span>));
            {"\n"}
            {"\n"}<span className="cm">{"// [2] 블록 번호 결정: 지정하지 않으면 마지막"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">targetIdx</span> = <span className="prop">blockNum</span> !== <span className="kw">undefined</span>
            {"\n"}{"  "}? <span className="prop">blockNum</span> - <span className="num">1</span>      <span className="cm">{"// 1-based → 0-based 변환"}</span>
            {"\n"}{"  "}: <span className="prop">allBlocks</span>.<span className="prop">length</span> - <span className="num">1</span>;  <span className="cm">{"// 마지막 블록"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// [3] 범위 검증"}</span>
            {"\n"}<span className="kw">if</span> (<span className="prop">targetIdx</span> {"<"} <span className="num">0</span> || <span className="prop">targetIdx</span> {">="} <span className="prop">allBlocks</span>.<span className="prop">length</span>) {"{"}
            {"\n"}{"  "}<span className="kw">return</span> {"{"} <span className="prop">output</span>: <span className="str">`Block #${"{"}<span className="prop">blockNum</span>{"}"} not found...`</span>, ... {"}"};
            {"\n"}{"}"}
            {"\n"}
            {"\n"}<span className="cm">{"// [4] 클립보드에 복사"}</span>
            {"\n"}<span className="kw">await</span> <span className="fn">copyToClipboard</span>(<span className="prop">allBlocks</span>[<span className="prop">targetIdx</span>].<span className="prop">code</span>);
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> <code className="text-cyan-600">flatMap</code>으로 모든 어시스턴트 메시지의 코드 블록을 하나의 배열로 합칩니다. 순서는 메시지 순서를 따릅니다.</p>
            <p><strong className="text-gray-900">[2]</strong> 사용자가 번호를 지정하지 않으면 <code className="text-cyan-600">allBlocks.length - 1</code>로 마지막 블록을 선택합니다.</p>
            <p><strong className="text-gray-900">[3]</strong> 인덱스가 범위를 벗어나면 사용 가능한 블록 수를 안내하는 에러 메시지를 반환합니다.</p>
            <p><strong className="text-gray-900">[4]</strong> <code className="text-cyan-600">code</code> 필드만 복사합니다 (언어명이나 ``` 펜스는 제외).</p>
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
              &quot;Failed to copy to clipboard. Clipboard command not available.&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              플랫폼에 맞는 클립보드 명령어가 없거나 실행에 실패한 경우입니다.
              Linux에서는 <code className="text-cyan-600">xclip</code>이 설치되어 있는지 확인하세요
              (<code>sudo apt install xclip</code>). SSH 세션이나 Docker 컨테이너처럼
              GUI가 없는 환경에서는 클립보드가 작동하지 않습니다.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;No code blocks found in conversation.&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              어시스턴트가 코드 블록을 생성하지 않은 경우입니다.
              마크다운 코드 블록(<code className="text-cyan-600">```</code>으로 감싼 형태)만 인식됩니다.
              인라인 코드(<code className="text-cyan-600">`코드`</code>)는 추출 대상이 아닙니다.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;복사된 코드에 들여쓰기가 이상해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">extractCodeBlocks()</code>는 코드 블록의 내용을
              <code className="text-cyan-600">trimEnd()</code>만 적용합니다. 앞쪽 공백은 그대로 유지되므로,
              LLM이 생성한 들여쓰기가 그대로 복사됩니다. 붙여넣을 때 에디터의 자동 포맷팅을
              활용하세요.
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
                name: "utils/platform.ts",
                slug: "utils-platform",
                relation: "sibling",
                desc: "getPlatform() 함수를 제공하여 OS를 감지하는 유틸리티 모듈",
              },
              {
                name: "registry.ts",
                slug: "cmd-registry",
                relation: "parent",
                desc: "SlashCommand 인터페이스 정의 및 명령어 등록/실행을 관리하는 레지스트리",
              },
              {
                name: "/bug",
                slug: "cmd-bug",
                relation: "sibling",
                desc: "버그 리포트 생성 명령어 — /copy로 리포트를 복사할 수 있음",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
