<template>
  <div class="flex space-x-4 mb-4">
    <select v-model="selectedStatus" class="p-2 border rounded">
      <option value="">All Statuses</option>
      <option value="TODO">TODO</option>
      <option value="IN_PROGRESS">In Progress</option>
      <option value="DONE">Done</option>
    </select>
    <select v-model="selectedPriority" class="p-2 border rounded">
      <option value="">All Priorities</option>
      <option value="LOW">Low</option>
      <option value="MEDIUM">Medium</option>
      <option value="HIGH">High</option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const selectedStatus = ref('');
const selectedPriority = ref('');
</script>
