/**
 * 체크포인트 관리자(Checkpoint Manager) 모듈
 *
 * 파일 상태의 스냅샷(체크포인트)을 생성하고, 필요 시 되돌릴 수 있는 기능을 제공합니다.
 * 도구가 파일을 수정하기 전에 자동으로 체크포인트를 생성하여,
 * 잘못된 변경을 안전하게 되돌릴 수 있습니다.
 *
 * 주니어 개발자를 위한 설명:
 * - 체크포인트란? 파일의 특정 시점 상태를 저장해둔 "세이브 포인트"입니다
 * - 게임에서 저장 후 잘못되면 되돌리는 것과 같은 원리입니다
 * - file_edit, file_write 같은 도구가 실행되기 전에 자동으로 파일을 백업합니다
 * - 체크포인트에는 파일 내용의 복사본과 SHA-256 해시가 저장됩니다
 * - diff 기능으로 체크포인트 이후 어떤 파일이 변경되었는지 확인할 수 있습니다
 *
 * 디렉토리 구조:
 * ```
 * {session-dir}/checkpoints/
 * ├── cp-001.json           # 체크포인트 메타데이터 (파일 목록, 해시, 크기)
 * ├── cp-001/               # 저장된 파일 내용
 * │   ├── src__index.ts     # 원본 파일 복사본 (경로의 / → __ 로 변환)
 * │   └── src__utils__path.ts
 * └── cp-002.json
 * ```
 */
import { mkdir, readFile, writeFile, readdir, stat, copyFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import { BaseError } from "../utils/error.js";

/**
 * 체크포인트 관련 에러 클래스
 */
export class CheckpointError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "CHECKPOINT_ERROR", context);
  }
}

/**
 * 체크포인트 내 단일 파일의 스냅샷 정보
 *
 * @property relativePath - 작업 디렉토리 기준 상대 경로 (예: "src/index.ts")
 * @property contentHash - 파일 내용의 SHA-256 해시 (변경 감지용)
 * @property size - 파일 크기 (바이트)
 * @property exists - 체크포인트 시점에 파일이 존재했는지 여부
 *   (false이면 "파일이 없었다"는 것도 기록하여, 새로 생긴 파일을 감지할 수 있음)
 */
export interface FileSnapshot {
  readonly relativePath: string;
  readonly contentHash: string;
  readonly size: number;
  readonly exists: boolean;
}

/**
 * 체크포인트 메타데이터
 *
 * @property id - 체크포인트 식별자 (예: "cp-001", "cp-002")
 * @property sessionId - 이 체크포인트가 속한 세션 ID
 * @property createdAt - 생성 시각 (ISO 8601)
 * @property description - 체크포인트 설명 (예: "Before file_edit: index.ts")
 * @property messageIndex - 체크포인트 생성 시점의 메시지 인덱스
 * @property files - 스냅샷된 파일 목록
 */
export interface Checkpoint {
  readonly id: string;
  readonly sessionId: string;
  readonly createdAt: string;
  readonly description: string;
  readonly messageIndex: number;
  readonly files: readonly FileSnapshot[];
}

/**
 * 체크포인트 생성 옵션
 *
 * @property sessionId - 세션 ID
 * @property description - 체크포인트 설명
 * @property messageIndex - 현재 메시지 인덱스 (어느 시점인지 기록)
 * @property workingDirectory - 작업 디렉토리 (파일 경로의 기준)
 * @property trackedFiles - 스냅샷할 파일 경로 목록
 */
export interface CreateCheckpointOptions {
  readonly sessionId: string;
  readonly description: string;
  readonly messageIndex: number;
  readonly workingDirectory: string;
  readonly trackedFiles: readonly string[];
}

/**
 * 체크포인트 복원 결과
 *
 * @property restoredFiles - 성공적으로 복원된 파일 경로 목록
 * @property skippedFiles - 복원을 건너뛴 파일 경로 목록 (원본이 없었거나 복원 실패)
 * @property checkpoint - 복원에 사용된 체크포인트 정보
 */
export interface RestoreResult {
  readonly restoredFiles: readonly string[];
  readonly skippedFiles: readonly string[];
  readonly checkpoint: Checkpoint;
}

/**
 * 체크포인트 관리자 — 파일 상태 스냅샷과 되감기 기능을 제공합니다.
 *
 * 사용 흐름:
 * 1. 파일 수정 전: createCheckpoint()로 현재 상태를 저장
 * 2. 문제 발생 시: restoreCheckpoint()로 이전 상태로 되돌리기
 * 3. 확인 용도: diffFromCheckpoint()로 체크포인트 이후 변경사항 확인
 */
export class CheckpointManager {
  /** 체크포인트가 저장되는 디렉토리 */
  private readonly checkpointsDir: string;
  /** 다음에 생성할 체크포인트의 번호 (cp-001, cp-002, ...) */
  private nextId: number;

