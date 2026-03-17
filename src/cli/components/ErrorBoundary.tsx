/**
 * ErrorBoundary.tsx — React 에러 경계(Error Boundary) 컴포넌트
 *
 * React의 Error Boundary 패턴을 사용하여 하위 컴포넌트에서 발생하는
 * 렌더링 에러를 포착합니다. 에러가 발생하면 전체 프로세스가 조용히
 * 크래시하는 대신, 친화적인 에러 메시지를 표시합니다.
 *
 * 참고: Error Boundary는 React의 클래스 컴포넌트에서만 사용 가능합니다.
 * (함수형 컴포넌트에서는 getDerivedStateFromError를 쓸 수 없음)
 */
import React from "react";
import { Box, Text } from "ink";

/** @param children - 에러 경계 내에서 렌더링할 자식 컴포넌트 */
interface ErrorBoundaryProps {
  readonly children: React.ReactNode;
}

/**
 * 에러 경계의 상태
 * @param hasError - 에러 발생 여부
 * @param errorMessage - 발생한 에러의 메시지 문자열
 */
interface ErrorBoundaryState {
  readonly hasError: boolean;
  readonly errorMessage: string | null;
}

/**
 * CLI 애플리케이션용 React Error Boundary
 *
 * 렌더링 중 처리되지 않은 에러를 포착하여 크래시 대신
 * 빨간색 테두리의 에러 메시지를 표시합니다.
 * 에러 정보는 stderr로도 출력되어 디버깅에 활용할 수 있습니다.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || "Unknown error",
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    process.stderr.write(`[ErrorBoundary] Uncaught render error: ${error.message}\n`);
    if (errorInfo.componentStack) {
      process.stderr.write(`[ErrorBoundary] Component stack:${errorInfo.componentStack}\n`);
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={1}>
          <Text color="red" bold>
            A fatal rendering error occurred:
          </Text>
          <Text color="red">{this.state.errorMessage}</Text>
          <Text dimColor>Press Ctrl+C to exit</Text>
        </Box>
      );
    }

    return this.props.children;
  }
}
