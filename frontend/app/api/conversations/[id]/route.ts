// API route for single conversation
import { NextRequest, NextResponse } from "next/server";
import { getConversationById } from "@/lib/db";

// GET /api/conversations/[id] - Fetch single conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Conversation ID is required",
        },
        { status: 400 }
      );
    }

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
      conversation,
    });
  } catch (error) {
    console.error(`Failed to fetch conversation:`, error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch conversation",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
