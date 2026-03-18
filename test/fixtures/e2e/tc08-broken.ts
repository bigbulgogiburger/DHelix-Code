/**
 * TC-08: Error Message Analysis fixture
 *
 * This file intentionally contains exactly 3 TypeScript type errors.
 * It is used to verify that the AI can read the file, identify the errors,
 * and explain why it does not compile.
 *
 * DO NOT FIX — the errors ARE the test.
 */

interface User {
  name: string;
  age: number;
  email: string;
}

// Error 1: Type mismatch — string assigned to number
const user: User = {
  name: "Alice",
  age: "twenty-five",
  email: "alice@example.com",
};

// Error 2: Missing required property 'email'
const admin: User = {
  name: "Bob",
  age: 30,
};

// Error 3: Function return type mismatch — returns string but declared as number
function getUserAge(u: User): number {
  return `Age: ${u.age}`;
}

export { user, admin, getUserAge };
