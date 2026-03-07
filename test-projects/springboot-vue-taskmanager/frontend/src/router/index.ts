import { createRouter, createWebHistory } from 'vue-router';
import TaskBoard from '@/views/TaskBoard.vue';
import TaskDetail from '@/views/TaskDetail.vue';

const routes = [
  {
    path: '/',
    name: 'TaskBoard',
    component: TaskBoard
  },
  {
    path: '/tasks/:id',
    name: 'TaskDetail',
    component: TaskDetail
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
