// Matching algorithm for apples and oranges
// Calculates bidirectional compatibility scores based on preferences and attributes

import type { Fruit, FruitAttributes, FruitPreferences } from "./generateFruit.ts";
import Surreal from "npm:surrealdb@1.3.2";

export interface Match {
  fruit: Fruit;
  fruitId: string;
  seekerToFruitScore: number;
  fruitToSeekerScore: number;
  mutualScore: number;
}

/**
 * Score a numeric attribute (size, weight) based on preferences
 * @param preference - The seeker's preference with optional min/max
 * @param actualValue - The candidate's actual value
 * @returns Score contribution (-20 to +15)
 */
function scoreNumericAttribute(
  preference: { min?: number; max?: number } | undefined,
  actualValue: number | null | undefined
): number {
  // No preference = neutral
  if (!preference || (preference.min === undefined && preference.max === undefined)) {
    return 0;
  }

  // Candidate has unknown value = neutral (no penalty, no bonus)
  if (actualValue === null || actualValue === undefined) {
    return 0;
  }

  // Check if value is out of range
  if (preference.min !== undefined && actualValue < preference.min) {
    return -20; // Strong penalty for being below min
  }

  if (preference.max !== undefined && actualValue > preference.max) {
    return -20; // Strong penalty for being above max
  }

  // Value is within range - calculate proximity bonus
  if (preference.min !== undefined && preference.max !== undefined) {
    // Both bounds defined - reward being close to center
    const rangeCenter = (preference.min + preference.max) / 2;
    const rangeWidth = preference.max - preference.min;
    const distance = Math.abs(actualValue - rangeCenter);
    const proximity = 1 - (distance / (rangeWidth / 2));
    return 15 * Math.max(0, proximity);
  } else if (preference.min !== undefined) {
    // Only min defined - reward being close to min
    const distance = actualValue - preference.min;
    const proximity = Math.max(0, 1 - distance / 5); // Arbitrary scaling
    return 15 * proximity;
  } else if (preference.max !== undefined) {
    // Only max defined - reward being close to max
    const distance = preference.max - actualValue;
    const proximity = Math.max(0, 1 - distance / 5);
    return 15 * proximity;
  }

  return 0;
}

/**
 * Score a boolean attribute (hasStem, hasLeaf, hasWorm, hasChemicals)
 * @param preference - The seeker's preference (true/false/undefined)
 * @param actualValue - The candidate's actual value
 * @returns Score contribution (-25 to +15)
 */
function scoreBooleanAttribute(
  preference: boolean | undefined,
  actualValue: boolean | null | undefined
): number {
  // No preference = neutral
  if (preference === undefined) {
    return 0;
  }

  // Candidate has unknown value = neutral
  if (actualValue === null || actualValue === undefined) {
    return 0;
  }

  // Exact match required
  if (actualValue === preference) {
    return 15; // Bonus for match
  } else {
    return -25; // Strong penalty for mismatch
  }
}

/**
 * Score an enum attribute (shineFactor)
 * @param preference - The seeker's preference (single value or array)
 * @param actualValue - The candidate's actual value
 * @returns Score contribution (-15 to +12)
 */
function scoreEnumAttribute(
  preference: string | string[] | undefined,
  actualValue: string | null | undefined
): number {
  // No preference = neutral
  if (!preference) {
    return 0;
  }

  // Candidate has unknown value = neutral
  if (actualValue === null || actualValue === undefined) {
    return 0;
  }

  // Convert single value to array for consistent handling
  const acceptableValues = Array.isArray(preference) ? preference : [preference];

  // Check if candidate's value is acceptable
  if (acceptableValues.includes(actualValue)) {
    return 12; // Bonus for match
  } else {
    return -15; // Penalty for mismatch
  }
}

/**
 * Calculate compatibility score from seeker to candidate
 * @param seeker - The fruit looking for a match
 * @param candidate - The potential match
 * @returns Compatibility score (0-100)
 */
