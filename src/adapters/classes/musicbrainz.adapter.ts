/**
 * MusicBrainz Adapter
 *
 * Transforms MusicBrainz API responses to internal Artist, Album, and Recording types.
 * MusicBrainz is an open music encyclopedia with detailed metadata.
 */

import { AdapterClass } from './adapter.class';
import type { Artist, Album, Recording, RecordLabel, ReleaseGroup } from '$types/music.type';

// ============================================================================
// MusicBrainz API Types
// ============================================================================

/**
 * MusicBrainz area reference
 */
export interface MBArea {
	id: string;
	name: string;
	'sort-name'?: string;
	'iso-3166-1-codes'?: string[];
	type?: string;
}

/**
 * MusicBrainz life span
 */
export interface MBLifeSpan {
	begin?: string;
	end?: string;
	ended?: boolean;
}

/**
 * MusicBrainz artist result
 */
export interface MBArtistResult {
	id: string;
	name: string;
	'sort-name'?: string;
	type?: string;
	'type-id'?: string;
	country?: string;
	area?: MBArea;
	'begin-area'?: MBArea;
	'end-area'?: MBArea;
	disambiguation?: string;
	'life-span'?: MBLifeSpan;
	gender?: string;
	'gender-id'?: string;
	tags?: Array<{ name: string; count: number }>;
	genres?: Array<{ name: string; count: number }>;
}

/**
 * MusicBrainz artist credit
 */
export interface MBArtistCredit {
	name?: string;
	artist: {
		id: string;
		name: string;
		'sort-name'?: string;
	};
	joinphrase?: string;
}

/**
 * MusicBrainz release (album) result
 */
export interface MBReleaseResult {
	id: string;
	title: string;
	status?: string;
	'status-id'?: string;
	date?: string;
	country?: string;
	barcode?: string;
	'artist-credit'?: MBArtistCredit[];
	'label-info'?: Array<{
		'catalog-number'?: string;
		label?: {
			id: string;
			name: string;
		};
	}>;
	'track-count'?: number;
	'release-group'?: {
		id: string;
		title: string;
		'primary-type'?: string;
		'secondary-types'?: string[];
		'first-release-date'?: string;
	};
	'cover-art-archive'?: {
		artwork: boolean;
		count: number;
		front: boolean;
		back: boolean;
	};
}

/**
 * MusicBrainz recording result
 */
export interface MBRecordingResult {
	id: string;
	title: string;
	length?: number; // in milliseconds
	isrcs?: string[];
	'first-release-date'?: string;
	'artist-credit'?: MBArtistCredit[];
	releases?: MBReleaseResult[];
	tags?: Array<{ name: string; count: number }>;
	genres?: Array<{ name: string; count: number }>;
}

/**
 * MusicBrainz label result
 */
export interface MBLabelResult {
	id: string;
	name: string;
	'sort-name'?: string;
	type?: string;
	country?: string;
	area?: MBArea;
	'life-span'?: MBLifeSpan;
	'label-code'?: number;
}

/**
 * MusicBrainz release group result
 */
export interface MBReleaseGroupResult {
	id: string;
	title: string;
	'primary-type'?: string;
	'secondary-types'?: string[];
	'artist-credit'?: MBArtistCredit[];
	'first-release-date'?: string;
	releases?: MBReleaseResult[];
}

// ============================================================================
// Adapter Implementation
// ============================================================================

class MusicBrainzAdapter extends AdapterClass<MBArtistResult, Artist> {
	constructor() {
		super('musicbrainz');
	}

	/**
	 * Transform MusicBrainz artist to internal Artist format
	 */
	fromApi(apiData: MBArtistResult): Artist {
		return {
			id: apiData.id,
			name: apiData.name,
			sortName: apiData['sort-name'],
			type: this.normalizeArtistType(apiData.type),
			country: apiData.country || apiData.area?.['iso-3166-1-codes']?.[0],
			area: apiData.area?.name,
			beginDate: apiData['life-span']?.begin,
			endDate: apiData['life-span']?.end,
			disambiguation: apiData.disambiguation,
			genres: this.extractTagNames(apiData.genres || apiData.tags),
			tags: this.extractTagNames(apiData.tags),
			mbid: apiData.id
		};
	}

	/**
	 * Transform MusicBrainz release to internal Album format
	 */
	fromRelease(apiData: MBReleaseResult): Album {
		return {
			id: apiData.id,
			title: apiData.title,
			artistCredit: this.formatArtistCredit(apiData['artist-credit']),
			artistIds: apiData['artist-credit']?.map((ac) => ac.artist.id),
			releaseDate: apiData.date,
			releaseType: this.normalizeReleaseType(apiData['release-group']?.['primary-type']),
			status: this.normalizeReleaseStatus(apiData.status),
			country: apiData.country,
			label: apiData['label-info']?.[0]?.label?.name,
			catalogNumber: apiData['label-info']?.[0]?.['catalog-number'],
			barcode: apiData.barcode,
			coverArtUrl: apiData['cover-art-archive']?.front
				? `https://coverartarchive.org/release/${apiData.id}/front`
				: undefined,
			trackCount: apiData['track-count'],
			mbid: apiData.id
		};
	}

