import PptxGenJS from "pptxgenjs";

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE"; // 16:9
pptx.author = "DBInc";
pptx.subject = "dbcode 프로젝트 개요";

// ── 디자인 토큰 ──
const C = {
  bg: "FFFFFF",
  primary: "1B2A4A",
  accent: "2D6CDF",
  lightBg: "F4F6FA",
  text: "1B2A4A",
  sub: "5A6A7E",
  white: "FFFFFF",
  border: "D0D7E3",
  green: "27AE60",
  orange: "E67E22",
};
const F = "맑은 고딕";

// ── 공통 프레임 ──
function frame(slide, title, page) {
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0,
    y: 0,
    w: "100%",
    h: 0.9,
    fill: { color: C.primary },
  });
  slide.addText(title, {
    x: 0.6,
    y: 0.15,
    w: 10,
    h: 0.6,
    fontSize: 24,
    fontFace: F,
    color: C.white,
    bold: true,
  });
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0,
    y: 7.2,
    w: "100%",
    h: 0.03,
    fill: { color: C.accent },
  });
  slide.addText(`${page} / 5`, {
    x: 12,
    y: 7.25,
    w: 1.2,
    h: 0.3,
    fontSize: 10,
    fontFace: F,
    color: C.sub,
    align: "right",
  });
  slide.addText("dbcode", {
    x: 0.5,
    y: 7.25,
    w: 1.5,
    h: 0.3,
    fontSize: 10,
    fontFace: F,
    color: C.sub,
    bold: true,
  });
}

// ══════════════════════════════════════════════════════════
// 슬라이드 1: 표지
// ══════════════════════════════════════════════════════════
const s1 = pptx.addSlide();
s1.addShape(pptx.shapes.RECTANGLE, {
  x: 0,
  y: 0,
  w: "100%",
  h: "100%",
  fill: { color: C.primary },
});
s1.addShape(pptx.shapes.RECTANGLE, {
  x: 0,
  y: 0,
  w: 0.08,
  h: "100%",
  fill: { color: C.accent },
});
s1.addText("dbcode", {
  x: 1.2,
  y: 2.0,
  w: 10,
  h: 1.0,
  fontSize: 48,
  fontFace: F,
  color: C.white,
  bold: true,
});
s1.addText("CLI AI 코딩 어시스턴트", {
  x: 1.2,
  y: 3.0,
  w: 10,
  h: 0.6,
  fontSize: 22,
  fontFace: F,
  color: C.accent,
});
s1.addShape(pptx.shapes.RECTANGLE, {
  x: 1.2,
  y: 3.9,
  w: 3,
  h: 0.04,
  fill: { color: C.accent },
});
s1.addText("로컬 및 외부 LLM을 활용한\nAI 기반 코드 자동화 도구", {
  x: 1.2,
  y: 4.2,
  w: 8,
  h: 0.9,
  fontSize: 16,
  fontFace: F,
  color: "8FA3C0",
  lineSpacingMultiple: 1.4,
});
s1.addText("2026. 03", {
  x: 1.2,
  y: 6.2,
  w: 3,
  h: 0.4,
  fontSize: 14,
  fontFace: F,
  color: "8FA3C0",
});

// ══════════════════════════════════════════════════════════
// 슬라이드 2: 시스템 아키텍처
// ══════════════════════════════════════════════════════════
const s2 = pptx.addSlide();
frame(s2, "시스템 아키텍처", 2);

const layers = [
  {
    label: "CLI 계층",
    desc: "Ink / React 기반 터미널 UI · 컴포넌트 렌더링 · 키보드 입력 처리",
    color: C.accent,
    y: 1.3,
  },
  {
    label: "Core 계층",
    desc: "Agent Loop (ReAct 패턴) · 대화 관리 · 컨텍스트 매니저 · 시스템 프롬프트",
    color: "3B82B6",
    y: 2.7,
  },
  {
    label: "Infra 계층",
    desc: "LLM 클라이언트 (OpenAI SDK) · 도구 시스템 (14종) · 권한 관리 · MCP 클라이언트",
    color: "4E6D8C",
    y: 4.1,
  },
  {
    label: "Leaf 계층",
    desc: "설정 관리 (5단계 계층) · 유틸리티 · 로거 · 이벤트 시스템",
    color: "6B7C8D",
    y: 5.5,
  },
];

layers.forEach((l) => {
  s2.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 1.5,
    y: l.y,
    w: 10.3,
    h: 1.1,
    fill: { color: l.color },
    rectRadius: 0.08,
  });
  s2.addText(l.label, {
    x: 1.9,
    y: l.y + 0.12,
    w: 3,
    h: 0.4,
    fontSize: 16,
    fontFace: F,
    color: C.white,
    bold: true,
  });
  s2.addText(l.desc, {
    x: 1.9,
    y: l.y + 0.52,
    w: 9,
    h: 0.4,
    fontSize: 12,
    fontFace: F,
    color: "D4E0F0",
  });
});

