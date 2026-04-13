/**
 * footer-bar.tsx — 하단 상태바 레이아웃 컴포넌트
 *
 * 현재 StatusBar.tsx의 레이아웃 패턴을 참고하여,
 * ShellLayout의 footer 슬롯에 들어갈 상태바를 제공합니다.
 * 모드 표시 (permission mode), git 브랜치, 모델명, 토큰 사용량 등
 * 다양한 상태 정보를 한 줄로 표시합니다.
 *
 * 기존 StatusBar.tsx와의 차이점:
 * - StatusBar는 비즈니스 로직(비용 계산 등)을 포함하지만
 *   FooterBar는 순수 레이아웃 + 표시 전용 컴포넌트입니다
 * - 외부에서 포맷된 문자열을 받아서 배치만 담당합니다
 *
 * 아키텍처 위치: CLI Layer (Layer 1)
 * 참조: src/cli/components/StatusBar.tsx, src/cli/renderer/theme.ts
 *
 * @module layout/footer-bar
 */
import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { getActiveTheme, type ThemeColors } from "../renderer/theme.js";

/**
 * FooterBar에 표시할 상태 항목
 *
 * @property label - 표시할 텍스트 (예: "Default", "main", "gpt-4o")
 * @property colorToken - 테마 색상 토큰 키 (ThemeColors의 키)
 * @property bold - 볼드체 여부 (기본값: false)
 */
export interface FooterBarItem {
  readonly label: string;
  readonly colorToken?: keyof ThemeColors;
  readonly bold?: boolean;
}

/**
 * FooterBar 컴포넌트의 Props
 *
 * @property left - 좌측에 표시할 항목 배열 (모델명, 버전 등)
 * @property center - 중앙에 표시할 항목 배열 (사용량 바, 모드 등)
 * @property right - 우측에 표시할 항목 배열 (상태 표시 등)
 * @property borderColor - 테두리 색상 (기본값: 테마의 border 색상)
 */
export interface FooterBarProps {
  readonly left?: readonly FooterBarItem[];
  readonly center?: readonly FooterBarItem[];
  readonly right?: readonly FooterBarItem[];
  readonly borderColor?: string;
}

/**
 * FooterBarItem을 Ink Text 컴포넌트로 렌더링하는 헬퍼
 *
 * @param item - 표시할 항목
 * @param colors - 현재 테마의 색상 팔레트
 * @param index - 리스트 내 인덱스 (React key용)
 * @returns Ink Text 엘리먼트
 */
function renderItem(item: FooterBarItem, colors: ThemeColors, index: number): React.ReactNode {
  const color = item.colorToken ? colors[item.colorToken] : colors.muted;
  return (
    <Text key={`footer-item-${index}`} color={color} bold={item.bold}>
      {item.label}
    </Text>
  );
}

/**
 * FooterBar — 하단 상태 표시줄 레이아웃 컴포넌트
 *
 * 3-section 레이아웃(좌/중/우)으로 상태 정보를 배치합니다.
 * 테마 색상을 자동으로 적용하며, 테두리(borderStyle: "single")로
 * 시각적 구분을 제공합니다.
 *
 * 사용 예시:
 * ```tsx
 * <FooterBar
 *   left={[{ label: "gpt-4o", colorToken: "primary" }]}
 *   center={[{ label: "[Default]", colorToken: "border" }]}
 *   right={[{ label: "ready", colorToken: "muted" }]}
 * />
 * ```
 *
 * @param props - FooterBarProps
 * @returns Ink Box 기반 상태 표시줄
 */
export const FooterBar = React.memo(function FooterBar({
  left = [],
  center = [],
  right = [],
  borderColor,
}: FooterBarProps) {
  const theme = useMemo(() => getActiveTheme(), []);
  const colors = theme.colors;
  const resolvedBorderColor = borderColor ?? colors.border;

  return (
    <Box
      borderStyle="single"
      borderColor={resolvedBorderColor}
      paddingX={1}
      justifyContent="space-between"
    >
      <Box gap={1}>{left.map((item, idx) => renderItem(item, colors, idx))}</Box>
      <Box gap={1}>{center.map((item, idx) => renderItem(item, colors, idx))}</Box>
      <Box gap={1}>{right.map((item, idx) => renderItem(item, colors, idx))}</Box>
    </Box>
  );
});
