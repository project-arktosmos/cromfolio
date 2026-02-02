/**
 * Pokemon Trivia Game Service
 *
 * Manages the Pokemon Trivia game state, question generation, scoring, and statistics.
 * All game logic is extracted from the component into this service.
 * Stats are persisted to SQLite via Tauri in the _user_game_stats table.
 */

import { invoke } from '@tauri-apps/api/core';
import type {
	TriviaStats,
	TriviaQuestion,
	TriviaAnswer,
	DifficultyConfig,
	GameDifficulty,
	TimerController,
	TimerState
} from '$types/game-state.type';
import type { PokemonTriviaTemplateV2 } from '$types/pokemon-trivia-template.type';

// ============================================================================
// Game Stats Types (from database)
// ============================================================================

interface UserGameStats {
	id: string;
	gameType: string;
	totalGamesPlayed: number;
	totalScore: number;
	bestScore: number;
	totalCorrect: number;
	totalWrong: number;
	bestStreak: number;
	longestGame: number;
	lastPlayedAt?: string;
	createdAt: string;
	updatedAt: string;
}

const GAME_TYPE = 'pokemon-trivia';

// ============================================================================
// Stats Service (SQLite persistence via Tauri)
// ============================================================================

/**
 * Get trivia stats from SQLite
 */
export async function getTriviaStats(): Promise<TriviaStats> {
	const stats = await invoke<UserGameStats | null>('get_user_game_stats', { gameType: GAME_TYPE });
	if (!stats) {
		return {
			id: 'pokemon-trivia-stats',
			totalGamesPlayed: 0,
			totalCorrect: 0,
			totalWrong: 0,
			bestStreak: 0,
			longestGame: 0
		};
	}
	return {
		id: stats.id,
		totalGamesPlayed: stats.totalGamesPlayed,
		totalCorrect: stats.totalCorrect,
		totalWrong: stats.totalWrong,
		bestStreak: stats.bestStreak,
		longestGame: stats.longestGame,
		lastPlayedAt: stats.lastPlayedAt
	};
}

// ============================================================================
// Difficulty Configuration
// ============================================================================

const DIFFICULTY_CONFIGS: Record<GameDifficulty, DifficultyConfig> = {
	easy: {
		maxLives: 3,
		timePerQuestion: 10,
		answerCount: 3,
		label: 'Easy',
		description: '3 lives, 10s per question'
	},
	hard: {
		maxLives: 1,
		timePerQuestion: 5,
		answerCount: 4,
		label: 'Hard',
		description: '1 life, 5s per question'
	}
};

/**
 * Get the configuration for a difficulty level
 */
export function getDifficultyConfig(difficulty: GameDifficulty): DifficultyConfig {
	return DIFFICULTY_CONFIGS[difficulty];
}

/**
 * Get all available difficulty configurations
 */
export function getAllDifficultyConfigs(): Record<GameDifficulty, DifficultyConfig> {
	return DIFFICULTY_CONFIGS;
}

// ============================================================================
// Question Generation
// ============================================================================

/**
 * Pokemon data structure for question generation
 */
