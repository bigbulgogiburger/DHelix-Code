<template>
  <div class="p-4">
    <h2 class="text-2xl font-bold mb-4">Task Details</h2>
    <div v-if="task">
      <h3 class="text-lg font-bold">{{ task.title }}</h3>
      <p>{{ task.description }}</p>
      <p>Status: {{ task.status }}</p>
      <p>Priority: {{ task.priority }}</p>
      <p>Due Date: {{ task.dueDate || 'N/A' }}</p>
      <div class="flex space-x-2 mt-4">
        <button class="btn-edit" @click="editTask">Edit</button>
        <button class="btn-delete" @click="deleteTask">Delete</button>
      </div>
    </div>
    <div v-else>
      <p>Loading...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTaskStore } from '@/stores/taskStore';

const route = useRoute();
const router = useRouter();
const taskStore = useTaskStore();
const task = ref(null);

onMounted(async () => {
  const taskId = Number(route.params.id);
  task.value = await taskStore.getTaskById(taskId);
});

function editTask() {
  // Logic to open edit form
}

function deleteTask() {
  if (task.value) {
    taskStore.removeTask(task.value.id);
    router.push('/');
  }
}
</script>

<style>
.btn-edit {
  @apply bg-blue-500 text-white px-3 py-1 rounded;
}

.btn-delete {
  @apply bg-red-500 text-white px-3 py-1 rounded;
}
</style>
