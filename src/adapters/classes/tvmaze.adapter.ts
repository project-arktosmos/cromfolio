/**
 * TVMaze Adapter
 *
 * Transforms TVMaze API responses to internal TVShow type.
 * TVMaze provides detailed TV show and episode information.
 */

import { AdapterClass } from './adapter.class';
import type { TVShow, TVEpisode, CastMember } from '$types/media.type';

// ============================================================================
// TVMaze API Types
// ============================================================================

/**
 * TVMaze image object
 */
export interface TVMazeImage {
	medium?: string;
	original?: string;
}

/**
 * TVMaze network object
 */
export interface TVMazeNetwork {
	id: number;
	name: string;
	country?: {
		name: string;
		code: string;
		timezone: string;
	};
}

/**
 * TVMaze schedule object
 */
export interface TVMazeSchedule {
	time?: string;
	days?: string[];
}

/**
 * TVMaze show result
 */
export interface TVMazeShowResult {
	id: number;
	url?: string;
	name: string;
	type?: string;
	language?: string;
	genres?: string[];
	status?: string;
	runtime?: number;
	averageRuntime?: number;
	premiered?: string;
	ended?: string;
	officialSite?: string;
	schedule?: TVMazeSchedule;
	rating?: { average?: number };
	weight?: number;
	network?: TVMazeNetwork;
	webChannel?: TVMazeNetwork;
	dvdCountry?: { name: string; code: string };
	externals?: {
		tvrage?: number;
		thetvdb?: number;
		imdb?: string;
	};
	image?: TVMazeImage;
	summary?: string;
	updated?: number;
}

/**
 * TVMaze episode result
 */
export interface TVMazeEpisodeResult {
	id: number;
	url?: string;
	name: string;
	season: number;
	number: number;
	type?: string;
	airdate?: string;
	airtime?: string;
	airstamp?: string;
	runtime?: number;
	rating?: { average?: number };
	image?: TVMazeImage;
	summary?: string;
}

/**
 * TVMaze cast member result
 */
export interface TVMazeCastResult {
	person: {
		id: number;
		url?: string;
		name: string;
		country?: { name: string; code: string };
		birthday?: string;
		deathday?: string;
		gender?: string;
		image?: TVMazeImage;
	};
	character: {
		id: number;
		url?: string;
		name: string;
		image?: TVMazeImage;
	};
	self?: boolean;
	voice?: boolean;
}

/**
 * TVMaze search result wrapper
 */
export interface TVMazeSearchResult {
	score: number;
	show: TVMazeShowResult;
}

// ============================================================================
// Adapter Implementation
// ============================================================================

class TVMazeAdapter extends AdapterClass<TVMazeShowResult, TVShow> {
	constructor() {
		super('tvmaze');
	}

	/**
	 * Transform TVMaze show to internal TVShow format
	 */
	fromApi(apiData: TVMazeShowResult): TVShow {
		return {
			id: String(apiData.id),
			name: apiData.name,
			status: this.normalizeStatus(apiData.status),
			premiered: apiData.premiered,
			ended: apiData.ended,
			genres: apiData.genres || [],
			rating: apiData.rating?.average,
			image: apiData.image?.original || apiData.image?.medium,
			summary: this.stripHtml(apiData.summary),
			network: apiData.network?.name || apiData.webChannel?.name,
			schedule: apiData.schedule
				? {
						time: apiData.schedule.time,
						days: apiData.schedule.days
					}
				: undefined,
			imdbId: apiData.externals?.imdb,
			tvdbId: apiData.externals?.thetvdb,
			tvRageId: apiData.externals?.tvrage
		};
	}

	/**
	 * Transform TVMaze episode to internal TVEpisode format
	 */
	fromEpisode(apiData: TVMazeEpisodeResult, showId: string | number): TVEpisode {
		return {
			id: String(apiData.id),
			showId: String(showId),
			season: apiData.season,
			episode: apiData.number,
			name: apiData.name,
			airdate: apiData.airdate,
			runtime: apiData.runtime,
			image: apiData.image?.original || apiData.image?.medium,
			summary: this.stripHtml(apiData.summary),
			rating: apiData.rating?.average
		};
	}

	/**
	 * Transform TVMaze cast member to internal CastMember format
	 */
	fromCast(apiData: TVMazeCastResult): CastMember {
		return {
			id: String(apiData.person.id),
			name: apiData.person.name,
			character: apiData.character.name,
			image: apiData.person.image?.original || apiData.person.image?.medium
		};
	}

	/**
	 * Transform search result wrapper
	 */
	fromSearchResult(result: TVMazeSearchResult): TVShow {
		return this.fromApi(result.show);
	}

	/**
	 * Format show for display
	 */
	toDisplayFormat(show: TVShow): string {
		const year = show.premiered ? show.premiered.substring(0, 4) : 'TBA';
		return `${show.name} (${year})`;
	}

	// ========================================================================
	// Batch Transformations
	// ========================================================================

	fromEpisodeMany(apiDataArray: TVMazeEpisodeResult[], showId: string | number): TVEpisode[] {
		return apiDataArray.map((item) => this.fromEpisode(item, showId));
	}

	fromCastMany(apiDataArray: TVMazeCastResult[]): CastMember[] {
		return apiDataArray.map((item) => this.fromCast(item));
	}

	fromSearchResults(results: TVMazeSearchResult[]): TVShow[] {
		return results.map((r) => this.fromSearchResult(r));
	}

	// ========================================================================
	// Private Helpers
	// ========================================================================

	private normalizeStatus(status?: string): TVShow['status'] {
		const statusMap: Record<string, TVShow['status']> = {
			Running: 'Running',
			Ended: 'Ended',
			'To Be Determined': 'To Be Determined',
			'In Development': 'In Development'
		};
		return statusMap[status || ''] || status || 'To Be Determined';
	}

	private stripHtml(html?: string): string | undefined {
		if (!html) {
			return undefined;
		}
		return html.replace(/<[^>]*>/g, '').trim();
	}
}

export const tvmazeAdapter = new TVMazeAdapter();
