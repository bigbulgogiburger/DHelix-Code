import { Box, Text } from "ink";
import { VERSION, APP_NAME } from "../../constants.js";

/**
 * Cute doge pixel art using Unicode shade/block characters.
 * Source: dogemuchwow.com ASCII art collection.
 * Each character type gets a different color for a warm gradient effect.
 */

// prettier-ignore
const DOG_ART = [
  "       \u2584      \u2584",
  "      \u2590\u2592\u2580\u2584\u2584\u2584\u2584\u2580\u2592\u258C",
  "    \u2584\u2580\u2592\u2592\u2592\u2592\u2592\u2592\u2593\u2580\u2584",
  "  \u2584\u2580\u2591\u2588\u2591\u2591\u2591\u2591\u2588\u2591\u2591\u2592\u2592\u2592\u2590",
  "  \u258C\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2592\u2592\u2590",
  " \u2590\u2592\u2591\u2588\u2588\u2592\u2592\u2591\u2591\u2591\u2591\u2591\u2591\u2592\u2590",
  " \u2590\u2592\u2591\u2593\u2593\u2592\u2592\u2592\u2591\u2591\u2591\u2591\u2591\u2591\u2584\u2580",
  "  \u2580\u2584\u2591\u2580\u2580\u2580\u2580\u2591\u2591\u2591\u2591\u2584\u2580",
  "    \u2580\u2580\u2584\u2584\u2584\u2584\u2584\u2580\u2580",
];

/** Per-character color based on shade level */
const CHAR_COLORS: Readonly<Record<string, string>> = {
  "\u2591": "#F5DEB3", // wheat - light face
  "\u2592": "#DAA520", // goldenrod - mid fur
  "\u2593": "#B8860B", // dark goldenrod - dark fur
  "\u2588": "#5D4037", // chocolate - eyes/nose
  "\u2584": "#E8A317", // golden - outline
  "\u2580": "#E8A317",
  "\u2590": "#E8A317",
  "\u258C": "#E8A317",
};

interface Segment {
  readonly text: string;
  readonly color?: string;
}

/** Group consecutive same-color characters for efficient rendering */
function groupByColor(line: string): readonly Segment[] {
  const segments: Segment[] = [];
  let text = "";
  let color: string | undefined;

  for (const ch of line) {
    const c = CHAR_COLORS[ch] as string | undefined;
    if (c === color) {
      text += ch;
    } else {
      if (text) {
        segments.push({ text, color });
      }
      text = ch;
      color = c;
    }
  }
  if (text) {
    segments.push({ text, color });
  }
  return segments;
}

const LOGO_LINES: readonly (readonly Segment[])[] = DOG_ART.map(groupByColor);

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
        LOGO_LINES.map((segments, lineIdx) => (
          <Text key={lineIdx}>
            {segments.map((seg, segIdx) => (
              <Text key={segIdx} color={seg.color}>
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
