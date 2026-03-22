"use client";

import { FilePath } from "@/components/FilePath";
import { LayerBadge } from "@/components/LayerBadge";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import { DeepDive } from "@/components/DeepDive";
import { ParamTable } from "@/components/ParamTable";
import { SeeAlso } from "@/components/SeeAlso";

export default function ConfigLoaderPage() {
  return (
    <div className="min-h-screen pt-[100px] pb-20">
      <div className="max-w-[900px] mx-auto px-4 sm:px-8">

        {/* ───────────────────── 1. Header ───────────────────── */}
        <RevealOnScroll>
        <div className="mb-14">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <FilePath path="src/config/loader.ts" />
            <LayerBadge layer="leaf" />
          </div>
          <h1 className="text-[clamp(28px,4vw,44px)] font-black tracking-tight leading-[1.15] mb-3">
            <span className="bg-gradient-to-r from-accent-orange to-accent-cyan bg-clip-text text-transparent">
              Config Loader
            </span>
          </h1>
          <p className="text-[16px] text-text-secondary max-w-[640px]">
            5단계 계층에서 설정을 병합하여 최종 설정을 생성하는 모듈입니다.
            CLI 플래그부터 기본값까지, 우선순위에 따라 <span className="text-accent-cyan font-semibold">deepMerge</span>로 합쳐집니다.
          </p>
        </div>
        </RevealOnScroll>

        {/* ───────────────────── 2. 개요 ───────────────────── */}
        <RevealOnScroll>
          <section className="mb-14">
            <h2 className="text-2xl font-extrabold mb-5 flex items-center gap-2">
              <span>{"📦"}</span> 개요
            </h2>
            <p className="text-[14px] text-text-secondary leading-relaxed mb-4">
              dbcode는 하나의 설정 파일에 의존하지 않습니다.
              <strong className="text-text-primary"> 5개 레이어</strong>에서 설정을 모아
              <span className="text-accent-cyan font-semibold"> deepMerge</span>로 합치고,
              마지막에 <span className="text-accent-purple font-semibold">Zod 스키마</span>로 검증합니다.
              이 구조 덕분에 기본값 위에 사용자 설정을 얹고, 프로젝트별로 덮어쓰고,
              환경변수나 CLI 플래그로 일회성 오버라이드를 할 수 있습니다.
            </p>

            <Callout type="tip" icon="💡">
              <strong>핵심 원칙:</strong> 높은 레벨이 낮은 레벨을 덮어씁니다.
              CLI 플래그가 가장 높고, <code className="text-accent-cyan text-xs">defaults.ts</code>가 가장 낮습니다.
            </Callout>

            <MermaidDiagram
              title="5-Layer 설정 병합 우선순위"
              titleColor="orange"
              chart={`flowchart TB
  L1["🔧 Level 1\\ndefaults.ts\\n(가장 낮은 우선순위)"]
  L2["👤 Level 2\\n~/.dbcode/config.json\\n(사용자 전역)"]
  L3["📁 Level 3\\n.dbcode/config.json\\n(프로젝트별)"]
  L4["🌍 Level 4\\n환경변수\\n(DBCODE_*, OPENAI_*)"]
  L5["⚡ Level 5\\nCLI 플래그\\n(가장 높은 우선순위)"]

  L1 -->|deepMerge| L2
  L2 -->|deepMerge| L3
  L3 -->|deepMerge| L4
  L4 -->|deepMerge| L5
  L5 -->|Zod 검증| FINAL["✅ ResolvedConfig"]

  style L1 fill:#1e293b,stroke:#f59e0b,color:#f1f5f9
  style L2 fill:#1e293b,stroke:#8b5cf6,color:#f1f5f9
  style L3 fill:#1e293b,stroke:#3b82f6,color:#f1f5f9
  style L4 fill:#1e293b,stroke:#10b981,color:#f1f5f9
  style L5 fill:#1e293b,stroke:#ef4444,color:#f1f5f9
  style FINAL fill:#0f172a,stroke:#06b6d4,color:#06b6d4,stroke-width:2px`}
            />

            <div className="bg-bg-card border border-border rounded-xl p-5 mt-4">
              <h4 className="text-[14px] font-bold mb-3">각 레이어가 존재하는 이유</h4>
              <div className="flex flex-col gap-2.5 text-[13px] text-text-secondary">
                <div className="flex gap-3">
                  <span className="text-accent-orange font-bold shrink-0 w-20">Level 1</span>
                  <span>아무 설정 없이도 앱이 동작하도록 보장하는 <strong className="text-text-primary">안전망</strong></span>
                </div>
                <div className="flex gap-3">
                  <span className="text-accent-purple font-bold shrink-0 w-20">Level 2</span>
                  <span>사용자 전역 설정 &mdash; 모든 프로젝트에 공통 적용 (API 키, 테마 등)</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-accent-blue font-bold shrink-0 w-20">Level 3</span>
                  <span>프로젝트별 설정 &mdash; 팀원과 공유 가능 (<code className="text-accent-cyan text-xs">.dbcode/config.json</code>을 Git에 커밋)</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-accent-green font-bold shrink-0 w-20">Level 4</span>
                  <span>환경변수 &mdash; CI/CD, Docker 등 배포 환경별 설정 주입</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-accent-red font-bold shrink-0 w-20">Level 5</span>
                  <span>CLI 플래그 &mdash; <code className="text-accent-cyan text-xs">--model gpt-4o</code>처럼 일회성 덮어쓰기</span>
                </div>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 3. 레퍼런스 ───────────────────── */}
        <RevealOnScroll>
          <section className="mb-14">
            <h2 className="text-2xl font-extrabold mb-5 flex items-center gap-2">
              <span>{"📋"}</span> 레퍼런스
            </h2>

            {/* loadConfig */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-accent-cyan">loadConfig()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[rgba(16,185,129,0.1)] text-accent-green">exported</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[rgba(139,92,246,0.1)] text-accent-purple">async</span>
              </h3>
              <p className="text-[13px] text-text-secondary mb-3">
                5단계 계층 설정 로더의 메인 함수입니다. 모든 설정 소스를 병합하고 Zod 스키마로 검증하여
                <code className="text-accent-cyan text-xs"> ResolvedConfig</code>를 반환합니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "cliOverrides",
                    type: "Partial<AppConfig>",
                    required: false,
                    desc: "CLI 플래그로 전달된 설정 덮어쓰기 값. 기본값은 빈 객체 {}",
                  },
                  {
                    name: "projectDir",
                    type: "string | undefined",
                    required: false,
                    desc: "프로젝트 디렉토리 경로. 지정하면 해당 디렉토리의 .dbcode/config.json을 로딩",
                  },
                ]}
              />

              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-text-primary mb-2">반환 타입: <code className="text-accent-purple text-xs">Promise&lt;ResolvedConfig&gt;</code></h4>
                <ParamTable
                  params={[
                    {
                      name: "config",
                      type: "AppConfig (readonly)",
                      required: true,
                      desc: "최종 병합된 설정 객체. Zod 스키마 검증 통과 보장",
                    },
                    {
                      name: "sources",
                      type: "ReadonlyMap<string, ConfigSource>",
                      required: true,
                      desc: '각 설정 키가 어느 소스에서 왔는지 매핑 (예: "llm" → "environment")',
                    },
                  ]}
                />
              </div>

              <Callout type="warn" icon="⚠️">
                Zod 검증에 실패하면 <code className="text-accent-red text-xs">ConfigError</code>를 던집니다.
                에러 객체의 <code className="text-accent-cyan text-xs">errors</code> 필드에 어떤 필드가 잘못됐는지 상세 정보가 담겨 있습니다.
              </Callout>
            </div>

            {/* loadEnvConfig (내부 함수이지만 중요) */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-accent-cyan">loadEnvConfig()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[rgba(100,116,139,0.1)] text-text-muted">internal</span>
              </h3>
              <p className="text-[13px] text-text-secondary mb-3">
                환경변수에서 설정 관련 값을 추출합니다. <code className="text-accent-cyan text-xs">DBCODE_*</code> 변수가
                <code className="text-accent-cyan text-xs"> OPENAI_*</code> 변수보다 우선합니다.
              </p>

              <div className="bg-bg-card border border-border rounded-xl p-4 mb-3">
                <h4 className="text-[13px] font-bold mb-3">환경변수 우선순위 매트릭스</h4>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[12px]">
                    <thead>
                      <tr>
                        <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted bg-[rgba(255,255,255,0.02)] border-b border-border">설정</th>
                        <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted bg-[rgba(255,255,255,0.02)] border-b border-border">1순위 (최우선)</th>
                        <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted bg-[rgba(255,255,255,0.02)] border-b border-border">2순위</th>
                        <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted bg-[rgba(255,255,255,0.02)] border-b border-border">3순위</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      <tr className="border-b border-[rgba(255,255,255,0.03)]">
                        <td className="p-2.5 text-text-secondary">Base URL</td>
                        <td className="p-2.5 text-accent-red font-semibold">LOCAL_API_BASE_URL</td>
                        <td className="p-2.5 text-accent-orange">DBCODE_BASE_URL</td>
                        <td className="p-2.5 text-accent-green">OPENAI_BASE_URL</td>
                      </tr>
                      <tr className="border-b border-[rgba(255,255,255,0.03)]">
                        <td className="p-2.5 text-text-secondary">API Key</td>
                        <td className="p-2.5 text-accent-orange font-semibold">DBCODE_API_KEY</td>
                        <td className="p-2.5 text-accent-green">OPENAI_API_KEY</td>
                        <td className="p-2.5 text-text-muted">&mdash;</td>
                      </tr>
                      <tr className="border-b border-[rgba(255,255,255,0.03)]">
                        <td className="p-2.5 text-text-secondary">Model</td>
                        <td className="p-2.5 text-accent-red font-semibold">LOCAL_MODEL</td>
                        <td className="p-2.5 text-accent-orange">DBCODE_MODEL</td>
                        <td className="p-2.5 text-accent-green">OPENAI_MODEL</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-text-secondary">Verbose</td>
                        <td className="p-2.5 text-accent-orange font-semibold">DBCODE_VERBOSE</td>
                        <td className="p-2.5 text-text-muted">&mdash;</td>
                        <td className="p-2.5 text-text-muted">&mdash;</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <Callout type="info" icon="🔑">
                <code className="text-accent-cyan text-xs">OPENAI_API_KEY</code>만 설정되고 Base URL이 없으면,
                자동으로 <code className="text-accent-cyan text-xs">https://api.openai.com/v1</code>이 사용됩니다.
                로컬 LLM을 쓸 때는 반드시 <code className="text-accent-cyan text-xs">LOCAL_API_BASE_URL</code>이나
                <code className="text-accent-cyan text-xs"> DBCODE_BASE_URL</code>을 함께 설정하세요.
              </Callout>
            </div>

            {/* deepMerge */}
            <div className="mb-4">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-accent-cyan">deepMerge()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[rgba(100,116,139,0.1)] text-text-muted">internal</span>
              </h3>
              <p className="text-[13px] text-text-secondary mb-3">
                두 객체를 재귀적으로 깊은 병합하는 유틸리티. 양쪽 모두 객체(배열 제외)이면 재귀 병합하고,
                그 외에는 source 값이 target 값을 덮어씁니다. 원본은 변경하지 않습니다 (불변성 보장).
              </p>
              <ParamTable
                params={[
                  {
                    name: "target",
                    type: "Record<string, unknown>",
                    required: true,
                    desc: "병합 대상 (기존 값). 이 객체는 변경되지 않음",
                  },
                  {
                    name: "source",
                    type: "Record<string, unknown>",
                    required: true,
                    desc: "병합 소스 (새로운 값). 충돌 시 이 값이 우선",
                  },
                ]}
              />
            </div>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 4. 사용법 ───────────────────── */}
        <RevealOnScroll>
          <section className="mb-14">
            <h2 className="text-2xl font-extrabold mb-5 flex items-center gap-2">
              <span>{"🚀"}</span> 사용법
            </h2>

            <h3 className="text-[15px] font-bold mb-3">기본 사용 (애플리케이션 부팅 시)</h3>
            <p className="text-[13px] text-text-secondary mb-3">
              앱이 시작될 때 <code className="text-accent-cyan text-xs">loadConfig()</code>를 호출합니다.
              CLI에서 받은 플래그를 <code className="text-accent-cyan text-xs">cliOverrides</code>로 전달하면
              가장 높은 우선순위로 적용됩니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">loadConfig</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./config/loader.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>{"\n\n"}
              <span className="text-[#8b949e]">{"// CLI 플래그로 모델을 오버라이드하는 예시"}</span>{"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">config</span>
              <span className="text-[#c9d1d9]">{", "}</span>
              <span className="text-[#79c0ff]">sources</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#d2a8ff]">loadConfig</span>
              <span className="text-[#c9d1d9]">(</span>{"\n"}
              <span className="text-[#c9d1d9]">{"  { "}</span>
              <span className="text-[#79c0ff]">llm</span>
              <span className="text-[#c9d1d9]">{": { "}</span>
              <span className="text-[#79c0ff]">model</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"gpt-4o"'}</span>
              <span className="text-[#c9d1d9]">{" } },"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#a5d6ff]">{'"./my-project"'}</span>{"\n"}
              <span className="text-[#c9d1d9]">);</span>{"\n\n"}
              <span className="text-[#8b949e]">{"// config.llm.model === \"gpt-4o\"  (CLI 플래그가 최우선)"}</span>{"\n"}
              <span className="text-[#8b949e]">{'// sources.get("llm") === "cli-flags"'}</span>
            </CodeBlock>

            <h3 className="text-[15px] font-bold mb-3 mt-6">설정 파일로 오버라이드하기</h3>
            <p className="text-[13px] text-text-secondary mb-3">
              <code className="text-accent-cyan text-xs">~/.dbcode/config.json</code> (사용자 전역) 또는{" "}
              <code className="text-accent-cyan text-xs">.dbcode/config.json</code> (프로젝트별)에
              JSON 파일을 만들면 자동으로 로딩됩니다. 특정 키만 지정하면 나머지는 기본값이 유지됩니다.
            </p>

            <CodeBlock>
              <span className="text-[#8b949e]">{"// ~/.dbcode/config.json (사용자 전역)"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"{"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#7ee787]">{'"llm"'}</span>
              <span className="text-[#c9d1d9]">{": {"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"    "}</span>
              <span className="text-[#7ee787]">{'"model"'}</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"claude-opus-4-6"'}</span>
              <span className="text-[#c9d1d9]">{","}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"    "}</span>
              <span className="text-[#7ee787]">{'"timeout"'}</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#79c0ff]">180000</span>{"\n"}
              <span className="text-[#c9d1d9]">{"  },"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#7ee787]">{'"verbose"'}</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#79c0ff]">true</span>{"\n"}
              <span className="text-[#c9d1d9]">{"}"}</span>
            </CodeBlock>

            <DeepDive title="환경변수로 설정하기 (CI/CD, Docker)">
              <p className="mb-3">
                배포 환경에서는 설정 파일 대신 환경변수를 사용하는 것이 일반적입니다.
                dbcode는 <code className="text-accent-cyan text-xs">DBCODE_*</code>,{" "}
                <code className="text-accent-cyan text-xs">OPENAI_*</code>,{" "}
                <code className="text-accent-cyan text-xs">LOCAL_*</code> 접두사의 환경변수를 자동 인식합니다.
              </p>

              <CodeBlock>
                <span className="text-[#8b949e]">{"# 로컬 LLM (Ollama 등) 연결"}</span>{"\n"}
                <span className="text-[#ff7b72]">export</span>{" "}
                <span className="text-[#79c0ff]">LOCAL_API_BASE_URL</span>
                <span className="text-[#c9d1d9]">=</span>
                <span className="text-[#a5d6ff]">http://localhost:11434/v1</span>{"\n"}
                <span className="text-[#ff7b72]">export</span>{" "}
                <span className="text-[#79c0ff]">LOCAL_MODEL</span>
                <span className="text-[#c9d1d9]">=</span>
                <span className="text-[#a5d6ff]">llama3.3</span>{"\n\n"}
                <span className="text-[#8b949e]">{"# OpenAI API 사용"}</span>{"\n"}
                <span className="text-[#ff7b72]">export</span>{" "}
                <span className="text-[#79c0ff]">OPENAI_API_KEY</span>
                <span className="text-[#c9d1d9]">=</span>
                <span className="text-[#a5d6ff]">sk-...</span>{"\n"}
                <span className="text-[#ff7b72]">export</span>{" "}
                <span className="text-[#79c0ff]">DBCODE_MODEL</span>
                <span className="text-[#c9d1d9]">=</span>
                <span className="text-[#a5d6ff]">gpt-4o</span>{"\n\n"}
                <span className="text-[#8b949e]">{"# 디버깅 모드"}</span>{"\n"}
                <span className="text-[#ff7b72]">export</span>{" "}
                <span className="text-[#79c0ff]">DBCODE_VERBOSE</span>
                <span className="text-[#c9d1d9]">=</span>
                <span className="text-[#a5d6ff]">true</span>
              </CodeBlock>

              <Callout type="warn" icon="⚠️">
                <code className="text-accent-cyan text-xs">LOCAL_API_BASE_URL</code>과{" "}
                <code className="text-accent-cyan text-xs">LOCAL_MODEL</code>은 최우선순위입니다.
                이 변수들이 설정되면 <code className="text-accent-cyan text-xs">DBCODE_*</code>이나{" "}
                <code className="text-accent-cyan text-xs">OPENAI_*</code> 값은 무시됩니다.
              </Callout>
            </DeepDive>

            <h3 className="text-[15px] font-bold mb-3 mt-6">출처 추적하기 (디버깅용)</h3>
            <p className="text-[13px] text-text-secondary mb-3">
              <code className="text-accent-cyan text-xs">sources</code> Map을 사용하면
              특정 설정이 어디서 왔는지 확인할 수 있어, &ldquo;왜 이 값이 적용됐지?&rdquo; 문제를 쉽게 디버깅할 수 있습니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">config</span>
              <span className="text-[#c9d1d9]">{", "}</span>
              <span className="text-[#79c0ff]">sources</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#d2a8ff]">loadConfig</span>
              <span className="text-[#c9d1d9]">();</span>{"\n\n"}
              <span className="text-[#8b949e]">{"// 각 설정의 출처 확인"}</span>{"\n"}
              <span className="text-[#c9d1d9]">sources.</span>
              <span className="text-[#d2a8ff]">get</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#a5d6ff]">{'"llm"'}</span>
              <span className="text-[#c9d1d9]">);</span>
              <span className="text-[#8b949e]">{"     // → \"environment\" (환경변수에서 옴)"}</span>{"\n"}
              <span className="text-[#c9d1d9]">sources.</span>
              <span className="text-[#d2a8ff]">get</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#a5d6ff]">{'"verbose"'}</span>
              <span className="text-[#c9d1d9]">);</span>
              <span className="text-[#8b949e]">{" // → \"project\" (프로젝트 설정에서 옴)"}</span>{"\n"}
              <span className="text-[#c9d1d9]">sources.</span>
              <span className="text-[#d2a8ff]">get</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#a5d6ff]">{'"*"'}</span>
              <span className="text-[#c9d1d9]">);</span>
              <span className="text-[#8b949e]">{"         // → \"defaults\" (기본값 사용 중)"}</span>
            </CodeBlock>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 5. 내부 구현 ───────────────────── */}
        <RevealOnScroll>
          <section className="mb-14">
            <h2 className="text-2xl font-extrabold mb-5 flex items-center gap-2">
              <span>{"🔍"}</span> 내부 구현
            </h2>

            <h3 className="text-[15px] font-bold mb-3">deepMerge 알고리즘</h3>
            <p className="text-[13px] text-text-secondary mb-3">
              설정 병합의 핵심은 <code className="text-accent-cyan text-xs">deepMerge</code> 함수입니다.
              단순 <code className="text-accent-cyan text-xs">Object.assign</code>과 달리,
              중첩된 객체도 재귀적으로 병합하여 하위 키를 보존합니다.
            </p>

            <MermaidDiagram
              title="deepMerge 동작 흐름"
              titleColor="cyan"
              chart={`flowchart TD
  START["deepMerge(target, source)"] --> COPY["result = { ...target }"]
  COPY --> LOOP["source의 각 key 순회"]
  LOOP --> CHECK{"양쪽 모두\\n순수 객체?\\n(배열 아님)"}
  CHECK -->|Yes| RECURSE["result[key] =\\ndeepMerge(targetVal, sourceVal)"]
  CHECK -->|No| OVERWRITE["result[key] = sourceVal"]
  RECURSE --> NEXT["다음 key"]
  OVERWRITE --> NEXT
  NEXT -->|더 있음| LOOP
  NEXT -->|끝| RETURN["return result"]

  style START fill:#1e293b,stroke:#06b6d4,color:#f1f5f9
  style CHECK fill:#1e293b,stroke:#f59e0b,color:#f1f5f9
  style RECURSE fill:#1e293b,stroke:#8b5cf6,color:#f1f5f9
  style OVERWRITE fill:#1e293b,stroke:#ef4444,color:#f1f5f9
  style RETURN fill:#0f172a,stroke:#10b981,color:#10b981,stroke-width:2px`}
            />

            <h3 className="text-[15px] font-bold mb-3 mt-6">병합 예시</h3>
            <p className="text-[13px] text-text-secondary mb-3">
              아래 예시를 보면 <code className="text-accent-cyan text-xs">model</code>만 덮어쓰이고,
              <code className="text-accent-cyan text-xs"> timeout</code>은 원본 값이 유지되는 것을 확인할 수 있습니다.
            </p>

            <CodeBlock>
              <span className="text-[#8b949e]">{"// target (Level 1: defaults)"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">llm</span>
              <span className="text-[#c9d1d9]">{": { "}</span>
              <span className="text-[#79c0ff]">model</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"gpt-5.1-codex-mini"'}</span>
              <span className="text-[#c9d1d9]">{", "}</span>
              <span className="text-[#79c0ff]">timeout</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#79c0ff]">120000</span>
              <span className="text-[#c9d1d9]">{" } }"}</span>{"\n\n"}
              <span className="text-[#8b949e]">{"// source (Level 2: user config)"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">llm</span>
              <span className="text-[#c9d1d9]">{": { "}</span>
              <span className="text-[#79c0ff]">model</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"claude-opus-4-6"'}</span>
              <span className="text-[#c9d1d9]">{" } }"}</span>{"\n\n"}
              <span className="text-[#8b949e]">{"// 결과 (model만 교체, timeout은 유지)"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">llm</span>
              <span className="text-[#c9d1d9]">{": { "}</span>
              <span className="text-[#79c0ff]">model</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"claude-opus-4-6"'}</span>
              <span className="text-[#c9d1d9]">{", "}</span>
              <span className="text-[#79c0ff]">timeout</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#79c0ff]">120000</span>
              <span className="text-[#c9d1d9]">{" } }"}</span>
            </CodeBlock>

            <Callout type="info" icon="📝">
              <strong>배열은 재귀 병합하지 않습니다.</strong> 배열은 source 값으로 <em>통째로 교체</em>됩니다.
              예를 들어 <code className="text-accent-cyan text-xs">permissions.allow</code>를 프로젝트 설정에서 지정하면
              사용자 설정의 allow 리스트는 무시됩니다.
            </Callout>

            <h3 className="text-[15px] font-bold mb-3 mt-6">설정 파일 로딩 전략</h3>
            <p className="text-[13px] text-text-secondary mb-3">
              <code className="text-accent-cyan text-xs">loadJsonFile()</code>은 파일이 없거나 파싱에 실패하면
              <code className="text-accent-cyan text-xs"> undefined</code>를 반환합니다. 에러를 던지지 않는 &ldquo;조용한 실패&rdquo; 전략으로,
              설정 파일이 선택적(optional)이라는 설계 의도를 반영합니다.
            </p>

            <CodeBlock>
              <span className="text-[#8b949e]">{"// 파일이 없으면 undefined → 병합 단계를 건너뜀"}</span>{"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">userConfig</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#d2a8ff]">loadJsonFile</span>
              <span className="text-[#c9d1d9]">(userConfigPath);</span>{"\n"}
              <span className="text-[#ff7b72]">if</span>{" "}
              <span className="text-[#c9d1d9]">(userConfig) {"{"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"  merged = "}</span>
              <span className="text-[#d2a8ff]">deepMerge</span>
              <span className="text-[#c9d1d9]">(merged, userConfig);</span>{"\n"}
              <span className="text-[#c9d1d9]">{"}"}</span>{" "}
              <span className="text-[#8b949e]">{"// 파일 없으면 이 블록 자체를 건너뜀"}</span>
            </CodeBlock>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 6. 트러블슈팅 ───────────────────── */}
        <RevealOnScroll>
          <section className="mb-14">
            <h2 className="text-2xl font-extrabold mb-5 flex items-center gap-2">
              <span>{"🔧"}</span> 트러블슈팅
            </h2>

            <div className="flex flex-col gap-4">
              {/* FAQ 1 */}
              <div className="bg-bg-card border border-border rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-accent-red">Q.</span> 설정 파일을 수정했는데 적용이 안 돼요
                </h4>
                <div className="text-[13px] text-text-secondary leading-relaxed">
                  <p className="mb-2">
                    <strong className="text-text-primary">원인 1:</strong> 더 높은 우선순위 소스가 덮어쓰고 있습니다.
                    <code className="text-accent-cyan text-xs"> sources.get(&quot;llm&quot;)</code>으로 실제 출처를 확인하세요.
                  </p>
                  <p className="mb-2">
                    <strong className="text-text-primary">원인 2:</strong> JSON 문법 오류.{" "}
                    <code className="text-accent-cyan text-xs">loadJsonFile</code>은 파싱 실패 시 조용히{" "}
                    <code className="text-accent-cyan text-xs">undefined</code>를 반환합니다.
                    터미널에서 <code className="text-accent-cyan text-xs">cat .dbcode/config.json | python3 -m json.tool</code>로 문법을 확인해보세요.
                  </p>
                  <p>
                    <strong className="text-text-primary">원인 3:</strong> 파일 경로가 틀렸습니다.
                    사용자 설정은 <code className="text-accent-cyan text-xs">~/.dbcode/config.json</code>,
                    프로젝트 설정은 <code className="text-accent-cyan text-xs">{"{projectDir}"}/.dbcode/config.json</code>이어야 합니다.
                  </p>
                </div>
              </div>

              {/* FAQ 2 */}
              <div className="bg-bg-card border border-border rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-accent-red">Q.</span> 환경변수를 설정했는데 로컬 LLM에 연결이 안 돼요
                </h4>
                <div className="text-[13px] text-text-secondary leading-relaxed">
                  <p className="mb-2">
                    <strong className="text-text-primary">확인 1:</strong>{" "}
                    <code className="text-accent-cyan text-xs">LOCAL_API_BASE_URL</code>을 설정했나요?
                    <code className="text-accent-cyan text-xs"> OPENAI_API_KEY</code>만 설정하면 자동으로 OpenAI API로 연결됩니다.
                  </p>
                  <p>
                    <strong className="text-text-primary">확인 2:</strong> URL에{" "}
                    <code className="text-accent-cyan text-xs">/chat/completions</code> 경로가 포함되어 있지 않은지 확인하세요.
                    LLM 클라이언트가 자동으로 추가합니다.
                    올바른 예: <code className="text-accent-cyan text-xs">http://localhost:11434/v1</code>
                  </p>
                </div>
              </div>

              {/* FAQ 3 */}
              <div className="bg-bg-card border border-border rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-accent-red">Q.</span> ConfigError: Invalid configuration 에러가 발생해요
                </h4>
                <div className="text-[13px] text-text-secondary leading-relaxed">
                  <p className="mb-2">
                    Zod 스키마 검증에 실패한 것입니다. 에러 메시지의{" "}
                    <code className="text-accent-cyan text-xs">errors</code> 필드를 확인하세요.
                  </p>
                  <p>
                    흔한 원인: <code className="text-accent-cyan text-xs">temperature</code>가 0~2 범위 밖,{" "}
                    <code className="text-accent-cyan text-xs">baseUrl</code>이 유효한 URL이 아님,{" "}
                    <code className="text-accent-cyan text-xs">permissionMode</code>에 잘못된 문자열을 넣었을 때 등.
                  </p>
                </div>
              </div>

              {/* FAQ 4 */}
              <div className="bg-bg-card border border-border rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-accent-red">Q.</span> 프로젝트 설정의 permissions.allow가 사용자 설정과 합쳐지지 않아요
                </h4>
                <div className="text-[13px] text-text-secondary leading-relaxed">
                  <p>
                    <strong className="text-text-primary">이것은 의도된 동작입니다.</strong>{" "}
                    <code className="text-accent-cyan text-xs">deepMerge</code>는 배열을 재귀 병합하지 않고{" "}
                    <em>통째로 교체</em>합니다. 프로젝트 설정에서{" "}
                    <code className="text-accent-cyan text-xs">permissions.allow</code>를 지정하면
                    사용자 설정의 리스트가 완전히 대체됩니다.
                    두 리스트를 합치려면 프로젝트 설정에 사용자 설정의 항목도 포함시키세요.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 7. 관련 문서 ───────────────────── */}
        <RevealOnScroll>
          <section className="mb-8">
            <h2 className="text-2xl font-extrabold mb-5 flex items-center gap-2">
              <span>{"🔗"}</span> 관련 문서
            </h2>

            <SeeAlso
              items={[
                {
                  name: "instruction-loader.ts",
                  slug: "instruction-loader",
                  relation: "sibling",
                  desc: "6단계 DBCODE.md 로딩 체인 — config-loader와 함께 Leaf Layer를 구성",
                },
                {
                  name: "skill-manager.ts",
                  slug: "skill-manager",
                  relation: "sibling",
                  desc: "4개 디렉토리에서 스킬 로딩 — 설정과 독립적으로 동작하는 같은 레이어 모듈",
                },
                {
                  name: "llm/client.ts",
                  slug: "llm-client",
                  relation: "parent",
                  desc: "설정의 llm.baseUrl, llm.model 등을 소비하는 LLM 클라이언트",
                },
                {
                  name: "permissions/manager.ts",
                  slug: "permission-manager",
                  relation: "parent",
                  desc: "설정의 permissionMode, permissions를 소비하는 권한 관리자",
                },
              ]}
            />
          </section>
        </RevealOnScroll>

      </div>
    </div>
  );
}
