import { FilePath } from "./FilePath";
import { LayerBadge } from "./LayerBadge";

interface DocPageHeaderProps {
  filePath: string;
  title: string;
  layer: "core" | "infra" | "leaf" | "cli";
  description: string;
}

export function DocPageHeader({ filePath, title, layer, description }: DocPageHeaderProps) {
  return (
    <header style={{ marginBottom: "48px", paddingTop: "40px" }}>
      <FilePath path={filePath} />
      <h1 className="text-3xl font-bold text-gray-900" style={{ marginTop: "16px", marginBottom: "12px" }}>
        {title}
      </h1>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
        <LayerBadge layer={layer} />
        <span className="text-gray-600 text-base">{description}</span>
      </div>
    </header>
  );
}
