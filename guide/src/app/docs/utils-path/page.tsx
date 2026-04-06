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

export default function UtilsPathPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/utils/path.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">Path Utilities</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              크로스 플랫폼 파일 경로 처리 유틸리티입니다. Windows 백슬래시를 포워드 슬래시로
              통일하고, Git Bash 경로 변환, UNC 경로, 긴 경로(260자 초과) 등을 처리합니다.
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
                Node.js의 <code className="text-cyan-600">path</code> 모듈은 OS에 따라 다른 구분자를
                사용합니다 (Windows: <code>\</code>, Unix: <code>/</code>). 이 모듈은 모든 결과를
                포워드 슬래시(<code>/</code>)로 통일하여 코드베이스 전체에서 경로를 일관되게
                처리합니다.
              </p>
              <p>
                기본 경로 작업(normalize, resolve, join, dirname, basename, extname, relative)을
                래핑하고, Git Bash 경로 변환(<code>/c/Users</code> &harr; <code>C:\Users</code>),
                Windows 환경 변수 확장(<code>%VAR%</code>), UNC 경로 정규화 등 플랫폼별 엣지
                케이스를 처리하는 함수도 제공합니다.
              </p>
              <p>
                프로젝트의 코딩 컨벤션에 따라 <strong>모든 파일 경로 작업은 이 모듈을 통해</strong>{" "}
                수행합니다. Node.js의 <code className="text-cyan-600">path</code> 모듈을 직접
                사용하지 마세요.
              </p>
            </div>

            <MermaidDiagram
              title="경로 유틸리티 함수 분류"
              titleColor="purple"
              chart={`graph TD
  subgraph BASIC["기본 경로 작업"]
    NP["normalizePath()"]
    RP["resolvePath()"]
    JP["joinPath()"]
    DN["dirName()"]
    BN["baseName()"]
    EN["extName()"]
    REL["relativePath()"]
    ABS["isAbsolutePath()"]
  end

  subgraph GITBASH["Git Bash 변환"]
    GTW["gitBashToWindows()"]
    WTG["windowsToGitBash()"]
    ISG["isGitBashPath()"]
    AUTO["autoResolveGitBashPath()"]
  end

  subgraph WINDOWS["Windows 특화"]
    EXP["expandWindowsEnvVars()"]
    NDL["normalizeDriveLetter()"]
    UNC["isUNCPath() / normalizeUNCPath()"]
    LONG["isLongPath() / ensureLongPathSupport()"]
  end

  PLATFORM["platform.ts<br/><small>isWindows()</small>"] -.-> NP
  PLATFORM -.-> AUTO

  style BASIC fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style GITBASH fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style WINDOWS fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style PLATFORM fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>핵심 원칙:</strong> 이 모듈의 모든 함수는 결과를 포워드 슬래시(/)로
              반환합니다. Windows에서도 <code>C:/Users/name/file.txt</code> 형식을 사용하여 플랫폼
              간 코드 일관성을 유지합니다.
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

            {/* Basic path functions */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              기본 경로 함수
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              Node.js path 모듈을 래핑하여 모든 결과를 포워드 슬래시로 정규화합니다.
            </p>
            <div className="bg-white border border-gray-200 rounded-xl p-5 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <code className="text-cyan-600">normalizePath(p)</code> &mdash; 경로 정규화 +
                백슬래시를 포워드 슬래시로 변환
              </p>
              <p>
                <code className="text-cyan-600">resolvePath(...segments)</code> &mdash; 절대 경로로
                해석 후 정규화
              </p>
              <p>
                <code className="text-cyan-600">joinPath(...segments)</code> &mdash; 경로 세그먼트
                결합 후 정규화
              </p>
              <p>
                <code className="text-cyan-600">dirName(p)</code> &mdash; 디렉토리 부분 추출
              </p>
              <p>
                <code className="text-cyan-600">baseName(p, ext?)</code> &mdash; 파일 이름 추출
              </p>
              <p>
                <code className="text-cyan-600">extName(p)</code> &mdash; 확장자 추출 (점 포함)
              </p>
              <p>
                <code className="text-cyan-600">relativePath(from, to)</code> &mdash; 상대 경로 계산
              </p>
              <p>
                <code className="text-cyan-600">isAbsolutePath(p)</code> &mdash; 절대 경로 여부
                (Unix + Windows 모두 인식)
              </p>
            </div>

            {/* Git Bash path functions */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              Git Bash 경로 변환
            </h3>
            <div className="bg-white border border-gray-200 rounded-xl p-5 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <code className="text-cyan-600">gitBashToWindows(p)</code> &mdash;{" "}
                <code>/c/Users/name</code> &rarr; <code>C:\Users\name</code>
              </p>
              <p>
                <code className="text-cyan-600">windowsToGitBash(p)</code> &mdash;{" "}
                <code>C:\Users\name</code> &rarr; <code>/c/Users/name</code>
              </p>
              <p>
                <code className="text-cyan-600">isGitBashPath(p)</code> &mdash; Git Bash 형식 경로
                여부 확인
              </p>
              <p>
                <code className="text-cyan-600">autoResolveGitBashPath(p)</code> &mdash;
                Windows에서만 Git Bash 경로를 자동 변환
              </p>
            </div>

            {/* Windows-specific functions */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              Windows 특화 함수
            </h3>
            <div className="bg-white border border-gray-200 rounded-xl p-5 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <code className="text-cyan-600">expandWindowsEnvVars(p)</code> &mdash;{" "}
                <code>%USERPROFILE%\Documents</code> &rarr; <code>C:\Users\name\Documents</code>
              </p>
              <p>
                <code className="text-cyan-600">normalizeDriveLetter(p)</code> &mdash; 드라이브 문자
                대문자 통일 (<code>c:</code> &rarr; <code>C:</code>)
              </p>
              <p>
                <code className="text-cyan-600">isUNCPath(p)</code> &mdash; UNC 경로 여부 (
                <code>\\server\share</code>)
              </p>
              <p>
                <code className="text-cyan-600">normalizeUNCPath(p)</code> &mdash; UNC 경로 정규화
              </p>
              <p>
                <code className="text-cyan-600">isLongPath(p)</code> &mdash; 260자 초과 여부
              </p>
              <p>
                <code className="text-cyan-600">ensureLongPathSupport(p)</code> &mdash;{" "}
                <code>\\?\</code> 접두사 추가
              </p>
            </div>

            {/* Aliases */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              별칭 (Aliases)
            </h3>
            <div className="text-[13px] text-gray-600 space-y-1">
              <p>
                &bull; <code className="text-cyan-600">toGitBashPath</code> ={" "}
                <code>windowsToGitBash</code>
              </p>
              <p>
                &bull; <code className="text-cyan-600">fromGitBashPath</code> ={" "}
                <code>gitBashToWindows</code>
              </p>
            </div>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                Node.js의 <code className="text-cyan-600">path</code> 모듈을 직접 사용하지 마세요.
                이 모듈을 통해야 Windows에서 일관된 포워드 슬래시 경로가 보장됩니다.
              </li>
              <li>
                <code className="text-cyan-600">gitBashToWindows()</code>는 단일 드라이브 문자 패턴
                (<code>/c/...</code>)만 인식합니다. <code>/home/user</code> 같은 경로는 변환하지
                않습니다.
              </li>
              <li>
                <code className="text-cyan-600">expandWindowsEnvVars()</code>는 해석 불가한 변수를
                원래 형태(<code>%VAR%</code>)로 유지합니다. 에러를 발생시키지 않습니다.
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
              기본 사용법 &mdash; 경로 조합과 정규화
            </h3>
            <CodeBlock>
              <span className="kw">import</span> {"{"} <span className="prop">joinPath</span>,{" "}
              <span className="prop">resolvePath</span>, <span className="prop">normalizePath</span>{" "}
              {"}"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./utils/path.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 경로 결합"}</span>
              {"\n"}
              <span className="fn">joinPath</span>(<span className="str">&quot;src&quot;</span>,{" "}
              <span className="str">&quot;utils&quot;</span>,{" "}
              <span className="str">&quot;path.ts&quot;</span>);
              {"\n"}
              <span className="cm">{'// → "src/utils/path.ts"'}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 절대 경로 해석"}</span>
              {"\n"}
              <span className="fn">resolvePath</span>(<span className="str">&quot;/home&quot;</span>
              , <span className="str">&quot;user&quot;</span>,{" "}
              <span className="str">&quot;docs&quot;</span>);
              {"\n"}
              <span className="cm">{'// → "/home/user/docs"'}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// Windows 경로 정규화"}</span>
              {"\n"}
              <span className="fn">normalizePath</span>(
              <span className="str">&quot;C:\\Users\\name\\file.txt&quot;</span>);
              {"\n"}
              <span className="cm">{'// → "C:/Users/name/file.txt"'}</span>
            </CodeBlock>

            {/* Git Bash 변환 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              Git Bash 경로 변환
            </h3>
            <CodeBlock>
              <span className="kw">import</span> {"{"}{" "}
              <span className="prop">gitBashToWindows</span>,{" "}
              <span className="prop">windowsToGitBash</span>,{" "}
              <span className="prop">autoResolveGitBashPath</span> {"}"}{" "}
              <span className="kw">from</span>{" "}
              <span className="str">&quot;./utils/path.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="fn">gitBashToWindows</span>(
              <span className="str">&quot;/c/Users/name&quot;</span>);
              {"\n"}
              <span className="cm">{'// → "C:\\Users\\name"'}</span>
              {"\n"}
              {"\n"}
              <span className="fn">windowsToGitBash</span>(
              <span className="str">&quot;C:\\Users\\name&quot;</span>);
              {"\n"}
              <span className="cm">{'// → "/c/Users/name"'}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 자동 감지: Windows에서만 변환"}</span>
              {"\n"}
              <span className="fn">autoResolveGitBashPath</span>(
              <span className="str">&quot;/c/Users/name&quot;</span>);
              {"\n"}
              <span className="cm">{'// Windows → "C:\\Users\\name", macOS/Linux → 그대로'}</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>gitBashToWindows()</code>의 결과는 백슬래시(
              <code>\</code>)를 사용합니다. dhelix 내부에서 사용하려면 <code>normalizePath()</code>
              를 추가로 적용하여 포워드 슬래시로 통일하세요.
            </Callout>

            {/* UNC + Long Path */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; UNC 경로와 긴 경로
            </h3>
            <CodeBlock>
              <span className="cm">{"// UNC 경로 확인 및 정규화"}</span>
              {"\n"}
              <span className="fn">isUNCPath</span>(
              <span className="str">&quot;\\\\server\\share\\folder&quot;</span>);{" "}
              <span className="cm">{"// → true"}</span>
              {"\n"}
              <span className="fn">normalizeUNCPath</span>(
              <span className="str">&quot;\\\\server\\share\\folder\\&quot;</span>);
              {"\n"}
              <span className="cm">{'// → "//server/share/folder"'}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 260자 초과 경로 처리"}</span>
              {"\n"}
              <span className="fn">ensureLongPathSupport</span>(
              <span className="prop">veryLongPath</span>);
              {"\n"}
              <span className="cm">{'// → "\\\\?\\C:\\very\\long\\...\\path"'}</span>
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> <code>isAbsolutePath()</code>는 Unix(<code>/usr</code>)와
              Windows(<code>C:\Users</code>) 형식 모두 인식합니다. Node.js의{" "}
              <code>path.isAbsolute()</code>보다 크로스 플랫폼 호환성이 높습니다.
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
              정규화 파이프라인
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              모든 기본 경로 함수는 내부적으로{" "}
              <code className="text-cyan-600">normalizePath()</code>를 거칩니다. Windows에서만
              백슬래시 치환이 발생합니다.
            </p>

            <MermaidDiagram
              title="경로 정규화 흐름"
              titleColor="purple"
              chart={`graph LR
  INPUT["입력 경로<br/><small>C:\\Users\\name</small>"]
  NODE["path.normalize()<br/><small>Node.js 내장</small>"]
  CHECK{"isWindows()?"}
  REPLACE["replace(/\\\\\\\\/g, '/')<br/><small>백슬래시 → 슬래시</small>"]
  OUTPUT["출력 경로<br/><small>C:/Users/name</small>"]

  INPUT --> NODE --> CHECK
  CHECK -->|"Yes"| REPLACE --> OUTPUT
  CHECK -->|"No"| OUTPUT

  style INPUT fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style REPLACE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style OUTPUT fill:#dcfce7,stroke:#10b981,color:#065f46
  style CHECK fill:#fef3c7,stroke:#f59e0b,color:#1e293b`}
            />

            <DeepDive title="Git Bash 경로 패턴 매칭 상세">
              <p className="mb-3">Git Bash 경로를 인식하는 정규식 패턴:</p>
              <CodeBlock>
                <span className="cm">{"// Git Bash → Windows"}</span>
                {"\n"}
                <span className="kw">const</span> <span className="prop">match</span> ={" "}
                <span className="prop">p</span>.<span className="fn">match</span>(
                <span className="str">/^\/([a-zA-Z])(\/.*)?$/</span>);
                {"\n"}
                <span className="cm">
                  {"// /c/Users/name → match[1]='c', match[2]='/Users/name'"}
                </span>
                {"\n"}
                <span className="cm">{'// 결과: "C:\\Users\\name"'}</span>
                {"\n"}
                {"\n"}
                <span className="cm">{"// Windows → Git Bash"}</span>
                {"\n"}
                <span className="kw">const</span> <span className="prop">match</span> ={" "}
                <span className="prop">p</span>.<span className="fn">match</span>(
                <span className="str">/^([a-zA-Z]):[/\\\\](.*)$/</span>);
                {"\n"}
                <span className="cm">
                  {"// C:\\Users\\name → match[1]='C', match[2]='Users\\name'"}
                </span>
                {"\n"}
                <span className="cm">{'// 결과: "/c/Users/name"'}</span>
              </CodeBlock>
              <p className="mt-3 text-gray-600">
                <code className="text-cyan-600">isGitBashPath()</code>는 <code>/[단일문자]/</code>{" "}
                또는
                <code>/[단일문자]</code>(끝) 패턴을 확인합니다. <code>/home/user</code>는
                &quot;h&quot;가 드라이브 문자가 아니므로 이론상 매칭되지만,{" "}
                <code>autoResolveGitBashPath()</code>는 Windows에서만 변환을 수행하므로 Unix에서는
                안전합니다.
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
                &quot;경로에 백슬래시가 섞여 있어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                Node.js의 <code className="text-cyan-600">path</code> 모듈을 직접 사용하고 있지
                않은지 확인하세요. 이 모듈의 함수(<code>joinPath</code>, <code>resolvePath</code>{" "}
                등)를 사용하면 자동으로 포워드 슬래시로 통일됩니다.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Git Bash 경로가 변환되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">autoResolveGitBashPath()</code>는 Windows에서만
                변환합니다. macOS/Linux에서는 <code>/c/Users</code> 같은 경로도 그대로 반환됩니다.
                직접 변환이 필요하면 <code>gitBashToWindows()</code>를 사용하세요.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Windows에서 260자 넘는 경로가 에러를 발생시켜요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">ensureLongPathSupport()</code>를 사용하여
                <code>\\?\</code> 접두사를 추가하세요. 또는 Windows 10 이상에서 그룹 정책으로 긴
                경로 지원을 활성화할 수 있습니다.
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
                  name: "platform.ts",
                  slug: "utils-platform",
                  relation: "child",
                  desc: "isWindows()를 사용하여 경로 구분자 변환 여부를 결정합니다",
                },
                {
                  name: "token-store.ts",
                  slug: "token-store",
                  relation: "parent",
                  desc: "자격 증명 파일 경로를 joinPath()로 생성합니다",
                },
                {
                  name: "config-loader.ts",
                  slug: "config-loader",
                  relation: "parent",
                  desc: "설정 파일 경로 해석에 resolvePath()를 사용합니다",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
