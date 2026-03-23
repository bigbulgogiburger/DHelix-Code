const layerConfig: Record<string, { label: string; color: string }> = {
  core: {
    label: "Layer 2: Core",
    color: "bg-violet-100 text-violet-700",
  },
  infra: {
    label: "Layer 3: Infrastructure",
    color: "bg-emerald-100 text-emerald-700",
  },
  leaf: {
    label: "Layer 4: Leaf",
    color: "bg-amber-100 text-amber-700",
  },
  cli: {
    label: "Layer 1: CLI",
    color: "bg-blue-100 text-blue-700",
  },
};

export function LayerBadge({ layer }: { layer: "core" | "infra" | "leaf" | "cli" }) {
  const cfg = layerConfig[layer];
  return (
    <span
      className={`text-xs font-semibold rounded-md ${cfg.color}`}
      style={{ padding: "7px 18px", margin: "4px 0", display: "inline-block" }}
    >
      {cfg.label}
    </span>
  );
}
