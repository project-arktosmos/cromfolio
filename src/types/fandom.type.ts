/**
 * Fandom Wiki types for TV show wiki discovery
 */

export interface FandomWiki {
	id: number;
	name: string; // subdomain (e.g., "breakingbad")
	title: string; // display name (e.g., "Breaking Bad Wiki")
	url: string; // full URL
	hub: string; // category (e.g., "Entertainment")
	language: string; // e.g., "en"
	description?: string;
	image?: string; // logo/wordmark
	stats?: FandomWikiStats;
}

export interface FandomWikiStats {
	articles: number;
	pages: number;
	images: number;
	users: number;
	activeUsers: number;
	admins: number;
}

export interface FandomArticle {
	id: number;
	title: string;
	url: string;
	ns: number; // namespace (0=main, 14=category)
	quality?: number;
	snippet?: string;
	thumbnail?: string;
}

export interface FandomArticleSection {
	index: string;
	toclevel: number; // heading depth (1-6)
	level: string;
	line: string; // section title
	number: string; // e.g., "1", "1.1", "2"
	anchor: string; // URL-safe anchor
	content?: string; // HTML content
}

export interface FandomArticleContent {
	id: number;
	title: string;
	url: string;
	revision?: {
		id: number;
		user?: string;
		timestamp?: string;
	};
	sections: FandomArticleSection[];
}

export interface FandomCategory {
	id?: number;
	title: string; // e.g., "Category:Characters"
	size?: number; // page count
	pages?: number;
	files?: number;
	subcats?: number;
}

export interface FandomImage {
	name: string; // e.g., "File:Walter_White.png"
	title: string; // Display title without "File:" prefix
	url: string; // Direct image URL
	descriptionUrl: string; // Wiki page URL for the image
	width?: number;
	height?: number;
	size?: number; // File size in bytes
	mime?: string; // e.g., "image/png"
	thumbUrl?: string; // Thumbnail URL (if requested)
}

export interface FandomSearchResponse<T> {
	data: T;
	fromCache: boolean;
	cacheAge?: number;
}
