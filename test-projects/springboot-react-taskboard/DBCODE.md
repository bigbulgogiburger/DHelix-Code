# Task Board Application

This project is a monorepo for a Task Board application, consisting of a backend and a frontend.

## Backend
- **Framework**: Spring Boot 3.2
- **Build Tool**: Gradle Kotlin DSL
- **Language**: Java 17
- **Database**: H2
- **ORM**: Spring Data JPA
- **Testing**: JUnit 5, JaCoCo

### Directory Structure
```
/backend
  ├── build.gradle.kts
  ├── src
  │   ├── main
  │   │   ├── java
  │   │   └── resources
  │   └── test
  │       ├── java
  │       └── resources
```

### Build Commands
- `./gradlew build` - Build the backend

### Test Commands
- `./gradlew test` - Run tests with JUnit 5
- `./gradlew jacocoTestReport` - Generate JaCoCo coverage report

### Coding Conventions
- RESTful API under `/api/v1/`

## Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS
- **Testing**: Vitest, React Testing Library

### Directory Structure
```
/frontend
  ├── vite.config.ts
  ├── src
  │   ├── components
  │   ├── hooks
  │   ├── pages
  │   ├── styles
  │   └── tests
```

### Build Commands
- `npm run build` - Build the frontend

### Test Commands
- `npm run test` - Run tests with Vitest

### Coding Conventions
- Functional components only
- TypeScript strict mode
- Typed fetch wrapper
- Tailwind CSS for styling

## Coverage
- Target 80% test coverage for both backend and frontend.