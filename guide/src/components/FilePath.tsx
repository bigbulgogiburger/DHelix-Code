export function FilePath({ path }: { path: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-sm font-mono text-indigo-600 bg-indigo-50 rounded-md"
      style={{ padding: "6px 14px", display: "inline-flex", marginBottom: "16px" }}
    >
      📄 {path}
    </span>
  );
}
