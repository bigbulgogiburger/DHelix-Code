import { UserService } from "./user-service.js";

export class UserController {
  constructor(private readonly userService: UserService) {}

  async getUser(id: string) {
    const user = await this.userService.findById(id);
    if (!user) throw new Error("User not found");
    return user;
  }

  async listUsers() {
    return this.userService.findAll();
  }
}
