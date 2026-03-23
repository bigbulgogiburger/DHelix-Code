interface SectionHeaderProps {
  label: string;
  labelColor: "blue" | "purple" | "green" | "orange" | "cyan" | "pink" | "red";
  title: string;
  description: string;
}

const colorMap: Record<string, string> = {
  blue: "bg-blue-100 text-blue-700",
  purple: "bg-violet-100 text-violet-700",
  green: "bg-emerald-100 text-emerald-700",
  orange: "bg-amber-100 text-amber-700",
  cyan: "bg-cyan-100 text-cyan-700",
  pink: "bg-pink-100 text-pink-700",
  red: "bg-red-100 text-red-700",
};

export function SectionHeader({ label, labelColor, title, description }: SectionHeaderProps) {
  return (
    <div className="text-center mb-14" style={{ textAlign: "center", marginBottom: "48px" }}>
      <span
        className={`inline-block text-xs font-bold uppercase tracking-[2px] rounded-md ${colorMap[labelColor]}`}
        style={{ padding: "8px 20px", marginBottom: "16px", display: "inline-block" }}
      >
        {label}
      </span>
      <h2
        className="text-[clamp(26px,3.2vw,38px)] font-extrabold tracking-tight mb-3 text-gray-900"
        style={{ marginBottom: "12px" }}
      >
        {title}
      </h2>
      <p
        className="text-[15px] text-gray-600 max-w-[620px]"
        style={{ maxWidth: "600px", marginLeft: "auto", marginRight: "auto" }}
      >
        {description}
      </p>
    </div>
  );
}
