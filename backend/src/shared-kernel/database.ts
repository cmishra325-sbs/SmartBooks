import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

// Initialize the database connection pool using variables from the .env file
export const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Utility to run a query against the PostgreSQL pool.
 * Encapsulates error logs and correlation tracing.
 */
export async function query(text: string, params?: any[]): Promise<any[]> {
  try {
    const start = Date.now();
    const res = await dbPool.query(text, params);
    const duration = Date.now() - start;
    
    // Log query execution performance in development
    if (process.env.NODE_ENV === "development") {
      console.log(`[Database Query] Executed: ${text.substring(0, 80)}... | Duration: ${duration}ms | Rows: ${res.rowCount}`);
    }
    
    return res.rows;
  } catch (error: any) {
    console.error(`[Database Error] Query failed: ${text}`);
    console.error(`[Database Error] Details: ${error.message}`);
    throw error;
  }
}

/**
 * Verify database connectivity.
 */
export async function testConnection(): Promise<boolean> {
  try {
    // Run a simple query to get the current database timestamp
    await query("SELECT NOW();");
    return true;
  } catch (error) {
    return false;
  }
}
