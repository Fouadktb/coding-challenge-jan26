"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatRelativeTime } from "@/lib/utils";

interface Conversation {
  id: string;
  fruit_id: string;
  status: string;
  messages: Array<{
    id: string;
    role: "system" | "user" | "assistant";
    content: string;
    timestamp: string;
  }>;
  created_at: string;
}

export default function ConversationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch conversations
  const { data: conversations = [], isLoading: loading } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const response = await fetch("/api/conversations");
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.conversations as Conversation[];
    },
  });

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async (type: "apple" | "orange") => {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.conversation;
    },
    onSuccess: (conversation) => {
      const conversationId = conversation.conversationId.replace("conversations:", "");
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      router.push(`/conversations/${conversationId}`);
    },
    onError: (error) => {
      console.error("Failed to create conversation:", error);
      alert("Failed to create conversation. Check console for details.");
    },
  });

  return (
    <div className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Matchmaking Conversations</h1>
            <p className="text-muted">Watch fruits find their perfect match!</p>
          </div>
          <Link href="/dashboard" className="btn-secondary">
            ← Back to Dashboard
          </Link>
        </div>

        {/* New Conversation Buttons */}
        <div className="card p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Start New Conversation</h2>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => createConversationMutation.mutate("apple")}
              disabled={createConversationMutation.isPending}
              className="btn-primary flex items-center gap-2 bg-red-600 hover:bg-red-700"
            >
              <span className="text-xl">🍎</span>
              {createConversationMutation.isPending ? "Creating..." : "New Apple"}
            </button>
            <button
              type="button"
              onClick={() => createConversationMutation.mutate("orange")}
              disabled={createConversationMutation.isPending}
              className="btn-primary flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
            >
              <span className="text-xl">🍊</span>
              {createConversationMutation.isPending ? "Creating..." : "New Orange"}
            </button>
          </div>
        </div>

        {/* Conversations List */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">
            Recent Conversations ({conversations.length})
          </h2>

          {loading ? (
            <div className="text-center py-8 text-muted">Loading conversations...</div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 text-muted">
              No conversations yet. Start one above!
            </div>
          ) : (
            <div className="space-y-4">
              {conversations.map((conv) => {
                // Extract conversation ID without the "conversations:" prefix
                const convId = conv.id.replace("conversations:", "");

                return (
                  <Link
                    key={conv.id}
                    href={`/conversations/${convId}`}
                    className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-lime-400 dark:hover:border-lime-600 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{conv.fruit_id}</span>
                      <span className="text-xs text-muted">
                        {formatRelativeTime(new Date(conv.created_at))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted">
                        {conv.messages.length} messages
                      </div>
                      <div className="text-sm text-lime-600 dark:text-lime-400">
                        Open chat →
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
