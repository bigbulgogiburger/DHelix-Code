# 프로젝트 구조 시각화

다음은 이 저장소 전체를 대표하는 Mermaid 다이어그램입니다.

```mermaid
graph TD
  root["dhelix/"]
  root --> src
  root --> docs
  root --> scripts
  root --> bin
  root --> test
  root --> package.json
  root --> README.md

  src --> cli
  src --> commands
  src --> config
  src --> core
  src --> guardrails
  src --> hooks
  src --> llm
  src --> mcp
  src --> memory
  src --> permissions
  src --> sandbox
  src --> skills
  src --> subagents
  src --> telemetry
  src --> tools
  src --> utils
  src --> voice

  cli --> "components/"
  cli --> hooks
  cli --> renderer

  commands --> init
  commands --> agents
  commands --> dual-model
  commands --> context
  commands --> status

  core --> agent-loop
  core --> context-manager
  core --> session-manager
  core --> system-prompt

  tools --> definitions
  tools --> executor
  tools --> registry

  docs --> features
  docs --> research
  docs --> roadmap

  subagents --> agent-hooks
  subagents --> explore
  subagents --> general
  subagents --> plan
```
