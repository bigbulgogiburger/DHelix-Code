<template>
  <div class="p-4">
    <TaskFilter />
    <TaskList />
    <TaskForm />
  </div>
</template>

<script setup lang="ts">
import TaskFilter from '@/components/TaskFilter.vue';
import TaskList from '@/components/TaskList.vue';
import TaskForm from '@/components/TaskForm.vue';
</script>
