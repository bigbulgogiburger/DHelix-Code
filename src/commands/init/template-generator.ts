/**
 * 확장된 정적 DHELIX.md 템플릿 생성기 — 15+ 프로젝트 타입 자동 감지
 *
 * 프로젝트 루트의 설정 파일들을 분석하여 프로젝트 유형을 자동 감지하고,
 * 구조화된 DHELIX.md 템플릿을 생성합니다.
 *
 * 감지 항목 (15+):
 *   1.  package.json     — 이름, 스크립트, 모듈 타입, 엔진, 워크스페이스
 *   2.  tsconfig.json    — strict, target, module, path aliases
 *   3.  Cargo.toml       — 이름, edition, workspace members, features
 *   4.  go.mod           — 모듈 경로, Go 버전, 주요 의존성
 *   5.  pyproject.toml   — 이름, Python 버전, 빌드 시스템 (poetry/hatch/setuptools)
 *   6.  pom.xml          — Java 버전, Spring Boot, 모듈
 *   7.  build.gradle(.kts) — Kotlin/Groovy, 플러그인, 서브프로젝트
 *   8.  Gemfile          — Ruby 버전, Rails 버전
 *   9.  .github/workflows/ — CI 존재 여부, 워크플로 파일 목록
 *  10.  Dockerfile       — 베이스 이미지, 노출 포트
 *  11.  docker-compose   — 서비스 이름 목록
 *  12.  .env.example     — 필수 환경변수 이름 (값은 제외)
 *  13.  nx/turbo/lerna   — 모노레포 도구
 *  14.  Makefile         — 주요 타겟 목록 (최대 10개)
 *  15.  vitest/jest/pytest — 테스트 프레임워크
 *
 * CLI에서 `dhelix init` 실행 시 (에이전트 루프 외부, LLM 없이)
 * 폴백(fallback)으로 사용됩니다.
 *
 * @module commands/init/template-generator
 */
import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { APP_NAME } from "../../constants.js";

// ─────────────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────────────

/**
 * 감지된 프로젝트 정보를 담는 불변 구조체
 *
 * 각 감지기가 수집한 정보를 하나의 구조체에 모아
 * 최종 템플릿 생성 시 참조합니다.
 */
interface ProjectInfo {
  readonly name: string;
  readonly language: string;
  readonly framework: string;
  readonly testFramework: string;
  readonly cicd: string;
  readonly container: string;
  readonly monorepo: string;
  readonly commands: readonly string[];
  readonly stackDetails: readonly string[];
  readonly envVars: readonly string[];
  readonly services: readonly string[];
  readonly makeTargets: readonly string[];
}

/**
 * 빈 프로젝트 정보 기본값 — 모든 필드가 빈 상태
 */
const EMPTY_PROJECT_INFO: ProjectInfo = {
  name: "",
  language: "",
  framework: "",
  testFramework: "",
  cicd: "",
  container: "",
  monorepo: "",
  commands: [],
  stackDetails: [],
  envVars: [],
  services: [],
  makeTargets: [],
};

// ─────────────────────────────────────────────────────────────
// 내부 헬퍼 함수
// ─────────────────────────────────────────────────────────────

/**
 * 파일 존재 여부를 확인하는 내부 헬퍼
 *
 * @param filePath - 확인할 파일 또는 디렉토리의 절대 경로
 * @returns 존재하면 true, 없으면 false
 */
async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 파일을 안전하게 읽는 내부 헬퍼 — 파일이 없으면 null 반환
 *
 * @param filePath - 읽을 파일의 절대 경로
 * @returns 파일 내용 문자열 또는 null
 */
async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * JSON 파일을 안전하게 파싱하는 헬퍼 — tsconfig.json 등 주석 포함 JSON 지원
 *
 * 1차 시도: 표준 JSON.parse
 * 2차 시도: 주석 및 trailing comma 제거 후 재파싱
 *
 * @param content - JSON 문자열
 * @returns 파싱된 레코드 객체 또는 null
 */
function safeParseJson(content: string): Record<string, unknown> | null {
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    try {
      const stripped = content
        .replace(/\/\/.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/,\s*([\]}])/g, "$1");
      return JSON.parse(stripped) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

/**
 * 더 구체적인 언어 감지인지 판별하는 헬퍼
 *
 * 예: TypeScript는 JavaScript보다 구체적이므로 덮어쓸 수 있습니다.
 * Kotlin은 Java보다 구체적입니다.
 *
 * @param incoming - 새로 감지된 언어
 * @param existing - 기존 감지된 언어
 * @returns incoming이 더 구체적이면 true
 */
function isMoreSpecificLanguage(incoming: string, existing: string): boolean {
  const overrides: ReadonlyArray<readonly [string, string]> = [
    ["TypeScript", "JavaScript"],
    ["Kotlin", "Java"],
  ];
  return overrides.some(([specific, general]) => incoming === specific && existing === general);
}

