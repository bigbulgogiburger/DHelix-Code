/**
 * ErrorBanner.tsx — 에러 메시지를 분류하여 시각적으로 표시하는 배너 컴포넌트
 *
 * 에러 메시지를 분석하여 유형(rate_limit, network, auth 등)을 자동으로
 * 분류하고, 각 유형에 맞는 아이콘과 한국어 가이드를 함께 표시합니다.
 * 빨간색 둥근 테두리 안에 에러 정보를 보여줍니다.
 */
import { Box, Text } from "ink";

/**
 * @param message - 에러 메시지 (필수)
 * @param details - 추가 상세 정보 (선택적, 회색으로 표시)
 */
interface ErrorBannerProps {
  readonly message: string;
  readonly details?: string;
}

/**
 * 에러 분류 결과
 * @param type - 에러 유형 (rate_limit, network, token_limit, auth, model_not_found, unknown)
 * @param guide - 사용자를 위한 한국어 해결 가이드
 * @param icon - 에러 유형에 맞는 이모지 아이콘
 */
interface ErrorClassification {
  readonly type: "rate_limit" | "network" | "token_limit" | "auth" | "model_not_found" | "unknown";
  readonly guide: string;
  readonly icon: string;
}

/**
 * 에러 메시지를 분석하여 유형을 자동 분류합니다.
 * 메시지에 포함된 키워드(429, timeout, 401 등)를 기반으로 판별하고,
 * 각 유형에 맞는 아이콘과 한국어 해결 가이드를 반환합니다.
 */
function classifyError(message: string): ErrorClassification {
  const lower = message.toLowerCase();

  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("rate_limit")) {
    return {
      type: "rate_limit",
      icon: "\u23F3",
      guide:
        "API \uC0AC\uC6A9\uB7C9\uC774 \uCD08\uACFC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.",
    };
  }

  if (
    lower.includes("econnrefused") ||
    lower.includes("timeout") ||
    lower.includes("network") ||
    lower.includes("enotfound") ||
    lower.includes("socket")
  ) {
    return {
      type: "network",
      icon: "\uD83D\uDD0C",
      guide:
        "\uB124\uD2B8\uC6CC\uD06C\uB97C \uD655\uC778\uD558\uC138\uC694. \uC11C\uBC84\uAC00 \uC2E4\uD589 \uC911\uC778\uC9C0 \uD655\uC778: dhelix --base-url <url>",
    };
  }

  if (
    lower.includes("too many tokens") ||
    lower.includes("request too large") ||
    lower.includes("context_length")
  ) {
    return {
      type: "token_limit",
      icon: "\uD83D\uDCCF",
      guide:
        "\uB300\uD654\uAC00 \uB108\uBB34 \uAE41\uB2C8\uB2E4. /compact\uB85C \uC555\uCD95\uD558\uC138\uC694.",
    };
  }

  if (
    lower.includes("401") ||
    lower.includes("unauthorized") ||
    lower.includes("api key") ||
    lower.includes("api_key")
  ) {
    return {
      type: "auth",
      icon: "\uD83D\uDD11",
      guide:
        "API \uD0A4\uAC00 \uC720\uD6A8\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. --api-key \uB610\uB294 \uD658\uACBD\uBCC0\uC218\uB97C \uD655\uC778\uD558\uC138\uC694.",
    };
  }

  if (lower.includes("404") && lower.includes("model")) {
    return {
      type: "model_not_found",
      icon: "\uD83E\uDD16",
      guide:
        "\uBAA8\uB378\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. /model\uB85C \uBCC0\uACBD\uD558\uC138\uC694.",
    };
  }

  return {
    type: "unknown",
    icon: "\u274C",
    guide: "",
  };
}

/** 터미널에 표시되는 비차단(Non-blocking) 에러 배너 — 에러가 발생해도 앱은 계속 실행됨 */
export function ErrorBanner({ message, details }: ErrorBannerProps) {
  const classification = classifyError(message + (details ?? ""));

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={1}>
      <Text color="red" bold>
        {classification.icon} Error: {message}
      </Text>
      {details ? (
        <Text color="gray" dimColor>
          {details}
        </Text>
      ) : null}
      {classification.guide ? <Text dimColor>{classification.guide}</Text> : null}
    </Box>
  );
}
