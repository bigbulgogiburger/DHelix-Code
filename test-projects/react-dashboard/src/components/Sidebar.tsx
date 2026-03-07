import React from 'react';
import { NavLink } from 'react-router-dom';

export const Sidebar: React.FC = () => {
  return (
    <div className="bg-gray-900 h-full w-64">
      <nav className="mt-10">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `block py-2.5 px-4 rounded transition duration-200 hover:bg-indigo-500 ${
              isActive ? 'bg-indigo-600' : 'text-white'
            }`
          }
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/users"
          className={({ isActive }) =>
            `block py-2.5 px-4 rounded transition duration-200 hover:bg-indigo-500 ${
              isActive ? 'bg-indigo-600' : 'text-white'
            }`
          }
        >
          Users
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `block py-2.5 px-4 rounded transition duration-200 hover:bg-indigo-500 ${
              isActive ? 'bg-indigo-600' : 'text-white'
            }`
          }
        >
          Settings
        </NavLink>
      </nav>
    </div>
  );
};
