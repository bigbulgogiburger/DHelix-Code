/**
 * 도구 실행 엔진 — LLM이 요청한 도구 호출을 실제로 실행하는 모듈
 *
 * 도구 이름으로 레지스트리에서 정의를 찾고, Zod로 인수를 검증한 뒤,
 * 타임아웃과 AbortSignal을 설정하여 안전하게 실행합니다.
 *
 * 주요 기능:
 * - 4-stage ToolPipeline을 통한 구조화된 실행 (preflight → schedule → execute → postprocess)
 * - 도구 인수 자동 교정 (저성능 모델의 잘못된 호출 보정)
 * - 타임아웃 관리 (AbortController 기반)
 * - 일시적 에러 자동 재시도 (RetryEngine 기반)
 * - 백그라운드 프로세스 관리 (장시간 실행 명령을 비동기로 관리)
 *
 * AbortController — 비동기 작업을 외부에서 취소할 수 있게 하는 웹 표준 API
 */
import {
  type ToolDefinition,
  type ToolContext,
  type ToolResult,
  type ExtractedToolCall,
  type ToolCallResult,
} from "./types.js";
import { type ToolRegistry } from "./registry.js";
import { type LLMProvider } from "../llm/provider.js";
import { type AppEventEmitter } from "../utils/events.js";
import { parseToolArguments } from "./validation.js";
import { correctToolCall } from "./tool-call-corrector.js";
import { classifyError } from "./errors.js";
import { type CapabilityTier } from "../llm/model-capabilities.js";
import { getPlatform, getShellCommand, getShellArgs } from "../utils/platform.js";
import { TOOL_TIMEOUTS } from "../constants.js";
import { ToolPipeline, type PipelineConfig, type PipelineResult } from "./pipeline.js";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, readFileSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

/** 일시적 에러 발생 시 최대 재시도 횟수 */
const MAX_TOOL_RETRIES = 1;

/**
 * 단일 도구 실행 — 타임아웃, 검증, 에러 처리를 포함한 안전한 실행
 *
 * 실행 흐름:
 * 1. AbortController로 타임아웃과 부모 취소 신호를 연결
 * 2. 저성능 모델의 인수 오류를 자동 교정 (correctToolCall)
 * 3. Zod 스키마로 인수 검증 (parseToolArguments)
 * 4. 도구 실행 (일시적 에러 시 자동 재시도)
 * 5. 타임아웃/에러 발생 시 안전한 에러 결과 반환
 *
 * @param tool - 실행할 도구 정의
 * @param args - LLM이 전달한 원시 인수
 * @param options - 작업 디렉토리, 취소 신호, 이벤트 발행기 등 (선택사항)
 * @returns 도구 실행 결과 (출력 텍스트와 에러 여부)
 */
