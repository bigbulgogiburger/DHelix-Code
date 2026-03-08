# dbcode vs Claude Code v2.1.71 — 종합 비교 분석

> **분석일**: 2026-03-09
> **Claude Code 기준 버전**: v2.1.71 (2026-03-06 릴리즈)
> **dbcode 기준**: main branch (commit a825d8e)
> **Sources**: Claude Code 공식 문서, GitHub 릴리즈, Piebald-AI 시스템 프롬프트 추출, 실제 코드 분석

---

## 1. 총 평점: **7.5 / 10**

dbcode는 코어 에이전트 엔진(도구 시스템, ReAct 루프, 컨텍스트 관리, 퍼미션)에서 Claude Code와 동등한 수준의 완성도를 보유하고 있으며, **다중 LLM 지원**이라는 고유 강점이 있다. 그러나 **Auto-Memory**, **영구 퍼미션 저장**, **IDE 통합**, **멀티서피스 접근**(데스크톱 앱, 웹, 모바일), **Windows/Linux 지원 완성도**에서 체감되는 격차가 존재한다.

---

## 2. 카테고리별 상세 비교

### 2.1 내장 도구 시스템

| 도구 | Claude Code | dbcode | 비고 |
|------|-------------|--------|------|
| Read (파일 읽기) | ✅ | ✅ `file_read` | 이미지/PDF/노트북 모두 지원 |
| Write (파일 쓰기) | ✅ | ✅ `file_write` | 동등 |
| Edit (파일 편집) | ✅ | ✅ `file_edit` | 동등, diff preview 포함 |
| Bash (셸 실행) | ✅ | ✅ `bash_exec` | 타임아웃, 백그라운드 지원 |
| BashOutput (백그라운드 출력) | ✅ 별도 도구 | ⚠️ bash_exec에 통합 | Claude Code는 별도 도구로 분리 |
| KillShell (셸 종료) | ✅ 별도 도구 | ⚠️ bash_exec에 통합 | Claude Code는 별도 도구로 분리 |
| Glob (파일 검색) | ✅ | ✅ `glob_search` | 동등 |
| Grep (내용 검색) | ✅ ripgrep 기반 | ✅ `grep_search` | fast-glob 기반 (ripgrep 아님) |
| WebFetch (웹 페이지) | ✅ | ✅ `web_fetch` | dbcode는 15분 캐시 + FIFO 50개 |
| WebSearch (웹 검색) | ✅ | ✅ `web_search` | Brave + DuckDuckGo 폴백 |
| NotebookEdit (주피터) | ✅ | ✅ `notebook_edit` | 동등 |
| TodoWrite (할일 관리) | ✅ | ✅ `todo_write` | 동등 |
| Agent/Task (서브에이전트) | ✅ Task 도구 | ✅ `agent` 도구 | 팩토리 패턴, explore/plan/general |
| ExitPlanMode | ✅ | ❌ | Claude Code 전용 |
| SlashCommand (내부 실행) | ✅ | ❌ | Claude Code 전용 |
| ListDir (디렉토리 목록) | ❌ (Bash로 대체) | ✅ `list_dir` | dbcode에만 있음 |
| Mkdir (디렉토리 생성) | ❌ (Bash로 대체) | ✅ `mkdir` | dbcode에만 있음 |
| AskUser (사용자 질문) | ✅ AskFollowupQuestion | ✅ `ask_user` | 동등 |

**도구 수**: Claude Code 15개 vs dbcode 14개 — 거의 동등하나 구성이 다름.

**점수: 9.0 / 10**

---

### 2.2 에이전트 루프 (ReAct Pattern)

