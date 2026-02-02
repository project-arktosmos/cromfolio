/**
 * IGDB Adapter
 *
 * Transforms IGDB (Internet Game Database) API responses to internal Game type.
 * IGDB provides comprehensive video game metadata.
 */

import { AdapterClass } from './adapter.class';
import type { Game, GamePlatform, GameCompany, GameGenre } from '$types/game-entity.type';

// ============================================================================
// IGDB API Types
// ============================================================================

/**
 * IGDB cover image
 */
export interface IGDBCover {
	id: number;
	image_id: string;
	url?: string;
	width?: number;
	height?: number;
}

/**
 * IGDB game result
 */
export interface IGDBGameResult {
	id: number;
	name: string;
	slug?: string;
	summary?: string;
	storyline?: string;
	first_release_date?: number; // Unix timestamp
	rating?: number;
	rating_count?: number;
	aggregated_rating?: number;
	aggregated_rating_count?: number;
	total_rating?: number;
	total_rating_count?: number;
	cover?: IGDBCover | number;
	platforms?: Array<{ id: number; name: string; slug?: string; abbreviation?: string }> | number[];
	genres?: Array<{ id: number; name: string; slug?: string }> | number[];
	themes?: Array<{ id: number; name: string; slug?: string }> | number[];
	game_modes?: Array<{ id: number; name: string; slug?: string }> | number[];
	involved_companies?: Array<{
		id: number;
		company: { id: number; name: string; slug?: string };
		developer?: boolean;
		publisher?: boolean;
	}>;
	franchises?: Array<{ id: number; name: string; slug?: string }> | number[];
	url?: string;
	websites?: Array<{ url: string; category: number }>;
}

/**
 * IGDB platform result
 */
export interface IGDBPlatformResult {
	id: number;
	name: string;
	slug?: string;
	abbreviation?: string;
	generation?: number;
	category?: number;
	platform_logo?: { id: number; image_id: string };
}

/**
 * IGDB company result
 */
export interface IGDBCompanyResult {
	id: number;
	name: string;
	slug?: string;
	description?: string;
	logo?: { id: number; image_id: string };
	country?: number;
	start_date?: number;
	websites?: Array<{ url: string; category: number }>;
}

/**
 * IGDB genre result
 */
export interface IGDBGenreResult {
	id: number;
	name: string;
	slug?: string;
}

// ============================================================================
// Constants
// ============================================================================

const IGDB_IMAGE_BASE_URL = 'https://images.igdb.com/igdb/image/upload';

// ============================================================================
// Adapter Implementation
// ============================================================================

class IGDBAdapter extends AdapterClass<IGDBGameResult, Game> {
	constructor() {
		super('igdb');
	}

	/**
	 * Transform IGDB game to internal Game format
	 */
	fromApi(apiData: IGDBGameResult): Game {
		return {
			id: String(apiData.id),
			name: apiData.name,
			slug: apiData.slug || this.slugify(apiData.name),
			summary: apiData.summary,
			storyline: apiData.storyline,
			releaseDate: this.timestampToIso(apiData.first_release_date),
			rating: apiData.total_rating || apiData.rating,
			ratingCount: apiData.total_rating_count || apiData.rating_count,
			aggregatedRating: apiData.aggregated_rating,
			cover: this.buildCoverUrl(apiData.cover),
			platforms: this.extractNames(apiData.platforms),
			genres: this.extractNames(apiData.genres),
			themes: this.extractNames(apiData.themes),
			gameModes: this.extractNames(apiData.game_modes),
			developers: this.extractCompanies(apiData.involved_companies, 'developer'),
			publishers: this.extractCompanies(apiData.involved_companies, 'publisher'),
			franchises: this.extractNames(apiData.franchises),
			igdbId: apiData.id
		};
	}

