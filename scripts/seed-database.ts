#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

// Seed script to load raw fruit data into SurrealDB
// Usage: deno run --allow-net --allow-read --allow-env scripts/seed-database.ts

import Surreal from "npm:surrealdb@1.3.2";
import { join, dirname } from "https://deno.land/std@0.208.0/path/mod.ts";

// SurrealDB configuration
const SURREALDB_URL = Deno.env.get("SURREALDB_URL") || "ws://127.0.0.1:8000/rpc";
const SURREALDB_NAMESPACE = Deno.env.get("SURREALDB_NAMESPACE") || "matchmaking";
const SURREALDB_DATABASE = Deno.env.get("SURREALDB_DATABASE") || "fruits";
const SURREALDB_USER = Deno.env.get("SURREALDB_USER") || "root";
const SURREALDB_PASSWORD = Deno.env.get("SURREALDB_PASSWORD") || "root";

interface FruitAttributes {
  size: number | null;
  weight: number | null;
  hasStem: boolean | null;
  hasLeaf: boolean | null;
  hasWorm: boolean | null;
  shineFactor: "dull" | "neutral" | "shiny" | "extraShiny" | null;
  hasChemicals: boolean | null;
}

interface FruitPreferences {
  size?: {
    min?: number;
    max?: number;
  };
  weight?: {
    min?: number;
    max?: number;
  };
  hasStem?: boolean;
  hasLeaf?: boolean;
  hasWorm?: boolean;
  shineFactor?: string | string[];
  hasChemicals?: boolean;
}

interface RawFruit {
  type: "apple" | "orange";
  attributes: FruitAttributes;
  preferences: FruitPreferences;
}

async function connectToSurrealDB(): Promise<Surreal> {
  const db = new Surreal();

  try {
    await db.connect(SURREALDB_URL);
    await db.signin({
      username: SURREALDB_USER,
      password: SURREALDB_PASSWORD,
    });
    await db.use({
      namespace: SURREALDB_NAMESPACE,
      database: SURREALDB_DATABASE,
    });

    console.log(`✓ Connected to SurrealDB: ${SURREALDB_NAMESPACE}/${SURREALDB_DATABASE}`);
    return db;
  } catch (error) {
    console.error("✗ Failed to connect to SurrealDB:", error);
    throw error;
  }
}

async function initializeSchema(db: Surreal, force = false): Promise<void> {
  try {
    const scriptDir = dirname(new URL(import.meta.url).pathname);
    const schemaPath = join(scriptDir, "../supabase/functions/_shared/surrealdb-schema.surql");

    console.log(`\nLoading schema from: ${schemaPath}`);

    if (force) {
      // Clear existing data
      console.log("Clearing existing data...");
      await db.query("DELETE fruits; DELETE matches; DELETE conversations;");
      await db.query("REMOVE TABLE IF EXISTS fruits; REMOVE TABLE IF EXISTS matches; REMOVE TABLE IF EXISTS conversations;");
    }

    const schemaSQL = await Deno.readTextFile(schemaPath);
    await db.query(schemaSQL);

    console.log("✓ Schema initialized successfully\n");
  } catch (error) {
    if (error.message && error.message.includes("already exists")) {
      console.log("⚠ Schema already exists, clearing data only...\n");
      await db.query("DELETE fruits; DELETE matches; DELETE conversations;");
    } else {
      console.error("✗ Failed to initialize schema:", error);
      throw error;
    }
  }
}

// Convert null values to undefined for SurrealDB option<T> types
function convertNullToUndefined(obj: any): any {
  if (obj === null) return undefined;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(convertNullToUndefined);

  const result: any = {};
  for (const key in obj) {
    result[key] = convertNullToUndefined(obj[key]);
  }
  return result;
}

async function loadSeedData(db: Surreal): Promise<void> {
  try {
    const scriptDir = dirname(new URL(import.meta.url).pathname);
    const dataPath = join(scriptDir, "../data/raw_apples_and_oranges.json");

    console.log(`Loading seed data from: ${dataPath}`);

    const rawData = await Deno.readTextFile(dataPath);
    const fruits: RawFruit[] = JSON.parse(rawData);

    console.log(`Found ${fruits.length} fruits to import\n`);

    let appleCount = 0;
    let orangeCount = 0;

    for (const fruit of fruits) {
      try {
        // Convert null to undefined for SurrealDB compatibility
        const fruitData = convertNullToUndefined({
          type: fruit.type,
          attributes: fruit.attributes,
          preferences: fruit.preferences,
        });

        await db.create("fruits", fruitData);

        if (fruit.type === "apple") {
          appleCount++;
        } else {
          orangeCount++;
        }

        process.stdout.write(`\r  Imported: ${appleCount} apples, ${orangeCount} oranges`);
      } catch (error) {
        console.error(`\n✗ Failed to insert fruit:`, error);
      }
    }

    console.log(`\n\n✓ Successfully imported ${appleCount} apples and ${orangeCount} oranges`);
  } catch (error) {
    console.error("✗ Failed to load seed data:", error);
    throw error;
  }
}

async function verifyData(db: Surreal): Promise<void> {
  try {
    console.log("\nVerifying imported data...");

    const [apples] = await db.query<[{ count: number }[]]>(
      'SELECT count() as count FROM fruits WHERE type = "apple" GROUP ALL'
    );

    const [oranges] = await db.query<[{ count: number }[]]>(
      'SELECT count() as count FROM fruits WHERE type = "orange" GROUP ALL'
    );

    const appleCount = apples[0]?.count || 0;
    const orangeCount = oranges[0]?.count || 0;

    console.log(`  - Apples in DB: ${appleCount}`);
    console.log(`  - Oranges in DB: ${orangeCount}`);
    console.log(`  - Total fruits: ${appleCount + orangeCount}`);

    if (appleCount > 0 && orangeCount > 0) {
      console.log("\n✓ Data verification passed!\n");
    } else {
      console.log("\n✗ Data verification failed - missing fruits\n");
    }
  } catch (error) {
    console.error("✗ Failed to verify data:", error);
  }
}

// Main execution
async function main() {
  console.log("\n===========================================");
  console.log("Apples & Oranges - Database Seeding");
  console.log("===========================================\n");

  let db: Surreal | null = null;

  try {
    // Connect to SurrealDB
    db = await connectToSurrealDB();

    // Initialize schema
    await initializeSchema(db);

    // Load seed data
    await loadSeedData(db);

    // Verify data was loaded correctly
    await verifyData(db);

    console.log("===========================================");
    console.log("Seeding complete!");
    console.log("===========================================\n");
  } catch (error) {
    console.error("\n✗ Seeding failed:", error);
    Deno.exit(1);
  } finally {
    if (db) {
      await db.close();
    }
  }
}

// Run the main function
if (import.meta.main) {
  main();
}
