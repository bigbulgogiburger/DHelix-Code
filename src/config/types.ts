/**
 * 설정 타입 정의 모듈 — Zod 스키마에서 추론된 설정 타입과 메타데이터 인터페이스
 *
 * 이 파일은 애플리케이션 전체에서 사용되는 설정 관련 타입을 정의합니다.
 * Zod 스키마(schema.ts)에서 타입을 자동 추론하여, 스키마와 타입이 항상 동기화됩니다.
 *
 * 설정 우선순위 (높은 것이 낮은 것을 덮어씀):
 * 5. CLI 플래그 (--model gpt-4o)
 * 4. 환경변수 (DHELIX_MODEL=gpt-4o)
 * 3. 프로젝트 설정 (.dhelix/config.json)
 * 2. 사용자 설정 (~/.dhelix/config.json)
 * 1. 기본값 (src/config/defaults.ts)
 */

import { type z } from "zod";
import { type configSchema } from "./schema.js";

/**
 * 전체 애플리케이션 설정 타입 — Zod 스키마에서 자동 추론
 *
 * z.infer를 사용하면 Zod 스키마 정의로부터 TypeScript 타입을 자동 생성합니다.
 * 이렇게 하면 스키마를 변경할 때 타입도 자동으로 업데이트됩니다.
 */
export type AppConfig = z.infer<typeof configSchema>;

/**
 * 설정 소스 레벨 — 각 설정 값이 어디서 왔는지 추적하기 위한 타입
 *
 * 우선순위 순서 (높은 것이 앞):
 * - "cli-flags": 명령줄 플래그 (--model, --verbose 등)
 * - "environment": 환경변수 (DHELIX_MODEL, OPENAI_API_KEY 등)
 * - "project": 프로젝트 설정 파일 (.dhelix/config.json)
 * - "user": 사용자 전역 설정 파일 (~/.dhelix/config.json)
 * - "defaults": 하드코딩된 기본값 (defaults.ts)
 */
export type ConfigSource = "cli-flags" | "environment" | "project" | "user" | "defaults";

/**
 * 소스 메타데이터가 포함된 최종 설정 객체
 *
 * 각 설정 키가 어디서 왔는지(sources) 추적하여,
 * 디버깅 시 "이 값은 어디서 설정됐지?"를 빠르게 파악할 수 있습니다.
 */
export interface ResolvedConfig {
  /** 최종 병합된 설정 객체 (readonly로 불변성 보장) */
  readonly config: AppConfig;
  /** 각 설정 키가 어느 소스에서 왔는지 매핑 (예: "llm" → "environment") */
  readonly sources: ReadonlyMap<string, ConfigSource>;
}
