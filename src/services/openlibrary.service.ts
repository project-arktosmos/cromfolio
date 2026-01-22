/**
 * Open Library Service
 * Provides functions for searching book authors and their works via the Open Library API
 *
 * Open Library API is free and doesn't require authentication
 * Docs: https://openlibrary.org/developers/api
 */

const OPENLIBRARY_BASE_URL = 'https://openlibrary.org';
const COVERS_BASE_URL = 'https://covers.openlibrary.org';

// Open Library API interfaces
export interface OLAuthorSearchDoc {
	key: string; // e.g., "OL23919A"
	name: string;
	alternate_names?: string[];
	birth_date?: string;
	death_date?: string;
	top_work?: string;
	work_count?: number;
	top_subjects?: string[];
}

export interface OLAuthorSearchResult {
	numFound: number;
	start: number;
	numFoundExact: boolean;
	docs: OLAuthorSearchDoc[];
}

export interface OLWork {
	key: string; // e.g., "/works/OL45883W"
	title: string;
	authors?: { author: { key: string }; type?: { key: string } }[];
	first_publish_date?: string;
	description?: string | { type: string; value: string };
	subjects?: string[];
	covers?: number[];
}

export interface OLAuthorWorksResult {
	links: { self: string; author: string; next?: string };
	size: number;
	entries: OLWork[];
}

export interface OLAuthorDetails {
	key: string;
	name: string;
	personal_name?: string;
	alternate_names?: string[];
	birth_date?: string;
	death_date?: string;
	bio?: string | { type: string; value: string };
	photos?: number[];
	links?: { url: string; title: string; type?: { key: string } }[];
}

/**
 * Search for authors on Open Library
 */
export async function searchAuthors(
	query: string,
	limit = 20
): Promise<OLAuthorSearchResult | { error: string }> {
	try {
		const url = `${OPENLIBRARY_BASE_URL}/search/authors.json?q=${encodeURIComponent(query)}&limit=${limit}`;
		const response = await fetch(url);

		if (!response.ok) {
			console.error('[openlibrary.service] Author search failed:', response.status);
			return { error: `Open Library API error: ${response.status}` };
		}

		return await response.json();
	} catch (error) {
		console.error('[openlibrary.service] searchAuthors error:', error);
		return { error: 'Failed to search Open Library authors' };
	}
}

/**
 * Get author details by author key
 */
export async function getAuthorDetails(
	authorKey: string
): Promise<OLAuthorDetails | { error: string }> {
	try {
		// authorKey can be just the ID (e.g., "OL23919A") or full path ("/authors/OL23919A")
		const cleanKey = authorKey.replace('/authors/', '');
		const url = `${OPENLIBRARY_BASE_URL}/authors/${cleanKey}.json`;
		const response = await fetch(url);

		if (!response.ok) {
			console.error('[openlibrary.service] Author details fetch failed:', response.status);
			return { error: `Open Library API error: ${response.status}` };
		}

		return await response.json();
	} catch (error) {
		console.error('[openlibrary.service] getAuthorDetails error:', error);
		return { error: 'Failed to fetch author details' };
	}
}

/**
 * Get works by an author
 */
export async function getAuthorWorks(
	authorKey: string,
	limit = 50,
	offset = 0
): Promise<OLAuthorWorksResult | { error: string }> {
	try {
		// authorKey can be just the ID (e.g., "OL23919A") or full path ("/authors/OL23919A")
		const cleanKey = authorKey.replace('/authors/', '');
		const url = `${OPENLIBRARY_BASE_URL}/authors/${cleanKey}/works.json?limit=${limit}&offset=${offset}`;
		const response = await fetch(url);

		if (!response.ok) {
			console.error('[openlibrary.service] Author works fetch failed:', response.status);
			return { error: `Open Library API error: ${response.status}` };
		}

		return await response.json();
	} catch (error) {
		console.error('[openlibrary.service] getAuthorWorks error:', error);
		return { error: 'Failed to fetch author works' };
	}
}

/**
 * Search for works/books on Open Library
 */