/**
 * 부분 프로젝트 정보를 기존 정보에 비파괴적으로 병합하는 헬퍼
 *
 * 불변 패턴을 따라 새로운 객체를 반환합니다.
 * 스칼라 필드: 기존 값이 비어있을 때만 덮어씀
 * 배열 필드: 기존 배열 뒤에 새 항목을 추가
 *
 * @param base - 기존 프로젝트 정보
 * @param partial - 병합할 부분 정보
 * @returns 병합된 새 프로젝트 정보
 */
function mergeInfo(base: ProjectInfo, partial: Partial<ProjectInfo>): ProjectInfo {
  return {
    name: partial.name && !base.name ? partial.name : base.name,
    language:
      partial.language &&
      (!base.language || isMoreSpecificLanguage(partial.language, base.language))
        ? partial.language
        : base.language,
    framework: partial.framework && !base.framework ? partial.framework : base.framework,
    testFramework:
      partial.testFramework && !base.testFramework ? partial.testFramework : base.testFramework,
    cicd: partial.cicd && !base.cicd ? partial.cicd : base.cicd,
    container: partial.container && !base.container ? partial.container : base.container,
    monorepo: partial.monorepo && !base.monorepo ? partial.monorepo : base.monorepo,
    commands: [...base.commands, ...(partial.commands ?? [])],
    stackDetails: [...base.stackDetails, ...(partial.stackDetails ?? [])],
    envVars: [...base.envVars, ...(partial.envVars ?? [])],
    services: [...base.services, ...(partial.services ?? [])],
    makeTargets: [...base.makeTargets, ...(partial.makeTargets ?? [])],
  };
}

// ─────────────────────────────────────────────────────────────
// 개별 감지기 (Detector) 함수들
// 각 감지기는 try/catch로 감싸져 파일이 없어도 안전합니다.
// ─────────────────────────────────────────────────────────────

/**
 * package.json 감지기 — Node.js 프로젝트 정보를 상세 추출
 *
 * 추출 항목:
 *   - name: 프로젝트 이름
 *   - scripts: build, dev, start, test, lint, format, typecheck
 *   - type: module(ESM) / commonjs
 *   - engines: Node.js 버전 요구사항
 *   - workspaces: 모노레포 워크스페이스 경로
 *
 * @param cwd - 프로젝트 루트 디렉토리
 * @returns 감지된 프로젝트 정보 (부분)
 */
async function detectPackageJson(cwd: string): Promise<Partial<ProjectInfo>> {
  const raw = await safeReadFile(join(cwd, "package.json"));
  if (!raw) return {};

  const pkg = safeParseJson(raw);
  if (!pkg) return {};

  const name = typeof pkg.name === "string" ? pkg.name : "";
  const commands: string[] = [];
  const stackDetails: string[] = [];

  // 모듈 타입 (ESM vs CommonJS)
  const moduleType = typeof pkg.type === "string" ? pkg.type : "commonjs";
  stackDetails.push(`Module System: ${moduleType === "module" ? "ESM" : "CommonJS"}`);

  // 엔진 요구사항
  const engines = pkg.engines as Record<string, string> | undefined;
  if (engines && typeof engines.node === "string") {
    stackDetails.push(`Node.js: ${engines.node}`);
  }

  // 워크스페이스 (npm/yarn/pnpm)
  if (pkg.workspaces) {
    const workspacePaths = Array.isArray(pkg.workspaces)
      ? (pkg.workspaces as readonly string[])
      : Array.isArray((pkg.workspaces as Record<string, unknown>).packages)
        ? ((pkg.workspaces as Record<string, unknown>).packages as readonly string[])
        : [];
    if (workspacePaths.length > 0) {
      stackDetails.push(`Workspaces: ${workspacePaths.slice(0, 5).join(", ")}`);
    }
  }

  // 스크립트 추출 — 주요 스크립트만 표시
  const scripts = pkg.scripts as Record<string, string> | undefined;
  if (scripts) {
    const scriptEntries: ReadonlyArray<readonly [string, string]> = [
      ["build", "npm run build"],
      ["dev", "npm run dev"],
      ["start", "npm start"],
      ["test", "npm test"],
      ["lint", "npm run lint"],
      ["format", "npm run format"],
      ["typecheck", "npm run typecheck"],
    ];
    for (const [key, cmd] of scriptEntries) {
      if (typeof scripts[key] === "string") {
        commands.push(`${cmd.padEnd(24)} # ${scripts[key]}`);
      }
    }
  }

  return { name, language: "JavaScript", commands, stackDetails };
}

/**
 * tsconfig.json 감지기 — TypeScript 프로젝트 상세 설정 추출
 *
 * 추출 항목:
 *   - strict: strict 모드 여부
 *   - target: 컴파일 타겟 (es2020, esnext 등)
 *   - module: 모듈 시스템 (nodenext, esnext 등)
 *   - paths: path alias 목록
 *
 * @param cwd - 프로젝트 루트 디렉토리
 * @returns 감지된 프로젝트 정보 (부분)
 */