	/**
	 * Transform IGDB platform to internal GamePlatform format
	 */
	fromPlatform(apiData: IGDBPlatformResult): GamePlatform {
		return {
			id: String(apiData.id),
			name: apiData.name,
			slug: apiData.slug || this.slugify(apiData.name),
			abbreviation: apiData.abbreviation,
			generation: apiData.generation,
			category: this.mapPlatformCategory(apiData.category),
			logo: apiData.platform_logo ? this.buildImageUrl(apiData.platform_logo.image_id) : undefined
		};
	}

	/**
	 * Transform IGDB company to internal GameCompany format
	 */
	fromCompany(apiData: IGDBCompanyResult): GameCompany {
		return {
			id: String(apiData.id),
			name: apiData.name,
			slug: apiData.slug || this.slugify(apiData.name),
			description: apiData.description,
			logo: apiData.logo ? this.buildImageUrl(apiData.logo.image_id) : undefined,
			country: apiData.country,
			startDate: this.timestampToIso(apiData.start_date),
			websites: apiData.websites?.map((w) => w.url)
		};
	}

	/**
	 * Transform IGDB genre to internal GameGenre format
	 */
	fromGenre(apiData: IGDBGenreResult): GameGenre {
		return {
			id: String(apiData.id),
			name: apiData.name,
			slug: apiData.slug || this.slugify(apiData.name)
		};
	}

	/**
	 * Format game for display
	 */
	toDisplayFormat(game: Game): string {
		const year = game.releaseDate ? game.releaseDate.substring(0, 4) : 'TBA';
		return `${game.name} (${year})`;
	}

	// ========================================================================
	// Batch Transformations
	// ========================================================================

	fromPlatformMany(apiDataArray: IGDBPlatformResult[]): GamePlatform[] {
		return apiDataArray.map((item) => this.fromPlatform(item));
	}

	fromCompanyMany(apiDataArray: IGDBCompanyResult[]): GameCompany[] {
		return apiDataArray.map((item) => this.fromCompany(item));
	}

	fromGenreMany(apiDataArray: IGDBGenreResult[]): GameGenre[] {
		return apiDataArray.map((item) => this.fromGenre(item));
	}

	// ========================================================================
	// Private Helpers
	// ========================================================================

	private timestampToIso(timestamp?: number): string | undefined {
		if (!timestamp) {
			return undefined;
		}
		return new Date(timestamp * 1000).toISOString().split('T')[0];
	}

	private buildImageUrl(imageId: string, size: string = 't_cover_big'): string {
		return `${IGDB_IMAGE_BASE_URL}/${size}/${imageId}.jpg`;
	}

	private buildCoverUrl(cover?: IGDBCover | number): string | undefined {
		if (!cover) {
			return undefined;
		}
		if (typeof cover === 'number') {
			return undefined; // Need to fetch cover separately
		}
		return this.buildImageUrl(cover.image_id, 't_cover_big');
	}

	private extractNames(items?: Array<{ name: string }> | number[]): string[] {
		if (!items || items.length === 0) {
			return [];
		}
		// Check if it's array of objects with name property
		if (typeof items[0] === 'object' && 'name' in items[0]) {
			return (items as Array<{ name: string }>).map((i) => i.name);
		}
		return [];
	}

	private extractCompanies(
		companies?: Array<{
			company: { name: string };
			developer?: boolean;
			publisher?: boolean;
		}>,
		role?: 'developer' | 'publisher'
	): string[] {
		if (!companies) {
			return [];
		}
		return companies
			.filter((c) => (role === 'developer' ? c.developer : c.publisher))
			.map((c) => c.company.name);
	}

	private mapPlatformCategory(category?: number): GamePlatform['category'] {
		const categoryMap: Record<number, GamePlatform['category']> = {
			1: 'console',
			2: 'arcade',
			3: 'platform',
			4: 'operating_system',
			5: 'portable_console',
			6: 'computer'
		};
		return categoryMap[category || 0];
	}

	private slugify(text: string): string {
		return text
			.toLowerCase()
			.replace(/[^\w\s-]/g, '')
			.replace(/\s+/g, '-');
	}
}

export const igdbAdapter = new IGDBAdapter();
