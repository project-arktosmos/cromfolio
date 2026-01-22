/**
 * Trivia Fetch Service
 * Fetches trivia questions from multiple sources:
 * 1. The Trivia API - Semantic search by album title
 * 2. Wikipedia - Extract facts and convert to trivia
 * 3. ModelsLab AI - Generate custom trivia questions
 */

import type { Album, AlbumType } from '$types/album.type';
import type { Question, Difficulty, CorrectAnswer } from '$types/question.type';
import type {
	TheTriviaAPIQuestion,
	WikipediaSummary,
	ModelsLabResponse,
	ModelsLabQuestion,
	FetchedTrivia,
	TriviaFetchOptions,
	TriviaFetchResult,
	TriviaSource
} from '$types/trivia-api.type';

// API endpoints
const THE_TRIVIA_API_URL = 'https://the-trivia-api.com/v2/questions';
const WIKIPEDIA_API_URL = 'https://en.wikipedia.org/api/rest_v1/page/summary';
const MODELSLAB_API_URL = 'https://modelslab.com/api/v6/llm/uncensored_chat';

// Category mapping for The Trivia API
const ALBUM_TYPE_TO_TRIVIA_CATEGORY: Record<AlbumType, string> = {
	movie: 'film_and_tv',
	tv: 'film_and_tv',
	videogame: 'general_knowledge',
	anime: 'general_knowledge',
	musician: 'music',
	author: 'arts_and_literature',
	animal: 'science',
	sports_league: 'sport_and_leisure'
};

// Wikipedia title suffix by album type
const ALBUM_TYPE_TO_WIKI_SUFFIX: Record<AlbumType, string> = {
	movie: '(film)',
	tv: '(TV series)',
	videogame: '(video game)',
	anime: '(anime)',
	musician: '',
	author: '',
	animal: '',
	sports_league: ''
};

