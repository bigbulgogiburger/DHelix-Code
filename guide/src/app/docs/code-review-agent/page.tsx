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

export default function CodeReviewAgentPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/core/code-review-agent.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">Code Review Agent</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="core" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              Generator-Critic 패턴으로 코드 diff를 분석하여 구조화된 리뷰 결과(이슈 목록, 점수,
              요약)를 생성하는 자동화 코드 리뷰 모듈입니다.
            </p>
          </div>
        </RevealOnScroll>

        {/* ─── 1. 개요 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>📋</span> 개요
            </h2>

            <div className="text-[14px] text-gray-600 leading-[1.85] space-y-4">
              <p>
                코드 리뷰 에이전트는{" "}
                <strong className="text-gray-900">Generator-Critic 패턴</strong>을 사용합니다. 1단계
                Generator에서 LLM이 diff를 분석하여 모든 잠재적 이슈를 찾아내고, 2단계 Critic에서
                LLM이 스스로 재평가하여 오탐(false positive)을 제거합니다. 이 두 단계를 하나의
                프롬프트 안에 지시하여 단일 LLM 호출로 고품질 리뷰를 완성합니다.
              </p>
              <p>
                이 모듈은 두 개의 핵심 함수만 노출합니다:{" "}
                <code className="text-cyan-600 text-[13px]">buildReviewPrompt()</code>와{" "}
                <code className="text-cyan-600 text-[13px]">parseReviewResult()</code>. 프롬프트
                생성과 출력 파싱을 분리하여 각각 단독 테스트할 수 있도록 설계되었습니다.
              </p>
              <p>
                이슈는 심각도(critical / high / medium / low)와 카테고리(security / correctness /
                style / performance) 두 축으로 분류됩니다. 이를 통해 팀이 우선순위를 바탕으로 리뷰에
                집중할 수 있습니다.
              </p>
            </div>

            <MermaidDiagram
              title="Code Review Agent — Generator-Critic 흐름"
              titleColor="purple"
              chart={`sequenceDiagram
    participant CALLER as 호출자(cmd-review)
    participant BRP as buildReviewPrompt()
    participant LLM as LLM Client
    participant PRR as parseReviewResult()

    CALLER->>BRP: diff, focusAreas?
    BRP-->>CALLER: prompt(Generator+Critic 지시)
    CALLER->>LLM: prompt 전달
    LLM-->>CALLER: JSON lines + SUMMARY + SCORE
    CALLER->>PRR: llmOutput
    PRR-->>CALLER: ReviewResult { issues, summary, score }`}
            />
          </section>
        </RevealOnScroll>

        {/* ─── 2. 레퍼런스 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>📖</span> 레퍼런스
            </h2>

            {/* buildReviewPrompt */}
            <div className="mb-8">
              <h3
                className="text-[17px] font-bold text-indigo-600 font-mono"
                style={{ marginTop: "32px", marginBottom: "16px" }}
              >
                buildReviewPrompt()
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-4">
                diff 문자열로부터 Generator-Critic 패턴을 지시하는 LLM 프롬프트를 생성합니다. LLM
                출력 형식(JSON 한 줄, SUMMARY, SCORE)을 구체적으로 명시하여 파싱 가능한 결과를
                보장합니다.
              </p>

              <CodeBlock>
                <span className="text-[#ff7b72]">function</span>{" "}
                <span className="text-[#d2a8ff]">buildReviewPrompt</span>({"\n"}
                {"  "}
                <span className="text-[#ffa657]">diff</span>:{" "}
                <span className="text-[#79c0ff]">string</span>,{"\n"}
                {"  "}
                <span className="text-[#ffa657]">focusAreas</span>?:{" "}
                <span className="text-[#79c0ff]">readonly string[]</span>
                {"\n"}): <span className="text-[#79c0ff]">string</span>
              </CodeBlock>

              <ParamTable
                params={[
                  {
                    name: "diff",
                    type: "string",
                    required: true,
                    desc: "리뷰할 git diff 또는 코드 diff 문자열. --- BEGIN DIFF --- / --- END DIFF --- 구분자로 감쌉니다.",
                  },
                  {
                    name: "focusAreas",
                    type: "readonly string[]",
                    required: false,
                    desc: '특별히 집중할 영역 목록. 예: ["security", "performance"]. 없으면 모든 영역을 균등하게 검토합니다.',
                  },
                ]}
              />
            </div>

            {/* parseReviewResult */}
            <div className="mb-8">
              <h3
                className="text-[17px] font-bold text-indigo-600 font-mono"
                style={{ marginTop: "32px", marginBottom: "16px" }}
              >
                parseReviewResult()
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-4">
                LLM의 원시 텍스트 출력을 구조화된{" "}
                <code className="text-cyan-600">ReviewResult</code>로 변환합니다. 파싱할 수 없는
                줄은 건너뛰어, 부분적으로 잘못된 LLM 출력에도 안전하게 동작합니다.
              </p>

              <CodeBlock>
                <span className="text-[#ff7b72]">function</span>{" "}
                <span className="text-[#d2a8ff]">parseReviewResult</span>({"\n"}
                {"  "}
                <span className="text-[#ffa657]">llmOutput</span>:{" "}
                <span className="text-[#79c0ff]">string</span>
                {"\n"}): <span className="text-[#79c0ff]">ReviewResult</span>
              </CodeBlock>
            </div>

            {/* isNewerVersion은 update-checker이므로 여기선 타입 참조 */}

            {/* ReviewResult 인터페이스 */}
            <div className="mb-8">
              <h3
                className="text-[17px] font-bold text-indigo-600 font-mono"
                style={{ marginTop: "32px", marginBottom: "16px" }}
              >
                타입 정의
              </h3>

              <ParamTable
                params={[
                  {
                    name: "ReviewSeverity",
                    type: '"critical" | "high" | "medium" | "low"',
                    required: true,
                    desc: "이슈 심각도. critical=보안/크래시, high=로직에러, medium=코드스멜, low=스타일.",
                  },
                  {
                    name: "ReviewCategory",
                    type: '"security" | "correctness" | "style" | "performance"',
                    required: true,
                    desc: "이슈 카테고리. security=인증/인젝션, correctness=로직에러, style=네이밍, performance=알고리즘.",
                  },
                  {
                    name: "ReviewIssue.severity",
                    type: "ReviewSeverity",
                    required: true,
                    desc: "이슈의 심각도 수준.",
                  },
                  {
                    name: "ReviewIssue.category",
                    type: "ReviewCategory",
                    required: true,
                    desc: "이슈의 카테고리.",
                  },
                  {
                    name: "ReviewIssue.message",
                    type: "string",
                    required: true,
                    desc: "이슈에 대한 설명 텍스트.",
                  },
                  {
                    name: "ReviewIssue.line",
                    type: "number",
                    required: false,
                    desc: "이슈가 발생한 줄 번호. 특정할 수 없으면 undefined.",
                  },
                  {
                    name: "ReviewIssue.file",
                    type: "string",
                    required: false,
                    desc: "이슈가 발생한 파일 경로. 특정할 수 없으면 undefined.",
                  },
                  {
                    name: "ReviewResult.issues",
                    type: "readonly ReviewIssue[]",
                    required: true,
                    desc: "발견된 이슈 전체 목록.",
                  },
                  {
                    name: "ReviewResult.summary",
                    type: "string",
                    required: true,
                    desc: "전체적인 평가 요약 (1~2문장). LLM이 제공하지 않으면 이슈 통계로 자동 생성됩니다.",
                  },
                  {
                    name: "ReviewResult.score",
                    type: "number",
                    required: true,
                    desc: "코드 품질 점수 0~100. 100이 완벽한 코드. LLM 출력 없으면 기본값 50.",
                  },
                ]}
              />
            </div>
          </section>
        </RevealOnScroll>

        {/* ─── 3. 사용법 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🚀</span> 사용법
            </h2>

            <p className="text-[14px] text-gray-600 leading-[1.85] mb-6">
              기본 사용 흐름은 프롬프트 빌드 → LLM 호출 → 결과 파싱의 3단계입니다.
            </p>

            <CodeBlock>
              <span className="text-[#8b949e]">// 1. 프롬프트 생성</span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span> prompt ={" "}
              <span className="text-[#d2a8ff]">buildReviewPrompt</span>(diff, [
              <span className="text-[#a5d6ff]">"security"</span>,{" "}
              <span className="text-[#a5d6ff]">"correctness"</span>]);{"\n\n"}
              <span className="text-[#8b949e]">
                // 2. LLM 호출 (예시 — 실제 호출은 llm/client.ts 사용)
              </span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span> llmOutput ={" "}
              <span className="text-[#ff7b72]">await</span> llmClient.
              <span className="text-[#d2a8ff]">chat</span>([{"{"} role:{" "}
              <span className="text-[#a5d6ff]">"user"</span>, content: prompt {"}"}]);{"\n\n"}
              <span className="text-[#8b949e]">// 3. 결과 파싱</span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span> result ={" "}
              <span className="text-[#d2a8ff]">parseReviewResult</span>(llmOutput);{"\n"}
              console.<span className="text-[#d2a8ff]">log</span>(result.score);{" "}
              <span className="text-[#8b949e]">// 0~100</span>
              {"\n"}
              console.<span className="text-[#d2a8ff]">log</span>(result.issues.length);{" "}
              <span className="text-[#8b949e]">// 이슈 수</span>
            </CodeBlock>

            <Callout type="warn" icon="⚠️">
              <span className="text-[13px]">
                <strong>주의:</strong> <code className="text-cyan-600">parseReviewResult()</code>는
                LLM 출력에서 JSON을 줄 단위로 파싱합니다. LLM이 JSON 형식을 지키지 않으면 해당 줄이
                무시됩니다. LLM이 요약(SUMMARY)을 제공하지 않으면 이슈 통계로 자동 생성된 요약이
                반환되며, 점수를 제공하지 않으면 기본값 50이 사용됩니다.
              </span>
            </Callout>

            <DeepDive title="focusAreas — 집중 영역 지정">
              <div className="space-y-3">
                <p>
                  <code className="text-cyan-600">focusAreas</code>를 지정하면 LLM이 해당 영역에
                  집중하도록 프롬프트에 추가 지시가 삽입됩니다. 예를 들어 보안 감사 목적이라면{" "}
                  <code className="text-cyan-600">["security"]</code>를, 성능 최적화 PR이라면{" "}
                  <code className="text-cyan-600">["performance", "correctness"]</code>를 전달하면
                  효과적입니다.
                </p>
                <CodeBlock>
                  <span className="text-[#8b949e]">// 보안 중심 리뷰</span>
                  {"\n"}
                  <span className="text-[#d2a8ff]">buildReviewPrompt</span>(diff, [
                  <span className="text-[#a5d6ff]">"security"</span>]);{"\n\n"}
                  <span className="text-[#8b949e]">// 스타일 무시, 버그만 확인</span>
                  {"\n"}
                  <span className="text-[#d2a8ff]">buildReviewPrompt</span>(diff, [
                  <span className="text-[#a5d6ff]">"correctness"</span>,{" "}
                  <span className="text-[#a5d6ff]">"performance"</span>]);
                </CodeBlock>
              </div>
            </DeepDive>
          </section>
        </RevealOnScroll>

        {/* ─── 4. 내부 구현 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>⚙️</span> 내부 구현
            </h2>

            <MermaidDiagram
              title="parseReviewResult() 파싱 흐름"
              titleColor="blue"
              chart={`flowchart TD
    INPUT["llmOutput 텍스트"] --> SPLIT["줄 단위 분리"]
    SPLIT --> LOOP["각 줄 순회"]
    LOOP --> JSON_CHECK{"{로 시작하고\\n}로 끝나는 줄?"}
    JSON_CHECK -->|"YES"| TRY_PARSE["tryParseIssue()\\n필드 유효성 검사"]
    TRY_PARSE -->|"유효"| PUSH["issues 배열에 추가"]
    TRY_PARSE -->|"무효/에러"| SKIP["줄 건너뜀"]
    JSON_CHECK -->|"NO"| SUMMARY_CHECK{"SUMMARY: 패턴?"}
    SUMMARY_CHECK -->|"YES"| SAVE_SUM["summary 저장"]
    SUMMARY_CHECK -->|"NO"| SCORE_CHECK{"SCORE: 숫자?"}
    SCORE_CHECK -->|"YES"| SAVE_SCORE["score 저장 (0~100 범위 검증)"]
    SCORE_CHECK -->|"NO"| SKIP
    PUSH --> LOOP
    SKIP --> LOOP
    SAVE_SUM --> LOOP
    SAVE_SCORE --> LOOP
    LOOP -->|"완료"| FALLBACK{"summary\\n비어있음?"}
    FALLBACK -->|"YES"| GEN_SUM["generateFallbackSummary()\\n이슈 통계로 생성"]
    FALLBACK -->|"NO"| RESULT
    GEN_SUM --> RESULT["ReviewResult 반환"]

    style INPUT fill:#2a1e4a,stroke:#8b5cf6,color:#f1f5f9
    style RESULT fill:#1a3a2a,stroke:#10b981,color:#f1f5f9
    style TRY_PARSE fill:#1a2a3a,stroke:#3b82f6,color:#f1f5f9`}
            />

            <div className="text-[14px] text-gray-600 leading-[1.85] space-y-4 mt-6">
              <p>
                <strong className="text-gray-900">tryParseIssue() 유효성 검사:</strong>{" "}
                <code className="text-cyan-600">VALID_SEVERITIES</code>와{" "}
                <code className="text-cyan-600">VALID_CATEGORIES</code> Set을 이용하여 severity와
                category 필드의 유효성을 O(1)로 검사합니다. message가 비어있어도 유효하지 않은
                이슈로 처리됩니다.
              </p>
            </div>

            <CodeBlock>
              <span className="text-[#8b949e]">// 유효성 검사 상수</span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span> VALID_SEVERITIES ={" "}
              <span className="text-[#ff7b72]">new</span>{" "}
              <span className="text-[#d2a8ff]">Set</span>
              {"<"}
              <span className="text-[#79c0ff]">string</span>
              {">"}([
              <span className="text-[#a5d6ff]">"critical"</span>,{" "}
              <span className="text-[#a5d6ff]">"high"</span>,{" "}
              <span className="text-[#a5d6ff]">"medium"</span>,{" "}
              <span className="text-[#a5d6ff]">"low"</span>]);{"\n"}
              <span className="text-[#ff7b72]">const</span> VALID_CATEGORIES ={" "}
              <span className="text-[#ff7b72]">new</span>{" "}
              <span className="text-[#d2a8ff]">Set</span>
              {"<"}
              <span className="text-[#79c0ff]">string</span>
              {">"}([
              <span className="text-[#a5d6ff]">"security"</span>,{" "}
              <span className="text-[#a5d6ff]">"correctness"</span>,{" "}
              <span className="text-[#a5d6ff]">"style"</span>,{" "}
              <span className="text-[#a5d6ff]">"performance"</span>]);{"\n\n"}
              <span className="text-[#8b949e]">// generateFallbackSummary — LLM 요약 없을 때</span>
              {"\n"}
              <span className="text-[#8b949e]">// 예: "Found 3 issue(s): 1 critical 2 high"</span>
            </CodeBlock>

            <Callout type="info" icon="💡">
              <span className="text-[13px]">
                <strong>점수 기본값:</strong> LLM이 SCORE 줄을 출력하지 않으면{" "}
                <code className="text-cyan-600">score = 50</code>이 됩니다. 유효 범위(0~100)를
                벗어난 점수는 무시되고 기본값이 유지됩니다.
              </span>
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ─── 5. 트러블슈팅 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🔧</span> 트러블슈팅
            </h2>

            <div className="space-y-5">
              <div className="glass-card p-5 rounded-xl">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-500">Q.</span>
                  issues 배열이 항상 비어있습니다
                </h4>
                <p className="text-[13px] text-gray-600 leading-[1.8]">
                  <span className="text-emerald-600 font-bold">A.</span> LLM이 JSON 형식을 지키지
                  않아 모든 줄이 파싱 실패했을 가능성이 큽니다. 원시 LLM 출력을 로깅하여 실제 형식을
                  확인하세요. 특히 LLM이 코드 블록(```json ... ```)으로 감싸서 응답하면 중괄호가 줄
                  처음에 오지 않아 파싱이 실패합니다.{" "}
                  <code className="text-cyan-600">buildReviewPrompt()</code>는 코드 블록 없이 한
                  줄에 JSON을 출력하도록 지시하지만, 일부 모델은 이를 무시합니다.
                </p>
              </div>

              <div className="glass-card p-5 rounded-xl">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-500">Q.</span>
                  score가 항상 50입니다
                </h4>
                <p className="text-[13px] text-gray-600 leading-[1.8]">
                  <span className="text-emerald-600 font-bold">A.</span> LLM이{" "}
                  <code className="text-cyan-600">SCORE: 숫자</code> 형식을 출력하지 않고 있습니다.
                  LLM 원시 출력을 확인하여 SCORE 줄이 있는지 검토하세요. 일부 모델은 "Score: 85/100"
                  같은 다른 형식을 사용하는데, 정규식{" "}
                  <code className="text-cyan-600">/^SCORE:\s*(\d+)/i</code>는 이를 매칭하지
                  못합니다.
                </p>
              </div>

              <div className="glass-card p-5 rounded-xl">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-500">Q.</span>
                  critical 이슈가 실제로는 문제없는 코드를 지적합니다
                </h4>
                <p className="text-[13px] text-gray-600 leading-[1.8]">
                  <span className="text-emerald-600 font-bold">A.</span> Generator-Critic 패턴은
                  오탐을 줄이기 위한 것이지만 완벽하지 않습니다. LLM 모델 품질에 따라 Critic 단계가
                  제대로 작동하지 않을 수 있습니다.{" "}
                  <code className="text-cyan-600">focusAreas</code>를 좁게 설정하거나, 더 강력한
                  모델(Sonnet 4.5 이상)을 사용하면 오탐률을 낮출 수 있습니다.
                </p>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* ─── 6. 관련 문서 ─── */}
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
                  desc: "Code Review Agent를 통해 생성된 프롬프트를 LLM 클라이언트에 전달하는 메인 루프입니다.",
                },
                {
                  name: "message-types.ts",
                  slug: "message-types",
                  relation: "sibling",
                  desc: "LLM에 전달하는 ChatMessage 타입 정의. buildReviewPrompt() 출력은 user 메시지로 래핑됩니다.",
                },
                {
                  name: "recovery-executor.ts",
                  slug: "recovery-executor",
                  relation: "sibling",
                  desc: "LLM 호출 실패 시 자동 복구를 담당합니다. 리뷰 프롬프트 전송 중 에러가 발생하면 이 모듈이 개입합니다.",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
