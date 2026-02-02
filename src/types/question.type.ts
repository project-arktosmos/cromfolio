/**
 * Trivia question types for source-based trivia games
 */

import type { ID } from '$types/core.type';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Question {
	id: ID;
	sourceId: ID;
	questionText: string;

	// The correct answer text
	correctAnswer: string;

	// All wrong answer options (stored as JSON array in DB)
	wrongAnswers: string[];

	// Optional difficulty level
	difficulty?: Difficulty;

	// Timestamps
	createdAt?: string;
	updatedAt?: string;
}
