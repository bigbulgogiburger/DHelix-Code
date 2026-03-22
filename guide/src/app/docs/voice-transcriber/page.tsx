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

export default function VoiceTranscriberPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/voice/transcriber.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">Voice Transcriber</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              OpenAI Whisper API를 사용하여 오디오 Buffer를 텍스트로 변환(STT)하는 모듈입니다.
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
                <code className="text-cyan-600">transcribe()</code>는 녹음된 오디오 Buffer를 OpenAI
                Whisper API에 전송하여 텍스트로 변환합니다. 한국어(ko)를 포함한 다양한 언어의 음성을
                인식할 수 있습니다.
              </p>
              <p>
                함수 하나(<code className="text-cyan-600">transcribe</code>)로 구성된 간결한
                모듈입니다. WAV 형식의 오디오 Buffer를 받아 OpenAI SDK를 통해 Whisper API를
                호출하고, 인식된 텍스트, 소요 시간, 감지된 언어를 반환합니다.
              </p>
              <p>
                커스텀 엔드포인트(<code className="text-cyan-600">baseUrl</code>)를 지원하여 OpenAI
                호환 API를 제공하는 로컬/서드파티 서비스도 사용할 수 있습니다.
              </p>
            </div>

            <MermaidDiagram
              title="Voice Transcriber 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  RECORDER["voice/recorder.ts<br/><small>오디오 녹음 → Buffer</small>"]
  TRANSCRIBER["transcribe()<br/><small>voice/transcriber.ts</small>"]
  OPENAI["OpenAI Whisper API<br/><small>whisper-1 모델</small>"]
  RESULT["TranscribeResult<br/><small>text, duration, language</small>"]
  INPUT["사용자 입력 처리<br/><small>음성을 텍스트로 변환 후 프롬프트에 전달</small>"]

  RECORDER -->|"audioBuffer"| TRANSCRIBER
  TRANSCRIBER -->|"File + API 호출"| OPENAI
  OPENAI -->|"응답"| RESULT
  RESULT -->|"text"| INPUT

  style TRANSCRIBER fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style RECORDER fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style OPENAI fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46
  style INPUT fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 통역사를 떠올리세요. Voice Transcriber는 사용자의
              음성(오디오)을 듣고 텍스트로 받아쓰는 통역사입니다. 어떤 언어로 말하는지 지정하면(
              <code>language: &quot;ko&quot;</code>) 더 정확하게 인식합니다.
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

            {/* TranscribeOptions */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface TranscribeOptions
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              Whisper API 호출에 필요한 설정 옵션입니다.
            </p>
            <ParamTable
              params={[
                { name: "apiKey", type: "string", required: true, desc: "OpenAI API 키 (필수)" },
                {
                  name: "baseUrl",
                  type: "string | undefined",
                  required: false,
                  desc: "커스텀 API 엔드포인트 URL (OpenAI 호환 서비스용)",
                },
                {
                  name: "model",
                  type: "string | undefined",
                  required: false,
                  desc: 'Whisper 모델명 (기본: "whisper-1")',
                },
                {
                  name: "language",
                  type: "string | undefined",
                  required: false,
                  desc: '인식할 언어 (ISO 639-1, 예: "ko", "en")',
                },
              ]}
            />

            {/* TranscribeResult */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface TranscribeResult
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              음성 인식 결과를 담는 인터페이스입니다.
            </p>
            <ParamTable
              params={[
                { name: "text", type: "string", required: true, desc: "인식된 텍스트" },
                {
                  name: "duration",
                  type: "number",
                  required: true,
                  desc: "API 호출 소요 시간 (초)",
                },
                {
                  name: "language",
                  type: "string",
                  required: true,
                  desc: "감지된 또는 지정된 언어 코드",
                },
              ]}
            />

            {/* transcribe function */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              transcribe(audioBuffer, options)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              오디오 Buffer를 OpenAI Whisper API로 전사(transcribe)합니다.
            </p>
            <CodeBlock>
              <span className="kw">async function</span> <span className="fn">transcribe</span>(
              {"\n"}
              {"  "}
              <span className="prop">audioBuffer</span>: <span className="type">Buffer</span>,{"\n"}
              {"  "}
              <span className="prop">options</span>: <span className="type">TranscribeOptions</span>
              ,{"\n"}): <span className="type">Promise</span>&lt;
              <span className="type">TranscribeResult</span>&gt;
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "audioBuffer",
                  type: "Buffer",
                  required: true,
                  desc: "WAV 형식의 오디오 데이터 (recorder.stop()에서 반환)",
                },
                {
                  name: "options",
                  type: "TranscribeOptions",
                  required: true,
                  desc: "API 키, 모델, 언어 등 설정",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">apiKey</code>는 <strong>필수</strong>입니다. API 키
                없이 호출하면 OpenAI SDK에서 에러가 발생합니다.
              </li>
              <li>
                <code className="text-cyan-600">language</code>를 지정하면 해당 언어 인식 정확도가
                향상됩니다. 미지정 시 Whisper가 자동으로 언어를 감지하지만, 짧은 음성에서는 오탐이
                있을 수 있습니다.
              </li>
              <li>
                오디오는 <strong>WAV 형식</strong>이어야 합니다.
                <code className="text-cyan-600">
                  new File([audioBuffer], &quot;recording.wav&quot;)
                </code>
                로 변환됩니다.
              </li>
              <li>
                <code className="text-cyan-600">response_format: &quot;verbose_json&quot;</code>을
                사용하므로 감지된 언어 등 상세 정보가 포함됩니다.
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
              기본 사용법 &mdash; 음성을 텍스트로 변환
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              녹음된 오디오 Buffer를 Whisper API에 전송하여 텍스트를 얻습니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{ "}
              <span className="fn">transcribe</span>
              {" }"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./voice/transcriber.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="kw">await</span> <span className="fn">transcribe</span>(
              <span className="prop">audioBuffer</span>, {"{"}
              {"\n"}
              {"  "}
              <span className="prop">apiKey</span>: <span className="prop">process</span>.
              <span className="prop">env</span>.<span className="prop">OPENAI_API_KEY</span>!,
              {"\n"}
              {"  "}
              <span className="prop">language</span>: <span className="str">&quot;ko&quot;</span>,{" "}
              <span className="cm">{"// 한국어 인식 정확도 향상"}</span>
              {"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="kw">if</span> (<span className="prop">result</span>.
              <span className="prop">text</span>.<span className="fn">trim</span>()) {"{"}
              {"\n"}
              {"  "}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="str">
                `인식 결과: ${"{"}result.text{"}"}`
              </span>
              );
              {"\n"}
              {"  "}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="str">
                `소요 시간: ${"{"}result.duration{"}"}초`
              </span>
              );
              {"\n"}
              {"  "}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="str">
                `언어: ${"{"}result.language{"}"}`
              </span>
              );
              {"\n"}
              {"}"}
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>OPENAI_API_KEY</code> 환경 변수가 설정되지 않으면 API
              호출이 실패합니다. 반드시 유효한 API 키를 제공하세요.
            </Callout>

            {/* 커스텀 엔드포인트 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 커스텀 엔드포인트 사용
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              OpenAI 호환 API(예: Azure, 로컬 Whisper 서버)를 사용할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="kw">await</span> <span className="fn">transcribe</span>(
              <span className="prop">audioBuffer</span>, {"{"}
              {"\n"}
              {"  "}
              <span className="prop">apiKey</span>:{" "}
              <span className="str">&quot;local-key&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">baseUrl</span>:{" "}
              <span className="str">&quot;http://localhost:8080/v1&quot;</span>,{" "}
              <span className="cm">{"// 로컬 Whisper 서버"}</span>
              {"\n"}
              {"  "}
              <span className="prop">model</span>:{" "}
              <span className="str">&quot;whisper-1&quot;</span>,{"\n"}
              {"}"});
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> <code>duration</code>은 네트워크 지연을 포함한 전체 API 호출
              시간입니다. 오디오 길이가 아닌 &quot;API 응답까지 걸린 시간&quot;을 나타냅니다. 성능
              모니터링에 활용할 수 있습니다.
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
              실행 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">transcribe()</code>는 4단계로 실행됩니다: 클라이언트
              생성 → Buffer 변환 → API 호출 → 결과 추출.
            </p>

            <MermaidDiagram
              title="transcribe() 실행 흐름"
              titleColor="purple"
              chart={`graph TD
  START["audioBuffer + options"]
  CLIENT["1. OpenAI 클라이언트 생성<br/><small>apiKey + baseUrl 설정</small>"]
  CONVERT["2. Buffer → File 변환<br/><small>new File([buffer], 'recording.wav')</small>"]
  API["3. Whisper API 호출<br/><small>audio.transcriptions.create()</small><br/><small>response_format: verbose_json</small>"]
  RESULT["4. 결과 추출<br/><small>text, duration, language</small>"]

  START --> CLIENT
  CLIENT --> CONVERT
  CONVERT --> API
  API --> RESULT

  style API fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style CLIENT fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style CONVERT fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style START fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              Buffer를 File 객체로 변환하는 것이 핵심입니다. Whisper API는 File 형식을 요구하므로 이
              변환이 필수입니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// Buffer → File 변환 (Whisper API 요구사항)"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">file</span> ={" "}
              <span className="kw">new</span> <span className="type">File</span>([
              <span className="prop">audioBuffer</span>],{" "}
              <span className="str">&quot;recording.wav&quot;</span>, {"{"}{" "}
              <span className="prop">type</span>: <span className="str">&quot;audio/wav&quot;</span>{" "}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// Whisper API 호출"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">response</span> ={" "}
              <span className="kw">await</span> <span className="prop">client</span>.
              <span className="prop">audio</span>.<span className="prop">transcriptions</span>.
              <span className="fn">create</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">file</span>,{"\n"}
              {"  "}
              <span className="prop">model</span>: <span className="prop">options</span>.
              <span className="prop">model</span> ??{" "}
              <span className="str">&quot;whisper-1&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">language</span>: <span className="prop">options</span>.
              <span className="prop">language</span>,{"\n"}
              {"  "}
              <span className="prop">response_format</span>:{" "}
              <span className="str">&quot;verbose_json&quot;</span>,{"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">
                {"// 결과 반환 — duration은 API 호출 시간 (오디오 길이 아님)"}
              </span>
              {"\n"}
              <span className="kw">return</span> {"{"}
              {"\n"}
              {"  "}
              <span className="prop">text</span>: <span className="prop">response</span>.
              <span className="prop">text</span>,{"\n"}
              {"  "}
              <span className="prop">duration</span>: (<span className="type">Date</span>.
              <span className="fn">now</span>() - <span className="prop">startTime</span>) /{" "}
              <span className="num">1000</span>,{"\n"}
              {"  "}
              <span className="prop">language</span>: <span className="prop">response</span>.
              <span className="prop">language</span> ?? <span className="prop">options</span>.
              <span className="prop">language</span> ??{" "}
              <span className="str">&quot;unknown&quot;</span>,{"\n"}
              {"}"};
            </CodeBlock>

            <DeepDive title="verbose_json 응답 형식">
              <p className="mb-3">
                <code className="text-cyan-600">response_format: &quot;verbose_json&quot;</code>을
                사용하면 기본 텍스트 외에 추가 정보가 포함됩니다:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <code className="text-cyan-600">text</code> &mdash; 인식된 전체 텍스트
                </li>
                <li>
                  <code className="text-cyan-600">language</code> &mdash; 감지된 언어 코드
                </li>
                <li>
                  <code className="text-cyan-600">segments</code> &mdash; 세그먼트별 타임스탬프와
                  텍스트 (현재 미사용)
                </li>
              </ul>
              <p className="mt-3 text-gray-600">
                현재 구현에서는 <code className="text-cyan-600">text</code>와{" "}
                <code className="text-cyan-600">language</code>만 활용하고 있습니다. 향후 세그먼트
                정보를 활용한 실시간 자막 기능이 추가될 수 있습니다.
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
                &quot;인식 결과가 빈 문자열이에요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                오디오 Buffer가 비어 있거나, 너무 짧은 녹음(1초 미만)일 수 있습니다. 또한 배경
                소음만 있는 녹음은 빈 텍스트를 반환할 수 있습니다.
                <code className="text-cyan-600">result.text.trim()</code>으로 확인하세요.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;한국어 인식이 부정확해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">language: &quot;ko&quot;</code>를 명시적으로
                설정하세요. 언어를 지정하지 않으면 Whisper가 자동 감지를 시도하는데, 짧은 한국어
                음성은 다른 언어로 오탐될 수 있습니다.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;API 호출이 실패해요 — 401 Unauthorized&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">apiKey</code>가 유효한 OpenAI API 키인지 확인하세요.
                커스텀 <code className="text-cyan-600">baseUrl</code>을 사용하는 경우, 해당 서버가
                Whisper API 호환 엔드포인트를 제공하는지 확인하세요.
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
                  name: "voice/recorder.ts",
                  slug: "voice-recorder",
                  relation: "sibling",
                  desc: "마이크 입력을 녹음하여 오디오 Buffer를 생성하는 레코더",
                },
                {
                  name: "llm-client.ts",
                  slug: "llm-client",
                  relation: "parent",
                  desc: "LLM API 클라이언트 — OpenAI SDK를 공유하며 음성 인식 결과를 프롬프트에 전달",
                },
                {
                  name: "config-loader.ts",
                  slug: "config-loader",
                  relation: "sibling",
                  desc: "API 키와 모델 설정을 로드하는 설정 로더",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