async function detectTypeScript(cwd: string): Promise<Partial<ProjectInfo>> {
  const raw = await safeReadFile(join(cwd, "tsconfig.json"));
  if (!raw) return {};

  const tsconfig = safeParseJson(raw);
  const stackDetails: string[] = [];

  if (tsconfig) {
    const compilerOptions = tsconfig.compilerOptions as Record<string, unknown> | undefined;
    if (compilerOptions) {
      if (compilerOptions.strict === true) {
        stackDetails.push("TypeScript: strict mode");
      }
      if (typeof compilerOptions.target === "string") {
        stackDetails.push(`TS Target: ${compilerOptions.target}`);
      }
      if (typeof compilerOptions.module === "string") {
        stackDetails.push(`TS Module: ${compilerOptions.module}`);
      }
      const paths = compilerOptions.paths as Record<string, unknown> | undefined;
      if (paths) {
        const aliases = Object.keys(paths).slice(0, 5);
        if (aliases.length > 0) {
          stackDetails.push(`Path Aliases: ${aliases.join(", ")}`);
        }
      }
    }
  }

  return { language: "TypeScript", stackDetails };
}

/**
 * Cargo.toml 감지기 — Rust 프로젝트 상세 정보 추출
 *
 * TOML 파서 없이 정규식으로 주요 정보를 추출합니다.
 * 추출 항목: name, edition, workspace members, features
 *
 * @param cwd - 프로젝트 루트 디렉토리
 * @returns 감지된 프로젝트 정보 (부분)
 */
async function detectRust(cwd: string): Promise<Partial<ProjectInfo>> {
  const raw = await safeReadFile(join(cwd, "Cargo.toml"));
  if (!raw) return {};

  const stackDetails: string[] = [];
  const commands: string[] = [
    "cargo build              # Build",
    "cargo test               # Run tests",
    "cargo run                # Run binary",
    "cargo clippy             # Lint",
  ];

  // 이름 추출
  const nameMatch = raw.match(/^\s*name\s*=\s*"([^"]+)"/m);
  const name = nameMatch ? nameMatch[1] : "";

  // Edition
  const editionMatch = raw.match(/^\s*edition\s*=\s*"([^"]+)"/m);
  if (editionMatch) {
    stackDetails.push(`Rust Edition: ${editionMatch[1]}`);
  }

  // Workspace members
  const workspaceMatch = raw.match(/\[workspace\][\s\S]*?members\s*=\s*\[([\s\S]*?)\]/);
  if (workspaceMatch) {
    const members = workspaceMatch[1]
      .match(/"([^"]+)"/g)
      ?.map((m) => m.replace(/"/g, ""))
      .slice(0, 5);
    if (members && members.length > 0) {
      stackDetails.push(`Workspace Members: ${members.join(", ")}`);
    }
  }

  // Features
  const featuresMatch = raw.match(/\[features\]([\s\S]*?)(?:\n\[|$)/);
  if (featuresMatch) {
    const featureNames = featuresMatch[1]
      .match(/^(\w[\w-]*)\s*=/gm)
      ?.map((f) => f.replace(/\s*=.*/, ""))
      .slice(0, 5);
    if (featureNames && featureNames.length > 0) {
      stackDetails.push(`Features: ${featureNames.join(", ")}`);
    }
  }

  return { name, language: "Rust", stackDetails, commands };
}

/**
 * go.mod 감지기 — Go 프로젝트 상세 정보 추출
 *
 * 추출 항목: module path, Go version, key dependencies (최대 5개)
 *
 * @param cwd - 프로젝트 루트 디렉토리
 * @returns 감지된 프로젝트 정보 (부분)
 */
async function detectGo(cwd: string): Promise<Partial<ProjectInfo>> {
  const raw = await safeReadFile(join(cwd, "go.mod"));
  if (!raw) return {};

  const stackDetails: string[] = [];
  const commands: string[] = [
    "go build ./...           # Build",
    "go test ./...            # Run tests",
    "go run .                 # Run",
    "go vet ./...             # Lint",
  ];

  // 모듈 경로
  const moduleMatch = raw.match(/^module\s+(\S+)/m);
  const name = moduleMatch ? moduleMatch[1] : "";

  // Go 버전
  const versionMatch = raw.match(/^go\s+(\S+)/m);
  if (versionMatch) {
    stackDetails.push(`Go Version: ${versionMatch[1]}`);
  }

  // 주요 의존성 (require 블록에서 최대 5개)
  const requireMatch = raw.match(/require\s*\(([\s\S]*?)\)/);
  if (requireMatch) {
    const deps = requireMatch[1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("//"))
      .map((line) => line.split(/\s+/)[0])
      .filter(Boolean)
      .slice(0, 5);
    if (deps.length > 0) {
      stackDetails.push(`Key Deps: ${deps.join(", ")}`);
    }
  }

  return { name, language: "Go", stackDetails, commands };
}

/**
 * pyproject.toml 감지기 — Python 프로젝트 상세 정보 추출
 *
 * TOML 파서 없이 정규식으로 추출합니다.
 * 추출 항목: name, python version 요구사항, 빌드 시스템 (poetry/hatch/setuptools)
 *
 * @param cwd - 프로젝트 루트 디렉토리
 * @returns 감지된 프로젝트 정보 (부분)
 */
async function detectPython(cwd: string): Promise<Partial<ProjectInfo>> {
  const raw = await safeReadFile(join(cwd, "pyproject.toml"));
  if (!raw) return {};

  const stackDetails: string[] = [];
  const commands: string[] = [];

  // 이름 추출
  const nameMatch = raw.match(/^\s*name\s*=\s*"([^"]+)"/m);
  const name = nameMatch ? nameMatch[1] : "";

  // Python 버전 요구사항
  const pyVersionMatch = raw.match(/requires-python\s*=\s*"([^"]+)"/);
  if (pyVersionMatch) {
    stackDetails.push(`Python: ${pyVersionMatch[1]}`);
  }

  // 빌드 시스템 감지
  const buildBackend = raw.match(/build-backend\s*=\s*"([^"]+)"/);
  if (buildBackend) {
    const backend = buildBackend[1];
    if (backend.includes("poetry")) {
      stackDetails.push("Build System: Poetry");
      commands.push(
        "poetry install            # Install deps",
        "poetry run pytest         # Run tests",
        "poetry run ruff check .   # Lint",
      );
    } else if (backend.includes("hatchling") || backend.includes("hatch")) {
      stackDetails.push("Build System: Hatch");
      commands.push("hatch run test            # Run tests", "hatch run lint            # Lint");
    } else if (backend.includes("setuptools")) {
      stackDetails.push("Build System: Setuptools");
      commands.push(
        "pip install -e .          # Install in dev mode",
        "pytest                    # Run tests",
      );
    } else {
      stackDetails.push(`Build System: ${backend}`);
    }
  } else {
    commands.push(
      "pip install -e .          # Install in dev mode",
      "pytest                    # Run tests",
    );
  }

  return { name, language: "Python", stackDetails, commands };
}

