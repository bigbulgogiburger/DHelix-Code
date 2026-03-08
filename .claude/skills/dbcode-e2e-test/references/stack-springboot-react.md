# Stack 2: Spring Boot + React (TypeScript)

## Project Description
Modern full-stack application with Spring Boot REST API backend and React TypeScript frontend.
Monorepo structure with separate backend/ and frontend/ directories.

## DBCODE.md Template
```markdown
# Task Board - Spring Boot + React

## Stack
- Backend: Java 17, Spring Boot 3.2, Gradle (Kotlin DSL), H2, Spring Data JPA
- Frontend: React 18, TypeScript 5, Vite, Tailwind CSS
- Testing: JUnit 5 + MockMvc (backend), Vitest + React Testing Library (frontend)

## Build & Test
- Backend build: `cd backend && ./gradlew build`
- Backend test: `cd backend && ./gradlew test jacocoTestReport`
- Frontend build: `cd frontend && npm run build`
- Frontend test: `cd frontend && npx vitest run --coverage`
- Full build: Run both backend and frontend builds

## Directory Structure
backend/
├── src/main/java/com/example/taskboard/
│   ├── controller/    # @RestController classes
│   ├── service/       # Business logic
│   ├── repository/    # Spring Data JPA repositories
│   ├── entity/        # JPA entities
│   └── dto/           # Request/Response DTOs
frontend/
├── src/
│   ├── components/    # React components
│   ├── hooks/         # Custom hooks
│   ├── services/      # API client (fetch/axios)
│   ├── types/         # TypeScript interfaces
│   └── pages/         # Page components

## Conventions
- Backend: RESTful endpoints under /api/v1/
- Frontend: Functional components only, no class components
- TypeScript strict mode enabled
- API client uses typed fetch wrapper, not raw fetch
- Tailwind for styling, no CSS modules
```

## Turn Definitions

### Turn 0: /init
```
Run /init to initialize this project. Create a DBCODE.md for a Task Board application using
Spring Boot 3.2 (Gradle Kotlin DSL, Java 17, H2, Spring Data JPA) as backend and
React 18 (TypeScript 5, Vite, Tailwind CSS) as frontend. Monorepo with backend/ and frontend/.
Testing: JUnit 5 + JaCoCo (backend), Vitest + React Testing Library (frontend). Target 80% coverage.
```

### Turn 1: Backend Scaffold
```
Create the backend/ directory with Spring Boot 3.2 Gradle project. Include dependencies:
spring-boot-starter-web, spring-boot-starter-data-jpa, h2, lombok.
Add JaCoCo plugin with 80% minimum coverage. Create application.yml with H2 config.
Follow DBCODE.md directory structure exactly.
```

### Turn 2: Backend API
```
Implement REST API for Task entity with fields: id, title, description, status (enum: TODO/IN_PROGRESS/DONE),
priority (enum: LOW/MEDIUM/HIGH), createdAt, updatedAt.
Create full CRUD endpoints under /api/v1/tasks with DTOs.
Refer to DBCODE.md — use @RestController, not @Controller.
```

### Turn 3: Frontend Scaffold
```
Create frontend/ with Vite + React + TypeScript. Install dependencies:
react, react-dom, tailwindcss, @types/react. Configure TypeScript strict mode.
Set up Vitest + React Testing Library. Proxy /api to backend (vite.config.ts).
Follow DBCODE.md directory structure.
```

### Turn 4: Frontend Components
```
Build the Task Board UI: TaskList, TaskCard, TaskForm, StatusFilter components.
Use Tailwind CSS for styling (no CSS modules per DBCODE.md).
Create typed API client in services/ using fetch wrapper.
Functional components only as specified in DBCODE.md.
```

### Turn 5: Frontend State + Integration
```
Connect frontend to backend API. Implement CRUD operations through the API client.
Add drag-and-drop for status changes (TODO -> IN_PROGRESS -> DONE).
Handle loading and error states. Use custom hooks for data fetching.
```

### Turn 6: Build Both
```
Build both projects:
1. cd backend && ./gradlew build
2. cd frontend && npm run build
Fix any errors in either project.
```

### Turn 7: Tests + Coverage
```
Write tests for BOTH projects targeting 80% coverage:
Backend: JUnit 5 tests for controller (MockMvc), service (Mockito), repository.
Frontend: Vitest tests for components, hooks, and API client.
Run: backend: ./gradlew test jacocoTestReport, frontend: npx vitest run --coverage
```

### Turn 8: DBCODE.md Review
```
Review the entire project against DBCODE.md. Check:
1. REST endpoints under /api/v1/
2. Functional components only
3. TypeScript strict mode
4. Typed fetch wrapper (not raw fetch)
5. Tailwind only (no CSS modules)
Fix violations.
```
