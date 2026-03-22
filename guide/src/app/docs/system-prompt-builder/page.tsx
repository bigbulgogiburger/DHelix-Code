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

export default function SystemPromptBuilderPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">

        {/* ───────────────────── 1. Header ───────────────────── */}
        <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <FilePath path="src/core/system-prompt-builder.ts" />
            <LayerBadge layer="core" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mb-3">
            <span className="text-gray-900">
              System Prompt Builder
            </span>
          </h1>
          <p className="text-[16px] text-gray-600 max-w-[640px]">
            동적 시스템 프롬프트 조립 엔진입니다.
            모듈식 섹션들을 <span className="text-cyan-600 font-semibold">우선순위 기반</span>으로 정렬하고,
            <span className="text-violet-600 font-semibold"> 토큰 예산</span> 내에서 greedy packing한 뒤,
            정적/동적 블록을 분리하여 <span className="text-cyan-600 font-semibold">캐시 힌트</span>를 붙입니다.
          </p>
        </div>
        </RevealOnScroll>

        {/* ───────────────────── 2. 개요 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>{"📋"}</span> 개요
            </h2>
            <p className="text-[14px] text-gray-600 leading-relaxed mb-4">
              LLM에게 보내는 시스템 프롬프트는 &ldquo;너는 어떤 AI이고, 어떻게 행동해야 해&rdquo;를 알려주는 텍스트입니다.
              이 모듈은 프롬프트를 하나의 긴 문자열로 하드코딩하지 않고,
              <strong className="text-gray-900"> identity, environment, tools, conventions</strong> 같은
              <span className="text-cyan-600 font-semibold"> 모듈식 섹션</span>으로 분리합니다.
              각 섹션에는 우선순위가 있어서 토큰 예산을 초과하면 낮은 우선순위부터 자동으로 제거됩니다.
              또한 세션 상태(plan mode, subagent, extended thinking)에 따라
              조건부로 섹션을 포함하거나 제외할 수 있습니다.
            </p>

            <Callout type="tip" icon="💡">
              <strong>핵심 원칙:</strong> 높은 우선순위 섹션이 먼저 포함됩니다.
              identity(100)가 가장 높고, feature flags(60)가 가장 낮습니다.
              예산이 부족하면 낮은 우선순위 섹션이 통째로 제거됩니다.
            </Callout>

            <MermaidDiagram
              title="시스템 프롬프트 조립 파이프라인"
              titleColor="cyan"
              chart={`flowchart LR
  COLLECT["📦 섹션 수집<br/><small>모든 섹션 등록</small>"]
  FILTER["🔍 조건 필터링<br/><small>세션 상태로 제외</small>"]
  SORT["📊 우선순위 정렬<br/><small>높은 것 먼저 배치</small>"]
  BUDGET["✂️ 토큰 예산<br/><small>초과 섹션 잘라내기</small>"]
  JOIN["📄 최종 조립<br/><small>구분자로 합치기</small>"]

  COLLECT --> FILTER --> SORT --> BUDGET --> JOIN

  style COLLECT fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style FILTER fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style SORT fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style BUDGET fill:#f1f5f9,stroke:#ef4444,color:#1e293b
  style JOIN fill:#f8fafc,stroke:#10b981,color:#10b981,stroke-width:2px`}
            />

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4">
              <h4 className="text-[14px] font-bold mb-3">섹션 우선순위 맵</h4>
              <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                <div className="flex gap-3">
                  <span className="text-red-600 font-bold shrink-0 w-28">100 identity</span>
                  <span>AI의 정체성, 행동 규칙, 커뮤니케이션 스타일 &mdash; <strong className="text-gray-900">절대 제거 안 됨</strong></span>
                </div>
                <div className="flex gap-3">
                  <span className="text-red-600 font-bold shrink-0 w-28">96 headless</span>
                  <span>headless 모드에서 ask_user 억제 + 자율 진행 지시 (조건부)</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-orange-600 font-bold shrink-0 w-28">95 doing-tasks</span>
                  <span>작업 수행 규칙 &mdash; 파일 읽기 우선, 최소 변경, 완전성 규칙</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-orange-600 font-bold shrink-0 w-28">94 locale</span>
                  <span>응답 언어 설정 (조건부: en이 아닐 때만 포함)</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-amber-600 font-bold shrink-0 w-28">92 plan-mode</span>
                  <span>계획 모드 지시 &mdash; 파일 수정 금지, 계획만 작성 (조건부)</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-amber-600 font-bold shrink-0 w-28">91 low-tool-guide</span>
                  <span>LOW 티어 모델용 도구 사용 예시 가이드 (조건부)</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-amber-600 font-bold shrink-0 w-28">90 environment</span>
                  <span>플랫폼, 작업 디렉토리, git 브랜치, 프로젝트 타입</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-yellow-600 font-bold shrink-0 w-28">88 subagent</span>
                  <span>서브에이전트 컨텍스트 &mdash; explore/plan/general 유형별 지시 (조건부)</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-green-600 font-bold shrink-0 w-28">85 tools</span>
                  <span>도구 목록 + 사용 가이드라인</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-green-600 font-bold shrink-0 w-28">84 deferred-tools</span>
                  <span>지연 로딩 도구 요약 (조건부: deferred mode일 때)</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-green-600 font-bold shrink-0 w-28">82 mcp</span>
                  <span>MCP 서버 목록 + 도구 이름 (조건부: MCP 서버 있을 때)</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-teal-600 font-bold shrink-0 w-28">80 conventions</span>
                  <span>코드 품질 + git 컨벤션 규칙</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-blue-600 font-bold shrink-0 w-28">78 skills</span>
                  <span>스킬(슬래시 명령) 섹션</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-blue-600 font-bold shrink-0 w-28">77 action-bias</span>
                  <span>도구 호출 없이 대화만 하는 것을 방지하는 지시</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-blue-600 font-bold shrink-0 w-28">76 tone</span>
                  <span>응답 톤 프로필 (조건부: normal이 아닐 때)</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-indigo-600 font-bold shrink-0 w-28">75 ext-thinking</span>
                  <span>확장 사고 모드 지시 (조건부)</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-violet-600 font-bold shrink-0 w-28">72 auto-memory</span>
                  <span>MEMORY.md에서 로드한 프로젝트 메모리</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-violet-600 font-bold shrink-0 w-28">70 project</span>
                  <span>DBCODE.md 프로젝트 지침</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-purple-600 font-bold shrink-0 w-28">60 features</span>
                  <span>기능 플래그별 섹션 (parallel-tools, auto-compact 등)</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-gray-500 font-bold shrink-0 w-28">35 repo-map</span>
                  <span>저장소 맵 &mdash; 코드베이스 구조 개요 (가장 낮은 우선순위)</span>
                </div>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 3. 레퍼런스 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>{"📖"}</span> 레퍼런스
            </h2>

            {/* buildSystemPrompt */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">buildSystemPrompt()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">exported</span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                메인 함수입니다. 모든 섹션을 수집하고, 조건 필터링 + 우선순위 정렬 + 토큰 예산 적용을 거쳐
                최종 시스템 프롬프트 문자열을 반환합니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "options",
                    type: "BuildSystemPromptOptions",
                    required: false,
                    desc: "빌드 옵션 전체. 미지정 시 기본값 사용 (process.cwd(), 기본 예산 등)",
                  },
                ]}
              />

              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">반환 타입: <code className="text-violet-600 text-xs">string</code></h4>
                <p className="text-[13px] text-gray-600">
                  조립 완료된 시스템 프롬프트. 각 섹션은 <code className="text-cyan-600 text-xs">{'"\\n\\n---\\n\\n"'}</code> 구분자로 연결됩니다.
                </p>
              </div>

              <Callout type="warn" icon="⚠️">
                토큰 예산(기본 32,000)을 초과하면 낮은 우선순위 섹션이 <strong>통째로 제거</strong>됩니다.
                부분 잘림이 아니라 전체 섹션 단위로 제거되므로, 중요한 내용은 높은 우선순위 섹션에 배치하세요.
              </Callout>
            </div>

            {/* buildStructuredSystemPrompt */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">buildStructuredSystemPrompt()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">exported</span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                프롬프트 캐싱을 지원하는 구조화된 시스템 프롬프트를 빌드합니다.
                내부적으로 <code className="text-cyan-600 text-xs">buildSystemPrompt()</code>를 호출한 후,
                결과를 정적/동적 블록으로 분리하여 <code className="text-cyan-600 text-xs">cache_control</code> 힌트를 추가합니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "options",
                    type: "BuildSystemPromptOptions",
                    required: false,
                    desc: "buildSystemPrompt와 동일한 옵션",
                  },
                ]}
              />

              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">반환 타입: <code className="text-violet-600 text-xs">StructuredSystemPrompt</code></h4>
                <ParamTable
                  params={[
                    {
                      name: "text",
                      type: "string",
                      required: true,
                      desc: "전체 텍스트 (캐싱 미지원 프로바이더용 — OpenAI 등)",
                    },
                    {
                      name: "blocks",
                      type: "readonly SystemPromptBlock[]",
                      required: true,
                      desc: "캐싱 힌트가 포함된 블록 배열 (Anthropic용)",
                    },
                  ]}
                />
              </div>
            </div>

            {/* buildSystemReminder */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">buildSystemReminder()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">exported</span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                대화 중간에 삽입하는 시스템 리마인더를 생성합니다.
                LLM이 반복적인 실수를 할 때 적절한 교정 메시지를 <code className="text-cyan-600 text-xs">{"<system-reminder>"}</code> 태그로 감싸 주입합니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "type",
                    type: '"tool-usage" | "code-quality" | "git-safety" | "context-limit"',
                    required: true,
                    desc: "리마인더 유형. 각 유형별로 다른 교정 메시지를 생성",
                  },
                  {
                    name: "context",
                    type: "Record<string, unknown>",
                    required: false,
                    desc: '리마인더에 포함할 동적 데이터 (예: context-limit일 때 { usagePercent: 85 })',
                  },
                ]}
              />

              <div className="bg-white border border-gray-200 rounded-xl p-4 mt-3">
                <h4 className="text-[13px] font-bold mb-3">리마인더 유형별 용도</h4>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[12px]">
                    <thead>
                      <tr>
                        <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">유형</th>
                        <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">트리거 상황</th>
                        <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">교정 내용</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-600">
                      <tr className="border-b border-gray-200">
                        <td className="p-2.5 font-mono text-cyan-600">tool-usage</td>
                        <td className="p-2.5">도구 없이 텍스트만 반복 출력할 때</td>
                        <td className="p-2.5">file_read 우선, 병렬 호출, grep 사용 등</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="p-2.5 font-mono text-cyan-600">code-quality</td>
                        <td className="p-2.5">불필요한 리팩토링이나 과잉 에러 핸들링 시</td>
                        <td className="p-2.5">최소 변경, 기존 스타일 준수</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="p-2.5 font-mono text-cyan-600">git-safety</td>
                        <td className="p-2.5">위험한 git 명령 시도 시</td>
                        <td className="p-2.5">force push, reset --hard 금지, diff 확인</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-mono text-cyan-600">context-limit</td>
                        <td className="p-2.5">컨텍스트 윈도우가 임계치에 도달할 때</td>
                        <td className="p-2.5">간결하게, 대용량 파일 읽기 자제, 요약 사용</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* compressToolDescription */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">compressToolDescription()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">exported</span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                LOW 티어 모델용 도구 설명 압축 유틸리티입니다.
                <code className="text-cyan-600 text-xs">low</code> 티어에서만 설명의 첫 문장만 유지하여 토큰을 절약합니다.
                <code className="text-cyan-600 text-xs">medium</code>, <code className="text-cyan-600 text-xs">high</code> 티어에서는 원본을 그대로 반환합니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "description",
                    type: "string",
                    required: true,
                    desc: "원본 도구 설명 문자열",
                  },
                  {
                    name: "tier",
                    type: "CapabilityTier",
                    required: true,
                    desc: '모델 능력 수준 ("high" | "medium" | "low")',
                  },
                ]}
              />
            </div>

            {/* 주요 인터페이스 */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-3">주요 인터페이스</h3>

              {/* PromptSection */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="font-mono text-violet-600">PromptSection</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">exported</span>
                </h4>
                <p className="text-[12px] text-gray-500 mb-3">
                  시스템 프롬프트의 개별 섹션을 나타냅니다. 각 섹션은 고유 ID, 내용, 우선순위를 가집니다.
                </p>
                <ParamTable
                  params={[
                    { name: "id", type: "string", required: true, desc: "섹션 고유 식별자 (디버깅 및 추적용)" },
                    { name: "content", type: "string", required: true, desc: "섹션의 실제 텍스트 내용" },
                    { name: "priority", type: "number", required: true, desc: "우선순위 (높을수록 먼저 포함, 100=최고)" },
                    { name: "condition", type: "() => boolean", required: false, desc: "조건 함수 — false 반환 시 제외. undefined면 항상 포함" },
                    { name: "tokenBudget", type: "number", required: false, desc: "이 섹션의 최대 토큰 수. 초과 시 줄 단위로 잘림" },
                  ]}
                />
              </div>

              {/* SessionState */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="font-mono text-violet-600">SessionState</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">exported</span>
                </h4>
                <p className="text-[12px] text-gray-500 mb-3">
                  세션의 현재 상태를 나타내며, 조건부 섹션 포함 여부를 결정하는 데 사용됩니다.
                </p>
                <ParamTable
                  params={[
                    { name: "mode", type: '"normal" | "plan"', required: true, desc: "현재 모드 — plan이면 계획 모드 섹션 활성화" },
                    { name: "isSubagent", type: "boolean", required: true, desc: "서브에이전트로 실행 중인지 여부" },
                    { name: "subagentType", type: '"explore" | "plan" | "general"', required: false, desc: "서브에이전트 유형별 특화 지시" },
                    { name: "availableTools", type: "readonly string[]", required: true, desc: "사용 가능한 도구 이름 목록" },
                    { name: "extendedThinkingEnabled", type: "boolean", required: true, desc: "확장 사고(extended thinking) 활성화 여부" },
                    { name: "features", type: "Record<string, boolean>", required: true, desc: "활성화된 기능 플래그 매핑" },
                  ]}
                />
              </div>

              {/* BuildSystemPromptOptions */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="font-mono text-violet-600">BuildSystemPromptOptions</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">exported</span>
                </h4>
                <p className="text-[12px] text-gray-500 mb-3">
                  프롬프트 조립에 필요한 모든 입력을 담고 있는 옵션 객체입니다.
                </p>
                <ParamTable
                  params={[
                    { name: "projectInstructions", type: "string", required: false, desc: "DBCODE.md에서 로드한 프로젝트 지침" },
                    { name: "workingDirectory", type: "string", required: false, desc: "작업 디렉토리 (기본: process.cwd())" },
                    { name: "toolRegistry", type: "ToolRegistry", required: false, desc: "등록된 도구 레지스트리 — 도구 섹션 생성에 사용" },
                    { name: "mcpServers", type: "{ name, tools }[]", required: false, desc: "MCP 서버 목록 — MCP 섹션 생성에 사용" },
                    { name: "customSections", type: "PromptSection[]", required: false, desc: "외부에서 주입할 커스텀 섹션" },
                    { name: "skillsPromptSection", type: "string", required: false, desc: "스킬 섹션 내용 (미리 렌더링된 문자열)" },
                    { name: "autoMemoryContent", type: "string", required: false, desc: "MEMORY.md에서 로드한 자동 메모리 내용" },
                    { name: "sessionState", type: "SessionState", required: false, desc: "세션 상태 — 조건부 섹션 제어" },
                    { name: "totalTokenBudget", type: "number", required: false, desc: "전체 토큰 예산 (기본: 32,000)" },
                    { name: "capabilityTier", type: "CapabilityTier", required: false, desc: "모델 능력 수준 — 프롬프트 복잡도 자동 조절" },
                    { name: "locale", type: "string", required: false, desc: '응답 언어 (기본: "en")' },
                    { name: "tone", type: "string", required: false, desc: '응답 톤 (기본: "normal")' },
                    { name: "repoMapContent", type: "string", required: false, desc: "미리 렌더링된 저장소 맵 내용" },
                    { name: "isHeadless", type: "boolean", required: false, desc: "headless(비대화형) 모드 여부" },
                  ]}
                />
              </div>

              {/* SystemPromptBlock / StructuredSystemPrompt */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="font-mono text-violet-600">SystemPromptBlock</span> / <span className="font-mono text-violet-600">StructuredSystemPrompt</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">exported</span>
                </h4>
                <p className="text-[12px] text-gray-500 mb-3">
                  캐시 힌트를 지원하는 블록 구조체입니다.
                  <code className="text-cyan-600 text-xs">SystemPromptBlock</code>은 개별 블록,
                  <code className="text-cyan-600 text-xs"> StructuredSystemPrompt</code>은 전체 text + blocks 배열을 포함합니다.
                </p>
                <ParamTable
                  params={[
                    { name: "type", type: '"text"', required: true, desc: "블록 유형 (현재 text만 지원)" },
                    { name: "text", type: "string", required: true, desc: "블록의 텍스트 내용" },
                    { name: "cache_control", type: '{ type: "ephemeral" }', required: false, desc: "Anthropic API용 캐싱 힌트 — 정적 블록에만 설정" },
                  ]}
                />
              </div>
            </div>

            {/* TIER_BUDGETS 상수 */}
            <div className="mb-4">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">TIER_BUDGETS</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-600">constant</span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                모델 능력 수준(tier)별 토큰 예산 배분표입니다.
                <code className="text-cyan-600 text-xs">capabilityTier</code>가 지정되면 이 값이 각 섹션의
                <code className="text-cyan-600 text-xs"> tokenBudget</code>으로 적용됩니다.
              </p>

              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[12px]">
                    <thead>
                      <tr>
                        <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">항목</th>
                        <th className="p-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-green-600 bg-gray-50 border-b border-gray-200">high</th>
                        <th className="p-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-gray-50 border-b border-gray-200">medium</th>
                        <th className="p-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-red-600 bg-gray-50 border-b border-gray-200">low</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono text-gray-600 text-center">
                      <tr className="border-b border-gray-200">
                        <td className="p-2.5 text-left font-sans">전체 예산</td>
                        <td className="p-2.5 text-green-600 font-semibold">12,000</td>
                        <td className="p-2.5 text-amber-600">8,000</td>
                        <td className="p-2.5 text-red-600">4,000</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="p-2.5 text-left font-sans">도구 설명</td>
                        <td className="p-2.5">4,000</td>
                        <td className="p-2.5">2,500</td>
                        <td className="p-2.5">1,500</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="p-2.5 text-left font-sans">지침</td>
                        <td className="p-2.5">3,000</td>
                        <td className="p-2.5">2,000</td>
                        <td className="p-2.5">1,000</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="p-2.5 text-left font-sans">저장소 맵</td>
                        <td className="p-2.5">5,000</td>
                        <td className="p-2.5">2,000</td>
                        <td className="p-2.5">500</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-left font-sans">스킬</td>
                        <td className="p-2.5">2,000</td>
                        <td className="p-2.5">1,000</td>
                        <td className="p-2.5">500</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <Callout type="info" icon="📝">
                <code className="text-cyan-600 text-xs">totalTokenBudget</code> 옵션이 명시적으로 지정되면
                TIER_BUDGETS의 <code className="text-cyan-600 text-xs">totalBudget</code>보다 우선합니다.
                개별 섹션 예산은 tier 기반으로만 적용됩니다.
              </Callout>
            </div>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 4. 사용법 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>{"🚀"}</span> 사용법
            </h2>

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용 (Agent Loop에서)</h3>
            <p className="text-[13px] text-gray-600 mb-3">
              Agent Loop이 시작될 때 <code className="text-cyan-600 text-xs">buildSystemPrompt()</code>를 호출하여
              LLM에 전달할 시스템 프롬프트를 생성합니다. 도구 레지스트리와 세션 상태를 전달하면
              상황에 맞는 프롬프트가 자동으로 조립됩니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">buildSystemPrompt</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./core/system-prompt-builder.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>{"\n\n"}
              <span className="text-[#8b949e]">{"// 기본 사용 — 최소한의 프롬프트"}</span>{"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">prompt</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#d2a8ff]">buildSystemPrompt</span>
              <span className="text-[#c9d1d9]">();</span>{"\n\n"}
              <span className="text-[#8b949e]">{"// 옵션 전달 — 도구 + 세션 상태 포함"}</span>{"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">fullPrompt</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#d2a8ff]">buildSystemPrompt</span>
              <span className="text-[#c9d1d9]">({"{"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">toolRegistry</span>
              <span className="text-[#c9d1d9]">,</span>{"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">sessionState</span>
              <span className="text-[#c9d1d9]">{": {"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"    "}</span>
              <span className="text-[#79c0ff]">mode</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"normal"'}</span>
              <span className="text-[#c9d1d9]">,</span>{"\n"}
              <span className="text-[#c9d1d9]">{"    "}</span>
              <span className="text-[#79c0ff]">isSubagent</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#79c0ff]">false</span>
              <span className="text-[#c9d1d9]">,</span>{"\n"}
              <span className="text-[#c9d1d9]">{"    "}</span>
              <span className="text-[#79c0ff]">extendedThinkingEnabled</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#79c0ff]">true</span>
              <span className="text-[#c9d1d9]">,</span>{"\n"}
              <span className="text-[#c9d1d9]">{"    "}</span>
              <span className="text-[#79c0ff]">availableTools</span>
              <span className="text-[#c9d1d9]">{": [],"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"    "}</span>
              <span className="text-[#79c0ff]">features</span>
              <span className="text-[#c9d1d9]">{": { "}</span>
              <span className="text-[#a5d6ff]">{'"parallel-tools"'}</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#79c0ff]">true</span>
              <span className="text-[#c9d1d9]">{" },"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"  },"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">capabilityTier</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"high"'}</span>
              <span className="text-[#c9d1d9]">,</span>{"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">locale</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"ko"'}</span>
              <span className="text-[#c9d1d9]">,</span>{"\n"}
              <span className="text-[#c9d1d9]">{"});"}</span>
            </CodeBlock>

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>캐시 최적화 (Anthropic API)</h3>
            <p className="text-[13px] text-gray-600 mb-3">
              Anthropic API를 사용하는 경우, <code className="text-cyan-600 text-xs">buildStructuredSystemPrompt()</code>를 사용하면
              정적 블록에 <code className="text-cyan-600 text-xs">cache_control</code> 힌트가 자동으로 추가됩니다.
              identity, tools, conventions 같은 변하지 않는 섹션은 캐싱되어 반복 호출 비용을 절약합니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">buildStructuredSystemPrompt</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./core/system-prompt-builder.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>{"\n\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">text</span>
              <span className="text-[#c9d1d9]">{", "}</span>
              <span className="text-[#79c0ff]">blocks</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#d2a8ff]">buildStructuredSystemPrompt</span>
              <span className="text-[#c9d1d9]">(options);</span>{"\n\n"}
              <span className="text-[#8b949e]">{"// OpenAI → text 필드 사용"}</span>{"\n"}
              <span className="text-[#8b949e]">{"// Anthropic → blocks 배열 사용 (cache_control 포함)"}</span>{"\n"}
              <span className="text-[#c9d1d9]">blocks.</span>
              <span className="text-[#d2a8ff]">forEach</span>
              <span className="text-[#c9d1d9]">((</span>
              <span className="text-[#79c0ff]">b</span>
              <span className="text-[#c9d1d9]">) </span>
              <span className="text-[#ff7b72]">{"=>"}</span>
              <span className="text-[#c9d1d9]"> {"{"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#8b949e]">{"// 정적 블록: { type: 'text', text: '...', cache_control: { type: 'ephemeral' } }"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#8b949e]">{"// 동적 블록: { type: 'text', text: '...' }  ← cache_control 없음"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"});"}</span>
            </CodeBlock>

            <DeepDive title="서브에이전트에서 사용하기">
              <p className="mb-3">
                서브에이전트를 생성할 때 <code className="text-cyan-600 text-xs">sessionState.isSubagent = true</code>로 설정하면
                서브에이전트 전용 지시가 프롬프트에 포함됩니다.
                <code className="text-cyan-600 text-xs"> subagentType</code>에 따라 탐색/계획/일반 유형별로 다른 지시가 추가됩니다.
              </p>

              <CodeBlock>
                <span className="text-[#ff7b72]">const</span>{" "}
                <span className="text-[#79c0ff]">explorerPrompt</span>{" "}
                <span className="text-[#c9d1d9]">=</span>{" "}
                <span className="text-[#d2a8ff]">buildSystemPrompt</span>
                <span className="text-[#c9d1d9]">({"{"}</span>{"\n"}
                <span className="text-[#c9d1d9]">{"  "}</span>
                <span className="text-[#79c0ff]">sessionState</span>
                <span className="text-[#c9d1d9]">{": {"}</span>{"\n"}
                <span className="text-[#c9d1d9]">{"    "}</span>
                <span className="text-[#79c0ff]">mode</span>
                <span className="text-[#c9d1d9]">{": "}</span>
                <span className="text-[#a5d6ff]">{'"normal"'}</span>
                <span className="text-[#c9d1d9]">,</span>{"\n"}
                <span className="text-[#c9d1d9]">{"    "}</span>
                <span className="text-[#79c0ff]">isSubagent</span>
                <span className="text-[#c9d1d9]">{": "}</span>
                <span className="text-[#79c0ff]">true</span>
                <span className="text-[#c9d1d9]">,</span>{"\n"}
                <span className="text-[#c9d1d9]">{"    "}</span>
                <span className="text-[#79c0ff]">subagentType</span>
                <span className="text-[#c9d1d9]">{": "}</span>
                <span className="text-[#a5d6ff]">{'"explore"'}</span>
                <span className="text-[#c9d1d9]">,</span>{"\n"}
                <span className="text-[#c9d1d9]">{"    "}</span>
                <span className="text-[#79c0ff]">extendedThinkingEnabled</span>
                <span className="text-[#c9d1d9]">{": "}</span>
                <span className="text-[#79c0ff]">false</span>
                <span className="text-[#c9d1d9]">,</span>{"\n"}
                <span className="text-[#c9d1d9]">{"    "}</span>
                <span className="text-[#79c0ff]">availableTools</span>
                <span className="text-[#c9d1d9]">{": ["}</span>
                <span className="text-[#a5d6ff]">{'"file_read"'}</span>
                <span className="text-[#c9d1d9]">{", "}</span>
                <span className="text-[#a5d6ff]">{'"grep_search"'}</span>
                <span className="text-[#c9d1d9]">{"],"}</span>{"\n"}
                <span className="text-[#c9d1d9]">{"    "}</span>
                <span className="text-[#79c0ff]">features</span>
                <span className="text-[#c9d1d9]">{": {},"}</span>{"\n"}
                <span className="text-[#c9d1d9]">{"  },"}</span>{"\n"}
                <span className="text-[#c9d1d9]">{"  "}</span>
                <span className="text-[#79c0ff]">capabilityTier</span>
                <span className="text-[#c9d1d9]">{": "}</span>
                <span className="text-[#a5d6ff]">{'"medium"'}</span>
                <span className="text-[#c9d1d9]">,</span>{"\n"}
                <span className="text-[#c9d1d9]">{"});"}</span>
              </CodeBlock>

              <Callout type="warn" icon="⚠️">
                서브에이전트의 <code className="text-cyan-600 text-xs">explore</code> 타입은 &ldquo;반드시 도구를 호출하라&rdquo;는
                강한 지시를 포함합니다. 도구 없이 텍스트만 반복 출력하는 문제를 방지하기 위한 것이지만,
                너무 공격적으로 도구를 호출할 수 있으므로 반복 횟수 제한(15회)과 함께 사용해야 합니다.
              </Callout>
            </DeepDive>

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>시스템 리마인더 사용하기</h3>
            <p className="text-[13px] text-gray-600 mb-3">
              대화가 길어지면서 LLM이 초기 지시를 &ldquo;잊어버리는&rdquo; 현상이 발생할 수 있습니다.
              <code className="text-cyan-600 text-xs"> buildSystemReminder()</code>를 사용하면 적절한 시점에
              교정 메시지를 주입할 수 있습니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">buildSystemReminder</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./core/system-prompt-builder.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>{"\n\n"}
              <span className="text-[#8b949e]">{"// 컨텍스트가 85% 차면 간결 모드 리마인더 주입"}</span>{"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">reminder</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#d2a8ff]">buildSystemReminder</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#a5d6ff]">{'"context-limit"'}</span>
              <span className="text-[#c9d1d9]">, {"{"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">usagePercent</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#79c0ff]">85</span>{"\n"}
              <span className="text-[#c9d1d9]">{"});"}</span>{"\n\n"}
              <span className="text-[#8b949e]">{"// → '<system-reminder>\\nContext window is 85% full.\\n...\\n</system-reminder>'"}</span>
            </CodeBlock>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 5. 내부 구현 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>{"⚙️"}</span> 내부 구현
            </h2>

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>assembleSections 알고리즘</h3>
            <p className="text-[13px] text-gray-600 mb-3">
              섹션 조립의 핵심 함수 <code className="text-cyan-600 text-xs">assembleSections()</code>은
              3단계 파이프라인을 수행합니다: 조건 필터링 → 우선순위 정렬 → 예산 기반 greedy packing.
            </p>

            <MermaidDiagram
              title="assembleSections 상태 다이어그램"
              titleColor="purple"
              chart={`graph LR
  INPUT(("sections[]")) --> FILTER["Filter<br/><small>조건 함수로 필터링</small>"]
  FILTER -->|"active[]"| SORT["Sort<br/><small>우선순위 내림차순 정렬</small>"]
  SORT -->|"sorted[]"| BPS["BudgetPerSection<br/><small>개별 섹션 토큰 제한</small>"]
  BPS -->|"budgeted[]"| GP["GreedyPack<br/><small>전체 예산 내 포함 결정</small>"]
  GP -->|"string"| OUTPUT(("최종 프롬프트"))

  subgraph FILTER_DETAIL["Filter 상세"]
    CC["CheckCondition<br/><small>조건 함수 실행</small>"]
    CC -->|"true / undefined"| INC["Include<br/><small>섹션 포함</small>"]
    CC -->|"false"| SKIP["Skip<br/><small>섹션 제외</small>"]
  end

  subgraph BPS_DETAIL["BudgetPerSection 상세"]
    ET["EstimateTokens<br/><small>토큰 수 추정</small>"]
    ET -->|"초과"| TRUNC["Truncate<br/><small>줄 단위 잘라내기</small>"]
    ET -->|"이내"| PT["PassThrough<br/><small>원본 그대로 유지</small>"]
  end

  subgraph GP_DETAIL["GreedyPack 상세"]
    AT["AccumulateTokens<br/><small>토큰 누적 계산</small>"]
    AT -->|"예산 이내"| ADD["AddSection<br/><small>포함 목록에 추가</small>"]
    AT -->|"예산 초과"| DROP["DropSection<br/><small>섹션 통째로 건너뜀</small>"]
  end

  style FILTER fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style SORT fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style BPS fill:#f1f5f9,stroke:#ef4444,color:#1e293b
  style GP fill:#f1f5f9,stroke:#10b981,color:#1e293b
  style INC fill:#dcfce7,stroke:#10b981,color:#065f46
  style SKIP fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style ADD fill:#dcfce7,stroke:#10b981,color:#065f46
  style DROP fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
            />

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>Greedy Packing 전략</h3>
            <p className="text-[13px] text-gray-600 mb-3">
              우선순위 순으로 정렬된 섹션을 순회하면서 토큰을 누적합니다.
              예산을 초과하는 시점에서 해당 섹션은 <strong className="text-gray-900">통째로 건너뛰고</strong>,
              다음 섹션을 시도하지 않습니다.
              이는 &ldquo;가장 중요한 것부터 넣는&rdquo; 전략으로, 배낭 문제(knapsack problem)의 greedy 근사입니다.
            </p>

            <CodeBlock>
              <span className="text-[#8b949e]">{"// assembleSections 핵심 로직"}</span>{"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">included</span>
              <span className="text-[#c9d1d9]">{": PromptSection[] = [];"}</span>{"\n"}
              <span className="text-[#ff7b72]">let</span>{" "}
              <span className="text-[#79c0ff]">totalTokens</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#79c0ff]">0</span>
              <span className="text-[#c9d1d9]">;</span>{"\n\n"}
              <span className="text-[#ff7b72]">for</span>{" "}
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">section</span>{" "}
              <span className="text-[#ff7b72]">of</span>{" "}
              <span className="text-[#79c0ff]">budgeted</span>
              <span className="text-[#c9d1d9]">) {"{"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">sectionTokens</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#d2a8ff]">estimateTokens</span>
              <span className="text-[#c9d1d9]">(section.content);</span>{"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#ff7b72]">if</span>{" "}
              <span className="text-[#c9d1d9]">(totalTokens + sectionTokens {"<="} budget) {"{"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"    included."}</span>
              <span className="text-[#d2a8ff]">push</span>
              <span className="text-[#c9d1d9]">(section);</span>{"\n"}
              <span className="text-[#c9d1d9]">{"    totalTokens += sectionTokens;"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"  }"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#8b949e]">{"// 초과 시 이 섹션을 건너뜀 (greedy: 다음 섹션 시도 안 함)"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"}"}</span>
            </CodeBlock>

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>truncateToTokenBudget</h3>
            <p className="text-[13px] text-gray-600 mb-3">
              개별 섹션이 자체 <code className="text-cyan-600 text-xs">tokenBudget</code>을 초과하면
              줄 단위로 잘립니다. 줄 중간에서 자르지 않아 가독성을 보장하며,
              잘린 경우 마지막에 <code className="text-cyan-600 text-xs">...(truncated)</code>를 추가합니다.
            </p>

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>캐시 블록 분리 전략</h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">buildStructuredSystemPrompt()</code>는 프롬프트를
              <code className="text-cyan-600 text-xs"> {"---"}</code> 구분자로 분리한 후,
              각 파트가 <strong className="text-gray-900">동적</strong>(Environment, Project Instructions, Auto Memory)인지
              <strong className="text-gray-900"> 정적</strong>(나머지 전부)인지 판별합니다.
            </p>

            <MermaidDiagram
              title="정적/동적 블록 분리 흐름"
              titleColor="orange"
              chart={`flowchart TD
  TEXT["전체 프롬프트 텍스트<br/><small>조립된 시스템 프롬프트</small>"] --> SPLIT["구분자 분리<br/><small>--- 기준으로 파트 나누기</small>"]
  SPLIT --> LOOP["각 파트 순회<br/><small>파트별 정적/동적 판별</small>"]
  LOOP --> CHECK{"동적 접두사?<br/>(Environment,<br/>Project, Memory)"}
  CHECK -->|Yes| FLUSH["정적 버퍼 flush<br/><small>cache_control 힌트 추가</small>"]
  FLUSH --> DYNAMIC["동적 블록 추가<br/><small>캐시 제외 블록</small>"]
  CHECK -->|No| BUFFER["정적 버퍼 누적<br/><small>연속 정적 블록 합치기</small>"]
  DYNAMIC --> NEXT["다음 파트<br/><small>순회 계속</small>"]
  BUFFER --> NEXT
  NEXT -->|더 있음| LOOP
  NEXT -->|끝| FINAL["잔여 버퍼 flush<br/><small>마지막 정적 블록 처리</small>"]

  style TEXT fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style CHECK fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style FLUSH fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style DYNAMIC fill:#f1f5f9,stroke:#ef4444,color:#1e293b
  style BUFFER fill:#f1f5f9,stroke:#10b981,color:#1e293b
  style FINAL fill:#f8fafc,stroke:#8b5cf6,color:#8b5cf6,stroke-width:2px`}
            />

            <Callout type="info" icon="📝">
              <strong>정적 블록은 연속으로 합쳐집니다.</strong>
              identity + tools + conventions가 모두 정적이면 하나의 큰 정적 블록으로 합쳐진 후
              <code className="text-cyan-600 text-xs"> cache_control</code>이 한 번만 추가됩니다.
              이는 Anthropic API의 캐시 적중률을 높이기 위한 전략입니다.
            </Callout>

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>프로젝트 감지 로직</h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">detectProjectType()</code>은 작업 디렉토리의 특정 파일 존재 여부로
              프로젝트 유형을 판별합니다. <code className="text-cyan-600 text-xs">detectGitContext()</code>는
              git 브랜치, dirty 상태, 최근 3개 커밋을 안전하게 감지합니다 (git 저장소가 아니면 null).
            </p>

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h4 className="text-[13px] font-bold mb-3">프로젝트 유형 감지 매핑</h4>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr>
                      <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">감지 파일</th>
                      <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">프로젝트 유형</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600">
                    <tr className="border-b border-gray-200">
                      <td className="p-2.5 font-mono text-cyan-600">package.json</td>
                      <td className="p-2.5">Node.js</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="p-2.5 font-mono text-cyan-600">Cargo.toml</td>
                      <td className="p-2.5">Rust</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="p-2.5 font-mono text-cyan-600">go.mod</td>
                      <td className="p-2.5">Go</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="p-2.5 font-mono text-cyan-600">pyproject.toml / setup.py</td>
                      <td className="p-2.5">Python</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="p-2.5 font-mono text-cyan-600">pom.xml / build.gradle</td>
                      <td className="p-2.5">Java</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-cyan-600">Gemfile</td>
                      <td className="p-2.5">Ruby</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 6. 트러블슈팅 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>{"🔧"}</span> 트러블슈팅
            </h2>

            <div className="flex flex-col gap-4">
              {/* FAQ 1 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> 프로젝트 지침(DBCODE.md)이 프롬프트에 포함되지 않아요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    <strong className="text-gray-900">원인 1:</strong> 토큰 예산 초과.
                    프로젝트 지침은 우선순위 70으로, 예산이 빠듯하면 가장 먼저 제거 대상이 됩니다.
                    <code className="text-cyan-600 text-xs"> capabilityTier</code>가 <code className="text-cyan-600 text-xs">{'"low"'}</code>이면
                    전체 예산이 4,000 토큰밖에 안 되므로 대부분 포함되지 않습니다.
                  </p>
                  <p className="mb-2">
                    <strong className="text-gray-900">원인 2:</strong> 파일 경로 오류.
                    <code className="text-cyan-600 text-xs"> DBCODE.md</code>는 프로젝트 루트 또는
                    <code className="text-cyan-600 text-xs"> .dbcode/</code> 디렉토리에 있어야 합니다.
                    <code className="text-cyan-600 text-xs"> getProjectConfigPaths()</code>가 반환하는 경로를 확인하세요.
                  </p>
                  <p>
                    <strong className="text-gray-900">원인 3:</strong> <code className="text-cyan-600 text-xs">projectInstructions</code> 옵션이
                    명시적으로 전달된 경우 파일 로딩을 건너뜁니다.
                  </p>
                </div>
              </div>

              {/* FAQ 2 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> 소형 모델에서 도구 사용을 잘 못 해요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    <strong className="text-gray-900">확인 1:</strong>{" "}
                    <code className="text-cyan-600 text-xs">capabilityTier</code>가 <code className="text-cyan-600 text-xs">{'"low"'}</code>로 설정되어 있는지 확인하세요.
                    low 티어에서는 자동으로 <strong>도구 사용 예시 가이드</strong>와 <strong>CoT 스캐폴딩</strong>이 추가됩니다.
                  </p>
                  <p>
                    <strong className="text-gray-900">확인 2:</strong>{" "}
                    <code className="text-cyan-600 text-xs">compressToolDescription()</code>이 도구 설명을 첫 문장으로 잘라내므로,
                    핵심 정보가 첫 문장에 없는 도구는 사용법이 불명확할 수 있습니다.
                  </p>
                </div>
              </div>

              {/* FAQ 3 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> plan mode나 extended thinking 섹션이 프롬프트에 안 나와요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    <strong className="text-gray-900">원인:</strong> <code className="text-cyan-600 text-xs">sessionState</code>를
                    전달하지 않으면 조건부 섹션이 아예 추가되지 않습니다.
                    <code className="text-cyan-600 text-xs"> sessionState</code> 객체를 반드시 전달하고,
                    <code className="text-cyan-600 text-xs"> mode: {'"plan"'}</code>이나
                    <code className="text-cyan-600 text-xs"> extendedThinkingEnabled: true</code>를 설정하세요.
                  </p>
                </div>
              </div>

              {/* FAQ 4 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> 캐시 적중률이 낮아요 (Anthropic API 비용이 높아요)
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    <strong className="text-gray-900">확인 1:</strong>{" "}
                    <code className="text-cyan-600 text-xs">buildStructuredSystemPrompt()</code>를 사용하고 있는지 확인하세요.
                    <code className="text-cyan-600 text-xs"> buildSystemPrompt()</code>는 단순 문자열만 반환하므로 캐시 힌트가 없습니다.
                  </p>
                  <p>
                    <strong className="text-gray-900">확인 2:</strong> 동적 섹션(Environment, Project Instructions)이
                    매 요청마다 변하는 것은 정상입니다. 이 섹션들은 의도적으로 캐시 대상에서 제외됩니다.
                    정적 섹션(identity, tools, conventions)이 제대로 합쳐져서 하나의 큰 캐시 블록이 되는지 확인하세요.
                  </p>
                </div>
              </div>

              {/* FAQ 5 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> 커스텀 섹션을 추가했는데 다른 섹션이 사라졌어요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    <strong className="text-gray-900">원인:</strong> 커스텀 섹션이 토큰을 많이 소비하여 예산을 초과한 것입니다.
                    <code className="text-cyan-600 text-xs"> customSections</code>에 추가할 때
                    <code className="text-cyan-600 text-xs"> tokenBudget</code>을 설정하여 크기를 제한하거나,
                    <code className="text-cyan-600 text-xs"> totalTokenBudget</code>을 늘려보세요.
                    커스텀 섹션의 우선순위가 높으면 기존 섹션이 밀려날 수 있으니 우선순위를 적절히 설정하세요.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 7. 관련 문서 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>{"🔗"}</span> 관련 문서
            </h2>

            <SeeAlso
              items={[
                {
                  name: "agent-loop.ts",
                  slug: "agent-loop",
                  relation: "parent",
                  desc: "시스템 프롬프트를 소비하는 Agent Loop — buildSystemPrompt()의 주요 호출자",
                },
                {
                  name: "token-counter.ts",
                  slug: "token-counter",
                  relation: "sibling",
                  desc: "estimateTokens() — 섹션별 토큰 수 추정에 사용되는 같은 레이어 유틸리티",
                },
                {
                  name: "model-capabilities.ts",
                  slug: "model-capabilities",
                  relation: "sibling",
                  desc: "CapabilityTier 타입 정의 — 모델 능력 수준에 따른 프롬프트 조절",
                },
                {
                  name: "context-manager.ts",
                  slug: "context-manager",
                  relation: "sibling",
                  desc: "컨텍스트 압축과 시스템 리마인더 주입을 조율하는 같은 레이어 모듈",
                },
                {
                  name: "config-loader.ts",
                  slug: "config-loader",
                  relation: "child",
                  desc: "설정 로딩 — locale, tone 등 프롬프트 빌드에 영향을 미치는 설정 제공",
                },
              ]}
            />
          </section>
        </RevealOnScroll>

      </div>
    </div>
  );
}
