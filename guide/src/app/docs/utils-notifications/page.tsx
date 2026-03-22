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

export default function UtilsNotificationsPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/utils/notifications.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">Notifications</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              크로스 플랫폼(macOS/Linux/Windows) 데스크톱 알림을 전송하는 유틸리티 모듈입니다.
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
                <code className="text-cyan-600">notifications.ts</code>는 각 OS에 맞는 네이티브
                도구를 사용하여 데스크톱 알림을 보내는 모듈입니다. macOS에서는
                <code className="text-cyan-600">osascript</code>(AppleScript), Linux에서는{" "}
                <code className="text-cyan-600">notify-send</code>, Windows에서는{" "}
                <code className="text-cyan-600">PowerShell BalloonTip</code>을 사용합니다.
              </p>
              <p>
                이 모듈은 3개의 파일로 구성된 알림 시스템의 핵심입니다:
                <code className="text-cyan-600">notification-config.ts</code>가 설정을 정의하고,
                <code className="text-cyan-600">notifications.ts</code>가 OS별 알림 전송을 구현하며,
                <code className="text-cyan-600">notification-triggers.ts</code>가 이벤트 버스와
                알림을 연결합니다.
              </p>
              <p>
                핵심 설계 원칙은 <strong>&quot;절대 실패하지 않는다&quot;</strong>입니다. 알림
                도구가 없거나 에러가 발생해도 예외를 던지지 않고 <code>false</code>를 반환합니다.
                알림 실패가 메인 앱의 동작을 방해해서는 안 되기 때문입니다.
              </p>
            </div>

            <MermaidDiagram
              title="알림 시스템 3-파일 아키텍처"
              titleColor="purple"
              chart={`graph TD
  EVENTS["AppEventEmitter<br/><small>이벤트 버스</small>"]
  TRIGGERS["notification-triggers.ts<br/><small>이벤트 → 알림 연결</small>"]
  CONFIG["notification-config.ts<br/><small>설정값 정의</small>"]
  NOTIF["notifications.ts<br/><small>OS별 알림 전송</small>"]
  MAC["macOS<br/><small>osascript</small>"]
  LINUX["Linux<br/><small>notify-send</small>"]
  WIN["Windows<br/><small>PowerShell</small>"]

  EVENTS -->|"agent:iteration<br/>agent:assistant-message<br/>llm:error"| TRIGGERS
  CONFIG -->|"enabled, minDuration, sound"| TRIGGERS
  TRIGGERS -->|"sendNotification()"| NOTIF
  NOTIF --> MAC
  NOTIF --> LINUX
  NOTIF --> WIN

  style NOTIF fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style TRIGGERS fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style CONFIG fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style EVENTS fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style MAC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style LINUX fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style WIN fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 집에서 세탁기를 돌려놓고 다른 방에 있으면 끝났는지 알 수
              없습니다. 이 모듈은 세탁기에 부저를 달아주는 역할입니다. 에이전트가 오래 걸리는 작업을
              마치면 OS 알림 센터를 통해 &quot;작업 완료!&quot;를 알려줍니다.
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

            {/* NotificationOptions */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface NotificationOptions
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              <code className="text-cyan-600">sendNotification()</code>에 전달하는 옵션입니다.
            </p>
            <ParamTable
              params={[
                { name: "title", type: "string", required: true, desc: "알림 제목 (예: 'dbcode')" },
                {
                  name: "message",
                  type: "string",
                  required: true,
                  desc: "알림 본문 메시지 (예: 'Task completed in 45s')",
                },
                {
                  name: "sound",
                  type: "boolean",
                  required: false,
                  desc: "알림과 함께 사운드를 재생할지 여부 (macOS에서만 지원)",
                },
                {
                  name: "icon",
                  type: "string",
                  required: false,
                  desc: "아이콘 경로 (Linux에서 notify-send의 --icon 옵션으로 전달)",
                },
              ]}
            />

            {/* NotificationConfig */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface NotificationConfig
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              <code className="text-cyan-600">notification-config.ts</code>에 정의된 알림
              설정입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "enabled",
                  type: "boolean",
                  required: true,
                  desc: "데스크톱 알림 활성화 여부 (기본값: true)",
                },
                {
                  name: "minDurationSeconds",
                  type: "number",
                  required: true,
                  desc: "알림을 보내기 위한 최소 작업 시간 (초, 기본값: 30)",
                },
                {
                  name: "sound",
                  type: "boolean",
                  required: true,
                  desc: "알림에 사운드 포함 여부 (기본값: false)",
                },
              ]}
            />

            {/* DEFAULT_NOTIFICATION_CONFIG */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              const DEFAULT_NOTIFICATION_CONFIG
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              기본 알림 설정값입니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span>{" "}
              <span className="prop">DEFAULT_NOTIFICATION_CONFIG</span>:{" "}
              <span className="type">NotificationConfig</span> = {"{"}
              {"\n"}
              {"  "}
              <span className="prop">enabled</span>: <span className="kw">true</span>,{" "}
              <span className="cm">{"// 알림 켜짐"}</span>
              {"\n"}
              {"  "}
              <span className="prop">minDurationSeconds</span>: <span className="num">30</span>,{" "}
              <span className="cm">{"// 30초 이상 걸린 작업만"}</span>
              {"\n"}
              {"  "}
              <span className="prop">sound</span>: <span className="kw">false</span>,{" "}
              <span className="cm">{"// 소리 없음"}</span>
              {"\n"}
              {"}"};
            </CodeBlock>

            {/* sendNotification */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              sendNotification(options)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              현재 OS를 감지하여 적절한 네이티브 도구로 데스크톱 알림을 전송합니다. 절대 예외를
              던지지 않습니다.
            </p>
            <CodeBlock>
              <span className="kw">export async function</span>{" "}
              <span className="fn">sendNotification</span>({"\n"}
              {"  "}
              <span className="prop">options</span>:{" "}
              <span className="type">NotificationOptions</span>
              {"\n"}): <span className="type">Promise</span>&lt;
              <span className="type">boolean</span>&gt;
              {"\n"}
              <span className="cm">{"// true  → 알림 전송 성공"}</span>
              {"\n"}
              <span className="cm">{"// false → 전송 실패 (조용히 실패, 예외 없음)"}</span>
            </CodeBlock>

            {/* isNotificationAvailable */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              isNotificationAvailable()
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              현재 플랫폼에서 데스크톱 알림을 사용할 수 있는지 확인합니다.
            </p>
            <CodeBlock>
              <span className="kw">export async function</span>{" "}
              <span className="fn">isNotificationAvailable</span>():{" "}
              <span className="type">Promise</span>&lt;<span className="type">boolean</span>&gt;
            </CodeBlock>

            {/* setupNotificationTriggers */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              setupNotificationTriggers(events, options?)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              <code className="text-cyan-600">notification-triggers.ts</code>에 정의된 함수입니다.
              이벤트 버스와 알림을 연결하고, cleanup 함수를 반환합니다.
            </p>
            <CodeBlock>
              <span className="kw">export function</span>{" "}
              <span className="fn">setupNotificationTriggers</span>({"\n"}
              {"  "}
              <span className="prop">events</span>: <span className="type">AppEventEmitter</span>,
              {"\n"}
              {"  "}
              <span className="prop">options</span>?:{" "}
              <span className="type">NotificationTriggerOptions</span>
              {"\n"}): () =&gt; <span className="type">void</span>
              {"\n"}
              <span className="cm">{"// 반환값: cleanup 함수 — 호출 시 모든 리스너 해제"}</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "events",
                  type: "AppEventEmitter",
                  required: true,
                  desc: "mitt 기반 앱 이벤트 에미터",
                },
                {
                  name: "options.minDurationMs",
                  type: "number",
                  required: false,
                  desc: "완료 알림 최소 경과 시간 (밀리초, 기본값: 30000)",
                },
                {
                  name: "options.enabled",
                  type: "boolean",
                  required: false,
                  desc: "알림 활성화 여부 (기본값: true)",
                },
                {
                  name: "options.sound",
                  type: "boolean",
                  required: false,
                  desc: "알림 사운드 포함 여부 (기본값: false)",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                모든 알림 함수는 <strong>절대 예외를 던지지 않습니다</strong>. 실패 시{" "}
                <code className="text-cyan-600">false</code>를 반환하거나 조용히 무시합니다.
              </li>
              <li>
                <code className="text-cyan-600">child.unref()</code>를 호출하여 알림 프로세스가
                Node.js 이벤트 루프를 유지하지 않도록 합니다. 앱이 종료될 때 알림 전송을 기다리지
                않습니다.
              </li>
              <li>
                <code className="text-cyan-600">execCommand()</code>에 5초 타임아웃이 설정되어
                있습니다 (Windows는 10초). 알림 도구가 응답하지 않아도 앱이 멈추지 않습니다.
              </li>
              <li>
                <code className="text-cyan-600">sound</code> 옵션은 macOS에서만 지원됩니다.
                Linux/Windows에서는 무시됩니다.
              </li>
              <li>
                <code className="text-cyan-600">setupNotificationTriggers()</code>는
                <code className="text-cyan-600">enabled=false</code>이면 이벤트 리스너를 등록하지
                않고 no-op cleanup 함수를 반환합니다.
              </li>
            </ul>
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

            {/* 기본 사용법: sendNotification */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              기본 사용법 &mdash; 알림 직접 전송
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              가장 간단한 사용법입니다. 알림을 보내고 결과를 확인합니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"} <span className="fn">sendNotification</span>{" "}
              {"}"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./utils/notifications.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 기본 알림"}</span>
              {"\n"}
              <span className="kw">await</span> <span className="fn">sendNotification</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">title</span>: <span className="str">&quot;dbcode&quot;</span>,
              {"\n"}
              {"  "}
              <span className="prop">message</span>:{" "}
              <span className="str">&quot;작업 완료!&quot;</span>,{"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// 사운드 포함 (macOS만 지원)"}</span>
              {"\n"}
              <span className="kw">await</span> <span className="fn">sendNotification</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">title</span>: <span className="str">&quot;dbcode&quot;</span>,
              {"\n"}
              {"  "}
              <span className="prop">message</span>:{" "}
              <span className="str">&quot;빌드 완료!&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">sound</span>: <span className="kw">true</span>,{"\n"}
              {"}"});
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>sendNotification()</code>은 <code>async</code>이지만,
              대부분의 사용처에서는 <code>void sendNotification(...)</code>으로 fire-and-forget
              패턴을 사용합니다. 알림 결과를 기다릴 필요가 없기 때문입니다.
            </Callout>

            {/* 이벤트 기반 사용법 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 이벤트 기반 자동 알림
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">setupNotificationTriggers()</code>를 사용하면 이벤트
              버스에 자동으로 연결됩니다. 장시간 작업 완료와 LLM 에러를 자동 감지합니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"}{" "}
              <span className="fn">setupNotificationTriggers</span> {"}"}{" "}
              <span className="kw">from</span>{" "}
              <span className="str">&quot;./utils/notification-triggers.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 이벤트 버스에 알림 트리거 연결"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">cleanup</span> ={" "}
              <span className="fn">setupNotificationTriggers</span>(
              <span className="prop">events</span>, {"{"}
              {"\n"}
              {"  "}
              <span className="prop">minDurationMs</span>: <span className="num">60000</span>,{" "}
              <span className="cm">{"// 60초 이상 걸린 작업만 알림"}</span>
              {"\n"}
              {"  "}
              <span className="prop">sound</span>: <span className="kw">true</span>,{" "}
              <span className="cm">{"// 사운드 포함"}</span>
              {"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// 앱 종료 시 리스너 해제"}</span>
              {"\n"}
              <span className="prop">cleanup</span>();
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> <code>setupNotificationTriggers()</code>가 감지하는 이벤트는 두
              가지입니다: (1) <code>agent:assistant-message</code>의 <code>isFinal=true</code>로
              작업 완료를 감지하고, (2) <code>llm:error</code>로 에러 발생을 감지합니다.
            </Callout>

            <DeepDive title="알림 가용성 사전 확인">
              <p className="mb-3">
                알림을 보내기 전에 현재 환경에서 알림이 가능한지 확인할 수 있습니다:
              </p>
              <CodeBlock>
                <span className="kw">import</span> {"{"}{" "}
                <span className="fn">isNotificationAvailable</span> {"}"}{" "}
                <span className="kw">from</span>{" "}
                <span className="str">&quot;./utils/notifications.js&quot;</span>;{"\n"}
                {"\n"}
                <span className="kw">const</span> <span className="prop">available</span> ={" "}
                <span className="kw">await</span>{" "}
                <span className="fn">isNotificationAvailable</span>();
                {"\n"}
                <span className="kw">if</span> (<span className="prop">available</span>) {"{"}
                {"\n"}
                {"  "}
                <span className="cm">{"// 알림 전송 가능"}</span>
                {"\n"}
                {"}"} <span className="kw">else</span> {"{"}
                {"\n"}
                {"  "}
                <span className="cm">{"// Linux: notify-send 미설치"}</span>
                {"\n"}
                {"  "}
                <span className="cm">{"// 또는 지원하지 않는 OS"}</span>
                {"\n"}
                {"}"}
              </CodeBlock>
              <p className="mt-3 text-gray-600">
                macOS에서는 <code className="text-cyan-600">osascript</code>가 항상 설치되어
                있으므로 거의 항상 <code>true</code>를 반환합니다. Linux에서는{" "}
                <code>which notify-send</code>로 확인합니다.
              </p>
            </DeepDive>
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

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              OS별 알림 전송 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">sendNotification()</code>은 플랫폼을 감지한 후 OS별
              전송 함수로 분기합니다.
            </p>

            <MermaidDiagram
              title="OS별 알림 전송 분기"
              titleColor="purple"
              chart={`graph TD
  SEND["sendNotification()"] --> PLAT{"getPlatform()"}

  PLAT -->|"darwin"| MAC["sendMacOSNotification()<br/><small>osascript -e 'display notification ...'</small>"]
  PLAT -->|"linux"| LIN["sendLinuxNotification()<br/><small>notify-send title message</small>"]
  PLAT -->|"win32"| WIN["sendWindowsNotification()<br/><small>PowerShell BalloonTip</small>"]
  PLAT -->|"other"| FALSE["return false"]

  MAC --> EXEC["execCommand()<br/><small>execFile + timeout 5s + unref()</small>"]
  LIN --> EXEC
  WIN --> EXEC2["execCommand()<br/><small>timeout 10s (GUI 렌더링)</small>"]

  EXEC --> RESULT["true / false"]
  EXEC2 --> RESULT

  style SEND fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style PLAT fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style MAC fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style LIN fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style WIN fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style FALSE fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style EXEC fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style EXEC2 fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              이벤트 트리거 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">setupNotificationTriggers()</code>가 이벤트를 어떻게
              처리하는지 보여줍니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// [1] 에이전트 첫 반복 시 시작 시간 기록"}</span>
              {"\n"}
              <span className="prop">events</span>.<span className="fn">on</span>(
              <span className="str">&quot;agent:iteration&quot;</span>, ({"{"}{" "}
              <span className="prop">iteration</span> {"}"}) =&gt; {"{"}
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">iteration</span> ==={" "}
              <span className="num">1</span>) <span className="prop">agentStartTime</span> ={" "}
              <span className="fn">Date.now</span>();
              {"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// [2] 최종 메시지 수신 시 경과 시간 확인 → 알림"}</span>
              {"\n"}
              <span className="prop">events</span>.<span className="fn">on</span>(
              <span className="str">&quot;agent:assistant-message&quot;</span>, ({"{"}{" "}
              <span className="prop">isFinal</span> {"}"}) =&gt; {"{"}
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">isFinal</span> &&{" "}
              <span className="prop">elapsed</span> {">="}{" "}
              <span className="prop">minDurationMs</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">void</span> <span className="fn">sendNotification</span>({"{"}{" "}
              <span className="prop">title</span>: <span className="str">&quot;dbcode&quot;</span>,
              ... {"}"});
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// [3] LLM 에러 발생 시 즉시 에러 알림"}</span>
              {"\n"}
              <span className="prop">events</span>.<span className="fn">on</span>(
              <span className="str">&quot;llm:error&quot;</span>, ({"{"}{" "}
              <span className="prop">error</span> {"}"}) =&gt; {"{"}
              {"\n"}
              {"  "}
              <span className="kw">void</span> <span className="fn">sendNotification</span>({"{"}{" "}
              <span className="prop">title</span>:{" "}
              <span className="str">&quot;dbcode — Error&quot;</span>, ... {"}"});
              {"\n"}
              {"}"});
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong>{" "}
                <code className="text-cyan-600">iteration === 1</code>일 때만 시작 시간을
                기록합니다. 이후 반복에서는 시간을 갱신하지 않습니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong>{" "}
                <code className="text-cyan-600">isFinal=true</code>는 에이전트 루프의 마지막
                메시지를 의미합니다. 경과 시간이 최소 기준 이상이면 완료 알림을 전송합니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> LLM 에러는 경과 시간과 무관하게 즉시
                알림을 전송합니다. 에러 메시지는 200자로 잘라 전송합니다.
              </p>
            </div>

            <DeepDive title="execCommand()와 unref() 상세">
              <p className="mb-3">
                <code className="text-cyan-600">execCommand()</code>는
                <code className="text-cyan-600">child_process.execFile()</code>의 래퍼입니다. 두
                가지 핵심 설계가 있습니다:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <strong>타임아웃:</strong> 기본 5초(Windows 10초) 타임아웃이 설정되어 있어 알림
                  도구가 응답하지 않아도 앱이 멈추지 않습니다.
                </li>
                <li>
                  <strong>unref():</strong> <code className="text-cyan-600">child.unref()</code>를
                  호출하여 자식 프로세스가 Node.js 이벤트 루프를 유지하지 않도록 합니다. 앱이
                  종료되려 할 때 알림 전송 완료를 기다리지 않습니다.
                </li>
              </ul>
              <p className="mt-3 text-amber-600">
                <code>try-catch</code>로 <code>execFile</code> 자체의 에러(파일 없음 등)도 잡습니다.
                어떤 상황에서도 <code>resolve(false)</code>로 처리하여 예외가 전파되지 않습니다.
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

            {/* FAQ 1 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;알림이 나타나지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                플랫폼별로 확인하세요:
              </p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  <strong>macOS:</strong> 시스템 설정 &gt; 알림에서 터미널(또는 해당 앱)의 알림이
                  허용되어 있는지 확인
                </li>
                <li>
                  <strong>Linux:</strong> <code>notify-send</code>가 설치되어 있는지 확인:{" "}
                  <code>which notify-send</code>
                </li>
                <li>
                  <strong>Windows:</strong> PowerShell 실행 정책이 알림 스크립트를 차단하고 있지
                  않은지 확인
                </li>
              </ul>
              <Callout type="tip" icon="*">
                <code>isNotificationAvailable()</code>을 호출하여 알림 가용성을 프로그래밍 방식으로
                확인할 수 있습니다.
              </Callout>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;작업이 오래 걸렸는데 완료 알림이 안 와요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">minDurationSeconds</code> 설정을 확인하세요.
                기본값은 30초이므로, 30초 미만의 작업에서는 알림이 발생하지 않습니다. 또한{" "}
                <code className="text-cyan-600">enabled</code>가 <code>true</code>인지도 확인하세요.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;알림 소리가 나지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">sound</code> 옵션은 macOS에서만 지원됩니다. Linux와
                Windows에서는 이 옵션이 무시됩니다. macOS에서도 &quot;방해 금지&quot; 모드가
                활성화되어 있으면 소리가 나지 않을 수 있습니다.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;알림 메시지에 특수문자가 깨져요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                macOS에서는 <code className="text-cyan-600">escapeAppleScript()</code>가 백슬래시와
                쌍따옴표를 이스케이프합니다. Windows에서는{" "}
                <code className="text-cyan-600">escapePowerShell()</code>이 홑따옴표를
                이스케이프합니다. 이외의 특수문자는 이스케이프되지 않으므로, 알림 메시지에는 단순한
                텍스트를 사용하는 것이 안전합니다.
              </p>
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
                  name: "utils-events",
                  slug: "utils-events",
                  relation: "parent",
                  desc: "mitt 기반 이벤트 버스 — notification-triggers가 구독하는 이벤트의 원천",
                },
                {
                  name: "utils-platform",
                  slug: "utils-platform",
                  relation: "child",
                  desc: "getPlatform() 유틸리티 — OS 감지에 사용",
                },
                {
                  name: "ErrorBanner",
                  slug: "error-banner",
                  relation: "sibling",
                  desc: "터미널 내 에러 배너 — 데스크톱 알림의 시각적 보완 역할",
                },
                {
                  name: "agent-loop",
                  slug: "agent-loop",
                  relation: "parent",
                  desc: "에이전트 루프 — 작업 완료 및 에러 이벤트의 발행자",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
