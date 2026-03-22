interface TroubleshootItemProps {
  question: string;
  children: React.ReactNode;
}

export function TroubleshootItem({ question, children }: TroubleshootItemProps) {
  return (
    <div className="border border-gray-200 rounded-lg bg-white" style={{ padding: "20px", marginBottom: "16px" }}>
      <h3 className="text-base font-semibold text-gray-900" style={{ marginBottom: "12px", marginTop: "0", display: "flex", alignItems: "center", gap: "8px" }}>
        <span className="text-amber-500">Q.</span> {question}
      </h3>
      <div className="text-sm text-gray-700" style={{ lineHeight: "1.75" }}>
        {children}
      </div>
    </div>
  );
}
