/**
 * 2단계 도구 호출 — 저능력 모델의 자연어 의도를 구조화된 도구 호출로 변환하는 모듈
 *
 * 일부 LLM 모델(특히 소형 로컬 모델)은 네이티브 function calling이나
 * XML 형식의 도구 호출도 제대로 수행하지 못하고,
 * 자연어로 의도를 표현하는 경우가 있습니다.
 *
 * 예시:
 * - 모델 출력: "read file src/main.ts"
 * - 변환 결과: { toolName: "file_read", extractedArgs: { file_path: "src/main.ts" } }
 *
 * 이 모듈은 정규식 패턴 매칭을 사용하여
 * 자연어 텍스트에서 도구 호출 의도를 추출합니다.
 *
 * 지원하는 패턴:
 * - "read [file] <path>" → file_read
 * - "search [for] <pattern>" → grep_search
 * - "write [to] <path>" → file_write
 * - "run <command>" → bash_exec
 * - "list [files [in]] <path>" → list_dir
 * - "edit <path>" → file_edit
 * - "find [files] <pattern>" → glob_search
 */
import type { ToolDefinition } from "../../tools/types.js";

/**
 * 자연어에서 추출된 도구 호출 의도
 *
 * 정규식 매칭 결과를 구조화된 형태로 표현합니다.
 */
export interface NaturalLanguageIntent {
  /** 매칭된 도구 이름 (예: "file_read", "bash_exec") */
  readonly toolName: string;
  /** 추출된 인자 — 정규식 캡처 그룹에서 추출 (예: { file_path: "src/main.ts" }) */
  readonly extractedArgs: Record<string, unknown>;
  /** 필수 매개변수 이름 목록 */
  readonly requiredParams: readonly string[];
  /** 매칭 신뢰도 (0~1) — 현재 고정값 0.9 사용 */
  readonly confidence: number;
}

/**
 * 의도 패턴 — 정규식과 도구 이름, 인자 추출 함수의 매핑
 */
interface IntentPattern {
  /** 자연어 텍스트를 매칭하는 정규식 */
  readonly regex: RegExp;
  /** 매칭 시 사용할 도구 이름 */
  readonly tool: string;
  /** 정규식 매칭 결과에서 인자를 추출하는 함수 */
  readonly argMap: (m: RegExpMatchArray) => Record<string, unknown>;
}

/**
 * 자연어 의도 패턴 목록
 *
 * 각 패턴은 특정 동사로 시작하는 자연어 명령을 매칭합니다.
 * 정규식의 캡처 그룹으로 인자 값을 추출합니다.
 */
const INTENT_PATTERNS: readonly IntentPattern[] = [
  // "read file src/main.ts" 또는 "read src/main.ts"
  {
    regex: /read\s+(?:file\s+)?(.+)/i,
    tool: "file_read",
    argMap: (m: RegExpMatchArray) => ({ file_path: m[1]?.trim() }),
  },
  // "search for pattern" 또는 "search pattern"
  {
    regex: /search\s+(?:for\s+)?(.+)/i,
    tool: "grep_search",
    argMap: (m: RegExpMatchArray) => ({ pattern: m[1]?.trim() }),
  },
  // "write to path" 또는 "write path"
  {
    regex: /write\s+(?:to\s+)?(.+)/i,
    tool: "file_write",
    argMap: (m: RegExpMatchArray) => ({ file_path: m[1]?.trim() }),
  },
  // "run npm test" — 명령어 전체를 캡처
  {
    regex: /run\s+(.+)/i,
    tool: "bash_exec",
    argMap: (m: RegExpMatchArray) => ({ command: m[1]?.trim() }),
  },
  // "list files in src/" 또는 "list src/"
  {
    regex: /list\s+(?:files?\s+(?:in\s+)?)?(.+)/i,
    tool: "list_dir",
    argMap: (m: RegExpMatchArray) => ({ path: m[1]?.trim() }),
  },
  // "edit src/main.ts"
  {
    regex: /edit\s+(.+)/i,
    tool: "file_edit",
    argMap: (m: RegExpMatchArray) => ({ file_path: m[1]?.trim() }),
  },
  // "find files *.ts" 또는 "find *.ts"
  {
    regex: /find\s+(?:files?\s+)?(.+)/i,
    tool: "glob_search",
    argMap: (m: RegExpMatchArray) => ({ pattern: m[1]?.trim() }),
  },
];

/**
 * 자연어 텍스트를 분석하여 구조화된 도구 호출 의도를 추출
 *
 * 패턴 목록을 순서대로 매칭하며, 첫 번째로 일치하는 패턴을 사용합니다.
 * 매칭된 도구가 실제 사용 가능한 도구 목록(availableTools)에 존재하는지도 확인합니다.
 *
 * 사용 시나리오:
 * - 소형 로컬 모델이 "I'll read the file main.ts"라고 응답한 경우
 * - 이 함수가 { toolName: "file_read", extractedArgs: { file_path: "main.ts" } }를 반환
 * - 에이전트 루프에서 이를 실제 도구 호출로 변환하여 실행
 *
 * @param text - LLM의 자연어 응답 텍스트
 * @param availableTools - 현재 사용 가능한 도구 정의 목록
 * @returns 추출된 의도 또는 null (매칭 실패 시)
 */
export function parseNaturalLanguageIntent(
  text: string,
  availableTools: readonly ToolDefinition[],
): NaturalLanguageIntent | null {
  const trimmed = text.trim();

  for (const p of INTENT_PATTERNS) {
    const match = trimmed.match(p.regex);
    // 정규식이 매칭되고, 해당 도구가 사용 가능한 목록에 있는 경우에만 반환
    if (match && availableTools.some((t) => t.name === p.tool)) {
      const args = p.argMap(match);
      return {
        toolName: p.tool,
        extractedArgs: args,
        requiredParams: Object.keys(args),
        confidence: 0.9, // 정규식 매칭은 비교적 신뢰도가 높음
      };
    }
  }

  // 어떤 패턴에도 매칭되지 않음
  return null;
}
