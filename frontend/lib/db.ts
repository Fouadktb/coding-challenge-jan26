// SurrealDB client for Next.js server-side operations
// This is only used in server components and API routes
import Surreal from "surrealdb";

// SurrealDB configuration from environment variables
const SURREALDB_URL = process.env.SURREALDB_URL || "ws://127.0.0.1:8000/rpc";
const SURREALDB_NAMESPACE = process.env.SURREALDB_NAMESPACE || "matchmaking";
const SURREALDB_DATABASE = process.env.SURREALDB_DATABASE || "fruits";
const SURREALDB_USER = process.env.SURREALDB_USER || "root";
const SURREALDB_PASSWORD = process.env.SURREALDB_PASSWORD || "root";

/**
 * Connect to SurrealDB from Next.js server
 * NOTE: This should only be used in server components or API routes
 */
export async function connectToSurrealDB(): Promise<Surreal> {
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

    return db;
  } catch (error) {
    console.error("Failed to connect to SurrealDB:", error);
    throw new Error(`SurrealDB connection failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Query helper for Next.js
 */
export async function query<T = unknown>(
  sql: string,
  vars?: Record<string, unknown>
): Promise<T[]> {
  const db = await connectToSurrealDB();

  try {
    const results = await db.query<T[][]>(sql, vars);
    return results[0] || [];
  } catch (error) {
    console.error("Query execution failed:", error);
    throw error;
  } finally {
    await db.close();
  }
}

/**
 * Get dashboard metrics from SurrealDB
 */
export async function getDashboardMetrics() {
  const db = await connectToSurrealDB();

  try {
    // Get total apples
    const [applesResult] = await db.query<[{ count: number }[]]>(
      'SELECT count() as count FROM fruits WHERE type = "apple" GROUP ALL'
    );
    const totalApples = applesResult[0]?.count || 0;

    // Get total oranges
    const [orangesResult] = await db.query<[{ count: number }[]]>(
      'SELECT count() as count FROM fruits WHERE type = "orange" GROUP ALL'
    );
    const totalOranges = orangesResult[0]?.count || 0;

    // Get match statistics
    const [matchStatsResult] = await db.query<[Array<{
      total_matches: number;
      avg_score: number;
      best_score: number;
      worst_score: number;
    }>]>(`
      SELECT
        count() as total_matches,
        math::mean(mutual_score) as avg_score,
        math::max(mutual_score) as best_score,
        math::min(mutual_score) as worst_score
      FROM matches
      GROUP ALL
    `);

    const matchStats = matchStatsResult[0] || {
      total_matches: 0,
      avg_score: 0,
      best_score: 0,
      worst_score: 0,
    };

    // Get success rate (matches > 60%)
    const [successResult] = await db.query<[{ high_quality_matches: number }[]]>(`
      SELECT
        count() as high_quality_matches
      FROM matches
      WHERE mutual_score >= 60
      GROUP ALL
    `);

    const highQualityMatches = successResult[0]?.high_quality_matches || 0;
    const successRate = matchStats.total_matches > 0
      ? (highQualityMatches / matchStats.total_matches) * 100
      : 0;

    // Get score distribution
    const [scoreDistResult] = await db.query<[Array<{ bucket: number; count: number }>]>(`
      SELECT
        math::floor(mutual_score / 20) * 20 as bucket,
        count() as count
      FROM matches
      GROUP BY bucket
      ORDER BY bucket ASC
    `);

    return {
      totalApples,
      totalOranges,
      totalMatches: matchStats.total_matches,
      avgCompatibility: Math.round(matchStats.avg_score * 10) / 10,
      successRate: Math.round(successRate * 10) / 10,
      bestScore: Math.round(matchStats.best_score * 10) / 10,
      scoreDistribution: scoreDistResult || [],
    };
  } catch (error) {
    console.error("Failed to get dashboard metrics:", error);
    // Return zeros on error
    return {
      totalApples: 0,
      totalOranges: 0,
      totalMatches: 0,
      avgCompatibility: 0,
      successRate: 0,
      bestScore: 0,
      scoreDistribution: [],
    };
  } finally {
    await db.close();
  }
}

/**
 * Get recent matches
 */
export async function getRecentMatches(limit = 10) {
  const db = await connectToSurrealDB();

  try {
    const [matches] = await db.query<[Array<{
      id: string;
      apple_id: string;
      orange_id: string;
      mutual_score: number;
      created_at: string;
    }>]>(`
      SELECT
        id,
        apple_id,
        orange_id,
        mutual_score,
        created_at
      FROM matches
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);

    return matches || [];
  } catch (error) {
    console.error("Failed to get recent matches:", error);
    return [];
  } finally {
    await db.close();
  }
}

/**
 * Get all conversations with their messages
 */
export async function getConversations() {
  const db = await connectToSurrealDB();

  try {
    const [conversations] = await db.query<[Array<any>]>(`
      SELECT * FROM conversations
      ORDER BY created_at DESC
    `);

    if (!conversations || conversations.length === 0) {
      return [];
    }

    // Fetch messages for each conversation
    const conversationsWithMessages = await Promise.all(
      conversations.map(async (conv) => {
        const convIdString = typeof conv.id === 'string' ? conv.id : conv.id.toString();
        const idPart = convIdString.replace('conversations:', '');

        const [messages] = await db.query<[Array<any>]>(
          `SELECT role, content, created_at
           FROM messages
           WHERE conversation_id = type::thing($table, $id)
           ORDER BY created_at ASC`,
          { table: 'conversations', id: idPart }
        );

        return {
          ...conv,
          messages: messages || [],
        };
      })
    );

    return conversationsWithMessages;
  } catch (error) {
    console.error("Failed to get conversations:", error);
    return [];
  } finally {
    await db.close();
  }
}

/**
 * Get a single conversation by ID with messages
 */
export async function getConversationById(id: string) {
  const db = await connectToSurrealDB();

  try {
    const [conversations] = await db.query<[Array<any>]>(
      `SELECT * FROM ${id}`
    );

    if (!conversations || conversations.length === 0) {
      return null;
    }

    const conversation = conversations[0];

    // Fetch messages for this conversation
    // Use type::thing() to convert string to record ID for comparison
    const [messages] = await db.query<[Array<any>]>(
      `SELECT role, content, created_at
       FROM messages
       WHERE conversation_id = type::thing($table, $id)
       ORDER BY created_at ASC`,
      { table: 'conversations', id: id.replace('conversations:', '') }
    );

    return {
      ...conversation,
      messages: messages || [],
    };
  } catch (error) {
    console.error(`Failed to get conversation ${id}:`, error);
    return null;
  } finally {
    await db.close();
  }
}
