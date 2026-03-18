export interface UserData {
  id: string;
  name: string;
  email: string;
}

export class UserService {
  private users: Map<string, UserData> = new Map();

  async findById(id: string): Promise<UserData | null> {
    return this.users.get(id) ?? null;
  }

  async findAll(): Promise<UserData[]> {
    return Array.from(this.users.values());
  }

  async create(data: Omit<UserData, "id">): Promise<UserData> {
    const id = crypto.randomUUID();
    const user: UserData = { id, ...data };
    this.users.set(id, user);
    return user;
  }

  async delete(id: string): Promise<boolean> {
    return this.users.delete(id);
  }
}
