/**
 * Logo.tsx — Dhelix Code 브랜드 로고를 터미널에 표시하는 컴포넌트
 *
 * Dhelix 로고를 유니코드 문자와 ANSI 색상을 사용하여 터미널에 렌더링합니다.
 * 원본 SVG를 chafa(이미지→유니코드 변환 도구)로 변환한 결과입니다.
 *
 * 두 가지 렌더링 방식:
 * 1. Logo 컴포넌트 — Ink 내부에서 React 컴포넌트로 렌더링
 * 2. printStartupLogo() — Ink 시작 전에 stdout에 직접 출력 (깜빡임 방지)
 */
import { Box, Text } from "ink";
import chalk from "chalk";
import { VERSION, APP_NAME } from "../../constants.js";

/** 로고의 한 세그먼트 — 텍스트, 전경색, 배경색으로 구성 */
interface Segment {
  readonly text: string;
  readonly color?: string;
  readonly bgColor?: string;
}

/**
 * Dhelix 브랜드 로고 데이터 — 유니코드 블록 문자로 구성
 *
 * Double Helix(이중나선) 모티프의 로고
 * 시안/청록 그라데이션의 DNA 나선 구조
 */

// prettier-ignore
const DB_LOGO: readonly (readonly Segment[])[] = [
  [{ text: "      " }, { text: "▕", color: "#0a3741" }, { text: "▄", color: "#058799", bgColor: "#0c171d" }, { text: "▁" }, { text: "▂▃▃▂", color: "#0c161d" }, { text: "▁" }, { text: "▄", color: "#10989d", bgColor: "#0d181d" }, { text: "▏", color: "#0d3d42" }],
  [{ text: "     " }, { text: "▁", color: "#0b2f37" }, { text: "▁", color: "#09444e" }, { text: "▅", color: "#0b1e25", bgColor: "#03aabf" }, { text: "▘", color: "#067281", bgColor: "#09404b" }, { text: "▄", color: "#057a8a", bgColor: "#0b1c24" }, { text: "▂", color: "#02cae1", bgColor: "#0b222b" }, { text: "▂", color: "#05d7ea", bgColor: "#0b252c" }, { text: "▄", color: "#0a8c97", bgColor: "#0c1d24" }, { text: "▝", color: "#0c8089", bgColor: "#0c484f" }, { text: "▅", color: "#0c1f26", bgColor: "#11bfc3" }, { text: "▁", color: "#0d4a4e" }, { text: "▁", color: "#0d3337" }],
  [{ text: "     " }, { text: "▔", color: "#0a3c46" }, { text: "▔", color: "#085460", bgColor: "#0b1b22" }, { text: "▗", color: "#01bbd3", bgColor: "#093c46" }, { text: "▄", color: "#094551", bgColor: "#067888" }, { text: "▅", color: "#093a45", bgColor: "#03a9bd" }, { text: "▔", color: "#03d5eb", bgColor: "#0a323c" }, { text: "▔", color: "#01b7ce", bgColor: "#0a313a" }, { text: "▅", color: "#0c3d44", bgColor: "#038fa2" }, { text: "▄", color: "#093e48", bgColor: "#066574" }, { text: "▖", color: "#019aae", bgColor: "#09343e" }, { text: "▔", color: "#0f5b60", bgColor: "#0c1b22" }, { text: "▔", color: "#0f4146" }],
  [{ text: "     " }, { text: "▌", bgColor: "#0c161d" }, { text: "▁", color: "#0b1920", bgColor: "#0c171e" }, { text: "▁", color: "#02a7bd", bgColor: "#0a262f" }, { text: "▃", color: "#02aec3", bgColor: "#076271" }, { text: "▁", color: "#0a242c", bgColor: "#0490a4" }, { text: "▂▂", color: "#0a232b", bgColor: "#058496" }, { text: "▁", color: "#0a252d", bgColor: "#0591a2" }, { text: "▃", color: "#0ac7d4", bgColor: "#075562" }, { text: "▁", color: "#07c6d7", bgColor: "#0b262e" }, { text: "▁", color: "#0b1a21", bgColor: "#0c171e" }, { text: "▌", color: "#0c161d" }],
  [{ text: "     " }, { text: "▕", color: "#084e5a", bgColor: "#0c161c" }, { text: "▁", color: "#0c171d", bgColor: "#048d9f" }, { text: "▂", color: "#02a8be", bgColor: "#084550" }, { text: "▁", color: "#029cb0", bgColor: "#0a242c" }, { text: "▁", color: "#0a2830", bgColor: "#0b222b" }, { text: "  ", color: "#0a2830", bgColor: "#0b232b" }, { text: "▁", color: "#0a2a32", bgColor: "#0b222b" }, { text: "▁", color: "#02bbd1", bgColor: "#0a252d" }, { text: "▂", color: "#03cadf", bgColor: "#0a4e58" }, { text: "▁", color: "#0c171e", bgColor: "#09a4b1" }, { text: "▏", color: "#0e565a", bgColor: "#0c161c" }],
  [{ text: "      " }, { text: "▝" }, { text: "▁", color: "#047f92", bgColor: "#0b2028" }, { text: "▃", color: "#038ea3", bgColor: "#084550" }, { text: "▂", color: "#0b232c", bgColor: "#039baf" }, { text: "▃", color: "#0b1920", bgColor: "#048b9e" }, { text: "▃", color: "#0b181f", bgColor: "#048b9e" }, { text: "▂", color: "#0b2128", bgColor: "#06a5b4" }, { text: "▔", color: "#00d5ee", bgColor: "#074c58" }, { text: "▁", color: "#046975", bgColor: "#0b2028" }, { text: "▘" }],
  [{ text: "       " }, { text: "▄", color: "#0c151c", bgColor: "#047e92" }, { text: "▔", color: "#0b181f" }, { text: "▆▅▅▆", bgColor: "#0c161d" }, { text: "▔", color: "#0b171d" }, { text: "▄", bgColor: "#046874" }],
];

/**
 * Logo 컴포넌트의 Props
 * @param version - 표시할 버전 문자열 (기본값: 상수에서 가져옴)
 * @param modelName - 현재 사용 중인 모델명 (선택적)
 * @param showLogo - 로고 그래픽 표시 여부 (기본값: true)
 */
export interface LogoProps {
  readonly version?: string;
  readonly modelName?: string;
  readonly showLogo?: boolean;
}

/** Ink 내부에서 React 컴포넌트로 로고를 렌더링하는 컴포넌트 */
export function Logo({ version = VERSION, modelName, showLogo = true }: LogoProps) {
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
 * Ink 렌더링이 시작되기 전에 로고를 stdout에 직접 출력합니다.
 *
 * Ink의 동적 영역에 포함되지 않으므로 깜빡임이 없습니다.
 * chalk 라이브러리를 사용하여 ANSI 색상을 직접 적용합니다.
 * src/index.ts에서 앱 시작 시 호출됩니다.
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
  const versionLine =
    chalk.bold.cyan(`${APP_NAME} v${version}`) +
    (modelName ? " " + chalk.gray(`Model: ${modelName}`) : "");
  process.stdout.write("\n" + versionLine + "\n");

  // Subtitle
  process.stdout.write(chalk.gray("AI Coding Assistant") + "\n\n");
}
