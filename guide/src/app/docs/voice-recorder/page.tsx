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

export default function VoiceRecorderPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/voice/recorder.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">Voice Recorder</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              SoX(Sound eXchange)를 사용한 마이크 녹음 모듈입니다. 시스템의 기본 마이크에서 PCM
              오디오를 캡처하여 WAV 형식의 Buffer로 반환합니다.
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
                dbcode의 <code className="text-cyan-600">/voice</code> 명령은 음성으로 프롬프트를
                입력할 수 있게 합니다. 이 모듈은 SoX 명령줄 도구를 자식 프로세스로 실행하여
                마이크에서 오디오를 캡처합니다. 캡처된 오디오는 Whisper API로 전송되어 텍스트로
                변환됩니다.
              </p>
              <p>
                녹음 설정은 Whisper API에 최적화되어 있습니다: 16000 Hz 샘플 레이트, 모노 채널,
                16비트 signed-integer PCM 인코딩, WAV 형식. SoX의 stdout으로 오디오 데이터가
                스트리밍되며, 녹음 종료 시 Buffer로 합쳐집니다.
              </p>
              <p>
                SIGTERM으로 정상 종료하면 WAV 헤더가 올바르게 마무리되고, SIGKILL로 취소하면
                데이터가 즉시 폐기됩니다.
              </p>
            </div>

            <MermaidDiagram
              title="음성 녹음 아키텍처"
              titleColor="purple"
              chart={`graph TD
  USER["사용자<br/><small>/voice 명령</small>"]
  RECORDER["createRecorder()<br/><small>recorder.ts</small>"]
  SOX["SoX 프로세스<br/><small>자식 프로세스</small>"]
  MIC["마이크<br/><small>기본 입력 장치</small>"]
  BUFFER["WAV Buffer<br/><small>오디오 데이터</small>"]
  WHISPER["Whisper API<br/><small>음성→텍스트</small>"]
  CHECK["checkSoxInstalled()<br/><small>SoX 설치 확인</small>"]

  USER --> RECORDER
  CHECK -.->|"사전 확인"| RECORDER
  RECORDER -->|"spawn()"| SOX
  SOX -->|"stdin: -d"| MIC
  SOX -->|"stdout: WAV"| BUFFER
  BUFFER -->|"stop() 후"| WHISPER

  style RECORDER fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style SOX fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style MIC fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style BUFFER fill:#dcfce7,stroke:#10b981,color:#065f46
  style WHISPER fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style CHECK fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>외부 의존성:</strong> SoX는 시스템에 별도로 설치해야 합니다. macOS:{" "}
              <code>brew install sox</code>, Ubuntu: <code>apt install sox</code>, Windows:{" "}
              <code>choco install sox</code>.
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

            {/* RecorderOptions */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface RecorderOptions
            </h3>
            <ParamTable
              params={[
                {
                  name: "sampleRate",
                  type: "number",
                  required: false,
                  desc: "샘플 레이트 Hz (기본값: 16000 — Whisper 권장)",
                },
                {
                  name: "channels",
                  type: "number",
                  required: false,
                  desc: "오디오 채널 수 (기본값: 1 — 모노)",
                },
                {
                  name: "soxPath",
                  type: "string",
                  required: false,
                  desc: 'SoX 실행 파일 경로 (기본값: "sox" — PATH에서 탐색)',
                },
              ]}
            />

            {/* RecorderHandle */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface RecorderHandle
            </h3>
            <ParamTable
              params={[
                {
                  name: "stop",
                  type: "() => Promise<Buffer>",
                  required: true,
                  desc: "녹음 정상 종료 (SIGTERM) — WAV Buffer 반환",
                },
                {
                  name: "cancel",
                  type: "() => void",
                  required: true,
                  desc: "녹음 즉시 취소 (SIGKILL) — 데이터 폐기",
                },
                {
                  name: "isRecording",
                  type: "boolean (getter)",
                  required: true,
                  desc: "현재 녹음 중인지 여부",
                },
              ]}
            />

            {/* createRecorder */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              createRecorder(options?)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              SoX를 사용하여 마이크 녹음기를 생성합니다. 호출 즉시 녹음이 시작됩니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">createRecorder</span>(
              <span className="prop">options</span>?: <span className="type">RecorderOptions</span>
              ): <span className="type">RecorderHandle</span>
            </CodeBlock>

            {/* checkSoxInstalled */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              checkSoxInstalled(soxPath?)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              SoX가 시스템에 설치되어 있고 사용 가능한지 확인합니다.
            </p>
            <CodeBlock>
              <span className="kw">async function</span>{" "}
              <span className="fn">checkSoxInstalled</span>(<span className="prop">soxPath</span>?:{" "}
              <span className="type">string</span>):{" "}
              <span className="type">Promise&lt;boolean&gt;</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "soxPath",
                  type: "string",
                  required: false,
                  desc: 'SoX 실행 파일 경로 (기본값: "sox")',
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                SoX가 시스템에 설치되어 있어야 합니다. 설치되지 않으면
                <code className="text-cyan-600">createRecorder()</code>가 에러 이벤트를
                발생시킵니다.
                <code className="text-cyan-600">checkSoxInstalled()</code>로 사전 확인하세요.
              </li>
              <li>
                <code className="text-cyan-600">stop()</code>은 SIGTERM을 보내 WAV 헤더를 올바르게
                마무리합니다.
                <code className="text-cyan-600">cancel()</code>의 SIGKILL은 즉시 종료하므로 WAV
                파일이 손상될 수 있습니다.
              </li>
              <li>
                <code className="text-cyan-600">createRecorder()</code> 호출 즉시 녹음이 시작됩니다.
                사용자에게 녹음 시작을 알린 후 호출하세요.
              </li>
              <li>
                마이크 접근 권한이 필요합니다. macOS에서는 시스템 설정에서 마이크 접근을 허용해야
                합니다.
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
              기본 사용법 &mdash; 녹음 시작/종료
            </h3>
            <CodeBlock>
              <span className="kw">import</span> {"{"} <span className="prop">createRecorder</span>,{" "}
              <span className="prop">checkSoxInstalled</span> {"}"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./voice/recorder.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 1. SoX 설치 확인"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">hasSox</span> ={" "}
              <span className="kw">await</span> <span className="fn">checkSoxInstalled</span>();
              {"\n"}
              <span className="kw">if</span> (!<span className="prop">hasSox</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="str">&quot;SoX를 설치하세요: brew install sox&quot;</span>);
              {"\n"}
              {"  "}
              <span className="kw">return</span>;{"\n"}
              {"}"}
              {"\n"}
              {"\n"}
              <span className="cm">{"// 2. 녹음 시작 (즉시 시작됨)"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">recorder</span> ={" "}
              <span className="fn">createRecorder</span>();
              {"\n"}
              {"\n"}
              <span className="cm">{"// 3. 사용자가 말하는 동안 대기..."}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 4. 녹음 종료 — WAV Buffer 반환"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">audioBuffer</span> ={" "}
              <span className="kw">await</span> <span className="prop">recorder</span>.
              <span className="fn">stop</span>();
              {"\n"}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="str">`녹음 완료: ${"{"}</span>
              <span className="prop">audioBuffer</span>.<span className="prop">length</span>
              <span className="str">{"}"} bytes`</span>);
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>createRecorder()</code> 호출 시점부터 녹음이 시작됩니다.
              &quot;녹음 시작&quot; UI를 먼저 표시한 후 호출하세요. 그렇지 않으면 사용자가 녹음
              시작을 인지하기 전에 오디오가 캡처됩니다.
            </Callout>

            {/* 녹음 취소 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              녹음 취소
            </h3>
            <CodeBlock>
              <span className="cm">{"// 사용자가 Esc 키를 누르면 녹음 취소"}</span>
              {"\n"}
              <span className="kw">if</span> (<span className="prop">recorder</span>.
              <span className="prop">isRecording</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="prop">recorder</span>.<span className="fn">cancel</span>();{" "}
              <span className="cm">{"// SIGKILL — 즉시 종료"}</span>
              {"\n"}
              {"}"}
            </CodeBlock>

            {/* 커스텀 설정 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 커스텀 녹음 설정
            </h3>
            <CodeBlock>
              <span className="cm">{"// 고품질 녹음 설정"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">recorder</span> ={" "}
              <span className="fn">createRecorder</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">sampleRate</span>: <span className="num">44100</span>,{" "}
              <span className="cm">{"// CD 품질"}</span>
              {"\n"}
              {"  "}
              <span className="prop">channels</span>: <span className="num">2</span>,{" "}
              <span className="cm">{"// 스테레오"}</span>
              {"\n"}
              {"  "}
              <span className="prop">soxPath</span>:{" "}
              <span className="str">&quot;/usr/local/bin/sox&quot;</span>,{" "}
              <span className="cm">{"// 커스텀 경로"}</span>
              {"\n"}
              {"}"});
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> Whisper API는 16000 Hz 모노를 권장합니다. 더 높은 샘플 레이트는
              파일 크기만 커지고 인식 품질은 거의 향상되지 않습니다.
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
              녹음 라이프사이클
            </h3>

            <MermaidDiagram
              title="녹음 상태 전이"
              titleColor="purple"
              chart={`stateDiagram-v2
  [*] --> Recording: createRecorder()
  Recording --> Recording: stdout data → chunks.push()
  Recording --> Stopped: stop() → SIGTERM
  Recording --> Cancelled: cancel() → SIGKILL
  Stopped --> [*]: Buffer.concat(chunks)
  Cancelled --> [*]: 데이터 폐기

  note right of Recording
    SoX 프로세스 실행 중
    stdout으로 WAV 데이터 스트리밍
  end note

  note right of Stopped
    SIGTERM으로 우아한 종료
    WAV 헤더 올바르게 마무리
  end note`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              SoX 명령줄 인수
            </h3>
            <CodeBlock>
              <span className="fn">spawn</span>(<span className="str">&quot;sox&quot;</span>, [
              {"\n"}
              {"  "}
              <span className="str">&quot;-d&quot;</span>,{" "}
              <span className="cm">{"// 기본 입력 장치 (마이크)"}</span>
              {"\n"}
              {"  "}
              <span className="str">&quot;-t&quot;</span>,{" "}
              <span className="str">&quot;wav&quot;</span>,{" "}
              <span className="cm">{"// 출력 형식: WAV"}</span>
              {"\n"}
              {"  "}
              <span className="str">&quot;-r&quot;</span>,{" "}
              <span className="str">&quot;16000&quot;</span>,{" "}
              <span className="cm">{"// 샘플 레이트: 16000 Hz"}</span>
              {"\n"}
              {"  "}
              <span className="str">&quot;-c&quot;</span>,{" "}
              <span className="str">&quot;1&quot;</span>,{" "}
              <span className="cm">{"// 채널: 모노"}</span>
              {"\n"}
              {"  "}
              <span className="str">&quot;-b&quot;</span>,{" "}
              <span className="str">&quot;16&quot;</span>,{" "}
              <span className="cm">{"// 비트 깊이: 16비트"}</span>
              {"\n"}
              {"  "}
              <span className="str">&quot;-e&quot;</span>,{" "}
              <span className="str">&quot;signed-integer&quot;</span>,{" "}
              <span className="cm">{"// 인코딩: PCM"}</span>
              {"\n"}
              {"  "}
              <span className="str">&quot;-&quot;</span>,{" "}
              <span className="cm">{"// 파일 대신 stdout으로 출력"}</span>
              {"\n"}]);
            </CodeBlock>

            <DeepDive title="SIGTERM vs SIGKILL의 차이">
              <p className="mb-3">두 시그널은 프로세스 종료 방식이 다릅니다:</p>
              <div className="bg-white border border-gray-200 rounded-xl p-5 text-[13px] text-gray-600 space-y-2.5">
                <p>
                  <strong className="text-gray-900">SIGTERM (stop)</strong> &mdash; 프로세스에
                  &quot;종료해 달라&quot;고 요청합니다. SoX는 이 시그널을 받으면 WAV 헤더의 파일
                  크기 필드를 올바르게 업데이트하고 종료합니다. 결과 Buffer는 유효한 WAV 파일입니다.
                </p>
                <p>
                  <strong className="text-gray-900">SIGKILL (cancel)</strong> &mdash; 프로세스를
                  즉시 강제 종료합니다. SoX가 WAV 헤더를 마무리할 기회가 없으므로 결과 Buffer는
                  손상된 WAV일 수 있습니다. 취소 시에는 데이터를 사용하지 않으므로 문제없습니다.
                </p>
              </div>
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
                &quot;SoX가 설치되어 있는데 checkSoxInstalled()가 false를 반환해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                SoX 실행 파일이 PATH에 있는지 확인하세요.{" "}
                <code className="text-cyan-600">which sox</code>
                (macOS/Linux) 또는 <code className="text-cyan-600">where sox</code>(Windows)로
                경로를 확인하세요. PATH에 없으면 <code className="text-cyan-600">soxPath</code>{" "}
                옵션으로 직접 지정하세요.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;마이크 접근이 거부됩니다&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                macOS: 시스템 설정 &gt; 개인정보 보호 및 보안 &gt; 마이크에서 터미널 앱에 마이크
                접근을 허용하세요. Linux: PulseAudio 또는 ALSA 설정에서 마이크 입력이 활성화되어
                있는지 확인하세요.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;녹음된 오디오가 비어 있어요 (0 bytes)&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                SoX 프로세스가 에러를 발생시켰을 수 있습니다. 터미널에서 직접
                <code className="text-cyan-600">
                  sox -d -t wav -r 16000 -c 1 -b 16 -e signed-integer test.wav
                </code>
                를 실행하여 정상 녹음되는지 확인하세요. 마이크가 다른 앱에 의해 점유되어 있을 수도
                있습니다.
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
                  name: "events.ts",
                  slug: "utils-events",
                  relation: "sibling",
                  desc: "voice:toggle 이벤트를 통해 음성 입력 활성화/비활성화를 알립니다",
                },
                {
                  name: "platform.ts",
                  slug: "utils-platform",
                  relation: "sibling",
                  desc: "플랫폼별 SoX 설치 경로와 마이크 접근 방식이 다릅니다",
                },
                {
                  name: "llm-client.ts",
                  slug: "llm-client",
                  relation: "parent",
                  desc: "녹음된 오디오를 Whisper API로 전송하여 텍스트로 변환합니다",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
