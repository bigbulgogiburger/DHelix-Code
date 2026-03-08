import { Box, Text } from "ink";
import chalk from "chalk";
import { VERSION, APP_NAME } from "../../constants.js";

interface Segment {
  readonly text: string;
  readonly color?: string;
  readonly bgColor?: string;
}

/**
 * DB brand logo converted from original SVG via chafa (image-to-unicode).
 * Three shapes: orange half-circle (left), blue teardrop (top), green teardrop (right)
 * Plus "DB" text in dark green — gradient colors preserved from the original.
 */

// prettier-ignore
const DB_LOGO: readonly (readonly Segment[])[] = [
  [{ text: "   " }, { text: "\u2595", color: "#0C7093" }, { text: "\u2594", color: "#0D84B4", bgColor: "#10A2DD" }, { text: "\u2594", bgColor: "#0A85C4" }, { text: "\u2584", color: "#04619D" }],
  [{ text: "   " }, { text: "\u2595", color: "#12A4D7" }, { text: "\u2595", color: "#1499D3", bgColor: "#11A3DD" }, { text: "\u2581", color: "#409AB2", bgColor: "#0A8BCC" }, { text: "\u258c", color: "#0679C0", bgColor: "#036EB9" }, { text: "\u258e  ", color: "#005EA5" }, { text: "\u2582", color: "#005830" }, { text: "\u2582", color: "#006B3B" }, { text: "\u2582", color: "#006638" }, { text: "\u2581 ", color: "#004928" }, { text: " " }, { text: "\u2582\u2582", color: "#006B3B" }, { text: "\u2581", color: "#007D45" }],
  [{ text: "\u258f", color: "#931E1E", bgColor: "#D43C27" }, { text: "\u2594", color: "#AC451A", bgColor: "#E76022" }, { text: "\u2585", color: "#E9731D" }, { text: "\u2596", color: "#824010" }, { text: "\u258c", color: "#12A7E0", bgColor: "#7EC057" }, { text: "\u2594", color: "#8AC441", bgColor: "#8BC53F" }, { text: "\u2594", color: "#3189A1", bgColor: "#79BD45" }, { text: "\u2584", color: "#4BA544" }, { text: " " }, { text: " ", color: "#0F3318" }, { text: "\u258f", bgColor: "#007C44" }, { text: "\u2586\u2586", bgColor: "#008449" }, { text: "\u2584", bgColor: "#00733F" }, { text: "\u259d", bgColor: "#006D3C" }, { text: "\u258b", bgColor: "#008449" }, { text: "\u258c", color: "#008449" }, { text: "\u2586", bgColor: "#008449" }, { text: "\u2596", bgColor: "#006135" }, { text: "\u258b", color: "#007741" }],
  [{ text: "\u258c", color: "#CE3128", bgColor: "#D84426" }, { text: "\u258c", color: "#E25724", bgColor: "#EC6B21" }, { text: "\u258f", color: "#F2771F", bgColor: "#F3781F" }, { text: "\u258a", color: "#E5711D" }, { text: "\u258c", bgColor: "#87C13F" }, { text: " ", color: "#031C26", bgColor: "#8BC53F" }, { text: "\u258c", color: "#84C23F", bgColor: "#6FBB43" }, { text: "\u258c", color: "#5AB447", bgColor: "#44AC4B" }, { text: "\u258a ", color: "#259046" }, { text: "\u258f", bgColor: "#007C44" }, { text: "\u258f ", color: "#008449" }, { text: " " }, { text: "\u258f", bgColor: "#008046" }, { text: "\u258b", bgColor: "#008449" }, { text: "\u258c", color: "#008449" }, { text: "\u2584", bgColor: "#006537" }, { text: "\u2584", bgColor: "#008348" }, { text: "\u259d", bgColor: "#00723F" }],
  [{ text: "\u258f", color: "#A92322", bgColor: "#D53E27" }, { text: "\u258c", color: "#E35823", bgColor: "#EC6B20" }, { text: "\u2581", color: "#E3701C", bgColor: "#F3771F" }, { text: "\u2598", color: "#F2771E" }, { text: "\u258c", bgColor: "#85BD3C" }, { text: " ", bgColor: "#8BC53F" }, { text: "\u258c", color: "#84C23F", bgColor: "#6EBB43" }, { text: "\u258c", color: "#59B447", bgColor: "#43AC4B" }, { text: "\u258a ", color: "#259147" }, { text: "\u2582", bgColor: "#006C3C" }, { text: "\u2582", bgColor: "#00532E" }, { text: "\u2586", color: "#00512D" }, { text: "\u2583", bgColor: "#00693A" }, { text: "\u2598", color: "#006538" }, { text: "\u258b", bgColor: "#006739" }, { text: "\u2582", bgColor: "#006A3B" }, { text: "\u2585", color: "#00562F" }, { text: "\u2582", bgColor: "#005730" }, { text: "\u2584", bgColor: "#006F3D" }],
  [{ text: "\u2585", bgColor: "#C23823" }, { text: "\u2585", bgColor: "#DF5E21" }, { text: "\u2586", bgColor: "#834010" }, { text: " " }, { text: "\u258b", bgColor: "#7CB038" }, { text: "\u2581", color: "#66912D", bgColor: "#8BC53F" }, { text: "\u2581", bgColor: "#75B83F" }, { text: "\u2583", bgColor: "#44983F" }],
];

export interface LogoProps {
  readonly version?: string;
  readonly modelName?: string;
  readonly showLogo?: boolean;
}

export function Logo({
  version = VERSION,
  modelName,
  showLogo = true,
}: LogoProps) {
  return (
    <Box flexDirection="column">
      {showLogo &&
        DB_LOGO.map((segments, lineIdx) => (
          <Text key={lineIdx}>
            {segments.map((seg, segIdx) => (
              <Text key={segIdx} color={seg.color} backgroundColor={seg.bgColor}>
                {seg.text}
              </Text>
            ))}
          </Text>
        ))}
      <Box flexDirection="row" gap={1} marginTop={showLogo ? 1 : 0}>
        <Text bold color="cyan">
          {APP_NAME} v{version}
        </Text>
        {modelName && (
          <Text dimColor color="gray">
            Model: {modelName}
          </Text>
        )}
      </Box>
      <Text dimColor>AI Coding Assistant</Text>
    </Box>
  );
}

/**
 * Print the startup logo directly to stdout BEFORE Ink render starts.
 * This prevents flickering since the logo won't be part of Ink's dynamic area.
 */
export function printStartupLogo(modelName?: string, version: string = VERSION): void {
  // Render each row of DB_LOGO using chalk
  for (const segments of DB_LOGO) {
    let line = "";
    for (const seg of segments) {
      let styled = seg.text;
      if (seg.color && seg.bgColor) {
        styled = chalk.hex(seg.color).bgHex(seg.bgColor)(seg.text);
      } else if (seg.color) {
        styled = chalk.hex(seg.color)(seg.text);
      } else if (seg.bgColor) {
        styled = chalk.bgHex(seg.bgColor)(seg.text);
      }
      line += styled;
    }
    process.stdout.write(line + "\n");
  }

  // Version line
  const versionLine = chalk.bold.cyan(`${APP_NAME} v${version}`) +
    (modelName ? " " + chalk.gray(`Model: ${modelName}`) : "");
  process.stdout.write("\n" + versionLine + "\n");

  // Subtitle
  process.stdout.write(chalk.gray("AI Coding Assistant") + "\n\n");
}
