/**
 * 할일 목록(Todo) 관리 도구 — 현재 작업을 단계별로 분해하고 진행 상태를 추적하는 도구
 *
 * LLM이 복잡한 작업을 수행할 때, 전체 작업을 작은 단계로 분해하고
 * 각 단계의 진행 상태(대기/진행중/완료)를 관리합니다.
 *
 * 규칙:
 * - 전체 목록을 매번 완전히 전달해야 합니다 (부분 업데이트 불가)
 * - 항상 정확히 1개의 항목만 "in_progress" 상태여야 합니다
 * - 상태는 메모리에만 저장됩니다 (세션이 끝나면 초기화)
 *
 * 권한 수준: "safe" — 메모리에만 상태를 저장하므로 안전합니다.
 */
import { z } from "zod";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";

/**
 * 개별 할일 항목의 스키마 — 내용(content)과 상태(status)를 정의
 */
const todoItemSchema = z.object({
  /** 할일 항목의 설명 텍스트 */
  content: z.string().describe("Description of the todo item"),
  /**
   * 할일 항목의 현재 상태:
   * - "pending": 아직 시작하지 않음
   * - "in_progress": 현재 진행 중 (항상 1개만 허용)
   * - "completed": 완료됨
   */
  status: z
    .enum(["pending", "in_progress", "completed"])
    .describe("Current status of the todo item"),
});

/**
 * 매개변수 스키마 — 전체 할일 목록을 배열로 전달
 */
const paramSchema = z.object({
  /** 전체 할일 목록 — 매번 완전한 목록을 전달해야 합니다 (최소 1개) */
  todos: z
    .array(todoItemSchema)
    .min(1)
    .describe("Complete list of todo items. Exactly one item must have status 'in_progress'."),
});

type TodoItem = z.infer<typeof todoItemSchema>;
type Params = z.infer<typeof paramSchema>;

/**
 * 세션 범위의 인메모리 할일 상태
 *
 * Object.freeze()로 불변(immutable) 배열로 유지합니다.
 * 프로세스가 종료되면 상태가 사라집니다.
 */
let currentTodos: readonly TodoItem[] = [];

/**
 * 현재 할일 상태를 외부에서 읽기 — 테스트 또는 UI에서 사용
 *
 * @returns 현재 할일 항목 배열 (읽기 전용)
 */
export function getTodos(): readonly TodoItem[] {
  return currentTodos;
}

/**
 * 할일 상태 초기화 — 테스트에서 클린 상태로 리셋할 때 사용
 */
export function resetTodos(): void {
  currentTodos = [];
}

/**
 * 상태별 표시 아이콘 — 터미널에서 시각적으로 상태를 구분
 * - completed(완료): ✓ (체크 마크)
 * - in_progress(진행중): → (화살표)
 * - pending(대기): (빈 공간)
 */
const STATUS_INDICATORS: Readonly<Record<TodoItem["status"], string>> = {
  completed: "\u2713", // ✓
  in_progress: "\u2192", // →
  pending: " ",
};

/**
 * 할일 목록을 사람이 읽기 쉬운 텍스트로 변환
 *
 * 출력 예시:
 * Todo List Updated:
 * 1. [✓] 파일 구조 분석
 * 2. [→] 타입 정의 작성
 * 3. [ ] 테스트 작성
 *
 * @param todos - 할일 항목 배열
 * @returns 포맷팅된 텍스트
 */
function formatTodoList(todos: readonly TodoItem[]): string {
  const lines = todos.map(
    (item, i) => `${i + 1}. [${STATUS_INDICATORS[item.status]}] ${item.content}`,
  );
  return `Todo List Updated:\n${lines.join("\n")}`;
}

/**
 * 할일 목록 업데이트 실행 함수
 *
 * 유효성 검증: 정확히 1개의 항목만 "in_progress" 상태여야 합니다.
 * 이 규칙은 LLM이 한 번에 하나의 작업에만 집중하도록 강제합니다.
 *
 * @param params - 검증된 매개변수 (전체 할일 목록)
 * @param _context - 실행 컨텍스트 (이 도구에서는 사용하지 않음)
 * @returns 업데이트된 할일 목록 텍스트
 */
async function execute(params: Params, _context: ToolContext): Promise<ToolResult> {
  const { todos } = params;

  // 유효성 검증: in_progress 상태가 정확히 1개인지 확인
  const inProgressCount = todos.filter((t) => t.status === "in_progress").length;
  if (inProgressCount !== 1) {
    return {
      output: `Validation error: exactly one todo must have status 'in_progress', but found ${inProgressCount}.`,
      isError: true,
    };
  }

  // Object.freeze()로 불변 배열로 저장 — 외부에서 실수로 수정하는 것을 방지
  currentTodos = Object.freeze(todos.map((t) => ({ ...t })));

  return {
    output: formatTodoList(currentTodos),
    isError: false,
    metadata: {
      total: currentTodos.length,
      completed: currentTodos.filter((t) => t.status === "completed").length,
      inProgress: 1,
      pending: currentTodos.filter((t) => t.status === "pending").length,
    },
  };
}

/**
 * todo_write 도구 정의 — 내보내기하여 도구 레지스트리에 등록
 */
export const todoWriteTool: ToolDefinition<Params> = {
  name: "todo_write",
  description:
    "Track and update a todo list for the current task. Use this to break down complex tasks into steps and track progress. The full list must be provided each time. Exactly one item must be 'in_progress' at any time.",
  parameterSchema: paramSchema,
  permissionLevel: "safe",
  /** 5초 타임아웃 — 단순한 인메모리 연산이므로 짧은 타임아웃 */
  timeoutMs: 5_000,
  execute,
};
