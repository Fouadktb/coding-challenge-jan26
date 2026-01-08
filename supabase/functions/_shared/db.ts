// SurrealDB connection utility for Deno edge functions
import Surreal from "npm:surrealdb@1.3.2";

// SurrealDB configuration from environment variables
const SURREALDB_URL = Deno.env.get("SURREALDB_URL") || "ws://127.0.0.1:8000/rpc";
const SURREALDB_NAMESPACE = Deno.env.get("SURREALDB_NAMESPACE") || "matchmaking";
const SURREALDB_DATABASE = Deno.env.get("SURREALDB_DATABASE") || "fruits";
const SURREALDB_USER = Deno.env.get("SURREALDB_USER") || "root";
const SURREALDB_PASSWORD = Deno.env.get("SURREALDB_PASSWORD") || "root";

/**
 * Connect to SurrealDB and return the database instance
 * Handles authentication and namespace/database selection
 */
export async function connectToSurrealDB(): Promise<Surreal> {
  try {
    const db = new Surreal();

    // Connect to SurrealDB
    await db.connect(SURREALDB_URL);

    // Authenticate
    await db.signin({
      username: SURREALDB_USER,
      password: SURREALDB_PASSWORD,
    });

    // Select namespace and database
    await db.use({
      namespace: SURREALDB_NAMESPACE,
      database: SURREALDB_DATABASE,
    });

    console.log(`Connected to SurrealDB: ${SURREALDB_NAMESPACE}/${SURREALDB_DATABASE}`);

    return db;
  } catch (error) {
    console.error("Failed to connect to SurrealDB:", error);
    throw new Error(`SurrealDB connection failed: ${error.message}`);
  }
}

/**
 * Query helper that connects, executes query, and returns results
 * Automatically handles connection cleanup
 */
export async function query<T = unknown>(
  sql: string,
  vars?: Record<string, unknown>
): Promise<T[]> {
  const db = await connectToSurrealDB();

  try {
    const results = await db.query<T[][]>(sql, vars);

    // SurrealDB returns array of arrays (one per query)
    // For single queries, we return the first result set
    return results[0] || [];
  } catch (error) {
    console.error("Query execution failed:", error);
    throw new Error(`Query failed: ${error.message}`);
  } finally {
    await db.close();
  }
}

/**
 * Insert a single record into a table
 */
export async function insertOne<T = unknown>(
  table: string,
  data: Record<string, unknown>
): Promise<T> {
  const db = await connectToSurrealDB();

  try {
    const result = await db.create<T>(table, data);
    return result;
  } catch (error) {
    console.error(`Failed to insert into ${table}:`, error);
    throw new Error(`Insert failed: ${error.message}`);
  } finally {
    await db.close();
  }
}

/**
 * Insert multiple records into a table
 */
export async function insertMany<T = unknown>(
  table: string,
  data: Record<string, unknown>[]
): Promise<T[]> {
  const db = await connectToSurrealDB();

  try {
    const results: T[] = [];

    for (const item of data) {
      const result = await db.create<T>(table, item);
      results.push(result);
    }

    return results;
  } catch (error) {
    console.error(`Failed to insert multiple records into ${table}:`, error);
    throw new Error(`Batch insert failed: ${error.message}`);
  } finally {
    await db.close();
  }
}

/**
 * Select records from a table with optional filtering
 */
export async function select<T = unknown>(
  table: string,
  filter?: string
): Promise<T[]> {
  const db = await connectToSurrealDB();

  try {
    if (filter) {
      return await db.query<T[][]>(`SELECT * FROM ${table} WHERE ${filter}`).then(r => r[0] || []);
    }
    return await db.select<T>(table);
  } catch (error) {
    console.error(`Failed to select from ${table}:`, error);
    throw new Error(`Select failed: ${error.message}`);
  } finally {
    await db.close();
  }
}

/**
 * Update a specific record by ID
 */
export async function updateOne<T = unknown>(
  recordId: string,
  data: Record<string, unknown>
): Promise<T> {
  const db = await connectToSurrealDB();

  try {
    const result = await db.merge<T>(recordId, data);
    return result;
  } catch (error) {
    console.error(`Failed to update ${recordId}:`, error);
    throw new Error(`Update failed: ${error.message}`);
  } finally {
    await db.close();
  }
}

/**
 * Delete a specific record by ID
 */
export async function deleteOne(recordId: string): Promise<void> {
  const db = await connectToSurrealDB();

  try {
    await db.delete(recordId);
  } catch (error) {
    console.error(`Failed to delete ${recordId}:`, error);
    throw new Error(`Delete failed: ${error.message}`);
  } finally {
    await db.close();
  }
}

/**
 * Initialize the database schema
 * Loads the schema file and executes all DEFINE statements
 */
export async function initializeSchema(schemaPath: string): Promise<void> {
  const db = await connectToSurrealDB();

  try {
    const schemaSQL = await Deno.readTextFile(schemaPath);
    await db.query(schemaSQL);
    console.log("Schema initialized successfully");
  } catch (error) {
    console.error("Failed to initialize schema:", error);
    throw new Error(`Schema initialization failed: ${error.message}`);
  } finally {
    await db.close();
  }
}