[2.45, 3.85, 5.25].forEach((y) => {
  s2.addText("▼", {
    x: 6.2,
    y,
    w: 0.8,
    h: 0.3,
    fontSize: 14,
    color: C.border,
    align: "center",
  });
});

s2.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 1.5,
  y: 6.7,
  w: 10.3,
  h: 0.4,
  fill: { color: C.lightBg },
  rectRadius: 0.05,
});
s2.addText("의존성 규칙:  상위 → 하위 단방향만 허용  |  순환 의존성 0건 검증 완료", {
  x: 1.7,
  y: 6.7,
  w: 10,
  h: 0.4,
  fontSize: 11,
  fontFace: F,
  color: C.sub,
});

// ══════════════════════════════════════════════════════════
// 슬라이드 3: 기술 스택 & 코어 기능
// ══════════════════════════════════════════════════════════
const s3 = pptx.addSlide();
frame(s3, "기술 스택 & 코어 기능", 3);

s3.addText("기술 스택", {
  x: 0.8,
  y: 1.3,
  w: 4,
  h: 0.4,
  fontSize: 16,
  fontFace: F,
  color: C.primary,
  bold: true,
});

const stack = [
  ["런타임", "Node.js 20+"],
  ["언어", "TypeScript 5.x (Strict 모드)"],
  ["터미널 UI", "Ink 5.x (React for CLI)"],
  ["LLM 연동", "OpenAI SDK (호환 API 지원)"],
  ["빌드 도구", "tsup (ESM, 코드 스플리팅)"],
  ["테스트", "Vitest (단위/통합/E2E)"],
  ["모듈 시스템", "ESM Only"],
];

stack.forEach(([label, value], i) => {
  const y = 1.9 + i * 0.52;
  s3.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.8,
    y,
    w: 1.8,
    h: 0.38,
    fill: { color: C.accent },
    rectRadius: 0.05,
  });
  s3.addText(label, {
    x: 0.8,
    y,
    w: 1.8,
    h: 0.38,
    fontSize: 11,
    fontFace: F,
    color: C.white,
    bold: true,
    align: "center",
  });
  s3.addText(value, {
    x: 2.8,
    y,
    w: 3.2,
    h: 0.38,
    fontSize: 11,
    fontFace: F,
    color: C.text,
  });
});

s3.addShape(pptx.shapes.RECTANGLE, {
  x: 6.3,
  y: 1.3,
  w: 0.02,
  h: 5.5,
  fill: { color: C.border },
});

s3.addText("코어 기능", {
  x: 6.8,
  y: 1.3,
  w: 5,
  h: 0.4,
  fontSize: 16,
  fontFace: F,
  color: C.primary,
  bold: true,
});

const features = [
  ["ReAct Agent Loop", "추론 → 행동 → 관찰 반복 패턴"],
  ["14개 내장 도구", "파일 읽기/쓰기, Bash, Grep, Glob 등"],
  ["25개 슬래시 명령", "/model, /config, /cost, /resume 등"],
  ["MCP 클라이언트", "외부 도구 서버 연동 (stdio 통신)"],
  ["5단계 설정 체계", "기본값 → 사용자 → 프로젝트 → 환경변수 → CLI"],
  ["멀티턴 대화", "컨텍스트 유지 및 세션 관리"],
  ["권한 관리 시스템", "도구별 실행 권한 제어"],
];

features.forEach(([title, desc], i) => {
  const y = 1.9 + i * 0.7;
  s3.addText(title, {
    x: 6.8,
    y,
    w: 5.5,
    h: 0.3,
    fontSize: 12,
    fontFace: F,
    color: C.accent,
    bold: true,
  });
  s3.addText(desc, {
    x: 6.8,
    y: y + 0.28,
    w: 5.5,
    h: 0.3,
    fontSize: 10,
    fontFace: F,
    color: C.sub,
  });
});

// ══════════════════════════════════════════════════════════
// 슬라이드 4: 개발 워크플로우
// ══════════════════════════════════════════════════════════
const s4 = pptx.addSlide();
frame(s4, "개발 워크플로우", 4);

const workflows = [
  {
    title: "TDD 기반 개발",
    x: 0.6,
    items: [
      "1. 테스트 작성 (RED)",
      "2. 최소 구현 (GREEN)",
      "3. 리팩토링 (IMPROVE)",
      "4. 커버리지 검증 (80%+)",
    ],
    icon: "TEST",
  },
  {
    title: "CI / 품질 관리",
    x: 4.7,
    items: [
      "TypeScript 타입 체크",
      "ESLint 정적 분석",
      "Vitest 자동 테스트",
      "Prettier 코드 포맷팅",
    ],
    icon: "CI",
  },
  {
    title: "Git 워크플로우",
    x: 8.8,
    items: [
      "Conventional Commits 규칙",
      "Pre-commit Hook 검증",
      "브랜치 전략 운용",
      "코드 리뷰 프로세스",
    ],
    icon: "GIT",
  },
];

