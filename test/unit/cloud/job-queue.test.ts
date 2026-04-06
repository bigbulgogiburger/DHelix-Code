/**
 * JobQueue 단위 테스트
 *
 * enqueue/dequeue, 우선순위 정렬, cancel, filter, stats, dispose 검증
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { JobQueue } from '../../../src/cloud/job-queue.js';
import type { CloudJobInput } from '../../../src/cloud/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<CloudJobInput> = {}): CloudJobInput {
  return {
    agentManifestId: 'explore',
    prompt: 'Test prompt',
    priority: 'normal',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('JobQueue', () => {
  let queue: JobQueue;

  beforeEach(() => {
    queue = new JobQueue();
  });

  // -----------------------------------------------------------------------
  // enqueue
  // -----------------------------------------------------------------------

  describe('enqueue', () => {
    it('should return a unique job ID', () => {
      const id1 = queue.enqueue(makeInput());
      const id2 = queue.enqueue(makeInput());

      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });

    it('should set status to queued and createdAt', () => {
      const id = queue.enqueue(makeInput());
      const job = queue.getJob(id);

      expect(job).toBeDefined();
      expect(job!.status).toBe('queued');
      expect(job!.createdAt).toBeGreaterThan(0);
    });

    it('should preserve input fields', () => {
      const id = queue.enqueue(makeInput({
        agentManifestId: 'implement',
        prompt: 'Build feature X',
        priority: 'high',
        metadata: { tag: 'sprint-1' },
      }));

      const job = queue.getJob(id);
      expect(job!.agentManifestId).toBe('implement');
      expect(job!.prompt).toBe('Build feature X');
      expect(job!.priority).toBe('high');
      expect(job!.metadata).toEqual({ tag: 'sprint-1' });
    });
  });

  // -----------------------------------------------------------------------
  // dequeue
  // -----------------------------------------------------------------------

  describe('dequeue', () => {
    it('should return undefined when queue is empty', () => {
      expect(queue.dequeue()).toBeUndefined();
    });

    it('should return the only queued job', () => {
      const id = queue.enqueue(makeInput());
      const job = queue.dequeue();

      expect(job).toBeDefined();
      expect(job!.id).toBe(id);
      expect(job!.status).toBe('running');
      expect(job!.startedAt).toBeGreaterThan(0);
    });

    it('should dequeue highest priority first', () => {
      queue.enqueue(makeInput({ priority: 'low', prompt: 'low' }));
      queue.enqueue(makeInput({ priority: 'critical', prompt: 'critical' }));
      queue.enqueue(makeInput({ priority: 'normal', prompt: 'normal' }));
      queue.enqueue(makeInput({ priority: 'high', prompt: 'high' }));

      const first = queue.dequeue();
      expect(first!.priority).toBe('critical');

      const second = queue.dequeue();
      expect(second!.priority).toBe('high');

      const third = queue.dequeue();
      expect(third!.priority).toBe('normal');

      const fourth = queue.dequeue();
      expect(fourth!.priority).toBe('low');

      expect(queue.dequeue()).toBeUndefined();
    });

    it('should respect FIFO within same priority', () => {
      const id1 = queue.enqueue(makeInput({ prompt: 'first' }));
      const id2 = queue.enqueue(makeInput({ prompt: 'second' }));
      const id3 = queue.enqueue(makeInput({ prompt: 'third' }));

      expect(queue.dequeue()!.id).toBe(id1);
      expect(queue.dequeue()!.id).toBe(id2);
      expect(queue.dequeue()!.id).toBe(id3);
    });

    it('should not return the same job twice', () => {
      queue.enqueue(makeInput());
      const first = queue.dequeue();
      const second = queue.dequeue();

      expect(first).toBeDefined();
      expect(second).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // cancel
  // -----------------------------------------------------------------------

  describe('cancel', () => {
    it('should cancel a queued job', () => {
      const id = queue.enqueue(makeInput());
      const result = queue.cancel(id);

      expect(result).toBe(true);
      expect(queue.getJob(id)!.status).toBe('cancelled');
      expect(queue.getJob(id)!.completedAt).toBeGreaterThan(0);
    });

    it('should cancel a running job', () => {
      const id = queue.enqueue(makeInput());
      queue.dequeue(); // transitions to running

      const result = queue.cancel(id);
      expect(result).toBe(true);
      expect(queue.getJob(id)!.status).toBe('cancelled');
    });

    it('should not cancel a completed job', () => {
      const id = queue.enqueue(makeInput());
      queue.dequeue();
      queue.updateStatus(id, 'completed');

      expect(queue.cancel(id)).toBe(false);
      expect(queue.getJob(id)!.status).toBe('completed');
    });

    it('should return false for unknown job ID', () => {
      expect(queue.cancel('nonexistent')).toBe(false);
    });

    it('should remove cancelled job from dequeue pool', () => {
      const id = queue.enqueue(makeInput());
      queue.cancel(id);

      expect(queue.dequeue()).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // updateStatus
  // -----------------------------------------------------------------------

  describe('updateStatus', () => {
    it('should update status and set completedAt for terminal states', () => {
      const id = queue.enqueue(makeInput());
      queue.dequeue();
      queue.updateStatus(id, 'completed');

      const job = queue.getJob(id);
      expect(job!.status).toBe('completed');
      expect(job!.completedAt).toBeGreaterThan(0);
    });

    it('should attach result when provided', () => {
      const id = queue.enqueue(makeInput());
      queue.dequeue();

      const result = {
        success: true,
        output: 'Done',
        artifacts: [],
        tokensUsed: 500,
        durationMs: 1000,
      };
      queue.updateStatus(id, 'completed', result);

      expect(queue.getJob(id)!.result).toEqual(result);
    });

    it('should throw for unknown job ID', () => {
      expect(() => queue.updateStatus('nonexistent', 'completed')).toThrow('Job not found');
    });
  });

  // -----------------------------------------------------------------------
  // listJobs / filter
  // -----------------------------------------------------------------------

  describe('listJobs', () => {
    it('should return all jobs when no filter', () => {
      queue.enqueue(makeInput());
      queue.enqueue(makeInput());
      queue.enqueue(makeInput());

      expect(queue.listJobs()).toHaveLength(3);
    });

    it('should filter by status', () => {
      queue.enqueue(makeInput());
      queue.enqueue(makeInput());
      queue.dequeue(); // one becomes running

      const queued = queue.listJobs({ status: 'queued' });
      const running = queue.listJobs({ status: 'running' });

      expect(queued).toHaveLength(1);
      expect(running).toHaveLength(1);
    });

    it('should filter by priority', () => {
      queue.enqueue(makeInput({ priority: 'low' }));
      queue.enqueue(makeInput({ priority: 'high' }));
      queue.enqueue(makeInput({ priority: 'high' }));

      const high = queue.listJobs({ priority: 'high' });
      expect(high).toHaveLength(2);
    });

    it('should combine status and priority filters', () => {
      queue.enqueue(makeInput({ priority: 'high' }));
      queue.enqueue(makeInput({ priority: 'low' }));

      const result = queue.listJobs({ status: 'queued', priority: 'high' });
      expect(result).toHaveLength(1);
      expect(result[0].priority).toBe('high');
    });

    it('should return jobs sorted by createdAt', () => {
      queue.enqueue(makeInput({ prompt: 'first' }));
      queue.enqueue(makeInput({ prompt: 'second' }));

      const jobs = queue.listJobs();
      expect(jobs[0].createdAt).toBeLessThanOrEqual(jobs[1].createdAt);
    });
  });

  // -----------------------------------------------------------------------
  // getStats
  // -----------------------------------------------------------------------

  describe('getStats', () => {
    it('should return zero counts for empty queue', () => {
      const stats = queue.getStats();
      expect(stats).toEqual({
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      });
    });

    it('should count jobs by status', () => {
      const id1 = queue.enqueue(makeInput());
      queue.enqueue(makeInput());
      queue.enqueue(makeInput());

      queue.dequeue(); // running
      queue.cancel(id1); // cancelled (already running -> cancelled)

      const stats = queue.getStats();
      expect(stats.queued).toBe(2);
      expect(stats.cancelled).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // clear / dispose
  // -----------------------------------------------------------------------

  describe('clear', () => {
    it('should remove all jobs', () => {
      queue.enqueue(makeInput());
      queue.enqueue(makeInput());
      queue.clear();

      expect(queue.listJobs()).toHaveLength(0);
      expect(queue.dequeue()).toBeUndefined();
    });
  });

  describe('dispose', () => {
    it('should throw on operations after dispose', () => {
      queue.dispose();

      expect(() => queue.enqueue(makeInput())).toThrow('disposed');
      expect(() => queue.dequeue()).toThrow('disposed');
      expect(() => queue.cancel('x')).toThrow('disposed');
      expect(() => queue.updateStatus('x', 'completed')).toThrow('disposed');
    });
  });
});