export async function executeTool(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool: ToolDefinition<any>,
  args: Record<string, unknown>,
  options?: {
    workingDirectory?: string;
    signal?: AbortSignal;
    events?: AppEventEmitter;
    toolCallId?: string;
    capabilityTier?: CapabilityTier;
    activeClient?: LLMProvider;
    activeModel?: string;
    checkPermission?: import("./types.js").ToolContext["checkPermission"];
    checkpointManager?: import("./types.js").ToolContext["checkpointManager"];
    sessionId?: string;
    thinking?: import("./types.js").ToolContext["thinking"];
  },
): Promise<ToolResult> {
  // 도구별 타임아웃이 지정되어 있으면 사용, 없으면 전역 기본값 사용
  const timeoutMs = tool.timeoutMs ?? TOOL_TIMEOUTS.default;
  // AbortController — 이 도구 실행만을 위한 독립적인 취소 제어기 생성
  const controller = new AbortController();
  const workingDirectory = options?.workingDirectory ?? process.cwd();

  // 부모 취소 신호(abort signal)와 연결 — 사용자가 Esc를 누르면 이 도구도 취소됨
  if (options?.signal) {
    // 이미 취소된 상태라면 즉시 "Aborted" 반환
    if (options.signal.aborted) {
      return { output: "Aborted", isError: true };
    }
    // 부모 신호가 취소되면 이 컨트롤러도 취소하도록 이벤트 연결
    options.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  // 지정된 시간이 지나면 자동으로 취소하는 타이머 설정
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  // 도구 실행에 필요한 컨텍스트(환경 정보) 객체 생성
  const context: ToolContext = {
    workingDirectory,
    abortSignal: controller.signal,
    timeoutMs,
    platform: getPlatform(),
    events: options?.events,
    toolCallId: options?.toolCallId,
    activeClient: options?.activeClient,
    activeModel: options?.activeModel,
    capabilityTier: options?.capabilityTier,
    checkPermission: options?.checkPermission,
    checkpointManager: options?.checkpointManager,
    sessionId: options?.sessionId,
    thinking: options?.thinking,
  };

  try {
    // 저성능 모델(low/medium tier)의 흔한 인수 오류를 자동 교정
    // 예: 상대 경로 → 절대 경로, 문자열 "true" → boolean true
    const correctedArgs = correctToolCall(
      args,
      workingDirectory,
      context.capabilityTier ?? options?.capabilityTier ?? "high",
    );
    // Zod 스키마로 인수 검증 — 잘못된 인수면 에러를 던짐
    const validatedArgs = parseToolArguments(tool.parameterSchema, correctedArgs);

    // 재시도 루프 — classifyError로 에러를 분류하여 재시도 가능 여부 판단
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_TOOL_RETRIES; attempt++) {
      try {
        return await tool.execute(validatedArgs, context);
      } catch (execError) {
        lastError = execError;
        // classifyError로 에러 종류를 분류하여 재시도 가능 여부 판단
        const classified = classifyError(execError, tool.name);
        if (attempt < MAX_TOOL_RETRIES && classified.retryable) {
          // 지수 백오프: 1초, 2초, ... (attempt + 1)초 대기
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        throw execError;
      }
    }
    // 모든 재시도 실패 시 마지막 에러를 throw
    throw lastError;
  } catch (error) {
    // classifyError로 에러를 구조화하여 일관된 에러 메시지 생성
    const classified = classifyError(error, tool.name);

    // AbortSignal이 활성화됨 = 타임아웃 또는 사용자 취소
    if (controller.signal.aborted) {
      return { output: `Tool "${tool.name}" timed out after ${timeoutMs}ms`, isError: true };
    }

    // 분류된 에러 종류에 따라 적절한 에러 메시지 반환
    return {
      output: `Tool "${tool.name}" failed [${classified.kind}]: ${classified.message}`,
      isError: true,
    };
  } finally {
    // 타이머 정리 — 메모리 누수 방지
    clearTimeout(timeout);
  }
}

/**
 * 레지스트리에서 도구를 찾아 실행 — executeTool의 상위 래퍼(wrapper)
 *
 * 레지스트리에서 도구 이름으로 정의를 조회한 뒤, executeTool을 호출합니다.
 * 도구를 찾을 수 없으면 "Unknown tool" 에러 결과를 반환합니다.
 *
 * @param registry - 도구 레지스트리 (등록된 모든 도구가 있는 저장소)
 * @param call - LLM 응답에서 추출한 도구 호출 정보 (이름, ID, 인수)
 * @param options - 실행 옵션 (작업 디렉토리, 취소 신호 등)
 * @returns 도구 호출 결과 (ID, 이름, 출력, 에러 여부 포함)
 */
export async function executeToolCall(
  registry: ToolRegistry,
  call: ExtractedToolCall,
  options?: {
    workingDirectory?: string;
    signal?: AbortSignal;
    events?: AppEventEmitter;
    capabilityTier?: CapabilityTier;
    activeClient?: LLMProvider;
    activeModel?: string;
    checkPermission?: import("./types.js").ToolContext["checkPermission"];
    checkpointManager?: import("./types.js").ToolContext["checkpointManager"];
    sessionId?: string;
    thinking?: import("../llm/provider.js").ThinkingConfig;
  },
): Promise<ToolCallResult> {
  // 레지스트리에서 도구를 이름으로 조회
  const tool = registry.get(call.name);
  if (!tool) {
    // 등록되지 않은 도구를 호출한 경우 — LLM이 존재하지 않는 도구를 "환각(hallucinate)"했을 가능성
    return {
      id: call.id,
      name: call.name,
      output: `Unknown tool: ${call.name}`,
      isError: true,
    };
  }

  // 찾은 도구를 실행하고 결과에 호출 ID를 포함하여 반환
  const result = await executeTool(tool, call.arguments, {
    workingDirectory: options?.workingDirectory,
    signal: options?.signal,
    events: options?.events,
    toolCallId: call.id,
    capabilityTier: options?.capabilityTier,
    activeClient: options?.activeClient,
    activeModel: options?.activeModel,
    checkPermission: options?.checkPermission,
    checkpointManager: options?.checkpointManager,
    sessionId: options?.sessionId,
    thinking: options?.thinking,
  });
  return {
    id: call.id,
    name: call.name,
    output: result.output,
    isError: result.isError,
    metadata: result.metadata,
  };
}

/**
 * 백그라운드 프로세스 상태 정보 — 외부에서 프로세스 상태를 조회할 때 반환하는 인터페이스
 */
export interface BackgroundProcessStatus {
  /** 운영체제 PID (Process ID) — 프로세스 고유 번호 */
  readonly pid: number;
  /** 사람이 읽기 쉬운 프로세스 ID (예: "bg-1", "bg-2") */
  readonly processId: string;
  /** 실행 중인 명령어 */
  readonly command: string;
  /** 현재 실행 중 여부 */
  readonly running: boolean;
  /** 종료 코드 (아직 실행 중이면 null, 0이면 성공, 그 외는 에러) */
  readonly exitCode: number | null;
  /** 출력이 기록되는 임시 파일 경로 */
  readonly outputFile: string;
}

/**
 * 백그라운드 프로세스 목록 정보 — list() 메서드에서 반환하는 간략한 프로세스 정보
 */
export interface BackgroundProcessInfo {
  /** 사람이 읽기 쉬운 프로세스 ID */
  readonly processId: string;
  /** 운영체제 PID */
  readonly pid: number;
  /** 실행 중인 명령어 */
  readonly command: string;
  /** 현재 실행 중 여부 */
  readonly running: boolean;
  /** 종료 코드 */
  readonly exitCode: number | null;
}

/**
 * 내부 백그라운드 프로세스 항목 — 프로세스 관리에 필요한 모든 내부 상태를 담는 인터페이스
 */
interface BackgroundProcess {
  /** 운영체제 PID */
  readonly pid: number;
  /** 사람이 읽기 쉬운 프로세스 ID */
  readonly processId: string;
  /** 실행된 명령어 */
  readonly command: string;
  /** 출력이 기록되는 임시 파일 경로 */
  readonly outputFile: string;
  /** Node.js 자식 프로세스(ChildProcess) 객체 — kill 등 프로세스 제어에 사용 */
  readonly proc: ChildProcess;
  /** 현재 실행 중 여부 (프로세스 종료 시 false로 변경) */
  running: boolean;
  /** 종료 코드 */
  exitCode: number | null;
  /** 프로세스 완료 시 호출할 콜백 함수 목록 */
  completionCallbacks: Array<(exitCode: number) => void>;
  /** 증분 읽기(incremental read)를 위한 바이트 오프셋 — 마지막으로 읽은 위치 */
  lastReadOffset: number;
}

/**
 * 백그라운드 프로세스 관리자 — 장시간 실행 명령을 비동기적으로 관리하는 클래스
 *
 * 사용자가 "npm run dev"처럼 오래 걸리는 명령을 백그라운드에서 실행하고,
 * 나중에 출력을 확인하거나 종료할 수 있게 합니다.
 *
 * 각 프로세스는 임시 파일에 출력을 기록하며, "bg-1", "bg-2" 같은
 * 사람이 읽기 쉬운 ID로 식별됩니다.
 *
 * detached 모드로 실행하여 부모 프로세스가 종료되어도 독립적으로 실행됩니다.
 */
export class BackgroundProcessManager {
  /** PID로 프로세스를 조회하는 Map */
  private readonly processes = new Map<number, BackgroundProcess>();
  /** 사람이 읽기 쉬운 ID("bg-1")로 프로세스를 조회하는 Map */
  private readonly processIdMap = new Map<string, BackgroundProcess>();
  /** 다음에 할당할 프로세스 번호 (순차 증가) */
  private nextId = 1;

  /**
   * 백그라운드 프로세스 시작
   *
   * 셸 명령을 detached(분리) 모드로 실행하고, 출력을 임시 파일에 기록합니다.
   * unref()를 호출하여 이 프로세스가 Node.js 이벤트 루프를 블로킹하지 않게 합니다.
   *
   * @param command - 실행할 셸 명령어
   * @param cwd - 작업 디렉토리
   * @returns 프로세스 PID, 프로세스 ID, 출력 파일 경로
   */
  start(command: string, cwd: string): { pid: number; processId: string; outputFile: string } {
    // 고유한 파일명을 위해 UUID의 앞 8자리 사용
    const fileId = randomUUID().slice(0, 8);
    // 사람이 읽기 쉬운 순차 ID 할당
    const processId = `bg-${this.nextId++}`;
    // 임시 디렉토리에 출력 로그 파일 생성
    const outputFile = join(tmpdir(), `dhelix-bg-${fileId}.log`);
    const shell = getShellCommand();
    const args = getShellArgs(command);

    // 추가(append) 모드로 출력 파일 스트림 생성
    const outStream = createWriteStream(outputFile, { flags: "a" });

    // detached: true — 프로세스 그룹을 분리하여 독립 실행
    // stdio: ["ignore", "pipe", "pipe"] — stdin 무시, stdout/stderr를 파이프로 캡처
    const proc = spawn(shell, [...args], {
      cwd,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const pid = proc.pid!;

    // stdout과 stderr를 모두 같은 출력 파일로 파이프
    proc.stdout?.pipe(outStream);
    proc.stderr?.pipe(outStream);

    const entry: BackgroundProcess = {
      pid,
      processId,
      command,
      outputFile,
      proc,
      running: true,
      exitCode: null,
      completionCallbacks: [],
      lastReadOffset: 0,
    };

    // 프로세스가 종료되면 상태 업데이트 및 콜백 호출
    proc.on("close", (code) => {
      entry.running = false;
      entry.exitCode = code ?? 1;
      outStream.end();
      // 등록된 모든 완료 콜백을 실행
      for (const cb of entry.completionCallbacks) {
        cb(entry.exitCode);
      }
    });

    // 프로세스 시작 에러 처리
    proc.on("error", () => {
      entry.running = false;
      entry.exitCode = 1;
      outStream.end();
    });

    // unref() — 이 자식 프로세스가 부모의 이벤트 루프 종료를 막지 않도록 참조 해제
    proc.unref();

    // 두 가지 Map에 모두 등록 (PID 및 프로세스 ID로 조회 가능)
    this.processes.set(pid, entry);
    this.processIdMap.set(processId, entry);
    return { pid, processId, outputFile };
  }

  /**
   * 프로세스 조회 — 사람이 읽기 쉬운 ID("bg-1") 또는 숫자 PID로 프로세스를 찾음
   *
   * @param idOrPid - 프로세스 ID 문자열 또는 숫자 PID
   * @returns 프로세스 항목 또는 undefined
   */
  private resolve(idOrPid: string | number): BackgroundProcess | undefined {
    if (typeof idOrPid === "string") {
      return this.processIdMap.get(idOrPid) ?? this.findByPidString(idOrPid);
    }
    return this.processes.get(idOrPid);
  }

  /**
   * 문자열을 숫자 PID로 파싱하여 조회 시도
   *
   * 사용자가 "bg-1" 대신 PID를 문자열로 입력한 경우를 처리합니다.
   *
   * @param str - PID 문자열 (예: "12345")
   * @returns 프로세스 항목 또는 undefined
   */
  private findByPidString(str: string): BackgroundProcess | undefined {
    const num = parseInt(str, 10);
    if (!isNaN(num)) {
      return this.processes.get(num);
    }
    return undefined;
  }

  /**
   * 프로세스 상태 조회
   *
   * @param idOrPid - 프로세스 ID 또는 PID
   * @returns 프로세스 상태 정보 또는 undefined (프로세스를 찾을 수 없는 경우)
   */
  getStatus(idOrPid: string | number): BackgroundProcessStatus | undefined {
    const entry = this.resolve(idOrPid);
    if (!entry) return undefined;
    return {
      pid: entry.pid,
      processId: entry.processId,
      command: entry.command,
      running: entry.running,
      exitCode: entry.exitCode,
      outputFile: entry.outputFile,
    };
  }

  /**
   * 프로세스의 전체 출력을 읽기 — 출력 파일의 전체 내용을 반환
   *
   * @param idOrPid - 프로세스 ID 또는 PID
   * @returns 전체 출력 텍스트 (프로세스를 찾을 수 없으면 빈 문자열)
   */
  getOutput(idOrPid: string | number): string {
    const entry = this.resolve(idOrPid);
    if (!entry) return "";
    try {
      return readFileSync(entry.outputFile, "utf-8");
    } catch {
      return "";
    }
  }

  /**
   * 프로세스의 새로운 출력만 읽기 (증분 읽기, incremental read)
   *
   * 마지막으로 읽은 바이트 위치(lastReadOffset)부터 새로 추가된 내용만 읽습니다.
   * 이를 통해 LLM이 이미 본 출력을 중복 수신하지 않습니다.
   *
   * 저수준 파일 I/O(openSync, readSync)를 사용하여 정확한 바이트 오프셋부터 읽습니다.
   *
   * @param idOrPid - 프로세스 ID 또는 PID
   * @returns 새 출력 텍스트, 실행 상태, 종료 코드
   */
  getIncrementalOutput(idOrPid: string | number): {
    output: string;
    running: boolean;
    exitCode: number | null;
  } {
    const entry = this.resolve(idOrPid);
    if (!entry) {
      return { output: "", running: false, exitCode: null };
    }
    try {
      // 파일의 현재 크기를 확인
      const stats = statSync(entry.outputFile);
      const totalBytes = stats.size;
      // 마지막 읽은 위치 이후에 새 데이터가 없으면 빈 문자열 반환
      if (totalBytes <= entry.lastReadOffset) {
        return { output: "", running: entry.running, exitCode: entry.exitCode };
      }
      // 새로 추가된 바이트만 읽기 (정확한 오프셋에서 시작)
      const fd = openSync(entry.outputFile, "r");
      const buffer = Buffer.alloc(totalBytes - entry.lastReadOffset);
      readSync(fd, buffer, 0, buffer.length, entry.lastReadOffset);
      closeSync(fd);
      // 읽은 위치를 업데이트하여 다음 읽기에서 중복 방지
      entry.lastReadOffset = totalBytes;
      return { output: buffer.toString("utf-8"), running: entry.running, exitCode: entry.exitCode };
    } catch {
      return { output: "", running: entry.running, exitCode: entry.exitCode };
    }
  }

  /**
   * 백그라운드 프로세스에 시그널을 보내 종료
   *
   * 먼저 프로세스 그룹(-pid)에 시그널을 보내고,
   * 실패하면 개별 프로세스에 직접 시그널을 보냅니다.
   * 프로세스 그룹에 보내면 자식 프로세스들도 함께 종료됩니다.
   *
   * @param idOrPid - 프로세스 ID 또는 PID
   * @param signal - 보낼 시그널 (기본값: SIGTERM — 정상 종료 요청)
   * @returns 시그널 전송 성공 여부
   */
  kill(idOrPid: string | number, signal: NodeJS.Signals = "SIGTERM"): boolean {
    const entry = this.resolve(idOrPid);
    if (!entry) return false;
    if (!entry.running) return false;
    try {
      // -pid: 음수 PID는 프로세스 그룹 전체에 시그널을 보냄
      process.kill(-entry.pid, signal);
      return true;
    } catch {
      try {
        // 프로세스 그룹 시그널이 실패하면 개별 프로세스에 직접 시도
        entry.proc.kill(signal);
        return true;
      } catch {
        // 프로세스가 이미 종료된 경우 — 에러를 무시
        return false;
      }
    }
  }

  /**
   * 프로세스 완료 시 콜백 등록 — 프로세스가 종료되면 콜백 함수를 호출
   *
   * 이미 종료된 프로세스에 대해 호출하면 즉시 콜백을 실행합니다.
   *
   * @param idOrPid - 프로세스 ID 또는 PID
   * @param callback - 종료 코드를 인수로 받는 콜백 함수
   */
  onComplete(idOrPid: string | number, callback: (exitCode: number) => void): void {
    const entry = this.resolve(idOrPid);
    if (!entry) return;
    // 이미 종료된 프로세스 — 즉시 콜백 실행
    if (!entry.running) {
      callback(entry.exitCode ?? 1);
      return;
    }
    // 아직 실행 중 — 콜백 목록에 추가하여 종료 시 호출
    entry.completionCallbacks.push(callback);
  }

  /**
   * 추적 중인 모든 백그라운드 프로세스 목록 반환
   *
   * @returns 프로세스 정보 배열 (ID, PID, 명령어, 실행 상태, 종료 코드)
   */
  list(): readonly BackgroundProcessInfo[] {
    return [...this.processIdMap.values()].map((entry) => ({
      processId: entry.processId,
      pid: entry.pid,
      command: entry.command,
      running: entry.running,
      exitCode: entry.exitCode,
    }));
  }

  /**
   * 모든 실행 중인 백그라운드 프로세스 종료 — 애플리케이션 종료 시 정리(cleanup)에 사용
   *
   * SIGTERM 시그널을 보내 정상 종료를 요청합니다.
   */
  cleanup(): void {
    for (const entry of this.processes.values()) {
      if (entry.running) {
        try {
          process.kill(-entry.pid, "SIGTERM");
        } catch {
          try {
            entry.proc.kill("SIGTERM");
          } catch {
            // 프로세스가 이미 종료된 경우 — 에러를 무시
          }
        }
      }
    }
  }
}

/**
 * 싱글톤(Singleton) 백그라운드 프로세스 관리자 인스턴스
 *
 * 애플리케이션 전체에서 하나의 인스턴스만 사용하여
 * 모든 백그라운드 프로세스를 중앙에서 관리합니다.
 */
export const backgroundProcessManager = new BackgroundProcessManager();

/**
 * 여러 도구 호출을 4-stage 파이프라인으로 일괄 실행
 *
 * 기존 executeToolCall을 개별 호출하는 대신, ToolPipeline을 사용하여
 * preflight → schedule → execute → postprocess 단계를 거칩니다.
 *
 * @param registry - 도구 레지스트리
 * @param calls - 실행할 도구 호출 목록
 * @param options - 실행 옵션
 * @param pipelineConfig - 파이프라인 설정 (선택사항)
 * @returns 파이프라인 실행 결과
 */
export async function executeToolCallsWithPipeline(
  registry: ToolRegistry,
  calls: readonly ExtractedToolCall[],
  options: {
    workingDirectory?: string;
    signal?: AbortSignal;
    events?: AppEventEmitter;
    capabilityTier?: CapabilityTier;
    activeClient?: LLMProvider;
    activeModel?: string;
    checkPermission?: import("./types.js").ToolContext["checkPermission"];
    checkpointManager?: import("./types.js").ToolContext["checkpointManager"];
    sessionId?: string;
    thinking?: import("../llm/provider.js").ThinkingConfig;
    enableGuardrails?: boolean;
  },
  pipelineConfig?: PipelineConfig,
): Promise<PipelineResult> {
  const workingDirectory = options.workingDirectory ?? process.cwd();
  const pipeline = new ToolPipeline(registry);

  const context: ToolContext = {
    workingDirectory,
    abortSignal: options.signal ?? new AbortController().signal,
    timeoutMs: TOOL_TIMEOUTS.default,
    platform: getPlatform(),
    events: options.events,
    activeClient: options.activeClient,
    activeModel: options.activeModel,
    capabilityTier: options.capabilityTier,
    checkPermission: options.checkPermission,
    checkpointManager: options.checkpointManager,
    sessionId: options.sessionId,
    thinking: options.thinking,
  };

  return pipeline.execute(calls, context, {
    enableGuardrails: options.enableGuardrails,
    ...pipelineConfig,
  });
}

// Re-export pipeline types for convenience
export { ToolPipeline, type PipelineConfig, type PipelineResult } from "./pipeline.js";
