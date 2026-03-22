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

export default function UtilsLoggerPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/utils/logger.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">Logger</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              pino 기반 구조화된 로깅 시스템입니다. 민감 정보 자동 마스킹(redaction)과 파일 기반
              JSON 로깅을 제공하며, 싱글톤 패턴으로 앱 전체에서 공유됩니다.
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
                <code className="text-cyan-600">pino</code>는 Node.js에서 가장 빠른 JSON 로거 중
                하나입니다. 이 모듈은 pino를 래핑하여 dbcode에 특화된 기능을 추가합니다: API 키,
                토큰, 비밀번호 등 14개 경로의 민감 정보를 자동으로 &quot;[REDACTED]&quot;로
                마스킹합니다.
              </p>
              <p>
                로그는 stdout이 아닌 <strong>파일</strong>로 출력됩니다. CLI 앱의 특성상 stdout은
                사용자 인터페이스(Ink)가 점유하므로, 로그는 별도 파일에 JSON 형식으로 기록합니다.
                로그 레벨은 <code className="text-cyan-600">DBCODE_LOG_LEVEL</code> 환경 변수로
                제어합니다.
              </p>
              <p>
                <code className="text-cyan-600">getLogger()</code>는 싱글톤 패턴으로 동일한 로거
                인스턴스를 반환하고,
                <code className="text-cyan-600">setLogger()</code>로 테스트용 모킹 로거를 주입할 수
                있습니다.
              </p>
            </div>

            <MermaidDiagram
              title="로거 시스템 아키텍처"
              titleColor="purple"
              chart={`graph TD
  APP["전체 모듈<br/><small>Agent, LLM, Tools...</small>"]
  GET["getLogger()<br/><small>싱글톤 접근</small>"]
  CREATE["createLogger()<br/><small>pino 인스턴스 생성</small>"]
  PINO["pino Logger<br/><small>JSON 로깅 엔진</small>"]
  REDACT["Redaction<br/><small>14개 경로 마스킹</small>"]
  FILE["로그 파일<br/><small>LOG_FILE 상수 경로</small>"]

  APP -->|"import"| GET
  GET -->|"최초 1회"| CREATE
  CREATE --> PINO
  PINO --> REDACT
  PINO --> FILE

  style GET fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style CREATE fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style PINO fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style REDACT fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style FILE fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style APP fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>핵심 원칙:</strong> 로그에 민감 정보가 유출되면 보안 사고입니다.
              <code>apiKey</code>, <code>token</code>, <code>secret</code>, <code>password</code>{" "}
              등의 필드는 자동으로 마스킹되므로 개발자가 별도로 관리할 필요가 없습니다.
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

            {/* createLogger */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              createLogger(options?)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              pino 로거 인스턴스를 생성합니다. 민감 정보 마스킹, 파일 출력, ISO 타임스탬프가 기본
              설정됩니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">createLogger</span>(
              <span className="prop">options</span>?: {"{"} <span className="prop">level</span>?:{" "}
              <span className="type">string</span>; <span className="prop">file</span>?:{" "}
              <span className="type">string</span> {"}"}): <span className="type">pino.Logger</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "options.level",
                  type: "string",
                  required: false,
                  desc: '로그 레벨 (기본값: DBCODE_LOG_LEVEL 환경 변수 또는 "info")',
                },
                {
                  name: "options.file",
                  type: "string",
                  required: false,
                  desc: "로그 파일 경로 (기본값: LOG_FILE 상수)",
                },
              ]}
            />

            {/* getLogger */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              getLogger()
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              기본 로거를 가져옵니다. 싱글톤 패턴으로 앱 전체에서 하나의 로거를 공유합니다. 최초
              호출 시 <code className="text-cyan-600">createLogger()</code>로 생성됩니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">getLogger</span>():{" "}
              <span className="type">pino.Logger</span>
            </CodeBlock>

            {/* setLogger */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              setLogger(logger)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              커스텀 로거를 기본 로거로 설정합니다. 주로 테스트에서 모킹 로거를 주입할 때
              사용합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">setLogger</span>(
              <span className="prop">logger</span>: <span className="type">pino.Logger</span>):{" "}
              <span className="type">void</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "logger",
                  type: "pino.Logger",
                  required: true,
                  desc: "기본 로거로 사용할 pino Logger 인스턴스",
                },
              ]}
            />

            {/* Redaction paths */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              마스킹 경로 (Redaction Paths)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              다음 14개 경로에 해당하는 값은 자동으로 &quot;[REDACTED]&quot;로 치환됩니다.
            </p>
            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-1.5">
              <p>
                <code className="text-cyan-600">apiKey</code>,{" "}
                <code className="text-cyan-600">*.apiKey</code> &mdash; API 키
              </p>
              <p>
                <code className="text-cyan-600">headers.authorization</code>,{" "}
                <code className="text-cyan-600">*.headers.authorization</code> &mdash; 인증 헤더
              </p>
              <p>
                <code className="text-cyan-600">token</code>,{" "}
                <code className="text-cyan-600">*.token</code> &mdash; 토큰
              </p>
              <p>
                <code className="text-cyan-600">secret</code>,{" "}
                <code className="text-cyan-600">*.secret</code> &mdash; 시크릿
              </p>
              <p>
                <code className="text-cyan-600">password</code>,{" "}
                <code className="text-cyan-600">*.password</code> &mdash; 비밀번호
              </p>
              <p>
                <code className="text-cyan-600">authorization</code>,{" "}
                <code className="text-cyan-600">*.authorization</code> &mdash; 인증 정보
              </p>
              <p>
                <code className="text-cyan-600">api_key</code>,{" "}
                <code className="text-cyan-600">*.api_key</code> &mdash; API 키 (스네이크 케이스)
              </p>
              <p>
                <code className="text-cyan-600">accessToken</code>,{" "}
                <code className="text-cyan-600">*.accessToken</code> &mdash; 액세스 토큰
              </p>
            </div>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                로그는 <strong>stdout이 아닌 파일</strong>로 출력됩니다. CLI 앱에서 stdout은 Ink
                UI가 점유하므로 <code className="text-cyan-600">console.log()</code>는 사용하지
                마세요.
              </li>
              <li>
                마스킹은 지정된 경로명과 정확히 일치하는 필드에만 적용됩니다.
                <code className="text-cyan-600">myApiKey</code>나{" "}
                <code className="text-cyan-600">tokenValue</code> 같은 커스텀 이름은 마스킹되지
                않습니다.
              </li>
              <li>
                <code className="text-cyan-600">setLogger()</code>로 교체한 로거는 마스킹 설정이
                적용되지 않을 수 있습니다. 테스트 전용으로만 사용하세요.
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
              기본 사용법 &mdash; 로그 작성
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">getLogger()</code>로 싱글톤 로거를 가져와 사용합니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"} <span className="prop">getLogger</span> {"}"}{" "}
              <span className="kw">from</span>{" "}
              <span className="str">&quot;./utils/logger.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="kw">const</span> <span className="prop">log</span> ={" "}
              <span className="fn">getLogger</span>();
              {"\n"}
              {"\n"}
              <span className="cm">{"// 구조화된 로깅 — 첫 번째 인수에 메타데이터 객체"}</span>
              {"\n"}
              <span className="prop">log</span>.<span className="fn">info</span>({"{"}{" "}
              <span className="prop">userId</span>: <span className="str">&quot;abc&quot;</span>{" "}
              {"}"}, <span className="str">&quot;사용자 로그인 성공&quot;</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 민감 정보는 자동 마스킹됨"}</span>
              {"\n"}
              <span className="prop">log</span>.<span className="fn">error</span>({"{"}{" "}
              <span className="prop">apiKey</span>:{" "}
              <span className="str">&quot;sk-abc123&quot;</span> {"}"},{" "}
              <span className="str">&quot;API 호출 실패&quot;</span>);
              {"\n"}
              <span className="cm">
                {'// 출력: { apiKey: "[REDACTED]", msg: "API 호출 실패" }'}
              </span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>console.log()</code>를 사용하면 Ink UI와 출력이 섞여
              화면이 깨집니다. 모든 로깅은 반드시 <code>getLogger()</code>를 통해 수행하세요.
            </Callout>

            {/* 로그 레벨 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              로그 레벨 제어
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">DBCODE_LOG_LEVEL</code> 환경 변수로 로그 레벨을
              제어합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 디버그 로그까지 출력"}</span>
              {"\n"}
              <span className="prop">DBCODE_LOG_LEVEL</span>=<span className="str">debug</span>{" "}
              <span className="prop">dbcode</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 에러만 출력"}</span>
              {"\n"}
              <span className="prop">DBCODE_LOG_LEVEL</span>=<span className="str">error</span>{" "}
              <span className="prop">dbcode</span>
              {"\n"}
              {"\n"}
              <span className="cm">
                {"// 레벨 순서: trace < debug < info < warn < error < fatal"}
              </span>
            </CodeBlock>

            {/* 테스트에서 모킹 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 테스트에서 로거 모킹
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">setLogger()</code>로 모킹 로거를 주입하여 테스트 중
              파일 I/O를 방지할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> <span className="prop">pino</span>{" "}
              <span className="kw">from</span> <span className="str">&quot;pino&quot;</span>;{"\n"}
              <span className="kw">import</span> {"{"} <span className="prop">setLogger</span> {"}"}{" "}
              <span className="kw">from</span>{" "}
              <span className="str">&quot;./utils/logger.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// /dev/null로 로그를 보내는 모킹 로거"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">mockLogger</span> ={" "}
              <span className="fn">pino</span>({"{"} <span className="prop">level</span>:{" "}
              <span className="str">&quot;silent&quot;</span> {"}"});
              {"\n"}
              <span className="fn">setLogger</span>(<span className="prop">mockLogger</span>);
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> 테스트 후 <code>setLogger()</code>로 원래 로거를 복원하는 것을
              잊지 마세요. afterEach/afterAll에서 복원하는 것이 좋습니다.
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
              로그 처리 파이프라인
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              pino의 내부 파이프라인: 로그 메서드 호출 &rarr; 레벨 필터링 &rarr; 마스킹 &rarr; JSON
              직렬화 &rarr; 파일 기록
            </p>

            <MermaidDiagram
              title="로그 처리 파이프라인"
              titleColor="purple"
              chart={`graph LR
  CALL["log.info()<br/><small>로그 메서드 호출</small>"]
  LEVEL["Level Filter<br/><small>설정 레벨 이하 무시</small>"]
  REDACT["Redaction<br/><small>민감 정보 마스킹</small>"]
  FORMAT["Formatter<br/><small>숫자→문자열 레벨</small>"]
  TIME["Timestamp<br/><small>ISO 8601</small>"]
  FILE["File Transport<br/><small>JSON → 파일 기록</small>"]

  CALL --> LEVEL --> REDACT --> FORMAT --> TIME --> FILE

  style CALL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style REDACT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style FILE fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style LEVEL fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style FORMAT fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style TIME fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              싱글톤 패턴
            </h3>
            <CodeBlock>
              <span className="kw">let</span> <span className="prop">defaultLogger</span>:{" "}
              <span className="type">pino.Logger</span> | <span className="type">undefined</span>;
              {"\n"}
              {"\n"}
              <span className="kw">function</span> <span className="fn">getLogger</span>():{" "}
              <span className="type">pino.Logger</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">if</span> (!<span className="prop">defaultLogger</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="prop">defaultLogger</span> = <span className="fn">createLogger</span>
              ();
              {"\n"}
              {"  }"}
              {"\n"}
              {"  "}
              <span className="kw">return</span> <span className="prop">defaultLogger</span>;{"\n"}
              {"}"}
            </CodeBlock>

            <DeepDive title="pino 성능 특성">
              <p className="mb-3">pino가 빠른 이유:</p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>JSON.stringify 대신 빠른 직렬화기(fast-json-stringify) 사용</li>
                <li>비동기 I/O &mdash; 로그 기록이 메인 스레드를 블로킹하지 않음</li>
                <li>transport 옵션으로 별도 스레드에서 파일 기록 가능</li>
                <li>redaction은 로그 기록 시점에만 적용 &mdash; 원본 객체는 변경하지 않음</li>
              </ul>
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
                &quot;로그 파일이 생성되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">LOG_FILE</code> 경로의 부모 디렉토리에 쓰기 권한이
                있는지 확인하세요. pino의 <code className="text-cyan-600">mkdir: true</code> 옵션이
                디렉토리를 자동 생성하지만, 상위 디렉토리의 권한이 부족하면 실패합니다.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;로그에 민감 정보가 그대로 출력됩니다&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                마스킹은 정확한 경로명과 일치하는 필드에만 적용됩니다.
                <code className="text-cyan-600">mySecret</code>,{" "}
                <code className="text-cyan-600">apiToken</code> 등 비표준 이름은 마스킹 대상이
                아닙니다. 표준 필드명 (<code className="text-cyan-600">apiKey</code>,{" "}
                <code className="text-cyan-600">token</code>,
                <code className="text-cyan-600">secret</code>,{" "}
                <code className="text-cyan-600">password</code>)을 사용하세요.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;디버그 로그를 보고 싶어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">DBCODE_LOG_LEVEL=debug</code> 환경 변수를 설정한 후
                dbcode를 실행하세요. 로그 파일(LOG_FILE 경로)에서 JSON 형식으로 확인할 수 있습니다.
                <code className="text-cyan-600">jq</code> 도구를 사용하면 가독성이 좋아집니다:
                <code className="text-cyan-600">cat ~/.dbcode/logs/app.log | jq .</code>
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
                  name: "error.ts",
                  slug: "utils-error",
                  relation: "sibling",
                  desc: "구조화된 에러 클래스 — context 정보가 로거에 의해 JSON으로 기록됩니다",
                },
                {
                  name: "events.ts",
                  slug: "utils-events",
                  relation: "sibling",
                  desc: "이벤트 시스템과 함께 로그를 기록하여 디버깅 추적성을 높입니다",
                },
                {
                  name: "secret-scanner.ts",
                  slug: "secret-scanner",
                  relation: "sibling",
                  desc: "도구 출력에서 비밀 키를 감지하는 보안 스캐너 — 로거의 마스킹과 보완적",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
