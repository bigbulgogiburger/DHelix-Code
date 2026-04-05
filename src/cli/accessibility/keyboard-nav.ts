/**
 * keyboard-nav.ts — 키보드 포커스 관리 유틸리티
 *
 * 터미널 UI에서 Tab/Shift+Tab 키보드 탐색을 지원하기 위한
 * FocusManager 클래스를 제공합니다. 등록된 요소들을 tab 순서에 따라
 * 순환하며 포커스를 이동합니다.
 *
 * 사용 방법:
 * - new FocusManager(): 인스턴스 생성
 * - manager.register(element): 포커스 가능한 요소 등록
 * - manager.focusNext(): 다음 요소로 이동
 * - manager.focusPrevious(): 이전 요소로 이동
 */

/** 포커스 가능한 UI 요소의 타입 */
export type FocusableType = "input" | "button" | "list" | "panel";

/**
 * 포커스 가능한 UI 요소 — 불변 객체로 관리됩니다.
 */
export interface FocusableElement {
  /** 요소의 고유 식별자 */
  readonly id: string;
  /** 스크린 리더에 표시될 접근성 레이블 */
  readonly label: string;
  /** Tab 키 탐색 순서 (낮을수록 먼저 포커스됨) */
  readonly order: number;
  /** 요소 타입: 'input', 'button', 'list', 'panel' */
  readonly type: FocusableType;
}

/**
 * 키보드 포커스 상태를 관리하는 클래스.
 * 등록된 요소들을 `order` 오름차순으로 정렬하여 Tab/Shift+Tab 탐색을 지원합니다.
 *
 * @example
 * ```typescript
 * const manager = new FocusManager();
 * manager.register({ id: 'input-1', label: '검색', order: 0, type: 'input' });
 * manager.register({ id: 'btn-submit', label: '전송', order: 1, type: 'button' });
 * const next = manager.focusNext(); // { id: 'input-1', ... }
 * ```
 */
export class FocusManager {
  /** 등록된 요소들 (order 기준 정렬 유지) */
  private elements: FocusableElement[] = [];
  /** 현재 포커스된 요소의 인덱스 (없으면 -1) */
  private currentIndex: number = -1;

  /**
   * 포커스 가능한 요소를 등록합니다.
   * 동일한 id가 이미 등록되어 있으면 덮어씁니다.
   * 등록 후 `order` 오름차순으로 재정렬됩니다.
   * @param element - 등록할 FocusableElement
   */
  register(element: FocusableElement): void {
    const existing = this.elements.findIndex((el) => el.id === element.id);
    if (existing !== -1) {
      // 현재 포커스 인덱스 유지를 위해 교체
      this.elements[existing] = element;
    } else {
      this.elements.push(element);
    }
    this.elements.sort((a, b) => a.order - b.order);

    // 재정렬 후 현재 포커스 요소 인덱스 동기화
    if (this.currentIndex !== -1) {
      const currentId = this.elements[this.currentIndex]?.id;
      if (currentId !== undefined) {
        this.currentIndex = this.elements.findIndex(
          (el) => el.id === currentId
        );
      }
    }
  }

  /**
   * 등록된 요소를 제거합니다.
   * 현재 포커스된 요소가 제거되면 포커스가 해제됩니다.
   * @param id - 제거할 요소의 고유 식별자
   */
  unregister(id: string): void {
    const removingIndex = this.elements.findIndex((el) => el.id === id);
    if (removingIndex === -1) return;

    const wasCurrent = removingIndex === this.currentIndex;
    this.elements = this.elements.filter((el) => el.id !== id);

    if (wasCurrent) {
      this.currentIndex = -1;
    } else if (removingIndex < this.currentIndex) {
      this.currentIndex -= 1;
    }
  }

  /**
   * 다음 요소로 포커스를 이동합니다 (순환).
   * 등록된 요소가 없으면 `undefined`를 반환합니다.
   * @returns 새로 포커스된 요소, 또는 요소가 없으면 `undefined`
   */
  focusNext(): FocusableElement | undefined {
    if (this.elements.length === 0) return undefined;

    this.currentIndex = (this.currentIndex + 1) % this.elements.length;
    return this.elements[this.currentIndex];
  }

  /**
   * 이전 요소로 포커스를 이동합니다 (순환).
   * 등록된 요소가 없으면 `undefined`를 반환합니다.
   * @returns 새로 포커스된 요소, 또는 요소가 없으면 `undefined`
   */
  focusPrevious(): FocusableElement | undefined {
    if (this.elements.length === 0) return undefined;

    if (this.currentIndex <= 0) {
      this.currentIndex = this.elements.length - 1;
    } else {
      this.currentIndex -= 1;
    }
    return this.elements[this.currentIndex];
  }

  /**
   * 특정 id의 요소로 포커스를 이동합니다.
   * @param id - 포커스할 요소의 고유 식별자
   * @returns 성공 시 `true`, 해당 요소를 찾지 못한 경우 `false`
   */
  focusById(id: string): boolean {
    const index = this.elements.findIndex((el) => el.id === id);
    if (index === -1) return false;

    this.currentIndex = index;
    return true;
  }

  /**
   * 현재 포커스된 요소를 반환합니다.
   * @returns 현재 포커스된 요소, 또는 포커스 없으면 `undefined`
   */
  getCurrent(): FocusableElement | undefined {
    if (this.currentIndex === -1) return undefined;
    return this.elements[this.currentIndex];
  }

  /**
   * 등록된 모든 요소를 순서대로 반환합니다.
   * @returns `order` 오름차순으로 정렬된 불변 배열
   */
  getAll(): readonly FocusableElement[] {
    return this.elements;
  }

  /**
   * 포커스 상태와 등록된 모든 요소를 초기화합니다.
   */
  reset(): void {
    this.elements = [];
    this.currentIndex = -1;
  }
}
