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

export default function SessionManagerPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/core/session-manager.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              SessionManager
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="core" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            세션 생명주기 관리 &mdash; 생성, 저장, 복원, 이름 지정
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
              <code className="text-cyan-600">SessionManager</code>는 사용자와 AI 간의 대화 세션을
              생성, 저장, 복원, 삭제하는 모듈입니다. 세션이란 하나의 대화 흐름을 의미하며,
              나중에 이어서 대화할 수 있도록 디스크에 영구 저장됩니다.
            </p>
            <p>
              세션 데이터는 <strong>JSONL(JSON Lines)</strong> 형식으로 저장됩니다.
              한 줄에 하나의 JSON 메시지를 기록하므로, 추가(append) 작업이 빠르고
              대용량 대화도 효율적으로 처리할 수 있습니다.
            </p>
            <p>
              동시에 여러 프로세스가 같은 세션에 접근해도 데이터가 깨지지 않도록
              <strong>파일 잠금(file lock)</strong>과 <strong>원자적 쓰기(atomic write)</strong>를 사용합니다.
              원자적 쓰기란 임시 파일에 먼저 쓴 뒤 <code className="text-cyan-600">rename()</code>으로
              한 번에 교체하는 방식으로, 쓰기 도중 크래시가 발생해도 파일이 손상되지 않습니다.
            </p>
          </div>

          <MermaidDiagram
            title="SessionManager 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  APP["App.tsx<br/><small>CLI 진입점</small>"]
  AGENT["Agent Loop<br/><small>agent-loop.ts</small>"]
  SM["SessionManager<br/><small>session-manager.ts</small>"]
  DISK["Disk Storage<br/><small>~/.dbcode/sessions/</small>"]
  CONV["Conversation<br/><small>conversation.ts</small>"]

  APP -->|"세션 생성/복원"| SM
  AGENT -->|"메시지 저장"| SM
  SM -->|"JSONL 읽기/쓰기"| DISK
  SM -->|"메시지 변환"| CONV

  style SM fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style APP fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style AGENT fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style DISK fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style CONV fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 세션 관리자는 &quot;일기장 관리자&quot;와 비슷합니다.
            새 일기장을 만들고(생성), 매일 한 줄씩 기록하고(메시지 추가),
            이전 일기장을 꺼내 읽고(복원), 필요 없으면 버립니다(삭제).
            잠금 장치 덕분에 두 사람이 동시에 같은 일기장을 쓰려 해도 안전합니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* SessionMetadata interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface SessionMetadata
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            세션의 메타데이터를 나타냅니다. <code className="text-cyan-600">metadata.json</code> 파일에 저장되며,
            세션의 기본 정보(이름, 생성 시각, 모델 등)를 담고 있습니다.
          </p>
          <ParamTable
            params={[
              { name: "id", type: "string", required: true, desc: "세션 고유 식별자 (UUID)" },
              { name: "name", type: "string", required: true, desc: "세션 이름 (자동 또는 수동 설정)" },
              { name: "createdAt", type: "string", required: true, desc: "생성 시각 (ISO 8601 문자열)" },
              { name: "lastUsedAt", type: "string", required: true, desc: "마지막 사용 시각 (ISO 8601 문자열)" },
              { name: "workingDirectory", type: "string", required: true, desc: "세션이 시작된 작업 디렉토리 경로" },
              { name: "model", type: "string", required: true, desc: "사용된 LLM 모델명" },
              { name: "messageCount", type: "number", required: true, desc: "총 메시지 수" },
            ]}
          />

          {/* SessionIndexEntry interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface SessionIndexEntry
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            세션 인덱스 파일(<code className="text-cyan-600">index.json</code>)에 저장되는 경량 참조입니다.
            전체 메타데이터의 핵심 정보만 담고 있어 목록 조회 시 빠르게 로드할 수 있습니다.
          </p>
          <ParamTable
            params={[
              { name: "id", type: "string", required: true, desc: "세션 고유 식별자 (UUID)" },
              { name: "name", type: "string", required: true, desc: "세션 이름" },
              { name: "createdAt", type: "string", required: true, desc: "생성 시각 (ISO 8601)" },
              { name: "lastUsedAt", type: "string", required: true, desc: "마지막 사용 시각 (ISO 8601)" },
              { name: "messageCount", type: "number", required: true, desc: "총 메시지 수" },
            ]}
          />

          {/* SessionError class */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class SessionError
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            세션 관리 관련 에러 클래스입니다. <code className="text-cyan-600">BaseError</code>를 상속하며,
            에러 코드로 <code className="text-cyan-600">&quot;SESSION_ERROR&quot;</code>를 사용합니다.
          </p>
          <CodeBlock>
            <span className="kw">class</span> <span className="type">SessionError</span> <span className="kw">extends</span> <span className="type">BaseError</span> {"{"}
            {"\n"}{"  "}<span className="kw">constructor</span>(<span className="prop">message</span>: <span className="type">string</span>, <span className="prop">context</span>?: <span className="type">Record</span>{"<"}<span className="type">string</span>, <span className="type">unknown</span>{">"}){"\n"}{"}"}
          </CodeBlock>

          {/* SessionManager class */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class SessionManager
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            세션의 전체 생명주기를 관리하는 메인 클래스입니다.
            생성, 메시지 추가, 복원, 삭제, 포크 등의 기능을 제공합니다.
          </p>

          {/* Constructor */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            constructor
          </h4>
          <CodeBlock>
            <span className="kw">constructor</span>(<span className="prop">sessionsDir</span>?: <span className="type">string</span>)
          </CodeBlock>
          <ParamTable
            params={[
              { name: "sessionsDir", type: "string | undefined", required: false, desc: "세션 저장 디렉토리 (기본값: ~/.dbcode/sessions/)" },
            ]}
          />

          {/* createSession */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            createSession(options)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            새 세션을 생성합니다. UUID를 자동 생성하고, 세션 디렉토리와 메타데이터 파일을 만듭니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">createSession</span>(<span className="prop">options</span>: {"{"}
            {"\n"}{"  "}<span className="prop">workingDirectory</span>: <span className="type">string</span>;
            {"\n"}{"  "}<span className="prop">model</span>: <span className="type">string</span>;
            {"\n"}{"  "}<span className="prop">name</span>?: <span className="type">string</span>;
            {"\n"}{"}"}): <span className="type">Promise</span>{"<"}<span className="type">string</span>{">"}
          </CodeBlock>
          <ParamTable
            params={[
              { name: "workingDirectory", type: "string", required: true, desc: "세션의 작업 디렉토리 경로" },
              { name: "model", type: "string", required: true, desc: "사용할 LLM 모델명" },
              { name: "name", type: "string | undefined", required: false, desc: "세션 이름 (기본값: 'New session')" },
            ]}
          />

          {/* appendMessage */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            appendMessage(sessionId, message)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            세션 대화 기록에 메시지 한 개를 추가합니다.
            파일 잠금을 사용하여 동시 쓰기를 방지합니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">appendMessage</span>(<span className="prop">sessionId</span>: <span className="type">string</span>, <span className="prop">message</span>: <span className="type">ChatMessage</span>): <span className="type">Promise</span>{"<"}<span className="type">void</span>{">"}
          </CodeBlock>

          {/* appendMessages */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            appendMessages(sessionId, messages)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            여러 메시지를 한번에 추가합니다 (배치 쓰기). 잠금 1회, 디스크 쓰기 1회로 효율적입니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">appendMessages</span>(<span className="prop">sessionId</span>: <span className="type">string</span>, <span className="prop">messages</span>: <span className="kw">readonly</span> <span className="type">ChatMessage</span>[]): <span className="type">Promise</span>{"<"}<span className="type">void</span>{">"}
          </CodeBlock>

          {/* loadMessages */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            loadMessages(sessionId)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            세션의 전체 대화 기록을 로드합니다. JSONL 파일의 각 줄을 파싱하여 <code className="text-cyan-600">ChatMessage</code> 배열로 변환합니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">loadMessages</span>(<span className="prop">sessionId</span>: <span className="type">string</span>): <span className="type">Promise</span>{"<"}<span className="kw">readonly</span> <span className="type">ChatMessage</span>[]{">"}
          </CodeBlock>

          {/* listSessions */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            listSessions()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            모든 세션 목록을 조회합니다. <code className="text-cyan-600">lastUsedAt</code> 기준 내림차순(최근 사용 순)으로 정렬됩니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">listSessions</span>(): <span className="type">Promise</span>{"<"}<span className="kw">readonly</span> <span className="type">SessionIndexEntry</span>[]{">"}
          </CodeBlock>

          {/* forkSession */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            forkSession(sourceSessionId, options?)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            기존 세션을 포크(복제)하여 새 세션을 만듭니다. 원본 세션은 그대로 유지되고,
            복제된 세션에서 다른 방향으로 대화를 이어갈 수 있습니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">forkSession</span>(<span className="prop">sourceSessionId</span>: <span className="type">string</span>, <span className="prop">options</span>?: {"{"} <span className="prop">name</span>?: <span className="type">string</span> {"}"}): <span className="type">Promise</span>{"<"}<span className="type">string</span>{">"}
          </CodeBlock>

          {/* deleteSession */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            deleteSession(sessionId)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            세션을 삭제합니다. 세션 디렉토리와 모든 파일을 삭제하고 인덱스에서 제거합니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">deleteSession</span>(<span className="prop">sessionId</span>: <span className="type">string</span>): <span className="type">Promise</span>{"<"}<span className="type">void</span>{">"}
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              모든 쓰기 작업은 <strong>원자적 쓰기(atomic write)</strong>를 사용합니다.
              임시 파일에 먼저 쓴 뒤 <code className="text-cyan-600">rename()</code>으로 교체하므로,
              쓰기 도중 크래시가 발생해도 데이터가 손상되지 않습니다.
            </li>
            <li>
              <code className="text-cyan-600">withFileLock()</code>은 디렉토리 기반 잠금을 사용합니다.
              <code className="text-cyan-600">mkdir()</code>의 원자성을 이용하며,
              30초 이상 유지된 잠금은 비정상 종료로 간주하고 자동 제거합니다.
            </li>
            <li>
              세션 목록은 <code className="text-cyan-600">index.json</code>으로 관리됩니다.
              이 파일이 손상되면 세션 목록이 비어 보일 수 있지만,
              개별 세션 디렉토리의 데이터는 안전합니다.
            </li>
            <li>
              <code className="text-cyan-600">loadMessages()</code>는 전체 JSONL 파일을 메모리에 로드합니다.
              매우 긴 대화(수천 줄)의 경우 메모리 사용량에 주의하세요.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 세션 생성 및 메시지 저장</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            가장 일반적인 사용 패턴입니다. 세션을 생성하고, 메시지를 추가하고, 나중에 복원합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 1. SessionManager 인스턴스 생성"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">sessionManager</span> = <span className="kw">new</span> <span className="fn">SessionManager</span>();
            {"\n"}
            {"\n"}<span className="cm">{"// 2. 새 세션 생성"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">sessionId</span> = <span className="kw">await</span> <span className="prop">sessionManager</span>.<span className="fn">createSession</span>({"{"}{"\n"}{"  "}<span className="prop">workingDirectory</span>: <span className="str">&quot;/home/user/project&quot;</span>,
            {"\n"}{"  "}<span className="prop">model</span>: <span className="str">&quot;gpt-4o&quot;</span>,
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 3. 메시지 추가"}</span>
            {"\n"}<span className="kw">await</span> <span className="prop">sessionManager</span>.<span className="fn">appendMessage</span>(<span className="prop">sessionId</span>, {"{"}{"\n"}{"  "}<span className="prop">role</span>: <span className="str">&quot;user&quot;</span>,
            {"\n"}{"  "}<span className="prop">content</span>: <span className="str">&quot;안녕하세요!&quot;</span>,
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 4. 나중에 세션 복원"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">messages</span> = <span className="kw">await</span> <span className="prop">sessionManager</span>.<span className="fn">loadMessages</span>(<span className="prop">sessionId</span>);
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>appendMessage()</code>는 내부적으로 파일 잠금을 사용합니다.
            잠금 획득 타임아웃은 5초(5000ms)이며, 타임아웃 초과 시
            <code className="text-cyan-600">SessionError</code>가 발생합니다.
            다른 프로세스가 같은 세션에 장시간 쓰기 중이면 대기할 수 있습니다.
          </Callout>

          {/* 세션 이름 자동 설정 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            세션 이름 자동 설정
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            첫 번째 사용자 메시지를 기반으로 세션 이름을 자동 생성합니다.
            50자로 잘라내고, 줄바꿈과 연속 공백을 정리합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 사용자의 첫 메시지로 세션 이름 자동 설정"}</span>
            {"\n"}<span className="kw">await</span> <span className="prop">sessionManager</span>.<span className="fn">autoNameSession</span>(<span className="prop">sessionId</span>, <span className="str">&quot;React 컴포넌트 리팩토링 도와주세요&quot;</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// 수동으로 이름 변경도 가능"}</span>
            {"\n"}<span className="kw">await</span> <span className="prop">sessionManager</span>.<span className="fn">renameSession</span>(<span className="prop">sessionId</span>, <span className="str">&quot;프로젝트 A 리팩토링&quot;</span>);
          </CodeBlock>

          {/* 세션 포크 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 세션 포크(Fork)
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            기존 대화를 복제하여 새로운 방향으로 분기할 수 있습니다.
            원본 세션은 그대로 유지됩니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 현재 세션을 포크하여 다른 접근 방법 시도"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">forkedId</span> = <span className="kw">await</span> <span className="prop">sessionManager</span>.<span className="fn">forkSession</span>(<span className="prop">sessionId</span>, {"{"}{"\n"}{"  "}<span className="prop">name</span>: <span className="str">&quot;Alternative approach&quot;</span>,
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 포크된 세션에서 다른 방향으로 대화 계속"}</span>
            {"\n"}<span className="kw">await</span> <span className="prop">sessionManager</span>.<span className="fn">appendMessage</span>(<span className="prop">forkedId</span>, {"{"}{"\n"}{"  "}<span className="prop">role</span>: <span className="str">&quot;user&quot;</span>,
            {"\n"}{"  "}<span className="prop">content</span>: <span className="str">&quot;다른 방법으로 시도해볼게요&quot;</span>,
            {"\n"}{"}"});
          </CodeBlock>

          <DeepDive title="배치 쓰기 vs 개별 쓰기 성능 차이">
            <p className="mb-3">
              메시지를 여러 개 추가할 때는 <code className="text-cyan-600">appendMessages()</code>를
              사용하는 것이 훨씬 효율적입니다:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li>
                <strong>개별 쓰기:</strong> 메시지 N개 &times; (잠금 획득 + 파일 읽기 + 파일 쓰기 + 잠금 해제) = N번 디스크 I/O
              </li>
              <li>
                <strong>배치 쓰기:</strong> 잠금 1번 + 파일 읽기 1번 + 파일 쓰기 1번 + 잠금 해제 1번 = 4번 디스크 I/O
              </li>
            </ul>
            <p className="mt-3 text-amber-600">
              에이전트 루프의 한 턴에서 여러 메시지가 생성되면(도구 호출 결과 등),
              <code>appendMessages()</code>로 한번에 저장하는 것을 권장합니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>디렉토리 구조</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            세션 데이터는 아래와 같은 디렉토리 구조로 저장됩니다.
            각 세션은 고유한 UUID 이름의 디렉토리를 가집니다.
          </p>
          <CodeBlock>
            <span className="cm">{"~/.dbcode/sessions/"}</span>
            {"\n"}<span className="prop">{"├── index.json"}</span>{"               "}<span className="cm">{"# 전체 세션 목록 (경량 인덱스)"}</span>
            {"\n"}<span className="prop">{"├── {session-id}/"}</span>
            {"\n"}<span className="prop">{"│   ├── transcript.jsonl"}</span>{"     "}<span className="cm">{"# 메시지 기록 (한 줄 = 한 메시지)"}</span>
            {"\n"}<span className="prop">{"│   └── metadata.json"}</span>{"        "}<span className="cm">{"# 세션 메타데이터"}</span>
          </CodeBlock>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>파일 잠금 메커니즘</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">withFileLock()</code>은 디렉토리 기반 잠금을 사용합니다.
            <code className="text-cyan-600">mkdir()</code>의 원자성을 이용하여 동시 접근을 방지합니다.
          </p>

          <MermaidDiagram
            title="파일 잠금 획득 플로우"
            titleColor="purple"
            chart={`graph TD
  START(("시작")) --> TRY["mkdir(lockDir)<br/><small>잠금 디렉토리 생성 시도</small>"]
  TRY -->|"성공"| EXEC["함수 실행<br/><small>잠금 보유 중</small>"]
  TRY -->|"EEXIST"| STALE{"잠금이 30초<br/>이상 오래됨?"}
  STALE -->|"예"| REMOVE["오래된 잠금 제거<br/><small>rm -rf lockDir</small>"]
  STALE -->|"아니오"| TIMEOUT{"타임아웃<br/>초과?"}
  REMOVE --> TRY
  TIMEOUT -->|"예"| ERROR["SessionError<br/><small>잠금 획득 실패</small>"]
  TIMEOUT -->|"아니오"| WAIT["50ms 대기<br/><small>재시도</small>"]
  WAIT --> TRY
  EXEC --> UNLOCK["잠금 해제<br/><small>lockDir 삭제</small>"]
  UNLOCK --> DONE(("완료"))

  style TRY fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style EXEC fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style ERROR fill:#fee2e2,stroke:#ef4444,color:#991b1b,stroke-width:2px
  style STALE fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style TIMEOUT fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style REMOVE fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style WAIT fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style UNLOCK fill:#dbeafe,stroke:#3b82f6,color:#1e293b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석 &mdash; atomicWrite</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            원자적 쓰기의 핵심 로직입니다.
            임시 파일에 쓴 뒤 <code className="text-cyan-600">rename()</code>으로 교체합니다.
          </p>
          <CodeBlock>
            <span className="kw">async function</span> <span className="fn">atomicWrite</span>(<span className="prop">filePath</span>: <span className="type">string</span>, <span className="prop">content</span>: <span className="type">string</span>): <span className="type">Promise</span>{"<"}<span className="type">void</span>{">"} {"{"}
            {"\n"}{"  "}<span className="cm">{"// [1] 고유한 임시 파일 이름 생성 (PID + 타임스탬프)"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">tmpPath</span> = <span className="str">{"`${filePath}.tmp.${process.pid}.${Date.now()}`"}</span>;
            {"\n"}{"  "}<span className="kw">try</span> {"{"}
            {"\n"}{"    "}<span className="cm">{"// [2] 임시 파일에 내용 쓰기"}</span>
            {"\n"}{"    "}<span className="kw">await</span> <span className="fn">writeFile</span>(<span className="prop">tmpPath</span>, <span className="prop">content</span>, <span className="str">&quot;utf-8&quot;</span>);
            {"\n"}{"    "}<span className="cm">{"// [3] 원자적 교체 (OS 수준에서 원자적)"}</span>
            {"\n"}{"    "}<span className="kw">await</span> <span className="fn">rename</span>(<span className="prop">tmpPath</span>, <span className="prop">filePath</span>);
            {"\n"}{"  "}<span className="kw">{"}"} catch</span> (<span className="prop">err</span>) {"{"}
            {"\n"}{"    "}<span className="cm">{"// [4] 실패 시 임시 파일 정리"}</span>
            {"\n"}{"    "}<span className="kw">await</span> <span className="fn">unlink</span>(<span className="prop">tmpPath</span>).<span className="fn">catch</span>(() ={">"} {"{"}{"}"});
            {"\n"}{"    "}<span className="kw">throw</span> <span className="prop">err</span>;
            {"\n"}{"  "}{"}"}
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> PID와 타임스탬프를 조합하여 임시 파일 이름 충돌을 방지합니다.</p>
            <p><strong className="text-gray-900">[2]</strong> 목적 파일이 아닌 임시 파일에 먼저 씁니다. 쓰기 중 크래시가 나도 원본은 안전합니다.</p>
            <p><strong className="text-gray-900">[3]</strong> <code className="text-cyan-600">rename()</code>은 OS 수준에서 원자적 연산이므로, 교체가 &quot;절반만&quot; 되는 일은 없습니다.</p>
            <p><strong className="text-gray-900">[4]</strong> 쓰기나 교체가 실패하면 임시 파일을 정리하고 에러를 다시 던집니다.</p>
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
              &quot;Lock acquisition timeout 에러가 발생해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              5초 이내에 파일 잠금을 획득하지 못하면 이 에러가 발생합니다.
              보통 다음 원인 중 하나입니다:
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <strong>다른 프로세스가 잠금을 보유:</strong> 다른 dbcode 인스턴스가 같은 세션에 쓰기 중일 수 있습니다.
                잠시 기다린 후 재시도하세요.
              </li>
              <li>
                <strong>오래된 잠금 파일:</strong> 이전 프로세스가 비정상 종료되어 잠금이 남아있을 수 있습니다.
                30초가 지나면 자동으로 제거되지만, 수동으로
                <code className="text-cyan-600">~/.dbcode/sessions/{"{sessionId}"}/.lock</code> 디렉토리를 삭제해도 됩니다.
              </li>
            </ul>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;세션 목록에 세션이 보이지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              <code className="text-cyan-600">index.json</code> 파일이 손상되었을 수 있습니다.
              세션 데이터 자체(각 세션 디렉토리의 파일들)는 안전하므로,
              <code className="text-cyan-600">index.json</code>을 삭제하면 다시 재구축할 수 있습니다.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Failed to parse session transcript line 에러가 발생해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              JSONL 파일의 특정 줄이 유효하지 않은 JSON 형식입니다.
              보통 쓰기 도중 프로세스가 비정상 종료되었을 때 발생합니다.
              원자적 쓰기를 사용하므로 드문 경우이지만, 발생하면 해당 줄을 수동으로 수정하거나
              삭제해야 합니다.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;세션 이름이 자동으로 설정되지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">autoNameSession()</code>이 호출되어야 자동 이름이 설정됩니다.
              첫 번째 사용자 메시지가 비어있으면 빈 문자열이 이름이 됩니다.
              수동으로 <code className="text-cyan-600">renameSession()</code>을 호출하여
              원하는 이름으로 변경할 수 있습니다.
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
                name: "conversation.ts",
                slug: "conversation-manager",
                relation: "sibling",
                desc: "불변 대화 상태 관리 — SessionManager가 저장한 메시지를 Conversation 객체로 변환",
              },
              {
                name: "agent-loop.ts",
                slug: "agent-loop",
                relation: "parent",
                desc: "에이전트 루프가 세션을 생성하고 매 턴마다 메시지를 저장하는 메인 루프",
              },
              {
                name: "activity.ts",
                slug: "activity-collector",
                relation: "sibling",
                desc: "턴 활동 수집 — 세션 내 각 턴에서 발생하는 활동을 기록",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
