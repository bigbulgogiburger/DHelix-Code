"use client";

import { SectionHeader } from "../SectionHeader";
import { FilePath } from "../FilePath";
import { MermaidDiagram } from "../MermaidDiagram";
import { CodeBlock } from "../CodeBlock";
import { ImplDirection } from "../ImplDirection";
import { Callout } from "../Callout";
import { RevealOnScroll } from "../RevealOnScroll";

const compactionChart = `graph TB
    subgraph L1["Layer 1: Microcompaction"]
        direction LR
        TOOL_OUT["도구 결과 200+ tokens"] --> SIZE_CHECK{"크기 > 200?"}
        SIZE_CHECK -->|"Yes"| COLD["Cold Storage 디스크 저장"]
        SIZE_CHECK -->|"No"| KEEP["인라인 유지"]
        COLD --> REF["ColdStorageRef 참조만 남김"]
    end
    subgraph L2["Layer 2: Auto-compaction (83.5%)"]
        direction LR
        USAGE["컨텍스트 사용률 >= 83.5%"] --> PRESERVE["보존: system + 최근 N턴"]
        USAGE --> COMPRESS["압축: 오래된 메시지"]
        COMPRESS --> SUMMARY["LLM 요약 핵심 정보 추출"]
        SUMMARY --> MERGED["요약 + 보존 = 새 컨텍스트"]
    end
    subgraph L3["Layer 3: Rehydration"]
        direction LR
        COMPACT_DONE["압축 완료"] --> STRATEGY{"리하이드 전략"}
        STRATEGY -->|"recency"| RECENT_F["최근 접근 파일 5개"]
        STRATEGY -->|"frequency"| FREQ_F["자주 접근 파일 5개"]
        STRATEGY -->|"mixed"| MIX_F["복합 우선순위 파일 5개"]
    end
    L1 --> L2
    L2 --> L3
    style L1 fill:#0d2137,stroke:#06b6d4,color:#f1f5f9
    style L2 fill:#1a1a3e,stroke:#8b5cf6,color:#f1f5f9
    style L3 fill:#0d2a1a,stroke:#10b981,color:#f1f5f9`;

export function ContextSection() {
  return (
    <section id="context" className="py-20 bg-bg-secondary">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
        <RevealOnScroll>
          <SectionHeader
            label="MODULE 02"
            labelColor="cyan"
            title="Context Manager — 3-Layer 압축"
            description="제한된 컨텍스트 윈도우 안에서 최대한 많은 정보를 유지하는 토큰 관리 엔진입니다."
          />
        </RevealOnScroll>

        <RevealOnScroll><FilePath path="src/core/context-manager.ts" /></RevealOnScroll>

        <RevealOnScroll>
          <MermaidDiagram chart={compactionChart} title="3-Layer 압축 파이프라인" titleColor="cyan" />
        </RevealOnScroll>

        <RevealOnScroll>
          <h3 className="text-lg font-bold mb-4">Cold Storage 내부 구조</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CodeBlock>
              <span className="cm">{"// Cold Storage 참조"}</span>{"\n"}
              <span className="kw">interface</span> <span className="type">ColdStorageRef</span> {"{"}{"\n"}
              {"  "}<span className="prop">id</span>: <span className="type">string</span>;           <span className="cm">{"// 고유 식별자"}</span>{"\n"}
              {"  "}<span className="prop">toolName</span>: <span className="type">string</span>;     <span className="cm">{"// 원본 도구명"}</span>{"\n"}
              {"  "}<span className="prop">filePath</span>: <span className="type">string</span>;     <span className="cm">{"// 디스크 경로"}</span>{"\n"}
              {"  "}<span className="prop">tokenCount</span>: <span className="type">number</span>;   <span className="cm">{"// 원본 토큰 수"}</span>{"\n"}
              {"  "}<span className="prop">summary</span>: <span className="type">string</span>;      <span className="cm">{"// 1줄 요약"}</span>{"\n"}
              {"  "}<span className="prop">createdAt</span>: <span className="type">number</span>;    <span className="cm">{"// 타임스탬프"}</span>{"\n"}
              {"}"}{"\n\n"}
              <span className="cm">{"// 디스크: ~/.dbcode/projects/{hash}/cold-storage/"}</span>{"\n"}
              <span className="cm">{"// TTL: 24시간 후 자동 정리"}</span>
            </CodeBlock>
            <CodeBlock>
              <span className="cm">{"// 컨텍스트 사용량"}</span>{"\n"}
              <span className="kw">interface</span> <span className="type">ContextUsage</span> {"{"}{"\n"}
              {"  "}<span className="prop">currentTokens</span>: <span className="type">number</span>;  <span className="cm">{"// 현재 사용 토큰"}</span>{"\n"}
              {"  "}<span className="prop">maxTokens</span>: <span className="type">number</span>;      <span className="cm">{"// 모델별 한계"}</span>{"\n"}
              {"  "}<span className="prop">usagePercent</span>: <span className="type">number</span>;   <span className="cm">{"// 사용률 (%)"}</span>{"\n"}
              {"  "}<span className="prop">coldRefCount</span>: <span className="type">number</span>;   <span className="cm">{"// Cold 참조 수"}</span>{"\n"}
              {"  "}<span className="prop">totalSaved</span>: <span className="type">number</span>;     <span className="cm">{"// 절약한 총 토큰"}</span>{"\n"}
              {"}"}{"\n\n"}
              <span className="cm">{"// 모델별 보존 턴 수"}</span>{"\n"}
              <span className="cm">{"// HIGH: 5턴 / MEDIUM: 4턴 / LOW: 3턴"}</span>
            </CodeBlock>
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <Callout type="tip" icon="🔑">
            <strong>핵심 상태 변수:</strong>{" "}
            <code className="bg-[rgba(255,255,255,0.05)] px-1.5 py-0.5 rounded text-xs">coldRefs: Map</code>,{" "}
            <code className="bg-[rgba(255,255,255,0.05)] px-1.5 py-0.5 rounded text-xs">recentFiles: string[]</code>,{" "}
            <code className="bg-[rgba(255,255,255,0.05)] px-1.5 py-0.5 rounded text-xs">fileAccessFrequency: Map</code>,{" "}
            <code className="bg-[rgba(255,255,255,0.05)] px-1.5 py-0.5 rounded text-xs">compactionCount</code>,{" "}
            <code className="bg-[rgba(255,255,255,0.05)] px-1.5 py-0.5 rounded text-xs">totalTokensSaved</code>
          </Callout>
        </RevealOnScroll>

        <RevealOnScroll>
          <ImplDirection items={[
            "<strong>압축 임계값 조정</strong>: getContextConfig()에서 모델 티어별 threshold 수정 (현재 83.5%)",
            "<strong>리하이드 전략 추가</strong>: 현재 recency/frequency/mixed → 'importance' 기반 전략 추가 가능",
            "<strong>Cold Storage 포맷</strong>: 현재 JSON 텍스트 → 압축 바이너리로 디스크 효율 개선 가능",
            "<strong>압축 품질 개선</strong>: LLM 요약 시 '코드 변경사항 우선' 같은 도메인 힌트 활용",
          ]} />
        </RevealOnScroll>
      </div>
    </section>
  );
}
