import { UserService } from "./user-service.js";
import { createUserRoutes } from "./user-routes.js";
import { createAuthMiddleware } from "./auth-middleware.js";

export function bootstrap() {
  const { controller, userService } = createUserRoutes();
  const authMiddleware = createAuthMiddleware(userService);

  return {
    controller,
    userService,
    authMiddleware,
  };
}
