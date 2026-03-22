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

export default function UseVoicePage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/cli/hooks/useVoice.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              useVoice
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="cli" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            마이크 녹음과 텍스트 변환(STT)의 전체 생명주기를 관리하는 React 훅입니다.
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
              <code className="text-cyan-600">useVoice</code>는 음성 입력 기능의 전체 사이클을
              관리하는 React 훅입니다. SoX(명령줄 오디오 도구)로 마이크 녹음을 수행하고,
              녹음이 끝나면 OpenAI Whisper API를 통해 음성을 텍스트로 변환합니다.
            </p>
            <p>
              동작 흐름은 간단합니다: <code className="text-cyan-600">/voice</code> 명령으로
              기능을 활성화한 후, <kbd>Alt+V</kbd>를 눌러
              <code className="text-cyan-600">toggleRecording()</code>을 호출합니다.
              첫 번째 호출에서 녹음이 시작되고, 두 번째 호출에서 녹음을 중지한 후
              Whisper API로 변환하여 <code className="text-cyan-600">onTranscription</code>
              콜백을 호출합니다.
            </p>
            <p>
              전제 조건으로 시스템에 <strong>SoX</strong>가 설치되어 있어야 하고,
              <code className="text-cyan-600">OPENAI_API_KEY</code> 환경변수가 설정되어 있어야 합니다.
              변환 실패 시 에러를 throw하지 않고 조용히 복구합니다.
            </p>
          </div>

          <MermaidDiagram
            title="useVoice 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  APP["App.tsx<br/><small>메인 앱</small>"]
  UV["useVoice<br/><small>음성 입력 훅</small>"]
  REC["recorder.ts<br/><small>SoX 녹음</small>"]
  TR["transcriber.ts<br/><small>Whisper API 변환</small>"]
  INPUT["UserInput<br/><small>텍스트 입력 필드</small>"]

  APP --> UV
  UV -->|"createRecorder()"| REC
  UV -->|"transcribe()"| TR
  UV -->|"onTranscription"| INPUT
  REC -->|"audioBuffer"| UV

  style UV fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style APP fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style REC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TR fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style INPUT fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 워키토키를 생각하세요. 버튼을 누르면 녹음이 시작되고,
            손을 떼면 녹음이 끝나면서 상대방에게 음성이 전달됩니다.
            <code className="text-cyan-600">toggleRecording()</code>이 바로 그 버튼입니다.
            다만 여기서는 음성이 텍스트로 변환되어 입력 필드에 채워집니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* UseVoiceOptions */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface UseVoiceOptions
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            <code className="text-cyan-600">useVoice()</code> 훅에 전달하는 설정 옵션입니다.
          </p>
          <ParamTable
            params={[
              { name: "language", type: "string", required: false, desc: "음성 인식 언어 (기본값: 'ko' 한국어). Whisper API의 language 파라미터로 전달됩니다." },
              { name: "soxPath", type: "string | undefined", required: false, desc: "SoX 실행 파일 경로 (선택적). 미설정 시 시스템 PATH에서 자동 탐색합니다." },
              { name: "onTranscription", type: "(text: string) => void", required: false, desc: "텍스트 변환 완료 시 호출되는 콜백. 변환된 텍스트(trim 적용됨)가 전달됩니다." },
            ]}
          />

          {/* UseVoiceReturn */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface UseVoiceReturn
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            <code className="text-cyan-600">useVoice()</code> 훅의 반환값입니다.
          </p>
          <ParamTable
            params={[
              { name: "isRecording", type: "boolean", required: true, desc: "현재 녹음 중 여부. true이면 마이크가 활성화된 상태입니다." },
              { name: "isTranscribing", type: "boolean", required: true, desc: "Whisper API 변환 중 여부. true이면 녹음은 끝났지만 텍스트 변환이 진행 중입니다." },
              { name: "lastTranscription", type: "string | undefined", required: true, desc: "마지막으로 변환된 텍스트. 아직 변환된 적이 없으면 undefined입니다." },
              { name: "voiceEnabled", type: "boolean", required: true, desc: "음성 입력 기능 활성화 여부. false이면 toggleRecording()이 무시됩니다." },
              { name: "setVoiceEnabled", type: "(enabled: boolean) => void", required: true, desc: "음성 기능 활성화/비활성화 함수. /voice 명령이 이 함수를 호출합니다." },
              { name: "toggleRecording", type: "() => void", required: true, desc: "녹음 시작/중지 토글. Alt+V 키가 이 함수에 바인딩됩니다." },
            ]}
          />

          {/* useVoice 시그니처 */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            useVoice(options?)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            음성 입력 생명주기 관리 훅의 시그니처입니다.
          </p>
          <CodeBlock>
            <span className="kw">export function</span> <span className="fn">useVoice</span>(
            {"\n"}{"  "}<span className="prop">options</span>?: <span className="type">UseVoiceOptions</span>
            {"\n"}): <span className="type">UseVoiceReturn</span>
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">voiceEnabled</code>가
              <code className="text-cyan-600">false</code>이면
              <code className="text-cyan-600">toggleRecording()</code>이 아무 동작도 하지 않습니다.
              반드시 <code className="text-cyan-600">/voice</code> 명령으로 먼저 활성화해야 합니다.
            </li>
            <li>
              <code className="text-cyan-600">OPENAI_API_KEY</code> 환경변수가 없거나
              녹음 데이터가 비어 있으면 변환을 건너뜁니다.
            </li>
            <li>
              변환 실패 시 에러를 throw하지 않고 <code className="text-cyan-600">catch</code>에서
              조용히 복구합니다. 사용자에게 실패 알림이 표시되지 않습니다.
            </li>
            <li>
              이미 녹음 중이거나 변환 중일 때 <code className="text-cyan-600">toggleRecording()</code>을
              호출하면, 녹음 중이면 중지+변환, 변환 중이면 무시됩니다.
            </li>
            <li>
              <code className="text-cyan-600">recorderRef</code>는
              <code className="text-cyan-600">useRef</code>로 관리되어 리렌더링을 유발하지 않습니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 컴포넌트에서 사용하기</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            App.tsx에서 훅을 호출하고, 변환된 텍스트를 입력 필드에 채웁니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{"} <span className="fn">useVoice</span> {"}"} <span className="kw">from</span> <span className="str">&quot;./hooks/useVoice.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="kw">function</span> <span className="fn">App</span>() {"{"}
            {"\n"}{"  "}<span className="kw">const</span> {"{"} <span className="prop">isRecording</span>, <span className="prop">isTranscribing</span>, <span className="prop">toggleRecording</span> {"}"} =
            {"\n"}{"    "}<span className="fn">useVoice</span>({"{"}
            {"\n"}{"      "}<span className="prop">language</span>: <span className="str">&quot;ko&quot;</span>,
            {"\n"}{"      "}<span className="prop">onTranscription</span>: (<span className="prop">text</span>) =&gt; {"{"}
            {"\n"}{"        "}<span className="cm">{"// 변환된 텍스트를 입력 필드에 설정"}</span>
            {"\n"}{"        "}<span className="fn">setInputText</span>(<span className="prop">text</span>);
            {"\n"}{"      "}{"}"}{","}
            {"\n"}{"    "}{"}"});
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// Alt+V 키에 toggleRecording 바인딩"}</span>
            {"\n"}{"  "}<span className="fn">useKeybindings</span>({"{"} <span className="str">&quot;alt+v&quot;</span>: <span className="prop">toggleRecording</span> {"}"});
            {"\n"}
            {"\n"}{"  "}<span className="kw">return</span> (
            {"\n"}{"    "}{"<"}<span className="type">Box</span>{">"}
            {"\n"}{"      "}{"{"}isRecording && {"<"}<span className="type">Text</span> <span className="prop">color</span>=<span className="str">&quot;red&quot;</span>{">"}🎙 녹음 중...{"</"}<span className="type">Text</span>{">"}{"}"}
            {"\n"}{"      "}{"{"}isTranscribing && {"<"}<span className="type">Text</span>{">"}변환 중...{"</"}<span className="type">Text</span>{">"}{"}"}
            {"\n"}{"    "}{"</"}<span className="type">Box</span>{">"}
            {"\n"}{"  "});
            {"\n"}{"}"}
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> SoX가 시스템에 설치되어 있지 않으면 녹음이 시작되지 않습니다.
            macOS: <code>brew install sox</code>, Ubuntu: <code>apt install sox</code>로 설치하세요.
          </Callout>

          {/* 고급: 언어 변경 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 다른 언어로 음성 인식
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">language</code> 옵션으로
            Whisper가 지원하는 언어 코드를 전달할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 영어 음성 인식"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">voice</span> = <span className="fn">useVoice</span>({"{"} <span className="prop">language</span>: <span className="str">&quot;en&quot;</span> {"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 일본어 음성 인식"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">voice</span> = <span className="fn">useVoice</span>({"{"} <span className="prop">language</span>: <span className="str">&quot;ja&quot;</span> {"}"});
          </CodeBlock>

          <DeepDive title="toggleRecording() 상태 전이 상세">
            <p className="mb-3">
              <code className="text-cyan-600">toggleRecording()</code>의 동작은
              현재 상태에 따라 달라집니다:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li><strong>voiceEnabled=false</strong>: 즉시 return (아무 동작 없음)</li>
              <li><strong>isRecording=true</strong>: 녹음 중지 &rarr; recorderRef 해제 &rarr; isTranscribing=true &rarr; Whisper API 호출</li>
              <li><strong>isRecording=false, isTranscribing=false</strong>: 새 녹음 시작 &rarr; createRecorder() &rarr; isRecording=true</li>
              <li><strong>isTranscribing=true</strong>: 이미 변환 중이므로 무시 (중복 방지)</li>
            </ul>
            <p className="mt-3 text-amber-600">
              <code>useCallback</code>의 의존성 배열에
              <code>[voiceEnabled, isRecording, isTranscribing, language, soxPath, onTranscription]</code>이
              모두 포함되어 있으므로, 이 값들이 변경되면 <code>toggleRecording</code> 함수도 재생성됩니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>음성 입력 상태 전이 다이어그램</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            useVoice는 3가지 상태 사이를 전이합니다:
            대기(idle), 녹음 중(recording), 변환 중(transcribing).
          </p>

          <MermaidDiagram
            title="useVoice 상태 전이"
            titleColor="purple"
            chart={`graph TD
  DISABLED(("voiceEnabled=false<br/><small>비활성</small>"))
  IDLE["Idle<br/><small>대기 — 입력 대기</small>"]
  REC["Recording<br/><small>녹음 중 — SoX 실행</small>"]
  TRANS["Transcribing<br/><small>변환 중 — Whisper API</small>"]

  DISABLED -->|"setVoiceEnabled(true)"| IDLE
  IDLE -->|"toggleRecording()"| REC
  REC -->|"toggleRecording()"| TRANS
  TRANS -->|"성공/실패"| IDLE
  IDLE -->|"setVoiceEnabled(false)"| DISABLED

  style DISABLED fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style IDLE fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style REC fill:#fee2e2,stroke:#ef4444,color:#991b1b,stroke-width:2px
  style TRANS fill:#fef3c7,stroke:#f59e0b,color:#78350f,stroke-width:2px`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석 &mdash; 녹음 중지 및 변환</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">toggleRecording()</code>에서
            녹음을 중지하고 Whisper API로 변환하는 부분입니다.
          </p>
          <CodeBlock>
            <span className="kw">if</span> (<span className="prop">isRecording</span> && <span className="prop">recorderRef</span>.<span className="prop">current</span>) {"{"}
            {"\n"}{"  "}<span className="cm">{"// [1] recorder 참조 해제 후 녹음 중지"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">recorder</span> = <span className="prop">recorderRef</span>.<span className="prop">current</span>;
            {"\n"}{"  "}<span className="prop">recorderRef</span>.<span className="prop">current</span> = <span className="kw">null</span>;
            {"\n"}{"  "}<span className="fn">setIsRecording</span>(<span className="kw">false</span>);
            {"\n"}{"  "}<span className="fn">setIsTranscribing</span>(<span className="kw">true</span>);
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [2] 녹음 중지 → 오디오 버퍼 획득"}</span>
            {"\n"}{"  "}<span className="kw">void</span> <span className="prop">recorder</span>.<span className="fn">stop</span>().<span className="fn">then</span>(<span className="kw">async</span> (<span className="prop">audioBuffer</span>) =&gt; {"{"}
            {"\n"}{"    "}<span className="kw">try</span> {"{"}
            {"\n"}{"      "}<span className="cm">{"// [3] API 키 확인 + 빈 오디오 체크"}</span>
            {"\n"}{"      "}<span className="kw">const</span> <span className="prop">apiKey</span> = <span className="prop">process</span>.<span className="prop">env</span>.<span className="prop">OPENAI_API_KEY</span>;
            {"\n"}{"      "}<span className="kw">if</span> (!<span className="prop">apiKey</span> || <span className="prop">audioBuffer</span>.<span className="prop">length</span> === <span className="num">0</span>) <span className="kw">return</span>;
            {"\n"}
            {"\n"}{"      "}<span className="cm">{"// [4] Whisper API 호출"}</span>
            {"\n"}{"      "}<span className="kw">const</span> <span className="prop">result</span> = <span className="kw">await</span> <span className="fn">transcribe</span>(<span className="prop">audioBuffer</span>, {"{"} <span className="prop">apiKey</span>, <span className="prop">language</span> {"}"});
            {"\n"}
            {"\n"}{"      "}<span className="cm">{"// [5] 빈 결과가 아니면 콜백 호출"}</span>
            {"\n"}{"      "}<span className="kw">if</span> (<span className="prop">result</span>.<span className="prop">text</span>.<span className="fn">trim</span>()) {"{"}
            {"\n"}{"        "}<span className="fn">setLastTranscription</span>(<span className="prop">result</span>.<span className="prop">text</span>.<span className="fn">trim</span>());
            {"\n"}{"        "}<span className="prop">onTranscription</span>?.(<span className="prop">result</span>.<span className="prop">text</span>.<span className="fn">trim</span>());
            {"\n"}{"      "}{"}"}
            {"\n"}{"    "}<span className="kw">{"}"} catch {"{"}</span>
            {"\n"}{"      "}<span className="cm">{"// [6] 변환 실패 — 조용히 복구"}</span>
            {"\n"}{"    "}<span className="kw">{"}"} finally {"{"}</span>
            {"\n"}{"      "}<span className="fn">setIsTranscribing</span>(<span className="kw">false</span>);
            {"\n"}{"    "}{"}"}
            {"\n"}{"  "}{"}"});
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> recorderRef를 먼저 null로 설정하여 중복 호출을 방지합니다.</p>
            <p><strong className="text-gray-900">[2]</strong> <code className="text-cyan-600">void</code> 키워드로 Promise를 의도적으로 무시합니다. 이벤트 핸들러에서 await하면 안 되기 때문입니다.</p>
            <p><strong className="text-gray-900">[3]</strong> API 키가 없거나 오디오 데이터가 비어 있으면 변환을 건너뜁니다.</p>
            <p><strong className="text-gray-900">[4]</strong> <code className="text-cyan-600">transcribe()</code>는 <code>voice/transcriber.ts</code>에 정의된 Whisper API 래퍼입니다.</p>
            <p><strong className="text-gray-900">[5]</strong> 빈 문자열이 아닌 경우에만 상태를 업데이트하고 콜백을 호출합니다. <code>trim()</code>이 3번 호출되지만 문자열은 불변이므로 성능 문제는 없습니다.</p>
            <p><strong className="text-gray-900">[6]</strong> <code>catch</code> 블록이 비어 있어 모든 에러를 삼킵니다. 이는 의도적인 설계입니다.</p>
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
              &quot;Alt+V를 눌러도 아무 반응이 없어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              세 가지를 확인하세요:
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">/voice</code> 명령으로 음성 기능을 활성화했는지 확인.
                <code className="text-cyan-600">voiceEnabled</code>가 <code>false</code>이면
                <code>toggleRecording()</code>이 무시됩니다.
              </li>
              <li>
                SoX가 설치되어 있는지 확인: <code>sox --version</code>으로 테스트하세요.
              </li>
              <li>
                이미 변환 중(<code>isTranscribing=true</code>)이면 새 녹음이 시작되지 않습니다.
                변환이 완료될 때까지 기다리세요.
              </li>
            </ul>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;녹음은 되는데 텍스트로 변환되지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">OPENAI_API_KEY</code> 환경변수가
              설정되어 있는지 확인하세요. API 키가 없으면 변환 단계를 건너뜁니다.
              또한 녹음 시간이 너무 짧으면 오디오 버퍼가 비어 있을 수 있습니다.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;한국어 인식 정확도가 낮아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">language</code> 옵션이
              <code className="text-cyan-600">&quot;ko&quot;</code>로 설정되어 있는지 확인하세요.
              기본값이 <code>&quot;ko&quot;</code>이므로 별도 설정 없이도 한국어를 인식합니다.
              외부 환경(배경 소음, 마이크 품질)이 인식 정확도에 영향을 줄 수 있습니다.
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
                name: "voice-recorder",
                slug: "voice-recorder",
                relation: "child",
                desc: "SoX를 사용한 마이크 녹음 모듈 — useVoice가 createRecorder()를 호출",
              },
              {
                name: "useKeybindings",
                slug: "use-keybindings",
                relation: "sibling",
                desc: "키 바인딩 훅 — Alt+V를 toggleRecording()에 연결",
              },
              {
                name: "useInput",
                slug: "use-input",
                relation: "sibling",
                desc: "사용자 입력 훅 — 음성 변환 결과가 이 훅의 텍스트 필드에 채워짐",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