export async function searchWorks(
	query: string,
	limit = 20
): Promise<{ numFound: number; docs: OLWorkSearchDoc[] } | { error: string }> {
	try {
		const url = `${OPENLIBRARY_BASE_URL}/search.json?q=${encodeURIComponent(query)}&limit=${limit}`;
		const response = await fetch(url);

		if (!response.ok) {
			console.error('[openlibrary.service] Works search failed:', response.status);
			return { error: `Open Library API error: ${response.status}` };
		}

		return await response.json();
	} catch (error) {
		console.error('[openlibrary.service] searchWorks error:', error);
		return { error: 'Failed to search Open Library works' };
	}
}

export interface OLWorkSearchDoc {
	key: string; // e.g., "/works/OL45883W"
	title: string;
	author_key?: string[];
	author_name?: string[];
	first_publish_year?: number;
	edition_count?: number;
	subject?: string[];
	cover_i?: number;
	isbn?: string[];
	publisher?: string[];
}

/**
 * Get cover image URL for a book
 * @param coverId - The cover ID from Open Library
 * @param size - Image size: 'S' (small), 'M' (medium), 'L' (large)
 */
export function getCoverUrl(coverId: number, size: 'S' | 'M' | 'L' = 'M'): string {
	return `${COVERS_BASE_URL}/b/id/${coverId}-${size}.jpg`;
}

/**
 * Get author photo URL
 * @param authorKey - The author's Open Library ID (e.g., "OL23919A")
 * @param size - Image size: 'S' (small), 'M' (medium), 'L' (large)
 */
export function getAuthorPhotoUrl(authorKey: string, size: 'S' | 'M' | 'L' = 'M'): string {
	const cleanKey = authorKey.replace('/authors/', '');
	return `${COVERS_BASE_URL}/a/olid/${cleanKey}-${size}.jpg`;
}

/**
 * Transform Open Library author search result to our format
 */
export function transformAuthor(author: OLAuthorSearchDoc): {
	key: string;
	name: string;
	alternateNames?: string[];
	birthDate?: string;
	deathDate?: string;
	topWork?: string;
	workCount?: number;
	topSubjects?: string[];
	imageUrl?: string;
} {
	return {
		key: author.key,
		name: author.name,
		alternateNames: author.alternate_names,
		birthDate: author.birth_date,
		deathDate: author.death_date,
		topWork: author.top_work,
		workCount: author.work_count,
		topSubjects: author.top_subjects?.slice(0, 10),
		imageUrl: getAuthorPhotoUrl(author.key, 'M')
	};
}

/**
 * Transform Open Library work search result to our format
 */
export function transformWorkSearch(work: OLWorkSearchDoc): {
	key: string;
	title: string;
	authorKey?: string;
	authorName?: string;
	firstPublishYear?: number;
	editionCount?: number;
	subjects?: string[];
	imageUrl?: string;
	publisher?: string;
} {
	return {
		key: work.key,
		title: work.title,
		authorKey: work.author_key?.[0],
		authorName: work.author_name?.[0],
		firstPublishYear: work.first_publish_year,
		editionCount: work.edition_count,
		subjects: work.subject?.slice(0, 10),
		imageUrl: work.cover_i ? getCoverUrl(work.cover_i, 'M') : undefined,
		publisher: work.publisher?.[0]
	};
}

/**
 * Transform Open Library work from author's works list to our format
 */
export function transformWork(
	work: OLWork,
	authorKey?: string,
	authorName?: string
): {
	key: string;
	title: string;
	authorKey?: string;
	authorName?: string;
	firstPublishYear?: number;
	subjects?: string[];
	coverIds?: number[];
	imageUrl?: string;
	description?: string;
} {
	const firstPublishYear = work.first_publish_date
		? parseInt(work.first_publish_date.split(/[-,\s]/)[0], 10)
		: undefined;

	const description =
		typeof work.description === 'string' ? work.description : work.description?.value;

	return {
		key: work.key,
		title: work.title,
		authorKey: authorKey,
		authorName: authorName,
		firstPublishYear: firstPublishYear && !isNaN(firstPublishYear) ? firstPublishYear : undefined,
		subjects: work.subjects?.slice(0, 10),
		coverIds: work.covers?.filter((id) => id > 0),
		imageUrl: work.covers?.[0] && work.covers[0] > 0 ? getCoverUrl(work.covers[0], 'M') : undefined,
		description: description
	};
}
