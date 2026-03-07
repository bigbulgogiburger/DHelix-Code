# Task Manager Application

This project is a Task Manager application built using a monorepo structure with separate backend and frontend directories.

## Backend
- **Framework**: Spring Boot 3.2
- **Build Tool**: Gradle Kotlin DSL
- **Language**: Java 17
- **Database**: H2
- **ORM**: Spring Data JPA

### Directory Structure
```
backend/
├── src
│   ├── main
│   │   ├── java
│   │   └── resources
│   └── test
│       ├── java
│       └── resources
└── build.gradle.kts
```

### Build Commands
- `./gradlew build`

### Test Commands
- `./gradlew test jacocoTestReport`

### Testing
- **Framework**: JUnit 5
- **Coverage Tool**: JaCoCo
- **Coverage Target**: 80%

## Frontend
- **Framework**: Vue 3
- **Build Tool**: Vite
- **Language**: TypeScript
- **State Management**: Pinia
- **Styling**: Tailwind CSS

### Directory Structure
```
frontend/
├── src
│   ├── assets
│   ├── components
│   ├── composables
│   ├── router
│   ├── store
│   ├── styles
│   ├── views
│   └── main.ts
└── vite.config.ts
```

### Build Commands
- `npm run build`

### Test Commands
- `npx vitest run --coverage`

### Testing
- **Framework**: Vitest
- **Utilities**: Vue Test Utils
- **Coverage Target**: 80%

## Coding Conventions
- **Backend**: RESTful endpoints under `/api/v1/`
- **Frontend**: Vue 3 Composition API with `<script setup>`
- **TypeScript**: Strict mode enabled
- **State Management**: Pinia
- **Styling**: Tailwind CSS only (no scoped styles)