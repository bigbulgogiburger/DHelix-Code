# Dashboard & Cloud Execution

> 참조 시점: 대시보드 API 확장, 클라우드 실행 연동, SSE 이벤트 추가 시

## Dashboard Server (`src/dashboard/`)

### REST API 라우트

| Method | Path                | 설명              |
| ------ | ------------------- | ----------------- |
| GET    | `/api/sessions`     | 세션 목록         |
| GET    | `/api/sessions/:id` | 세션 상세         |
| GET    | `/api/mcp/servers`  | MCP 서버 상태     |
| GET    | `/api/jobs`         | 작업 목록         |
| GET    | `/api/metrics`      | 런타임 메트릭     |
| GET    | `/api/events`       | SSE 실시간 스트림 |
| GET    | `/health`           | 헬스체크          |

### SSE / WebSocket 이벤트

- REST: `src/dashboard/server.ts`
- WebSocket: `src/dashboard/websocket.ts` — 실시간 스트림 (세션/작업/에이전트 메시지)
- 이벤트: `session:updated`, `mcp:health-changed`, `job:progress`, `metrics:updated`, `agent:message`
- 30초 heartbeat, 클라이언트 자동 정리
- 데이터 소스 DI 패턴 (SessionDataSource 등)

## Cloud Execution (`src/cloud/`)

### Job Queue (`job-queue.ts`)

- 우선순위: critical > high > normal > low (같은 레벨은 FIFO)
- `enqueue()` → `dequeue()` → `updateStatus()` 생명주기
- `listJobs(filter)`, `getStats()`, `cancel()`

### Agent Runner (`agent-runner.ts`)

- AbortController 기반 타임아웃/취소
- 현재: 인메모리 시뮬레이션 (향후 HTTP/Docker 확장 포인트)
- `executeJob()`, `cancelExecution()`, `getRunningCount()`

### Result Sync (`result-sync.ts`)

- 아티팩트 분류: file-change / test-result / analysis
- `getPendingChanges()` → `applyChanges(ids)` / `rejectChanges(ids)` 승인 패턴

## Auth (`src/auth/`)

- **Token Store** (`token-store.ts`) — Bearer / API-Key / Custom-header 토큰 저장
- **OAuth Token Store** (`mcp/oauth-pkce.ts`) — MCP 서버용 PKCE 챌린지 + 파일 기반 토큰 저장

> 이전 문서의 `sso-saml.ts`는 현재 소스에 존재하지 않음 (로드맵 항목).
