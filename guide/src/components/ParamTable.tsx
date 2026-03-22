interface Param {
  name: string;
  type: string;
  required: boolean;
  desc: string;
}

export function ParamTable({ params }: { params: Param[] }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden my-4">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className="p-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-text-muted bg-[rgba(255,255,255,0.02)] border-b border-border">이름</th>
            <th className="p-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-text-muted bg-[rgba(255,255,255,0.02)] border-b border-border">타입</th>
            <th className="p-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-text-muted bg-[rgba(255,255,255,0.02)] border-b border-border">필수</th>
            <th className="p-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-text-muted bg-[rgba(255,255,255,0.02)] border-b border-border">설명</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, i) => (
            <tr key={i} className="hover:bg-[rgba(59,130,246,0.03)] border-b border-[rgba(255,255,255,0.03)]">
              <td className="p-3 px-4 font-mono text-accent-cyan font-semibold">{p.name}</td>
              <td className="p-3 px-4 font-mono text-accent-purple text-xs">{p.type}</td>
              <td className="p-3 px-4">
                {p.required ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[rgba(239,68,68,0.1)] text-accent-red">필수</span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[rgba(100,116,139,0.1)] text-text-muted">선택</span>
                )}
              </td>
              <td className="p-3 px-4 text-text-secondary">{p.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
