interface SectionHeaderProps {
  label: string;
  labelColor: "blue" | "purple" | "green" | "orange" | "cyan" | "pink" | "red";
  title: string;
  description: string;
}

const colorMap: Record<string, string> = {
  blue: "text-accent-blue bg-[rgba(59,130,246,0.1)]",
  purple: "text-accent-purple bg-[rgba(139,92,246,0.1)]",
  green: "text-accent-green bg-[rgba(16,185,129,0.1)]",
  orange: "text-accent-orange bg-[rgba(245,158,11,0.1)]",
  cyan: "text-accent-cyan bg-[rgba(6,182,212,0.1)]",
  pink: "text-accent-pink bg-[rgba(236,72,153,0.1)]",
  red: "text-accent-red bg-[rgba(239,68,68,0.1)]",
};

export function SectionHeader({ label, labelColor, title, description }: SectionHeaderProps) {
  return (
    <div className="text-center mb-14">
      <span
        className={`inline-block text-[11px] font-bold uppercase tracking-[2px] px-3.5 py-1.5 rounded-md mb-3.5 ${colorMap[labelColor]}`}
      >
        {label}
      </span>
      <h2 className="text-[clamp(26px,3.2vw,38px)] font-extrabold tracking-tight mb-3">
        {title}
      </h2>
      <p className="text-[15px] text-text-secondary max-w-[620px] mx-auto">{description}</p>
    </div>
  );
}
