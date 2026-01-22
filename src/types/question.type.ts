/**
 * Trivia question types for album-based trivia games
 */

import type { ID } from '$types/core.type';

export type CorrectAnswer = 'a' | 'b' | 'c';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Question {
	id: ID;
	albumId: ID;
	questionText: string;

	// ABC answer options
	answerA: string;
	answerB: string;
	answerC: string;

	// Correct answer: 'a', 'b', or 'c'
	correctAnswer: CorrectAnswer;

	// Optional difficulty level
	difficulty?: Difficulty;

	// Timestamps
	createdAt?: string;
	updatedAt?: string;
}
