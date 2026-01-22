/**
 * Quote Types
 * Type definitions for quotes from various APIs
 */

export interface Quote {
	id: string;
	content: string;
	author: string; // Page title or speaker name
	speaker?: string; // Who said the quote (for dialogues)
	source?: string; // Where it's from (anime, movie, book, etc.)
	context?: string; // Episode, chapter, scene info
	section?: string; // Section heading from the page
	tags?: string[];
	apiSource: QuoteApiSource;
}

export type QuoteApiSource = 'wikiquote' | 'animechan';

export interface QuoteSearchParams {
	query: string;
	limit?: number;
}

export interface QuoteSearchResult {
	quotes: Quote[];
	source: QuoteApiSource;
	error?: string;
}

// Animechan types
export interface AnimechanQuote {
	id: number;
	quote: string;
	character: {
		id: number;
		name: string;
	};
	anime: {
		id: number;
		name: string;
	};
}

export interface AnimechanResponse {
	status: string;
	data: AnimechanQuote[];
}