/**
 * pom.xml 감지기 — Java/Maven 프로젝트 상세 정보 추출
 *
 * XML 파서 없이 정규식으로 추출합니다.
 * 추출 항목: Java version, Spring Boot version, modules
 *
 * @param cwd - 프로젝트 루트 디렉토리
 * @returns 감지된 프로젝트 정보 (부분)
 */
async function detectJavaMaven(cwd: string): Promise<Partial<ProjectInfo>> {
  const raw = await safeReadFile(join(cwd, "pom.xml"));
  if (!raw) return {};

  const stackDetails: string[] = [];
  const commands: string[] = [
    "mvn clean install        # Build",
    "mvn test                 # Run tests",
  ];

  let framework = "";

  // Java 버전 (다양한 프로퍼티명 지원)
  const javaVersionMatch = raw.match(
    /<(?:java\.version|maven\.compiler\.(?:source|target|release))>\s*(\d+)\s*</,
  );
  if (javaVersionMatch) {
    stackDetails.push(`Java: ${javaVersionMatch[1]}`);
  }

  // Spring Boot 버전 (parent에서 추출)
  const springBootMatch = raw.match(
    /<parent>[\s\S]*?spring-boot-starter-parent[\s\S]*?<version>([^<]+)<\/version>/,
  );
  if (springBootMatch) {
    framework = `Spring Boot ${springBootMatch[1]}`;
    stackDetails.push(`Framework: ${framework}`);
    commands.push("mvn spring-boot:run      # Run (Spring Boot)");
  }

  // 모듈 (멀티모듈 프로젝트)
  const modules = Array.from(raw.matchAll(/<module>([^<]+)<\/module>/g), (m) => m[1]).slice(0, 10);
  if (modules.length > 0) {
    stackDetails.push(`Modules: ${modules.join(", ")}`);
  }

  return { language: "Java", framework, stackDetails, commands };
}

/**
 * build.gradle / build.gradle.kts 감지기 — Gradle 프로젝트 상세 정보 추출
 *
 * 추출 항목:
 *   - DSL 유형 (Kotlin DSL vs Groovy DSL)
 *   - 플러그인 목록
 *   - Spring Boot / Kotlin 감지
 *   - settings.gradle에서 서브프로젝트 추출
 *
 * @param cwd - 프로젝트 루트 디렉토리
 * @returns 감지된 프로젝트 정보 (부분)
 */
