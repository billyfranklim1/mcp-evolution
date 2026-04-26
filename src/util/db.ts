import { Pool } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool | null {
  if (pool) return pool;
  const url = process.env.EVOLUTION_DB_URL;
  if (!url) return null;
  pool = new Pool({
    connectionString: url,
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  pool.on("error", (err) => {
    console.error("[mcp-evolution] pg pool error:", err.message);
  });
  return pool;
}

export function isDbConfigured(): boolean {
  return Boolean(process.env.EVOLUTION_DB_URL);
}
