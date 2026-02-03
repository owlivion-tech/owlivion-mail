/**
 * Database Configuration - PostgreSQL
 *
 * Manages database connection pool and queries
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'owlivion_sync',
  user: process.env.DB_USER || 'owlivion',
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Handle pool errors
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Execute a query
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<object>} Query result
 */
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === 'development') {
      console.log('Executed query', { text, duration, rows: res.rowCount });
    }

    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

/**
 * Get a client from the pool for transactions
 * @returns {Promise<PoolClient>}
 */
export const getClient = async () => {
  const client = await pool.connect();

  const originalQuery = client.query;
  const originalRelease = client.release;

  // Set a timeout of 5 seconds, after which we will log this client's last query
  const timeout = setTimeout(() => {
    console.error('A client has been checked out for more than 5 seconds!');
  }, 5000);

  // Monkey-patch the query method to log queries
  client.query = (...args) => {
    return originalQuery.apply(client, args);
  };

  // Monkey-patch the release method to clear timeout
  client.release = () => {
    clearTimeout(timeout);
    // Set the methods back to their old un-monkey-patched version
    client.query = originalQuery;
    client.release = originalRelease;
    return originalRelease.apply(client);
  };

  return client;
};

/**
 * Initialize database and tables
 * @returns {Promise<boolean>}
 */
export const initDatabase = async () => {
  try {
    // Always use postgres as admin user for database initialization
    const adminUser = 'postgres';

    // First, connect to postgres database to create our database
    const adminPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: 'postgres',
      user: adminUser,
      password: process.env.DB_PASSWORD || '',
    });

    // Check if user exists (only if not using peer auth with same user)
    const targetUser = process.env.DB_USER || 'owlivion';
    if (targetUser !== adminUser) {
      const checkUserQuery = `SELECT 1 FROM pg_user WHERE usename = $1`;
      const userExists = await adminPool.query(checkUserQuery, [targetUser]);

      if (userExists.rows.length === 0) {
        console.log(`📦 Creating user: ${targetUser}`);
        await adminPool.query(`CREATE USER ${targetUser} WITH PASSWORD 'owlivion'`);
        console.log('✅ User created successfully');
      } else {
        console.log('✅ User already exists');
      }
    }

    // Check if database exists
    const dbName = process.env.DB_NAME || 'owlivion_sync_db';
    const checkDbQuery = `SELECT 1 FROM pg_database WHERE datname = $1`;
    const dbExists = await adminPool.query(checkDbQuery, [dbName]);

    if (dbExists.rows.length === 0) {
      console.log(`📦 Creating database: ${dbName}`);
      await adminPool.query(`CREATE DATABASE ${dbName} OWNER ${targetUser}`);
      console.log('✅ Database created successfully');
    } else {
      console.log('✅ Database already exists');
    }

    await adminPool.end();

    // Now create tables using our main pool
    console.log('📦 Creating tables...');

    // Read and execute schema.sql
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const schemaPath = path.join(__dirname, '../../schema.sql');

    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);

    console.log('✅ Tables created successfully');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    return false;
  }
};

/**
 * Test database connection
 * @returns {Promise<boolean>}
 */
export const testConnection = async () => {
  try {
    // Initialize database first
    await initDatabase();

    const result = await query('SELECT NOW() as now');
    console.log('✅ Database connection successful:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

/**
 * Close all database connections
 */
export const closePool = async () => {
  await pool.end();
  console.log('Database pool closed');
};

export default {
  query,
  getClient,
  testConnection,
  closePool,
};
