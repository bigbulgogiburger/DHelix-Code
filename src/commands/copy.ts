/**
 * /copy 명령어 핸들러 — 대화 중 코드 블록을 클립보드에 복사
 *
 * 사용자가 /copy를 입력하면 대화에서 어시스턴트가 작성한
 * 코드 블록(```으로 감싼 부분)을 시스템 클립보드에 복사합니다.
 *
 * 사용 예시:
 *   /copy     → 마지막 코드 블록 복사
 *   /copy 1   → 첫 번째 코드 블록 복사
 *   /copy 3   → 세 번째 코드 블록 복사
 *
 * 사용 시점: LLM이 생성한 코드를 바로 에디터에 붙여넣고 싶을 때
 *
 * 플랫폼별 클립보드 도구:
 *   - macOS: pbcopy
 *   - Linux: xclip
 *   - Windows: clip
 */
import { exec } from "node:child_process";
import { getPlatform } from "../utils/platform.js";
import { type SlashCommand } from "./registry.js";

/**
 * 마크다운 텍스트에서 펜스드 코드 블록(```으로 감싼 부분)을 추출하는 함수
 *
 * 정규식으로 ```언어\n코드``` 패턴을 찾아 언어명과 코드 내용을 반환합니다.
 *
 * @param text - 마크다운 텍스트
 * @returns 언어명(lang)과 코드 내용(code)의 객체 배열
 */
function extractCodeBlocks(text: string): readonly { lang: string; code: string }[] {
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  const blocks: { lang: string; code: string }[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    blocks.push({ lang: match[1] || "", code: match[2].trimEnd() });
  }

  return blocks;
}

/**
 * 플랫폼에 맞는 명령어를 사용하여 텍스트를 시스템 클립보드에 복사하는 함수
 *
 * OS를 감지하여 적절한 클립보드 명령어(pbcopy/clip/xclip)를 실행하고,
 * stdin으로 텍스트를 전달합니다.
 *
 * @param text - 클립보드에 복사할 텍스트
 * @returns 복사 완료 시 resolve되는 Promise
 * @throws 클립보드 명령어가 없거나 실행 실패 시 reject
 */
function copyToClipboard(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const platform = getPlatform();
    let cmd: string;

    if (platform === "win32") {
      cmd = "clip";
    } else if (platform === "darwin") {
      cmd = "pbcopy";
    } else {
      cmd = "xclip -selection clipboard";
    }

    const proc = exec(cmd, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });

    proc.stdin?.write(text);
    proc.stdin?.end();
  });
}

/**
 * /copy 슬래시 명령어 정의 — 대화의 코드 블록을 클립보드에 복사
 *
 * 어시스턴트 메시지에서 모든 코드 블록을 수집한 뒤,
 * 지정된 번호(기본값: 마지막)의 코드 블록을 클립보드에 복사합니다.
 */
export const copyCommand: SlashCommand = {
  name: "copy",
  description: "Copy last code block to clipboard",
  usage: "/copy [block number]",
  execute: async (args, context) => {
    const blockNum = args.trim() ? parseInt(args.trim(), 10) : undefined;

    if (blockNum !== undefined && isNaN(blockNum)) {
      return {
        output: "Usage: /copy [block number]\nExample: /copy 1 (copies first code block)",
        success: false,
      };
    }

    // Collect all code blocks from assistant messages
    const messages = context.messages ?? [];
    const allBlocks = messages
      .filter((m) => m.role === "assistant")
      .flatMap((m) => extractCodeBlocks(m.content));

    if (allBlocks.length === 0) {
      return {
        output: "No code blocks found in conversation.",
        success: false,
      };
    }

    const targetIdx = blockNum !== undefined ? blockNum - 1 : allBlocks.length - 1;

    if (targetIdx < 0 || targetIdx >= allBlocks.length) {
      return {
        output: `Block #${blockNum} not found. ${allBlocks.length} code block(s) available.`,
        success: false,
      };
    }

    const block = allBlocks[targetIdx];

    try {
      await copyToClipboard(block.code);
      const langLabel = block.lang ? ` (${block.lang})` : "";
      return {
        output: `Copied code block #${targetIdx + 1}${langLabel} to clipboard (${block.code.length} chars).`,
        success: true,
      };
    } catch {
      return {
        output: `Failed to copy to clipboard. Clipboard command not available.`,
        success: false,
      };
    }
  },
};