  /**
   * @param sessionDir - 세션 디렉토리 경로 (하위에 checkpoints/ 생성)
   */
  constructor(sessionDir: string) {
    this.checkpointsDir = join(sessionDir, "checkpoints");
    this.nextId = 1;
  }

  /** 체크포인트 디렉토리가 존재하도록 보장합니다 */
  private async ensureDir(): Promise<void> {
    await mkdir(this.checkpointsDir, { recursive: true });
  }

  /**
   * 지정된 파일들의 체크포인트를 생성합니다.
   *
   * 각 파일의 내용을 체크포인트 디렉토리에 복사하고,
   * SHA-256 해시와 크기 등의 메타데이터를 기록합니다.
   *
   * 파일 경로에서 / 를 __ 로 치환하여 안전한 파일 이름을 만듭니다.
   * 예: "src/utils/path.ts" → "src__utils__path.ts"
   *
   * @param options - 체크포인트 생성 옵션
   * @returns 생성된 체크포인트 정보
   */
  async createCheckpoint(options: CreateCheckpointOptions): Promise<Checkpoint> {
    await this.ensureDir();

    // 기존 체크포인트 파일을 확인하여 다음 ID를 동기화
    await this.syncNextId();
    const id = `cp-${String(this.nextId).padStart(3, "0")}`; // 예: "cp-001"
    this.nextId++;

    const cpDir = join(this.checkpointsDir, id);
    await mkdir(cpDir, { recursive: true });

    // 각 추적 대상 파일의 스냅샷 생성
    const snapshots: FileSnapshot[] = [];
    for (const filePath of options.trackedFiles) {
      const fullPath = resolve(options.workingDirectory, filePath);
      const relativeTo = relative(options.workingDirectory, fullPath);
      // 경로 구분자(/ 또는 \)를 __로 변환하여 안전한 파일 이름 생성
      const safeFileName = relativeTo.replace(/[\\/]/g, "__");

      try {
        const fileStat = await stat(fullPath);
        if (!fileStat.isFile()) continue; // 디렉토리는 건너뜀

        // 파일 내용 읽기 → 해시 계산 → 체크포인트 디렉토리에 복사
        const content = await readFile(fullPath);
        const destPath = join(cpDir, safeFileName);
        await writeFile(destPath, content);
        const hash = createHash("sha256").update(content).digest("hex");

        snapshots.push({
          relativePath: relativeTo.replace(/\\/g, "/"), // 경로 구분자 통일
          contentHash: hash,
          size: fileStat.size,
          exists: true,
        });
      } catch {
        // 파일이 존재하지 않음 → "없었다"는 것을 기록
        // 나중에 diff에서 "새로 생긴 파일"을 감지할 수 있음
        snapshots.push({
          relativePath: relativeTo.replace(/\\/g, "/"),
          contentHash: "",
          size: 0,
          exists: false,
        });
      }
    }

    const checkpoint: Checkpoint = {
      id,
      sessionId: options.sessionId,
      createdAt: new Date().toISOString(),
      description: options.description,
      messageIndex: options.messageIndex,
      files: snapshots,
    };

    // 체크포인트 메타데이터를 JSON 파일로 저장
    await writeFile(
      join(this.checkpointsDir, `${id}.json`),
      JSON.stringify(checkpoint, null, 2),
      "utf-8",
    );

    return checkpoint;
  }

  /**
   * 모든 체크포인트 목록을 조회합니다.
   * 생성 시간 순(오래된 것 먼저)으로 정렬됩니다.
   *
   * @returns 체크포인트 배열
   */
  async listCheckpoints(): Promise<readonly Checkpoint[]> {
    await this.ensureDir();

    try {
      const entries = await readdir(this.checkpointsDir);
      // .json 파일만 필터링하고 이름순 정렬 (cp-001, cp-002, ...)
      const jsonFiles = entries.filter((e) => e.endsWith(".json")).sort();

      const checkpoints: Checkpoint[] = [];
      for (const file of jsonFiles) {
        const content = await readFile(join(this.checkpointsDir, file), "utf-8");
        checkpoints.push(JSON.parse(content) as Checkpoint);
      }

      return checkpoints;
    } catch {
      return [];
    }
  }

  /**
   * ID로 특정 체크포인트를 조회합니다.
   *
   * @param checkpointId - 조회할 체크포인트 ID (예: "cp-001")
   * @returns 체크포인트 정보
   * @throws CheckpointError - 체크포인트를 찾을 수 없는 경우
   */
  async getCheckpoint(checkpointId: string): Promise<Checkpoint> {
    const metaPath = join(this.checkpointsDir, `${checkpointId}.json`);
    try {
      const content = await readFile(metaPath, "utf-8");
      return JSON.parse(content) as Checkpoint;
    } catch {
      throw new CheckpointError("Checkpoint not found", { checkpointId });
    }
  }

