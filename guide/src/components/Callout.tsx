interface CalloutProps {
  type: "info" | "warn" | "tip" | "danger";
  icon: string;
  children: React.ReactNode;
}

const typeStyles: Record<string, string> = {
  info: "bg-blue-50 border-l-4 border-l-blue-500",
  warn: "bg-amber-50 border-l-4 border-l-amber-500",
  tip: "bg-emerald-50 border-l-4 border-l-emerald-500",
  danger: "bg-red-50 border-l-4 border-l-red-500",
};

export function Callout({ type, icon, children }: CalloutProps) {
  const isAlertRole = type === "warn" || type === "danger";

  return (
    <div
      className={`flex gap-3 p-4 my-5 rounded-r-lg text-sm text-gray-700 ${typeStyles[type]}`}
      style={{ padding: "16px", margin: "20px 0" }}
      {...(isAlertRole ? { role: "alert" } : {})}
    >
      <span className="text-lg shrink-0" style={{ width: "1.5rem", textAlign: "center" }}>{icon}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}
