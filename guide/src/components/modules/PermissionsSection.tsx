"use client";

import { SectionHeader } from "../SectionHeader";
import { FilePath } from "../FilePath";
import { MermaidDiagram } from "../MermaidDiagram";
import { Callout } from "../Callout";
import { ImplDirection } from "../ImplDirection";
import { RevealOnScroll } from "../RevealOnScroll";

const decisionTreeChart = `graph TD
    START["도구 호출 요청<br/><small>LLM이 tool_call을 반환</small>"] --> DENY_RULES{"1. Permanent Deny?<br/><small>settings.json의 deny 패턴 매칭</small>"}
    DENY_RULES -->|"매칭"| DENIED["DENY<br/><small>사용자에게 거부 사유 표시</small>"]
    DENY_RULES -->|"미매칭"| SESSION{"2. Session Approved?<br/><small>이번 세션에서 이미 허용된 도구인지</small>"}
    SESSION -->|"있음"| ALLOWED["ALLOW<br/><small>도구 실행 진행</small>"]
    SESSION -->|"없음"| ALLOW_RULES{"3. Permanent Allow?<br/><small>settings.json의 allow 패턴 매칭</small>"}
    ALLOW_RULES -->|"매칭"| ALLOWED
    ALLOW_RULES -->|"미매칭"| EXPLICIT{"4. Explicit Rules?<br/><small>도구별 항상 허용 설정 확인</small>"}
    EXPLICIT -->|"허용"| ALLOWED
    EXPLICIT -->|"없음"| MODE{"5. Permission Mode?<br/><small>plan/auto/default/bypassPermissions</small>"}
    MODE -->|"bypassPermissions"| ALLOWED
    MODE -->|"dontAsk"| ONCE["1회 확인 후 세션 기억<br/><small>이번 한 번만 허용</small>"]
    MODE -->|"acceptEdits"| EDIT_CHECK{"파일 수정?<br/><small>Write/Edit 도구인지 확인</small>"}
    MODE -->|"plan"| READ_CHECK{"읽기 전용?<br/><small>Read/Grep/Glob인지 확인</small>"}
    MODE -->|"default"| ASK["사용자에게 매번 확인<br/><small>터미널에 허용/거부 프롬프트 표시</small>"]
    EDIT_CHECK -->|"Yes"| ALLOWED
    EDIT_CHECK -->|"No"| ASK
    READ_CHECK -->|"Yes"| ALLOWED
    READ_CHECK -->|"No"| ASK
    ONCE --> ALLOWED
    ASK --> USER_DECIDE{"사용자 응답<br/><small>y/n/always 선택</small>"}
    USER_DECIDE -->|"허용"| RECORD["세션에 기록 ALLOW<br/><small>always → 이후 같은 도구 자동 허용</small>"]
    USER_DECIDE -->|"거부"| DENIED
    style START fill:#fef3c7,stroke:#f59e0b,color:#1e293b
    style DENIED fill:#fee2e2,stroke:#ef4444,color:#1e293b
    style ALLOWED fill:#dcfce7,stroke:#10b981,color:#1e293b
    style ASK fill:#e0e7ff,stroke:#3b82f6,color:#1e293b`;

const modes = [
  {
    name: "default",
    desc: "매번 사용자에게 확인을 요청합니다. 가장 안전한 모드.",
    color: "border-l-amber-600",
  },
  {
    name: "acceptEdits",
    desc: "파일 읽기/쓰기/수정을 자동 승인. bash 명령은 여전히 확인 필요.",
    color: "border-l-blue-600",
  },
  {
    name: "plan",
    desc: "읽기 전용 도구만 자동 승인. 쓰기 작업은 모두 확인 필요.",
    color: "border-l-violet-600",
  },
  {
    name: "dontAsk",
    desc: "도구당 1회만 확인 후 세션 동안 기억합니다.",
    color: "border-l-emerald-600",
  },
  {
    name: "bypassPermissions",
    desc: "모든 도구를 무조건 허용. 개발/테스트 전용.",
    color: "border-l-red-600",
  },
];

export function PermissionsSection() {
  return (
    <section
      id="permissions"
      className="py-16 bg-blue-50/50"
      style={{ paddingTop: "64px", paddingBottom: "64px" }}
    >
      <div className="center-container">
        <RevealOnScroll>
          <SectionHeader
            label="MODULE 05"
            labelColor="orange"
            title="Permission Manager — 5단계 결정 트리"
            description='도구 실행 전 반드시 거치는 권한 시스템. "deny 우선" 원칙으로 안전성을 보장합니다.'
          />
        </RevealOnScroll>

        <RevealOnScroll>
          <FilePath path="src/permissions/manager.ts" />
        </RevealOnScroll>

        <RevealOnScroll>
          <MermaidDiagram
            chart={decisionTreeChart}
            title="권한 확인 결정 트리 (deny-first)"
            titleColor="orange"
          />
        </RevealOnScroll>

        <RevealOnScroll>
          <h3
            className="text-lg font-semibold text-gray-900 mb-4"
            style={{ marginTop: "32px", marginBottom: "16px" }}
          >
            5가지 권한 모드
          </h3>
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5"
            style={{ gap: "20px" }}
          >
            {modes.map((m) => (
              <div
                key={m.name}
                className={`border border-[#e2e8f0] rounded-lg p-5 bg-white hover:bg-gray-50 hover:border-gray-300 border-l-[3px] ${m.color}`}
                style={{ padding: "20px" }}
              >
                <h4 className="text-sm font-bold mb-1.5">{m.name}</h4>
                <p className="text-xs text-gray-600">{m.desc}</p>
              </div>
            ))}
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <Callout type="info" icon="🎯">
            <strong>규칙 패턴 매칭:</strong>{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800">
              {"ToolName(arg1: value1, arg2: *)"}
            </code>{" "}
            형식으로 glob 패턴 지원. 예:{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800">
              {"bash_exec(command: npm *)"}
            </code>
            는 npm으로 시작하는 모든 명령을 매칭.
          </Callout>
        </RevealOnScroll>

        <RevealOnScroll>
          <ImplDirection
            items={[
              "<strong>감사 로그 활용</strong>: audit-log.ts의 JSONL 데이터로 도구 사용 패턴 분석 대시보드 구현 가능",
              "<strong>팀 권한 정책</strong>: 프로젝트 .dbcode/settings.json으로 팀 공통 deny/allow 규칙 공유",
              "<strong>동적 권한 학습</strong>: 사용자 승인 패턴 분석 → 자동 규칙 제안 기능",
            ]}
          />
        </RevealOnScroll>
      </div>
    </section>
  );
}