	/**
	 * Transform MusicBrainz recording to internal Recording format
	 */
	fromRecording(apiData: MBRecordingResult): Recording {
		return {
			id: apiData.id,
			title: apiData.title,
			artistCredit: this.formatArtistCredit(apiData['artist-credit']),
			artistIds: apiData['artist-credit']?.map((ac) => ac.artist.id),
			lengthMs: apiData.length,
			isrc: apiData.isrcs?.[0],
			firstReleaseDate: apiData['first-release-date'],
			genres: this.extractTagNames(apiData.genres || apiData.tags),
			mbid: apiData.id
		};
	}

	/**
	 * Transform MusicBrainz label to internal RecordLabel format
	 */
	fromLabel(apiData: MBLabelResult): RecordLabel {
		return {
			id: apiData.id,
			name: apiData.name,
			sortName: apiData['sort-name'],
			type: this.normalizeLabelType(apiData.type),
			country: apiData.country || apiData.area?.['iso-3166-1-codes']?.[0],
			beginDate: apiData['life-span']?.begin,
			endDate: apiData['life-span']?.end,
			mbid: apiData.id
		};
	}

	/**
	 * Transform MusicBrainz release group to internal ReleaseGroup format
	 */
	fromReleaseGroup(apiData: MBReleaseGroupResult): ReleaseGroup {
		return {
			id: apiData.id,
			title: apiData.title,
			primaryType: apiData['primary-type'],
			secondaryTypes: apiData['secondary-types'],
			artistCredit: this.formatArtistCredit(apiData['artist-credit']),
			firstReleaseDate: apiData['first-release-date'],
			releaseCount: apiData.releases?.length,
			mbid: apiData.id
		};
	}

	/**
	 * Format artist for display
	 */
	toDisplayFormat(artist: Artist): string {
		const type = artist.type ? ` (${artist.type})` : '';
		return `${artist.name}${type}`;
	}

	// ========================================================================
	// Batch Transformations
	// ========================================================================

	fromReleaseMany(apiDataArray: MBReleaseResult[]): Album[] {
		return apiDataArray.map((item) => this.fromRelease(item));
	}

	fromRecordingMany(apiDataArray: MBRecordingResult[]): Recording[] {
		return apiDataArray.map((item) => this.fromRecording(item));
	}

	fromLabelMany(apiDataArray: MBLabelResult[]): RecordLabel[] {
		return apiDataArray.map((item) => this.fromLabel(item));
	}

	fromReleaseGroupMany(apiDataArray: MBReleaseGroupResult[]): ReleaseGroup[] {
		return apiDataArray.map((item) => this.fromReleaseGroup(item));
	}

	// ========================================================================
	// Private Helpers
	// ========================================================================

	private formatArtistCredit(credits?: MBArtistCredit[]): string | undefined {
		if (!credits || credits.length === 0) {
			return undefined;
		}
		return credits.map((c) => `${c.name || c.artist.name}${c.joinphrase || ''}`).join('');
	}

	private extractTagNames(tags?: Array<{ name: string; count: number }>): string[] {
		if (!tags) {
			return [];
		}
		return tags.sort((a, b) => b.count - a.count).map((t) => t.name);
	}

	private normalizeArtistType(type?: string): Artist['type'] {
		const typeMap: Record<string, Artist['type']> = {
			Person: 'Person',
			Group: 'Group',
			Orchestra: 'Orchestra',
			Choir: 'Choir',
			Character: 'Character',
			Other: 'Other'
		};
		return typeMap[type || ''] || 'Other';
	}

	private normalizeReleaseType(type?: string): Album['releaseType'] {
		const typeMap: Record<string, Album['releaseType']> = {
			Album: 'album',
			Single: 'single',
			EP: 'ep',
			Compilation: 'compilation',
			Soundtrack: 'soundtrack',
			Live: 'live',
			Remix: 'remix'
		};
		return typeMap[type || ''] || 'other';
	}

	private normalizeReleaseStatus(status?: string): Album['status'] {
		const statusMap: Record<string, Album['status']> = {
			Official: 'official',
			Promotion: 'promotion',
			Bootleg: 'bootleg',
			'Pseudo-Release': 'pseudo-release'
		};
		return statusMap[status || ''];
	}

	private normalizeLabelType(type?: string): RecordLabel['type'] {
		const typeMap: Record<string, RecordLabel['type']> = {
			Distributor: 'distributor',
			Holding: 'holding',
			Production: 'production',
			'Original Production': 'original_production',
			'Bootleg Production': 'bootleg_production',
			'Reissue Production': 'reissue_production',
			Publisher: 'publisher'
		};
		return typeMap[type || ''];
	}
}

export const musicbrainzAdapter = new MusicBrainzAdapter();
