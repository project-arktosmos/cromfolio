/**
 * Trivia Fetch Service
 * Fetches trivia questions from multiple sources:
 * 1. The Trivia API - Semantic search by album title
 * 2. Wikipedia - Extract facts and convert to trivia
 */

import type { ID } from '$types/core.type';
import type { Source, SourceType } from '$types/source.type';
import type { Question, Difficulty } from '$types/question.type';
import type {
	TheTriviaAPIQuestion,
	WikipediaSummary,
	FetchedTrivia,
	TriviaFetchOptions,
	TriviaFetchResult,
	TriviaSource
} from '$types/trivia-api.type';

// API endpoints
const THE_TRIVIA_API_URL = 'https://the-trivia-api.com/v2/questions';
const WIKIPEDIA_API_URL = 'https://en.wikipedia.org/api/rest_v1/page/summary';

// Category mapping for The Trivia API
const SOURCE_TYPE_TO_TRIVIA_CATEGORY: Record<SourceType, string> = {
	movie: 'film_and_tv',
	tv: 'film_and_tv',
	videogame: 'general_knowledge',
	anime: 'general_knowledge',
	animal: 'science',
	sports_league: 'sport_and_leisure',
	award_list: 'film_and_tv',
	grammy: 'music',
	game_console: 'general_knowledge'
};

// Wikipedia title suffix by source type
const SOURCE_TYPE_TO_WIKI_SUFFIX: Record<SourceType, string> = {
	movie: '(film)',
	tv: '(TV series)',
	videogame: '(video game)',
	anime: '(anime)',
	animal: '',
	sports_league: '',
	award_list: '',
	grammy: '',
	game_console: '(video game)'
};

/**
 * Decode HTML entities in text
 */
function decodeHtmlEntities(text: string): string {
	const textarea = document.createElement('textarea');
	textarea.innerHTML = text;
	return textarea.value;
}

/**
 * Generate a unique ID
 */
function generateId(): string {
	return crypto.randomUUID();
}

/**
 * Shuffle an array
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
 * Normalize difficulty string to our format
 */
function normalizeDifficulty(diff: string | undefined): Difficulty {
	const lower = (diff || '').toLowerCase();
	if (lower === 'easy') return 'easy';
	if (lower === 'medium') return 'medium';
	if (lower === 'hard') return 'hard';
	return 'medium'; // default
}

/**
 * Fetch trivia from The Trivia API
 */
export async function fetchFromTheTriviaAPI(
	sourceTitle: string,
	sourceType: SourceType,
	options?: { difficulty?: Difficulty; amount?: number }
): Promise<FetchedTrivia[]> {
	const category = SOURCE_TYPE_TO_TRIVIA_CATEGORY[sourceType];
	const amount = options?.amount || 10;

	const params = new URLSearchParams({
		categories: category,
		limit: amount.toString()
	});

	// Add difficulty if specified
	if (options?.difficulty) {
		params.set('difficulties', options.difficulty);
	}

	try {
		const response = await fetch(`${THE_TRIVIA_API_URL}?${params}`);

		if (!response.ok) {
			throw new Error(`The Trivia API error: ${response.status}`);
		}

		const questions: TheTriviaAPIQuestion[] = await response.json();

		return questions.map((q) => ({
			id: generateId(),
			source: 'thetriviaapi' as TriviaSource,
			questionText: decodeHtmlEntities(q.question.text),
			correctAnswer: decodeHtmlEntities(q.correctAnswer),
			incorrectAnswers: q.incorrectAnswers.map(decodeHtmlEntities),
			difficulty: normalizeDifficulty(q.difficulty),
			selected: true
		}));
	} catch (error) {
		console.error('[trivia-fetch] The Trivia API error:', error);
		throw error;
	}
}

/**
 * Fetch Wikipedia summary and generate trivia questions
 */
export async function fetchFromWikipedia(
	sourceTitle: string,
	sourceType: SourceType
): Promise<FetchedTrivia[]> {
	const suffix = SOURCE_TYPE_TO_WIKI_SUFFIX[sourceType];
	const searchTitle = suffix ? `${sourceTitle} ${suffix}` : sourceTitle;
	const encodedTitle = encodeURIComponent(searchTitle.replace(/ /g, '_'));

	try {
		const response = await fetch(`${WIKIPEDIA_API_URL}/${encodedTitle}`);

		if (!response.ok) {
			// Try without suffix
			if (suffix) {
				const fallbackTitle = encodeURIComponent(sourceTitle.replace(/ /g, '_'));
				const fallbackResponse = await fetch(`${WIKIPEDIA_API_URL}/${fallbackTitle}`);
				if (!fallbackResponse.ok) {
					throw new Error(`Wikipedia article not found for "${sourceTitle}"`);
				}
				const data: WikipediaSummary = await fallbackResponse.json();
				return generateTriviaFromWikipedia(data, sourceTitle, sourceType);
			}
			throw new Error(`Wikipedia article not found for "${searchTitle}"`);
		}

		const data: WikipediaSummary = await response.json();
		return generateTriviaFromWikipedia(data, sourceTitle, sourceType);
	} catch (error) {
		console.error('[trivia-fetch] Wikipedia error:', error);
		throw error;
	}
}

