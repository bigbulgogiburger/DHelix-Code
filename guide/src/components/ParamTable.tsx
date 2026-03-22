interface Param {
  name: string;
  type: string;
  required: boolean;
  desc: string;
}

export function ParamTable({ params }: { params: Param[] }) {
  return (
    <div className="border border-[#e2e8f0] rounded-lg overflow-hidden my-6" style={{ margin: "24px 0" }}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth: "500px" }}>
          <thead>
            <tr>
              <th className="p-3 px-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-[#e2e8f0] whitespace-nowrap" style={{ padding: "12px 16px" }}>이름</th>
              <th className="p-3 px-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-[#e2e8f0] whitespace-nowrap" style={{ padding: "12px 16px" }}>타입</th>
              <th className="p-3 px-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-[#e2e8f0]" style={{ padding: "12px 16px" }}>필수</th>
              <th className="p-3 px-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-[#e2e8f0]" style={{ padding: "12px 16px" }}>설명</th>
            </tr>
          </thead>
          <tbody>
            {params.map((p, i) => (
              <tr key={i} className="hover:bg-gray-50 border-b border-gray-100">
                <td className="p-3 px-4 font-mono text-indigo-600 font-semibold whitespace-nowrap" style={{ padding: "12px 16px" }}>{p.name}</td>
                <td className="p-3 px-4 font-mono text-purple-600 text-xs whitespace-nowrap" style={{ padding: "12px 16px" }}>{p.type}</td>
                <td className="p-3 px-4" style={{ padding: "12px 16px" }}>
                  {p.required ? (
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-100 text-red-700">필수</span>
                  ) : (
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-500">선택</span>
                  )}
                </td>
                <td className="p-3 px-4 text-gray-600" style={{ padding: "12px 16px", wordBreak: "break-word" }}>{p.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