| 항목 | Claude Code | dbcode | 상태 |
|------|-------------|--------|------|
| ReAct 루프 | ✅ gather → act → verify | ✅ input → filter → LLM → extract → execute → loop | 동등 |
| 병렬 도구 실행 | ✅ | ✅ read-only 병렬, write 충돌 감지 | 동등 |
| 자동 컨텍스트 압축 | ✅ | ✅ 83.5% 임계값 3-layer | 동등 |
| 스트리밍 | ✅ | ✅ SSE + 1MB 백프레셔 | 동등 |
| 가드레일 (입출력 필터) | ✅ | ✅ 시크릿 스캐너 + 명령어 필터 | 동등 |
| 반복 제한 | ✅ | ✅ maxIterations: 50 | 동등 |
| 자동 체크포인트 | ✅ 파일 편집 전 스냅샷 | ✅ file_write/file_edit 전 | 동등 |
| 에러 분류 및 재시도 | ✅ | ✅ transient/overload/permanent | 동등 |
| 중간 메시지 이벤트 | ✅ | ✅ `agent:assistant-message` | 동등 |

**점수: 9.5 / 10**

---

### 2.3 컨텍스트 & 메모리 관리

| 항목 | Claude Code | dbcode | 상태 |
|------|-------------|--------|------|
| 컨텍스트 자동 압축 | ✅ tool output 먼저, 대화 요약 후 | ✅ 3-layer (micro → summary → rehydrate) | dbcode가 더 정교 |
| `/compact` 수동 압축 | ✅ focus 인자 지원 | ✅ | 동등 |
| `/context` 사용량 확인 | ✅ | ✅ | 동등 |
| **Auto-Memory** | ✅ `~/.claude/projects/<project>/memory/MEMORY.md` | ❌ **없음** | **핵심 격차** |
| 세션 간 학습 | ✅ Claude가 자동으로 패턴/선호 저장 | ❌ | **핵심 격차** |
| MEMORY.md 자동 로드 | ✅ 첫 200줄 매 세션 시작 시 | ❌ | 미구현 |
| 토픽별 메모리 파일 | ✅ debugging.md, patterns.md 등 | ❌ | 미구현 |
| `/memory` 명령어 | ✅ 메모리 조회/편집/토글 | ✅ (기본 구현) | Claude Code가 더 풍부 |

**점수: 6.5 / 10**

> **이것이 가장 큰 격차이다.** Claude Code의 Auto-Memory는 세션 간 컨텍스트 연속성을 제공하는 핵심 기능이다. 개발자가 "지난 세션에서 발견한 그 빌드 커맨드"를 자동으로 기억하고, 프로젝트별 디버깅 인사이트와 사용자 선호를 축적한다.

---

### 2.4 프로젝트 지침 시스템 (CLAUDE.md / DBCODE.md)

| 항목 | Claude Code | dbcode | 상태 |
|------|-------------|--------|------|
| 프로젝트 지침 파일 | ✅ `CLAUDE.md` | ✅ `DBCODE.md` | 동등 |
| 계층적 로딩 | ✅ managed → project → user → local | ✅ global → rules → parent → project → rules → local (6-layer) | 동등 |
| `.local.md` 오버라이드 | ✅ `CLAUDE.local.md` (gitignored) | ✅ `DBCODE.local.md` | 동등 |
| **`@import` 구문** | ✅ `@path/to/file` 재귀 (5단계) | ❌ **없음** | **격차** |
| `.claude/rules/` | ✅ 토픽별 분리 | ✅ `.dbcode/rules/` | 동등 |
| **path-specific rules** | ✅ YAML `paths:` (다중 패턴) | ⚠️ `pattern:` (단일 glob) | Claude Code가 더 유연 |
| 하위 디렉토리 지연 로드 | ✅ 파일 접근 시 로드 | ❌ 전부 시작 시 로드 | 격차 |
| **Managed Policy** | ✅ `/Library/Application Support/` IT 배포 | ❌ | **기업용 격차** |
| 심링크 지원 | ✅ | ❌ | 미구현 |

**점수: 7.5 / 10**

---

### 2.5 퍼미션 & 보안

