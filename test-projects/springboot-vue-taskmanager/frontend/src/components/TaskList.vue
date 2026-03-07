<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <TaskCard v-for="task in filteredTasks" :key="task.id" :task="task" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useTaskStore } from '@/stores/taskStore';
import TaskCard from './TaskCard.vue';

const taskStore = useTaskStore();

const filteredTasks = computed(() => {
  // Add filtering logic here if needed
  return taskStore.tasks;
});
</script>
