# Stack 5: Flutter WebView + Spring Boot API

## Project Description

Hybrid mobile app using Flutter WebView to embed a Spring Boot served web application.
The Spring Boot backend serves both REST API and Thymeleaf HTML pages.
Flutter wraps the web app in a WebView with native bridge for device features.

## DBCODE.md Template

```markdown
# Smart Notes - Flutter WebView + Spring Boot

## Stack

- Backend: Java 17, Spring Boot 3.2, Gradle, H2, Thymeleaf + REST API
- Mobile Shell: Flutter 3.x with webview_flutter package
- Web UI: Thymeleaf templates + Bootstrap 5 + vanilla JavaScript
- Testing: JUnit 5 (backend), flutter_test (mobile), MockMvc (web)

## Build & Test

- Backend: `cd backend && ./gradlew build` / `./gradlew test jacocoTestReport`
- Mobile: `cd mobile && flutter build apk --debug` / `flutter test --coverage`

## Architecture

- Backend serves Thymeleaf pages at / and REST API at /api/
- Flutter WebView loads backend URL
- JavaScript bridge: window.FlutterBridge.postMessage() for native features
- Backend handles both @Controller (pages) and @RestController (API)

## Directory Structure

backend/
├── src/main/java/.../
│ ├── controller/ # Page controllers (@Controller)
│ ├── api/ # REST controllers (@RestController)
│ ├── service/
│ ├── entity/
│ └── repository/
├── src/main/resources/
│ ├── templates/ # Thymeleaf .html files
│ └── static/ # CSS, JS assets

mobile/
├── lib/
│ ├── screens/ # WebView screen
│ ├── services/ # Native bridge handler
│ └── utils/

## Conventions

- Thymeleaf pages use layout fragments (header, footer)
- REST API returns JSON, page controllers return view names
- Flutter WebView configuration: JavaScript enabled, allow navigation
- Native bridge: camera, share, clipboard via platform channels
```

## Turn Definitions (10 turns)

### Turn 0: /init — DBCODE.md for Smart Notes

### Turn 1: Backend scaffold (Gradle, Spring Boot + Thymeleaf + Web + JPA + H2)

### Turn 2: Note entity (id, title, content, tags, createdAt, updatedAt) + Repository + Service

### Turn 3: REST API controllers (/api/notes CRUD) + Page controllers (/, /notes/{id})

### Turn 4: Thymeleaf templates (layout.html, list.html, detail.html, form.html) + Bootstrap 5

### Turn 5: JavaScript for dynamic features (AJAX note search, tag filtering, auto-save draft)

### Turn 6: Flutter project scaffold + WebView setup + JavaScript bridge

### Turn 7: Flutter native features — share note, copy to clipboard via bridge

### Turn 8: Build both (./gradlew build + flutter build apk --debug)

### Turn 9: Tests + 80% coverage

Backend: MockMvc for both page and API controllers, service tests
Flutter: WebView widget test, bridge handler tests

### Turn 10: DBCODE.md compliance review
