"use client";

import { SectionHeader } from "../SectionHeader";
import { FilePath } from "../FilePath";
import { MermaidDiagram } from "../MermaidDiagram";
import { ImplDirection } from "../ImplDirection";
import { RevealOnScroll } from "../RevealOnScroll";

const configMergeChart = `graph BT
    D["defaults.ts 하드코딩 기본값"] --> MERGE["Deep Merge"]
    U["~/.dbcode/settings.json 사용자 전역"] --> MERGE
    P[".dbcode/settings.json 프로젝트 설정"] --> MERGE
    E["환경변수 LOCAL_API_BASE_URL 등"] --> MERGE
    C["CLI Flags --model --verbose 최우선"] --> MERGE
    MERGE --> FINAL["최종 Config"]
    style MERGE fill:#1e3a2a,stroke:#10b981,color:#f1f5f9
    style C fill:#2a1e4a,stroke:#8b5cf6,color:#f1f5f9
    style FINAL fill:#1e3a2a,stroke:#10b981,color:#f1f5f9`;

const dbcodeLoadChart = `graph LR
    G["1. ~/.dbcode/DBCODE.md 전역"] --> GR["2. ~/.dbcode/rules/*.md 전역 규칙"]
    GR --> PD["3. 상위 디렉토리 ../DBCODE.md 체인"]
    PD --> P["4. ./DBCODE.md 프로젝트"]
    P --> PR["5. .dbcode/rules/*.md 프로젝트 규칙"]
    PR --> L["6. .dbcode/DBCODE.local.md 로컬"]
    L --> CONCAT["순서대로 연결"]
    CONCAT --> PROMPT["system-prompt-builder.ts에 주입"]
    style CONCAT fill:#1e2a4a,stroke:#3b82f6,color:#f1f5f9
    style PROMPT fill:#2a1e4a,stroke:#8b5cf6,color:#f1f5f9`;

const configPaths = [
  { use: "프로젝트 설정", path: ".dbcode/settings.json", git: "✅", desc: "프로젝트 전용 설정 (팀 공유)" },
  { use: "사용자 전역", path: "~/.dbcode/settings.json", git: "—", desc: "모든 프로젝트에 적용" },
  { use: "프로젝트 규칙", path: ".dbcode/rules/*.md", git: "✅", desc: "경로 조건부 규칙 (glob 기반)" },
  { use: "전역 규칙", path: "~/.dbcode/rules/*.md", git: "—", desc: "모든 프로젝트에 적용" },
  { use: "로컬 지시사항", path: ".dbcode/DBCODE.local.md", git: "❌", desc: "개인 지시사항 (gitignored)" },
  { use: "프로젝트 메모리", path: "~/.dbcode/projects/{hash}/memory/", git: "—", desc: "프로젝트별 AI 메모리" },
  { use: "Cold Storage", path: "~/.dbcode/projects/{hash}/cold-storage/", git: "—", desc: "압축된 컨텍스트 (24h TTL)" },
  { use: "감사 로그", path: ".dbcode/audit.jsonl", git: "❌", desc: "권한 감사 기록" },
];

export function ConfigSection() {
  return (
    <section id="config" className="py-20 bg-bg-secondary">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
        <RevealOnScroll>
          <SectionHeader
            label="MODULE 08"
            labelColor="green"
            title="Config & Instructions — 설정 계층"
            description="5-Layer 설정 병합 + 6단계 DBCODE.md 로딩으로 유연한 설정 관리를 구현합니다."
          />
        </RevealOnScroll>

        <RevealOnScroll>
          <div className="flex gap-2 flex-wrap mb-5">
            <FilePath path="src/config/loader.ts" />
            <FilePath path="src/config/defaults.ts" />
            <FilePath path="src/instructions/loader.ts" />
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <MermaidDiagram chart={configMergeChart} title="5-Layer 설정 병합 과정" titleColor="green" />
        </RevealOnScroll>

        <RevealOnScroll>
          <MermaidDiagram chart={dbcodeLoadChart} title="DBCODE.md 6단계 로딩 체인" titleColor="blue" />
        </RevealOnScroll>

        <RevealOnScroll>
          <h3 className="text-lg font-bold mb-4">주요 설정/데이터 경로 정리</h3>
          <div className="bg-bg-card border border-border rounded-2xl overflow-hidden overflow-x-auto">
            <table className="w-full border-collapse min-w-[600px]">
              <thead>
                <tr>
                  {["구분", "경로", "Git", "설명"].map((h) => (
                    <th key={h} className="p-3 px-5 text-left text-[11px] font-bold uppercase tracking-wider text-text-muted bg-[rgba(255,255,255,0.02)] border-b border-border">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-[13px]">
                {configPaths.map((row, i) => (
                  <tr key={i} className="hover:bg-[rgba(59,130,246,0.03)] border-b border-[rgba(255,255,255,0.03)]">
                    <td className="p-3 px-5">{row.use}</td>
                    <td className="p-3 px-5 font-mono text-accent-cyan font-semibold text-xs">{row.path}</td>
                    <td className="p-3 px-5">{row.git}</td>
                    <td className="p-3 px-5">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <ImplDirection items={[
            "<strong>설정 검증</strong>: Zod 스키마로 settings.json 유효성 검사 + 의미 있는 에러 메시지",
            "<strong>규칙 조건부 적용</strong>: glob 패턴으로 특정 경로에만 규칙 적용",
            "<strong>환경변수 확장</strong>: 현재 LOCAL_* → 더 많은 환경변수 지원 (PROXY, CACHE 등)",
            "<strong>/doctor 진단</strong>: 설정 충돌, 누락 API 키 등 12가지 헬스 체크",
          ]} />
        </RevealOnScroll>
      </div>
    </section>
  );
}