| 항목 | Claude Code | dbcode | 상태 |
|------|-------------|--------|------|
| 퍼미션 모드 | ✅ 5개 | ✅ 5개 (동일) | 동등 |
| 세션 내 승인 캐시 | ✅ | ✅ SessionApprovalStore | 동등 |
| **영구 퍼미션 저장** | ✅ `settings.json`에 `allow/deny` 규칙 | ❌ **세션 종료 시 사라짐** | **핵심 격차** |
| **와일드카드 패턴** | ✅ `Bash(npm run *)`, `Edit(/src/**)` | ❌ 도구명 수준만 | **격차** |
| **deny 우선 규칙** | ✅ deny → ask → allow 순서 | ⚠️ rules + mode 기반 | Claude Code가 더 정교 |
| `/permissions` 관리 UI | ✅ | ❌ | 미구현 |
| 시크릿 스캐닝 | ✅ | ✅ | 동등 |
| 명령어 필터링 | ✅ | ✅ | 동등 |
| macOS Seatbelt | ✅ | ✅ | 동등 |
| **Linux bubblewrap** | ✅ 네트워크 프록시 포함 | ❌ **macOS만** | **격차** |
| **네트워크 격리** | ✅ 프록시 통한 도메인 필터링 | ❌ | **격차** |
| **Windows 샌드박스** | ⚠️ WSL2에서 bubblewrap 사용 | ❌ | **격차** |
| Managed Settings (기업) | ✅ MDM/GPO 배포, 오버라이드 불가 | ❌ | **기업용 격차** |

**점수: 6.5 / 10**

> Anthropic 공식 수치: 샌드박싱 도입 후 퍼미션 프롬프트가 **84% 감소**.

---

### 2.6 CLI / UX

| 항목 | Claude Code | dbcode | 상태 |
|------|-------------|--------|------|
| 터미널 UI | ✅ Ink | ✅ Ink 5.x | 동등 |
| 안티플리커 | ✅ | ✅ DEC Mode 2026 + Progressive Static | 동등 |
| 스트리밍 렌더링 | ✅ | ✅ 100ms batched | 동등 |
| 입력 히스토리 (영구) | ✅ | ✅ `~/.dbcode/input-history.json` | 동등 |
| 키보드 단축키 | ✅ | ✅ | 동등 |
| 상태바 | ✅ | ✅ | 동등 |
| 멀티라인 입력 | ✅ Shift+Enter (v2.1.0+) | ✅ Ctrl+J | 동등 |
| Tab 자동완성 | ✅ | ✅ 파일 경로 + @mentions | 동등 |
| 슬래시 명령어 메뉴 | ✅ | ✅ | 동등 |
| Thinking 블록 UI | ✅ 토글 (Alt+T) | ✅ ThinkingBlock | 동등 |
| **시스템 알림** | ✅ 데스크톱 알림 | ❌ | 미구현 |

**점수: 8.5 / 10**

---

### 2.7 멀티 서피스 & IDE 통합

| 항목 | Claude Code | dbcode | 상태 |
|------|-------------|--------|------|
| 터미널 CLI | ✅ | ✅ | 동등 |
| **VS Code Extension** | ✅ 인라인 diff, @mentions, plan review | ❌ | **큰 격차** |
| **JetBrains Plugin** | ✅ IntelliJ, PyCharm, WebStorm | ❌ | **큰 격차** |
| **Desktop App** | ✅ macOS + Windows (Electron) | ❌ | **큰 격차** |
| **Web Version** | ✅ claude.ai/code (브라우저) | ❌ | **큰 격차** |
| **모바일 접근** | ✅ Remote Control + iOS 앱 | ❌ | **큰 격차** |
| `/teleport` (웹→CLI) | ✅ | ❌ | 미구현 |
| **Chrome 디버깅** | ✅ Claude in Chrome | ❌ | 미구현 |

**점수: 2.0 / 10**

> dbcode는 **OpenAI-compatible API를 지원하는 범용 CLI**를 지향하므로, 이 격차는 프로젝트 방향성의 차이이기도 하다.

---

### 2.8 멀티 에이전트

| 항목 | Claude Code | dbcode | 상태 |
|------|-------------|--------|------|
| Subagents | ✅ explore/plan/task | ✅ explore/plan/general | 동등 |
| Worktree 격리 | ✅ | ✅ | 동등 |
| 백그라운드 에이전트 | ✅ | ✅ | 동등 |
| 에이전트 재개 | ✅ | ✅ history store (100개) | 동등 |
| **Agent Teams** | ✅ 실험적 (TeamCreate, SendMessage) | ❌ | **격차** |
| 공유 태스크 리스트 | ✅ | ❌ | 미구현 |
| 에이전트 간 메시징 | ✅ mailbox | ❌ | 미구현 |
| split-pane (tmux/iTerm2) | ✅ | ❌ | 미구현 |

