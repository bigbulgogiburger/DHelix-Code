interface ImplDirectionProps {
  items: string[];
}

export function ImplDirection({ items }: ImplDirectionProps) {
  return (
    <div
      className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 mt-6"
      style={{ padding: "24px", marginTop: "24px" }}
    >
      <h4 className="text-indigo-800 font-semibold text-[15px] mb-3 flex items-center gap-2">
        구현 방향 &amp; 확장 포인트
      </h4>
      <ul
        className="flex flex-col gap-2"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          paddingLeft: 0,
          listStyle: "none",
        }}
      >
        {items.map((item, i) => (
          <li
            key={i}
            className="text-sm text-gray-700"
            style={{ paddingLeft: "20px", position: "relative", marginBottom: 0 }}
          >
            <span className="text-indigo-500 font-bold" style={{ position: "absolute", left: 0 }}>
              →
            </span>
            <span dangerouslySetInnerHTML={{ __html: item }} />
          </li>
        ))}
      </ul>
    </div>
  );
}
