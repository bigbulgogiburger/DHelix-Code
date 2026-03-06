import React from 'react';
import { SortableTable } from '../components/SortableTable';
import { mockUsers } from '../data/mock';
import type { User } from '../types';

export const Users: React.FC = () => {
  const columns = [
    { key: 'name' as keyof User, label: 'Name' },
    { key: 'email' as keyof User, label: 'Email' },
    { key: 'role' as keyof User, label: 'Role' },
    {
      key: 'status' as keyof User,
      label: 'Status',
      renderCell: (user: User) => (
        <span
          className={`px-2 py-1 rounded-full text-white ${
            user.status === 'Active'
              ? 'bg-green-500'
              : user.status === 'Inactive'
              ? 'bg-red-500'
              : 'bg-yellow-500'
          }`}
        >
          {user.status}
        </span>
      ),
    },
  ];

  return (
    <div>
      <SortableTable columns={columns} data={mockUsers} />
    </div>
  );
};
