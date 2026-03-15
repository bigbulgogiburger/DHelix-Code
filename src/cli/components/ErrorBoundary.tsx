import React from "react";
import { Box, Text } from "ink";

interface ErrorBoundaryProps {
  readonly children: React.ReactNode;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
  readonly errorMessage: string | null;
}

/**
 * React Error Boundary for the CLI application.
 * Catches unhandled render errors and displays a crash message
 * instead of letting the entire process crash silently.
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
    process.stderr.write(
      `[ErrorBoundary] Uncaught render error: ${error.message}\n`,
    );
    if (errorInfo.componentStack) {
      process.stderr.write(
        `[ErrorBoundary] Component stack:${errorInfo.componentStack}\n`,
      );
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
