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

export default function UseInputPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/cli/hooks/useInput.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">useInputHistory</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="cli" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              사용자 입력 히스토리를 메모리와 디스크에 동시 관리하는 React 훅입니다.
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
                <code className="text-cyan-600">useInputHistory</code>는 CLI 입력창에서 사용자가
                이전에 입력한 내용을 위/아래 화살표 키로 탐색할 수 있게 해주는 훅입니다. 쉘의
                히스토리 기능(bash의 <code className="text-cyan-600">~/.bash_history</code>)과
                동일한 UX를 제공합니다.
              </p>
              <p>
                히스토리는 <code className="text-cyan-600">~/.dbcode/input-history.json</code>에
                JSON 배열로 영속 저장됩니다. 앱을 재시작해도 이전 입력을 복원할 수 있으며, 중복
                입력은 자동으로 제거되고 최신 위치로 이동합니다.
              </p>
              <p>
                최대 <code className="text-cyan-600">INPUT_HISTORY_MAX</code>개까지 유지되며, 초과
                시 가장 오래된 항목부터 자동으로 삭제됩니다. React 상태와 디스크 파일이 항상
                동기화되어 데이터 손실을 방지합니다.
              </p>
            </div>

            <MermaidDiagram
              title="useInputHistory 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  APP["App.tsx<br/><small>메인 앱 컴포넌트</small>"]
  INPUT["useInputHistory<br/><small>useInput.ts</small>"]
  DISK["input-history.json<br/><small>~/.dbcode/</small>"]
  UI["TextInput 컴포넌트<br/><small>입력창 UI</small>"]
  KB["useKeybindings<br/><small>키보드 단축키</small>"]

  APP --> INPUT
  INPUT -->|"loadHistory()"| DISK
  INPUT -->|"saveHistory()"| DISK
  INPUT -->|"navigateUp/Down"| UI
  KB -->|"방향키 감지"| INPUT

  style INPUT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style APP fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style DISK fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style UI fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style KB fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 터미널 쉘에서 위 화살표를 누르면 이전 명령어가 나오는 것처럼,
              이 훅은 dbcode CLI에서 같은 경험을 제공합니다. 히스토리는 파일로 저장되어 앱을
              종료하고 다시 열어도 유지됩니다.
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

            {/* loadHistory */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              loadHistory()
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              디스크에서 저장된 히스토리를 로드합니다. JSON 배열 형태의 파일을 파싱하며, 실패 시 빈
              배열을 반환합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">loadHistory</span>():{" "}
              <span className="type">readonly string[]</span>
            </CodeBlock>
            <div className="text-[13px] text-gray-600 mt-2 space-y-1">
              <p>
                &bull; 파일이 없거나 유효하지 않은 JSON이면 빈 배열{" "}
                <code className="text-cyan-600">[]</code>을 반환합니다.
              </p>
              <p>&bull; 배열 내 모든 항목이 문자열인지 검증합니다 (타입 가드).</p>
              <p>
                &bull; <code className="text-cyan-600">INPUT_HISTORY_MAX</code>를 초과하는 항목은
                잘라냅니다.
              </p>
            </div>

            {/* saveHistory */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              saveHistory(history)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              히스토리를 디스크에 JSON 배열로 직렬화하여 저장합니다. 디렉토리가 없으면 자동으로
              생성합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">saveHistory</span>(
              <span className="prop">history</span>: <span className="type">readonly string[]</span>
              ): <span className="type">void</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "history",
                  type: "readonly string[]",
                  required: true,
                  desc: "저장할 히스토리 배열 (최신이 인덱스 0)",
                },
              ]}
            />

            {/* useInputHistory hook */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              useInputHistory(maxHistory?)
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              디스크 영속성을 가진 입력 히스토리를 관리하는 메인 React 훅입니다. 초기 렌더링 시
              디스크에서 히스토리를 로드하고, 변경 시마다 자동으로 디스크에 저장합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">useInputHistory</span>(
              <span className="prop">maxHistory</span>?: <span className="type">number</span>):{" "}
              {"{"}
              {"\n"}
              {"  "}
              <span className="prop">history</span>: <span className="type">readonly string[]</span>
              ;{"\n"}
              {"  "}
              <span className="prop">addToHistory</span>: (<span className="prop">input</span>:{" "}
              <span className="type">string</span>) =&gt; <span className="type">void</span>;{"\n"}
              {"  "}
              <span className="prop">navigateUp</span>: () =&gt;{" "}
              <span className="type">string | undefined</span>;{"\n"}
              {"  "}
              <span className="prop">navigateDown</span>: () =&gt;{" "}
              <span className="type">string | undefined</span>;{"\n"}
              {"  "}
              <span className="prop">reset</span>: () =&gt; <span className="type">void</span>;
              {"\n"}
              {"}"}
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "maxHistory",
                  type: "number | undefined",
                  required: false,
                  desc: "최대 히스토리 개수 (기본값: INPUT_HISTORY_MAX)",
                },
              ]}
            />

            {/* Return values */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">반환값</h4>
            <ParamTable
              params={[
                {
                  name: "history",
                  type: "readonly string[]",
                  required: true,
                  desc: "현재 히스토리 배열 (최신이 인덱스 0)",
                },
                {
                  name: "addToHistory",
                  type: "(input: string) => void",
                  required: true,
                  desc: "새 입력을 히스토리에 추가 (중복 제거 후 최신 위치로)",
                },
                {
                  name: "navigateUp",
                  type: "() => string | undefined",
                  required: true,
                  desc: "이전 입력으로 이동 (위 화살표). 히스토리가 비어있으면 undefined",
                },
                {
                  name: "navigateDown",
                  type: "() => string | undefined",
                  required: true,
                  desc: "다음 입력으로 이동 (아래 화살표). 끝이면 빈 문자열 반환",
                },
                {
                  name: "reset",
                  type: "() => void",
                  required: true,
                  desc: "히스토리 인덱스를 -1로 초기화 (현재 입력 모드로 복귀)",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">loadHistory()</code>와
                <code className="text-cyan-600">saveHistory()</code>는 <strong>동기</strong> fs
                함수를 사용합니다 (<code className="text-cyan-600">readFileSync</code>,{" "}
                <code className="text-cyan-600">writeFileSync</code>). 히스토리 파일이 매우 클 경우
                블로킹이 발생할 수 있지만,
                <code className="text-cyan-600">INPUT_HISTORY_MAX</code>로 크기를 제한하므로
                실제로는 문제되지 않습니다.
              </li>
              <li>
                첫 렌더링 시에는 디스크 저장을 건너뜁니다 (
                <code className="text-cyan-600">isFirstRender</code> ref 사용). 로드한 데이터를
                불필요하게 다시 쓰지 않기 위한 최적화입니다.
              </li>
              <li>
                <code className="text-cyan-600">historyIndex</code>가{" "}
                <code className="text-cyan-600">-1</code>이면 현재 입력 모드이고,{" "}
                <code className="text-cyan-600">0</code> 이상이면 히스토리 탐색 모드입니다.
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
              기본 사용법 &mdash; 입력창에서 히스토리 탐색
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              가장 일반적인 사용 패턴입니다. 사용자가 입력을 제출하면{" "}
              <code className="text-cyan-600">addToHistory</code>로 저장하고, 방향키로 이전 입력을
              탐색합니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> {"{"} <span className="prop">history</span>,{" "}
              <span className="prop">addToHistory</span>, <span className="prop">navigateUp</span>,{" "}
              <span className="prop">navigateDown</span>, <span className="prop">reset</span> {"}"}{" "}
              = <span className="fn">useInputHistory</span>();
              {"\n"}
              {"\n"}
              <span className="cm">{"// 사용자가 Enter를 눌렀을 때"}</span>
              {"\n"}
              <span className="kw">function</span> <span className="fn">handleSubmit</span>(
              <span className="prop">input</span>: <span className="type">string</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="fn">addToHistory</span>(<span className="prop">input</span>);{" "}
              <span className="cm">{"// 히스토리에 추가 + 디스크 저장"}</span>
              {"\n"}
              {"  "}
              <span className="fn">processInput</span>(<span className="prop">input</span>);
              {"\n"}
              {"}"}
              {"\n"}
              {"\n"}
              <span className="cm">{"// 위 화살표 키 핸들러"}</span>
              {"\n"}
              <span className="kw">function</span> <span className="fn">handleUpArrow</span>() {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">prev</span> ={" "}
              <span className="fn">navigateUp</span>();
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">prev</span> !=={" "}
              <span className="kw">undefined</span>) <span className="fn">setInputValue</span>(
              <span className="prop">prev</span>);
              {"\n"}
              {"}"}
              {"\n"}
              {"\n"}
              <span className="cm">{"// 아래 화살표 키 핸들러"}</span>
              {"\n"}
              <span className="kw">function</span> <span className="fn">handleDownArrow</span>(){" "}
              {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">next</span> ={" "}
              <span className="fn">navigateDown</span>();
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">next</span> !=={" "}
              <span className="kw">undefined</span>) <span className="fn">setInputValue</span>(
              <span className="prop">next</span>);
              {"\n"}
              {"}"}
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>navigateDown()</code>이 빈 문자열{" "}
              <code>&quot;&quot;</code>을 반환하면 히스토리 끝에 도달한 것입니다. 이때 입력창을
              비워주세요.
              <code>undefined</code>와 <code>&quot;&quot;</code>을 구분해야 합니다.
            </Callout>

            {/* 고급 사용법 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 중복 제거 동작
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              이미 히스토리에 있는 입력을 다시 제출하면, 기존 항목이 제거되고 최신 위치(인덱스 0)로
              이동합니다. 같은 명령을 반복 실행해도 히스토리가 중복으로 쌓이지 않습니다.
            </p>
            <CodeBlock>
              <span className="cm">{'// 히스토리: ["fix bug", "add test", "refactor"]'}</span>
              {"\n"}
              <span className="fn">addToHistory</span>(
              <span className="str">&quot;add test&quot;</span>);
              {"\n"}
              <span className="cm">{'// 결과: ["add test", "fix bug", "refactor"]'}</span>
              {"\n"}
              <span className="cm">
                {'// → "add test"가 기존 위치에서 제거되고 맨 앞으로 이동'}
              </span>
            </CodeBlock>

            <DeepDive title="디스크 동기화 타이밍">
              <p className="mb-3">
                히스토리 배열이 변경될 때마다 <code className="text-cyan-600">useEffect</code>가
                트리거되어 디스크에 자동 저장됩니다. 단, 첫 렌더링 시에는 저장하지 않습니다.
              </p>
              <CodeBlock>
                <span className="cm">{"// isFirstRender ref로 첫 렌더링 건너뛰기"}</span>
                {"\n"}
                <span className="fn">useEffect</span>(() =&gt; {"{"}
                {"\n"}
                {"  "}
                <span className="kw">if</span> (<span className="prop">isFirstRender</span>.
                <span className="prop">current</span>) {"{"}
                {"\n"}
                {"    "}
                <span className="prop">isFirstRender</span>.<span className="prop">current</span> ={" "}
                <span className="kw">false</span>;{"\n"}
                {"    "}
                <span className="kw">return</span>;{"\n"}
                {"  "}
                {"}"}
                {"\n"}
                {"  "}
                <span className="fn">saveHistory</span>(<span className="prop">history</span>);
                {"\n"}
                {"}"}, [<span className="prop">history</span>]);
              </CodeBlock>
              <p className="mt-3 text-gray-600">
                이 패턴은 &quot;로드한 데이터를 불필요하게 다시 쓰지 않기&quot; 위한 최적화입니다.
                초기 <code className="text-cyan-600">useState</code> 콜백에서{" "}
                <code className="text-cyan-600">loadHistory()</code>를 호출하므로, 첫 렌더링의{" "}
                <code className="text-cyan-600">history</code>는 이미 디스크와 동일합니다.
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
              히스토리 탐색 상태 다이어그램
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">historyIndex</code>는 현재 탐색 위치를 나타냅니다.
              <code className="text-cyan-600">-1</code>이면 현재 입력 모드이고,
              <code className="text-cyan-600">0</code> 이상이면 히스토리 탐색 모드입니다.
            </p>

            <MermaidDiagram
              title="히스토리 탐색 상태 전이"
              titleColor="purple"
              chart={`graph LR
  CURRENT["현재 입력 모드<br/><small>historyIndex = -1</small>"]
  NAV["히스토리 탐색 모드<br/><small>historyIndex >= 0</small>"]

  CURRENT -->|"navigateUp()"| NAV
  NAV -->|"navigateUp()<br/>인덱스 증가"| NAV
  NAV -->|"navigateDown()<br/>인덱스 감소"| NAV
  NAV -->|"navigateDown()<br/>인덱스 0에서"| CURRENT
  NAV -->|"addToHistory()<br/>또는 reset()"| CURRENT

  style CURRENT fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style NAV fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f,stroke-width:2px`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">addToHistory</code>의 중복 제거 로직입니다. 이미
              존재하는 입력을 필터링한 후 맨 앞에 추가합니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">addToHistory</span> ={" "}
              <span className="fn">useCallback</span>((<span className="prop">input</span>:{" "}
              <span className="type">string</span>) =&gt; {"{"}
              {"\n"}
              {"  "}
              <span className="fn">setHistory</span>((<span className="prop">prev</span>) =&gt;{" "}
              {"{"}
              {"\n"}
              {"    "}
              <span className="cm">{"// [1] 중복 제거: 같은 입력이 있으면 제거"}</span>
              {"\n"}
              {"    "}
              <span className="kw">const</span> <span className="prop">filtered</span> ={" "}
              <span className="prop">prev</span>.<span className="fn">filter</span>((
              <span className="prop">item</span>) =&gt; <span className="prop">item</span> !=={" "}
              <span className="prop">input</span>);
              {"\n"}
              {"    "}
              <span className="cm">{"// [2] 최신 입력을 맨 앞에 추가"}</span>
              {"\n"}
              {"    "}
              <span className="kw">const</span> <span className="prop">next</span> = [
              <span className="prop">input</span>, ...<span className="prop">filtered</span>];
              {"\n"}
              {"    "}
              <span className="cm">{"// [3] 최대 개수 초과 시 잘라내기"}</span>
              {"\n"}
              {"    "}
              <span className="kw">return</span> <span className="prop">next</span>.
              <span className="prop">length</span> &gt; <span className="prop">maxHistory</span>
              {"\n"}
              {"      "}? <span className="prop">next</span>.<span className="fn">slice</span>(
              <span className="num">0</span>, <span className="prop">maxHistory</span>) :{" "}
              <span className="prop">next</span>;{"\n"}
              {"  "}
              {"}"});
              {"\n"}
              {"  "}
              <span className="fn">setHistoryIndex</span>(<span className="num">-1</span>);{" "}
              <span className="cm">{"// [4] 현재 입력 모드로 복귀"}</span>
              {"\n"}
              {"}"}, [<span className="prop">maxHistory</span>]);
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong>{" "}
                <code className="text-cyan-600">filter</code>로 동일한 문자열을 가진 기존 항목을
                모두 제거합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> 새 입력을 배열 맨 앞(인덱스 0)에
                추가하여 &quot;최신순&quot; 정렬을 유지합니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong>{" "}
                <code className="text-cyan-600">maxHistory</code>를 초과하면 가장 오래된
                항목(뒤쪽)을 잘라냅니다.
              </p>
              <p>
                <strong className="text-gray-900">[4]</strong> 새 입력 추가 후 탐색 인덱스를
                리셋하여 현재 입력 모드로 돌아갑니다.
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
                &quot;앱을 재시작하면 히스토리가 사라져요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                <code className="text-cyan-600">~/.dbcode/input-history.json</code> 파일이
                존재하는지, 올바른 JSON 형식인지 확인하세요. 파일이 손상되면{" "}
                <code className="text-cyan-600">loadHistory()</code>가 빈 배열을 반환합니다.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;위 화살표를 눌러도 아무 반응이 없어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                히스토리가 비어 있으면 <code className="text-cyan-600">navigateUp()</code>이
                <code className="text-cyan-600">undefined</code>를 반환합니다. 최소 한 번 이상
                <code className="text-cyan-600">addToHistory()</code>를 호출해야 탐색이 가능합니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;같은 입력이 히스토리에 여러 번 나타나요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">addToHistory()</code>는 자동으로 중복을 제거합니다.
                이 현상이 발생한다면, 입력 문자열에 보이지 않는 공백이나 개행 문자가 포함되어 있지
                않은지 확인하세요. 문자열 비교는 정확 일치(
                <code className="text-cyan-600">===</code>)로 수행됩니다.
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
                  name: "useKeybindings.ts",
                  slug: "use-keybindings",
                  relation: "sibling",
                  desc: "방향키와 단축키를 감지하여 히스토리 탐색 함수를 호출하는 키바인딩 시스템",
                },
                {
                  name: "useAgentLoop.ts",
                  slug: "use-agent-loop",
                  relation: "parent",
                  desc: "에이전트 루프 React 브릿지 — 입력 제출 시 히스토리에 자동 추가",
                },
                {
                  name: "useStreaming.ts",
                  slug: "use-streaming",
                  relation: "sibling",
                  desc: "LLM 스트리밍 상태 관리 훅 — 같은 hooks 디렉토리의 형제 모듈",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