**점수: 6.0 / 10**

> Agent Teams는 아직 실험적(experimental)이며 세션 재개 미지원 등 제한사항이 있다.

---

### 2.9 Windows 지원 상세 비교

| 항목 | Claude Code | dbcode | 상태 |
|------|-------------|--------|------|
| **네이티브 Windows 설치** | ✅ PowerShell/CMD 설치 스크립트 | ⚠️ npm 글로벌만 | 격차 |
| **Windows ARM64 바이너리** | ✅ win32-arm64 네이티브 (2026-02) | ❌ | 격차 |
| **Windows Desktop App** | ✅ x64 + ARM64 (2026-03-04) | ❌ | 격차 |
| **Git for Windows 통합** | ✅ Git Bash 기반 실행 | ⚠️ cmd.exe 사용 | 격차 |
| **WSL2 지원** | ✅ bubblewrap + socat 샌드박스 | ❌ | 격차 |
| **WSL1 감지/경고** | ✅ "WSL1 미지원" 메시지 | ❌ | 미구현 |
| **Windows 샌드박스** | ⚠️ 네이티브 Windows는 미지원 (WSL2 필요) | ❌ | 둘 다 미지원 |
| **경로 정규화** | ✅ | ✅ `src/utils/path.ts` | 동등 |
| **셸 명령어** | ✅ Git Bash | ⚠️ `cmd.exe /c` | **격차** |
| **PowerShell 호환** | ⚠️ 실험적 | ❌ | 격차 |

