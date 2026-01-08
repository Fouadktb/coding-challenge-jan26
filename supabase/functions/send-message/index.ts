// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { connectToSurrealDB } from "../_shared/db.ts";
import { streamText } from "ai";

// CORS headers for local development
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let db;

  try {
    const { conversationId, message } = await req.json();

    if (!conversationId || !message) {
      return new Response(
        JSON.stringify({ error: "Missing conversationId or message" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    console.log(`Processing message for conversation: ${conversationId}`);

    db = await connectToSurrealDB();

    // Fetch conversation details
    const [conversations] = await db.query(
      `SELECT * FROM ${conversationId} FETCH fruit_id`
    );

    if (!conversations || conversations.length === 0) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }

    const conversation = conversations[0];
    const fruit = conversation.fruit_id;

    // Fetch all matches for this fruit
    const fruitType = fruit.type;
    const oppositeType = fruitType === "apple" ? "orange" : "apple";
    const matchedFruitField = fruitType === "apple" ? "orange_id" : "apple_id";

    const [matches] = await db.query(
      `SELECT *, ${matchedFruitField} AS matched_fruit
      FROM matches
      WHERE ${fruitType}_id = type::thing($table, $id)
      ORDER BY mutual_score DESC
      FETCH ${matchedFruitField}`,
      {
        table: 'fruits',
        id: fruit.id.toString().replace('fruits:', '')
      }
    );

    // Fetch previous messages
    const [messages] = await db.query(
      `SELECT role, content, created_at
      FROM messages
      WHERE conversation_id = $convId
      ORDER BY created_at ASC`,
      { convId: conversationId }
    );

    // Store user message
    // Use the record ID object from the conversation query
    const userMessageResult = await db.create("messages", {
      conversation_id: conversation.id,
      role: "user",
      content: message,
    });

    // Build context for LLM
    const systemPrompt = `You are a friendly matchmaking assistant helping ${fruitType === "apple" ? "an apple" : "an orange"} understand their matches with ${oppositeType}s.

Context about this fruit:
- Type: ${fruit.type}
- Attributes: ${JSON.stringify(fruit.attributes)}
- Preferences: ${JSON.stringify(fruit.preferences)}

Top matches found:
${matches.slice(0, 5).map((m: any, i: number) => `
  ${i + 1}. ${m.matched_fruit.type} (${m.mutual_score}% mutual compatibility)
     - ${fruitType} → ${oppositeType}: ${fruitType === "apple" ? m.apple_to_orange_score : m.orange_to_apple_score}%
     - ${oppositeType} → ${fruitType}: ${fruitType === "apple" ? m.orange_to_apple_score : m.apple_to_orange_score}%
     - Attributes: ${JSON.stringify(m.matched_fruit.attributes)}
`).join("\n")}

Answer the user's questions about the matches in a friendly, conversational way. Be specific about compatibility scores and attribute matches when relevant.`;

    // Generate LLM response with streaming
    const apiKey = Deno.env.get("AI_GATEWAY_API_KEY");
    if (!apiKey) {
      throw new Error("AI_GATEWAY_API_KEY not configured");
    }

    const result = await streamText({
      model: "google/gemini-3-flash",
      system: systemPrompt,
      prompt: message,
      maxTokens: 400,
      temperature: 0.7,
      apiKey,
      async onFinish({ text }) {
        // Store the complete message after streaming is done
        try {
          await db.create("messages", {
            conversation_id: conversation.id,
            role: "assistant",
            content: text,
          });

          // Update conversation timestamp
          await db.query(
            `UPDATE ${conversationId} SET updated_at = time::now()`
          );

          await db.close();
        } catch (error) {
          console.error("Error storing message:", error);
          try {
            await db.close();
          } catch (closeError) {
            console.error("Error closing db:", closeError);
          }
        }
      },
    });

    // Use AI SDK's UI message stream response for useChat compatibility
    return result.toUIMessageStreamResponse({
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Error processing message:", error);

    // Clean up db connection on error
    if (db) {
      try {
        await db.close();
      } catch (closeError) {
        console.error("Error closing db:", closeError);
      }
    }

    return new Response(
      JSON.stringify({
        error: "Failed to process message",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