/**
 * Generate trivia questions from Wikipedia summary
 */
function generateTriviaFromWikipedia(
	data: WikipediaSummary,
	sourceTitle: string,
	sourceType: SourceType
): FetchedTrivia[] {
	const trivia: FetchedTrivia[] = [];
	const extract = data.extract || '';

	// Extract year (look for 4-digit years in the first sentence)
	const yearMatch = extract.match(/\b(19\d{2}|20\d{2})\b/);
	if (yearMatch) {
		const year = yearMatch[1];
		const wrongYears = generateWrongYears(parseInt(year));
		trivia.push({
			id: generateId(),
			source: 'wikipedia',
			questionText: `In what year was "${sourceTitle}" released/created?`,
			correctAnswer: year,
			incorrectAnswers: wrongYears,
			difficulty: 'medium',
			selected: true
		});
	}

	// Extract description if available
	if (data.description) {
		const descParts = data.description.split(' ');
		if (descParts.length >= 2) {
			// Use description for a "what type" question
			const wrongDescriptions = generateWrongDescriptions(sourceType);
			trivia.push({
				id: generateId(),
				source: 'wikipedia',
				questionText: `What is "${sourceTitle}"?`,
				correctAnswer: capitalizeFirst(data.description),
				incorrectAnswers: wrongDescriptions,
				difficulty: 'easy',
				selected: true
			});
		}
	}

	// Extract names (potential creators/directors/authors)
	const nameMatches = extract.match(
		/(?:directed by|created by|written by|developed by|by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi
	);
	if (nameMatches && nameMatches.length > 0) {
		const match = nameMatches[0];
		const nameMatch = match.match(/(?:directed by|created by|written by|developed by|by)\s+(.+)/i);
		if (nameMatch) {
			const name = nameMatch[1];
			const wrongNames = generateWrongNames();
			trivia.push({
				id: generateId(),
				source: 'wikipedia',
				questionText: `Who created/directed "${sourceTitle}"?`,
				correctAnswer: name,
				incorrectAnswers: wrongNames,
				difficulty: 'hard',
				selected: true
			});
		}
	}

	return trivia;
}

/**
 * Generate wrong years close to the correct year
 */
function generateWrongYears(correctYear: number): string[] {
	const offsets = shuffleArray([-3, -2, -1, 1, 2, 3]);
	return offsets.slice(0, 2).map((offset) => String(correctYear + offset));
}

/**
 * Generate wrong descriptions based on source type
 */
function generateWrongDescriptions(sourceType: SourceType): string[] {
	const allTypes: Record<SourceType, string> = {
		movie: 'American film',
		tv: 'Television series',
		videogame: 'Video game',
		anime: 'Japanese animated series',
		animal: 'Animal species',
		sports_league: 'Sports organization',
		award_list: 'Award ceremony',
		grammy: 'Grammy-winning music',
		game_console: 'Console video game'
	};

	return Object.entries(allTypes)
		.filter(([type]) => type !== sourceType)
		.slice(0, 2)
		.map(([, desc]) => desc);
}

/**
 * Generate wrong names (generic famous names)
 */
function generateWrongNames(): string[] {
	const names = [
		'Steven Spielberg',
		'Christopher Nolan',
		'James Cameron',
		'Quentin Tarantino',
		'Martin Scorsese',
		'Ridley Scott',
		'David Fincher',
		'Denis Villeneuve'
	];
	return shuffleArray(names).slice(0, 2);
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Fetch trivia from all selected sources
 */
export async function fetchTriviaForSource(
	source: Source,
	options: TriviaFetchOptions
): Promise<TriviaFetchResult> {
	const results: FetchedTrivia[] = [];
	const errors: { source: TriviaSource; message: string }[] = [];

	const promises: Promise<void>[] = [];

	if (options.sources.includes('thetriviaapi')) {
		promises.push(
			fetchFromTheTriviaAPI(source.title, source.sourceType, {
				difficulty: options.difficulty,
				amount: options.amount
			})
				.then((trivia) => {
					results.push(...trivia);
				})
				.catch((err) => {
					errors.push({ source: 'thetriviaapi', message: err.message });
				})
		);
	}

	if (options.sources.includes('wikipedia')) {
		promises.push(
			fetchFromWikipedia(source.title, source.sourceType)
				.then((trivia) => {
					results.push(...trivia);
				})
				.catch((err) => {
					errors.push({ source: 'wikipedia', message: err.message });
				})
		);
	}

	await Promise.all(promises);

	return { trivia: results, errors };
}

/**
 * Convert FetchedTrivia to Question for database storage
 * Uses new schema: correctAnswer (text) + wrongAnswers (array)
 */
export function convertToQuestion(trivia: FetchedTrivia, sourceId: ID): Question {
	return {
		id: generateId(),
		sourceId,
		questionText: trivia.questionText,
		correctAnswer: trivia.correctAnswer,
		wrongAnswers: trivia.incorrectAnswers,
		difficulty: trivia.difficulty
	};
}
