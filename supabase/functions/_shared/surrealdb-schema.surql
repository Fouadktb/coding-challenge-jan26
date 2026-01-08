-- Apples & Oranges Matchmaking System - SurrealDB Schema
-- This schema defines the database structure for storing fruits, matches, and conversations

-- ====================================
-- FRUITS TABLE
-- ====================================
-- Stores all fruits (apples and oranges) with their attributes and preferences

DEFINE TABLE fruits SCHEMAFULL;

-- Core fields
DEFINE FIELD type ON fruits TYPE string
  ASSERT $value IN ["apple", "orange"];
DEFINE FIELD created_at ON fruits TYPE datetime
  DEFAULT time::now();

-- Attributes (all nullable - NONE represents null/unknown)
DEFINE FIELD attributes ON fruits TYPE object;
DEFINE FIELD attributes.size ON fruits TYPE option<number>;
DEFINE FIELD attributes.weight ON fruits TYPE option<number>;
DEFINE FIELD attributes.hasStem ON fruits TYPE option<bool>;
DEFINE FIELD attributes.hasLeaf ON fruits TYPE option<bool>;
DEFINE FIELD attributes.hasWorm ON fruits TYPE option<bool>;
DEFINE FIELD attributes.shineFactor ON fruits TYPE option<string>
  ASSERT $value == NONE OR $value IN ["dull", "neutral", "shiny", "extraShiny"];
DEFINE FIELD attributes.hasChemicals ON fruits TYPE option<bool>;

-- Preferences (flexible object structure - fields are optional)
DEFINE FIELD preferences ON fruits TYPE object;
DEFINE FIELD preferences.size ON fruits TYPE option<object>;
DEFINE FIELD preferences.size.min ON fruits TYPE option<number>;
DEFINE FIELD preferences.size.max ON fruits TYPE option<number>;
DEFINE FIELD preferences.weight ON fruits TYPE option<object>;
DEFINE FIELD preferences.weight.min ON fruits TYPE option<number>;
DEFINE FIELD preferences.weight.max ON fruits TYPE option<number>;
DEFINE FIELD preferences.hasStem ON fruits TYPE option<bool>;
DEFINE FIELD preferences.hasLeaf ON fruits TYPE option<bool>;
DEFINE FIELD preferences.hasWorm ON fruits TYPE option<bool>;
DEFINE FIELD preferences.shineFactor ON fruits FLEXIBLE TYPE option<string | array<string>>;
DEFINE FIELD preferences.hasChemicals ON fruits TYPE option<bool>;

-- Indexes for efficient querying
DEFINE INDEX idx_fruits_type ON fruits FIELDS type;
DEFINE INDEX idx_fruits_created ON fruits FIELDS created_at;

-- ====================================
-- MATCHES TABLE
-- ====================================
-- Stores compatibility matches between apples and oranges

DEFINE TABLE matches SCHEMAFULL;

-- Match fields
DEFINE FIELD apple_id ON matches TYPE record<fruits>;
DEFINE FIELD orange_id ON matches TYPE record<fruits>;
DEFINE FIELD apple_to_orange_score ON matches TYPE number;
DEFINE FIELD orange_to_apple_score ON matches TYPE number;
DEFINE FIELD mutual_score ON matches TYPE number;
DEFINE FIELD match_explanation ON matches TYPE string;
DEFINE FIELD created_at ON matches TYPE datetime
  DEFAULT time::now();

-- Indexes for match queries
DEFINE INDEX idx_matches_apple ON matches FIELDS apple_id;
DEFINE INDEX idx_matches_orange ON matches FIELDS orange_id;
DEFINE INDEX idx_matches_mutual_score ON matches FIELDS mutual_score;
DEFINE INDEX idx_matches_created ON matches FIELDS created_at;

-- ====================================
-- CONVERSATIONS TABLE
-- ====================================
-- Stores conversation records for visualization

DEFINE TABLE conversations SCHEMAFULL;

-- Conversation fields
DEFINE FIELD fruit_id ON conversations TYPE record<fruits>;
DEFINE FIELD match_id ON conversations TYPE option<record<matches>>;
DEFINE FIELD status ON conversations TYPE string
  ASSERT $value IN ["active", "completed", "error"];
DEFINE FIELD created_at ON conversations TYPE datetime
  DEFAULT time::now();
DEFINE FIELD updated_at ON conversations TYPE datetime
  DEFAULT time::now();

-- Indexes for conversation queries
DEFINE INDEX idx_conversations_fruit ON conversations FIELDS fruit_id;
DEFINE INDEX idx_conversations_status ON conversations FIELDS status;
DEFINE INDEX idx_conversations_created ON conversations FIELDS created_at;

-- ====================================
-- MESSAGES TABLE
-- ====================================
-- Stores individual messages within conversations

DEFINE TABLE messages SCHEMAFULL;

-- Message fields
DEFINE FIELD conversation_id ON messages TYPE record<conversations>;
DEFINE FIELD role ON messages TYPE string
  ASSERT $value IN ["system", "user", "assistant"];
DEFINE FIELD content ON messages TYPE string;
DEFINE FIELD created_at ON messages TYPE datetime
  DEFAULT time::now();

-- Indexes for message queries
DEFINE INDEX idx_messages_conversation ON messages FIELDS conversation_id;
DEFINE INDEX idx_messages_created ON messages FIELDS created_at;
