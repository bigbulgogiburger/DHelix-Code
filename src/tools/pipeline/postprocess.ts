/**
 * Postprocess Stage — 도구 실행 결과를 정리하는 후처리 단계
 *
 * 주요 기능:
 * 1. Output 길이 제한 (truncation) — 너무 긴 출력을 잘라냄
 * 2. 메타데이터 첨부 — 실행 시간, 출력 크기, truncation 여부
 * 3. Spillover 파일 생성 — 출력이 너무 클 때 파일로 저장
 *
 * @module tools/pipeline/postprocess
 */

import { type ToolResult } from "../types.js";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

/**
 * 후처리 설정 — 출력 제한 및 메타데이터 정책
 */
export interface PostprocessConfig {
  /** 최대 출력 길이 (바이트, 기본값: 100KB) */
  readonly maxOutputLength: number;
  /** Truncation 전략 */
  readonly truncationStrategy: "head" | "tail" | "head-tail";
  /** Spillover 파일 저장 활성화 여부 */
  readonly spilloverEnabled: boolean;
  /** Spillover 파일 저장 디렉토리 */
  readonly spilloverDir: string;
  /** 메타데이터 첨부 여부 */
  readonly metadataAttach: boolean;
}

/**
 * 기본 후처리 설정
 */
export const DEFAULT_POSTPROCESS_CONFIG: PostprocessConfig = {
  maxOutputLength: 100_000, // 100KB
  truncationStrategy: "head-tail",
  spilloverEnabled: true,
  spilloverDir: join(tmpdir(), "dhelix-spillover"),
  metadataAttach: true,
};

/**
 * 출력 텍스트를 지정된 전략에 따라 truncate합니다.
 *
 * @param output - 원본 출력 텍스트
 * @param maxLength - 최대 허용 길이
 * @param strategy - truncation 전략
 * @returns truncate된 텍스트
 */
function truncateOutput(
  output: string,
  maxLength: number,
  strategy: PostprocessConfig["truncationStrategy"],
): string {
  if (output.length <= maxLength) {
    return output;
  }

  const truncationNotice = "\n\n... [output truncated] ...\n\n";
  const noticeLength = truncationNotice.length;
  const availableLength = maxLength - noticeLength;

  switch (strategy) {
    case "head": {
      return output.slice(0, maxLength - noticeLength) + truncationNotice;
    }
    case "tail": {
      return truncationNotice + output.slice(output.length - availableLength);
    }
    case "head-tail": {
      const halfLength = Math.floor(availableLength / 2);
      const head = output.slice(0, halfLength);
      const tail = output.slice(output.length - halfLength);
      return head + truncationNotice + tail;
    }
  }
}

/**
 * Spillover 파일을 생성하여 전체 출력을 저장합니다.
 *
 * @param output - 전체 출력 텍스트
 * @param spilloverDir - 저장 디렉토리
 * @returns spillover 파일 경로
 */
async function writeSpilloverFile(
  output: string,
  spilloverDir: string,
): Promise<string> {
  await mkdir(spilloverDir, { recursive: true });
  const fileName = `spillover-${randomUUID().slice(0, 8)}.txt`;
  const filePath = join(spilloverDir, fileName);
  await writeFile(filePath, output, "utf-8");
  return filePath;
}

/**
 * 도구 실행 결과를 후처리합니다.
 *
 * 1. 출력이 maxOutputLength를 초과하면 truncation 적용
 * 2. spillover가 활성화되어 있으면 전체 출력을 파일로 저장
 * 3. 메타데이터(실행 시간, 출력 크기, truncation 여부)를 첨부
 *
 * @param result - 원본 도구 실행 결과
 * @param config - 후처리 설정
 * @param executionTimeMs - 도구 실행 소요 시간 (밀리초)
 * @returns 후처리된 도구 실행 결과
 */
export async function postprocess(
  result: ToolResult,
  config: PostprocessConfig = DEFAULT_POSTPROCESS_CONFIG,
  executionTimeMs: number = 0,
): Promise<ToolResult> {
  const originalBytes = Buffer.byteLength(result.output, "utf-8");
  let processedOutput = result.output;
  let truncated = false;
  let spilloverPath: string | undefined;

  // 1. Truncation — 출력이 maxOutputLength를 초과하면 잘라냄
  if (processedOutput.length > config.maxOutputLength) {
    truncated = true;

    // 2. Spillover — 전체 출력을 파일로 저장
    if (config.spilloverEnabled) {
      try {
        spilloverPath = await writeSpilloverFile(
          processedOutput,
          config.spilloverDir,
        );
      } catch {
        // spillover 실패는 무시 — truncation만 적용
      }
    }

    processedOutput = truncateOutput(
      processedOutput,
      config.maxOutputLength,
      config.truncationStrategy,
    );

    // spillover 경로를 출력에 추가
    if (spilloverPath) {
      processedOutput += `\n[Full output saved to: ${spilloverPath}]`;
    }
  }

  // 3. 메타데이터 첨부
  if (config.metadataAttach) {
    const metadata: Record<string, unknown> = {
      ...(result.metadata ?? {}),
      executionTimeMs,
      outputBytes: originalBytes,
      truncated,
    };

    if (spilloverPath) {
      metadata["spilloverPath"] = spilloverPath;
    }

    return {
      output: processedOutput,
      isError: result.isError,
      metadata,
    };
  }

  return {
    output: processedOutput,
    isError: result.isError,
    metadata: result.metadata,
  };
}
