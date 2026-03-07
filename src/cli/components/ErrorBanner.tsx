import { Box, Text } from "ink";

interface ErrorBannerProps {
  readonly message: string;
  readonly details?: string;
}

interface ErrorClassification {
  readonly type: "rate_limit" | "network" | "token_limit" | "auth" | "model_not_found" | "unknown";
  readonly guide: string;
  readonly icon: string;
}

function classifyError(message: string): ErrorClassification {
  const lower = message.toLowerCase();

  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("rate_limit")) {
    return {
      type: "rate_limit",
      icon: "\u23F3",
      guide: "\uC18D\uB3C4 \uC81C\uD55C. \uC7A0\uC2DC \uD6C4 \uC790\uB3D9 \uC7AC\uC2DC\uB3C4\uB429\uB2C8\uB2E4.",
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
      guide: "\uB124\uD2B8\uC6CC\uD06C\uB97C \uD655\uC778\uD558\uC138\uC694. \uC11C\uBC84\uAC00 \uC2E4\uD589 \uC911\uC778\uC9C0 \uD655\uC778: dbcode --base-url <url>",
    };
  }

  if (lower.includes("too many tokens") || lower.includes("request too large") || lower.includes("context_length")) {
    return {
      type: "token_limit",
      icon: "\uD83D\uDCCF",
      guide: "\uB300\uD654\uAC00 \uB108\uBB34 \uAE41\uB2C8\uB2E4. /compact\uB85C \uC555\uCD95\uD558\uC138\uC694.",
    };
  }

  if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("api key") || lower.includes("api_key")) {
    return {
      type: "auth",
      icon: "\uD83D\uDD11",
      guide: "API \uD0A4\uAC00 \uC720\uD6A8\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. --api-key \uB610\uB294 \uD658\uACBD\uBCC0\uC218\uB97C \uD655\uC778\uD558\uC138\uC694.",
    };
  }

  if (lower.includes("404") && lower.includes("model")) {
    return {
      type: "model_not_found",
      icon: "\uD83E\uDD16",
      guide: "\uBAA8\uB378\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. /model\uB85C \uBCC0\uACBD\uD558\uC138\uC694.",
    };
  }

  return {
    type: "unknown",
    icon: "\u274C",
    guide: "",
  };
}

/** Non-blocking error banner displayed in the terminal */
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
      {classification.guide ? (
        <Text dimColor>
          {classification.guide}
        </Text>
      ) : null}
    </Box>
  );
}
