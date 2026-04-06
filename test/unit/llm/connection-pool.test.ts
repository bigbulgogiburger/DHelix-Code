import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ConnectionPool,
  type PoolConfig,
  type PooledConnection,
  type PoolStats,
} from "../../../src/llm/connection-pool.js";

// ─── 테스트 픽스처 ──────────────────────────────────────────────────

const ENDPOINT_A = "https://api.anthropic.com";
const ENDPOINT_B = "https://api.openai.com";

function makePool(overrides: Partial<PoolConfig> = {}): ConnectionPool {
  return new ConnectionPool({
    maxConnections: 5,
    idleTimeoutMs: 60_000,
    prewarmCount: 2,
    ...overrides,
  });
}

// ─── acquire ────────────────────────────────────────────────────────

describe("ConnectionPool.acquire", () => {
  let pool: ConnectionPool;

  beforeEach(() => {
    pool = makePool();
  });

  afterEach(() => {
    pool.dispose();
  });

  it("should return a PooledConnection with active status", async () => {
    const conn = await pool.acquire(ENDPOINT_A);

    expect(conn.id).toBeDefined();
    expect(conn.endpoint).toBe(ENDPOINT_A);
    expect(conn.status).toBe("active");
    expect(conn.createdAt).toBeLessThanOrEqual(Date.now());
    expect(conn.lastUsedAt).toBeLessThanOrEqual(Date.now());
  });

  it("should create new connection for new endpoint", async () => {
    const connA = await pool.acquire(ENDPOINT_A);
    const connB = await pool.acquire(ENDPOINT_B);

    expect(connA.id).not.toBe(connB.id);
    expect(connA.endpoint).toBe(ENDPOINT_A);
    expect(connB.endpoint).toBe(ENDPOINT_B);
  });

  it("should reuse idle connection for same endpoint", async () => {
    const conn1 = await pool.acquire(ENDPOINT_A);
    pool.release(conn1.id);

    const conn2 = await pool.acquire(ENDPOINT_A);
    expect(conn2.id).toBe(conn1.id);
  });

  it("should increment reused count on connection reuse", async () => {
    const conn = await pool.acquire(ENDPOINT_A);
    pool.release(conn.id);

    const statsBefore = pool.getStats();
    await pool.acquire(ENDPOINT_A);
    const statsAfter = pool.getStats();

    expect(statsAfter.reused).toBe(statsBefore.reused + 1);
  });

  it("should create new connection when no idle available", async () => {
    const conn1 = await pool.acquire(ENDPOINT_A);
    const conn2 = await pool.acquire(ENDPOINT_A);

    expect(conn1.id).not.toBe(conn2.id);

    pool.release(conn1.id);
    pool.release(conn2.id);
  });

  it("should throw after dispose", async () => {
    pool.dispose();
    await expect(pool.acquire(ENDPOINT_A)).rejects.toThrow(/disposed/);
  });

  it("should evict oldest idle when maxConnections reached", async () => {
    const smallPool = makePool({ maxConnections: 2, idleTimeoutMs: 60_000, prewarmCount: 0 });

    const c1 = await smallPool.acquire(ENDPOINT_A);
    const c2 = await smallPool.acquire(ENDPOINT_B);
    smallPool.release(c1.id);
    smallPool.release(c2.id);

    // 3번째 acquire: 용량 초과 → oldest idle 제거 후 새 연결 생성
    const c3 = await smallPool.acquire("https://api.example.com");
    expect(c3.status).toBe("active");

    smallPool.dispose();
  });
});

// ─── release ────────────────────────────────────────────────────────

describe("ConnectionPool.release", () => {
  let pool: ConnectionPool;

  beforeEach(() => {
    pool = makePool();
  });

  afterEach(() => {
    pool.dispose();
  });

  it("should change connection status to idle", async () => {
    const conn = await pool.acquire(ENDPOINT_A);
    expect(pool.getStats().active).toBe(1);

    pool.release(conn.id);
    expect(pool.getStats().idle).toBe(1);
    expect(pool.getStats().active).toBe(0);
  });

  it("should be safe to release unknown connection id", () => {
    expect(() => pool.release("nonexistent-id")).not.toThrow();
  });

  it("should be safe to release twice", async () => {
    const conn = await pool.acquire(ENDPOINT_A);
    pool.release(conn.id);
    expect(() => pool.release(conn.id)).not.toThrow();
  });
});

// ─── prewarm ────────────────────────────────────────────────────────

describe("ConnectionPool.prewarm", () => {
  it("should create prewarmCount idle connections per endpoint", async () => {
    const pool = makePool({ prewarmCount: 3, maxConnections: 10 });
    await pool.prewarm([ENDPOINT_A]);

    const stats = pool.getStats();
    expect(stats.idle).toBe(3);
    expect(stats.active).toBe(0);

    pool.dispose();
  });

  it("should create connections for multiple endpoints", async () => {
    const pool = makePool({ prewarmCount: 2, maxConnections: 10 });
    await pool.prewarm([ENDPOINT_A, ENDPOINT_B]);

    const stats = pool.getStats();
    expect(stats.idle).toBe(4); // 2 × 2 endpoints
    expect(stats.created).toBe(4);

    pool.dispose();
  });

  it("should reuse prewarmed connections on acquire", async () => {
    const pool = makePool({ prewarmCount: 2, maxConnections: 10 });
    await pool.prewarm([ENDPOINT_A]);

    const statsBefore = pool.getStats();
    const conn = await pool.acquire(ENDPOINT_A);
    const statsAfter = pool.getStats();

    expect(conn.status).toBe("active");
    expect(statsAfter.reused).toBe(statsBefore.reused + 1);

    pool.dispose();
  });

  it("should not exceed maxConnections", async () => {
    const pool = makePool({ prewarmCount: 5, maxConnections: 3 });
    await pool.prewarm([ENDPOINT_A]);

    const stats = pool.getStats();
    expect(stats.total).toBeLessThanOrEqual(3);

    pool.dispose();
  });

  it("should throw after dispose", async () => {
    const pool = makePool();
    pool.dispose();
    await expect(pool.prewarm([ENDPOINT_A])).rejects.toThrow(/disposed/);
  });
});

