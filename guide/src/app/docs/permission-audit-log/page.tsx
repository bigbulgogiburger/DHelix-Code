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

export default function PermissionAuditLogPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/permissions/audit-log.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              AuditLogger
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            권한 결정 감사 로그 &mdash; 도구 실행이 승인되거나 거부될 때마다
            &quot;누가, 언제, 무엇을, 왜&quot;를 JSONL 형식으로 기록하는 보안 추적 모듈입니다.
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
              권한 시스템에서 가장 중요한 것 중 하나는 <strong>&quot;무슨 일이 있었는지 나중에 확인할 수 있는가?&quot;</strong>입니다.
              세션 저장소는 &quot;지금 승인된 것&quot;을 기억하고, 영구 저장소는 &quot;항상 적용될 규칙&quot;을 저장합니다.
              하지만 &quot;어제 10시에 어떤 도구가 승인되었고, 왜 승인되었는지&quot;를 추적하려면 별도의 기록이 필요합니다.
              <code className="text-cyan-600">AuditLogger</code>가 이 역할을 합니다.
            </p>
            <p>
              기록 형식은 <strong>JSONL(JSON Lines)</strong>입니다. 일반적인 JSON 배열(<code>[...]</code>)이 아니라,
              각 줄이 독립적인 JSON 객체인 형식입니다. 왜 이 형식을 선택했을까요?
            </p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>
                <strong>추가 전용(append-only)</strong> &mdash; 파일 끝에 한 줄만 추가하면 됩니다.
                기존 내용을 읽거나 파싱할 필요가 없어서 매우 빠릅니다.
              </li>
              <li>
                <strong>부분 손상 내성</strong> &mdash; 한 줄이 깨져도 다른 줄은 독립적이므로 정상 파싱됩니다.
                프로세스가 비정상 종료되어 마지막 줄이 불완전해도 나머지는 안전합니다.
              </li>
              <li>
                <strong>원자적 쓰기</strong> &mdash; OS 파이프 버퍼(보통 4KB) 미만의 쓰기는 원자적으로 수행됩니다.
                일반적인 감사 로그 항목은 수백 바이트이므로, 여러 프로세스가 동시에 써도 줄이 깨지지 않습니다.
              </li>
            </ul>
            <p>
              <code className="text-cyan-600">AuditLogger</code>는 <strong>추가 전용</strong> 방식으로 동작합니다.
              한 번 기록된 로그는 수정하거나 삭제하는 API가 없습니다.
              이는 감사 로그의 무결성(integrity)을 보장합니다 &mdash;
              설령 공격자가 시스템에 접근하더라도, 이미 기록된 로그 항목을 API로 지울 수 없습니다.
            </p>
            <p>
              기본 파일 경로는 <code className="text-cyan-600">~/.dbcode/audit.jsonl</code>이며,
              생성자에서 경로를 지정할 수 있습니다.
            </p>
          </div>

          <MermaidDiagram
            title="AuditLogger 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  TOOL["Tool Executor<br/><small>도구 실행 요청</small>"]
  PM["Permission Manager<br/><small>permissions/manager.ts</small>"]
  SS["SessionApprovalStore<br/><small>session-store.ts</small>"]
  PS["PersistentPermissionStore<br/><small>persistent-store.ts</small>"]
  AL["AuditLogger<br/><small>audit-log.ts</small>"]
  DISK["~/.dbcode/audit.jsonl<br/><small>JSONL 로그 파일</small>"]

  TOOL -->|"1. 권한 확인"| PM
  PM -->|"2. 캐시/규칙 확인"| SS
  PM -->|"3. 영구 규칙 확인"| PS
  PM -->|"4. 모든 결정 기록"| AL
  AL -->|"appendFile()"| DISK

  style AL fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style PM fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style SS fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style PS fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TOOL fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style DISK fill:#fef3c7,stroke:#f59e0b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 건물의 CCTV 녹화 시스템을 떠올리세요.
            출입문을 통과할 때마다 시간, 사람, 출입 결정이 녹화됩니다.
            이 영상은 덮어쓰거나 삭제할 수 없으며(추가 전용),
            보안 사고 발생 시 &quot;누가 언제 출입했는지&quot; 추적하는 데 사용됩니다.
            한 프레임이 깨져도 전후 프레임은 정상입니다(JSONL의 줄 단위 독립성).
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* ── AuditEntry interface ── */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface AuditEntry
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            감사 로그의 한 항목을 나타내는 인터페이스입니다.
            모든 프로퍼티가 <code className="text-cyan-600">readonly</code>입니다.
            JSONL 파일에서 각 항목은 이 인터페이스의 JSON 표현이며, 한 줄에 해당합니다.
          </p>
          <ParamTable
            params={[
              { name: "timestamp", type: "string", required: true, desc: "ISO 8601 형식의 타임스탬프 (예: \"2024-01-15T10:30:00.000Z\"). new Date().toISOString()으로 생성" },
              { name: "sessionId", type: "string", required: true, desc: "현재 세션의 고유 ID. 같은 세션에서 발생한 로그를 그룹핑하여 하나의 대화 흐름을 추적할 수 있음" },
              { name: "toolName", type: "string", required: true, desc: "권한 검사 대상 도구 이름 (예: \"Bash\", \"file_read\", \"file_write\")" },
              { name: "decision", type: "\"approved\" | \"denied\" | \"auto-approved\"", required: true, desc: "권한 결정 결과 — 아래 상세 설명 참조" },
              { name: "reason", type: "string | undefined", required: false, desc: "결정의 이유. 디버깅이나 감사 시 왜 그런 결정이 내려졌는지 파악하는 데 사용" },
            ]}
          />
          <div className="text-[13px] text-gray-600 mt-3 space-y-1.5">
            <p><strong>decision 값의 의미:</strong></p>
            <p>&bull; <code className="text-emerald-600">&quot;approved&quot;</code> &mdash; 사용자가 UI에서 직접 &quot;허용&quot;을 클릭하여 수동 승인</p>
            <p>&bull; <code className="text-red-600">&quot;denied&quot;</code> &mdash; 영구 deny 규칙에 의해 거부되었거나, 사용자가 &quot;거부&quot;를 클릭</p>
            <p>&bull; <code className="text-cyan-600">&quot;auto-approved&quot;</code> &mdash; 세션 캐시 히트, 영구 allow 규칙 매칭, 또는 권한 모드(safe mode 등)에 의해 자동으로 승인</p>
          </div>

          {/* ── AuditLogger class ── */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class AuditLogger
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            JSONL 형식의 추가 전용(append-only) 감사 로거 클래스입니다.
            수정이나 삭제 메서드가 없는 것이 의도된 설계입니다.
            내부에 <code className="text-cyan-600">logPath</code>(로그 파일 경로)와
            <code className="text-cyan-600">initialized</code>(지연 초기화 플래그) 두 개의 private 필드를 가집니다.
          </p>

          {/* Constructor */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            constructor(logPath)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            로그 파일 경로를 받아 저장합니다. 생성 시점에는 파일이나 디렉토리를 생성하지 않습니다.
            실제 디렉토리 생성은 첫 번째 <code className="text-cyan-600">log()</code> 호출까지 지연됩니다(지연 초기화).
            이는 AuditLogger 인스턴스만 만들고 실제로 사용하지 않는 경우의 불필요한 I/O를 방지합니다.
          </p>
          <CodeBlock>
            <span className="kw">constructor</span>(<span className="prop">logPath</span>: <span className="type">string</span>)
          </CodeBlock>
          <ParamTable
            params={[
              { name: "logPath", type: "string", required: true, desc: "감사 로그 파일의 절대 경로 (예: \"/home/user/.dbcode/audit.jsonl\")" },
            ]}
          />

          {/* log */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            log(entry)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            감사 로그 항목을 JSONL 파일에 추가합니다.
            첫 호출 시 <code className="text-cyan-600">ensureDirectory()</code>를 통해
            로그 디렉토리를 자동 생성합니다(지연 초기화).
            항목은 <code className="text-cyan-600">JSON.stringify()</code>로 한 줄로 직렬화된 뒤
            줄바꿈(<code>\n</code>)이 추가되어 파일 끝에 append됩니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">log</span>(<span className="prop">entry</span>: <span className="type">AuditEntry</span>): <span className="type">Promise&lt;void&gt;</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "entry", type: "AuditEntry", required: true, desc: "기록할 감사 로그 항목. timestamp, sessionId, toolName, decision은 필수" },
            ]}
          />

          {/* getRecentEntries */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            getRecentEntries(count?)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            가장 최근의 감사 로그 항목들을 읽어옵니다.
            파일 전체를 메모리에 읽은 후, 줄 단위로 JSON 파싱하고,
            마지막 <code className="text-cyan-600">count</code>개를 반환합니다.
            손상된 줄(JSON 파싱 실패)은 건너뛰어 <strong>방어적</strong>으로 처리합니다.
            로그 파일이 없으면 에러 없이 빈 배열을 반환합니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">getRecentEntries</span>(<span className="prop">count</span>?: <span className="type">number</span>): <span className="type">Promise&lt;readonly AuditEntry[]&gt;</span>
            {"\n"}<span className="cm">// count 기본값: 50</span>
            {"\n"}<span className="cm">// 반환: 시간순(오래된 것 먼저)으로 정렬된 배열</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "count", type: "number", required: false, desc: "반환할 최대 항목 수. 기본값 50. 파일에 count보다 적은 항목이 있으면 전부 반환" },
            ]}
          />

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <strong>수정/삭제 API가 없습니다.</strong>{" "}
              이것은 버그가 아니라 의도된 설계입니다. 감사 로그의 무결성을 보장하기 위해
              <code className="text-cyan-600">log()</code>(추가)와
              <code className="text-cyan-600">getRecentEntries()</code>(읽기)만 제공합니다.
            </li>
            <li>
              <strong>getRecentEntries()는 파일 전체를 읽습니다.</strong>{" "}
              로그 파일이 매우 커지면(수십만 줄 이상) 메모리 사용량이 증가합니다.
              운영 환경에서는 주기적인 로그 로테이션을 고려하세요.
            </li>
            <li>
              <strong>지연 초기화는 첫 log() 호출에서만 발생합니다.</strong>{" "}
              <code className="text-cyan-600">getRecentEntries()</code>는 디렉토리를 생성하지 않습니다.
              파일이 없으면 빈 배열을 반환할 뿐입니다.
            </li>
            <li>
              <strong>동시 쓰기는 조건부 안전입니다.</strong>{" "}
              감사 로그 항목이 OS 파이프 버퍼(보통 4KB) 미만이면 원자적 쓰기가 보장됩니다.
              일반적인 항목은 수백 바이트이므로 안전하지만, 극단적으로 큰 reason 필드는 피하세요.
            </li>
            <li>
              <strong>log()는 비동기(async)입니다.</strong>{" "}
              <code className="text-cyan-600">await</code>를 빠뜨리면 로그가 기록되기 전에
              다음 코드가 실행될 수 있습니다. 특히 프로세스 종료 직전에는 반드시 <code className="text-cyan-600">await</code>하세요.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 권한 결정 기록</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            Permission Manager에서 권한 결정이 내려질 때마다
            감사 로그에 기록하는 패턴입니다.
            모든 결정(승인, 거부, 자동 승인)이 기록되어야 완전한 감사 추적이 가능합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 1. 로거 생성 — 로그 파일 경로 지정"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">auditLogger</span> = <span className="kw">new</span> <span className="fn">AuditLogger</span>(
            {"\n"}{"  "}<span className="fn">join</span>(<span className="fn">homedir</span>(), <span className="str">&quot;.dbcode&quot;</span>, <span className="str">&quot;audit.jsonl&quot;</span>)
            {"\n"});
            {"\n"}<span className="cm">{"// 이 시점에서는 파일/디렉토리가 생성되지 않음 (지연 초기화)"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 2. 사용자가 수동으로 승인한 경우"}</span>
            {"\n"}<span className="kw">await</span> <span className="prop">auditLogger</span>.<span className="fn">log</span>({"{"}
            {"\n"}{"  "}<span className="prop">timestamp</span>: <span className="kw">new</span> <span className="fn">Date</span>().<span className="fn">toISOString</span>(),
            {"\n"}{"  "}<span className="prop">sessionId</span>: <span className="str">&quot;sess_abc123&quot;</span>,
            {"\n"}{"  "}<span className="prop">toolName</span>: <span className="str">&quot;Bash&quot;</span>,
            {"\n"}{"  "}<span className="prop">decision</span>: <span className="str">&quot;approved&quot;</span>,
            {"\n"}{"  "}<span className="prop">reason</span>: <span className="str">&quot;User manually approved&quot;</span>,
            {"\n"}{"}"});
            {"\n"}<span className="cm">{"// → 첫 호출이므로 ~/.dbcode/ 디렉토리 생성 + 로그 기록"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 3. 세션 캐시 히트로 자동 승인된 경우"}</span>
            {"\n"}<span className="kw">await</span> <span className="prop">auditLogger</span>.<span className="fn">log</span>({"{"}
            {"\n"}{"  "}<span className="prop">timestamp</span>: <span className="kw">new</span> <span className="fn">Date</span>().<span className="fn">toISOString</span>(),
            {"\n"}{"  "}<span className="prop">sessionId</span>: <span className="str">&quot;sess_abc123&quot;</span>,
            {"\n"}{"  "}<span className="prop">toolName</span>: <span className="str">&quot;Bash&quot;</span>,
            {"\n"}{"  "}<span className="prop">decision</span>: <span className="str">&quot;auto-approved&quot;</span>,
            {"\n"}{"  "}<span className="prop">reason</span>: <span className="str">&quot;Session cache hit&quot;</span>,
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 4. 영구 규칙에 의해 거부된 경우"}</span>
            {"\n"}<span className="kw">await</span> <span className="prop">auditLogger</span>.<span className="fn">log</span>({"{"}
            {"\n"}{"  "}<span className="prop">timestamp</span>: <span className="kw">new</span> <span className="fn">Date</span>().<span className="fn">toISOString</span>(),
            {"\n"}{"  "}<span className="prop">sessionId</span>: <span className="str">&quot;sess_abc123&quot;</span>,
            {"\n"}{"  "}<span className="prop">toolName</span>: <span className="str">&quot;file_write&quot;</span>,
            {"\n"}{"  "}<span className="prop">decision</span>: <span className="str">&quot;denied&quot;</span>,
            {"\n"}{"  "}<span className="prop">reason</span>: <span className="str">&quot;Persistent deny rule: Bash(rm -rf *)&quot;</span>,
            {"\n"}{"}"});
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>log()</code>는 비동기입니다.
            <code>await</code>를 빠뜨리면 로그가 기록되기 전에 다음 코드가 실행됩니다.
            특히 프로세스 종료 직전의 마지막 로그는 반드시 <code>await</code>하세요.
            그렇지 않으면 마지막 결정이 기록되지 않을 수 있습니다.
          </Callout>

          {/* 고급: 최근 로그 조회 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 최근 감사 로그 조회와 분석
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            보안 감사, 디버깅, 또는 UI에서 최근 권한 이력을 보여줄 때의 패턴입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// ── 최근 20개 항목 조회 ──"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">entries</span> = <span className="kw">await</span> <span className="prop">auditLogger</span>.<span className="fn">getRecentEntries</span>(<span className="num">20</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// ── 거부된 항목만 필터링 (보안 감사) ──"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">denied</span> = <span className="prop">entries</span>.<span className="fn">filter</span>(
            {"\n"}{"  "}<span className="prop">e</span> ={">"} <span className="prop">e</span>.<span className="prop">decision</span> === <span className="str">&quot;denied&quot;</span>
            {"\n"});
            {"\n"}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">`최근 거부된 도구 호출: ${"{"}</span><span className="prop">denied</span>.<span className="prop">length</span><span className="str">{"}"}`</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// ── 특정 세션의 로그만 조회 (디버깅) ──"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">sessionLogs</span> = <span className="prop">entries</span>.<span className="fn">filter</span>(
            {"\n"}{"  "}<span className="prop">e</span> ={">"} <span className="prop">e</span>.<span className="prop">sessionId</span> === <span className="str">&quot;sess_abc123&quot;</span>
            {"\n"});
            {"\n"}
            {"\n"}<span className="cm">{"// ── 도구별 통계 (UI 표시) ──"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">toolStats</span> = <span className="kw">new</span> <span className="fn">Map</span>&lt;<span className="type">string</span>, <span className="type">number</span>&gt;();
            {"\n"}<span className="kw">for</span> (<span className="kw">const</span> <span className="prop">entry</span> <span className="kw">of</span> <span className="prop">entries</span>) {"{"}
            {"\n"}{"  "}<span className="prop">toolStats</span>.<span className="fn">set</span>(
            {"\n"}{"    "}<span className="prop">entry</span>.<span className="prop">toolName</span>,
            {"\n"}{"    "}(<span className="prop">toolStats</span>.<span className="fn">get</span>(<span className="prop">entry</span>.<span className="prop">toolName</span>) ?? <span className="num">0</span>) + <span className="num">1</span>
            {"\n"}{"  "});
            {"\n"}{"}"}
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> <code>getRecentEntries()</code>에 인수를 전달하지 않으면
            기본적으로 최근 50개 항목을 반환합니다.
            반환값은 시간순(오래된 것이 앞)이므로, 가장 최근 항목은 배열의 마지막에 있습니다.
          </Callout>

          <DeepDive title="JSONL 형식 vs JSON 배열">
            <p className="mb-3">
              감사 로그에 JSONL을 선택한 이유를 일반 JSON 배열과 비교합니다:
            </p>
            <div className="overflow-x-auto">
              <table className="text-[13px] text-gray-600 w-full border-collapse mt-2">
                <thead>
                  <tr className="text-left border-b border-gray-200">
                    <th className="py-2 pr-4 font-bold text-gray-900">비교 항목</th>
                    <th className="py-2 pr-4 font-bold text-gray-900">JSON 배열</th>
                    <th className="py-2 font-bold text-gray-900">JSONL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-4">항목 추가</td>
                    <td className="py-2 pr-4">전체 파일을 읽고, 파싱하고, 배열에 추가하고, 다시 저장</td>
                    <td className="py-2">파일 끝에 한 줄 append</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-4">부분 손상</td>
                    <td className="py-2 pr-4">닫는 괄호가 없으면 전체 파싱 실패</td>
                    <td className="py-2">깨진 줄만 건너뛰고 나머지 정상 파싱</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-4">동시 쓰기</td>
                    <td className="py-2 pr-4">파일 잠금 필수</td>
                    <td className="py-2">4KB 미만이면 원자적 append</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">파일 크기</td>
                    <td className="py-2 pr-4">커지면 파싱 시간 급증</td>
                    <td className="py-2">줄 단위 스트리밍 처리 가능</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </DeepDive>
        </section>
      </RevealOnScroll>

      {/* ─── 4. 내부 구현 (Internals) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>⚙️</span> 내부 구현
          </h2>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>log()과 getRecentEntries() 내부 흐름</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">log()</code>는 지연 초기화 패턴으로 디렉토리를 생성한 뒤 파일에 추가합니다.
            <code className="text-cyan-600">getRecentEntries()</code>는 파일 전체를 읽고 방어적 파싱 후 마지막 N개를 반환합니다.
          </p>

          <MermaidDiagram
            title="AuditLogger 내부 흐름"
            titleColor="purple"
            chart={`graph TD
  LOG(("log(entry)")) --> INIT{"initialized<br/>플래그?"}
  INIT -->|"false"| MKDIR["await mkdir(recursive)<br/><small>디렉토리 생성</small>"]
  MKDIR --> FLAG["initialized = true"]
  FLAG --> SERIAL
  INIT -->|"true (이후 호출)"| SERIAL["JSON.stringify(entry)<br/><small>한 줄 직렬화</small>"]
  SERIAL --> APPEND["await appendFile()<br/><small>줄바꿈 추가 후 파일 끝에 쓰기</small>"]
  APPEND --> DONE_W(("완료"))

  READ(("getRecentEntries(count)")) --> TRY["await readFile()"]
  TRY --> SPLIT["줄바꿈 분리 + 빈 줄 제거"]
  SPLIT --> PARSE["줄마다 try JSON.parse<br/><small>실패 시 skip</small>"]
  PARSE --> SLICE["entries.slice(-count)<br/><small>마지막 N개만 반환</small>"]
  SLICE --> DONE_R(("반환"))
  TRY -->|"파일 없음 / 읽기 실패"| EMPTY["빈 배열 반환"]

  style LOG fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style INIT fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style MKDIR fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style FLAG fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style SERIAL fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style APPEND fill:#dcfce7,stroke:#10b981,color:#065f46
  style DONE_W fill:#dcfce7,stroke:#10b981,color:#065f46
  style READ fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style TRY fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style SPLIT fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style PARSE fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style SLICE fill:#dcfce7,stroke:#10b981,color:#065f46
  style DONE_R fill:#dcfce7,stroke:#10b981,color:#065f46
  style EMPTY fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>log() &mdash; 지연 초기화 + 추가 전용 기록</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">log()</code> 메서드의 전체 코드입니다.
            짧지만 세 가지 핵심 패턴이 담겨 있습니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">log</span>(<span className="prop">entry</span>: <span className="type">AuditEntry</span>): <span className="type">Promise&lt;void&gt;</span> {"{"}
            {"\n"}{"  "}<span className="cm">{"// [1] 지연 초기화 — 첫 호출에서만 디렉토리 생성"}</span>
            {"\n"}{"  "}<span className="kw">await</span> <span className="kw">this</span>.<span className="fn">ensureDirectory</span>();
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [2] 한 줄 JSON으로 직렬화 + 줄바꿈"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">line</span> = <span className="fn">JSON.stringify</span>(<span className="prop">entry</span>) + <span className="str">&quot;\n&quot;</span>;
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [3] 파일 끝에 추가 (기존 내용 보존)"}</span>
            {"\n"}{"  "}<span className="kw">await</span> <span className="fn">appendFile</span>(<span className="kw">this</span>.<span className="prop">logPath</span>, <span className="prop">line</span>, {"{"} <span className="prop">encoding</span>: <span className="str">&quot;utf-8&quot;</span> {"}"});
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1] 지연 초기화(Lazy Initialization):</strong> <code className="text-cyan-600">ensureDirectory()</code>는 내부의 <code className="text-cyan-600">initialized</code> 플래그를 확인합니다. <code>false</code>이면 <code>mkdir(recursive: true)</code>로 디렉토리를 생성하고 <code>true</code>로 설정합니다. 이후 호출에서는 I/O 없이 즉시 반환됩니다.</p>
            <p><strong className="text-gray-900">[2] JSONL 직렬화:</strong> <code className="text-cyan-600">JSON.stringify()</code>는 줄바꿈 없이 한 줄 JSON을 만듭니다. 끝에 <code>\n</code>을 추가하여 다음 항목과 분리합니다.</p>
            <p><strong className="text-gray-900">[3] 추가 전용 쓰기:</strong> <code className="text-cyan-600">appendFile()</code>은 파일이 없으면 생성하고, 있으면 끝에 추가합니다. 기존 로그를 절대 덮어쓰지 않습니다. 4KB 미만이면 OS가 원자적 쓰기를 보장합니다.</p>
          </div>

          <DeepDive title="getRecentEntries()의 방어적 파싱 전략">
            <p className="mb-3">
              로그 파일은 프로세스 비정상 종료, 디스크 오류 등으로 부분적으로 손상될 수 있습니다.
              <code className="text-cyan-600">getRecentEntries()</code>는 이에 대비한 방어적 파싱을 수행합니다:
            </p>
            <CodeBlock>
              <span className="cm">{"// 줄바꿈으로 분리, 빈 줄 제거"}</span>
              {"\n"}<span className="kw">const</span> <span className="prop">lines</span> = <span className="prop">content</span>.<span className="fn">split</span>(<span className="str">&quot;\n&quot;</span>)
              {"\n"}{"  "}.<span className="fn">filter</span>(<span className="prop">line</span> ={">"} <span className="prop">line</span>.<span className="fn">trim</span>().<span className="prop">length</span> {">"} <span className="num">0</span>);
              {"\n"}
              {"\n"}<span className="kw">const</span> <span className="prop">entries</span>: <span className="type">AuditEntry[]</span> = [];
              {"\n"}<span className="kw">for</span> (<span className="kw">const</span> <span className="prop">line</span> <span className="kw">of</span> <span className="prop">lines</span>) {"{"}
              {"\n"}{"  "}<span className="kw">try</span> {"{"}
              {"\n"}{"    "}<span className="prop">entries</span>.<span className="fn">push</span>(<span className="fn">JSON.parse</span>(<span className="prop">line</span>) <span className="kw">as</span> <span className="type">AuditEntry</span>);
              {"\n"}{"  "}<span className="kw">{"}"} catch {"{"}</span>
              {"\n"}{"    "}<span className="cm">{"// 손상된 줄은 건너뜀 — 나머지 정상 처리"}</span>
              {"\n"}{"  "}{"}"}
              {"\n"}{"}"}
              {"\n"}
              {"\n"}<span className="cm">{"// 마지막 count개만 반환 (시간순 유지)"}</span>
              {"\n"}<span className="kw">if</span> (<span className="prop">entries</span>.<span className="prop">length</span> {">"} <span className="prop">count</span>) {"{"}
              {"\n"}{"  "}<span className="kw">return</span> <span className="prop">entries</span>.<span className="fn">slice</span>(-<span className="prop">count</span>);
              {"\n"}{"}"}
              {"\n"}<span className="kw">return</span> <span className="prop">entries</span>;
            </CodeBlock>
            <p className="mt-3 text-gray-600">
              핵심은 <strong>줄 단위 try/catch</strong>입니다. 하나의 손상된 줄이 전체 파싱을 실패시키지 않습니다.
              예를 들어, 프로세스가 비정상 종료되어 마지막 줄이 <code>{`{"timestamp":"2024-01-1`}</code>로
              잘린 경우, 그 줄만 건너뛰고 나머지 99줄은 정상적으로 반환합니다.
            </p>
          </DeepDive>
        </section>
      </RevealOnScroll>

      {/* ─── 5. 트러블슈팅 (Troubleshooting) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>🔧</span> 트러블슈팅
          </h2>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;audit.jsonl 파일이 계속 커져요. 어떻게 관리하나요?&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              AuditLogger에는 로그 로테이션 기능이 내장되어 있지 않습니다.
              파일이 너무 커지면 수동으로 관리해야 합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"# 현재 로그 파일 크기 확인"}</span>
              {"\n"}<span className="fn">ls</span> -lh ~/.dbcode/audit.jsonl
              {"\n"}
              {"\n"}<span className="cm">{"# 백업 후 초기화 — 새 파일은 다음 log() 호출 시 자동 생성"}</span>
              {"\n"}<span className="fn">mv</span> ~/.dbcode/audit.jsonl ~/.dbcode/audit.jsonl.bak
              {"\n"}
              {"\n"}<span className="cm">{"# 또는 최근 1000줄만 남기기"}</span>
              {"\n"}<span className="fn">tail</span> -n 1000 ~/.dbcode/audit.jsonl {">"} ~/.dbcode/audit.tmp
              {"\n"}<span className="fn">mv</span> ~/.dbcode/audit.tmp ~/.dbcode/audit.jsonl
            </CodeBlock>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;getRecentEntries()가 빈 배열을 반환해요.&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-2">
              세 가지 원인이 가능합니다:
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <strong>로그 파일이 없음:</strong>{" "}
                <code className="text-cyan-600">log()</code>를 한 번도 호출하지 않았을 수 있습니다.
                <code className="text-cyan-600">getRecentEntries()</code>는 디렉토리를 생성하지 않으므로,
                파일이 없으면 빈 배열을 반환합니다.
              </li>
              <li>
                <strong>파일 경로가 다름:</strong>{" "}
                생성자에 전달한 <code className="text-cyan-600">logPath</code>와
                실제 로그가 기록된 경로가 다를 수 있습니다.
              </li>
              <li>
                <strong>모든 줄이 손상됨:</strong>{" "}
                파일은 있지만 모든 줄이 JSON 파싱에 실패하면 빈 배열이 반환됩니다.
                파일 내용을 직접 확인해보세요.
              </li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;동시에 여러 프로세스가 같은 로그 파일에 쓸 수 있나요?&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              일반적인 감사 로그 항목(수백 바이트)은 OS 파이프 버퍼 크기(보통 4KB)보다 작으므로,
              <code className="text-cyan-600">appendFile()</code> 호출이 원자적으로 수행됩니다.
              줄이 중간에 끊기거나 섞이지 않습니다.
            </p>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              단, <code className="text-cyan-600">reason</code> 필드에 매우 긴 문자열(수 KB)을 넣으면
              원자성이 보장되지 않을 수 있습니다. reason은 간결하게 유지하세요.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;감사 로그에서 특정 항목을 삭제하고 싶어요.&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">AuditLogger</code>는 의도적으로 삭제 API를 제공하지 않습니다.
              감사 로그의 무결성을 위해 추가만 가능합니다.
              정말로 삭제가 필요하다면 파일을 직접 편집하세요 &mdash;
              각 줄이 독립적인 JSON이므로, 해당 줄만 제거하면 됩니다.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;첫 log() 호출이 느려요.&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              첫 호출에서 <code className="text-cyan-600">ensureDirectory()</code>가
              <code className="text-cyan-600">mkdir(recursive: true)</code>를 실행합니다.
              디렉토리가 이미 존재해도 OS 호출이 발생하므로 약간의 지연이 있습니다.
              두 번째 호출부터는 <code className="text-cyan-600">initialized</code> 플래그로 건너뛰어
              <code className="text-cyan-600">appendFile()</code>만 실행하므로 빠릅니다.
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
                name: "manager.ts",
                slug: "permission-manager",
                relation: "parent",
                desc: "5단계 권한 결정 트리의 모든 결정(승인, 거부, 자동 승인)을 AuditLogger.log()로 기록하는 호출자",
              },
              {
                name: "session-store.ts",
                slug: "permission-session-store",
                relation: "sibling",
                desc: "세션별 승인 캐시. 캐시 히트 시 AuditLogger에 \"auto-approved\" 결정이 기록됨",
              },
              {
                name: "persistent-store.ts",
                slug: "permission-persistent-store",
                relation: "sibling",
                desc: "settings.json 영구 권한 규칙. 규칙 매칭 시 AuditLogger에 결정과 이유가 기록됨",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
