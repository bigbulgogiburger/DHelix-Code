/**
 * 네트워크 정책 적용 샌드박스 — 샌드박스 실행에 네트워크 정책을 통합
 *
 * 기존 샌드박스(Seatbelt/bubblewrap) 실행에 네트워크 정책 프록시를 추가하여,
 * 프로세스가 허용된 도메인에만 접속할 수 있도록 제한합니다.
 *
 * 동작 과정:
 * 1. 네트워크 정책이 설정되면 로컬 프록시 서버를 시작합니다
 * 2. HTTP_PROXY/HTTPS_PROXY 환경 변수를 설정하여 프록시를 경유하도록 합니다
 * 3. 샌드박스 안에서 명령을 실행합니다
 * 4. 실행 완료 후 프록시를 종료합니다 (에러가 발생해도 반드시 정리)
 *
 * 정책이 없거나 "모두 허용"인 경우 프록시 오버헤드 없이 직접 샌드박스 실행합니다.
 *
 * @example
 * const result = await executeSandboxedWithNetwork({
 *   command: "curl",
 *   args: ["https://api.openai.com/v1/models"],
 *   projectDir: "/project",
 *   networkPolicy: { defaultAction: "deny", allowlist: ["*.openai.com"], denylist: [] },
 * });
 */

import { type NetworkPolicy, DEFAULT_NETWORK_POLICY } from "./network-policy.js";
import { startNetworkProxy } from "./network-proxy.js";
import { executeSandboxed, type SandboxConfig, SandboxError } from "./seatbelt.js";

/** 네트워크 정책이 추가된 확장 샌드박스 설정 */
export interface NetworkSandboxConfig extends SandboxConfig {
  /** 적용할 네트워크 정책. 생략하면 DEFAULT_NETWORK_POLICY 사용 */
  readonly networkPolicy?: NetworkPolicy;
}

/**
 * 네트워크 정책을 적용하여 샌드박스 안에서 명령을 실행합니다.
 *
 * 실행 과정:
 * 1. 로컬 프록시 시작 (네트워크 정책 적용)
 * 2. HTTP_PROXY/HTTPS_PROXY 환경 변수를 프록시 URL로 설정
 * 3. 샌드박스에서 명령 실행
 * 4. 프록시 정리 (에러 발생 시에도 finally에서 반드시 실행)
 *
 * 프록시가 불필요한 경우 (정책 없음 또는 기본 "모두 허용"):
 * 프록시 오버헤드 없이 표준 샌드박스 실행으로 위임합니다.
 *
 * @param config - 네트워크 정책이 포함된 샌드박스 설정
 * @returns stdout과 stderr를 포함한 실행 결과
 * @throws SandboxError - 실행 실패 시 (차단된 호스트 정보 포함 가능)
 */
export async function executeSandboxedWithNetwork(
  config: NetworkSandboxConfig,
): Promise<{ stdout: string; stderr: string }> {
  const { networkPolicy, ...sandboxConfig } = config;

  // 네트워크 정책이 없으면 표준 샌드박스 실행으로 위임
  if (!networkPolicy) {
    return executeSandboxed(sandboxConfig);
  }

  // "모두 허용" 기본 정책이면 프록시 없이 직접 실행 (불필요한 오버헤드 방지)
  if (
    networkPolicy.defaultAction === "allow" &&
    networkPolicy.denylist.length === 0 &&
    networkPolicy.allowlist.length === 0
  ) {
    return executeSandboxed(sandboxConfig);
  }

  // 차단된 호스트를 추적하기 위한 배열
  const blockedHosts: string[] = [];

  // 포트 0: OS가 사용 가능한 포트를 자동 할당
  const proxy = await startNetworkProxy({
    port: 0,
    policy: networkPolicy ?? DEFAULT_NETWORK_POLICY,
    onBlocked: (host) => {
      blockedHosts.push(host);
    },
  });

  try {
    // 프록시 URL 구성 (예: "http://127.0.0.1:54321")
    const proxyUrl = `http://127.0.0.1:${proxy.port}`;

    // 프록시 환경 변수 병합 (대/소문자 모두 설정하여 호환성 확보)
    const proxyEnv: Record<string, string> = {
      ...sandboxConfig.env,
      HTTP_PROXY: proxyUrl, // 대문자 (표준)
      HTTPS_PROXY: proxyUrl, // 대문자 (표준)
      http_proxy: proxyUrl, // 소문자 (일부 도구 호환)
      https_proxy: proxyUrl, // 소문자 (일부 도구 호환)
    };

    // 프록시 환경 변수가 적용된 상태로 샌드박스 실행
    const result = await executeSandboxed({
      ...sandboxConfig,
      env: proxyEnv,
    });

    return result;
  } catch (error) {
    // 차단된 호스트가 있으면 에러 컨텍스트에 추가 정보를 포함
    if (blockedHosts.length > 0 && error instanceof SandboxError) {
      throw new SandboxError("Sandboxed command failed with blocked network access", {
        ...error.context,
        blockedHosts, // 어떤 호스트가 차단되었는지 디버깅 정보 제공
      });
    }
    throw error;
  } finally {
    // 프록시 서버를 반드시 정리 (에러가 발생해도 실행)
    await proxy.stop();
  }
}
