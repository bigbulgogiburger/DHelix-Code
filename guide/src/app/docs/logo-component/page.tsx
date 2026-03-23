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

export default function LogoComponentPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/cli/components/Logo.tsx" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">Logo</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="cli" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              dbcode 브랜드 로고를 터미널에 렌더링하는 컴포넌트입니다. Ink React 컴포넌트와 직접
              stdout 출력 함수 두 가지 방식을 제공하며, 유니코드 블록 문자와 ANSI 색상으로 DB 로고를
              표현합니다.
            </p>
          </div>
        </RevealOnScroll>

        {/* ─── 1. 개요 (Overview) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>📋</span> 개요
            </h2>
            <div className="text-[14px] text-gray-600 leading-[1.85] mb-8 space-y-3">
              <p>
                <code className="text-cyan-600">Logo.tsx</code>는 두 가지 렌더링 방식을 제공합니다.
                첫 번째는 <code className="text-cyan-600">Logo</code> React 컴포넌트로, Ink 렌더
                트리 내부에서 사용합니다. 두 번째는{" "}
                <code className="text-cyan-600">printStartupLogo()</code> 함수로, Ink가 시작되기
                전에 stdout에 직접 출력하여 깜빡임(flicker)을 방지합니다.
              </p>
              <p>
                로고 그래픽 데이터(<code className="text-cyan-600">DB_LOGO</code>)는 원본 SVG를
                chafa(이미지→유니코드 변환 도구)로 변환한 결과입니다. 유니코드 블록 문자(▘, ▜, █
                등)와 16진수 색상 코드로 주황색 반원, 파란색 물방울, 초록색 물방울, "DB" 텍스트를
                표현합니다.
              </p>
              <p>
                <code className="text-cyan-600">Logo</code> 컴포넌트는 버전 문자열과 현재 모델명을
                표시하는 헤더 라인을 자동으로 추가합니다.{" "}
                <code className="text-cyan-600">showLogo</code> prop으로 그래픽을 숨기고 텍스트만
                표시할 수 있습니다.
              </p>
            </div>

            <MermaidDiagram
              title="Logo 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  IDX["src/index.ts<br/><small>CLI 진입점</small>"]
  APP["App.tsx<br/><small>루트 컴포넌트</small>"]
  LOGO["Logo<br/><small>cli/components/Logo.tsx</small>"]
  PSL["printStartupLogo()<br/><small>Ink 시작 전 직접 출력</small>"]
  CONST["constants.ts<br/><small>VERSION, APP_NAME</small>"]
  CHALK["chalk<br/><small>ANSI 색상 라이브러리</small>"]
  INK["ink Box/Text<br/><small>React 렌더링</small>"]

  IDX -->|"앱 시작 시 호출"| PSL
  APP -->|"초기 화면 렌더링"| LOGO
  LOGO -->|"버전/앱명"| CONST
  LOGO -->|"Box/Text 렌더링"| INK
  PSL -->|"버전/앱명"| CONST
  PSL -->|"ANSI 색상 적용"| CHALK

  style LOGO fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style PSL fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style IDX fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style APP fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CONST fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>두 가지 렌더링 방식의 이유:</strong>{" "}
              <code className="text-cyan-600">printStartupLogo()</code>는 Ink가 동적 영역을
              초기화하기 전에 로고를 한 번만 출력합니다. Ink가 시작되면 터미널을 제어하기 때문에,
              이후에 렌더링된 내용은 업데이트 시 다시 그려집니다. 로고를 Ink 외부에서 먼저 출력하면
              깜빡임 없이 안정적인 스타트업 화면을 제공할 수 있습니다.
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ─── 2. 레퍼런스 (Reference) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>📖</span> 레퍼런스
            </h2>

            {/* LogoProps */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface LogoProps
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              <code className="text-cyan-600">Logo</code> Ink 컴포넌트에 전달하는 props입니다. 모든
              prop은 선택 사항입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "version",
                  type: "string",
                  required: false,
                  desc: "표시할 버전 문자열. 기본값: constants.ts의 VERSION 상수.",
                },
                {
                  name: "modelName",
                  type: "string",
                  required: false,
                  desc: "현재 사용 중인 모델명. 제공 시 버전 라인 옆에 회색으로 표시됩니다.",
                },
                {
                  name: "showLogo",
                  type: "boolean",
                  required: false,
                  desc: "로고 그래픽 표시 여부. 기본값: true. false이면 버전/모델 텍스트만 표시됩니다.",
                },
              ]}
            />

            {/* Segment 타입 */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "40px", marginBottom: "16px" }}
            >
              interface Segment (내부)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              <code className="text-cyan-600">DB_LOGO</code> 배열의 각 행을 구성하는 세그먼트
              타입입니다. 각 세그먼트는 유니코드 텍스트 + 전경색(fg) + 배경색(bg)을 가집니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "text",
                  type: "string",
                  required: true,
                  desc: "유니코드 블록 문자 또는 공백. 터미널에 직접 출력됩니다.",
                },
                {
                  name: "color",
                  type: "string",
                  required: false,
                  desc: "전경색 (16진수, 예: '#0C7093'). Ink의 color prop 또는 chalk.hex()에 전달됩니다.",
                },
                {
                  name: "bgColor",
                  type: "string",
                  required: false,
                  desc: "배경색 (16진수). Ink의 backgroundColor prop 또는 chalk.bgHex()에 전달됩니다.",
                },
              ]}
            />

            {/* printStartupLogo 함수 */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "40px", marginBottom: "16px" }}
            >
              function printStartupLogo(modelName?, version?)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              Ink 렌더링 시작 전에 로고를 stdout에 직접 출력합니다.{" "}
              <code className="text-cyan-600">src/index.ts</code>에서 앱 부팅 시 호출됩니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "modelName",
                  type: "string",
                  required: false,
                  desc: "모델명 (선택적). 버전 라인 옆에 회색으로 표시됩니다.",
                },
                {
                  name: "version",
                  type: "string",
                  required: false,
                  desc: "버전 문자열. 기본값: constants.ts의 VERSION 상수.",
                },
              ]}
            />
          </section>
        </RevealOnScroll>

        {/* ─── 3. 사용법 (Usage) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🚀</span> 사용법
            </h2>

            <h3
              className="text-base font-bold text-gray-900"
              style={{ marginBottom: "12px", marginTop: "0" }}
            >
              1. Ink 컴포넌트로 사용 (App.tsx 내부)
            </h3>
            <CodeBlock
              language="tsx"
              code={`import { Logo } from "./components/Logo.js";

// 기본 사용 — 로고 + 버전 표시
<Logo />

// 모델명 포함
<Logo modelName="claude-sonnet-4-20250514" />

// 로고 그래픽 없이 텍스트만
<Logo showLogo={false} version="1.2.3" />`}
            />

            <h3
              className="text-base font-bold text-gray-900"
              style={{ marginBottom: "12px", marginTop: "32px" }}
            >
              2. Ink 시작 전 직접 출력 (index.ts)
            </h3>
            <CodeBlock
              language="typescript"
              code={`import { printStartupLogo } from "./cli/components/Logo.js";

// Ink render() 호출 전에 실행
printStartupLogo("gpt-4o");

// 이후 Ink 시작
const { unmount } = render(<App ... />);`}
            />

            <Callout type="warn" icon="⚠️">
              <strong>순서 주의:</strong> <code className="text-cyan-600">printStartupLogo()</code>
              는 반드시 <code className="text-cyan-600">render()</code> 호출 전에 실행해야 합니다.
              Ink가 터미널 제어권을 가진 후에 호출하면 로고가 Ink의 동적 렌더링 영역과 겹쳐서 화면이
              깨질 수 있습니다.
            </Callout>

            <DeepDive title="DB_LOGO 데이터 구조 이해하기">
              <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
                <code className="text-cyan-600">DB_LOGO</code>는{" "}
                <code className="text-cyan-600">readonly (readonly Segment[])[]</code> 타입의 6행
                배열입니다. 각 행은 여러 개의 Segment로 구성되며, 각 Segment는 유니코드 블록 문자와
                색상 정보를 포함합니다.
              </p>
              <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
                원본 DB SVG 로고를 chafa 도구로 변환하면 각 픽셀 영역이 유니코드 블록 문자(▘▜█▌
                등)에 가장 가까운 색상으로 매핑됩니다. 색상은 16진수 RGB 값으로 보존됩니다.
              </p>
              <CodeBlock
                language="typescript"
                code={`// DB_LOGO 구조 예시 (실제 첫 번째 행)
const DB_LOGO = [
  // 행 0: 파란색 물방울 상단
  [
    { text: "   " },  // 공백
    { text: "▕", color: "#0C7093" },
    { text: "▔", color: "#0D84B4", bgColor: "#10A2DD" },
    // ...
  ],
  // 행 1~5: 나머지 로고 부분
];`}
              />
            </DeepDive>
          </section>
        </RevealOnScroll>

        {/* ─── 4. 내부 구현 (Implementation) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>⚙️</span> 내부 구현
            </h2>

            <MermaidDiagram
              title="Logo 렌더링 흐름"
              titleColor="cyan"
              chart={`sequenceDiagram
  participant IDX as index.ts
  participant PSL as printStartupLogo()
  participant INK as Ink render()
  participant APP as App.tsx
  participant LOGO as Logo 컴포넌트

  IDX->>PSL: printStartupLogo(modelName)
  PSL->>PSL: DB_LOGO 순회
  PSL->>PSL: chalk.hex(color).bgHex(bgColor)(text)
  PSL->>IDX: process.stdout.write(행별 출력)
  Note over IDX,PSL: Ink 시작 전 로고 출력 완료

  IDX->>INK: render(<App />)
  INK->>APP: 마운트
  APP->>LOGO: <Logo modelName={model} />
  LOGO->>LOGO: DB_LOGO.map() → Ink Text/Box
  LOGO->>INK: 렌더 트리 반환`}
            />

            <div style={{ marginTop: "32px" }}>
              <h3 className="text-base font-bold text-gray-900" style={{ marginBottom: "12px" }}>
                Logo React 컴포넌트 구현
              </h3>
              <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
                Ink의 <code className="text-cyan-600">Box</code>와{" "}
                <code className="text-cyan-600">Text</code>를 사용하여 DB_LOGO 데이터를
                렌더링합니다. 각 세그먼트의 color/bgColor를 Ink의 color/backgroundColor prop에 직접
                전달합니다.
              </p>
              <CodeBlock
                language="tsx"
                code={`export function Logo({ version = VERSION, modelName, showLogo = true }: LogoProps) {
  return (
    <Box flexDirection="column">
      {showLogo &&
        DB_LOGO.map((segments, lineIdx) => (
          <Text key={lineIdx}>
            {segments.map((seg, segIdx) => (
              <Text key={segIdx} color={seg.color} backgroundColor={seg.bgColor}>
                {seg.text}
              </Text>
            ))}
          </Text>
        ))}
      <Box flexDirection="row" gap={1} marginTop={showLogo ? 1 : 0}>
        <Text bold color="cyan">
          {APP_NAME} v{version}
        </Text>
        {modelName && (
          <Text dimColor color="gray">
            Model: {modelName}
          </Text>
        )}
      </Box>
      <Text dimColor>AI Coding Assistant</Text>
    </Box>
  );
}`}
              />
            </div>

            <div style={{ marginTop: "32px" }}>
              <h3 className="text-base font-bold text-gray-900" style={{ marginBottom: "12px" }}>
                printStartupLogo 구현
              </h3>
              <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
                chalk 라이브러리로 ANSI 색상을 적용하여 각 행을{" "}
                <code className="text-cyan-600">process.stdout.write()</code>로 직접 출력합니다.
                세그먼트의 color/bgColor 조합에 따라 chalk 메서드를 선택합니다.
              </p>
              <CodeBlock
                language="typescript"
                code={`export function printStartupLogo(modelName?: string, version: string = VERSION): void {
  for (const segments of DB_LOGO) {
    let line = "";
    for (const seg of segments) {
      let styled = seg.text;
      if (seg.color && seg.bgColor) {
        styled = chalk.hex(seg.color).bgHex(seg.bgColor)(seg.text);
      } else if (seg.color) {
        styled = chalk.hex(seg.color)(seg.text);
      } else if (seg.bgColor) {
        styled = chalk.bgHex(seg.bgColor)(seg.text);
      }
      line += styled;
    }
    process.stdout.write(line + "\\n");
  }

  const versionLine =
    chalk.bold.cyan(\`\${APP_NAME} v\${version}\`) +
    (modelName ? " " + chalk.gray(\`Model: \${modelName}\`) : "");
  process.stdout.write("\\n" + versionLine + "\\n");
  process.stdout.write(chalk.gray("AI Coding Assistant") + "\\n\\n");
}`}
              />
            </div>

            <MermaidDiagram
              title="Segment 색상 처리 로직"
              titleColor="purple"
              chart={`flowchart TD
  SEG["Segment 처리"]
  HAS_BOTH{"color && bgColor?"}
  HAS_COLOR{"color만?"}
  HAS_BG{"bgColor만?"}
  BOTH["chalk.hex(color).bgHex(bgColor)(text)"]
  COLOR_ONLY["chalk.hex(color)(text)"]
  BG_ONLY["chalk.bgHex(bgColor)(text)"]
  PLAIN["text 그대로"]

  SEG --> HAS_BOTH
  HAS_BOTH -->|"Yes"| BOTH
  HAS_BOTH -->|"No"| HAS_COLOR
  HAS_COLOR -->|"Yes"| COLOR_ONLY
  HAS_COLOR -->|"No"| HAS_BG
  HAS_BG -->|"Yes"| BG_ONLY
  HAS_BG -->|"No"| PLAIN

  style SEG fill:#2a1e4a,stroke:#8b5cf6,color:#f1f5f9
  style BOTH fill:#1e3a2a,stroke:#22c55e,color:#f1f5f9
  style COLOR_ONLY fill:#1e3a2a,stroke:#22c55e,color:#f1f5f9
  style BG_ONLY fill:#1e3a2a,stroke:#22c55e,color:#f1f5f9`}
            />
          </section>
        </RevealOnScroll>

        {/* ─── 5. 트러블슈팅 (Troubleshooting) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🔧</span> 트러블슈팅
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-2">
                  로고가 깨지거나 이상한 문자로 표시됩니다
                </h3>
                <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                  터미널이 유니코드 블록 문자를 지원하지 않거나, 폰트가 이 문자를 포함하지 않을 때
                  발생합니다. 해결 방법:
                </p>
                <ul className="text-[13px] text-gray-600 list-disc pl-5 space-y-1">
                  <li>
                    <strong>터미널 변경</strong>: iTerm2, Alacritty, Windows Terminal 등 유니코드를
                    완전히 지원하는 터미널을 사용하세요.
                  </li>
                  <li>
                    <strong>폰트 변경</strong>: Nerd Fonts 계열 또는 monospace 폰트로 변경하세요.
                  </li>
                  <li>
                    <strong>인코딩 확인</strong>: 터미널 인코딩이 UTF-8로 설정되어 있는지
                    확인하세요.
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-base font-bold text-gray-900 mb-2">로고가 두 번 표시됩니다</h3>
                <p className="text-[13px] text-gray-600 leading-relaxed">
                  <code className="text-cyan-600">printStartupLogo()</code>와{" "}
                  <code className="text-cyan-600">Logo</code> 컴포넌트가 둘 다 사용된 경우입니다.
                  일반적으로 <code className="text-cyan-600">printStartupLogo()</code>만 사용하고
                  App.tsx에서는 <code className="text-cyan-600">Logo</code>를 마운트하지 않거나,
                  반대로 컴포넌트만 사용해야 합니다.
                </p>
              </div>

              <div>
                <h3 className="text-base font-bold text-gray-900 mb-2">
                  색상이 전혀 표시되지 않습니다
                </h3>
                <p className="text-[13px] text-gray-600 leading-relaxed">
                  chalk가 색상 지원 여부를 자동 감지합니다. CI 환경이나 색상 미지원 터미널에서는
                  색상이 비활성화됩니다. 강제로 색상을 활성화하려면 환경변수{" "}
                  <code className="text-cyan-600">FORCE_COLOR=1</code>을 설정하세요.
                </p>
              </div>

              <div>
                <h3 className="text-base font-bold text-gray-900 mb-2">
                  로고 없이 버전만 표시하고 싶습니다
                </h3>
                <p className="text-[13px] text-gray-600 leading-relaxed">
                  <code className="text-cyan-600">Logo</code> 컴포넌트를 사용할 때{" "}
                  <code className="text-cyan-600">showLogo={"{false}"}</code> prop을 전달하면 그래픽
                  없이 버전과 모델명 텍스트만 표시됩니다.
                </p>
              </div>

              <Callout type="warn" icon="⚠️">
                <strong>Windows 환경 주의:</strong> Windows 기본 cmd.exe나 구형 PowerShell은
                유니코드 블록 문자를 제대로 렌더링하지 못합니다. Windows Terminal(wtd.exe) 또는 Git
                Bash를 사용하세요. WSL(Windows Subsystem for Linux) 환경에서는 정상적으로
                표시됩니다.
              </Callout>
            </div>
          </section>
        </RevealOnScroll>

        {/* ─── 6. 관련 문서 (See Also) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🔗</span> 관련 문서
            </h2>
            <SeeAlso
              links={[
                {
                  href: "/docs/app-entry",
                  title: "App Entry (App.tsx)",
                  desc: "Logo 컴포넌트를 마운트하는 루트 컴포넌트",
                },
                {
                  href: "/docs/status-bar",
                  title: "StatusBar",
                  desc: "모델명과 버전을 하단에 표시하는 상태 바 컴포넌트",
                },
                {
                  href: "/docs/rendering-engine",
                  title: "Rendering Engine",
                  desc: "터미널 출력과 ANSI 색상을 담당하는 렌더링 엔진",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
