/**
 * ResultSyncManager 단위 테스트
 *
 * syncResult, getPendingChanges, applyChanges, rejectChanges, clear 검증
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { ResultSyncManager } from '../../../src/cloud/result-sync.js';
import type { CloudJobResult } from '../../../src/cloud/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(overrides: Partial<CloudJobResult> = {}): CloudJobResult {
  return {
    success: true,
    output: 'Test output',
    artifacts: [],
    tokensUsed: 100,
    durationMs: 500,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ResultSyncManager', () => {
  let sync: ResultSyncManager;

  beforeEach(() => {
    sync = new ResultSyncManager();
  });

  // -----------------------------------------------------------------------
  // syncResult
  // -----------------------------------------------------------------------

  describe('syncResult', () => {
    it('should return sync result with correct counts', () => {
      const result = makeResult({
        artifacts: [
          { type: 'file-change', path: 'src/foo.ts', content: 'new content' },
          { type: 'file-change', path: 'src/bar.ts', content: 'bar content' },
          { type: 'test-result', content: '{"passed": 5}' },
          { type: 'analysis', content: 'All good' },
        ],
      });

      const syncResult = sync.syncResult('job-1', result);

      expect(syncResult.jobId).toBe('job-1');
      expect(syncResult.syncId).toBeTruthy();
      expect(syncResult.pendingFileChanges).toBe(2);
      expect(syncResult.testResults).toBe(1);
      expect(syncResult.analyses).toBe(1);
      expect(syncResult.syncedAt).toBeGreaterThan(0);
    });

    it('should skip file-change artifacts without path', () => {
      const result = makeResult({
        artifacts: [
          { type: 'file-change', content: 'no path' },
        ],
      });

      const syncResult = sync.syncResult('job-1', result);
      expect(syncResult.pendingFileChanges).toBe(0);
    });

    it('should handle empty artifacts', () => {
      const result = makeResult({ artifacts: [] });
      const syncResult = sync.syncResult('job-1', result);

      expect(syncResult.pendingFileChanges).toBe(0);
      expect(syncResult.testResults).toBe(0);
      expect(syncResult.analyses).toBe(0);
    });

    it('should add to sync history', () => {
      sync.syncResult('job-1', makeResult());
      sync.syncResult('job-2', makeResult());

      const history = sync.getSyncHistory();
      expect(history).toHaveLength(2);
      expect(history[0].jobId).toBe('job-1');
      expect(history[1].jobId).toBe('job-2');
    });
  });

  // -----------------------------------------------------------------------
  // getPendingChanges
  // -----------------------------------------------------------------------

  describe('getPendingChanges', () => {
    it('should return empty array when no pending changes', () => {
      expect(sync.getPendingChanges()).toHaveLength(0);
    });

    it('should return all pending file changes', () => {
      const result = makeResult({
        artifacts: [
          { type: 'file-change', path: 'src/a.ts', content: 'a' },
          { type: 'file-change', path: 'src/b.ts', content: 'b' },
        ],
      });

      sync.syncResult('job-1', result);
      const pending = sync.getPendingChanges();

      expect(pending).toHaveLength(2);
      expect(pending[0].jobId).toBe('job-1');
      expect(pending[0].filePath).toBeTruthy();
      expect(pending[0].content).toBeTruthy();
      expect(pending[0].changeId).toBeTruthy();
      expect(pending[0].createdAt).toBeGreaterThan(0);
    });

    it('should accumulate changes from multiple syncs', () => {
      sync.syncResult('job-1', makeResult({
        artifacts: [{ type: 'file-change', path: 'a.ts', content: 'a' }],
      }));
      sync.syncResult('job-2', makeResult({
        artifacts: [{ type: 'file-change', path: 'b.ts', content: 'b' }],
      }));

      expect(sync.getPendingChanges()).toHaveLength(2);
    });
  });

  // -----------------------------------------------------------------------
  // applyChanges
  // -----------------------------------------------------------------------

  describe('applyChanges', () => {
    it('should apply and remove pending changes', async () => {
      sync.syncResult('job-1', makeResult({
        artifacts: [
          { type: 'file-change', path: 'src/a.ts', content: 'a' },
          { type: 'file-change', path: 'src/b.ts', content: 'b' },
        ],
      }));

      const pending = sync.getPendingChanges();
      const result = await sync.applyChanges([pending[0].changeId]);

      expect(result.applied).toBe(1);
      expect(result.failed).toBe(0);
      expect(Object.keys(result.errors)).toHaveLength(0);

      // 하나가 제거되어 1개 남음
      expect(sync.getPendingChanges()).toHaveLength(1);
    });

    it('should report failure for unknown change IDs', async () => {
      const result = await sync.applyChanges(['nonexistent-id']);

      expect(result.applied).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors['nonexistent-id']).toContain('not found');
    });

    it('should handle mixed valid and invalid IDs', async () => {
      sync.syncResult('job-1', makeResult({
        artifacts: [{ type: 'file-change', path: 'a.ts', content: 'a' }],
      }));

      const pending = sync.getPendingChanges();
      const result = await sync.applyChanges([pending[0].changeId, 'bad-id']);

      expect(result.applied).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('should handle empty changeIds array', async () => {
      const result = await sync.applyChanges([]);
      expect(result.applied).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // rejectChanges
  // -----------------------------------------------------------------------

  describe('rejectChanges', () => {
    it('should remove rejected changes from pending', () => {
      sync.syncResult('job-1', makeResult({
        artifacts: [
          { type: 'file-change', path: 'a.ts', content: 'a' },
          { type: 'file-change', path: 'b.ts', content: 'b' },
        ],
      }));

      const pending = sync.getPendingChanges();
      sync.rejectChanges([pending[0].changeId]);

      expect(sync.getPendingChanges()).toHaveLength(1);
    });

    it('should silently ignore unknown change IDs', () => {
      sync.rejectChanges(['nonexistent']);
      expect(sync.getPendingChanges()).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // getSyncHistory
  // -----------------------------------------------------------------------

  describe('getSyncHistory', () => {
    it('should return empty array initially', () => {
      expect(sync.getSyncHistory()).toHaveLength(0);
    });

    it('should return immutable copy', () => {
      sync.syncResult('job-1', makeResult());
      const history1 = sync.getSyncHistory();
      const history2 = sync.getSyncHistory();

      expect(history1).toEqual(history2);
      expect(history1).not.toBe(history2); // 다른 배열 인스턴스
    });
  });

  // -----------------------------------------------------------------------
  // clear
  // -----------------------------------------------------------------------

  describe('clear', () => {
    it('should remove all data', () => {
      sync.syncResult('job-1', makeResult({
        artifacts: [
          { type: 'file-change', path: 'a.ts', content: 'a' },
          { type: 'test-result', content: 'pass' },
          { type: 'analysis', content: 'ok' },
        ],
      }));

      sync.clear();

      expect(sync.getSyncHistory()).toHaveLength(0);
      expect(sync.getPendingChanges()).toHaveLength(0);
    });
  });
});