async function detectGradle(cwd: string): Promise<Partial<ProjectInfo>> {
  const ktsPath = join(cwd, "build.gradle.kts");
  const groovyPath = join(cwd, "build.gradle");
  const ktsExists = await exists(ktsPath);
  const groovyExists = await exists(groovyPath);

  if (!ktsExists && !groovyExists) return {};

  const filePath = ktsExists ? ktsPath : groovyPath;
  const raw = await safeReadFile(filePath);
  if (!raw) return {};

  const dslType = ktsExists ? "Kotlin DSL" : "Groovy DSL";
  let detectedLanguage = "Java";
  const stackDetails: string[] = [`Gradle: ${dslType}`];
  const commands: string[] = [
    "./gradlew build          # Build",
    "./gradlew test           # Run tests",
  ];

  let framework = "";

  // 플러그인 감지 — Kotlin DSL 스타일
  const plugins: string[] = [];
  const ktsDslMatches = Array.from(raw.matchAll(/id\s*[("]\s*["']?([^"')]+)["']?\s*[)"]/g));
  for (const match of ktsDslMatches) {
    plugins.push(match[1]);
  }
  // Groovy 스타일
  const groovyPluginMatches = Array.from(raw.matchAll(/apply\s+plugin:\s*['"]([^'"]+)['"]/g));
  for (const match of groovyPluginMatches) {
    plugins.push(match[1]);
  }

  const uniquePlugins = Array.from(new Set(plugins));
  if (uniquePlugins.length > 0) {
    stackDetails.push(`Plugins: ${uniquePlugins.slice(0, 5).join(", ")}`);
  }

  // Spring Boot 감지
  if (uniquePlugins.some((p) => p.includes("spring-boot") || p.includes("org.springframework"))) {
    framework = "Spring Boot";
    commands.push("./gradlew bootRun        # Run (Spring Boot)");
  }

  // Kotlin 감지
  if (uniquePlugins.some((p) => p.includes("kotlin"))) {
    detectedLanguage = "Kotlin";
  }

  // settings.gradle(.kts) — 서브프로젝트 추출
  const settingsRaw =
    (await safeReadFile(join(cwd, "settings.gradle.kts"))) ??
    (await safeReadFile(join(cwd, "settings.gradle")));
  if (settingsRaw) {
    const includeMatches = [
      ...Array.from(settingsRaw.matchAll(/include\s*\(\s*["']([^"']+)["']/g)),
      ...Array.from(settingsRaw.matchAll(/include\s+['"]([^'"]+)['"]/g)),
    ];
    const includes = includeMatches.map((m) => m[1]).slice(0, 10);
    const uniqueIncludes = Array.from(new Set(includes));
    if (uniqueIncludes.length > 0) {
      stackDetails.push(`Subprojects: ${uniqueIncludes.join(", ")}`);
    }
  }

  return { language: detectedLanguage, framework, stackDetails, commands };
}

/**
 * Gemfile 감지기 — Ruby 프로젝트 상세 정보 추출
 *
 * 추출 항목: Ruby version, Rails version (있으면 Rails 관련 명령어 추가)
 *
 * @param cwd - 프로젝트 루트 디렉토리
 * @returns 감지된 프로젝트 정보 (부분)
 */
