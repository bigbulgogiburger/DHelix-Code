import React from 'react';
import { NavLink } from 'react-router-dom';

export const Sidebar: React.FC = () => {
  return (
    <div className="bg-gray-900 h-full w-64">
      <nav className="flex flex-col p-4">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `p-2 text-white ${isActive ? 'bg-indigo-600' : ''}`
          }
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/users"
          className={({ isActive }) =>
            `p-2 text-white ${isActive ? 'bg-indigo-600' : ''}`
          }
        >
          Users
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `p-2 text-white ${isActive ? 'bg-indigo-600' : ''}`
          }
        >
          Settings
        </NavLink>
      </nav>
    </div>
  );
};
