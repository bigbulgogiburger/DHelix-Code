interface CalloutProps {
  type: "info" | "warn" | "tip" | "danger";
  icon: string;
  children: React.ReactNode;
}

const typeStyles: Record<string, string> = {
  info: "bg-[rgba(59,130,246,0.08)] border-l-[3px] border-l-accent-blue",
  warn: "bg-[rgba(245,158,11,0.08)] border-l-[3px] border-l-accent-orange",
  tip: "bg-[rgba(16,185,129,0.08)] border-l-[3px] border-l-accent-green",
  danger: "bg-[rgba(239,68,68,0.08)] border-l-[3px] border-l-accent-red",
};

export function Callout({ type, icon, children }: CalloutProps) {
  return (
    <div className={`flex gap-3.5 p-[18px] rounded-[10px] my-3.5 text-[13px] ${typeStyles[type]}`}>
      <span className="text-base shrink-0">{icon}</span>
      <div>{children}</div>
    </div>
  );
}