workflows.forEach((wf) => {
  s4.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: wf.x,
    y: 1.4,
    w: 3.8,
    h: 4.2,
    fill: { color: C.lightBg },
    rectRadius: 0.1,
    line: { color: C.border, width: 0.5 },
  });
  s4.addShape(pptx.shapes.OVAL, {
    x: wf.x + 1.4,
    y: 1.7,
    w: 1.0,
    h: 1.0,
    fill: { color: C.accent },
  });
  s4.addText(wf.icon, {
    x: wf.x + 1.4,
    y: 1.7,
    w: 1.0,
    h: 1.0,
    fontSize: 11,
    fontFace: F,
    color: C.white,
    bold: true,
    align: "center",
    valign: "middle",
  });
  s4.addText(wf.title, {
    x: wf.x + 0.3,
    y: 2.9,
    w: 3.2,
    h: 0.4,
    fontSize: 14,
    fontFace: F,
    color: C.primary,
    bold: true,
    align: "center",
  });
  wf.items.forEach((item, i) => {
    s4.addText(item, {
      x: wf.x + 0.5,
      y: 3.5 + i * 0.45,
      w: 3,
      h: 0.35,
      fontSize: 11,
      fontFace: F,
      color: C.text,
    });
  });
});

s4.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.6,
  y: 6.0,
  w: 12.0,
  h: 0.7,
  fill: { color: C.primary },
  rectRadius: 0.08,
});
s4.addText("npm run check  →  타입체크 + 린트 + 테스트 + 빌드  (커밋 전 필수 실행)", {
  x: 0.8,
  y: 6.0,
  w: 11.6,
  h: 0.7,
  fontSize: 12,
  fontFace: F,
  color: C.white,
  align: "center",
});

// ══════════════════════════════════════════════════════════
// 슬라이드 5: 향후 개발 방향
// ══════════════════════════════════════════════════════════
const s5 = pptx.addSlide();
frame(s5, "향후 개발 방향", 5);

const roadmap = [
  {
    title: "에이전트 도구 시스템",
    desc: "서브에이전트 병렬 실행 지원\n독립 작업 분리 및 위임 기능\n백그라운드 태스크 관리",
    priority: "HIGH",
    x: 0.6,
    y: 1.3,
  },
  {
    title: "컨텍스트 관리 고도화",
    desc: "자동 컨텍스트 압축 (3단계)\n대용량 출력 디스크 캐싱\n토큰 사용량 최적화",
    priority: "HIGH",
    x: 6.95,
    y: 1.3,
  },
  {
    title: "도구 확장",
    desc: "WebFetch / WebSearch 강화\nMultiEdit (다중 편집 지원)\nNotebook 편집 지원",
    priority: "MEDIUM",
    x: 0.6,
    y: 4.15,
  },
  {
    title: "개발자 경험 개선",
    desc: "TodoWrite (작업 추적 도구)\n세션 자동 저장 및 복원\n향상된 오류 메시지 체계",
    priority: "MEDIUM",
    x: 6.95,
    y: 4.15,
  },
];

roadmap.forEach((item) => {
  s5.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: item.x,
    y: item.y,
    w: 5.75,
    h: 2.5,
    fill: { color: C.lightBg },
    rectRadius: 0.1,
    line: { color: C.border, width: 0.5 },
  });
  const bc = item.priority === "HIGH" ? C.accent : C.orange;
  s5.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: item.x + 4.3,
    y: item.y + 0.2,
    w: 1.1,
    h: 0.35,
    fill: { color: bc },
    rectRadius: 0.05,
  });
  s5.addText(item.priority, {
    x: item.x + 4.3,
    y: item.y + 0.2,
    w: 1.1,
    h: 0.35,
    fontSize: 9,
    fontFace: F,
    color: C.white,
    bold: true,
    align: "center",
  });
  s5.addText(item.title, {
    x: item.x + 0.4,
    y: item.y + 0.2,
    w: 4,
    h: 0.4,
    fontSize: 15,
    fontFace: F,
    color: C.primary,
    bold: true,
  });
  s5.addText(item.desc, {
    x: item.x + 0.4,
    y: item.y + 0.8,
    w: 5,
    h: 1.4,
    fontSize: 11,
    fontFace: F,
    color: C.text,
    lineSpacingMultiple: 1.5,
  });
});

// ── 저장 ──
const outPath = "C:/Users/DBInc/dbcode/dbcode-overview.pptx";
await pptx.writeFile({ fileName: outPath });
console.log(`PPT 저장 완료: ${outPath}`);
