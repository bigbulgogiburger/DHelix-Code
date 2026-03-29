# L4 Advanced+ TC Design (TC-41 ~ TC-55)

> Date: 2026-03-19 | Designer: TC-Designer (Anthropic Claude Opus 4.6)
> Phase 2 only: deploy after L1-L3 >= 376 points
> 15 TCs x 10 points = 150 points, raw max 550

---

## Design Principles

1. Headless: all TCs run via `node dist/index.js -p PROMPT --output-format text`
2. Objective grading: `tsc --noEmit`, `grep`, `test -f`, `node --check`
3. Non-overlapping with existing L1-L3 40 TCs
4. 1-5 turns per TC, file-based multi-turn pattern
5. Difficulty: Easy(3) + Medium(7) + Hard(5)

## Common Setup

```bash
TC_DIR=/tmp/dhelix-qa-tcXX
mkdir -p $TC_DIR && cp C:/Users/DBInc/dhelix/.env $TC_DIR/.env && cd $TC_DIR
DHELIX='node C:/Users/DBInc/dhelix/dist/index.js'
```

---

## EASY (3)

### TC-41: CI/CD - GitHub Actions YAML Generation

| Item             | Content                                   |
| ---------------- | ----------------------------------------- |
| **Level**        | L4 Easy                                   |
| **Turns**        | 1                                         |
| **Prerequisite** | package.json with lint/test/build scripts |

**Prerequisite:** Create package.json with scripts (lint: eslint, test: vitest, build: tsup) and devDeps.

**T1 Prompt:**

> package.json을 읽고 GitHub Actions CI 워크플로우 .github/workflows/ci.yml 생성. push+PR 트리거, Node 18/20/22 매트릭스, npm ci->lint->test->build, actions/checkout@v4+setup-node@v4, npm 캐시.

**Grading (10pt):** ci.yml exists(2) + valid YAML(1) + push+PR(1) + Node matrix(2) + lint+test+build(2) + checkout+setup-node+cache(2)

---

### TC-42: Docker - multi-stage Dockerfile + docker-compose.yml

| Item             | Content                                   |
| ---------------- | ----------------------------------------- |
| **Level**        | L4 Easy                                   |
| **Turns**        | 1                                         |
| **Prerequisite** | package.json + src/index.ts (Express app) |

**T1 Prompt:**

> Dockerfile(multi-stage builder+prod, Node 22 alpine, npm ci --omit=dev, 비root, EXPOSE 3000) + docker-compose.yml(app+postgres+redis, ports, volumes, depends_on) 생성.

**Grading (10pt):** Dockerfile(1) + compose(1) + multi-stage(2) + alpine+non-root(1) + 3 services(2) + depends_on+volumes+port(2) + EXPOSE(1)

---

### TC-43: Structured JSON Logging System

| Item             | Content                                              |
| ---------------- | ---------------------------------------------------- |
| **Level**        | L4 Easy                                              |
| **Turns**        | 1                                                    |
| **Prerequisite** | tsconfig.json (strict) + package.json (type: module) |

**T1 Prompt:**

> src/logger.ts 구조화 JSON 로깅. 순수 TS, 외부 의존성 없음. LogLevel 4단계, createLogger({level,context?}) 팩토리, JSON stdout 출력, ISO-8601 timestamp, child(context) 하위로거, level 미만 무시. named export.

**Grading (10pt):** file(1) + tsc(2) + 4 methods(2) + JSON.stringify(1) + toISOString(1) + child()(1) + named+createLogger(2)

---

## MEDIUM (7)

### TC-44: GraphQL SDL + Resolvers + Types

| Item             | Content                                                  |
| ---------------- | -------------------------------------------------------- |
| **Level**        | L4 Medium                                                |
| **Turns**        | 1                                                        |
| **Prerequisite** | NEXUS.md (User/Post domain spec), tsconfig, package.json |

**NEXUS.md:** User(id,name,email,posts), Post(id,title,content,author,createdAt). Query: users/user(id)/posts/post(id). Mutation: createUser/createPost/deletePost. In-memory array.

**T1:** src/schema.graphql(SDL) + src/types.ts(TS interfaces) + src/resolvers.ts(인메모리 CRUD). named, strict.

**Grading (10pt):** 3 files(2) + SDL 4 types(2) + TS interfaces(1) + CRUD 4+ fns(2) + tsc(2) + named(1)

---

### TC-45: JWT Authentication + RBAC

| Item             | Content                              |
| ---------------- | ------------------------------------ |
| **Level**        | L4 Medium                            |
| **Turns**        | 2                                    |
| **Prerequisite** | NEXUS.md, express+jwt deps, tsconfig |

**T1:** src/middleware/auth.ts(JWT verify, Bearer, JWT_SECRET, 401) + rbac.ts(requireRole, admin>editor>viewer, 403) + types.ts. named.
**T2:** src/app.ts Express 3 routes with auth+rbac middleware.