export function calculateCompatibilityScore(
  seeker: Fruit,
  candidate: Fruit
): number {
  let score = 50; // Base score

  const seekerPrefs = seeker.preferences;
  const candidateAttrs = candidate.attributes;

  // Score size preference
  if (seekerPrefs.size) {
    score += scoreNumericAttribute(seekerPrefs.size, candidateAttrs.size);
  }

  // Score weight preference
  if (seekerPrefs.weight) {
    score += scoreNumericAttribute(seekerPrefs.weight, candidateAttrs.weight);
  }

  // Score hasStem preference
  if (seekerPrefs.hasStem !== undefined) {
    score += scoreBooleanAttribute(seekerPrefs.hasStem, candidateAttrs.hasStem);
  }

  // Score hasLeaf preference
  if (seekerPrefs.hasLeaf !== undefined) {
    score += scoreBooleanAttribute(seekerPrefs.hasLeaf, candidateAttrs.hasLeaf);
  }

  // Score hasWorm preference
  if (seekerPrefs.hasWorm !== undefined) {
    score += scoreBooleanAttribute(seekerPrefs.hasWorm, candidateAttrs.hasWorm);
  }

  // Score hasChemicals preference
  if (seekerPrefs.hasChemicals !== undefined) {
    score += scoreBooleanAttribute(seekerPrefs.hasChemicals, candidateAttrs.hasChemicals);
  }

  // Score shineFactor preference
  if (seekerPrefs.shineFactor) {
    score += scoreEnumAttribute(seekerPrefs.shineFactor, candidateAttrs.shineFactor);
  }

  // Normalize to 0-100 scale
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate mutual compatibility score (geometric mean of bidirectional scores)
 * @param fruitA - First fruit
 * @param fruitB - Second fruit
 * @returns Mutual compatibility score (0-100)
 */
export function calculateMutualScore(fruitA: Fruit, fruitB: Fruit): number {
  const aToB = calculateCompatibilityScore(fruitA, fruitB);
  const bToA = calculateCompatibilityScore(fruitB, fruitA);

  // Geometric mean - both directions must be good for high score
  const mutualScore = Math.sqrt(aToB * bToA);

  return Math.round(mutualScore * 10) / 10; // Round to 1 decimal place
}

/**
 * Find top matches for a fruit from a candidate pool
 * @param seeker - The fruit looking for matches
 * @param candidates - Pool of potential matches
 * @param limit - Maximum number of matches to return (default: 5)
 * @returns Array of matches sorted by mutual score (highest first)
 */
export function findTopMatches(
  seeker: Fruit,
  candidates: Fruit[],
  limit = 5
): Match[] {
  // Calculate scores for all candidates
  const scoredMatches: Match[] = candidates.map(candidate => {
    const seekerToFruitScore = calculateCompatibilityScore(seeker, candidate);
    const fruitToSeekerScore = calculateCompatibilityScore(candidate, seeker);
    const mutualScore = Math.sqrt(seekerToFruitScore * fruitToSeekerScore);

    return {
      fruit: candidate,
      fruitId: candidate.id || "unknown",
      seekerToFruitScore: Math.round(seekerToFruitScore * 10) / 10,
      fruitToSeekerScore: Math.round(fruitToSeekerScore * 10) / 10,
      mutualScore: Math.round(mutualScore * 10) / 10,
    };
  });

  // Sort by mutual score (descending)
  const sortedMatches = scoredMatches.sort((a, b) => b.mutualScore - a.mutualScore);

  // Return top N matches
  return sortedMatches.slice(0, limit);
}

/**
 * Find top matches for a fruit by querying database
 * @param db - SurrealDB connection
 * @param seeker - The fruit looking for matches
 * @param limit - Maximum number of matches to return (default: 5)
 * @returns Array of matches sorted by mutual score (highest first)
 */
export async function findTopMatchesFromDB(
  db: Surreal,
  seeker: Fruit,
  limit = 5
): Promise<Match[]> {
  // Determine opposite type
  const oppositeType = seeker.type === "apple" ? "orange" : "apple";

  // Query all fruits of opposite type
  const query = `SELECT * FROM fruits WHERE type = $type`;
  const [candidates] = await db.query<Fruit[][]>(query, { type: oppositeType });

  if (!candidates || candidates.length === 0) {
    return [];
  }

  // Use findTopMatches to score and rank
  return findTopMatches(seeker, candidates, limit);
}

/**
 * Generate a summary of why a match was chosen
 * Useful for LLM prompts and debugging
 */
export function generateMatchReasons(seeker: Fruit, match: Match): string[] {
  const reasons: string[] = [];
  const seekerPrefs = seeker.preferences;
  const matchAttrs = match.fruit.attributes;

  // Check size match
  if (seekerPrefs.size && matchAttrs.size !== null && matchAttrs.size !== undefined) {
    if (seekerPrefs.size.min !== undefined && seekerPrefs.size.max !== undefined) {
      if (matchAttrs.size >= seekerPrefs.size.min && matchAttrs.size <= seekerPrefs.size.max) {
        reasons.push(`Size ${matchAttrs.size} is within preferred range ${seekerPrefs.size.min}-${seekerPrefs.size.max}`);
      }
    }
  }

  // Check weight match
  if (seekerPrefs.weight && matchAttrs.weight !== null && matchAttrs.weight !== undefined) {
    if (seekerPrefs.weight.min !== undefined && seekerPrefs.weight.max !== undefined) {
      if (matchAttrs.weight >= seekerPrefs.weight.min && matchAttrs.weight <= seekerPrefs.weight.max) {
        reasons.push(`Weight ${matchAttrs.weight} is within preferred range ${seekerPrefs.weight.min}-${seekerPrefs.weight.max}`);
      }
    }
  }

  // Check boolean attributes
  if (seekerPrefs.hasWorm === false && matchAttrs.hasWorm === false) {
    reasons.push("Worm-free as preferred");
  }

  if (seekerPrefs.hasStem !== undefined && matchAttrs.hasStem === seekerPrefs.hasStem) {
    reasons.push(seekerPrefs.hasStem ? "Has a stem" : "No stem");
  }

  if (seekerPrefs.hasLeaf !== undefined && matchAttrs.hasLeaf === seekerPrefs.hasLeaf) {
    reasons.push(seekerPrefs.hasLeaf ? "Has a leaf" : "No leaf");
  }

  if (seekerPrefs.hasChemicals !== undefined && matchAttrs.hasChemicals === seekerPrefs.hasChemicals) {
    reasons.push(seekerPrefs.hasChemicals ? "Treated with chemicals" : "Chemical-free");
  }

  // Check shine factor
  if (seekerPrefs.shineFactor && matchAttrs.shineFactor) {
    const acceptable = Array.isArray(seekerPrefs.shineFactor)
      ? seekerPrefs.shineFactor
      : [seekerPrefs.shineFactor];

    if (acceptable.includes(matchAttrs.shineFactor)) {
      reasons.push(`Shine factor (${matchAttrs.shineFactor}) matches preference`);
    }
  }

  // Add mutual compatibility note
  reasons.push(`${match.mutualScore}% mutual compatibility score`);

  return reasons;
}
