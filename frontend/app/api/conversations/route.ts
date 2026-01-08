// API route for conversations
import { NextRequest, NextResponse } from "next/server";
import { getConversations } from "@/lib/db";

// GET /api/conversations - Fetch all conversations
export async function GET() {
  try {
    const conversations = await getConversations();

    return NextResponse.json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error("Failed to fetch conversations:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch conversations",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST /api/conversations - Trigger new conversation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type } = body; // "apple" or "orange"

    if (!type || !["apple", "orange"].includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid fruit type. Must be 'apple' or 'orange'",
        },
        { status: 400 }
      );
    }

    // Get the Supabase functions URL from environment
    const supabaseFunctionsUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
    const endpoint = type === "apple" ? "get-incoming-apple" : "get-incoming-orange";
    const url = `${supabaseFunctionsUrl}/functions/v1/${endpoint}`;

    console.log(`Calling edge function: ${url}`);

    // Call the edge function
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Edge function error:", errorText);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to create conversation",
          details: errorText,
        },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      conversation: result,
    });
  } catch (error) {
    console.error("Failed to create conversation:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create conversation",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
