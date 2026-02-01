/**
 * Types for trivia fetching from external APIs
 */

import type { Difficulty } from '$types/question.type';

// The Trivia API response types
export interface TheTriviaAPIQuestion {
	id: string;
	category: string;
	question: { text: string };
	correctAnswer: string;
	incorrectAnswers: string[];
	difficulty: string;
}

export interface TheTriviaAPIResponse {
	questions: TheTriviaAPIQuestion[];
}

// Wikipedia summary response
export interface WikipediaSummary {
	title: string;
	extract: string;
	description?: string;
	content_urls?: {
		desktop: { page: string };
	};
}

// Source identifiers
export type TriviaSource = 'thetriviaapi' | 'wikipedia';

// Normalized trivia for preview before import
export interface FetchedTrivia {
	id: string;
	source: TriviaSource;
	questionText: string;
	correctAnswer: string;
	incorrectAnswers: string[];
	difficulty: Difficulty;
	selected: boolean;
}

// Fetch options
export interface TriviaFetchOptions {
	sources: TriviaSource[];
	difficulty?: Difficulty;
	amount?: number;
}

// Fetch result with source info
export interface TriviaFetchResult {
	trivia: FetchedTrivia[];
	errors: { source: TriviaSource; message: string }[];
}
