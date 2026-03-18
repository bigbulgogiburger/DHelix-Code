// Vulnerability 1: Hardcoded secret
const API_KEY = "sk-proj-abc123def456ghi789";
const DB_PASSWORD = "admin123!";

// Vulnerability 2: SQL injection
export function findUser(username: string): string {
  const query = `SELECT * FROM users WHERE name = '${username}'`;
  return query;
}

// Vulnerability 3: No input validation
export function processInput(data: any): any {
  const result = eval(data.expression);
  return { result, raw: data };
}

export function connectDB(): string {
  return `postgresql://admin:${DB_PASSWORD}@localhost:5432/mydb`;
}
