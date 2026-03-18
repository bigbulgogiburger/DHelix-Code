import { Repository, Entity } from "./repository.js";

export class ApiRepository implements Repository<Entity> {
  constructor(private readonly baseUrl: string) {}

  async findAll(): Promise<Entity[]> {
    return [];
  }

  async findById(id: string): Promise<Entity | null> {
    return null;
  }

  async create(data: Omit<Entity, "id">): Promise<Entity> {
    const id = crypto.randomUUID();
    return { id, ...data };
  }

  async update(id: string, data: Partial<Entity>): Promise<Entity> {
    const existing = await this.findById(id);
    if (!existing) throw new Error("Not found");
    return { ...existing, ...data };
  }

  async delete(id: string): Promise<void> {
    // no-op for stub
  }
}
