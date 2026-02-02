/**
 * Music Types
 *
 * Internal types for artists, albums, and recordings.
 * These are the normalized internal representations used throughout the app.
 */

import type { ID } from './core.type';

/**
 * Music artist representation (normalized from MusicBrainz, etc.)
 */
export interface Artist {
	id: string;
	name: string;
	sortName?: string;
	type?: 'Person' | 'Group' | 'Orchestra' | 'Choir' | 'Character' | 'Other';
	country?: string; // ISO 3166-1 alpha-2
	area?: string;
	beginDate?: string; // ISO date (birth/formation date)
	endDate?: string; // ISO date (death/dissolution date)
	disambiguation?: string;
	genres?: string[];
	tags?: string[];
	mbid?: string; // MusicBrainz ID
}

/**
 * Music album/release representation
 */
export interface Album {
	id: string;
	title: string;
	artistCredit?: string;
	artistIds?: ID[];
	releaseDate?: string; // ISO date
	releaseType?:
		| 'album'
		| 'single'
		| 'ep'
		| 'compilation'
		| 'soundtrack'
		| 'live'
		| 'remix'
		| 'other';
	status?: 'official' | 'promotion' | 'bootleg' | 'pseudo-release';
	country?: string;
	label?: string;
	catalogNumber?: string;
	barcode?: string;
	coverArtUrl?: string;
	trackCount?: number;
	genres?: string[];
	mbid?: string; // MusicBrainz ID
}

/**
 * Music recording/track representation
 */
export interface Recording {
	id: string;
	title: string;
	artistCredit?: string;
	artistIds?: ID[];
	lengthMs?: number; // duration in milliseconds
	isrc?: string; // International Standard Recording Code
	firstReleaseDate?: string;
	genres?: string[];
	mbid?: string; // MusicBrainz ID
}

/**
 * Music label representation
 */
export interface RecordLabel {
	id: string;
	name: string;
	sortName?: string;
	type?:
		| 'distributor'
		| 'holding'
		| 'production'
		| 'original_production'
		| 'bootleg_production'
		| 'reissue_production'
		| 'publisher';
	country?: string;
	beginDate?: string;
	endDate?: string;
	mbid?: string;
}

/**
 * Music release group representation
 */
export interface ReleaseGroup {
	id: string;
	title: string;
	primaryType?: string;
	secondaryTypes?: string[];
	artistCredit?: string;
	firstReleaseDate?: string;
	releaseCount?: number;
	mbid?: string;
}

/**
 * Union type for all music entities
 */
export type MusicEntity = Artist | Album | Recording;

/**
 * Type guard to check if entity is an Artist
 */
export function isArtist(entity: MusicEntity): entity is Artist {
	return 'sortName' in entity || 'beginDate' in entity;
}

/**
 * Type guard to check if entity is an Album
 */
export function isAlbum(entity: MusicEntity): entity is Album {
	return 'releaseType' in entity || 'trackCount' in entity;
}

/**
 * Type guard to check if entity is a Recording
 */
export function isRecording(entity: MusicEntity): entity is Recording {
	return 'lengthMs' in entity || 'isrc' in entity;
}