  /**
   * 체크포인트에서 파일들을 복원합니다.
   *
   * 체크포인트에 저장된 파일 내용을 작업 디렉토리에 다시 복사합니다.
   * 체크포인트 시점에 존재하지 않았던 파일은 건너뜁니다.
   *
   * @param checkpointId - 복원할 체크포인트 ID
   * @param workingDirectory - 파일을 복원할 작업 디렉토리
   * @returns 복원 결과 (복원된 파일, 건너뛴 파일, 체크포인트 정보)
   */
  async restoreCheckpoint(checkpointId: string, workingDirectory: string): Promise<RestoreResult> {
    const checkpoint = await this.getCheckpoint(checkpointId);
    const cpDir = join(this.checkpointsDir, checkpointId);

    const restoredFiles: string[] = [];
    const skippedFiles: string[] = [];

    for (const snapshot of checkpoint.files) {
      // 체크포인트 시점에 파일이 없었으면 복원할 것이 없으므로 건너뜀
      if (!snapshot.exists) {
        skippedFiles.push(snapshot.relativePath);
        continue;
      }

      const safeFileName = snapshot.relativePath.replace(/[\\/]/g, "__");
      const srcPath = join(cpDir, safeFileName);           // 체크포인트에 저장된 파일
      const destPath = resolve(workingDirectory, snapshot.relativePath); // 복원 대상 경로

      try {
        // 복원 대상 디렉토리가 존재하도록 보장
        await mkdir(dirname(destPath), { recursive: true });
        // 파일 복사 (체크포인트 → 작업 디렉토리)
        await copyFile(srcPath, destPath);
        restoredFiles.push(snapshot.relativePath);
      } catch {
        skippedFiles.push(snapshot.relativePath);
      }
    }

    return { restoredFiles, skippedFiles, checkpoint };
  }

  /**
   * 체크포인트와 현재 파일 상태의 차이(diff)를 확인합니다.
   *
   * 각 파일에 대해 다음 상태 중 하나를 반환합니다:
   * - "unchanged": 체크포인트 이후 변경되지 않음 (해시 일치)
   * - "modified": 내용이 변경됨 (해시 불일치)
   * - "deleted": 체크포인트 시점에 있었지만 현재 삭제됨
   * - "new": 체크포인트 시점에 없었지만 현재 존재함
   *
   * @param checkpointId - 비교할 체크포인트 ID
   * @param workingDirectory - 현재 파일 상태를 확인할 작업 디렉토리
   * @returns 파일별 변경 상태 배열
   */
  async diffFromCheckpoint(
    checkpointId: string,
    workingDirectory: string,
  ): Promise<
    readonly {
      readonly path: string;
      readonly status: "modified" | "unchanged" | "deleted" | "new";
    }[]
  > {
    const checkpoint = await this.getCheckpoint(checkpointId);
    const results: { path: string; status: "modified" | "unchanged" | "deleted" | "new" }[] = [];

    for (const snapshot of checkpoint.files) {
      const fullPath = resolve(workingDirectory, snapshot.relativePath);

      if (!snapshot.exists) {
        // 체크포인트 시점에 없었던 파일
        try {
          await stat(fullPath);
          results.push({ path: snapshot.relativePath, status: "new" }); // 지금은 존재함 → "new"
        } catch {
          results.push({ path: snapshot.relativePath, status: "unchanged" }); // 여전히 없음
        }
        continue;
      }

      try {
        // 현재 파일의 해시를 계산하여 체크포인트 해시와 비교
        const content = await readFile(fullPath);
        const currentHash = createHash("sha256").update(content).digest("hex");

        if (currentHash === snapshot.contentHash) {
          results.push({ path: snapshot.relativePath, status: "unchanged" });
        } else {
          results.push({ path: snapshot.relativePath, status: "modified" });
        }
      } catch {
        // 파일을 읽을 수 없음 → 삭제된 것으로 간주
        results.push({ path: snapshot.relativePath, status: "deleted" });
      }
    }

    return results;
  }

  /**
   * 기존 체크포인트 파일을 확인하여 nextId를 동기화합니다.
   * 가장 높은 번호 + 1로 설정합니다.
   */
  private async syncNextId(): Promise<void> {
    try {
      const entries = await readdir(this.checkpointsDir);
      const cpFiles = entries.filter((e) => e.match(/^cp-\d+\.json$/));
      if (cpFiles.length === 0) {
        this.nextId = 1;
        return;
      }

      // cp-001.json, cp-002.json 등에서 숫자 부분을 추출하여 최대값 계산
      const maxId = Math.max(
        ...cpFiles.map((f) => {
          const match = f.match(/^cp-(\d+)\.json$/);
          return match ? parseInt(match[1], 10) : 0;
        }),
      );
      this.nextId = maxId + 1;
    } catch {
      this.nextId = 1;
    }
  }
}
