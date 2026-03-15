/**
 * 네트워크 정책 스키마 — Zod를 사용한 네트워크 정책 유효성 검사 스키마
 *
 * 네트워크 정책 설정(NetworkPolicy)의 구조와 기본값을 Zod 스키마로 정의합니다.
 * 설정 파일이나 환경 변수에서 읽은 원시 값을 안전하게 파싱할 때 사용합니다.
 *
 * @example
 * import { networkPolicySchema } from "./network-policy-schema.js";
 * const policy = networkPolicySchema.parse({ defaultAction: "deny", allowlist: ["api.openai.com"] });
 */

import { z } from "zod";

/**
 * Zod 스키마: 네트워크 정책 유효성 검사.
 *
 * - defaultAction: 기본 동작 ("allow" 또는 "deny", 기본값: "allow")
 * - allowlist: 명시적으로 허용할 도메인/IP 목록 (기본값: 빈 배열)
 * - denylist: 명시적으로 차단할 도메인/IP 목록 (기본값: 빈 배열)
 */
export const networkPolicySchema = z.object({
  defaultAction: z.enum(["allow", "deny"]).default("allow"),
  allowlist: z.array(z.string()).default([]),
  denylist: z.array(z.string()).default([]),
});

/** 스키마에서 추론(infer)된 타입 — NetworkPolicy 인터페이스와 동일한 구조 */
export type NetworkPolicyConfig = z.infer<typeof networkPolicySchema>;
