// LLM utilities for generating natural language match explanations
import { generateText } from "ai";
import type { Fruit } from "./generateFruit.ts";
import type { Match } from "./matching.ts";
import { generateMatchReasons } from "./matching.ts";

/**
 * Generate a natural language explanation of match results using Google Gemini
 * @param fruit - The fruit seeking matches
 * @param matches - The top matches found
 * @param attributesCommunication - The fruit's self-description
 * @param preferencesCommunication - The fruit's preferences description
 * @returns LLM-generated match explanation
 */
export async function generateMatchExplanation(
  fruit: Fruit,
  matches: Match[],
  attributesCommunication: string,
  preferencesCommunication: string
): Promise<string> {
  try {
    const systemPrompt = `You are a friendly, warm, and slightly playful matchmaking assistant for a fruit dating service. You help apples find oranges and vice versa. Your job is to communicate match results in an encouraging and honest way.

Your tone should be:
- Warm and supportive
- Slightly playful but professional
- Honest about match quality
- Focus on compatibility highlights
- Keep it concise (3-5 sentences max)

Never mention technical details like "compatibility scores" or "algorithms". Instead, focus on the actual attributes and preferences that make the match work.`;

    const userPrompt = `A new ${fruit.type} has joined the matchmaking service!

They describe themselves as:
"${attributesCommunication}"

They're looking for:
"${preferencesCommunication}"

I've analyzed ${matches.length} potential matches:

${matches.map((m, i) => {
  const reasons = generateMatchReasons(fruit, m);
  return `
Match ${i + 1}: ${m.fruit.type} (ID: ${m.fruitId})
- Mutual Compatibility: ${m.mutualScore}%
- Key compatibility factors:
  ${reasons.filter(r => !r.includes("compatibility score")).map(r => `• ${r}`).join("\n  ")}
`;
}).join("\n")}

Please communicate these results to the ${fruit.type} in a friendly, encouraging way. Highlight the best match(es) and explain why they're compatible based on the specific attributes and preferences mentioned. Keep it concise and natural.`;

    const response = await generateText({
      model: "google/gemini-3-flash", // Latest, fastest Gemini Flash model
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 300,
      temperature: 0.7,
    });

    return response.text;
  } catch (error) {
    console.error("LLM generation failed:", error);

    // Fallback to template-based message
    return generateFallbackMessage(fruit, matches);
  }
}

/**
 * Generate a fallback message when LLM fails
 * Uses templates instead of AI generation
 */
function generateFallbackMessage(fruit: Fruit, matches: Match[]): string {
  if (matches.length === 0) {
    return `No matches found at the moment. Don't worry! New ${
      fruit.type === "apple" ? "oranges" : "apples"
    } are joining all the time. Check back soon!`;
  }

  const bestMatch = matches[0];
  const oppositeType = fruit.type === "apple" ? "orange" : "apple";

  let message = `Great news! We found ${matches.length} potential ${
    matches.length === 1 ? "match" : "matches"
  } for you. `;

  if (bestMatch.mutualScore >= 80) {
    message += `Your top match is an ${oppositeType} with a ${bestMatch.mutualScore}% compatibility score. This is an excellent match! `;
  } else if (bestMatch.mutualScore >= 60) {
    message += `Your top match is an ${oppositeType} with a ${bestMatch.mutualScore}% compatibility score. This could be a great connection! `;
  } else {
    message += `Your best option is an ${oppositeType} with a ${bestMatch.mutualScore}% compatibility score. There's potential here! `;
  }

  // Add one or two key reasons
  const reasons = generateMatchReasons(fruit, bestMatch);
  const topReasons = reasons.filter(r => !r.includes("compatibility score")).slice(0, 2);

  if (topReasons.length > 0) {
    message += `They match your preferences in key areas: ${topReasons.join(", and ")}.`;
  }

  return message;
}

/**
 * Test function to verify LLM setup
 */
export async function testLLMConnection(): Promise<boolean> {
  try {
    const response = await generateText({
      model: "google/gemini-3-flash",
      prompt: "Say 'Hello from the fruit matchmaking service!' in a friendly way.",
      maxTokens: 50,
    });

    console.log("LLM test response:", response.text);
    return true;
  } catch (error) {
    console.error("LLM test failed:", error);
    return false;
  }
}
