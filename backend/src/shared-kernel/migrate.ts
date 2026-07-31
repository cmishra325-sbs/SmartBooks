import fs from "fs";
import path from "path";
import { query } from "./database";

/**
 * Scans database/init-scripts/ directory, matches files that have
 * not run yet against public.schema_migrations table, and runs them.
 */
export async function runMigration(): Promise<boolean> {
  try {
    console.log("[Migration] Initializing migration manager...");

    // 1. Create public.schema_migrations table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        filename    VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
      );
    `);

    // 2. Read all SQL files in the migration directory
    const migrationsDir = path.join(__dirname, "../../../database/init-scripts");
    
    if (!fs.existsSync(migrationsDir)) {
      console.error(`[Migration Error] Migration folder not found at: ${migrationsDir}`);
      return false;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith(".sql"))
      .sort(); // Sort alphabetically (01-..., 02-...)

    // 3. Fetch list of already executed migrations
    const executedRows = await query("SELECT filename FROM public.schema_migrations;");
    const executedFiles = new Set(executedRows.map(row => row.filename));

    // 4. Run pending migrations in order
    for (const file of files) {
      if (executedFiles.has(file)) {
        console.log(`[Migration] Script '${file}' already executed. Skipping.`);
        continue;
      }

      console.log(`[Migration] Running script: '${file}'...`);
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, "utf8");

      // Execute SQL content
      await query(sqlContent);

      // Record migration execution in history
      await query(
        "INSERT INTO public.schema_migrations (filename) VALUES ($1);",
        [file]
      );
      
      console.log(`🟢 [Migration] Script '${file}' completed successfully.`);
    }

    console.log("🟢 [Migration] Database is fully up-to-date!");
    return true;
  } catch (error: any) {
    console.error("🔴 [Migration] Migration process encountered a critical error!");
    console.error(`[Migration Error] Details: ${error.message}`);
    return false;
  }
}
