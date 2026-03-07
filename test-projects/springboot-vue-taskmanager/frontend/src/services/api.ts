import { Task, CreateTaskRequest, UpdateTaskRequest } from '@/types/task';

const API_URL = '/api/v1/tasks';

export async function getAllTasks(): Promise<Task[]> {
  const response = await fetch(API_URL);
  return response.json();
}

export async function getTaskById(id: number): Promise<Task> {
  const response = await fetch(`${API_URL}/${id}`);
  return response.json();
}

export async function createTask(task: CreateTaskRequest): Promise<Task> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(task),
  });
  return response.json();
}

export async function updateTask(id: number, task: UpdateTaskRequest): Promise<Task> {
  const response = await fetch(`${API_URL}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(task),
  });
  return response.json();
}

export async function deleteTask(id: number): Promise<void> {
  await fetch(`${API_URL}/${id}`, {
    method: 'DELETE',
  });
}