async function detectRuby(cwd: string): Promise<Partial<ProjectInfo>> {
  const raw = await safeReadFile(join(cwd, "Gemfile"));
  if (!raw) return {};

  const stackDetails: string[] = [];
  const commands: string[] = [
    "bundle install            # Install deps",
    "bundle exec rspec         # Run tests",
  ];

  let framework = "";

  // Ruby 버전
  const rubyVersionMatch = raw.match(/ruby\s+['"]([^'"]+)['"]/);
  if (rubyVersionMatch) {
    stackDetails.push(`Ruby: ${rubyVersionMatch[1]}`);
  }

  // Rails 버전
  const railsMatch = raw.match(/gem\s+['"]rails['"](?:\s*,\s*['"]([^'"]+)['"])?/);
  if (railsMatch) {
    framework = railsMatch[1] ? `Rails ${railsMatch[1]}` : "Rails";
    stackDetails.push(`Framework: ${framework}`);
    commands.push(
      "rails server             # Start dev server",
      "rails console            # Interactive console",
      "rails db:migrate         # Run migrations",
    );
  }

  return { language: "Ruby", framework, stackDetails, commands };
}

/**
 * .github/workflows/ 감지기 — CI/CD 워크플로 파일 목록 추출
 *
 * 워크플로 디렉토리의 .yml/.yaml 파일을 최대 10개까지 나열합니다.
 *
 * @param cwd - 프로젝트 루트 디렉토리
 * @returns 감지된 프로젝트 정보 (부분)
 */
async function detectCIWorkflows(cwd: string): Promise<Partial<ProjectInfo>> {
  const workflowDir = join(cwd, ".github", "workflows");
  try {
    const entries = await readdir(workflowDir);
    const yamlFiles = entries.filter((f) => f.endsWith(".yml") || f.endsWith(".yaml")).slice(0, 10);
    if (yamlFiles.length === 0) return {};
    return { cicd: `GitHub Actions (${yamlFiles.join(", ")})` };
  } catch {
    return {};
  }
}

/**
 * Dockerfile 감지기 — 컨테이너 빌드 정보 추출
 *
 * 추출 항목: base image (최초 FROM), exposed ports (EXPOSE)
 *
 * @param cwd - 프로젝트 루트 디렉토리
 * @returns 감지된 프로젝트 정보 (부분)
 */
async function detectDocker(cwd: string): Promise<Partial<ProjectInfo>> {
  const raw = await safeReadFile(join(cwd, "Dockerfile"));
  if (!raw) return {};

  const stackDetails: string[] = [];

  // 베이스 이미지 (최초 FROM)
  const fromMatch = raw.match(/^FROM\s+(\S+)/m);
  if (fromMatch) {
    stackDetails.push(`Docker Base: ${fromMatch[1]}`);
  }

  // 노출 포트
  const ports = Array.from(raw.matchAll(/^EXPOSE\s+(\d+)/gm), (m) => m[1]);
  if (ports.length > 0) {
    stackDetails.push(`Exposed Ports: ${ports.join(", ")}`);
  }

  return { container: "Docker", stackDetails };
}

/**
 * docker-compose 감지기 — 서비스 구성 정보 추출
 *
 * docker-compose.yml, docker-compose.yaml, compose.yml, compose.yaml을 순차 확인합니다.
 * YAML 파서 없이 들여쓰기 패턴으로 서비스명을 추출합니다.
 *
 * @param cwd - 프로젝트 루트 디렉토리
 * @returns 감지된 프로젝트 정보 (부분)
 */
async function detectDockerCompose(cwd: string): Promise<Partial<ProjectInfo>> {
  const candidates = ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"];

  let raw: string | null = null;
  for (const candidate of candidates) {
    raw = await safeReadFile(join(cwd, candidate));
    if (raw) break;
  }
  if (!raw) return {};

  // services: 블록 아래의 최상위 키 (2칸 들여쓰기)를 서비스명으로 추출
  const servicesMatch = raw.match(/^services:\s*\n((?:\s+\S.*\n)*)/m);
  if (!servicesMatch) return {};

  const services: string[] = [];
  for (const line of servicesMatch[1].split("\n")) {
    const match = line.match(/^\s{2}(\w[\w.-]*):/);
    if (match) {
      services.push(match[1]);
    }
  }

  return { services: services.slice(0, 10) };
}

/**
 * .env.example / .env.sample 감지기 — 필수 환경변수 이름 추출
 *
 * 보안을 위해 변수의 값은 추출하지 않고 이름만 추출합니다.
 * 주석 줄(#)과 빈 줄은 건너뜁니다.
 *
 * @param cwd - 프로젝트 루트 디렉토리
 * @returns 감지된 프로젝트 정보 (부분)
 */
async function detectEnvExample(cwd: string): Promise<Partial<ProjectInfo>> {
  const candidates = [".env.example", ".env.sample"];

  let raw: string | null = null;
  for (const candidate of candidates) {
    raw = await safeReadFile(join(cwd, candidate));
    if (raw) break;
  }
  if (!raw) return {};

  const envVars = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=/);
      return match ? match[1] : null;
    })
    .filter((v): v is string => v !== null)
    .slice(0, 20);

  return { envVars };
}

/**
 * 모노레포 도구 감지기 — nx.json / turbo.json / lerna.json
 *
 * 첫 번째로 발견된 도구만 보고합니다 (우선순위: Nx > Turborepo > Lerna).
 *
 * @param cwd - 프로젝트 루트 디렉토리
 * @returns 감지된 프로젝트 정보 (부분)
 */
async function detectMonorepoTool(cwd: string): Promise<Partial<ProjectInfo>> {
  const tools: ReadonlyArray<readonly [string, string]> = [
    ["nx.json", "Nx"],
    ["turbo.json", "Turborepo"],
    ["lerna.json", "Lerna"],
  ];

  for (const [file, toolName] of tools) {
    if (await exists(join(cwd, file))) {
      return { monorepo: toolName };
    }
  }

  return {};
}

/**
 * Makefile 감지기 — 주요 빌드 타겟 이름 추출
 *
 * 정규식 `/^([a-zA-Z_][\w-]*):/gm`으로 타겟명을 추출합니다.
 * 도트(.)로 시작하는 내부 타겟은 제외하며, 최대 10개까지 추출합니다.
 *
 * @param cwd - 프로젝트 루트 디렉토리
 * @returns 감지된 프로젝트 정보 (부분)
 */
async function detectMakefile(cwd: string): Promise<Partial<ProjectInfo>> {
  const raw = await safeReadFile(join(cwd, "Makefile"));
  if (!raw) return {};

  const targets = Array.from(raw.matchAll(/^([a-zA-Z_][\w-]*):/gm))
    .map((m) => m[1])
    .filter((t) => !t.startsWith("."))
    .slice(0, 10);

  if (targets.length === 0) return {};

  return { makeTargets: targets };
}

