import { Repository, Entity } from "./repository.js";

export class MemoryRepository implements Repository<Entity> {
  private items: Map<string, Entity> = new Map();

  async findAll(): Promise<Entity[]> {
    return Array.from(this.items.values());
  }

  async findById(id: string): Promise<Entity | null> {
    return this.items.get(id) ?? null;
  }

  async create(data: Omit<Entity, "id">): Promise<Entity> {
    const id = crypto.randomUUID();
    const entity: Entity = { id, ...data };
    this.items.set(id, entity);
    return entity;
  }

  async update(id: string, data: Partial<Entity>): Promise<Entity> {
    const existing = this.items.get(id);
    if (!existing) throw new Error("Not found");
    const updated: Entity = { ...existing, ...data };
    this.items.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}
