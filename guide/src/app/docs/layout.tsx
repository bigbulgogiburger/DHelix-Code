import { PrevNextNav } from "@/components/PrevNextNav";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <div className="center-narrow" style={{ paddingBottom: "40px" }}>
        <PrevNextNav />
      </div>
    </>
  );
}
