/**
 * 세션 승인 저장소 — 현재 세션 동안의 권한 승인을 캐시하는 모듈
 *
 * 사용자가 도구 실행을 승인하면, 같은 세션 내에서 동일한 도구를
 * 다시 사용할 때 반복적으로 확인을 요청하지 않도록 캐시합니다.
 *
 * 두 가지 승인 수준이 있습니다:
 * 1. 특정 인수로 승인: "이 경로의 파일 읽기"만 허용 (키: "도구:인수")
 * 2. 도구 전체 승인: "이 도구의 모든 호출" 허용 (키: "도구이름")
 *
 * 세션 저장소는 기본적으로 메모리에만 유지되지만,
 * save()/load()를 통해 디스크에 영속화할 수도 있습니다.
 * (파일 경로: ~/.dhelix/session-approvals.json)
 *
 * 영구 권한 저장소(persistent-store.ts)와의 차이점:
 * - 세션 저장소: 현재 실행 동안만 유지, 빈번한 읽기 최적화
 * - 영구 저장소: settings.json에 저장, 세션 간 유지
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/**
 * 세션 범위의 승인 캐시 클래스
 *
 * Set 자료구조를 사용하여 O(1) 시간에 승인 여부를 확인합니다.
 * 승인 키는 "도구이름" 또는 "도구이름:인수" 형태의 문자열입니다.
 */
export class SessionApprovalStore {
  /** 승인된 키들을 저장하는 Set (빠른 조회를 위해 사용) */
  private readonly approved = new Set<string>();

  /**
   * 도구 호출에 대한 캐시 키를 생성합니다.
   *
   * 인수에 "path" 속성이 있으면 "도구이름:경로" 형태의 구체적 키를 생성합니다.
   * 그렇지 않으면 도구 이름만 사용합니다.
   *
   * @param toolName - 도구 이름
   * @param args - 도구 인수 (선택적)
   * @returns 캐시 키 문자열
   */
  private buildKey(toolName: string, args?: Readonly<Record<string, unknown>>): string {
    // path 인수가 있으면 "도구:경로" 형태로 더 구체적인 키 생성
    if (args && "path" in args && typeof args.path === "string") {
      return `${toolName}:${args.path}`;
    }
    return toolName;
  }

  /**
   * 도구 호출이 이번 세션에서 이미 승인되었는지 확인합니다.
   *
   * 확인 순서:
   * 1. 구체적 키 (도구 + 인수)로 정확히 매칭되는지 확인
   * 2. 도구 이름만으로 전체 승인되었는지 확인 (approveAll로 설정된 경우)
   *
   * @param toolName - 확인할 도구 이름
   * @param args - 도구 인수 (선택적)
   * @returns 승인되었으면 true
   */
  isApproved(toolName: string, args?: Readonly<Record<string, unknown>>): boolean {
    // 구체적 키(도구+인수)로 정확히 매칭
    if (this.approved.has(this.buildKey(toolName, args))) {
      return true;
    }
    // 도구 전체가 승인되었는지 확인 (인수 무관)
    return this.approved.has(toolName);
  }

  /**
   * 특정 도구 호출을 이번 세션에서 승인합니다.
   *
   * 인수가 있으면 해당 인수의 호출만 승인합니다.
   *
   * @param toolName - 승인할 도구 이름
   * @param args - 도구 인수 (선택적)
   */
  approve(toolName: string, args?: Readonly<Record<string, unknown>>): void {
    this.approved.add(this.buildKey(toolName, args));
  }

  /**
   * 도구의 모든 향후 호출을 이번 세션에서 승인합니다.
   *
   * 도구 이름만을 키로 등록하여, 어떤 인수로 호출하든 승인됩니다.
   *
   * @param toolName - 전체 승인할 도구 이름
   */
  approveAll(toolName: string): void {
    this.approved.add(toolName);
  }

  /**
   * 모든 세션 승인을 초기화합니다.
   *
   * 권한 모드 변경이나 보안 재설정 시 사용합니다.
   */
  clear(): void {
    this.approved.clear();
  }

  /**
   * 현재 등록된 승인 항목의 수를 반환합니다.
   */
  get size(): number {
    return this.approved.size;
  }

  /**
   * 세션 승인을 영속화할 파일 경로
   * ~/.dhelix/session-approvals.json
   */
  private get persistPath(): string {
    return join(homedir(), ".dhelix", "session-approvals.json");
  }

  /**
   * 현재 승인 상태를 디스크에 저장합니다.
   *
   * JSON 배열 형태로 저장되며, 최선 노력(best-effort) 방식으로
   * 저장 실패 시 에러를 무시합니다 (세션 데이터이므로 유실되어도 무방).
   */
  save(): void {
    try {
      const dir = join(homedir(), ".dhelix");
      // 디렉토리가 없으면 생성 (recursive: true)
      mkdirSync(dir, { recursive: true });
      // Set을 배열로 변환하여 JSON으로 직렬화
      writeFileSync(this.persistPath, JSON.stringify([...this.approved]), "utf-8");
    } catch {
      // 최선 노력 영속화 — 저장 실패해도 기능에 지장 없음
    }
  }

  /**
   * 디스크에서 저장된 승인 상태를 복원합니다.
   *
   * 이전 세션의 승인 상태를 이어서 사용하고 싶을 때 호출합니다.
   * 파일이 없거나 파싱 실패 시 빈 상태에서 시작합니다.
   */
  load(): void {
    try {
      const data = readFileSync(this.persistPath, "utf-8");
      const approvals = JSON.parse(data) as string[];
      for (const key of approvals) {
        this.approved.add(key);
      }
    } catch {
      // 저장된 승인이 없거나 파싱 에러 — 빈 상태로 시작
    }
  }
}
