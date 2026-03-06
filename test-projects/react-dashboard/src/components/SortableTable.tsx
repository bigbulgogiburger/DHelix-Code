import React, { useState } from 'react';

export function sortData<T extends Record<string, any>>(
  data: T[],
  key: keyof T,
  direction: 'asc' | 'desc' | null
): T[] {
  if (direction === null) return data;
  return [...data].sort((a, b) => {
    const aValue = a[key];
    const bValue = b[key];
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return direction === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    return 0;
  });
}

interface Column<T> {
  key: keyof T;
  label: string;
  renderCell?: (item: T) => React.ReactNode;
}

interface SortableTableProps<T> {
  columns: Column<T>[];
  data: T[];
}

export function SortableTable<T extends Record<string, any>>({
  columns,
  data,
}: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

  const sortedData = sortKey ? sortData(data, sortKey, sortDirection) : data;

  const handleSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  return (
    <table className="min-w-full bg-white">
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={String(column.key)}
              onClick={() => handleSort(column.key)}
              className="cursor-pointer px-4 py-2 border-b"
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sortedData.map((item, index) => (
          <tr key={index} className="border-b">
            {columns.map((column) => (
              <td key={String(column.key)} className="px-4 py-2">
                {column.renderCell ? column.renderCell(item) : item[column.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