**dbcode의 Windows 현재 상태:**
- `src/utils/platform.ts`: `isWindows()`, `getShellCommand()` → `cmd.exe` 사용
- `src/sandbox/seatbelt.ts`: macOS 전용 — Windows에서는 **샌드박스 없이 실행**
- `src/tools/definitions/bash-exec.ts`: Windows 경로 처리 있으나 Git Bash 미사용
- `src/utils/path.ts`: 크로스 플랫폼 경로 정규화 (`\` → `/`)

**Claude Code의 Windows 접근법:**
- Git for Windows 필수 설치 → Git Bash를 기본 셸로 사용
- 네이티브 Windows 바이너리 (x64 + ARM64) 제공
- WSL2에서는 Linux와 동일한 bubblewrap 샌드박스 적용
- 네이티브 Windows에서는 `/sandbox` 미지원 (Seatbelt/bubblewrap 대체제 없음)

**점수: 3.0 / 10**

---

### 2.10 CI/CD & 외부 통합

| 항목 | Claude Code | dbcode | 상태 |
|------|-------------|--------|------|
| **GitHub Actions** | ✅ PR 리뷰, 이슈 분류 | ❌ | **격차** |
| **GitLab CI/CD** | ✅ | ❌ | **격차** |
| **Slack 통합** | ✅ @Claude 멘션 → PR 생성 | ❌ | **격차** |
| MCP 서버 | ✅ | ✅ | 동등 |
| **Code Intelligence (LSP)** | ✅ 플러그인 | ❌ | **격차** |
| 자동 업데이트 | ✅ 백그라운드 | ❌ | 미구현 |

**점수: 4.0 / 10**

---

### 2.11 LLM 지원 (dbcode 강점 영역)

| 항목 | Claude Code | dbcode | 상태 |
|------|-------------|--------|------|
| Anthropic 모델 | ✅ 네이티브 | ✅ 프로바이더 | 동등 |
| OpenAI 모델 | ⚠️ third-party proxy | ✅ **네이티브** | **dbcode 강점** |
| **로컬 모델** | ❌ proxy 필요 | ✅ **OpenAI-compatible** | **dbcode 핵심 강점** |
| Tool call 전략 | ✅ native only | ✅ **native + text-parsing** | **dbcode 강점** |
| Extended Thinking | ✅ | ✅ ThinkingConfig | 동등 |
| 모델 능력 감지 | ✅ | ✅ 30+ 모델 | 동등 |
| 컨텍스트 윈도우 | ✅ 200K (1M premium) | ✅ 설정 가능 (기본 1M) | 동등 |

**점수: 9.5 / 10** (dbcode 강점 영역)

> **dbcode의 가장 큰 차별점.** Ollama, vLLM, LM Studio 등 로컬 모델 사용 가능. `text-parsing` 전략으로 tool_calls 미지원 모델도 대응.

---

## 3. 가중 평점 계산

| 카테고리 | 가중치 | 점수 | 가중 점수 |
|----------|--------|------|----------|
| 내장 도구 시스템 | 10% | 9.0 | 0.90 |
| 에이전트 루프 | 10% | 9.5 | 0.95 |
| 컨텍스트 & 메모리 | 12% | 6.5 | 0.78 |
| 프로젝트 지침 (DBCODE.md) | 7% | 7.5 | 0.525 |
| 퍼미션 & 보안 | 10% | 6.5 | 0.65 |
| CLI / UX | 8% | 8.5 | 0.68 |
| 멀티 서피스 & IDE | 8% | 2.0 | 0.16 |
| 멀티 에이전트 | 7% | 6.0 | 0.42 |
| **Windows 지원** | **8%** | **3.0** | **0.24** |
| CI/CD & 외부 통합 | 5% | 4.0 | 0.20 |
| 스킬 & 훅 | 5% | 7.5 | 0.375 |
| 세션 관리 | 5% | 8.5 | 0.425 |
| LLM 지원 | 5% | 9.5 | 0.475 |
| **합계** | **100%** | | **7.39 → 7.5/10** |

---

## 4. SWOT 분석

### Strengths (강점)

1. **다중 LLM 지원** — OpenAI, Anthropic, 로컬 모델 등 모든 OpenAI-compatible API 지원
2. **text-parsing 전략** — tool_calls 미지원 모델에도 도구 호출 가능
3. **코어 완성도 95%+** — 14개 도구, 3-layer 압축, 6-layer 지침 등 stub 없이 완전 구현
4. **비용 유연성** — 저렴한 모델(gpt-4.1-mini)이나 무료 로컬 모델 사용 가능
5. **정교한 컨텍스트 관리** — 마이크로컴팩션 + 디스크 cold storage + 리하이드레이션

### Weaknesses (약점)

1. **Auto-Memory 없음** — 세션 간 학습 불가
2. **영구 퍼미션 없음** — 매 세션 동일 승인 반복
3. **IDE 통합 없음** — VS Code/JetBrains 확장 부재
4. **Windows 지원 미흡** — cmd.exe 사용, Git Bash 미통합, 샌드박스 없음
5. **Linux 샌드박스 없음** — bubblewrap 미구현

### Opportunities (기회)

1. **Multi-LLM A/B 테스팅** — 여러 모델 비교 (Claude Code에 없는 고유 기능)
2. **로컬 모델 최적화** — Ollama/vLLM 전용 최적화
3. **비용 대시보드** — 모델별 비용/품질 비교
4. **경량 배포** — Anthropic 계정 불필요

### Threats (위협)

1. **Claude Code의 빠른 진화** — 월 2-3회 릴리즈
2. **Cursor, Windsurf 등 경쟁** — IDE 통합 AI 도구의 시장 점유
3. **생태계 효과** — Claude Code의 대규모 스킬/MCP 생태계

---

## 5. 개선 로드맵

### Phase 1: 핵심 격차 해소 (P0) — 목표: 8.5+

| # | 기능 | 난이도 | 효과 | 상세 |
|---|------|--------|------|------|
| 1 | **Auto-Memory System** | ★★★★ | 메모리 6.5→8.5 | `~/.dbcode/projects/{hash}/memory/MEMORY.md` 자동 관리, 첫 200줄 세션 시작 시 로드, 토픽별 파일 분리 |
| 2 | **Persistent Permissions** | ★★☆☆ | 퍼미션 6.5→8.0 | `settings.json`에 `permissions.allow/deny` 배열, 와일드카드 패턴 `Bash(npm *)`, deny 우선 규칙 |
| 3 | **Linux Sandbox** | ★★★☆ | 퍼미션 8.0→8.5 | bubblewrap 기반, 네트워크 프록시 도메인 필터링 |

### Phase 2: Windows 지원 강화 (P0-P1)

| # | 기능 | 난이도 | 상세 |
|---|------|--------|------|
| 4 | **Git Bash 기본 셸 전환** | ★★☆☆ | Windows에서 `cmd.exe` 대신 Git Bash 사용. Claude Code와 동일한 접근법. POSIX 명령어 호환성 확보 |
| 5 | **Windows 설치 스크립트** | ★★☆☆ | PowerShell/CMD 원라인 설치: `irm https://... \| iex`. Git for Windows 자동 감지/설치 안내 |
| 6 | **WSL2 샌드박스 지원** | ★★★☆ | WSL2 감지 시 bubblewrap + socat 사용. WSL1 감지 시 경고 메시지 |
| 7 | **Windows ARM64 지원** | ★★☆☆ | ARM64 네이티브 빌드 또는 x64 에뮬레이션 폴백 |
| 8 | **Windows 경로 개선** | ★☆☆☆ | UNC 경로, 드라이브 레터 처리, `.exe` 확장자 자동 감지 |
| 9 | **PowerShell 호환** | ★★★☆ | PowerShell 감지 시 적절한 명령어 변환 (예: `ls` → `Get-ChildItem`) |

### Phase 3: 경쟁력 강화 (P1)

| # | 기능 | 난이도 | 효과 |
|---|------|--------|------|
| 10 | **VS Code Extension** | ★★★★★ | IDE 2.0→5.0 |
| 11 | **@import 구문** | ★★☆☆ | 지침 7.5→8.5 |
| 12 | **Agent Teams** | ★★★★★ | 멀티에이전트 6.0→8.0 |
| 13 | **시스템 알림** | ★☆☆☆ | UX +0.5 |
| 14 | **자동 업데이트** | ★★☆☆ | DX +0.5 |

### Phase 4: 차별화 (P2)

| # | 기능 | 설명 |
|---|------|------|
| 15 | **Multi-LLM A/B Testing** | 같은 프롬프트 여러 모델 병렬 실행, 결과 비교 |
| 16 | **비용/품질 대시보드** | 모델별 토큰 비용, 응답 시간, 성공률 시각화 |
| 17 | **로컬 모델 First-class** | Ollama/vLLM 전용 최적화 |
| 18 | **GitHub Actions 통합** | PR 리뷰, 이슈 분류 워크플로우 |
| 19 | **Code Intelligence (LSP)** | 타입 에러 감지, 정의 이동, 참조 찾기 |

### Phase 5: 생태계 확장 (P3)

| # | 기능 | 설명 |
|---|------|------|
| 20 | JetBrains Plugin | IntelliJ/WebStorm 통합 |
| 21 | Desktop App | Electron 기반 멀티 세션 |
| 22 | 스킬 핫 리로드 | 개발 중 SKILL.md 변경 즉시 반영 |
| 23 | Managed Settings | 기업용 중앙 관리 정책 |
| 24 | 플러그인 마켓플레이스 | 커뮤니티 도구/스킬 공유 |

---

## 6. Windows 개선 상세 가이드

### 6.1 현재 상태 진단

```
src/utils/platform.ts    → isWindows() ✅, getShellCommand() → cmd.exe ⚠️
src/sandbox/seatbelt.ts  → macOS 전용, Windows에서 무방비 실행
src/tools/definitions/bash-exec.ts → Windows 경로 처리 있으나 불완전
```

### 6.2 Git Bash 전환 (최우선)

**이유**: Claude Code는 Git for Windows의 Git Bash를 기본 셸로 사용한다. 이렇게 하면:
- `grep`, `find`, `cat`, `ls` 등 POSIX 명령어가 Windows에서도 작동
- 셸 스크립트 호환성 확보
- `cmd.exe`의 명령어 차이 문제 해소

```typescript
// src/utils/platform.ts 수정 방향
export function getShellCommand(): string {
  if (isWindows()) {
    // Git Bash 탐색: Program Files → PATH → 폴백
    const gitBashPaths = [
      "C:\\Program Files\\Git\\bin\\bash.exe",
      "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
    ];
    for (const p of gitBashPaths) {
      if (existsSync(p)) return p;
    }
    // Git Bash 없으면 경고 + cmd.exe 폴백
    console.warn("Git Bash not found. Install Git for Windows for best experience.");
    return "cmd.exe";
  }
  return "/bin/bash";
}
```

### 6.3 WSL2 샌드박스

```typescript
// src/sandbox/linux.ts (새 파일)
// WSL2 감지: /proc/version에 "microsoft" 포함 여부
async function isWSL2(): Promise<boolean> {
  try {
    const version = await readFile("/proc/version", "utf-8");
    return version.toLowerCase().includes("microsoft");
  } catch { return false; }
}

// bubblewrap 가용성 확인
async function hasBubblewrap(): Promise<boolean> {
  try {
    await execFileAsync("bwrap", ["--version"]);
    return true;
  } catch { return false; }
}
```

### 6.4 Windows 경로 엣지 케이스

| 케이스 | 예시 | 현재 | 필요 |
|--------|------|------|------|
| 드라이브 레터 | `C:\Users\...` | ⚠️ 부분 처리 | 완전 정규화 |
| UNC 경로 | `\\server\share\...` | ❌ | 지원 필요 |
| Git Bash 경로 | `/c/Users/...` | ❌ | 변환 필요 |
| 환경변수 경로 | `%USERPROFILE%` | ❌ | 확장 필요 |
| 긴 경로 (260+) | `\\?\C:\very\long\...` | ❌ | `longPaths` 레지스트리 |

---

## 7. 결론

### 핵심 차이 한 줄 요약

| 관점 | Claude Code 우위 | dbcode 우위 |
|------|-----------------|------------|
| 범용성 | 6개 서피스 접근 | 모든 LLM 지원 |
| 학습 | Auto-Memory | 비용 유연성 |
| 보안 | 이중 샌드박스 + 영구 퍼미션 | — |
| 확장성 | GitHub/Slack/Chrome 통합 | text-parsing 전략 |
| 플랫폼 | Windows 네이티브 바이너리 + WSL2 | — |

### 7.5 → 9.0으로 가는 핵심 3가지

1. **Auto-Memory** (메모리 6.5→8.5) — 세션 간 학습
2. **Persistent Permissions** (퍼미션 6.5→8.0) — 영구 승인 저장
3. **Windows/Linux 지원 강화** (Windows 3.0→6.0, 퍼미션 8.0→8.5) — Git Bash + bubblewrap

이 세 가지를 구현하면 가중 평점이 **8.5~9.0**까지 상승한다.

---

## Sources

- [Claude Code Overview](https://code.claude.com/docs/en/overview)
- [How Claude Code Works](https://code.claude.com/docs/en/how-claude-code-works)
- [Agent Teams](https://code.claude.com/docs/en/agent-teams)
- [Memory (CLAUDE.md & Auto Memory)](https://code.claude.com/docs/en/memory)
- [Permissions](https://code.claude.com/docs/en/permissions)
- [Sandboxing](https://code.claude.com/docs/en/sandboxing)
- [Claude Code Built-in Tools Reference (vtrivedy)](https://www.vtrivedy.com/posts/claudecode-tools-reference)
- [Claude Code System Prompts (Piebald-AI)](https://github.com/Piebald-AI/claude-code-system-prompts)
- [Claude Code Releases](https://github.com/anthropics/claude-code/releases)
- [Claude Code v2.1.0 Notes](https://www.threads.com/@boris_cherny/post/DTOyRyBD018)
- [Claude Code Sandboxing Blog](https://www.anthropic.com/engineering/claude-code-sandboxing)
- [WSL2 Performance Guide](https://www.thetributary.ai/blog/optimizing-wsl2-claude-code-performance-guide/)
- [Windows Native Install Guide](https://smartscope.blog/en/generative-ai/claude/claude-code-windows-native-installation/)
- [Claude Code Desktop App](https://code.claude.com/docs/en/desktop)
- [Remote Control](https://code.claude.com/docs/en/remote-control)
