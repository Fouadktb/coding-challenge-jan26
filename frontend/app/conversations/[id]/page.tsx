'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useQuery } from '@tanstack/react-query';
import { MessageBubble } from '@/components/MessageBubble';
import { MatchCard } from '@/components/MatchCard';

interface Message {
  id?: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  created_at?: string;
}

interface MatchData {
  type: 'matches';
  data: Array<{
    fruitId: string;
    fruitType: 'apple' | 'orange';
    mutualScore: number;
    seekerToFruitScore: number;
    fruitToSeekerScore: number;
  }>;
}

export default function ConversationDetailPage() {
  const params = useParams();
  const conversationId = params.id as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch initial messages using React Query
  const { data: messagesData, isLoading: loading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const response = await fetch(
        `/api/conversations/${conversationId}/messages`
      );
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.messages as Message[];
    },
  });

  // Use AI SDK's useChat hook with DefaultChatTransport
  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: {
        conversationId: `conversations:${conversationId}`,
      },
    }),
  });

  // Pre-populate messages from database when loaded
  useEffect(() => {
    if (messagesData && messagesData.length > 0 && messages.length === 0) {
      // Convert database messages to UIMessage format
      const uiMessages = messagesData.map((msg) => ({
        id: msg.id || crypto.randomUUID(),
        role: msg.role,
        parts: [
          {
            type: 'text' as const,
            text: msg.content,
          },
        ],
      }));
      setMessages(uiMessages);
    }
  }, [messagesData, messages.length, setMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Extract text content from UI message parts
  const getMessageText = (msg: any): string => {
    if (!msg.parts || !Array.isArray(msg.parts)) return '';

    // Combine all text parts (handles streaming where multiple text parts may exist)
    return msg.parts
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('');
  };

  // Check if message content is match data
  const isMatchData = (content: string): MatchData | null => {
    try {
      const parsed = JSON.parse(content);
      if (parsed.type === 'matches' && Array.isArray(parsed.data)) {
        return parsed as MatchData;
      }
    } catch {
      // Not JSON or not match data
    }
    return null;
  };

  return (
    <div className='h-screen flex flex-col bg-gray-50 dark:bg-gray-900'>
      {/* Fixed Header */}
      <div className='flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4'>
        <div className='max-w-4xl mx-auto flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold'>Conversation</h1>
            <p className='text-sm text-muted'>conversations:{conversationId}</p>
          </div>
          <Link href='/conversations' className='btn-secondary'>
            ← Back
          </Link>
        </div>
      </div>

      {/* Scrollable Messages Area */}
      <div className='flex-1 overflow-y-auto p-4'>
        <div className='max-w-4xl mx-auto space-y-4'>
          {loading ? (
            <div className='text-center py-8 text-muted'>
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className='text-center py-8 text-muted'>
              No messages yet. Start the conversation!
            </div>
          ) : (
            <>
              {messages.map((msg, i) => {
                const content = getMessageText(msg);
                const matchData = isMatchData(content);

                if (matchData) {
                  // Render match cards
                  return (
                    <div key={msg.id || i} className='my-4'>
                      <div className='text-sm font-semibold text-muted mb-3'>
                        🎯 Your Top Matches
                      </div>
                      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
                        {matchData.data.map((match, idx) => (
                          <MatchCard
                            key={idx}
                            fruitType={match.fruitType}
                            fruitId={match.fruitId}
                            mutualScore={match.mutualScore}
                            seekerToFruitScore={match.seekerToFruitScore}
                            fruitToSeekerScore={match.fruitToSeekerScore}
                          />
                        ))}
                      </div>
                    </div>
                  );
                }

                // Regular message
                return (
                  <MessageBubble
                    key={msg.id || i}
                    role={msg.role}
                    content={content}
                    timestamp={new Date().toISOString()}
                  />
                );
              })}
            </>
          )}
          {(isSubmitting || status === 'streaming') && (
            <div className='flex items-center gap-2 text-muted text-sm p-4'>
              <div
                className='w-2 h-2 bg-lime-500 rounded-full animate-bounce'
                style={{ animationDelay: '0ms' }}
              ></div>
              <div
                className='w-2 h-2 bg-lime-500 rounded-full animate-bounce'
                style={{ animationDelay: '150ms' }}
              ></div>
              <div
                className='w-2 h-2 bg-lime-500 rounded-full animate-bounce'
                style={{ animationDelay: '300ms' }}
              ></div>
              <span className='ml-2'>AI is thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Fixed Input Area */}
      <div className='flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4'>
        <div className='max-w-4xl mx-auto'>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const message = input.trim();
              if (message && !isSubmitting && status !== 'streaming') {
                setInput('');
                setIsSubmitting(true);
                try {
                  await sendMessage({ text: message });
                } finally {
                  setIsSubmitting(false);
                }
              }
            }}
            className='flex gap-2'
          >
            <input
              type='text'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your matches... (e.g., 'Why was this orange my top match?')"
              disabled={isSubmitting || status === 'streaming'}
              className='flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-black dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-lime-500
                       disabled:opacity-50 disabled:cursor-not-allowed'
              autoFocus
            />
            <button
              type='submit'
              disabled={isSubmitting || status === 'streaming' || !input?.trim()}
              className='btn-primary px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap'
            >
              {isSubmitting || status === 'streaming' ? 'Sending...' : 'Send'}
            </button>
          </form>
          <p className='text-xs text-muted mt-2'>
            Ask questions about your matches, compatibility scores, or why
            certain fruits were recommended.
          </p>
        </div>
      </div>
    </div>
  );
}
