# Stack 4: Spring Boot + Flutter (Mobile)

## Project Description

Mobile-first application with Spring Boot REST API and Flutter (Dart) mobile client.

## DBCODE.md Template

```markdown
# Habit Tracker - Spring Boot + Flutter

## Stack

- Backend: Java 17, Spring Boot 3.2, Gradle, H2, Spring Data JPA
- Mobile: Flutter 3.x, Dart, Provider for state management
- Testing: JUnit 5 (backend), flutter_test + mockito (mobile)

## Build & Test

- Backend: `cd backend && ./gradlew build` / `./gradlew test jacocoTestReport`
- Mobile: `cd mobile && flutter build apk --debug` / `flutter test --coverage`
- Coverage target: 80% for both

## Directory Structure

backend/ # Spring Boot API
mobile/ # Flutter app
├── lib/
│ ├── models/ # Data classes
│ ├── services/ # API client + business logic
│ ├── screens/ # Full page widgets
│ ├── widgets/ # Reusable widgets
│ ├── providers/ # State management (Provider)
│ └── utils/ # Helpers, constants

## Conventions

- Flutter: Provider pattern for state, not setState in screens
- All API calls through a typed ApiClient class
- Backend returns consistent JSON: { data, message, success }
- Flutter widgets: composition over inheritance
```

## Turn Definitions (9 turns)

### Turn 0: /init — DBCODE.md for Habit Tracker

### Turn 1: Backend scaffold (Gradle, dependencies, standard response wrapper)

### Turn 2: Habit entity (name, description, frequency, streak, lastCompleted) + REST API

### Turn 3: Flutter project scaffold (pubspec.yaml, Provider setup, ApiClient)

### Turn 4: Flutter screens — HabitListScreen, HabitDetailScreen, AddHabitScreen

### Turn 5: Provider state management + API integration + streak calculation

### Turn 6: Build both (./gradlew build + flutter build apk --debug)

### Turn 7: Tests + 80% coverage

Backend: Controller + Service tests
Flutter: Widget tests + unit tests for providers and services

### Turn 8: DBCODE.md compliance check