// Album type labels for prompts
const ALBUM_TYPE_LABELS: Record<AlbumType, string> = {
	movie: 'movie',
	tv: 'TV series',
	videogame: 'video game',
	anime: 'anime series',
	musician: 'musician/band',
	author: 'author',
	animal: 'animal species',
	sports_league: 'sports team/league'
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
	albumTitle: string,
	albumType: AlbumType,
	options?: { difficulty?: Difficulty; amount?: number }
): Promise<FetchedTrivia[]> {
	const category = ALBUM_TYPE_TO_TRIVIA_CATEGORY[albumType];
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
	albumTitle: string,
	albumType: AlbumType
): Promise<FetchedTrivia[]> {
	const suffix = ALBUM_TYPE_TO_WIKI_SUFFIX[albumType];
	const searchTitle = suffix ? `${albumTitle} ${suffix}` : albumTitle;
	const encodedTitle = encodeURIComponent(searchTitle.replace(/ /g, '_'));

	try {
		const response = await fetch(`${WIKIPEDIA_API_URL}/${encodedTitle}`);

		if (!response.ok) {
			// Try without suffix
			if (suffix) {
				const fallbackTitle = encodeURIComponent(albumTitle.replace(/ /g, '_'));
				const fallbackResponse = await fetch(`${WIKIPEDIA_API_URL}/${fallbackTitle}`);
				if (!fallbackResponse.ok) {
					throw new Error(`Wikipedia article not found for "${albumTitle}"`);
				}
				const data: WikipediaSummary = await fallbackResponse.json();
				return generateTriviaFromWikipedia(data, albumTitle, albumType);
			}
			throw new Error(`Wikipedia article not found for "${searchTitle}"`);
		}

		const data: WikipediaSummary = await response.json();
		return generateTriviaFromWikipedia(data, albumTitle, albumType);
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
	albumTitle: string,
	albumType: AlbumType
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
			questionText: `In what year was "${albumTitle}" released/created?`,
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
			const wrongDescriptions = generateWrongDescriptions(albumType);
			trivia.push({
				id: generateId(),
				source: 'wikipedia',
				questionText: `What is "${albumTitle}"?`,
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
		const nameMatch = match.match(
			/(?:directed by|created by|written by|developed by|by)\s+(.+)/i
		);
		if (nameMatch) {
			const name = nameMatch[1];
			const wrongNames = generateWrongNames();
			trivia.push({
				id: generateId(),
				source: 'wikipedia',
				questionText: `Who created/directed "${albumTitle}"?`,
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
 * Generate wrong descriptions based on album type
 */
function generateWrongDescriptions(albumType: AlbumType): string[] {
	const allTypes: Record<AlbumType, string> = {
		movie: 'American film',
		tv: 'Television series',
		videogame: 'Video game',
		anime: 'Japanese animated series',
		musician: 'Musical artist',
		author: 'American author',
		animal: 'Animal species',
		sports_league: 'Sports organization'
	};

	return Object.entries(allTypes)
		.filter(([type]) => type !== albumType)
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
 * Fetch trivia from ModelsLab AI
 */
export async function fetchFromModelsLab(
	albumTitle: string,
	albumType: AlbumType,
	amount: number = 5,
	apiKey: string
): Promise<FetchedTrivia[]> {
	const typeLabel = ALBUM_TYPE_LABELS[albumType];

	const prompt = `Generate exactly ${amount} trivia questions about "${albumTitle}" (${typeLabel}).

Return ONLY a valid JSON array with this exact structure, no other text:
[
  {
    "question": "question text here",
    "correct": "correct answer",
    "wrong": ["wrong answer 1", "wrong answer 2"],
    "difficulty": "easy"
  }
]

Rules:
- Each question should have exactly 2 wrong answers
- Difficulty must be "easy", "medium", or "hard"
- Questions should be factual about "${albumTitle}"
- Do not include any text before or after the JSON array`;

	try {
		const response = await fetch(MODELSLAB_API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				key: apiKey,
				messages: [
					{
						role: 'user',
						content: prompt
					}
				],
				max_tokens: 2000
			})
		});

		if (!response.ok) {
			throw new Error(`ModelsLab API error: ${response.status}`);
		}

		const data: ModelsLabResponse = await response.json();

		if (data.status !== 'success' || !data.output) {
			throw new Error(data.message || 'ModelsLab returned no output');
		}

		// Parse the JSON from the response
		const jsonMatch = data.output.match(/\[[\s\S]*\]/);
		if (!jsonMatch) {
			throw new Error('Could not parse trivia JSON from ModelsLab response');
		}

		const questions: ModelsLabQuestion[] = JSON.parse(jsonMatch[0]);

		return questions.map((q) => ({
			id: generateId(),
			source: 'modelslab' as TriviaSource,
			questionText: q.question,
			correctAnswer: q.correct,
			incorrectAnswers: q.wrong.slice(0, 2),
			difficulty: normalizeDifficulty(q.difficulty),
			selected: true
		}));
	} catch (error) {
		console.error('[trivia-fetch] ModelsLab error:', error);
		throw error;
	}
}

/**
 * Fetch trivia from all selected sources
 */
export async function fetchTriviaForAlbum(
	album: Album,
	options: TriviaFetchOptions,
	modelsLabApiKey?: string
): Promise<TriviaFetchResult> {
	const results: FetchedTrivia[] = [];
	const errors: { source: TriviaSource; message: string }[] = [];

	const promises: Promise<void>[] = [];

	if (options.sources.includes('thetriviaapi')) {
		promises.push(
			fetchFromTheTriviaAPI(album.title, album.albumType, {
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
			fetchFromWikipedia(album.title, album.albumType)
				.then((trivia) => {
					results.push(...trivia);
				})
				.catch((err) => {
					errors.push({ source: 'wikipedia', message: err.message });
				})
		);
	}

	if (options.sources.includes('modelslab') && modelsLabApiKey) {
		promises.push(
			fetchFromModelsLab(album.title, album.albumType, options.amount || 5, modelsLabApiKey)
				.then((trivia) => {
					results.push(...trivia);
				})
				.catch((err) => {
					errors.push({ source: 'modelslab', message: err.message });
				})
		);
	} else if (options.sources.includes('modelslab') && !modelsLabApiKey) {
		errors.push({ source: 'modelslab', message: 'API key not configured' });
	}

	await Promise.all(promises);

	return { trivia: results, errors };
}

/**
 * Convert FetchedTrivia to Question for database storage
 */
export function convertToQuestion(trivia: FetchedTrivia, albumId: string): Question {
	// Shuffle answers and assign to A, B, C
	const allAnswers = [trivia.correctAnswer, ...trivia.incorrectAnswers];
	const shuffled = shuffleArray(allAnswers);

	const correctIndex = shuffled.indexOf(trivia.correctAnswer);
	const correctAnswer: CorrectAnswer = (['a', 'b', 'c'] as const)[correctIndex];

	return {
		id: generateId(),
		albumId,
		questionText: trivia.questionText,
		answerA: shuffled[0] || '',
		answerB: shuffled[1] || '',
		answerC: shuffled[2] || '',
		correctAnswer,
		difficulty: trivia.difficulty
	};
}
