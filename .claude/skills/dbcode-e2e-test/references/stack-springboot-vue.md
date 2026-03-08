# Stack 3: Spring Boot + Vue 3 (TypeScript)

## Project Description
Full-stack application with Spring Boot API and Vue 3 Composition API frontend.

## DBCODE.md Template
```markdown
# Expense Tracker - Spring Boot + Vue 3

## Stack
- Backend: Java 17, Spring Boot 3.2, Maven, H2, Spring Data JPA
- Frontend: Vue 3 (Composition API), TypeScript, Vite, Pinia (state), Vue Router
- Testing: JUnit 5 + MockMvc (backend), Vitest + Vue Test Utils (frontend)

## Build & Test
- Backend: `cd backend && mvn clean package` / `mvn test jacoco:report`
- Frontend: `cd frontend && npm run build` / `npx vitest run --coverage`

## Conventions
- Vue: Composition API with `<script setup>` syntax only
- Pinia stores for ALL shared state
- Backend: ResponseEntity<> return types on all endpoints
- API versioning: /api/v1/
- Vue components: PascalCase .vue files
```

## Turn Definitions (9 turns)

### Turn 0: /init
Create DBCODE.md for Expense Tracker with above stack.

### Turn 1: Backend project scaffold (Maven, dependencies, application.yml)

### Turn 2: Expense entity + Category entity + JPA relationships + REST API
Fields: id, amount, description, category (ManyToOne), date, type (INCOME/EXPENSE)

### Turn 3: Frontend scaffold (Vite + Vue 3 + TypeScript + Pinia + Vue Router)

### Turn 4: Vue components — ExpenseList, ExpenseForm, CategoryFilter, Dashboard with charts

### Turn 5: Pinia store + API integration + Vue Router setup

### Turn 6: Build both projects, fix errors

### Turn 7: Tests + 80% coverage (both backend and frontend)

### Turn 8: DBCODE.md compliance review
