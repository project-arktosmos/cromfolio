/**
 * SteamGridDB Adapter
 *
 * Transforms SteamGridDB API responses to internal GameImage type.
 * SteamGridDB provides custom artwork for games (grids, heroes, logos, icons).
 */

import { AdapterClass } from './adapter.class';
import type { GameImage } from '$types/game-entity.type';

// ============================================================================
// SteamGridDB API Types
// ============================================================================

/**
 * SteamGridDB author object
 */
export interface SGDBAuthor {
	name: string;
	steam64?: string;
	avatar?: string;
}

/**
 * SteamGridDB image result (base type for all image types)
 */
export interface SGDBImageResult {
	id: number;
	url: string;
	thumb: string;
	width: number;
	height: number;
	mime?: string;
	language?: string;
	style?: string;
	score?: number;
	upvotes?: number;
	downvotes?: number;
	nsfw?: boolean;
	humor?: boolean;
	epilepsy?: boolean;
	notes?: string;
	author?: SGDBAuthor;
	lock?: boolean;
}

/**
 * SteamGridDB grid result (style values: alternate, blurred, white_logo, material, no_logo)
 */
export type SGDBGridResult = SGDBImageResult;

/**
 * SteamGridDB hero result (style values: alternate, blurred, material)
 */
export type SGDBHeroResult = SGDBImageResult;

/**
 * SteamGridDB logo result (style values: official, white, black, custom)
 */
export type SGDBLogoResult = SGDBImageResult;

/**
 * SteamGridDB icon result (style values: official, custom)
 */
export type SGDBIconResult = SGDBImageResult;

/**
 * SteamGridDB game search result
 */
export interface SGDBGameResult {
	id: number;
	name: string;
	types?: string[];
	verified?: boolean;
	release_date?: number; // Unix timestamp
}

// ============================================================================
// Adapter Implementation
// ============================================================================

class SGDBAdapter extends AdapterClass<SGDBImageResult, GameImage> {
	constructor() {
		super('sgdb');
	}

	/**
	 * Transform SteamGridDB image to internal GameImage format (default: grid)
	 */
	fromApi(apiData: SGDBImageResult): GameImage {
		return this.fromGrid(apiData);
	}

	/**
	 * Transform SteamGridDB grid image
	 */
	fromGrid(apiData: SGDBGridResult): GameImage {
		return this.transformImage(apiData, 'grid');
	}

	/**
	 * Transform SteamGridDB hero image
	 */
	fromHero(apiData: SGDBHeroResult): GameImage {
		return this.transformImage(apiData, 'hero');
	}

	/**
	 * Transform SteamGridDB logo image
	 */
	fromLogo(apiData: SGDBLogoResult): GameImage {
		return this.transformImage(apiData, 'logo');
	}

	/**
	 * Transform SteamGridDB icon image
	 */
	fromIcon(apiData: SGDBIconResult): GameImage {
		return this.transformImage(apiData, 'icon');
	}

	/**
	 * Format image for display
	 */
	toDisplayFormat(image: GameImage): string {
		const authorStr = image.author?.name ? ` by ${image.author.name}` : '';
		return `${image.type} (${image.width}x${image.height})${authorStr}`;
	}

	// ========================================================================
	// Batch Transformations
	// ========================================================================

	fromGridMany(apiDataArray: SGDBGridResult[]): GameImage[] {
		return apiDataArray.map((item) => this.fromGrid(item));
	}

	fromHeroMany(apiDataArray: SGDBHeroResult[]): GameImage[] {
		return apiDataArray.map((item) => this.fromHero(item));
	}

	fromLogoMany(apiDataArray: SGDBLogoResult[]): GameImage[] {
		return apiDataArray.map((item) => this.fromLogo(item));
	}

	fromIconMany(apiDataArray: SGDBIconResult[]): GameImage[] {
		return apiDataArray.map((item) => this.fromIcon(item));
	}

	// ========================================================================
	// Private Helpers
	// ========================================================================

	private transformImage(apiData: SGDBImageResult, type: GameImage['type']): GameImage {
		return {
			id: String(apiData.id),
			url: apiData.url,
			thumbUrl: apiData.thumb,
			type,
			width: apiData.width,
			height: apiData.height,
			style: this.normalizeStyle(apiData.style),
			mimeType: apiData.mime,
			animated: apiData.mime?.includes('gif') || apiData.mime?.includes('webp'),
			nsfw: apiData.nsfw,
			humor: apiData.humor,
			epilepsy: apiData.epilepsy,
			score: apiData.score,
			upvotes: apiData.upvotes,
			downvotes: apiData.downvotes,
			author: apiData.author
				? {
						name: apiData.author.name,
						avatar: apiData.author.avatar
					}
				: undefined
		};
	}

	private normalizeStyle(style?: string): GameImage['style'] {
		const styleMap: Record<string, GameImage['style']> = {
			alternate: 'alternate',
			blurred: 'blurred',
			white_logo: 'white_logo',
			material: 'material',
			no_logo: 'no_logo'
		};
		return styleMap[style || ''];
	}
}

export const sgdbAdapter = new SGDBAdapter();
