import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  change: number;
  icon: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, change, icon }) => {
  const changeColor = change >= 0 ? 'text-green-500' : 'text-red-500';
  const changeSign = change >= 0 ? '+' : '';

  return (
    <div className="bg-white shadow-md rounded-lg p-4 flex items-center">
      <div className="text-3xl mr-4">{icon}</div>
      <div>
        <div className="text-xl font-bold">{value}</div>
        <div className={`text-sm ${changeColor}`}>{changeSign}{change}%</div>
        <div className="text-gray-500">{label}</div>
      </div>
    </div>
  );
};
