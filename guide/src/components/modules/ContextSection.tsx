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
        TOOL_OUT["도구 결과 200+ tokens<br/><small>토큰이 200 이상인 도구 출력만 대상</small>"] --> SIZE_CHECK{"크기 > 200?<br/><small>토큰 수 기준 필터링</small>"}
        SIZE_CHECK -->|"Yes"| COLD["Cold Storage 디스크 저장<br/><small>JSON 파일로 디스크에 영구 저장</small>"]
        SIZE_CHECK -->|"No"| KEEP["인라인 유지<br/><small>작은 출력은 메시지에 그대로 유지</small>"]
        COLD --> REF["ColdStorageRef 참조만 남김<br/><small>원본 대신 경로 참조로 대체</small>"]
    end
    subgraph L2["Layer 2: Auto-compaction (83.5%)"]
        direction LR
        USAGE["컨텍스트 사용률 >= 83.5%<br/><small>토큰 사용률이 임계값 초과 시 트리거</small>"] --> PRESERVE["보존: system + 최근 N턴<br/><small>시스템 프롬프트와 최근 대화는 보호</small>"]
        USAGE --> COMPRESS["압축: 오래된 메시지<br/><small>오래된 메시지를 LLM으로 요약</small>"]
        COMPRESS --> SUMMARY["LLM 요약 핵심 정보 추출<br/><small>핵심 결정사항 + 코드 변경사항 요약</small>"]
        SUMMARY --> MERGED["요약 + 보존 = 새 컨텍스트<br/><small>요약 결과와 보존 메시지를 합쳐 새 컨텍스트 구성</small>"]
    end
    subgraph L3["Layer 3: Rehydration"]
        direction LR
        COMPACT_DONE["압축 완료<br/><small>Auto-compaction 결과물</small>"] --> STRATEGY{"리하이드 전략<br/><small>어떤 Cold Storage 항목을 복원할지 결정</small>"}
        STRATEGY -->|"recency"| RECENT_F["최근 접근 파일 5개<br/><small>가장 최근에 저장된 항목부터 복원</small>"]
        STRATEGY -->|"frequency"| FREQ_F["자주 접근 파일 5개<br/><small>자주 참조된 항목을 우선 복원</small>"]
        STRATEGY -->|"mixed"| MIX_F["복합 우선순위 파일 5개<br/><small>최근성 + 빈도를 종합하여 복원</small>"]
    end
    L1 --> L2
    L2 --> L3
    style L1 fill:#cffafe,stroke:#06b6d4,color:#1e293b
    style L2 fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
    style L3 fill:#dcfce7,stroke:#10b981,color:#1e293b`;

