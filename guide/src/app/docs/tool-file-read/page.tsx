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

export default function ToolFileReadPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/tools/definitions/file-read.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              file_read Tool
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            파일 읽기 도구 — 텍스트, 이미지, PDF, Jupyter Notebook 등 다양한 형식을 지원하는 범용 파일 읽기 도구입니다.
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
              <code className="text-cyan-600">file_read</code>는 에이전트가 파일 시스템의 파일을 읽을 때
              사용하는 핵심 도구입니다. 단순 텍스트 파일뿐 아니라 이미지(PNG, JPG, GIF, WebP, SVG),
              PDF, Jupyter Notebook(.ipynb)까지 지원하며, 파일 확장자를 기반으로 자동으로 형식을 판별합니다.
            </p>
            <p>
              텍스트 파일은 줄 번호를 붙여 반환하고, <code className="text-cyan-600">offset</code>과
              <code className="text-cyan-600"> limit</code>으로 부분 읽기가 가능합니다.
              기본 2000줄 이상은 자동으로 잘라내어 LLM 컨텍스트를 보호합니다.
            </p>
            <p>
              <code className="text-cyan-600">.env</code> 등 민감 파일은 시크릿 키 값을 자동으로 마스킹하여
              LLM에 API 키가 노출되는 것을 방지합니다. 권한 수준은
              <code className="text-emerald-600"> &quot;safe&quot;</code>로, 파일 시스템을 읽기만 하므로
              사용자 확인 없이 실행됩니다.
            </p>
          </div>

          <MermaidDiagram
            title="file_read 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  AGENT["Agent Loop<br/><small>agent-loop.ts</small>"]
  EXEC["Tool Executor<br/><small>tools/executor.ts</small>"]
  FR["file_read<br/><small>file-read.ts</small>"]
  IMG["handleImage<br/><small>Base64 인코딩</small>"]
  PDF["handlePdf<br/><small>텍스트 추출</small>"]
  NB["handleJupyter<br/><small>셀 포맷팅</small>"]
  TXT["텍스트 처리<br/><small>줄 번호 + 잘림</small>"]
  FS["Node.js fs<br/><small>readFile / stat</small>"]

  AGENT -->|"도구 호출"| EXEC
  EXEC -->|"file_read 디스패치"| FR
  FR -->|".png/.jpg/.gif/.webp/.svg"| IMG
  FR -->|".pdf"| PDF
  FR -->|".ipynb"| NB
  FR -->|"그 외 텍스트"| TXT
  IMG --> FS
  PDF --> FS
  NB --> FS
  TXT --> FS

  style FR fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AGENT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style EXEC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style IMG fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style PDF fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style NB fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style TXT fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style FS fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 도서관의 사서를 떠올리세요. 일반 책(텍스트)은 페이지 번호를 붙여 복사해주고,
            사진집(이미지)은 스캔해서 디지털로 변환하고, 학술 논문(PDF)은 텍스트를 추출해주며,
            실험 노트(Jupyter)는 코드와 결과를 깔끔하게 정리해서 전달합니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* paramSchema */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            매개변수 스키마 (paramSchema)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            Zod로 정의된 입력 매개변수입니다. 파일 경로는 필수이고, 나머지는 선택사항입니다.
          </p>
          <ParamTable
            params={[
              { name: "path", type: "string", required: true, desc: "읽을 파일의 절대 또는 상대 경로" },
              { name: "offset", type: "number", required: false, desc: "읽기 시작 줄 번호 (0-based). 대용량 파일의 특정 범위만 읽을 때 사용" },
              { name: "limit", type: "number", required: false, desc: "최대 읽기 줄 수. 기본값: 파일 전체 또는 2000줄 중 작은 값" },
              { name: "pages", type: "string", required: false, desc: 'PDF 페이지 범위 (예: "1-5", "3", "10-20"). PDF 파일 전용' },
            ]}
          />

          {/* ToolDefinition */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            fileReadTool (ToolDefinition)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            도구 레지스트리에 등록되는 도구 정의 객체입니다.
          </p>
          <ParamTable
            params={[
              { name: "name", type: '"file_read"', required: true, desc: "도구 이름 — 레지스트리에서 이 이름으로 호출됨" },
              { name: "permissionLevel", type: '"safe"', required: true, desc: "읽기 전용이므로 사용자 확인 없이 실행" },
              { name: "timeoutMs", type: "30_000", required: true, desc: "30초 타임아웃" },
            ]}
          />

          {/* 상수 */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            주요 상수
          </h3>
          <ParamTable
            params={[
              { name: "DEFAULT_LINE_LIMIT", type: "2000", required: true, desc: "기본 줄 수 제한. 이보다 많은 줄은 자동으로 잘림" },
              { name: "MAX_LINE_LENGTH", type: "2000", required: true, desc: "한 줄의 최대 길이. 미니파이된 파일 등에서 긴 줄 잘림" },
              { name: "MAX_PDF_PAGES_PER_REQUEST", type: "20", required: true, desc: "PDF 1회 요청 시 최대 페이지 수" },
              { name: "PDF_PAGES_REQUIRE_PARAM", type: "10", required: true, desc: "이 페이지 수 이상의 PDF는 pages 매개변수 필수" },
            ]}
          />

          {/* 내부 함수 */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            내부 함수
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            파일 형식별로 전용 핸들러 함수가 분리되어 있습니다.
          </p>
          <ParamTable
            params={[
              { name: "getFileType()", type: "(filePath) => FileType", required: true, desc: '확장자로 파일 형식 판별: "image" | "pdf" | "jupyter" | "text"' },
              { name: "handleImage()", type: "async (filePath) => ToolResult", required: true, desc: "이미지를 Base64 인코딩 + 헤더에서 크기(width/height) 파싱" },
              { name: "handlePdf()", type: "async (filePath, pages?) => ToolResult", required: true, desc: "PDF 텍스트 추출 (pdf-parse 동적 import). 페이지 범위 지정 가능" },
              { name: "handleJupyter()", type: "async (filePath) => ToolResult", required: true, desc: "노트북 셀별 코드/마크다운/출력을 포맷팅하여 반환" },
              { name: "maskSecrets()", type: "(content, fileName) => string", required: true, desc: ".env 파일의 KEY/SECRET/TOKEN 등의 값을 마스킹" },
              { name: "truncateLine()", type: "(line) => string", required: true, desc: "2000자 초과 줄을 잘라냄" },
            ]}
          />

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">offset</code>/<code className="text-cyan-600">limit</code> 없이
              2000줄을 초과하는 파일을 읽으면 자동으로 잘리고, 잘림 안내 메시지가 추가됩니다.
            </li>
            <li>
              10페이지 초과 PDF는 반드시 <code className="text-cyan-600">pages</code> 매개변수를 지정해야 합니다.
              미지정 시 에러를 반환합니다.
            </li>
            <li>
              이미지 크기 파싱은 PNG, JPEG, GIF, WebP만 지원합니다. SVG는 크기 정보 없이 Base64만 반환됩니다.
            </li>
            <li>
              <code className="text-cyan-600">.env</code>, <code className="text-cyan-600">.env.local</code>,
              <code className="text-cyan-600">.env.production</code>, <code className="text-cyan-600">.env.development</code>
              파일은 KEY/SECRET/TOKEN/PASSWORD/CREDENTIAL/AUTH 키의 값이 자동 마스킹됩니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 텍스트 파일 읽기</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            가장 기본적인 사용 패턴입니다. 파일 경로만 지정하면 줄 번호와 함께 내용이 반환됩니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 텍스트 파일 전체 읽기"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">result</span> = <span className="kw">await</span> <span className="fn">execute</span>({"{"} <span className="prop">path</span>: <span className="str">&quot;src/index.ts&quot;</span> {"}"}, <span className="prop">context</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// 반환 형식:"}</span>
            {"\n"}<span className="cm">{"//      1 | import { App } from './app.js';"}</span>
            {"\n"}<span className="cm">{"//      2 | import { logger } from './utils/logger.js';"}</span>
            {"\n"}<span className="cm">{"//      3 |"}</span>
            {"\n"}<span className="cm">{"//      4 | const app = new App();"}</span>
          </CodeBlock>

          {/* 부분 읽기 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>부분 읽기 &mdash; offset / limit</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            대용량 파일에서 특정 범위만 읽을 때 <code className="text-cyan-600">offset</code>과
            <code className="text-cyan-600"> limit</code>을 사용합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 100번째 줄부터 50줄만 읽기"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">result</span> = <span className="kw">await</span> <span className="fn">execute</span>({"{"}
            {"\n"}{"  "}<span className="prop">path</span>: <span className="str">&quot;src/large-file.ts&quot;</span>,
            {"\n"}{"  "}<span className="prop">offset</span>: <span className="num">100</span>,
            {"\n"}{"  "}<span className="prop">limit</span>: <span className="num">50</span>,
            {"\n"}{"}"}, <span className="prop">context</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// metadata.totalLines로 전체 줄 수 확인 가능"}</span>
            {"\n"}<span className="cm">{"// metadata.readFrom / readTo로 읽은 범위 확인"}</span>
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>offset</code>은 0-based입니다. 즉 <code>offset: 0</code>이 파일의 첫 번째 줄입니다.
            표시되는 줄 번호는 1-based이므로 혼동하지 마세요.
          </Callout>

          {/* PDF 읽기 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; PDF 파일 읽기
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            PDF 파일은 <code className="text-cyan-600">pdf-parse</code> 라이브러리를 동적 import하여 텍스트를 추출합니다.
            10페이지 초과 시 <code className="text-cyan-600">pages</code> 매개변수가 필수입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// PDF 특정 페이지 범위 읽기"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">result</span> = <span className="kw">await</span> <span className="fn">execute</span>({"{"}
            {"\n"}{"  "}<span className="prop">path</span>: <span className="str">&quot;docs/spec.pdf&quot;</span>,
            {"\n"}{"  "}<span className="prop">pages</span>: <span className="str">&quot;1-5, 10&quot;</span>,
            {"\n"}{"}"}, <span className="prop">context</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// 반환 형식:"}</span>
            {"\n"}<span className="cm">{"// --- Page 1 ---"}</span>
            {"\n"}<span className="cm">{"// (페이지 1 텍스트)"}</span>
            {"\n"}<span className="cm">{"// --- Page 2 ---"}</span>
            {"\n"}<span className="cm">{"// (페이지 2 텍스트)"}</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> <code>pdf-parse</code>는 동적 import로 로드되므로, PDF를 읽지 않는 경우에는
            라이브러리가 로드되지 않아 시작 시간에 영향을 주지 않습니다.
          </Callout>

          <DeepDive title="이미지 크기 파싱의 동작 원리">
            <p className="mb-3">
              이미지 파일의 가로/세로 크기는 외부 라이브러리 없이 바이너리 헤더에서 직접 파싱합니다.
              각 이미지 형식마다 전용 파서가 있습니다:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li><strong>PNG:</strong> 바이트 16-19(가로), 20-23(세로) &mdash; big-endian 32비트</li>
              <li><strong>JPEG:</strong> SOF0(0xFFC0) 또는 SOF2(0xFFC2) 마커를 스캔하여 크기 추출</li>
              <li><strong>GIF:</strong> 바이트 6-7(가로), 8-9(세로) &mdash; little-endian 16비트</li>
              <li><strong>WebP:</strong> VP8(손실) 또는 VP8L(무손실) 청크에서 비트 필드로 크기 추출</li>
            </ul>
            <p className="mt-3 text-amber-600">
              SVG는 벡터 형식이므로 바이너리 헤더에서 크기를 파싱할 수 없어, 크기 정보 없이 Base64만 반환됩니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>파일 형식 분기 흐름</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">execute()</code> 함수는 파일 확장자로 형식을 판별한 뒤,
            각 형식에 맞는 전용 핸들러로 분기합니다.
          </p>

          <MermaidDiagram
            title="file_read 실행 흐름"
            titleColor="purple"
            chart={`graph TD
  START(("execute()")) --> RESOLVE["resolvePath<br/><small>경로 해석</small>"]
  RESOLVE --> TYPE{"getFileType()"}
  TYPE -->|"image"| IMG["handleImage<br/><small>Base64 + 크기 파싱</small>"]
  TYPE -->|"pdf"| PDF["handlePdf<br/><small>텍스트 추출</small>"]
  TYPE -->|"jupyter"| NB["handleJupyter<br/><small>셀 포맷팅</small>"]
  TYPE -->|"text"| STAT["stat() 확인"]
  STAT -->|"size === 0"| EMPTY["빈 파일 반환"]
  STAT -->|"size > 0"| READ["readFile"]
  READ --> MASK{"민감 파일?"}
  MASK -->|"Yes"| MASKED["maskSecrets"]
  MASK -->|"No"| SLICE["slice + 줄 번호"]
  MASKED --> SLICE
  SLICE --> RESULT(("ToolResult"))

  style START fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style TYPE fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style MASK fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style IMG fill:#dcfce7,stroke:#10b981,color:#065f46
  style PDF fill:#dcfce7,stroke:#10b981,color:#065f46
  style NB fill:#dcfce7,stroke:#10b981,color:#065f46
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석 &mdash; 시크릿 마스킹</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">maskSecrets()</code> 함수는 민감 파일에서 시크릿 값을 마스킹합니다.
            활성 라인과 주석 라인 모두 처리합니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">maskSecrets</span>(<span className="prop">content</span>: <span className="type">string</span>, <span className="prop">fileName</span>: <span className="type">string</span>): <span className="type">string</span> {"{"}
            {"\n"}{"  "}<span className="cm">{"// [1] 민감 파일이 아니면 원본 그대로 반환"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (!<span className="prop">SENSITIVE_FILE_NAMES</span>.<span className="fn">has</span>(<span className="prop">fileName</span>)) <span className="kw">return</span> <span className="prop">content</span>;
            {"\n"}
            {"\n"}{"  "}<span className="kw">return</span> <span className="prop">content</span>.<span className="fn">split</span>(<span className="str">&quot;\n&quot;</span>).<span className="fn">map</span>((<span className="prop">line</span>) =&gt; {"{"}
            {"\n"}{"    "}<span className="cm">{"// [2] 활성 라인 매치: API_KEY=sk-abc..."}</span>
            {"\n"}{"    "}<span className="kw">const</span> <span className="prop">match</span> = <span className="prop">line</span>.<span className="fn">match</span>(<span className="prop">SECRET_KEY_PATTERN</span>);
            {"\n"}{"    "}<span className="kw">if</span> (<span className="prop">match</span>) <span className="kw">return</span> <span className="str">`${"{"}<span className="prop">key</span>{"}"}=${"{"}<span className="fn">maskValue</span>(<span className="prop">value</span>){"}"}`</span>;
            {"\n"}
            {"\n"}{"    "}<span className="cm">{"// [3] 주석 라인 매치: # API_KEY=sk-abc..."}</span>
            {"\n"}{"    "}<span className="kw">const</span> <span className="prop">commentMatch</span> = <span className="prop">line</span>.<span className="fn">match</span>(<span className="prop">COMMENT_SECRET_KEY_PATTERN</span>);
            {"\n"}{"    "}<span className="kw">if</span> (<span className="prop">commentMatch</span>) <span className="kw">return</span> <span className="str">`${"{"}<span className="prop">prefix</span>{"}"}${"{"}<span className="prop">key</span>{"}"}=${"{"}<span className="fn">maskValue</span>(<span className="prop">value</span>){"}"}`</span>;
            {"\n"}
            {"\n"}{"    "}<span className="kw">return</span> <span className="prop">line</span>;
            {"\n"}{"  "}{"}"}).<span className="fn">join</span>(<span className="str">&quot;\n&quot;</span>);
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> <code className="text-cyan-600">SENSITIVE_FILE_NAMES</code> Set에 파일명이 포함되어야만 마스킹이 동작합니다. (.env, .env.local, .env.production, .env.development)</p>
            <p><strong className="text-gray-900">[2]</strong> KEY, SECRET, TOKEN, PASSWORD, CREDENTIAL, AUTH 키워드가 포함된 키의 값을 마스킹합니다. 짧으면 전체 마스킹(***), 길면 앞 4자만 표시합니다.</p>
            <p><strong className="text-gray-900">[3]</strong> 주석 처리된 라인(# 으로 시작)도 동일하게 마스킹하여 비활성화된 키도 보호합니다.</p>
          </div>

          <DeepDive title="줄 번호 포맷팅과 잘림 처리">
            <p className="mb-3">
              텍스트 파일 출력 시 줄 번호를 <code className="text-cyan-600">padStart(6)</code>으로
              6자리로 맞추어 최대 999,999줄까지 깔끔하게 정렬합니다:
            </p>
            <CodeBlock>
              <span className="cm">{"// 출력 형식 예시"}</span>
              {"\n"}<span className="str">&quot;     1 | const x = 1;&quot;</span>
              {"\n"}<span className="str">&quot;     2 | const y = 2;&quot;</span>
              {"\n"}<span className="str">&quot;  1000 | // 1000번째 줄&quot;</span>
            </CodeBlock>
            <p className="mt-3 text-gray-600">
              한 줄이 2000자를 초과하면 <code className="text-cyan-600">truncateLine()</code>이 잘라내고
              <code className="text-amber-600"> &quot;... (truncated)&quot;</code> 표시를 추가합니다.
              미니파이된 JS/CSS 파일에서 한 줄이 수만 자인 경우에 유용합니다.
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
              &quot;파일을 읽었는데 뒷부분이 잘려있어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              기본 줄 수 제한이 2000줄이기 때문입니다. <code className="text-cyan-600">offset</code>과
              <code className="text-cyan-600"> limit</code>을 사용하여 이어서 읽으세요.
            </p>
            <CodeBlock>
              <span className="cm">{"// 2000줄 이후 읽기"}</span>
              {"\n"}<span className="fn">execute</span>({"{"} <span className="prop">path</span>: <span className="str">&quot;file.ts&quot;</span>, <span className="prop">offset</span>: <span className="num">2000</span>, <span className="prop">limit</span>: <span className="num">2000</span> {"}"}, <span className="prop">ctx</span>);
            </CodeBlock>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;PDF 파일을 읽으려 했는데 에러가 나요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              10페이지를 초과하는 PDF는 <code className="text-cyan-600">pages</code> 매개변수를 반드시
              지정해야 합니다. 1회 요청 최대 20페이지까지 가능합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 올바른 사용법"}</span>
              {"\n"}<span className="fn">execute</span>({"{"} <span className="prop">path</span>: <span className="str">&quot;big.pdf&quot;</span>, <span className="prop">pages</span>: <span className="str">&quot;1-10&quot;</span> {"}"}, <span className="prop">ctx</span>);
            </CodeBlock>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;.env 파일의 API 키가 마스킹되어 있어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              의도된 동작입니다. <code className="text-cyan-600">.env</code> 파일의 KEY, SECRET, TOKEN,
              PASSWORD 등이 포함된 키의 값은 LLM에 API 키가 노출되는 것을 방지하기 위해
              자동으로 마스킹됩니다. 마스킹은 표시용(<code className="text-cyan-600">displayOutput</code>)에만
              적용되고, LLM에 전달되는 <code className="text-cyan-600">output</code>은 원본입니다.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;이미지 크기가 표시되지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              SVG 파일은 벡터 형식이라 바이너리 헤더에서 크기를 파싱할 수 없습니다.
              PNG, JPEG, GIF, WebP만 크기 정보가 포함됩니다.
              파일이 손상되었거나 헤더가 비표준인 경우에도 크기가 표시되지 않을 수 있습니다.
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
                name: "file-edit.ts",
                slug: "tool-file-edit",
                relation: "sibling",
                desc: "파일 수정 도구 — file_read로 내용을 확인한 후 file_edit로 수정하는 워크플로우",
              },
              {
                name: "tool-registry.ts",
                slug: "tool-registry",
                relation: "parent",
                desc: "도구 레지스트리 — fileReadTool을 등록하고 에이전트에 노출하는 모듈",
              },
              {
                name: "secret-scanner.ts",
                slug: "secret-scanner",
                relation: "sibling",
                desc: "시크릿 스캐너 — file_read의 마스킹보다 광범위한 시크릿 탐지 모듈",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
