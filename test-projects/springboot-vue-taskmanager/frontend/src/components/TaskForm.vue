<template>
  <div class="fixed inset-0 bg-gray-800 bg-opacity-50 flex justify-center items-center">
    <div class="bg-white p-6 rounded-lg shadow-lg">
      <h2 class="text-xl font-bold mb-4">{{ isEdit ? 'Edit Task' : 'New Task' }}</h2>
      <form @submit.prevent="handleSubmit">
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700">Title</label>
          <input v-model="form.title" type="text" class="mt-1 block w-full" required maxlength="100" />
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700">Description</label>
          <textarea v-model="form.description" class="mt-1 block w-full" maxlength="500"></textarea>
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700">Status</label>
          <select v-model="form.status" class="mt-1 block w-full">
            <option value="TODO">TODO</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DONE">Done</option>
          </select>
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700">Priority</label>
          <select v-model="form.priority" class="mt-1 block w-full">
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700">Due Date</label>
          <input v-model="form.dueDate" type="date" class="mt-1 block w-full" />
        </div>
        <div class="flex justify-end">
          <button type="submit" class="bg-blue-500 text-white px-4 py-2 rounded">{{ isEdit ? 'Update' : 'Create' }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Task, CreateTaskRequest, UpdateTaskRequest } from '@/types/task';
import { useTaskStore } from '@/stores/taskStore';

const props = defineProps<{ task?: Task }>();
const isEdit = ref(!!props.task);
const taskStore = useTaskStore();

const form = ref<CreateTaskRequest | UpdateTaskRequest>({
  title: props.task?.title || '',
  description: props.task?.description || '',
  status: props.task?.status || 'TODO',
  priority: props.task?.priority || 'MEDIUM',
  dueDate: props.task?.dueDate || ''
});

function handleSubmit() {
  if (isEdit.value && props.task) {
    taskStore.editTask(props.task.id, form.value as UpdateTaskRequest);
  } else {
    taskStore.addTask(form.value as CreateTaskRequest);
  }
}
</script>
