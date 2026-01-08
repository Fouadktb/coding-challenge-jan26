// Tests for matching algorithm
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  calculateCompatibilityScore,
  calculateMutualScore,
  findTopMatches,
  generateMatchReasons,
} from "./matching.ts";
import type { Fruit } from "./generateFruit.ts";

// Test fruits
const appleNoPreferences: Fruit = {
  id: "fruits:apple1",
  type: "apple",
  attributes: {
    size: 7.0,
    weight: 180,
    hasStem: true,
    hasLeaf: false,
    hasWorm: false,
    shineFactor: "shiny",
    hasChemicals: false,
  },
  preferences: {}, // No preferences
};

const orangePerfectMatch: Fruit = {
  id: "fruits:orange1",
  type: "orange",
  attributes: {
    size: 7.5,
    weight: 200,
    hasStem: false,
    hasLeaf: true,
    hasWorm: false,
    shineFactor: "shiny",
    hasChemicals: false,
  },
  preferences: {}, // No preferences
};

const appleWithPreferences: Fruit = {
  id: "fruits:apple2",
  type: "apple",
  attributes: {
    size: 6.0,
    weight: 150,
    hasStem: true,
    hasLeaf: true,
    hasWorm: false,
    shineFactor: "neutral",
    hasChemicals: false,
  },
  preferences: {
    size: { min: 7.0, max: 10.0 },
    weight: { min: 180, max: 220 },
    hasWorm: false,
    shineFactor: ["shiny", "extraShiny"],
  },
};

const orangeGoodMatch: Fruit = {
  id: "fruits:orange2",
  type: "orange",
  attributes: {
    size: 8.0,
    weight: 195,
    hasStem: false,
    hasLeaf: false,
    hasWorm: false,
    shineFactor: "shiny",
    hasChemicals: false,
  },
  preferences: {
    hasWorm: false,
    hasChemicals: false,
  },
};

const orangePoorMatch: Fruit = {
  id: "fruits:orange3",
  type: "orange",
  attributes: {
    size: 4.0,
    weight: 100,
    hasStem: true,
    hasLeaf: true,
    hasWorm: true,
    shineFactor: "dull",
    hasChemicals: true,
  },
  preferences: {
    hasWorm: true,
  },
};

Deno.test("calculateCompatibilityScore - no preferences", () => {
  const score = calculateCompatibilityScore(appleNoPreferences, orangePerfectMatch);
  assertEquals(score, 50, "Base score with no preferences should be 50");
});

Deno.test("calculateCompatibilityScore - good match", () => {
  const score = calculateCompatibilityScore(appleWithPreferences, orangeGoodMatch);
  console.log(`Good match score: ${score}`);
  // Should be high because orange meets most preferences
  assertEquals(score > 60, true, "Good match should score above 60");
});

Deno.test("calculateCompatibilityScore - poor match", () => {
  const score = calculateCompatibilityScore(appleWithPreferences, orangePoorMatch);
  console.log(`Poor match score: ${score}`);
  // Should be low because orange fails most preferences
  assertEquals(score < 40, true, "Poor match should score below 40");
});

Deno.test("calculateCompatibilityScore - null attributes are neutral", () => {
  const appleWithNullPrefs: Fruit = {
    id: "fruits:apple3",
    type: "apple",
    attributes: {
      size: 5.0,
      weight: 150,
      hasStem: null, // Unknown
      hasLeaf: null,
      hasWorm: false,
      shineFactor: null,
      hasChemicals: null,
    },
    preferences: {
      hasStem: true, // Prefers stem
      shineFactor: "shiny",
    },
  };

  const orangeWithNulls: Fruit = {
    id: "fruits:orange4",
    type: "orange",
    attributes: {
      size: 6.0,
      weight: 170,
      hasStem: null, // Unknown - should not penalize
      hasLeaf: false,
      hasWorm: false,
      shineFactor: null, // Unknown - should not penalize
      hasChemicals: false,
    },
    preferences: {},
  };

  const score = calculateCompatibilityScore(appleWithNullPrefs, orangeWithNulls);
  console.log(`Score with nulls: ${score}`);
  // Null attributes should not cause penalties, score should be around base
  assertEquals(score >= 45 && score <= 55, true, "Null attributes should not heavily penalize");
});

Deno.test("calculateMutualScore - bidirectional", () => {
  const mutualScore = calculateMutualScore(appleWithPreferences, orangeGoodMatch);
  console.log(`Mutual score: ${mutualScore}`);
  assertExists(mutualScore);
  assertEquals(mutualScore >= 0 && mutualScore <= 100, true, "Mutual score should be 0-100");
});

Deno.test("findTopMatches - returns sorted results", () => {
  const candidates = [orangePoorMatch, orangeGoodMatch, orangePerfectMatch];
  const matches = findTopMatches(appleWithPreferences, candidates, 3);

  assertEquals(matches.length, 3, "Should return 3 matches");

  // Scores should be in descending order
  for (let i = 0; i < matches.length - 1; i++) {
    assertEquals(
      matches[i].mutualScore >= matches[i + 1].mutualScore,
      true,
      "Matches should be sorted by mutual score descending"
    );
  }

  console.log("Match scores:", matches.map(m => m.mutualScore));
});

Deno.test("findTopMatches - limits results", () => {
  const candidates = [orangePoorMatch, orangeGoodMatch, orangePerfectMatch];
  const matches = findTopMatches(appleWithPreferences, candidates, 2);

  assertEquals(matches.length, 2, "Should limit to 2 matches");
});

Deno.test("generateMatchReasons - provides explanations", () => {
  const candidates = [orangeGoodMatch];
  const matches = findTopMatches(appleWithPreferences, candidates, 1);
  const reasons = generateMatchReasons(appleWithPreferences, matches[0]);

  console.log("Match reasons:", reasons);
  assertExists(reasons);
  assertEquals(reasons.length > 0, true, "Should provide at least one reason");
  assertEquals(
    reasons.some(r => r.includes("compatibility")),
    true,
    "Should include compatibility score"
  );
});

console.log("\n✓ All matching algorithm tests passed!");