**Grading (10pt):** auth.ts(1) + rbac.ts(1) + JWT verify(1) + 401(1) + role hierarchy(2) + 403(1) + 3 routes(2) + named(1)

---

### TC-46: Type-safe In-memory Cache Layer

| Item             | Content                 |
| ---------------- | ----------------------- |
| **Level**        | L4 Medium               |
| **Turns**        | 1                       |
| **Prerequisite** | tsconfig + package.json |

**T1:** src/cache.ts 순수 TS. createCache<T>({ttl, maxSize?}) Map. get/set/delete/has/clear/size/keys + TTL lazy + maxSize LRU + invalidatePattern(glob) + stats() + withCache(key,fn,ttl?). named.

**Grading (10pt):** file(1) + tsc(2) + CRUD(2) + TTL(1) + LRU(1) + invalidatePattern(1) + stats(1) + withCache(1)

---

### TC-47: i18n - String Extraction + Multi-language Resources

| Item             | Content                                     |
| ---------------- | ------------------------------------------- |
| **Level**        | L4 Medium                                   |
| **Turns**        | 2                                           |
| **Prerequisite** | src/app.ts with 7+ hardcoded Korean strings |

**T1:** 한국어 추출 -> src/i18n/index.ts(t함수) + ko.json + en.json + ja.json. 도트 표기법.
**T2:** app.ts 하드코딩 전부 t() 호출로 교체. console.log 포함.

**Grading (10pt):** 3 JSON(2) + index.ts(1) + 5+ keys(1) + key match(1) + 0 Korean(2) + 5+ t()(2) + dot notation(1)

---

### TC-48: Algorithm Optimization O(n^2) to O(n)

| Item             | Content                                                                                |
| ---------------- | -------------------------------------------------------------------------------------- |
| **Level**        | L4 Medium                                                                              |
| **Turns**        | 2                                                                                      |
| **Prerequisite** | src/problems.ts with twoSum O(n^2), longestUniqueSubstring O(n^3), topKFrequent O(n^2) |

**T1:** src/optimized.ts: twoSum(HashMap) + longestUniqueSubstring(슬라이딩윈도우) + topKFrequent(버킷). 복잡도 주석. named.
**T2:** src/optimized.test.ts vitest 9+ tests. ESM import.

**Grading (10pt):** file(1) + 3 fns(1) + HashMap(1) + sliding window(1) + bucket(1) + comments(1) + tsc(1) + 9+ tests(1) + named(1)

---

### TC-49: Playwright E2E - Page Object Pattern

| Item             | Content                                       |
| ---------------- | --------------------------------------------- |
| **Level**        | L4 Medium                                     |
| **Turns**        | 1                                             |
| **Prerequisite** | NEXUS.md (login/dashboard/profile page specs) |

**T1:** e2e/pages/login.page.ts + dashboard.page.ts + profile.page.ts + e2e/login-flow.spec.ts. PO: constructor(page:Page), Locator, async, named.

**Grading (10pt):** 4 files(2) + 3 PO classes(3) + test blocks(1) + PO imports(1) + PW API(1) + tsc(1) + named(1)

---

### TC-50: WebSocket Advanced - Reconnect + Heartbeat + Queue

| Item             | Content                          |
| ---------------- | -------------------------------- |
| **Level**        | L4 Medium                        |
| **Turns**        | 1                                |
| **Prerequisite** | tsconfig + package.json (ws dep) |

**T1:** src/ws-client.ts: 재연결(지수백오프 1s~30s, max10), 하트비트(30s ping, 10s pong), 오프라인큐(flush), 콜백 5개, 상태 5개, close()/destroy(). createReliableWebSocket. named.

**Grading (10pt):** file(1) + tsc(1) + reconnect+backoff(2) + heartbeat(2) + queue(2) + states(1) + close/destroy(1)

---

## HARD (5)

### TC-51: Large-scale Refactoring - 5+ File Interface Change

| Item             | Content                     |
| ---------------- | --------------------------- |
| **Level**        | L4 Hard                     |
| **Turns**        | 2                           |
| **Prerequisite** | 6-file Product/Order domain |

**Fixture:** types.ts(Product{id,name,price}, OrderItem, Order) + product-repo + order-service + discount + formatter + validator.

**T1:** Product에 category:string + createdAt:Date. 5파일 업데이트. tsc 0.
**T2:** tsc --noEmit 실행, 에러시 수정.

**Grading (10pt):** types fields(2) + repo(1) + formatter(1) + validator(1) + discount(1) + tsc(3) + named(1)

---

### TC-52: Monorepo Topological Sort Build Order

| Item             | Content                                   |
| ---------------- | ----------------------------------------- |
| **Level**        | L4 Hard                                   |
| **Turns**        | 2                                         |
| **Prerequisite** | 5 packages (utils->logger->core->api,cli) |

