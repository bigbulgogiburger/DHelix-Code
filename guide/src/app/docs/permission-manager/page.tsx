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

export default function PermissionManagerPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <div className="flex items-center gap-3 mb-4">
              <FilePath path="src/permissions/manager.ts" />
              <LayerBadge layer="infra" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mb-4 text-gray-900">
              PermissionManager
            </h1>
            <p className="text-[16px] text-gray-600 max-w-[700px]">
              AI가 도구를 실행하기 전, 사용자에게 허가를 받을지 여부를 결정하는{" "}
              <strong className="text-gray-900">중앙 권한 오케스트레이터</strong>입니다. 5단계
              계층적 검사와 deny-first 원칙으로 안전성을 보장합니다.
            </p>
          </div>
        </RevealOnScroll>

        {/* ─── 1. 개요 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-2"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>&#128208;</span> 개요
            </h2>

            <p className="text-[14px] text-gray-600 leading-relaxed mb-6">
              권한 관리자(PermissionManager)는 dbcode의{" "}
              <strong className="text-gray-900">보안 게이트키퍼</strong>입니다. AI 에이전트가 파일
              수정, 쉘 명령어 실행 등 도구를 호출할 때마다 이 모듈이 &ldquo;이 작업을 허용해도
              되는가?&rdquo;를 판단합니다.
            </p>

            <p className="text-[14px] text-gray-600 leading-relaxed mb-6">
              핵심 설계 원칙은 <strong className="text-red-600">deny-by-default</strong>(기본
              거부)입니다. 어떤 규칙에도 매칭되지 않으면 사용자에게 직접 확인을 요청합니다. 이는
              &ldquo;허용되지 않은 것은 금지&rdquo;라는 최소 권한 원칙(Principle of Least
              Privilege)을 따릅니다.
            </p>

            <Callout type="info" icon="&#128161;">
              <strong>왜 deny-first인가?</strong>
              <br />
              AI가 예상치 못한 도구를 호출하더라도, 명시적으로 허용되지 않은 작업은 자동으로
              차단됩니다. 실수로 위험한 명령이 실행되는 것을 원천적으로 방지하는 안전 장치입니다.
            </Callout>

            <MermaidDiagram
              title="5단계 권한 결정 트리"
              titleColor="green"
              chart={`flowchart TD
    START["check(toolName, level, args)<br/><small>권한 검사 시작</small>"] --> DENY{"1. 영구 deny 규칙<br/><small>차단 목록 매칭 확인</small>"}
    DENY -->|"Yes"| BLOCKED["거부 (즉시)<br/><small>작업 차단됨</small>"]
    DENY -->|"No"| SESSION{"2. 세션 승인<br/><small>캐시에서 승인 확인</small>"}
    SESSION -->|"Yes"| AUTO_ALLOW["자동 허용<br/><small>추가 확인 없이 통과</small>"]
    SESSION -->|"No"| ALLOW{"3. 영구 allow 규칙<br/><small>허용 목록 매칭 확인</small>"}
    ALLOW -->|"Yes"| AUTO_ALLOW
    ALLOW -->|"No"| EXPLICIT{"4. 명시적 규칙<br/><small>코드 등록 규칙 확인</small>"}
    EXPLICIT -->|"Yes (allowed)"| AUTO_ALLOW
    EXPLICIT -->|"Yes (denied)"| BLOCKED
    EXPLICIT -->|"No"| MODE{"5. 모드 기반 검사<br/><small>최종 폴백 판단</small>"}
    MODE -->|"safe + default"| AUTO_ALLOW
    MODE -->|"confirm/dangerous + default"| PROMPT["사용자 확인 요청<br/><small>UI에서 승인 대기</small>"]
    MODE -->|"plan + confirm/dangerous"| BLOCKED

    style START fill:#dbeafe,stroke:#3b82f6,color:#1e293b
    style BLOCKED fill:#fee2e2,stroke:#ef4444,color:#991b1b
    style AUTO_ALLOW fill:#dcfce7,stroke:#10b981,color:#065f46
    style PROMPT fill:#fef3c7,stroke:#f59e0b,color:#92400e`}
            />
          </section>
        </RevealOnScroll>

        {/* ─── 2. 레퍼런스 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-2"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>&#128218;</span> 레퍼런스
            </h2>

            {/* PermissionMode 타입 */}
            <h3
              className="text-lg font-bold text-cyan-600"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              PermissionMode 타입
            </h3>
            <p className="text-[13px] text-gray-600 mb-4">
              권한 검사의 동작 방식을 결정하는 5가지 모드입니다.{" "}
              <code className="text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded text-xs">
                types.ts
              </code>
              에서 정의됩니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "default",
                  type: "string",
                  required: false,
                  desc: "기본 모드 -- 읽기 전용 자동 허용, 수정/실행은 사용자 확인 필요",
                },
                {
                  name: "acceptEdits",
                  type: "string",
                  required: false,
                  desc: "편집 허용 -- 파일 수정 자동 허용, 위험한 명령만 사용자 확인",
                },
                {
                  name: "plan",
                  type: "string",
                  required: false,
                  desc: "계획 모드 -- 읽기 전용 도구만 허용, 모든 수정/실행 차단",
                },
                {
                  name: "dontAsk",
                  type: "string",
                  required: false,
                  desc: "자동 승인 -- 모든 작업 확인 없이 허용 (주의 필요)",
                },
                {
                  name: "bypassPermissions",
                  type: "string",
                  required: false,
                  desc: "우회 모드 -- 모든 권한 검사 건너뜀 (개발/테스트 전용)",
                },
              ]}
            />

            {/* PermissionCheckResult 인터페이스 */}
            <h3
              className="text-lg font-bold text-cyan-600"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              PermissionCheckResult 인터페이스
            </h3>
            <p className="text-[13px] text-gray-600 mb-4">
              <code className="text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded text-xs">
                check()
              </code>{" "}
              메서드의 반환값입니다. 허용 여부와 함께 사용자에게 프롬프트를 보여야 하는지도
              알려줍니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "allowed",
                  type: "boolean",
                  required: true,
                  desc: "작업 허용 여부 (true = 실행 가능)",
                },
                {
                  name: "requiresPrompt",
                  type: "boolean",
                  required: true,
                  desc: "사용자에게 확인 프롬프트를 표시해야 하는지 여부",
                },
                {
                  name: "reason",
                  type: "string",
                  required: false,
                  desc: "결정 이유 (로깅 및 UI 표시용, 예: 'Session approved')",
                },
              ]}
            />

            {/* PersistentPermissionRule 인터페이스 */}
            <h3
              className="text-lg font-bold text-cyan-600"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              PersistentPermissionRule 인터페이스
            </h3>
            <p className="text-[13px] text-gray-600 mb-4">
              세션 간에 유지되는 영구 권한 규칙입니다.{" "}
              <code className="text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded text-xs">
                settings.json
              </code>
              에 저장되어 앱을 재시작해도 유지됩니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "tool",
                  type: "string",
                  required: true,
                  desc: "대상 도구 이름 (예: 'Bash', 'Edit')",
                },
                {
                  name: "pattern",
                  type: "string",
                  required: false,
                  desc: "인수 패턴 (예: 'npm *'는 npm으로 시작하는 명령만 매칭)",
                },
                {
                  name: "type",
                  type: "'allow' | 'deny'",
                  required: true,
                  desc: "'allow' = 항상 허용, 'deny' = 항상 거부",
                },
                {
                  name: "scope",
                  type: "'project' | 'user'",
                  required: true,
                  desc: "'project' = 프로젝트 단위, 'user' = 사용자 전체",
                },
              ]}
            />

            {/* PermissionManager 클래스 */}
            <h3
              className="text-lg font-bold text-cyan-600"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              PermissionManager 클래스
            </h3>
            <p className="text-[13px] text-gray-600 mb-4">
              권한 시스템의 핵심 클래스입니다. 모드, 규칙, 세션 승인, 영구 규칙을 조합하여 계층적
              권한 검사를 수행합니다.
            </p>

            {/* constructor */}
            <h4 className="text-sm font-bold text-violet-600 mb-2 mt-6">
              constructor(mode?, rules?, persistentRules?, options?)
            </h4>
            <ParamTable
              params={[
                {
                  name: "mode",
                  type: "PermissionMode",
                  required: false,
                  desc: "초기 권한 모드 (기본값: 'default')",
                },
                {
                  name: "rules",
                  type: "readonly PermissionRule[]",
                  required: false,
                  desc: "초기 명시적 규칙 배열",
                },
                {
                  name: "persistentRules",
                  type: "{ allow?: string[]; deny?: string[] }",
                  required: false,
                  desc: "초기 영구 규칙 (allow/deny 문자열 배열)",
                },
                {
                  name: "options.auditLogPath",
                  type: "string",
                  required: false,
                  desc: "감사 로그 파일 경로 (지정 시 JSONL 감사 로그 활성화)",
                },
                {
                  name: "options.sessionId",
                  type: "string",
                  required: false,
                  desc: "현재 세션 고유 ID (감사 로그 그룹핑용, 기본값: 'unknown')",
                },
              ]}
            />

            {/* check() */}
            <h4 className="text-sm font-bold text-violet-600 mb-2 mt-6">
              check(toolName, permissionLevel, args?): PermissionCheckResult
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              <strong className="text-gray-900">핵심 메서드</strong> -- 도구 실행의 허용 여부를
              5단계 계층 검사로 결정합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "toolName",
                  type: "string",
                  required: true,
                  desc: "실행하려는 도구 이름 (예: 'Bash', 'Edit')",
                },
                {
                  name: "permissionLevel",
                  type: "PermissionLevel",
                  required: true,
                  desc: "도구의 권한 수준 ('safe' | 'confirm' | 'dangerous')",
                },
                {
                  name: "args",
                  type: "Record<string, unknown>",
                  required: false,
                  desc: "도구에 전달될 인수 (패턴 매칭에 사용)",
                },
              ]}
            />

            {/* approve() / approveAll() */}
            <h4 className="text-sm font-bold text-violet-600 mb-2 mt-6">
              approve(toolName, args?) / approveAll(toolName)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">approve()</code>는 특정 도구+인수 조합을 세션
              내 승인합니다.
              <code className="text-cyan-600 text-xs ml-1">approveAll()</code>은 해당 도구의{" "}
              <strong className="text-gray-900">모든</strong> 호출을 세션 내 승인합니다.
            </p>

            {/* approveAlways() */}
            <h4 className="text-sm font-bold text-violet-600 mb-2 mt-6">
              approveAlways(toolName, pattern?, scope?)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              영구 allow 규칙을 추가합니다. 메모리 내 규칙 목록에만 추가되므로, 디스크에
              영속화하려면 별도로{" "}
              <code className="text-cyan-600 text-xs">PersistentPermissionStore</code>를 통해
              저장해야 합니다.
            </p>
            <ParamTable
              params={[
                { name: "toolName", type: "string", required: true, desc: "항상 허용할 도구 이름" },
                {
                  name: "pattern",
                  type: "string",
                  required: false,
                  desc: "인수 패턴 (예: 'npm *')",
                },
                {
                  name: "scope",
                  type: "'project' | 'user'",
                  required: false,
                  desc: "저장 범위 (기본값: 'project')",
                },
              ]}
            />

            {/* setMode() / getMode() */}
            <h4 className="text-sm font-bold text-violet-600 mb-2 mt-6">
              setMode(mode) / getMode()
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              현재 권한 모드를 변경하거나 조회합니다. 모드 변경은 이후의 모든{" "}
              <code className="text-cyan-600 text-xs">check()</code> 호출에 즉시 반영됩니다.
            </p>

            {/* setPersistentRules() / getPersistentRules() */}
            <h4 className="text-sm font-bold text-violet-600 mb-2 mt-6">
              setPersistentRules(rules) / getPersistentRules()
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              디스크에서 로드한 영구 규칙을 설정하거나 현재 설정된 영구 규칙을 조회합니다. 규칙은
              allow/deny로 분리되어 파싱되며, deny가 먼저 검사됩니다.
            </p>

            {/* addRule() */}
            <h4 className="text-sm font-bold text-violet-600 mb-2 mt-6">
              addRule(rule: PermissionRule)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              프로그래밍적으로 명시적 권한 규칙을 추가합니다. 이 규칙은 4단계 &ldquo;명시적
              규칙&rdquo; 검사에서 평가됩니다.
            </p>

            {/* clearSession() */}
            <h4 className="text-sm font-bold text-violet-600 mb-2 mt-6">clearSession()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              세션 승인 캐시를 초기화합니다. 이전에 승인된 모든 세션 승인이 취소되며, 모드 전환이나
              보안 재설정 시 사용합니다.
            </p>

            {/* Caveats */}
            <h3
              className="text-lg font-bold text-amber-600"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              Caveats
            </h3>

            <Callout type="warn" icon="&#9888;&#65039;">
              <strong>Caveat 1: approveAlways()는 메모리만 변경합니다</strong>
              <br />
              <code className="text-cyan-600 text-xs">approveAlways()</code>는 내부 규칙 목록에만
              추가합니다. 앱을 재시작하면 사라집니다. 영구 저장을 원한다면 호출자가{" "}
              <code className="text-cyan-600 text-xs">PersistentPermissionStore</code>를 통해 별도로
              디스크에 저장해야 합니다.
            </Callout>

            <Callout type="warn" icon="&#9888;&#65039;">
              <strong>Caveat 2: 잘못된 패턴은 조용히 무시됩니다</strong>
              <br />
              <code className="text-cyan-600 text-xs">parsePersistentRules()</code>는 파싱에 실패한
              패턴을 건너뛰는 graceful degradation 방식을 사용합니다. 규칙이 적용되지 않는다면 패턴
              문자열 형식을 먼저 확인하세요. 오류 로그는 남지 않습니다.
            </Callout>

            <Callout type="warn" icon="&#9888;&#65039;">
              <strong>Caveat 3: 감사 로그는 fire-and-forget입니다</strong>
              <br />
              <code className="text-cyan-600 text-xs">logAudit()</code>는 비동기로 로그를 기록하지만
              완료를 기다리지 않습니다. 로그 기록 실패는{" "}
              <code className="text-cyan-600 text-xs">.catch()</code>로 조용히 삼켜집니다. 따라서
              감사 로그에 누락이 있을 수 있으며, 이는 권한 검사 성능을 보장하기 위한 의도적인
              트레이드오프입니다.
            </Callout>

            <Callout type="danger" icon="&#128683;">
              <strong>Caveat 4: bypassPermissions 모드는 프로덕션에서 사용 금지</strong>
              <br />이 모드는 모든 권한 검사를 완전히 건너뜁니다. 개발/테스트 환경에서만 사용해야
              하며, 프로덕션에서 활성화하면 AI가 어떤 도구든 제한 없이 실행할 수 있어 심각한 보안
              위험이 됩니다.
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ─── 3. 사용법 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-2"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>&#128736;&#65039;</span> 사용법
            </h2>

            {/* 기본 사용 */}
            <h3
              className="text-lg font-bold text-cyan-600"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              기본 권한 검사 흐름
            </h3>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-4">
              Agent Loop에서 도구를 실행하기 전에{" "}
              <code className="text-cyan-600 text-xs">check()</code>를 호출합니다. 결과에 따라 즉시
              실행하거나, 사용자에게 확인 프롬프트를 보여주거나, 실행을 차단합니다.
            </p>
            <CodeBlock>{`// 1. PermissionManager 생성
const pm = new PermissionManager("default", [], {
  allow: ["Bash(npm *)"],
  deny:  ["Bash(rm -rf *)"],
}, {
  auditLogPath: "~/.dbcode/audit.jsonl",
  sessionId: crypto.randomUUID(),
});

// 2. 도구 실행 전 권한 검사
const result = pm.check("Bash", "dangerous", { command: "npm install" });

if (result.allowed) {
  // 자동 허용됨 -- 도구 실행
  executeTool("Bash", { command: "npm install" });
} else if (result.requiresPrompt) {
  // 사용자 확인 필요 -- UI에 프롬프트 표시
  const userApproved = await showPermissionPrompt("Bash", args);
  if (userApproved) {
    pm.approve("Bash", { command: "npm install" }); // 세션 캐시
    executeTool("Bash", { command: "npm install" });
  }
} else {
  // 완전 차단 -- 실행 불가
  console.log(result.reason); // "Persistent deny rule"
}`}</CodeBlock>

            {/* 5가지 모드 설명 */}
            <h3
              className="text-lg font-bold text-cyan-600"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              5가지 권한 모드
            </h3>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-4">
              각 모드는 도구의 <code className="text-violet-600 text-xs">PermissionLevel</code>
              (safe/confirm/dangerous)에 따라 다르게 동작합니다.
            </p>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden my-4">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr>
                    <th className="p-3 px-4 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                      모드
                    </th>
                    <th className="p-3 px-4 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                      safe (읽기)
                    </th>
                    <th className="p-3 px-4 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                      confirm (수정)
                    </th>
                    <th className="p-3 px-4 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                      dangerous (위험)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      mode: "default",
                      safe: "auto",
                      confirm: "prompt",
                      dangerous: "prompt",
                      desc: "기본값. 가장 안전한 일반 사용 모드",
                    },
                    {
                      mode: "acceptEdits",
                      safe: "auto",
                      confirm: "auto",
                      dangerous: "prompt",
                      desc: "파일 편집은 신뢰, 쉘 명령만 확인",
                    },
                    {
                      mode: "plan",
                      safe: "auto",
                      confirm: "block",
                      dangerous: "block",
                      desc: "분석만 하고 변경 없이 계획 수립",
                    },
                    {
                      mode: "dontAsk",
                      safe: "auto",
                      confirm: "auto",
                      dangerous: "auto",
                      desc: "모든 작업 자동 승인 (주의)",
                    },
                    {
                      mode: "bypassPermissions",
                      safe: "auto",
                      confirm: "auto",
                      dangerous: "auto",
                      desc: "모든 검사 건너뜀 (개발 전용)",
                    },
                  ].map((row) => (
                    <tr key={row.mode} className="hover:bg-blue-50 border-b border-gray-200">
                      <td className="p-3 px-4 font-mono text-cyan-600 font-semibold">{row.mode}</td>
                      <td className="p-3 px-4 text-center">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                          {row.safe === "auto" ? "Auto" : row.safe}
                        </span>
                      </td>
                      <td className="p-3 px-4 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            row.confirm === "auto"
                              ? "bg-emerald-50 text-emerald-600"
                              : row.confirm === "prompt"
                                ? "bg-amber-50 text-amber-600"
                                : "bg-red-50 text-red-600"
                          }`}
                        >
                          {row.confirm === "auto"
                            ? "Auto"
                            : row.confirm === "prompt"
                              ? "Prompt"
                              : "Block"}
                        </span>
                      </td>
                      <td className="p-3 px-4 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            row.dangerous === "auto"
                              ? "bg-emerald-50 text-emerald-600"
                              : row.dangerous === "prompt"
                                ? "bg-amber-50 text-amber-600"
                                : "bg-red-50 text-red-600"
                          }`}
                        >
                          {row.dangerous === "auto"
                            ? "Auto"
                            : row.dangerous === "prompt"
                              ? "Prompt"
                              : "Block"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Callout type="tip" icon="&#128161;">
              모드 전환은 <code className="text-cyan-600 text-xs">Shift+Tab</code> 키보드 단축키로
              할 수 있습니다.
              <code className="text-cyan-600 text-xs ml-1">
                pm.setMode(&quot;acceptEdits&quot;)
              </code>
              를 호출하면 즉시 반영됩니다.
            </Callout>

            {/* 패턴 매칭 */}
            <h3
              className="text-lg font-bold text-cyan-600"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              패턴 매칭 규칙
            </h3>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-4">
              영구 규칙과 명시적 규칙은 <strong className="text-gray-900">glob 패턴</strong>을
              사용하여 도구 이름과 인수를 매칭합니다. 패턴 형식은{" "}
              <code className="text-violet-600 text-xs bg-violet-50 px-1.5 py-0.5 rounded">
                도구이름(인수패턴)
              </code>
              입니다.
            </p>
            <CodeBlock>{`// 패턴 형식 예시:
"Bash"              // Bash 도구의 모든 호출에 매칭
"Bash(npm *)"       // "npm"으로 시작하는 Bash 명령만 매칭
"Edit(/src/**)"     // /src/ 하위 경로의 파일 편집만 매칭
"file_read"         // file_read 도구의 모든 호출에 매칭

// glob 규칙:
// *  -> 임의의 문자열 (경로 구분자 포함)
// ?  -> 임의의 한 문자

// settings.json 설정 예시:
{
  "permissions": {
    "allow": [
      "Bash(npm *)",           // npm 명령어는 항상 허용
      "Bash(git status)",      // git status는 항상 허용
      "Edit(/src/**)"          // src 하위 편집은 항상 허용
    ],
    "deny": [
      "Bash(rm -rf *)",        // rm -rf는 항상 차단
      "Bash(sudo *)",          // sudo 명령은 항상 차단
      "Bash(curl * | sh)"      // 파이프 실행 차단
    ]
  }
}`}</CodeBlock>

            <Callout type="info" icon="&#128270;">
              패턴 매칭은 도구 인수의 <strong>문자열 값</strong>에 대해 수행됩니다. 예를 들어{" "}
              <code className="text-cyan-600 text-xs">Bash(npm *)</code> 패턴은 인수 중{" "}
              <code className="text-cyan-600 text-xs">{`{ command: "npm install" }`}</code>처럼
              &ldquo;npm&rdquo;으로 시작하는 문자열 값이 있는지 확인합니다.
            </Callout>

            {/* Deep Dive: 감사 로깅 */}
            <DeepDive title="감사 로그 (Audit Log) 시스템">
              <p className="mb-3">
                PermissionManager는 모든 권한 결정을 JSONL(JSON Lines) 형식의 감사 로그에
                기록합니다. 각 줄이 독립적인 JSON 객체이므로, 파일 일부가 손상되어도 다른 줄에
                영향을 주지 않습니다.
              </p>

              <p className="mb-3">
                <strong className="text-gray-900">기록 방식: fire-and-forget</strong>
                <br />
                로그 기록은 비동기적으로 수행되지만 완료를 기다리지 않습니다. 이는 권한 검사 성능을
                보장하기 위한 의도적인 설계입니다.
              </p>

              <CodeBlock>{`// 감사 로그 파일 예시 (~/.dbcode/audit.jsonl):
{"timestamp":"2024-01-15T10:30:00Z","sessionId":"abc-123","toolName":"Bash","decision":"auto-approved","reason":"Session approved"}
{"timestamp":"2024-01-15T10:30:05Z","sessionId":"abc-123","toolName":"Bash","decision":"denied","reason":"Persistent deny rule"}
{"timestamp":"2024-01-15T10:30:10Z","sessionId":"abc-123","toolName":"Edit","decision":"auto-approved","reason":"Persistent allow rule"}`}</CodeBlock>

              <p className="mt-3">
                <strong className="text-gray-900">AuditEntry 인터페이스:</strong>
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>
                  <code className="text-cyan-600 text-xs">timestamp</code> -- ISO 8601 형식
                </li>
                <li>
                  <code className="text-cyan-600 text-xs">sessionId</code> -- 세션별 그룹핑용 고유
                  ID
                </li>
                <li>
                  <code className="text-cyan-600 text-xs">toolName</code> -- 검사 대상 도구 이름
                </li>
                <li>
                  <code className="text-cyan-600 text-xs">decision</code> --{" "}
                  <code className="text-xs">
                    &quot;approved&quot; | &quot;denied&quot; | &quot;auto-approved&quot;
                  </code>
                </li>
                <li>
                  <code className="text-cyan-600 text-xs">reason</code> -- 결정 이유 (선택적)
                </li>
              </ul>

              <p className="mt-3 text-gray-400 text-[12px]">
                로그 파일은 append-only(추가 전용)로 무결성이 보장됩니다.
                <code className="text-cyan-600 text-xs ml-1">AuditLogger.getRecentEntries(50)</code>
                으로 최근 항목을 조회할 수 있습니다.
              </p>
            </DeepDive>
          </section>
        </RevealOnScroll>

        {/* ─── 4. 내부 구현 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-2"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>&#9881;&#65039;</span> 내부 구현
            </h2>

            <p className="text-[13px] text-gray-600 leading-relaxed mb-6">
              PermissionManager의 <code className="text-cyan-600 text-xs">check()</code> 메서드는
              5단계 계층적 검사를 순차적으로 수행합니다. 각 단계에서 결론이 나면 즉시 반환하여
              불필요한 검사를 건너뜁니다(단락 평가).
            </p>

            <MermaidDiagram
              title="check() 메서드 내부 플로우"
              titleColor="cyan"
              chart={`flowchart LR
    subgraph Step1["1단계: Deny"]
        D1["matchesPersistent<br/><small>영구 거부 규칙 매칭</small>"]
    end
    subgraph Step2["2단계: Session"]
        D2["sessionStore.isApproved<br/><small>세션 승인 캐시 조회</small>"]
    end
    subgraph Step3["3단계: Allow"]
        D3["matchesPersistent<br/><small>영구 허용 규칙 매칭</small>"]
    end
    subgraph Step4["4단계: Explicit"]
        D4["findMatchingRule<br/><small>명시적 규칙 검색</small>"]
    end
    subgraph Step5["5단계: Mode"]
        D5["checkPermissionByMode<br/><small>모드별 최종 판단</small>"]
    end

    D1 -->|"No match"| D2
    D2 -->|"Not approved"| D3
    D3 -->|"No match"| D4
    D4 -->|"No match"| D5

    style Step1 fill:#fee2e2,stroke:#ef4444,color:#991b1b
    style Step2 fill:#dbeafe,stroke:#3b82f6,color:#1e40af
    style Step3 fill:#dcfce7,stroke:#10b981,color:#065f46
    style Step4 fill:#fef9c3,stroke:#f59e0b,color:#92400e
    style Step5 fill:#ede9fe,stroke:#8b5cf6,color:#5b21b6`}
            />

            <h3
              className="text-lg font-bold text-cyan-600"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              check() 핵심 코드
            </h3>
            <CodeBlock>{`check(
  toolName: string,
  permissionLevel: PermissionLevel,
  args?: Readonly<Record<string, unknown>>,
): PermissionCheckResult {
  // 1단계: 영구 deny 규칙 -- deny는 항상 최우선
  if (this.matchesPersistent(this.persistentDenyRules, toolName, args)) {
    this.logAudit(toolName, "denied", "Persistent deny rule");
    return { allowed: false, requiresPrompt: false, reason: "Persistent deny rule" };
  }

  // 2단계: 세션 승인 확인 -- 이미 승인된 도구는 다시 묻지 않음
  if (this.sessionStore.isApproved(toolName, args)) {
    this.logAudit(toolName, "auto-approved", "Session approved");
    return { allowed: true, requiresPrompt: false, reason: "Session approved" };
  }

  // 3단계: 영구 allow 규칙 -- "항상 허용"으로 설정된 도구
  if (this.matchesPersistent(this.persistentAllowRules, toolName, args)) {
    this.logAudit(toolName, "auto-approved", "Persistent allow rule");
    return { allowed: true, requiresPrompt: false, reason: "Persistent allow rule" };
  }

  // 4단계: 명시적 규칙 -- 코드에서 등록된 규칙
  const matchedRule = findMatchingRule(this.rules, toolName, args);
  if (matchedRule) {
    return {
      allowed: matchedRule.allowed,
      requiresPrompt: false,
      reason: matchedRule.allowed ? "Rule: allowed" : "Rule: denied",
    };
  }

  // 5단계: 모드 기반 검사 -- 최종 폴백
  return checkPermissionByMode(this.mode, permissionLevel);
}`}</CodeBlock>

            <h3
              className="text-lg font-bold text-cyan-600"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              영구 규칙 파싱 흐름
            </h3>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-4">
              영구 규칙 문자열은{" "}
              <code className="text-cyan-600 text-xs">parsePersistentRules()</code>에 의해 파싱되어
              빠른 매칭을 위한 <code className="text-cyan-600 text-xs">PersistentRule</code>{" "}
              구조체로 변환됩니다.
            </p>
            <CodeBlock>{`// 원본 문자열 -> 파싱된 구조체 변환 과정:
"Bash(npm *)"
  -> parsePermissionPattern("Bash(npm *)")
  -> { toolName: "Bash", argPattern: "npm *" }
  -> PersistentRule { raw: "Bash(npm *)", parsed: { toolName: "Bash", argPattern: "npm *" } }

// matchesPersistent() 내부:
// 1. toolName을 glob -> regex 변환: "Bash" -> /^Bash$/
// 2. argPattern을 glob -> regex 변환: "npm *" -> /^npm .*$/
// 3. 인수의 문자열 값 중 하나라도 매칭되면 true`}</CodeBlock>

            <Callout type="tip" icon="&#128640;">
              <strong>성능 최적화 포인트</strong>
              <br />
              <code className="text-cyan-600 text-xs">matchesPersistent()</code>는{" "}
              <code className="text-cyan-600 text-xs">Array.some()</code>을 사용합니다. 첫 번째
              매칭에서 즉시 반환(단락 평가)하므로, 규칙이 많아도 불필요한 매칭을 건너뜁니다. 또한
              규칙은 생성 시점에 미리 파싱되어{" "}
              <code className="text-cyan-600 text-xs">Object.freeze()</code>로 불변 처리됩니다.
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ─── 5. 트러블슈팅 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-2"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>&#128533;</span> 트러블슈팅
            </h2>

            {/* FAQ 1 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-2">
                Q1. 도구가 예상치 못하게 차단됩니다
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <strong className="text-gray-900">원인:</strong> deny 규칙이 의도치 않게 넓은 범위를
                매칭하고 있을 수 있습니다. deny는 항상 최우선이므로, allow 규칙보다 먼저 평가됩니다.
              </p>
              <p className="text-[13px] text-gray-600 leading-relaxed mt-2">
                <strong className="text-gray-900">해결:</strong>{" "}
                <code className="text-cyan-600 text-xs">settings.json</code>의 deny 목록을
                확인하세요.
                <code className="text-cyan-600 text-xs ml-1">Bash(*)</code>처럼 와일드카드가 너무
                넓으면
                <code className="text-cyan-600 text-xs ml-1">Bash(rm *)</code>처럼 구체적으로
                좁히세요. 감사 로그(
                <code className="text-cyan-600 text-xs">~/.dbcode/audit.jsonl</code>)에서{" "}
                <code className="text-cyan-600 text-xs">&quot;Persistent deny rule&quot;</code>을
                검색하면 원인을 찾을 수 있습니다.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-2">
                Q2. allow 규칙을 추가했는데 적용되지 않습니다
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <strong className="text-gray-900">원인 1:</strong> 패턴 형식이 잘못되어 파싱에
                실패했을 수 있습니다.
                <code className="text-cyan-600 text-xs">parsePersistentRules()</code>는 잘못된
                패턴을 조용히 건너뜁니다.
              </p>
              <p className="text-[13px] text-gray-600 leading-relaxed mt-2">
                <strong className="text-gray-900">원인 2:</strong> 같은 도구에 대한 deny 규칙이
                있으면 deny가 우선합니다. deny 규칙(1단계)은 allow 규칙(3단계)보다 먼저 평가됩니다.
              </p>
              <p className="text-[13px] text-gray-600 leading-relaxed mt-2">
                <strong className="text-gray-900">해결:</strong> 패턴 형식을 확인하세요:{" "}
                <code className="text-cyan-600 text-xs">Bash(npm *)</code>처럼
                <code className="text-cyan-600 text-xs ml-1">도구이름(패턴)</code> 형식이어야
                합니다. 괄호가 없으면 도구의 모든 호출에 매칭됩니다. 빈 괄호{" "}
                <code className="text-cyan-600 text-xs">Bash()</code>는 에러입니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-2">
                Q3. 세션 승인과 영구 승인의 차이는 무엇인가요?
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <strong className="text-blue-600">세션 승인</strong>: 현재 실행 동안만 유지됩니다.{" "}
                <code className="text-cyan-600 text-xs">approve()</code> /{" "}
                <code className="text-cyan-600 text-xs">approveAll()</code>로 설정하며, 앱을
                종료하면 사라집니다.{" "}
                <code className="text-cyan-600 text-xs">SessionApprovalStore</code>의{" "}
                <code className="text-cyan-600 text-xs">save()/load()</code>를 사용하면 디스크에
                영속화할 수도 있지만 기본적으로는 메모리 전용입니다.
              </p>
              <p className="text-[13px] text-gray-600 leading-relaxed mt-2">
                <strong className="text-emerald-600">영구 승인</strong>:{" "}
                <code className="text-cyan-600 text-xs">settings.json</code>에 저장되어 세션 간에
                유지됩니다.
                <code className="text-cyan-600 text-xs ml-1">approveAlways()</code>로 메모리에
                추가한 뒤,
                <code className="text-cyan-600 text-xs ml-1">PersistentPermissionStore</code>로
                디스크에 저장해야 합니다.
              </p>
              <p className="text-[13px] text-gray-600 leading-relaxed mt-2">
                <strong className="text-gray-900">검사 순서:</strong> 세션 승인(2단계)이 영구
                allow(3단계)보다 먼저 검사됩니다. 이는 같은 세션에서 이미 승인한 도구를 빠르게
                처리하기 위한 최적화입니다.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-2">
                Q4. 모드를 변경했는데 이전에 승인한 것이 계속 작동합니다
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <strong className="text-gray-900">원인:</strong> 세션 승인 캐시(2단계)는 모드 변경과
                독립적으로 유지됩니다. 이미 세션에서 승인된 도구는 모드가 변경되어도 2단계에서 자동
                허용됩니다.
              </p>
              <p className="text-[13px] text-gray-600 leading-relaxed mt-2">
                <strong className="text-gray-900">해결:</strong> 모드 변경 시{" "}
                <code className="text-cyan-600 text-xs">clearSession()</code>을 호출하여 세션 승인
                캐시를 초기화하세요. 이렇게 하면 이전에 승인된 모든 세션 승인이 취소되고, 새 모드의
                규칙에 따라 다시 권한 검사가 수행됩니다.
              </p>
              <CodeBlock>{`// 모드 변경 시 세션 캐시 초기화 패턴:
pm.setMode("plan");
pm.clearSession(); // 이전 승인 모두 취소`}</CodeBlock>
            </div>
          </section>
        </RevealOnScroll>

        {/* ─── 6. 관련 문서 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-2"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>&#128279;</span> 관련 문서
            </h2>
            <SeeAlso
              items={[
                {
                  name: "agent-loop.ts",
                  slug: "agent-loop",
                  relation: "parent",
                  desc: "Agent Loop에서 도구 실행 전 PermissionManager.check()를 호출합니다",
                },
                {
                  name: "audit-log.ts",
                  slug: "audit-log",
                  relation: "child",
                  desc: "JSONL 형식의 추가 전용 감사 로거 -- 모든 권한 결정을 기록합니다",
                },
                {
                  name: "tools/executor.ts",
                  slug: "tool-executor",
                  relation: "sibling",
                  desc: "도구 실행 파이프라인 -- 권한 검사 통과 후 실제 도구를 실행합니다",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
