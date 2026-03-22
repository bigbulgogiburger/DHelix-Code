interface ImplDirectionProps {
  items: string[];
}

export function ImplDirection({ items }: ImplDirectionProps) {
  return (
    <div className="bg-gradient-to-br from-[rgba(139,92,246,0.06)] to-[rgba(59,130,246,0.06)] border border-[rgba(139,92,246,0.15)] rounded-2xl p-6 mt-6">
      <h4 className="text-[15px] font-bold mb-3 flex items-center gap-2">
        🧭 구현 방향 &amp; 확장 포인트
      </h4>
      <ul className="flex flex-col gap-2">
        {items.map((item, i) => (
          <li
            key={i}
            className="text-[13px] text-text-secondary pl-5 relative before:content-['→'] before:absolute before:left-0 before:text-accent-purple before:font-bold"
            dangerouslySetInnerHTML={{ __html: item }}
          />
        ))}
      </ul>
    </div>
  );
}
