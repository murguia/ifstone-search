import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

// Single shared pool. Locally: postgresql://localhost/ifstone
// In production: the Supabase connection string.
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
