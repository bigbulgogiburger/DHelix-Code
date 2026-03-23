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

export default function SecretScannerPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/guardrails/secret-scanner.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4 text-gray-900">
              Secret Scanner
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 max-w-[640px]">
              코드 출력에서 AWS 키, GitHub 토큰, JWT 등{" "}
              <strong className="text-gray-900">28가지 패턴</strong>의 민감 정보를 정규식으로
              탐지하고 <code className="text-cyan-600 text-[13px]">[REDACTED]</code>로 자동 대체하는
              가드레일 모듈입니다.
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

            <p className="text-[14px] text-gray-600 leading-relaxed mb-6">
              AI 코딩 어시스턴트는 파일을 읽고, 코드를 생성하고, 터미널 명령을 실행합니다. 이
              과정에서 <code className="text-cyan-600">.env</code> 파일의 API 키, 데이터베이스 연결
              문자열, 개인키 같은 민감 정보가 LLM 응답에 포함될 수 있습니다.
              <strong className="text-gray-900"> Secret Scanner</strong>는 이런 위협을 사전에
              차단합니다.
            </p>

            <Callout type="danger" icon="🚨">
              <strong>실제 위협 시나리오</strong>
              <br />
              1. 사용자가 <code>.env</code> 파일 분석을 요청 → LLM이 API 키를 응답에 포함
              <br />
              2. <code>git diff</code> 출력에 실수로 커밋된 비밀번호가 노출
              <br />
              3. DB 마이그레이션 스크립트에 하드코딩된 연결 문자열이 컨텍스트에 유입
              <br />
              Secret Scanner가 없으면 이 정보들이 LLM 서버로 전송될 수 있습니다.
            </Callout>

            <MermaidDiagram
              title="Guardrails 시스템 내 Secret Scanner 위치"
              titleColor="red"
              chart={`graph LR
    A["🧑 사용자 입력<br/><small>사용자 요청 입력</small>"] --> B["Agent Loop<br/><small>ReAct 에이전트 루프</small>"]
    B --> C["Tool 실행<br/>(read_file, bash 등)<br/><small>도구 결과 생성</small>"]
    C --> D{{"🛡️ Guardrails<br/><small>보안 검사 게이트</small>"}}
    D --> E["injection-detector<br/><small>프롬프트 주입 탐지</small>"]
    D --> F["entropy-scanner<br/><small>고엔트로피 문자열 탐지</small>"]
    D --> G["<strong>secret-scanner</strong><br/><small>비밀 정보 정규식 탐지</small>"]
    D --> H["path-filter<br/><small>민감 경로 접근 차단</small>"]
    D --> I["command-filter<br/><small>위험 명령어 차단</small>"]
    G --> J["[REDACTED] 처리<br/><small>비밀 정보 마스킹</small>"]
    J --> K["LLM 응답<br/><small>안전한 응답 전달</small>"]

    style G fill:#fee2e2,stroke:#ef4444,color:#991b1b
    style D fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <DeepDive title="왜 서버 측 필터링이 아니라 클라이언트 측에서?">
              <p className="mb-2">
                dbcode는 <strong>로컬 우선(local-first)</strong> 철학을 따릅니다. 비밀 정보가
                네트워크를 타기 <em>전에</em> 클라이언트에서 제거해야 합니다. 서버 측 필터링에
                의존하면 전송 과정에서 이미 노출된 것이므로 의미가 없습니다.
              </p>
              <p>
                또한 자체 호스팅 LLM(<code>LOCAL_API_BASE_URL</code>)을 사용하는 경우에도 동일한
                보호가 적용되어야 하므로, 클라이언트 측 가드레일이 필수적입니다.
              </p>
            </DeepDive>
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

            {/* SecretScanResult 인터페이스 */}
            <h3
              className="text-lg font-bold text-gray-900 flex items-center gap-2"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-accent-purple" />
              <code className="text-violet-600">SecretScanResult</code> 인터페이스
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code>scanForSecrets()</code> 함수의 반환 타입입니다. 모든 프로퍼티가{" "}
              <code className="text-cyan-600">readonly</code>로 선언되어 불변성을 보장합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "found",
                  type: "boolean",
                  required: true,
                  desc: "하나 이상의 비밀 정보가 발견되었는지 여부",
                },
                {
                  name: "redacted",
                  type: "string",
                  required: true,
                  desc: "[REDACTED]로 대체된 텍스트. 비밀 정보가 없으면 원본 그대로 반환",
                },
                {
                  name: "patterns",
                  type: "readonly string[]",
                  required: true,
                  desc: '탐지된 패턴의 이름 목록 (예: ["AWS Access Key", "JWT Token"])',
                },
              ]}
            />

            {/* scanForSecrets 함수 */}
            <h3
              className="text-lg font-bold text-gray-900 flex items-center gap-2"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan" />
              <code className="text-cyan-600">scanForSecrets(text)</code> 함수
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              텍스트에서 28가지 비밀 정보 패턴을 순서대로 검사하고, 매칭되는 부분을{" "}
              <code className="text-red-600">[REDACTED]</code>로 교체합니다. 원본 텍스트는 변경하지
              않고 새로운 문자열을 반환합니다 (순수 함수).
            </p>
            <ParamTable
              params={[
                {
                  name: "text",
                  type: "string",
                  required: true,
                  desc: "비밀 정보를 검사할 텍스트 (도구 실행 출력, 파일 내용 등)",
                },
              ]}
            />

            <Callout type="info" icon="💡">
              <strong>반환값:</strong> <code>SecretScanResult</code> 객체. <code>found</code>가{" "}
              <code>false</code>이면 <code>redacted</code>는 원본 <code>text</code>와 동일합니다.
            </Callout>

            <Callout type="warn" icon="⚠️">
              <strong>주의사항:</strong> 정규식 기반 탐지이므로 100% 완벽하지 않습니다. 새로운
              서비스의 키 형식이 추가되면 패턴 목록을 업데이트해야 합니다. 또한, Base64로 이중
              인코딩된 시크릿은 탐지하지 못할 수 있습니다.
            </Callout>
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

            <p className="text-[13px] text-gray-600 mb-5 leading-relaxed">
              <code>scanForSecrets</code>는 Agent Loop에서 도구 실행 결과를 LLM에 전달하기 전에
              자동으로 호출됩니다. 직접 사용할 수도 있습니다.
            </p>

            {/* 정상 입력 */}
            <h3
              className="text-[15px] font-bold text-emerald-600"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              정상 입력 — 비밀 정보 없음
            </h3>
            <CodeBlock>
              <span className="text-[#7ee787]">import</span>{" "}
              <span className="text-[#e6edf3]">{"{ "}</span>
              <span className="text-[#79c0ff]">scanForSecrets</span>
              <span className="text-[#e6edf3]">{" }"}</span>{" "}
              <span className="text-[#7ee787]">from</span>{" "}
              <span className="text-[#a5d6ff]">{`'./guardrails/secret-scanner.js'`}</span>
              <span className="text-[#e6edf3]">;</span>
              {"\n\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">result</span>{" "}
              <span className="text-[#ff7b72]">=</span>{" "}
              <span className="text-[#d2a8ff]">scanForSecrets</span>
              <span className="text-[#e6edf3]">(</span>
              <span className="text-[#a5d6ff]">{`"const port = 3000;"`}</span>
              <span className="text-[#e6edf3]">);</span>
              {"\n\n"}
              <span className="text-[#8b949e]">{`// result.found    === false`}</span>
              {"\n"}
              <span className="text-[#8b949e]">{`// result.redacted === "const port = 3000;"`}</span>
              {"\n"}
              <span className="text-[#8b949e]">{`// result.patterns === []`}</span>
            </CodeBlock>

            {/* 차단 입력 */}
            <h3
              className="text-[15px] font-bold text-red-600"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              차단 입력 — AWS 키 + DB 연결 문자열
            </h3>
            <CodeBlock>
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">dangerousText</span>{" "}
              <span className="text-[#ff7b72]">=</span>{" "}
              <span className="text-[#a5d6ff]">{`\``}</span>
              {"\n"}
              <span className="text-[#a5d6ff]">{`  AWS_KEY=AKIAIOSFODNN7EXAMPLE`}</span>
              {"\n"}
              <span className="text-[#a5d6ff]">{`  DB_URL=postgresql://admin:s3cret@db.example.com/prod`}</span>
              {"\n"}
              <span className="text-[#a5d6ff]">{`\``}</span>
              <span className="text-[#e6edf3]">;</span>
              {"\n\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">result</span>{" "}
              <span className="text-[#ff7b72]">=</span>{" "}
              <span className="text-[#d2a8ff]">scanForSecrets</span>
              <span className="text-[#e6edf3]">(</span>
              <span className="text-[#79c0ff]">dangerousText</span>
              <span className="text-[#e6edf3]">);</span>
              {"\n\n"}
              <span className="text-[#8b949e]">{`// result.found    === true`}</span>
              {"\n"}
              <span className="text-[#8b949e]">{`// result.redacted === "  AWS_KEY=[REDACTED]\\n  DB_URL=[REDACTED]"`}</span>
              {"\n"}
              <span className="text-[#8b949e]">{`// result.patterns === ["AWS Access Key", "PostgreSQL Connection"]`}</span>
            </CodeBlock>

            <Callout type="warn" icon="⚠️">
              <strong>오탐(False Positive) 가능성</strong>
              <br />
              <code>sk-</code>로 시작하는 20자 이상의 문자열은 모두 OpenAI API 키로 인식됩니다. 예를
              들어 테스트 코드에서 <code>{`sk-abcdefghij1234567890`}</code> 같은 더미 값을 사용하면
              차단됩니다. 이는 의도된 동작입니다 — 안전을 우선합니다.
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ─── 4. 내부 구현 (Internals) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>⚙️</span> 내부 구현
            </h2>

            {/* 탐지 패턴 목록 */}
            <h3
              className="text-lg font-bold text-gray-900"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              28가지 탐지 패턴 전체 목록
            </h3>
            <p className="text-[13px] text-gray-600 mb-5 leading-relaxed">
              패턴은 <strong className="text-gray-900">구체적 → 일반적</strong> 순서로 배치됩니다.
              일반 패턴이 먼저 매칭되면 구체적 패턴의 탐지 기회를 빼앗을 수 있기 때문입니다.
            </p>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden my-4">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr>
                    <th className="p-3 px-4 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                      카테고리
                    </th>
                    <th className="p-3 px-4 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                      패턴 이름
                    </th>
                    <th className="p-3 px-4 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                      탐지 기준
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      cat: "☁️ 클라우드",
                      name: "AWS Access Key",
                      rule: "AKIA 또는 ASIA + 영대문자/숫자 16자",
                    },
                    {
                      cat: "☁️ 클라우드",
                      name: "Google Cloud SA",
                      rule: '"type": "service_account" JSON 패턴',
                    },
                    {
                      cat: "☁️ 클라우드",
                      name: "Azure Connection",
                      rule: "DefaultEndpointsProtocol / AccountKey / SharedAccessSignature",
                    },
                    { cat: "🤖 AI/ML", name: "OpenAI API Key", rule: "sk- + 영숫자 20자 이상" },
                    {
                      cat: "🤖 AI/ML",
                      name: "Anthropic API Key",
                      rule: "sk-ant- + 영숫자/하이픈/밑줄 20자 이상",
                    },
                    { cat: "🐙 Git", name: "GitHub Token", rule: "ghp_ + 영숫자 36자" },
                    { cat: "🐙 Git", name: "GitHub OAuth", rule: "gho_ + 영숫자 36자" },
                    {
                      cat: "🐙 Git",
                      name: "GitHub App Token",
                      rule: "ghu_ / ghs_ / ghr_ + 영숫자 36자",
                    },
                    {
                      cat: "💬 채팅",
                      name: "Slack Token",
                      rule: "xoxb- / xoxp- / xoxs- / xoxa- + 10자 이상",
                    },
                    {
                      cat: "💳 결제",
                      name: "Stripe Secret Key",
                      rule: "sk_live_ 또는 sk_test_ + 영숫자 20자 이상",
                    },
                    {
                      cat: "💳 결제",
                      name: "Stripe Publishable",
                      rule: "pk_live_ 또는 pk_test_ + 영숫자 20자 이상",
                    },
                    {
                      cat: "🔑 개인키",
                      name: "RSA Private Key",
                      rule: "-----BEGIN RSA PRIVATE KEY-----",
                    },
                    {
                      cat: "🔑 개인키",
                      name: "EC Private Key",
                      rule: "-----BEGIN EC PRIVATE KEY-----",
                    },
                    {
                      cat: "🔑 개인키",
                      name: "OpenSSH Private Key",
                      rule: "-----BEGIN OPENSSH PRIVATE KEY-----",
                    },
                    {
                      cat: "🔑 개인키",
                      name: "Generic Private Key",
                      rule: "-----BEGIN PRIVATE KEY-----",
                    },
                    {
                      cat: "🎫 토큰",
                      name: "JWT Token",
                      rule: "eyJ...eyJ...signature (Base64URL 3-part)",
                    },
                    { cat: "📦 레지스트리", name: "npm Token", rule: "npm_ + 영숫자 36자" },
                    { cat: "🌐 SaaS", name: "Heroku API Key", rule: "heroku_api_key = 값" },
                    { cat: "🌐 SaaS", name: "SendGrid API Key", rule: "SG. + 22자 + . + 43자" },
                    {
                      cat: "🌐 SaaS",
                      name: "Twilio Auth Token",
                      rule: "twilio_auth_token = 16진수 32자",
                    },
                    { cat: "🗄️ DB", name: "PostgreSQL Connection", rule: "postgresql://..." },
                    {
                      cat: "🗄️ DB",
                      name: "MongoDB Connection",
                      rule: "mongodb:// 또는 mongodb+srv://...",
                    },
                    { cat: "🗄️ DB", name: "MySQL Connection", rule: "mysql://..." },
                    { cat: "🔓 일반", name: "Password", rule: "password = 값" },
                    { cat: "🔓 일반", name: "Bearer Token", rule: "Bearer + 토큰 문자열" },
                    { cat: "🔓 일반", name: "API Key", rule: "API_KEY = 값" },
                    {
                      cat: "🔓 일반",
                      name: "Generic Secret",
                      rule: "secret/token/credential/auth_key = '8자 이상 값'",
                    },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-blue-50 border-b border-gray-200">
                      <td className="p-2.5 px-4 text-gray-400 whitespace-nowrap">{row.cat}</td>
                      <td className="p-2.5 px-4 font-mono text-cyan-600 font-semibold whitespace-nowrap">
                        {row.name}
                      </td>
                      <td className="p-2.5 px-4 text-gray-600">{row.rule}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 핵심 로직 코드 설명 */}
            <h3
              className="text-lg font-bold text-gray-900"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              핵심 로직: <code className="text-cyan-600">scanForSecrets()</code>
            </h3>

            <CodeBlock>
              <span className="text-[#7ee787]">export function</span>{" "}
              <span className="text-[#d2a8ff]">scanForSecrets</span>
              <span className="text-[#e6edf3]">(</span>
              <span className="text-[#ffa657]">text</span>
              <span className="text-[#ff7b72]">:</span>{" "}
              <span className="text-[#79c0ff]">string</span>
              <span className="text-[#e6edf3]">)</span>
              <span className="text-[#ff7b72]">:</span>{" "}
              <span className="text-[#79c0ff]">SecretScanResult</span>{" "}
              <span className="text-[#e6edf3]">{"{"}</span>
              {"\n"}
              <span className="text-[#e6edf3]">{"  "}</span>
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">matchedPatterns</span>
              <span className="text-[#ff7b72]">:</span>{" "}
              <span className="text-[#79c0ff]">string[]</span>{" "}
              <span className="text-[#ff7b72]">=</span> <span className="text-[#e6edf3]">[];</span>
              {"\n"}
              <span className="text-[#e6edf3]">{"  "}</span>
              <span className="text-[#ff7b72]">let</span>{" "}
              <span className="text-[#79c0ff]">redacted</span>{" "}
              <span className="text-[#ff7b72]">=</span> <span className="text-[#79c0ff]">text</span>
              <span className="text-[#e6edf3]">;</span>
              {"\n\n"}
              <span className="text-[#e6edf3]">{"  "}</span>
              <span className="text-[#ff7b72]">for</span> <span className="text-[#e6edf3]">(</span>
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#e6edf3]">{"{ "}</span>
              <span className="text-[#79c0ff]">name</span>
              <span className="text-[#e6edf3]">,</span>{" "}
              <span className="text-[#79c0ff]">regex</span>
              <span className="text-[#e6edf3]">{" } "}</span>
              <span className="text-[#ff7b72]">of</span>{" "}
              <span className="text-[#79c0ff]">SECRET_PATTERNS</span>
              <span className="text-[#e6edf3]">) {"{"}</span>
              {"\n"}
              <span className="text-[#8b949e]">
                {"    // 🔑 핵심: RegExp 객체를 새로 생성하여 lastIndex 초기화"}
              </span>
              {"\n"}
              <span className="text-[#e6edf3]">{"    "}</span>
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">pattern</span>{" "}
              <span className="text-[#ff7b72]">=</span> <span className="text-[#ff7b72]">new</span>{" "}
              <span className="text-[#d2a8ff]">RegExp</span>
              <span className="text-[#e6edf3]">(regex.source, regex.flags);</span>
              {"\n\n"}
              <span className="text-[#e6edf3]">{"    "}</span>
              <span className="text-[#ff7b72]">if</span>{" "}
              <span className="text-[#e6edf3]">(pattern.</span>
              <span className="text-[#d2a8ff]">test</span>
              <span className="text-[#e6edf3]">(redacted)) {"{"}</span>
              {"\n"}
              <span className="text-[#e6edf3]">{"      "}matchedPatterns.</span>
              <span className="text-[#d2a8ff]">push</span>
              <span className="text-[#e6edf3]">(name);</span>
              {"\n"}
              <span className="text-[#8b949e]">
                {"      // test()가 lastIndex를 변경하므로 새 RegExp로 대체"}
              </span>
              {"\n"}
              <span className="text-[#e6edf3]">{"      "}</span>
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">replacePattern</span>{" "}
              <span className="text-[#ff7b72]">=</span> <span className="text-[#ff7b72]">new</span>{" "}
              <span className="text-[#d2a8ff]">RegExp</span>
              <span className="text-[#e6edf3]">(regex.source, regex.flags);</span>
              {"\n"}
              <span className="text-[#e6edf3]">{"      "}redacted = redacted.</span>
              <span className="text-[#d2a8ff]">replace</span>
              <span className="text-[#e6edf3]">(replacePattern, </span>
              <span className="text-[#a5d6ff]">{`"[REDACTED]"`}</span>
              <span className="text-[#e6edf3]">);</span>
              {"\n"}
              <span className="text-[#e6edf3]">{"    }"}</span>
              {"\n"}
              <span className="text-[#e6edf3]">{"  }"}</span>
              {"\n\n"}
              <span className="text-[#e6edf3]">{"  "}</span>
              <span className="text-[#ff7b72]">return</span>{" "}
              <span className="text-[#e6edf3]">{"{ "}</span>
              <span className="text-[#79c0ff]">found</span>
              <span className="text-[#e6edf3]">: matchedPatterns.length {">"} 0, </span>
              <span className="text-[#79c0ff]">redacted</span>
              <span className="text-[#e6edf3]">, </span>
              <span className="text-[#79c0ff]">patterns</span>
              <span className="text-[#e6edf3]">: matchedPatterns </span>
              <span className="text-[#e6edf3]">{"};"}</span>
              {"\n"}
              <span className="text-[#e6edf3]">{"}"}</span>
            </CodeBlock>

            <DeepDive title="왜 RegExp를 매번 새로 생성하나요?">
              <p className="mb-3">
                JavaScript의 <code>/g</code> (global) 플래그가 붙은 정규식은{" "}
                <strong>상태를 가집니다</strong>.<code>regex.test()</code>를 호출하면 내부적으로{" "}
                <code>lastIndex</code> 프로퍼티가 마지막 매칭 위치로 업데이트됩니다.
              </p>
              <p className="mb-3">
                같은 RegExp 객체로 <code>.test()</code> 후 바로 <code>.replace()</code>를 호출하면,
                <code>lastIndex</code>가 이미 변경된 상태이므로 일부 매칭을 놓칠 수 있습니다.
              </p>
              <p>
                그래서 <code>new RegExp(regex.source, regex.flags)</code>로 매번 새 객체를 생성하여
                <code>lastIndex</code>를 <code>0</code>으로 초기화합니다. 이는 JavaScript 정규식
                작업의 흔한 함정(gotcha)입니다.
              </p>
            </DeepDive>

            <DeepDive title="SECRET_PATTERNS 배열의 순서가 중요한 이유">
              <p className="mb-3">
                패턴은 <strong>구체적 → 일반적</strong> 순서로 배열됩니다. 예를 들어:
              </p>
              <ul className="list-disc list-inside space-y-1 mb-3">
                <li>
                  <code>sk-ant-</code> (Anthropic) 패턴이 <code>sk-</code> (OpenAI) 패턴보다 먼저
                  옵니다
                </li>
                <li>
                  <code>sk_live_</code> (Stripe) 패턴이 일반 <code>API_KEY</code> 패턴보다 먼저
                  옵니다
                </li>
              </ul>
              <p>
                만약 일반 패턴이 먼저 매칭되면, 해당 부분이 <code>[REDACTED]</code>로 대체되어
                구체적 패턴이 매칭할 기회를 잃습니다. <code>patterns</code> 배열에 정확한 패턴
                이름이 기록되어야 디버깅이 가능하므로, 순서가 중요합니다.
              </p>
            </DeepDive>
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

            <div className="flex flex-col gap-4">
              {/* FAQ 1 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-[14px] font-bold text-amber-600 mb-2">
                  Q. 정상적인 코드인데 <code>[REDACTED]</code>로 치환돼요
                </h3>
                <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                  테스트용 더미 키(<code>sk-test1234567890abcdef1234</code>)나 예제 코드의
                  placeholder가 실제 키와 동일한 형식이면 차단됩니다. 이는{" "}
                  <strong>의도된 동작</strong>입니다.
                </p>
                <p className="text-[13px] text-gray-600 leading-relaxed">
                  <strong className="text-gray-900">해결 방법:</strong> 테스트에서는 패턴에 매칭되지
                  않는 짧은 더미 값을 사용하세요. 예: <code>sk-short</code> (20자 미만이므로 OpenAI
                  패턴에 매칭 안 됨)
                </p>
              </div>

              {/* FAQ 2 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-[14px] font-bold text-amber-600 mb-2">
                  Q. <code>password</code>라는 변수명만 있어도 차단돼요
                </h3>
                <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                  <code>Password</code> 패턴은 <code>{`password\\s*[:=]\\s*\\S+`}</code> 형태를
                  탐지합니다. 즉, <code>password = </code> 뒤에 공백이 아닌 문자가 1개 이상 오면
                  매칭됩니다.
                </p>
                <p className="text-[13px] text-gray-600 leading-relaxed">
                  <strong className="text-gray-900">예시:</strong>{" "}
                  <code>{`password = "hello"`}</code> → 차단됨, <code>{`passwordField`}</code> →
                  차단 안 됨 (= 또는 : 없음), <code>{`// password는 필수입니다`}</code> → 차단 안 됨
                </p>
              </div>

              {/* FAQ 3 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-[14px] font-bold text-amber-600 mb-2">
                  Q. Bearer 토큰 관련 문서를 작성하는데 예시가 차단돼요
                </h3>
                <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                  <code>Bearer</code> 뒤에 영숫자, 점, 하이픈, 밑줄로 된 토큰 문자열이 오면
                  탐지됩니다. 문서에서 예시를 보여줄 때는 명확히 가짜임을 알 수 있는 값을
                  사용하세요.
                </p>
                <p className="text-[13px] text-gray-600 leading-relaxed">
                  <strong className="text-gray-900">팁:</strong>{" "}
                  <code>{`Bearer <your-token-here>`}</code> 형태는 <code>{"<"}</code>가 매칭 패턴에
                  포함되지 않으므로 차단되지 않습니다.
                </p>
              </div>

              {/* FAQ 4 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-[14px] font-bold text-amber-600 mb-2">
                  Q. 새로운 서비스의 API 키 형식을 추가하고 싶어요
                </h3>
                <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                  <code>SECRET_PATTERNS</code> 배열에 <code>{"{ name, regex }"}</code> 객체를
                  추가하세요.
                  <strong className="text-gray-900"> 구체적인 패턴일수록 배열 앞쪽</strong>에
                  배치해야 합니다.
                </p>
                <p className="text-[13px] text-gray-600 leading-relaxed">
                  반드시 <code>/g</code> 플래그를 포함하세요. 그래야 텍스트 내 모든 매칭을 찾아
                  대체할 수 있습니다. 추가 후 기존 테스트가 깨지지 않는지 <code>npm test</code>로
                  확인하세요.
                </p>
              </div>

              {/* FAQ 5 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-[14px] font-bold text-amber-600 mb-2">
                  Q. DB 연결 문자열의 호스트 부분만 남기고 비밀번호만 숨길 수 없나요?
                </h3>
                <p className="text-[13px] text-gray-600 leading-relaxed">
                  현재는 연결 문자열 전체(<code>postgresql://...전체...</code>)가{" "}
                  <code>[REDACTED]</code>로 대체됩니다. 부분 마스킹은 지원하지 않습니다. 이는 안전
                  우선(safety-first) 원칙에 따른 의도적 설계입니다 — 호스트명 자체도 내부 인프라
                  정보이므로 노출을 방지합니다.
                </p>
              </div>
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
              items={[
                {
                  name: "injection-detector.ts",
                  slug: "injection-detector",
                  relation: "sibling",
                  desc: "프롬프트 인젝션 공격 탐지 — Secret Scanner와 함께 입력/출력 보안 담당",
                },
                {
                  name: "entropy-scanner.ts",
                  slug: "entropy-scanner",
                  relation: "sibling",
                  desc: "높은 엔트로피 문자열 탐지 — 패턴 매칭이 아닌 통계적 방법으로 비밀 정보 탐지",
                },
                {
                  name: "path-filter.ts",
                  slug: "path-filter",
                  relation: "sibling",
                  desc: "위험 경로 필터링 — /etc/passwd, ~/.ssh 등 민감한 파일 접근 차단",
                },
                {
                  name: "command-filter.ts",
                  slug: "command-filter",
                  relation: "sibling",
                  desc: "위험 명령어 필터링 — rm -rf /, curl | sh 등 파괴적 명령 차단",
                },
                {
                  name: "agent-loop.ts",
                  slug: "agent-loop",
                  relation: "parent",
                  desc: "ReAct 패턴 메인 루프 — 도구 출력에 Secret Scanner를 자동 적용하는 호출자",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
