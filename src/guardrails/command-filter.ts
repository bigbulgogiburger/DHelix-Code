/**
 * 명령어 필터 — 위험한 쉘 명령어를 탐지하고 차단하는 보안 모듈
 *
 * AI가 쉘 명령어를 실행할 때, 시스템을 파괴하거나 보안을 위협하는
 * 위험한 명령어가 실행되지 않도록 사전에 검사합니다.
 *
 * 위험도에 따라 두 단계로 분류합니다:
 * - BLOCK(차단): 실행하면 시스템이 파괴되거나 심각한 보안 위협이 되는 명령어
 *   예) rm -rf /, 포크 폭탄, 리버스 쉘 등
 * - WARN(경고): 주의가 필요하지만 합법적인 용도가 있을 수 있는 명령어
 *   예) DROP TABLE, chmod 777, git force push 등
 */

import type { GuardrailResult } from "./types.js";

/**
 * 명령어 패턴 인터페이스
 *
 * @property regex - 위험한 명령어를 탐지하는 정규식 패턴
 * @property description - 이 패턴이 탐지하는 위험의 설명 (영문, 로그에 사용)
 */
interface CommandPattern {
  readonly regex: RegExp;
  readonly description: string;
}

/**
 * 차단(BLOCK) 패턴 목록 — 매칭되면 즉시 실행을 차단합니다.
 * 이 명령어들은 시스템을 복구 불가능하게 손상시킬 수 있습니다.
 */
const BLOCK_PATTERNS: readonly CommandPattern[] = [
  // rm -rf / : 루트 파일시스템 전체를 재귀적으로 삭제 (시스템 파괴)
  // \/(?!\w) : 슬래시 뒤에 영문자가 아닌 경우만 매칭 (rm -rf /tmp 같은 정상 명령은 허용)
  { regex: /rm\s+-rf\s+\/(?!\w)/, description: "Recursive delete of root filesystem" },

  // > /dev/sd* : 디스크 장치에 직접 쓰기 (디스크 데이터 파괴)
  { regex: />\s*\/dev\/sd/, description: "Direct write to block device" },

  // mkfs : 파일시스템 포맷 명령어 (디스크 데이터 전체 삭제)
  { regex: /mkfs/, description: "Filesystem format command" },

  // dd if= : 저수준 디스크 복사/쓰기 도구 (잘못 사용하면 디스크 파괴)
  { regex: /dd\s+if=/, description: "Low-level disk write (dd)" },

  // :(){ :|:& };: : 포크 폭탄(Fork Bomb) — 프로세스를 무한히 복제하여 시스템을 마비시키는 공격
  // 함수 ':' 를 재귀적으로 호출하면서 백그라운드로 파이프하여 기하급수적으로 프로세스 증가
  { regex: /:\(\)\{\s*:\|:&\s*\};:/, description: "Fork bomb" },

  // curl ... | sh : URL에서 다운로드한 스크립트를 바로 쉘에서 실행
  // 악의적인 원격 코드 실행(Remote Code Execution) 위험이 매우 높음
  // [^\n|]* : 파이프(|) 전까지의 curl 옵션들을 매칭
  // (?:sudo\s+)? : sudo 사용 여부를 선택적으로 매칭
  // (?:ba)?sh : sh 또는 bash를 매칭
  {
    regex: /curl\s+[^\n|]*\|\s*(?:sudo\s+)?(?:ba)?sh/,
    description: "Curl piped to shell execution",
  },

  // wget ... | sh : wget으로 다운로드한 스크립트를 바로 쉘에서 실행 (curl|sh와 동일한 위험)
  {
    regex: /wget\s+[^\n|]*\|\s*(?:sudo\s+)?(?:ba)?sh/,
    description: "Wget piped to shell execution",
  },

  // nc -e /bin/sh : Netcat을 이용한 리버스 쉘(Reverse Shell)
  // 리버스 쉘이란 공격자의 서버로 쉘 연결을 열어주는 해킹 기법
  // \b : 단어 경계를 매칭하여 "nc"가 다른 단어의 일부가 아닌 경우만 탐지
  { regex: /\bnc\b.*\s-e\s+\/bin\/(?:ba)?sh/, description: "Netcat reverse shell" },
  { regex: /\bnetcat\b.*\s-e\s+\/bin\/(?:ba)?sh/, description: "Netcat reverse shell" },
  { regex: /\bncat\b.*\s-e\s+\/bin\/(?:ba)?sh/, description: "Ncat reverse shell" },
];

