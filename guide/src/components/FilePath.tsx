export function FilePath({ path }: { path: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-accent-cyan bg-[rgba(6,182,212,0.08)] px-2.5 py-1 rounded-[5px] my-1">
      📄 {path}
    </span>
  );
}