/**
 * 테스트 프레임워크 감지기 — vitest / jest / pytest / RSpec 설정 파일 확인
 *
 * 다양한 설정 파일 패턴을 순차적으로 확인합니다:
 *   - Vitest: vitest.config.{ts,js,mts,mjs}
 *   - Jest: jest.config.{ts,js,mjs,cjs}, .jest.config.{js,ts}, package.json의 jest 키
 *   - pytest: pytest.ini, conftest.py, setup.cfg의 [tool:pytest], pyproject.toml의 [tool.pytest]
 *   - RSpec: .rspec
 *
 * @param cwd - 프로젝트 루트 디렉토리
 * @returns 감지된 프로젝트 정보 (부분)
 */
async function detectTestFramework(cwd: string): Promise<Partial<ProjectInfo>> {
  // Vitest
  const vitestConfigs = [
    "vitest.config.ts",
    "vitest.config.js",
    "vitest.config.mts",
    "vitest.config.mjs",
  ];
  for (const config of vitestConfigs) {
    if (await exists(join(cwd, config))) {
      return { testFramework: "Vitest" };
    }
  }

  // Jest — 설정 파일
  const jestConfigs = [
    "jest.config.ts",
    "jest.config.js",
    "jest.config.mjs",
    "jest.config.cjs",
    ".jest.config.js",
    ".jest.config.ts",
  ];
  for (const config of jestConfigs) {
    if (await exists(join(cwd, config))) {
      return { testFramework: "Jest" };
    }
  }

  // Jest — package.json의 jest 키
  const pkgRaw = await safeReadFile(join(cwd, "package.json"));
  if (pkgRaw) {
    const pkg = safeParseJson(pkgRaw);
    if (pkg && "jest" in pkg) {
      return { testFramework: "Jest" };
    }
  }

  // pytest — pytest.ini, conftest.py
  if (await exists(join(cwd, "pytest.ini"))) {
    return { testFramework: "pytest" };
  }
  if (await exists(join(cwd, "conftest.py"))) {
    return { testFramework: "pytest" };
  }

  // pytest — setup.cfg의 [tool:pytest] 섹션
  const setupCfg = await safeReadFile(join(cwd, "setup.cfg"));
  if (setupCfg && setupCfg.includes("[tool:pytest]")) {
    return { testFramework: "pytest" };
  }

  // pytest — pyproject.toml의 [tool.pytest] 섹션
  const pyprojectRaw = await safeReadFile(join(cwd, "pyproject.toml"));
  if (pyprojectRaw && pyprojectRaw.includes("[tool.pytest")) {
    return { testFramework: "pytest" };
  }

  // RSpec
  if (await exists(join(cwd, ".rspec"))) {
    return { testFramework: "RSpec" };
  }

  return {};
}

// ─────────────────────────────────────────────────────────────
// 템플릿 빌더 함수
// ─────────────────────────────────────────────────────────────

/**
 * 감지된 프로젝트 정보가 없을 때 사용되는 플레이스홀더 템플릿 생성
 *
 * @returns 최소한의 DHELIX.md 플레이스홀더 문자열
 */
function buildPlaceholderTemplate(): string {
  return [
    `# ${APP_NAME.toUpperCase()}.md — Project Instructions`,
    "",
    "Add project-specific instructions here.",
    `${APP_NAME} reads this file at the start of every session.`,
    "",
    "## Example",
    "",
    "```",
    "- Runtime: Node.js 20+",
    "- Test: vitest",
    "- Lint: eslint + prettier",
    "```",
    "",
  ].join("\n");
}

/**
 * 감지된 프로젝트 정보를 기반으로 구조화된 DHELIX.md 템플릿 생성
 *
 * 출력 구조:
 *   # DHELIX.md — Project Instructions
 *   ## Project Overview   (이름, 언어, 프레임워크)
 *   ## Commands           (빌드/테스트/린트 명령어)
 *   ## Stack              (스택 상세, 테스트, CI/CD, 컨테이너, 모노레포)
 *   ## Development        (환경변수, Docker Compose 서비스)
 *
 * @param info - 감지된 프로젝트 정보
 * @returns 구조화된 DHELIX.md 템플릿 문자열
 */
