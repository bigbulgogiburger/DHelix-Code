import { UserService } from "./user-service.js";

export function createAuthMiddleware(userService: UserService) {
  return async (userId: string): Promise<boolean> => {
    const user = await userService.findById(userId);
    return user !== null;
  };
}
