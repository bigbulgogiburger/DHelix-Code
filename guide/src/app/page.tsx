import { Navigation } from "@/components/Navigation";
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
      <Navigation />

      {/* Hero */}
      <header className="pt-[130px] pb-[70px] px-8 text-center relative overflow-hidden">
        <div
          className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] pointer-events-none"
          style={{
            background: "radial-gradient(circle at 50% 50%, rgba(139,92,246,0.06) 0%, transparent 50%)",
            animation: "heroGlow 10s ease-in-out infinite alternate",
          }}
        />
        <div className="relative">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-[rgba(139,92,246,0.1)] border border-[rgba(139,92,246,0.2)] rounded-full text-[13px] text-accent-purple font-semibold mb-6">
            Module Deep Dive — TypeScript Source Analysis
          </span>
          <h1 className="text-[clamp(32px,4.5vw,56px)] font-black tracking-tight leading-[1.15] mb-5">
            각 모듈의{" "}
            <span className="bg-gradient-to-r from-accent-purple to-accent-pink bg-clip-text text-transparent">
              내부 구조
            </span>
            를
            <br />
            코드 레벨에서 이해하기
          </h1>
          <p className="text-[17px] text-text-secondary max-w-[680px] mx-auto">
            architecture.html이 &ldquo;무엇이 있는지&rdquo; 보여줬다면, 이 문서는 &ldquo;어떻게 동작하는지&rdquo;를 TS 코드와 함께 보여줍니다.
            각 모듈의 상태 흐름, 핵심 인터페이스, 구현 방향을 담았습니다.
          </p>
        </div>
      </header>

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

      <footer className="py-12 border-t border-border text-center text-text-muted text-[13px]">
        <div className="max-w-[1400px] mx-auto px-8">
          <p className="mb-2">
            <strong className="text-text-primary">dbcode</strong> Module Deep Dive Documentation
          </p>
          <p>Built with Next.js, Tailwind CSS &amp; Mermaid.js</p>
        </div>
      </footer>
    </>
  );
}
