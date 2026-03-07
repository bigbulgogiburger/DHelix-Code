import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Task, CreateTaskRequest, UpdateTaskRequest } from '@/types/task';
import { getAllTasks, getTaskById, createTask, updateTask, deleteTask } from '@/services/api';

export const useTaskStore = defineStore('taskStore', () => {
  const tasks = ref<Task[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchTasks() {
    loading.value = true;
    try {
      tasks.value = await getAllTasks();
    } catch (err) {
      error.value = 'Failed to fetch tasks';
    } finally {
      loading.value = false;
    }
  }

  async function getTaskById(id: number) {
    loading.value = true;
    try {
      return await getTaskById(id);
    } catch (err) {
      error.value = 'Failed to fetch task';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function addTask(task: CreateTaskRequest) {
    try {
      const newTask = await createTask(task);
      tasks.value.push(newTask);
    } catch (err) {
      error.value = 'Failed to add task';
    }
  }

  async function editTask(id: number, task: UpdateTaskRequest) {
    try {
      const updatedTask = await updateTask(id, task);
      const index = tasks.value.findIndex(t => t.id === id);
      if (index !== -1) tasks.value[index] = updatedTask;
    } catch (err) {
      error.value = 'Failed to update task';
    }
  }

  async function removeTask(id: number) {
    try {
      await deleteTask(id);
      tasks.value = tasks.value.filter(t => t.id !== id);
    } catch (err) {
      error.value = 'Failed to delete task';
    }
  }

  return { tasks, loading, error, fetchTasks, addTask, editTask, removeTask };
});