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

export default function SystemPromptCachePage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/core/system-prompt-cache.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">SystemPromptCache</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="core" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              SHA-256 기반 시스템 프롬프트 캐싱 모듈입니다.
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
                <code className="text-cyan-600">SystemPromptCache</code>는 빌드된 시스템 프롬프트를
                캐싱하여 매 에이전트 루프 반복마다 불필요하게 다시 생성하는 것을 방지하는
                모듈입니다. 시스템 프롬프트 빌드에는 파일 읽기, git 명령 실행 등 비용이 드는 작업이
                포함되므로, 설정 파일이 변경되지 않았다면 같은 프롬프트를 재사용하는 것이 훨씬
                효율적입니다.
              </p>
              <p>
                캐시 키는 설정 파일들의 <strong>수정 시각(mtime)</strong>을 SHA-256 해시로
                생성합니다. 파일이 수정되면 mtime이 바뀌므로 캐시 키도 달라져 자동으로 캐시가
                무효화됩니다. 파일이 삭제되어도 센티넬 값 &quot;0&quot;이 사용되어 캐시 무효화가
                보장됩니다.
              </p>
              <p>
                구조는 극도로 단순합니다: 키-값 쌍 하나만 저장하는 싱글 슬롯 캐시입니다. 메서드도{" "}
                <code className="text-cyan-600">get</code>,
                <code className="text-cyan-600">set</code>,
                <code className="text-cyan-600">invalidate</code>,
                <code className="text-cyan-600">buildKey</code> 네 개뿐입니다.
              </p>
            </div>

            <MermaidDiagram
              title="SystemPromptCache 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  AL["Agent Loop<br/><small>agent-loop.ts</small>"]
  SPB["System Prompt Builder<br/><small>system-prompt.ts</small>"]
  SPC["SystemPromptCache<br/><small>system-prompt-cache.ts</small>"]
  FILES["설정 파일들<br/><small>DHELIX.md, .dhelix/config.json...</small>"]
  LLM["LLM Client<br/><small>llm/client.ts</small>"]

  AL -->|"프롬프트 요청"| SPB
  SPB -->|"캐시 확인 (get)"| SPC
  SPC -->|"캐시 히트"| SPB
  SPC -->|"캐시 미스"| SPB
  SPB -->|"새 프롬프트 빌드"| FILES
  SPB -->|"캐시 저장 (set)"| SPC
  SPB -->|"시스템 프롬프트 전달"| LLM

  style SPC fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style SPB fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style AL fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style FILES fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style LLM fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 레스토랑의 오늘의 메뉴판을 떠올리세요. 식재료(설정 파일)가
              바뀌지 않았으면 어제 만든 메뉴판(시스템 프롬프트)을 그대로 사용합니다. 식재료가
              바뀌면(mtime 변경) 메뉴판을 새로 인쇄합니다. SHA-256 해시는 &quot;식재료 목록의
              지문&quot;입니다.
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

            {/* class SystemPromptCache */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class SystemPromptCache
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              단일 키-값 슬롯 캐시입니다. 키가 일치하면 캐시된 프롬프트를 반환하고, 다르면 null을
              반환합니다(캐시 미스).
            </p>

            {/* get */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">get(key)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              캐시에서 프롬프트를 가져옵니다. 키가 일치하면 캐시된 문자열을, 아니면 null을
              반환합니다.
            </p>
            <CodeBlock>
              <span className="fn">get</span>(<span className="prop">key</span>:{" "}
              <span className="type">string</span>): <span className="type">string</span> |{" "}
              <span className="type">null</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "key",
                  type: "string",
                  required: true,
                  desc: "확인할 캐시 키 (buildKey()로 생성)",
                },
                {
                  name: "(반환)",
                  type: "string | null",
                  required: true,
                  desc: "캐시된 프롬프트 문자열, 캐시 미스 시 null",
                },
              ]}
            />

            {/* set */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">set(key, prompt)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              프롬프트를 캐시에 저장합니다. 이전 캐시는 덮어씁니다 (싱글 슬롯).
            </p>
            <CodeBlock>
              <span className="fn">set</span>(<span className="prop">key</span>:{" "}
              <span className="type">string</span>, <span className="prop">prompt</span>:{" "}
              <span className="type">string</span>): <span className="type">void</span>
            </CodeBlock>
            <ParamTable
              params={[
                { name: "key", type: "string", required: true, desc: "캐시 키 (파일 mtime 해시)" },
                {
                  name: "prompt",
                  type: "string",
                  required: true,
                  desc: "저장할 시스템 프롬프트 문자열",
                },
              ]}
            />

            {/* invalidate */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">invalidate()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              캐시를 무효화(초기화)합니다. 저장된 프롬프트와 키를 모두 삭제합니다.
            </p>
            <CodeBlock>
              <span className="fn">invalidate</span>(): <span className="type">void</span>
            </CodeBlock>

            {/* buildKey (static) */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              static buildKey(instructionFiles)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              설정 파일들의 수정 시각(mtime)으로부터 캐시 키를 생성합니다. SHA-256 해시의 앞 16자를
              반환합니다.
            </p>
            <CodeBlock>
              <span className="kw">static async</span> <span className="fn">buildKey</span>(
              <span className="prop">instructionFiles</span>: <span className="kw">readonly</span>{" "}
              <span className="type">string</span>[]):{" "}
              <span className="type">Promise&lt;string&gt;</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "instructionFiles",
                  type: "readonly string[]",
                  required: true,
                  desc: "캐시 키 생성에 사용할 설정 파일 경로 목록",
                },
                {
                  name: "(반환)",
                  type: "string",
                  required: true,
                  desc: "16자리 SHA-256 해시 문자열 (캐시 키)",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <strong>싱글 슬롯 캐시:</strong> 한 번에 하나의 프롬프트만 캐시합니다. 여러
                프롬프트를 동시에 캐싱하는 기능은 없습니다.
              </li>
              <li>
                <code className="text-cyan-600">buildKey()</code>는 <strong>async</strong>입니다.
                파일 시스템의 <code>stat()</code>을 호출하기 때문입니다.
              </li>
              <li>
                파일이 존재하지 않으면 mtime을 <code className="text-cyan-600">&quot;0&quot;</code>
                으로 처리합니다. 파일 삭제도 캐시 무효화를 유발합니다.
              </li>
              <li>
                해시 앞 16자만 사용하므로 충돌(collision) 가능성이 이론적으로 존재하지만,
                실용적으로는 무시할 수 있는 수준입니다.
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
              기본 사용법 &mdash; 캐시 히트/미스 패턴
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              시스템 프롬프트 빌더에서 캐시를 활용하는 전형적인 패턴입니다. 캐시 키를 생성하고,
              히트하면 바로 반환, 미스하면 새로 빌드하여 캐시에 저장합니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">cache</span> ={" "}
              <span className="kw">new</span> <span className="fn">SystemPromptCache</span>();
              {"\n"}
              {"\n"}
              <span className="cm">{"// 1. 설정 파일 목록에서 캐시 키 생성"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">key</span> ={" "}
              <span className="kw">await</span> <span className="type">SystemPromptCache</span>.
              <span className="fn">buildKey</span>([
              {"\n"}
              {"  "}
              <span className="str">&quot;DHELIX.md&quot;</span>,{"\n"}
              {"  "}
              <span className="str">&quot;.dhelix/config.json&quot;</span>,{"\n"}
              {"  "}
              <span className="str">&quot;~/.dhelix/config.json&quot;</span>,{"\n"}]);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 2. 캐시 확인"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">cached</span> ={" "}
              <span className="prop">cache</span>.<span className="fn">get</span>(
              <span className="prop">key</span>);
              {"\n"}
              <span className="kw">if</span> (<span className="prop">cached</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="kw">return</span> <span className="prop">cached</span>;{" "}
              <span className="cm">{"// 캐시 히트!"}</span>
              {"\n"}
              {"}"}
              {"\n"}
              {"\n"}
              <span className="cm">{"// 3. 캐시 미스 → 새로 빌드"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">prompt</span> ={" "}
              <span className="kw">await</span> <span className="fn">buildSystemPrompt</span>(
              <span className="prop">config</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 4. 캐시에 저장"}</span>
              {"\n"}
              <span className="prop">cache</span>.<span className="fn">set</span>(
              <span className="prop">key</span>, <span className="prop">prompt</span>);
              {"\n"}
              <span className="kw">return</span> <span className="prop">prompt</span>;
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>buildKey()</code>의 <code>instructionFiles</code>에
              포함되지 않은 파일이 변경되어도 캐시가 무효화되지 않습니다. 시스템 프롬프트에 영향을
              주는 <strong>모든</strong>
              파일을 빠짐없이 나열해야 합니다.
            </Callout>

            {/* 고급: 수동 무효화 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 수동 캐시 무효화
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              설정 파일 변경 외에 다른 이유로 프롬프트를 다시 빌드해야 할 때
              <code className="text-cyan-600">invalidate()</code>로 수동 무효화할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 사용자가 /model 명령으로 모델을 변경했을 때"}</span>
              {"\n"}
              <span className="prop">cache</span>.<span className="fn">invalidate</span>();
              {"\n"}
              {"\n"}
              <span className="cm">{"// 다음 프롬프트 빌드 시 캐시 미스 → 새로 빌드됨"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">newPrompt</span> ={" "}
              <span className="kw">await</span> <span className="fn">buildSystemPrompt</span>(
              <span className="prop">config</span>);
            </CodeBlock>

            <DeepDive title="buildKey() 해시 생성 상세">
              <p className="mb-3">
                <code className="text-cyan-600">buildKey()</code>는 다음 과정으로 캐시 키를
                생성합니다:
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-gray-600">
                <li>
                  각 파일 경로에 대해 <code className="text-cyan-600">fs.stat()</code>으로 수정
                  시각(mtimeMs)을 조회합니다.
                </li>
                <li>
                  &quot;경로:시각&quot; 형태의 문자열을 생성합니다. 예:{" "}
                  <code>/path/DHELIX.md:1711234567890.123</code>
                </li>
                <li>
                  파일이 없으면 <code className="text-cyan-600">경로:0</code>으로 처리합니다 (센티넬
                  값).
                </li>
                <li>모든 문자열을 줄바꿈으로 결합하여 SHA-256 해시를 생성합니다.</li>
                <li>해시의 앞 16자를 캐시 키로 반환합니다.</li>
              </ol>
              <p className="mt-3 text-amber-600">
                mtimeMs는 밀리초 단위의 부동소수점이므로, 같은 파일이라도 수정 시 매우 높은 확률로
                다른 키가 생성됩니다. 1초 이내에 두 번 수정해도 ms 단위에서 차이가 납니다.
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
              캐시 동작 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              캐시 히트와 캐시 미스의 두 가지 경로를 보여주는 흐름도입니다.
            </p>

            <MermaidDiagram
              title="SystemPromptCache 동작 흐름"
              titleColor="purple"
              chart={`graph TD
  START(("프롬프트 요청")) --> BUILD_KEY["buildKey()<br/><small>파일 mtime SHA-256 해시</small>"]
  BUILD_KEY --> GET["cache.get(key)"]
  GET -->|"키 일치 + cached != null"| HIT["캐시 히트<br/><small>즉시 반환</small>"]
  GET -->|"키 불일치 or cached == null"| MISS["캐시 미스<br/><small>프롬프트 빌드</small>"]
  MISS --> SET["cache.set(key, prompt)<br/><small>새 프롬프트 캐싱</small>"]
  SET --> RETURN(("프롬프트 반환"))
  HIT --> RETURN

  INVALIDATE["invalidate()<br/><small>수동 무효화</small>"] -.->|"키+캐시 null로"| GET

  style BUILD_KEY fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style HIT fill:#dcfce7,stroke:#10b981,color:#065f46
  style MISS fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style SET fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style INVALIDATE fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석 &mdash; buildKey()
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              캐시 키 생성의 핵심 로직입니다. 파일 mtime을 수집하고 SHA-256 해시를 생성합니다.
            </p>
            <CodeBlock>
              <span className="kw">static async</span> <span className="fn">buildKey</span>(
              <span className="prop">instructionFiles</span>: <span className="kw">readonly</span>{" "}
              <span className="type">string</span>[]):{" "}
              <span className="type">Promise&lt;string&gt;</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">parts</span>:{" "}
              <span className="type">string</span>[] = [];
              {"\n"}
              {"\n"}
              {"  "}
              <span className="kw">for</span> (<span className="kw">const</span>{" "}
              <span className="prop">filePath</span> <span className="kw">of</span>{" "}
              <span className="prop">instructionFiles</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">try</span> {"{"}
              {"\n"}
              {"      "}
              <span className="kw">const</span> <span className="prop">fileStat</span> ={" "}
              <span className="kw">await</span> <span className="fn">stat</span>(
              <span className="prop">filePath</span>);
              {"\n"}
              {"      "}
              <span className="cm">{"// 파일 경로 + 수정 시각을 기록"}</span>
              {"\n"}
              {"      "}
              <span className="prop">parts</span>.<span className="fn">push</span>(
              <span className="str">{"`${filePath}:${fileStat.mtimeMs}`"}</span>);
              {"\n"}
              {"    "}
              <span className="kw">
                {"}"} catch {"{"}
              </span>
              {"\n"}
              {"      "}
              <span className="cm">{"// 파일 없음 → 센티넬 값 '0' 사용"}</span>
              {"\n"}
              {"      "}
              <span className="prop">parts</span>.<span className="fn">push</span>(
              <span className="str">{"`${filePath}:0`"}</span>);
              {"\n"}
              {"    "}
              {"}"}
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// SHA-256 해시 → 앞 16자"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">hash</span> ={" "}
              <span className="fn">createHash</span>(<span className="str">&quot;sha256&quot;</span>
              );
              {"\n"}
              {"  "}
              <span className="prop">hash</span>.<span className="fn">update</span>(
              <span className="prop">parts</span>.<span className="fn">join</span>(
              <span className="str">&quot;\n&quot;</span>));
              {"\n"}
              {"  "}
              <span className="kw">return</span> <span className="prop">hash</span>.
              <span className="fn">digest</span>(<span className="str">&quot;hex&quot;</span>).
              <span className="fn">slice</span>(<span className="num">0</span>,{" "}
              <span className="num">16</span>);
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">센티넬 값 &quot;0&quot;:</strong> 파일이 없거나
                접근 불가한 경우 mtime 대신 &quot;0&quot;을 사용합니다. 이전에 파일이 있었다가
                삭제되면 키가 달라져 캐시 미스가 발생합니다.
              </p>
              <p>
                <strong className="text-gray-900">16자 해시:</strong> SHA-256 전체(64자) 대신 앞
                16자만 사용합니다. 16자 hex = 64비트 = 2^64 가지로, 프롬프트 캐시 용도로는 충분히
                유니크합니다.
              </p>
              <p>
                <strong className="text-gray-900">줄바꿈 구분자:</strong> parts를 <code>\n</code>
                으로 결합하여 &quot;파일A:시각\n파일B:시각&quot; 형태로 해시합니다. 경로에 줄바꿈이
                포함되면 이론적으로 충돌 가능하지만, 실용적으로 무시할 수 있습니다.
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
                &quot;설정 파일을 수정했는데 프롬프트가 바뀌지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                수정한 파일이 <code className="text-cyan-600">buildKey()</code>의
                <code className="text-cyan-600">instructionFiles</code> 목록에 포함되어 있는지
                확인하세요. 목록에 없는 파일은 mtime이 변경되어도 캐시 키에 영향을 주지 않습니다.
                또한 일부 에디터는 파일을 &quot;원자적(atomic)&quot;으로 저장하여 mtime이 예상대로
                변경되지 않을 수 있습니다.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;캐시가 전혀 작동하지 않아요 (매번 새로 빌드됨)&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                <code className="text-cyan-600">buildKey()</code>가 매번 다른 키를 반환하고 있을 수
                있습니다. 다음을 확인하세요:
              </p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>파일 목록에 임시 파일이나 자주 변경되는 파일이 포함되어 있지 않은지</li>
                <li>파일 경로가 매번 동일한지 (상대 경로 vs 절대 경로 불일치)</li>
                <li>
                  <code className="text-cyan-600">invalidate()</code>가 매 루프마다 호출되고 있지
                  않은지
                </li>
              </ul>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;캐시가 오래된 프롬프트를 반환해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                설정 파일 이외의 요소(예: 환경 변수, git 상태 등)가 프롬프트에 영향을 주고 있다면,
                해당 요소의 변경이 캐시 키에 반영되지 않을 수 있습니다.
                <code className="text-cyan-600">invalidate()</code>를 호출하여 수동으로 캐시를
                무효화하세요.
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
                  name: "agent-loop.ts",
                  slug: "agent-loop",
                  relation: "parent",
                  desc: "매 반복마다 시스템 프롬프트를 요청하며, 캐시 히트 시 빌드를 건너뜀",
                },
                {
                  name: "auto-memory.ts",
                  slug: "auto-memory",
                  relation: "sibling",
                  desc: "메모리 프롬프트가 시스템 프롬프트에 삽입되므로, 메모리 변경 시 캐시 무효화 필요",
                },
                {
                  name: "adaptive-context.ts",
                  slug: "adaptive-context",
                  relation: "sibling",
                  desc: "작업 복잡도에 따라 포함할 프롬프트 섹션 수가 달라지므로, 캐시 키에 영향",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
