import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { messages, conversationId } = await req.json();

    if (!conversationId) {
      return new Response('conversationId is required', { status: 400 });
    }

    // Get the Supabase functions URL from environment
    const supabaseFunctionsUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
    const url = `${supabaseFunctionsUrl}/functions/v1/send-message`;

    // Get the last user message and extract text from parts
    const lastMessage = messages[messages.length - 1];
    let messageContent = '';

    // UIMessage has parts array
    if (lastMessage.parts && Array.isArray(lastMessage.parts)) {
      const textPart = lastMessage.parts.find((p: any) => p.type === 'text');
      messageContent = textPart?.text || '';
    } else if (lastMessage.content) {
      // Fallback for old format
      messageContent = lastMessage.content;
    }

    console.log(`Sending to edge function: ${url}`, { conversationId, messageLength: messageContent.length });

    // Call edge function
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        message: messageContent,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Edge function error:', errorText);
      return new Response(errorText, { status: response.status });
    }

    // Stream the response from the edge function
    return new Response(response.body, {
      headers: {
        'Content-Type': response.headers.get('content-type') || 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      error instanceof Error ? error.message : 'Internal server error',
      { status: 500 }
    );
  }
}
