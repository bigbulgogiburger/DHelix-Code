# Stack 1: Spring MVC + JSP + JavaScript

## Project Description

Traditional Spring MVC web application with JSP views, JSTL, jQuery/vanilla JS frontend.
Classic enterprise pattern still used in many Korean enterprise systems.

## DBCODE.md Template

```markdown
# Todo Manager - Spring MVC + JSP

## Stack

- Java 17, Spring Framework 6.x (not Boot), Maven
- JSP + JSTL for views, jQuery 3.x for interactivity
- H2 in-memory database, Spring JDBC Template
- JUnit 5 + Mockito for testing

## Build & Test

- Build: `mvn clean package -DskipTests`
- Test: `mvn test`
- Coverage: `mvn jacoco:report` (target: 80%+)
- Run: `mvn spring-boot:run` (embedded Tomcat)

## Directory Structure

src/main/java/com/example/todo/
├── config/ # Spring configuration classes
├── controller/ # @Controller classes
├── service/ # Business logic
├── repository/ # Data access (JdbcTemplate)
├── model/ # Domain models
└── dto/ # Request/Response DTOs

src/main/webapp/
├── WEB-INF/views/ # JSP files
├── resources/
│ ├── css/ # Stylesheets
│ └── js/ # JavaScript files
└── index.jsp

## Conventions

- Controller methods return view names (String), not ResponseBody
- Use @ModelAttribute for form binding
- JSP uses JSTL c:forEach, c:if — no scriptlets
- JavaScript in separate .js files, not inline in JSP
```

## Turn Definitions

### Turn 0: /init

```
Run /init to initialize this project. Create a DBCODE.md describing a Spring MVC + JSP + JavaScript
Todo Manager application. Use Java 17, Spring Framework 6.x with Maven, JSP+JSTL views, jQuery,
H2 database, Spring JDBC Template. Include JUnit 5 + Mockito + JaCoCo for 80% coverage.
Specify directory structure as: controller, service, repository, model, dto under src/main/java
and WEB-INF/views under src/main/webapp.
```

### Turn 1: Maven Project Setup

```
Create the Maven project with pom.xml. Include dependencies for:
spring-webmvc, spring-jdbc, h2, jstl, javax.servlet-api, junit-jupiter, mockito, jacoco-maven-plugin.
Set up the directory structure exactly as defined in DBCODE.md.
Create the Spring configuration class (AppConfig.java) with component scan, view resolver for JSP,
and DataSource bean for H2. Follow DBCODE.md conventions.
```

**Assert:** pom.xml exists, AppConfig.java exists, directory structure matches

### Turn 2: Domain Model + Repository

```
Implement the Todo domain model with fields: id (Long), title (String), description (String),
completed (boolean), createdAt (LocalDateTime). Create TodoRepository using Spring JdbcTemplate
with CRUD operations. Include schema.sql for H2 table creation. Refer to DBCODE.md for naming.
```

**Assert:** Todo.java, TodoRepository.java, schema.sql exist

### Turn 3: Service Layer

```
Implement TodoService with business logic: createTodo, getTodoById, getAllTodos,
updateTodo, toggleComplete, deleteTodo. Use constructor injection.
Follow DBCODE.md conventions for package structure.
```

**Assert:** TodoService.java exists with all methods

### Turn 4: Controller + JSP Views

```
Create TodoController with endpoints: GET / (list), GET /todos/new (form),
POST /todos (create), GET /todos/{id}/edit (edit form), POST /todos/{id} (update),
POST /todos/{id}/delete (delete), POST /todos/{id}/toggle (toggle).
Create corresponding JSP views: list.jsp, form.jsp. Use JSTL tags, no scriptlets.
Follow DBCODE.md — controller returns view name strings, not @ResponseBody.
```

**Assert:** TodoController.java, list.jsp, form.jsp exist

### Turn 5: JavaScript Interactivity

```
Add jQuery-based interactivity: AJAX toggle complete without page reload,
confirm dialog before delete, form validation on client side.
Create separate .js files under src/main/webapp/resources/js/ as specified in DBCODE.md.
Do NOT use inline JavaScript in JSP files.
```

**Assert:** todo.js exists, no inline `<script>` in JSP (except src includes)

### Turn 6: Build

```
Build the project with: mvn clean package -DskipTests
Fix any compilation errors. Make sure all dependencies resolve correctly.
```

**Assert:** BUILD SUCCESS in output

### Turn 7: Tests + Coverage

```
Write comprehensive JUnit 5 tests for TodoRepository, TodoService, and TodoController.
Use Mockito for mocking dependencies. Use MockMvc for controller tests.
Run: mvn test jacoco:report
Target: 80% line coverage. Fix any failing tests.
```

**Assert:** Tests pass, coverage >= 80%

### Turn 8: DBCODE.md Compliance

```
Review all code against DBCODE.md conventions. Verify:
1. No scriptlets in JSP
2. JavaScript in separate files
3. Correct package structure
4. Controller returns view names
Fix any violations.
```

**Assert:** Agent reads DBCODE.md, compliance verified
