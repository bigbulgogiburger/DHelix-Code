interface CodeBlockProps {
  children: React.ReactNode;
}

export function CodeBlock({ children }: CodeBlockProps) {
  return (
    <div className="code-block bg-[#0d1117] border border-border rounded-[10px] p-5 overflow-x-auto font-mono text-[12.5px] leading-[1.8] text-[#e6edf3] my-3.5">
      <pre>{children}</pre>
    </div>
  );
}
