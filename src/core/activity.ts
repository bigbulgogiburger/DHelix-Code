/**
 * 활동(Activity) 수집 모듈
 *
 * 에이전트 루프 실행 중 발생하는 모든 활동을 수집하고 관리합니다.
 * 활동은 "턴(turn)" 단위로 그룹화됩니다.
 * 하나의 턴 = 사용자 메시지 1개 + 에이전트의 전체 응답 사이클
 *
 * 주니어 개발자를 위한 설명:
 * - "턴"이란 사용자가 질문하고 AI가 답변하는 하나의 왕복 과정입니다
 * - 하나의 턴 안에서 여러 도구 호출, 에러, 중간 응답 등이 발생할 수 있습니다
 * - 이 모듈은 그 모든 과정을 시간순으로 기록하는 "활동 로그" 역할을 합니다
 */
import { randomUUID } from "node:crypto";

/**
 * 활동 피드에 나타날 수 있는 항목 유형
 *
 * - "user-message": 사용자가 입력한 메시지
 * - "assistant-text": AI의 최종 텍스트 응답
 * - "assistant-intermediate": AI의 중간 응답 (도구 호출 전 등)
 * - "tool-start": 도구 실행 시작
 * - "tool-complete": 도구 실행 완료
 * - "tool-denied": 도구 실행이 권한에 의해 거부됨
 * - "error": 에러 발생
 */
export type ActivityEntryType =
  | "user-message"
  | "assistant-text"
  | "assistant-intermediate"
  | "tool-start"
  | "tool-complete"
  | "tool-denied"
  | "error";

/**
 * 턴 내의 단일 활동 항목
 *
 * @property type - 활동의 종류 (위의 ActivityEntryType 참조)
 * @property timestamp - 활동이 발생한 시각
 * @property data - 활동에 대한 추가 정보 (도구 이름, 에러 메시지 등)
 */
export interface ActivityEntry {
  readonly type: ActivityEntryType;
  readonly timestamp: Date;
  readonly data: Readonly<Record<string, unknown>>;
}

/**
 * 하나의 완성된 활동 턴
 * 사용자 메시지 하나와 그에 대한 에이전트의 전체 응답 사이클을 포함합니다.
 *
 * @property id - 턴의 고유 식별자 (UUID)
 * @property entries - 이 턴에서 발생한 모든 활동 항목 목록
 * @property isComplete - 이 턴이 완료되었는지 여부
 */
export interface TurnActivity {
  readonly id: string;
  readonly entries: readonly ActivityEntry[];
  readonly isComplete: boolean;
}

/**
 * 에이전트 루프 실행 중 활동 항목을 수집하는 클래스
 *
 * 항목들을 턴(turn) 단위로 정리합니다.
 * 각 턴은 사용자 메시지 한 개에 대한 전체 응답 사이클입니다.
 * 한번 저장된 항목(entry)은 변경되지 않습니다 (불변 저장).
 */
export class ActivityCollector {
  // 현재 진행 중인 턴 (null이면 활성 턴이 없음)
  private _currentTurn: { readonly id: string; entries: ActivityEntry[] } | null = null;
  // 완료된 모든 턴의 목록
  private readonly _completedTurns: TurnActivity[] = [];

  /**
   * 새로운 턴을 시작합니다.
   * 진행 중인 턴이 있으면 먼저 완료 처리한 뒤 새 턴을 시작합니다.
   *
   * @returns 새 턴의 고유 ID
   */
  startTurn(): string {
    // 이전 턴이 아직 열려있으면 자동으로 완료 처리
    if (this._currentTurn) {
      this.completeTurn();
    }
    const id = randomUUID();
    this._currentTurn = { id, entries: [] };
    return id;
  }

  /**
   * 현재 턴에 활동 항목을 추가합니다.
   * 활성 턴이 없으면 자동으로 새 턴을 시작합니다.
   *
   * @param type - 활동 유형
   * @param data - 활동에 대한 추가 데이터 (기본값: 빈 객체)
   */
  addEntry(type: ActivityEntryType, data: Readonly<Record<string, unknown>> = {}): void {
    // 턴이 시작되지 않았으면 자동으로 시작
    if (!this._currentTurn) {
      this.startTurn();
    }
    this._currentTurn!.entries.push({
      type,
      timestamp: new Date(),
      data,
    });
  }

  /**
   * 현재 턴을 완료 상태로 표시합니다.
   * 완료된 턴은 completedTurns 목록에 저장되고,
   * 현재 턴은 null로 초기화됩니다.
   */
  completeTurn(): void {
    if (!this._currentTurn) {
      return;
    }
    this._completedTurns.push({
      id: this._currentTurn.id,
      entries: [...this._currentTurn.entries], // 배열 복사로 불변성 보장
      isComplete: true,
    });
    this._currentTurn = null;
  }

  /**
   * 현재 진행 중인 턴의 스냅샷을 반환합니다.
   * 활성 턴이 없으면 null을 반환합니다.
   *
   * @returns 현재 턴 정보 (불변 복사본) 또는 null
   */
  getCurrentTurn(): TurnActivity | null {
    if (!this._currentTurn) {
      return null;
    }
    return {
      id: this._currentTurn.id,
      entries: [...this._currentTurn.entries],
      isComplete: false,
    };
  }

  /**
   * 완료된 모든 턴의 목록을 반환합니다.
   *
   * @returns 완료된 턴 배열 (불변 복사본)
   */
  getCompletedTurns(): readonly TurnActivity[] {
    return [...this._completedTurns];
  }

  /**
   * 모든 턴(완료 + 진행 중)을 반환합니다.
   * UI에서 전체 활동 히스토리를 표시할 때 유용합니다.
   *
   * @returns 전체 턴 배열 (완료된 턴 + 현재 활성 턴)
   */
  getAllTurns(): readonly TurnActivity[] {
    const turns: TurnActivity[] = [...this._completedTurns];
    const current = this.getCurrentTurn();
    if (current) {
      turns.push(current);
    }
    return turns;
  }
}
