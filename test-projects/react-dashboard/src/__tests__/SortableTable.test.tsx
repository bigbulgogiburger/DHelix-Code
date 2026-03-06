import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { sortData, SortableTable } from '../components/SortableTable';

interface TestData {
  name: string;
  value: string;
}

const testData: TestData[] = [
  { name: 'Charlie', value: '3' },
  { name: 'Alice', value: '1' },
  { name: 'Bob', value: '2' },
];

describe('sortData', () => {
  it('returns a copy of the data when direction is null', () => {
    const result = sortData(testData, 'name', null);
    expect(result).toEqual(testData);
  });

  it('sorts data in ascending order by string key', () => {
    const result = sortData(testData, 'name', 'asc');
    expect(result).toEqual([
      { name: 'Alice', value: '1' },
      { name: 'Bob', value: '2' },
      { name: 'Charlie', value: '3' },
    ]);
  });

  it('sorts data in descending order by string key', () => {
    const result = sortData(testData, 'name', 'desc');
    expect(result).toEqual([
      { name: 'Charlie', value: '3' },
      { name: 'Bob', value: '2' },
      { name: 'Alice', value: '1' },
    ]);
  });

  it('returns unsorted data when direction is null', () => {
    const result = sortData(testData, 'name', null);
    expect(result).toEqual(testData);
  });
});

describe('SortableTable', () => {
  const columns = [
    { key: 'name' as keyof TestData, label: 'Name' },
    { key: 'value' as keyof TestData, label: 'Value' },
  ];

  it('renders all rows', () => {
    render(<SortableTable columns={columns} data={testData} />);
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(testData.length + 1); // +1 for header row
  });

  it('renders column headers', () => {
    render(<SortableTable columns={columns} data={testData} />);
    columns.forEach((column) => {
      expect(screen.getByText(column.label)).toBeInTheDocument();
    });
  });

  it('sorts data on header click', () => {
    render(<SortableTable columns={columns} data={testData} />);
    const nameHeader = screen.getByText('Name');

    // Initial click to sort ascending
    fireEvent.click(nameHeader);
    let rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Alice');
    expect(rows[2]).toHaveTextContent('Bob');
    expect(rows[3]).toHaveTextContent('Charlie');

    // Second click to sort descending
    fireEvent.click(nameHeader);
    rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Charlie');
    expect(rows[2]).toHaveTextContent('Bob');
    expect(rows[3]).toHaveTextContent('Alice');
  });
});
