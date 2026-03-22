#!/usr/bin/env python3
"""Convert chafa ANSI output to TypeScript Logo segment data.

Usage:
  # Generate logo art and convert in one step:
  TERM=xterm-256color chafa --format symbols --symbols block --size 20 \
    --color-space rgb image.png | python3 scripts/chafa-to-tsx.py

  # Or from a saved file:
  python3 scripts/chafa-to-tsx.py logo.txt
"""

import re
import sys
import json


def parse_ansi_line(line: str):
    """Parse a line with ANSI codes into (char, fg_rgb, bg_rgb) tuples."""
    cells = []
    fg = None
    bg = None
    reverse = False

    i = 0
    while i < len(line):
        if line[i] == "\x1b" and i + 1 < len(line) and line[i + 1] == "[":
            j = i + 2
            while j < len(line) and line[j] not in ("m", "h", "l"):
                j += 1
            if j < len(line):
                code = line[i + 2 : j]
                cmd = line[j]
                i = j + 1
                if cmd == "m":
                    parts = code.split(";") if code else [""]
                    idx = 0
                    while idx < len(parts):
                        p = parts[idx]
                        if p == "0" or p == "":
                            fg = bg = None
                            reverse = False
                        elif p == "7":
                            reverse = True
                        elif p == "38" and idx + 4 < len(parts) and parts[idx + 1] == "2":
                            fg = (int(parts[idx + 2]), int(parts[idx + 3]), int(parts[idx + 4]))
                            idx += 4
                        elif p == "48" and idx + 4 < len(parts) and parts[idx + 1] == "2":
                            bg = (int(parts[idx + 2]), int(parts[idx + 3]), int(parts[idx + 4]))
                            idx += 4
                        idx += 1
                continue
            else:
                i = j
                continue
        elif line[i] == "\x1b":
            i += 1
            continue
        else:
            ch = line[i]
            actual_fg = bg if reverse else fg
            actual_bg = fg if reverse else bg
            cells.append((ch, actual_fg, actual_bg))
            i += 1

    return cells


def rgb_to_hex(rgb):
    if rgb is None:
        return None
    r, g, b = rgb
    return f"#{r:02X}{g:02X}{b:02X}"


def is_dark(rgb):
    if rgb is None:
        return True
    return sum(rgb) < 40


def cells_to_segments(cells):
    """Group consecutive cells with same colors into segments."""
    if not cells:
        return []

    # Strip trailing dark/empty characters
    while cells and cells[-1][0] == " " and is_dark(cells[-1][1]) and is_dark(cells[-1][2]):
        cells.pop()

    segments = []
    cur_text = ""
    cur_fg = None
    cur_bg = None

    for ch, fg, bg in cells:
        fg_hex = rgb_to_hex(fg) if fg and sum(fg) >= 40 else None
        bg_hex = rgb_to_hex(bg) if bg and sum(bg) >= 40 else None

        if fg_hex == cur_fg and bg_hex == cur_bg:
            cur_text += ch
        else:
            if cur_text:
                segments.append((cur_text, cur_fg, cur_bg))
            cur_text = ch
            cur_fg = fg_hex
            cur_bg = bg_hex

    if cur_text:
        segments.append((cur_text, cur_fg, cur_bg))

    return segments


def main():
    if len(sys.argv) > 1:
        with open(sys.argv[1], "r") as f:
            content = f.read()
    else:
        content = sys.stdin.read()

    content = re.sub(r"\x1b\[\?25[lh]", "", content)

    raw_lines = content.split("\n")
    while raw_lines and not raw_lines[-1].strip():
        raw_lines.pop()

    print("// prettier-ignore")
    print("const DB_LOGO: readonly (readonly Segment[])[] = [")

    for line in raw_lines:
        cells = parse_ansi_line(line)
        segments = cells_to_segments(cells)
        parts = []
        for text, fg, bg in segments:
            t = json.dumps(text)
            if not fg and not bg:
                parts.append(f"{{ text: {t} }}")
            elif fg and bg:
                parts.append(f'{{ text: {t}, color: "{fg}", bgColor: "{bg}" }}')
            elif fg:
                parts.append(f'{{ text: {t}, color: "{fg}" }}')
            else:
                parts.append(f'{{ text: {t}, bgColor: "{bg}" }}')
        print(f"  [{', '.join(parts)}],")

    print("];")


if __name__ == "__main__":
    main()
