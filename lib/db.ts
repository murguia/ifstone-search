import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const connectionString = process.env.DATABASE_URL;

// Local Postgres (dev) runs without SSL; Supabase requires it. node-pg doesn't
// reliably enable SSL from an `sslmode` URL param, so set it explicitly for any
// non-local host. rejectUnauthorized:false accepts Supabase's pooler cert chain
// without bundling a CA.
const isLocal = /@?(localhost|127\.0\.0\.1)/.test(connectionString);

// Single shared pool. Locally: postgresql://localhost/ifstone
// In production: the Supabase transaction-pooler string (port 6543).
// max kept low: serverless functions each hold a pool, and the pooler caps conns.
export const pool = new Pool({
  connectionString,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
  max: isLocal ? 10 : 3,
});
