# Replace dhelix CLI Logo

Replace the dhelix CLI startup logo with a new image. Converts any image to Unicode block character art using `chafa`, then updates `src/cli/components/Logo.tsx`.

## Prerequisites

- `chafa` must be installed (`brew install chafa`)
- Python 3 must be available
- The parser script at `/tmp/dhelix-logo/generate_logo_tsx.py` (will be auto-created if missing)

## Steps

### 1. Get the image path

Ask the user for the image path if not provided via `$ARGUMENTS`. Supported formats: PNG, JPG, SVG, WEBP, GIF, TIFF.

### 2. Determine the size

The default logo size is **20 columns** (matches the original doge logo dimensions: ~20 chars wide × 6 rows). The user can request a different size.

### 3. Generate Unicode art with chafa

```bash
TERM=xterm-256color chafa --format symbols --symbols block --size <SIZE> --color-space rgb "<IMAGE_PATH>" > /tmp/dhelix-logo/logo-output.txt
```

Key chafa options:

- `--format symbols` — force text character output (not image protocol)
- `--symbols block` — use Unicode block characters (▀▄█▌▐ etc.)
- `--color-space rgb` — RGB color matching for accuracy
- `--size <N>` — width in columns (height auto-calculated from aspect ratio)

### 4. Parse ANSI output to TypeScript segments

Create the parser script if it doesn't exist, then run:

```bash
python3 /tmp/dhelix-logo/generate_logo_tsx.py /tmp/dhelix-logo/logo-output.txt
```

The parser script (`generate_logo_tsx.py`) does:

1. Read ANSI escape codes from chafa output
2. Parse each character's foreground/background colors (24-bit RGB)
3. Handle reverse video mode (`\e[7m`)
4. Group consecutive same-colored characters into segments
5. Strip trailing dark/empty characters
6. Output TypeScript `const DB_LOGO` array

If the script is missing, recreate it with this core logic:

- Parse `\e[38;2;R;G;Bm` for foreground colors
- Parse `\e[48;2;R;G;Bm` for background colors
- Parse `\e[7m` for reverse video (swap fg/bg)
- Parse `\e[0m` for reset
- Group into `{text, color?, bgColor?}` segments per line

### 5. Update Logo.tsx

Replace the `DB_LOGO` constant in `src/cli/components/Logo.tsx` with the generated output. Keep everything else (imports, Segment interface, LogoProps, Logo component) unchanged.

The Segment interface must include `bgColor`:

```typescript
interface Segment {
  readonly text: string;
  readonly color?: string;
  readonly bgColor?: string;
}
```

The Logo component renders segments with:

```tsx
<Text color={seg.color} backgroundColor={seg.bgColor}>
  {seg.text}
</Text>
```

### 6. Preview for user confirmation

Generate an HTML preview and open it:

```bash
# Generate HTML that renders the ANSI art in a browser
python3 -c "
# ... convert ANSI to HTML spans with inline color styles ...
# Save to /tmp/dhelix-logo-preview.html
"
open /tmp/dhelix-logo-preview.html
```

This lets the user see the exact terminal rendering in their browser, since raw ANSI codes don't display in Claude Code's output.

### 7. Build and verify

```bash
npx tsc --noEmit  # type check
npm run build     # build
```

### 8. Ask for confirmation

Show the preview to the user and ask: "이 로고로 확정할까요?"

If they say no, ask what to change (size, colors, different image) and repeat from step 3.

## Troubleshooting

- **chafa not installed**: `brew install chafa`
- **Colors look wrong**: Try `--color-space din99d` instead of `rgb`
- **Too pixelated**: Increase `--size` (e.g., 25 or 30)
- **Too large for terminal**: Decrease `--size` (e.g., 15)
- **Image protocol output instead of text**: Make sure `--format symbols` is set and `TERM=xterm-256color`
