// API route for sending messages in a conversation
import { NextRequest, NextResponse } from "next/server";
import { getConversationById } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const conversationId = `conversations:${id}`;
    const conversation = await getConversationById(conversationId);

    if (!conversation) {
      return NextResponse.json(
        {
          success: false,
          error: "Conversation not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      messages: conversation.messages || [],
    });
  } catch (error) {
    console.error("Failed to fetch messages:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch messages",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { id } = await params;
    const conversationId = `conversations:${id}`;

    // Support both useChat format (messages array) and direct message
    let messageContent: string;

    if (body.messages && Array.isArray(body.messages)) {
      // useChat format - get the last user message
      const lastMessage = body.messages[body.messages.length - 1];
      if (!lastMessage || lastMessage.role !== "user") {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid message format",
          },
          { status: 400 }
        );
      }
      // AI SDK v6 format: messages have parts array
      if (lastMessage.parts && Array.isArray(lastMessage.parts)) {
        const textPart = lastMessage.parts.find((p: any) => p.type === 'text');
        messageContent = textPart?.text || '';
      } else if (typeof lastMessage.content === 'string') {
        // Fallback to old content format
        messageContent = lastMessage.content;
      } else {
        messageContent = '';
      }
    } else if (body.message) {
      // Direct message format
      messageContent = body.message;
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "Message content is required",
        },
        { status: 400 }
      );
    }

    if (typeof messageContent !== "string" || messageContent.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Message content is required",
        },
        { status: 400 }
      );
    }

    // Get the Supabase functions URL from environment
    const supabaseFunctionsUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
    const url = `${supabaseFunctionsUrl}/functions/v1/send-message`;

    console.log(`Sending message to: ${url}`);

    // Call the send-message edge function
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversationId,
        message: messageContent.trim(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Edge function error:", errorText);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to send message",
          details: errorText,
        },
        { status: response.status }
      );
    }

    // Check if response is streaming (AI SDK uses text/plain with data stream format)
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("text/event-stream") || contentType?.includes("text/plain")) {
      // Stream the response - pass through AI SDK data stream
      return new Response(response.body, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Transfer-Encoding": "chunked",
        },
      });
    }

    // Non-streaming response (fallback)
    const result = await response.json();
    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Failed to send message:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to send message",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
