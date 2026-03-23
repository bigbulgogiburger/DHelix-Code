"use client";

import { FilePath } from "@/components/FilePath";
import { LayerBadge } from "@/components/LayerBadge";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import { DeepDive } from "@/components/DeepDive";
import { ParamTable } from "@/components/ParamTable";
import { SeeAlso } from "@/components/SeeAlso";

export default function UpdateCheckerPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/core/update-checker.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">Update Checker</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="core" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              npm 레지스트리에서 최신 버전을 확인하여 업데이트가 가능한지 알려주는 모듈입니다. 7일
              주기 캐싱과 5초 타임아웃으로 앱 시작 성능에 영향을 주지 않습니다.
            </p>
          </div>
        </RevealOnScroll>

        {/* ─── 1. 개요 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>📋</span> 개요
            </h2>

            <div className="text-[14px] text-gray-600 leading-[1.85] space-y-4">
              <p>
                Update Checker는 <strong className="text-gray-900">비차단(non-blocking)</strong>{" "}
                업데이트 확인을 수행합니다. 앱 시작 시 백그라운드에서 npm 레지스트리에 접속하여 새
                버전이 있으면 사용자에게 안내합니다. 네트워크 오류나 타임아웃은 조용히 무시합니다.
              </p>
              <p>
                매번 확인하면 앱이 느려지므로, 확인 결과를{" "}
                <code className="text-cyan-600 text-[13px]">~/.dbcode/update-check.json</code>에
                캐싱합니다. 마지막 확인 시각을 저장해두고 7일이 지나야 새로 확인합니다.
              </p>
              <p>
                버전 비교는 <strong className="text-gray-900">시맨틱 버저닝(semver)</strong>을
                따릅니다. "v" 접두사를 제거하고 주버전 → 부버전 → 패치 순서로 비교합니다.
              </p>
            </div>

            <MermaidDiagram
              title="checkForUpdates() 흐름"
              titleColor="cyan"
              chart={`flowchart TD
    START["checkForUpdates(currentVersion)"] --> READ["readState()\\n~/.dbcode/update-check.json 읽기"]
    READ --> HAS{"상태 파일\\n존재?"}
    HAS -->|"없음"| FETCH["fetchLatestVersion()\\nnpm 레지스트리 조회"]
    HAS -->|"있음"| AGE{"마지막 확인\\n7일 이내?"}
    AGE -->|"YES (캐시 유효)"| CACHE["캐시된 latestVersion 사용"]
    AGE -->|"NO (만료됨)"| FETCH
    FETCH -->|"5초 타임아웃"| GOT{"최신 버전\\n수신?"}
    GOT -->|"실패/타임아웃"| SAVE_NULL["writeState(null)\\n다음 확인 타이머 갱신"]
    GOT -->|"성공"| SAVE["writeState(latest)\\n디스크에 저장"]
    SAVE --> CMP["isNewerVersion()\\n버전 비교"]
    CACHE --> CMP2["isNewerVersion()\\n버전 비교"]
    CMP -->|"새 버전 있음"| RETURN["UpdateInfo 반환"]
    CMP -->|"최신 상태"| NULL["null 반환"]
    SAVE_NULL --> NULL
    CMP2 -->|"새 버전 있음"| RETURN
    CMP2 -->|"최신 상태"| NULL

    style START fill:#2a1e4a,stroke:#8b5cf6,color:#f1f5f9
    style RETURN fill:#1a3a2a,stroke:#10b981,color:#f1f5f9
    style NULL fill:#1a2a3a,stroke:#3b82f6,color:#f1f5f9`}
            />
          </section>
        </RevealOnScroll>

        {/* ─── 2. 레퍼런스 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>📖</span> 레퍼런스
            </h2>

            {/* checkForUpdates */}
            <div className="mb-8">
              <h3
                className="text-[17px] font-bold text-indigo-600 font-mono"
                style={{ marginTop: "32px", marginBottom: "16px" }}
              >
                checkForUpdates()
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-4">
                npm에서 사용 가능한 업데이트를 확인합니다. 7일 주기 캐싱을 적용하여 불필요한
                네트워크 요청을 방지합니다.
              </p>
              <CodeBlock>
                <span className="text-[#ff7b72]">async function</span>{" "}
                <span className="text-[#d2a8ff]">checkForUpdates</span>({"\n"}
                {"  "}
                <span className="text-[#ffa657]">currentVersion</span>:{" "}
                <span className="text-[#79c0ff]">string</span>
                {"\n"}): <span className="text-[#79c0ff]">Promise</span>
                {"<"}
                <span className="text-[#79c0ff]">UpdateInfo | null</span>
                {">"}
              </CodeBlock>
              <ParamTable
                params={[
                  {
                    name: "currentVersion",
                    type: "string",
                    required: true,
                    desc: '현재 설치된 버전 문자열. 예: "0.1.0" 또는 "v0.1.0". "v" 접두사는 비교 시 자동 제거됩니다.',
                  },
                ]}
              />
              <p className="text-[13px] text-gray-500 mt-3">
                반환값: 새 버전이 있으면 <code className="text-cyan-600">UpdateInfo</code>, 없거나
                확인 실패 시 <code className="text-cyan-600">null</code>.
              </p>
            </div>

            {/* isNewerVersion */}
            <div className="mb-8">
              <h3
                className="text-[17px] font-bold text-indigo-600 font-mono"
                style={{ marginTop: "32px", marginBottom: "16px" }}
              >
                isNewerVersion()
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-4">
                두 시맨틱 버전 문자열을 비교하여 latest가 current보다 새로운 버전인지 판별합니다.
              </p>
              <CodeBlock>
                <span className="text-[#ff7b72]">function</span>{" "}
                <span className="text-[#d2a8ff]">isNewerVersion</span>({"\n"}
                {"  "}
                <span className="text-[#ffa657]">current</span>:{" "}
                <span className="text-[#79c0ff]">string</span>,{"\n"}
                {"  "}
                <span className="text-[#ffa657]">latest</span>:{" "}
                <span className="text-[#79c0ff]">string</span>
                {"\n"}): <span className="text-[#79c0ff]">boolean</span>
              </CodeBlock>
              <ParamTable
                params={[
                  {
                    name: "current",
                    type: "string",
                    required: true,
                    desc: '현재 설치된 버전. 예: "1.2.3".',
                  },
                  {
                    name: "latest",
                    type: "string",
                    required: true,
                    desc: '비교할 최신 버전. 예: "1.3.0". latest가 current보다 크면 true.',
                  },
                ]}
              />
            </div>

            {/* UpdateInfo 인터페이스 */}
            <div className="mb-8">
              <h3
                className="text-[17px] font-bold text-indigo-600 font-mono"
                style={{ marginTop: "32px", marginBottom: "16px" }}
              >
                UpdateInfo 인터페이스
              </h3>
              <ParamTable
                params={[
                  {
                    name: "current",
                    type: "string",
                    required: true,
                    desc: "현재 설치된 버전.",
                  },
                  {
                    name: "latest",
                    type: "string",
                    required: true,
                    desc: "npm에 게시된 최신 버전.",
                  },
                  {
                    name: "updateCommand",
                    type: "string",
                    required: true,
                    desc: '업데이트 명령어. 예: "npm install -g dbcode@latest".',
                  },
                ]}
              />
            </div>
          </section>
        </RevealOnScroll>

        {/* ─── 3. 사용법 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🚀</span> 사용법
            </h2>

            <p className="text-[14px] text-gray-600 leading-[1.85] mb-6">
              앱 시작 시 백그라운드에서 호출하는 것이 권장됩니다. 결과를 기다리지 않으므로 부팅
              시간에 영향을 주지 않습니다.
            </p>

            <CodeBlock>
              <span className="text-[#8b949e]">// 앱 진입점에서 백그라운드 확인</span>
              {"\n"}
              <span className="text-[#d2a8ff]">checkForUpdates</span>(pkg.version).
              <span className="text-[#d2a8ff]">then</span>((info) ={">"} {"{"}
              {"\n"}
              {"  "}
              <span className="text-[#ff7b72]">if</span> (info) {"{"}
              {"\n"}
              {"    "}console.
              <span className="text-[#d2a8ff]">log</span>({"\n"}
              {"      "}
              <span className="text-[#a5d6ff]">`업데이트 가능: ${"{"}</span>
              info.current
              <span className="text-[#a5d6ff]">
                {"}"} → ${"{"}
              </span>
              info.latest
              <span className="text-[#a5d6ff]">{"}"}`</span>
              {"\n"}
              {"    "});{"\n"}
              {"    "}console.
              <span className="text-[#d2a8ff]">log</span>(
              <span className="text-[#a5d6ff]">
                `실행: ${"{"}info.updateCommand{"}"}`
              </span>
              );{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"}"}).
              <span className="text-[#d2a8ff]">catch</span>(() ={">"} {"{"}
              {"\n"}
              {"  "}
              <span className="text-[#8b949e]">// 에러는 이미 내부에서 처리됨 — 도달 불가</span>
              {"\n"}
              {"}"});
            </CodeBlock>

            <Callout type="warn" icon="⚠️">
              <span className="text-[13px]">
                <strong>주의:</strong> <code className="text-cyan-600">checkForUpdates()</code>는
                7일 이내에 확인한 결과가 있으면 캐시를 사용합니다. 테스트 중 캐시를 초기화하려면
                <code className="text-cyan-600"> ~/.dbcode/update-check.json</code>을 삭제하세요.
                캐시 파일이 손상되어도 에러가 발생하지 않고 새로 확인합니다.
              </span>
            </Callout>

            <DeepDive title="isNewerVersion() — 시맨틱 버전 비교 알고리즘">
              <div className="space-y-3">
                <p>
                  버전 문자열에서 "v" 접두사를 제거하고 "."으로 분리한 뒤 주버전 → 부버전 → 패치
                  순서로 숫자를 비교합니다. 파싱 실패한 부분은 0으로 처리합니다.
                </p>
                <CodeBlock>
                  <span className="text-[#8b949e]">// "v1.2.3" → [1, 2, 3]</span>
                  {"\n"}
                  <span className="text-[#ff7b72]">const</span> parseSemver = (
                  <span className="text-[#ffa657]">v</span>:{" "}
                  <span className="text-[#79c0ff]">string</span>) ={">"}
                  {"\n"}
                  {"  "}v.<span className="text-[#d2a8ff]">replace</span>(/^v/,{" "}
                  <span className="text-[#a5d6ff]">""</span>) .
                  <span className="text-[#d2a8ff]">split</span>(
                  <span className="text-[#a5d6ff]">"."</span>) .
                  <span className="text-[#d2a8ff]">map</span>((s) ={">"} parseInt(s, 10) || 0);
                  {"\n\n"}
                  <span className="text-[#8b949e]">// 비교 예시</span>
                  {"\n"}
                  <span className="text-[#d2a8ff]">isNewerVersion</span>(
                  <span className="text-[#a5d6ff]">"1.2.3"</span>,{" "}
                  <span className="text-[#a5d6ff]">"1.3.0"</span>);{" "}
                  <span className="text-[#8b949e]">// → true (부버전 증가)</span>
                  {"\n"}
                  <span className="text-[#d2a8ff]">isNewerVersion</span>(
                  <span className="text-[#a5d6ff]">"1.2.3"</span>,{" "}
                  <span className="text-[#a5d6ff]">"1.2.3"</span>);{" "}
                  <span className="text-[#8b949e]">// → false (같은 버전)</span>
                  {"\n"}
                  <span className="text-[#d2a8ff]">isNewerVersion</span>(
                  <span className="text-[#a5d6ff]">"2.0.0"</span>,{" "}
                  <span className="text-[#a5d6ff]">"1.9.9"</span>);{" "}
                  <span className="text-[#8b949e]">// → false (현재가 더 최신)</span>
                </CodeBlock>
              </div>
            </DeepDive>
          </section>
        </RevealOnScroll>

        {/* ─── 4. 내부 구현 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>⚙️</span> 내부 구현
            </h2>

            <div className="text-[14px] text-gray-600 leading-[1.85] space-y-4">
              <p>
                <strong className="text-gray-900">fetchLatestVersion() — 5초 타임아웃:</strong>{" "}
                <code className="text-cyan-600">AbortController</code>로 타임아웃을 구현합니다.
                <code className="text-cyan-600"> setTimeout</code>으로 5초 후에{" "}
                <code className="text-cyan-600">controller.abort()</code>를 호출하고, fetch에
                signal을 전달합니다. 타임아웃이나 네트워크 에러 발생 시 null을 반환합니다.
              </p>
              <p>
                <strong className="text-gray-900">상태 파일 구조:</strong>{" "}
                <code className="text-cyan-600">~/.dbcode/update-check.json</code>에는{" "}
                <code className="text-cyan-600">lastCheckTimestamp</code>(Unix 밀리초)와{" "}
                <code className="text-cyan-600">latestVersion</code>(문자열 또는 null)만 저장됩니다.
                저장 실패는 치명적이지 않으므로 조용히 무시합니다.
              </p>
            </div>

            <CodeBlock>
              <span className="text-[#8b949e]">// 5초 타임아웃 구현</span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span> controller ={" "}
              <span className="text-[#ff7b72]">new</span>{" "}
              <span className="text-[#d2a8ff]">AbortController</span>();{"\n"}
              <span className="text-[#ff7b72]">const</span> timeout ={" "}
              <span className="text-[#d2a8ff]">setTimeout</span>(() ={">"} controller.
              <span className="text-[#d2a8ff]">abort</span>(),{" "}
              <span className="text-[#79c0ff]">5_000</span>);{"\n\n"}
              <span className="text-[#ff7b72]">const</span> response ={" "}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#d2a8ff]">fetch</span>(url, {"{"} signal: controller.signal{" "}
              {"}"});{"\n"}
              <span className="text-[#d2a8ff]">clearTimeout</span>(timeout);{"\n\n"}
              <span className="text-[#8b949e]">// 상태 저장 실패 무시</span>
              {"\n"}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#d2a8ff]">writeState</span>(state).
              <span className="text-[#d2a8ff]">catch</span>(() ={">"} {"{"}{" "}
              <span className="text-[#8b949e]">/* 비치명적 */</span> {"}"});
            </CodeBlock>

            <Callout type="info" icon="💡">
              <span className="text-[13px]">
                <strong>CHECK_INTERVAL_MS:</strong> 7일 = 7 × 24 × 60 × 60 × 1000 = 604,800,000ms.
                이 상수를 변경하여 확인 주기를 조정할 수 있습니다. 개발 중에는 0으로 설정하면 항상
                새로 확인합니다.
              </span>
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ─── 5. 트러블슈팅 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🔧</span> 트러블슈팅
            </h2>

            <div className="space-y-5">
              <div className="glass-card p-5 rounded-xl">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-500">Q.</span>
                  업데이트가 있는데 알림이 표시되지 않습니다
                </h4>
                <p className="text-[13px] text-gray-600 leading-[1.8]">
                  <span className="text-emerald-600 font-bold">A.</span> 7일 이내에 이미 확인한
                  결과가 캐시되어 있을 수 있습니다.{" "}
                  <code className="text-cyan-600">~/.dbcode/update-check.json</code>을 삭제하면 다음
                  실행 시 새로 확인합니다. 또한 네트워크가 차단된 환경이라면{" "}
                  <code className="text-cyan-600">fetchLatestVersion()</code>이 null을 반환합니다.
                </p>
              </div>

              <div className="glass-card p-5 rounded-xl">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-500">Q.</span>앱 시작이 5초 이상 걸립니다
                </h4>
                <p className="text-[13px] text-gray-600 leading-[1.8]">
                  <span className="text-emerald-600 font-bold">A.</span>{" "}
                  <code className="text-cyan-600">checkForUpdates()</code>를{" "}
                  <code className="text-cyan-600">await</code> 없이 호출해야 합니다. await를
                  사용하면 최대 5초를 기다립니다. 결과는 Promise 체인으로 처리하거나
                  Fire-and-forget으로 실행하세요. 또한 7일 캐시가 있으면 npm 요청 자체가 없으므로
                  캐시 파일 존재 여부를 확인하세요.
                </p>
              </div>

              <div className="glass-card p-5 rounded-xl">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-500">Q.</span>
                  isNewerVersion()이 예상과 다른 결과를 반환합니다
                </h4>
                <p className="text-[13px] text-gray-600 leading-[1.8]">
                  <span className="text-emerald-600 font-bold">A.</span> 시맨틱 버전이 아닌 형식(예:
                  날짜 기반 버전, 프리릴리즈 태그)은 지원하지 않습니다. "1.0.0-beta.1" 같은
                  프리릴리즈 버전은 "-" 이후 부분이 무시되어 "1.0.0"으로 처리됩니다. 프리릴리즈 버전
                  비교가 필요하면 별도 로직이 필요합니다.
                </p>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* ─── 6. 관련 문서 ─── */}
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
                  name: "agent-loop.ts",
                  slug: "agent-loop",
                  relation: "parent",
                  desc: "앱 시작 시 checkForUpdates()를 백그라운드에서 호출하는 메인 루프입니다.",
                },
                {
                  name: "memory-storage.ts",
                  slug: "memory-storage",
                  relation: "sibling",
                  desc: "비슷한 JSON 파일 캐싱 패턴을 사용합니다. ~/.dbcode/ 디렉토리에 상태를 저장합니다.",
                },
                {
                  name: "session-manager.ts",
                  slug: "session-manager",
                  relation: "sibling",
                  desc: "앱 진입점에서 함께 초기화되는 세션 관리 모듈입니다.",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
