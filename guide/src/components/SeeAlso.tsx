import Link from "next/link";

interface SeeAlsoItem {
  name: string;
  slug: string;
  relation: "parent" | "child" | "sibling";
  desc: string;
}

const relationLabel: Record<string, { icon: string; text: string; color: string }> = {
  parent: { icon: "⬆️", text: "상위 모듈", color: "text-accent-purple" },
  child: { icon: "⬇️", text: "하위 모듈", color: "text-accent-green" },
  sibling: { icon: "↔️", text: "같은 레이어", color: "text-accent-blue" },
};

export function SeeAlso({ items }: { items: SeeAlsoItem[] }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => {
        const rel = relationLabel[item.relation];
        return (
          <Link
            key={i}
            href={`/docs/${item.slug}`}
            className="flex items-center gap-3 p-4 bg-bg-card border border-border rounded-xl hover:border-[rgba(59,130,246,0.3)] hover:translate-y-[-1px] transition-all"
          >
            <span>{rel.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-accent-cyan">{item.name}</span>
                <span className={`text-[10px] font-bold ${rel.color}`}>{rel.text}</span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">{item.desc}</p>
            </div>
            <span className="text-text-muted text-sm">→</span>
          </Link>
        );
      })}
    </div>
  );
}