**T1:** packages/ 스캔, 토폴로지 정렬 scripts/build-order.js. 순환감지, JSON {buildOrder, graph}. node 실행.
**T2:** 실행+순서 검증 (utils < logger < core < api,cli).

**Grading (10pt):** file(1) + executable(2) + 5 pkgs(1) + correct order(3) + JSON(1) + cycle(1) + syntax(1)

---

### TC-53: MCP Server Config + Tool Bridge Stub

| Item             | Content                           |
| ---------------- | --------------------------------- |
| **Level**        | L4 Hard                           |
| **Turns**        | 2                                 |
| **Prerequisite** | NEXUS.md (3 MCP servers), zod dep |

**T1:** .dhelix/mcp.json(3서버) + src/mcp-tool-bridge.ts(bridgeMcpTool: JSON Schema->Zod, mcp\_\_ naming, confirm, stub). named.
**T2:** src/mcp-tool-bridge.test.ts vitest 4+ tests.

**Grading (10pt):** mcp.json(1) + 3 servers(1) + bridge(1) + function(1) + naming(1) + Zod(2) + tsc(1) + tests(1) + named(1)

---

### TC-54: Transform Stream Log Parser

| Item             | Content                                                           |
| ---------------- | ----------------------------------------------------------------- |
| **Level**        | L4 Hard                                                           |
| **Turns**        | 2                                                                 |
| **Prerequisite** | 15-line sample.log (INFO/DEBUG/WARN/ERROR, 4 services, key=value) |

**T1:** src/log-parser.ts: Transform/readline, regex, ParsedLogEntry, metadata key=value, parseLogFile AsyncGenerator, getLogStats(). node:stream/fs/readline. named.
**T2:** src/main.js: sample.log -> JSON stats. node 실행.

**Grading (10pt):** file(1) + tsc(1) + stream/readline(2) + regex(1) + metadata(1) + type(1) + stats(1) + parse(1) + named(1)

---

### TC-55: Worker Thread Parallel Task Pool

| Item             | Content                 |
| ---------------- | ----------------------- |
| **Level**        | L4 Hard                 |
| **Turns**        | 2                       |
| **Prerequisite** | tsconfig + package.json |

**T1:** src/worker-pool.ts: createWorkerPool({workerPath, poolSize, taskTimeout?}). execute/executeAll, FIFO queue, timeout, error isolation, stats(), destroy(). node:worker_threads. named.
**T2:** src/worker.js(fibonacci) + src/demo.js(3 parallel+timing). node 실행.

**Grading (10pt):** file(1) + tsc(1) + worker_threads(1) + execute+All(2) + queue(1) + timeout(1) + stats(1) + destroy(1) + worker+demo(1)

---

## Summary

### Difficulty Distribution

| Difficulty | TCs           | Count | Expected         |
| ---------- | ------------- | ----- | ---------------- |
| Easy       | TC-41, 42, 43 | 3     | 95%+ (28.5/30)   |
| Medium     | TC-44~50      | 7     | 85-90% (61.5/70) |
| Hard       | TC-51~55      | 5     | 75-85% (40/50)   |

**Expected Total**: ~130/150 (86.7%)

### Score Simulation

| Scenario           | L1-L3 | L4  | Raw/550 | Rate  |
| ------------------ | ----- | --- | ------- | ----- |
| Current + L4 86%   | 332   | 130 | 462     | 84.0% |
| L1-L3 376 + L4 86% | 376   | 130 | 506     | 92.0% |
| L1-L3 376 + L4 94% | 376   | 141 | 517     | 94.0% |
| L1-L3 390 + L4 90% | 390   | 135 | 525     | 95.5% |

### L1-L3 Non-overlap Matrix

| L4 TC               | Similar L1-L3 | Key Difference                       |
| ------------------- | ------------- | ------------------------------------ |
| TC-41 CI/CD         | None          | New topic                            |
| TC-42 Docker        | None          | New topic                            |
| TC-43 Logging       | TC-37         | Standalone module vs Express server  |
| TC-44 GraphQL       | None          | New topic                            |
| TC-45 JWT/RBAC      | TC-27         | Analysis only vs full implementation |
| TC-46 Caching       | None          | New topic                            |
| TC-47 i18n          | TC-06         | Variable rename vs string extraction |
| TC-48 Perf Opt      | None          | New (algorithm analysis)             |
| TC-49 Playwright    | None          | New topic                            |
| TC-50 WS Advanced   | TC-35         | Rooms vs reconnect+heartbeat+queue   |
| TC-51 Refactoring   | TC-21/30      | 2-3 files vs 5+ files                |
| TC-52 Monorepo      | TC-40         | Structure vs topo sort               |
| TC-53 MCP Bridge    | None          | New (dhelix architecture)            |
| TC-54 Stream Parser | TC-33         | Python CSV vs TS Transform Stream    |
| TC-55 Worker Pool   | None          | New topic                            |

---

_Design: 2026-03-19 | TC-Designer (Anthropic Claude Opus 4.6)_
