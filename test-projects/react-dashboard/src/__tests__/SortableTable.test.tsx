import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { sortData, SortableTable } from '../components/SortableTable';

// Mock data for testing
const mockData = [
  { name: 'Alice', email: 'alice@example.com', role: 'Admin', status: 'Active' },
  { name: 'Bob', email: 'bob@example.com', role: 'User', status: 'Inactive' },
  { name: 'Charlie', email: 'charlie@example.com', role: 'User', status: 'Active' },
];

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role' },
  { key: 'status', label: 'Status' },
];

// Tests for sortData function
describe('sortData', () => {
  it('returns a copy of the array when direction is null', () => {
    const result = sortData(mockData, 'name', null);
    expect(result).toEqual(mockData);
  });

  it('sorts the array in ascending order by a string key', () => {
    const result = sortData(mockData, 'name', 'asc');
    expect(result[0].name).toBe('Alice');
    expect(result[1].name).toBe('Bob');
    expect(result[2].name).toBe('Charlie');
  });

  it('sorts the array in descending order by a string key', () => {
    const result = sortData(mockData, 'name', 'desc');
    expect(result[0].name).toBe('Charlie');
    expect(result[1].name).toBe('Bob');
    expect(result[2].name).toBe('Alice');
  });

  it('returns the array unsorted when direction is null', () => {
    const result = sortData(mockData, 'name', null);
    expect(result).toEqual(mockData);
  });
});

// Tests for SortableTable component
describe('SortableTable', () => {
  it('renders all rows', () => {
    render(<SortableTable columns={columns} data={mockData} />);
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(mockData.length + 1); // +1 for header row
  });

  it('renders column headers', () => {
    render(<SortableTable columns={columns} data={mockData} />);
    columns.forEach(column => {
      expect(screen.getByText(column.label)).toBeInTheDocument();
    });
  });

  it('sorts data on header click', () => {
    render(<SortableTable columns={columns} data={mockData} />);
    const nameHeader = screen.getByText('Name');
    fireEvent.click(nameHeader);
    let rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Alice');
    fireEvent.click(nameHeader);
    rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Charlie');
  });
});