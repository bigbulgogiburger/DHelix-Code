/**
 * ResultSyncManager -- 클라우드 작업 결과 동기화 관리
 *
 * 작업 실행 결과를 수신하여 로컬 환경에 반영합니다.
 * - file-change 아티팩트: 로컬 파일 반영 계획 생성 (확인 후 적용)
 * - test-result 아티팩트: 요약 저장
 * - analysis 아티팩트: 텍스트 저장
 *
 * 파일 변경은 즉시 적용되지 않고 PendingFileChange로 저장되어
 * 사용자의 명시적 승인(applyChanges) 후에만 반영됩니다.
 *
 * @module cloud/result-sync
 */

import { randomUUID } from 'node:crypto';

import type {
  ApplyResult,
  CloudArtifact,
  CloudJobResult,
  PendingFileChange,
  SyncRecord,
  SyncResult,
} from './types.js';

// ---------------------------------------------------------------------------
// ResultSyncManager
// ---------------------------------------------------------------------------

/**
 * 클라우드 작업 결과 동기화 매니저
 *
 * 작업 결과의 아티팩트를 분류하여 저장하고, 파일 변경은
 * 대기 목록에 추가하여 사용자의 명시적 승인을 기다립니다.
 *
 * @example
 * ```ts
 * const sync = new ResultSyncManager();
 *
 * // 작업 결과 동기화
 * const result = sync.syncResult('job-123', jobResult);
 * console.log(result.pendingFileChanges); // 대기 중인 파일 변경 수
 *
 * // 대기 중인 변경 확인
 * const pending = sync.getPendingChanges();
 *
 * // 변경 적용 또는 거부
 * await sync.applyChanges([pending[0].changeId]);
 * sync.rejectChanges([pending[1].changeId]);
 * ```
 */
export class ResultSyncManager {
  /** 동기화 이력 */
  private readonly syncHistory: SyncRecord[] = [];

  /** 대기 중인 파일 변경 (changeId -> PendingFileChange) */
  private readonly pendingChanges: Map<string, PendingFileChange> = new Map();

  /** 테스트 결과 요약 저장소 */
  private readonly testResults: Map<string, string> = new Map();

  /** 분석 결과 저장소 */
  private readonly analysisResults: Map<string, string> = new Map();

  /**
   * 작업 결과를 동기화합니다.
   *
   * 결과의 아티팩트를 유형별로 분류하여 저장합니다:
   * - file-change: PendingFileChange로 추가 (경로가 있는 경우만)
   * - test-result: 테스트 결과 요약 저장
   * - analysis: 분석 텍스트 저장
   *
   * @param jobId - 원본 작업 ID
   * @param result - 동기화할 작업 결과
   * @returns 동기화 결과 요약
   */
  syncResult(jobId: string, result: CloudJobResult): SyncResult {
    const syncId = randomUUID();
    const now = Date.now();

    let pendingFileChanges = 0;
    let testResultCount = 0;
    let analysisCount = 0;

    for (const artifact of result.artifacts) {
      switch (artifact.type) {
        case 'file-change':
          if (artifact.path !== undefined) {
            this.addPendingChange(jobId, artifact);
            pendingFileChanges++;
          }
          break;

        case 'test-result':
          this.testResults.set(`${jobId}-${randomUUID().slice(0, 8)}`, artifact.content);
          testResultCount++;
          break;

        case 'analysis':
          this.analysisResults.set(`${jobId}-${randomUUID().slice(0, 8)}`, artifact.content);
          analysisCount++;
          break;
      }
    }

    const syncResult: SyncResult = {
      syncId,
      jobId,
      pendingFileChanges,
      testResults: testResultCount,
      analyses: analysisCount,
      syncedAt: now,
    };

    const record: SyncRecord = {
      syncId,
      jobId,
      result: syncResult,
      syncedAt: now,
    };

    this.syncHistory.push(record);

    return syncResult;
  }

  /**
   * 동기화 이력을 반환합니다.
   *
   * @returns 동기화 이력 배열 (시간 순서, 읽기 전용)
   */
  getSyncHistory(): readonly SyncRecord[] {
    return [...this.syncHistory];
  }

  /**
   * 아직 적용되지 않은 대기 중인 파일 변경 목록을 반환합니다.
   *
   * @returns 대기 중인 파일 변경 배열 (읽기 전용)
   */
  getPendingChanges(): readonly PendingFileChange[] {
    return [...this.pendingChanges.values()];
  }

  /**
   * 지정된 파일 변경을 적용합니다.
   *
   * 현재 인메모리 구현에서는 대기 목록에서 제거만 수행합니다.
   * 향후 실제 파일 시스템 쓰기 로직이 추가됩니다.
   *
   * @param changeIds - 적용할 변경 ID 배열
   * @returns 적용 결과 (적용/실패 수, 에러 상세)
   */
  async applyChanges(changeIds: readonly string[]): Promise<ApplyResult> {
    let applied = 0;
    let failed = 0;
    const errors: Record<string, string> = {};

    for (const changeId of changeIds) {
      const change = this.pendingChanges.get(changeId);
      if (change === undefined) {
        failed++;
        errors[changeId] = `Change not found: ${changeId}`;
        continue;
      }

      try {
        // 인메모리 시뮬레이션: 실제 파일 쓰기 대신 대기 목록에서 제거
        // 향후: await fs.writeFile(change.filePath, change.content, 'utf-8');
        this.pendingChanges.delete(changeId);
        applied++;
      } catch (error: unknown) {
        failed++;
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors[changeId] = message;
      }
    }

    return { applied, failed, errors };
  }

  /**
   * 지정된 파일 변경을 거부합니다.
   *
   * 대기 목록에서 제거하며 파일 시스템에 반영하지 않습니다.
   *
   * @param changeIds - 거부할 변경 ID 배열
   */
  rejectChanges(changeIds: readonly string[]): void {
    for (const changeId of changeIds) {
      this.pendingChanges.delete(changeId);
    }
  }

  /**
   * 모든 동기화 데이터를 초기화합니다.
   *
   * 이력, 대기 변경, 테스트 결과, 분석 결과를 모두 삭제합니다.
   */
  clear(): void {
    this.syncHistory.length = 0;
    this.pendingChanges.clear();
    this.testResults.clear();
    this.analysisResults.clear();
  }

  // -------------------------------------------------------------------------
  // Private methods
  // -------------------------------------------------------------------------

  /**
   * file-change 아티팩트를 대기 변경으로 추가합니다.
   *
   * @param jobId - 원본 작업 ID
   * @param artifact - 파일 변경 아티팩트
   */
  private addPendingChange(jobId: string, artifact: CloudArtifact): void {
    const changeId = randomUUID();
    const change: PendingFileChange = {
      changeId,
      jobId,
      filePath: artifact.path ?? '',
      content: artifact.content,
      createdAt: Date.now(),
    };
    this.pendingChanges.set(changeId, change);
  }
}