export function ContextSection() {
  return (
    <section
      id="context"
      className="py-16 bg-violet-50/50"
      style={{ paddingTop: "64px", paddingBottom: "64px" }}
    >
      <div className="center-container">
        <RevealOnScroll>
          <SectionHeader
            label="MODULE 02"
            labelColor="cyan"
            title="Context Manager — 3-Layer 압축"
            description="제한된 컨텍스트 윈도우 안에서 최대한 많은 정보를 유지하는 토큰 관리 엔진입니다."
          />
        </RevealOnScroll>

        <RevealOnScroll>
          <FilePath path="src/core/context-manager.ts" />
        </RevealOnScroll>

        <RevealOnScroll>
          <MermaidDiagram
            chart={compactionChart}
            title="3-Layer 압축 파이프라인"
            titleColor="cyan"
          />
        </RevealOnScroll>

        <RevealOnScroll>
          <h3
            className="text-lg font-semibold text-gray-900 mb-4"
            style={{ marginTop: "32px", marginBottom: "16px" }}
          >
            Cold Storage 내부 구조
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" style={{ gap: "20px" }}>
            <CodeBlock>
              <span className="cm">{"// Cold Storage 참조"}</span>
              {"\n"}
              <span className="kw">interface</span> <span className="type">ColdStorageRef</span>{" "}
              {"{"}
              {"\n"}
              {"  "}
              <span className="prop">id</span>: <span className="type">string</span>;{" "}
              <span className="cm">{"// 고유 식별자"}</span>
              {"\n"}
              {"  "}
              <span className="prop">toolName</span>: <span className="type">string</span>;{" "}
              <span className="cm">{"// 원본 도구명"}</span>
              {"\n"}
              {"  "}
              <span className="prop">filePath</span>: <span className="type">string</span>;{" "}
              <span className="cm">{"// 디스크 경로"}</span>
              {"\n"}
              {"  "}
              <span className="prop">tokenCount</span>: <span className="type">number</span>;{" "}
              <span className="cm">{"// 원본 토큰 수"}</span>
              {"\n"}
              {"  "}
              <span className="prop">summary</span>: <span className="type">string</span>;{" "}
              <span className="cm">{"// 1줄 요약"}</span>
              {"\n"}
              {"  "}
              <span className="prop">createdAt</span>: <span className="type">number</span>;{" "}
              <span className="cm">{"// 타임스탬프"}</span>
              {"\n"}
              {"}"}
              {"\n\n"}
              <span className="cm">{"// 디스크: ~/.dbcode/projects/{hash}/cold-storage/"}</span>
              {"\n"}
              <span className="cm">{"// TTL: 24시간 후 자동 정리"}</span>
            </CodeBlock>
            <CodeBlock>
              <span className="cm">{"// 컨텍스트 사용량"}</span>
              {"\n"}
              <span className="kw">interface</span> <span className="type">ContextUsage</span> {"{"}
              {"\n"}
              {"  "}
              <span className="prop">currentTokens</span>: <span className="type">number</span>;{" "}
              <span className="cm">{"// 현재 사용 토큰"}</span>
              {"\n"}
              {"  "}
              <span className="prop">maxTokens</span>: <span className="type">number</span>;{" "}
              <span className="cm">{"// 모델별 한계"}</span>
              {"\n"}
              {"  "}
              <span className="prop">usagePercent</span>: <span className="type">number</span>;{" "}
              <span className="cm">{"// 사용률 (%)"}</span>
              {"\n"}
              {"  "}
              <span className="prop">coldRefCount</span>: <span className="type">number</span>;{" "}
              <span className="cm">{"// Cold 참조 수"}</span>
              {"\n"}
              {"  "}
              <span className="prop">totalSaved</span>: <span className="type">number</span>;{" "}
              <span className="cm">{"// 절약한 총 토큰"}</span>
              {"\n"}
              {"}"}
              {"\n\n"}
              <span className="cm">{"// 모델별 보존 턴 수"}</span>
              {"\n"}
              <span className="cm">{"// HIGH: 5턴 / MEDIUM: 4턴 / LOW: 3턴"}</span>
            </CodeBlock>
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <Callout type="tip" icon="🔑">
            <strong>핵심 상태 변수:</strong>{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800">
              coldRefs: Map
            </code>
            ,{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800">
              recentFiles: string[]
            </code>
            ,{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800">
              fileAccessFrequency: Map
            </code>
            ,{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800">
              compactionCount
            </code>
            ,{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800">
              totalTokensSaved
            </code>
          </Callout>
        </RevealOnScroll>

        <RevealOnScroll>
          <ImplDirection
            items={[
              "<strong>압축 임계값 조정</strong>: getContextConfig()에서 모델 티어별 threshold 수정 (현재 83.5%)",
              "<strong>리하이드 전략 추가</strong>: 현재 recency/frequency/mixed → 'importance' 기반 전략 추가 가능",
              "<strong>Cold Storage 포맷</strong>: 현재 JSON 텍스트 → 압축 바이너리로 디스크 효율 개선 가능",
              "<strong>압축 품질 개선</strong>: LLM 요약 시 '코드 변경사항 우선' 같은 도메인 힌트 활용",
            ]}
          />
        </RevealOnScroll>
      </div>
    </section>
  );
}
