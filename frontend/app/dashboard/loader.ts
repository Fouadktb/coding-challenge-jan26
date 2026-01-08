import type { MatchMetrics } from "./page";
import { getDashboardMetrics, getRecentMatches } from "@/lib/db";

export interface DashboardData {
  metrics: MatchMetrics;
  recentMatches: Array<{
    id: string;
    apple_id: string;
    orange_id: string;
    mutual_score: number;
    created_at: string;
  }>;
  scoreDistribution: Array<{ bucket: number; count: number }>;
  avgCompatibility: number;
  bestScore: number;
}

/**
 * Server-side data loader for the dashboard page.
 * Fetches real data from SurrealDB
 */
export async function getDashboardData(): Promise<DashboardData> {
  try {
    // Fetch dashboard metrics from SurrealDB
    const dbMetrics = await getDashboardMetrics();

    // Fetch recent matches
    const recentMatches = await getRecentMatches(10);

    const metrics: MatchMetrics = {
      totalApples: dbMetrics.totalApples,
      totalOranges: dbMetrics.totalOranges,
      totalMatches: dbMetrics.totalMatches,
      successRate: dbMetrics.successRate,
    };

    return {
      metrics,
      recentMatches,
      scoreDistribution: dbMetrics.scoreDistribution,
      avgCompatibility: dbMetrics.avgCompatibility,
      bestScore: dbMetrics.bestScore,
    };
  } catch (error) {
    console.error("Failed to load dashboard data:", error);

    // Return empty data on error
    return {
      metrics: {
        totalApples: 0,
        totalOranges: 0,
        totalMatches: 0,
        successRate: 0,
      },
      recentMatches: [],
      scoreDistribution: [],
      avgCompatibility: 0,
      bestScore: 0,
    };
  }
}