function buildDetectedTemplate(info: ProjectInfo): string {
  const lines: string[] = [`# ${APP_NAME.toUpperCase()}.md — Project Instructions`, ""];

  // ── Project Overview ──
  lines.push("## Project Overview", "");
  if (info.name) {
    lines.push(`- **Name**: ${info.name}`);
  }
  if (info.language) {
    lines.push(`- **Language**: ${info.language}`);
  }
  if (info.framework) {
    lines.push(`- **Framework**: ${info.framework}`);
  }
  lines.push("");

  // ── Commands ──
  if (info.commands.length > 0) {
    lines.push("## Commands", "", "```bash");
    for (const cmd of info.commands) {
      lines.push(cmd);
    }
    lines.push("```", "");
  }

  // ── Makefile Targets ──
  if (info.makeTargets.length > 0) {
    lines.push("### Makefile Targets", "", "```bash");
    for (const target of info.makeTargets) {
      lines.push(`make ${target}`);
    }
    lines.push("```", "");
  }

  // ── Stack ──
  const stackEntries: string[] = [];
  if (info.language) stackEntries.push(`- **Language**: ${info.language}`);
  if (info.framework) stackEntries.push(`- **Framework**: ${info.framework}`);
  if (info.testFramework) stackEntries.push(`- **Test Framework**: ${info.testFramework}`);
  if (info.cicd) stackEntries.push(`- **CI/CD**: ${info.cicd}`);
  if (info.container) stackEntries.push(`- **Container**: ${info.container}`);
  if (info.monorepo) stackEntries.push(`- **Monorepo**: ${info.monorepo}`);

  // stackDetails에서 Language/Framework 중복 제거 (이미 위에서 출력)
  const filteredDetails = info.stackDetails.filter(
    (d) => !d.startsWith("Language:") && !d.startsWith("Framework:"),
  );

  if (stackEntries.length > 0 || filteredDetails.length > 0) {
    lines.push("## Stack", "");
    for (const entry of stackEntries) {
      lines.push(entry);
    }
    for (const detail of filteredDetails) {
      const colonIdx = detail.indexOf(":");
      if (colonIdx > 0) {
        lines.push(`- **${detail.slice(0, colonIdx)}**:${detail.slice(colonIdx + 1)}`);
      } else {
        lines.push(`- ${detail}`);
      }
    }
    lines.push("");
  }

  // ── Development ──
  const hasDevSection = info.envVars.length > 0 || info.services.length > 0;

  if (hasDevSection) {
    lines.push("## Development", "");

    if (info.envVars.length > 0) {
      lines.push("### Environment Variables", "");
      lines.push("Required environment variables (from `.env.example`):", "");
      for (const v of info.envVars) {
        lines.push(`- \`${v}\``);
      }
      lines.push("");
    }

    if (info.services.length > 0) {
      lines.push("### Services (Docker Compose)", "");
      lines.push(`Services: ${info.services.join(", ")}`, "");
    }
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────
// 공개 API
// ─────────────────────────────────────────────────────────────

/**
 * 프로젝트 디렉토리를 분석하여 DHELIX.md 정적 템플릿을 생성하는 함수
 *
 * 15+ 프로젝트 유형의 설정 파일을 병렬로 감지하고,
 * 감지된 정보를 구조화된 마크다운 템플릿으로 조합합니다.
 *
 * 각 감지기는 독립적으로 실행되며, 특정 파일이 없거나
 * 파싱에 실패해도 다른 감지기에 영향을 주지 않습니다.
 *
 * CLI에서 `dhelix init` 실행 시 (에이전트 루프 외부, LLM 없이)
 * 폴백(fallback)으로 사용됩니다.
 *
 * @param cwd - 프로젝트 루트 디렉토리
 * @returns 생성된 DHELIX.md 템플릿 문자열
 *
 * @example
 * ```typescript
 * const template = await generateTemplate("/path/to/project");
 * await writeFile("DHELIX.md", template, "utf-8");
 * ```
 */
export async function generateTemplate(cwd: string): Promise<string> {
  // 15개 감지기를 병렬 실행하여 프로젝트 정보 수집
  const detectionResults = await Promise.all([
    detectPackageJson(cwd),
    detectTypeScript(cwd),
    detectRust(cwd),
    detectGo(cwd),
    detectPython(cwd),
    detectJavaMaven(cwd),
    detectGradle(cwd),
    detectRuby(cwd),
    detectCIWorkflows(cwd),
    detectDocker(cwd),
    detectDockerCompose(cwd),
    detectEnvExample(cwd),
    detectMonorepoTool(cwd),
    detectMakefile(cwd),
    detectTestFramework(cwd),
  ]);

  // 모든 결과를 순차적으로 병합 (불변 패턴)
  let info: ProjectInfo = { ...EMPTY_PROJECT_INFO };
  for (const result of detectionResults) {
    info = mergeInfo(info, result);
  }

  // 아무것도 감지되지 않으면 플레이스홀더 반환
  const hasAnyDetection =
    info.name ||
    info.language ||
    info.commands.length > 0 ||
    info.stackDetails.length > 0 ||
    info.envVars.length > 0 ||
    info.services.length > 0 ||
    info.makeTargets.length > 0 ||
    info.cicd ||
    info.container ||
    info.monorepo ||
    info.testFramework;

  if (!hasAnyDetection) {
    return buildPlaceholderTemplate();
  }

  return buildDetectedTemplate(info);
}