// ─── getStats ────────────────────────────────────────────────────────

describe("ConnectionPool.getStats", () => {
  let pool: ConnectionPool;

  beforeEach(() => {
    pool = makePool();
  });

  afterEach(() => {
    pool.dispose();
  });

  it("should return zero stats initially", () => {
    const stats = pool.getStats();
    expect(stats.total).toBe(0);
    expect(stats.active).toBe(0);
    expect(stats.idle).toBe(0);
    expect(stats.created).toBe(0);
    expect(stats.reused).toBe(0);
  });

  it("should track created connections", async () => {
    await pool.acquire(ENDPOINT_A);
    await pool.acquire(ENDPOINT_B);

    const stats = pool.getStats();
    expect(stats.created).toBe(2);
    expect(stats.total).toBe(2);
    expect(stats.active).toBe(2);
  });

  it("should update active/idle correctly after release", async () => {
    const conn = await pool.acquire(ENDPOINT_A);
    pool.release(conn.id);

    const stats = pool.getStats();
    expect(stats.active).toBe(0);
    expect(stats.idle).toBe(1);
    expect(stats.total).toBe(1);
  });

  it("total should equal active + idle", async () => {
    const c1 = await pool.acquire(ENDPOINT_A);
    const c2 = await pool.acquire(ENDPOINT_B);
    pool.release(c1.id);

    const stats = pool.getStats();
    expect(stats.total).toBe(stats.active + stats.idle);
  });
});

// ─── drain ────────────────────────────────────────────────────────────

describe("ConnectionPool.drain", () => {
  it("should close all connections and reset stats", async () => {
    const pool = makePool();
    const c1 = await pool.acquire(ENDPOINT_A);
    const c2 = await pool.acquire(ENDPOINT_B);
    pool.release(c1.id);

    await pool.drain();

    const stats = pool.getStats();
    expect(stats.total).toBe(0);
    expect(stats.active).toBe(0);
    expect(stats.idle).toBe(0);
    expect(stats.created).toBe(0);
    expect(stats.reused).toBe(0);

    // drain 후에도 재사용 가능
    const c3 = await pool.acquire(ENDPOINT_A);
    expect(c3.status).toBe("active");
    pool.dispose();
  });

  it("should be safe to drain empty pool", async () => {
    const pool = makePool();
    await expect(pool.drain()).resolves.not.toThrow();
    pool.dispose();
  });
});

// ─── dispose ──────────────────────────────────────────────────────────

describe("ConnectionPool.dispose", () => {
  it("should prevent further acquire calls", async () => {
    const pool = makePool();
    pool.dispose();
    await expect(pool.acquire(ENDPOINT_A)).rejects.toThrow(/disposed/);
  });

  it("should be idempotent", () => {
    const pool = makePool();
    expect(() => {
      pool.dispose();
      pool.dispose();
    }).not.toThrow();
  });
});

// ─── idle timeout ─────────────────────────────────────────────────────

describe("ConnectionPool — idle timeout", () => {
  it("should auto-close idle connection after timeout", async () => {
    vi.useFakeTimers();
    const pool = makePool({ idleTimeoutMs: 100, maxConnections: 5 });

    const conn = await pool.acquire(ENDPOINT_A);
    pool.release(conn.id);

    expect(pool.getStats().idle).toBe(1);

    vi.advanceTimersByTime(200);

    expect(pool.getStats().idle).toBe(0);
    expect(pool.getStats().total).toBe(0);

    pool.dispose();
    vi.useRealTimers();
  });

  it("should cancel idle timer on reacquire", async () => {
    vi.useFakeTimers();
    const pool = makePool({ idleTimeoutMs: 200, maxConnections: 5 });

    const conn = await pool.acquire(ENDPOINT_A);
    pool.release(conn.id);

    // 타임아웃 전에 재획득
    vi.advanceTimersByTime(100);
    const conn2 = await pool.acquire(ENDPOINT_A);
    expect(conn2.id).toBe(conn.id);
    expect(conn2.status).toBe("active");

    // 추가 시간 경과해도 active 연결이 닫히지 않음
    vi.advanceTimersByTime(300);
    expect(pool.getStats().active).toBe(1);

    pool.release(conn2.id);
    pool.dispose();
    vi.useRealTimers();
  });
});

// ─── PooledConnection 타입 확인 ───────────────────────────────────────

describe("PooledConnection shape", () => {
  it("should have correct readonly structure", async () => {
    const pool = makePool();
    const conn: PooledConnection = await pool.acquire(ENDPOINT_A);

    expect(typeof conn.id).toBe("string");
    expect(typeof conn.endpoint).toBe("string");
    expect(typeof conn.createdAt).toBe("number");
    expect(typeof conn.lastUsedAt).toBe("number");
    expect(["idle", "active", "closed"]).toContain(conn.status);

    pool.dispose();
  });
});
