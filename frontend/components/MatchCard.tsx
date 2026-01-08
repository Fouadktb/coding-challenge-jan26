"use client";

interface MatchCardProps {
  fruitType: "apple" | "orange";
  fruitId: string;
  mutualScore: number;
  seekerToFruitScore?: number;
  fruitToSeekerScore?: number;
}

export function MatchCard({
  fruitType,
  fruitId,
  mutualScore,
  seekerToFruitScore,
  fruitToSeekerScore,
}: MatchCardProps) {
  // Determine quality based on score
  let qualityLabel = "";
  let qualityColor = "";

  if (mutualScore >= 80) {
    qualityLabel = "Excellent Match";
    qualityColor = "text-lime-600 dark:text-lime-400";
  } else if (mutualScore >= 60) {
    qualityLabel = "Good Match";
    qualityColor = "text-green-600 dark:text-green-400";
  } else if (mutualScore >= 40) {
    qualityLabel = "Fair Match";
    qualityColor = "text-yellow-600 dark:text-yellow-400";
  } else {
    qualityLabel = "Potential Match";
    qualityColor = "text-orange-600 dark:text-orange-400";
  }

  const icon = fruitType === "apple" ? "🍎" : "🍊";

  return (
    <div className="card p-3 hover:shadow-lg transition-shadow border-2 border-lime-200 dark:border-lime-800">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-2xl flex-shrink-0">{icon}</span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-900 dark:text-gray-100 capitalize">
              {fruitType}
            </p>
            <p className="text-[10px] text-muted truncate">{fruitId}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0 ml-2">
          <p className={`text-xl font-bold ${qualityColor}`}>{mutualScore}%</p>
          <p className="text-[10px] text-muted whitespace-nowrap">{qualityLabel}</p>
        </div>
      </div>

      {(seekerToFruitScore !== undefined || fruitToSeekerScore !== undefined) && (
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between gap-2 text-[10px] text-muted">
            {seekerToFruitScore !== undefined && (
              <div className="min-w-0 flex-1">
                <span className="opacity-70">You:</span>{" "}
                <span className="font-medium">{seekerToFruitScore}%</span>
              </div>
            )}
            {fruitToSeekerScore !== undefined && (
              <div className="min-w-0 flex-1 text-right">
                <span className="opacity-70">Them:</span>{" "}
                <span className="font-medium">{fruitToSeekerScore}%</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
