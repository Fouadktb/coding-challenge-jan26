// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { generateApple, communicateAttributes, communicatePreferences } from "../_shared/generateFruit.ts";
import { connectToSurrealDB } from "../_shared/db.ts";
import { findTopMatchesFromDB } from "../_shared/matching.ts";
import { generateMatchExplanation } from "../_shared/llm.ts";

// Convert null values to undefined for SurrealDB option<T> types
function convertNullToUndefined(obj: any): any {
  if (obj === null) return undefined;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(convertNullToUndefined);

  const result: any = {};
  for (const key in obj) {
    result[key] = convertNullToUndefined(obj[key]);
  }
  return result;
}

/**
 * Get Incoming Apple Edge Function
 *
 * Task Flow:
 * 1. Generate a new apple instance
 * 2. Capture the new apple's communication (attributes and preferences)
 * 3. Store the new apple in SurrealDB
 * 4. Match the new apple to existing oranges
 * 5. Communicate matching results back to the apple via LLM
 */

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
    // Step 1: Generate a new apple instance
    const apple = generateApple();

    // Step 2: Capture the apple's communication
    // The apple expresses its attributes and preferences
    const appleAttrs = communicateAttributes(apple);
    const applePrefs = communicatePreferences(apple);

    // Step 3: Store the new apple in SurrealDB
    console.log("Storing new apple in database...");
    db = await connectToSurrealDB();

    // Convert null to undefined for SurrealDB compatibility
    const appleData = convertNullToUndefined({
      type: apple.type,
      attributes: apple.attributes,
      preferences: apple.preferences,
    });

    const storedAppleResult = await db.create("fruits", appleData);

    // Extract the record from array response
    const storedApple = Array.isArray(storedAppleResult) ? storedAppleResult[0] : storedAppleResult;
    const appleId = storedApple.id;
    console.log(`Apple stored with ID: ${appleId}`);

    // Add ID to apple object for matching
    apple.id = appleId;

    // Step 4: Match the new apple to existing oranges
    console.log("Finding matches for apple...");
    const matches = await findTopMatchesFromDB(db, apple, 5);
    console.log(`Found ${matches.length} matches`);

    // Store match records in database
    const matchIds: any[] = [];
    for (const match of matches) {
      const matchResult = await db.create("matches", {
        apple_id: appleId,
        orange_id: match.fruitId,
        apple_to_orange_score: match.seekerToFruitScore,
        orange_to_apple_score: match.fruitToSeekerScore,
        mutual_score: match.mutualScore,
        match_explanation: `${match.mutualScore}% compatibility`,
      });
      // Extract match ID from array response
      const matchRecord = Array.isArray(matchResult) ? matchResult[0] : matchResult;
      matchIds.push(matchRecord.id);
    }

    // Step 5: Communicate matching results via LLM
    console.log("Generating LLM explanation...");
    const explanation = await generateMatchExplanation(
      apple,
      matches,
      appleAttrs,
      applePrefs
    );

    // Create conversation record
    const conversation = await db.create("conversations", {
      fruit_id: appleId,
      match_id: matchIds.length > 0 ? matchIds[0] : null,
      status: "active",
    });

    // Extract conversation ID from array response
    const conversationRecord = Array.isArray(conversation) ? conversation[0] : conversation;
    const conversationId = conversationRecord.id;

    // Create initial messages in the messages table
    const initialMessages = [
      { role: "system", content: "Welcome to the Fruit Matchmaking Service!" },
      { role: "user", content: appleAttrs },
      { role: "user", content: applePrefs },
      { role: "assistant", content: `Found ${matches.length} potential matches! Analyzing compatibility...` },
      {
        role: "assistant",
        content: JSON.stringify({
          type: "matches",
          data: matches.slice(0, 3).map(m => ({
            fruitId: m.fruitId,
            fruitType: m.fruit.type,
            mutualScore: m.mutualScore,
            seekerToFruitScore: m.seekerToFruitScore,
            fruitToSeekerScore: m.fruitToSeekerScore,
          }))
        })
      },
      { role: "assistant", content: explanation },
    ];

    for (const msg of initialMessages) {
      await db.create("messages", {
        conversation_id: conversationId,
        role: msg.role,
        content: msg.content,
      });
    }

    // Return success response with all the data
    return new Response(
      JSON.stringify({
        success: true,
        fruit: {
          id: appleId,
          type: apple.type,
          attributes: apple.attributes,
          preferences: apple.preferences,
        },
        communication: {
          attributes: appleAttrs,
          preferences: applePrefs,
        },
        matches: matches.map(m => ({
          fruitId: m.fruitId,
          type: m.fruit.type,
          mutualScore: m.mutualScore,
          seekerToFruitScore: m.seekerToFruitScore,
          fruitToSeekerScore: m.fruitToSeekerScore,
        })),
        explanation,
        conversationId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error processing incoming apple:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process incoming apple",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  } finally {
    // Always close the database connection
    if (db) {
      await db.close();
    }
  }
});
