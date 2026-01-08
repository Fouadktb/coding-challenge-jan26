// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { generateOrange, communicateAttributes, communicatePreferences } from "../_shared/generateFruit.ts";
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
 * Get Incoming Orange Edge Function
 *
 * Task Flow:
 * 1. Generate a new orange instance
 * 2. Capture the new orange's communication (attributes and preferences)
 * 3. Store the new orange in SurrealDB
 * 4. Match the new orange to existing apples
 * 5. Communicate matching results back to the orange via LLM
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
    // Step 1: Generate a new orange instance
    const orange = generateOrange();

    // Step 2: Capture the orange's communication
    // The orange expresses its attributes and preferences
    const orangeAttrs = communicateAttributes(orange);
    const orangePrefs = communicatePreferences(orange);

    // Step 3: Store the new orange in SurrealDB
    console.log("Storing new orange in database...");
    db = await connectToSurrealDB();

    // Convert null to undefined for SurrealDB compatibility
    const orangeData = convertNullToUndefined({
      type: orange.type,
      attributes: orange.attributes,
      preferences: orange.preferences,
    });

    const storedOrangeResult = await db.create("fruits", orangeData);

    // Extract the record from array response
    const storedOrange = Array.isArray(storedOrangeResult) ? storedOrangeResult[0] : storedOrangeResult;
    const orangeId = storedOrange.id;
    console.log(`Orange stored with ID: ${orangeId}`);

    // Add ID to orange object for matching
    orange.id = orangeId;

    // Step 4: Match the new orange to existing apples
    console.log("Finding matches for orange...");
    const matches = await findTopMatchesFromDB(db, orange, 5);
    console.log(`Found ${matches.length} matches`);

    // Store match records in database
    const matchIds: any[] = [];
    for (const match of matches) {
      const matchResult = await db.create("matches", {
        apple_id: match.fruitId,
        orange_id: orangeId,
        apple_to_orange_score: match.fruitToSeekerScore,
        orange_to_apple_score: match.seekerToFruitScore,
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
      orange,
      matches,
      orangeAttrs,
      orangePrefs
    );

    // Create conversation record
    const conversation = await db.create("conversations", {
      fruit_id: orangeId,
      match_id: matchIds.length > 0 ? matchIds[0] : null,
      status: "active",
    });

    // Extract conversation ID from array response
    const conversationRecord = Array.isArray(conversation) ? conversation[0] : conversation;
    const conversationId = conversationRecord.id;

    // Create initial messages in the messages table
    const initialMessages = [
      { role: "system", content: "Welcome to the Fruit Matchmaking Service!" },
      { role: "user", content: orangeAttrs },
      { role: "user", content: orangePrefs },
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
          id: orangeId,
          type: orange.type,
          attributes: orange.attributes,
          preferences: orange.preferences,
        },
        communication: {
          attributes: orangeAttrs,
          preferences: orangePrefs,
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
    console.error("Error processing incoming orange:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process incoming orange",
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