/**
 * 경고(WARN) 패턴 목록 — 매칭되면 경고를 표시하지만 실행은 허용합니다.
 * 이 명령어들은 합법적인 용도가 있지만 주의가 필요합니다.
 */
const WARN_PATTERNS: readonly CommandPattern[] = [
  // DROP TABLE : SQL에서 테이블 전체를 삭제하는 명령 (데이터 손실 위험)
  // /i : 대소문자 구분 없이 매칭
  { regex: /DROP\s+TABLE/i, description: "SQL DROP TABLE" },

  // DELETE FROM : SQL에서 레코드를 삭제하는 명령 (WHERE 절 없이 사용 시 전체 삭제)
  { regex: /DELETE\s+FROM/i, description: "SQL DELETE FROM" },

  // chmod 777 : 모든 사용자에게 읽기/쓰기/실행 권한 부여 (보안 취약점)
  // 777은 Owner/Group/Others 모두에게 rwx(읽기/쓰기/실행) 권한을 부여
  { regex: /chmod\s+777/, description: "Overly permissive chmod" },

  // sudo rm : 관리자 권한으로 파일 삭제 (실수로 중요 파일 삭제 위험)
  { regex: /sudo\s+rm/, description: "Sudo remove" },

  // git push --force : 원격 저장소의 히스토리를 강제로 덮어쓰기 (팀원의 커밋 손실 위험)
  // (?!-) : --force-with-lease 같은 안전한 변형은 허용
  { regex: /git\s+push\s+.*--force(?!-)/, description: "Git force push" },

  // git push -f : --force의 단축 옵션
  // (?:\s|$) : -f 뒤에 공백이나 문자열 끝이 와야 함 (-fast 같은 것은 미해당)
  { regex: /git\s+push\s+.*-f(?:\s|$)/, description: "Git force push (-f)" },

  // git reset --hard : 모든 로컬 변경사항을 되돌릴 수 없게 삭제
  { regex: /git\s+reset\s+--hard/, description: "Git hard reset" },

  // npm publish : npm 레지스트리에 패키지 게시 (의도치 않은 공개 배포 위험)
  { regex: /\bnpm\s+publish\b/, description: "npm publish to registry" },

  // docker run --privileged : 호스트 시스템의 모든 장치에 접근 가능한 특권 컨테이너 실행
  // 컨테이너 격리(isolation)가 무력화되어 호스트 시스템에 직접 영향을 줄 수 있음
  { regex: /docker\s+run\s+.*--privileged/, description: "Docker privileged container" },

  // eval "$var" : 변수 내용을 코드로 실행 (코드 인젝션 위험)
  // 공격자가 변수에 악성 코드를 주입하면 임의 코드가 실행될 수 있음
  { regex: /\beval\s+["`$]/, description: "Eval with variable expansion" },

  // exec "$var" : eval과 유사하게 변수 내용을 프로세스로 실행
  { regex: /\bexec\s+["`$]/, description: "Exec with variable expansion" },
];

/**
 * 쉘 명령어의 안전성을 검사합니다.
 *
 * 입력된 명령어를 차단 패턴과 경고 패턴에 대해 순서대로 검사합니다.
 * 차단 패턴에 매칭되면 즉시 실행을 거부하고, 경고 패턴에 매칭되면
 * 경고와 함께 실행을 허용합니다. 어떤 패턴에도 매칭되지 않으면
 * 안전한 명령어로 판단합니다.
 *
 * @param command - 검사할 쉘 명령어 문자열
 * @returns 검사 결과 (통과 여부, 이유, 심각도)
 *
 * @example
 * ```ts
 * const result = checkCommand("rm -rf /");
 * // result.passed === false, result.severity === "block"
 *
 * const result2 = checkCommand("npm install express");
 * // result2.passed === true, result2.severity === "info"
 * ```
 */
export function checkCommand(command: string): GuardrailResult {
  // 1단계: 차단 패턴 검사 — 매칭되면 즉시 실행 거부
  for (const { regex, description } of BLOCK_PATTERNS) {
    if (regex.test(command)) {
      return {
        passed: false,
        reason: `Blocked dangerous command: ${description}`,
        severity: "block",
      };
    }
  }

  // 2단계: 경고 패턴 검사 — 매칭되면 경고와 함께 실행 허용
  for (const { regex, description } of WARN_PATTERNS) {
    if (regex.test(command)) {
      return {
        passed: true,
        reason: `Warning: ${description}`,
        severity: "warn",
      };
    }
  }

  // 3단계: 어떤 위험 패턴에도 매칭되지 않으면 안전한 명령어로 판단
  return {
    passed: true,
    severity: "info",
  };
}
