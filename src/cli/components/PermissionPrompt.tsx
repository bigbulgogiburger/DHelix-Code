/**
 * PermissionPrompt.tsx — 도구 실행 권한을 사용자에게 묻는 프롬프트 컴포넌트
 *
 * 에이전트가 위험할 수 있는 도구(bash_exec, file_write 등)를 실행하려 할 때
 * 사용자에게 허용 여부를 묻습니다. 좌우 화살표로 옵션을 선택하고
 * Enter로 확인합니다.
 *
 * 옵션:
 * - "Allow once" — 이번 한 번만 허용
 * - "Allow for session" — 현재 세션 동안 이 도구를 항상 허용
 * - "Deny" — 거부
 */
import { Box, Text, useInput } from "ink";
import { useState } from "react";

/**
 * @param toolName - 권한을 요청하는 도구 이름 (예: "bash_exec")
 * @param description - 도구 호출의 상세 설명 (인수 포함)
 * @param onResponse - 사용자의 선택을 전달하는 콜백 ("yes" | "no" | "always")
 */
interface PermissionPromptProps {
  readonly toolName: string;
  readonly description: string;
  readonly onResponse: (response: "yes" | "no" | "always") => void;
}

/** 사용자가 선택할 수 있는 권한 옵션 목록 */
const OPTIONS = [
  { label: "Allow once", response: "yes" },
  { label: "Allow for session", response: "always" },
  { label: "Deny", response: "no" },
] as const;

/**
 * 도구 실행 권한 확인 프롬프트 — 좌우 화살표로 옵션을 선택
 * 노란색 둥근 테두리 안에 도구 이름과 인수를 표시하고,
 * 하단에 3개의 선택지를 가로로 나열합니다.
 */
export function PermissionPrompt({ toolName, description, onResponse }: PermissionPromptProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [answered, setAnswered] = useState(false);

  useInput(
    (_input, key) => {
      if (answered) return;
      if (key.leftArrow) {
        setSelectedIndex((prev) => (prev - 1 + OPTIONS.length) % OPTIONS.length);
      } else if (key.rightArrow) {
        setSelectedIndex((prev) => (prev + 1) % OPTIONS.length);
      } else if (key.return) {
        setAnswered(true);
        onResponse(OPTIONS[selectedIndex].response);
      }
    },
    { isActive: !answered },
  );

  if (answered) {
    return null;
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="#00BCD4" paddingX={1}>
      <Text color="#00BCD4" bold>
        Permission required
      </Text>
      <Box marginTop={0}>
        <Text>
          Tool: <Text bold>{toolName}</Text>
        </Text>
      </Box>
      <Text color="gray">{description}</Text>
      <Box marginTop={1} gap={2}>
        {OPTIONS.map((option, index) => {
          const isSelected = index === selectedIndex;
          return (
            <Text
              key={option.label}
              color={isSelected ? "cyan" : "gray"}
              bold={isSelected}
              underline={isSelected}
              dimColor={!isSelected}
            >
              {isSelected ? "\u25B8 " : "  "}
              {option.label}
            </Text>
          );
        })}
      </Box>
    </Box>
  );
}
