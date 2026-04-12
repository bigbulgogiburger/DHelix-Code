# Repository Guidelines

## Project Structure & Module Organization

Core application code lives in `src/`. Major areas include `src/commands/` for CLI commands, `src/cli/` for Ink UI components and hooks, `src/llm/` for model clients, `src/mcp/` for MCP integration, and `src/{permissions,skills,sandbox,telemetry}/` for platform services. Tests live under `test/` and are split into `test/unit/`, `test/integration/`, `test/e2e/`, plus shared fixtures in `test/fixtures/` and mocks in `test/mocks/`. The VS Code companion extension is isolated in `vscode-extension/`. Build output goes to `dist/`; do not edit generated files.

## Build, Test, and Development Commands

- `npm install`: install dependencies; Node.js 20+ is required.
- `npm run dev`: run `tsup --watch` during local development.
- `npm run build`: bundle the CLI from `src/index.ts` into `dist/`.
- `npm run typecheck`: run strict TypeScript checks without emitting files.
- `npm run lint`: lint `src/**/*.{ts,tsx}` with ESLint.
- `npm run format`: apply Prettier formatting to `src/**/*.{ts,tsx}`.
- `npm test`: run the full Vitest suite.
- `npm run test:coverage`: run tests with V8 coverage.
- `npm run ci`: full verification pipeline before publish or merge.

## Coding Style & Naming Conventions

Use TypeScript with ESM and explicit relative `.js` import extensions. Prefer named exports over `default` exports. Follow the existing layering: CLI -> commands -> core/services -> utils. Keep types strict; prefer `unknown` plus validation over `any`. Match local file naming patterns such as `token-manager.ts`, `useConversation.ts`, and `manager.test.ts`. Use Prettier defaults for formatting and keep ESLint warnings at zero before opening a PR.

## Testing Guidelines

Vitest is the test runner. Put fast unit tests in `test/unit/`, cross-module behavior in `test/integration/`, and workflow coverage in `test/e2e/`. Name tests `*.test.ts`. When changing a module, add or update the nearest focused test file, then run `npm test` or `npx vitest run test/unit/path/to/file.test.ts` for targeted checks. Prefer `npm run test:coverage` for larger refactors.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commit prefixes such as `feat(lsp): ...`, `fix(cli): ...`, and `refactor: ...`. Keep that format and scope commits to a single logical change. PRs should include a concise summary, testing notes, linked issues, and screenshots or terminal captures for CLI or `vscode-extension/` UI changes. Call out config, permission, or sandbox behavior changes explicitly.

## Agent-Specific Notes

`DHELIX.md` is the repository-specific instruction file for the coding agent. Update it when contributor workflow or architectural expectations change.
