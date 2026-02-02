/**
 * Game State Types
 *
 * Types for managing game state in the /game routes.
 * These types are used by game services and components.
 */

import type { ID } from './core.type';

// ============================================================================
// Pokemon Trivia Game Types
// ============================================================================

/**
 * View states for the Pokemon Trivia game
 */
export type TriviaViewState =
	| 'collection-select'
	| 'difficulty-select'
	| 'playing'
	| 'question-result'
	| 'game-over'
	| 'booster-reveal';

/**
 * Difficulty levels for the trivia game
 */
export type GameDifficulty = 'easy' | 'hard';

/**
 * Configuration for a difficulty level
 */
export interface DifficultyConfig {
	/** Number of lives (wrong answers allowed before game over) */
	maxLives: number;
	/** Time per question in seconds */
	timePerQuestion: number;
	/** Number of answer options to display */
	answerCount: number;
	/** Human-readable label */
	label: string;
	/** Description of this difficulty */
	description: string;
}

/**
 * Persistent trivia stats (stored in localStorage)
 */
export interface TriviaStats {
	id: string;
	totalGamesPlayed: number;
	totalCorrect: number;
	totalWrong: number;
	bestStreak?: number;
	longestGame?: number;
	lastPlayedAt?: string; // ISO date
}

/**
 * Current trivia game state (in-memory during gameplay)
 */
export interface TriviaGameState {
	viewState: TriviaViewState;
	selectedCollectionId: ID | null;
	selectedDifficulty: GameDifficulty;
	currentQuestionIndex: number;
	correctAnswers: number;
	wrongAnswers: number;
	timeRemaining: number;
	hasAnswered: boolean;
	selectedAnswerIndex: number | null;
	currentStreak: number;
}

/**
 * A single trivia answer option
 */
export interface TriviaAnswer {
	/** Display text for the answer */
	text: string;
	/** ID of the Pokemon this answer represents */
	pokemonId: ID;
	/** Name of the Pokemon */
	pokemonName: string;
	/** Image URL for the Pokemon */
	pokemonImage: string;
	/** Whether this is the correct answer */
	isCorrect: boolean;
	/** The attribute value if relevant to the question */
	attributeValue?: string;
}

/**
 * A trivia question
 */
export interface TriviaQuestion {
	/** The question text */
	text: string;
	/** Available answer options */
	answers: TriviaAnswer[];
	/** ID of the correct Pokemon */
	correctPokemonId: ID;
	/** Name of the correct Pokemon */
	correctPokemonName: string;
	/** Image URL for the correct Pokemon */
	correctPokemonImage: string;
	/** Whether to show the Pokemon image in the question */
	showsPokemonImage: boolean;
	/** The primary attribute being tested (e.g., 'type', 'generation') */
	primaryAttribute?: string;
}

// ============================================================================
// Album View Types
// ============================================================================

/**
 * Album view state for spread navigation
 */
export interface AlbumViewState {
	selectedCollectionId: ID | null;
	currentSpread: number;
	isFlipping: boolean;
	flipDirection: 'forward' | 'backward' | null;
	targetSpread: number | null;
}

/**
 * Album flip animation configuration
 */
export interface FlipAnimationConfig {
	duration: number; // milliseconds
	easing: string; // CSS easing function
}

// ============================================================================
// Collection Stats Types
// ============================================================================

/**
 * Detailed statistics for a collection
 */
export interface CollectionDetailedStats {
	/** Total number of stickers in collection */
	total: number;
	/** Number of unique stickers owned */
	owned: number;
	/** Count of stickers by rarity ID */
	rarityBreakdown: Map<string, number>;
	/** Weighted completion score */
	completionScore: number;
	/** Maximum possible completion score */
	maxCompletionScore: number;
	/** Completion percentage (0-100) */
	completionPercent: number;
}

/**
 * Cache for collection statistics
 */
export interface CollectionStatsCache {
	/** Stats keyed by collection ID */
	stats: Map<string, CollectionDetailedStats>;
	/** Set of owned sticker IDs */
	ownedStickerIds: Set<string>;
	/** Map of sticker ID to best rarity ID */
	stickerRarityMap: Map<string, string>;
	/** Cache of copy counts by sticker ID */
	copyCountCache: Map<string, number>;
	/** Timestamp when cache was last updated */
	lastUpdated: number;
}

// ============================================================================
// Booster Pack Types
// ============================================================================

/**
 * Configuration for booster pack opening
 */
export interface BoosterPackConfig {
	/** Number of stickers per pack */
	packSize: number;
	/** Maximum rarity sort order to include */
	maxRaritySortOrder: number;
	/** Weights for random selection by rarity */
	rarityWeights?: Record<string, number>;
}

/**
 * Result of opening a booster pack
 */
export interface BoosterPackResult {
	/** Stickers received in the pack */
	stickerIds: ID[];
	/** Collection the pack was from */
	collectionId: ID;
	/** Whether any stickers were new (not previously owned) */
	hasNewStickers: boolean;
	/** Count of new vs duplicate stickers */
	newCount: number;
	duplicateCount: number;
}

// ============================================================================
// Sticker Mixing Types
// ============================================================================

/**
 * A group of owned stickers with the same sticker and rarity
 */
export interface OwnedStickerGroup {
	stickerId: string;
	rarityId: string;
	count: number;
	sticker: {
		id: string;
		name: string;
		image: string;
		sourceId: string;
	};
	rarity: {
		id: string;
		name: string;
		sortOrder: number;
		color?: string;
	} | null;
	sourceId: string;
}

/**
 * Result of mixing stickers
 */
export interface MixResult {
	/** The new sticker created */
	newStickerId: string;
	/** The rarity of the new sticker */
	newRarityId: string;
	/** Number of stickers consumed */
	consumed: number;
	/** Whether the mix was successful */
	success: boolean;
}

// ============================================================================
// Placement Mode Types
// ============================================================================

/**
 * State for stamp/icon placement mode
 */
export interface PlacementState {
	isActive: boolean;
	scale: number;
	position: { x: number; y: number };
	itemType: 'stamp' | 'icon';
	itemId: string | null;
}

/**
 * Configuration for placement mode
 */
export interface PlacementConfig {
	minScale: number;
	maxScale: number;
	scaleStep: number;
	defaultScale: number;
}

// ============================================================================
// Timer Types
// ============================================================================

/**
 * Timer state for countdown functionality
 */
export interface TimerState {
	remaining: number; // seconds
	total: number; // seconds
	isRunning: boolean;
	isPaused: boolean;
}

/**
 * Timer controller interface
 */
export interface TimerController {
	start: () => void;
	stop: () => void;
	pause: () => void;
	resume: () => void;
	reset: (duration?: number) => void;
	getState: () => TimerState;
}
