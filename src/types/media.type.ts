/**
 * Media Types
 *
 * Internal types for movies, TV shows, and other media content.
 * These are the normalized internal representations used throughout the app.
 */

import type { ID } from './core.type';

/**
 * Movie representation (normalized from OMDB, TMDB, etc.)
 */
export interface Movie {
	id: string;
	title: string;
	year: number;
	type: 'movie' | 'series' | 'episode';
	poster?: string;
	backdrop?: string;
	plot?: string;
	director?: string;
	actors?: string[];
	genres?: string[];
	rating?: number;
	runtime?: number; // in minutes
	language?: string;
	country?: string;
	awards?: string;
	imdbId?: string;
	tmdbId?: number;
}

/**
 * TV Show representation (normalized from TVMaze, TMDB, etc.)
 */
export interface TVShow {
	id: string;
	name: string;
	status: 'Running' | 'Ended' | 'In Development' | 'To Be Determined' | string;
	premiered?: string; // ISO date
	ended?: string; // ISO date
	genres: string[];
	rating?: number;
	image?: string;
	summary?: string;
	network?: string;
	schedule?: {
		time?: string;
		days?: string[];
	};
	imdbId?: string;
	tvdbId?: number;
	tvRageId?: number;
}

/**
 * TV Episode representation
 */
export interface TVEpisode {
	id: string;
	showId: ID;
	season: number;
	episode: number;
	name: string;
	airdate?: string; // ISO date
	runtime?: number; // in minutes
	image?: string;
	summary?: string;
	rating?: number;
}

/**
 * Cast member representation
 */
export interface CastMember {
	id: string;
	name: string;
	character?: string;
	image?: string;
	order?: number;
}

/**
 * Crew member representation
 */
export interface CrewMember {
	id: string;
	name: string;
	job: string;
	department?: string;
	image?: string;
}

/**
 * Media image representation
 */
export interface MediaImage {
	id: string;
	url: string;
	type: 'poster' | 'backdrop' | 'still' | 'profile' | 'logo';
	width?: number;
	height?: number;
	aspectRatio?: number;
	language?: string;
}
