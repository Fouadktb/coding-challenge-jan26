import { Suspense } from 'react';
import Link from 'next/link';
import { getDashboardData } from './loader';
import { formatRelativeTime } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

// These are example types - define your own based on your solution!
export interface MatchMetrics {
  totalApples: number;
  totalOranges: number;
  totalMatches: number;
  successRate: number;
}

// =============================================================================
// SERVER DATA LOADING
// =============================================================================

async function DashboardContent() {
  const data = await getDashboardData();

  return (
    <>
      <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5 mb-8'>
        <MetricCard
          title='Total Apples'
          value={data.metrics.totalApples}
          icon='🍎'
          description='Apples in the system'
        />
        <MetricCard
          title='Total Oranges'
          value={data.metrics.totalOranges}
          icon='🍊'
          description='Oranges in the system'
        />
        <MetricCard
          title='Total Matches'
          value={data.metrics.totalMatches}
          icon='🍐'
          description='Successful pairings'
        />
        <MetricCard
          title='Success Rate'
          value={`${data.metrics.successRate}%`}
          icon='✓'
          description='Matches above 60%'
        />
        <MetricCard
          title='Avg Score'
          value={`${data.avgCompatibility}%`}
          icon='📊'
          description='Average compatibility'
        />
      </div>

      {/* Recent Matches */}
      {data.recentMatches && data.recentMatches.length > 0 && (
        <div className='card mb-8'>
          <h3 className='text-lg font-semibold mb-4'>Recent Matches</h3>
          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead>
                <tr className='border-b border-zinc-200 dark:border-zinc-700'>
                  <th className='px-4 py-3 text-left text-sm font-medium text-muted'>
                    Apple
                  </th>
                  <th className='px-4 py-3 text-left text-sm font-medium text-muted'>
                    Orange
                  </th>
                  <th className='px-4 py-3 text-left text-sm font-medium text-muted'>
                    Score
                  </th>
                  <th className='px-4 py-3 text-left text-sm font-medium text-muted'>
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.recentMatches.slice(0, 10).map((match) => (
                  <tr
                    key={match.id}
                    className='border-b border-zinc-100 dark:border-zinc-800'
                  >
                    <td className='px-4 py-3 font-mono text-xs'>
                      {match.apple_id}
                    </td>
                    <td className='px-4 py-3 text-sm font-mono text-xs'>
                      {match.orange_id}
                    </td>
                    <td className='px-4 py-3 text-sm'>
                      <span
                        className={`font-semibold ${
                          match.mutual_score >= 80
                            ? 'text-lime-600 dark:text-lime-400'
                            : match.mutual_score >= 60
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-yellow-600 dark:text-yellow-400'
                        }`}
                      >
                        {match.mutual_score}%
                      </span>
                    </td>
                    <td className='px-4 py-3 text-sm text-muted'>
                      {formatRelativeTime(new Date(match.created_at))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Score Distribution */}
      {data.scoreDistribution && data.scoreDistribution.length > 0 && (
        <div className='card'>
          <h3 className='text-lg font-semibold mb-4'>
            Match Quality Distribution
          </h3>
          <div className='space-y-3'>
            {data.scoreDistribution.map((bucket) => (
              <div key={bucket.bucket} className='flex items-center gap-4'>
                <div className='w-24 text-sm text-muted'>
                  {bucket.bucket}-{bucket.bucket + 19}%
                </div>
                <div className='flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-8 overflow-hidden'>
                  <div
                    className='h-full bg-lime-500 dark:bg-lime-600 flex items-center justify-end px-3 text-white text-sm font-semibold transition-all'
                    style={{
                      width: `${
                        (bucket.count / data.metrics.totalMatches) * 100
                      }%`,
                    }}
                  >
                    {bucket.count > 0 && bucket.count}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: string;
  description: string;
}

function MetricCard({ title, value, icon, description }: MetricCardProps) {
  return (
    <div className='metric-card'>
      <div className='flex items-center justify-between'>
        <span className='text-2xl'>{icon}</span>
        <span className='text-xs uppercase tracking-wide text-muted'>
          {title}
        </span>
      </div>
      <div className='mt-4'>
        <p className='text-3xl font-bold'>{value}</p>
        <p className='mt-1 text-sm text-muted'>{description}</p>
      </div>
    </div>
  );
}

function MetricCardSkeleton() {
  return (
    <div className='metric-card animate-pulse'>
      <div className='flex items-center justify-between'>
        <div className='h-8 w-8 rounded bg-zinc-200 dark:bg-zinc-700' />
        <div className='h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-700' />
      </div>
      <div className='mt-4'>
        <div className='h-8 w-24 rounded bg-zinc-200 dark:bg-zinc-700' />
        <div className='mt-2 h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-700' />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4'>
      {Array.from({ length: 4 }).map((_, i) => (
        <MetricCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * A helper component to display scaffold notes in the UI.
 * Remove this component entirely when building your solution!
 */
function ScaffoldNote({ children }: { children: React.ReactNode }) {
  return (
    <div className='mb-4 rounded-lg border border-dashed border-amber-400/50 bg-amber-50/50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-400'>
      <span className='mr-2'>💡</span>
      {children}
    </div>
  );
}

// =============================================================================
// PAGE
// =============================================================================

export default function DashboardPage() {
  return (
    <div className='min-h-screen'>
      {/* Header - Feel free to redesign! */}
      <header className='border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80'>
        <div className='mx-auto max-w-7xl px-6 py-6'>
          <div className='flex items-center justify-between'>
            <div>
              <h1 className='text-2xl font-bold tracking-tight'>
                🍎 Matchmaking Dashboard 🍊
              </h1>
              <p className='mt-1 text-sm text-muted'>
                Creating perfect pears, one match at a time
              </p>
            </div>
            <div className='flex items-center gap-4'>
              <Link href='/conversations' className='btn-primary'>
                Start Matchmaking
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className='mx-auto max-w-7xl px-6 py-8'>
        {/* Metrics and Analytics Section */}
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardContent />
        </Suspense>
      </main>
    </div>
  );
}
