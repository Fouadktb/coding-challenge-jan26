"use client";

import { formatRelativeTime } from "@/lib/utils";

interface MessageBubbleProps {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: string;
  fruitType?: "apple" | "orange";
}

export function MessageBubble({ role, content, timestamp, fruitType }: MessageBubbleProps) {
  const isSystem = role === "system";
  const isUser = role === "user";
  const isAssistant = role === "assistant";

  // Determine styling based on role and fruit type
  let bubbleClass = "rounded-lg p-4 max-w-2xl animate-fade-in";
  let containerClass = "flex gap-3 mb-4";

  if (isSystem) {
    bubbleClass += " bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700";
    containerClass += " justify-center";
  } else if (isUser) {
    if (fruitType === "apple") {
      bubbleClass += " bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-100 border-2 border-red-200 dark:border-red-800";
    } else if (fruitType === "orange") {
      bubbleClass += " bg-orange-50 dark:bg-orange-950 text-orange-900 dark:text-orange-100 border-2 border-orange-200 dark:border-orange-800";
    } else {
      bubbleClass += " bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-100 border-2 border-blue-200 dark:border-blue-800";
    }
    containerClass += " justify-end";
  } else if (isAssistant) {
    bubbleClass += " bg-lime-50 dark:bg-lime-950 text-lime-900 dark:text-lime-100 border-2 border-lime-200 dark:border-lime-800";
    containerClass += " justify-start";
  }

  return (
    <div className={containerClass}>
      <div className={bubbleClass}>
        <div className="flex items-start justify-between gap-4 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wide opacity-70">
            {isSystem ? "System" : isUser ? `${fruitType || "Fruit"}` : "Matchmaker"}
          </span>
          <span className="text-xs opacity-50">{formatRelativeTime(new Date(timestamp))}</span>
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}
