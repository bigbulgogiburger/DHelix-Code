import Link from "next/link";
import { AgentLoopSection } from "@/components/modules/AgentLoopSection";
import { ContextSection } from "@/components/modules/ContextSection";
import { LLMSection } from "@/components/modules/LLMSection";
import { ToolsSection } from "@/components/modules/ToolsSection";
import { PermissionsSection } from "@/components/modules/PermissionsSection";
import { MCPSection } from "@/components/modules/MCPSection";
import { RecoverySection } from "@/components/modules/RecoverySection";
import { ConfigSection } from "@/components/modules/ConfigSection";
import { SubagentSection } from "@/components/modules/SubagentSection";
import { DataFlowSection } from "@/components/modules/DataFlowSection";

export default function Home() {
  return (
    <>
      {/* Hero */}
      <header
        className="text-center pt-16 pb-12"
        style={{ paddingTop: "80px", paddingBottom: "64px" }}
      >
        <div className="center-wide">
          <span
            className="inline-block bg-indigo-100 text-indigo-700 text-sm font-bold tracking-wide rounded-full"
            style={{ padding: "10px 24px", marginBottom: "28px" }}
          >
            Module Deep Dive — TypeScript Source Analysis
          </span>
          <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-4">
            각 모듈의 내부 구조를
            <br />
            코드 레벨에서 이해하기
          </h1>
          <p
            className="text-lg text-gray-600 leading-relaxed"
            style={{ maxWidth: "40rem", marginLeft: "auto", marginRight: "auto" }}
          >
            architecture.html이 &ldquo;무엇이 있는지&rdquo; 보여줬다면, 이 문서는 &ldquo;어떻게
            동작하는지&rdquo;를 TS 코드와 함께 보여줍니다. 각 모듈의 상태 흐름, 핵심 인터페이스,
            구현 방향을 담았습니다.
          </p>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 bg-indigo-600 rounded-full text-base font-semibold hover:bg-indigo-700 transition-colors"
            style={{ marginTop: "28px", padding: "14px 32px", color: "#ffffff" }}
          >
            모듈 상세 문서 보기
            <span>→</span>
          </Link>
        </div>
      </header>

      {/* Divider */}
      <div className="border-b border-gray-200" style={{ margin: "0" }} />

      <AgentLoopSection />
      <ContextSection />
      <LLMSection />
      <ToolsSection />
      <PermissionsSection />
      <MCPSection />
      <RecoverySection />
      <ConfigSection />
      <SubagentSection />
      <DataFlowSection />

      <footer
        className="border-t border-gray-200 py-12 text-center text-gray-500 text-sm"
        style={{ paddingTop: "48px", paddingBottom: "48px" }}
      >
        <div className="center-wide">
          <p className="mb-2">
            <strong className="text-gray-900">dbcode</strong> Module Deep Dive Documentation
          </p>
          <p>Built with Next.js, Tailwind CSS &amp; Mermaid.js</p>
        </div>
      </footer>
    </>
  );
}
