import Link from "next/link";

interface SeeAlsoItem {
  name: string;
  slug: string;
  relation: "parent" | "child" | "sibling";
  desc: string;
}

const relationLabel: Record<string, { icon: string; text: string; color: string }> = {
  parent: { icon: "⬆️", text: "상위 모듈", color: "text-violet-600" },
  child: { icon: "⬇️", text: "하위 모듈", color: "text-emerald-600" },
  sibling: { icon: "↔️", text: "같은 레이어", color: "text-blue-600" },
};

export function SeeAlso({ items }: { items: SeeAlsoItem[] }) {
  return (
    <div
      className="flex flex-col gap-2"
      style={{ display: "flex", flexDirection: "column", gap: "12px" }}
    >
      {items.map((item, i) => {
        const rel = relationLabel[item.relation];
        return (
          <Link
            key={i}
            href={`/docs/${item.slug}`}
            className="group flex items-center gap-3 p-4 border border-[#e2e8f0] rounded-lg hover:bg-gray-50 hover:border-gray-300 hover:shadow-md transition-all duration-200"
            style={{ padding: "16px" }}
          >
            <span>{rel.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-indigo-600 font-mono text-sm font-semibold">{item.name}</span>
                <span className={`text-[10px] font-semibold ${rel.color}`}>{rel.text}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
            </div>
            <span className="text-gray-400 text-sm group-hover:text-gray-600 group-hover:translate-x-1 transition-all duration-200">
              &rarr;
            </span>
          </Link>
        );
      })}
    </div>
  );
}
