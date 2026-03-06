import React, { useState } from 'react';

export const Settings: React.FC = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(false);

  const handleSaveChanges = () => {
    // Handle save changes logic
    console.log('Settings saved:', { darkMode, emailNotifications, pushNotifications });
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Settings</h2>
      <div className="mb-4">
        <label className="flex items-center">
          <span className="mr-2">Dark Mode</span>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`w-10 h-6 flex items-center bg-gray-300 rounded-full p-1 cursor-pointer ${darkMode ? 'bg-indigo-600' : ''}`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform ${darkMode ? 'translate-x-4' : ''}`}
            />
          </button>
        </label>
      </div>
      <div className="mb-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={emailNotifications}
            onChange={() => setEmailNotifications(!emailNotifications)}
            className="mr-2"
          />
          Email Notifications
        </label>
      </div>
      <div className="mb-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={pushNotifications}
            onChange={() => setPushNotifications(!pushNotifications)}
            className="mr-2"
          />
          Push Notifications
        </label>
      </div>
      <button
        onClick={handleSaveChanges}
        className="bg-indigo-600 text-white px-4 py-2 rounded"
      >
        Save Changes
      </button>
    </div>
  );
};
