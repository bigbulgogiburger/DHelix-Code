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

export default function ConstantsPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/constants.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">전역 상수 정의</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              애플리케이션 전체에서 사용되는 상수, 기본값, 경로를 정의하는 최하위 레이어 모듈입니다.
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
                <code className="text-cyan-600">constants.ts</code>는 아키텍처의 최하위 레이어(Leaf
                Module)에 위치하며, 다른 모든 모듈이 이 파일을 참조할 수 있지만 이 파일은 다른
                <code className="text-cyan-600">src/</code> 모듈을 import하지 않습니다. 이를 통해
                순환 의존성을 원천 차단합니다.
              </p>
              <p>
                세 가지 원칙을 강제합니다: 모델명 하드코딩 금지 (
                <code className="text-cyan-600">DEFAULT_MODEL</code> 사용), 경로 하드코딩 금지 (
                <code className="text-cyan-600">CONFIG_DIR</code>,{" "}
                <code className="text-cyan-600">SESSIONS_DIR</code> 등 사용), 매직 넘버 금지(
                <code className="text-cyan-600">AGENT_LOOP</code>,
                <code className="text-cyan-600">TOOL_TIMEOUTS</code> 등 명명된 상수 사용).
              </p>
              <p>
                환경변수 기반의 설정(모델명, API URL 등)과 고정 상수(버전, 경로, 제한값)를 모두 이
                파일에서 단일 소스(Single Source of Truth)로 관리합니다.
              </p>
            </div>

            <MermaidDiagram
              title="constants.ts 의존 관계"
              titleColor="purple"
              chart={`graph TD
  CONST["constants.ts<br/><small>전역 상수 정의</small>"]
  CMD["commands/*<br/><small>슬래시 명령어</small>"]
  CORE["core/*<br/><small>Agent Loop, Context</small>"]
  LLM["llm/*<br/><small>LLM Client, Router</small>"]
  TOOLS["tools/*<br/><small>Tool System</small>"]
  CONFIG["config/*<br/><small>Config Loader</small>"]
  MEM["memory/*<br/><small>Memory System</small>"]

  CMD --> CONST
  CORE --> CONST
  LLM --> CONST
  TOOLS --> CONST
  CONFIG --> CONST
  MEM --> CONST

  NODE_OS["node:os<br/><small>homedir()</small>"]
  NODE_PATH["node:path<br/><small>join()</small>"]
  ENV["process.env<br/><small>환경변수</small>"]

  CONST --> NODE_OS
  CONST --> NODE_PATH
  CONST --> ENV

  style CONST fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style CMD fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CORE fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style LLM fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style TOOLS fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CONFIG fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style MEM fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style NODE_OS fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style NODE_PATH fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style ENV fill:#fef3c7,stroke:#f59e0b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 건물의 기초와 같습니다. 모든 층(모듈)이 이 기초 위에
              세워지지만, 기초 자체는 다른 층에 의존하지 않습니다. 상수를 변경하면 그 위의 모든
              모듈에 영향이 가므로 신중하게 관리해야 합니다.
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

            {/* 기본 식별 상수 */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              기본 식별 상수
            </h3>
            <ParamTable
              params={[
                {
                  name: "VERSION",
                  type: '"0.1.0"',
                  required: true,
                  desc: "애플리케이션 버전 (package.json과 동기화 필요)",
                },
                {
                  name: "APP_NAME",
                  type: '"dhelix"',
                  required: true,
                  desc: "애플리케이션 이름 (디렉토리명, 환경변수 접두사 등에 사용)",
                },
              ]}
            />

            {/* 경로 상수 */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              경로 상수
            </h3>
            <ParamTable
              params={[
                {
                  name: "CONFIG_DIR",
                  type: "string",
                  required: true,
                  desc: "사용자 전역 설정 디렉토리: ~/.dhelix/",
                },
                {
                  name: "PROJECT_CONFIG_FILE",
                  type: '"DHELIX.md"',
                  required: true,
                  desc: "프로젝트 루트 인스트럭션 파일명",
                },
                {
                  name: "PROJECT_CONFIG_DIR",
                  type: '".dhelix"',
                  required: true,
                  desc: "프로젝트별 설정 디렉토리명",
                },
                {
                  name: "SESSIONS_DIR",
                  type: "string",
                  required: true,
                  desc: "세션 저장 디렉토리: ~/.dhelix/sessions/",
                },
                {
                  name: "LOG_FILE",
                  type: "string",
                  required: true,
                  desc: "디버그 로그 파일: ~/.dhelix/debug.log",
                },
                {
                  name: "INPUT_HISTORY_FILE",
                  type: "string",
                  required: true,
                  desc: "입력 히스토리: ~/.dhelix/input-history.json",
                },
                {
                  name: "INPUT_HISTORY_MAX",
                  type: "500",
                  required: true,
                  desc: "입력 히스토리 최대 항목 수",
                },
              ]}
            />

            {/* getProjectConfigPaths */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              function getProjectConfigPaths()
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              DHELIX.md 탐색 경로를 우선순위 순으로 반환합니다.
            </p>
            <CodeBlock>
              <span className="kw">export function</span>{" "}
              <span className="fn">getProjectConfigPaths</span>(<span className="prop">cwd</span>:{" "}
              <span className="type">string</span>): <span className="kw">readonly</span>{" "}
              <span className="type">string</span>[]
            </CodeBlock>
            <ParamTable
              params={[{ name: "cwd", type: "string", required: true, desc: "탐색 시작 디렉토리" }]}
            />
            <div className="text-[13px] text-gray-600 mt-2 space-y-1">
              <p>
                &bull; 우선순위 1: <code className="text-cyan-600">{"{cwd}/DHELIX.md"}</code>{" "}
                (프로젝트 루트, 권장)
              </p>
              <p>
                &bull; 우선순위 2:{" "}
                <code className="text-cyan-600">{"{cwd}/.dhelix/DHELIX.md"}</code> (하위 호환 폴백)
              </p>
            </div>

            {/* AGENT_LOOP */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              const AGENT_LOOP
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              에이전트 루프의 자동 반복 실행을 제어하는 제한 상수입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "maxIterations",
                  type: "50",
                  required: true,
                  desc: "최대 반복 횟수 (초과 시 강제 중단)",
                },
                {
                  name: "compactionThreshold",
                  type: "0.835",
                  required: true,
                  desc: "자동 컴팩션 트리거 임계치 (컨텍스트 윈도우의 83.5%)",
                },
                {
                  name: "responseReserveRatio",
                  type: "0.2",
                  required: true,
                  desc: "LLM 응답용 토큰 예약 비율 (컨텍스트 윈도우의 20%)",
                },
              ]}
            />

            {/* TOOL_TIMEOUTS */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              const TOOL_TIMEOUTS
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              도구별 최대 실행 시간(밀리초)입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "bash",
                  type: "120_000",
                  required: true,
                  desc: "Bash 명령 실행 타임아웃 (2분)",
                },
                {
                  name: "fileOps",
                  type: "30_000",
                  required: true,
                  desc: "파일 작업 타임아웃 (30초)",
                },
                { name: "default", type: "30_000", required: true, desc: "기본 타임아웃 (30초)" },
              ]}
            />

            {/* DEFAULT_MODEL + LLM_DEFAULTS */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              const DEFAULT_MODEL / LLM_DEFAULTS
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              LLM 관련 기본 설정입니다. 환경변수에서 결정되는 단일 소스(Single Source of
              Truth)입니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// DEFAULT_MODEL 우선순위:"}</span>
              {"\n"}
              <span className="cm">
                {'// LOCAL_MODEL > DHELIX_MODEL > OPENAI_MODEL > "gpt-4o-mini"'}
              </span>
              {"\n"}
              <span className="kw">export const</span> <span className="prop">DEFAULT_MODEL</span> =
              {"\n"}
              {"  "}
              <span className="prop">process</span>.<span className="prop">env</span>.
              <span className="prop">LOCAL_MODEL</span> ||
              {"\n"}
              {"  "}
              <span className="prop">process</span>.<span className="prop">env</span>.
              <span className="prop">DHELIX_MODEL</span> ||
              {"\n"}
              {"  "}
              <span className="prop">process</span>.<span className="prop">env</span>.
              <span className="prop">OPENAI_MODEL</span> ||
              {"\n"}
              {"  "}
              <span className="str">&quot;gpt-4o-mini&quot;</span>;
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "LLM_DEFAULTS.baseUrl",
                  type: "string",
                  required: true,
                  desc: "기본 API URL (LOCAL_API_BASE_URL > DHELIX_BASE_URL > OPENAI_BASE_URL > OpenAI 공식)",
                },
                {
                  name: "LLM_DEFAULTS.model",
                  type: "string",
                  required: true,
                  desc: "기본 모델명 (DEFAULT_MODEL과 동일)",
                },
                {
                  name: "LLM_DEFAULTS.temperature",
                  type: "0.0",
                  required: true,
                  desc: "기본 온도 (결정적, 동일 입력에 동일 출력)",
                },
                {
                  name: "LLM_DEFAULTS.maxTokens",
                  type: "32768",
                  required: true,
                  desc: "기본 최대 응답 토큰 수",
                },
              ]}
            />

            {/* TOKEN_DEFAULTS */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              const TOKEN_DEFAULTS
            </h3>
            <ParamTable
              params={[
                {
                  name: "defaultModel",
                  type: "string",
                  required: true,
                  desc: "토큰 카운팅에 사용할 기본 모델 (DEFAULT_MODEL)",
                },
                {
                  name: "maxContextWindow",
                  type: "1_000_000",
                  required: true,
                  desc: "최대 컨텍스트 윈도우 크기 (100만 토큰)",
                },
              ]}
            />

            {/* Memory constants */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              메모리 관련 상수
            </h3>
            <ParamTable
              params={[
                { name: "MEMORY_DIR", type: '"memory"', required: true, desc: "메모리 디렉토리명" },
                {
                  name: "MEMORY_MAIN_FILE",
                  type: '"MEMORY.md"',
                  required: true,
                  desc: "메인 메모리 파일명",
                },
                {
                  name: "MEMORY_MAX_MAIN_LINES",
                  type: "200",
                  required: true,
                  desc: "MEMORY.md 최대 줄 수",
                },
                {
                  name: "MEMORY_MAX_TOPIC_LINES",
                  type: "500",
                  required: true,
                  desc: "토픽 파일 최대 줄 수",
                },
                {
                  name: "MEMORY_MAX_ENTRIES_PER_SESSION",
                  type: "20",
                  required: true,
                  desc: "세션당 최대 메모리 항목 수",
                },
                {
                  name: "MEMORY_MIN_CONFIDENCE",
                  type: "0.7",
                  required: true,
                  desc: "메모리 저장 최소 신뢰도 (0.0~1.0)",
                },
              ]}
            />

            {/* getProjectMemoryDir / getGlobalMemoryDir */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              function getProjectMemoryDir() / getGlobalMemoryDir()
            </h3>
            <CodeBlock>
              <span className="kw">export function</span>{" "}
              <span className="fn">getProjectMemoryDir</span>(
              <span className="prop">projectDir</span>: <span className="type">string</span>):{" "}
              <span className="type">string</span>
              {"\n"}
              <span className="cm">{"// → {projectDir}/.dhelix/memory/"}</span>
              {"\n"}
              {"\n"}
              <span className="kw">export function</span>{" "}
              <span className="fn">getGlobalMemoryDir</span>(): <span className="type">string</span>
              {"\n"}
              <span className="cm">{"// → ~/.dhelix/memory/"}</span>
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">VERSION</code>은 수동으로 관리됩니다. 릴리스 시
                <code className="text-cyan-600">package.json</code>과 반드시 동기화해야 합니다.
              </li>
              <li>
                <strong>이 파일에서 다른 src/ 모듈을 import하면 안 됩니다.</strong> 순환 의존성의
                원인이 됩니다. <code className="text-cyan-600">node:os</code>,
                <code className="text-cyan-600">node:path</code>,{" "}
                <code className="text-cyan-600">process.env</code>만 참조할 수 있습니다.
              </li>
              <li>
                <code className="text-cyan-600">DEFAULT_MODEL</code>은 프로세스 시작 시점의
                환경변수로 결정됩니다. 런타임에 환경변수를 변경해도 반영되지 않습니다.
              </li>
              <li>
                모든 객체 상수에 <code className="text-cyan-600">as const</code>가 적용되어 있어
                타입 레벨에서 리터럴 타입으로 추론됩니다.
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

            {/* 기본 import */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              기본 사용법 &mdash; 상수 import
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              필요한 상수를 named import로 가져옵니다. ESM 규칙에 따라
              <code className="text-cyan-600">.js</code> 확장자를 사용합니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"}
              {"\n"}
              {"  "}
              <span className="prop">VERSION</span>,{"\n"}
              {"  "}
              <span className="prop">APP_NAME</span>,{"\n"}
              {"  "}
              <span className="prop">DEFAULT_MODEL</span>,{"\n"}
              {"  "}
              <span className="prop">CONFIG_DIR</span>,{"\n"}
              {"  "}
              <span className="prop">AGENT_LOOP</span>,{"\n"}
              {"  "}
              <span className="prop">TOOL_TIMEOUTS</span>,{"\n"}
              {"}"} <span className="kw">from</span>{" "}
              <span className="str">&quot;../constants.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 에이전트 루프에서 최대 반복 횟수 사용"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">cb</span> ={" "}
              <span className="kw">new</span> <span className="fn">CircuitBreaker</span>(
              <span className="prop">AGENT_LOOP</span>.<span className="prop">maxIterations</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// Bash 도구에서 타임아웃 사용"}</span>
              {"\n"}
              <span className="fn">setTimeout</span>(() {"=>"} <span className="fn">abort</span>(),{" "}
              <span className="prop">TOOL_TIMEOUTS</span>.<span className="prop">bash</span>);
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 모델명, 경로, 제한값을 다른 파일에 하드코딩하지 마세요. 반드시
              이 파일의 상수를 import하여 사용해야 합니다. 하드코딩하면 값 변경 시 모든 파일을
              수동으로 업데이트해야 합니다.
            </Callout>

            {/* 환경변수로 모델 변경 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 환경변수로 기본 모델 변경
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">DEFAULT_MODEL</code>은 환경변수 우선순위로 결정됩니다.
              프로세스 시작 전에 환경변수를 설정하면 기본 모델을 변경할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"# 로컬 LLM 사용"}</span>
              {"\n"}
              <span className="prop">LOCAL_MODEL</span>=
              <span className="str">&quot;llama-3.3-70b&quot;</span>{" "}
              <span className="fn">dhelix</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"# OpenAI 모델 지정"}</span>
              {"\n"}
              <span className="prop">OPENAI_MODEL</span>=
              <span className="str">&quot;gpt-4o&quot;</span> <span className="fn">dhelix</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"# 커스텀 API 엔드포인트"}</span>
              {"\n"}
              <span className="prop">DHELIX_BASE_URL</span>=
              <span className="str">&quot;http://localhost:11434/v1&quot;</span>{" "}
              <span className="fn">dhelix</span>
            </CodeBlock>

            <DeepDive title="환경변수 우선순위 체인 상세">
              <p className="mb-3">모델명과 API URL 모두 같은 우선순위 패턴을 따릅니다:</p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <strong>LOCAL_*</strong> &mdash; 최우선. 로컬 LLM(Ollama 등) 설정용
                </li>
                <li>
                  <strong>DHELIX_*</strong> &mdash; dhelix 전용 설정. 다른 도구와 충돌 방지
                </li>
                <li>
                  <strong>OPENAI_*</strong> &mdash; OpenAI SDK 표준 환경변수. 기존 설정 재활용
                </li>
                <li>
                  <strong>하드코딩 폴백</strong> &mdash; 환경변수가 모두 없을 때 사용되는 기본값
                </li>
              </ul>
              <p className="mt-3 text-amber-600">
                <code>LOCAL_MODEL</code>이 설정되면 <code>OPENAI_MODEL</code>은 무시됩니다. 의도하지
                않은 모델이 사용될 경우 환경변수 우선순위를 확인하세요.
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
              상수 카테고리 구조
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              상수는 크게 5가지 카테고리로 구분됩니다.
            </p>

            <MermaidDiagram
              title="constants.ts 상수 카테고리"
              titleColor="purple"
              chart={`graph TD
  CONST["constants.ts"]

  ID["식별 상수<br/><small>VERSION, APP_NAME</small>"]
  PATH["경로 상수<br/><small>CONFIG_DIR, SESSIONS_DIR,<br/>LOG_FILE, INPUT_HISTORY_FILE</small>"]
  LIMITS["제한 상수<br/><small>AGENT_LOOP, TOOL_TIMEOUTS,<br/>INPUT_HISTORY_MAX</small>"]
  LLM["LLM 설정<br/><small>DEFAULT_MODEL,<br/>LLM_DEFAULTS, TOKEN_DEFAULTS</small>"]
  MEM["메모리 상수<br/><small>MEMORY_DIR, MEMORY_MAIN_FILE,<br/>MEMORY_MAX_*, MEMORY_MIN_*</small>"]

  CONST --> ID
  CONST --> PATH
  CONST --> LIMITS
  CONST --> LLM
  CONST --> MEM

  style CONST fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style ID fill:#dcfce7,stroke:#10b981,color:#065f46
  style PATH fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style LIMITS fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style LLM fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style MEM fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              경로 상수가 구성되는 패턴입니다. <code className="text-cyan-600">CONFIG_DIR</code>을
              기반으로 하위 경로가 파생됩니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// [1] 기반 경로: ~/.dhelix/"}</span>
              {"\n"}
              <span className="kw">export const</span> <span className="prop">CONFIG_DIR</span> ={" "}
              <span className="fn">join</span>(<span className="fn">homedir</span>(),{" "}
              <span className="str">
                `.${"{"}APP_NAME{"}"}`
              </span>
              );
              {"\n"}
              {"\n"}
              <span className="cm">{"// [2] 파생 경로: CONFIG_DIR 기반"}</span>
              {"\n"}
              <span className="kw">export const</span> <span className="prop">SESSIONS_DIR</span> ={" "}
              <span className="fn">join</span>(<span className="prop">CONFIG_DIR</span>,{" "}
              <span className="str">&quot;sessions&quot;</span>);
              {"\n"}
              <span className="kw">export const</span> <span className="prop">LOG_FILE</span> ={" "}
              <span className="fn">join</span>(<span className="prop">CONFIG_DIR</span>,{" "}
              <span className="str">&quot;debug.log&quot;</span>);
              {"\n"}
              <span className="kw">export const</span>{" "}
              <span className="prop">INPUT_HISTORY_FILE</span> = <span className="fn">join</span>(
              <span className="prop">CONFIG_DIR</span>,{" "}
              <span className="str">&quot;input-history.json&quot;</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// [3] 프로젝트 메모리 경로: 프로젝트별"}</span>
              {"\n"}
              <span className="kw">export function</span>{" "}
              <span className="fn">getProjectMemoryDir</span>(
              <span className="prop">projectDir</span>: <span className="type">string</span>):{" "}
              <span className="type">string</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">return</span> <span className="fn">join</span>(
              <span className="prop">projectDir</span>,{" "}
              <span className="prop">PROJECT_CONFIG_DIR</span>,{" "}
              <span className="prop">MEMORY_DIR</span>);
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong>{" "}
                <code className="text-cyan-600">homedir()</code>는 플랫폼에 관계없이 사용자 홈
                디렉토리를 반환합니다 (macOS: /Users/xxx, Linux: /home/xxx).
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> 모든 하위 경로가{" "}
                <code className="text-cyan-600">CONFIG_DIR</code>에서 파생되므로,{" "}
                <code className="text-cyan-600">APP_NAME</code>을 변경하면 모든 경로가 자동으로
                업데이트됩니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 프로젝트 메모리는 프로젝트 디렉토리
                내 <code className="text-cyan-600">.dhelix/memory/</code>에 저장되어 프로젝트별로
                격리됩니다.
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
                &quot;환경변수를 설정했는데 모델이 바뀌지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">DEFAULT_MODEL</code>은{" "}
                <strong>프로세스 시작 시점</strong>에 결정됩니다. 실행 중에 환경변수를 변경해도
                반영되지 않습니다. dhelix를 재시작하거나,{" "}
                <code className="text-cyan-600">/model</code> 명령어로 런타임에 모델을 전환하세요.
                또한 우선순위가 높은 환경변수가 이미 설정되어 있는지 확인하세요 (예:{" "}
                <code className="text-cyan-600">LOCAL_MODEL</code>이 설정되면{" "}
                <code className="text-cyan-600">OPENAI_MODEL</code>은 무시됨).
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;DHELIX.md가 인식되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">getProjectConfigPaths()</code>가 반환하는 두 경로를
                확인하세요. 프로젝트 루트에 <code className="text-cyan-600">DHELIX.md</code>가
                있거나
                <code className="text-cyan-600">.dhelix/DHELIX.md</code>에 있어야 합니다. 파일명의
                대소문자가 정확한지도 확인하세요 (대문자 &quot;DHELIX&quot;).
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;에이전트 루프가 50번째에서 항상 멈춰요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">AGENT_LOOP.maxIterations</code>의 기본값이 50이기
                때문입니다. 이 값은 <code className="text-cyan-600">as const</code>로 타입이
                고정되어 있어 직접 변경하려면 소스 코드를 수정해야 합니다. 대규모 작업에서는 서킷
                브레이커 생성 시 더 높은 값을 전달할 수 있습니다.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;VERSION이 package.json과 다릅니다&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">VERSION</code>은 수동으로 관리되므로
                <code className="text-cyan-600">package.json</code>의 version 필드와 직접 동기화해야
                합니다. 릴리스 프로세스에서 두 값이 일치하는지 확인하는 CI 체크를 추가하는 것을
                권장합니다.
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
                  name: "config-loader.ts",
                  slug: "config-loader",
                  relation: "sibling",
                  desc: "constants.ts의 경로 상수를 사용하여 5-layer 설정 병합을 수행하는 모듈",
                },
                {
                  name: "agent-loop.ts",
                  slug: "agent-loop",
                  relation: "parent",
                  desc: "AGENT_LOOP 상수를 사용하여 반복 제한과 컴팩션 임계치를 결정하는 메인 루프",
                },
                {
                  name: "circuit-breaker.ts",
                  slug: "circuit-breaker",
                  relation: "sibling",
                  desc: "AGENT_LOOP.maxIterations를 기본값으로 사용하는 안전장치 모듈",
                },
                {
                  name: "model-capabilities.ts",
                  slug: "model-capabilities",
                  relation: "sibling",
                  desc: "DEFAULT_MODEL을 기반으로 모델별 능력과 가격 정보를 조회하는 모듈",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
