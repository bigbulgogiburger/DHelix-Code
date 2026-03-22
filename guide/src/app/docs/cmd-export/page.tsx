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

export default function CmdExportPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/commands/export.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">/export</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              현재 대화 내역을 마크다운 파일 또는 클립보드로 내보내는 세션 내보내기 명령어입니다.
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
                <code className="text-cyan-600">/export</code>는 현재 대화의 전체 내역을 풍부한
                메타데이터와 함께 마크다운(.md) 파일로 저장하거나 클립보드에 복사합니다. 내보낸
                파일에는 날짜, 모델, 세션 ID, 버전, 플랫폼 정보가 포함되며, 턴별로 구분된 메시지와
                도구 호출 감지 결과를 포함합니다.
              </p>
              <p>
                보안을 위해 API 키, Bearer 토큰, GitHub 토큰, Slack 토큰 등 민감한 정보는 자동으로{" "}
                <code className="text-cyan-600">[REDACTED_...]</code>로 마스킹됩니다. 마지막에는 턴
                수, 메시지 수, 추정 토큰 수를 요약하는 Summary 섹션이 추가됩니다.
              </p>
              <p>
                대화 내용을 팀과 공유하거나, 이슈 리포트에 첨부하거나, 학습 기록으로 보관할 때
                유용합니다.
              </p>
            </div>

            <MermaidDiagram
              title="/export 처리 파이프라인"
              titleColor="purple"
              chart={`graph TD
  USER["사용자 입력<br/><small>/export [filename | --clipboard]</small>"]
  CMD["exportCommand<br/><small>export.ts</small>"]
  MSGS["context.messages<br/><small>대화 내역</small>"]
  SANITIZE["sanitizeContent()<br/><small>민감 정보 마스킹</small>"]
  DETECT["detectToolCalls()<br/><small>도구 호출 감지</small>"]
  FORMAT["마크다운 포맷팅<br/><small>메타데이터 + 턴별 메시지</small>"]
  FILE["파일 저장<br/><small>writeFile()</small>"]
  CLIP["클립보드 복사<br/><small>pbcopy / xclip</small>"]

  USER --> CMD
  CMD --> MSGS
  MSGS --> SANITIZE
  SANITIZE --> DETECT
  DETECT --> FORMAT
  FORMAT -->|"기본"| FILE
  FORMAT -->|"--clipboard"| CLIP

  style CMD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style SANITIZE fill:#fef3c7,stroke:#f59e0b,color:#1e293b,stroke-width:2px
  style DETECT fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style FORMAT fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 회의록 작성을 떠올리세요. 회의에서 누가 무슨 말을 했는지, 어떤
              자료를 참고했는지를 정리하고, 비밀번호 같은 민감 정보는 가린 채 공유 문서로 만드는
              과정과 동일합니다.
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

            {/* sanitizeContent */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              sanitizeContent(content)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              민감한 데이터 패턴을 마스킹하여 콘텐츠를 정화합니다.
            </p>
            <CodeBlock>
              <span className="fn">sanitizeContent</span>(<span className="prop">content</span>:{" "}
              <span className="type">string</span>): <span className="type">string</span>
            </CodeBlock>
            <ParamTable
              params={[{ name: "content", type: "string", required: true, desc: "정화할 텍스트" }]}
            />
            <div className="text-[13px] text-gray-600 mt-2 space-y-1">
              <p>
                &bull; <code className="text-cyan-600">sk-abc123...</code> &rarr;{" "}
                <code className="text-red-600">[REDACTED_API_KEY]</code>
              </p>
              <p>
                &bull; <code className="text-cyan-600">Bearer eyJ...</code> &rarr;{" "}
                <code className="text-red-600">Bearer [REDACTED_TOKEN]</code>
              </p>
              <p>
                &bull; <code className="text-cyan-600">ghp_abc123...</code> &rarr;{" "}
                <code className="text-red-600">[REDACTED_GITHUB_TOKEN]</code>
              </p>
              <p>
                &bull; <code className="text-cyan-600">xoxb-abc123...</code> &rarr;{" "}
                <code className="text-red-600">[REDACTED_SLACK_TOKEN]</code>
              </p>
              <p>
                &bull; <code className="text-cyan-600">password=&quot;secret123&quot;</code> &rarr;{" "}
                <code className="text-red-600">password=&quot;[REDACTED]&quot;</code>
              </p>
            </div>

            {/* detectToolCalls */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              detectToolCalls(content)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              어시스턴트 메시지에서 도구 참조를 감지하여 고유 도구 이름 목록을 반환합니다.
            </p>
            <CodeBlock>
              <span className="fn">detectToolCalls</span>(<span className="prop">content</span>:{" "}
              <span className="type">string</span>): <span className="type">readonly string</span>[]
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "content",
                  type: "string",
                  required: true,
                  desc: "어시스턴트 메시지 텍스트",
                },
              ]}
            />

            {/* estimateTokens */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              estimateTokens(text)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              텍스트의 토큰 수를 대략적으로 추정합니다. 약 4글자 = 1토큰으로 계산합니다.
            </p>
            <CodeBlock>
              <span className="fn">estimateTokens</span>(<span className="prop">text</span>:{" "}
              <span className="type">string</span>): <span className="type">number</span>
              {"\n"}
              <span className="cm">// Math.ceil(text.length / 4)</span>
            </CodeBlock>

            {/* copyToClipboard */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              copyToClipboard(text)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              텍스트를 시스템 클립보드에 복사합니다. 플랫폼별 명령어를 사용합니다.
            </p>
            <CodeBlock>
              <span className="fn">copyToClipboard</span>(<span className="prop">text</span>:{" "}
              <span className="type">string</span>): <span className="type">boolean</span>
              {"\n"}
              <span className="cm">// macOS: pbcopy | Linux: xclip | 그 외: false</span>
            </CodeBlock>

            {/* exportCommand */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              exportCommand: SlashCommand
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">/export</code> 슬래시 명령어 정의입니다.
            </p>
            <CodeBlock>
              <span className="prop">name</span>: <span className="str">&quot;export&quot;</span>
              {"\n"}
              <span className="prop">usage</span>:{" "}
              <span className="str">&quot;/export [filename | --clipboard]&quot;</span>
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                클립보드 복사는 macOS(<code className="text-cyan-600">pbcopy</code>)와 Linux(
                <code className="text-cyan-600">xclip</code>)에서만 지원됩니다. Windows에서는 파일
                저장을 사용하세요.
              </li>
              <li>
                <code className="text-cyan-600">system</code> 역할의 메시지는 내보내기에서
                제외됩니다. 시스템 프롬프트는 포함되지 않습니다.
              </li>
              <li>
                토큰 추정은 <code className="text-cyan-600">Math.ceil(text.length / 4)</code>로
                대략적입니다. 한국어 텍스트는 실제 토큰 수가 더 많을 수 있습니다.
              </li>
              <li>
                파일은 <code className="text-cyan-600">context.workingDirectory</code>에 저장됩니다.
                상대 경로를 지정하면 현재 작업 디렉토리 기준으로 저장됩니다.
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

            {/* 기본: 파일 저장 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              기본 사용법 &mdash; 파일로 저장
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              인자 없이 실행하면 타임스탬프 기반 파일명으로 자동 저장됩니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 자동 파일명으로 저장"}</span>
              {"\n"}
              <span className="str">/export</span>
              {"\n"}
              <span className="cm">
                {"// → Conversation exported to: dbcode-conversation-2025-01-15T14-30-00.md"}
              </span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 지정 파일명으로 저장"}</span>
              {"\n"}
              <span className="str">/export my-session</span>
              {"\n"}
              <span className="cm">{"// → Conversation exported to: my-session"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 클립보드에 복사"}</span>
              {"\n"}
              <span className="str">/export --clipboard</span>
              {"\n"}
              <span className="cm">{"// → Conversation copied to clipboard."}</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 민감 정보 마스킹은 알려진 패턴(API 키, Bearer 토큰 등)만
              처리합니다. 커스텀 시크릿이나 비정형 비밀번호는 마스킹되지 않을 수 있으므로, 공유 전에
              내보낸 파일을 반드시 검토하세요.
            </Callout>

            {/* 내보내기 파일 구조 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 내보내기 파일 구조
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              내보낸 마크다운 파일은 다음 구조를 따릅니다.
            </p>
            <CodeBlock>
              <span className="cm">{"# 1. 메타데이터 테이블"}</span>
              {"\n"}
              <span className="prop"># dbcode Conversation Export</span>
              {"\n"}| Field | Value |{"\n"}| Date | 2025-01-15T14:30:00Z |{"\n"}| Model | gpt-4o |
              {"\n"}| Session | abc-123 |{"\n"}| Version | v0.5.0 |{"\n"}| Platform | darwin (arm64)
              |{"\n"}| Directory | /Users/dev/project |{"\n"}
              {"\n"}
              <span className="cm">{"# 2. 턴별 메시지 (system 제외)"}</span>
              {"\n"}
              <span className="prop">## Turn 1</span>
              {"\n"}
              <span className="prop">### User</span>
              {"\n"}(사용자 메시지)
              {"\n"}
              <span className="prop">### Assistant</span>
              {"\n"}(어시스턴트 응답)
              {"\n"}
              <span className="str">{"> Tool: `read_file`"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"# 3. 요약"}</span>
              {"\n"}
              <span className="prop">## Summary</span>
              {"\n"}- Turns: 5 (5 user, 5 assistant)
              {"\n"}- Total messages: 10
              {"\n"}- Estimated tokens: ~12,500
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> 내보낸 파일을 GitHub Issue에 첨부하면 팀원이 대화 맥락을 빠르게
              파악할 수 있습니다. 민감 정보가 자동 마스킹되므로 안심하고 공유할 수 있습니다.
            </Callout>

            <DeepDive title="도구 호출 감지 패턴 상세">
              <p className="mb-3">
                3가지 정규식 패턴으로 어시스턴트 메시지에서 도구 호출을 감지합니다:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <strong>패턴 1:</strong> 백틱으로 감싼 도구 이름 (
                  <code className="text-cyan-600">`read_file`</code>,{" "}
                  <code className="text-cyan-600">`bash`</code> 등)
                </li>
                <li>
                  <strong>패턴 2:</strong>{" "}
                  <code className="text-cyan-600">{"> Tool: `도구명`"}</code> 형식의 인용
                </li>
                <li>
                  <strong>패턴 3:</strong> <code className="text-cyan-600">tool_call: 도구명</code>{" "}
                  형식의 텍스트
                </li>
              </ul>
              <p className="mt-3 text-amber-600">
                동일한 도구가 여러 번 감지되더라도 <code className="text-cyan-600">Set</code>으로
                중복을 제거하여 한 번만 표시됩니다.
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
              메시지 처리 파이프라인
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              각 메시지는 순차적으로 처리되며, 역할에 따라 다른 포맷이 적용됩니다.
            </p>

            <MermaidDiagram
              title="메시지별 처리 흐름"
              titleColor="purple"
              chart={`graph TD
  MSGS["context.messages 순회"]
  SKIP{"role =<br/>system?"}
  USER{"role =<br/>user?"}
  TURN["turnIndex++ 증가<br/><small>## Turn N 헤더</small>"]
  LABEL["### User 또는<br/>### Assistant 라벨"]
  SANITIZE["sanitizeContent()<br/><small>민감 정보 마스킹</small>"]
  TOOLS{"role =<br/>assistant?"}
  DETECT["detectToolCalls()<br/><small>도구 호출 감지 → Tool 인용</small>"]
  TOKENS["estimateTokens()<br/><small>토큰 수 누적</small>"]
  SUMMARY["## Summary<br/><small>턴 수, 메시지 수, 추정 토큰</small>"]

  MSGS --> SKIP
  SKIP -->|"예"| MSGS
  SKIP -->|"아니오"| USER
  USER -->|"예"| TURN
  USER -->|"아니오"| LABEL
  TURN --> LABEL
  LABEL --> SANITIZE
  SANITIZE --> TOOLS
  TOOLS -->|"예"| DETECT
  TOOLS -->|"아니오"| TOKENS
  DETECT --> TOKENS
  TOKENS --> MSGS
  MSGS -->|"완료"| SUMMARY

  style SANITIZE fill:#fef3c7,stroke:#f59e0b,color:#1e293b,stroke-width:2px
  style DETECT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style SUMMARY fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              민감 정보 마스킹의 정규식 체인입니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">sanitizeContent</span>(
              <span className="prop">content</span>: <span className="type">string</span>):{" "}
              <span className="type">string</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">return</span> <span className="prop">content</span>
              {"\n"}
              {"    "}.<span className="fn">replace</span>(
              <span className="str">/\b(sk-[a-zA-Z0-9]{"{20,}"})\b/g</span>,{" "}
              <span className="str">&quot;[REDACTED_API_KEY]&quot;</span>){"\n"}
              {"    "}.<span className="fn">replace</span>(
              <span className="str">/\b(key-[a-zA-Z0-9]{"{20,}"})\b/g</span>,{" "}
              <span className="str">&quot;[REDACTED_KEY]&quot;</span>){"\n"}
              {"    "}.<span className="fn">replace</span>(
              <span className="str">/\b(ssm_[a-zA-Z0-9]{"{20,}"})\b/g</span>,{" "}
              <span className="str">&quot;[REDACTED_KEY]&quot;</span>){"\n"}
              {"    "}.<span className="fn">replace</span>(
              <span className="str">/(Bearer\s+)[a-zA-Z0-9._\-]{"{20,}"}/g</span>,{" "}
              <span className="str">&quot;$1[REDACTED_TOKEN]&quot;</span>){"\n"}
              {"    "}.<span className="fn">replace</span>(
              <span className="str">/\b(ghp_[a-zA-Z0-9]{"{20,}"})\b/g</span>,{" "}
              <span className="str">&quot;[REDACTED_GITHUB_TOKEN]&quot;</span>){"\n"}
              {"    "}.<span className="fn">replace</span>(
              <span className="str">/\b(xoxb-[a-zA-Z0-9\-]{"{20,}"})\b/g</span>,{" "}
              <span className="str">&quot;[REDACTED_SLACK_TOKEN]&quot;</span>){"\n"}
              {"    "}.<span className="fn">replace</span>(
              <span className="str">/(password...)[^&quot;&apos;]{"{8,}"}(.)/gi</span>,{" "}
              <span className="str">&quot;$1[REDACTED]$2&quot;</span>);
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">체인 방식:</strong>{" "}
                <code className="text-cyan-600">.replace()</code>를 체이닝하여 여러 패턴을
                순차적으로 처리합니다. 한 번의 패스로 모든 마스킹이 완료됩니다.
              </p>
              <p>
                <strong className="text-gray-900">최소 길이:</strong> 대부분의 패턴에{" "}
                <code className="text-cyan-600">{"{20,}"}</code> 최소 길이 조건이 있어, 짧은 일반
                텍스트가 오탐되지 않습니다.
              </p>
              <p>
                <strong className="text-gray-900">prefix 보존:</strong> Bearer 토큰의{" "}
                <code className="text-cyan-600">Bearer </code> 접두사는 보존되어 어떤 유형의 정보가
                마스킹되었는지 알 수 있습니다.
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
                &quot;Clipboard not available 에러가 나와요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                Windows 또는 클립보드 유틸리티가 없는 Linux 환경에서 발생합니다.
                <code className="text-cyan-600">/export</code> 또는
                <code className="text-cyan-600">/export my-file.md</code>로 파일로 저장하는 방식을
                사용하세요.
              </p>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                Linux에서 클립보드를 사용하려면 <code className="text-cyan-600">xclip</code>을
                설치하세요: <code className="text-cyan-600">sudo apt install xclip</code>
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;No messages in conversation&quot;이라고 나와요
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                대화가 아직 시작되지 않았을 때 표시됩니다. 최소한 하나의 메시지를 보낸 후{" "}
                <code className="text-cyan-600">/export</code>를 실행하세요.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;민감 정보가 마스킹되지 않았어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">sanitizeContent()</code>는 알려진 패턴만 처리합니다.
                커스텀 시크릿이나 비정형 토큰은 감지되지 않을 수 있습니다. 공유 전에 반드시 내보낸
                파일을 수동으로 검토하세요.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Export failed 에러가 발생해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                파일 쓰기 권한이 없거나 디스크 공간이 부족할 때 발생합니다.
                <code className="text-cyan-600">/doctor</code>로 디스크 공간과 권한을 확인하세요.
                다른 디렉토리에 파일명을 지정할 수도 있습니다.
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
                  name: "secret-scanner.ts",
                  slug: "secret-scanner",
                  relation: "sibling",
                  desc: "도구 출력에서 시크릿을 감지하는 가드레일 모듈 (sanitizeContent와 유사한 패턴 사용)",
                },
                {
                  name: "session-manager.ts",
                  slug: "session-manager",
                  relation: "sibling",
                  desc: "세션 ID, 메시지 내역을 관리하는 모듈 (context.messages의 소스)",
                },
                {
                  name: "conversation-manager.ts",
                  slug: "conversation-manager",
                  relation: "sibling",
                  desc: "대화 상태 관리 및 메시지 영속화 모듈",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
