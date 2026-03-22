"use client";

import { SectionHeader } from "../SectionHeader";
import { FilePath } from "../FilePath";
import { MermaidDiagram } from "../MermaidDiagram";
import { Callout } from "../Callout";
import { ImplDirection } from "../ImplDirection";
import { RevealOnScroll } from "../RevealOnScroll";

const decisionTreeChart = `graph TD
    START["도구 호출 요청"] --> DENY_RULES{"1. Permanent Deny?"}
    DENY_RULES -->|"매칭"| DENIED["DENY"]
    DENY_RULES -->|"미매칭"| SESSION{"2. Session Approved?"}
    SESSION -->|"있음"| ALLOWED["ALLOW"]
    SESSION -->|"없음"| ALLOW_RULES{"3. Permanent Allow?"}
    ALLOW_RULES -->|"매칭"| ALLOWED
    ALLOW_RULES -->|"미매칭"| EXPLICIT{"4. Explicit Rules?"}
    EXPLICIT -->|"허용"| ALLOWED
    EXPLICIT -->|"없음"| MODE{"5. Permission Mode?"}
    MODE -->|"bypassPermissions"| ALLOWED
    MODE -->|"dontAsk"| ONCE["1회 확인 후 세션 기억"]
    MODE -->|"acceptEdits"| EDIT_CHECK{"파일 수정?"}
    MODE -->|"plan"| READ_CHECK{"읽기 전용?"}
    MODE -->|"default"| ASK["사용자에게 매번 확인"]
    EDIT_CHECK -->|"Yes"| ALLOWED
    EDIT_CHECK -->|"No"| ASK
    READ_CHECK -->|"Yes"| ALLOWED
    READ_CHECK -->|"No"| ASK
    ONCE --> ALLOWED
    ASK --> USER_DECIDE{"사용자 응답"}
    USER_DECIDE -->|"허용"| RECORD["세션에 기록 ALLOW"]
    USER_DECIDE -->|"거부"| DENIED
    style START fill:#3a2e1e,stroke:#f59e0b,color:#f1f5f9
    style DENIED fill:#3a1e1e,stroke:#ef4444,color:#f1f5f9
    style ALLOWED fill:#1e3a2a,stroke:#10b981,color:#f1f5f9
    style ASK fill:#1a2035,stroke:#3b82f6,color:#f1f5f9`;

const modes = [
  { name: "default", desc: "매번 사용자에게 확인을 요청합니다. 가장 안전한 모드.", color: "border-l-accent-orange" },
  { name: "acceptEdits", desc: "파일 읽기/쓰기/수정을 자동 승인. bash 명령은 여전히 확인 필요.", color: "border-l-accent-blue" },
  { name: "plan", desc: "읽기 전용 도구만 자동 승인. 쓰기 작업은 모두 확인 필요.", color: "border-l-accent-purple" },
  { name: "dontAsk", desc: "도구당 1회만 확인 후 세션 동안 기억합니다.", color: "border-l-accent-green" },
  { name: "bypassPermissions", desc: "모든 도구를 무조건 허용. 개발/테스트 전용.", color: "border-l-accent-red" },
];

export function PermissionsSection() {
  return (
    <section id="permissions" className="py-20">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
        <RevealOnScroll>
          <SectionHeader
            label="MODULE 05"
            labelColor="orange"
            title="Permission Manager — 5단계 결정 트리"
            description='도구 실행 전 반드시 거치는 권한 시스템. "deny 우선" 원칙으로 안전성을 보장합니다.'
          />
        </RevealOnScroll>

        <RevealOnScroll><FilePath path="src/permissions/manager.ts" /></RevealOnScroll>

        <RevealOnScroll>
          <MermaidDiagram chart={decisionTreeChart} title="권한 확인 결정 트리 (deny-first)" titleColor="orange" />
        </RevealOnScroll>

        <RevealOnScroll>
          <h3 className="text-lg font-bold mb-4">5가지 권한 모드</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {modes.map((m) => (
              <div key={m.name} className={`bg-bg-card border border-border rounded-2xl p-5 border-l-[3px] ${m.color}`}>
                <h4 className="text-sm font-bold mb-1.5">{m.name}</h4>
                <p className="text-xs text-text-secondary">{m.desc}</p>
              </div>
            ))}
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <Callout type="info" icon="🎯">
            <strong>규칙 패턴 매칭:</strong>{" "}
            <code className="bg-[rgba(255,255,255,0.05)] px-1.5 py-0.5 rounded text-xs">{"ToolName(arg1: value1, arg2: *)"}</code> 형식으로 glob 패턴 지원.
            예: <code className="bg-[rgba(255,255,255,0.05)] px-1.5 py-0.5 rounded text-xs">{"bash_exec(command: npm *)"}</code>는 npm으로 시작하는 모든 명령을 매칭.
          </Callout>
        </RevealOnScroll>

        <RevealOnScroll>
          <ImplDirection items={[
            "<strong>감사 로그 활용</strong>: audit-log.ts의 JSONL 데이터로 도구 사용 패턴 분석 대시보드 구현 가능",
            "<strong>팀 권한 정책</strong>: 프로젝트 .dbcode/settings.json으로 팀 공통 deny/allow 규칙 공유",
            "<strong>동적 권한 학습</strong>: 사용자 승인 패턴 분석 → 자동 규칙 제안 기능",
          ]} />
        </RevealOnScroll>
      </div>
    </section>
  );
}
