/**
 * 업데이트 확인(Update Checker) 모듈
 *
 * npm 레지스트리에서 최신 버전을 확인하여 업데이트가 가능한지 알려줍니다.
 * 주간(7일) 주기로 백그라운드에서 비차단(non-blocking) 확인을 수행합니다.
 *
 * 주니어 개발자를 위한 설명:
 * - 앱 시작 시 npm에서 최신 버전을 확인하여 업데이트 안내를 표시합니다
 * - 매번 확인하면 느려지므로, 마지막 확인 시각을 저장해두고 7일마다 한 번만 확인합니다
 * - 네트워크 문제가 있어도 앱 실행에 영향을 주지 않습니다 (5초 타임아웃, 에러 무시)
 * - 확인 결과는 ~/.dbcode/update-check.json에 캐싱됩니다
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { APP_NAME } from "../constants.js";

/**
 * 사용 가능한 업데이트 정보
 *
 * @property current - 현재 설치된 버전 (예: "0.1.0")
 * @property latest - npm에 게시된 최신 버전 (예: "0.2.0")
 * @property updateCommand - 업데이트를 위해 실행할 명령어
 */
export interface UpdateInfo {
  readonly current: string;
  readonly latest: string;
  readonly updateCommand: string;
}

/** 업데이트 확인 간격: 7일 (밀리초 단위) */
const CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 업데이트 확인 상태 파일의 경로를 반환합니다.
 * ~/.dbcode/update-check.json 에 저장됩니다.
 */
function getStateFilePath(): string {
  return join(homedir(), `.${APP_NAME}`, "update-check.json");
}

/**
 * 디스크에 저장되는 업데이트 확인 상태
 *
 * @property lastCheckTimestamp - 마지막 확인 시각 (Unix 타임스탬프, 밀리초)
 * @property latestVersion - 마지막으로 확인한 최신 버전 (확인 실패 시 null)
 */
interface UpdateCheckState {
  readonly lastCheckTimestamp: number;
  readonly latestVersion: string | null;
}

/**
 * 디스크에서 업데이트 확인 상태를 읽습니다.
 * 파일이 없거나 손상되었으면 null을 반환합니다.
 *
 * @returns 저장된 상태, 또는 파일이 없거나 유효하지 않으면 null
 */
async function readState(): Promise<UpdateCheckState | null> {
  try {
    const raw = await readFile(getStateFilePath(), "utf-8");
    const parsed: unknown = JSON.parse(raw);
    // 타입 가드: lastCheckTimestamp 필드가 숫자인지 확인
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "lastCheckTimestamp" in parsed &&
      typeof (parsed as Record<string, unknown>).lastCheckTimestamp === "number"
    ) {
      return parsed as UpdateCheckState;
    }
    return null;
  } catch {
    // 파일 없음, 파싱 실패 등 → null 반환
    return null;
  }
}

/**
 * 업데이트 확인 상태를 디스크에 저장합니다.
 *
 * @param state - 저장할 상태 객체
 */
async function writeState(state: UpdateCheckState): Promise<void> {
  const filePath = getStateFilePath();
  const dir = join(homedir(), `.${APP_NAME}`);
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, JSON.stringify(state, null, 2), "utf-8");
}

/**
 * npm 레지스트리에서 최신 버전을 가져옵니다.
 *
 * 앱 시작 시간에 영향을 주지 않도록 5초 타임아웃을 설정합니다.
 * 네트워크 오류가 발생하면 null을 반환합니다 (비차단).
 *
 * @returns 최신 버전 문자열 (예: "0.2.0"), 또는 실패 시 null
 */
