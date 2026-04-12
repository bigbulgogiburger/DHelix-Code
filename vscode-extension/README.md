# Dhelix Code — IDE Bridge

VS Code extension that bridges VS Code's language intelligence (diagnostics, go-to-definition, find-references, type info) to the Dhelix CLI AI coding assistant via JSON-RPC 2.0 over Unix domain sockets.

## Features

- **LSP Bridge**: Forwards VS Code language server results to the Dhelix CLI
- **Real-time Diagnostics**: Streams TypeScript/ESLint/etc. diagnostics to the CLI agent
- **IPC Communication**: Uses `vscode-jsonrpc` v9 over Unix domain sockets for low-latency communication

## Commands

| Command | Description |
|---------|-------------|
| `Dhelix: Start LSP Bridge` | Manually start the IPC bridge server |
| `Dhelix: Stop LSP Bridge` | Stop the bridge and clean up the socket |
| `Dhelix: Show Bridge Status` | Display connection status and stats |

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `dhelix.bridge.autoStart` | `true` | Auto-start bridge on workspace open |
| `dhelix.bridge.socketPath` | `""` | Custom socket path (auto-generated if empty) |
| `dhelix.bridge.diagnosticsDebounceMs` | `300` | Debounce interval for diagnostics (ms) |
| `dhelix.bridge.enableDiagnostics` | `true` | Forward diagnostics to CLI |

## Development

```bash
npm install
npm run watch    # Build with watch mode
# Press F5 in VS Code to launch Extension Development Host
```

## Building

```bash
npm run build           # Development build
npm run vscode:prepublish  # Production build (minified)
npm run package         # Create .vsix package
```

## Architecture

The extension acts as a bridge between VS Code's built-in language services and the Dhelix CLI. It does not implement its own language server; instead, it leverages the language servers already running in VS Code (TypeScript, ESLint, etc.) and forwards their results over IPC to the CLI agent.

```
VS Code Language Servers  -->  Dhelix Extension  -->  Unix Socket  -->  Dhelix CLI
(TypeScript, ESLint, ...)      (JSON-RPC bridge)      (IPC)            (AI Agent)
```
