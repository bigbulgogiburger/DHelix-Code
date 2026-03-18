import { UserService } from "./user-service.js";
import { UserController } from "./user-controller.js";

export function createUserRoutes() {
  const userService = new UserService();
  const controller = new UserController(userService);
  return { controller, userService };
}
