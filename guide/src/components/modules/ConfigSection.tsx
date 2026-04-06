"use client";

import { SectionHeader } from "../SectionHeader";
import { FilePath } from "../FilePath";
import { MermaidDiagram } from "../MermaidDiagram";
import { ImplDirection } from "../ImplDirection";
import { RevealOnScroll } from "../RevealOnScroll";

const configMergeChart = `graph BT
    D["defaults.ts 하드코딩 기본값<br/><small>하드코딩 기본값 안전망</small>"] --> MERGE["Deep Merge<br/><small>5개 레이어를 깊은 병합</small>"]
    U["~/.dhelix/settings.json 사용자 전역<br/><small>사용자 전역 설정</small>"] --> MERGE
    P[".dhelix/settings.json 프로젝트 설정<br/><small>프로젝트별 팀 공유 설정</small>"] --> MERGE
    E["환경변수 LOCAL_API_BASE_URL 등<br/><small>DHELIX_* OPENAI_* 등</small>"] --> MERGE
    C["CLI Flags --model --verbose 최우선<br/><small>--model --verbose 등 일회성</small>"] --> MERGE
    MERGE --> FINAL["최종 Config<br/><small>Zod 스키마 검증된 최종 설정</small>"]
    style MERGE fill:#dcfce7,stroke:#10b981,color:#1e293b
    style C fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
    style FINAL fill:#dcfce7,stroke:#10b981,color:#1e293b`;

const dhelixLoadChart = `graph LR
    G["1. ~/.dhelix/DHELIX.md 전역<br/><small>~/.dhelix/DHELIX.md</small>"] --> GR["2. ~/.dhelix/rules/*.md 전역 규칙<br/><small>~/.dhelix/rules/*.md 경로 조건부</small>"]
    GR --> PD["3. 상위 디렉토리 ../DHELIX.md 체인<br/><small>부모 디렉토리 DHELIX.md 모노레포</small>"]
    PD --> P["4. ./DHELIX.md 프로젝트<br/><small>{root}/DHELIX.md</small>"]
    P --> PR["5. .dhelix/rules/*.md 프로젝트 규칙<br/><small>.dhelix/rules/*.md 경로 조건부</small>"]
    PR --> L["6. .dhelix/DHELIX.local.md 로컬<br/><small>DHELIX.local.md 개인 gitignore</small>"]
    L --> CONCAT["순서대로 연결<br/><small>'\\n\\n---\\n\\n' 구분자로 합침</small>"]
    CONCAT --> PROMPT["system-prompt-builder.ts에 주입<br/><small>buildSystemPrompt()에서 사용</small>"]
    style CONCAT fill:#dbeafe,stroke:#3b82f6,color:#1e293b
    style PROMPT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b`;

const configPaths = [
  {
    use: "프로젝트 설정",
    path: ".dhelix/settings.json",
    git: "✅",
    desc: "프로젝트 전용 설정 (팀 공유)",
  },
  { use: "사용자 전역", path: "~/.dhelix/settings.json", git: "—", desc: "모든 프로젝트에 적용" },
  {
    use: "프로젝트 규칙",
    path: ".dhelix/rules/*.md",
    git: "✅",
    desc: "경로 조건부 규칙 (glob 기반)",
  },
  { use: "전역 규칙", path: "~/.dhelix/rules/*.md", git: "—", desc: "모든 프로젝트에 적용" },
  {
    use: "로컬 지시사항",
    path: ".dhelix/DHELIX.local.md",
    git: "❌",
    desc: "개인 지시사항 (gitignored)",
  },
  {
    use: "프로젝트 메모리",
    path: "~/.dhelix/projects/{hash}/memory/",
    git: "—",
    desc: "프로젝트별 AI 메모리",
  },
  {
    use: "Cold Storage",
    path: "~/.dhelix/projects/{hash}/cold-storage/",
    git: "—",
    desc: "압축된 컨텍스트 (24h TTL)",
  },
  { use: "감사 로그", path: ".dhelix/audit.jsonl", git: "❌", desc: "권한 감사 기록" },
];

export function ConfigSection() {
  return (
    <section
      id="config"
      className="py-16 bg-amber-50/50"
      style={{ paddingTop: "64px", paddingBottom: "64px" }}
    >
      <div className="center-container">
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <SectionHeader
              label="MODULE 08"
              labelColor="green"
              title="Config & Instructions — 설정 계층"
              description="5-Layer 설정 병합 + 6단계 DHELIX.md 로딩으로 유연한 설정 관리를 구현합니다."
            />
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <div className="flex gap-2 flex-wrap mb-6">
            <FilePath path="src/config/loader.ts" />
            <FilePath path="src/config/defaults.ts" />
            <FilePath path="src/instructions/loader.ts" />
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <MermaidDiagram
            chart={configMergeChart}
            title="5-Layer 설정 병합 과정"
            titleColor="green"
          />
        </RevealOnScroll>

        <RevealOnScroll>
          <MermaidDiagram
            chart={dhelixLoadChart}
            title="DHELIX.md 6단계 로딩 체인"
            titleColor="blue"
          />
        </RevealOnScroll>

        <RevealOnScroll>
          <h3
            className="text-lg font-semibold text-gray-900 mb-4"
            style={{ marginTop: "32px", marginBottom: "16px" }}
          >
            주요 설정/데이터 경로 정리
          </h3>
          <div
            className="border border-[#e2e8f0] rounded-lg overflow-hidden overflow-x-auto bg-white"
            style={{ marginBottom: "24px" }}
          >
            <table className="w-full border-collapse min-w-[600px]">
              <thead>
                <tr>
                  {["구분", "경로", "Git", "설명"].map((h) => (
                    <th
                      key={h}
                      className="p-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-200"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-sm">
                {configPaths.map((row, i) => (
                  <tr
                    key={i}
                    className="hover:bg-gray-50 border-b border-gray-100 transition-colors"
                  >
                    <td className="p-3 px-4 text-sm">{row.use}</td>
                    <td className="p-3 px-4 text-sm font-mono text-cyan-600 font-semibold text-xs">
                      {row.path}
                    </td>
                    <td className="p-3 px-4 text-sm">{row.git}</td>
                    <td className="p-3 px-4 text-sm">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <ImplDirection
            items={[
              "<strong>설정 검증</strong>: Zod 스키마로 settings.json 유효성 검사 + 의미 있는 에러 메시지",
              "<strong>규칙 조건부 적용</strong>: glob 패턴으로 특정 경로에만 규칙 적용",
              "<strong>환경변수 확장</strong>: 현재 LOCAL_* → 더 많은 환경변수 지원 (PROXY, CACHE 등)",
              "<strong>/doctor 진단</strong>: 설정 충돌, 누락 API 키 등 12가지 헬스 체크",
            ]}
          />
        </RevealOnScroll>
      </div>
    </section>
  );
}