export interface PokemonWithTags {
	id: string;
	name: string;
	image: string;
	tags: Record<string, string>;
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

/**
 * Select wrong answers for a question based on template criteria
 */
function selectWrongAnswers(
	correctPokemon: PokemonWithTags,
	pokemonPool: PokemonWithTags[],
	template: PokemonTriviaTemplateV2 | null,
	count: number
): PokemonWithTags[] {
	// Filter out the correct pokemon
	let candidates = pokemonPool.filter((p) => p.id !== correctPokemon.id);

	// If template has comparison config, parse it and filter by similar attributes
	if (template?.comparisonConfig) {
		try {
			const config = JSON.parse(template.comparisonConfig);
			const primaryAttr = template.primaryAttribute;
			const correctValue = correctPokemon.tags[primaryAttr];

			// Use comparison config if it specifies wrong answer filtering
			if (config.scope && correctValue) {
				// Filter candidates based on scope
				const scopeAttr = Object.keys(config.scope)[0];
				if (scopeAttr) {
					const scopeValue = config.scope[scopeAttr];
					candidates = candidates.filter((p) => p.tags[scopeAttr] === scopeValue);
				}
			}
		} catch {
			// Ignore parse errors, use default candidates
		}
	}

	// If we don't have enough candidates, fall back to full pool
	if (candidates.length < count) {
		candidates = pokemonPool.filter((p) => p.id !== correctPokemon.id);
	}

	// Shuffle and take required count
	return shuffleArray(candidates).slice(0, count);
}

/**
 * Generate a trivia question based on a template
 */
export function generateQuestion(
	pokemonPool: PokemonWithTags[],
	templates: PokemonTriviaTemplateV2[],
	wrongAnswerCount: number
): TriviaQuestion | null {
	if (pokemonPool.length < wrongAnswerCount + 1 || templates.length === 0) {
		return null;
	}

	// Select a random template
	const template = templates[Math.floor(Math.random() * templates.length)];

	// Select the correct pokemon
	const shuffledPool = shuffleArray(pokemonPool);
	const correctPokemon = shuffledPool[0];

	// Select wrong answers
	const wrongAnswers = selectWrongAnswers(correctPokemon, pokemonPool, template, wrongAnswerCount);

	// Build question text
	let questionText = template.questionTemplate;
	const primaryAttr = template.primaryAttribute;
	const attributeValue = correctPokemon.tags[primaryAttr] || 'Unknown';

	// Replace placeholders in question template
	questionText = questionText.replace('{value}', attributeValue);
	questionText = questionText.replace('{pokemon}', correctPokemon.name);
	questionText = questionText.replace('{name}', correctPokemon.name);

	// Build answers
	const answers: TriviaAnswer[] = [
		{
			text: correctPokemon.name,
			pokemonId: correctPokemon.id,
			pokemonName: correctPokemon.name,
			pokemonImage: correctPokemon.image,
			isCorrect: true,
			attributeValue
		},
		...wrongAnswers.map((p) => ({
			text: p.name,
			pokemonId: p.id,
			pokemonName: p.name,
			pokemonImage: p.image,
			isCorrect: false,
			attributeValue: p.tags[primaryAttr]
		}))
	];

	// Shuffle answers so correct isn't always first
	const shuffledAnswers = shuffleArray(answers);

	return {
		text: questionText,
		answers: shuffledAnswers,
		correctPokemonId: correctPokemon.id,
		correctPokemonName: correctPokemon.name,
		correctPokemonImage: correctPokemon.image,
		showsPokemonImage: template.templateType !== 'reverse_lookup',
		primaryAttribute: primaryAttr
	};
}

/**
 * Generate a simple "Who's that Pokemon?" question (no template)
 */
export function generateSimpleQuestion(
	pokemonPool: PokemonWithTags[],
	wrongAnswerCount: number
): TriviaQuestion | null {
	if (pokemonPool.length < wrongAnswerCount + 1) {
		return null;
	}

	const shuffled = shuffleArray(pokemonPool);
	const correctPokemon = shuffled[0];
	const wrongAnswers = shuffled.slice(1, wrongAnswerCount + 1);

	const answers: TriviaAnswer[] = shuffleArray([
		{
			text: correctPokemon.name,
			pokemonId: correctPokemon.id,
			pokemonName: correctPokemon.name,
			pokemonImage: correctPokemon.image,
			isCorrect: true
		},
		...wrongAnswers.map((p) => ({
			text: p.name,
			pokemonId: p.id,
			pokemonName: p.name,
			pokemonImage: p.image,
			isCorrect: false
		}))
	]);

	return {
		text: "Who's that Pokemon?",
		answers,
		correctPokemonId: correctPokemon.id,
		correctPokemonName: correctPokemon.name,
		correctPokemonImage: correctPokemon.image,
		showsPokemonImage: true
	};
}

// ============================================================================
// Scoring
// ============================================================================

/**
 * Calculate progress percentage
 */
export function calculateProgressPercentage(currentIndex: number, total: number): number {
	return Math.round((currentIndex / total) * 100);
}

/**
 * Check if game is complete
 */
export function isGameComplete(currentIndex: number, total: number): boolean {
	return currentIndex >= total;
}

/**
 * Update stats after a game (async - uses SQLite via Tauri)
 */
export async function updateStatsAfterGame(
	correctAnswers: number,
	wrongAnswers: number,
	streak: number
): Promise<TriviaStats> {
	// Use the record_user_game Tauri command which handles all stat updates atomically
	const stats = await invoke<UserGameStats>('record_user_game', {
		gameType: GAME_TYPE,
		score: 0, // Trivia doesn't track score, just correct/wrong
		correct: correctAnswers,
		wrong: wrongAnswers,
		streak
	});

	return {
		id: stats.id,
		totalGamesPlayed: stats.totalGamesPlayed,
		totalCorrect: stats.totalCorrect,
		totalWrong: stats.totalWrong,
		bestStreak: stats.bestStreak,
		longestGame: stats.longestGame,
		lastPlayedAt: stats.lastPlayedAt
	};
}

/**
 * Get accuracy percentage
 */
export function getAccuracyPercentage(correct: number, wrong: number): number {
	const total = correct + wrong;
	if (total === 0) return 0;
	return Math.round((correct / total) * 100);
}

// ============================================================================
// Timer
// ============================================================================

/**
 * Create a countdown timer controller
 */
export function createTimer(
	duration: number,
	onTick: (remaining: number) => void,
	onComplete: () => void
): TimerController {
	let intervalId: ReturnType<typeof setInterval> | null = null;
	let state: TimerState = {
		remaining: duration,
		total: duration,
		isRunning: false,
		isPaused: false
	};

	const tick = () => {
		if (state.remaining > 0) {
			state.remaining -= 1;
			onTick(state.remaining);
		} else {
			stop();
			onComplete();
		}
	};

	const start = () => {
		if (state.isRunning) return;
		state.isRunning = true;
		state.isPaused = false;
		intervalId = setInterval(tick, 1000);
	};

	const stop = () => {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
		state.isRunning = false;
		state.isPaused = false;
	};

	const pause = () => {
		if (!state.isRunning || state.isPaused) return;
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
		state.isPaused = true;
	};

	const resume = () => {
		if (!state.isPaused) return;
		state.isPaused = false;
		intervalId = setInterval(tick, 1000);
	};

	const reset = (newDuration?: number) => {
		stop();
		state = {
			remaining: newDuration ?? duration,
			total: newDuration ?? duration,
			isRunning: false,
			isPaused: false
		};
	};

	const getState = () => ({ ...state });

	return { start, stop, pause, resume, reset, getState };
}
