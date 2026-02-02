/**
 * Quotes Service
 * Provides functions for searching quotes from multiple APIs:
 * - Wikiquote (general quotes, real people - free, no key required)
 * - Animechan (anime character quotes - free, no key required)
 *
 * Rate limits:
 * - Wikiquote: No strict limit (be reasonable)
 * - Animechan: 20 requests/hour (free tier)
 */

import type {
	Quote,
	QuoteSearchResult,
	AnimechanQuote,
	AnimechanResponse
} from '$types/quotes.type';
import { getQuotes as getWikiquotes } from './wikiquote.service';

const ANIMECHAN_BASE_URL = 'https://api.animechan.io/v1';

/**
 * Convert Animechan quote to unified format
 */
function animechanToQuote(q: AnimechanQuote): Quote {
	return {
		id: `animechan-${q.id}`,
		content: q.quote,
		author: q.anime.name,
		speaker: q.character.name,
		source: q.anime.name,
		apiSource: 'animechan'
	};
}

/**
 * Search quotes from Wikiquote
 */
export async function searchWikiquote(query: string, limit = 20): Promise<QuoteSearchResult> {
	try {
		const { quotes, pageTitle } = await getWikiquotes(query, limit);

		if (quotes.length === 0) {
			return {
				quotes: [],
				source: 'wikiquote',
				error: pageTitle ? 'No quotes found on this page' : 'No matching page found'
			};
		}

		return {
			quotes: quotes.map((q, i) => ({
				id: `wikiquote-${i}-${Date.now()}`,
				content: q.text,
				author: q.speaker || pageTitle || query,
				speaker: q.speaker,
				source: pageTitle || undefined,
				context: q.context,
				section: q.section,
				apiSource: 'wikiquote' as const
			})),
			source: 'wikiquote'
		};
	} catch (error) {
		console.error('[quotes.service] searchWikiquote error:', error);
		return {
			quotes: [],
			source: 'wikiquote',
			error: error instanceof Error ? error.message : 'Failed to search Wikiquote'
		};
	}
}

/**
 * Search anime quotes from Animechan by character name
 * https://animechan.io
 */
export async function searchAnimechan(
	characterName: string,
	limit = 10
): Promise<QuoteSearchResult> {
	try {
		const response = await fetch(
			`${ANIMECHAN_BASE_URL}/quotes?character=${encodeURIComponent(characterName)}&limit=${limit}`
		);

		if (!response.ok) {
			if (response.status === 404) {
				return {
					quotes: [],
					source: 'animechan',
					error: 'No anime quotes found for this character'
				};
			}
			if (response.status === 429) {
				return {
					quotes: [],
					source: 'animechan',
					error: 'Rate limited - try again later'
				};
			}
			throw new Error(`Animechan API error: ${response.status}`);
		}

		const data: AnimechanResponse = await response.json();

		return {
			quotes: (data.data || []).map(animechanToQuote),
			source: 'animechan'
		};
	} catch (error) {
		console.error('[quotes.service] searchAnimechan error:', error);
		return {
			quotes: [],
			source: 'animechan',
			error: error instanceof Error ? error.message : 'Failed to search Animechan'
		};
	}
}

/**
 * Search all available quote APIs in parallel
 */
export async function searchAllQuotes(
	query: string,
	limit = 20
): Promise<{
	results: QuoteSearchResult[];
	totalQuotes: number;
}> {
	const searches = [searchWikiquote(query, limit), searchAnimechan(query, limit)];

	const results = await Promise.all(searches);
	const totalQuotes = results.reduce((sum, r) => sum + r.quotes.length, 0);

	return {
		results,
		totalQuotes
	};
}
