<template>
  <div class="p-4 bg-white shadow rounded-lg">
    <div class="flex justify-between items-center">
      <h3 class="text-lg font-bold">{{ task.title }}</h3>
      <span :class="statusClass">{{ task.status }}</span>
    </div>
    <p class="text-sm text-gray-600">{{ task.description }}</p>
    <div class="flex justify-between items-center mt-2">
      <span class="text-xs text-gray-500">Due: {{ task.dueDate || 'N/A' }}</span>
      <span :class="priorityClass">{{ task.priority }}</span>
    </div>
    <div class="flex space-x-2 mt-4">
      <button class="btn-edit">Edit</button>
      <button class="btn-delete">Delete</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Task } from '@/types/task';

const props = defineProps<{ task: Task }>();

const statusClass = computed(() => {
  switch (props.task.status) {
    case 'TODO':
      return 'bg-blue-100 text-blue-800';
    case 'IN_PROGRESS':
      return 'bg-yellow-100 text-yellow-800';
    case 'DONE':
      return 'bg-green-100 text-green-800';
  }
});

const priorityClass = computed(() => {
  switch (props.task.priority) {
    case 'LOW':
      return 'text-green-500';
    case 'MEDIUM':
      return 'text-yellow-500';
    case 'HIGH':
      return 'text-red-500';
  }
});
</script>

<style>
.btn-edit {
  @apply bg-blue-500 text-white px-3 py-1 rounded;
}

.btn-delete {
  @apply bg-red-500 text-white px-3 py-1 rounded;
}
</style>
