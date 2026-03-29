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

export default function AutoMemoryPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/core/auto-memory.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">AutoMemoryCollector</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="core" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              대화에서 학습한 내용을 자동으로 감지하고 영속화하는 모듈입니다.
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
                <code className="text-cyan-600">AutoMemoryCollector</code>는 에이전트 루프의 각
                턴(turn)을 분석하여 &quot;기억할 만한&quot; 정보를 자동으로 감지하고 수집하는
                모듈입니다. AI가 대화 중 발견한 아키텍처 결정, 디버깅 해결법, 사용자 선호, 코딩
                컨벤션 등을 키워드 패턴 매칭으로 감지합니다.
              </p>
              <p>
                수집된 항목은 pending 큐에 쌓이고, <code className="text-cyan-600">flush()</code>를
                호출하면
                <code className="text-cyan-600">MEMORY.md</code> 또는 주제별 파일(architecture,
                debugging 등)에 영속적으로 저장됩니다. 이후 세션에서 시스템 프롬프트에 자동으로
                삽입되어 프로젝트 맥락을 유지합니다.
              </p>
              <p>
                중복 체크, 세션당 최대 항목 수 제한, 신뢰도(confidence) 기반 필터링으로 메모리
                파일이 무한히 커지거나 노이즈로 오염되는 것을 방지합니다.
              </p>
            </div>

            <MermaidDiagram
              title="AutoMemory 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  AL["Agent Loop<br/><small>agent-loop.ts</small>"]
  AM["AutoMemoryCollector<br/><small>auto-memory.ts</small>"]
  MS["Memory Storage<br/><small>memory-storage.ts</small>"]
  SP["System Prompt Builder<br/><small>system-prompt.ts</small>"]
  DISK["MEMORY.md + Topic Files<br/><small>.dhelix/memory/</small>"]

  AL -->|"턴 완료 시 analyzeForMemories()"| AM
  AM -->|"flush() 시 저장"| MS
  MS -->|"파일 I/O"| DISK
  AM -->|"buildMemoryPrompt()"| SP
  SP -->|"시스템 프롬프트에 삽입"| AL

  style AM fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style MS fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style SP fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style DISK fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 수업을 들으면서 자동으로 중요한 내용을 노트에 적어주는 비서를
              떠올리세요. 선생님(AI)이 &quot;이 버그의 근본 원인은...&quot;이라고 말하면 비서가
              자동으로 &quot;디버깅&quot; 카테고리에 기록합니다. 다음 수업에서 해당 노트를 참고할 수
              있습니다.
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

            {/* MemoryCategory type */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              type MemoryCategory
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              자동 감지되는 메모리의 8가지 카테고리입니다.
            </p>
            <CodeBlock>
              <span className="kw">type</span> <span className="type">MemoryCategory</span> ={"\n"}
              {"  "}| <span className="str">&quot;architecture&quot;</span>{" "}
              <span className="cm">{"// 아키텍처 결정, 설계 패턴"}</span>
              {"\n"}
              {"  "}| <span className="str">&quot;patterns&quot;</span>{" "}
              <span className="cm">{"// 코딩 패턴, 모범 사례"}</span>
              {"\n"}
              {"  "}| <span className="str">&quot;debugging&quot;</span>{" "}
              <span className="cm">{"// 디버깅 해결법, 버그 원인"}</span>
              {"\n"}
              {"  "}| <span className="str">&quot;preferences&quot;</span>{" "}
              <span className="cm">{"// 사용자 선호, 컨벤션"}</span>
              {"\n"}
              {"  "}| <span className="str">&quot;infrastructure&quot;</span>{" "}
              <span className="cm">{"// 빌드, 배포, CI/CD"}</span>
              {"\n"}
              {"  "}| <span className="str">&quot;conventions&quot;</span>{" "}
              <span className="cm">{"// 네이밍 규칙, 코드 스타일"}</span>
              {"\n"}
              {"  "}| <span className="str">&quot;dependencies&quot;</span>{" "}
              <span className="cm">{"// 패키지 의존성, 버전"}</span>
              {"\n"}
              {"  "}| <span className="str">&quot;files&quot;</span>;{" "}
              <span className="cm">{"// 자주 사용되는 파일 경로"}</span>
            </CodeBlock>

            {/* AutoMemoryEntry interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface AutoMemoryEntry
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              자동 감지된 단일 메모리 항목입니다. 카테고리, 내용, 신뢰도, 출처를 포함합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "category",
                  type: "MemoryCategory",
                  required: true,
                  desc: "메모리 카테고리 (architecture, debugging 등 8종)",
                },
                {
                  name: "content",
                  type: "string",
                  required: true,
                  desc: "기억할 내용 텍스트 (최대 500자)",
                },
                {
                  name: "confidence",
                  type: "number",
                  required: true,
                  desc: "신뢰도 점수 (0.0 ~ 1.0, 높을수록 확실)",
                },
                {
                  name: "source",
                  type: "string",
                  required: true,
                  desc: '감지 출처 ("assistant-response", "user-message", "file-access-tracking" 등)',
                },
              ]}
            />

            {/* AutoMemoryConfig interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface AutoMemoryConfig
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              자동 메모리 수집기의 동작 설정입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "enabled",
                  type: "boolean",
                  required: true,
                  desc: "자동 메모리 기능 활성화 여부 (기본: true)",
                },
                {
                  name: "minConfidence",
                  type: "number",
                  required: true,
                  desc: "저장 최소 신뢰도 (기본: 0.7 = 70%)",
                },
                {
                  name: "maxEntriesPerSession",
                  type: "number",
                  required: true,
                  desc: "세션당 최대 수집 항목 수 (기본: 20)",
                },
                {
                  name: "deduplication",
                  type: "boolean",
                  required: true,
                  desc: "중복 체크 활성화 여부 (기본: true)",
                },
              ]}
            />

            {/* TurnContext interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface TurnContext
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              완료된 에이전트 루프 턴의 컨텍스트 정보입니다. 분석에 필요한 모든 정보를 담고
              있습니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "userMessage",
                  type: "string",
                  required: true,
                  desc: "사용자가 입력한 메시지",
                },
                {
                  name: "assistantResponse",
                  type: "string",
                  required: true,
                  desc: "AI의 응답 텍스트",
                },
                {
                  name: "toolCalls",
                  type: "readonly ToolCallInfo[]",
                  required: true,
                  desc: "이 턴에서 실행된 도구 호출 정보 목록",
                },
                {
                  name: "filesAccessed",
                  type: "readonly string[]",
                  required: true,
                  desc: "접근된 파일 경로 목록",
                },
                {
                  name: "errorsEncountered",
                  type: "readonly string[]",
                  required: true,
                  desc: "발생한 에러 메시지 목록",
                },
              ]}
            />

            {/* AutoMemoryCollector class */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class AutoMemoryCollector
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              에이전트 루프의 각 턴을 분석하여 기억할 만한 패턴을 감지하는 메인 클래스입니다. 감지된
              항목은 pending 큐에 쌓이고, <code className="text-cyan-600">flush()</code>로 디스크에
              저장합니다.
            </p>

            {/* Constructor */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">constructor</h4>
            <CodeBlock>
              <span className="kw">constructor</span>(<span className="prop">storage</span>:{" "}
              <span className="type">MemoryConfig</span>, <span className="prop">config</span>?:{" "}
              <span className="type">Partial&lt;AutoMemoryConfig&gt;</span>)
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "storage",
                  type: "MemoryConfig",
                  required: true,
                  desc: "메모리 파일 저장 설정 (경로 등)",
                },
                {
                  name: "config",
                  type: "Partial<AutoMemoryConfig>",
                  required: false,
                  desc: "자동 메모리 동작 설정 (생략 시 기본값 사용)",
                },
              ]}
            />

            {/* analyzeForMemories */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">analyzeForMemories(turn)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              완료된 턴을 분석하여 기억할 만한 내용을 감지합니다. 4가지 분석(패턴 매칭, 선호 감지,
              파일 빈도, 에러 해결)을 수행합니다.
            </p>
            <CodeBlock>
              <span className="fn">analyzeForMemories</span>(<span className="prop">turn</span>:{" "}
              <span className="type">TurnContext</span>): <span className="kw">readonly</span>{" "}
              <span className="type">AutoMemoryEntry</span>[]
            </CodeBlock>

            {/* flush */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">flush()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              대기 중인 모든 항목을 디스크에 저장합니다. 중복 제거 후 MEMORY.md 우선 저장,
              오버플로우 시 주제별 파일에 분산합니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">flush</span>():{" "}
              <span className="type">Promise&lt;number&gt;</span>
              {"\n"}
              <span className="cm">// 반환: 성공적으로 저장된 항목 수</span>
            </CodeBlock>

            {/* buildMemoryPrompt */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">buildMemoryPrompt()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              시스템 프롬프트에 삽입할 메모리 섹션을 구성합니다. 메인 MEMORY.md, 전역 메모리, 주제별
              파일을 순서대로 로드합니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">buildMemoryPrompt</span>():{" "}
              <span className="type">Promise&lt;string&gt;</span>
              {"\n"}
              <span className="cm">
                // 반환: 마크다운 형식의 메모리 프롬프트 (없으면 빈 문자열)
              </span>
            </CodeBlock>

            {/* getPending / clearPending */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              getPending() / clearPending()
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              아직 저장되지 않은 대기 중인 항목을 조회하거나 삭제합니다.
            </p>
            <CodeBlock>
              <span className="fn">getPending</span>(): <span className="kw">readonly</span>{" "}
              <span className="type">AutoMemoryEntry</span>[]
              {"\n"}
              <span className="fn">clearPending</span>(): <span className="type">void</span>
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">analyzeForMemories()</code>는 수집만 하고 저장하지
                않습니다. 반드시 <code className="text-cyan-600">flush()</code>를 호출해야 디스크에
                기록됩니다.
              </li>
              <li>세션당 최대 20개 항목 제한이 있어, 이후 호출에서는 빈 배열을 반환합니다.</li>
              <li>
                중복 체크는 대소문자 무시 + 공백 정규화 기반 부분 문자열 매칭으로 수행됩니다.
                비슷하지만 완전히 같지 않은 내용은 중복으로 걸러지지 않을 수 있습니다.
              </li>
              <li>MEMORY.md 최대 200줄 제한을 초과하면 주제별 파일로 자동 분산됩니다.</li>
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
              기본 사용법 &mdash; 에이전트 루프에서 사용하기
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              매 턴이 완료될 때마다 <code className="text-cyan-600">analyzeForMemories()</code>를
              호출하고, 세션 종료 시 <code className="text-cyan-600">flush()</code>로 디스크에
              저장합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 1. 수집기 생성"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">collector</span> ={" "}
              <span className="kw">new</span> <span className="fn">AutoMemoryCollector</span>(
              <span className="prop">memoryConfig</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 2. 에이전트 루프의 각 턴 분석"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">detected</span> ={" "}
              <span className="prop">collector</span>.<span className="fn">analyzeForMemories</span>
              ({"{"}
              {"\n"}
              {"  "}
              <span className="prop">userMessage</span>:{" "}
              <span className="str">&quot;이 버그 왜 생기나요?&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">assistantResponse</span>:{" "}
              <span className="str">&quot;root cause는 race condition입니다...&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">toolCalls</span>: [],{"\n"}
              {"  "}
              <span className="prop">filesAccessed</span>: [
              <span className="str">&quot;src/core/agent-loop.ts&quot;</span>],{"\n"}
              {"  "}
              <span className="prop">errorsEncountered</span>: [],{"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// 3. 세션 종료 시 디스크에 저장"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">savedCount</span> ={" "}
              <span className="kw">await</span> <span className="prop">collector</span>.
              <span className="fn">flush</span>();
              {"\n"}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="str">{"`${savedCount}개 항목 저장됨`"}</span>);
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>flush()</code>를 호출하지 않으면 수집된 항목이 모두
              사라집니다. 세션 종료, 프로세스 종료 등 적절한 시점에 반드시 호출하세요.
            </Callout>

            {/* 고급: 시스템 프롬프트 삽입 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 시스템 프롬프트에 메모리 삽입
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              이전 세션에서 저장된 메모리를 시스템 프롬프트에 포함시켜 프로젝트 맥락을 유지합니다.
            </p>
            <CodeBlock>
              <span className="cm">
                {"// 메모리 프롬프트 생성 (MEMORY.md + 글로벌 + 주제별 파일)"}
              </span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">memorySection</span> ={" "}
              <span className="kw">await</span> <span className="prop">collector</span>.
              <span className="fn">buildMemoryPrompt</span>();
              {"\n"}
              {"\n"}
              <span className="cm">{"// 시스템 프롬프트에 추가"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">systemPrompt</span> ={" "}
              <span className="str">`${"{"}</span>
              <span className="prop">basePrompt</span>
              <span className="str">{"}"}</span>
              {"\n"}
              {"\n"}
              <span className="str">{`\${memorySection}`}</span>
              <span className="str">`</span>;
            </CodeBlock>

            {/* 고급: 커스텀 설정 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 커스텀 설정
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              기본 설정을 부분적으로 오버라이드하여 수집 동작을 조절할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 높은 신뢰도만 수집, 세션당 최대 5개"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">strictCollector</span> ={" "}
              <span className="kw">new</span> <span className="fn">AutoMemoryCollector</span>(
              <span className="prop">storage</span>, {"{"}
              {"\n"}
              {"  "}
              <span className="prop">minConfidence</span>: <span className="num">0.9</span>,{" "}
              <span className="cm">{"// 90% 이상만"}</span>
              {"\n"}
              {"  "}
              <span className="prop">maxEntriesPerSession</span>: <span className="num">5</span>,
              {"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// 중복 체크 비활성화 (테스트용)"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">testCollector</span> ={" "}
              <span className="kw">new</span> <span className="fn">AutoMemoryCollector</span>(
              <span className="prop">storage</span>, {"{"}
              {"\n"}
              {"  "}
              <span className="prop">deduplication</span>: <span className="kw">false</span>,{"\n"}
              {"}"});
            </CodeBlock>

            <DeepDive title="패턴 감지 규칙의 신뢰도 보정 메커니즘">
              <p className="mb-3">
                각 패턴 규칙에는 <code className="text-cyan-600">baseConfidence</code> (기본
                신뢰도)가 있으며, 추출된 내용의 품질에 따라 최종 신뢰도가 보정됩니다:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  100자 이상의 상세한 내용: <strong>+0.05</strong> (더 유용할 가능성 높음)
                </li>
                <li>
                  20자 미만의 짧은 내용: <strong>-0.15</strong> (노이즈일 수 있음)
                </li>
                <li>
                  코드 관련 토큰 포함 시: <strong>+0.05</strong> (백틱 코드, function/class 등)
                </li>
              </ul>
              <p className="mt-3 text-amber-600">
                디버깅 카테고리는 <code>baseConfidence: 0.85</code>로 가장 높고, 인프라/의존성
                카테고리는 <code>0.7</code>로 가장 낮습니다.
                <code>minConfidence</code> 기본값이 0.7이므로, 짧은 인프라 관련 내용은 보정 후
                0.55로 떨어져 필터링될 수 있습니다.
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
              데이터 흐름 다이어그램
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              턴 분석부터 디스크 저장까지의 전체 파이프라인입니다. 4가지 감지 분석이 병렬로
              수행되고, 결과가 pending 큐에 합쳐진 뒤 flush() 시점에 중복 제거와 저장 분류가
              이루어집니다.
            </p>

            <MermaidDiagram
              title="AutoMemory 데이터 흐름"
              titleColor="purple"
              chart={`graph TD
  TURN["TurnContext<br/><small>사용자 메시지 + AI 응답 + 도구 호출</small>"]
  P1["패턴 감지<br/><small>AI 응답에서 키워드 매칭</small>"]
  P2["선호 감지<br/><small>사용자 메시지에서 선호/교정</small>"]
  P3["파일 빈도<br/><small>3회 이상 접근 파일 감지</small>"]
  P4["에러 해결<br/><small>에러 + 해결 지표 매칭</small>"]
  PENDING["Pending 큐<br/><small>세션당 최대 20개</small>"]
  DEDUP["중복 제거<br/><small>정규화 + 부분 문자열 매칭</small>"]
  MAIN["MEMORY.md<br/><small>최대 200줄</small>"]
  TOPICS["주제별 파일<br/><small>architecture, debugging...</small>"]

  TURN --> P1
  TURN --> P2
  TURN --> P3
  TURN --> P4
  P1 --> PENDING
  P2 --> PENDING
  P3 --> PENDING
  P4 --> PENDING
  PENDING -->|"flush()"| DEDUP
  DEDUP -->|"여유 있음"| MAIN
  DEDUP -->|"200줄 초과"| TOPICS

  style PENDING fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style DEDUP fill:#fef3c7,stroke:#f59e0b,color:#1e293b,stroke-width:2px
  style MAIN fill:#dcfce7,stroke:#10b981,color:#065f46
  style TOPICS fill:#dcfce7,stroke:#10b981,color:#065f46
  style TURN fill:#e0e7ff,stroke:#3b82f6,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석 &mdash; analyzeForMemories()
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">analyzeForMemories()</code>의 핵심 로직입니다. 4가지
              감지기를 순서대로 실행하고, 세션 예산에 맞춰 잘라냅니다.
            </p>
            <CodeBlock>
              <span className="fn">analyzeForMemories</span>(<span className="prop">turn</span>:{" "}
              <span className="type">TurnContext</span>): <span className="kw">readonly</span>{" "}
              <span className="type">AutoMemoryEntry</span>[] {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [1] 비활성화 또는 예산 소진 시 조기 반환"}</span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (!<span className="kw">this</span>.
              <span className="prop">config</span>.<span className="prop">enabled</span>){" "}
              <span className="kw">return</span> [];
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="kw">this</span>.
              <span className="prop">totalEntriesThisSession</span> {">="}{" "}
              <span className="kw">this</span>.<span className="prop">config</span>.
              <span className="prop">maxEntriesPerSession</span>) <span className="kw">return</span>{" "}
              [];
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [2] 4가지 감지 분석 실행"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">entries</span> = [{"\n"}
              {"    "}...<span className="kw">this</span>.<span className="fn">detectPatterns</span>
              (<span className="prop">turn</span>.<span className="prop">assistantResponse</span>,{" "}
              <span className="str">&quot;assistant-response&quot;</span>),
              {"\n"}
              {"    "}...<span className="kw">this</span>.<span className="fn">detectPatterns</span>
              (<span className="prop">turn</span>.<span className="prop">userMessage</span>,{" "}
              <span className="str">&quot;user-message&quot;</span>),
              {"\n"}
              {"    "}...<span className="kw">this</span>.
              <span className="fn">detectFrequentFiles</span>(<span className="prop">turn</span>.
              <span className="prop">filesAccessed</span>),
              {"\n"}
              {"    "}...<span className="kw">this</span>.
              <span className="fn">detectResolvedErrors</span>(<span className="prop">turn</span>),
              {"\n"}
              {"  "}];
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [3] 남은 예산만큼만 수집"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">remaining</span> ={" "}
              <span className="kw">this</span>.<span className="prop">config</span>.
              <span className="prop">maxEntriesPerSession</span> - <span className="kw">this</span>.
              <span className="prop">totalEntriesThisSession</span>;{"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">accepted</span> ={" "}
              <span className="prop">entries</span>.<span className="fn">slice</span>(
              <span className="num">0</span>, <span className="prop">remaining</span>);
              {"\n"}
              {"  "}
              <span className="kw">this</span>.<span className="prop">pending</span>.
              <span className="fn">push</span>(...<span className="prop">accepted</span>);
              {"\n"}
              {"  "}
              <span className="kw">return</span> <span className="prop">accepted</span>;{"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> 기능 비활성화 상태이거나 세션
                예산(기본 20개)을 모두 소진했으면 빈 배열을 반환합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> 4가지 감지기가 순서대로 실행됩니다:
                AI 응답 패턴, 사용자 메시지 패턴, 파일 빈도, 에러 해결 감지.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 남은 예산에 맞춰 앞쪽 항목만
                잘라내므로, 앞쪽 감지기(패턴 매칭)의 결과가 우선시됩니다.
              </p>
            </div>

            <DeepDive title="flush() 저장 분류 상세 로직">
              <p className="mb-3">
                <code className="text-cyan-600">flush()</code>는 다음 순서로 저장 위치를 결정합니다:
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-gray-600">
                <li>
                  <strong>중복 제거:</strong> 메인 MEMORY.md, 해당 카테고리 주제 파일, pending 큐
                  모두에서 중복 여부를 확인합니다.
                </li>
                <li>
                  <strong>메인 파일 우선:</strong> MEMORY.md에 줄 수 여유(200줄 이내)가 있으면 메인
                  파일에 저장합니다.
                </li>
                <li>
                  <strong>오버플로우 분산:</strong> 200줄을 초과하면 카테고리에 해당하는 주제
                  파일(architecture, debugging 등)에 저장합니다.
                </li>
              </ol>
              <p className="mt-3 text-amber-600">
                저장 형식은 <code>### 카테고리 (YYYY-MM-DD)\n\n내용</code>의 마크다운 섹션입니다.
                파일 I/O 실패 시 해당 항목만 건너뛰고 나머지는 계속 저장합니다.
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

            {/* FAQ 1 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;MEMORY.md에 아무것도 저장되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">다음을 확인하세요:</p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  <strong>flush() 호출 여부:</strong>{" "}
                  <code className="text-cyan-600">analyzeForMemories()</code>는 수집만 하고 저장하지
                  않습니다. 세션 종료 시 <code className="text-cyan-600">flush()</code>를 반드시
                  호출하세요.
                </li>
                <li>
                  <strong>신뢰도 임계값:</strong> 기본{" "}
                  <code className="text-cyan-600">minConfidence: 0.7</code>로, 짧은 내용(20자
                  미만)은 보정 후 임계값 아래로 떨어질 수 있습니다.
                </li>
                <li>
                  <strong>중복 체크:</strong> 이미 동일한 내용이 저장되어 있으면 건너뜁니다.
                </li>
              </ul>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;너무 많은 항목이 수집돼서 메모리 파일이 커져요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                <code className="text-cyan-600">maxEntriesPerSession</code>을 낮추거나
                <code className="text-cyan-600">minConfidence</code>를 높이세요.
              </p>
              <CodeBlock>
                <span className="kw">const</span> <span className="prop">collector</span> ={" "}
                <span className="kw">new</span> <span className="fn">AutoMemoryCollector</span>(
                <span className="prop">storage</span>, {"{"}
                {"\n"}
                {"  "}
                <span className="prop">minConfidence</span>: <span className="num">0.9</span>,{"\n"}
                {"  "}
                <span className="prop">maxEntriesPerSession</span>: <span className="num">5</span>,
                {"\n"}
                {"}"});
              </CodeBlock>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;특정 카테고리의 메모리만 수집하고 싶어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                현재 카테고리별 필터링 옵션은 없습니다. 패턴 규칙은
                <code className="text-cyan-600">buildPatternRules()</code> 함수에 하드코딩되어
                있으므로, 커스텀 필터가 필요하면{" "}
                <code className="text-cyan-600">analyzeForMemories()</code> 반환값을 직접 필터링한
                뒤 <code className="text-cyan-600">flush()</code> 전에{" "}
                <code className="text-cyan-600">clearPending()</code>으로 원치 않는 항목을
                제거하세요.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;파일 접근 빈도 감지가 작동하지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                파일 빈도 감지는 <strong>정확히 3회 접근</strong> 시점에 한 번만 기록됩니다.
                <code className="text-cyan-600">TurnContext.filesAccessed</code>에 올바른 파일
                경로가 전달되고 있는지, 그리고 동일 경로가 3회 이상 나타나는지 확인하세요.
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
                  desc: "매 턴 완료 시 AutoMemoryCollector.analyzeForMemories()를 호출하는 메인 루프",
                },
                {
                  name: "system-prompt-cache.ts",
                  slug: "system-prompt-cache",
                  relation: "sibling",
                  desc: "빌드된 시스템 프롬프트를 캐싱하여 메모리 프롬프트 재생성 비용을 절감",
                },
                {
                  name: "context-manager.ts",
                  slug: "context-manager",
                  relation: "sibling",
                  desc: "3-Layer 컨텍스트 관리 - 메모리 프롬프트 삽입 시 컨텍스트 윈도우 한도 관리",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
