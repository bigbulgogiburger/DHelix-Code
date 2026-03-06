import { Box, Text } from "ink";

/**
 * Cute doge pixel art using Unicode shade/block characters.
 * Source: dogemuchwow.com ASCII art collection.
 * Each character type gets a different color for a warm gradient effect.
 */

// prettier-ignore
const DOG_ART = [
  "       ▄      ▄",
  "      ▐▒▀▄▄▄▄▀▒▌",
  "    ▄▀▒▒▒▒▒▒▒▒▓▀▄",
  "  ▄▀░█░░░░█░░▒▒▒▐",
  "  ▌░░░░░░░░░░░▒▒▐",
  " ▐▒░██▒▒░░░░░░░▒▐",
  " ▐▒░▓▓▒▒▒░░░░░░▄▀",
  "  ▀▄░▀▀▀▀░░░░▄▀",
  "    ▀▀▄▄▄▄▄▀▀",
];

/** Per-character color based on shade level */
const CHAR_COLORS: Readonly<Record<string, string>> = {
  "░": "#F5DEB3", // wheat — light face
  "▒": "#DAA520", // goldenrod — mid fur
  "▓": "#B8860B", // dark goldenrod — dark fur
  "█": "#5D4037", // chocolate — eyes/nose
  "▄": "#E8A317", // golden — outline
  "▀": "#E8A317",
  "▐": "#E8A317",
  "▌": "#E8A317",
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

export function Logo() {
  return (
    <Box flexDirection="column">
      {LOGO_LINES.map((segments, lineIdx) => (
        <Text key={lineIdx}>
          {segments.map((seg, segIdx) => (
            <Text key={segIdx} color={seg.color}>
              {seg.text}
            </Text>
          ))}
        </Text>
      ))}
    </Box>
  );
}
