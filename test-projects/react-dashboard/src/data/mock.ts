import type { StatData, User } from '../types';

export const dashboardStats: StatData[] = [
  { label: 'Total Users', value: 12345, change: 12.5, icon: '👥' },
  { label: 'Active Sessions', value: 1234, change: -3.2, icon: '📊' },
  { label: 'Revenue', value: '$45678', change: 8.1, icon: '💰' },
  { label: 'Conversion', value: '3.24%', change: 1.2, icon: '🔄' },
];

export const mockUsers: User[] = [
  { name: 'Alice Johnson', email: 'alice@example.com', role: 'Admin', status: 'Active' },
  { name: 'Bob Smith', email: 'bob@example.com', role: 'User', status: 'Inactive' },
  { name: 'Charlie Brown', email: 'charlie@example.com', role: 'User', status: 'Active' },
  { name: 'David Wilson', email: 'david@example.com', role: 'Manager', status: 'Active' },
  { name: 'Eve Davis', email: 'eve@example.com', role: 'User', status: 'Pending' },
];