async function fetchLatestVersion(): Promise<string | null> {
  try {
    // AbortController로 5초 타임아웃 구현
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    const response = await fetch(
      `https://registry.npmjs.org/${APP_NAME}/latest`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);

    if (!response.ok) return null;

    // 응답에서 version 필드 추출
    const data: unknown = await response.json();
    if (
      typeof data === "object" &&
      data !== null &&
      "version" in data &&
      typeof (data as Record<string, unknown>).version === "string"
    ) {
      return (data as Record<string, unknown>).version as string;
    }
    return null;
  } catch {
    // 네트워크 에러, 타임아웃 등 → null 반환 (앱 실행에 영향 없음)
    return null;
  }
}

/**
 * 두 시맨틱 버전(semver) 문자열을 비교합니다.
 *
 * 시맨틱 버전이란? "주버전.부버전.패치" 형식 (예: 1.2.3)
 * - 주버전(major): 호환되지 않는 변경
 * - 부버전(minor): 하위 호환되는 기능 추가
 * - 패치(patch): 하위 호환되는 버그 수정
 *
 * @param current - 현재 설치된 버전
 * @param latest - 비교할 최신 버전
 * @returns latest가 current보다 새로운 버전이면 true
 */
export function isNewerVersion(current: string, latest: string): boolean {
  // 버전 문자열에서 숫자 배열을 추출 (예: "v1.2.3" → [1, 2, 3])
  const parseSemver = (v: string): readonly number[] =>
    v
      .replace(/^v/, "") // "v" 접두사 제거
      .split(".")
      .map((s) => parseInt(s, 10) || 0);

  const currentParts = parseSemver(current);
  const latestParts = parseSemver(latest);

  // 주버전 → 부버전 → 패치 순서로 비교
  for (let i = 0; i < 3; i++) {
    const c = currentParts[i] ?? 0;
    const l = latestParts[i] ?? 0;
    if (l > c) return true;  // latest가 더 크면 새 버전
    if (l < c) return false; // current가 더 크면 아님
  }
  // 모든 부분이 같으면 같은 버전이므로 false
  return false;
}

/**
 * npm에서 사용 가능한 업데이트를 확인합니다.
 *
 * 주간(7일) 주기로 백그라운드에서 비차단 확인을 수행합니다.
 * 최근에 확인한 결과가 있으면 캐시된 결과를 사용합니다.
 *
 * 동작 흐름:
 * 1. 이전 확인 상태를 디스크에서 읽음
 * 2. 7일 이내에 확인했으면 캐시된 결과 사용
 * 3. 7일이 지났으면 npm 레지스트리에서 최신 버전 확인
 * 4. 결과를 디스크에 저장 (다음 확인 시 사용)
 * 5. 새 버전이 있으면 UpdateInfo 반환, 없으면 null
 *
 * @param currentVersion - 현재 설치된 버전 (예: "0.1.0")
 * @returns 업데이트가 가능하면 UpdateInfo, 아니면 null
 */
export async function checkForUpdates(
  currentVersion: string,
): Promise<UpdateInfo | null> {
  // 이전 확인 상태 로드
  const state = await readState();
  const now = Date.now();

  // 7일 이내에 확인했으면 캐시된 결과 사용
  if (state && now - state.lastCheckTimestamp < CHECK_INTERVAL_MS) {
    if (
      state.latestVersion &&
      isNewerVersion(currentVersion, state.latestVersion)
    ) {
      return {
        current: currentVersion,
        latest: state.latestVersion,
        updateCommand: `npm install -g ${APP_NAME}@latest`,
      };
    }
    return null;
  }

  // 새로운 확인 수행 (npm 레지스트리 조회)
  const latest = await fetchLatestVersion();

  // 확인 결과를 디스크에 저장 (저장 실패는 무시 — 치명적이지 않음)
  await writeState({
    lastCheckTimestamp: now,
    latestVersion: latest,
  }).catch(() => {
    // 저장 실패는 비치명적이므로 조용히 무시
  });

  if (!latest) return null;

  if (isNewerVersion(currentVersion, latest)) {
    return {
      current: currentVersion,
      latest,
      updateCommand: `npm install -g ${APP_NAME}@latest`,
    };
  }

  return null;
}
