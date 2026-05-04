import { Pool } from 'pg';

// Use environment variable or default to local postgres
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/songs';

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Helper for single queries
export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};
