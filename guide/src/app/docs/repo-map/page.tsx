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

export default function RepoMapPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/indexing/repo-map.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">RepoMap</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              코드베이스의 심볼(클래스, 함수, 인터페이스)과 import 관계를 경량 분석하여 AI에게
              프로젝트 전체 구조를 제공합니다.
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
                <code className="text-cyan-600">buildRepoMap()</code>은 프로젝트의 모든 소스 파일을
                스캔하여 심볼(클래스, 함수, 인터페이스, 타입, 상수, enum)과 import 관계를
                추출합니다. 이 정보를 LLM 컨텍스트에 주입하면, AI가 &quot;이 프로젝트에 어떤 모듈이
                있고, 어떤 함수가 export되는지&quot; 파악할 수 있습니다.
              </p>
              <p>
                <strong>정규식(regex) 기반</strong>의 경량 분석입니다. tree-sitter 같은 파서보다
                가볍고 빠르지만, 100% 정확하지는 않습니다. 그러나 컨텍스트 제공 목적으로는 충분한
                정확도를 가집니다.
              </p>
              <p>
                <code className="text-cyan-600">renderRepoMap()</code>은 분석 결과를 토큰 예산(기본
                4000토큰) 내에서 텍스트로 렌더링합니다. export된 심볼만 표시하여 간결한 요약을
                생성합니다.
              </p>
            </div>

            <MermaidDiagram
              title="RepoMap 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  ROOT["프로젝트 루트<br/><small>buildRepoMap(rootDir)</small>"]
  COLLECT["collectFiles()<br/><small>재귀 디렉토리 탐색</small><br/><small>SKIP_DIRS 제외</small>"]
  EXTRACT["extractSymbols()<br/><small>정규식 기반 심볼 추출</small>"]
  MAP["RepoMap<br/><small>files[], totalSymbols, totalFiles</small>"]
  RENDER["renderRepoMap()<br/><small>토큰 예산 내 텍스트 렌더링</small>"]
  PROMPT["System Prompt<br/><small>LLM 컨텍스트 주입</small>"]

  ROOT --> COLLECT
  COLLECT -->|"소스 파일 경로"| EXTRACT
  EXTRACT -->|"symbols[] + imports[]"| MAP
  MAP --> RENDER
  RENDER -->|"텍스트 요약"| PROMPT

  style MAP fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style ROOT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style COLLECT fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style EXTRACT fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style RENDER fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style PROMPT fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 도서관의 목록(카탈로그)을 떠올리세요. RepoMap은 모든 책(파일)의
              제목(심볼)과 참고문헌(import)을 정리한 카탈로그입니다. AI는 이 카탈로그를 보고
              &quot;어떤 파일에 어떤 기능이 있는지&quot;를 빠르게 파악할 수 있습니다.
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

            {/* RepoSymbol */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface RepoSymbol
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              소스 파일에서 추출된 심볼 하나를 나타냅니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "name",
                  type: "string",
                  required: true,
                  desc: '심볼 이름 (예: "UserService", "loadConfig")',
                },
                {
                  name: "kind",
                  type: "string",
                  required: true,
                  desc: "심볼 종류: class, function, interface, type, const, enum",
                },
                {
                  name: "file",
                  type: "string",
                  required: true,
                  desc: "정의된 파일 경로 (프로젝트 루트 기준 상대 경로)",
                },
                {
                  name: "line",
                  type: "number",
                  required: true,
                  desc: "정의된 줄 번호 (1부터 시작)",
                },
                {
                  name: "exported",
                  type: "boolean",
                  required: true,
                  desc: "export 키워드 존재 여부",
                },
              ]}
            />

            {/* RepoFileEntry */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface RepoFileEntry
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              레포 맵의 파일 항목 &mdash; 파일 하나의 심볼과 임포트 정보입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "path",
                  type: "string",
                  required: true,
                  desc: "파일 경로 (프로젝트 루트 기준 상대 경로)",
                },
                {
                  name: "symbols",
                  type: "readonly RepoSymbol[]",
                  required: true,
                  desc: "이 파일에서 추출된 심볼 목록",
                },
                {
                  name: "imports",
                  type: "readonly string[]",
                  required: true,
                  desc: "import하는 모듈 경로 목록",
                },
                { name: "size", type: "number", required: true, desc: "파일 크기 (바이트)" },
              ]}
            />

            {/* RepoMap */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface RepoMap
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              전체 레포지토리의 분석 결과입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "root",
                  type: "string",
                  required: true,
                  desc: "프로젝트 루트 디렉토리 절대 경로",
                },
                {
                  name: "files",
                  type: "readonly RepoFileEntry[]",
                  required: true,
                  desc: "분석된 모든 파일 항목",
                },
                {
                  name: "totalSymbols",
                  type: "number",
                  required: true,
                  desc: "전체 심볼 수 (모든 파일 합산)",
                },
                { name: "totalFiles", type: "number", required: true, desc: "분석된 전체 파일 수" },
              ]}
            />

            {/* buildRepoMap */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              buildRepoMap(rootDir)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              프로젝트 루트에서 레포지토리 맵을 빌드합니다. 모든 소스 파일을 스캔하여 심볼과
              임포트를 추출합니다.
            </p>
            <CodeBlock>
              <span className="kw">async function</span> <span className="fn">buildRepoMap</span>(
              <span className="prop">rootDir</span>: <span className="type">string</span>):{" "}
              <span className="type">Promise</span>&lt;<span className="type">RepoMap</span>&gt;
            </CodeBlock>

            {/* renderRepoMap */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              renderRepoMap(map, maxTokens?)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              레포 맵을 LLM 컨텍스트 주입용 텍스트로 렌더링합니다. export된 심볼만 표시하며, 토큰
              예산을 초과하지 않도록 자동으로 잘립니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">renderRepoMap</span>(
              <span className="prop">map</span>: <span className="type">RepoMap</span>,{" "}
              <span className="prop">maxTokens</span>?: <span className="type">number</span>):{" "}
              <span className="type">string</span>
            </CodeBlock>
            <ParamTable
              params={[
                { name: "map", type: "RepoMap", required: true, desc: "렌더링할 레포 맵" },
                {
                  name: "maxTokens",
                  type: "number | undefined",
                  required: false,
                  desc: "최대 토큰 예산 (기본: 4000, 약 16000자)",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <strong>정규식 기반</strong>이므로 복잡한 구문(중첩 제네릭, 멀티라인 선언 등)은 놓칠
                수 있습니다. 100% 정확한 분석이 필요하면 tree-sitter를 사용하세요.
              </li>
              <li>
                지원 확장자는 <code className="text-cyan-600">.ts</code>,{" "}
                <code className="text-cyan-600">.tsx</code>,
                <code className="text-cyan-600">.js</code>,{" "}
                <code className="text-cyan-600">.jsx</code>뿐입니다. Python, Go 등 다른 언어는
                분석되지 않습니다.
              </li>
              <li>
                <code className="text-cyan-600">node_modules</code>,{" "}
                <code className="text-cyan-600">.git</code>,
                <code className="text-cyan-600">dist</code>,{" "}
                <code className="text-cyan-600">build</code>,
                <code className="text-cyan-600">.next</code>,{" "}
                <code className="text-cyan-600">coverage</code>
                디렉토리는 자동으로 건너뜁니다.
              </li>
              <li>
                <code className="text-cyan-600">renderRepoMap()</code>은 export된 심볼만 표시합니다.
                내부 심볼은 외부에서 접근 불가하므로 AI 컨텍스트에서 제외됩니다.
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
              기본 사용법 &mdash; 레포 맵 빌드와 렌더링
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              프로젝트 루트에서 레포 맵을 빌드하고, 텍스트로 렌더링하여 LLM에 제공합니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{ "}
              <span className="fn">buildRepoMap</span>, <span className="fn">renderRepoMap</span>
              {" }"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./indexing/repo-map.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 레포 맵 빌드"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">map</span> ={" "}
              <span className="kw">await</span> <span className="fn">buildRepoMap</span>(
              <span className="str">&quot;/path/to/project&quot;</span>);
              {"\n"}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="str">
                `${"{"}map.totalFiles{"}"} files, ${"{"}map.totalSymbols{"}"} symbols`
              </span>
              );
              {"\n"}
              {"\n"}
              <span className="cm">{"// 텍스트로 렌더링 (기본 4000 토큰)"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">text</span> ={" "}
              <span className="fn">renderRepoMap</span>(<span className="prop">map</span>);
              {"\n"}
              <span className="cm">
                {
                  '// → "Repository Map (42 files, 156 symbols)\\n\\nsrc/config/loader.ts:\\n  function loadConfig (L69)\\n..."'
                }
              </span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 대규모 프로젝트에서는 <code>buildRepoMap()</code>이 수 초가
              걸릴 수 있습니다. 비동기(async)로 실행되므로 반드시 <code>await</code>를 사용하세요.
            </Callout>

            {/* 토큰 예산 조절 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 토큰 예산 커스터마이징
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              기본 토큰 예산은 4000(약 16000자)입니다. 컨텍스트 여유에 따라 늘리거나 줄일 수
              있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 적은 컨텍스트용: 2000 토큰"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">compact</span> ={" "}
              <span className="fn">renderRepoMap</span>(<span className="prop">map</span>,{" "}
              <span className="num">2000</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 넉넉한 컨텍스트용: 8000 토큰"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">detailed</span> ={" "}
              <span className="fn">renderRepoMap</span>(<span className="prop">map</span>,{" "}
              <span className="num">8000</span>);
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> 토큰 예산이 충분하면 더 많은 파일의 심볼이 포함됩니다. 파일은
              분석 순서(디렉토리 탐색 순)대로 표시되므로, 중요한 파일이 먼저 나오도록 디렉토리
              구조를 설계하는 것이 좋습니다.
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
              심볼 추출 파이프라인
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              각 파일을 줄 단위로 읽고, 6가지 정규식 패턴으로 심볼을 매칭합니다. 한 줄에서 첫 번째로
              매칭되는 패턴만 사용합니다.
            </p>

            <MermaidDiagram
              title="심볼 추출 흐름"
              titleColor="purple"
              chart={`graph TD
  FILE["소스 파일 읽기<br/><small>readFile(utf-8)</small>"]
  SPLIT["줄 분리<br/><small>content.split(\\n)</small>"]
  IMPORT{"import문?"}
  PATTERNS["패턴 매칭 순회<br/><small>class → function → interface<br/>→ type → const → enum</small>"]
  SYMBOL["RepoSymbol 생성<br/><small>name, kind, file, line, exported</small>"]
  NEXT["다음 줄"]

  FILE --> SPLIT
  SPLIT --> IMPORT
  IMPORT -->|"예"| NEXT
  IMPORT -->|"아니오"| PATTERNS
  PATTERNS -->|"매칭됨"| SYMBOL
  PATTERNS -->|"매칭 없음"| NEXT
  SYMBOL --> NEXT

  style PATTERNS fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style SYMBOL fill:#dcfce7,stroke:#10b981,color:#065f46
  style IMPORT fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style FILE fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style SPLIT fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style NEXT fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              정규식 패턴 목록
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              6가지 심볼 타입과 1가지 import를 매칭하는 정규식입니다. 모든 패턴은 줄의 시작(
              <code className="text-cyan-600">^</code>)에서 매칭됩니다.
            </p>
            <CodeBlock>
              <span className="prop">classDecl</span>:{" "}
              <span className="str">/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/</span>
              {"\n"}
              <span className="prop">functionDecl</span>:{" "}
              <span className="str">/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/</span>
              {"\n"}
              <span className="prop">interfaceDecl</span>:{" "}
              <span className="str">/^(?:export\s+)?interface\s+(\w+)/</span>
              {"\n"}
              <span className="prop">typeDecl</span>:{" "}
              <span className="str">/^(?:export\s+)?type\s+(\w+)\s*=/</span>
              {"\n"}
              <span className="prop">constDecl</span>:{" "}
              <span className="str">/^(?:export\s+)?const\s+(\w+)\s*[=:]/</span>
              {"\n"}
              <span className="prop">enumDecl</span>:{" "}
              <span className="str">/^(?:export\s+)?enum\s+(\w+)/</span>
              {"\n"}
              <span className="prop">importDecl</span>:{" "}
              <span className="str">
                /^import\s+.*from\s+[&apos;&quot;]([^&apos;&quot;]+)[&apos;&quot;]/
              </span>
            </CodeBlock>

            <DeepDive title="renderRepoMap()의 토큰 예산 관리">
              <p className="mb-3">
                렌더링 시 토큰 예산(기본 4000)을 문자 수로 변환합니다 (1 토큰 ≈ 4자). 파일을
                순회하면서 export된 심볼이 있는 파일만 출력하고, 문자 수가 예산을 초과하면 즉시
                중단합니다.
              </p>
              <CodeBlock>
                <span className="kw">const</span> <span className="prop">maxChars</span> ={" "}
                <span className="prop">maxTokens</span> * <span className="num">4</span>;{" "}
                <span className="cm">{"// 4000 → 16000자"}</span>
                {"\n"}
                {"\n"}
                <span className="kw">for</span> (<span className="kw">const</span>{" "}
                <span className="prop">file</span> <span className="kw">of</span>{" "}
                <span className="prop">map</span>.<span className="prop">files</span>) {"{"}
                {"\n"}
                {"  "}
                <span className="kw">const</span> <span className="prop">exported</span> ={" "}
                <span className="prop">file</span>.<span className="prop">symbols</span>.
                <span className="fn">filter</span>(<span className="prop">s</span> {"=>"}{" "}
                <span className="prop">s</span>.<span className="prop">exported</span>);
                {"\n"}
                {"  "}
                <span className="kw">if</span> (<span className="prop">exported</span>.
                <span className="prop">length</span> === <span className="num">0</span>){" "}
                <span className="kw">continue</span>;{" "}
                <span className="cm">{"// export 없으면 건너뜀"}</span>
                {"\n"}
                {"  "}
                <span className="kw">if</span> (<span className="prop">charCount</span> +{" "}
                <span className="prop">block</span>.<span className="prop">length</span> {">"}{" "}
                <span className="prop">maxChars</span>) <span className="kw">break</span>;{" "}
                <span className="cm">{"// 예산 초과"}</span>
                {"\n"}
                {"}"}
              </CodeBlock>
              <p className="mt-3 text-gray-600">
                이 방식은 간단하지만, 파일 순서에 따라 중요한 파일이 잘릴 수 있습니다. 향후 심볼
                중요도 기반 정렬이 추가될 수 있습니다.
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

            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;특정 클래스/함수가 레포 맵에 나타나지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                두 가지 가능성이 있습니다: (1) 심볼이 <code className="text-cyan-600">export</code>
                되지 않았을 수 있습니다.
                <code className="text-cyan-600">renderRepoMap()</code>은 export된 심볼만 표시합니다.
                (2) 정규식이 매칭하지 못하는 복잡한 선언일 수 있습니다(예: 데코레이터 뒤의 클래스
                선언).
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Python/Go 파일이 분석되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                현재 <code className="text-cyan-600">.ts</code>,{" "}
                <code className="text-cyan-600">.tsx</code>,
                <code className="text-cyan-600">.js</code>,{" "}
                <code className="text-cyan-600">.jsx</code>
                확장자만 지원됩니다. 다른 언어는{" "}
                <code className="text-cyan-600">SUPPORTED_EXTENSIONS</code>
                Set에 추가하고 해당 언어의 정규식 패턴을 구현해야 합니다.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;렌더링 결과에 파일이 너무 적어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                기본 토큰 예산은 4000입니다. 프로젝트 규모가 크면 예산 내에 모든 파일을 포함하지
                못합니다. <code className="text-cyan-600">maxTokens</code>를 늘리거나, 컨텍스트
                윈도우 크기를 고려하여 적절한 값을 선택하세요.
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
                  name: "system-prompt-builder.ts",
                  slug: "system-prompt-builder",
                  relation: "parent",
                  desc: "레포 맵 렌더링 결과를 시스템 프롬프트에 주입하는 빌더",
                },
                {
                  name: "context-manager.ts",
                  slug: "context-manager",
                  relation: "sibling",
                  desc: "3-Layer 토큰 관리 — 레포 맵이 차지하는 토큰 예산을 관리",
                },
                {
                  name: "token-counter.ts",
                  slug: "token-counter",
                  relation: "sibling",
                  desc: "토큰 수 계산 — renderRepoMap의 토큰 예산 검증에 활용",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
