const layerConfig: Record<string, { label: string; color: string }> = {
  core: { label: "Layer 2: Core", color: "bg-[rgba(139,92,246,0.1)] text-accent-purple" },
  infra: { label: "Layer 3: Infrastructure", color: "bg-[rgba(16,185,129,0.1)] text-accent-green" },
  leaf: { label: "Layer 4: Leaf", color: "bg-[rgba(245,158,11,0.1)] text-accent-orange" },
  cli: { label: "Layer 1: CLI", color: "bg-[rgba(59,130,246,0.1)] text-accent-blue" },
};

export function LayerBadge({ layer }: { layer: "core" | "infra" | "leaf" | "cli" }) {
  const cfg = layerConfig[layer];
  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}
